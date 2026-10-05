// 후보 다양성 측정용 순수 함수(tests/diversity.js가 쓰고 tests/unit.js가 검증한다). 후보는
// {key, result: {assigned, unassignedMembers}, metrics: scheduleMetrics 결과}.
//
// 두 후보의 관계를 넷 중 하나로 나눈다:
//   duplicate     배정(회원·요일·시작 시각·지점)이 완전히 같다
//   same-quality  배정은 다르지만 주요 품질 지표가 전부 같다(구조만 다른 배치)
//   dominated     한쪽이 모든 주요 지표에서 같거나 낫고 하나 이상에서 낫다
//   trade-off     서로 나은 지표가 따로 있다
//
// 지배 판정 축·배치 서명은 앱의 후보 선정 정책(src/engine/candidateSelection.js)을 그대로 쓴다.
// 이 모듈을 부르기 전에 lib을 불러야 한다(caseRunner가 예산 전역을 정한 뒤 불러온다).
"use strict";

const {
  QUALITY_AXES,
  layoutSignature: signature,
  qualityKey: qualityType,
} = require("./loadLib.js");

const sessionKey = (r) =>
  `${r.memberId}|${r.day}|${r.startSlot}|${r.locationId}`;
const memberDayKey = (r) => `${r.memberId}|${r.day}`;

// 두 배정 목록의 겹침 비율(교집합/합집합). 둘 다 비었으면 1.
function jaccard(a, b) {
  const A = new Set(a),
    B = new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  return inter / (A.size + B.size - inter);
}

// b가 a보다 나은 지표·나쁜 지표의 이름.
function metricDiff(ma, mb) {
  const better = [],
    worse = [];
  QUALITY_AXES.forEach(([k, dir]) => {
    const d = (mb[k] - ma[k]) * dir;
    if (d > 0) better.push(k);
    else if (d < 0) worse.push(k);
  });
  return { better, worse };
}

function pairRelation(a, b) {
  const { better, worse } = metricDiff(a.metrics, b.metrics);
  let relation;
  if (signature(a.result) === signature(b.result)) relation = "duplicate";
  else if (!better.length && !worse.length) relation = "same-quality";
  else if (!better.length || !worse.length) relation = "dominated";
  else relation = "trade-off";
  return {
    a: a.key,
    b: b.key,
    relation,
    // 지배 관계일 때 더 나은 쪽
    winner: relation === "dominated" ? (better.length ? b.key : a.key) : null,
    sessionSimilarity: jaccard(
      a.result.assigned.map(sessionKey),
      b.result.assigned.map(sessionKey),
    ),
    memberDaySimilarity: jaccard(
      a.result.assigned.map(memberDayKey),
      b.result.assigned.map(memberDayKey),
    ),
    // b - a (지표 원래 단위)
    deltas: Object.fromEntries(
      QUALITY_AXES.filter(([k]) => a.metrics[k] !== b.metrics[k]).map(([k]) => [
        k,
        b.metrics[k] - a.metrics[k],
      ]),
    ),
  };
}

// 표시 후보 수, exact unique 수, 품질 유형 수, 다른 후보에 지배되지 않는 후보(Pareto)와 그 품질 유형 수,
// 쌍별 관계.
function diversitySummary(cands) {
  const pairs = [];
  for (let i = 0; i < cands.length; i++)
    for (let j = i + 1; j < cands.length; j++)
      pairs.push(pairRelation(cands[i], cands[j]));
  const dominatedKeys = new Set(
    pairs
      .filter((p) => p.relation === "dominated")
      .map((p) => (p.winner === p.a ? p.b : p.a)),
  );
  return {
    shown: cands.length,
    exactUnique: new Set(cands.map((c) => signature(c.result))).size,
    qualityTypes: new Set(cands.map((c) => qualityType(c.metrics))).size,
    pareto: cands.map((c) => c.key).filter((k) => !dominatedKeys.has(k)),
    // 실제로 고를 만한 선택지 수: 지배되지 않은 후보의 서로 다른 품질 유형 수
    paretoQualityTypes: new Set(
      cands
        .filter((c) => !dominatedKeys.has(c.key))
        .map((c) => qualityType(c.metrics)),
    ).size,
    pairs,
  };
}

module.exports = {
  signature,
  pairRelation,
  diversitySummary,
};
