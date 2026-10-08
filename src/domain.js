import { state } from "./state.js";
import {
  CONSULT_DURATION_MIN,
  SESSION_DURATION_MIN,
  MAX_SESSIONS_PER_MEMBER,
  SOLO_TRAVEL_LOCATION_NAMES,
  INEFFICIENT_ROUNDTRIP_LOCATION_NAMES,
  BLOCK_COLOR,
  MEMBER_COLORS,
  MEMBER_COLOR_SHADE_STEPS,
  shadeColor,
} from "./constants.js";
import {
  currentExcludedIds,
  currentOnceLimitIds,
} from "./selectionOverride.js";

// 생성 엔진이 신청·노드마다 아주 많이 부르므로 id → 배열 위치 색인을 둔다. 회원 목록은
// 추가(unshift)·삭제(filter 재할당) 등 어떤 식으로든 바뀔 수 있으므로 색인을 믿지 않고, 찾은
// 위치의 회원 id가 실제로 같은지 매번 확인한다 — 다르거나 색인에 없으면 원래대로 배열을 훑고,
// 찾았으면 색인을 다시 만든다. 그래서 결과는 항상 state.members.find와 같다.
let memberPosIndex = { list: null, posById: new Map() };
export function memberById(id) {
  const list = state.members;
  if (memberPosIndex.list === list) {
    const pos = memberPosIndex.posById.get(id);
    const m = pos === undefined ? undefined : list[pos];
    if (m && m.id === id) return m;
  }
  const found = list.find((m) => m.id === id);
  if (found) {
    const posById = new Map();
    list.forEach((m, i) => {
      if (m && !posById.has(m.id)) posById.set(m.id, i);
    });
    memberPosIndex = { list, posById };
  }
  return found;
}

// 현재 등록된 지점 id 집합. 후보 지점 계산이 신청마다 불려 매번 Set을 새로 만들던 비용을
// 없애려고 캐시하되, 지점은 몇 개뿐이라 호출마다 id 목록이 그대로인지 전부 확인한다(지점
// 추가·삭제·교체 어느 경우든 바로 다시 만든다).
let knownLocationCache = { ids: [], set: new Set() };
export function knownLocationIdSet() {
  const list = state.locations;
  const ids = knownLocationCache.ids;
  let same = ids.length === list.length;
  for (let i = 0; same && i < list.length; i++) same = list[i].id === ids[i];
  if (!same) {
    const nextIds = list.map((l) => l.id);
    knownLocationCache = { ids: nextIds, set: new Set(nextIds) };
  }
  return knownLocationCache.set;
}

// 상담 회원은 확보 시간이 짧다(30분) — 그 외(등록 회원)는 기본 수업 시간(60분).
// 구분이 비어있으면 상담으로 취급한다(다른 곳의 기본값과 동일). 회원을 못 찾은 경우(member가
// null/undefined, 예: 신청은 남아있는데 회원이 삭제된 경우)도 같은 이유로 상담 취급한다 —
// maxSessionsFor의 null 처리(최대 1회)와 일관되게, 가장 보수적인 값을 준다.
export function sessionDurationFor(member) {
  if (!member) return CONSULT_DURATION_MIN;
  return (member.category || "상담") === "상담"
    ? CONSULT_DURATION_MIN
    : SESSION_DURATION_MIN;
}

// 상담 회원은 최대 1회까지만, 그 외(등록 회원)는 최대 MAX_SESSIONS_PER_MEMBER(2)회까지.
// "1회 제한 회원"으로 지정된 회원은 구분과 무관하게 최대 1회로 제한된다.
export function maxSessionsFor(member) {
  if (!member) return 1;
  if (currentOnceLimitIds().includes(member.id)) return 1;
  return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
}

// 상담 회원은 이미 항상 최대 1회로 제한되므로(위 규칙), "1회 제한 회원" 목록에는 표시하지 않는다.
export function isOnceLimitEligible(member) {
  return !!member && (member.category || "상담") !== "상담";
}

// "회원 스케줄 추가" 페이지의 회원 탭과 같은 방식: 지점은 풀네임 대신 한 글자 배지(전체
// 이름은 title 툴팁)로, 그 뒤에 이름을 붙인다 — 지점 풀네임을 쓰면 칩이 너무 길어지기 때문.
// 지점이 2개 이상인 회원은 배지도 모두 표시한다(회원 탭과 동일).
// createMemberSelectionWidget(미배정/1회 제한 회원 위젯)이 공통으로 쓴다.
export function appendOnceLimitMemberLabel(container, member) {
  member.locationIds.forEach((locId) => {
    const loc = locationById(locId);
    if (!loc) return;
    const badge = document.createElement("span");
    badge.className = "tab-loc";
    badge.textContent = loc.name.charAt(0);
    badge.title = loc.name;
    container.appendChild(badge);
  });
  const nameEl = document.createElement("span");
  nameEl.textContent = member.name;
  container.appendChild(nameEl);
}

