// 고정(사용자가 옮기거나 확정한) 세션 정책의 단일 소유자. 고정 세션은 "같은 회원이 같은 요일·
// 시작 시각·지점에 그대로 남는" 배정이다 — 재최적화(5a)는 고정 세션을 그대로 두고 나머지만 다시
// 짠다. 엔진(greedy.js·chainDpPolish.js)은 고정 세션을 변경 대상으로 고르지 않고 회원 주간 횟수에
// 이미 사용된 수업으로 계산하며, 최종 결과는 missingPins로 다시 검사한다(가중치는 보장이 아니다).

// 고정 세션의 위치 식별자. request id는 시작 시각과 1:1이지만 지점은 담지 않으므로 지점까지 묶는다.
export function pinKey(r) {
  return r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId;
}

// 후보(assigned + confirmedIds)에서 고정 세션을 꺼낸다. confirmedIds에 있지만 배정에 없는 id(가리킬
// 세션이 없는 옛 참조)는 고정할 대상이 없으므로 무시한다.
export function pinsFromResult(result) {
  const ids = new Set((result && result.confirmedIds) || []);
  return result.assigned
    .filter((r) => ids.has(r.id))
    .map((r) => ({
      id: r.id,
      memberId: r.memberId,
      day: r.day,
      startSlot: r.startSlot,
      duration: r.duration,
      locationId: r.locationId,
    }));
}

// 결과에서 같은 자리로 남지 않은 고정 세션 목록(빈 배열이면 모두 유지). 재최적화 최종 gate.
export function missingPins(assigned, pins) {
  if (!pins || pins.length === 0) return [];
  const keys = new Set(assigned.map(pinKey));
  return pins.filter((p) => !keys.has(pinKey(p)));
}
