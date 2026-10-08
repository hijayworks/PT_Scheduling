// 골든 데이터셋의 품질 하한(expect) 판정. tests/golden.js가 쓰고, 래칫 규칙(하한은 올라가기만
// 한다)은 tests/unit.js가 검사한다.
"use strict";

// expect 키 → [지표, 방향]. 방향 "max"는 지표가 하한값 이하여야, "min"은 이상이어야 통과.
const FLOOR_KEYS = {
  maxUnassigned: ["unassigned", "max"],
  minSessions: ["sessions", "min"],
  maxInefficientMoves: ["inefficientMoves", "max"],
  maxTravelCount: ["travelCount", "max"],
  maxIdleMinutes: ["idleMinutes", "max"],
};
const FLOOR_CANDIDATES = ["B", "C"];
const meetsFloor = (fk, value, bound) =>
  FLOOR_KEYS[fk][1] === "max" ? value <= bound : value >= bound;
function floorsFrom(m) {
  const floors = {};
  Object.entries(FLOOR_KEYS).forEach(
    ([k, [metric]]) => (floors[k] = m[metric]),
  );
  return floors;
}

// 새 하한(next)이 기존 하한(prev)보다 느슨해지는 항목을 돌려준다. 하한은 올라가기만 해야 한다 —
// 품질이 나빠진 결과를 그대로 기록해 버리면 골든이 회귀를 못 잡게 된다.
function floorRegressions(id, prev, next) {
  if (!prev) return [];
  if (prev.attempts !== next.attempts)
    return [
      `${id}: 기존 하한은 시도 ${prev.attempts}회 기준 — 기준 횟수를 바꾸려면 --allow-regression 필요`,
    ];
  const out = [];
  FLOOR_CANDIDATES.forEach((key) =>
    Object.entries(prev[key] || {}).forEach(([fk, bound]) => {
      if (!meetsFloor(fk, next[key][fk], bound))
        out.push(`${id} ${key}: ${fk} ${bound} → ${next[key][fk]} (나빠짐)`);
    }),
  );
  return out;
}

module.exports = {
  FLOOR_KEYS,
  FLOOR_CANDIDATES,
  meetsFloor,
  floorsFrom,
  floorRegressions,
};
