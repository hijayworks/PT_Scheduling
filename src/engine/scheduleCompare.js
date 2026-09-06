import { SLOT_MIN } from "../constants.js";
import { durationToSlots } from "../utils.js";
import { totalTravelCount, totalTravelMinutes, TRAVEL_VALUE_MINUTES } from "./greedy.js";
import { requiredGapMin2 } from "./chainDpCore.js";

// "수업 스케줄 생성2" 결과끼리 비교하고 서명(중복 판별)하는 순수 함수 모음. chainDp.js(카드
// 재시작 오케스트레이션)가 요일 순서 후보·다듬은 결과를 고를 때 이 모듈에 의존한다.

// result가 better보다 더 나은 결과인지 비교한다: 미배정 회원 수(적을수록) → 수업 수(많을수록)
// → 이동 횟수(적을수록) → 총 이동 시간(적을수록) 순.
export function isSchedule2ResultBetter(a, b) {
  if (a.unassignedMembers.length !== b.unassignedMembers.length) {
    return a.unassignedMembers.length < b.unassignedMembers.length;
  }
  if (a.assigned.length !== b.assigned.length)
    return a.assigned.length > b.assigned.length;
  const travelCountA = totalTravelCount(a.assigned),
    travelCountB = totalTravelCount(b.assigned);
  const idleA = schedule2TotalIdleMinutes(a.assigned),
    idleB = schedule2TotalIdleMinutes(b.assigned);
  if (travelCountA !== travelCountB) {
    // 이동 횟수가 다르면 무조건 이동이 적은 쪽을 이기게 하지 않고, 이동 1번의 가치를
    // 빈 시간 TRAVEL_VALUE_MINUTES분으로 쳐서 하나의 점수로 합쳐 비교한다 — 이동을
    // 줄이는 대가로 늘어난 빈 시간이 그보다 크면 오히려 더 나쁜 것으로 친다.
    const netA = travelCountA * TRAVEL_VALUE_MINUTES + idleA;
    const netB = travelCountB * TRAVEL_VALUE_MINUTES + idleB;
    if (netA !== netB) return netA < netB;
  }
  const travelMinA = totalTravelMinutes(a.assigned),
    travelMinB = totalTravelMinutes(b.assigned);
  if (travelMinA !== travelMinB) return travelMinA < travelMinB;
  return idleA < idleB;
}

// isSchedule2ResultBetter 중 앞 두 기준(미배정 수 → 수업 수)만으로 a가 b보다 나은지 본다.
// 후보A-1/A-2/A-3(runSchedule2RestartGroup)가 "카드 간 목표 공유"에 쓴다 — 이동 횟수 등
// 나머지 지표는 카드마다 골격 자체가 달라 서로 비교할 대상이 아니기 때문에 뺀다. b가 없으면
// (아직 어떤 카드도 끝나지 않았으면) 항상 true.
export function floorIsBetter(a, b) {
  if (!b) return true;
  if (a.unassignedMembers.length !== b.unassignedMembers.length) {
    return a.unassignedMembers.length < b.unassignedMembers.length;
  }
  return a.assigned.length > b.assigned.length;
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
