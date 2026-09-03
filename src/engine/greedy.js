import {
  DAYS,
  SLOT_MIN,
  START_MIN,
  SESSION_DURATION_MIN,
  ALLOWED_GAP_MIN,
  BREAK_MIN,
  MAX_TRAVELS_PER_DAY,
  FORCE_ONCE_WEIGHT,
} from "../constants.js";
import { cellKey, durationToSlots, showToast } from "../utils.js";
import {
  state,
  runtime,
  saveState,
  GenerationCancelledError,
} from "../state.js";
import {
  memberById,
  maxSessionsFor,
  soloTravelMemberIds,
  travelMinutes,
} from "../domain.js";
import { currentExcludedIds } from "../selectionOverride.js";

export function requestCells(req) {
  const cells = [];
  const slots = durationToSlots(req.duration);
  for (let i = 0; i < slots; i++)
    cells.push(cellKey(req.day, req.startSlot + i));
  return cells;
}

export function isWithinAvailability(req) {
  return requestCells(req).every((k) => runtime.availableCells.has(k));
}

// "미배정 회원"으로 지정된 회원의 신청은 후보 생성에서 아예 빼고 계산한다(다른 조건은
// 그대로 두고 그 회원만 등록조차 안 한 것처럼 취급).
export function isEligibleRequest(req) {
  return (
    isWithinAvailability(req) && !currentExcludedIds().includes(req.memberId)
  );
}

// day가 days(회원이 이미 배정된 요일들) 중 하나와 연속된 이틀을 이루는지 확인한다.
// 일요일은 다루지 않으므로(토~월 사이에 쉬는 일요일이 끼어 있음) 주 경계 wraparound는 연속으로 보지 않는다.
export function isAdjacentDay(day, days) {
  for (const d of days) {
    if (Math.abs(d - day) === 1) return true;
  }
  return false;
}

// 회원이 등록한 지점들 중 어디서든 그 신청을 소화할 수 있다고 보고, 배정 시점에
// 실제로 사용할 지점을 그 순간의 상황(이동 시간)에 맞춰 고른다.
export function candidateLocationsFor(memberId) {
  const member = memberById(memberId);
  return member && member.locationIds && member.locationIds.length > 0
    ? member.locationIds
    : [null];
}

// 회원의 기본 지점들에 더해, 그 신청 하나에만 "지점 추가하기"로 별도로 허용해둔 지점
// (req.extraLocationIds)까지 합쳐서 돌려준다 — 다른 신청(시간대)에는 영향을 주지 않는다.
export function candidateLocationsForRequest(req) {
  const base = candidateLocationsFor(req.memberId).filter((id) => id !== null);
  const extra = (req.extraLocationIds || []).filter((id) => !base.includes(id));
  const combined = base.concat(extra);
  return combined.length > 0 ? combined : [null];
}

// 두 세션 사이에 실제로 확보해야 하는 최소 간격(분): 쉬는 시간 없이, 지점이 다를 때만 그
// 이동 시간만큼(BREAK_MIN은 0이라 같은 지점이면 간격이 필요 없다). "스케줄과 이동시간은
// 겹칠 수 없습니다" 조건의 하한이다. 10분 슬롯 격자에 맞춰 올림한다 — 이동 시간이 슬롯
// 배수가 아니면(예: 15분) 정확히 그 값에 맞는 시작 시각이 격자 위에 존재할 수 없으므로,
// 격자에서 표현 가능한 가장 좁은 간격을 "빈 시간 없음"의 기준으로 삼아야 한다.
export function requiredGapMin(locA, locB) {
  const raw = Math.max(BREAK_MIN, travelMinutes(locA, locB));
  return Math.ceil(raw / SLOT_MIN) * SLOT_MIN;
}

// tie-break(preferDaytime 옵션)의 "낮 시간대 우선"에 쓴다 — 18시 이전에
// 시작하는 신청인지만 보면 된다.
export const DAYTIME_END_MIN = 18 * 60;
export function isDaytimeStart(cand) {
  return START_MIN + cand.startSlot * SLOT_MIN < DAYTIME_END_MIN;
}

// 하루의 첫 수업이 13:00, 13:30처럼 30분 단위 시각에 시작하는지 본다 — 인원·이동까지
// 동점일 때만 우선하는 tie-break이다(buildBestChain의 alignedScore). 인원을 줄이면서까지
// 강제하지는 않는다. 이미 앞 세션에 맞물려 이어지는 두 번째 이후 세션은 관계없다.
export function isHalfHourStart(cand) {
  return (START_MIN + cand.startSlot * SLOT_MIN) % 30 === 0;
}

// 그 요일의 지점 간 이동 횟수(시간순으로 지점이 바뀌는 지점 수, 이동 시간이 0분인 지점
// 쌍은 실제 이동으로 치지 않음)를 센다. "하루 이동은 최소화하며 최대 허용 횟수까지" 조건에 쓴다.
export function dailyTravelCount(chain) {
  let count = 0;
  for (let i = 1; i < chain.length; i++) {
    if (travelMinutes(chain[i - 1].locationId, chain[i].locationId) > 0)
      count++;
  }
  return count;
}

