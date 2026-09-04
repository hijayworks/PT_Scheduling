// 원본 script.js에서 "회원관리"와 "회원 스케줄 추가" 두 페이지의 DOM 캐싱·붙여넣기 파싱
// 코드가 서로 뒤섞여 있어(예: 회원 스케줄용 scheduleGridEl이 회원관리 섹션 안에서 캐싱됨),
// 둘로 억지로 나누면 참조를 놓치기 쉬워 이번엔 한 모듈로 합쳐서 옮긴다.
import {
  DAYS,
  SLOT_MIN,
  SLOT_COUNT,
  START_MIN,
  BREAK_MIN,
  CATEGORY_OPTIONS,
} from "../constants.js";
import {
  minutesLabel,
  slotLabel,
  durationToSlots,
  uid,
  showToast,
} from "../utils.js";
import { state, runtime, saveState } from "../state.js";
import {
  memberById,
  locationById,
  memberColor,
  locationColor,
  sessionDurationFor,
} from "../domain.js";
import { renderGrid } from "../grid.js";
import { fillTimeSelect, businessHoursGridRange } from "./settings.js";
import {
  renderSchedule3Result,
  onceLimit3Widget,
  excluded3Widget,
  goToPage,
} from "../schedule3.js";

/* ---------------- Member management page ---------------- */
export const memberForm = document.getElementById("memberForm");
export const memberNameInput = document.getElementById("memberName");
export const memberLocationMsEl = document.getElementById("memberLocationMs");
export const memberLocationControlEl = document.getElementById(
  "memberLocationControl",
);
export const memberLocationChipsEl = document.getElementById(
  "memberLocationChips",
);
export const memberLocationDropdownEl = document.getElementById(
  "memberLocationDropdown",
);
export const memberCategoryMsEl = document.getElementById("memberCategoryMs");
export const memberCategoryControlEl = document.getElementById(
  "memberCategoryControl",
);
export const memberCategoryDisplayEl = document.getElementById(
  "memberCategoryDisplay",
);
export const memberCategoryDropdownEl = document.getElementById(
  "memberCategoryDropdown",
);
export const memberMemoInput = document.getElementById("memberMemo");
export const memberLocationHintEl =
  document.getElementById("memberLocationHint");
export const memberCategoryHintEl =
  document.getElementById("memberCategoryHint");
export const memberNameHintEl = document.getElementById("memberNameHint");
export const memberHintEls = [
  memberLocationHintEl,
  memberCategoryHintEl,
  memberNameHintEl,
];
export function syncMemberHintSpacing() {
  memberForm.classList.toggle(
    "has-hint",
    memberHintEls.some((el) => el.textContent !== ""),
  );
}
export function setMemberHint(el, message, isError) {
  el.textContent = message;
  el.classList.toggle("generate-hint-error", !!isError);
  syncMemberHintSpacing();
}
export function clearMemberHints() {
  memberHintEls.forEach((el) => {
    el.textContent = "";
    el.classList.remove("generate-hint-error");
  });
  syncMemberHintSpacing();
}
export const memberTableBodyEl = document.getElementById("memberTableBody");
export const memberLocationSortThEl = document.getElementById(
  "memberLocationSortTh",
);
export const memberLocationSortArrowEl = document.getElementById(
  "memberLocationSortArrow",
);
export const memberSubmitBtn = memberForm.querySelector("button[type=submit]");
export const requestSummaryEl = document.getElementById("requestSummary");
export const memberTabsEl = document.getElementById("memberTabs");
export const scheduleGridEl = document.getElementById("scheduleGrid");
export const scheduleGridScrollEl =
  document.getElementById("scheduleGridScroll");
export const scheduleChipRowEl = document.getElementById("scheduleChipRow");
export const scheduleInteractiveEl = document.getElementById(
  "scheduleInteractive",
);
export const rangeAddRowEl = document.getElementById("rangeAddRow");
export const rangeDayListEl = document.getElementById("rangeDayList");
export const rangeAddBtn = document.getElementById("rangeAddBtn");
export const resetAllSchedulesBtn = document.getElementById(
  "resetAllSchedulesBtn",
);
export let activeScheduleMemberId = null;
// schedule3.js(goToPage)가 이 페이지를 벗어날 때 선택을 초기화하려고 호출한다 — import
// 바인딩은 읽기 전용이라 재대입은 이 setter를 통해서만 가능하다.
export function setActiveScheduleMemberId(id) {
  activeScheduleMemberId = id;
}

// "한 번에 추가" 컨트롤: 요일마다 독립된 시작~종료 시간대 선택창을 두고(기본값 "선택안함"),
// 시간대를 지정한 요일들만 모아 그 범위 안에서 가능한 모든 60분 후보 시작 시각(10분 간격)을
// 한 번에 희망 시간으로 등록한다.
export const rangeDayRows = DAYS.map((d, di) => {
  const row = document.createElement("div");
  row.className = "range-day-row";

  const name = document.createElement("span");
  name.className = "range-day-name";
  name.textContent = d;

  // 시작~종료 선택창을 하나의 묶음으로 감싸 좁은 화면에서 요일명 옆에 나란히 붙거나
  // (근무 가능 시간 설정의 .avail-day-time과 동일한 패턴) 필요하면 통째로 다음 줄로
  // 넘어가게 한다 — 그래야 화면이 좁을 때 시작 선택창과 종료 선택창이 서로 떨어져
  // 엉뚱한 자리에 걸리지 않는다.
  const timePair = document.createElement("div");
  timePair.className = "range-time-pair";

  const startSel = document.createElement("select");
  const sep = document.createElement("span");
  sep.className = "sep";
  sep.textContent = "~";
  const endSel = document.createElement("select");
  fillTimeSelect(startSel, "start");
  fillTimeSelect(endSel, "end");
  [startSel, endSel].forEach((sel) => {
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "선택안함";
    sel.insertBefore(noneOpt, sel.firstChild);
    sel.value = ""; // 기본값: 선택안함 (사용자가 직접 시간을 골라야 함)
  });

  timePair.appendChild(startSel);
  timePair.appendChild(sep);
  timePair.appendChild(endSel);

  row.appendChild(name);
  row.appendChild(timePair);
  rangeDayListEl.appendChild(row);

  return { day: di, startSel, endSel };
});

rangeAddBtn.addEventListener("click", () => {
  const activeMember = memberById(activeScheduleMemberId);
  if (!activeMember || activeMember.locationIds.length === 0) return;
  // 시작을 선택하지 않으면 맨 처음부터, 종료를 선택하지 않으면 맨 끝까지 가능한 것으로 처리한다.
  const configuredRows = rangeDayRows
    .filter((r) => r.startSel.value !== "" || r.endSel.value !== "")
    .map((r) => ({
      day: r.day,
      startSel: r.startSel,
      endSel: r.endSel,
      start: r.startSel.value === "" ? 0 : parseInt(r.startSel.value, 10),
      end: r.endSel.value === "" ? SLOT_COUNT : parseInt(r.endSel.value, 10),
    }));
  if (configuredRows.length === 0) {
    alert("요일별로 시작 또는 종료 시간대를 하나 이상 설정해주세요.");
    return;
  }
  for (const r of configuredRows) {
    // 종료(=마지막으로 시작 가능한 시각)는 시작 시각과 같아도 된다 — 예: 하루에 17시 딱 한 타임만
    // 가능하면 시작~종료를 모두 17:00으로 두면 된다. 종료가 시작보다 이를 때만 막는다.
    if (r.end < r.start) {
      alert(DAYS[r.day] + "요일의 종료 시간이 시작 시간보다 빠를 수 없습니다.");
      return;
    }
  }
  const added = configuredRows.reduce(
    (sum, r) => sum + addDesiredRange(activeMember, r.day, r.start, r.end),
    0,
  );
  if (added === 0) {
    alert(
      "추가할 새 시간대가 없습니다. 이미 등록되었거나, 그 범위엔 수업이 들어갈 자리가 없습니다.",
    );
    return;
  }
  configuredRows.forEach((r) => {
    r.startSel.value = "";
    r.endSel.value = "";
  });
  runtime.requestsChangedSinceGenerate3 = true;
  saveState();
  renderRequestList();
  showToast("일정이 추가 되었습니다.", "success");
});

export function resetAllRequests() {
  if (state.requests.length === 0) return;
  state.requests = [];
  runtime.requestsChangedSinceGenerate3 = true;
  saveState();
  renderRequestList();
}

resetAllSchedulesBtn.addEventListener("click", () => {
  if (state.requests.length === 0) return;
  if (!confirm("스케줄이 등록된 회원의 가능 시간을 모두 지우고 초기화할까요?"))
    return;
  resetAllRequests();
  showToast("전체 스케줄이 초기화되었습니다", "info");
});

/* ---------------- 회원 스케줄 추가: 붙여넣기로 일괄 등록 ---------------- */
// 트레이너가 평소 쓰는 "이름  요일 시간..." 텍스트를 그대로 붙여넣으면 파싱해서 회원별
// 희망 시간으로 한 번에 등록한다. 이름 다음에는 요일 토큰(월화수목금토를 이어 붙인 것,
// 예: 화목)과 시간 토큰이 번갈아 나오고, 시간 토큰의 숫자는 새 요일 토큰이 나오기 전까지
// 직전 요일 토큰 전체에 적용된다. "화목8910"처럼 요일과 시간 사이에 공백이 없어도
// 요일 글자 뒤에 남는 숫자를 그대로 시간 토큰으로 이어서 처리한다.
export const DAY_CHAR_TO_INDEX = {};
DAYS.forEach((d, i) => {
  DAY_CHAR_TO_INDEX[d] = i;
});

