import { state } from "./state.js";
import {
  CONSULT_DURATION_MIN,
  SESSION_DURATION_MIN,
  MAX_SESSIONS_PER_MEMBER,
  SOLO_TRAVEL_LOCATION_NAMES,
  BLOCK_COLOR,
  MEMBER_COLORS,
  MEMBER_COLOR_SHADE_STEPS,
  shadeColor,
} from "./constants.js";
import { currentOnceLimitIds } from "./selectionOverride.js";

export function memberById(id) {
  return state.members.find((m) => m.id === id);
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

export function pairKey(idA, idB) {
  return [idA, idB].sort().join("|");
}

export function travelMinutes(locIdA, locIdB) {
  if (!locIdA || !locIdB || locIdA === locIdB) return 0;
  const v = state.travelTimes[pairKey(locIdA, locIdB)];
  return typeof v === "number" && v >= 0 ? v : 0;
}
