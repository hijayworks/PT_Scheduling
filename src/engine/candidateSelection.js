import { isSchedule2ResultBetter } from "./scheduleCompare.js";
import { formatDelta, assignmentDiff } from "./candidateDiff.js";
import { scheduleMetrics, scheduleViolations } from "./scheduleQuality.js";
import { missingPins } from "./pins.js";

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
// 업무 정책값(사용자 결정 2026-10-11): 한 번 생성한 후보 풀에서 조건마다 대표 결과를 하나씩 고른다(대표 후보
// 비교표의 행 순서). 조건을 충족하는 결과가 없으면 그 행은 "찾지 못함"이고, 여러 역할이 같은 품질 그룹을 고르면
// 카드 하나에 역할을 함께 붙인다. "최대·최소"는 모두 이번 탐색에서 찾은 후보 중에서다.
//   recommended       추천 기준(isSchedule2ResultBetter)으로 가장 나은 후보 = 미배정이 가장 적다
//   sessions          추천과 같은 미배정 수 중 수업 최대(공강 허용) → 추천 기준
//   sessionsNoIdle    추천과 같은 미배정 수·공강 0분(필수 이동시간 제외 빈 시간 0) 중 수업 최대 → 추천 기준
//   travelTradeoff    추천과 같은 미배정 수·'sessions' 후보보다 이동이 적은 것 중 수업 최대 → 이동 적은 순 → 추천 기준
//   unassignedSessions 미배정이 추천보다 정확히 1명 많고 수업이 UNASSIGNED_TRADEOFF_MIN_SESSIONS건 이상 많은 것 중
//                     수업 최대 → 이동 적은 순 → 추천 기준
//   unassignedTravel  미배정이 추천보다 정확히 1명 많고 이동이 UNASSIGNED_TRADEOFF_MIN_TRAVEL회 이상 적은 것 중
//                     이동 최소 → 수업 많은 순 → 추천 기준
export const REPRESENTATIVE_ROLES = [
  { role: "recommended", label: "추천·균형" },
  { role: "sessions", label: "수업 수 우선·공강 허용" },
  { role: "sessionsNoIdle", label: "수업 수 우선·공강 없음" },
  { role: "travelTradeoff", label: "이동 절충·수업 수 우선" },
  { role: "unassignedSessions", label: "미배정 1명 추가·수업 증가" },
  { role: "unassignedTravel", label: "미배정 1명 추가·이동 감소" },
];
// 업무 정책값: 미배정 1명 추가·절충 후보의 자격(둘 중 하나 이상). 수업 +1건·이동 -1회만으로는 자격이 없다.
export const UNASSIGNED_TRADEOFF_MIN_SESSIONS = 2;
export const UNASSIGNED_TRADEOFF_MIN_TRAVEL = 2;
// rec(추천 지표) 대비 미배정 1명 추가·절충 후보의 자격: { sessionsUp, travelDown } — 둘 다 false면 자격 없음.
export function unassignedTradeoff(rec, m) {
  const plusOne = m.unassigned === rec.unassigned + 1;
  return {
    sessionsUp:
      plusOne && m.sessions - rec.sessions >= UNASSIGNED_TRADEOFF_MIN_SESSIONS,
    travelDown:
      plusOne &&
      rec.travelCount - m.travelCount >= UNASSIGNED_TRADEOFF_MIN_TRAVEL,
  };
}
// UI 표현값: 카드 하나의 최대 배치(variant) 수.
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
// "수업 +1 / 이동 +2 / 빈 시간 -60분"
export function formatTradeoff(deltas) {
  return deltas.map(({ key, delta }) => formatDelta(key, delta)).join(" / ");
}

