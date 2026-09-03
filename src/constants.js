/* ---------------- Constants ---------------- */
export const DAYS = ["월", "화", "수", "목", "금", "토"];
export const START_MIN = 12 * 60; // 12:00 (정오) — 근무 가능 시간 시작 선택창에 12:00, 12:30도 넣기 위해 13:00에서 당김
export const END_MIN = 24 * 60; // 24:00 (오전 12시)
export const SLOT_MIN = 10;
export const SLOT_COUNT = (END_MIN - START_MIN) / SLOT_MIN;
export const SESSION_DURATION_MIN = 60; // 수업(등록 회원) 시간
export const CONSULT_DURATION_MIN = 30; // 상담 회원은 확보 시간이 더 짧음
export const BREAK_MIN = 0; // 수업 사이 쉬는 시간 없음(지점이 바뀔 때만 이동 시간만큼 간격을 둔다)
export const ALLOWED_GAP_MIN = 10; // 이동시간·휴식시간을 제외하고 추가로 허용되는 빈 시간
// 상암점·여의도점·마포점 세 지점을 모두 다니는 회원은 "이동-회원-이동"(도착도 이동, 떠날 때도
// 이동)으로 배정될 수 없다는 숨김 하드 로직(greedyAssign·eligibleSwapMembersFor 공용)의 기준 지점들.
export const SOLO_TRAVEL_LOCATION_NAMES = ["상암점", "여의도점", "마포점"];
export const BLOCK_COLOR = "#4f46e5"; // 회원 미지정 등 예외 상황의 기본 블록 배경색
// 회원별 블록 배경색(등록 순서대로 순환, 고정 순서 — 절대 임의로 섞지 않음). 색맹 시뮬레이션
// 기준으로 인접 색끼리 구분이 되도록 검증된 팔레트: blue/orange/aqua/yellow/magenta/green/
// violet/red. 자극적인 원색 빨강 대신 톤을 낮춘 빨강을 써서 눈에 피로하지 않게 했다.
export const MEMBER_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];
// 검증된 색상은 8개뿐이라 회원이 9명을 넘으면 그대로 반복돼 서로 다른 회원이 똑같은 색을
// 갖게 된다. 새 색상을 만들어내는 대신(색맹 검증이 안 됨), 같은 8색을 유지한 채 명도만
// 단계적으로 어둡게 낮춰(글자는 항상 흰색이라 어둡게 할수록 대비는 오히려 좋아진다) 8명
// 단위로 순환한다. 명도 차이는 색맹 유형(적록·청황 색약 등)과 무관하게 지각되므로 색맹
// 안전성은 그대로 유지된다. 단계 수(5개)와 간격은 인접 단계가 서로 구분되면서도 40명
// 주기 이내에서는 같은 색상·단계 조합이 반복되지 않도록 검증된 값이다.
export const MEMBER_COLOR_SHADE_STEPS = [0, 0.18, 0.33, 0.46, 0.58];

export function shadeColor(hex, darkenRatio) {
  if (!darkenRatio) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff,
    g = (num >> 8) & 0xff,
    b = num & 0xff;
  const mix = (c) => Math.round(c * (1 - darkenRatio));
  return (
    "#" +
    [mix(r), mix(g), mix(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

export const CATEGORY_OPTIONS = ["상담", "등록"];

// engine/greedy.js의 STRATEGIES 배열 길이(후보A/B 2가지) — state.js의 loadState()가 저장된
// 후보의 strategyIndex가 아직 유효한지 검사할 때, 실제 STRATEGIES(정렬 함수까지 포함)를 통째로
// import하면 state.js ↔ engine/greedy.js 순환 의존이 생기므로, 개수만 별도 상수로 둔다.
export const STRATEGY_COUNT = 2;

// 후보 조건: 회원당 1일 최대 1회 · 최대 2회까지(상담 회원은 최대 1회까지, maxSessionsFor 참고).
// (최대한 1회 이상은 greedyAssign 1단계 배정에서 우선순위로 반영)
export const MAX_SESSIONS_PER_MEMBER = 2;
export const MAX_TRAVELS_PER_DAY = 2; // 하루 지점 간 이동은 최소화하되, 하더라도 최대 2회까지
export const FORCE_ONCE_WEIGHT = 1e6; // repairUnassigned의 forceOnceMemberIds가 1단계 배정에서 다른 회원들보다 항상 우선하도록 주는 가중치

// "수업 스케줄 생성2" 전용 후보 생성 규칙: 등록 회원 60분·상담 회원 30분, 쉬는 시간 없음(이동이
// 필요할 때만 그 이동 시간만큼 간격을 둔다). "수업 스케줄 생성1"도 이제 동일한 규칙(등록 60분·
// 상담 30분, 쉬는 시간 없음)이지만, 상수는 여전히 별개로 관리해 한쪽을 바꿔도 다른 쪽에 영향이 없도록 한다.
export const SESSION_DURATION_MIN_2 = 60;
export const CONSULT_DURATION_MIN_2 = 30;

export const STORAGE_KEY = "pt_schedule_state_v3";
export const OLD_STORAGE_KEY = "pt_schedule_state_v2"; // pre-migration key: 30분 슬롯 기준
export const OLD_SLOT_MIN = 30;
export const SLOT_SCALE = OLD_SLOT_MIN / SLOT_MIN; // 옛 슬롯 인덱스를 새 슬롯 인덱스로 환산
export const DEFAULT_LOCATION_NAMES = ["여의도점", "상암점", "마포점"];
export const DEFAULT_TRAVEL_MIN = 30;
// 지점 쌍별 기본 이동 시간(분) — 이름 순서는 상관없이 두 이름을 짝으로 찾는다.
export const DEFAULT_TRAVEL_PAIRS = [
  ["여의도점", "상암점", 60],
  ["여의도점", "마포점", 30],
  ["상암점", "마포점", 30],
];

export function defaultTravelMinutesFor(nameA, nameB) {
  const pair = DEFAULT_TRAVEL_PAIRS.find(
    ([a, b]) => (a === nameA && b === nameB) || (a === nameB && b === nameA),
  );
  return pair ? pair[2] : DEFAULT_TRAVEL_MIN;
}

// 첫 실행 시, 그리고 개별 요일을 새로 켤 때 기본으로 채워둘 근무 가능 시간: 14:00~23:30
// (첫 실행 기본값은 월~금만 적용하고 토요일은 비워둠)
export const DEFAULT_BUSINESS_DAY_INDICES = [0, 1, 2, 3, 4]; // 월~금
export const DEFAULT_BUSINESS_START_MIN = 14 * 60; // 14:00
export const DEFAULT_BUSINESS_END_MIN = 23 * 60 + 30; // 23:30
export const DEFAULT_BUSINESS_START_SLOT =
  (DEFAULT_BUSINESS_START_MIN - START_MIN) / SLOT_MIN;
export const DEFAULT_BUSINESS_END_SLOT =
  (DEFAULT_BUSINESS_END_MIN - START_MIN) / SLOT_MIN;
