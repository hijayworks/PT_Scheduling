import { DAYS } from "../constants.js";
import { state, runtime } from "../state.js";
import {
  yieldToUI,
  checkGenerationCancelled,
  MAX_POOL_VARIANTS,
  generateCandidatesAsync,
} from "./greedy.js";
import { isEligibleRequest2, runChainDP } from "./chainDpCore.js";
import { runSchedule2Pipeline } from "./chainDpPolish.js";
import { mulberry32, shuffled } from "./rng.js";
import {
  isSchedule2ResultBetter,
  floorIsBetter,
  schedule2Signature,
  schedule2ToIdleBlocks,
  schedule2TotalIdleMinutes,
} from "./scheduleCompare.js";

/* ---------------- "수업 스케줄 생성2" 카드 재시작 오케스트레이션 ----------------
     이 파일은 원래 하루치 DP·다듬기 파이프라인·비교 유틸까지 전부 한 파일(2400줄+)에
     담고 있었는데, 유지보수하기엔 너무 커서 관심사별로 나눴다 — 로직은 전혀 바뀌지 않았고
     코드가 이사만 했다:
       - chainDpCore.js: 하루치 체인 DP(runChainDP)와 노드 빌더
       - chainDpPolish.js: 요일 순서 하나를 받아 1~9단계를 실행하는 다듬기 파이프라인
       - scheduleCompare.js: 결과 비교·서명·빈 시간 계산 등 순수 함수
       - rng.js: 시드 기반 의사난수(mulberry32/shuffled)
     이 파일(chainDp.js)에는 "여러 요일 순서·시드로 위 파이프라인을 반복 호출해 카드
     하나(A-1/A-2/A-3 중 하나)의 최종 결과를 만드는" 재시작 오케스트레이션만 남는다.
     schedule3.js 등 다른 페이지 코드는 지금처럼 이 파일에서 그대로 import하면 되도록,
     이사간 함수들을 아래에서 다시 내보낸다(re-export). */
export {
  mulberry32,
  shuffled,
  runChainDP,
  isSchedule2ResultBetter,
  floorIsBetter,
  schedule2Signature,
  schedule2ToIdleBlocks,
  schedule2TotalIdleMinutes,
};

// 후보A를 서로 다른 요일 순서 탐색 시드로 이만큼("재시작 그룹") 독립적으로 처음부터 다시
// 탐색해, 각 그룹이 찾아낸 최종 결과들을 비교한다. 처음엔 "한 번의 탐색 안에서 담금질(SA)이
// 수렴한 뒤 남는 동점들"을 모아 배치 페이저에 보여줬는데, 그 동점들은 대개 같은 골격(누가
// 어느 요일에 배정됐는지)에서 한두 명만 자리를 맞바꾼 정도라 사용자가 원했던 "완전히 다른
// 배치"가 아니었다(실제로 이 문제로 확인됨). 요일 순서 탐색의 무작위 시드·신청 배열 순서
// 자체를 그룹마다 다르게 주면 그룹별로 아예 다른 골격에서 출발하게 되어, 정말 구조가 다른
// 배치 여러 개를 얻을 수 있다.
// 그룹마다 탐색 폭을 넓힐수록(다양성↑) 여러 그룹이 "정확히 같은 최적값"에 동시에 도달할
// 확률은 오히려 낮아져(생일 문제) 여러 그룹을 하나의 풀로 합쳐 동점만 골라내는 방식은
// 배치 페이저가 아예 안 뜨는 경우가 잦았다(실제로 확인됨). 그래서 그룹끼리 억지로 동점을
// 맞추려 하지 않고, 그룹 하나하나를 그대로 "후보A-1/A-2/A-3" 별도 카드로 보여준다(후보B·C가
// 이미 서로 다른 전략의 결과를 별도 카드로 보여주는 것과 같은 방식) — 카드 사이는 동점일
// 필요가 없고, 카드 안의 배치 페이저만 그 카드 자신의 탐색(allPolished)에서 나온 진짜
// 동점을 다룬다. SCHEDULE2_CARD_COUNT가 곧 카드 수이자 독립 탐색 그룹 수다.
export const SCHEDULE2_CARD_COUNT = 3;
// 담금질 계열 시간 예산은 전부 실측정 시간(ms) 기준이라, 데이터 크기와 무관하게 회원 1명짜리
// 입력에서도 그대로 다 소모된다(schedule3.js 등에서 실제로 확인됨 — 카드당 최대 7분+α).
// 스모크 테스트가 매번 이 시간을 다 기다리면 CI에서 못 돌리므로(현재 CI는 그래서
// SMOKE_SKIP_A로 이 구간 전체를 건너뜀), 테스트 하네스가 명시적으로 지정했을 때만
// window.__PT_TEST_BUDGET_SCALE__(0보다 크고 1 이하)로 아래 모든 시간 예산을 비례
// 축소한다. 지정하지 않으면 항상 1이라 실제 사용 중인 운영 동작은 전혀 바뀌지 않는다.
const TEST_BUDGET_SCALE =
  (typeof window !== "undefined" &&
    window.__PT_TEST_BUDGET_SCALE__ > 0 &&
    window.__PT_TEST_BUDGET_SCALE__ <= 1 &&
    window.__PT_TEST_BUDGET_SCALE__) ||
  1;