const better = (a, b) => isSchedule2ResultBetter(a.result, b.result);
const bestOf = (list) => list.reduce((x, y) => (better(y, x) ? y : x));
// 같은 품질 그룹 안의 순서: 이동 시간이 짧은 순, 같으면 배치 서명 순(입력 순서와 무관하게 결정적).
export function byTravelThenSignature(x, y) {
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

// 목록에서 key가 가장 큰(dir -1이면 가장 작은) entry들만 남긴다.
function extreme(list, key, dir) {
  if (!list.length) return list;
  const top = Math.max(...list.map((e) => e.metrics[key] * dir));
  return list.filter((e) => e.metrics[key] * dir === top);
}
// 역할 하나의 대표 entry({result, metrics}) 또는 null(조건을 충족하는 후보 없음). rec: 추천 entry, list: 후보
// entry들(rec 포함). 정책은 REPRESENTATIVE_ROLES 주석 — selectCandidates와 회원별 추가 탐색(memberExclusion.js)이
// 같은 규칙을 쓴다. 마지막 동점은 추천 기준(isSchedule2ResultBetter)으로 고른다.
export function pickRepresentative(role, rec, list) {
  const r = rec.metrics;
  const pick = (l) => (l.length ? bestOf(l) : null);
  const same = list.filter((e) => e.metrics.unassigned === r.unassigned);
  switch (role) {
    case "recommended":
      return rec;
    case "sessions":
      return pick(extreme(same, "sessions", 1));
    case "sessionsNoIdle":
      return pick(
        extreme(
          same.filter((e) => e.metrics.idleMinutes === 0),
          "sessions",
          1,
        ),
      );
    case "travelTradeoff": {
      const top = pickRepresentative("sessions", rec, list).metrics;
      return pick(
        extreme(
          extreme(
            same.filter((e) => e.metrics.travelCount < top.travelCount),
            "sessions",
            1,
          ),
          "travelCount",
          -1,
        ),
      );
    }
    case "unassignedSessions":
      return pick(
        extreme(
          extreme(
            list.filter((e) => unassignedTradeoff(r, e.metrics).sessionsUp),
            "sessions",
            1,
          ),
          "travelCount",
          -1,
        ),
      );
    case "unassignedTravel":
      return pick(
        extreme(
          extreme(
            list.filter((e) => unassignedTradeoff(r, e.metrics).travelDown),
            "travelCount",
            -1,
          ),
          "sessions",
          1,
        ),
      );
    default:
      throw new Error("unknown role " + role);
  }
}

// 반환: { cards, rows, stats }
//   cards: [{ role, roles, label, metrics, variants: entry[], deltas }] — 대표 카드(역할 순서, 첫 장이 추천)와 그
//     뒤의 사용자 수정 카드(role "edited"). roles: 이 카드가 맡은 대표 역할 [{role, label}](같은 품질 그룹을 고른
//     역할은 한 카드로 합친다), role: 그중 첫 역할, label: 역할 이름을 " · "로 이은 것.
//   rows: REPRESENTATIVE_ROLES 순서의 비교표 행 [{ role, label, card | null }] — null이면 조건을 충족하는 후보 없음.
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
  const m = (g) => head(g).metrics;
  // 3) 역할별 대표(REPRESENTATIVE_ROLES 주석의 정책) — 각 품질 그룹의 대표 배치로 고른다.
  const heads = groups.map(head);
  const rec = heads.length ? bestOf(heads) : null;
  const picks = new Map();
  if (rec)
    REPRESENTATIVE_ROLES.forEach(({ role }) => {
      const e = pickRepresentative(role, rec, heads);
      picks.set(role, e ? groups.find((g) => head(g) === e) : null);
    });
  const deltasOf = (metrics) => (rec ? tradeoffDeltas(rec.metrics, metrics) : []);
  // 4) 같은 그룹을 고른 역할은 카드 하나로 합친다(역할 순서대로). 그룹 안 variant는 다양성 우선.
  let similarRemoved = 0,
    variantLimitRemoved = 0;
  const cardOfGroup = new Map();
  const cards = [];
  const rows = REPRESENTATIVE_ROLES.map(({ role, label }) => {
    const g = picks.get(role) || null;
    if (!g) return { role, label, card: null };
    if (!cardOfGroup.has(g)) {
      const { kept, similar, overLimit } = pickVariants(g);
      similarRemoved += similar;
      variantLimitRemoved += overLimit;
      const card = {
        role,
        roles: [],
        label: "",
        metrics: m(g),
        variants: kept,
        deltas: deltasOf(m(g)),
      };
      cardOfGroup.set(g, card);
      cards.push(card);
    }
    const card = cardOfGroup.get(g);
    card.roles.push({ role, label });
    card.label = card.roles.map((r) => r.label).join(" · ");
    return { role, label, card };
  });
  fixed.forEach((e) =>
    cards.push({
      role: "edited",
      roles: [],
      label: "내가 수정한 후보",
      metrics: e.metrics,
      variants: [e],
      deltas: deltasOf(e.metrics),
    }),
  );
  const count = (list) => list.reduce((n, g) => n + g.length, 0);
  return {
    cards,
    rows,
    stats: {
      generated: entries.length,
      fixedCards: fixedCount,
      mergedIntoFixed,
      exactUnique: unique.length,
      exactDuplicates: autoEntries.length - unique.length - mergedIntoFixed,
      qualityGroups: groups.length,
      shownGroups: cardOfGroup.size,
      notShownLayouts: count(groups.filter((g) => !cardOfGroup.has(g))),
      rolesFound: rows.filter((r) => r.card).length,
      similarRemoved,
      variantLimitRemoved,
      cardsShown: cards.length,
    },
  };
}