export function parseDayGroupToken(token) {
  if (!token || !/^[월화수목금토]+$/.test(token)) return null;
  return Array.from(token).map((ch) => DAY_CHAR_TO_INDEX[ch]);
}

// 숫자만 이어진 문자열을 "시(오후 기준, 1~12)"들의 나열로 되돌린다. 예: "8910" -> 8시·9시·10시,
// "730" -> 7시30분, "1030" -> 10시30분, "640" -> 6시40분, "650" -> 6시50분. 앞에서부터 그리디하게
// 2자리(10/11/12)를 먼저 시도하고, 뒤에 "30"·"40"·"50"이 바로 붙으면 그 분으로 묶는다(백트래킹으로
// 전체 문자열이 소진되는 경우만 채택).
export const HOUR_DIGIT_MINUTE_SUFFIXES = [30, 40, 50];
export function tokenizeHourDigits(digits) {
  function rec(s) {
    if (s === "") return [];
    for (const len of [2, 1]) {
      if (s.length < len) continue;
      const num = parseInt(s.slice(0, len), 10);
      const valid =
        len === 2
          ? num === 10 || num === 11 || num === 12
          : num >= 1 && num <= 9;
      if (!valid) continue;
      const rest = s.slice(len);
      for (const minute of HOUR_DIGIT_MINUTE_SUFFIXES) {
        if (rest.slice(0, 2) === String(minute)) {
          const sub = rec(rest.slice(2));
          if (sub) return [{ hour: num, minute }].concat(sub);
        }
      }
      const sub2 = rec(rest);
      if (sub2) return [{ hour: num, minute: 0 }].concat(sub2);
    }
    return null;
  }
  return rec(digits);
}

// "시(1~12, 오후 기준)"를 그리드 startSlot으로 바꾼다. 근무 가능 시간이 12:00~24:00
// 기준이라 12시는 정오, 1~11시는 모두 오후(13:00~23:00)로 취급한다.
export function hourMarkToStartSlot(mark) {
  const hour24 = (mark.hour % 12) + 12;
  const minutes = hour24 * 60 + mark.minute;
  return (minutes - START_MIN) / SLOT_MIN;
}

export function hourMarkLabel(mark) {
  const hour24 = (mark.hour % 12) + 12;
  return minutesLabel(hour24 * 60 + mark.minute);
}

// "월345"처럼 매시 정각이 연달아 이어진 마크들은, 회원이 그 사이 언제든 시작할 수 있다는
// 뜻으로 보고 하나의 이어진 구간으로 묶는다(예: 3,4,5시 -> 3시~5시 사이 10분 단위로 전부
// 희망 시작 시각이 됨). 시간이 하나라도 비면(연속이 아니면) 새 구간으로 나눈다.
export function groupConsecutiveMarks(marks) {
  const groups = [];
  let current = [];
  marks.forEach((mark) => {
    if (current.length > 0) {
      const prevHour24 = (current[current.length - 1].hour % 12) + 12;
      const hour24 = (mark.hour % 12) + 12;
      if (hour24 !== prevHour24 + 1) {
        groups.push(current);
        current = [];
      }
    }
    current.push(mark);
  });
  if (current.length > 0) groups.push(current);
  return groups;
}

// "2~5"(왼쪽·오른쪽 모두 시각이 있는 물결)는 "2345"를 이어 쓴 것과 같은 뜻으로, 두 시각
// 사이의 매시 정각을 전부 개별 희망 시작 시각으로 펼친다. 양쪽 끝의 반시간(30분) 표기는
// 그 끝에서만 그대로 반영한다. 근무 가능 시간이 12:00(정오)~24:00(자정) 하루 안에서만
// 이어지므로(자정을 넘겨 다음 날로 순환하는 범위는 없음), 12시가 가장 이른 시각·11시가
// 가장 늦은 시각인 실제 시간 순서(12,1,2,...,11)로 비교해 왼쪽이 오른쪽보다 늦으면
// "10~1"처럼 순서가 뒤바뀐(오타 등) 입력으로 보고 실패 처리한다(자정을 넘겨 순환시키지 않음).
export function expandHourRange(leftMark, rightMark) {
  const leftHour24 = (leftMark.hour % 12) + 12;
  const rightHour24 = (rightMark.hour % 12) + 12;
  if (rightHour24 < leftHour24) return null;
  const marks = [];
  for (let h24 = leftHour24; h24 <= rightHour24; h24++) {
    const hour = h24 === 12 ? 12 : h24 - 12;
    if (h24 === leftHour24 && h24 === rightHour24) {
      marks.push({ hour, minute: leftMark.minute });
      if (rightMark.minute !== leftMark.minute)
        marks.push({ hour, minute: rightMark.minute });
    } else if (h24 === leftHour24) {
      marks.push({ hour, minute: leftMark.minute });
    } else if (h24 === rightHour24) {
      marks.push({ hour, minute: rightMark.minute });
    } else {
      marks.push({ hour, minute: 0 });
    }
  }
  return marks;
}

// 시간 토큰 하나를 해석한다.
//  - "8910" 같은 순수 숫자열 -> { type:"point", marks:[...] } (각각 독립된 희망 시작 시각)
//  - "2~5" 처럼 물결 양쪽에 시각이 있으면 -> { type:"point", marks:[...] } ("2345"와 동일하게 확장)
//  - "630~" -> { type:"openStart", mark:{...} } (그 시각부터 마감까지 전부 가능)
//  - "~730" -> { type:"openEnd", mark:{...} } (마감 이전부터 그 시각까지 전부 가능)
export function parseTimeToken(token) {
  const originalToken = token;
  // "늦은시간"은 트레이너들이 관행적으로 쓰는 표현으로, 영업 마감 직전 시간대인
  // 오후 10시30분 시작을 뜻한다. "금910늦은시간"처럼 다른 시각 표기 뒤에 바로 붙어도
  // 그 시각들에 더해 22:30을 별도의 희망 시작 시각으로 추가한다.
  const LATE_MARK = { hour: 10, minute: 30 };
  let hasLateMark = false;
  if (token.endsWith("늦은시간")) {
    hasLateMark = true;
    token = token.slice(0, -"늦은시간".length);
  }
  function withLateMark(result) {
    if (!hasLateMark || result.error) return result;
    if (result.type === "point")
      result.marks = result.marks.concat([LATE_MARK]);
    else if (result.type === "openStart" || result.type === "openEnd") {
      result.extraPoints = (result.extraPoints || []).concat([LATE_MARK]);
    }
    return result;
  }
  if (token === "") {
    if (hasLateMark) return { type: "point", marks: [LATE_MARK] };
    return { error: '알 수 없는 시간 표기: "' + originalToken + '"' };
  }
  // "5까지"는 "~5"(마감 이전부터 5시까지), "4부터"·"5이후"는 "4~"·"5~"(그 시각부터 마감까지)와
  // 같은 뜻이라 동일한 물결 표기로 바꿔서 아래 로직을 그대로 재사용한다.
  const suffixMatch = token.match(/^(\d+)(까지|부터|이후)$/);
  if (suffixMatch) {
    const digits = suffixMatch[1];
    token = suffixMatch[2] === "까지" ? "~" + digits : digits + "~";
  }
  const cleanMatch = token.match(/^[\d~]+/);
  let warning = null;
  if (!cleanMatch)
    return { error: '알 수 없는 시간 표기: "' + originalToken + '"' };
  const clean = cleanMatch[0];
  if (clean.length < token.length) {
    warning =
      '"' +
      originalToken +
      '"에서 뒤쪽 문자("' +
      token.slice(clean.length) +
      '")는 무시했습니다.';
  }
  const tildeCount = (clean.match(/~/g) || []).length;
  if (tildeCount > 1)
    return { error: '알 수 없는 시간 표기: "' + originalToken + '"', warning };
  if (tildeCount === 1) {
    const [leftStr, rightStr] = clean.split("~");
    if (leftStr !== "" && rightStr !== "") {
      const leftMarks = tokenizeHourDigits(leftStr);
      const rightMarks = tokenizeHourDigits(rightStr);
      if (
        !leftMarks ||
        leftMarks.length !== 1 ||
        !rightMarks ||
        rightMarks.length !== 1
      ) {
        return {
          error: '구간 표기 해석 실패: "' + originalToken + '"',
          warning,
        };
      }
      const marks = expandHourRange(leftMarks[0], rightMarks[0]);
      if (!marks)
        return {
          error: '구간 표기 해석 실패: "' + originalToken + '"',
          warning,
        };
      return withLateMark({ type: "point", marks, warning });
    }
    if (rightStr === "") {
      // "6630~"처럼 물결 앞에 시각이 여러 개 이어져 있으면, 물결에 맞닿은 마지막 시각(6시30분)을
      // "그 시각부터 마감까지" 열린 시작점으로 삼고, 그 앞의 시각들(6시)은 각각 개별 희망
      // 시작 시각으로 남긴다.
      const marks = tokenizeHourDigits(leftStr);
      if (!marks || marks.length === 0)
        return {
          error: '구간 표기 해석 실패: "' + originalToken + '"',
          warning,
        };
      return withLateMark({
        type: "openStart",
        mark: marks[marks.length - 1],
        extraPoints: marks.slice(0, -1),
        warning,
      });
    }
    // "~458"처럼 물결 뒤에 시각이 여러 개 이어져 있으면, 물결에 맞닿은 첫 시각(4시)을
    // "마감 이전부터 그 시각까지" 열린 끝점으로 삼고, 그 뒤의 시각들(5시, 8시)은 각각
    // 개별 희망 시작 시각으로 남긴다.
    const marks = tokenizeHourDigits(rightStr);
    if (!marks || marks.length === 0)
      return { error: '구간 표기 해석 실패: "' + originalToken + '"', warning };
    return withLateMark({
      type: "openEnd",
      mark: marks[0],
      extraPoints: marks.slice(1),
      warning,
    });
  }
  const marks = tokenizeHourDigits(clean);
  if (!marks)
    return { error: '시간 해석 실패: "' + originalToken + '"', warning };
  return withLateMark({ type: "point", marks, warning });
}

