import {
  SLOT_MIN,
  MAX_TRAVELS_PER_DAY,
  MAX_SESSIONS_PER_MEMBER,
  CONSULT_DURATION_MIN_2,
  SESSION_DURATION_MIN_2,
  COVERAGE_WEIGHT_GAP_THRESHOLD,
} from "../constants.js";
import { cellKey, durationToSlots } from "../utils.js";
import { runtime } from "../state.js";
import {
  memberById,
  travelMinutes,
  isInefficientRoundTrip,
  roundTripOriginLoc,
  soloTravelMemberIds,
} from "../domain.js";
import {
  currentExcludedIds2,
  currentOnceLimitIds2,
} from "../selectionOverride.js";
import { candidateLocationsForRequest } from "./greedy.js";

/* ---------------- "수업 스케줄 생성2" 핵심: 하루치 체인 DP ----------------
     회원별 신청을 슬롯 격자 위 노드로 만들고(buildDayNodes), 겹치지 않으면서 지점 간 이동
     시간까지 고려한 가중치 합 최댓값 체인을 하루 단위로 찾는다(runChainDP). 요일 순서
     탐색·다듬기 파이프라인(chainDpPolish.js)과 카드 재시작 오케스트레이션(chainDp.js)이
     공통으로 이 모듈에 의존한다 — chainDp.js의 크기를 줄이려고 원래 그 파일에 있던 걸
     그대로 옮긴 것으로, 로직 자체는 바뀌지 않았다. */

