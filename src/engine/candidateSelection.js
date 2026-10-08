import { isSchedule2ResultBetter } from "./scheduleCompare.js";

// 후보 선정 정책의 단일 소유자: 여러 엔진(후보A-1~3·B·C와 각 동점 풀)이 만든 결과 전체를 하나의
// 후보 풀로 보고, 사용자에게 보여줄 카드(실제 trade-off)를 고른다. 역할(추천·수업 우선 등)은 풀에
// 따라 달라지는 파생값이라 저장하지 않고 매번 여기서 계산한다.
//
// 입력 entry: { key, result: {assigned, unassignedMembers}, metrics: scheduleMetrics(result), fixed? }.
// fixed는 사용자가 옮기거나 확정한(사람의 의도가 담긴) 결과다 — 자동 선정에서 지우지 않고
// "내가 수정한 후보" 카드로 따로 보여주며, 추천 역할은 주지 않는다.
// isSchedule2ResultBetter가 state(회원·지점)를 읽으므로 생성 때와 같은 선택(미배정·1회 제한)
// 상태에서 호출하고, 빈 시간 최소화 모드(setIdleFirst)는 꺼져 있어야 한다.

// 업무 정책값: Pareto 판정 축과 좋은 방향(+1 클수록 좋음, -1 작을수록 좋음). 이동 시간은 축이
// 아니라 같은 품질 안에서의 순서(tie-break)로만 쓴다 — 축에 넣으면 "이동 10분 짧음" 같은 사소한
// 차이가 별도 선택지로 늘어난다.
export const QUALITY_AXES = [
  ["unassigned", -1],
  ["sessions", 1],
  ["inefficientMoves", -1],
  ["travelCount", -1],
  ["idleMinutes", -1],
];
// 업무 정책값: 추천 외 카드의 역할. 추천안보다 그 축이 나을 때만 붙고, 앞 역할부터 자리를 채운다.
export const CANDIDATE_ROLES = [
  { role: "sessions", label: "수업 우선", axis: "sessions" },
  { role: "travel", label: "이동 최소", axis: "travelCount" },
  { role: "idle", label: "공강 최소", axis: "idleMinutes" },
];
// UI 표현값: 추천안 포함 최대 카드 수, 카드 하나의 최대 배치(variant) 수.
export const MAX_CANDIDATE_CARDS = 3;
export const MAX_CARD_VARIANTS = 3;
// 알고리즘 튜닝값: 같은 품질의 두 배치가 별도 variant로 남으려면 회원·요일·지점 배정이 이만큼은
// 달라야 한다. 시작 시각만 다른 배치는 0이라 제거된다.
export const VARIANT_MIN_PLACEMENT_CHANGES = 1;

const sessionKey = (r) =>
  `${r.memberId}|${r.day}|${r.startSlot}|${r.locationId}`;
const placementKey = (r) => `${r.memberId}|${r.day}|${r.locationId}`;

export function layoutSignature(result) {
  return result.assigned.map(sessionKey).sort().join(",");
}
export function qualityKey(metrics) {
  return QUALITY_AXES.map(([k]) => metrics[k]).join("|");
}
// a에는 있지만 b에는 없는 회원·요일·지점 배정 수(같은 품질이면 수업 수가 같아 대칭).
export function placementChanges(a, b) {
  const inB = new Set(b.assigned.map(placementKey));
  return a.assigned.filter((r) => !inB.has(placementKey(r))).length;
}
// a가 b를 지배하는지: 모든 축에서 같거나 낫고 하나 이상에서 낫다.
export function dominates(ma, mb) {
  let strictly = false;
  for (const [k, dir] of QUALITY_AXES) {
    const d = (ma[k] - mb[k]) * dir;
    if (d < 0) return false;
    if (d > 0) strictly = true;
  }
  return strictly;
}
// b - base, 0이 아닌 축만(이동 시간 포함). [{key, delta}]
export function tradeoffDeltas(base, b) {
  return QUALITY_AXES.map(([k]) => k)
    .concat("travelMinutes")
    .filter((k) => b[k] !== base[k])
    .map((k) => ({ key: k, delta: b[k] - base[k] }));
}
const DELTA_LABELS = {
  unassigned: ["미배정", "명"],
  sessions: ["수업", ""],
  inefficientMoves: ["비효율 이동", ""],
  travelCount: ["이동", ""],
  idleMinutes: ["빈 시간", "분"],
  travelMinutes: ["이동 시간", "분"],
};
// "수업 +1 / 이동 +2 / 빈 시간 -60분"
export function formatTradeoff(deltas) {
  return deltas
    .map(({ key, delta }) => {
      const [label, unit] = DELTA_LABELS[key];
      return `${label} ${delta > 0 ? "+" : ""}${delta}${unit}`;
    })
    .join(" / ");
}