// 후보 조건을 지키며 배정한다: 회원당 1일 최대 1회, 최대 2회까지(상담 회원은 최대 1회까지), 하루 지점 간 이동은
// 최소화하되 기본 최대 2회까지(options.maxTravelsPerDay로 후보마다 강화 가능) 하며, 스케줄과 이동시간은
// 겹치지 않게, 그리고 "이동시간·휴식시간을 제외한 빈 시간은 없도록" 한다. 다만 빈 시간을
// 최대 ALLOWED_GAP_MIN분까지 허용했을 때 실제로 배정되는 수업(세션) 개수가 늘어난다면,
// 그만큼만 예외로 허용한다(맨 아래 runWithGapPolicy 참고).
//
// 근무 가능 시간이 예를 들어 15시부터라고 해서 그 요일의 첫 세션이 꼭 15시부터일 필요는
// 없다 — 오히려 "일단 제일 이른 신청부터 채우고 본다"는 방식은, 이르지만 고립된(그 뒤로
// 아무도 이어붙일 수 없는) 신청을 먼저 확정해버려서 뒤에 왔으면 빈틈없이 꽉 채울 수 있었던
// 더 나은 무리(cluster)를 놓치고, 그 사이에 허용 범위를 넘는 빈 시간만 남기기 쉽다. 그래서 요일별로
// "이 지점에서, 이 시각부터, 앞으로 이어지는 신청이 있는가"만 이어붙이는 최장 체인을 DP로
// 찾는다 — 체인 안의 인접한 두 세션 사이 간격은 항상 requiredGapMin 이상, requiredGapMin +
// allowGapMin 이하여야 하므로, 완성된 체인에는 정의상 그 한도를 넘는 빈 시간이 생기지
// 않는다. 이 최장 체인 탐색은 세 단계로 나눠 진행한다:
//   1단계 - "각 회원은 최대한 1회 이상"을 위해, 아직 아무 것도 못 받은 회원들만으로 요일별
//           최장 체인을 새로 짠다.
//   2단계 - 연속 이틀은 피하면서, 기존 체인은 뒤로 늘리고 비어있는 요일은 새로 짠다.
//   3단계 - 연속 이틀도 허용해 남은 자리를 채운다.
// (옵션과 무관하게 항상 적용되는 tie-break: 인원·이동까지 동점이면, 하루의 첫 수업이
//   30분 단위 시각(13:00, 13:30 등)에 시작하는 체인을 우선한다 — isHalfHourStart 참고.
//   인원을 줄이면서까지 강제하지는 않는, 동점 상황에서만 작동하는 선호다.)
// options: { travelFirst: 인원(가중치 합)보다 이동 시간 최소화를 먼저 비교한다 —
//   그래도 "빈 시간 없음"은 체인 구조 자체가 보장하므로 항상 유지된다.
//   preferDaytime: 인원·이동까지 같으면 낮 시간대(18시 이전 시작) 세션이 많이
//   들어간 체인을 우선한다 — 저녁보다 낮에 몰아 배정하면 그만큼 그날 안에서 이동할 수 있는
//   여지(뒤에 이어붙일 다른 회원)가 늘어나 결과적으로 이동을 줄이는 데 도움이 된다는 전제.
//   groupByLocation: 그 다음으로(또는 preferDaytime 없이 바로) 같은 지점이 연달아
//   이어지는(지점을 덜 옮겨다니는) 체인을 우선한다.
//   minimizeUnassigned("후보A"): 기본 순서로 한 번 배정해보고, 1단계(아직 아무 것도 못
//   받은 회원 채우기)에서 신청 가능한 회원이 적은(대안이 좁은) 요일부터 먼저 채우는
//   순서로 한 번 더 배정해본 뒤, 실제로 배정된 인원이 더 많은 쪽을 택한다 — 요일 순서를
//   바꾸는 것만으로는 항상 더 나아진다는 보장이 없으므로(체인끼리 얽혀 있으면 오히려
//   다른 요일의 체인을 갈라놓을 수 있다), 두 결과를 직접 비교해 기본보다 나쁘지 않은
//   쪽만 채택한다. }
export function greedyAssign(eligibleReqs, options, pinned) {
  options = options || {};
  pinned = pinned || [];
  const travelFirst = !!options.travelFirst;
  const preferDaytime = !!options.preferDaytime;
  const groupByLocation = !!options.groupByLocation;
  const minimizeUnassigned = !!options.minimizeUnassigned;
  // "총 수업 건수 → 이동 횟수" 순으로 배정하는 후보B용: 1단계를 "아직 아무 것도 못 받은
  // 회원만" 채우는 방식이 아니라, 처음부터 모든 회원(정원 안에서)을 대상으로 요일별 최선
  // 체인을 짜게 한다 — 인원(서로 다른 회원 수)이 아니라 세션 총 개수를 곧바로 최대화한다.
  const sessionCountFirst = !!options.sessionCountFirst;
  const pinnedLocationDay = options.pinnedLocationDay || null; // { day, locationId } — 특정 요일에 특정 지점을 먼저 배정(strengthenCandidate의 사전 단계 탐색용)
  const maxTravelsPerDay = options.maxTravelsPerDay || MAX_TRAVELS_PER_DAY;
  const maxTravelsPerWeek = options.maxTravelsPerWeek || null; // 일주일 총 이동 횟수 한도
  // travelCountOnly: 인원(또는 세션 수) → 이동 횟수까지만 비교하고 멈추게 하는 옵션 —
  // 이동 시간, 이동시간+빈시간 합 같은 세부 기준(아래 addToIndex 참고)은 건너뛴다. 한때
  // 후보A·B가 이 옵션을 켜뒀지만, 그러면 인원·세션·이동 횟수까지 완전히 동점인 배치들
  // 사이에서 빈 시간(간격)이 굳이 더 큰 쪽이 우연히 선택될 수 있었다 — 예를 들어 회원이
  // 20:00부터 가능한데 다른 조건이 모두 같은데도 20:10에 배정되는 식("이동시간·휴식시간을
  // 제외한 빈 시간은 없도록 합니다" 규칙과 어긋남). 그래서 지금은 어떤 후보도 이 옵션을
  // 켜지 않는다 — 모든 후보가 이동 횟수까지 동점이면 이동 시간, 그마저 동점이면 빈 시간
  // 합까지 비교해 가장 빈틈없는 배치를 고른다. 옵션 자체는 나중에 다시 필요할 수 있어 남겨둔다.
  const travelCountOnly = !!options.travelCountOnly;
  // repairUnassigned 전용: 지정된 회원들의 "첫 세션"에만 압도적으로 큰 가중치를 준다
  // (이미 1회를 받은 뒤에는 다시 보통 가중치로 돌아간다 —
  // 그렇지 않으면 sessionCountFirst 전략에서 이미 배정 여부와 무관하게 매 요일 1단계마다
  // 최우선으로 뽑혀 2회까지 억지로 채워지면서 다른 요일 배치를 필요 이상으로 크게 흔든다).
  // 여러 명을 한꺼번에 지정할 수 있는 이유는 repairUnassigned 참고.
  const forceOnceMemberIds = options.forceOnceMemberIds
    ? new Set(options.forceOnceMemberIds)
    : null;
  // 재생성 탐색용: 1단계에서 요일을 처리하는 순서를 외부(searchStrategyPool/generateCandidatesAsync)에서
  // 무작위로 섞어 넘겨줄 수 있다 — minimizeUnassigned의 "대안이 좁은 요일부터" 순서와 마찬가지로
  // runWithGapPolicy가 기본 순서와 비교해 실제로 더 나을 때만 채택한다(아래 참고).
  const externalDayOrder = options.stage1DayOrder || null;

  // 숨김 하드 로직(회원 개인 사정으로 인한 예외, 후보 조건에는 노출하지 않음): 상암점·여의도점·
  // 마포점 세 지점을 모두 다니는 회원은 "이동-회원-이동"(도착도 이동, 떠날 때도 이동 — 그
  // 지점에 그 회원 혼자만 있는 경우)으로 배정될 수 없다. 같은 지점에서 다른 회원과 붙어
  // 있으면(이동-회원-다른회원-이동) 괜찮다. buildBestChain predecessor 탐색에서, 이 회원
  // 자신도 이동으로 도착한 노드일 때 그 다음도 이동으로 이어지려는 연결만 걸러낸다(아래
  // arrivedViaTravel 참고). eligibleSwapMembersFor도 수동 교체 시 같은 규칙을 적용한다.
  const soloTravelIds = soloTravelMemberIds();

  // 정렬 순서(전략별 동점 처리 포함)를 "이 신청이 얼마나 우선인가"로만 쓴다 — 체인을 이을 때
  // 여러 후보가 동시에 맞물릴 수 있으면 순위가 앞선 쪽을 고르고, 체인 길이가 같으면 순위
  // 합이 더 좋은 체인을 고른다. 순서 자체를 그대로 커밋하지는 않는다(그게 바로 위 문제의 원인).
  const priorityRank = new Map(eligibleReqs.map((r, i) => [r.id, i]));

  const byDay = new Map();
  eligibleReqs.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const allLocIds = state.locations.map((l) => l.id).concat([null]);
  function allMemberIdsForDay(day) {
    return new Set((byDay.get(day) || []).map((r) => r.memberId));
  }

  // 하루치 배정을 처음부터 끝까지 한 번 실행한다(1~3단계 전체). stage1Order로 1단계에서
  // 요일을 처리하는 순서만 바꿀 수 있다 — minimizeUnassigned 옵션("후보A")이 이 순서를
  // 두 가지로 각각 시도해보고 더 나은 쪽을 고르는 데 쓴다. allowGapMin은 이번 실행에서
  // 세션 사이에 추가로 허용할 빈 시간(분) 한도다 — 아래 runWithGapPolicy가 0(엄격)과
  // ALLOWED_GAP_MIN(완화)을 각각 시도해보고 실제로 세션 수가 늘어날 때만 완화 쪽을 쓴다.
  function runPass(stage1Order, allowGapMin) {
    const assigned = [];
    const memberDays = new Map(); // memberId -> Set(day)
    const chainByDay = new Map(); // day -> 그 요일에 확정된, 시간순으로 빈틈없는 체인

    function withinCaps(memberId, day) {
      const usedDays = memberDays.get(memberId);
      if (usedDays && usedDays.has(day)) return false; // 1일 최대 1회
      if (usedDays && usedDays.size >= maxSessionsFor(memberById(memberId)))
        return false; // 최대 2회(상담 회원은 최대 1회)
      return true;
    }
    function commit(day, located) {
      assigned.push(located);
      if (!memberDays.has(located.memberId))
        memberDays.set(located.memberId, new Set());
      memberDays.get(located.memberId).add(day);
      if (!chainByDay.has(day)) chainByDay.set(day, []);
      chainByDay.get(day).push(located);
    }

    // maxTravelsPerWeek 옵션("새 후보": 일주일 총 이동 횟수 제한)에 쓴다 — day를 제외한 나머지
    // 요일에서 이미 확정된 이동 횟수의 합을 구해, 그 요일의 체인을 짜거나 늘릴 때 "이 요일
    // 자체 이동 횟수 + 다른 요일 합"이 주간 한도를 넘지 않는지 확인하는 데 쓴다.
    function weeklyTravelUsedExcluding(day) {
      let total = 0;
      chainByDay.forEach((chain, d) => {
        if (d === day) return;
        total += dailyTravelCount(chain);
      });
      return total;
    }

    // 그 요일 후보 전원을 대상으로, "빈 시간 없는" 최장(가중치 합이 가장 큰) 체인을 DP로 찾는다.
    // weightFn(memberId)이 주어지면(1단계에서만 씀) 단순히 세션 "개수"가 아니라 회원별 가중치의
    // 합을 최대화한다 — 이래야 그 요일에 유독 신청이 촘촘한 다른 회원들 덕분에 체인이 길어질
    // 때, 그 주에 그 시간대 말고는 갈 곳이 아예 없는 희소한 회원이 밀려나지 않는다("이동시간이
    // 있는데 다른 회원을 넣지 않은 이유" 문의로 확인된 문제 — 체인 길이만 보면 그 회원 한 명
    // 넣는 것보다 다른 여럿을 넣는 쪽이 항상 더 길어 보이지만, 그 여럿은 다른 요일에도 기회가
    // 있고 그 회원은 없을 수 있다).
    // 각 (신청, 사용할 지점) 조합을 노드로 보고 끝나는 시각 오름차순으로 처리한다.
    // 노드를 "끝나는 시각 + 지점"으로 색인해두면, 다음 신청이 필요로 하는 "정확히 그 시각에
    // 끝나는 이전 세션"을 매번 전체를 훑지 않고 바로 찾을 수 있다.
    // endBefore가 있으면({slot, locationId}), 하루 전체가 아니라 그 시각·지점 앞에 정확히
    // 맞물려 끝나는 체인만 찾는다 — 확정(고정)된 세션 앞의 빈 시간을 채울 때 쓴다.
    // onlyLocationId가 있으면("지점 우선 배정" 사전 단계), 그 지점을 등록해둔
    // 회원의 그 지점 후보만으로 체인을 짠다 — 같은 지점끼리는 이동 시간이 0이므로, 이 체인은
    // 곧 "그 요일에 그 지점으로 최대한 많이 배정하는" 결과가 된다.
    function buildBestChain(
      day,
      eligibleMemberIds,
      weightFn,
      endBefore,
      onlyLocationId,
    ) {
      weightFn = weightFn || (() => 1);
      // 이 함수 실행 동안(= day 하루치 체인을 짜는 동안) 다른 요일의 확정 이동 횟수는 바뀌지
      // 않으므로 한 번만 구해둔다.
      const otherDaysTravelUsed =
        maxTravelsPerWeek != null ? weeklyTravelUsedExcluding(day) : 0;
      const cands = (byDay.get(day) || []).filter(
        (r) =>
          eligibleMemberIds.has(r.memberId) &&
          (!endBefore ||
            r.startSlot + durationToSlots(r.duration) <= endBefore.slot),
      );
      const nodes = [];
      cands.forEach((cand) => {
        const memberLocs = candidateLocationsForRequest(cand);
        const locs = onlyLocationId
          ? memberLocs.includes(onlyLocationId)
            ? [onlyLocationId]
            : []
          : memberLocs;
        locs.forEach((locId) => {
          nodes.push({
            cand,
            locationId: locId,
            end: cand.startSlot + durationToSlots(cand.duration),
          });
        });
      });
      nodes.sort(
        (a, b) =>
          a.end - b.end ||
          priorityRank.get(a.cand.id) - priorityRank.get(b.cand.id),
      );

      // "하루 이동은 최소화"를 실제로 반영하려면, 인원(가중치 합)이 같은 체인들 사이에서는
      // 이동 횟수가 더 적은 쪽을 골라야 한다(travelFirst 옵션이 켜지면 이 둘의 우선순위를
      // 아예 뒤집어, 이동 횟수를 인원보다 먼저 비교한다). travelCountOnly 옵션이 켜지면
      // 여기서 비교를 멈춘다(지금은 어떤 후보도 켜지 않는다). 아니면 그마저 동점일 때 이동 시간 합이 더 적은 쪽을,
      // 그마저 동점이면 이동 시간 합 + 빈 시간(슬랙) 합이 더 적은 쪽을(=이동 시간이 같다면
      // 결국 빈 시간이 적은 쪽을) 고르고, 그다음으로 하루의 첫 수업이 30분 단위 시각(예:
      // 13:00, 13:30)에 시작하는 체인을 우선한다 — 인원을 줄이면서까지 정렬을 강제하지는
      // 않고, 이미 동점인 대안들 사이에서만 고른다. preferDaytime 옵션이
      // 켜지면 그다음으로 낮 시간대(18시 이전 시작) 세션이 많이 들어간 체인을 우선하고,
      // groupByLocation 옵션이 켜지면 그다음으로 같은 지점이 연달아 이어지는(지점을 덜
      // 옮겨다니는) 체인을 우선한다. 그래서 색인은 이 값들을 옵션에 맞는 순서로 정렬해둔다 —
      // 맨 앞이 항상 "이 시각·지점에서 끝나는 세션 중 가장 좋은 것"이 되게.
      const index = new Map(); // `${end}|${locId}` -> node[] (가장 좋은 것부터)
      const key = (end, locId) => end + "|" + locId;
      function timeCostOf(n) {
        return n.travelMinutesSum + n.idleMinutesSum;
      }
      function addToIndex(node) {
        const k = key(node.end, node.locationId);
        if (!index.has(k)) index.set(k, []);
        const list = index.get(k);
        list.push(node);
        list.sort((a, b) =>
          travelFirst
            ? a.travelCount - b.travelCount ||
              b.dp - a.dp ||
              (travelCountOnly
                ? 0
                : a.travelMinutesSum - b.travelMinutesSum ||
                  timeCostOf(a) - timeCostOf(b) ||
                  b.alignedScore - a.alignedScore ||
                  a.soloSlackPenalty - b.soloSlackPenalty) ||
              (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) ||
              (groupByLocation ? b.groupScore - a.groupScore : 0)
            : b.dp - a.dp ||
              a.travelCount - b.travelCount ||
              (travelCountOnly
                ? 0
                : a.travelMinutesSum - b.travelMinutesSum ||
                  timeCostOf(a) - timeCostOf(b) ||
                  b.alignedScore - a.alignedScore ||
                  a.soloSlackPenalty - b.soloSlackPenalty) ||
              (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) ||
              (groupByLocation ? b.groupScore - a.groupScore : 0),
        );
      }
      function chainScore(node) {
        let s = 0,
          n = node;
        while (n) {
          s += priorityRank.get(n.cand.id);
          n = n.prev;
        }
        return s;
      }
      // (dpA, countA, travelA, timeCostA, alignedA, slackPenA, daytimeA, groupA)가 (dpB, countB,
      // travelB, timeCostB, alignedB, slackPenB, daytimeB, groupB)보다 나은지, 옵션에 맞게
      // 비교한다. count는 하루 이동 횟수, travel은 이동 시간 합, timeCost는 이동 시간 합 + 빈
      // 시간(슬랙) 합이다 — 기본 순서는 "인원 최대화 → 이동 횟수 최소화 → (travelCountOnly가
      // 아니면) 이동 시간 최소화 → 총 이동시간+빈 시간의 합이 적은 쪽"(마지막 비교는 이동
      // 시간이 이미 같으므로 사실상 빈 시간만 비교하는 셈이 된다). slackPen은 숨김 하드 로직(세 지점을 모두 다니는 회원)의
      // 연장선인 숨김 소프트 선호다 — 그런 회원이 같은 지점 앞사람에게서 빈 시간 슬랙을 써서
      // 이어붙는 것보다는, 슬랙 없이 이어붙고 대신 그 뒤 이동 쪽에 슬랙이 남는 배치를 우선한다.
      function isBetterPair(
        dpA,
        countA,
        travelA,
        timeCostA,
        alignedA,
        slackPenA,
        daytimeA,
        groupA,
        dpB,
        countB,
        travelB,
        timeCostB,
        alignedB,
        slackPenB,
        daytimeB,
        groupB,
      ) {
        if (travelFirst) {
          if (countA !== countB) return countA < countB;
          if (dpA !== dpB) return dpA > dpB;
        } else {
          if (dpA !== dpB) return dpA > dpB;
          if (countA !== countB) return countA < countB;
        }
        if (travelCountOnly) return false;
        if (travelA !== travelB) return travelA < travelB;
        if (timeCostA !== timeCostB) return timeCostA < timeCostB;
        if (alignedA !== alignedB) return alignedA > alignedB;
        if (slackPenA !== slackPenB) return slackPenA < slackPenB;
        if (preferDaytime && daytimeA !== daytimeB) return daytimeA > daytimeB;
        if (groupByLocation && groupA !== groupB) return groupA > groupB;
        return false;
      }

      let best = null;
      nodes.forEach((node) => {
        // 회원 중복 금지는 "바로 앞 세션"뿐 아니라 체인 전체를 봐야 하므로(usedMembers), 각
        // predLoc(어느 지점에서 왔는지)마다 그 버킷에서 가장 좋은(색인이 이미 그 순서로 정렬된)
        // 항목부터 훑어 회원이 겹치지 않는 첫 항목을 취하고, predLoc들 사이에서는 결과
        // (dp, 이동 횟수, 이동시간+빈시간 합, 정렬 점수, 낮 시간대 점수, 지점 묶기 점수)를
        // 서로 비교해 최종적으로 가장 좋은 것을 고른다.
        let bestPrev = null,
          bestPrevDp = -Infinity,
          bestResultTravelOnly = Infinity,
          bestResultTimeCost = Infinity,
          bestResultAligned = -Infinity,
          bestResultSlackPen = Infinity,
          bestResultDaytime = -Infinity,
          bestResultGroup = -Infinity,
          bestTravelCount = Infinity,
          bestTransitionMin = 0,
          bestSlackMin = 0;
        allLocIds.forEach((predLoc) => {
          const need = requiredGapMin(predLoc, node.locationId);
          const transitionMin = travelMinutes(predLoc, node.locationId);
          // 필요한 간격(need)보다 최대 allowGapMin분까지 더 벌어져도(=설명 안 되는
          // 빈 시간이 그만큼 생겨도) 이어붙일 수 있다 — 10분 단위 슬롯마다 하나씩 확인한다.
          for (
            let slackMin = 0;
            slackMin <= allowGapMin;
            slackMin += SLOT_MIN
          ) {
            const reqEnd = node.cand.startSlot - (need + slackMin) / SLOT_MIN;
            const list = index.get(key(reqEnd, predLoc));
            if (!list) continue;
            for (const prevNode of list) {
              if (prevNode.usedMembers.has(node.cand.memberId)) continue;
              // 숨김 하드 로직: 세 지점을 모두 다니는 회원이 이동으로 도착한 세션이면, 거기서
              // 또 이동으로 이어지는 연결은 막는다("이동-회원-이동" 금지). 같은 지점에서 다른
              // 회원에게 이어지는 것(이동-회원-다른회원-이동)은 transitionMin이 0이라 여기 걸리지 않는다.
              if (
                soloTravelIds.has(prevNode.cand.memberId) &&
                prevNode.arrivedViaTravel &&
                transitionMin > 0
              )
                continue;
              const tc = prevNode.travelCount + (transitionMin > 0 ? 1 : 0);
              if (tc > maxTravelsPerDay) continue; // 하루 이동 최대 허용 횟수
              if (
                maxTravelsPerWeek != null &&
                otherDaysTravelUsed + tc > maxTravelsPerWeek
              )
                continue; // 일주일 총 이동 최대 허용 횟수
              const resultTravelOnly =
                prevNode.travelMinutesSum + transitionMin;
              const resultTimeCost =
                resultTravelOnly + prevNode.idleMinutesSum + slackMin;
              // 숨김 소프트 로직: 세 지점을 모두 다니는 회원이 같은 지점 앞사람에게서 슬랙(빈 시간)을
              // 써서 이어붙으면 그만큼 페널티를 쌓는다 — 슬랙 없이 붙거나(0) 이동으로 이어지는 경우는 0.
              const slackPenalty =
                soloTravelIds.has(node.cand.memberId) &&
                transitionMin === 0 &&
                slackMin > 0
                  ? slackMin
                  : 0;
              const resultSlackPen = prevNode.soloSlackPenalty + slackPenalty;
              if (
                !bestPrev ||
                isBetterPair(
                  prevNode.dp,
                  tc,
                  resultTravelOnly,
                  resultTimeCost,
                  prevNode.alignedScore,
                  resultSlackPen,
                  prevNode.daytimeScore,
                  prevNode.groupScore,
                  bestPrevDp,
                  bestTravelCount,
                  bestResultTravelOnly,
                  bestResultTimeCost,
                  bestResultAligned,
                  bestResultSlackPen,
                  bestResultDaytime,
                  bestResultGroup,
                )
              ) {
                bestPrevDp = prevNode.dp;
                bestPrev = prevNode;
                bestTravelCount = tc;
                bestResultTravelOnly = resultTravelOnly;
                bestResultTimeCost = resultTimeCost;
                bestTransitionMin = transitionMin;
                bestSlackMin = slackMin;
                bestResultAligned = prevNode.alignedScore;
                bestResultSlackPen = resultSlackPen;
                bestResultDaytime = prevNode.daytimeScore;
                bestResultGroup = prevNode.groupScore;
              }
              break; // 이 버킷에서는 이미 가장 좋은 순으로 정렬돼 있으니 첫 유효 항목이 최선
            }
          }
        });
        const daytimeBonus = isDaytimeStart(node.cand) ? 1 : 0;
        if (bestPrev) {
          node.dp = bestPrev.dp + weightFn(node.cand.memberId);
          node.prev = bestPrev;
          node.travelCount = bestTravelCount;
          node.travelMinutesSum = bestPrev.travelMinutesSum + bestTransitionMin;
          node.idleMinutesSum = bestPrev.idleMinutesSum + bestSlackMin;
          node.alignedScore = bestPrev.alignedScore; // 하루의 첫 세션이 정렬됐는지만 그대로 이어받는다
          node.soloSlackPenalty = bestResultSlackPen;
          node.daytimeScore = bestPrev.daytimeScore + daytimeBonus;
          node.groupScore =
            bestPrev.groupScore +
            (bestPrev.locationId === node.locationId ? 1 : 0); // 지점을 바꾸지 않고 이어지면 +1
          node.usedMembers = new Set(bestPrev.usedMembers);
          node.usedMembers.add(node.cand.memberId);
          node.arrivedViaTravel = bestPrev.locationId !== node.locationId;
        } else {
          node.dp = weightFn(node.cand.memberId);
          node.prev = null;
          node.travelCount = 0;
          node.travelMinutesSum = 0;
          node.idleMinutesSum = 0;
          node.alignedScore = isHalfHourStart(node.cand) ? 1 : 0;
          node.soloSlackPenalty = 0;
          node.daytimeScore = daytimeBonus;
          node.groupScore = 0;
          node.usedMembers = new Set([node.cand.memberId]);
          node.arrivedViaTravel = false; // 하루의 첫 세션은 "이동해서 도착"이 아니라 그냥 시작
        }
        if (node.dp > -Infinity) {
          addToIndex(node);
          const nodeTimeCost = timeCostOf(node);
          const bestTimeCost = best ? timeCostOf(best) : null;
          const tie =
            best &&
            node.dp === best.dp &&
            node.travelCount === best.travelCount &&
            (travelCountOnly ||
              node.travelMinutesSum === best.travelMinutesSum) &&
            (travelCountOnly || nodeTimeCost === bestTimeCost) &&
            (travelCountOnly || node.alignedScore === best.alignedScore) &&
            (travelCountOnly ||
              node.soloSlackPenalty === best.soloSlackPenalty) &&
            (!preferDaytime || node.daytimeScore === best.daytimeScore) &&
            (!groupByLocation || node.groupScore === best.groupScore);
          if (
            !best ||
            isBetterPair(
              node.dp,
              node.travelCount,
              node.travelMinutesSum,
              nodeTimeCost,
              node.alignedScore,
              node.soloSlackPenalty,
              node.daytimeScore,
              node.groupScore,
              best.dp,
              best.travelCount,
              best.travelMinutesSum,
              bestTimeCost,
              best.alignedScore,
              best.soloSlackPenalty,
              best.daytimeScore,
              best.groupScore,
            ) ||
            (tie && chainScore(node) < chainScore(best))
          )
            best = node;
        }
      });

      let chosen = best;
      if (endBefore) {
        // 하루 전체에서 가장 좋은 체인이 아니라, endBefore 앞에 정확히 맞물려 끝나는 체인 중
        // 가장 좋은 것을 고른다 (지점마다 필요한 간격이 달라 위치별로 인덱스를 조회한다).
        chosen = null;
        allLocIds.forEach((loc) => {
          const need = requiredGapMin(loc, endBefore.locationId);
          const transitionMin = travelMinutes(loc, endBefore.locationId);
          for (
            let slackMin = 0;
            slackMin <= allowGapMin;
            slackMin += SLOT_MIN
          ) {
            const gapSlots = (need + slackMin) / SLOT_MIN;
            const list = index.get(key(endBefore.slot - gapSlots, loc));
            if (!list || list.length === 0) continue;
            // 이미 버킷 안에서 가장 좋은 순으로 정렬되어 있으니 첫 유효 항목을 쓴다 — 다만
            // 숨김 하드 로직에 걸리는 회원이면("이동-회원-이동") 다음 후보를 본다.
            const node = list.find(
              (n) =>
                !(
                  soloTravelIds.has(n.cand.memberId) &&
                  n.arrivedViaTravel &&
                  transitionMin > 0
                ),
            );
            if (!node) continue;
            const nodeTimeCost = timeCostOf(node);
            const chosenTimeCost = chosen ? timeCostOf(chosen) : null;
            if (
              !chosen ||
              isBetterPair(
                node.dp,
                node.travelCount,
                node.travelMinutesSum,
                nodeTimeCost,
                node.alignedScore,
                node.soloSlackPenalty,
                node.daytimeScore,
                node.groupScore,
                chosen.dp,
                chosen.travelCount,
                chosen.travelMinutesSum,
                chosenTimeCost,
                chosen.alignedScore,
                chosen.soloSlackPenalty,
                chosen.daytimeScore,
                chosen.groupScore,
              )
            ) {
              chosen = node;
            }
          }
        });
      }

      if (!chosen) return [];
      const chain = [];
      let cur = chosen;
      while (cur) {
        chain.unshift({
          id: cur.cand.id,
          memberId: cur.cand.memberId,
          day,
          startSlot: cur.cand.startSlot,
          duration: cur.cand.duration,
          locationId: cur.locationId,
        });
        cur = cur.prev;
      }
      return chain;
    }

    // 이미 확정된 체인 뒤에 정확히 맞물리는 다음 신청을, 우선순위가 가장 앞선 것부터 하나씩
    // 이어붙인다(뒤쪽으로만 확장 — 앞쪽 빈 시간은 아래 extendChainBackward가 별도로 채운다).
    function extendExistingChain(day, eligibleMemberIds) {
      let chain = chainByDay.get(day) || [];
      if (chain.length === 0) return;
      const usedMembers = new Set(chain.map((s) => s.memberId));
      const dayCands = byDay.get(day) || [];
      let extending = true;
      while (extending) {
        extending = false;
        const chainEnd = chain[chain.length - 1];
        // 숨김 하드 로직: chainEnd가 세 지점을 모두 다니는 회원이고 그 자신도 이동으로
        // 도착했다면, 여기서 또 이동으로 이어붙이는 것은 막는다("이동-회원-이동" 금지,
        // buildBestChain의 동일 로직 참고).
        const chainEndArrivedViaTravel =
          chain.length >= 2 &&
          chain[chain.length - 2].locationId !== chainEnd.locationId;
        const chainEndIsSoloTravelMember =
          soloTravelIds.has(chainEnd.memberId) && chainEndArrivedViaTravel;
        // "하루 이동은 최소화"하기 위해, 여러 회원이 동시에 이어붙을 수 있으면 이동 시간이
        // 적게 드는 쪽을 먼저 고르고, 그래도 같으면 우선순위(priorityRank)로 정한다.
        let bestCand = null,
          bestLocated = null,
          bestCost = Infinity;
        dayCands.forEach((cand) => {
          if (
            !eligibleMemberIds.has(cand.memberId) ||
            usedMembers.has(cand.memberId)
          )
            return;
          let bestLoc = null;
          candidateLocationsForRequest(cand).forEach((locId) => {
            const need = requiredGapMin(chainEnd.locationId, locId);
            const actual =
              (cand.startSlot -
                (chainEnd.startSlot + durationToSlots(chainEnd.duration))) *
              SLOT_MIN;
            if (actual < need || actual > need + allowGapMin) return;
            const cost = travelMinutes(chainEnd.locationId, locId);
            if (chainEndIsSoloTravelMember && cost > 0) return;
            if (!bestLoc || cost < bestLoc.cost) bestLoc = { locId, cost };
          });
          if (!bestLoc) return;
          // travelFirst("이동 최소화")면 이동이 아예 안 드는 연장만 받아들인다 — 인원을
          // 늘리자고 새 이동을 추가하는 건 이 후보의 목적과 어긋난다. 체인은 여기서 멈추고,
          // 그 뒤 시간은 "빈 시간"이 아니라 그냥 그날 일정이 거기서 끝나는 것으로 둔다.
          if (travelFirst && bestLoc.cost > 0) return;
          if (
            !bestCand ||
            bestLoc.cost < bestCost ||
            (bestLoc.cost === bestCost &&
              priorityRank.get(cand.id) < priorityRank.get(bestCand.id))
          ) {
            bestCand = cand;
            bestCost = bestLoc.cost;
            bestLocated = {
              id: cand.id,
              memberId: cand.memberId,
              day,
              startSlot: cand.startSlot,
              duration: cand.duration,
              locationId: bestLoc.locId,
            };
          }
        });
        if (bestLocated) {
          const projectedChain = [...chain, bestLocated];
          if (dailyTravelCount(projectedChain) > maxTravelsPerDay) break; // 하루 이동 최대 허용 횟수
          if (
            maxTravelsPerWeek != null &&
            weeklyTravelUsedExcluding(day) + dailyTravelCount(projectedChain) >
              maxTravelsPerWeek
          )
            break; // 일주일 총 이동 최대 허용 횟수
          commit(day, bestLocated);
          chain = chainByDay.get(day);
          usedMembers.add(bestCand.memberId);
          extending = true;
        }
      }
    }

    // extendExistingChain이 체인 뒤쪽만 확장하는 것과 대칭으로, 체인 맨 앞(가장 이른 확정
    // 세션) 앞의 빈 시간을 채운다. 확정(고정) 세션 앞을 채울 때 쓰던 buildBestChain의
    // endBefore 기능을 그대로 재사용해, 체인 시작점 앞에 정확히 맞물리는 최선의 체인을
    // 찾는다. 앞뒤를 합친 하루 전체가 "하루 이동 최대 허용 횟수"를 넘기면 적용하지 않는다(앞쪽
    // 체인 자체는 자기 안에서 이 한도를 지키지만, 기존 체인과 이어지는 지점에서의 이동은
    // buildBestChain이 알지 못하므로 합친 뒤 다시 확인해야 한다).
    function extendChainBackward(day, eligibleMemberIds, weightFn) {
      const chain = chainByDay.get(day) || [];
      if (chain.length === 0) return;
      const usedMembers = new Set(chain.map((s) => s.memberId));
      const remaining = new Set(
        [...eligibleMemberIds].filter((id) => !usedMembers.has(id)),
      );
      if (remaining.size === 0) return;
      const chainStart = chain[0];
      const frontChain = buildBestChain(day, remaining, weightFn, {
        slot: chainStart.startSlot,
        locationId: chainStart.locationId,
      });
      if (frontChain.length === 0) return;
      const combined = [...frontChain, ...chain];
      if (dailyTravelCount(combined) > maxTravelsPerDay) return;
      if (
        maxTravelsPerWeek != null &&
        weeklyTravelUsedExcluding(day) + dailyTravelCount(combined) >
          maxTravelsPerWeek
      )
        return;
      frontChain.forEach((s) => {
        assigned.push(s);
        if (!memberDays.has(s.memberId)) memberDays.set(s.memberId, new Set());
        memberDays.get(s.memberId).add(day);
      });
      chainByDay.set(day, combined);
    }

    function fillDay(day, eligibleMemberIds, weightFn) {
      if ((chainByDay.get(day) || []).length > 0) {
        extendExistingChain(day, eligibleMemberIds);
        extendChainBackward(day, eligibleMemberIds, weightFn);
      } else {
        buildBestChain(day, eligibleMemberIds, weightFn).forEach((s) =>
          commit(day, s),
        );
      }
    }

    // "각 회원은 최대한 1회 이상의 스케줄을 가질 수 있도록" 단계에서 쓸 가중치.
    // 기본적으로 모든 회원을 동일하게 취급한다(한때 회원별 가중치를 뒀지만 "최소 1회는 다른
    // 조건보다 낮은 가중치여야 한다"는 결정에 따라 제거했다). repairUnassigned가 forceOnceMemberIds로
    // 지정한 회원의 첫 세션에만 예외적으로 압도적인 가중치를 준다(아래 참고).
    function fairnessWeight(memberId) {
      if (forceOnceMemberIds && forceOnceMemberIds.has(memberId)) {
        const usedDays = memberDays.get(memberId);
        if (!usedDays || usedDays.size === 0) return FORCE_ONCE_WEIGHT;
      }
      return 1;
    }

    // 확정(고정)된 세션이 있으면, 그 요일의 맨 앞부터 첫 확정 세션 앞까지의 빈 시간을 먼저
    // 체인으로 채운 뒤 확정 세션들을 시간순으로 커밋한다. 이후 1~3단계는 extendExistingChain으로
    // 가장 늦은 세션 뒤쪽을, extendChainBackward로 가장 이른 세션 앞쪽을 각각 채운다 —
    // 확정 세션이 여러 개인 날, 그 사이사이의 빈 시간까지 채우는 것은 지원하지 않는다(드문
    // 경우라 범위 밖으로 둔다). 확정 세션과 겹치거나 간격이 부족한 다른 신청은, 체인이 정확히
    // 맞물리는 항목만 잇는 구조상 애초에 선택되지 않는다.
    if (pinned.length > 0) {
      const pinsByDay = new Map();
      pinned.forEach((p) => {
        if (!pinsByDay.has(p.day)) pinsByDay.set(p.day, []);
        pinsByDay.get(p.day).push(p);
      });
      pinsByDay.forEach((dayPins, day) => {
        dayPins.sort((a, b) => a.startSlot - b.startSlot);
        const pinnedMemberIds = new Set(dayPins.map((p) => p.memberId));
        const beforeEligible = new Set(
          [...allMemberIdsForDay(day)].filter((id) => !pinnedMemberIds.has(id)),
        );
        const firstPin = dayPins[0];
        buildBestChain(day, beforeEligible, fairnessWeight, {
          slot: firstPin.startSlot,
          locationId: firstPin.locationId,
        }).forEach((s) => commit(day, s));
        dayPins.forEach((p) => commit(day, p));
      });
    }

    // 지정한 요일에는, 지정한 지점만으로 만들 수 있는 최대(가장 많이 배정되는) 체인을 1단계보다
    // 먼저 확정한다(strengthenCandidate가 모든 요일×지점 조합에 대해 이 옵션을 시도해본다).
    // 그 요일에 이미 확정(고정)된
    // 세션이 있으면 충돌을 피해 건드리지 않는다. 이후 1~3단계는 이 체인 뒤(extendExistingChain)와
    // 나머지 요일에서 평소처럼 진행되므로 "그 지점을 최대한 먼저 배정하고 나머지를 배정"이 된다.
    if (
      pinnedLocationDay &&
      !pinned.some((p) => p.day === pinnedLocationDay.day) &&
      (byDay.get(pinnedLocationDay.day) || []).length > 0
    ) {
      buildBestChain(
        pinnedLocationDay.day,
        allMemberIdsForDay(pinnedLocationDay.day),
        fairnessWeight,
        null,
        pinnedLocationDay.locationId,
      ).forEach((s) => commit(pinnedLocationDay.day, s));
    }

    // 1단계: 아직 아무 것도 못 받은 회원들만으로 요일별 체인을 새로 짠다. stage1Order가 그 순서를 정한다.
    // sessionCountFirst(후보B)이면 "아직 못 받은 회원만"이라는 제약을 두지 않는다 —
    // 인원(서로 다른 회원 수) 우선이 아니라 세션 총 개수 자체를 곧바로 최대화하기 위함이다.
    stage1Order.forEach((day) => {
      const elig = new Set(
        [...allMemberIdsForDay(day)].filter((id) => {
          if (!sessionCountFirst) {
            const usedDays = memberDays.get(id);
            if (usedDays && usedDays.size >= 1) return false;
          }
          return withinCaps(id, day);
        }),
      );
      fillDay(day, elig, fairnessWeight);
    });

    // 2단계: 남는 자리 중 연속된 요일이 아닌 곳부터 추가로 채운다.
    days.forEach((day) => {
      const elig = new Set(
        [...allMemberIdsForDay(day)].filter((id) => {
          if (!withinCaps(id, day)) return false;
          const usedDays = memberDays.get(id);
          if (usedDays && isAdjacentDay(day, usedDays)) return false;
          return true;
        }),
      );
      fillDay(day, elig);
    });

    // 3단계: 그래도 남는 자리는 연속 요일도 허용해 한도까지 채운다.
    days.forEach((day) => {
      const elig = new Set(
        [...allMemberIdsForDay(day)].filter((id) => withinCaps(id, day)),
      );
      fillDay(day, elig);
    });

    return assigned;
  }

  // 주어진 빈 시간 허용 한도(allowGapMin)로 배정을 한 번 완결한다. 기본은 요일 순서
  // 그대로 한 번 실행한다. 그 외에 두 가지 경로로 "1단계 요일 처리 순서를 바꾸면 더
  // 나아지는지"를 추가로 시도해볼 수 있다 — (1) minimizeUnassigned 옵션("후보A")이
  // 켜지면 "신청 가능한 회원이 적은(대안이 좁은) 요일부터 먼저 채우면 미배정이 줄어들
  // 것"이라는 고정된 가설을 항상 시도하고, (2) externalDayOrder가 주어지면(재생성 시도마다
  // 무작위로 섞은 순서 — searchStrategyPool/generateCandidatesAsync 참고) 그 순서도 함께
  // 시도한다. 요일을 순서대로 하나씩 확정해가는 구조상, 어떤 순서로 채우느냐에 따라 회원별
  // 주간 배정 횟수 상한 때문에 뒤 요일에서만 갈 곳이 있는 회원이 밀려날 수 있어 — 이 두
  // 경로 모두 "그 순서로 채웠을 때 실제로 배정 인원이 늘어나는지"를 겨냥한다. 시도한 결과들
  // 중 배정된 회원 수가 더 많은 쪽을 택한다(동점이면 총 세션 수가 많은 쪽, 그래도 동점이면
  // 먼저 나온 순서를 우선한다). 이 순서 바꾸기는 그 자체로 항상 더 나은 결과를 보장하는 게
  // 아니라(체인이 서로 얽혀 있으면 오히려 다른 요일의 체인을 갈라놓아 더 나빠질 수도 있다),
  // 그래서 직접 비교해 "적어도 기본 순서보다 나쁘지는 않은" 결과만 채택한다.
  function runWithGapPolicy(allowGapMin) {
    const naturalResult = runPass(days, allowGapMin);
    if (!minimizeUnassigned && !externalDayOrder) return naturalResult;

    let best = naturalResult;
    let bestMemberCount = new Set(best.map((r) => r.memberId)).size;
    function consider(order) {
      const attempt = runPass(order, allowGapMin);
      const attemptMemberCount = new Set(attempt.map((r) => r.memberId)).size;
      if (
        attemptMemberCount > bestMemberCount ||
        (attemptMemberCount === bestMemberCount && attempt.length > best.length)
      ) {
        best = attempt;
        bestMemberCount = attemptMemberCount;
      }
    }
    if (minimizeUnassigned) {
      consider(
        [...days].sort(
          (a, b) => allMemberIdsForDay(a).size - allMemberIdsForDay(b).size,
        ),
      );
    }
    if (externalDayOrder) {
      consider(externalDayOrder.filter((d) => byDay.has(d)));
    }
    return best;
  }

  // "이동시간·휴식시간을 제외한 빈 시간은 없도록" 엄격(allowGapMin=0)하게 한 번 배정해보고,
  // 빈 시간을 최대 ALLOWED_GAP_MIN분까지 허용했을 때 실제로 수업(세션) 개수가 늘어나는 경우에만
  // 완화된 결과를 쓴다 — 빈 시간 허용이 세션 수를 늘리지 못한다면(그저 같은 인원을 다르게
  // 배치할 뿐이라면) 빈 시간이 없는 엄격한 배정을 그대로 유지한다.
  const strictResult = runWithGapPolicy(0);
  const looseResult =
    ALLOWED_GAP_MIN > 0 ? runWithGapPolicy(ALLOWED_GAP_MIN) : strictResult;
  return looseResult.length > strictResult.length ? looseResult : strictResult;
}