// 한 줄("이름  요일 시간...")을 해석한다.
export function parseBulkImportLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const name = tokens[0];
  const result = {
    raw: line.trim(),
    name,
    days: [],
    warnings: [],
    errors: [],
    clearAll: false,
  };

  // "이름 x"(대소문자 무관)만 단독으로 오면, 그 회원의 기존 희망 시간을 전부 지우라는
  // 명시적 지시로 본다(등록 안 한 것처럼 초기화). 다른 요일·시간 표기와 섞여 있으면
  // 평소처럼 해석한다.
  if (tokens.length === 2 && /^x$/i.test(tokens[1])) {
    result.clearAll = true;
    return result;
  }

  let currentDays = null;

  function applyTimeToken(tok) {
    if (!currentDays) {
      result.errors.push(
        '요일 지정 전에 나온 시간 표기라 건너뜁니다: "' + tok + '"',
      );
      return;
    }
    const parsed = parseTimeToken(tok);
    if (parsed.warning) result.warnings.push(parsed.warning);
    if (parsed.error) {
      result.errors.push(parsed.error);
      return;
    }
    currentDays.forEach((day) => {
      let dayEntry = result.days.find((d) => d.day === day);
      if (!dayEntry) {
        dayEntry = { day, specs: [] };
        result.days.push(dayEntry);
      }
      dayEntry.specs.push(parsed);
    });
  }

  for (let i = 1; i < tokens.length; i++) {
    let tok = tokens[i];
    const dayPrefixMatch = tok.match(/^[월화수목금토]+/);
    if (dayPrefixMatch) {
      currentDays = parseDayGroupToken(dayPrefixMatch[0]);
      tok = tok.slice(dayPrefixMatch[0].length);
      if (tok === "") continue;
    }
    applyTimeToken(tok);
  }
  result.days.sort((a, b) => a.day - b.day);
  return result;
}

export function parseBulkImportText(text) {
  return text.split("\n").map(parseBulkImportLine).filter(Boolean);
}

// 마크 배열(연속이면 하나로 묶어)을 미리보기용 문구 조각들로 바꾼다.
export function describeMarks(marks) {
  return groupConsecutiveMarks(marks).map((group) =>
    group.length > 1
      ? hourMarkLabel(group[0]) + "~" + hourMarkLabel(group[group.length - 1])
      : hourMarkLabel(group[0]),
  );
}

// 파싱된 하루치 스케줄(day.specs)을 사람이 읽을 문구로 만든다 (미리보기 칩용).
export function describeDaySpecs(specs) {
  const parts = [];
  specs.forEach((spec) => {
    if (spec.type === "point") {
      parts.push(...describeMarks(spec.marks));
    } else if (spec.type === "openStart") {
      parts.push(...describeMarks(spec.extraPoints || []));
      parts.push(hourMarkLabel(spec.mark) + "~마감");
    } else if (spec.type === "openEnd") {
      parts.push("시작~" + hourMarkLabel(spec.mark));
      parts.push(...describeMarks(spec.extraPoints || []));
    }
  });
  return parts.join(", ");
}

export function findMembersByName(name) {
  return state.members.filter((m) => m.name === name);
}

/* ---- 붙여넣기 모달 ---- */
export const bulkImportConfirmOverlayEl = document.getElementById(
  "bulkImportConfirmOverlay",
);
export const bulkImportConfirmCloseBtn = document.getElementById(
  "bulkImportConfirmCloseBtn",
);
export const bulkImportJustAddBtn = document.getElementById(
  "bulkImportJustAddBtn",
);
export const bulkImportResetAddBtn = document.getElementById(
  "bulkImportResetAddBtn",
);
export const bulkImportOverlayEl = document.getElementById("bulkImportOverlay");
export const bulkImportOpenBtn = document.getElementById("bulkImportOpenBtn");
export const bulkImportCloseBtn = document.getElementById("bulkImportCloseBtn");
export const bulkImportCancelBtn = document.getElementById(
  "bulkImportCancelBtn",
);
export const bulkImportBackBtn = document.getElementById("bulkImportBackBtn");
export const bulkImportPreviewBtn = document.getElementById(
  "bulkImportPreviewBtn",
);
export const bulkImportApplyBtn = document.getElementById("bulkImportApplyBtn");
export const bulkImportTextareaEl =
  document.getElementById("bulkImportTextarea");
export const bulkImportStepInputEl = document.getElementById(
  "bulkImportStepInput",
);
export const bulkImportStepPreviewEl = document.getElementById(
  "bulkImportStepPreview",
);
export const bulkImportPreviewSummaryEl = document.getElementById(
  "bulkImportPreviewSummary",
);
export const bulkImportPreviewListEl = document.getElementById(
  "bulkImportPreviewList",
);

// { parsed, choice: memberId | "__new__" | "__skip__", newLocationId, newCategory }
export let bulkImportRows = [];

export function openBulkImportModal() {
  bulkImportTextareaEl.value = "";
  bulkImportStepInputEl.style.display = "";
  bulkImportStepPreviewEl.style.display = "none";
  bulkImportOverlayEl.classList.add("open");
  setTimeout(() => bulkImportTextareaEl.focus(), 0);
}

export function closeBulkImportModal() {
  bulkImportOverlayEl.classList.remove("open");
}

export function closeBulkImportConfirmModal() {
  bulkImportConfirmOverlayEl.classList.remove("open");
}

bulkImportOpenBtn.addEventListener("click", () => {
  if (state.requests.length === 0) {
    openBulkImportModal();
    return;
  }
  bulkImportConfirmOverlayEl.classList.add("open");
});
bulkImportConfirmCloseBtn.addEventListener(
  "click",
  closeBulkImportConfirmModal,
);
bulkImportConfirmOverlayEl.addEventListener("click", (e) => {
  if (e.target === bulkImportConfirmOverlayEl) closeBulkImportConfirmModal();
});
bulkImportJustAddBtn.addEventListener("click", () => {
  closeBulkImportConfirmModal();
  openBulkImportModal();
});
bulkImportResetAddBtn.addEventListener("click", () => {
  closeBulkImportConfirmModal();
  resetAllRequests();
  openBulkImportModal();
});
bulkImportCloseBtn.addEventListener("click", closeBulkImportModal);
bulkImportCancelBtn.addEventListener("click", closeBulkImportModal);
bulkImportOverlayEl.addEventListener("click", (e) => {
  if (e.target === bulkImportOverlayEl) closeBulkImportModal();
});
bulkImportBackBtn.addEventListener("click", () => {
  bulkImportStepInputEl.style.display = "";
  bulkImportStepPreviewEl.style.display = "none";
});

export function renderBulkImportPreview() {
  const lines = parseBulkImportText(bulkImportTextareaEl.value);
  if (lines.length === 0) {
    alert("붙여넣은 내용이 없습니다.");
    return;
  }
  bulkImportRows = lines.map((parsed) => {
    const matches = findMembersByName(parsed.name);
    return {
      parsed,
      choice: matches.length >= 1 ? matches[0].id : "__new__",
      newLocationId: state.locations[0] ? state.locations[0].id : "",
      newCategory: "등록",
    };
  });

  bulkImportPreviewListEl.innerHTML = "";
  let willApply = 0,
    willCreate = 0,
    willSkip = 0;

  bulkImportRows.forEach((row) => {
    const parsed = row.parsed;
    const matches = findMembersByName(parsed.name);

    const rowEl = document.createElement("div");
    rowEl.className = "bulk-preview-row";

    const head = document.createElement("div");
    head.className = "bulk-preview-row-head";

    const nameEl = document.createElement("span");
    nameEl.className = "bulk-preview-name";
    nameEl.textContent = parsed.name;
    head.appendChild(nameEl);

    const select = document.createElement("select");
    matches.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      const locNames = m.locationIds
        .map((id) => locationById(id))
        .filter(Boolean)
        .map((l) => l.name)
        .join("·");
      opt.textContent =
        "기존 회원 (" +
        (locNames || "지점 미지정") +
        ")" +
        (matches.length > 1 ? " #" + m.id.slice(-4) : "");
      select.appendChild(opt);
    });
    const newOpt = document.createElement("option");
    newOpt.value = "__new__";
    newOpt.textContent = "신규 회원";
    select.appendChild(newOpt);
    const skipOpt = document.createElement("option");
    skipOpt.value = "__skip__";
    skipOpt.textContent = "건너뛰기";
    select.appendChild(skipOpt);
    select.value = row.choice;
    select.addEventListener("change", () => {
      row.choice = select.value;
      renderRowState();
    });
    const newFields = document.createElement("div");
    newFields.className = "bulk-preview-new-fields";
    const locSelect = document.createElement("select");
    state.locations.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc.id;
      opt.textContent = loc.name;
      locSelect.appendChild(opt);
    });
    if (row.newLocationId) locSelect.value = row.newLocationId;
    locSelect.addEventListener("change", () => {
      row.newLocationId = locSelect.value;
    });
    const catSelect = document.createElement("select");
    CATEGORY_OPTIONS.forEach((opt) => {
      const optionEl = document.createElement("option");
      optionEl.value = opt;
      optionEl.textContent = opt;
      catSelect.appendChild(optionEl);
    });
    catSelect.value = row.newCategory;
    catSelect.addEventListener("change", () => {
      row.newCategory = catSelect.value;
    });
    newFields.appendChild(locSelect);
    newFields.appendChild(catSelect);
    head.appendChild(select);
    head.appendChild(newFields);
    rowEl.appendChild(head);

    const scheduleEl = document.createElement("div");
    scheduleEl.className = "bulk-preview-schedule";
    if (parsed.days.length > 0) {
      parsed.days.forEach((dayEntry) => {
        const chip = document.createElement("span");
        chip.className = "bulk-preview-day-chip";
        chip.innerHTML =
          "<b>" +
          DAYS[dayEntry.day] +
          "</b> " +
          describeDaySpecs(dayEntry.specs);
        scheduleEl.appendChild(chip);
      });
    } else if (parsed.clearAll) {
      const chip = document.createElement("span");
      chip.className = "bulk-preview-day-chip bulk-preview-day-chip-clear";
      chip.textContent = "기존 가능 시간 전체 삭제";
      scheduleEl.appendChild(chip);
    } else {
      const chip = document.createElement("span");
      chip.className = "bulk-preview-day-chip";
      chip.textContent = "등록할 시간 없음";
      scheduleEl.appendChild(chip);
    }
    rowEl.appendChild(scheduleEl);

    parsed.warnings.forEach((w) => {
      const p = document.createElement("p");
      p.className = "bulk-preview-note warning";
      p.textContent = "⚠ " + w;
      rowEl.appendChild(p);
    });
    parsed.errors.forEach((err) => {
      const p = document.createElement("p");
      p.className = "bulk-preview-note error";
      p.textContent = "✕ " + err;
      rowEl.appendChild(p);
    });

    function renderRowState() {
      rowEl.classList.toggle("skip", row.choice === "__skip__");
      newFields.style.display = row.choice === "__new__" ? "flex" : "none";
    }
    renderRowState();

    bulkImportPreviewListEl.appendChild(rowEl);

    if (row.choice === "__skip__") willSkip++;
    else if (row.choice === "__new__") willCreate++;
    else willApply++;
  });

  bulkImportPreviewSummaryEl.innerHTML =
    "기존 회원 적용 " +
    willApply +
    "명 · 신규 등록 " +
    willCreate +
    "명 · 건너뛰기 " +
    willSkip +
    "명" +
    "<br>적용 대상 회원의 기존 스케줄은 모두 지우고 아래 내용으로 교체합니다.";

  bulkImportStepInputEl.style.display = "none";
  bulkImportStepPreviewEl.style.display = "";
}