const better = (a, b) => isSchedule2ResultBetter(a.result, b.result);
const bestOf = (list) => list.reduce((x, y) => (better(y, x) ? y : x));
// 같은 품질 그룹 안의 순서: 이동 시간이 짧은 순, 같으면 배치 서명 순(입력 순서와 무관하게 결정적).
function byTravelThenSignature(x, y) {
  return (
    x.metrics.travelMinutes - y.metrics.travelMinutes ||
    (layoutSignature(x.result) < layoutSignature(y.result) ? -1 : 1)
  );
}

// 그룹(이동 시간 순) 안에서 variant를 고른다: 대표(첫 배치)부터 시작해, 이미 고른 배치들과의
// 최소 배정 차이가 가장 큰 배치를 차례로 더한다(같으면 그룹 순서). 이미 고른 배치와 차이가
// VARIANT_MIN_PLACEMENT_CHANGES 미만인 배치는 유사 배치로 지운다.
export function pickVariants(group) {
  const kept = [group[0]];
  let rest = group.slice(1);
  const distance = (e) =>
    Math.min(...kept.map((k) => placementChanges(e.result, k.result)));
  let similar = 0;
  for (;;) {
    const scored = rest.map((e) => ({ e, d: distance(e) }));
    similar += scored.filter((x) => x.d < VARIANT_MIN_PLACEMENT_CHANGES).length;
    rest = scored
      .filter((x) => x.d >= VARIANT_MIN_PLACEMENT_CHANGES)
      .map((x) => x.e);
    if (!rest.length || kept.length >= MAX_CARD_VARIANTS) break;
    const far = scored
      .filter((x) => x.d >= VARIANT_MIN_PLACEMENT_CHANGES)
      .reduce((x, y) => (y.d > x.d ? y : x));
    kept.push(far.e);
    rest = rest.filter((e) => e !== far.e);
  }
  return { kept, similar, overLimit: rest.length };
}

