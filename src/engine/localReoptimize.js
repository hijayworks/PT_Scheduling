// 국소 재최적화(5b-2) 영향 범위 정책의 단일 소유자. 사용자가 고정한 세션(seed, pins.js)에서 시작해
// "무엇을 움직일 수 있는가"만 Level별로 넓힌다. 범위 밖 기존 세션은 임시 고정(pins)으로 넘겨 엔진 API를
// 바꾸지 않는다. "어디로 갈 수 있는가"(목적지)는 제한하지 않는다 — 움직일 수 있는 세션과 미배정 회원은
// 기존 엔진의 신청 가능 범위 안 어디로든 갈 수 있다(사용자 결정 2026-10-07, 5b-2a 측정 단계).
//   L1: seed가 있는 요일에서 seed 바로 앞·뒤 세션 1개씩 + 원래 위치를 알면 원래 요일에서 빈자리 앞·뒤 1개씩
//   L2: seed 요일 전체 + 원래 위치를 알면 원래 요일 전체 (시간 근접 ±N분 기준은 근거가 없어 두지 않는다)
//   L3: L2 + L2에서 움직일 수 있는 회원·seed 회원의 다른 요일 세션 전부
//   full: 사용자 고정 말고 전부(5b-1 전체 재최적화와 같다)
// 앱 흐름(5b-2b, 사용자 결정 2026-10-08): L1 → L2 → L3를 차례로 돌려 처음 개선안을 찾으면 그 Level에서 멈추고
// "변경 최소화 제안"으로 보여준다(최선의 일정이라고 표현하지 않는다). 사용자가 "더 넓게 찾아보기"를 누르면
// 다음 Level 하나씩 이어서 돌리고(끝낸 Level은 다시 계산하지 않음), L3 뒤에는 사용자가 고를 때만 전체 재최적화를
// 돌린다(L1~L3가 모두 실패해도 전체를 자동으로 시작하지 않는다). 범위 비율 임계값·목적지 제한은 두지 않고
// 구조적 skip(빈 범위, 앞 Level과 같은 범위, 전체와 같은 범위)만 한다. 측정은 tests/reoptimize.js --levels,
// 운영 예산 측정은 tests/opBudget.js.
import { pinKey } from "./pins.js";
import { isSchedule2ResultBetter } from "./scheduleCompare.js";
import { layoutSignature } from "./candidateSelection.js";

export const IMPACT_LEVELS = ["L1", "L2", "L3", "full"];
export const LOCAL_LEVELS = ["L1", "L2", "L3"];
// 알고리즘 튜닝값: 국소 Level(L1~L3)의 후보A 예산 배율(chainDp.groupBudgets). 운영 예산 측정(5건, 국소 실행
// 14번)에서 ×1·×0.5·×0.25·×0.1의 품질·변경 회원 수가 모두 같았고 Level당 대기는 약 20분 → 2~3분이다.
// 기기별 자동 조정은 하지 않는다(벽시계 예산이라 느린 기기에서는 같은 시간에 탐색량이 줄 수 있다).
export const LOCAL_REOPTIMIZE_BUDGET_SCALE = 0.1;

// Level별 실행 계획. 국소 Level은 외부 후보B·C를 만들지 않는다(측정: 빼도 제안 소실·품질 하락 0%, 시간만 차지).
// 후보A 안의 그리디 기준선은 그대로다. 전체는 기존 재최적화와 같이 후보B·C + 후보A 운영 예산(배율 생략 = ×1).
export function levelPlan(level) {
  return level === "full"
    ? { withBC: true, budgetScale: undefined }
    : { withBC: false, budgetScale: LOCAL_REOPTIMIZE_BUDGET_SCALE };
}

// levelPlan대로 엔진을 부른다. engines.bc(pins) → 후보B·C 결과 목록, engines.a(pins, budgetScale) → 후보A
// 결과 목록. 반환 { bc, a } (결과를 만든 엔진을 계측하려고 나눠 둔다).
export async function generateForLevel(level, pins, engines) {
  const plan = levelPlan(level);
  const bc = plan.withBC ? await engines.bc(pins) : [];
  const a = await engines.a(pins, plan.budgetScale);
  return { bc, a };
}

