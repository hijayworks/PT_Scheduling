import {
  DAYS,
  SLOT_MIN,
  MAX_TRAVELS_PER_DAY,
  MAX_SESSIONS_PER_MEMBER,
  CONSULT_DURATION_MIN_2,
  SESSION_DURATION_MIN_2,
} from "../constants.js";
import { cellKey, durationToSlots } from "../utils.js";
import { state, runtime } from "../state.js";
import { memberById, travelMinutes } from "../domain.js";
import {
  currentExcludedIds2,
  currentOnceLimitIds2,
} from "../selectionOverride.js";
import {
  yieldToUI,
  checkGenerationCancelled,
  candidateLocationsForRequest,
  dailyTravelCount,
  totalTravelCount,
  totalTravelMinutes,
  TRAVEL_VALUE_MINUTES,
  MAX_POOL_VARIANTS,
} from "./greedy.js";

/* ---------------- "수업 스케줄 생성2": 새 후보 생성 알고리즘 ----------------
     기존 "수업 스케줄 생성1"(greedyAssign 등)과는 완전히 별개의, 훨씬 단순한 그리디
     알고리즘이다. 규칙:
       - 등록 회원 수업은 60분, 상담 회원은 30분(SESSION_DURATION_MIN_2 / CONSULT_DURATION_MIN_2).
       - 쉬는 시간은 두지 않는다 — 같은 지점이면 바로 이어서, 지점이 다르면 이동 시간만큼만 간격을 둔다.
       - 1순위: 미배정 회원이 없도록 한다. 2순위: 그 안에서 총 수업 수를 최대화한다.
       - 후보는 여러 개를 비교하지 않고 1개만 만든다(재생성 기능 없음).
     전략: 하루를 이른 시각부터 훑으며 이어서 시작할 수 있는(같은 지점이면 바로, 다른 지점이면
     이동 시간만큼 지난 뒤) 신청으로 최대한 빈틈없이 채운다 — 이동이 필요한 구간은 "빈 시간"이
     아니라 "이동 시간"으로 활용하는 것이 핵심이다(findInsertSlot의 간격 검사가 이를 보장).
     다만 무조건 이른 순서로만 채우면 신청 폭이 좁은 회원이 자리를 뺏겨 미배정으로 남기 쉬우므로,
     먼저 신청 가능한 자리 수가 적은 회원부터 1회씩 자리를 확보해준 뒤(1단계), 남은 자리를
     시간순으로 최대한 채운다(2단계). */

export function sessionDurationFor2(member) {
  return (member && (member.category || "상담")) === "상담"
    ? CONSULT_DURATION_MIN_2
    : SESSION_DURATION_MIN_2;
}

export function maxSessionsFor2(member) {
  if (!member) return 1;
  if (currentOnceLimitIds2().includes(member.id)) return 1;
  return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
}

// 두 세션 사이에 필요한 최소 간격(분): 쉬는 시간 없이, 지점이 다를 때만 그 이동 시간만큼.
// 슬롯 격자에 맞춰 올림한다(격자에서 표현 가능한 가장 좁은 간격을 기준으로 삼기 위함).
export function requiredGapMin2(locA, locB) {
  const raw = travelMinutes(locA, locB);
  return raw > 0 ? Math.ceil(raw / SLOT_MIN) * SLOT_MIN : 0;
}

export function isEligibleRequest2(req) {
  const member = memberById(req.memberId);
  if (!member || currentExcludedIds2().includes(req.memberId)) return false;
  const slots = durationToSlots(sessionDurationFor2(member));
  for (let i = 0; i < slots; i++) {
    if (!runtime.availableCells.has(cellKey(req.day, req.startSlot + i)))
      return false;
  }
  return true;
}

// 하루치 후보(신청 x 사용 가능 지점 조합)를 노드로 만든다. weightFn(memberId, startSlot,
// locationId)이 0/false를 돌려주면 그 조합은 후보에서 아예 뺀다 — 양수를 돌려주면 그
// 값이 그 노드를 골랐을 때 얻는 가중치(보통 1, 이미 확정된 자리를 그대로 유지시키고 싶을
// 때는 아주 큰 값)가 된다.
// jitterFn이 있으면(무작위 함수) 노드마다 작은 무작위 값을 하나씩 붙여둔다 — runChainDP가
// 다른 조건이 모두 동점일 때 이 값을 마지막 동점 처리 기준으로 써서, 요일 순서를 아무리
// 바꿔도 항상 시간순으로만 동점을 처리해 매번 "누가 2회를 받을지"가 똑같이 정해지던
// 문제를 깨뜨린다(요일 전체 재섞기 다듬기 단계 전용).
export function buildDayNodes(dayRequests, weightFn, jitterFn) {
  const nodes = [];
  dayRequests.forEach((r) => {
    const member = memberById(r.memberId);
    const duration = sessionDurationFor2(member);
    const end = r.startSlot + durationToSlots(duration);
    candidateLocationsForRequest(r).forEach((locationId) => {
      const weight = weightFn(r.memberId, r.startSlot, locationId);
      if (!weight) return;
      nodes.push({
        id: r.id,
        memberId: r.memberId,
        day: r.day,
        startSlot: r.startSlot,
        duration,
        locationId,
        end,
        weight,
        jitter: jitterFn ? jitterFn() : 0,
      });
    });
  });
  return nodes;
}

// "빈 시간 없이, 하루 이동 최대 MAX_TRAVELS_PER_DAY번까지"를 만족하며 가중치 합이 최대인
// 체인을 DP로 찾는다 — 끝나는 시각 순으로 노드를 처리하면서, 각 노드 앞에 올 수 있는(겹치지
// 않고 필요한 이동 시간만큼 간격이 확보된) 이전 노드들 중 가장 좋은 것을 이어붙인다
// (고전적인 "가중치 있는 구간 스케줄링" DP를, 지점마다 다른 이동 시간이 필요하다는 조건과
// 하루 이동 횟수 제한까지 반영해 확장한 것). 단순 그리디와 달리 이미 고른 것을 무를 수는
// 없지만 "앞에서부터 그리디하게 확정"하지 않고 전체를 한 번에 최적화하므로, 이르지만
// 고립된 신청 하나 때문에 뒤의 더 큰 무리를 놓치는 일이 없다.
export function runChainDP(nodes, maxTravelsPerDay) {
  if (maxTravelsPerDay === undefined) maxTravelsPerDay = MAX_TRAVELS_PER_DAY;
  nodes = nodes
    .slice()
    .sort((a, b) => a.end - b.end || a.startSlot - b.startSlot);
  const n = nodes.length;
  const dp = new Array(n),
    tc = new Array(n),
    tm = new Array(n),
    idle = new Array(n),
    js = new Array(n),
    prev = new Array(n);
  // 인원(가중치 합) → 이동 횟수 → 이동 시간 → 빈 시간(이동에 실제로 필요한 시간을 넘어서는
  // 여분의 간격) → 지터(무작위 값, buildDayNodes 참고) 순으로 비교한다. 세션 수·이동은
  // 완전히 같은데 시작 시각만 다른 선택지들(예: 15:00 시작과 15:30 시작 둘 다 다음 세션에
  // 문제없이 이어지는 경우) 사이에서는 빈 시간 기준이, 뒤에 남는 빈 시간을 최소화하는
  // 시작 시각을 고르게 해준다. 지터는 평소엔 전부 0이라 아무 영향이 없고, 요일 전체
  // 재섞기 다듬기 단계에서만 값을 채워 넣어 "동점이면 항상 시간순으로만 정해지던" 동점
  // 처리를 매 시도마다 다르게 흔들어준다.
  function better(dpA, tcA, tmA, idleA, jsA, dpB, tcB, tmB, idleB, jsB) {
    if (dpA !== dpB) return dpA > dpB;
    if (tcA !== tcB) return tcA < tcB;
    if (tmA !== tmB) return tmA < tmB;
    if (idleA !== idleB) return idleA < idleB;
    return jsA < jsB;
  }
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    let bestDp = node.weight,
      bestTc = 0,
      bestTm = 0,
      bestIdle = 0,
      bestJs = node.jitter || 0,
      bestPrev = -1;
    for (let j = 0; j < i; j++) {
      const p = nodes[j];
      if (p.memberId === node.memberId) continue; // 회원당 1일 최대 1회
      const gapNeed = requiredGapMin2(p.locationId, node.locationId);
      const gapActual = (node.startSlot - p.end) * SLOT_MIN;
      if (gapActual < gapNeed) continue;
      const addsTravel =
        travelMinutes(p.locationId, node.locationId) > 0 ? 1 : 0;
      const newTc = tc[j] + addsTravel;
      if (newTc > maxTravelsPerDay) continue;
      const newDp = dp[j] + node.weight;
      const newTm = tm[j] + travelMinutes(p.locationId, node.locationId);
      const newIdle = idle[j] + (gapActual - gapNeed);
      const newJs = js[j] + (node.jitter || 0);
      if (
        better(
          newDp,
          newTc,
          newTm,
          newIdle,
          newJs,
          bestDp,
          bestTc,
          bestTm,
          bestIdle,
          bestJs,
        )
      ) {
        bestDp = newDp;
        bestTc = newTc;
        bestTm = newTm;
        bestIdle = newIdle;
        bestJs = newJs;
        bestPrev = j;
      }
    }
    dp[i] = bestDp;
    tc[i] = bestTc;
    tm[i] = bestTm;
    idle[i] = bestIdle;
    js[i] = bestJs;
    prev[i] = bestPrev;
  }
  let bestEnd = -1,
    bestDpAll = 0,
    bestTcAll = 0,
    bestTmAll = 0,
    bestIdleAll = 0,
    bestJsAll = 0;
  for (let i = 0; i < n; i++) {
    if (
      bestEnd === -1 ||
      better(
        dp[i],
        tc[i],
        tm[i],
        idle[i],
        js[i],
        bestDpAll,
        bestTcAll,
        bestTmAll,
        bestIdleAll,
        bestJsAll,
      )
    ) {
      bestDpAll = dp[i];
      bestTcAll = tc[i];
      bestTmAll = tm[i];
      bestIdleAll = idle[i];
      bestJsAll = js[i];
      bestEnd = i;
    }
  }
  const chain = [];
  const used = new Set();
  let cur = bestEnd;
  while (cur !== -1 && cur !== undefined) {
    const node = nodes[cur];
    // 회원이 하루에 서로 겹치지 않는 신청을 두 번(예: 오전·저녁을 따로 등록) 낸 드문
    // 경우를 위한 안전망 — 인접 검사만으로는 못 거르는 비인접 중복을 여기서 한 번 더 막는다.
    if (!used.has(node.memberId)) {
      chain.unshift(node);
      used.add(node.memberId);
    }
    cur = prev[cur];
  }
  return chain;
}