export function totalTravelMinutes(assigned) {
  let total = 0;
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      total += travelMinutes(sorted[i - 1].locationId, sorted[i].locationId);
    }
  });
  return total;
}

// 이 후보의 한 주 전체에서 실제로 지점을 옮겨야 했던 횟수(요일별로 이동 시간이 0분보다
// 큰 전환만 센다 — dailyTravelCount와 같은 기준). "총 이동 n번" 배지에 쓴다.
export function totalTravelCount(assigned) {
  let total = 0;
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      if (travelMinutes(sorted[i - 1].locationId, sorted[i].locationId) > 0)
        total++;
    }
  });
  return total;
}

export function buildCandidate(
  title,
  desc,
  sortedReqs,
  eligibleSet,
  allMemberIds,
  options,
  pinned,
) {
  const assigned = greedyAssign(
    sortedReqs.filter((r) => eligibleSet.has(r.id)),
    options,
    pinned,
  );
  const assignedMemberIds = new Set(assigned.map((r) => r.memberId));
  const unassignedMembers = [...allMemberIds]
    .filter((id) => !assignedMemberIds.has(id))
    .map((id) => memberById(id))
    .filter(Boolean);
  return {
    title,
    desc,
    assigned,
    unassignedMembers,
    travelMinutes: totalTravelMinutes(assigned),
  };
}