// 지점 등록 순서로 먼저 묶고, 같은 지점 안에서는 이름을 가나다순으로 정렬한다.
export function compareOnceLimitMembers(a, b) {
  const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
  const aIdx = locOrder.has(a.locationIds[0])
    ? locOrder.get(a.locationIds[0])
    : Infinity;
  const bIdx = locOrder.has(b.locationIds[0])
    ? locOrder.get(b.locationIds[0])
    : Infinity;
  return aIdx - bIdx || a.name.localeCompare(b.name, "ko");
}

export function locationById(id) {
  return state.locations.find((l) => l.id === id);
}

// SOLO_TRAVEL_LOCATION_NAMES 세 지점을 모두 등록해둔 회원 id 집합. greedyAssign(생성 시
// "이동-회원-이동" 금지)과 eligibleSwapMembersFor(수동 교체 시 같은 규칙 적용)가 공용으로 쓴다.
export function soloTravelMemberIds() {
  // 이름이 정확히 하나씩만 매칭돼야 규칙이 어느 지점을 가리키는지 모호하지 않다 — 같은
  // 이름을 가진 지점이 실수로 두 개 등록되면(중복 매칭) 전체 개수가 3개를 넘어서게 되고,
  // 이럴 땐 어느 쪽이 진짜인지 알 수 없으므로 규칙 자체를 비활성화한다(잘못된 지점에
  // 하드 로직을 적용하는 것보다 안전).
  const soloTravelLocationIds = state.locations
    .filter((l) => SOLO_TRAVEL_LOCATION_NAMES.includes(l.name))
    .map((l) => l.id);
  if (soloTravelLocationIds.length !== SOLO_TRAVEL_LOCATION_NAMES.length)
    return new Set();
  return new Set(
    state.members
      .filter((m) =>
        soloTravelLocationIds.every((id) => m.locationIds.includes(id)),
      )
      .map((m) => m.id),
  );
}

// "이동-회원-이동 금지" 규칙의 단일 정의: soloIds(soloTravelMemberIds) 회원의 수업이 앞
// 수업에서 이동으로 도착해 다음 수업으로 또 이동해 떠나는 자리면 위반이다. 앞이나 뒤 수업이
// 없으면(locId가 null) 위반이 아니다.
export function breaksSoloTravel(memberId, prevLocId, locId, nextLocId, soloIds) {
  return (
    soloIds.has(memberId) &&
    !!prevLocId &&
    !!nextLocId &&
    travelMinutes(prevLocId, locId) > 0 &&
    travelMinutes(locId, nextLocId) > 0
  );
}

// 시간순으로 정렬된 하루 체인([{memberId, locationId}])에 위 규칙을 어기는 자리가 있는지.
export function chainBreaksSoloTravel(chain, soloIds) {
  for (let i = 1; i + 1 < chain.length; i++) {
    const cur = chain[i];
    if (
      breaksSoloTravel(
        cur.memberId,
        chain[i - 1].locationId,
        cur.locationId,
        chain[i + 1].locationId,
        soloIds,
      )
    )
      return true;
  }
  return false;
}

export function memberColor(id) {
  const idx = state.members.findIndex((m) => m.id === id);
  if (idx === -1) return BLOCK_COLOR;
  const hue = MEMBER_COLORS[idx % MEMBER_COLORS.length];
  const tier =
    Math.floor(idx / MEMBER_COLORS.length) % MEMBER_COLOR_SHADE_STEPS.length;
  return shadeColor(hue, MEMBER_COLOR_SHADE_STEPS[tier]);
}

export function locationColor(locId) {
  const idx = state.locations.findIndex((l) => l.id === locId);
  return idx === -1 ? null : MEMBER_COLORS[idx % MEMBER_COLORS.length];
}

// 체인DP 안쪽 루프에서 travelMinutes를 통해 아주 많이 불리므로 배열 생성·정렬 없이 만든다
// ([a, b].sort().join("|")와 같은 결과 — 기본 sort도 문자열 코드 단위 비교다).
export function pairKey(idA, idB) {
  const a = String(idA),
    b = String(idB);
  return a < b ? a + "|" + b : b + "|" + a;
}

