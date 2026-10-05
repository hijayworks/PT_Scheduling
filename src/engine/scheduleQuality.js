import {
  SLOT_MIN,
  START_MIN,
  BREAK_MIN,
  MAX_TRAVELS_PER_DAY,
} from "../constants.js";
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

// 어떤 엔진·시드·입력이든 생성된 후보가 반드시 지켜야 하는 하드 제약(업무 규칙 문장). 골든
// 데이터셋·퍼즈 테스트가 규칙별로 위반을 집계한다.
export const HARD_RULES = {
  notRequested: "회원이 신청한 시간에만 배정한다",
  excluded: "제외 회원은 배정하지 않는다",
  location: "허용된 지점에만 배정한다",
  availability: "근무 가능 시간에만 배정한다",
  maxSessions: "최대 수업 횟수를 넘지 않는다",
  sameDay: "같은 회원은 하루 2회 배정되지 않는다",
  gap: "수업끼리 겹치지 않고, 다른 지점 사이에는 이동시간을 확보한다",
  dailyTravel: `하루 이동은 ${MAX_TRAVELS_PER_DAY}회를 넘지 않는다`,
  soloTravel: "세 지점 회원은 이동-회원-이동으로 배정하지 않는다",
  unassigned: "미배정 목록과 실제 배정 상태가 일치한다",
};

// 하드 제약 위반 목록 [{rule, message}]을 돌려준다 — 빈 배열이면 정상.
export function scheduleViolations(result) {
  const out = [];
  const add = (rule, detail) =>
    out.push({ rule, message: `${HARD_RULES[rule]} — ${detail}` });
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
      add("notRequested", where(r));
      return;
    }
    if (excluded.has(r.memberId)) add("excluded", where(r));
    if (!candidateLocationsForRequest(req).includes(r.locationId))
      add("location", `${where(r)} ${r.locationId}`);
    for (let i = 0; i < durationToSlots(r.duration); i++) {
      if (!runtime.availableCells.has(cellKey(r.day, r.startSlot + i))) {
        add("availability", where(r));
        break;
      }
    }
  });

  sessionsByMember.forEach((n, id) => {
    const max = maxSessionsFor(memberById(id));
    if (n > max) add("maxSessions", `${id} ${n}회 > ${max}회`);
  });

  byDaySorted(result.assigned).forEach((reqs, day) => {
    const seen = new Set();
    reqs.forEach((r) => {
      if (seen.has(r.memberId)) add("sameDay", where(r));
      seen.add(r.memberId);
    });
    for (let i = 1; i < reqs.length; i++) {
      const prev = reqs[i - 1],
        cur = reqs[i];
      const gapMin =
        (cur.startSlot - prev.startSlot - durationToSlots(prev.duration)) *
        SLOT_MIN;
      // 엔진의 requiredGapMin(격자 올림 포함)을 빌려 쓰지 않고 정책 원천(이동시간·쉬는 시간)에서
      // 직접 계산한다 — 엔진 함수가 틀리면 검사기도 같이 틀려 위반을 못 잡기 때문이다(퍼즈
      // 변형 시험으로 확인됨). 이동시간이 없으면(Infinity) 어떤 간격으로도 연속 배정할 수 없다.
      if (
        gapMin < BREAK_MIN ||
        gapMin < travelMinutes(prev.locationId, cur.locationId)
      )
        add("gap", `${where(prev)} → ${where(cur)}`);
    }
    let travels = 0;
    for (let i = 1; i < reqs.length; i++)
      if (travelMinutes(reqs[i - 1].locationId, reqs[i].locationId) > 0)
        travels++;
    if (travels > MAX_TRAVELS_PER_DAY) add("dailyTravel", `${day}요일`);
    for (let i = 1; i + 1 < reqs.length; i++) {
      const r = reqs[i];
      if (
        soloIds.has(r.memberId) &&
        travelMinutes(reqs[i - 1].locationId, r.locationId) > 0 &&
        travelMinutes(r.locationId, reqs[i + 1].locationId) > 0
      )
        add("soloTravel", where(r));
    }
  });

  const assignedIds = new Set(sessionsByMember.keys());
  const expectedUnassigned = targetMemberIds()
    .filter((id) => !assignedIds.has(id))
    .sort();
  const reportedUnassigned = result.unassignedMembers.map((m) => m.id).sort();
  if (expectedUnassigned.join() !== reportedUnassigned.join())
    add(
      "unassigned",
      `실제 [${expectedUnassigned}] / 보고 [${reportedUnassigned}]`,
    );
  return out;
}
