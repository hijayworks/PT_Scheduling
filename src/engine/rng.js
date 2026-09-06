// 후보A(체인DP) 탐색·다듬기가 공용으로 쓰는 시드 기반 의사난수 유틸.
// 순수 함수라 chainDp.js(카드 재시작)와 chainDpPolish.js(다듬기 파이프라인) 양쪽에서
// 그대로 재사용한다.

// 시드가 있는 간단한 의사난수 생성기 — 매번 다른 배열 셔플을 만들되, 필요하면 재현 가능하게.
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(arr, randomFn) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