// 각 전략은 "거의 동시에 경합하는" 신청들 사이에서 jitter 값으로 순서를 정한다.
// 시작 시각이 정확히 같은 신청끼리만 비교하면, 회원마다 서로 다른 시각을 신청한
// 실제 데이터에서는 동점이 거의 발생하지 않아 재생성을 눌러도 결과가 바뀌지 않는다.
// 그래서 시작 시각을 한 세션 길이(CONTENTION_BUCKET_SLOTS) 단위로 묶어, 같은 구간 안에서
// 겹칠 가능성이 있는 신청들은 모두 jitter로 순서를 섞은 뒤에야 실제 시작 시각으로 정렬한다.
// jitter가 전부 0이면 항상 같은 결과, 랜덤 값을 주면 그 전략 안에서 다른 배정을 시도해볼 수 있다 (후보별 재생성용).
export const CONTENTION_BUCKET_SLOTS = durationToSlots(SESSION_DURATION_MIN);

// 요일별로 하루씩 채운다는 전제 아래, "빨리 끝나는 신청부터" 채워나가는 순서를 모든 후보의
// 공통 뼈대로 쓴다. "이동시간, 휴식시간을 제외한 빈 시간은 없어야 하되, 세션 수가 늘어날
// 때만 최대 10분까지 예외로 허용" 조건을 지키려면 이 순서가 그리디 배정에서 빈 시간을 가장 적게 남긴다 —
// 지점별로 묶거나 회원 우선순위를 앞세우면 실제 시간 순서와 어긋나는 신청이 먼저 채워져
// 자리가 빈 채로 남는 경우가 생기기 때문. 요일을 항상 가장 먼저 비교해야 하는데, 그렇지
// 않으면 시간대만 이른 다른 요일 신청이 앞서 처리되면서 회원이 정작 필요한 요일 대신
// 엉뚱한 요일에 먼저 배정받아, 원래라면 채울 수 있었던 같은 날의 빈 시간을 놓치게 된다.
// 각 후보는 이 뼈대 위에서, 같은 요일·같은 버킷(끝나는 시각)의 신청들 사이의 동점 순서만
// 서로 다르게 정해 자신의 특성을 낸다.
export function reqEnd(r) {
  return r.startSlot + durationToSlots(r.duration);
}
export function endBucket(r) {
  return Math.floor(reqEnd(r) / CONTENTION_BUCKET_SLOTS);
}
// 네 후보 모두 같은 뼈대(요일 → 끝나는 시각 → jitter)로 정렬하고,
// 계산 기준(인원 최대화 → 이동 최소화)도 모두 같다. 지점별로 묶는 힌트는 여기 넣지 않는다 —
// 바로 위 경고대로 실제 시간 순서와 어긋나는 신청이 먼저 채워져 빈 시간이 남을 수 있다.
// (그런 "지점별로 묶기"가 필요하면 groupByLocation 옵션으로 buildBestChain의 체인 선택
// 단계에서만, 이미 완성된 동점 체인들 사이에서 고르게 한다 — 정렬 자체를 건드리지 않는다.)
// 후보B는 sessionCountFirst 옵션으로, 인원(서로 다른 회원 수)이 아니라 총 수업 건수 자체를
// 먼저 최대화한다. 후보A는 minimizeUnassigned 옵션으로, 기본 순서와 "대안이
// 좁은 요일부터 먼저 채우는" 순서를 둘 다 시도해보고 실제로 미배정 회원이 더 적은 쪽을 택한다.
export function defaultSort(eligible, jitter) {
  return [...eligible].sort(
    (a, b) =>
      a.day - b.day ||
      endBucket(a) - endBucket(b) ||
      jitter.get(a.id) - jitter.get(b.id) ||
      reqEnd(a) - reqEnd(b),
  );
}

