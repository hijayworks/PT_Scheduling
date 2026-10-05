import { SLOT_MIN, START_MIN, MAX_TRAVELS_PER_DAY } from "../constants.js";
import { cellKey, durationToSlots } from "../utils.js";
import { state, runtime } from "../state.js";
import {
  memberById,
  maxSessionsFor,
  soloTravelMemberIds,
  travelMinutes,
} from "../domain.js";
import { currentExcludedIds } from "../selectionOverride.js";
import {
  candidateLocationsForRequest,
  requiredGapMin,
  dailyTravelCount,
  totalTravelCount,
  totalTravelMinutes,
  totalInefficientMoveCount,
} from "./greedy.js";
import { schedule2TotalIdleMinutes } from "./scheduleCompare.js";

// 생성된 후보({assigned, unassignedMembers}, 후보A·B·C 공통 형태)가 사용자 입장에서 얼마나
// 좋은지를 숫자로 계산하고(scheduleMetrics), 어떤 후보든 반드시 지켜야 하는 하드 제약을
// 엔진과 독립적으로 다시 검사한다(scheduleViolations). 엔진 비교 함수(isSchedule2ResultBetter
// 등)는 "어느 쪽이 나은가"만 답하므로, 엔진을 바꿨을 때 결과가 얼마나 달라졌는지는 여기서 본다.
// 둘 다 현재 state·runtime·selectionOverride(제외/1회 제한 회원)를 읽는다.

function byDaySorted(assigned) {
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  byDay.forEach((reqs) => reqs.sort((a, b) => a.startSlot - b.startSlot));
  return byDay;
}

// 배정 대상 회원: 제외되지 않았고 신청을 하나라도 낸 회원(엔진의 "미배정" 정의와 같다).
function targetMemberIds() {
  const excluded = new Set(currentExcludedIds());
  const submitted = new Set(state.requests.map((r) => r.memberId));
  return state.members
    .filter((m) => submitted.has(m.id) && !excluded.has(m.id))
    .map((m) => m.id);
}

export function scheduleMetrics(result) {
  const assigned = result.assigned;
  const sessionsByMember = new Map();
  assigned.forEach((r) =>
    sessionsByMember.set(
      r.memberId,
      (sessionsByMember.get(r.memberId) || 0) + 1,
    ),
  );
  const targets = targetMemberIds();
  // 2회까지 받을 수 있는데 1회만 받은 회원(상담·1회 제한 회원은 원래 1회라 제외).
  const onceOnly = targets.filter(
    (id) =>
      sessionsByMember.get(id) === 1 && maxSessionsFor(memberById(id)) > 1,
  ).length;
  let longestIdleMinutes = 0;
  let spanMinutes = 0;
  let lastEndMinute = 0; // 가장 늦은 수업 종료 시각(자정 기준 분)
  byDaySorted(assigned).forEach((reqs) => {
    for (let i = 1; i < reqs.length; i++) {
      const prev = reqs[i - 1],
        cur = reqs[i];
      const gap =
        (cur.startSlot - prev.startSlot - durationToSlots(prev.duration)) *
          SLOT_MIN -
        requiredGapMin(prev.locationId, cur.locationId);
      longestIdleMinutes = Math.max(longestIdleMinutes, gap);
    }
    const first = reqs[0],
      last = reqs[reqs.length - 1];
    const endMin = last.startSlot * SLOT_MIN + last.duration;
    spanMinutes += endMin - first.startSlot * SLOT_MIN;
    lastEndMinute = Math.max(lastEndMinute, START_MIN + endMin);
  });
  return {
    targetMembers: targets.length,
    assignedMembers: targets.filter((id) => sessionsByMember.has(id)).length,
    unassigned: result.unassignedMembers.length,
    sessions: assigned.length,
    onceOnly,
    travelCount: totalTravelCount(assigned),
    travelMinutes: totalTravelMinutes(assigned),
    inefficientMoves: totalInefficientMoveCount(assigned),
    idleMinutes: schedule2TotalIdleMinutes(assigned),
    longestIdleMinutes,
    workDays: new Set(assigned.map((r) => r.day)).size,
    spanMinutes,
    lastEndMinute,
  };
}

