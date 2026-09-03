import { state } from "./state.js";

// "수업 스케줄 생성3"이 생성1·생성2의 엔진 함수(greedyAssign, runSchedule2Pipeline 등)를
// 코드 복제 없이 그대로 재사용하기 위한 장치. 그 엔진들은 "미배정 회원"/"1회 제한 회원" 목록을
// 파라미터가 아니라 이 오버라이드에서 직접 읽는 지점이 여러 곳(엔진 얕은 진입점뿐 아니라
// 그리디 DP·체인 DP 내부 깊숙이도) 있다. 그 모든 지점을 일일이 파라미터로 바꾸는 대신,
// generateSchedule3Async가 호출을 감싸는 동안만 "지금 봐야 할 목록"을 여기에 담아두고
// finally에서 즉시 비운다.
let selectionOverride = null; // { excludedIds: string[], onceLimitIds: string[] } | null

export async function withSelectionOverride(
  excludedIds,
  onceLimitIds,
  asyncFn,
) {
  const prev = selectionOverride;
  selectionOverride = {
    excludedIds: excludedIds.slice(),
    onceLimitIds: onceLimitIds.slice(),
  };
  try {
    return await asyncFn();
  } finally {
    selectionOverride = prev;
  }
}

// 엔진 함수들은 생성 계산 자체는 항상 withSelectionOverride로 감싼 호출 안에서 실행되지만,
// renderSchedule3Result()의 "재생성 가능" 표시(hasRegenerableEligible → isEligibleRequest)는
// 계산이 끝나 override가 풀린 뒤에도 호출된다 — 그 시점엔 생성3 페이지의 현재 선택값
// (state.excludedMemberIds3/onceLimitedMemberIds3)으로 대체한다.
export function currentExcludedIds() {
  return selectionOverride
    ? selectionOverride.excludedIds
    : state.excludedMemberIds3;
}
export function currentOnceLimitIds() {
  return selectionOverride
    ? selectionOverride.onceLimitIds
    : state.onceLimitedMemberIds3;
}
export function currentExcludedIds2() {
  return selectionOverride
    ? selectionOverride.excludedIds
    : state.excludedMemberIds3;
}
export function currentOnceLimitIds2() {
  return selectionOverride
    ? selectionOverride.onceLimitIds
    : state.onceLimitedMemberIds3;
}