// 1단계에서 요일을 어떤 순서로 처리하느냐에 따라 "누가 어느 요일에 먼저 자리를 잡는지"가
// 달라진다 — 예를 들어 두 요일 모두 가능한 회원을 앞 요일에 먼저 배정해버리면, 뒤 요일에
// 정작 그 시간대를 쓸 수 있는 사람이 그 회원뿐이었던 경우 그 자리가 그냥 비어버릴 수 있다.
// 하루 안에서는 DP로 항상 최선을 찾지만, "어느 요일부터 볼지"까지는 요일 수가 6개뿐이라도
// 모든 조합을 다 따질 수는 없으므로, 여러 그럴듯한 순서로 전체 파이프라인을 반복 실행해보고
// (미배정 → 수업 수 → 이동 횟수 → 이동 시간 순으로) 가장 좋은 결과를 채택한다.
// seedOffset: 다듬기 단계(특히 담금질 기법)가 쓰는 의사난수 시드를 통째로 밀어, 같은 요일
// 순서·같은 배치에서 시작해도 서로 다른 탐색 경로를 시도해볼 수 있게 한다(generateSchedule2Async의
// 다중 재시작용 — 담금질 기법은 무작위로 하나씩 옮겨보다가 가끔 일부러 나빠지는 이동도
// 받아들이며 헤매는 방식이라, 시드가 고정돼 있으면 매번 정확히 같은 경로만 훑어보고 만다.
// 사람이 손으로 짠 배치처럼 3명 이상이 요일을 넘나들며 동시에 자리를 맞바꿔야만 나오는
// 조합은, 그 경로를 우연히 밟은 시드로만 찾을 수 있다 — 그래서 여러 시드로 재시작해보는
// 것이 요일 순서를 여러 개 시도하는 것만큼이나 중요하다).
export async function runSchedule2Pipeline(
  eligibleReqs,
  reqsByDay,
  daysWithReqs,
  stage1DayOrder,
  runRepair,
  runPolish,
  polishBudgetMs,
  seedOffset,
) {
  seedOffset = seedOffset || 0;
  // 아래 다듬기 루프들(특히 담금질 기법)은 동기로 몇 초~몇십 초씩 돌면 탭이 완전히
  // 멈춰버리므로, 주기적으로 yieldToUI에 제어권을 넘겨준다. 다만 그 시간도 실제 시계
  // (performance.now())에는 그대로 흐르므로, 아무 보정 없이 넘기기만 하면 같은 시간
  // 예산 안에서 돌 수 있는 반복 횟수가 줄어 결과 품질이 미세하게 나빠질 수 있다. 그래서
  // "양보에 실제로 쓴 시간"을 yieldOverheadMs에 누적해뒀다가, 이후 모든 마감시간 비교에는
  // performance.now() 대신 now()(= performance.now() - yieldOverheadMs, "순수 계산 시간만
  // 흐르는 시계")를 쓴다 — 양보한 시간만큼 마감이 뒤로 늦춰지는 셈이라, 계산량 자체는
  // 양보를 추가하기 전과 동일하게 유지된다.
  let yieldOverheadMs = 0;
  function now() {
    return performance.now() - yieldOverheadMs;
  }
  let lastYieldAt = performance.now();
  const YIELD_INTERVAL_MS = 48; // 프레임 몇 개 분량마다 한 번씩만 양보 — 너무 자주 양보하면 그 자체 오버헤드가 커진다
  async function maybeYield() {
    checkGenerationCancelled();
    const t = performance.now();
    if (t - lastYieldAt < YIELD_INTERVAL_MS) return;
    await yieldToUI();
    yieldOverheadMs += performance.now() - t;
    lastYieldAt = performance.now();
    checkGenerationCancelled();
  }
  // 1·2단계(그리디 DP)는 지터가 없으면 같은 요일 순서에서는 항상 정확히 같은 결과만
  // 낸다 — 그래서 요일 순서가 같은 여러 다듬기 시도(seedOffset만 다른)가 전부 똑같은
  // 출발점에서 시작해, 다듬기(7~8단계)가 절대 갈 수 없는 곳(전체 요일을 통째로 다시 짜야
  // 나오는 배치)은 seedOffset을 아무리 많이 시도해도 찾을 수 없었다(실제로 확인된 문제 —
  // 수동으로 짠 스케줄처럼 요일 절반이 통째로 바뀌어야 하는 배치는 다듬기만으로는 못
  // 찾음). 그래서 1·2단계에도 seedOffset으로 시드를 만든 지터를 줘서, 요일 순서가 같아도
  // seedOffset이 다르면 애초에 그리디 단계에서부터 다른 배치로 시작하게 한다(동점일 때만
  // 영향을 준다 — dp/이동/빈 시간이 이미 다르면 지터는 무시됨).
  const stage1RandomFn = mulberry32(112233 + seedOffset);
  const assignedCountByMember = new Map();
  const assignedDaysByMember = new Map();
  const dayChains = new Map();
  // 연쇄 교환(tryPlaceMember)은 최악의 경우 회원·신청이 아주 많고 서로 자리를 강하게
  // 물고 있으면 재귀 시도가 크게 늘어날 수 있다. 요일 순서 후보를 가볍게 비교하는 탐색
  // 단계(runPolish=false)에서는 다듬기 단계의 시간 예산(POLISH_DEADLINE)이 아예 적용되지
  // 않으므로, 이 단계 자체에도 최소한의 시간 상한을 둬 한 후보 때문에 전체 탐색이 통째로
  // 오래 걸리는 일을 막는다.
  const REPAIR_DEADLINE = now() + 3000;

  // "그 요일의, 이 회원의 신청들"을 매번 배열 전체를 훑어(filter) 찾지 않도록 미리
  // 회원별·요일별로 묶어둔다 — 회원·신청이 많을 때 복구/다듬기 단계들이 이걸 아주 여러 번
  // 반복해서 찾으므로, 이 인덱스 하나로 전체 성능이 크게 갈린다.
  const reqsByMemberDay = new Map(); // memberId -> (day -> requests[])
  eligibleReqs.forEach((r) => {
    if (!reqsByMemberDay.has(r.memberId))
      reqsByMemberDay.set(r.memberId, new Map());
    const byDay = reqsByMemberDay.get(r.memberId);
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  function reqsFor(memberId, day) {
    const byDay = reqsByMemberDay.get(memberId);
    return (byDay && byDay.get(day)) || [];
  }
  function reqAt(memberId, day, startSlot) {
    return reqsFor(memberId, day).find((r) => r.startSlot === startSlot);
  }

  function isEligibleForDay(memberId, day) {
    const cap = maxSessionsFor2(memberById(memberId));
    if ((assignedCountByMember.get(memberId) || 0) >= cap) return false;
    const days = assignedDaysByMember.get(memberId);
    return !(days && days.has(day));
  }
  function commit(day, node) {
    assignedCountByMember.set(
      node.memberId,
      (assignedCountByMember.get(node.memberId) || 0) + 1,
    );
    if (!assignedDaysByMember.has(node.memberId))
      assignedDaysByMember.set(node.memberId, new Set());
    assignedDaysByMember.get(node.memberId).add(day);
  }
  function uncommit(day, node) {
    assignedCountByMember.set(
      node.memberId,
      assignedCountByMember.get(node.memberId) - 1,
    );
    assignedDaysByMember.get(node.memberId).delete(day);
  }

  // 그 요일에 아직 미배정인 회원들이 가장 많이 쓰는 지점(가장 많은 서로 다른 회원이 다닐
  // 수 있는 지점)을 구한다 — 그 지점 후보에게 아주 작은 가중치 보너스를 줘서, 인원 수는
  // 그대로 최대화하면서도 동점일 때는 요일 하나를 한 지점으로 크게 뭉치는 쪽을 우선하게
  // 한다(수동으로 짠 스케줄에서 확인된 "요일마다 지점을 크게 하나로 묶는" 패턴 — 예를
  // 들어 화요일 전원을 마포점으로만 채워 그날 이동을 0번으로 만드는 식 — 을 재현하기
  // 위함). 보너스는 1보다 훨씬 작게 둬서 "인원 최대화"보다 항상 낮은 우선순위를 갖는다.
  function dominantLocationFor(day) {
    const membersByLoc = new Map();
    reqsByDay.get(day).forEach((r) => {
      if ((assignedCountByMember.get(r.memberId) || 0) !== 0) return;
      candidateLocationsForRequest(r).forEach((locId) => {
        if (!membersByLoc.has(locId)) membersByLoc.set(locId, new Set());
        membersByLoc.get(locId).add(r.memberId);
      });
    });
    let dominantLoc = null,
      dominantCount = -1;
    membersByLoc.forEach((set, locId) => {
      if (set.size > dominantCount) {
        dominantCount = set.size;
        dominantLoc = locId;
      }
    });
    return dominantLoc;
  }

  // 1단계: "미배정 회원 없음"이 최우선 목표이므로, 주어진 요일 순서대로 처리하며 그 시점까지
  // 아직 한 번도 배정받지 못한 회원들만으로 그 요일의 최선 체인(DP)을 짠다.
  stage1DayOrder.forEach((day) => {
    const dominantLoc = dominantLocationFor(day);
    const nodes = buildDayNodes(
      reqsByDay.get(day),
      (memberId, startSlot, locationId) => {
        if ((assignedCountByMember.get(memberId) || 0) !== 0) return 0;
        return locationId === dominantLoc ? 1.02 : 1;
      },
      () => stage1RandomFn(),
    );
    const chain = runChainDP(nodes);
    chain.forEach((node) => commit(day, node));
    dayChains.set(day, chain);
  });

  // 2단계: 요일별로, 1단계에서 확정된 자리는 압도적으로 큰 가중치로 고정해 절대 빠지지
  // 않게 한 채(그 회원의 다른 자리는 후보에서 제외), 그 주변을 포함해 하루 전체를 다시
  // DP로 짜서 남은 자리를 최대한 채운다 — 코어 시간대든 어디든 상관없이, 확정된 체인을
  // 깨지 않으면서 수업 수를 최대화하는 방향으로 자연스럽게 채워진다.
  const PIN_WEIGHT = 1e6;
  daysWithReqs.forEach((day) => {
    const existingChain = dayChains.get(day) || [];
    existingChain.forEach((node) => uncommit(day, node));
    const pinnedKeys = new Set(
      existingChain.map(
        (n) => n.memberId + "|" + n.startSlot + "|" + n.locationId,
      ),
    );
    const pinnedMemberIds = new Set(existingChain.map((n) => n.memberId));
    const nodes = buildDayNodes(
      reqsByDay.get(day),
      (memberId, startSlot, locationId) => {
        if (pinnedKeys.has(memberId + "|" + startSlot + "|" + locationId))
          return PIN_WEIGHT;
        if (pinnedMemberIds.has(memberId)) return 0; // 이미 확정된 회원은 그 자리 외에는 후보가 아니다
        return isEligibleForDay(memberId, day) ? 1 : 0;
      },
      () => stage1RandomFn(),
    );
    const chain = runChainDP(nodes);
    chain.forEach((node) => commit(day, node));
    dayChains.set(day, chain);
  });

  // 3단계: 그래도 미배정으로 남은 회원이 있으면, 이미 확정된 세션은 그대로 둔 채 그 회원
  // 한 명만이라도 넣을 수 있는 요일을 찾는다. 곧바로 빈 자리가 없으면, "정확히 한 명"과만
  // 시간이 겹치는 자리를 찾아 그 한 명을 내보내고(교환) 재귀적으로 그 사람이 갈 다른 자리를
  // 찾아준다(연쇄 교환/ejection chain) — 그 사람도 자리가 없으면 다시 "정확히 한 명"과
  // 겹치는 자리를 찾아 한 단계 더 내보내보는 식으로 최대 MAX_EJECTION_DEPTH단계까지
  // 시도한다. 하루 이동 최대 MAX_TRAVELS_PER_DAY회 제한은 "미배정 회원 없음"과 동등하게 반드시 지켜야 하는
  // 조건이므로, 모든 단계에서 항상 그대로 지킨다 — 그 제한 안에서 자리가 없으면(연쇄
  // 교환까지 다 시도해도) 최종 미배정으로 남는다.
  const MAX_EJECTION_DEPTH = 3;
  const submittedIds = new Set(state.requests.map((r) => r.memberId));
  // 요일 순서 후보를 여러 개 비교하는 탐색 단계 등에서 이 함수가 반복문 안에서 아주 여러
  // 번 불리므로, 매번 dayChains 전체를 훑어(O(전체 배정 세션 수)) Set을 새로 만들지 않고
  // commit/uncommit이 이미 정확히 유지하고 있는 assignedCountByMember를 그대로 O(1)로 조회한다.
  function isCurrentlyAssigned(memberId) {
    return (assignedCountByMember.get(memberId) || 0) > 0;
  }
  // currentExcludedIds2()도 매번 호출하면 배열 .includes()를 회원 수만큼 반복하므로, 파이프라인
  // 한 번 실행 동안 바뀌지 않는 값을 한 번만 Set으로 캐싱해둔다.
  const excludedIdSet2 = new Set(currentExcludedIds2());

  // 회원(memberId)을 excludeDays에 없는 요일 중에 배정한다. 성공하면 커밋까지 마치고
  // true를, 실패하면 아무것도 바꾸지 않고 false를 돌려준다.
  function tryPlaceMember(memberId, excludeDays, depth) {
    if (depth > MAX_EJECTION_DEPTH) return false;
    if (now() > REPAIR_DEADLINE) return false;
    // 이미 배정받은 다른 요일은 후보에서 뺀다 — 안 그러면 그 요일의 기존(자기 자신) 세션이
    // 그대로 남아있는 것을 "새로 옮겨 넣는 데 성공"한 것으로 잘못 판단하게 된다.
    const alreadyUsedDays = assignedDaysByMember.get(memberId) || new Set();
    const candidateDays = daysWithReqs.filter(
      (day) =>
        !excludeDays.has(day) &&
        !alreadyUsedDays.has(day) &&
        reqsByDay.get(day).some((r) => r.memberId === memberId),
    );
    for (const day of candidateDays) {
      const chain0 = dayChains.get(day) || [];
      const dayReqsForMember = reqsFor(memberId, day);
      const candNodes = buildDayNodes(dayReqsForMember, () => 1);

      // 1) 아무도 안 건드리고 바로 끼워넣을 수 있는 자리가 있는지 먼저 가볍게 훑는다
      //    (전체 DP를 다시 돌리지 않고, 그 요일 체인에 직접 삽입만 시도해본다 — 회원·
      //    신청이 많을 때 이 단계를 DP로 하면 너무 느려진다).
      for (const cand of candNodes) {
        let insertAt = 0;
        while (
          insertAt < chain0.length &&
          chain0[insertAt].startSlot < cand.startSlot
        )
          insertAt++;
        let feasible = true;
        if (insertAt > 0) {
          const prev = chain0[insertAt - 1];
          const prevEnd = prev.startSlot + durationToSlots(prev.duration);
          if (
            cand.startSlot < prevEnd ||
            (cand.startSlot - prevEnd) * SLOT_MIN <
              requiredGapMin2(prev.locationId, cand.locationId)
          )
            feasible = false;
        }
        if (feasible && insertAt < chain0.length) {
          const next = chain0[insertAt];
          if (
            next.startSlot < cand.end ||
            (next.startSlot - cand.end) * SLOT_MIN <
              requiredGapMin2(cand.locationId, next.locationId)
          )
            feasible = false;
        }
        if (!feasible) continue;
        const newNode = {
          id: cand.id,
          memberId,
          day,
          startSlot: cand.startSlot,
          duration: cand.duration,
          locationId: cand.locationId,
          end: cand.end,
        };
        const newChain = chain0.slice();
        newChain.splice(insertAt, 0, newNode);
        if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) continue; // 하루 이동 최대 MAX_TRAVELS_PER_DAY회 제한
        commit(day, newNode);
        dayChains.set(day, newChain);
        return true;
      }

      // 2) 안 되면, 이 회원의 후보 중 "치워야 할 사람이 정확히 한 명"뿐인 자리를 찾아 그
      //    한 명을 내보내고, 그 사람이 갈 다른 자리를 재귀적으로 찾아준다. "치워야 할 한
      //    명"은 시간이 직접 겹치는 회원뿐 아니라, 안 겹쳐도 앞뒤 이동 간격이 부족해 못
      //    들어가게 막는 이웃(신소영처럼 빈 시간은 있지만 그 앞뒤 이동 시간이 안 나오는
      //    경우)도 포함한다.
      for (const cand of candNodes) {
        const chain = dayChains.get(day) || [];
        const overlapping = new Set();
        chain.forEach((n) => {
          const nEnd = n.startSlot + durationToSlots(n.duration);
          if (cand.startSlot < nEnd && n.startSlot < cand.end)
            overlapping.add(n.memberId);
        });
        let otherMemberId = null;
        if (overlapping.size === 1) {
          otherMemberId = [...overlapping][0];
        } else if (overlapping.size === 0) {
          const sorted = chain
            .slice()
            .sort((a, b) => a.startSlot - b.startSlot);
          let idx = 0;
          while (idx < sorted.length && sorted[idx].startSlot < cand.startSlot)
            idx++;
          const prevN = idx > 0 ? sorted[idx - 1] : null;
          const nextN = idx < sorted.length ? sorted[idx] : null;
          const prevBad =
            prevN &&
            (cand.startSlot -
              (prevN.startSlot + durationToSlots(prevN.duration))) *
              SLOT_MIN <
              requiredGapMin2(prevN.locationId, cand.locationId);
          const nextBad =
            nextN &&
            (nextN.startSlot - cand.end) * SLOT_MIN <
              requiredGapMin2(cand.locationId, nextN.locationId);
          if (prevBad && nextBad && prevN.memberId !== nextN.memberId) continue; // 양쪽 다른 두 명이 동시에 막으면 손대지 않는다
          if (prevBad) otherMemberId = prevN.memberId;
          else if (nextBad) otherMemberId = nextN.memberId;
          else continue; // 겹치지도, 간격이 막히지도 않는데 못 들어간다면(주간 cap 등) 건드릴 대상이 없다
        } else {
          continue; // 2명 이상과 직접 겹치면 다루지 않는다
        }
        const otherNode = chain.find((n) => n.memberId === otherMemberId);

        const remainingChain = chain.filter(
          (n) => n.memberId !== otherMemberId,
        );
        let insertAt = 0;
        while (
          insertAt < remainingChain.length &&
          remainingChain[insertAt].startSlot < cand.startSlot
        )
          insertAt++;
        let feasible = true;
        if (insertAt > 0) {
          const prev = remainingChain[insertAt - 1];
          const prevEnd = prev.startSlot + durationToSlots(prev.duration);
          const gapMin = (cand.startSlot - prevEnd) * SLOT_MIN;
          if (gapMin < requiredGapMin2(prev.locationId, cand.locationId))
            feasible = false;
        }
        if (feasible && insertAt < remainingChain.length) {
          const next = remainingChain[insertAt];
          const gapMin = (next.startSlot - cand.end) * SLOT_MIN;
          if (gapMin < requiredGapMin2(cand.locationId, next.locationId))
            feasible = false;
        }
        if (!feasible) continue;

        const newNode = {
          id: cand.id,
          memberId,
          day,
          startSlot: cand.startSlot,
          duration: cand.duration,
          locationId: cand.locationId,
          end: cand.end,
        };
        const newChain = remainingChain.slice();
        newChain.splice(insertAt, 0, newNode);
        if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) continue; // 하루 이동 최대 MAX_TRAVELS_PER_DAY회 제한

        uncommit(day, otherNode);
        commit(day, newNode);
        dayChains.set(day, newChain);

        if (
          tryPlaceMember(
            otherMemberId,
            new Set([...excludeDays, day]),
            depth + 1,
          )
        ) {
          return true;
        }
        // otherMemberId를 옮길 데가 없으면(사슬이 여기서 끊기면) 원래대로 되돌린다.
        uncommit(day, newNode);
        commit(day, otherNode);
        dayChains.set(day, chain);
      }
    }
    return false;
  }

  function stillUnassignedIds() {
    return state.members
      .filter((m) => !excludedIdSet2.has(m.id) && submittedIds.has(m.id))
      .map((m) => m.id)
      .filter((id) => !isCurrentlyAssigned(id));
  }

  // 연쇄 교환(ejection chain)까지 포함한 복구는 계산량이 꽤 크므로, 여러 요일 순서를
  // 가볍게 비교해볼 때는(runRepair=false) 건너뛰고, 가장 좋아 보이는 순서 하나를 고른
  // 뒤에만(runRepair=true) 실제로 돌린다 — generateSchedule2Async 참고.
  if (runRepair) {
    for (const memberId of stillUnassignedIds()) {
      await maybeYield();
      if (isCurrentlyAssigned(memberId)) continue; // 앞선 시도로 이미 해결됐을 수 있음
      tryPlaceMember(memberId, new Set(), 0);
    }

    // 4단계: 연쇄 교환(자리를 하나씩 맞바꾸는 것)까지 시도해도 남는 회원이 있으면, 그
    // 회원이 가능한 요일 하나를 통째로 다시 짠다 — 그날 기존 배치를 그대로 지키지 않고,
    // 이 회원에게 압도적인 가중치를 주어 "이 회원을 포함해 그날 최대한 많은 인원이
    // 들어가도록" 처음부터 다시 최적화한다. 자리 하나만 바꿔서는 못 찾는, 여러 명을
    // 동시에 재배치해야 하는 경우(신소영 사례처럼 지점별로 다시 묶어야 자리가 나는 경우)를
    // 찾을 수 있다. 다시 짠 결과가 전체적으로 더 나빠지면(미배정이 늘거나, 미배정 수는
    // 같은데 수업 수가 줄면) 그대로 되돌린다.
    const REBUILD_TARGET_WEIGHT = 1e6;
    function tryRebuildDayFor(memberId, day) {
      const beforeUnassigned = stillUnassignedIds().length;
      const existingChain = dayChains.get(day) || [];
      existingChain.forEach((node) => uncommit(day, node));
      const nodes = buildDayNodes(
        reqsByDay.get(day),
        (mId, startSlot, locationId) => {
          if (mId === memberId) return REBUILD_TARGET_WEIGHT;
          return isEligibleForDay(mId, day) ? 1 : 0;
        },
      );
      const newChain = runChainDP(nodes); // 하루 이동 최대 MAX_TRAVELS_PER_DAY회 제한은 여기서도 그대로 지킨다
      if (!newChain.some((n) => n.memberId === memberId)) {
        existingChain.forEach((node) => commit(day, node)); // 이 회원을 못 넣으면 의미가 없으니 되돌린다
        dayChains.set(day, existingChain);
        return false;
      }
      newChain.forEach((node) => commit(day, node));
      dayChains.set(day, newChain);
      const afterUnassigned = stillUnassignedIds().length;
      if (
        afterUnassigned < beforeUnassigned ||
        (afterUnassigned === beforeUnassigned &&
          newChain.length >= existingChain.length)
      ) {
        return true; // 미배정이 줄었거나, 최소한 나빠지지 않았으면 채택
      }
      // 전체적으로 나빠졌으면 되돌린다.
      newChain.forEach((node) => uncommit(day, node));
      existingChain.forEach((node) => commit(day, node));
      dayChains.set(day, existingChain);
      return false;
    }

    for (const memberId of stillUnassignedIds()) {
      await maybeYield();
      if (now() > REPAIR_DEADLINE) break;
      if (isCurrentlyAssigned(memberId)) continue;
      const candidateDays = daysWithReqs.filter((day) =>
        reqsByDay.get(day).some((r) => r.memberId === memberId),
      );
      for (const day of candidateDays) {
        if (tryRebuildDayFor(memberId, day)) break;
      }
    }

    // 4.5단계: 여기까지는 "아직 한 번도 못 받은 회원"만 챙겼다 — 이미 1회를 받았지만 정원
    // (등록 회원 최대 2회)에는 못 미치는 회원에게 2번째 자리를 추가로 더 끼워넣을 수 있는지는
    // 아직 시도한 적이 없다. 이걸 건너뛰면 실제로는 더 넣을 수 있는데도 수업 총 건수가
    // 낮게 멈춰버린다. tryPlaceMember는 "이 회원이 아직 안 쓴 요일"에 넣어주는 함수라
    // 미배정 회원뿐 아니라 이런 회원에게도 그대로 쓸 수 있다. 한 명을 추가하면 그 여파로
    // 다른 회원에게도 새 틈이 생길 수 있으므로, 더 이상 아무도 늘지 않을 때까지 반복한다.
    let addedExtra = true;
    let extraPassCount = 0;
    while (addedExtra && extraPassCount < 5) {
      addedExtra = false;
      extraPassCount++;
      const extraCandidateIds = state.members
        .filter((m) => !excludedIdSet2.has(m.id))
        .map((m) => m.id)
        .filter((id) => {
          const count = assignedCountByMember.get(id) || 0;
          return count > 0 && count < maxSessionsFor2(memberById(id));
        });
      for (const memberId of extraCandidateIds) {
        await maybeYield();
        if (tryPlaceMember(memberId, new Set(), 0)) addedExtra = true;
      }
    }
  }

  // 5단계(runPolish): 미배정을 없앤 뒤에도, 요일별로 이동 횟수를 더 줄일 수 있는지 마지막
  // 으로 확인한다. 그 요일의 기존 배치는 고정하지 않고, 그 요일에 배정 가능한 모든 회원
  //으로 처음부터 다시 최적화해본다 — DP가 "인원 → 이동 횟수 → 이동 시간 → 빈 시간" 순으로
  // 항상 최선을 고르므로, 인원 수를 그대로 유지하면서 이동이 더 적은 배치를 찾으면 그걸로
  // 바꾼다. 요일 순서 후보를 비교하는 탐색 중에는 끄고(runPolish=false), 이미 선택된 후보
  // 하나에만 마지막으로 적용한다 — 매 후보마다 적용하면 이 단계가 후보 간 순위 자체를
  // 흔들어(어떤 후보는 이 단계로 인원이 줄고 다른 후보는 안 줄고) 오히려 더 나은 후보를
  // 놓칠 수 있기 때문이다. 미배정 회원 수뿐 아니라 전체 수업 수(모든 요일 합)가 줄어도
  // 되돌린다 — 이 요일만 보면 안 줄었어도 전체적으로는 손해일 수 있어서다.
  if (runPolish) {
    // 요일·회원·신청이 아주 많으면 아래 다듬기 단계들(특히 요일 전체 재섞기, 언덕 오르기)이
    // O(신청 수^2) 규모라 시간이 크게 늘어날 수 있다. 그래서 전체에 시간 예산을 두고,
    // 예산을 넘기면 그 시점까지 찾은 가장 좋은 결과로 바로 마무리한다 — 데이터가 아무리
    // 많아져도 생성 버튼이 무한정 느려지지 않게 하기 위함이다.
    const polishStart = now();
    const polishBudget = polishBudgetMs || 8000;
    const POLISH_DEADLINE = polishStart + polishBudget;
    // 다듬기 예산을 단계별로 미리 나눠둔다 — 그러지 않으면 뒤 단계(요일 전체 재섞기)가
    // 시도 횟수 상한(200번)에 못 미쳐도 남은 시간을 전부 써버려서, 그 뒤에 오는 담금질
    // 기법·언덕 오르기 단계에 시간이 하나도 안 남을 수 있다.
    const STAGE6_DEADLINE = polishStart + polishBudget * 0.25;
    const STAGE65_DEADLINE = polishStart + polishBudget * 0.55;
    const SA_DEADLINE = polishStart + polishBudget * 0.8;
    daysWithReqs.forEach((day) => {
      const beforeUnassignedCount = stillUnassignedIds().length;
      const beforeTotalSessions = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + c.length,
        0,
      );
      const existingChain = dayChains.get(day) || [];
      existingChain.forEach((node) => uncommit(day, node));
      const nodes = buildDayNodes(
        reqsByDay.get(day),
        (mId, startSlot, locationId) => (isEligibleForDay(mId, day) ? 1 : 0),
      );
      const newChain = runChainDP(nodes);
      newChain.forEach((node) => commit(day, node));
      dayChains.set(day, newChain);
      const afterTotalSessions = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + c.length,
        0,
      );
      const worse =
        stillUnassignedIds().length > beforeUnassignedCount ||
        afterTotalSessions < beforeTotalSessions;
      if (worse) {
        newChain.forEach((node) => uncommit(day, node));
        existingChain.forEach((node) => commit(day, node));
        dayChains.set(day, existingChain);
      }
    });
    // 요일 하나만 다시 짜서는 "다른 요일로 회원을 옮기는" 재배치를 찾을 수 없다(그 요일에
    // 없던 회원은애초에 후보에 안 잡히므로). 그래서 요일을 두 개씩 짝지어(전부 몇 안 되므로
    // 모든 조합을 다 본다) 두 요일을 동시에 비운 뒤 순서를 양쪽 다(A먼저·B먼저) 시도해
    // 다시 짜본다 — 이러면 한쪽 요일의 회원이 다른 쪽 요일로 넘어가는 재배치도 찾을 수
    // 있다. 두 요일 이동 횟수 합이 실제로 줄어들 때만 채택하고, 미배정이 늘거나 두 요일의
    // 수업 수 합이 줄면 항상 되돌린다.
    // 지터 없이 두 순서(A먼저·B먼저)만 시도하면, 가중치가 완전히 동점인 두 후보(예: 두
    // 회원 다 그 자리를 채울 수 있고 인원 수·거리도 그 요일만 보면 차이가 없는 경우) 중
    // 어느 쪽을 넣을지는 항상 신청 배열 순서로만 결정론적으로 정해진다 — "이 요일엔 회원1,
    // 저 요일엔 회원2"가 서로 바뀌어야 두 요일 합산 이동이 주는 경우(신혜진·김가현처럼
    // 둘 다 월·금 모두 가능한데 어느 요일에 누가 들어가느냐로 이동 횟수가 갈리는 경우)를
    // 이 결정론적 동점 처리로는 절대 못 찾는다. 그래서 순서 2가지 외에도 지터를 준 여러
    // 조합을 추가로 시도해 동점을 다르게 풀어본다.
    const stage6RandomFn = mulberry32(445566 + seedOffset);
    stage6: for (
      let i = 0;
      i < daysWithReqs.length && now() < STAGE6_DEADLINE;
      i++
    ) {
      for (let j = i + 1; j < daysWithReqs.length; j++) {
        await maybeYield();
        if (now() >= STAGE6_DEADLINE) break stage6;
        const dayA = daysWithReqs[i],
          dayB = daysWithReqs[j];
        const existingA = dayChains.get(dayA) || [];
        const existingB = dayChains.get(dayB) || [];
        const beforeUnassignedCount = stillUnassignedIds().length;
        const beforeTotalSessions = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + c.length,
          0,
        );
        const beforePairTravel =
          totalTravelCount(existingA) + totalTravelCount(existingB);

        // 기존 배치는 여기서 딱 한 번만 커밋 해제한다 — attemptOrder를 여러 번 호출하면서
        // 매번 이걸 다시 해제하면, 이미 해제된 회원을 또 해제하게 되어 배정 카운트가
        // 음수로 내려간다("이미 그 요일에 배정됨" 기록이 사라져 같은 요일에 또 배정
        // 가능하다고 잘못 판단하게 되는 심각한 버그였다 — 화/수요일에 같은 회원이 두 번
        // 배정되던 문제의 원인).
        existingA.forEach((node) => uncommit(dayA, node));
        existingB.forEach((node) => uncommit(dayB, node));
        dayChains.set(dayA, []);
        dayChains.set(dayB, []);

        // unassigned/totalSessions 계산은 dayChains를 직접 읽으므로(currentlyAssignedMemberIds
        // 참고), 시도 중에는 dayChains도 후보 체인으로 잠깐 채워둬야 정확히 계산되고, 시도가
        // 끝나면 커밋 해제와 함께 dayChains도 다시 비워 다음 시도가 항상 같은 빈 상태에서
        // 시작하도록 한다.
        function attemptOrder(firstDay, secondDay, jitterFn) {
          const firstNodes = buildDayNodes(
            reqsByDay.get(firstDay),
            (mId) => (isEligibleForDay(mId, firstDay) ? 1 : 0),
            jitterFn,
          );
          const firstChain = runChainDP(firstNodes);
          firstChain.forEach((node) => commit(firstDay, node));
          dayChains.set(firstDay, firstChain);
          const secondNodes = buildDayNodes(
            reqsByDay.get(secondDay),
            (mId) => (isEligibleForDay(mId, secondDay) ? 1 : 0),
            jitterFn,
          );
          const secondChain = runChainDP(secondNodes);
          secondChain.forEach((node) => commit(secondDay, node));
          dayChains.set(secondDay, secondChain);
          const outcome = {
            unassigned: stillUnassignedIds().length,
            totalSessions: Array.from(dayChains.values()).reduce(
              (sum, c) => sum + c.length,
              0,
            ),
            pairTravel:
              totalTravelCount(firstChain) + totalTravelCount(secondChain),
            chainA: firstDay === dayA ? firstChain : secondChain,
            chainB: firstDay === dayA ? secondChain : firstChain,
          };
          firstChain.forEach((node) => uncommit(firstDay, node));
          secondChain.forEach((node) => uncommit(secondDay, node));
          dayChains.set(firstDay, []);
          dayChains.set(secondDay, []);
          return outcome;
        }

        const attempts = [
          attemptOrder(dayA, dayB, null),
          attemptOrder(dayB, dayA, null),
        ];
        for (let k = 0; k < 8 && now() < STAGE6_DEADLINE; k++) {
          await maybeYield();
          attempts.push(attemptOrder(dayA, dayB, stage6RandomFn));
          attempts.push(attemptOrder(dayB, dayA, stage6RandomFn));
        }

        let bestOption = null;
        attempts.forEach((opt) => {
          if (opt.unassigned > beforeUnassignedCount) return;
          if (opt.totalSessions < beforeTotalSessions) return;
          if (opt.pairTravel >= beforePairTravel) return; // 개선되지 않으면 굳이 바꾸지 않는다
          if (!bestOption || opt.pairTravel < bestOption.pairTravel)
            bestOption = opt;
        });

        if (bestOption) {
          bestOption.chainA.forEach((node) => commit(dayA, node));
          bestOption.chainB.forEach((node) => commit(dayB, node));
          dayChains.set(dayA, bestOption.chainA);
          dayChains.set(dayB, bestOption.chainB);
        } else {
          existingA.forEach((node) => commit(dayA, node));
          existingB.forEach((node) => commit(dayB, node));
          dayChains.set(dayA, existingA);
          dayChains.set(dayB, existingB);
        }
      }
    }

    // 요일 하나·요일 둘을 다시 짜는 것만으로는 3개 이상의 요일이 얽힌 재배치(예: A의
    // 회원이 B로, B의 회원이 C로 옮겨가야 전체가 좋아지는 경우)를 못 찾을 수 있다. 그래서
    // 마지막으로, 이미 "미배정 없음·이 수업 수"가 가능하다는 걸 알고 있는 상태에서, 요일
    // 전체를 통째로 여러 다른 순서로 다시 짜보며(무작위 셔플을 여러 번) 그 조건(미배정 수
    // 이하·수업 수 이상)을 만족하면서 총 이동 횟수가 더 적은 배치를 찾으면 그걸로 바꾼다.
    // (신청이 아주 많으면 한 번 다시 짜는 데도 시간이 걸리므로, 시도 횟수를 최대 80번으로
    // 두되 시간 예산을 넘기면 그 전에 멈춘다.)
    const baselineUnassigned = stillUnassignedIds().length;
    const baselineSessions = Array.from(dayChains.values()).reduce(
      (sum, c) => sum + c.length,
      0,
    );
    const baselineTravel = Array.from(dayChains.values()).reduce(
      (sum, c) => sum + totalTravelCount(c),
      0,
    );
    let bestSnapshot = {
      unassigned: baselineUnassigned,
      sessions: baselineSessions,
      travel: baselineTravel,
      chains: new Map(dayChains),
    };

    const polishRandomFn = mulberry32(778899 + seedOffset);
    for (
      let attempt = 0;
      attempt < 200 && now() < STAGE65_DEADLINE;
      attempt++
    ) {
      await maybeYield();
      dayChains.forEach((chain, day) =>
        chain.forEach((node) => uncommit(day, node)),
      );
      shuffled(daysWithReqs, polishRandomFn).forEach((day) => {
        // 지터를 줘서, 매 시도마다 동점 처리가 달라지게 한다 — 요일 순서만 바꿔서는 항상
        // 시간순으로만 동점이 풀려 "누가 2회를 받는지" 조합이 거의 안 바뀌는 문제가 있었다.
        // 여기서도 지점 뭉치기 보너스를 함께 준다.
        const dominantLoc = dominantLocationFor(day);
        const nodes = buildDayNodes(
          reqsByDay.get(day),
          (mId, startSlot, locationId) => {
            if (!isEligibleForDay(mId, day)) return 0;
            return locationId === dominantLoc ? 1.02 : 1;
          },
          () => polishRandomFn(),
        );
        const chain = runChainDP(nodes);
        chain.forEach((node) => commit(day, node));
        dayChains.set(day, chain);
      });
      const attemptUnassigned = stillUnassignedIds().length;
      const attemptSessions = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + c.length,
        0,
      );
      const attemptTravel = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + totalTravelCount(c),
        0,
      );
      if (
        attemptUnassigned <= bestSnapshot.unassigned &&
        attemptSessions >= bestSnapshot.sessions &&
        attemptTravel < bestSnapshot.travel
      ) {
        bestSnapshot = {
          unassigned: attemptUnassigned,
          sessions: attemptSessions,
          travel: attemptTravel,
          chains: new Map(dayChains),
        };
      }
    }

    dayChains.forEach((chain, day) =>
      chain.forEach((node) => uncommit(day, node)),
    );
    bestSnapshot.chains.forEach((chain, day) => {
      chain.forEach((node) => commit(day, node));
      dayChains.set(day, chain);
    });

    // 요일 단위로 다시 짜는 방식(1~6단계)은 결국 "그 요일에 이미 후보로 잡힌 사람들
    // 중에서" 최선을 고르는 것이라, "이 회원의 세션을 아예 다른 요일로 옮기면 두 요일
    // 모두 이동이 줄어드는" 재배치는 찾지 못할 수 있다. 그래서 이미 배정된 세션 하나하나를
    // 골라 그 회원의 다른 가능한 (요일·시각·지점)으로 옮기거나 서로 다른 요일의 두 회원
    // 자리를 맞바꾸는 헬퍼들을 아래에 정의해둔다 — 담금질 기법(7단계)과 마지막 순수
    // 언덕 오르기(8단계)가 이 헬퍼들을 공유해서 쓴다.
    // 한 요일 체인의 "진짜 빈 시간"(이동에 필요한 시간을 넘어서는 여분의 간격) 합. 이동
    // 횟수가 같다면 이 값이 더 적은 쪽을 우선한다 — schedule2TotalIdleMinutes와 같은
    // 계산이지만 하루치 체인 하나만 받는다(재배치·맞바꾸기가 매번 요일 하나·둘만 건드리므로).
    function dayIdleMinutes(chain) {
      const sorted = [...chain].sort((a, b) => a.startSlot - b.startSlot);
      let idle = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1],
          cur = sorted[i];
        const gapMin =
          (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) *
          SLOT_MIN;
        idle += Math.max(
          0,
          gapMin - requiredGapMin2(prev.locationId, cur.locationId),
        );
      }
      return idle;
    }
    // (travelA, idleA)가 (travelB, idleB)보다 나은지 — 이동 1번의 가치를 빈 시간
    // TRAVEL_VALUE_MINUTES분으로 쳐서 하나의 점수로 합쳐 비교한다(이동이 줄어도 그 대가로
    // 늘어난 빈 시간이 너무 크면 더 나은 것으로 치지 않는다).
    function isTravelIdleBetter(travelA, idleA, travelB, idleB) {
      const scoreA = travelA * TRAVEL_VALUE_MINUTES + idleA;
      const scoreB = travelB * TRAVEL_VALUE_MINUTES + idleB;
      if (scoreA !== scoreB) return scoreA < scoreB;
      if (travelA !== travelB) return travelA < travelB;
      return idleA < idleB;
    }
    // (deltaTravel, deltaIdle) 변화가 실제로 개선인지: 이동이 늘면 무조건 거부, 이동이
    // 그대로면 빈 시간이 줄 때만, 이동이 줄면 그 대가로 늘어난 빈 시간이 이동 1번당
    // TRAVEL_VALUE_MINUTES분을 넘지 않을 때만 개선으로 친다.
    function travelIdleImproves(deltaTravel, deltaIdle) {
      if (deltaTravel > 0) return false;
      if (deltaTravel === 0) return deltaIdle < 0;
      return deltaIdle <= -deltaTravel * TRAVEL_VALUE_MINUTES;
    }

    function tryRelocateSession(node) {
      const memberId = node.memberId;
      const currentDay = node.day;
      const currentChainWithout = (dayChains.get(currentDay) || []).filter(
        (n) => n !== node,
      );
      const beforeCurrentDayTravel = totalTravelCount(
        dayChains.get(currentDay) || [],
      );
      const beforeCurrentDayIdle = dayIdleMinutes(
        dayChains.get(currentDay) || [],
      );
      const currentDayWithoutTravel = totalTravelCount(currentChainWithout); // 후보마다 매번 다시 구하지 않도록 한 번만 계산
      const currentDayWithoutIdle = dayIdleMinutes(currentChainWithout);
      let bestMove = null; // { sameDay, targetDay, newTargetChain, deltaTravel, deltaIdle }

      daysWithReqs.forEach((day) => {
        if (day !== currentDay) {
          // 이 회원이 그 요일에 이미 다른 세션을 갖고 있으면(있을 리 없지만 안전하게) 건너뛴다.
          if ((dayChains.get(day) || []).some((n) => n.memberId === memberId))
            return;
        }
        const dayReqsForMember = reqsFor(memberId, day);
        if (dayReqsForMember.length === 0) return;
        const candNodes = buildDayNodes(dayReqsForMember, () => 1);
        const baseChain =
          day === currentDay ? currentChainWithout : dayChains.get(day) || [];
        const beforeTargetDayTravel =
          day === currentDay ? 0 : totalTravelCount(baseChain); // 후보 훑기 전 한 번만
        const beforeTargetDayIdle =
          day === currentDay ? 0 : dayIdleMinutes(baseChain);
        candNodes.forEach((cand) => {
          if (
            day === currentDay &&
            cand.startSlot === node.startSlot &&
            cand.locationId === node.locationId
          )
            return; // 원래 자리
          let insertAt = 0;
          while (
            insertAt < baseChain.length &&
            baseChain[insertAt].startSlot < cand.startSlot
          )
            insertAt++;
          let feasible = true;
          if (insertAt > 0) {
            const prev = baseChain[insertAt - 1];
            const prevEnd = prev.startSlot + durationToSlots(prev.duration);
            if (
              cand.startSlot < prevEnd ||
              (cand.startSlot - prevEnd) * SLOT_MIN <
                requiredGapMin2(prev.locationId, cand.locationId)
            )
              feasible = false;
          }
          if (feasible && insertAt < baseChain.length) {
            const next = baseChain[insertAt];
            if (
              next.startSlot < cand.end ||
              (next.startSlot - cand.end) * SLOT_MIN <
                requiredGapMin2(cand.locationId, next.locationId)
            )
              feasible = false;
          }
          if (!feasible) return;
          const newNode = {
            id: cand.id,
            memberId,
            day,
            startSlot: cand.startSlot,
            duration: cand.duration,
            locationId: cand.locationId,
            end: cand.end,
          };
          const newChain = baseChain.slice();
          newChain.splice(insertAt, 0, newNode);
          if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) return;

          let deltaTravel, deltaIdle;
          if (day === currentDay) {
            deltaTravel = totalTravelCount(newChain) - beforeCurrentDayTravel;
            deltaIdle = dayIdleMinutes(newChain) - beforeCurrentDayIdle;
          } else {
            deltaTravel =
              currentDayWithoutTravel +
              totalTravelCount(newChain) -
              (beforeCurrentDayTravel + beforeTargetDayTravel);
            deltaIdle =
              currentDayWithoutIdle +
              dayIdleMinutes(newChain) -
              (beforeCurrentDayIdle + beforeTargetDayIdle);
          }
          const improves = travelIdleImproves(deltaTravel, deltaIdle);
          if (
            improves &&
            (!bestMove ||
              isTravelIdleBetter(
                deltaTravel,
                deltaIdle,
                bestMove.deltaTravel,
                bestMove.deltaIdle,
              ))
          ) {
            bestMove = {
              sameDay: day === currentDay,
              targetDay: day,
              newTargetChain: newChain,
              deltaTravel,
              deltaIdle,
            };
          }
        });
      });

      if (!bestMove) return false;
      uncommit(currentDay, node);
      if (bestMove.sameDay) {
        dayChains.set(currentDay, bestMove.newTargetChain);
      } else {
        dayChains.set(currentDay, currentChainWithout);
        dayChains.set(bestMove.targetDay, bestMove.newTargetChain);
      }
      const addedNode = bestMove.newTargetChain.find(
        (n) => n.memberId === memberId,
      );
      commit(bestMove.targetDay, addedNode);
      return true;
    }

    // 자리 하나를 옮기는 것만으로는 못 푸는 경우(두 회원이 서로 상대방의 자리를 원하는
    // 경우)를 위해, 서로 다른 요일에 배정된 두 회원의 자리를 통째로 맞바꾸는 것도 시도한다
    // — 각자 상대방의 (요일·시각)에 실제로 신청이 있고 그 지점도 다닐 수 있어야 하며,
    // 맞바꾼 뒤 두 요일 각각의 간격·이동 제한을 모두 만족해야 한다.
    function insertFeasible(chainWithout, cand) {
      let insertAt = 0;
      while (
        insertAt < chainWithout.length &&
        chainWithout[insertAt].startSlot < cand.startSlot
      )
        insertAt++;
      if (insertAt > 0) {
        const prev = chainWithout[insertAt - 1];
        const prevEnd = prev.startSlot + durationToSlots(prev.duration);
        if (
          cand.startSlot < prevEnd ||
          (cand.startSlot - prevEnd) * SLOT_MIN <
            requiredGapMin2(prev.locationId, cand.locationId)
        )
          return null;
      }
      if (insertAt < chainWithout.length) {
        const next = chainWithout[insertAt];
        if (
          next.startSlot < cand.end ||
          (next.startSlot - cand.end) * SLOT_MIN <
            requiredGapMin2(cand.locationId, next.locationId)
        )
          return null;
      }
      const newChain = chainWithout.slice();
      newChain.splice(insertAt, 0, cand);
      if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) return null;
      return newChain;
    }

    // "회원|요일|시작슬롯"가 실제 신청 목록에 있는지 매번 배열을 훑지 않고 바로 확인하기
    // 위한 조회용 집합 — 맞바꾸기는 모든 세션 쌍을 다 검사하므로(O(세션 수^2)) 이 조회가
    // 느리면 회원·신청이 많을 때 전체가 크게 느려진다.
    const reqKeySet = new Set(
      eligibleReqs.map((r) => r.memberId + "|" + r.day + "|" + r.startSlot),
    );

    function tryCrossDaySwap(node1, node2) {
      if (node1.day === node2.day || node1.memberId === node2.memberId)
        return false;
      const day1 = node1.day,
        day2 = node2.day,
        member1 = node1.memberId,
        member2 = node2.memberId;
      if (!reqKeySet.has(member1 + "|" + day2 + "|" + node2.startSlot))
        return false;
      if (!reqKeySet.has(member2 + "|" + day1 + "|" + node1.startSlot))
        return false;
      const req1InDay2 = reqAt(member1, day2, node2.startSlot);
      const req2InDay1 = reqAt(member2, day1, node1.startSlot);
      if (!candidateLocationsForRequest(req1InDay2).includes(node2.locationId))
        return false;
      if (!candidateLocationsForRequest(req2InDay1).includes(node1.locationId))
        return false;
      // 회원당 1일 최대 1회 — 등록 회원은 원래 2회를 배정받으므로, member1이 day2에(그
      // 자리를 넘겨줄 node2 말고) 이미 별도로 다른 세션을 갖고 있을 수 있다(반대도 마찬가지).
      // 이 경우 자리를 바꾸면 그 요일에 같은 회원이 두 번 배정되므로 반드시 막아야 한다.
      if ((dayChains.get(day2) || []).some((n) => n.memberId === member1))
        return false;
      if ((dayChains.get(day1) || []).some((n) => n.memberId === member2))
        return false;

      const dur1 = sessionDurationFor2(memberById(member1));
      const dur2 = sessionDurationFor2(memberById(member2));
      const newInDay2 = {
        id: req1InDay2.id,
        memberId: member1,
        day: day2,
        startSlot: node2.startSlot,
        duration: dur1,
        locationId: node2.locationId,
        end: node2.startSlot + durationToSlots(dur1),
      };
      const newInDay1 = {
        id: req2InDay1.id,
        memberId: member2,
        day: day1,
        startSlot: node1.startSlot,
        duration: dur2,
        locationId: node1.locationId,
        end: node1.startSlot + durationToSlots(dur2),
      };

      const chain1 = insertFeasible(
        (dayChains.get(day1) || []).filter((n) => n !== node1),
        newInDay1,
      );
      if (!chain1) return false;
      const chain2 = insertFeasible(
        (dayChains.get(day2) || []).filter((n) => n !== node2),
        newInDay2,
      );
      if (!chain2) return false;

      const beforeTravel =
        totalTravelCount(dayChains.get(day1) || []) +
        totalTravelCount(dayChains.get(day2) || []);
      const afterTravel = totalTravelCount(chain1) + totalTravelCount(chain2);
      const beforeIdle =
        dayIdleMinutes(dayChains.get(day1) || []) +
        dayIdleMinutes(dayChains.get(day2) || []);
      const afterIdle = dayIdleMinutes(chain1) + dayIdleMinutes(chain2);
      if (
        !travelIdleImproves(afterTravel - beforeTravel, afterIdle - beforeIdle)
      )
        return false;

      uncommit(day1, node1);
      uncommit(day2, node2);
      commit(day1, newInDay1);
      commit(day2, newInDay2);
      dayChains.set(day1, chain1);
      dayChains.set(day2, chain2);
      return true;
    }

    // tryRelocateSession(빈 자리로만 옮김)·tryCrossDaySwap(정확히 두 회원이 자리를 맞바꿈)
    // 둘 다로도 못 찾는 조합이 있다 — "이 자리로 옮기고 싶은데 거기 있는 사람을 내보내야
    // 하고, 그 사람은 또 다른 자리의 사람을 내보내야 하는" 식으로 3명 이상이 사슬처럼
    // 얽혀야 풀리는 경우다(수동으로 짠 스케줄이 실제로 이런 3자 연쇄로 이동을 1번 더 줄인
    // 사례로 확인됨). 3단계 미배정 복구의 연쇄 교환(tryPlaceMember)과 같은 방식으로 "정확히
    // 한 명과만 겹치는 자리를 찾아 내보내고, 그 사람이 갈 다른 자리를 재귀적으로 찾아준다"를
    // 쓰되, 여기서는 "배정에 성공했는가"가 아니라 "사슬 전체를 적용한 뒤 전체 이동·빈
    // 시간이 실제로 나아졌는가"로 채택 여부를 정한다(acceptFn) — 그래야 언덕 오르기(8단계,
    // 개선만 허용)와 담금질 기법(7단계, 온도에 따라 가끔 나빠지는 것도 허용) 양쪽에서 같은
    // 탐색을 재사용할 수 있다. 상태는 일단 실제로 바꿔보고(그래야 사슬 다음 단계의 빈
    // 자리·충돌 여부를 정확히 알 수 있다), acceptFn이 거부하면 스냅샷으로 통째로 되돌린다.
    const MAX_RELOCATE_EJECT_DEPTH = 3;
    function snapshotChainState() {
      return {
        dayChains: new Map(dayChains),
        counts: new Map(assignedCountByMember),
        days: new Map(
          Array.from(assignedDaysByMember, ([k, v]) => [k, new Set(v)]),
        ),
      };
    }
    function restoreChainState(snap) {
      dayChains.clear();
      snap.dayChains.forEach((v, k) => dayChains.set(k, v));
      assignedCountByMember.clear();
      snap.counts.forEach((v, k) => assignedCountByMember.set(k, v));
      assignedDaysByMember.clear();
      snap.days.forEach((v, k) => assignedDaysByMember.set(k, v));
    }
    // placeMemberId를 (excludeDays에 없는) 어느 요일이든 하나 끼워넣어본다 — 빈 자리가
    // 있으면 그대로, 없으면 "정확히 한 명"을 내보내고 그 사람을 재귀적으로 다시 배치해준다
    // (사슬 깊이는 MAX_RELOCATE_EJECT_DEPTH까지). protectedMemberId는 내보내면 안 되는
    // 회원(보통 이 사슬을 시작한 원래 회원 — 안 그러면 그 사람을 다시 내보내 제자리로
    // 돌아가는 식으로 무한히 맴돌 수 있다)이다. touchedDays에 이 과정에서 실제로 배치가
    // 바뀐 요일을 계속 추가해준다(호출한 쪽이 이동·빈 시간 변화를 계산할 때 씀).
    // tryEjectChainMove(자리 재배치)와 trySessionCountSwap(2회 배정 회원 교체) 둘 다 이
    // 헬퍼를 공유한다.
    function tryPlaceMemberChain(
      placeMemberId,
      excludeDays,
      depth,
      touchedDays,
      protectedMemberId,
    ) {
      if (depth > MAX_RELOCATE_EJECT_DEPTH) return false;
      for (const day of daysWithReqs) {
        if (excludeDays.has(day)) continue;
        if (
          (dayChains.get(day) || []).some((n) => n.memberId === placeMemberId)
        )
          continue;
        const reqs = reqsFor(placeMemberId, day);
        if (reqs.length === 0) continue;
        const candNodes = buildDayNodes(reqs, () => 1);
        const chain = dayChains.get(day) || [];

        // 1) 아무도 안 건드리고 바로 끼워넣을 수 있는 자리가 있는지 먼저 본다.
        for (const cand of candNodes) {
          const newNode = {
            id: cand.id,
            memberId: placeMemberId,
            day,
            startSlot: cand.startSlot,
            duration: cand.duration,
            locationId: cand.locationId,
            end: cand.end,
          };
          const newChain = insertFeasible(chain, newNode);
          if (newChain) {
            dayChains.set(day, newChain);
            commit(day, newNode);
            touchedDays.add(day);
            return true;
          }
        }

        // 2) 안 되면 "정확히 한 명"과만 겹치거나 앞뒤 간격을 막는 자리를 찾아 그 한 명을
        //    내보내고, 그 사람이 갈 다른 자리를 재귀적으로 찾아준다.
        for (const cand of candNodes) {
          const overlapping = new Set();
          chain.forEach((n) => {
            const nEnd = n.startSlot + durationToSlots(n.duration);
            if (cand.startSlot < nEnd && n.startSlot < cand.end)
              overlapping.add(n.memberId);
          });
          let otherMemberId = null;
          if (overlapping.size === 1) {
            otherMemberId = [...overlapping][0];
          } else if (overlapping.size === 0) {
            const sorted = chain
              .slice()
              .sort((a, b) => a.startSlot - b.startSlot);
            let idx = 0;
            while (
              idx < sorted.length &&
              sorted[idx].startSlot < cand.startSlot
            )
              idx++;
            const prevN = idx > 0 ? sorted[idx - 1] : null;
            const nextN = idx < sorted.length ? sorted[idx] : null;
            const prevBad =
              prevN &&
              (cand.startSlot -
                (prevN.startSlot + durationToSlots(prevN.duration))) *
                SLOT_MIN <
                requiredGapMin2(prevN.locationId, cand.locationId);
            const nextBad =
              nextN &&
              (nextN.startSlot - cand.end) * SLOT_MIN <
                requiredGapMin2(cand.locationId, nextN.locationId);
            if (prevBad && nextBad && prevN.memberId !== nextN.memberId)
              continue;
            if (prevBad) otherMemberId = prevN.memberId;
            else if (nextBad) otherMemberId = nextN.memberId;
            else continue;
          } else continue;
          if (otherMemberId === protectedMemberId) continue; // 사슬을 시작한 회원을 다시 내보내면 제자리로 돌아갈 뿐이다
          const otherNode = chain.find((n) => n.memberId === otherMemberId);
          const remaining = chain.filter((n) => n.memberId !== otherMemberId);
          const newNode = {
            id: cand.id,
            memberId: placeMemberId,
            day,
            startSlot: cand.startSlot,
            duration: cand.duration,
            locationId: cand.locationId,
            end: cand.end,
          };
          const newChain = insertFeasible(remaining, newNode);
          if (!newChain) continue;

          uncommit(day, otherNode);
          commit(day, newNode);
          dayChains.set(day, newChain);
          touchedDays.add(day);

          if (
            tryPlaceMemberChain(
              otherMemberId,
              new Set([...excludeDays, day]),
              depth + 1,
              touchedDays,
              protectedMemberId,
            )
          )
            return true;

          // 이 시도가 사슬 끝까지 이어지지 못했으면(더 내보낼 사람을 못 찾았으면) 되돌리고
          // 다음 후보를 계속 시도한다.
          uncommit(day, newNode);
          commit(day, otherNode);
          dayChains.set(day, chain);
        }
      }
      return false;
    }

    function tryEjectChainMove(node, acceptFn) {
      const snap = snapshotChainState();
      const memberId = node.memberId;
      const currentDay = node.day;
      const touchedDays = new Set([currentDay]);

      const chain0 = dayChains.get(currentDay) || [];
      uncommit(currentDay, node);
      dayChains.set(
        currentDay,
        chain0.filter((n) => n !== node),
      );

      const placed = tryPlaceMemberChain(
        memberId,
        new Set(),
        0,
        touchedDays,
        memberId,
      );
      if (!placed) {
        restoreChainState(snap);
        return false;
      }

      let beforeTravel = 0,
        beforeIdle = 0,
        afterTravel = 0,
        afterIdle = 0;
      touchedDays.forEach((day) => {
        beforeTravel += totalTravelCount(snap.dayChains.get(day) || []);
        beforeIdle += dayIdleMinutes(snap.dayChains.get(day) || []);
        afterTravel += totalTravelCount(dayChains.get(day) || []);
        afterIdle += dayIdleMinutes(dayChains.get(day) || []);
      });
      const deltaTravel = afterTravel - beforeTravel;
      const deltaIdle = afterIdle - beforeIdle;

      if (acceptFn(deltaTravel, deltaIdle)) return true;
      restoreChainState(snap);
      return false;
    }

    // "누가 2번째 수업을 받는지" 자체를 바꿔보는 이동. tryRelocateSession·tryCrossDaySwap·
    // tryEjectChainMove는 전부 "이미 배정된 세션을 다른 (요일·시각·지점)으로 옮기는" 것만
    // 다루므로, 각 회원의 배정 횟수(1회 vs 2회)는 항상 그대로 유지된다 — 그런데 수동으로
    // 짠 스케줄과 비교해보니, 이동을 더 줄이려면 지금 2회 배정된 회원 한 명의 2번째 수업을
    // 아예 포기하고 그 대신 지금 1회만 배정된 다른 회원에게 2번째 수업을 태워야 하는
    // 경우가 있었다(예: 김수연·최문열의 2회 배정을 이혜지·박진선에게 넘겨야 이동이 1번
    // 더 줄어드는 사례로 확인됨). 이 이동은 그 교체를 무작위로 시도해본다: 2회 배정 회원
    // 중 한 명의 세션 하나를 내려놓고, 1회 배정 회원(정원 2명인 회원 한정) 중 한 명을
    // tryPlaceMemberChain으로 대신 태워보고, 결과가 나아졌을 때만(acceptFn) 받아들인다.
    function trySessionCountSwap(randomFn, acceptFn) {
      const doubles = [],
        singles = [];
      assignedCountByMember.forEach((count, id) => {
        if (count === 0) return;
        if (maxSessionsFor2(memberById(id)) < 2) return; // 1회 제한·상담 회원은 대상이 아니다
        if (count === 2) doubles.push(id);
        else if (count === 1) singles.push(id);
      });
      if (doubles.length === 0 || singles.length === 0) return false;
      const memberA = doubles[Math.floor(randomFn() * doubles.length)];
      const memberB = singles[Math.floor(randomFn() * singles.length)];
      if (memberA === memberB) return false;

      const snap = snapshotChainState();
      const touchedDays = new Set();

      const aNodes = [];
      dayChains.forEach((chain, day) =>
        chain.forEach((n) => {
          if (n.memberId === memberA) aNodes.push({ day, node: n });
        }),
      );
      if (aNodes.length !== 2) {
        restoreChainState(snap);
        return false;
      } // 안전망(정상적으로는 항상 2개)
      const removed = aNodes[Math.floor(randomFn() * aNodes.length)];
      uncommit(removed.day, removed.node);
      dayChains.set(
        removed.day,
        (dayChains.get(removed.day) || []).filter((n) => n !== removed.node),
      );
      touchedDays.add(removed.day);

      const placed = tryPlaceMemberChain(
        memberB,
        new Set(),
        0,
        touchedDays,
        null,
      );
      if (!placed) {
        restoreChainState(snap);
        return false;
      }

      let beforeTravel = 0,
        beforeIdle = 0,
        afterTravel = 0,
        afterIdle = 0;
      touchedDays.forEach((day) => {
        beforeTravel += totalTravelCount(snap.dayChains.get(day) || []);
        beforeIdle += dayIdleMinutes(snap.dayChains.get(day) || []);
        afterTravel += totalTravelCount(dayChains.get(day) || []);
        afterIdle += dayIdleMinutes(dayChains.get(day) || []);
      });
      const deltaTravel = afterTravel - beforeTravel;
      const deltaIdle = afterIdle - beforeIdle;

      if (acceptFn(deltaTravel, deltaIdle)) return true;
      restoreChainState(snap);
      return false;
    }

    // 7단계: 지금까지의 단계(1~6단계)는 전부 "그 이동만으로 당장 더 나빠지면 절대
    // 받아들이지 않는" 방식이다. 그런데 사람이 손으로 짠 것처럼 "요일별로 지점을 뭉치는"
    // 배치는, 가끔 특정 회원 한두 명을 일단 더 안 좋아 보이는 자리로 옮겨야만(즉 이동 횟수가
    // 잠깐 늘어나야만) 그 다음에 전체가 훨씬 좋아지는 경로가 열리는 경우가 있다 — 언덕
    // 오르기만으로는 이런 "일단 내려갔다 다시 올라가는" 경로를 절대 찾지 못하고 국소
    // 최적점에 갇힌다. 이를 풀기 위해 담금질 기법(simulated annealing)을 쓴다: 무작위로
    // 회원 한 명(의 세션 하나)을 골라 무작위로 다른 (요일·시각·지점)으로 옮겨보거나, 무작위
    // 두 회원의 자리를 맞바꿔보고, 그 결과가 나빠지더라도 "온도"에 비례한 확률로 일단
    // 받아들인다. 온도는 반복할수록 점점 낮아지므로(식힌다), 처음엔 넓게 헤매다가 점점
    // 개선만 받아들이는 언덕 오르기에 가까워진다. 지금까지 본 것 중 가장 좋은(이동 적음 →
    // 빈 시간 적음) 배치는 별도로 기억해뒀다가 끝나면 그걸로 되돌린다. 세션을 추가·삭제하지
    // 않고 이미 배정된 세션의 자리만 바꾸므로, 미배정 수·전체 수업 수는 이 단계 내내
    // 절대 바뀌지 않는다(0순위·2순위 목표는 항상 그대로 유지됨).
    {
      function saTotalTravel() {
        let sum = 0;
        dayChains.forEach((chain) => {
          sum += totalTravelCount(chain);
        });
        return sum;
      }
      function saTotalIdle() {
        let sum = 0;
        dayChains.forEach((chain) => {
          sum += dayIdleMinutes(chain);
        });
        return sum;
      }
      // 이동 1번의 "무게"를 TRAVEL_VALUE_MINUTES분과 같게 쳐서 비용을 하나의 숫자로
      // 합친다 — 이동 1번을 줄이는 대가로 이보다 더 큰 빈 시간이 필요하면 손해로 친다.
      const SA_TRAVEL_WEIGHT = TRAVEL_VALUE_MINUTES;

      function pickRandomNode(randomFn) {
        const all = Array.from(dayChains.values()).flat();
        if (all.length === 0) return null;
        return all[Math.floor(randomFn() * all.length)];
      }

      function saProposeRelocate(randomFn) {
        const node = pickRandomNode(randomFn);
        if (!node) return null;
        const memberId = node.memberId,
          currentDay = node.day;
        const currentChainWithout = (dayChains.get(currentDay) || []).filter(
          (n) => n !== node,
        );

        const options = [];
        daysWithReqs.forEach((day) => {
          if (
            day !== currentDay &&
            (dayChains.get(day) || []).some((n) => n.memberId === memberId)
          )
            return;
          reqsFor(memberId, day).forEach((r) =>
            options.push({ day, startSlot: r.startSlot, req: r }),
          );
        });
        if (options.length === 0) return null;
        const picked = options[Math.floor(randomFn() * options.length)];
        const locOptions = candidateLocationsForRequest(picked.req);
        if (locOptions.length === 0) return null;
        const locationId =
          locOptions[Math.floor(randomFn() * locOptions.length)];
        if (
          picked.day === currentDay &&
          picked.startSlot === node.startSlot &&
          locationId === node.locationId
        )
          return null;

        const duration = sessionDurationFor2(memberById(memberId));
        const cand = {
          id: picked.req.id,
          memberId,
          day: picked.day,
          startSlot: picked.startSlot,
          duration,
          locationId,
          end: picked.startSlot + durationToSlots(duration),
        };
        const baseChain =
          picked.day === currentDay
            ? currentChainWithout
            : dayChains.get(picked.day) || [];
        const newChain = insertFeasible(baseChain, cand);
        if (!newChain) return null;

        let deltaTravel, deltaIdle;
        if (picked.day === currentDay) {
          deltaTravel =
            totalTravelCount(newChain) -
            totalTravelCount(dayChains.get(currentDay) || []);
          deltaIdle =
            dayIdleMinutes(newChain) -
            dayIdleMinutes(dayChains.get(currentDay) || []);
        } else {
          const beforeCur = dayChains.get(currentDay) || [];
          const beforeTgt = dayChains.get(picked.day) || [];
          deltaTravel =
            totalTravelCount(currentChainWithout) +
            totalTravelCount(newChain) -
            (totalTravelCount(beforeCur) + totalTravelCount(beforeTgt));
          deltaIdle =
            dayIdleMinutes(currentChainWithout) +
            dayIdleMinutes(newChain) -
            (dayIdleMinutes(beforeCur) + dayIdleMinutes(beforeTgt));
        }
        const cost = deltaTravel * SA_TRAVEL_WEIGHT + deltaIdle;

        return {
          cost,
          apply: () => {
            uncommit(currentDay, node);
            if (picked.day === currentDay) {
              dayChains.set(currentDay, newChain);
            } else {
              dayChains.set(currentDay, currentChainWithout);
              dayChains.set(picked.day, newChain);
            }
            const addedNode = newChain.find(
              (n) =>
                n.memberId === memberId &&
                n.startSlot === picked.startSlot &&
                n.locationId === locationId,
            );
            commit(picked.day, addedNode);
          },
        };
      }

      function saProposeSwap(randomFn) {
        const n1 = pickRandomNode(randomFn);
        const n2 = pickRandomNode(randomFn);
        if (
          !n1 ||
          !n2 ||
          n1 === n2 ||
          n1.day === n2.day ||
          n1.memberId === n2.memberId
        )
          return null;
        const day1 = n1.day,
          day2 = n2.day,
          member1 = n1.memberId,
          member2 = n2.memberId;
        if (!reqKeySet.has(member1 + "|" + day2 + "|" + n2.startSlot))
          return null;
        if (!reqKeySet.has(member2 + "|" + day1 + "|" + n1.startSlot))
          return null;
        const req1InDay2 = reqAt(member1, day2, n2.startSlot);
        const req2InDay1 = reqAt(member2, day1, n1.startSlot);
        if (!candidateLocationsForRequest(req1InDay2).includes(n2.locationId))
          return null;
        if (!candidateLocationsForRequest(req2InDay1).includes(n1.locationId))
          return null;
        // 회원당 1일 최대 1회 — member1이 day2에 이미 다른 세션을 갖고 있거나(반대도
        // 마찬가지) 놓치면, 자리를 바꾼 뒤 그 요일에 같은 회원이 두 번 배정될 수 있다.
        if ((dayChains.get(day2) || []).some((n) => n.memberId === member1))
          return null;
        if ((dayChains.get(day1) || []).some((n) => n.memberId === member2))
          return null;

        const dur1 = sessionDurationFor2(memberById(member1));
        const dur2 = sessionDurationFor2(memberById(member2));
        const newInDay2 = {
          id: req1InDay2.id,
          memberId: member1,
          day: day2,
          startSlot: n2.startSlot,
          duration: dur1,
          locationId: n2.locationId,
          end: n2.startSlot + durationToSlots(dur1),
        };
        const newInDay1 = {
          id: req2InDay1.id,
          memberId: member2,
          day: day1,
          startSlot: n1.startSlot,
          duration: dur2,
          locationId: n1.locationId,
          end: n1.startSlot + durationToSlots(dur2),
        };

        const chain1 = insertFeasible(
          (dayChains.get(day1) || []).filter((n) => n !== n1),
          newInDay1,
        );
        if (!chain1) return null;
        const chain2 = insertFeasible(
          (dayChains.get(day2) || []).filter((n) => n !== n2),
          newInDay2,
        );
        if (!chain2) return null;

        const beforeTravel =
          totalTravelCount(dayChains.get(day1) || []) +
          totalTravelCount(dayChains.get(day2) || []);
        const afterTravel = totalTravelCount(chain1) + totalTravelCount(chain2);
        const beforeIdle =
          dayIdleMinutes(dayChains.get(day1) || []) +
          dayIdleMinutes(dayChains.get(day2) || []);
        const afterIdle = dayIdleMinutes(chain1) + dayIdleMinutes(chain2);
        const cost =
          (afterTravel - beforeTravel) * SA_TRAVEL_WEIGHT +
          (afterIdle - beforeIdle);

        return {
          cost,
          apply: () => {
            uncommit(day1, n1);
            uncommit(day2, n2);
            commit(day1, newInDay1);
            commit(day2, newInDay2);
            dayChains.set(day1, chain1);
            dayChains.set(day2, chain2);
          },
        };
      }

      const saRandomFn = mulberry32(552233 + seedOffset);
      // 온도를 반복 횟수가 아니라 "SA 예산 중 실제로 흐른 시간의 비율"로 낮춘다. 반복
      // 한 번마다 곱하는 방식(예전 COOLING_RATE)은 느린 기기(특히 모바일)에서 같은
      // 시간 동안 반복 횟수 자체가 훨씬 적게 돌기 때문에, 마감 시각이 됐을 때 온도가
      // 전혀 식지 않은 채(뜨거운/무작위에 가까운 상태로) 잘려나가 결과 품질이 기기
      // 성능에 따라 들쭉날쭉해지는 문제가 있었다(실제로 확인됨 — 인위적으로 반복 한
      // 번당 처리 시간을 늘려보니 온도가 200에서 거의 안 식은 채 마감돼 빈 시간이
      // 눈에 띄게 나빠졌다). 경과 시간 비율로 식히면 반복 횟수와 무관하게 마감
      // 시각에는 항상 최저 온도(1) 근처까지 식어 있어, 느린 기기도 답이 튀지 않는다.
      const SA_START_TEMP = 200,
        SA_END_TEMP = 1;
      const saStart = now();
      const saDuration = Math.max(1, SA_DEADLINE - saStart);
      let temperature = SA_START_TEMP;
      let bestSnapshotSA = new Map(dayChains);
      let bestTravelSA = saTotalTravel();
      let bestIdleSA = saTotalIdle();
      let iter = 0;
      while (now() < SA_DEADLINE) {
        await maybeYield();
        iter++;
        const elapsedFrac = Math.min(1, (now() - saStart) / saDuration);
        temperature =
          SA_START_TEMP * Math.pow(SA_END_TEMP / SA_START_TEMP, elapsedFrac);
        // 20% 확률로는 3자 연쇄 재배치(tryEjectChainMove)를 시도한다 — 자리 하나만 옮기거나
        // 두 회원만 맞바꾸는 것보다 훨씬 비싸지만(체인이 이어질 때까지 여러 자리를 훑어야
        // 함), 그것만으로는 절대 못 찾는 3자 이상 조합을 찾는 유일한 방법이라 일정 비율을
        // 항상 배정해둔다.
        let applied = false;
        const moveRoll = saRandomFn();
        if (moveRoll < 0.15) {
          // 누가 2번째 수업을 받는지 자체를 바꿔본다(trySessionCountSwap 주석 참고).
          applied = trySessionCountSwap(saRandomFn, (dt, di) => {
            const cost = dt * SA_TRAVEL_WEIGHT + di;
            return cost <= 0 || saRandomFn() < Math.exp(-cost / temperature);
          });
        } else if (moveRoll < 0.35) {
          const node = pickRandomNode(saRandomFn);
          if (node) {
            applied = tryEjectChainMove(node, (dt, di) => {
              const cost = dt * SA_TRAVEL_WEIGHT + di;
              return cost <= 0 || saRandomFn() < Math.exp(-cost / temperature);
            });
          }
        } else {
          const proposal =
            saRandomFn() < 0.35
              ? saProposeSwap(saRandomFn)
              : saProposeRelocate(saRandomFn);
          if (proposal) {
            const accept =
              proposal.cost <= 0 ||
              saRandomFn() < Math.exp(-proposal.cost / temperature);
            if (accept) {
              proposal.apply();
              applied = true;
            }
          }
        }
        if (applied) {
          const curTravel = saTotalTravel();
          const curIdle = saTotalIdle();
          // "지금까지 최선"도 이동-빈 시간 트레이드오프에 같은 상한을 적용해 비교한다 —
          // 안 그러면 담금질이 잠깐 받아들인, 이동은 줄었지만 빈 시간이 과도하게 늘어난
          // 상태가 최종 결과로 굳어버릴 수 있다.
          const curScore = curTravel * TRAVEL_VALUE_MINUTES + curIdle;
          const bestScore = bestTravelSA * TRAVEL_VALUE_MINUTES + bestIdleSA;
          if (
            curScore < bestScore ||
            (curScore === bestScore && curTravel < bestTravelSA)
          ) {
            bestTravelSA = curTravel;
            bestIdleSA = curIdle;
            bestSnapshotSA = new Map(dayChains);
          }
        }
      }
      dayChains.forEach((chain, day) =>
        chain.forEach((node) => uncommit(day, node)),
      );
      bestSnapshotSA.forEach((chain, day) => {
        chain.forEach((node) => commit(day, node));
        dayChains.set(day, chain);
      });
    }

    // 8단계: 담금질 기법이 넓게 찾아둔 배치를, 마지막으로 다시 한번 순수 언덕 오르기(항상
    // 개선만 받아들임)로 다듬어 조금이라도 남은 개선을 마저 챙긴다.
    const relocateRandomFn = mulberry32(334455 + seedOffset);
    let improvedInPass = true;
    let passCount = 0;
    while (improvedInPass && passCount < 30 && now() < POLISH_DEADLINE) {
      await maybeYield();
      improvedInPass = false;
      passCount++;
      const flatNodes = shuffled(
        Array.from(dayChains.values()).flat(),
        relocateRandomFn,
      );
      for (const node of flatNodes) {
        await maybeYield();
        if (now() >= POLISH_DEADLINE) break;
        // dayChains가 이전 이동으로 바뀌었을 수 있으니, 이 노드가 여전히 배정되어 있는지 확인한다.
        const stillThere = (dayChains.get(node.day) || []).includes(node);
        if (!stillThere) continue;
        if (tryRelocateSession(node)) {
          improvedInPass = true;
          continue;
        }
        // 빈 자리로 바로 옮길 수 없으면, 3자 연쇄 재배치(자리를 내주고 그 사람은 다른
        // 자리로 보내는 식)로도 개선이 되는지 마지막으로 확인한다.
        if (tryEjectChainMove(node, travelIdleImproves)) improvedInPass = true;
      }
      if (now() >= POLISH_DEADLINE) break;
      // 맞바꾸기: 모든 (서로 다른 요일의) 세션 쌍을 무작위 순서로 훑으며 시도한다.
      const flatNodes2 = shuffled(
        Array.from(dayChains.values()).flat(),
        relocateRandomFn,
      );
      outer: for (let i = 0; i < flatNodes2.length; i++) {
        for (let k = i + 1; k < flatNodes2.length; k++) {
          await maybeYield();
          if (now() >= POLISH_DEADLINE) break outer;
          const n1 = flatNodes2[i],
            n2 = flatNodes2[k];
          const n1There = (dayChains.get(n1.day) || []).includes(n1);
          const n2There = (dayChains.get(n2.day) || []).includes(n2);
          if (!n1There || !n2There) continue;
          if (tryCrossDaySwap(n1, n2)) improvedInPass = true;
        }
      }
      // 세션 재분배: 2회 배정 회원 중 한 명의 세션을 내려놓고, 1회 배정 회원 중 한 명을
      // 대신 태워보는 조합도 개선이 되는지 확인한다(trySessionCountSwap 주석 참고).
      for (
        let attempt = 0;
        attempt < 60 && now() < POLISH_DEADLINE;
        attempt++
      ) {
        await maybeYield();
        if (trySessionCountSwap(relocateRandomFn, travelIdleImproves))
          improvedInPass = true;
      }
    }

    // 9단계: 지금까지의 담금질·언덕 오르기는 "자리를 완전히 다른 (요일·시각·지점)으로
    // 옮기는" 이동만 다뤘다 — 같은 지점 안에서 시작 시각만 당기면 없앨 수 있는 사소한
    // 빈 시간(예: 상암점 세션 두 개가 붙을 수 있는데 뒤 세션이 굳이 20분 늦게 시작하는
    // 경우)은 그 자체로는 "다른 자리로 옮기기" 후보가 아니어서 놓칠 수 있다. 그래서
    // 마지막으로 각 요일 체인을 이른 시각 쪽으로 눌러 붙인다 — 순서·지점은 그대로 두고
    // 각 세션의 시작 시각만, 그 회원이 실제로 그 시각에도 신청이 있었다는 전제 하에
    // 앞으로 당길 수 있는 만큼 당긴다. 지점 순서가 안 바뀌므로 이동 횟수는 절대 안
    // 바뀌고, 빈 시간만 줄어들거나 그대로다.
    daysWithReqs.forEach((day) => {
      const chain = (dayChains.get(day) || [])
        .slice()
        .sort((a, b) => a.startSlot - b.startSlot);
      for (let idx = 1; idx < chain.length; idx++) {
        const prev = chain[idx - 1];
        const node = chain[idx];
        const minStart =
          prev.startSlot +
          durationToSlots(prev.duration) +
          durationToSlots(requiredGapMin2(prev.locationId, node.locationId));
        if (node.startSlot <= minStart) continue;
        const earlierReqs = reqsFor(node.memberId, day).filter(
          (r) => r.startSlot >= minStart && r.startSlot < node.startSlot,
        );
        if (earlierReqs.length === 0) continue;
        const earliestSlot = Math.min(...earlierReqs.map((r) => r.startSlot));
        node.startSlot = earliestSlot;
        node.end = earliestSlot + durationToSlots(node.duration);
      }
      dayChains.set(day, chain);
    });
  }

  const assigned = [];
  dayChains.forEach((chain) => assigned.push(...chain));
  // 가능 시간(신청)을 아예 제출하지 않은 회원은 배정 대상이 아니었으므로 "미배정"에 넣지
  // 않는다 — 신청은 했지만 자리를 못 받은 회원만 미배정으로 표시한다.
  const eligibleMemberIds = state.members
    .filter((m) => !excludedIdSet2.has(m.id) && submittedIds.has(m.id))
    .map((m) => m.id);
  const assignedMemberIds = new Set(assigned.map((r) => r.memberId));
  const unassignedMembers = eligibleMemberIds
    .filter((id) => !assignedMemberIds.has(id))
    .map(memberById)
    .filter(Boolean);

  return { assigned, unassignedMembers };
}

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