// 표시 순서는 사용자가 지정한 순서를 그대로 따른다: A(기본, 미배정 없음 → 총 수업 건수 →
// 이동 횟수 순으로 비교하되, 신청 가능한 회원이 적은 요일부터 먼저 채우는 대안 순서도 함께
// 시도해보고 미배정이 더 적은 쪽을 택한다) → B(A와 같은 세 값을 비교하되 인원 대신 총 수업
// 건수를 먼저 최대화 → 인원(미배정 1명까지 허용) → 이동 횟수).
export const STRATEGIES = [
  {
    title: "후보A - 인원 최대",
    desc: "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다. (빈 시간 최소화)",
    // minimizeUnassigned: 기본 요일 순서로 한 번 배정해보고, 신청 가능한 회원이 적은
    // 요일부터 먼저 채우는 대안 순서로도 한 번 더 시도해본 뒤, 미배정 회원이 더 적은
    // 쪽(동점이면 총 세션 수가 많은 쪽)을 택한다 — 예전에는 이 대안 시도를 별도 후보(H)로
    // 분리해뒀지만, 대안이 기본 순서보다 나쁠 수는 없는 구조라(runWithGapPolicy 참고) 후보A
    // 자체에 통합했다. 분리해뒀을 때는 후보A와 후보H가 대부분 똑같거나, 다르면 항상 후보H가
    // 후보A보다 낫거나 같아서 후보A를 고를 이유가 없는 중복이었다.
    options: { strengthenSearch: "count", minimizeUnassigned: true },
    sort: defaultSort,
  },
  {
    title: "후보B - 수업 횟수 최대",
    desc: "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.",
    options: {
      sessionCountFirst: true,
      strengthenSearch: "sessions",
      maxUnassigned: 1,
    },
    sort: defaultSort,
  },
];

// 후보A/B는 스스로 정해둔 3단계 비교 순서(후보A: 인원 → 총 수업 건수 → 이동 횟수, 후보B:
// 총 수업 건수 → 인원 → 이동 횟수)를 내세우지만, 그리디 알고리즘은 요일을 처리하는 순서에
// 따라 이 기준으로도 최선이 아닌 결과를 낼 수 있다 — 실제로 특정 요일·지점을 먼저 채우면
// 우연히 더 나은 조합을 찾아내는 경우가 있었다. 그래서 모든 (요일, 지점) 조합을 "그 요일엔
// 그 지점부터 최대한 채운다"는 사전 단계로 하나씩 시도해보고, 그중 baseline보다 나은 결과가
// 있으면 그걸로 교체한다. 지점이 1개뿐이면 사전 단계를 시도할 의미가 없으므로 건너뛴다.
// primary가 "count"면 인원을 먼저 비교하고 그다음 총 수업 건수를(후보A), "sessions"면 총
// 수업 건수를 먼저 비교하고 그다음 인원을(후보B) 비교한다 — 어느 쪽이든 마지막은 이동 횟수다.
// 두 값 중 하나만 비교하면(예: 인원과 이동 횟수만) 그 사이에 있는 값(총 수업 건수 또는 인원)이
// 실제로는 누군가의 2번째 수업 자리를 희생해 이동을 줄인 것일 수 있어, 후보 제목이 내세우는
// 기준을 오히려 후퇴시킬 수 있다(실제로 28건 → 27건으로 줄어드는 문제가 있었다). 세 값을
// 모두, 선언한 순서 그대로 비교해 이런 후퇴를 막는다.
export function strengthenCandidate(
  baseline,
  sorted,
  eligibleIds,
  allMemberIds,
  options,
  pinned,
  primary,
) {
  // score/isBetter는 candidateSearchScore/isCandidateWorse와 같은 기준(options.maxUnassigned
  // 포함)을 써야 한다 — 여기서만 따로 계산하면 후보B의 "미배정 1명까지 허용" 상한이 이
  // 사전 강화 단계에서는 무시된 채 수업 건수만으로 골라버릴 수 있다.
  let best = baseline;
  let bestScore = candidateSearchScore(best, primary, options.maxUnassigned);
  function consider(opts) {
    const attempt = buildCandidate(
      baseline.title,
      baseline.desc,
      sorted,
      eligibleIds,
      allMemberIds,
      opts,
      pinned,
    );
    const attemptScore = candidateSearchScore(
      attempt,
      primary,
      options.maxUnassigned,
    );
    if (isCandidateWorse(bestScore, attemptScore)) {
      best = attempt;
      bestScore = attemptScore;
    }
  }

  // 요일별 1단계 처리 순서(sessionCountFirst)를 반대로 뒤집은 옵션도 함께 시도한다. 후보A
  // (count 우선)와 후보B(sessions 우선)는 이 옵션 하나만 다른데, 그리디 특성상 반대쪽
  // 순서가 스스로 내세운 기준(예: 후보A라면 인원이 동점일 때 총 수업 건수)에서 오히려 더
  // 나은 결과를 우연히 찾아내는 경우가 있다. 뒤집은 옵션에도 아래 day×지점 사전 배정을
  // 똑같이 시도해야, 상대 후보가 자기 자신을 강화할 때 찾아낸 조합까지 놓치지 않는다.
  const flippedOptions = Object.assign({}, options, {
    sessionCountFirst: !options.sessionCountFirst,
  });
  consider(flippedOptions);

  if (state.locations.length >= 2) {
    [options, flippedOptions].forEach((optsVariant) => {
      DAYS.forEach((d, day) => {
        state.locations.forEach((loc) => {
          consider(
            Object.assign({}, optsVariant, {
              pinnedLocationDay: { day, locationId: loc.id },
            }),
          );
        });
      });
    });
  }
  return best;
}