function scaledBudgetMs(fullMs, minMs) {
  return Math.max(minMs, Math.round(fullMs * TEST_BUDGET_SCALE));
}
// 카드 3장을 도입하며 "총 대기 시간을 비슷하게" 유지하려고 그룹당 예산을 통짜 탐색의 1/3로
// 줄였었는데, 그러면 실제(회원 수가 많은) 데이터에서는 카드마다 도달하는 최적화 수준이
// 달라진다(예: 수업 30/27/29건처럼 카드마다 실제로 다른 결과에 머묾 — 실제로 이 문제로
// 확인됨). 후보A는 원래 "미배정 없음 → 수업 횟수 최대"가 최우선 기준이라, 카드마다 도달
// 가능한 최댓값에 확실히 닿아야 의미가 있다. 그래서 카드당 예산을 통짜 탐색이 쓰던 값
// 그대로 되돌렸다 — 총 대기 시간은 카드 수(3)에 비례해 늘어난다(최악의 경우 약 20분대).
export const PER_GROUP_DAY_ORDER_SHUFFLES = 400; // 그룹마다 시도할 무작위 요일 순서 수
export const PER_GROUP_SEARCH_DEADLINE_MS = scaledBudgetMs(30000, 50);
export const PER_GROUP_MAX_POLISH_CANDIDATES = 16; // 다듬기 전 지표 상위권 요일 순서 중 그룹당 최대 이만큼만 서로 다른 시작점으로 쓴다
export const PER_GROUP_MAX_POLISH_ATTEMPTS = 48; // 요일 순서와 담금질 시드 재시작을 합쳐 그룹당 최대 이만큼만 다듬어본다
export const PER_GROUP_TOTAL_POLISH_BUDGET_MS = scaledBudgetMs(420000, 480);
export const MIN_POLISH_BUDGET_MS = scaledBudgetMs(6000, 10); // 시도가 여럿이어도 담금질이 의미 있으려면 한 시도당 최소한 이 정도는 필요하다
// 카드 간 목표 공유: 이 카드가, 앞서 끝난 카드가 이미 도달한 "미배정 없음 → 수업 횟수"
// 수준(targetFloor)에 정규 탐색 예산(PER_GROUP_SEARCH_DEADLINE_MS) 안에 못 미치면, 그
// 수준이 이 데이터에서 실제로 달성 가능하다는 뜻이므로 곧장 다듬기로 넘어가지 않고 더
// 탐색해본다(실제로 A-1은 수업 30건에 닿았는데 A-2·A-3는 서로 다른 시드 탓에 29건에
// 머무는 사례로 확인됨). 그래도 못 미치면 그 시점까지 찾은 가장 좋은 결과로 넘어간다 —
// 최댓값이 이 그룹의 시드 공간에서 사실상 못 닿는 경우도 있을 수 있어서다.
//
// 그리디 1·2단계의 지터(stage1RandomFn)는 "동점일 때만"(runSchedule2Pipeline 근처 주석
// 참고) 신청 순서를 바꾼다 — 즉 요일 순서만 더 섞어서는 신청 배열 자체의 순서가 30건
// 배치에 필요한 순서가 아니면 아무리 시도해도 못 찾는다(실제로 요일 순서만 늘려서는 이
// 문제가 해결되지 않는 사례로 확인됨). 그래서 목표에 못 미치면 신청 배열 자체를 통째로
// 다시 섞은 "대안 골격"(alt base)을 여러 번 새로 만들어, 그 골격 안에서 짧게 요일 순서를
// 탐색해보고 더 나은 결과를 찾으면 그 골격으로 완전히 갈아탄다.
export const TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS = scaledBudgetMs(90000, 100);
export const TARGET_MATCH_ALT_BASE_BUDGET_MS = scaledBudgetMs(8000, 20); // 대안 골격 하나에 쓸 수 있는 시간 상한
export const TARGET_MATCH_ALT_BASE_DAY_ORDER_SHUFFLES = 40; // 대안 골격 하나에서 시도할 무작위 요일 순서 수
// 신청 배열 순서(base) 하나를 요일별로 묶는다.
function groupByDay(reqs) {
  const reqsByDay = new Map();
  DAYS.forEach((_, d) => reqsByDay.set(d, []));
  reqs.forEach((r) => reqsByDay.get(r.day).push(r));
  const daysWithReqs = Array.from(reqsByDay.keys()).filter(
    (d) => reqsByDay.get(d).length > 0,
  );
  return { reqsByDay, daysWithReqs };
}
function fixedDayOrders(daysWithReqs, reqsByDay) {
  const memberCountOf = (day) =>
    new Set(reqsByDay.get(day).map((r) => r.memberId)).size;
  return [
    daysWithReqs.slice().sort((a, b) => memberCountOf(a) - memberCountOf(b)),
    daysWithReqs.slice().sort((a, b) => memberCountOf(b) - memberCountOf(a)),
    daysWithReqs.slice().sort((a, b) => a - b),
    daysWithReqs.slice().sort((a, b) => b - a),
  ];
}
// base(신청 배열 순서) 하나를 고정해두고, 그 안에서 요일 순서를 최대한 탐색해 이 base의
// 최선 결과를 찾는다. 회원·신청이 아주 많으면 요일 순서 후보 하나를 시도하는 데도 시간이
// 걸리므로(복구 단계 포함), 시간 예산을 둔다 — 예산을 넘기면 그때까지 찾은 가장 좋은
// 순서로 넘어간다. seedBase는 그리디 1·2단계 지터 시드의 밑변(호출하는 쪽에서 base·시도
// 끼리 겹치지 않도록 충분히 벌려서 넘긴다). randomFn은 호출하는 쪽(재시작 그룹 또는 품질
// 하한 따라잡기)이 쓰는 요일 순서 셔플용 의사난수를 그대로 받아 전체 탐색이 하나의 시드
// 계열로 재현 가능하게 한다.
async function searchWithinBase(
  reqs,
  reqsByDay,
  daysWithReqs,
  shuffleCount,
  deadlineMs,
  seedBase,
  randomFn,
  onEval,
) {
  const dayOrdersToTry = fixedDayOrders(daysWithReqs, reqsByDay);
  for (let k = 0; k < shuffleCount; k++)
    dayOrdersToTry.push(shuffled(daysWithReqs, randomFn));
  const deadline = performance.now() + deadlineMs;
    let best = null,
      bestOrder = null,
      bestSeedOffset = null;
    const evaluated = [];
    for (let i = 0; i < dayOrdersToTry.length; i++) {
      // seedOffset을 안 넘기면(undefined→0) 그리디 1·2단계의 지터(stage1RandomFn, 하루 안에서
      // 동점인 회원들 중 누구를 먼저 배정할지 정하는 값)가 요일 순서·그룹과 무관하게 항상 같은
      // 고정 시드로 고정돼버린다 — 그러면 그룹마다 "요일을 처리하는 순서"만 다를 뿐, "그 요일
      // 안에서 동점인 회원 중 누구를 고를지"는 항상 같아서, 실제로는 한두 명만 자리가 바뀐
      // 정도의 배치만 나온다(실제로 이 문제로 확인됨 — 페이저에 뜬 배치들이 골격은 거의 같고
      // 소수만 자리를 바꾼 수준이었음). base·시도 번호로 벌린 시드를 넘겨, base마다는 물론
      // 한 base 안의 요일 순서 시도끼리도 하루 안 배정이 서로 다르게 갈리도록 한다.
      const seedOffset = seedBase + i;
      const result = await runSchedule2Pipeline(
        reqs,
        reqsByDay,
        daysWithReqs,
        dayOrdersToTry[i],
        true,
        false,
        undefined,
        seedOffset,
      );
      // seedOffset을 결과와 함께 기억해둔다 — 다듬기 단계가 이 요일 순서를 다시 쓸 때 시드까지
      // 그대로 재현해야, 그리디 1·2단계의 동점 처리가 달라져 수업 건수 자체가 바뀌는 일 없이
      // "이 결과"를 다듬을 수 있다(아래 다듬기 후보 구성부 참고 — seedOffset을 안 넘겨주면
      // 다듬기가 매번 새 시드로 그리디 1·2단계를 다시 돌려, 탐색에서 찾은 최고 수업 건수를
      // 다듬은 결과가 재현하지 못하고 잃어버리는 문제가 있었다: 실제로 탐색 단계에서 30건을
      // 찾고도 다듬은 최종 결과는 29건으로 떨어지는 사례로 확인됨).
      evaluated.push({ order: dayOrdersToTry[i], seedOffset, result });
      if (!best || isSchedule2ResultBetter(result, best)) {
        best = result;
        bestOrder = dayOrdersToTry[i];
        bestSeedOffset = seedOffset;
      }
      if (onEval) await onEval();
      if (performance.now() >= deadline) break;
    }
    return { evaluated, best, bestOrder, bestSeedOffset };
}