// result가 better보다 더 나은 결과인지 비교한다: 미배정 회원 수(적을수록) → 수업 수(많을수록)
// → 이동 횟수(적을수록) → 총 이동 시간(적을수록) 순.
export function isSchedule2ResultBetter(a, b) {
  if (a.unassignedMembers.length !== b.unassignedMembers.length) {
    return a.unassignedMembers.length < b.unassignedMembers.length;
  }
  if (a.assigned.length !== b.assigned.length)
    return a.assigned.length > b.assigned.length;
  const travelCountA = totalTravelCount(a.assigned),
    travelCountB = totalTravelCount(b.assigned);
  const idleA = schedule2TotalIdleMinutes(a.assigned),
    idleB = schedule2TotalIdleMinutes(b.assigned);
  if (travelCountA !== travelCountB) {
    // 이동 횟수가 다르면 무조건 이동이 적은 쪽을 이기게 하지 않고, 이동 1번의 가치를
    // 빈 시간 TRAVEL_VALUE_MINUTES분으로 쳐서 하나의 점수로 합쳐 비교한다 — 이동을
    // 줄이는 대가로 늘어난 빈 시간이 그보다 크면 오히려 더 나쁜 것으로 친다.
    const netA = travelCountA * TRAVEL_VALUE_MINUTES + idleA;
    const netB = travelCountB * TRAVEL_VALUE_MINUTES + idleB;
    if (netA !== netB) return netA < netB;
  }
  const travelMinA = totalTravelMinutes(a.assigned),
    travelMinB = totalTravelMinutes(b.assigned);
  if (travelMinA !== travelMinB) return travelMinA < travelMinB;
  return idleA < idleB;
}