// 계측용: 제안 배치를 만든 엔진. 어느 결과와도 같지 않으면 선택 단계의 되돌리기(R)가 만든 배치다.
export function proposalSource(proposal, gen) {
  const sig = layoutSignature(proposal);
  const has = (list) => list.some((r) => r && layoutSignature(r) === sig);
  const inA = has(gen.a),
    inBC = has(gen.bc);
  return inA && inBC ? "A+BC" : inA ? "A" : inBC ? "BC" : "R";
}

const asPin = (a) => ({
  id: a.id,
  memberId: a.memberId,
  day: a.day,
  startSlot: a.startSlot,
  duration: a.duration,
  locationId: a.locationId,
});

// current: 지금 카드, userPins: 사용자 고정(pinsFromResult), origins: 옮기기 전 자리 [{day, startSlot}]
// (모르면 []). 반환 { pins: 사용자 고정 + 임시 고정, movable: 움직일 수 있는 current 세션, total,
// userPinned, tempPinned }.
export function impactRegion(current, userPins, level, origins = []) {
  if (!IMPACT_LEVELS.includes(level))
    throw new Error("알 수 없는 영향 범위 Level: " + level);
  const userKeys = new Set(userPins.map(pinKey));
  const free = current.assigned.filter((a) => !userKeys.has(pinKey(a)));
  const open = new Set();
  if (level === "full") free.forEach((a) => open.add(a));
  else if (level === "L1") {
    // 그 요일의 움직일 수 있는 세션 중 slot 바로 앞(시작 < slot)과 바로 뒤(시작 ≥ slot) 하나씩.
    const around = (day, slot) => {
      const list = free
        .filter((a) => a.day === day)
        .sort((a, b) => a.startSlot - b.startSlot);
      const next = list.findIndex((a) => a.startSlot >= slot);
      const before = next < 0 ? list[list.length - 1] : list[next - 1];
      [before, list[next]].forEach((a) => a && open.add(a));
    };
    userPins.forEach((p) => around(p.day, p.startSlot));
    origins.forEach((o) => around(o.day, o.startSlot));
  } else {
    const days = new Set(userPins.concat(origins).map((x) => x.day));
    free.filter((a) => days.has(a.day)).forEach((a) => open.add(a));
    if (level === "L3") {
      const members = new Set(
        userPins.map((p) => p.memberId).concat([...open].map((a) => a.memberId)),
      );
      free.filter((a) => members.has(a.memberId)).forEach((a) => open.add(a));
    }
  }
  const temp = free.filter((a) => !open.has(a));
  return {
    pins: userPins.concat(temp.map(asPin)),
    movable: free.filter((a) => open.has(a)),
    total: current.assigned.length,
    userPinned: current.assigned.length - free.length,
    tempPinned: temp.length,
  };
}

// Level 진행: levels 순서대로 영향 범위를 만들고 reoptimize(pins, level)(→ selectReoptimization 결과)를
// 부른다. 측정 단계라 성공해도 멈추지 않고 전부 계산한다. 움직일 세션이 없으면 생성하지 않고(skipped
// "empty"), 범위가 바로 앞 Level과 같으면 다시 생성하지 않고 그 결과를 쓴다(sameAs).
// 취소(GenerationCancelledError)와 엔진 오류는 잡지 않는다 — 다음 Level·전체 fallback으로 넘어가지 않고
// 그대로 호출한 쪽으로 올라간다(조용한 fallback 금지).
// 반환 [{ level, region, outcome, ms, skipped?, sameAs? }]
export async function runImpactLevels(
  current,
  userPins,
  origins,
  reoptimize,
  levels = IMPACT_LEVELS,
) {
  const out = [];
  let prev = null;
  for (const level of levels) {
    const region = impactRegion(current, userPins, level, origins);
    const key = region.movable.map(pinKey).sort().join(",");
    if (!region.movable.length) {
      out.push({ level, region, outcome: null, ms: 0, skipped: "empty" });
      continue;
    }
    if (prev && prev.key === key) {
      out.push({ level, region, outcome: prev.entry.outcome, ms: 0, sameAs: prev.entry.level });
      continue;
    }
    const t = Date.now();
    const outcome = await reoptimize(region.pins, level);
    const entry = { level, region, outcome, ms: Date.now() - t };
    out.push(entry);
    prev = { key, entry };
  }
  return out;
}