// 재시작 그룹 하나를 처음부터 끝까지(요일 순서 탐색 → 다듬기) 돌려 그 그룹의 최종 결과
// 하나를 반환한다. groupSeed가 요일 순서 무작위 셔플을 결정하고, groupIndex는 다듬기
// 단계의 담금질 시드가 그룹끼리 겹치지 않도록 seedOffset의 밑변을 벌려준다.
export async function runSchedule2RestartGroup(
  eligibleReqsMaster,
  groupSeed,
  groupIndex,
  onProgress,
  targetFloor,
) {
  const randomFn = mulberry32(groupSeed);

  // ---- 기본 골격(primary base): 카드 고유의 시드로 신청 배열을 한 번 섞는다(사용자가
  // "같은 스케줄을 추가하고 후보 생성하기를 눌러도 항상 같은 후보가 나오는 게 아니다"라고
  // 확인한 바로 그 상황을 재현 — 그리디 1·2단계가 "동점인 신청들 중 배열에서 먼저 나온
  // 것을 우선 채택"하는 지점들이 있어, 요일 순서·지터만 그룹마다 다르게 줘서는 이 경로로만
  // 나오는 배치(골격 자체가 크게 다른 배치)를 못 찾는다). ----
  let eligibleReqs = shuffled(eligibleReqsMaster, randomFn);
  let grouping = groupByDay(eligibleReqs);
  let reqsByDay = grouping.reqsByDay,
    daysWithReqs = grouping.daysWithReqs;

  let progressMax = 0;
  const primary = await searchWithinBase(
    eligibleReqs,
    reqsByDay,
    daysWithReqs,
    PER_GROUP_DAY_ORDER_SHUFFLES,
    PER_GROUP_SEARCH_DEADLINE_MS,
    groupIndex * 5000000,
    randomFn,
    async () => {
      if (onProgress) {
        progressMax = Math.min(
          0.55,
          progressMax + 0.55 / (PER_GROUP_DAY_ORDER_SHUFFLES + 4),
        );
        onProgress(progressMax);
        await yieldToUI();
        checkGenerationCancelled();
      }
    },
  );
  let evaluated = primary.evaluated,
    best = primary.best,
    bestOrder = primary.bestOrder,
    bestSeedOffset = primary.bestSeedOffset;

  // 카드 간 목표 공유: 앞서 끝난 카드가 이미 도달한 수준(targetFloor)에 기본 골격 탐색으로는
  // 못 미쳤다면, 그 수준이 이 데이터에서 실제로 달성 가능하다는 뜻이므로 곧장 다듬기로
  // 넘어가지 않고 더 탐색해본다. 그리디 1·2단계의 지터는 "동점일 때만" 신청 순서를 바꾸므로
  // (runSchedule2Pipeline 근처 주석 참고), 기본 골격 안에서 요일 순서만 더 섞어서는 신청
  // 배열 자체의 순서가 그 수준에 필요한 순서가 아닌 경우 못 찾는다 — 그래서 신청 배열
  // 자체를 통째로 다시 섞은 "대안 골격"을 여러 번 새로 만들어(짧게) 탐색해보고, 더 나은
  // 결과를 찾으면 그 골격으로 완전히 갈아탄다. 그래도 못 미치면 그 시점까지 찾은 가장 좋은
  // 결과로 넘어간다 — 최댓값이 이 그룹의 시드 공간에서 사실상 못 닿는 경우도 있을 수 있어서다.
  if (targetFloor && best && floorIsBetter(targetFloor, best)) {
    const extraDeadline =
      performance.now() + TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS;
    let altRestartCount = 0;
    while (
      performance.now() < extraDeadline &&
      floorIsBetter(targetFloor, best)
    ) {
      altRestartCount++;
      const altReqs = shuffled(eligibleReqsMaster, randomFn);
      const altGrouping = groupByDay(altReqs);
      const altBudget = Math.min(
        TARGET_MATCH_ALT_BASE_BUDGET_MS,
        Math.max(0, extraDeadline - performance.now()),
      );
      const alt = await searchWithinBase(
        altReqs,
        altGrouping.reqsByDay,
        altGrouping.daysWithReqs,
        TARGET_MATCH_ALT_BASE_DAY_ORDER_SHUFFLES,
        altBudget,
        groupIndex * 5000000 + altRestartCount * 1000000,
        randomFn,
        async () => {
          if (onProgress) {
            progressMax = Math.min(0.549, progressMax + 0.002);
            onProgress(progressMax);
            await yieldToUI();
            checkGenerationCancelled();
          }
        },
      );
      const improved = alt.best && isSchedule2ResultBetter(alt.best, best);
      if (improved) {
        eligibleReqs = altReqs;
        reqsByDay = altGrouping.reqsByDay;
        daysWithReqs = altGrouping.daysWithReqs;
        evaluated = alt.evaluated;
        best = alt.best;
        bestOrder = alt.bestOrder;
        bestSeedOffset = alt.bestSeedOffset;
      }
    }
  }
  if (!bestOrder) return null;

  // 다듬기 전 지표가 최선과 완전히 동점인 요일 순서만 다듬어보면(예전 방식), 다듬기 전엔
  // 살짝 못해 보이지만 다듬고 나면(특히 담금질 기법으로) 더 좋아지는 순서를 놓칠 수 있다
  // (실제로 수동으로 짠 스케줄이 다듬기 전 지표까지는 최선과 같은데, 그 최선 순서를
  // 다듬은 것보다도 이동을 1번 더 줄인 사례로 확인됨 — 즉 "동점"이 아니라 "최선에 가까운"
  // 순서 중에도 다듬으면 더 좋아지는 것이 있을 수 있다는 뜻). 그래서 완전 동점만 고르지
  // 않고, 다듬기 전 지표로 전체 순위를 매겨 상위 PER_GROUP_MAX_POLISH_CANDIDATES개(서로
  // 다른 배치만)를 고른다 — 다듬기는 항상 "다듬은 뒤 실제로 더 나쁘면 버리는" 방식이라
  // 후보를 넓혀도 손해는 없다.
  const ranked = evaluated.slice().sort((x, y) => {
    if (isSchedule2ResultBetter(x.result, y.result)) return -1;
    if (isSchedule2ResultBetter(y.result, x.result)) return 1;
    return 0;
  });
  const seenSignatures = new Set();
  const polishCandidates = [];
  for (const { order, seedOffset, result } of ranked) {
    const sig = schedule2Signature(result);
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);
    polishCandidates.push({ order, seedOffset });
    if (polishCandidates.length >= PER_GROUP_MAX_POLISH_CANDIDATES) break;
  }
  if (polishCandidates.length === 0)
    polishCandidates.push({ order: bestOrder, seedOffset: bestSeedOffset });

  // 요일 순서 후보만으로는 부족하다 — 담금질 기법은 시드가 고정돼 있으면 매번 정확히 같은
  // 무작위 경로만 훑어보므로, 사람이 손으로 짠 배치처럼 3명 이상이 요일을 넘나들며 동시에
  // 자리를 맞바꿔야만 나오는 조합은 그 경로를 우연히 밟지 못하면 몇 번을 다시 생성해도
  // 계속 같은 결과에 머문다(실제로 이 문제로 확인됨). 그래서 각 요일 순서 후보를 서로 다른
  // 시드로 여러 번 재시작해서 다듬어본다 — 후보를 돌아가며 시드를 바꿔 재시작을 추가한다.
  // groupIndex * 5,000,000을 더해 다른 재시작 그룹과 담금질 시드가 겹치지 않게 한다.
  //
  // round 0(첫 바퀴)은 각 후보가 "탐색 단계에서 실제로 그 지표(수업 수 포함)를 만들어낸"
  // 원래 seedOffset을 그대로 재사용한다 — 새 시드를 굴리면 그리디 1·2단계의 동점 처리가
  // 달라져 같은 요일 순서라도 수업 건수 자체가 바뀔 수 있어서, round 0을 재시드해버리면
  // 탐색 단계에서 찾은 최고 수업 건수를 다듬은 결과가 재현하지 못하고 잃어버린다(실제로
  // 확인됨: 탐색 단계에서 30건을 찾고도 다듬은 최종 결과는 29건으로 떨어짐). round 1부터는
  // 원래 방식대로 새 시드로 재시작해 다양성을 넓힌다.
  const attempts = polishCandidates.map((c) => ({
    order: c.order,
    seedOffset: c.seedOffset,
  }));
  for (
    let round = 1;
    attempts.length < PER_GROUP_MAX_POLISH_ATTEMPTS;
    round++
  ) {
    for (const c of polishCandidates) {
      attempts.push({
        order: c.order,
        seedOffset: groupIndex * 5000000 + round * 97711,
      });
      if (attempts.length >= PER_GROUP_MAX_POLISH_ATTEMPTS) break;
    }
  }

  // 시도 개수만큼 다듬기 시간 예산을 나누되(최소 예산은 보장), 각 시도를 다듬은 뒤
  // 서로 비교해 이 그룹에서 실제로 가장 좋은 결과를 택한다. 다듬은 시도는 전부 기억해뒀다가
  // 아래에서 동점을 골라내는 데 쓴다 — polishCandidates에 이미 서로 다른 골격(요일 순서)이
  // 여러 개 섞여 있을 수 있어(예: 완전히 대칭인 데이터라면 "월↔화를 맞바꾼" 요일 순서도
  // 다듬기 전 지표가 같아 함께 뽑힘), 최선 하나만 고르면 그 안에 이미 있었던 동점 배치를
  // 그냥 버리게 된다(실제로 이 문제로 확인됨 — 페이저에 아무 것도 안 뜸).
  const perAttemptBudget = Math.max(
    MIN_POLISH_BUDGET_MS,
    Math.floor(PER_GROUP_TOTAL_POLISH_BUDGET_MS / attempts.length),
  );
  let bestPolished = null;
  const allPolished = [];
  for (let i = 0; i < attempts.length; i++) {
    const attempt = await runSchedule2Pipeline(
      eligibleReqs,
      reqsByDay,
      daysWithReqs,
      attempts[i].order,
      true,
      true,
      perAttemptBudget,
      attempts[i].seedOffset,
    );
    allPolished.push(attempt);
    if (!bestPolished || isSchedule2ResultBetter(attempt, bestPolished))
      bestPolished = attempt;
    if (onProgress) {
      onProgress(0.55 + ((i + 1) / attempts.length) * 0.45);
      await yieldToUI();
      checkGenerationCancelled();
    }
  }
  // 배치 페이저용: bestPolished와 완전히 동점(미배정 → 수업 수 → 이동 횟수 → 이동 시간 →
  // 빈 시간 전부 동일)인 다른 시도를 서명 중복 제거해 최대 MAX_POOL_VARIANTS개까지 모은다.
  // bestPolished 자신과 서명이 같은 자리는 (같은 배정을 만든 다른 시도 객체가 아니라)
  // bestPolished 참조 그대로 넣어야, 페이저가 pool.indexOf(result)로 현재 위치를 찾을 수 있다.
  const bestSig = schedule2Signature(bestPolished);
  const tied = [];
  const seenTieSig = new Set();
  allPolished.forEach((cand) => {
    if (
      isSchedule2ResultBetter(cand, bestPolished) ||
      isSchedule2ResultBetter(bestPolished, cand)
    )
      return;
    const sig = schedule2Signature(cand);
    if (seenTieSig.has(sig)) return;
    seenTieSig.add(sig);
    if (tied.length < MAX_POOL_VARIANTS)
      tied.push(sig === bestSig ? bestPolished : cand);
  });
  // 위 루프는 캡(MAX_POOL_VARIANTS)에 먼저 도달하면 bestPolished 자신의 서명이
  // 뒤늦게 나와도 못 들어갈 수 있다. bestPolished는 정의상 항상 자기 자신과 동점이므로
  // pool에 반드시 포함되어야 페이저가 현재 위치(pool.indexOf(result))를 찾을 수 있다.
  if (!tied.includes(bestPolished)) {
    if (tied.length >= MAX_POOL_VARIANTS) tied.length = MAX_POOL_VARIANTS - 1;
    tied.unshift(bestPolished);
  }
  return { result: bestPolished, pool: tied };
}