// 요일을 넘나드는 맞바꾸기 보완: greedyAssign은 요일을 정해진 순서로 하나씩 확정해가므로,
// "이 회원의 유일한 가능 시간이 이미 꽉 찬 다른 요일 체인과 이동 한도 때문에 부딪힌다 —
// 자리를 만들려면 같은 요일이 아니라 다른 요일의 누군가를 옮겨야 한다"는 조합은 그 요일
// 하나만 다시 짜서는(strengthenCandidate의 day×지점 사전 배정으로도) 찾을 수 없다. 아직
// 미배정인 회원이 있으면, 그 회원(들)에게 딱 1회만(greedyAssign의 forceOnceMemberIds 옵션 —
// 이미 1회를 받은 뒤에는 보통 가중치로 돌아간다) 압도적인 최우선 가중치를 줘서
// 처음부터 다시 배정해본다 — 그러면 그 회원이 껴야 하는 요일의 체인이 통째로 다시 짜이면서,
// DP가 그 요일 안에서 그 회원을 포함한 최선의 조합(다른 요일 배치는 그대로 둔 채)을 스스로
// 찾는다. 그 결과가 기존보다 못하지 않으면(=다른 회원을 더 잃는 트레이드가 아니면) 교체하고,
// 못하면 버린다 — 그래서 이 보완은 "적어도 기존보다 나쁘지 않을 때만" 적용된다.
// 먼저 미배정 회원 전원을 한꺼번에 강제해본다 — 두 회원의 자리가 서로 다른 요일에서 맞물려야
// 하는 조합(한 명은 월요일 체인을, 다른 한 명은 금요일 체인을 흔들어야 함)은 한 명씩
// 순서대로 시도하면 먼저 고정된 선택이 다음 사람의 최선을 막을 수 있어, 동시에 시도하는
// 편이 더 잘 맞물린 조합을 찾을 때가 많다. 그래도 남는 미배정 회원은 한 명씩 시도한다.
// 최대 6명까지만 시도해 미배정이 많은 경우에도 시간이 무한정 늘어나지 않게 한다.
export function repairUnassigned(
  baseline,
  sorted,
  eligibleIds,
  allMemberIds,
  options,
  pinned,
  primary,
) {
  let best = baseline;
  let bestScore = candidateSearchScore(best, primary, options.maxUnassigned);
  function tryForce(ids) {
    const forcedOptions = Object.assign({}, options, {
      forceOnceMemberIds: ids,
    });
    const attempt = buildCandidate(
      baseline.title,
      baseline.desc,
      sorted,
      eligibleIds,
      allMemberIds,
      forcedOptions,
      pinned,
    );
    const attemptScore = candidateSearchScore(
      attempt,
      primary,
      options.maxUnassigned,
    );
    if (!isCandidateWorse(attemptScore, bestScore)) {
      best = attempt;
      bestScore = attemptScore;
      return true;
    }
    return false;
  }
  if (
    baseline.unassignedMembers.length > 0 &&
    baseline.unassignedMembers.length <= 6
  ) {
    tryForce(baseline.unassignedMembers.map((m) => m.id));
  }
  const tried = new Set();
  let guard = 0;
  while (guard < 6) {
    guard++;
    const target = best.unassignedMembers.find((m) => !tried.has(m.id));
    if (!target) break;
    tried.add(target.id);
    tryForce([target.id]);
  }
  return best;
}

export function buildCandidateFromStrategy(
  strategyIndex,
  eligible,
  eligibleIds,
  allMemberIds,
  jitter,
  pinned,
  dayOrder,
) {
  const strategy = STRATEGIES[strategyIndex];
  const sorted = strategy.sort(eligible, jitter);
  const strategyOptions =
    typeof strategy.options === "function"
      ? strategy.options()
      : strategy.options;
  // dayOrder가 주어지면(재생성 탐색이 매 시도마다 무작위로 섞은 요일 순서 —
  // searchStrategyPool·generateCandidatesAsync 참고) greedyAssign의 stage1DayOrder로 넘겨,
  // 이번 시도에서 그 순서가 기본 순서보다 배정 인원을 늘리는지도 함께 비교하게 한다.
  const globalOptions = {};
  if (dayOrder) globalOptions.stage1DayOrder = dayOrder;
  const options = Object.assign({}, strategyOptions, globalOptions);
  let cand = buildCandidate(
    strategy.title,
    strategy.desc,
    sorted,
    eligibleIds,
    allMemberIds,
    options,
    pinned,
  );
  // strengthenSearch는 전략의 "이름"(배열 위치가 아니라)에 매인 명시적 플래그다 — 배열 순서가
  // 또 바뀌어도 엉뚱한 후보에 이 사전 탐색이 붙거나 빠지지 않도록.
  if (strategyOptions.strengthenSearch) {
    cand = strengthenCandidate(
      cand,
      sorted,
      eligibleIds,
      allMemberIds,
      options,
      pinned,
      strategyOptions.strengthenSearch,
    );
    if (cand.unassignedMembers.length > 0) {
      cand = repairUnassigned(
        cand,
        sorted,
        eligibleIds,
        allMemberIds,
        options,
        pinned,
        strategyOptions.strengthenSearch,
      );
    }
  }
  cand.strategyIndex = strategyIndex;
  return cand;
}

// 후보 비교 우선순위: 기본은 인원(미배정 최소화) → 총 수업 건수 → 이동 횟수 — "후보 조건"이
// 내세우는 순서 그대로다. 다만 후보B는 스스로 "총 수업 횟수 → 인원 최대화 → 이동 횟수"를
// 내세우므로(strengthenSearch: "sessions"), primary가 "sessions"면 순서를 뒤집는다 — 그래야
// 후보B가 인원 대신 수업 건수를 우선하는 자기만의 트레이드오프를 실제로 보여줄 수 있다(안
// 그러면 항상 인원 기준으로만 비교돼 후보A와 사실상 같은 결과로 수렴해버린다). 처음 생성할
// 때 더 나은 조합을 찾을 때(generateCandidates)와, 재생성 시 지금보다 못한 결과로 후퇴하지
// 않게 막을 때(regenerateCandidate) 공통으로 쓴다 — 항상 그 후보 자신의 primary로 비교해야
// 한다.
// maxUnassigned가 주어지면(후보B의 "미배정 1명까지 허용") 그 상한을 지키는지 여부를 다른 무엇
// 보다도 먼저 비교한다 — 안 그러면 "수업 건수 최대화"가 항상 이겨서, 상한을 어기고서라도
// 수업 건수가 더 많은 조합을 골라버려(예: 미배정 2명) 후보 설명이 내세우는 상한이 지켜지지
// 않는다(실제로 이 문제가 있었다). 상한을 지키는 조합이 아예 없을 때만(둘 다 위반) 그 아래
// 기준으로 비교한다.
export function candidateSearchScore(cand, primary, maxUnassigned) {
  const count = new Set(cand.assigned.map((r) => r.memberId)).size;
  const sessions = cand.assigned.length;
  const travel = totalTravelCount(cand.assigned);
  const capOk =
    typeof maxUnassigned === "number" &&
    cand.unassignedMembers.length > maxUnassigned
      ? 0
      : 1;
  const base =
    primary === "sessions"
      ? [sessions, count, travel]
      : [count, sessions, travel];
  return [capOk, base[0], base[1], base[2]];
}
export function isCandidateWorse(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  if (a[2] !== b[2]) return a[2] < b[2];
  return a[3] > b[3];
}
// 두 candidateSearchScore 튜플이 완전히 동점인지("배치 페이저"용 — 미배정/수업 건수/이동
// 횟수까지 전부 같아 카드 pill 표시가 동일한 경우만 같은 풀로 묶는다).
export function isCandidateScoreTie(a, b) {
  return !isCandidateWorse(a, b) && !isCandidateWorse(b, a);
}
// strategyIndex의 STRATEGIES 정의에서 primary("count" 기본 / "sessions")를 읽어온다.
// options가 함수(후보I/J)면 strengthenSearch를 쓰지 않으므로 항상 기본값이다.
export function strategyPrimary(strategyIndex) {
  const options = STRATEGIES[strategyIndex].options;
  const strategyOptions = typeof options === "function" ? {} : options;
  return strategyOptions.strengthenSearch === "sessions" ? "sessions" : "count";
}
// strategyIndex의 STRATEGIES 정의에서 maxUnassigned(미배정 허용 상한, 없으면 null)를 읽어온다.
export function strategyMaxUnassigned(strategyIndex) {
  const options = STRATEGIES[strategyIndex].options;
  const strategyOptions = typeof options === "function" ? {} : options;
  return typeof strategyOptions.maxUnassigned === "number"
    ? strategyOptions.maxUnassigned
    : null;
}

// 시드 기반 의사난수: 초기 생성 시에도 여러 조합을 탐색해 그중 최선을 보여주되, 같은
// 데이터라면 "후보 생성하기"를 몇 번을 눌러도 항상 같은 결과가 나오도록(재현 가능하도록)
// Math.random() 대신 고정 시드로 만든 난수열을 쓴다.
export function makeSeededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1단계 요일 처리 순서도 tie-break jitter와 같은 자리에서 탐색 대상으로 삼는다: 요일을 정해진
// 순서로 하나씩 확정해가는 구조상, 앞선 요일에서 그럴듯한 조합을 먼저 확정해버리면 회원별
// 주간 배정 횟수 상한 때문에 뒤 요일에서만 갈 곳이 있는 회원의 자리를 못 만드는 경우가 있다
// (기본 순서·minimizeUnassigned의 "대안이 좁은 요일부터" 순서만으로는 못 찾는 조합). randomFn으로
// 매 시도마다 요일 순서를 섞어 greedyAssign의 stage1DayOrder로 넘기면, runWithGapPolicy가 그
// 순서도 기본 순서와 비교해 실제로 나을 때만 채택한다 — jitter와 마찬가지로 같은 시드면 항상
// 같은 순서열이 나와 재현 가능하다.
export function shuffledDayOrder(randomFn) {
  const order = DAYS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

// 무거운 동기 계산 중간에 브라우저가 화면을 다시 그릴 틈을 준다(로딩 스피너·진행률 갱신용).
// 탭이 백그라운드로 가면(다른 탭/앱으로 이동, 화면 잠금 등) requestAnimationFrame 콜백은
// 브라우저가 아예 실행하지 않으므로, 그때는 setTimeout만으로 양보해 생성이 멈추지 않고
// (다소 느려지더라도) 계속 진행되게 한다.
export function yieldToUI() {
  if (document.hidden) {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  return new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0)),
  );
}
// yieldToUI로 화면에 제어권을 넘긴 직후에만 "취소" 버튼 클릭이 실제로 처리됐을 수 있으므로,
// 그 직후마다 이걸 호출해 취소 여부를 확인한다.
export function checkGenerationCancelled() {
  if (runtime.generationCancelRequested) throw new GenerationCancelledError();
}
export const PROGRESS_YIELD_EVERY = 5; // 이만큼 조합을 만들 때마다 한 번씩 진행률을 갱신하고 화면을 그린다

