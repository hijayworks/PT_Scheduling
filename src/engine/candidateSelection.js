import { isSchedule2ResultBetter } from "./scheduleCompare.js";

// 후보 선정 정책의 단일 소유자: 여러 엔진(후보A-1~3·B·C와 각 동점 풀)이 만든 결과 전체를 하나의
// 후보 풀로 보고, 사용자에게 보여줄 카드(실제 trade-off)를 고른다. 역할(추천·수업 우선 등)은 풀에
// 따라 달라지는 파생값이라 저장하지 않고 매번 여기서 계산한다.
//
// 입력 entry: { key, result: {assigned, unassignedMembers}, metrics: scheduleMetrics(result) }.
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

// 반환: { cards, hidden, stats }
//   cards: [{ role, label, metrics, variants: entry[], deltas }] — 첫 장이 추천(role "recommended").
//   hidden: 카드가 되지 못한 Pareto 그룹 [{ reason: "unlabeled" | "role-taken" | "card-limit", ... }]
export function selectCandidates(entries) {
  // 1) 완전히 같은 배치는 하나만(먼저 나온 것) 남긴다.
  const seen = new Set();
  const unique = entries.filter((e) => {
    const sig = layoutSignature(e.result);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  // 2) 품질(Pareto 축)이 같은 배치끼리 묶는다. 그룹 안은 이동 시간이 짧은 순(같으면 입력 순).
  const groupMap = new Map();
  unique.forEach((e) => {
    const k = qualityKey(e.metrics);
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(e);
  });
  const groups = [...groupMap.values()].map((layouts) =>
    layouts
      .map((e, i) => ({ e, i }))
      .sort(
        (x, y) =>
          x.e.metrics.travelMinutes - y.e.metrics.travelMinutes || x.i - y.i,
      )
      .map(({ e }) => e),
  );
  // 3) 다른 그룹에 지배당하는 그룹을 지운다.
  const pareto = groups.filter(
    (g) => !groups.some((h) => dominates(h[0].metrics, g[0].metrics)),
  );
  const dominatedLayouts = groups
    .filter((g) => !pareto.includes(g))
    .reduce((n, g) => n + g.length, 0);
  // 4) 그룹 안에서 앞서 남긴 배치와 거의 같은(회원·요일·지점 배정 차이가 적은) 배치를 지우고,
  //    MAX_CARD_VARIANTS개까지만 남긴다.
  let similarRemoved = 0,
    variantLimitRemoved = 0;
  const variantsOf = new Map();
  pareto.forEach((g) => {
    const kept = [];
    g.forEach((e) => {
      if (
        kept.some(
          (k) =>
            placementChanges(e.result, k.result) <
            VARIANT_MIN_PLACEMENT_CHANGES,
        )
      )
        similarRemoved++;
      else if (kept.length >= MAX_CARD_VARIANTS) variantLimitRemoved++;
      else kept.push(e);
    });
    variantsOf.set(g, kept);
  });
  // 5) 추천: 기존 생성 비교 기준(isSchedule2ResultBetter)으로 가장 나은 그룹. 그 기준은 Pareto 축에
  //    단조라 추천은 항상 Pareto 그룹이다.
  const head = (g) => g[0];
  const rec = pareto.length ? bestOf(pareto.map(head)) : null;
  const recGroup = pareto.find((g) => head(g) === rec);
  const cardOf = (g, role, label) => ({
    role,
    label,
    metrics: head(g).metrics,
    variants: variantsOf.get(g),
    deltas: rec ? tradeoffDeltas(rec.metrics, head(g).metrics) : [],
  });
  const cards = recGroup ? [cardOf(recGroup, "recommended", "추천")] : [];
  // 6) 역할: 추천안보다 그 축이 나은 그룹 중 그 축이 가장 좋은 그룹(같으면 추천 기준). 한 그룹은
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
  const hidden = pareto
    .filter((g) => !used.has(g))
    .map((g) => {
      const card = cardOf(g, null, null);
      const roles = CANDIDATE_ROLES.filter(({ axis }) => qualifies(g, axis));
      return {
        ...card,
        reason: !roles.length
          ? "unlabeled"
          : cards.length >= MAX_CANDIDATE_CARDS
            ? "card-limit"
            : "role-taken",
        qualifiesFor: roles.map((r) => r.label),
      };
    });
  return {
    cards,
    hidden,
    stats: {
      generated: entries.length,
      exactUnique: unique.length,
      exactDuplicates: entries.length - unique.length,
      qualityGroups: groups.length,
      paretoGroups: pareto.length,
      dominatedGroups: groups.length - pareto.length,
      dominatedLayouts,
      similarRemoved,
      variantLimitRemoved,
      cardsShown: cards.length,
    },
  };
}
