import { SLOT_MIN } from "../constants.js";
import { durationToSlots } from "../utils.js";
import {
  totalTravelCount,
  totalTravelMinutes,
  totalInefficientMoveCount,
  TRAVEL_VALUE_MINUTES,
  SESSION_VALUE_MINUTES,
} from "./greedy.js";
import { requiredGapMin2, isIdleFirst } from "./chainDpCore.js";
import { soloTravelMemberIds, chainBreaksSoloTravel } from "../domain.js";

// "수업 스케줄 생성2" 결과끼리 비교하고 서명(중복 판별)하는 순수 함수 모음. chainDp.js(카드
// 재시작 오케스트레이션)가 요일 순서 후보·다듬은 결과를 고를 때 이 모듈에 의존한다.

// result가 better보다 더 나은 결과인지 비교한다: 미배정 회원 수(적을수록) → 비효율 이동
// 횟수(적을수록) → 수업 수·이동 횟수·빈 시간 환산 점수 → 수업 수 → 이동 횟수 → 총 이동
// 시간 → 빈 시간 순. 환산 점수는 수업 1건 = SESSION_VALUE_MINUTES분, 이동 1번 =
// TRAVEL_VALUE_MINUTES분 — 수업 1건을 더 넣는 대가로 이동이 2번 늘면 더 나쁜 것으로 친다.
export function isSchedule2ResultBetter(a, b) {
  if (a.unassignedMembers.length !== b.unassignedMembers.length) {
    return a.unassignedMembers.length < b.unassignedMembers.length;
  }
  const ineffA = totalInefficientMoveCount(a.assigned),
    ineffB = totalInefficientMoveCount(b.assigned);
  if (ineffA !== ineffB) return ineffA < ineffB;
  const travelCountA = totalTravelCount(a.assigned),
    travelCountB = totalTravelCount(b.assigned);
  const idleA = schedule2TotalIdleMinutes(a.assigned),
    idleB = schedule2TotalIdleMinutes(b.assigned);
  // 빈 시간 최소화 카드: 이동 횟수는 점수에 넣지 않고 수업 수와 빈 시간만 환산해 비교한다.
  const travelWeight = isIdleFirst() ? 0 : TRAVEL_VALUE_MINUTES;
  const netA =
    travelCountA * travelWeight +
    idleA -
    a.assigned.length * SESSION_VALUE_MINUTES;
  const netB =
    travelCountB * travelWeight +
    idleB -
    b.assigned.length * SESSION_VALUE_MINUTES;
  if (netA !== netB) return netA < netB;
  if (a.assigned.length !== b.assigned.length)
    return a.assigned.length > b.assigned.length;
  if (travelCountA !== travelCountB) return travelCountA < travelCountB;
  const travelMinA = totalTravelMinutes(a.assigned),
    travelMinB = totalTravelMinutes(b.assigned);
  if (travelMinA !== travelMinB) return travelMinA < travelMinB;
  return idleA < idleB;
}

// 수업 1건을 빼보고 isSchedule2ResultBetter 기준으로 나아지면 실제로 뺀다(더 나아지지 않을
// 때까지 반복). 예: 상암점 단독 수업 1건 때문에 이동이 2번 생겼다면 그 1건을 빼는 편이 낫다.
// 그 회원의 유일한 수업은 빼지 않는다 — 미배정이 늘어나기 때문이다.
// ponytail: 빼기만 하고 나머지 수업은 재배치하지 않는다. 뺀 자리를 활용한 재배치까지 보려면
// 다듬기 예산 일부를 떼어 "빼고 다시 다듬기"를 추가한다.
export function dropSessionsForBalance(result) {
  // 수업을 빼면 그 요일의 앞뒤 수업이 새로 이어지며 이동시간이 모자라거나(누락된 지점 쌍이면
  // 연결 불가) 이동-회원-이동이 생길 수 있다 — 그런 제거는 후보에서 뺀다.
  const soloIds = soloTravelMemberIds();
  const dayAllowed = (assigned, day) => {
    const chain = assigned
      .filter((x) => x.day === day)
      .sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1],
        cur = chain[i];
      const gapMin =
        (cur.startSlot - prev.startSlot - durationToSlots(prev.duration)) *
        SLOT_MIN;
      if (gapMin < requiredGapMin2(prev.locationId, cur.locationId))
        return false;
    }
    return !chainBreaksSoloTravel(chain, soloIds);
  };
  let cur = result;
  for (;;) {
    const sessionsByMember = new Map();
    cur.assigned.forEach((r) =>
      sessionsByMember.set(
        r.memberId,
        (sessionsByMember.get(r.memberId) || 0) + 1,
      ),
    );
    let best = cur;
    cur.assigned.forEach((r) => {
      if (sessionsByMember.get(r.memberId) < 2) return;
      const cand = { ...cur, assigned: cur.assigned.filter((x) => x !== r) };
      if (!dayAllowed(cand.assigned, r.day)) return;
      if (isSchedule2ResultBetter(cand, best)) best = cand;
    });
    if (best === cur) return cur;
    cur = best;
  }
}