// 전략 하나를 zeroJitter 포함 (attempts + 1)가지 조합으로 시도해 그 전체 목록(풀)을 그대로
// 돌려준다 — 예전에는 여기서 최선 하나만 골라 나머지를 버렸는데(searchBestCandidateForStrategy),
// 그러면 "다음 후보"가 이 계산을 다 해놓고도 아직 못 본 조합을 찾을 때는 별도로 딱
// REGEN_MAX_ATTEMPTS(10)번만 새로 시도해야 했다 — 이미 만들어둔 (attempts+1)개 중에는
// "아직 못 봤고 지금 화면보다 못하지 않은" 조합이 있어도 그냥 버려졌으므로, 재생성이 실제보다
// 훨씬 쉽게 "더 나은 후보지를 찾지 못했습니다"로 포기해버리는 문제가 있었다. 풀 전체를
// 돌려주면 regenerateCandidate가 이 목록 안에서 직접 찾아, 추가 계산 없이 훨씬 많은 후보
// 중에서 고를 수 있다. randomFn으로 재현 가능한 시드 난수(makeSeededRandom)를 넘기면 항상
// 같은 결과가, Math.random을 넘기면 매번 다를 수 있는 결과가 나온다. onProgress(0~1)를 넘기면
// 중간중간 진행률을 알려주면서 화면을 그릴 틈도 준다.
export async function searchStrategyPool(
  strategyIndex,
  eligible,
  eligibleIds,
  allMemberIds,
  pinned,
  attempts,
  randomFn,
  onProgress,
) {
  const zeroJitter = new Map(eligible.map((r) => [r.id, 0]));
  const pool = [
    buildCandidateFromStrategy(
      strategyIndex,
      eligible,
      eligibleIds,
      allMemberIds,
      zeroJitter,
      pinned,
    ),
  ];
  for (let i = 0; i < attempts; i++) {
    const jitter = new Map(eligible.map((r) => [r.id, randomFn()]));
    const dayOrder = shuffledDayOrder(randomFn);
    pool.push(
      buildCandidateFromStrategy(
        strategyIndex,
        eligible,
        eligibleIds,
        allMemberIds,
        jitter,
        pinned,
        dayOrder,
      ),
    );
    if (onProgress && (i + 1) % PROGRESS_YIELD_EVERY === 0) {
      onProgress((i + 1) / (attempts + 1));
      await yieldToUI();
    }
  }
  if (onProgress) onProgress(1);
  return pool;
}
// "후보 생성하기" 시 전략당 추가로 시도해볼 조합 수. generateCandidatesAsync는 모든 전략의
// 시도 결과를 하나의 공용 풀에 합치고(아래 pool 관련 주석 참고) 각 후보는 자기 기준으로 그
// 풀 전체에서 최선을 고른다. 153회로는 실제 데이터에서 찾을 수 있는 조합(예: 미배정 0명을
// 지키면서 수업 28건)을 못 찾고 26건에 머무는 경우가 있었고, 실측 결과 600회는 넘어야 그
// 조합을 안정적으로 찾았다 — 여유를 두어 1000회로 늘렸다(약 10분 소요, 생성3는 페이지를
// 이동해도 백그라운드에서 계속 진행되므로 결과를 기다리는 동안 다른 메뉴를 써도 된다).
export const INITIAL_SEARCH_ATTEMPTS = 1000;
// "다음 후보" 시 전략당 추가로 시도해볼 조합 수. regenerateCandidate는 (generateCandidatesAsync와
// 달리) searchStrategyPool로 그 전략 하나만의 풀을 새로 만들어 쓰므로 다른 전략 수의 영향을
// 받지 않는다 — 초기 생성과 다른 값을 쓸 수 있도록 별도로 둔 것뿐이다.
export const REGENERATE_SEARCH_ATTEMPTS = 25;

// strategyIndex별로 "이미 보여준 배정 결과"를 기록해, 재생성 시 똑같은 조합이 다시 나오는지
// 판별한다. 배정 결과(assigned)를 이루는 신청 id 집합을 그대로 서명으로 쓴다 — 같은
// 신청 조합이면 같은 서명이 나온다. (페이지를 새로고침하면 초기화되는 세션 한정 기록.)
export const candidateHistory = {}; // strategyIndex -> Set(signature)
// strategyIndex별로, 재생성으로 덮어쓰기 전의 이전 후보를 순서대로 쌓아둔다 — "이전 후보
// 다시보기" 버튼으로 되돌아갈 수 있게(여러 번 재생성했으면 여러 단계 되돌아갈 수 있다).
// candidateHistory와 마찬가지로 새로고침하면 초기화되는 세션 한정 기록.
export const candidateUndoStack = {}; // strategyIndex -> Candidate[]

// "배치 페이저"용: 미배정/수업 건수/이동 횟수(후보A는 이동 시간·빈 시간까지) 지표가 완전히
// 동점인 배치를 최대 이만큼만 서로 다른 배정(서명 기준)으로 모아둔다 — 화면이 지저분해지지
// 않게 상한을 둔다.
export const MAX_POOL_VARIANTS = 9;
// 후보A 다듬기(이동 횟수 vs 빈 시간 트레이드오프)에서 "이동 1번을 줄이는 대가로 받아들일
// 수 있는 빈 시간 증가"의 상한(분). 이보다 더 큰 빈 시간을 대가로 이동을 줄이는 배치는
// 채택하지 않는다 — 이동 1번의 가치를 최대 이 값만큼으로만 쳐준다는 뜻.
export const TRAVEL_VALUE_MINUTES = 60;
// strategyIndex별 동점 배치 풀(후보B/C). runtime.candidates[strategyIndex]는 항상 이 풀의 한 항목과
// 같은 객체 참조를 가리킨다 — 페이저가 pool.indexOf(현재 후보)로 현재 위치를 찾기 때문이다.
// candidateHistory와 마찬가지로 저장하지 않는 세션 한정 기록(새로고침하면 초기화).
export const candidatePools = {}; // strategyIndex -> Candidate[]
// 후보A-1/A-2/A-3(체인 DP) 카드별 동점 배치 풀. schedule3Result.candidateAList[i]는 항상
// candidateAPools[i]의 한 항목과 같은 객체 참조를 가리킨다. 세션 한정 기록.
export const candidateAPools = {}; // 카드 인덱스(0/1/2) -> Candidate[]

// 위 네 기록을 모두 비운다("전체 재생성" 등 지금까지의 재생성/되돌리기 이력이 더 이상
// 유효하지 않을 때 호출). 호출부(schedule3.js 등)가 각자 Object.keys(...).forEach(delete)로
// 직접 비우면 이 네 기록이 정확히 어떤 세트인지가 엔진 밖 여러 곳에 흩어져 있어야 해서,
// 하나를 추가/제거할 때 어느 한 곳을 빠뜨리기 쉽다 — 이 함수로 한곳에 모아둔다.
export function resetCandidateSession() {
  Object.keys(candidateHistory).forEach((k) => delete candidateHistory[k]);
  Object.keys(candidateUndoStack).forEach((k) => delete candidateUndoStack[k]);
  Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
  Object.keys(candidateAPools).forEach((k) => delete candidateAPools[k]);
}

export function candidateSignature(cand) {
  return cand.assigned
    .map((r) => r.id)
    .slice()
    .sort()
    .join(",");
}

// onProgress(0~1)를 주기적으로 호출해가며 진행률을 알려준다. 실제로 몇 개를 만들었는지를
// 세는 "진짜" 진행률이라, 회원 수·기기 성능과 상관없이 항상 정확하다(타이머로 흉내낸
// 가짜 진행바가 아니다).
export async function generateCandidatesAsync(onProgress) {
  // "미배정 회원"으로 지정된 회원은 애초에 없었던 것처럼 취급한다 — 배정 대상에서도,
  // (배정 실패가 아니라 의도적 제외이므로) 미배정 통계에서도 뺀다.
  const allMemberIds = new Set(
    state.requests
      .filter((r) => !currentExcludedIds().includes(r.memberId))
      .map((r) => r.memberId),
  );
  const eligible = state.requests.filter(isEligibleRequest);
  const eligibleIds = new Set(eligible.map((r) => r.id));

  // 그리디 배정은 동점 신청들을 처리하는 순서(jitter)뿐 아니라, 전략마다 회원을 채워나가는
  // 구조 자체(예: 후보B의 sessionCountFirst)가 달라서, 같은 횟수를 시도해도 어떤 전략은
  // 찾아내는 조합을 다른 전략은 구조적으로 못 찾을 수 있다. 그렇다고 "각 전략의 최종 결과"만
  // 서로 비교해 빌려주면(예전 방식), 정작 그 좋은 조합을 찾아낸 전략 자신이 자기 기준(예:
  // 후보B의 수업 건수 우선)에서는 그게 최선이 아니라고 판단해 다른 조합으로 갈아타 버릴 수
  // 있고, 그러면 그 좋은 조합은 어느 전략에도 안 남는다(실제로 이 문제가 있었다).
  // 그래서 전략마다 만든 시도들(zeroJitter + 시드 난수 여러 개)을 하나의 공통 풀에 모아두고,
  // 각 전략은 자기 것이든 남의 것이든 상관없이 이 풀 전체에서 "자기 기준"(primary)으로 최선을
  // 고른다. 이러면 어떤 전략의 탐색이 우연히 찾아낸 좋은 조합을, 그 조합이 실제로 더 잘
  // 맞는 다른 전략이 가져가 보여줄 수 있다. 일주일 총 이동 횟수 상한(maxTravelsPerWeek)이
  // 있는 전략은 그 상한을 지키는 시도만 고를 수 있다(상한 없는 전략의 결과를 그대로 가져오면
  // 그 전략의 조건을 어길 수 있으므로). 시드가 고정돼 있어 같은 데이터라면 "후보 생성하기"를
  // 몇 번 눌러도 항상 같은 결과가 나온다(재현 가능).
  const pool = [];
  const totalBuilds = STRATEGIES.length * (INITIAL_SEARCH_ATTEMPTS + 1);
  let completed = 0;
  for (let idx = 0; idx < STRATEGIES.length; idx++) {
    const rand = makeSeededRandom(idx + 1);
    const zeroJitter = new Map(eligible.map((r) => [r.id, 0]));
    pool.push(
      buildCandidateFromStrategy(
        idx,
        eligible,
        eligibleIds,
        allMemberIds,
        zeroJitter,
        [],
      ),
    );
    completed++;
    for (let i = 0; i < INITIAL_SEARCH_ATTEMPTS; i++) {
      const jitter = new Map(eligible.map((r) => [r.id, rand()]));
      const dayOrder = shuffledDayOrder(rand);
      pool.push(
        buildCandidateFromStrategy(
          idx,
          eligible,
          eligibleIds,
          allMemberIds,
          jitter,
          [],
          dayOrder,
        ),
      );
      completed++;
      if (completed % PROGRESS_YIELD_EVERY === 0) {
        onProgress(completed / totalBuilds);
        await yieldToUI();
      }
    }
  }
  onProgress(1);

  const builtPairs = STRATEGIES.map((strategy, idx) => {
    const myPrimary = strategyPrimary(idx);
    const strategyOptions = strategy.options;
    const myWeeklyCap =
      strategyOptions &&
      typeof strategyOptions !== "function" &&
      typeof strategyOptions.maxTravelsPerWeek === "number"
        ? strategyOptions.maxTravelsPerWeek
        : null;
    const myMaxUnassigned = strategyMaxUnassigned(idx);
    let best = null;
    let bestScore = null;
    pool.forEach((cand) => {
      if (myWeeklyCap != null && totalTravelCount(cand.assigned) > myWeeklyCap)
        return;
      const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
      if (!best || isCandidateWorse(bestScore, score)) {
        best = cand;
        bestScore = score;
      }
    });
    const builtCand = Object.assign({}, best, {
      title: strategy.title,
      desc: strategy.desc,
      strategyIndex: idx,
    });
    // 동점 배치 풀: best와 점수가 완전히 같은 항목들을 서명 중복 제거해 모은다. best 자신은
    // builtCand(같은 배정에 title/desc/strategyIndex만 덧붙인 새 객체)로 바꿔 넣어야, 카드가
    // 참조하는 runtime.candidates[idx]와 풀 안의 항목이 같은 객체가 되어 페이저의
    // pool.indexOf(현재 후보) 판별이 성립한다.
    const tied = [];
    const seenSig = new Set();
    pool.forEach((cand) => {
      if (myWeeklyCap != null && totalTravelCount(cand.assigned) > myWeeklyCap)
        return;
      const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
      if (!isCandidateScoreTie(score, bestScore)) return;
      const sig = candidateSignature(cand);
      if (seenSig.has(sig)) return;
      seenSig.add(sig);
      if (tied.length < MAX_POOL_VARIANTS)
        tied.push(cand === best ? builtCand : cand);
    });
    // 캡에 먼저 도달하면 builtCand(best) 자신이 못 들어갈 수 있다 — best는 정의상
    // 항상 자기 자신과 동점이므로, 페이저가 현재 위치를 찾으려면 반드시 pool에 있어야 한다.
    if (!tied.includes(builtCand)) {
      if (tied.length >= MAX_POOL_VARIANTS) tied.length = MAX_POOL_VARIANTS - 1;
      tied.unshift(builtCand);
    }
    return { builtCand, tied };
  });

  return {
    built: builtPairs.map((p) => p.builtCand),
    pools: builtPairs.map((p) => p.tied),
  };
}