bulkImportPreviewBtn.addEventListener("click", renderBulkImportPreview);

bulkImportApplyBtn.addEventListener("click", () => {
  if (state.locations.length === 0) {
    alert("설정 페이지에서 지점을 먼저 등록해주세요.");
    return;
  }
  let createdCount = 0;
  const zeroFitNames = []; // 파싱은 됐지만 마감 시간 등으로 실제 등록된 시간이 하나도 없는 회원
  const emptyRowNames = []; // 신규 회원인데 등록할 시간이 없어 건너뛴 줄
  const clearedNames = []; // 기존 회원이고 "이름 x"로 명시 지정해 기존 스케줄을 모두 지운 회원
  const unparsedSkippedNames = []; // 기존 회원인데 오타 등으로 파싱이 안 돼(명시적 x가 아님) 건드리지 않고 건너뛴 줄

  // 같은 회원을 가리키는 여러 줄(이름을 여러 줄로 나눠 붙여넣은 경우 등)이 서로의 스케줄을
  // 덮어쓰지 않도록, 적용 대상 회원별로 파싱된 스케줄을 먼저 합친 뒤 회원당 한 번만 교체한다.
  const entriesByMemberKey = new Map(); // memberId -> { member, isNew, days: Map<day, specs[]> }
  bulkImportRows.forEach((row) => {
    if (row.choice === "__skip__") return;
    let member,
      isNew = false;
    if (row.choice === "__new__") {
      // 신규 회원은 등록할 시간이 없으면 만들 이유가 없으니 건너뛴다.
      if (row.parsed.days.length === 0) {
        emptyRowNames.push(row.parsed.name);
        return;
      }
      if (!row.newLocationId) return;
      member = {
        id: uid("m"),
        name: row.parsed.name,
        locationIds: [row.newLocationId],
        category: row.newCategory,
        memo: "",
      };
      isNew = true;
    } else {
      // 기존 회원은 "등록할 시간 없음"도 유효한 지정이다 — 아래에서 기존 스케줄을 모두 지운다.
      member = memberById(row.choice);
      if (!member) return;
    }
    if (!entriesByMemberKey.has(member.id)) {
      entriesByMemberKey.set(member.id, {
        member,
        isNew,
        days: new Map(),
        explicitClear: false,
      });
    }
    const entry = entriesByMemberKey.get(member.id);
    if (row.parsed.clearAll) entry.explicitClear = true;
    row.parsed.days.forEach((dayEntry) => {
      if (!entry.days.has(dayEntry.day)) entry.days.set(dayEntry.day, []);
      entry.days.get(dayEntry.day).push(...dayEntry.specs);
    });
  });

  let appliedCount = 0;
  entriesByMemberKey.forEach((entry) => {
    const member = entry.member;
    if (entry.isNew) {
      state.members.unshift(member);
      createdCount++;
    } else if (entry.days.size === 0 && !entry.explicitClear) {
      // 기존 회원인데 파싱된 시간이 하나도 없고 "이름 x"로 명시 지정한 것도 아니면(오타·빈
      // 시간 표기 등), 실수로 기존 스케줄을 지우는 일을 막기 위해 이 회원은 아예 건드리지
      // 않고 건너뛴다.
      unparsedSkippedNames.push(member.name);
      return;
    }
    state.requests = state.requests.filter((r) => r.memberId !== member.id);
    let addedForMember = 0;
    // 연속된 매시 마크(예: 3,4,5시)는 그 사이 전부를 하나의 이어진 희망 구간으로 등록한다.
    function applyMarks(day, marks) {
      groupConsecutiveMarks(marks).forEach((group) => {
        const startSlot = hourMarkToStartSlot(group[0]);
        const endSlot = hourMarkToStartSlot(group[group.length - 1]);
        addedForMember += addDesiredRange(member, day, startSlot, endSlot);
      });
    }
    entry.days.forEach((specs, day) => {
      specs.forEach((spec) => {
        if (spec.type === "point") {
          applyMarks(day, spec.marks);
        } else if (spec.type === "openStart") {
          applyMarks(day, spec.extraPoints || []);
          addedForMember += addDesiredRange(
            member,
            day,
            hourMarkToStartSlot(spec.mark),
            SLOT_COUNT,
          );
        } else if (spec.type === "openEnd") {
          addedForMember += addDesiredRange(
            member,
            day,
            0,
            hourMarkToStartSlot(spec.mark),
          );
          applyMarks(day, spec.extraPoints || []);
        }
      });
    });
    appliedCount++;
    if (entry.days.size === 0) {
      if (!entry.isNew) clearedNames.push(member.name);
    } else if (addedForMember === 0) {
      zeroFitNames.push(member.name);
    }
  });

  runtime.requestsChangedSinceGenerate3 = true;
  saveState();
  renderMemberTable();
  renderRequestList();
  closeBulkImportModal();

  const notes = [];
  if (createdCount) notes.push("신규 " + createdCount + "명");
  if (zeroFitNames.length)
    notes.push(
      zeroFitNames.join(", ") +
        "은(는) 마감 시간 등으로 등록된 시간이 없습니다",
    );
  if (clearedNames.length)
    notes.push(
      clearedNames.join(", ") +
        "은(는) 'x' 지정으로 기존 시간을 모두 삭제했습니다",
    );
  if (emptyRowNames.length)
    notes.push(
      emptyRowNames.join(", ") + "은(는) 등록할 시간이 없어 건너뛰었습니다",
    );
  if (unparsedSkippedNames.length)
    notes.push(
      unparsedSkippedNames.join(", ") +
        "은(는) 줄을 해석하지 못해 기존 시간을 그대로 두고 건너뛰었습니다",
    );
  const suffix = notes.length ? " (" + notes.join(" · ") + ")" : "";
  showToast(
    appliedCount + "명 스케줄 등록 완료" + suffix,
    zeroFitNames.length ||
      emptyRowNames.length ||
      clearedNames.length ||
      unparsedSkippedNames.length
      ? "info"
      : "success",
  );
});

// Notion 스타일 지점 다중 선택 위젯: 드롭다운에서 클릭 한 번으로 지점을 추가/제거한다.
export let memberFormLocationIds = [];
export let memberLocationDropdownOpen = false;

export function toggleMemberFormLocation(locId) {
  memberFormLocationIds = memberFormLocationIds.includes(locId)
    ? memberFormLocationIds.filter((id) => id !== locId)
    : memberFormLocationIds.concat(locId);
  renderMemberLocationControl();
  renderMemberLocationDropdown();
}

export function renderMemberLocationControl() {
  memberLocationChipsEl.innerHTML = "";
  if (memberFormLocationIds.length === 0) {
    const placeholder = document.createElement("span");
    placeholder.className = "ms-placeholder";
    placeholder.textContent =
      state.locations.length === 0 ? "등록된 지점 없음" : "선택";
    memberLocationChipsEl.appendChild(placeholder);
    return;
  }
  memberFormLocationIds.forEach((locId) => {
    const loc = locationById(locId);
    if (!loc) return;
    const chip = document.createElement("span");
    chip.className = "chip ms-chip";
    const nameEl = document.createElement("span");
    nameEl.textContent = loc.name;
    chip.appendChild(nameEl);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.title = "제거";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMemberFormLocation(locId);
    });
    chip.appendChild(removeBtn);
    memberLocationChipsEl.appendChild(chip);
  });
}