// 원래 위치(origin) 판정 결과. 원점은 국소 범위를 잡는 힌트일 뿐(하드 제약·품질 판정에 쓰지 않음)이라, 확실할
// 때만 쓰고 조금이라도 애매하면 버리고 현재 위치만 쓴다. 계측에서 "이동이 없었다"와 "있었지만 모른다"를 구분한다.
export const ORIGIN_STATUS = {
  known: "known", // 원래 위치를 믿을 수 있게 앎(origins 1개 이상)
  noMove: "no-move", // 생성 이후 기록이 온전하고, 고정한 수업 중 옮겨서 자리를 비운 것이 없음
  afterApply: "after-apply", // 마지막 재최적화 적용 이후 옮긴 고정 수업 없음(적용 이전 기록은 무시)
  noHistory: "no-history", // 되돌리기 기록 없음(새로고침 등)
  truncated: "truncated", // 되돌리기 기록이 한도를 넘어 잘림 — 기준 상태를 모름
  ambiguous: "ambiguous", // 비운 자리와 옮긴 고정 수업을 짝지을 수 없음
};

// 수동 편집 되돌리기 스택(schedule3.js manualUndoStacks의 배열)에서 원래 위치를 꺼낸다. 반환 { origins, status }.
// 기준 상태: 마지막 재최적화 적용 스냅샷(reoptApplied) 다음 상태(없으면 지금 카드), 적용 표시가 없으면 스택의 가장
// 오래된 스냅샷(생성 직후). 적용 표시 없이 스택이 잘렸으면(stack.truncated) 기준을 모른다.
// 회원마다 기준 → 지금 비교: 비운 자리 V(기준에만 있음), 새 고정 P(지금 고정 중 기준에 없음), 새 비고정 U.
//   P = 0 → 이 회원은 고정한 이동이 없음(확정 취소된 이동·엔진 이동은 원점이 아님).
//   U = 0 && V ≤ P → V 전부가 원점(옮긴 고정 수업의 이전 자리).
//   그 밖(U > 0이거나 V > P) → 어느 빈 자리가 고정 이동의 원점인지 모름 → 전체를 ambiguous로 버린다.
export function originsFromHistory(current, userPins, stack) {
  const none = (status) => ({ origins: [], status });
  const snaps = stack || [];
  let applied = -1;
  for (let i = snaps.length - 1; i >= 0 && applied < 0; i--)
    if (snaps[i].reoptApplied) applied = i;
  if (applied < 0 && stack && stack.truncated) return none(ORIGIN_STATUS.truncated);
  if (!snaps.length) return none(ORIGIN_STATUS.noHistory);
  const base = applied < 0 ? snaps[0] : snaps[applied + 1] || current;
  const baseKeys = new Set(base.assigned.map(pinKey));
  const nowKeys = new Set(current.assigned.map(pinKey));
  const pinKeys = new Set(userPins.map(pinKey));
  const origins = [];
  for (const memberId of new Set(userPins.map((p) => p.memberId))) {
    const vacated = base.assigned.filter((a) => a.memberId === memberId && !nowKeys.has(pinKey(a)));
    const added = current.assigned.filter((a) => a.memberId === memberId && !baseKeys.has(pinKey(a)));
    const p = added.filter((a) => pinKeys.has(pinKey(a))).length;
    if (p === 0) continue;
    if (added.length > p || vacated.length > p) return none(ORIGIN_STATUS.ambiguous);
    for (const a of vacated) origins.push({ day: a.day, startSlot: a.startSlot });
  }
  if (origins.length) return { origins, status: ORIGIN_STATUS.known };
  return none(applied < 0 ? ORIGIN_STATUS.noMove : ORIGIN_STATUS.afterApply);
}