// 여러 요일 순서를 다 시도해보는 동안(특히 회원·신청이 많으면 한 조합에도 시간이 좀
// 걸릴 수 있어) 화면이 멈춘 것처럼 보이지 않도록, onProgress가 있으면 조합 하나를 끝낼
// 때마다 진행률을 알리고 화면을 다시 그릴 틈(yieldToUI)을 준다.
export async function generateSchedule2Async(onProgress) {
  const eligibleReqs = state.requests.filter(isEligibleRequest2);

  // 아래 "카드 간 품질 하한 공유"가 후보A 버튼만 단독으로 눌러도(후보B·C를 따로 생성해두지
  // 않아도) 항상 그리디 수준까지 확인할 수 있도록, 그리디 엔진(engine/greedy.js)으로 빠른
  // 기준선을 하나 미리 만들어둔다. 화면에 보이는 후보B/C 카드(runtime.candidates)나 그
  // 되돌리기 이력은 전혀 건드리지 않는다 — 체인DP 카드들끼리(그리고 그 카드들과) 비교할 때만
  // 쓰는 내부 참고용이다(실제로 사용자가 후보A만 단독으로 눌렀더니 후보B·C 수준을 못 따라
  // 잡은 사례로 확인됨 — runtime.candidates는 후보B·C를 먼저 생성해둔 적이 있을 때만 채워져
  // 있다). 그리디는 담금질보다 훨씬 빨라(수 초~수십 초) 전체 대기 시간에 크게 보태지 않는다.
  const GREEDY_BASELINE_PROGRESS_SHARE = 0.08;
  const greedyBaseline = await generateCandidatesAsync((p) => {
    if (onProgress) onProgress(p * GREEDY_BASELINE_PROGRESS_SHARE);
  });
  const cardProgressShare = 1 - GREEDY_BASELINE_PROGRESS_SHARE;

  // 후보A-1/A-2/A-3 카드마다 독립적으로 탐색한다(서로 다른 시드 → 서로 다른 골격에서
  // 출발) — 카드끼리 동점일 필요는 없다. 기본적으로 각 카드는 자기 자신의 탐색
  // (runSchedule2RestartGroup) 안에서 나온 동점만 배치 페이저로 보여주지만, 아래 "카드 간
  // 품질 하한 공유"로 다른 카드·그리디 결과로 바꿔치기되면 그 시점에 찾아낸 동점들로 풀이
  // 다시 채워진다.
  const cards = [];
  // 카드 간 목표 공유: 먼저 끝난 카드가 도달한 "미배정 없음 → 수업 횟수" 최고 수준을
  // 기억해뒀다가 다음 카드에 넘긴다 — 못 미치는 카드가 나오면 그 카드가 더 탐색하도록
  // runSchedule2RestartGroup의 targetFloor 처리(TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS)로 이어진다.
  let targetFloor = null;
  for (let g = 0; g < SCHEDULE2_CARD_COUNT; g++) {
    // 카드마다 서로 다른 소수 간격으로 시드를 벌려, 요일 순서·신청 배열 순서 무작위 셔플이
    // 카드끼리 겹치지 않고 완전히 다른 골격에서 출발하게 한다.
    const groupSeed = 20260823 + g * 104729;
    const groupStart =
      GREEDY_BASELINE_PROGRESS_SHARE +
      (g / SCHEDULE2_CARD_COUNT) * cardProgressShare;
    const card = await runSchedule2RestartGroup(
      eligibleReqs,
      groupSeed,
      g,
      (p) => {
        if (onProgress)
          onProgress(groupStart + (p / SCHEDULE2_CARD_COUNT) * cardProgressShare);
      },
      targetFloor,
    );
    cards.push(
      card || { result: { assigned: [], unassignedMembers: [] }, pool: [] },
    );
    if (card && card.result && floorIsBetter(card.result, targetFloor))
      targetFloor = card.result;
  }

  // 카드 간 품질 하한 공유: 카드끼리는 "요일 순서·신청 배열 순서가 다른 골격"에서 독립적으로
  // 탐색하도록 일부러 설계했고(SCHEDULE2_CARD_COUNT 근처 주석 참고), targetFloor도 미배정·
  // 수업 횟수까지만 공유해 이동·빈 시간은 카드마다 다를 수 있게 뒀다. 그런데 그 결과 한 카드가
  // 다른 카드보다, 또는 완전히 다른 엔진인 그리디(engine/greedy.js, 위 greedyBaseline과 화면에
  // 이미 떠 있을 수 있는 runtime.candidates 둘 다)보다 이동+빈 시간 환산 점수(TRAVEL_VALUE_MINUTES
  // 기준)로 순수하게 더 나쁠 수 있다 — 실제로 체인DP+담금질 카드를 같은 예산으로 통째로
  // 재시도시켜봐도(카드 하나를 새로 만드는 것과 같은 시간이 걸림) 그리디가 우연히 찾아낸
  // 이동5·빈시간0 수준을 못 따라잡는 사례가 있었다(사용자 피드백으로 확인됨). 그리디가 그
  // 수준이 이 데이터에서 실제로 가능하다는 걸 이미 증명했으므로, 체인DP 쪽에 그걸 다시
  // "찾아내라"고 느리고 못 미덥게 시키는 대신 그리디 결과(assigned/unassignedMembers 형태가
  // 그대로 호환된다)를 가장 좋은 것부터 찾아, 그보다 못한 카드는 그 결과를 즉시 가져다 쓴다.
  // 추가 탐색이 전혀 없어 순간적으로 끝나므로, 진행률 바가 카드 3장을 다 만든 뒤에도 한참
  // 100%에 멈춰 있던 문제도 이걸로 함께 없어진다.
  if (targetFloor) {
    let best = null;
    function considerAsCandidate(result) {
      if (!result || floorIsBetter(targetFloor, result)) return;
      if (!best || isSchedule2ResultBetter(result, best)) best = result;
    }
    const externalCandidates = (greedyBaseline.built || [])
      .concat(runtime.candidates || [])
      .map((cand) => {
        if (!cand || !cand.assigned) return null;
        return {
          assigned: cand.assigned,
          unassignedMembers: cand.unassignedMembers || [],
        };
      })
      .filter(Boolean);
    cards.forEach((c) => considerAsCandidate(c.result));
    externalCandidates.forEach((asResult) => considerAsCandidate(asResult));
    if (best) {
      // best로 카드를 통째로 바꿔치기하면 그 카드는 더 이상 "자기 자신의 탐색"에서 나온
      // 결과가 아니게 된다 — best 혼자만(pool 1개) 들고 오면 배치 페이저가 사라져버리므로
      // (실제로 이 문제로 확인됨), best와 정확히 동점인 배치를 카드들의 결과·각자 풀·
      // 그리디/후보B·C 쪽에서 모두 긁어모아 새 풀을 만든다. best보다 못한 동점 아닌 배치는
      // 절대 섞지 않는다(동점 풀은 늘 진짜 동점만 보여줘야 한다).
      const bestSig = schedule2Signature(best);
      const bestPool = [];
      const seenTieSig = new Set();
      function addTie(result) {
        if (!result) return;
        if (
          isSchedule2ResultBetter(best, result) ||
          isSchedule2ResultBetter(result, best)
        )
          return;
        const sig = schedule2Signature(result);
        if (seenTieSig.has(sig)) return;
        seenTieSig.add(sig);
        if (bestPool.length < MAX_POOL_VARIANTS)
          bestPool.push(sig === bestSig ? best : result);
      }
      addTie(best);
      cards.forEach((c) => {
        addTie(c.result);
        (c.pool || []).forEach(addTie);
      });
      externalCandidates.forEach(addTie);
      for (let g = 0; g < cards.length; g++) {
        const c = cards[g];
        if (!c.result || floorIsBetter(targetFloor, c.result)) continue;
        if (!isSchedule2ResultBetter(best, c.result)) continue;
        // bestPool을 그대로(참조로) 나눠주면 여러 카드가 같은 배열을 공유하게 되어, 한
        // 카드에서 페이저로 다른 배치를 골라(pickCandidateASlot의 pool.unshift 등) 배열을
        // 바꾸면 다른 카드의 풀까지 조용히 같이 바뀐다 — 카드마다 독립된 복사본을 준다.
        cards[g] = { result: best, pool: bestPool.slice() };
      }
    }
  }

  if (onProgress) onProgress(1);
  return cards; // [{result, pool}, {result, pool}, {result, pool}]
}