export function renderMemberLocationDropdown() {
  memberLocationDropdownEl.innerHTML = "";
  if (state.locations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ms-empty";
    empty.textContent = "설정 페이지에서 지점을 먼저 등록해주세요.";
    memberLocationDropdownEl.appendChild(empty);
    return;
  }
  state.locations.forEach((loc) => {
    const selected = memberFormLocationIds.includes(loc.id);
    const item = document.createElement("div");
    item.className = "ms-option" + (selected ? " selected" : "");
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(selected));
    const check = document.createElement("span");
    check.className = "ms-option-check";
    check.textContent = "✓";
    item.appendChild(check);
    const label = document.createElement("span");
    label.textContent = loc.name;
    item.appendChild(label);
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMemberFormLocation(loc.id);
    });
    memberLocationDropdownEl.appendChild(item);
  });
}

export function openMemberLocationDropdown() {
  if (state.locations.length === 0) return;
  memberLocationDropdownOpen = true;
  memberLocationMsEl.classList.add("open");
  memberLocationControlEl.setAttribute("aria-expanded", "true");
}

export function closeMemberLocationDropdown() {
  memberLocationDropdownOpen = false;
  memberLocationMsEl.classList.remove("open");
  memberLocationControlEl.setAttribute("aria-expanded", "false");
}

memberLocationControlEl.addEventListener("click", () => {
  if (memberLocationDropdownOpen) closeMemberLocationDropdown();
  else openMemberLocationDropdown();
});

export function populateMemberLocationSelect() {
  memberFormLocationIds = memberFormLocationIds.filter((id) =>
    state.locations.some((l) => l.id === id),
  );
  renderMemberLocationControl();
  renderMemberLocationDropdown();
  const hasLocations = state.locations.length > 0;
  memberSubmitBtn.disabled = !hasLocations;
  memberLocationControlEl.disabled = !hasLocations;
  setMemberHint(
    memberLocationHintEl,
    hasLocations ? "" : "설정 페이지에서 지점을 먼저 등록해주세요.",
    false,
  );
}

// 같은 위젯을 재사용한 구분 단일 선택: 클릭 한 번으로 값을 고르고, 고르면 바로 닫힌다.
export let memberFormCategory = "";
export let memberCategoryDropdownOpen = false;

export function renderMemberCategoryControl() {
  memberCategoryDisplayEl.innerHTML = "";
  const display = document.createElement("span");
  if (memberFormCategory) {
    display.className = "ms-value";
    display.textContent = memberFormCategory;
  } else {
    display.className = "ms-placeholder";
    display.textContent = "선택";
  }
  memberCategoryDisplayEl.appendChild(display);
}

export function renderMemberCategoryDropdown() {
  memberCategoryDropdownEl.innerHTML = "";
  CATEGORY_OPTIONS.forEach((opt) => {
    const selected = memberFormCategory === opt;
    const item = document.createElement("div");
    item.className = "ms-option" + (selected ? " selected" : "");
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(selected));
    const check = document.createElement("span");
    check.className = "ms-option-check";
    check.textContent = "✓";
    item.appendChild(check);
    const label = document.createElement("span");
    label.textContent = opt;
    item.appendChild(label);
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      memberFormCategory = opt;
      renderMemberCategoryControl();
      renderMemberCategoryDropdown();
      closeMemberCategoryDropdown();
    });
    memberCategoryDropdownEl.appendChild(item);
  });
}

export function openMemberCategoryDropdown() {
  memberCategoryDropdownOpen = true;
  memberCategoryMsEl.classList.add("open");
  memberCategoryControlEl.setAttribute("aria-expanded", "true");
}

export function closeMemberCategoryDropdown() {
  memberCategoryDropdownOpen = false;
  memberCategoryMsEl.classList.remove("open");
  memberCategoryControlEl.setAttribute("aria-expanded", "false");
}

memberCategoryControlEl.addEventListener("click", () => {
  if (memberCategoryDropdownOpen) closeMemberCategoryDropdown();
  else openMemberCategoryDropdown();
});

document.addEventListener("click", (e) => {
  if (memberLocationDropdownOpen && !memberLocationMsEl.contains(e.target))
    closeMemberLocationDropdown();
  if (memberCategoryDropdownOpen && !memberCategoryMsEl.contains(e.target))
    closeMemberCategoryDropdown();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (memberLocationDropdownOpen) closeMemberLocationDropdown();
  if (memberCategoryDropdownOpen) closeMemberCategoryDropdown();
});

renderMemberCategoryControl();
renderMemberCategoryDropdown();

export function deleteMember(member) {
  const reqCount = state.requests.filter(
    (r) => r.memberId === member.id,
  ).length;
  const msg =
    reqCount > 0
      ? "'" +
        member.name +
        "' 회원을 삭제하면 등록된 가능 시간 " +
        reqCount +
        "건도 함께 삭제됩니다. 계속할까요?"
      : "'" + member.name + "' 회원을 삭제할까요?";
  if (!confirm(msg)) return;
  state.members = state.members.filter((m) => m.id !== member.id);
  state.requests = state.requests.filter((r) => r.memberId !== member.id);
  state.onceLimitedMemberIds3 = state.onceLimitedMemberIds3.filter(
    (id) => id !== member.id,
  );
  state.excludedMemberIds3 = state.excludedMemberIds3.filter(
    (id) => id !== member.id,
  );
  runtime.requestsChangedSinceGenerate3 = true;
  saveState();
  renderMemberTable();
  renderRequestList();
  renderSchedule3Result();
  showToast("'" + member.name + "' 회원이 삭제되었습니다", "danger");
}

export function setMemberMemo(member, memo) {
  member.memo = memo;
  saveState();
  showToast("메모가 저장되었습니다", "success");
}

export function setMemberCategory(member, category) {
  member.category = category;
  // 구분이 바뀌면 확보 시간(상담 30분/등록 60분)도 바뀌므로, 이미 등록된 이 회원의
  // 신청들도 새 구분 기준 길이로 맞춰준다 — 안 그러면 예전 구분 기준 길이가 그대로 남아
  // 그리드에는 옛 길이만큼만 자리가 확보된 것처럼 보인다.
  const newDuration = sessionDurationFor(member);
  state.requests.forEach((r) => {
    if (r.memberId === member.id) r.duration = newDuration;
  });
  runtime.requestsChangedSinceGenerate3 = true;
  saveState();
  renderRequestList();
  showToast("회원 구분이 변경되었습니다", "success");
}

export let editingMemberNameId = null;

// 지점 정렬: null(등록순) → "asc" → "desc" → null 순으로 헤더 클릭할 때마다 순환한다.
export let memberLocationSortDir = null;
memberLocationSortThEl.addEventListener("click", () => {
  memberLocationSortDir =
    memberLocationSortDir === null
      ? "asc"
      : memberLocationSortDir === "asc"
        ? "desc"
        : null;
  renderMemberTable();
});

export function memberPrimaryLocationName(member) {
  const loc = locationById(member.locationIds[0]);
  return loc ? loc.name : "";
}