// isSchedule2ResultBetter 중 앞 두 기준(미배정 수 → 수업 수)만으로 a가 b보다 나은지 본다.
// 후보A-1/A-2/A-3(runSchedule2RestartGroup)가 "카드 간 목표 공유"에 쓴다 — 이동 횟수 등
// 나머지 지표는 카드마다 골격 자체가 달라 서로 비교할 대상이 아니기 때문에 뺀다. b가 없으면
// (아직 어떤 카드도 끝나지 않았으면) 항상 true.
export function floorIsBetter(a, b) {
  if (!b) return true;
  if (a.unassignedMembers.length !== b.unassignedMembers.length) {
    return a.unassignedMembers.length < b.unassignedMembers.length;
  }
  return a.assigned.length > b.assigned.length;
}

// 다듬기(5~9단계, 특히 담금질 기법)는 "미배정 수·수업 수는 그대로 둔 채 이동·빈 시간만
// 줄이는" 국소 탐색이라, 다듬은 뒤 결과가 실제로 얼마나 좋아지는지는 다듬기 전 배치의
// 구조(누가 어느 요일에 배정됐는지)에 따라 달라진다 — 다듬기 전 지표(미배정·수업 수·이동
// 횟수)가 완전히 같은 두 요일 순서라도, 한쪽만 다듬으면 이동이 더 줄어드는 경우가 있다
// (실제로 수동으로 짠 스케줄이 이 지표까지는 같은데 이동을 1번 더 줄인 사례로 확인됨).
// 그래서 다듬기 전 지표가 가장 좋은 순서 "하나"만 고르지 않고, 지표 상위권의 다른 요일
// 순서도(완전 동점이 아니어도) 함께 모아 각각 다듬어본 뒤, 실제로 다듬은 결과끼리 비교해
// 가장 좋은 것을 택한다(자세한 선정 기준은 generateSchedule2Async 참고). 상위권 후보가
// 아주 많을 수 있으므로(무작위 순서 400개 중 다수가 비슷한 지표에 도달하는 경우가 흔하다),
// 서로 다른 배치(신청 서명이 다른 것)만 최대 개수까지만 추려 다듬는다 — 그래야 다듬기
// 시간 예산이 후보 수만큼 무한정 쪼개지지 않는다.
export function schedule2Signature(result) {
  return result.assigned
    .map(
      (r) => r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId,
    )
    .sort()
    .join(",");
}
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
// 카드 3장을 도입하며 "총 대기 시간을 비슷하게" 유지하려고 그룹당 예산을 통짜 탐색의 1/3로
// 줄였었는데, 그러면 실제(회원 수가 많은) 데이터에서는 카드마다 도달하는 최적화 수준이
// 달라진다(예: 수업 30/27/29건처럼 카드마다 실제로 다른 결과에 머묾 — 실제로 이 문제로
// 확인됨). 후보A는 원래 "미배정 없음 → 수업 횟수 최대"가 최우선 기준이라, 카드마다 도달
// 가능한 최댓값에 확실히 닿아야 의미가 있다. 그래서 카드당 예산을 통짜 탐색이 쓰던 값
// 그대로 되돌렸다 — 총 대기 시간은 카드 수(3)에 비례해 늘어난다(최악의 경우 약 20분대).
export const PER_GROUP_DAY_ORDER_SHUFFLES = 400; // 그룹마다 시도할 무작위 요일 순서 수
export const PER_GROUP_SEARCH_DEADLINE_MS = 30000;
export const PER_GROUP_MAX_POLISH_CANDIDATES = 16; // 다듬기 전 지표 상위권 요일 순서 중 그룹당 최대 이만큼만 서로 다른 시작점으로 쓴다
export const PER_GROUP_MAX_POLISH_ATTEMPTS = 48; // 요일 순서와 담금질 시드 재시작을 합쳐 그룹당 최대 이만큼만 다듬어본다
export const PER_GROUP_TOTAL_POLISH_BUDGET_MS = 420000;
export const MIN_POLISH_BUDGET_MS = 6000; // 시도가 여럿이어도 담금질이 의미 있으려면 한 시도당 최소한 이 정도는 필요하다
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
export const TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS = 90000;
export const TARGET_MATCH_ALT_BASE_BUDGET_MS = 8000; // 대안 골격 하나에 쓸 수 있는 시간 상한
export const TARGET_MATCH_ALT_BASE_DAY_ORDER_SHUFFLES = 40; // 대안 골격 하나에서 시도할 무작위 요일 순서 수

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
  // 끼리 겹치지 않도록 충분히 벌려서 넘긴다).
  async function searchWithinBase(
    reqs,
    reqsByDay,
    daysWithReqs,
    shuffleCount,
    deadlineMs,
    seedBase,
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

  // 후보A-1/A-2/A-3 카드마다 독립적으로 탐색한다(서로 다른 시드 → 서로 다른 골격에서
  // 출발) — 카드끼리 동점일 필요는 없다. 각 카드는 자기 자신의 탐색(runSchedule2RestartGroup)
  // 안에서 나온 동점만 배치 페이저로 보여준다.
  const cards = [];
  // 카드 간 목표 공유: 먼저 끝난 카드가 도달한 "미배정 없음 → 수업 횟수" 최고 수준을
  // 기억해뒀다가 다음 카드에 넘긴다 — 못 미치는 카드가 나오면 그 카드가 더 탐색하도록
  // runSchedule2RestartGroup의 targetFloor 처리(TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS)로 이어진다.
  let targetFloor = null;
  for (let g = 0; g < SCHEDULE2_CARD_COUNT; g++) {
    // 카드마다 서로 다른 소수 간격으로 시드를 벌려, 요일 순서·신청 배열 순서 무작위 셔플이
    // 카드끼리 겹치지 않고 완전히 다른 골격에서 출발하게 한다.
    const groupSeed = 20260823 + g * 104729;
    const groupStart = g / SCHEDULE2_CARD_COUNT;
    const card = await runSchedule2RestartGroup(
      eligibleReqs,
      groupSeed,
      g,
      (p) => {
        if (onProgress) onProgress(groupStart + p / SCHEDULE2_CARD_COUNT);
      },
      targetFloor,
    );
    cards.push(
      card || { result: { assigned: [], unassignedMembers: [] }, pool: [] },
    );
    if (card && card.result && floorIsBetter(card.result, targetFloor))
      targetFloor = card.result;
  }
  if (onProgress) onProgress(1);
  return cards; // [{result, pool}, {result, pool}, {result, pool}]
}

