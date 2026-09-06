import {
  SLOT_MIN,
  MAX_TRAVELS_PER_DAY,
  MAX_SESSIONS_PER_MEMBER,
  CONSULT_DURATION_MIN_2,
  SESSION_DURATION_MIN_2,
} from "../constants.js";
import { cellKey, durationToSlots } from "../utils.js";
import { runtime } from "../state.js";
import { memberById, travelMinutes } from "../domain.js";
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