export function renderMemberTable() {
  onceLimit3Widget.renderAll();
  excluded3Widget.renderAll();
  memberTableBodyEl.innerHTML = "";
  memberLocationSortArrowEl.textContent =
    memberLocationSortDir === "asc"
      ? "▲"
      : memberLocationSortDir === "desc"
        ? "▼"
        : "";
  if (state.members.length === 0) {
    const emptyRow = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "generate-hint";
    cell.textContent =
      "등록된 회원이 없습니다. 위에서 회원을 먼저 등록해주세요.";
    emptyRow.appendChild(cell);
    memberTableBodyEl.appendChild(emptyRow);
    return;
  }
  // 지점이 미지정/삭제된 상태인 회원은 첫 번째 지점으로 자동 보정한다 (지점 미지정 상태를 허용하지 않음).
  if (state.locations.length > 0) {
    let fixedAny = false;
    state.members.forEach((member) => {
      const validIds = member.locationIds.filter((id) =>
        state.locations.some((l) => l.id === id),
      );
      if (validIds.length !== member.locationIds.length) {
        member.locationIds = validIds;
        fixedAny = true;
      }
      if (member.locationIds.length === 0) {
        member.locationIds = [state.locations[0].id];
        fixedAny = true;
      }
    });
    if (fixedAny) saveState();
  }

  const rows = memberLocationSortDir
    ? state.members.slice().sort((a, b) => {
        const cmp = memberPrimaryLocationName(a).localeCompare(
          memberPrimaryLocationName(b),
          "ko",
        );
        return memberLocationSortDir === "asc" ? cmp : -cmp;
      })
    : state.members;

  rows.forEach((member) => {
    const tr = document.createElement("tr");

    // 지점명
    const locCell = document.createElement("td");
    const locBadgeWrap = document.createElement("div");
    locBadgeWrap.className = "badge-cell";
    member.locationIds.forEach((locId) => {
      const loc = locationById(locId);
      if (!loc) return;
      const locBadge = document.createElement("span");
      locBadge.className = "chip location-chip";
      locBadge.textContent = loc.name;
      const color = locationColor(locId);
      if (color) {
        locBadge.style.background = color;
        locBadge.style.borderColor = color;
        locBadge.style.color = "#fff";
      }
      locBadgeWrap.appendChild(locBadge);
    });
    locCell.appendChild(locBadgeWrap);
    tr.appendChild(locCell);

    // 구분 (클릭하면 드롭다운으로 상담/등록을 바로 바꿀 수 있는 배지형 셀렉트)
    const catCell = document.createElement("td");
    const catBadge = document.createElement("select");
    const categoryValue = member.category || "상담";
    catBadge.className =
      "chip category-chip" +
      (categoryValue === "상담" ? " category-chip-consult" : "");
    CATEGORY_OPTIONS.forEach((opt) => {
      const optionEl = document.createElement("option");
      optionEl.value = opt;
      optionEl.textContent = opt;
      catBadge.appendChild(optionEl);
    });
    catBadge.value = categoryValue;
    catBadge.addEventListener("change", () => {
      setMemberCategory(member, catBadge.value);
      renderMemberTable();
    });
    catCell.appendChild(catBadge);
    tr.appendChild(catCell);

    // 회원명
    const nameCell = document.createElement("td");
    const nameWrap = document.createElement("span");
    nameWrap.className = "member-name-cell";
    nameCell.appendChild(nameWrap);

    if (editingMemberNameId === member.id) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = member.name;
      function commit() {
        const trimmed = input.value.trim();
        const changed = trimmed && trimmed !== member.name;
        // 이름만 같은 건 동명이인일 수 있어 그냥 저장하지만, 지점까지 같으면 실수로 중복된
        // 경우일 가능성이 높으므로 확인을 거친다.
        if (
          changed &&
          state.members.some(
            (m) =>
              m.id !== member.id &&
              m.name === trimmed &&
              m.locationIds.some((id) => member.locationIds.includes(id)),
          )
        ) {
          const proceed = confirm(
            "'" +
              trimmed +
              "' 이름의 회원이 같은 지점에 이미 있습니다. 이름만 같은 다른 회원으로 저장할까요?",
          );
          if (!proceed) {
            input.focus();
            return;
          }
        }
        if (trimmed) member.name = trimmed;
        editingMemberNameId = null;
        saveState();
        renderMemberTable();
        renderRequestList();
        if (changed) showToast("이름이 저장되었습니다", "success");
      }
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          editingMemberNameId = null;
          renderMemberTable();
        }
      });
      input.addEventListener("blur", commit);
      nameWrap.appendChild(input);
      tr.appendChild(nameCell);
      memberTableBodyEl.appendChild(tr);
      input.focus();
      input.select();
      return;
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "location-chip-name";
    nameSpan.title = "클릭해서 이름 수정";
    nameSpan.addEventListener("click", () => {
      editingMemberNameId = member.id;
      renderMemberTable();
    });
    const nameText = document.createElement("span");
    nameText.textContent = member.name;
    nameSpan.appendChild(nameText);
    const editIcon = document.createElement("span");
    editIcon.className = "edit-pencil";
    editIcon.setAttribute("aria-hidden", "true");
    editIcon.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    nameSpan.appendChild(editIcon);
    nameWrap.appendChild(nameSpan);
    tr.appendChild(nameCell);

    // 메모 (길어지면 잘리지 않고 여러 줄로 늘어나도록 textarea + 자동 높이 조절)
    const memoCell = document.createElement("td");
    memoCell.className = "memo-cell";
    const memoInput = document.createElement("textarea");
    memoInput.rows = 1;
    memoInput.value = member.memo || "";
    const growMemo = () => {
      memoInput.style.height = "auto";
      memoInput.style.height = memoInput.scrollHeight + "px";
    };
    memoInput.addEventListener("input", growMemo);
    memoInput.addEventListener("change", () =>
      setMemberMemo(member, memoInput.value),
    );
    memoCell.appendChild(memoInput);
    tr.appendChild(memoCell);

    // 삭제
    const actionCell = document.createElement("td");
    actionCell.className = "action-cell";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "×";
    delBtn.title = "삭제";
    delBtn.addEventListener("click", () => deleteMember(member));
    actionCell.appendChild(delBtn);
    tr.appendChild(actionCell);

    memberTableBodyEl.appendChild(tr);
    growMemo();
  });
}

memberForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = memberNameInput.value.trim();
  if (state.locations.length === 0) return;
  clearMemberHints();
  if (!name) {
    setMemberHint(memberNameHintEl, "이름을 입력해주세요.", true);
    return;
  }
  if (memberFormLocationIds.length === 0) {
    setMemberHint(memberLocationHintEl, "지점을 하나 이상 선택해주세요.", true);
    return;
  }
  if (!memberFormCategory) {
    setMemberHint(memberCategoryHintEl, "회원 구분을 선택해주세요.", true);
    return;
  }
  // 이름만 같은 건 동명이인일 수 있어 그냥 등록하지만, 지점까지 같으면 실수로 중복
  // 등록하는 경우일 가능성이 높으므로 확인을 거친다.
  if (
    state.members.some(
      (m) =>
        m.name === name &&
        m.locationIds.some((id) => memberFormLocationIds.includes(id)),
    )
  ) {
    const proceed = confirm(
      "'" +
        name +
        "' 이름의 회원이 같은 지점에 이미 있습니다. 이름만 같은 다른 회원으로 등록할까요?",
    );
    if (!proceed) return;
  }
  const member = {
    id: uid("m"),
    name,
    locationIds: memberFormLocationIds.slice(),
    category: memberFormCategory,
    memo: memberMemoInput.value.trim(),
  };
  state.members.unshift(member);
  memberNameInput.value = "";
  memberMemoInput.value = "";
  memberFormCategory = "";
  renderMemberCategoryControl();
  renderMemberCategoryDropdown();
  memberFormLocationIds = [];
  renderMemberLocationControl();
  renderMemberLocationDropdown();
  memberNameInput.focus();
  clearMemberHints();
  renderMemberTable();
  renderRequestList();
  saveState();
  showToast("'" + name + "' 회원이 등록되었습니다", "success");
});

/* ---------------- 회원관리: 붙여넣기로 일괄 등록 ---------------- */
// "지점 / 구분 / 이름" 형식(지점은 쉼표로 여러 개 가능)을 한 줄에 한 명씩 붙여넣으면
// 파싱해서 미리보기에서 확인·수정한 뒤 한 번에 회원으로 등록한다.
export const memberBulkImportOverlayEl = document.getElementById(
  "memberBulkImportOverlay",
);
export const memberBulkImportOpenBtn = document.getElementById(
  "memberBulkImportOpenBtn",
);
export const memberBulkImportCloseBtn = document.getElementById(
  "memberBulkImportCloseBtn",
);
export const memberBulkImportCancelBtn = document.getElementById(
  "memberBulkImportCancelBtn",
);
export const memberBulkImportBackBtn = document.getElementById(
  "memberBulkImportBackBtn",
);
export const memberBulkImportPreviewBtn = document.getElementById(
  "memberBulkImportPreviewBtn",
);
export const memberBulkImportApplyBtn = document.getElementById(
  "memberBulkImportApplyBtn",
);
export const memberBulkImportTextareaEl = document.getElementById(
  "memberBulkImportTextarea",
);
export const memberBulkImportStepInputEl = document.getElementById(
  "memberBulkImportStepInput",
);
export const memberBulkImportStepPreviewEl = document.getElementById(
  "memberBulkImportStepPreview",
);
export const memberBulkImportPreviewSummaryEl = document.getElementById(
  "memberBulkImportPreviewSummary",
);
export const memberBulkImportPreviewListEl = document.getElementById(
  "memberBulkImportPreviewList",
);

// { raw, locationIds, category, name, skip, errors }
export let memberBulkImportRows = [];

export function parseMemberBulkLine(line) {
  const raw = line.trim();
  if (!raw) return null;
  const parts = raw.split("/").map((s) => s.trim());
  const row = {
    raw,
    locationIds: [],
    unmatchedLocationNames: [],
    category: "",
    name: "",
    skip: false,
    errors: [],
  };
  if (parts.length !== 3) {
    row.errors.push(
      '형식이 맞지 않습니다. "지점 / 구분 / 이름" 형식으로 입력해주세요.',
    );
    return row;
  }
  const [locPart, catPart, namePart] = parts;
  const locationNames = locPart
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (locationNames.length === 0) row.errors.push("지점을 입력해주세요.");
  locationNames.forEach((n) => {
    const loc = state.locations.find((l) => l.name === n);
    if (loc) row.locationIds.push(loc.id);
    else row.unmatchedLocationNames.push(n);
  });
  if (row.unmatchedLocationNames.length > 0) {
    row.errors.push(
      "등록되지 않은 지점: " + row.unmatchedLocationNames.join(", "),
    );
  }
  row.category = catPart;
  if (!CATEGORY_OPTIONS.includes(catPart)) {
    row.errors.push(
      "회원 구분은 " +
        CATEGORY_OPTIONS.join("/") +
        ' 중 하나여야 합니다: "' +
        catPart +
        '"',
    );
  }
  row.name = namePart;
  if (!namePart) row.errors.push("이름을 입력해주세요.");
  return row;
}

export function openMemberBulkImportModal() {
  memberBulkImportTextareaEl.value = "";
  memberBulkImportStepInputEl.style.display = "";
  memberBulkImportStepPreviewEl.style.display = "none";
  memberBulkImportOverlayEl.classList.add("open");
  setTimeout(() => memberBulkImportTextareaEl.focus(), 0);
}

export function closeMemberBulkImportModal() {
  memberBulkImportOverlayEl.classList.remove("open");
}

memberBulkImportOpenBtn.addEventListener("click", openMemberBulkImportModal);
memberBulkImportCloseBtn.addEventListener("click", closeMemberBulkImportModal);
memberBulkImportCancelBtn.addEventListener("click", closeMemberBulkImportModal);
memberBulkImportOverlayEl.addEventListener("click", (e) => {
  if (e.target === memberBulkImportOverlayEl) closeMemberBulkImportModal();
});
memberBulkImportBackBtn.addEventListener("click", () => {
  memberBulkImportStepInputEl.style.display = "";
  memberBulkImportStepPreviewEl.style.display = "none";
});