// schedule2ToBlocks/schedule2ToTravelBlocks(생성2 결과를 드래그·컨텍스트메뉴 가능한 그리드
// 블록으로 바꾸는 어댑터)는 schedule3.js가 정의하는 moveOrSwapSession 등 페이지 레이어의
// 편집 함수에 의존하므로, 엔진 파일이 페이지를 import하는 순환을 피하기 위해 schedule3.js
// 쪽으로 옮겼다(schedule2ToIdleBlocks/schedule2TotalIdleMinutes는 순수 계산이라 그대로 둠).

// 같은 요일 안에서 연속된 두 세션 사이, 이동 블록이 차지하는 구간을 뺀 나머지
// "진짜 빈 시간"을 회색 배경의 빈 시간 블록으로 그리드에 표시하기 위한 좌표를 만든다.
// (이동 블록과 겹치거나 빈틈이 생기지 않도록, 이동 블록 렌더링과 동일한 반올림을 쓴다.)
export function schedule2ToIdleBlocks(assigned) {
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  const idleBlocks = [];
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1],
        cur = sorted[i];
      // 실제 스케줄링 제약(requiredGapMin2)과 같은 반올림을 써야, 알고리즘이 실제로 예약해둔
      // 이동 시간과 화면에 표시되는 "빈 시간" 시작 지점이 어긋나지 않는다.
      const travelSlots =
        requiredGapMin2(prev.locationId, cur.locationId) / SLOT_MIN;
      const idleStartSlot =
        prev.startSlot + durationToSlots(prev.duration) + travelSlots;
      const idleEndSlot = cur.startSlot;
      if (idleEndSlot > idleStartSlot) {
        const mins = (idleEndSlot - idleStartSlot) * SLOT_MIN;
        idleBlocks.push({
          day: prev.day,
          startSlot: idleStartSlot,
          duration: mins,
          label: "빈 시간 " + mins + "분",
          type: "idle",
        });
      }
    }
  });
  return idleBlocks;
}

// 같은 요일 안에서 연속된 두 세션 사이 간격 중, 이동에 실제로 필요한 시간을 넘어서는
// "진짜 빈 시간"만 합산한다 — 이동으로 이미 설명되는 구간은 빈 시간으로 치지 않는다.
export function schedule2TotalIdleMinutes(assigned) {
  let idle = 0;
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1],
        cur = sorted[i];
      const gapMin =
        (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) *
        SLOT_MIN;
      const needMin = requiredGapMin2(prev.locationId, cur.locationId);
      idle += Math.max(0, gapMin - needMin);
    }
  });
  return idle;
}