// "빈 시간 최소화" 후보A 카드(chainDp.js의 IDLE_FIRST_CARD_INDEX)를 만드는 동안만 켜진다 — 켜져 있으면 체인 DP·다듬기·결과 비교
// 전 단계가 "미배정 → 비효율 이동 → 수업 수" 다음에 이동 횟수보다 빈 시간을 먼저 본다.
// 카드는 한 장씩 순서대로(await) 만들어지므로 모듈 전역 플래그로 충분하다.
let idleFirst = false;
export function isIdleFirst() {
  return idleFirst;
}
export function setIdleFirst(on) {
  idleFirst = on;
}

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
// locationsFor는 신청 하나의 후보 지점을 돌려주는 함수(기본 candidateLocationsForRequest) —
// 다듬기 파이프라인이 실행 단위로 캐시한 버전을 넘긴다.
export function buildDayNodes(
  dayRequests,
  weightFn,
  jitterFn,
  locationsFor = candidateLocationsForRequest,
) {
  const nodes = [];
  dayRequests.forEach((r) => {
    const member = memberById(r.memberId);
    const duration = sessionDurationFor2(member);
    const end = r.startSlot + durationToSlots(duration);
    locationsFor(r).forEach((locationId) => {
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
export function runChainDP(
  nodes,
  maxTravelsPerDay,
  ineffInfo,
  coveragePriority,
) {
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
    ineff = new Array(n),
    prev = new Array(n),
    twoBackLocIdx = new Array(n);
  const prevOrNull = (k) => (prev[k] !== -1 ? prev[k] : null);
  const locOfIndex = (k) => nodes[k].locationId;
  // 인원(가중치 합) → 비효율 이동(상암점이 낀 A→B→A 왕복) 횟수 → 이동 횟수 → 이동 시간 →
  // 빈 시간(이동에 실제로 필요한 시간을 넘어서는 여분의 간격) → 지터(무작위 값, buildDayNodes
  // 참고) 순으로 비교한다. coveragePriority(아직 한 번도 못 받은 회원만 채우는 진짜 커버리지
  // 단계에서만 true)면 인원을 비효율 이동보다 먼저 보고, 그 외(확장·세션 최대화 단계)에서는
  // 비효율 이동을 인원보다 먼저 봐서 "비효율 이동을 피하려고 세션 하나를 덜 받는" 선택을
  // 허용한다 — 다만 커버리지 자체는 항상 최우선으로 지킨다. 세션 수·이동은 완전히 같은데
  // 시작 시각만 다른 선택지들(예: 15:00 시작과 15:30 시작 둘 다 다음 세션에 문제없이 이어지는
  // 경우) 사이에서는 빈 시간 기준이, 뒤에 남는 빈 시간을 최소화하는 시작 시각을 고르게
  // 해준다. 지터는 평소엔 전부 0이라 아무 영향이 없고, 요일 전체 재섞기 다듬기 단계에서만
  // 값을 채워 넣어 "동점이면 항상 시간순으로만 정해지던" 동점 처리를 매 시도마다 다르게
  // 흔들어준다.
  function better(
    dpA,
    ineffA,
    tcA,
    tmA,
    idleA,
    jsA,
    dpB,
    ineffB,
    tcB,
    tmB,
    idleB,
    jsB,
  ) {
    // dp 차이가 COVERAGE_WEIGHT_GAP_THRESHOLD를 넘으면 PIN_WEIGHT/REBUILD_TARGET_WEIGHT
    // 같은 하드 가중치가 걸려 있다는 뜻이므로, coveragePriority와 무관하게 dp를 먼저 본다.
    const hardWeightGap = Math.abs(dpA - dpB) >= COVERAGE_WEIGHT_GAP_THRESHOLD;
    if (coveragePriority || hardWeightGap) {
      if (dpA !== dpB) return dpA > dpB;
      if (ineffA !== ineffB) return ineffA < ineffB;
    } else {
      if (ineffA !== ineffB) return ineffA < ineffB;
      if (dpA !== dpB) return dpA > dpB;
    }
    if (idleFirst && idleA !== idleB) return idleA < idleB;
    if (tcA !== tcB) return tcA < tcB;
    if (tmA !== tmB) return tmA < tmB;
    if (idleA !== idleB) return idleA < idleB;
    return jsA < jsB;
  }
  // 지점 쌍별 이동 시간·필요 간격을 이 호출 동안만 미리 구해둔다 — 안쪽 루프가 O(노드 수^2)라
  // 쌍마다 travelMinutes를 다시 부르면 그 자체가 전체 생성 시간의 대부분을 차지했다(실측).
  // 호출 안에서만 쓰므로 이동 시간 설정이 바뀌어도 무효화할 캐시가 없다.
  const locIndex = new Map();
  nodes.forEach((nd) => {
    if (!locIndex.has(nd.locationId)) locIndex.set(nd.locationId, locIndex.size);
  });
  const locIds = Array.from(locIndex.keys());
  const L = locIds.length;
  const travelOf = new Array(L * L),
    gapNeedOf = new Array(L * L);
  for (let a = 0; a < L; a++)
    for (let b = 0; b < L; b++) {
      travelOf[a * L + b] = travelMinutes(locIds[a], locIds[b]);
      gapNeedOf[a * L + b] = requiredGapMin2(locIds[a], locIds[b]);
    }
  const locIdxOf = nodes.map((nd) => locIndex.get(nd.locationId));
  // 비효율 왕복 판정도 (2칸 전 지점, 직전 지점, 이번 지점) 조합별로 미리 구해둔다. 2칸 전
  // 지점이 없는 경우(null)는 인덱스 L로 둔다.
  const ineffOf = new Array((L + 1) * L * L);
  for (let a = 0; a <= L; a++)
    for (let b = 0; b < L; b++)
      for (let c = 0; c < L; c++)
        ineffOf[(a * L + b) * L + c] = isInefficientRoundTrip(
          ineffInfo,
          a === L ? null : locIds[a],
          locIds[b],
          locIds[c],
        )
          ? 1
          : 0;
  // 각 DP 상태(그 노드로 끝나는 최선 체인)에 들어 있는 회원 집합을 비트셋으로 들고 다닌다 —
  // 인접 노드만 비교하면 A→B→A처럼 비인접 중복을 놓쳐 잘못된 3개 체인을 점수에 반영한 뒤
  // reconstruction에서 하나를 지우게 되므로, 전이 시점부터 이런 경로를 금지해야 하는데,
  // 매 전이마다 predecessor 체인을 거슬러 올라가지 않고 O(1)로 확인하기 위함이다.
  const memberIndex = new Map();
  nodes.forEach((nd) => {
    if (!memberIndex.has(nd.memberId))
      memberIndex.set(nd.memberId, memberIndex.size);
  });
  const W = Math.max(1, Math.ceil(memberIndex.size / 32));
  const memberBits = new Uint32Array(n * W);
  const memberIdxOf = nodes.map((nd) => memberIndex.get(nd.memberId));
  // 세 지점 회원 규칙(domain.js의 breaksSoloTravel)을 전이 단계에서 지킨다: j가 세 지점 회원이고
  // 이동으로 도착했다면(j까지의 최선 체인 기준) j에서 또 이동으로 떠나는 전이는 막는다. 안쪽
  // 루프에서 쓰려고 정의를 노드별 플래그로 풀어둔 것이다.
  const soloIds = soloTravelMemberIds();
  const noTravelOut = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    let bestDp = node.weight,
      bestIneff = 0,
      bestTc = 0,
      bestTm = 0,
      bestIdle = 0,
      bestJs = node.jitter || 0,
      bestPrev = -1;
    const mIdx = memberIdxOf[i];
    const mWord = mIdx >>> 5,
      mMask = 1 << (mIdx & 31);
    for (let j = 0; j < i; j++) {
      const p = nodes[j];
      // 노드는 끝 시각 순으로 정렬돼 있으므로, 이 노드가 시작하기 전에 끝나지 않는 노드가
      // 처음 나오면 그 뒤도 전부 겹친다(필요 간격은 항상 0 이상) — 더 볼 필요가 없다.
      if (p.end > node.startSlot) break;
      const pair = locIdxOf[j] * L + locIdxOf[i];
      const gapNeed = gapNeedOf[pair];
      const gapActual = (node.startSlot - p.end) * SLOT_MIN;
      if (gapActual < gapNeed) continue;
      const travel = travelOf[pair];
      const addsTravel = travel > 0 ? 1 : 0;
      const newTc = tc[j] + addsTravel;
      if (newTc > maxTravelsPerDay) continue;
      if (memberBits[j * W + mWord] & mMask) continue; // 회원당 1일 최대 1회
      if (addsTravel && noTravelOut[j]) continue; // 이동-회원-이동 금지
      const newDp = dp[j] + node.weight;
      const newTm = tm[j] + travel;
      const newIdle = idle[j] + (gapActual - gapNeed);
      const newJs = js[j] + (node.jitter || 0);
      const newIneff =
        ineff[j] +
        ineffOf[(twoBackLocIdx[j] * L + locIdxOf[j]) * L + locIdxOf[i]];
      if (
        better(
          newDp,
          newIneff,
          newTc,
          newTm,
          newIdle,
          newJs,
          bestDp,
          bestIneff,
          bestTc,
          bestTm,
          bestIdle,
          bestJs,
        )
      ) {
        bestDp = newDp;
        bestIneff = newIneff;
        bestTc = newTc;
        bestTm = newTm;
        bestIdle = newIdle;
        bestJs = newJs;
        bestPrev = j;
      }
    }
    dp[i] = bestDp;
    ineff[i] = bestIneff;
    tc[i] = bestTc;
    tm[i] = bestTm;
    idle[i] = bestIdle;
    js[i] = bestJs;
    prev[i] = bestPrev;
    // 2칸 전 지점(i가 도착하기 전에 있던 지점)까지 알아야 i 다음 노드에서 완성되는 A→B→A
    // 왕복을 판정할 수 있다. prev[i]가 여기서 확정되므로 i마다 한 번만 구한다.
    const twoBack = roundTripOriginLoc(i, prevOrNull, locOfIndex);
    twoBackLocIdx[i] = twoBack === null ? L : locIndex.get(twoBack);
    noTravelOut[i] =
      bestPrev !== -1 &&
      soloIds.has(node.memberId) &&
      travelOf[locIdxOf[bestPrev] * L + locIdxOf[i]] > 0
        ? 1
        : 0;
    if (bestPrev !== -1)
      memberBits.set(
        memberBits.subarray(bestPrev * W, bestPrev * W + W),
        i * W,
      );
    memberBits[i * W + mWord] |= mMask;
  }
  let bestEnd = -1,
    bestDpAll = 0,
    bestIneffAll = 0,
    bestTcAll = 0,
    bestTmAll = 0,
    bestIdleAll = 0,
    bestJsAll = 0;
  for (let i = 0; i < n; i++) {
    if (
      bestEnd === -1 ||
      better(
        dp[i],
        ineff[i],
        tc[i],
        tm[i],
        idle[i],
        js[i],
        bestDpAll,
        bestIneffAll,
        bestTcAll,
        bestTmAll,
        bestIdleAll,
        bestJsAll,
      )
    ) {
      bestDpAll = dp[i];
      bestIneffAll = ineff[i];
      bestTcAll = tc[i];
      bestTmAll = tm[i];
      bestIdleAll = idle[i];
      bestJsAll = js[i];
      bestEnd = i;
    }
  }
  const chain = [];
  let cur = bestEnd;
  while (cur !== -1 && cur !== undefined) {
    chain.unshift(nodes[cur]);
    cur = prev[cur];
  }
  return chain;
}