// 재최적화(5a·5b-1) 제안 고르기: 고정 세션(pins)을 넘겨 다시 생성한 결과들(results, 후보A·B·C와 동점 풀)
// 중에서 지금 수정 카드(current)보다 나은 것을 고른다. 사용자 기대는 "고정한 수업을 유지하면서 나머지를
// 더 잘 정리"이므로 제안 자격(업무 정책)은 다음 순서로 본다.
//   1) 최종 gate: 고정 세션을 하나라도 같은 자리에 두지 않았거나(missingPins) 하드 제약을 어긴 결과는
//      버린다. 엔진의 고정 처리와 별개로 여기서 다시 확인한다.
//   2) 수업 유지(keepsSessions): 미배정이 current보다 많거나 총 수업 수가 current보다 적은 결과는 버린다
//      — 기존 비교 기준은 수업 1건을 빈 시간 SESSION_VALUE_MINUTES분과 바꿔 주므로, 수업을 빼고 공강을
//      크게 줄인 결과도 "더 낫다"가 된다. 회원 간 재배분(A -1회, B +1회)은 총수가 유지되면 허용한다
//      (사용자 결정 2026-10-07). 재배분 정도는 assignmentDiff counts(membersFewer 등)로 측정한다.
//   3) 남은 결과 중 기존 추천 비교 기준(isSchedule2ResultBetter)으로 current보다 엄격히 나은 최선의 품질
//      그룹(비교 기준으로 완전히 같은 결과들)만 제안 대상이다. 개별 지표는 나빠질 수 있다 — 예를 들어 수업
//      1건이 늘면 빈 시간이 20분 늘어도 더 나은 결과다.
//   4) 안정성(5b-1, 사용자 결정 2026-10-07 "Q·S1 + R"): 그 품질 그룹 안에서만 지금 카드와 가장 비슷한
//      배치를 앞에 둔다(STABILITY_KEYS). 품질이 더 낮은 결과를 안정성 때문에 고르지 않는다.
//   5) 고른 배치들에 되돌리기 패스(revertUnneededChanges)를 적용해, 품질·고정·하드 제약·수업 유지를
//      지키면서 원래 자리로 돌릴 수 있는 회원은 돌린다.
// variants: 제안과 비교 기준으로 완전히 같은 품질의 다른 배치(pickVariants, 안정성 순, 제안이 첫 번째).
// state(회원·선택 상태)를 읽으므로 생성 때와 같은 선택 상태에서, 빈 시간 최소화 모드를 끈 채 호출한다.
// 반환 { status: "improved" | "no-better", reason, proposal, variants, improving, stats }
//   improving: 자격을 통과하고 current보다 엄격히 나은 서로 다른 배치 전부({result, metrics}, 순서 무관,
//   되돌리기 전). 측정(tests/reoptimize.js의 안정성 비교)과 퍼즈 불변조건 검사가 쓴다.
//   reason(no-better): "fewer-sessions"(비교 기준으로 더 나은 결과는 있었지만 모두 수업이 줄거나 미배정이
//   늘었음) | "same-layout"(current와 같은 배치를 다시 찾음) | "equal-quality"(다른 배치지만 비교 기준으로
//   동점) | "worse"(자격을 통과한 결과가 모두 더 나쁨) | "none"(gate 통과 결과 없음)
// 재최적화 제안 자격의 수업 유지 조건: 총 수업 수가 current보다 적지 않고 미배정 회원 수가 current보다
// 많지 않다. 회원별 횟수는 보지 않는다.
export function keepsSessions(current, result) {
  return (
    result.unassignedMembers.length <= current.unassignedMembers.length &&
    result.assigned.length >= current.assigned.length
  );
}

// 업무 정책값(5b-1): 품질이 완전히 같은 재최적화 결과 사이의 순서. 지금 카드 대비 assignmentDiff counts를
// 이 순서로 비교해 작을수록 앞이다(변경 회원 → 변경 세션 → 요일 변경 → 지점 변경 → 시작 시각만 변경).
export const STABILITY_KEYS = [
  "changedMembers",
  "changedSessions",
  "dayChanges",
  "locationChanges",
  "startOnlyChanges",
];
// entry({result}) 비교 함수: current와 더 비슷한 쪽이 앞(음수). 품질은 보지 않는다.
export function byStability(current) {
  const cache = new Map();
  const counts = (e) => {
    if (!cache.has(e.result))
      cache.set(e.result, assignmentDiff(current, e.result).counts);
    return cache.get(e.result);
  };
  return (x, y) => {
    for (const k of STABILITY_KEYS) {
      const d = counts(x)[k] - counts(y)[k];
      if (d) return d;
    }
    return 0;
  };
}