// 반환: { cards, hidden, stats }
//   cards: [{ role, label, metrics, variants: entry[], deltas }] — 자동 카드(첫 장이 추천, role
//     "recommended")와 그 뒤의 사용자 수정 카드(role "edited").
//   hidden: 카드가 되지 못한 그룹 [{ reason, ... }]
//     "unassigned-gate"(미배정이 추천안보다 많아 대안에서 뺀, gate가 없었다면 Pareto였던 그룹)
//     "unlabeled" | "role-taken" | "card-limit"(Pareto지만 카드가 되지 못함)
export function selectCandidates(entries) {
  // 1) 사용자 수정 카드는 그대로 둔다(서로 완전히 같으면 하나만). 자동 배치가 수정 카드와 완전히
  //    같으면 자동 쪽을 지운다 — 같은 배치를 두 장 보여주지 않고, 사람이 손댄 카드가 대표한다.
  const seen = new Set();
  const firstOfSignature = (e) => {
    const sig = layoutSignature(e.result);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  };
  const fixed = entries.filter((e) => e.fixed).filter(firstOfSignature);
  const fixedCount = seen.size;
  const autoEntries = entries.filter((e) => !e.fixed);
  let mergedIntoFixed = 0;
  const unique = autoEntries.filter((e) => {
    const sig = layoutSignature(e.result);
    if (seen.has(sig)) {
      if (fixed.some((f) => layoutSignature(f.result) === sig))
        mergedIntoFixed++;
      return false;
    }
    seen.add(sig);
    return true;
  });
  // 2) 품질(Pareto 축)이 같은 배치끼리 묶는다.
  const groupMap = new Map();
  unique.forEach((e) => {
    const k = qualityKey(e.metrics);
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(e);
  });
  const groups = [...groupMap.values()]
    .map((g) => g.sort(byTravelThenSignature))
    .sort((g, h) => byTravelThenSignature(g[0], h[0]));
  const head = (g) => g[0];
  // 3) 추천: 기존 생성 비교 기준(isSchedule2ResultBetter)으로 가장 나은 그룹. 그 기준은 미배정을
  //    가장 먼저 보고 Pareto 축에 단조라, 추천은 항상 미배정이 가장 적은 Pareto 그룹이다.
  const rec = groups.length ? bestOf(groups.map(head)) : null;
  // 4) 미배정 gate: 추천안보다 미배정이 많은 그룹은 대안이 될 수 없다(Pareto 판정 전에 뺀다).
  const eligible = groups.filter(
    (g) => head(g).metrics.unassigned <= rec.metrics.unassigned,
  );
  const gated = groups.filter((g) => !eligible.includes(g));
  const isParetoIn = (g, pool) =>
    !pool.some((h) => dominates(h[0].metrics, g[0].metrics));
  // 5) 남은 그룹 중 다른 그룹에 지배당하는 그룹을 지운다.
  const pareto = eligible.filter((g) => isParetoIn(g, eligible));
  const count = (list) => list.reduce((n, g) => n + g.length, 0);
  // 6) 그룹 안 variant(다양성 우선, 최대 MAX_CARD_VARIANTS개).
  let similarRemoved = 0,
    variantLimitRemoved = 0;
  const variantsOf = new Map();
  pareto.forEach((g) => {
    const { kept, similar, overLimit } = pickVariants(g);
    similarRemoved += similar;
    variantLimitRemoved += overLimit;
    variantsOf.set(g, kept);
  });
  const recGroup = pareto.find((g) => head(g) === rec);
  const deltasOf = (m) => (rec ? tradeoffDeltas(rec.metrics, m) : []);
  const cardOf = (g, role, label) => ({
    role,
    label,
    metrics: head(g).metrics,
    variants: variantsOf.get(g) || g,
    deltas: deltasOf(head(g).metrics),
  });
  const cards = recGroup ? [cardOf(recGroup, "recommended", "추천")] : [];
  // 7) 역할: 추천안보다 그 축이 나은 그룹 중 그 축이 가장 좋은 그룹(같으면 추천 기준). 한 그룹은
  //    한 역할만 맡고, 해당하는 그룹이 없는 역할은 만들지 않는다.
  const used = new Set([recGroup]);
  const qualifies = (g, axis) => {
    const dir = QUALITY_AXES.find(([k]) => k === axis)[1];
    return (head(g).metrics[axis] - rec.metrics[axis]) * dir > 0;
  };
  CANDIDATE_ROLES.forEach(({ role, label, axis }) => {
    if (cards.length >= MAX_CANDIDATE_CARDS) return;
    const pool = pareto.filter((g) => !used.has(g) && qualifies(g, axis));
    if (!pool.length) return;
    const dir = QUALITY_AXES.find(([k]) => k === axis)[1];
    const bestVal = Math.max(...pool.map((g) => head(g).metrics[axis] * dir));
    const pick = bestOf(
      pool.filter((g) => head(g).metrics[axis] * dir === bestVal).map(head),
    );
    const g = pool.find((x) => head(x) === pick);
    used.add(g);
    cards.push(cardOf(g, role, label));
  });
  const hiddenOf = (g, reason) => ({
    ...cardOf(g, null, null),
    reason,
    qualifiesFor: CANDIDATE_ROLES.filter(({ axis }) => qualifies(g, axis)).map(
      (r) => r.label,
    ),
  });
  const hidden = gated
    .filter((g) => isParetoIn(g, groups))
    .map((g) => hiddenOf(g, "unassigned-gate"))
    .concat(
      pareto
        .filter((g) => !used.has(g))
        .map((g) =>
          hiddenOf(
            g,
            !CANDIDATE_ROLES.some(({ axis }) => qualifies(g, axis))
              ? "unlabeled"
              : cards.length >= MAX_CANDIDATE_CARDS
                ? "card-limit"
                : "role-taken",
          ),
        ),
    );
  fixed.forEach((e) =>
    cards.push({
      role: "edited",
      label: "내가 수정한 후보",
      metrics: e.metrics,
      variants: [e],
      deltas: deltasOf(e.metrics),
    }),
  );
  return {
    cards,
    hidden,
    stats: {
      generated: entries.length,
      fixedCards: fixedCount,
      mergedIntoFixed,
      exactUnique: unique.length,
      exactDuplicates: autoEntries.length - unique.length - mergedIntoFixed,
      qualityGroups: groups.length,
      gatedGroups: gated.length,
      gatedLayouts: count(gated),
      paretoGroups: pareto.length,
      dominatedGroups: eligible.length - pareto.length,
      dominatedLayouts: count(eligible.filter((g) => !pareto.includes(g))),
      similarRemoved,
      variantLimitRemoved,
      cardsShown: cards.length,
    },
  };
}