// 앱의 국소 탐색 진행 상태. next: 다음에 볼 LOCAL_LEVELS 번호, lastKey: 마지막으로 본(비지 않은) 범위.
const regionKey = (r) => r.movable.map(pinKey).sort().join(",");
export function createLocalSearch(current, userPins, origins = []) {
  return {
    current,
    userPins,
    origins,
    next: 0,
    lastKey: null,
    fullKey: regionKey(impactRegion(current, userPins, "full", origins)),
    steps: [],
  };
}
// i번째 Level의 범위와 구조적 skip 이유(없으면 null). lastKey는 그 앞까지 본 마지막 범위.
function examine(search, i, lastKey) {
  const level = LOCAL_LEVELS[i];
  const region = impactRegion(search.current, search.userPins, level, search.origins);
  const key = regionKey(region);
  const skipped = !region.movable.length
    ? "empty"
    : key === lastKey
      ? "same-as-previous"
      : key === search.fullKey
        ? "same-as-full"
        : null;
  return { level, region, key, skipped };
}
// 생성하지 않고, 다음에 실제로 돌릴 국소 Level 이름(없으면 null — 남은 것은 전체 재최적화뿐).
export function nextLocalLevel(search) {
  let lastKey = search.lastKey;
  for (let i = search.next; i < LOCAL_LEVELS.length; i++) {
    const e = examine(search, i, lastKey);
    if (!e.skipped) return e.level;
    if (e.region.movable.length) lastKey = e.key;
  }
  return null;
}
// search.next부터 국소 Level을 이어서 돌린다. reoptimize(pins, level) → selectReoptimization 결과.
// stopWhen(outcome)이 참이면 그 Level에서 멈추고 { level, region, outcome }을, 국소 Level을 다 보면 null을 준다.
// 첫 흐름은 "개선이면 멈춤", 더 넓게 찾아보기는 "한 Level 돌리면 멈춤"이다. 끝낸 Level은 next가 지나가므로
// 다시 계산하지 않는다. 취소·엔진 오류는 잡지 않는다 — 그 Level은 끝나지 않은 것으로 남고 이후 Level은 돌지 않는다.
export async function continueLocalSearch(search, reoptimize, stopWhen) {
  while (search.next < LOCAL_LEVELS.length) {
    const e = examine(search, search.next, search.lastKey);
    if (e.skipped) {
      search.next++;
      if (e.region.movable.length) search.lastKey = e.key;
      search.steps.push({ level: e.level, skipped: e.skipped });
      continue;
    }
    const outcome = await reoptimize(e.region.pins, e.level);
    search.next++;
    search.lastKey = e.key;
    search.steps.push({ level: e.level, status: outcome.status });
    if (stopWhen(outcome)) return { level: e.level, region: e.region, outcome };
  }
  return null;
}

// 더 넓게 찾은 제안(entry: { level, variants })을 제안 목록에 더한다. 목록의 마지막이 지금까지 가장 좋은 제안이며,
// 그보다 비교 기준(isSchedule2ResultBetter)으로 엄격히 나을 때만 더한다. 기존 제안(첫 번째 = 변경 최소화 제안)은
// 지우거나 바꾸지 않는다 — 안정성과 품질 중 무엇을 고를지는 사용자가 정한다. 반환: 더했는지.
export function addWiderProposal(proposals, entry) {
  const best = proposals[proposals.length - 1];
  if (best && !isSchedule2ResultBetter(entry.variants[0].result, best.variants[0].result))
    return false;
  proposals.push(entry);
  return true;
}