// 후보 카드 하나만 같은 전략 안에서 다시 계산한다 (동점인 신청들의 순서를 랜덤으로 바꿔 다른 배정을 시도).
// 확정된 세션이 있으면 그대로 고정하고, 나머지 신청들 안에서만 다시 배정한다.
// 이번 풀(REGENERATE_SEARCH_ATTEMPTS+1개) 안에 이미 봤던 조합밖에 없으면, 처음 후보로
// 되돌릴지 사용자에게 물어본다.
// "다음 후보 보기" 버튼을 켤지 판단한다: 확정(고정)된 세션을 뺀 나머지 신청이 하나도
// 없으면 다시 계산해봐야 항상 같은(빈) 결과라 "다음 후보"라 부를 게 없다.
export function hasRegenerableEligible(strategyIndex) {
  const prevCand = runtime.candidates[strategyIndex];
  const confirmedIds = new Set((prevCand && prevCand.confirmedIds) || []);
  const pinnedIds = new Set(
    (prevCand
      ? prevCand.assigned.filter((r) => confirmedIds.has(r.id))
      : []
    ).map((r) => r.id),
  );
  return state.requests.some(
    (r) => isEligibleRequest(r) && !pinnedIds.has(r.id),
  );
}

// onDone: 재생성이 끝나 화면을 다시 그려야 할 때 호출부가 넘겨주는 콜백(항상 명시적으로
// 넘겨받는다 — chainDp.js의 schedule2ToBlocks 등과 같은 관례. 엔진이 페이지 렌더 함수를
// 직접 import하면 페이지 ↔ 엔진 순환 의존이 생기므로 피한다).
export async function regenerateCandidate(strategyIndex, onProgress, onDone) {
  const prevCand = runtime.candidates[strategyIndex];
  if (!candidateHistory[strategyIndex]) {
    candidateHistory[strategyIndex] = new Set(
      prevCand ? [candidateSignature(prevCand)] : [],
    );
  }
  const seen = candidateHistory[strategyIndex];
  const confirmedIds = new Set((prevCand && prevCand.confirmedIds) || []);
  const pinned = prevCand
    ? prevCand.assigned.filter((r) => confirmedIds.has(r.id))
    : [];
  const pinnedIds = new Set(pinned.map((r) => r.id));
  // "미배정 회원"으로 지정된 회원은 배정 대상·미배정 통계 모두에서 뺀다(단, 이미 확정된
  // 세션은 그대로 유지된다 — 확정은 다른 설정보다 항상 우선한다).
  const allMemberIds = new Set(
    state.requests
      .filter(
        (r) =>
          pinnedIds.has(r.id) || !currentExcludedIds().includes(r.memberId),
      )
      .map((r) => r.memberId),
  );
  const eligible = state.requests.filter(
    (r) => isEligibleRequest(r) && !pinnedIds.has(r.id),
  );
  const eligibleIds = new Set(eligible.map((r) => r.id));

  // 재생성은 "다른 배치를 보여주는 것"이 목적이지, "후보 조건"의 우선순위(인원 최대화 →
  // 수업 건수 → 이동 횟수 최소화)보다 못한 결과로 후퇴하는 것은 아니다. 최소 허용선은
  // 기준(jitter 0) 결과 하나만이 아니라, 지금 화면에 이미 표시된 후보(prevCand)와 비교해도
  // 정해야 한다 — prevCand는 (운 좋은 jitter나 사전 탐색으로) 기준보다 이미 더 나은 상태일
  // 수 있는데, 기준만 최소 허용선으로 삼으면 "지금 보고 있는 것보다 못한" 결과도 통과해
  // 버린다(실제로 미배정 인원은 그대로인데 수업 건수만 줄어든 후보가 표시되는 문제가 있었다).
  // 그래서 둘 중 더 나은 쪽을 최소 허용선으로 삼고, 인원 → 수업 건수 → 이동 횟수 순으로,
  // 그보다 못한 시도는 아무리 새로운 조합이어도 버린다. baseline 자체도 (초기 생성과 같은
  // 방식으로) 시드 없이 여러 조합을 미리 시도해 최선을 찾아둔다 — 그래야 floor가 지나치게
  // 낮게 잡혀 있다가 낮은 결과를 새 것으로 오인해 받아들이는 일이 없다.
  // 비교는 이 전략 자신의 primary로 해야 한다 — 그래야 후보B가 "다음 후보"를 눌러도
  // 인원 기준으로 강제되지 않고, 자기가 내세우는 수업 건수 우선 트레이드오프를 유지한다.
  const myPrimary = strategyPrimary(strategyIndex);
  const myMaxUnassigned = strategyMaxUnassigned(strategyIndex);
  const pool = await searchStrategyPool(
    strategyIndex,
    eligible,
    eligibleIds,
    allMemberIds,
    pinned,
    REGENERATE_SEARCH_ATTEMPTS,
    Math.random,
    onProgress,
  );
  let baseline = pool[0];
  let baselineScore = candidateSearchScore(
    baseline,
    myPrimary,
    myMaxUnassigned,
  );
  pool.forEach((cand) => {
    const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
    if (isCandidateWorse(baselineScore, score)) {
      baseline = cand;
      baselineScore = score;
    }
  });
  // floorCand: baseline과 prevCand 중 더 나은 쪽. "새로운 조합을 못 찾았을 때"도 이 값으로
  // 돌아가야지, baseline으로 그냥 되돌리면 prevCand보다 못한 결과가 화면에 나타날 수 있다
  // (아래 !newCand 분기 참고) — "다음 후보"를 반복 클릭했을 때 수업 건수가 오르내리며
  // 들쭉날쭉해 보이는 문제가 바로 이 지점에서 나고 있었다.
  const floorCand =
    prevCand &&
    isCandidateWorse(
      baselineScore,
      candidateSearchScore(prevCand, myPrimary, myMaxUnassigned),
    )
      ? prevCand
      : baseline;
  const floorScore = candidateSearchScore(
    floorCand,
    myPrimary,
    myMaxUnassigned,
  );

  // 방금 만든 풀(pool) 안에서, 아직 못 본 조합 중 최소 허용선(floor) 이상인 것 중 가장 좋은
  // 것을 고른다 — 별도로 다시 시도하지 않고 이미 계산해둔 (attempts+1)개를 그대로 훑으므로,
  // 추가 계산 없이 예전(REGEN_MAX_ATTEMPTS=10개만 별도 시도)보다 훨씬 많은 후보 중에서 고를
  // 수 있다.
  let newCand = null;
  let newScore = null;
  pool.forEach((cand) => {
    const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
    if (isCandidateWorse(score, floorScore)) return; // 최소 허용선보다 못하면 버린다
    const sig = candidateSignature(cand);
    if (seen.has(sig)) return;
    if (!newCand || isCandidateWorse(newScore, score)) {
      newCand = cand;
      newScore = score;
    }
  });
  if (newCand) seen.add(candidateSignature(newCand));

  if (!newCand) {
    // 더 나은 조합을 못 찾았을 때도 사용자에게 묻지 않고, 지금까지 본 조합 기록을 지우고
    // 자동으로 다시 찾는다(다음 클릭 때 새 조합을 탐색할 수 있도록).
    newCand = floorCand; // baseline이 아니라 floorCand — 지금 보다 못한 결과로 되돌리지 않는다.
    candidateHistory[strategyIndex] = new Set([candidateSignature(newCand)]);
    newCand.confirmedIds = [...confirmedIds];
    if (prevCand && prevCand !== newCand) {
      if (!candidateUndoStack[strategyIndex])
        candidateUndoStack[strategyIndex] = [];
      candidateUndoStack[strategyIndex].push(prevCand);
    }
    runtime.candidates[strategyIndex] = newCand;
    saveState();
    onDone();
    showToast("더 나은 조합을 찾지 못해 다시 탐색합니다", "info");
    return;
  }

  newCand.confirmedIds = [...confirmedIds];
  // 배치 페이저용: newCand와 완전히 동점인 배치를 모아 풀로 저장한다. 재생성은 확정된 세션을
  // 고정한 채 탐색하므로(pinned), 풀의 모든 항목에 같은 confirmedIds를 설정해야 페이저로
  // 넘나들어도 확정 표시가 유지된다. newCand 자신과 서명이 같은 자리는 (같은 배정을 만든
  // 다른 시도 객체가 아니라) newCand 참조 그대로 넣어야 페이저의 pool.indexOf(현재 후보)
  // 판별이 성립한다.
  {
    const newCandSig = candidateSignature(newCand);
    const tied = [];
    const seenTieSig = new Set();
    pool.forEach((cand) => {
      const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
      if (!isCandidateScoreTie(score, newScore)) return;
      const sig = candidateSignature(cand);
      if (seenTieSig.has(sig)) return;
      seenTieSig.add(sig);
      const entry = sig === newCandSig ? newCand : cand;
      entry.confirmedIds = [...confirmedIds];
      if (tied.length < MAX_POOL_VARIANTS) tied.push(entry);
    });
    // 캡에 먼저 도달하면 newCand 자신이 못 들어갈 수 있다 — newCand는 정의상 항상
    // 자기 자신과 동점이므로, 페이저가 현재 위치를 찾으려면 반드시 pool에 있어야 한다.
    if (!tied.includes(newCand)) {
      if (tied.length >= MAX_POOL_VARIANTS) tied.length = MAX_POOL_VARIANTS - 1;
      tied.unshift(newCand);
    }
    candidatePools[strategyIndex] = tied;
  }
  if (prevCand) {
    if (!candidateUndoStack[strategyIndex])
      candidateUndoStack[strategyIndex] = [];
    candidateUndoStack[strategyIndex].push(prevCand);
  }
  runtime.candidates[strategyIndex] = newCand;
  saveState();
  onDone();
  showToast("후보가 재생성되었습니다", "success");
}

// "이전 후보 다시보기": 재생성으로 덮어쓰기 전의 후보로 되돌아간다(여러 번 눌러 여러 단계
// 되돌아갈 수 있음). 되돌아간 후보를 다시 재생성하면, 그 시점부터 새 이력이 쌓인다.
// onDone: regenerateCandidate와 같은 이유로 호출부가 명시적으로 넘겨준다.
export function restorePreviousCandidate(strategyIndex, onDone) {
  const stack = candidateUndoStack[strategyIndex];
  if (!stack || stack.length === 0) return;
  runtime.candidates[strategyIndex] = stack.pop();
  saveState();
  onDone();
  showToast("이전 후보로 되돌아갔습니다", "info");
}