// 저장된 이동 시간 값의 유효성: 0 이상의 유한한 분. 0은 "모름"이 아니라 "이동 시간 0분"으로
// 명시한 값이다 — 값이 없거나 이 조건을 벗어나면 travelMinutes가 연결 불가로 본다.
export function isValidTravelMinutes(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

// 이동 시간 입력칸의 글자를 저장할 분으로 바꾼다. 빈칸·숫자 아님·음수·소수는 null(거부) — 빈칸을
// 0분으로 바꾸면 "모름(연결 불가)"이 "이동 시간 없음"으로 뒤바뀌어 불가능한 연속 수업이 생긴다.
export function parseTravelMinutesInput(text) {
  const trimmed = String(text == null ? "" : text).trim();
  if (trimmed === "") return null;
  const v = Number(trimmed);
  return Number.isInteger(v) && isValidTravelMinutes(v) ? v : null;
}

export function travelMinutes(locIdA, locIdB) {
  if (!locIdA || !locIdB || locIdA === locIdB) return 0;
  const v = state.travelTimes[pairKey(locIdA, locIdB)];
  // 서로 다른 지점의 이동 시간이 없거나 손상된 경우 0분으로 간주하면 물리적으로 불가능한
  // 연속 수업이 생길 수 있다. 계산상 연결 불가능(Infinity)으로 취급해 해당 전이를 막는다.
  return isValidTravelMinutes(v) ? v : Infinity;
}

// 배정 대상 회원(미배정 판정의 기준): 실제 존재하고, 신청을 하나라도 냈고, 제외("미배정 회원"으로
// 지정)되지 않은 회원. 제외는 배정 실패가 아니라 의도적인 것이라 미배정에 넣지 않는다. 회원 목록 순서.
export function scheduleTargetMemberIds() {
  const excluded = new Set(currentExcludedIds());
  const submitted = new Set(state.requests.map((r) => r.memberId));
  return state.members
    .filter((m) => submitted.has(m.id) && !excluded.has(m.id))
    .map((m) => m.id);
}

// 후보의 unassignedMembers는 항상 이것으로 만든다: 배정 대상 중 assigned에 수업이 하나도 없는 회원.
// 반복 호출하는 엔진은 targetIds(scheduleTargetMemberIds 결과, 배열·Set)를 한 번 만들어 넘긴다.
export function unassignedMembersFor(
  assigned,
  targetIds = scheduleTargetMemberIds(),
) {
  const assignedIds = new Set(assigned.map((r) => r.memberId));
  return [...targetIds]
    .filter((id) => !assignedIds.has(id))
    .map((id) => memberById(id))
    .filter(Boolean);
}

// SOLO_TRAVEL_LOCATION_NAMES와 같은 원칙: 이름이 정확히 하나씩만 매칭돼야 규칙이 활성화된다
// (중복 등록 시에는 규칙 자체를 비활성화한다). 마포점↔여의도점 왕복만 "가능"이고, 상암점이
// 낀 나머지 왕복 조합은 전부 "비효율"이라는 규칙(isInefficientRoundTrip)이 쓰는 지점 id들.
export function inefficientRoundTripLocationInfo() {
  const matches = state.locations.filter((l) =>
    INEFFICIENT_ROUNDTRIP_LOCATION_NAMES.includes(l.name),
  );
  if (matches.length !== INEFFICIENT_ROUNDTRIP_LOCATION_NAMES.length)
    return null;
  const idByName = new Map(matches.map((l) => [l.name, l.id]));
  return {
    ids: new Set(idByName.values()),
    mapoId: idByName.get("마포점"),
    yeouidoId: idByName.get("여의도점"),
  };
}

// A→B→A 왕복(locA에서 나가 locB를 들렀다가 다시 locA로 돌아옴)이 실제로 완성됐고, 그 왕복이
// 마포점↔여의도점이 아니면(=상암점이 끼면) 비효율로 판정한다. info는
// inefficientRoundTripLocationInfo()의 결과를 호출부에서 한 번만 구해 넘겨야 한다(순수 함수라
// DP 안쪽 루프에서 반복 호출해도 안전하지만, info 자체를 반복 계산할 필요는 없다).
// 왕복의 출발 지점(A)을 구한다: start부터 같은 지점에서 연달아 한 세션들을 거슬러 올라가
// 그 직전에 있던 다른 지점을 돌려준다(없으면 null). 마포→상암→상암→마포처럼 B에서 여러 건을
// 하고 돌아와도 왕복으로 잡히도록, 바로 앞 세션이 아니라 이 값을 locA로 넘긴다.
export function roundTripOriginLoc(start, prevOf, locOf) {
  const loc = locOf(start);
  let n = prevOf(start);
  while (n != null && locOf(n) === loc) n = prevOf(n);
  return n == null ? null : locOf(n);
}

export function isInefficientRoundTrip(info, locA, locB, locC) {
  if (!info || locA == null || locB == null || locC == null) return false;
  if (locA !== locC || locA === locB) return false; // 실제로 이동이 있는 A→B→A만
  if (!info.ids.has(locA) || !info.ids.has(locB)) return false;
  const isMapoYeouido =
    (locA === info.mapoId && locB === info.yeouidoId) ||
    (locA === info.yeouidoId && locB === info.mapoId);
  return !isMapoYeouido;
}