export function memberBulkRowIsDuplicate(row) {
  return state.members.some(
    (m) =>
      m.name === row.name &&
      m.locationIds.some((id) => row.locationIds.includes(id)),
  );
}

export function renderMemberBulkImportPreview() {
  memberBulkImportPreviewListEl.innerHTML = "";
  let willAdd = 0,
    willSkip = 0,
    willError = 0;

  memberBulkImportRows.forEach((row) => {
    const hasError = row.errors.length > 0;
    const duplicate = !hasError && memberBulkRowIsDuplicate(row);
    if (hasError) willError++;
    else if (row.skip) willSkip++;
    else willAdd++;

    const rowEl = document.createElement("div");
    rowEl.className =
      "bulk-preview-row" + (row.skip || hasError ? " skip" : "");

    const head = document.createElement("div");
    head.className = "bulk-preview-row-head";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = row.name;
    nameInput.className = "bulk-preview-name";
    nameInput.style.cssText =
      "border:1px solid var(--border);border-radius:8px;height:32px;padding:0 8px;width:120px;font-family:inherit;";
    nameInput.addEventListener("input", () => {
      row.name = nameInput.value.trim();
      renderMemberBulkImportPreview();
    });
    head.appendChild(nameInput);

    const catSelect = document.createElement("select");
    CATEGORY_OPTIONS.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      catSelect.appendChild(o);
    });
    if (CATEGORY_OPTIONS.includes(row.category)) catSelect.value = row.category;
    catSelect.addEventListener("change", () => {
      row.category = catSelect.value;
      row.errors = row.errors.filter((e) => !e.startsWith("회원 구분은"));
      renderMemberBulkImportPreview();
    });
    head.appendChild(catSelect);

    const skipLabel = document.createElement("label");
    skipLabel.style.cssText =
      "display:inline-flex;align-items:center;gap:4px;font-size:12.5px;color:var(--text-mute);margin-left:auto;";
    const skipCheckbox = document.createElement("input");
    skipCheckbox.type = "checkbox";
    skipCheckbox.checked = row.skip;
    skipCheckbox.disabled = hasError;
    skipCheckbox.addEventListener("change", () => {
      row.skip = skipCheckbox.checked;
      renderMemberBulkImportPreview();
    });
    skipLabel.appendChild(skipCheckbox);
    skipLabel.appendChild(document.createTextNode("건너뛰기"));
    head.appendChild(skipLabel);

    rowEl.appendChild(head);

    const locWrap = document.createElement("div");
    locWrap.className = "bulk-preview-new-fields";
    state.locations.forEach((loc) => {
      const label = document.createElement("label");
      label.style.cssText =
        "display:inline-flex;align-items:center;gap:4px;font-size:12.5px;";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = row.locationIds.includes(loc.id);
      cb.addEventListener("change", () => {
        if (cb.checked) row.locationIds.push(loc.id);
        else row.locationIds = row.locationIds.filter((id) => id !== loc.id);
        if (row.locationIds.length > 0)
          row.errors = row.errors.filter(
            (e) =>
              !e.startsWith("지점을") && !e.startsWith("등록되지 않은 지점"),
          );
        renderMemberBulkImportPreview();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(loc.name));
      locWrap.appendChild(label);
    });
    rowEl.appendChild(locWrap);

    if (hasError) {
      const err = document.createElement("p");
      err.className = "bulk-preview-note error";
      err.textContent = row.errors.join(" ");
      rowEl.appendChild(err);
    } else if (duplicate) {
      const note = document.createElement("p");
      note.className = "bulk-preview-note warning";
      note.textContent =
        "같은 지점에 동명 회원이 이미 있습니다. 그대로 등록하면 별도 회원으로 추가됩니다.";
      rowEl.appendChild(note);
    }

    memberBulkImportPreviewListEl.appendChild(rowEl);
  });

  const parts = [willAdd + "명 등록"];
  if (willSkip > 0) parts.push(willSkip + "명 건너뜀");
  if (willError > 0) parts.push(willError + "명 형식 오류");
  memberBulkImportPreviewSummaryEl.textContent = parts.join(" · ");
  memberBulkImportApplyBtn.disabled = willAdd === 0;
}

memberBulkImportPreviewBtn.addEventListener("click", () => {
  const lines = memberBulkImportTextareaEl.value
    .split("\n")
    .map(parseMemberBulkLine)
    .filter(Boolean);
  if (lines.length === 0) {
    alert("붙여넣은 내용이 없습니다.");
    return;
  }
  memberBulkImportRows = lines;
  memberBulkImportStepInputEl.style.display = "none";
  memberBulkImportStepPreviewEl.style.display = "";
  renderMemberBulkImportPreview();
});

memberBulkImportApplyBtn.addEventListener("click", () => {
  const toAdd = memberBulkImportRows.filter(
    (row) => row.errors.length === 0 && !row.skip,
  );
  if (toAdd.length === 0) return;
  toAdd.forEach((row) => {
    state.members.unshift({
      id: uid("m"),
      name: row.name,
      locationIds: row.locationIds.slice(),
      category: row.category,
      memo: "",
    });
  });
  saveState();
  renderMemberTable();
  renderRequestList();
  closeMemberBulkImportModal();
  showToast(toAdd.length + "명의 회원이 등록되었습니다", "success");
});

/* ---------------- Requests page: desired-time entry ---------------- */
// 요일 하나에 대해 [startSlot, endSlot] 범위 안에서 만들 수 있는 모든 후보(회원 구분별
// 확보 시간만큼)의 시작 시각(10분 간격)을 희망 시간으로 등록한다. endSlot은 "마지막으로
// 수업을 시작할 수 있는 시각"이다 (그 시각에 시작해도 되고, 그 시각이 곧 수업이 끝나는
// 경계는 아니다). 이미 등록된 시작 시각은 건너뛴다. 겹치는 후보끼리는 서로 배타적인
// "대안"이므로 겹침 자체는 허용한다.
export function addDesiredRange(member, day, startSlot, endSlot) {
  if (member.locationIds.length === 0) return 0;
  const duration = sessionDurationFor(member);
  const neededSlots = durationToSlots(duration);
  const existingStarts = new Set(
    state.requests
      .filter((r) => r.memberId === member.id && r.day === day)
      .map((r) => r.startSlot),
  );
  // 하루가 끝나기 전에 수업이 끝날 수 있는 시각까지만 시작을 허용한다.
  const maxStart = Math.min(endSlot, SLOT_COUNT - neededSlots);
  let added = 0;
  for (let s = startSlot; s <= maxStart; s++) {
    if (existingStarts.has(s)) continue;
    state.requests.push({
      id: uid("r"),
      memberId: member.id,
      day,
      startSlot: s,
      duration,
    });
    added++;
  }
  return added;
}

export function removeRequests(reqIds) {
  const idSet = new Set(reqIds);
  state.requests = state.requests.filter((r) => !idSet.has(r.id));
  runtime.requestsChangedSinceGenerate3 = true;
  renderRequestList();
  saveState();
}

// 표시용으로만 겹치거나 맞닿은 후보들을 하나의 시간대 구간으로 묶는다 (저장 데이터는 그대로 개별 후보).
export function mergeRequestRuns(reqs) {
  const byDay = new Map();
  reqs.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  const runs = [];
  byDay.forEach((list, day) => {
    list.sort((a, b) => a.startSlot - b.startSlot);
    let current = null;
    list.forEach((r) => {
      const rEnd = r.startSlot + durationToSlots(r.duration);
      if (current && r.startSlot <= current.endSlot) {
        current.endSlot = Math.max(current.endSlot, rEnd);
        current.reqs.push(r);
      } else {
        current = { day, startSlot: r.startSlot, endSlot: rEnd, reqs: [r] };
        runs.push(current);
      }
    });
  });
  runs.sort((a, b) => a.day - b.day || a.startSlot - b.startSlot);
  return runs;
}

// 그리드에 표시되는 시간 블록(run) 하나에 딸린 "추가 지점"들 — 회원의 기본 지점과 별개로,
// 이 시간대에만 배정 가능하게 허용해둔 지점이다. 블록을 이루는 개별 신청(run.reqs)들에
// 똑같이 저장되므로 첫 번째 신청 것만 읽으면 된다.
export function requestRunExtraLocationIds(run) {
  return (run.reqs[0] && run.reqs[0].extraLocationIds) || [];
}

export function setRunExtraLocationIds(run, ids) {
  run.reqs.forEach((r) => {
    r.extraLocationIds = ids.slice();
  });
}

export function addExtraLocationToRun(run, locId) {
  const current = requestRunExtraLocationIds(run);
  if (current.includes(locId)) return;
  setRunExtraLocationIds(run, current.concat([locId]));
  runtime.requestsChangedSinceGenerate3 = true;
  saveState();
  renderRequestList();
  showToast("지점이 추가되었습니다", "success");
}

export function removeExtraLocationFromRun(run, locId) {
  setRunExtraLocationIds(
    run,
    requestRunExtraLocationIds(run).filter((id) => id !== locId),
  );
  runtime.requestsChangedSinceGenerate3 = true;
  saveState();
  renderRequestList();
  showToast("지점이 제거되었습니다", "info");
}