// 미배정 수만으로 a가 b보다 나은지 본다. 후보A 카드들(runSchedule2RestartGroup)이 "카드 간
// 목표 공유"에 쓴다 — 수업 수는 이동·빈 시간과 환산해 비교하므로(isSchedule2ResultBetter)
// 수업 수만 따로 하한으로 강제하지 않는다. b가 없으면(아직 어떤 카드도 끝나지 않았으면) 항상 true.
export function floorIsBetter(a, b) {
  if (!b) return true;
  return a.unassignedMembers.length < b.unassignedMembers.length;
}

// 다듬기(5~9단계, 특히 담금질 기법)는 "미배정 수·수업 수는 그대로 둔 채 이동·빈 시간만
// 줄이는" 국소 탐색이라, 다듬은 뒤 결과가 실제로 얼마나 좋아지는지는 다듬기 전 배치의
// 구조(누가 어느 요일에 배정됐는지)에 따라 달라진다 — 다듬기 전 지표(미배정·수업 수·이동
// 횟수)가 완전히 같은 두 요일 순서라도, 한쪽만 다듬으면 이동이 더 줄어드는 경우가 있다
// (실제로 수동으로 짠 스케줄이 이 지표까지는 같은데 이동을 1번 더 줄인 사례로 확인됨).
// 그래서 다듬기 전 지표가 가장 좋은 순서 "하나"만 고르지 않고, 지표 상위권의 다른 요일
// 순서도(완전 동점이 아니어도) 함께 모아 각각 다듬어본 뒤, 실제로 다듬은 결과끼리 비교해
// 가장 좋은 것을 택한다(자세한 선정 기준은 chainDp.js의 generateSchedule2Async 참고). 상위권
// 후보가 아주 많을 수 있으므로(무작위 순서 400개 중 다수가 비슷한 지표에 도달하는 경우가
// 흔하다), 서로 다른 배치(신청 서명이 다른 것)만 최대 개수까지만 추려 다듬는다 — 그래야
// 다듬기 시간 예산이 후보 수만큼 무한정 쪼개지지 않는다.
export function schedule2Signature(result) {
  return result.assigned
    .map(
      (r) => r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId,
    )
    .sort()
    .join(",");
}

// 같은 요일 안에서 연속된 두 세션 사이, 이동 블록이 차지하는 구간을 뺀 나머지
// "진짜 빈 시간"을 회색 배경의 빈 시간 블록으로 그리드에 표시하기 위한 좌표를 만든다.
// (이동 블록과 겹치거나 빈틈이 생기지 않도록, 이동 블록 렌더링과 동일한 반올림을 쓴다.)
export function schedule2ToIdleBlocks(assigned) {
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  const idleBlocks = [];
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1],
        cur = sorted[i];
      // 실제 스케줄링 제약(requiredGapMin2)과 같은 반올림을 써야, 알고리즘이 실제로 예약해둔
      // 이동 시간과 화면에 표시되는 "빈 시간" 시작 지점이 어긋나지 않는다.
      const travelSlots =
        requiredGapMin2(prev.locationId, cur.locationId) / SLOT_MIN;
      const idleStartSlot =
        prev.startSlot + durationToSlots(prev.duration) + travelSlots;
      const idleEndSlot = cur.startSlot;
      if (idleEndSlot > idleStartSlot) {
        const mins = (idleEndSlot - idleStartSlot) * SLOT_MIN;
        idleBlocks.push({
          day: prev.day,
          startSlot: idleStartSlot,
          duration: mins,
          label: "빈 시간 " + mins + "분",
          type: "idle",
        });
      }
    }
  });
  return idleBlocks;
}

// 같은 요일 안에서 연속된 두 세션 사이 간격 중, 이동에 실제로 필요한 시간을 넘어서는
// "진짜 빈 시간"만 합산한다 — 이동으로 이미 설명되는 구간은 빈 시간으로 치지 않는다.
export function schedule2TotalIdleMinutes(assigned) {
  let idle = 0;
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1],
        cur = sorted[i];
      const gapMin =
        (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) *
        SLOT_MIN;
      const needMin = requiredGapMin2(prev.locationId, cur.locationId);
      idle += Math.max(0, gapMin - needMin);
    }
  });
  return idle;
}