// 되돌리기 패스(R): base에서 바뀐 회원을 한 명씩 current의 배치(세션 전부, 미배정 여부 포함)로 되돌려 보고,
// 고정 유지·하드 제약·수업 유지(keepsSessions)를 지키며 비교 기준으로 base보다 나빠지지 않을 때만 되돌린
// 채로 둔다. 되돌린 회원이 없을 때까지 반복한다. 처리 순서가 결과를 바꿀 수 있어 member id 오름차순
// (assignmentDiff members 순서)으로 고정한다. 되돌릴 때마다 바뀐 회원이 한 명 줄어 반드시 끝난다.
export function revertUnneededChanges(current, pins, base) {
  let result = base;
  for (let progress = true; progress; ) {
    progress = false;
    for (const { memberId } of assignmentDiff(current, result).members) {
      const cand = {
        assigned: result.assigned
          .filter((a) => a.memberId !== memberId)
          .concat(current.assigned.filter((a) => a.memberId === memberId)),
        unassignedMembers: result.unassignedMembers
          .filter((m) => m.id !== memberId)
          .concat(current.unassignedMembers.filter((m) => m.id === memberId)),
      };
      if (
        missingPins(cand.assigned, pins).length ||
        scheduleViolations(cand).length ||
        !keepsSessions(current, cand) ||
        isSchedule2ResultBetter(base, cand)
      )
        continue;
      result = cand;
      progress = true;
    }
  }
  return result;
}

export function selectReoptimization(current, results, pins) {
  const stats = { results: results.length, missingPins: 0, hardViolations: 0, fewerSessions: 0 };
  const passed = results.filter((r) => {
    if (missingPins(r.assigned, pins).length) return stats.missingPins++, false;
    if (scheduleViolations(r).length) return stats.hardViolations++, false;
    return true;
  });
  stats.passed = passed.length;
  const none = (reason) => ({ status: "no-better", reason, proposal: null, variants: [], improving: [], stats });
  if (!passed.length) return none("none");
  const eligible = passed.filter((r) => keepsSessions(current, r));
  stats.fewerSessions = passed.length - eligible.length;
  const bestIn = (list) => list.reduce((x, y) => (isSchedule2ResultBetter(y, x) ? y : x));
  const best = eligible.length ? bestIn(eligible) : null;
  if (!best || !isSchedule2ResultBetter(best, current)) {
    if (passed.some((r) => !keepsSessions(current, r) && isSchedule2ResultBetter(r, current)))
      return none("fewer-sessions");
    if (!best || isSchedule2ResultBetter(current, best)) return none("worse");
    const cur = layoutSignature(current);
    return none(eligible.some((r) => layoutSignature(r) === cur) ? "same-layout" : "equal-quality");
  }
  const seen = new Set();
  const improving = eligible
    .filter((r) => isSchedule2ResultBetter(r, current))
    .filter((r) => {
      const sig = layoutSignature(r);
      return !seen.has(sig) && seen.add(sig);
    })
    .map((result) => ({ result, metrics: scheduleMetrics(result) }));
  const stable = byStability(current);
  const byStableThenSignature = (x, y) => stable(x, y) || byTravelThenSignature(x, y);
  const group = improving.filter((e) => !isSchedule2ResultBetter(best, e.result)).sort(byStableThenSignature);
  // 되돌리기는 고른 variant에만 적용하고(최대 MAX_CARD_VARIANTS개), 되돌린 뒤 같은 배치는 합친다.
  // 되돌리기는 품질을 낮추지 않으므로 되돌린 결과 중 비교 기준 최선 그룹만 남긴다.
  const revSeen = new Set();
  const reverted = pickVariants(group)
    .kept.map((e) => revertUnneededChanges(current, pins, e.result))
    .filter((r) => {
      const sig = layoutSignature(r);
      return !revSeen.has(sig) && revSeen.add(sig);
    })
    .map((result) => ({ result, metrics: scheduleMetrics(result) }));
  const top = bestIn(reverted.map((e) => e.result));
  const { kept } = pickVariants(
    reverted.filter((e) => !isSchedule2ResultBetter(top, e.result)).sort(byStableThenSignature),
  );
  return { status: "improved", reason: null, proposal: kept[0], variants: kept, improving, stats };
}