// 좌클릭(터치는 탭) 시 뜨는 메뉴: 지점 추가하기(이 시간대만 다른 지점에서도 배정 가능해짐 —
// 회원의 기본 지점과 이미 추가된 지점을 뺀 나머지 지점을 바로 항목으로 보여준다), 이미
// 추가해둔 지점 제거하기, 그리고 맨 아래에 구분선과 함께 이 가능 시간 자체를 삭제하는 항목을
// danger 스타일로 넣는다 — 터치 기기는 마우스 호버(×버튼)를 쓸 수 없으므로 이 메뉴가 유일한
// 삭제 경로이고, PC에서도 호버 ×버튼과 별개로 똑같이 쓸 수 있다.
export function buildRequestRunMenu(member, run, x, y) {
  const excluded = new Set(
    (member.locationIds || []).concat(requestRunExtraLocationIds(run)),
  );
  const addableLocations = state.locations.filter((l) => !excluded.has(l.id));
  const items =
    addableLocations.length > 0
      ? addableLocations.map((l) => ({
          label: l.name + " 추가",
          onClick: () => addExtraLocationToRun(run, l.id),
        }))
      : [{ label: "추가할 수 있는 지점이 없습니다", disabled: true }];
  const extraIds = requestRunExtraLocationIds(run);
  if (extraIds.length > 0) {
    items.push({ separator: true });
    extraIds.forEach((id) => {
      const loc = locationById(id);
      if (!loc) return;
      items.push({
        label: loc.name + " 제거",
        danger: true,
        onClick: () => removeExtraLocationFromRun(run, id),
      });
    });
  }
  items.push({ separator: true });
  items.push({
    label: "가능 시간 삭제",
    danger: true,
    onClick: () => removeRequests(run.reqs.map((r) => r.id)),
  });
  return items;
}

export function renderRequestList() {
  memberTabsEl.innerHTML = "";
  scheduleGridEl.innerHTML = "";
  scheduleChipRowEl.innerHTML = "";

  if (state.members.length === 0) {
    requestSummaryEl.innerHTML = "";
    requestSummaryEl.append(
      "등록된 회원이 없습니다. ",
      (() => {
        const link = document.createElement("a");
        link.href = "#";
        link.className = "request-summary-link";
        link.textContent = "회원관리";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          goToPage("members");
        });
        return link;
      })(),
      "에서 먼저 회원을 등록해 주세요.",
    );
    requestSummaryEl.style.display = "";
    scheduleInteractiveEl.style.display = "none";
    return;
  }
  scheduleInteractiveEl.style.display = "";

  // 지점 등록 순서(state.locations)를 기준으로 회원 탭을 첫 번째 지점별로 묶어서 표시한다.
  // 같은 지점 안에서는 회원을 실제로 등록한 순서(먼저 등록한 회원이 먼저)로 정렬한다 —
  // state.members 배열 자체는 새 회원이 맨 앞에 추가되는(unshift) 방식이라 배열 순서가
  // 최근 등록순이므로, 배열 인덱스를 거꾸로(큰 인덱스 = 먼저 등록함) 써서 뒤집는다.
  const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
  const sortedMembers = state.members
    .map((member, index) => ({ member, index }))
    .sort((a, b) => {
      const ao = locOrder.has(a.member.locationIds[0])
        ? locOrder.get(a.member.locationIds[0])
        : Infinity;
      const bo = locOrder.has(b.member.locationIds[0])
        ? locOrder.get(b.member.locationIds[0])
        : Infinity;
      return ao - bo || b.index - a.index;
    })
    .map((entry) => entry.member);

  if (
    !activeScheduleMemberId ||
    !state.members.some((m) => m.id === activeScheduleMemberId)
  ) {
    activeScheduleMemberId = null;
  }
  const activeMember = activeScheduleMemberId
    ? memberById(activeScheduleMemberId)
    : null;

  const registeredCount = new Set(state.requests.map((r) => r.memberId)).size;
  requestSummaryEl.textContent =
    "등록 " +
    registeredCount +
    "명 · 미등록 " +
    (state.members.length - registeredCount) +
    "명";
  requestSummaryEl.style.display = "";

  sortedMembers.forEach((member) => {
    const reqCount = state.requests.filter(
      (r) => r.memberId === member.id,
    ).length;
    const hasRequests = reqCount > 0;
    // 탭 안에 삭제(×) 버튼을 함께 넣어야 해서(상담 회원 한정) <button> 중첩을 피하려고 탭 자체는 div로 만든다.
    const tab = document.createElement("div");
    tab.className =
      "member-tab" +
      (hasRequests ? " has-req" : " no-req") +
      (member.id === activeScheduleMemberId ? " active" : "");
    tab.title = hasRequests
      ? "가능 시간 " + reqCount + "건 등록됨"
      : "가능 시간 미등록";

    member.locationIds.forEach((locId) => {
      const loc = locationById(locId);
      if (!loc) return;
      const locBadge = document.createElement("span");
      locBadge.className = "tab-loc";
      locBadge.textContent = loc.name.charAt(0);
      locBadge.title = loc.name;
      tab.appendChild(locBadge);
    });
    const tabName =
      member.name + ((member.category || "상담") === "상담" ? " (상담)" : "");
    tab.appendChild(document.createTextNode(tabName));
    if ((member.category || "상담") === "상담") {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "member-tab-delete";
      delBtn.title = "'" + member.name + "' 회원 삭제";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteMember(member);
      });
      tab.appendChild(delBtn);
    }
    tab.addEventListener("click", () => {
      activeScheduleMemberId = member.id;
      renderRequestList();
    });
    memberTabsEl.appendChild(tab);
  });

  rangeAddRowEl.style.display =
    activeMember && activeMember.locationIds.length > 0 ? "" : "none";
  scheduleGridScrollEl.style.display = activeMember ? "" : "none";

  if (!activeMember) {
    const hint = document.createElement("p");
    hint.className = "generate-hint";
    hint.textContent = "회원을 먼저 선택해 주세요.";
    scheduleChipRowEl.appendChild(hint);
    return;
  }

  if (activeMember.locationIds.length === 0) {
    const hint = document.createElement("p");
    hint.className = "generate-hint";
    hint.textContent =
      "회원관리에서 '" +
      activeMember.name +
      "' 회원의 지점을 먼저 선택해주세요.";
    scheduleChipRowEl.appendChild(hint);
    return;
  }

  const myReqs = state.requests.filter((r) => r.memberId === activeMember.id);
  const color = memberColor(activeMember.id);
  const memberLabel =
    activeMember.name +
    ((activeMember.category || "상담") === "상담" ? " (상담)" : "");
  // 겹치거나 맞닿은 후보들은 그리드에 하나의 블록으로 합쳐서 그린다.
  // (개별 후보를 각각 그리면 촘촘하게 겹쳐서 알아볼 수 없게 된다.)
  const runs = mergeRequestRuns(myReqs);
  // 신청은 더 이상 지점 하나에 고정되지 않고 회원이 등록한 모든 지점에서 가능하므로,
  // 블록에는 회원의 지점 전체를 함께 보여준다.
  const memberLocNames = activeMember.locationIds
    .map((id) => locationById(id))
    .filter(Boolean)
    .map((l) => l.name)
    .join(" · ");

  // 그리드에는 실제로 확보되는 시간을 하나의 블록으로 보여준다(쉬는 시간이 있던 시절의 흔적으로,
  // BREAK_MIN이 0이면 종료 시각을 늘리지 않는다 — 지금은 그렇다).
  const breakSlots = durationToSlots(BREAK_MIN);

  const scheduleGridRange = businessHoursGridRange();
  let rangeStartSlot = scheduleGridRange.rangeStartSlot;
  let rangeEndSlot = scheduleGridRange.rangeEndSlot;
  // 근무 가능 시간 밖으로 등록된 희망 시간(예: 붙여넣기로 일괄 등록할 때 실수로 근무 시간
  // 밖 시각을 넣은 경우)이 있으면, 그리드 범위를 넓혀서라도 항상 보이게 한다 — 그렇지
  // 않으면 블록 자체가 그려지지 않아(renderGrid의 클리핑) 삭제할 방법이 없는데도 회원 탭은
  // 신청이 있는 것으로(초록색) 계속 표시되는 모순이 생긴다.
  myReqs.forEach((r) => {
    rangeStartSlot = Math.min(rangeStartSlot, r.startSlot);
    rangeEndSlot = Math.max(
      rangeEndSlot,
      r.startSlot + durationToSlots(r.duration),
    );
  });
  renderGrid(scheduleGridEl, runtime.availableCells, {
    blocks: runs.map((run) => {
      const displayEndSlot = Math.min(run.endSlot + breakSlots, SLOT_COUNT);
      // "지점 추가하기"로 이 시간대에만 추가해둔 지점이 있으면 이름 뒤에 덧붙여 보여준다.
      const extraNames = requestRunExtraLocationIds(run)
        .map((id) => locationById(id))
        .filter(Boolean)
        .map((l) => l.name);
      return {
        day: run.day,
        startSlot: run.startSlot,
        duration: (displayEndSlot - run.startSlot) * SLOT_MIN,
        label: memberLabel,
        loc:
          memberLocNames +
          (extraNames.length > 0 ? " +" + extraNames.join(",") : ""),
        sublabel:
          slotLabel(run.startSlot) +
          "~" +
          minutesLabel(START_MIN + displayEndSlot * SLOT_MIN),
        color,
        onDelete: () => removeRequests(run.reqs.map((r) => r.id)),
        contextMenuItems: (x, y) =>
          buildRequestRunMenu(activeMember, run, x, y),
      };
    }),
    rangeStartSlot,
    rangeEndSlot,
  });

  if (myReqs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "generate-hint";
    empty.textContent =
      '위에서 요일별로 시간대를 고르고 "한 번에 추가"를 눌러 가능 시간을 추가하세요.';
    scheduleChipRowEl.appendChild(empty);
  }
}