// 하드 제약 위반 목록(문자열)을 돌려준다 — 빈 배열이면 정상. 어떤 엔진·시드·입력이든 생성된
// 후보는 이걸 통과해야 한다(골든 데이터셋·퍼즈 테스트 공용 판정 기준).
export function scheduleViolations(result) {
  const out = [];
  const requestsById = new Map(state.requests.map((r) => [r.id, r]));
  const excluded = new Set(currentExcludedIds());
  const soloIds = soloTravelMemberIds();
  const sessionsByMember = new Map();
  const where = (r) => `${r.memberId}@${r.day}-${r.startSlot}`;

  result.assigned.forEach((r) => {
    sessionsByMember.set(
      r.memberId,
      (sessionsByMember.get(r.memberId) || 0) + 1,
    );
    const req = requestsById.get(r.id);
    if (
      !req ||
      req.memberId !== r.memberId ||
      req.day !== r.day ||
      req.startSlot !== r.startSlot
    ) {
      out.push(`신청하지 않은 시간에 배정: ${where(r)}`);
      return;
    }
    if (excluded.has(r.memberId)) out.push(`제외 회원 배정: ${where(r)}`);
    if (!candidateLocationsForRequest(req).includes(r.locationId))
      out.push(`허용되지 않은 지점: ${where(r)} ${r.locationId}`);
    for (let i = 0; i < durationToSlots(r.duration); i++) {
      if (!runtime.availableCells.has(cellKey(r.day, r.startSlot + i))) {
        out.push(`근무 불가 시간에 배정: ${where(r)}`);
        break;
      }
    }
  });

  sessionsByMember.forEach((n, id) => {
    const max = maxSessionsFor(memberById(id));
    if (n > max) out.push(`최대 횟수 초과: ${id} ${n}회 > ${max}회`);
  });

  byDaySorted(result.assigned).forEach((reqs, day) => {
    const seen = new Set();
    reqs.forEach((r) => {
      if (seen.has(r.memberId)) out.push(`같은 날 2회 배정: ${where(r)}`);
      seen.add(r.memberId);
    });
    for (let i = 1; i < reqs.length; i++) {
      const prev = reqs[i - 1],
        cur = reqs[i];
      const gapMin =
        (cur.startSlot - prev.startSlot - durationToSlots(prev.duration)) *
        SLOT_MIN;
      // 이동시간이 없으면(Infinity) 어떤 간격으로도 연속 배정할 수 없다.
      if (gapMin < requiredGapMin(prev.locationId, cur.locationId))
        out.push(`겹침 또는 이동시간 부족: ${where(prev)} → ${where(cur)}`);
    }
    if (dailyTravelCount(reqs) > MAX_TRAVELS_PER_DAY)
      out.push(`하루 이동 ${MAX_TRAVELS_PER_DAY}회 초과: ${day}요일`);
    for (let i = 1; i + 1 < reqs.length; i++) {
      const r = reqs[i];
      if (
        soloIds.has(r.memberId) &&
        travelMinutes(reqs[i - 1].locationId, r.locationId) > 0 &&
        travelMinutes(r.locationId, reqs[i + 1].locationId) > 0
      )
        out.push(`세 지점 회원의 이동-회원-이동 배정: ${where(r)}`);
    }
  });

  const assignedIds = new Set(sessionsByMember.keys());
  const expectedUnassigned = targetMemberIds()
    .filter((id) => !assignedIds.has(id))
    .sort();
  const reportedUnassigned = result.unassignedMembers.map((m) => m.id).sort();
  if (expectedUnassigned.join() !== reportedUnassigned.join())
    out.push(
      `미배정 목록 불일치: 실제 [${expectedUnassigned}] / 보고 [${reportedUnassigned}]`,
    );
  return out;
}
