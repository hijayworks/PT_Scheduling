(function () {
  "use strict";

  /* ---------------- Constants ---------------- */
  const DAYS = ["월", "화", "수", "목", "금", "토"];
  const START_MIN = 12 * 60;  // 12:00 (정오) — 근무 가능 시간 시작 선택창에 12:00, 12:30도 넣기 위해 13:00에서 당김
  const END_MIN = 24 * 60;    // 24:00 (오전 12시)
  const SLOT_MIN = 10;
  const SLOT_COUNT = (END_MIN - START_MIN) / SLOT_MIN;
  const SESSION_DURATION_MIN = 60; // 수업(등록 회원) 시간
  const CONSULT_DURATION_MIN = 30; // 상담 회원은 확보 시간이 더 짧음
  const BREAK_MIN = 0; // 수업 사이 쉬는 시간 없음(지점이 바뀔 때만 이동 시간만큼 간격을 둔다)
  const ALLOWED_GAP_MIN = 10; // 이동시간·휴식시간을 제외하고 추가로 허용되는 빈 시간
  // 상암점·여의도점·마포점 세 지점을 모두 다니는 회원은 "이동-회원-이동"(도착도 이동, 떠날 때도
  // 이동)으로 배정될 수 없다는 숨김 하드 로직(greedyAssign·eligibleSwapMembersFor 공용)의 기준 지점들.
  const SOLO_TRAVEL_LOCATION_NAMES = ["상암점", "여의도점", "마포점"];
  const BLOCK_COLOR = "#4f46e5"; // 회원 미지정 등 예외 상황의 기본 블록 배경색
  // 회원별 블록 배경색(등록 순서대로 순환, 고정 순서 — 절대 임의로 섞지 않음). 색맹 시뮬레이션
  // 기준으로 인접 색끼리 구분이 되도록 검증된 팔레트: blue/orange/aqua/yellow/magenta/green/
  // violet/red. 자극적인 원색 빨강 대신 톤을 낮춘 빨강을 써서 눈에 피로하지 않게 했다.
  const MEMBER_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  // 검증된 색상은 8개뿐이라 회원이 9명을 넘으면 그대로 반복돼 서로 다른 회원이 똑같은 색을
  // 갖게 된다. 새 색상을 만들어내는 대신(색맹 검증이 안 됨), 같은 8색을 유지한 채 명도만
  // 단계적으로 어둡게 낮춰(글자는 항상 흰색이라 어둡게 할수록 대비는 오히려 좋아진다) 8명
  // 단위로 순환한다. 명도 차이는 색맹 유형(적록·청황 색약 등)과 무관하게 지각되므로 색맹
  // 안전성은 그대로 유지된다. 단계 수(5개)와 간격은 인접 단계가 서로 구분되면서도 40명
  // 주기 이내에서는 같은 색상·단계 조합이 반복되지 않도록 검증된 값이다.
  const MEMBER_COLOR_SHADE_STEPS = [0, 0.18, 0.33, 0.46, 0.58];
  function shadeColor(hex, darkenRatio) {
    if (!darkenRatio) return hex;
    const num = parseInt(hex.slice(1), 16);
    const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
    const mix = c => Math.round(c * (1 - darkenRatio));
    return "#" + [mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, "0")).join("");
  }
  const CATEGORY_OPTIONS = ["상담", "등록"];

  // 후보 조건: 회원당 1일 최대 1회 · 최대 2회까지(상담 회원은 최대 1회까지, maxSessionsFor 참고).
  // (최대한 1회 이상은 greedyAssign 1단계 배정에서 우선순위로 반영)
  const MAX_SESSIONS_PER_MEMBER = 2;
  const MAX_TRAVELS_PER_DAY = 2; // 하루 지점 간 이동은 최소화하되, 하더라도 최대 2회까지
  const FORCE_ONCE_WEIGHT = 1e6; // repairUnassigned의 forceOnceMemberIds가 1단계 배정에서 다른 회원들보다 항상 우선하도록 주는 가중치

  // "수업 스케줄 생성2" 전용 후보 생성 규칙: 등록 회원 60분·상담 회원 30분, 쉬는 시간 없음(이동이
  // 필요할 때만 그 이동 시간만큼 간격을 둔다). "수업 스케줄 생성1"도 이제 동일한 규칙(등록 60분·
  // 상담 30분, 쉬는 시간 없음)이지만, 상수는 여전히 별개로 관리해 한쪽을 바꿔도 다른 쪽에 영향이 없도록 한다.
  const SESSION_DURATION_MIN_2 = 60;
  const CONSULT_DURATION_MIN_2 = 30;

  const STORAGE_KEY = "pt_schedule_state_v3";
  const OLD_STORAGE_KEY = "pt_schedule_state_v2"; // pre-migration key: 30분 슬롯 기준
  const OLD_SLOT_MIN = 30;
  const SLOT_SCALE = OLD_SLOT_MIN / SLOT_MIN; // 옛 슬롯 인덱스를 새 슬롯 인덱스로 환산
  const DEFAULT_LOCATION_NAMES = ["여의도점", "상암점", "마포점"];
  const DEFAULT_TRAVEL_MIN = 30;
  // 지점 쌍별 기본 이동 시간(분) — 이름 순서는 상관없이 두 이름을 짝으로 찾는다.
  const DEFAULT_TRAVEL_PAIRS = [
    ["여의도점", "상암점", 60],
    ["여의도점", "마포점", 30],
    ["상암점", "마포점", 30]
  ];
  function defaultTravelMinutesFor(nameA, nameB) {
    const pair = DEFAULT_TRAVEL_PAIRS.find(([a, b]) => (a === nameA && b === nameB) || (a === nameB && b === nameA));
    return pair ? pair[2] : DEFAULT_TRAVEL_MIN;
  }
  // 첫 실행 시, 그리고 개별 요일을 새로 켤 때 기본으로 채워둘 근무 가능 시간: 14:00~23:30
  // (첫 실행 기본값은 월~금만 적용하고 토요일은 비워둠)
  const DEFAULT_BUSINESS_DAY_INDICES = [0, 1, 2, 3, 4]; // 월~금
  const DEFAULT_BUSINESS_START_MIN = 14 * 60;      // 14:00
  const DEFAULT_BUSINESS_END_MIN = 23 * 60 + 30;   // 23:30
  const DEFAULT_BUSINESS_START_SLOT = (DEFAULT_BUSINESS_START_MIN - START_MIN) / SLOT_MIN;
  const DEFAULT_BUSINESS_END_SLOT = (DEFAULT_BUSINESS_END_MIN - START_MIN) / SLOT_MIN;

  /* ---------------- State ---------------- */
  let state = {
    availableCells: [],   // array of "day-slot" strings
    locations: [],         // {id, name}
    travelTimes: {},       // { "locIdA|locIdB": minutes }
    members: [],          // {id, name, locationIds: [locId, ...]}
    requests: [],         // {id, memberId, locationId, day, startSlot, duration}
    onceLimitedMemberIds: [],  // 이번 후보 생성에서 최대 1회만 배정되어야 하는 회원 id 목록
    excludedMemberIds: [],  // "미배정 회원": 후보 생성에서 아예 제외할 회원 id 목록
    // "수업 스케줄 생성2" 전용 설정 (새 후보 생성 알고리즘용, 기존 스케줄 생성과는 별개로 관리)
    onceLimitedMemberIds2: [],  // 스케줄 생성2에서 최대 1회만 배정되어야 하는 회원 id 목록
    excludedMemberIds2: [],  // 스케줄 생성2에서 후보 생성 시 아예 제외할 회원 id 목록
    // "수업 스케줄 생성3" 전용 설정 (생성1·생성2 엔진을 그대로 재사용해 후보 3개를 한 화면에 보여줌)
    onceLimitedMemberIds3: [],  // 스케줄 생성3에서 최대 1회만 배정되어야 하는 회원 id 목록
    excludedMemberIds3: []  // 스케줄 생성3에서 후보 생성 시 아예 제외할 회원 id 목록
  };
  let availableCells = new Set();
  // "수업 스케줄 생성3"의 후보B(전략0, 인원 최대)·후보C(전략1, 수업 횟수 최대) 저장소.
  // 옛 "수업 스케줄 생성1" 페이지가 쓰던 배열을 그대로 재사용한다 — regenerateCandidate/
  // restorePreviousCandidate/candidateHistory/candidateUndoStack이 이 배열과 strategyIndex를
  // 그대로 참조하므로, 생성1의 "재생성"·"이전 후보 다시보기" 기능을 생성3에 그대로 이식할 수 있다.
  let candidates = [];
  let schedule3Result = { candidateA: null }; // "수업 스케줄 생성3"의 후보A(체인 DP). 후보B/C는 candidates 배열 참고.
  // 회원 스케줄 추가(신청 시간 추가/삭제) 등 신청 데이터가 바뀌면 true로 표시해둔다.
  // "수업 스케줄 생성" 메뉴로 들어올 때 이 값이 true면, 최신 신청과 맞지 않는 옛 후보를 자동으로 비운다.
  let requestsChangedSinceGenerate = false;
  let requestsChangedSinceGenerate2 = false; // 위와 동일하지만 "수업 스케줄 생성2" 전용
  let requestsChangedSinceGenerate3 = false; // 위와 동일하지만 "수업 스케줄 생성3" 전용
  // 세 생성 버튼 중 하나라도 계산 중이면 true — 동시에 두 계산이 겹치면 selectionOverride가
  // 서로 다른 페이지의 회원 선택 목록을 잘못 참조할 수 있어(withSelectionOverride 참고), 이 플래그로 막는다.
  let generationInProgress = false;
  // 생성2/생성3의 다듬기 파이프라인(담금질 기법 등)은 수 초~수십 초가 걸릴 수 있어, 사용자가
  // "취소"를 누르면 다음 양보 지점(yieldToUI 직후)에서 즉시 멈출 수 있도록 이 플래그로 신호를
  // 보낸다. 실제 중단은 GenerationCancelledError를 던져 호출 스택을 그대로 타고 올라가
  // 각 생성 버튼 핸들러의 catch에서 잡는 방식으로 처리한다.
  let generationCancelRequested = false;
  class GenerationCancelledError extends Error {}

  // 후보 생성 중(수 초~수 분) 모바일 화면이 꺼져 진행이 중단된 것처럼 보이지 않도록 Wake Lock을
  // 건다. 브라우저가 탭 전환/화면 잠금 시 잠금을 자동 해제하므로, 다시 보이는 시점에
  // generationInProgress가 여전히 true면 재요청한다. 미지원 브라우저에서는 조용히 무시한다.
  let wakeLockSentinel = null;
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
    } catch (err) {
      wakeLockSentinel = null;
    }
  }
  async function releaseWakeLock() {
    const sentinel = wakeLockSentinel;
    wakeLockSentinel = null;
    if (sentinel) {
      try { await sentinel.release(); } catch (err) {}
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && generationInProgress) {
      acquireWakeLock();
    }
  });

  // "수업 스케줄 생성3"이 생성1·생성2의 엔진 함수(greedyAssign, runSchedule2Pipeline 등)를
  // 코드 복제 없이 그대로 재사용하기 위한 장치. 그 엔진들은 "미배정 회원"/"1회 제한 회원" 목록을
  // state.excludedMemberIds(2)/state.onceLimitedMemberIds(2)에서 직접(파라미터가 아니라) 읽는
  // 지점이 여러 곳(엔진 얕은 진입점뿐 아니라 그리디 DP·체인 DP 내부 깊숙이도) 있다. 그 모든
  // 지점을 일일이 파라미터로 바꾸는 대신, 이 오버라이드가 활성화된 동안만 "지금 봐야 할 목록"을
  // 바꿔치기한다 — 활성화하는 쪽(generateSchedule3Async)이 항상 동기 호출을 감싸는 형태로만
  // 쓰고 finally에서 즉시 되돌리므로, generationInProgress 가드와 함께 있으면 생성1·생성2 자신의
  // 계산(오버라이드 없음)에는 전혀 영향이 없다.
  let selectionOverride = null; // { excludedIds: string[], onceLimitIds: string[] } | null
  async function withSelectionOverride(excludedIds, onceLimitIds, asyncFn) {
    const prev = selectionOverride;
    // state.excludedMemberIds(2)/onceLimitedMemberIds(2)는 배열이라 .includes()로 조회한다 —
    // 오버라이드도 같은 타입(배열)이어야 currentExcludedIds() 등의 호출부가 오버라이드 유무와
    // 무관하게 동일한 코드로 동작한다.
    selectionOverride = { excludedIds: excludedIds.slice(), onceLimitIds: onceLimitIds.slice() };
    try {
      return await asyncFn();
    } finally {
      selectionOverride = prev;
    }
  }
  // 오버라이드가 활성화돼 있으면 그 목록을, 아니면 원래 각 페이지의 state 필드를 그대로 돌려준다 —
  // 오버라이드가 없을 때(생성1·생성2 자신의 호출)는 기존 동작과 완전히 동일하다.
  function currentExcludedIds() { return selectionOverride ? selectionOverride.excludedIds : state.excludedMemberIds; }
  function currentOnceLimitIds() { return selectionOverride ? selectionOverride.onceLimitIds : state.onceLimitedMemberIds; }
  function currentExcludedIds2() { return selectionOverride ? selectionOverride.excludedIds : state.excludedMemberIds2; }
  function currentOnceLimitIds2() { return selectionOverride ? selectionOverride.onceLimitIds : state.onceLimitedMemberIds2; }
  const PAGE_IDS = ["settings", "schedule3", "members", "memberSchedule"];
  // Pages from before the sidebar redesign ("requests"/"candidates"/"confirm"), and "schedule"/"schedule2"
  // from before those menus were removed, all live under "schedule3" now.
  const OLD_PAGE_TO_NEW = {
    settings: "settings", requests: "schedule3", candidates: "schedule3", confirm: "schedule3",
    schedule: "schedule3", schedule2: "schedule3"
  };
  let currentPage = "settings";

  /* ---------------- Utils ---------------- */
  function minutesLabel(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function slotLabel(slotIndex) {
    return minutesLabel(START_MIN + slotIndex * SLOT_MIN);
  }

  function endLabel(startSlot, durationMin) {
    return minutesLabel(START_MIN + startSlot * SLOT_MIN + durationMin);
  }

  function cellKey(day, slot) { return day + "-" + slot; }

  function durationToSlots(min) { return min / SLOT_MIN; }

  function uid(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 9); }

  /* ---------------- Toast notifications ---------------- */
  let toastContainerEl = null;
  function showToast(message, type) {
    if (!toastContainerEl) {
      toastContainerEl = document.createElement("div");
      toastContainerEl.className = "toast-container";
      toastContainerEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastContainerEl);
    }
    const toast = document.createElement("div");
    toast.className = "toast toast-" + (type || "info");
    toast.textContent = message;
    toastContainerEl.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 2200);
  }

  // 후보 카드를 이미지(PNG)로 캡처해 다운로드한다. 편집취소·이전 후보·다음 후보·저장 버튼이 모인
  // actions 영역은 스크린샷에 의미가 없으므로 ignoreElements로 제외한다.
  async function saveCandidateCardAsImage(cardEl, title) {
    if (typeof html2canvas !== "function") {
      showToast("이미지 저장 기능을 불러오지 못했습니다.", "error");
      return;
    }
    // 좁은 모바일 화면에서는 요일별 그리드(.grid-scroll)가 화면 폭보다 넓어 가로 스크롤이
    // 걸리는데, html2canvas는 스크롤로 가려진 부분을 그리지 못해 화·수 등 뒤쪽 요일이 잘려
    // 저장된다. 캡처 전 실제로 필요한 전체 폭을 원본 DOM에서 측정해 두고, 캡처용 복제
    // 문서에서만 카드 폭을 그만큼 넓혀 스크롤 없이 월~토 전체가 한 번에 담기게 한다.
    const gridWrap = cardEl.querySelector(".grid-scroll");
    const neededWidth = gridWrap
      ? cardEl.offsetWidth + Math.max(0, gridWrap.scrollWidth - gridWrap.clientWidth)
      : null;
    const CAPTURE_ATTR = "data-capture-card";
    cardEl.setAttribute(CAPTURE_ATTR, "");
    try {
      const canvas = await html2canvas(cardEl, {
        backgroundColor: "#ffffff",
        scale: 2,
        ignoreElements: el => el.classList && el.classList.contains("candidate-card-actions"),
        // html2canvas가 repeating-linear-gradient 배경을 그리지 못하고 흰 배경으로 남기는 문제가
        // 있어(이동 시간 블록·제외 회원 블록에 사용 중), 캡처용 복제 문서에서만 무늬를 대표하는
        // 단색으로 바꿔치기한다. 화면에 실제로 보이는 원본 요소는 건드리지 않는다.
        onclone: clonedDoc => {
          clonedDoc.querySelectorAll(".cal-travel-block").forEach(el => {
            el.style.background = "#ffedd5";
          });
          clonedDoc.querySelectorAll(".cal-block.excluded").forEach(el => {
            el.style.background = "#e5e7eb";
          });
          if (neededWidth) {
            const clonedCard = clonedDoc.querySelector(`[${CAPTURE_ATTR}]`);
            if (clonedCard) {
              clonedCard.style.width = neededWidth + "px";
              clonedCard.style.maxWidth = "none";
            }
            clonedDoc.querySelectorAll(".grid-scroll").forEach(el => {
              el.style.overflow = "visible";
            });
          }
        }
      });
      canvas.toBlob(async blob => {
        if (!blob) {
          showToast("이미지 저장에 실패했습니다.", "error");
          return;
        }
        const dateLabel = new Date().toISOString().slice(0, 10);
        const filename = title.replace(/[\\/:*?"<>|]/g, "") + "_" + dateLabel + ".png";

        // 아이폰 Safari는 <a download>로 저장하면 "사진" 앱이 아닌 "파일" 앱으로 저장된다.
        // navigator.share로 이미지를 공유하면 공유 시트에 "이미지 저장" 항목이 뜨고,
        // 이를 선택하면 사진 앱에 저장된다. PC 브라우저도 Web Share API를 지원하는 경우가 있어
        // 모바일 기기에서만 공유 시트를 쓰고, PC에서는 바로 다운로드되게 한다.
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const file = new File([blob], filename, { type: "image/png" });
        if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
          // 공유 시트를 열기 직전에 안내 토스트를 띄운다. navigator.share()의 Promise는
          // 사용자가 시트에서 항목을 선택해 동작이 끝난 뒤에야 resolve되므로, await 이후에
          // 토스트를 띄우면 "선택하면 저장됩니다"라는 안내가 이미 선택을 마친 뒤에 나타나
          // 방금 한 행동을 다시 하라는 것처럼 오해를 준다.
          showToast("공유 시트에서 '이미지 저장'을 선택하면 사진 앱에 저장됩니다", "info");
          try {
            await navigator.share({ files: [file] });
            return;
          } catch (err) {
            if (err && err.name === "AbortError") return; // 사용자가 공유 취소
            // 공유 실패 시 아래 다운로드 방식으로 대체
          }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast("후보를 이미지로 저장했습니다", "success");
      }, "image/png");
    } catch (err) {
      showToast("이미지 저장에 실패했습니다.", "error");
    } finally {
      cardEl.removeAttribute(CAPTURE_ATTR);
    }
  }

  // 백업 복원 직후 reload()할 때 beforeunload/visibilitychange 핸들러가 옛 메모리 상태로
  // saveState()를 한 번 더 실행해 방금 덮어쓴 localStorage를 되돌리지 않도록 막는 플래그.
  let suppressAutosave = false;
  function saveState() {
    if (suppressAutosave) return;
    state.availableCells = Array.from(availableCells);
    state.candidates = candidates;
    state.schedule3Result = schedule3Result;
    state.currentPage = currentPage;
    state.startMinBase = START_MIN; // 슬롯 인덱스가 어느 시작 시각을 기준으로 저장됐는지 기록 (마이그레이션용)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // 근무 가능 시간 시작 선택창에 12:00, 12:30을 추가하면서 하루 슬롯의 기준 시각이 13:00에서
  // 12:00으로 1시간(6슬롯) 당겨졌다. 옛 기준(13:00 또는 그 이전 버전)으로 저장된 슬롯 인덱스는
  // 그대로 두면 시각이 1시간씩 밀려 보이므로, 새 기준에 맞게 전부 +shiftSlots만큼 옮겨준다.
  // 이미 새 기준으로 저장된 데이터(startMinBase === START_MIN)는 다시 옮기지 않는다.
  const LEGACY_START_MIN = 13 * 60;
  function migrateStartMinShift(parsed) {
    const savedBase = typeof parsed.startMinBase === "number" ? parsed.startMinBase : LEGACY_START_MIN;
    if (savedBase === START_MIN) return;
    const shiftSlots = (savedBase - START_MIN) / SLOT_MIN;
    parsed.availableCells = (parsed.availableCells || []).map(key => {
      const [dayStr, slotStr] = key.split("-");
      return cellKey(parseInt(dayStr, 10), parseInt(slotStr, 10) + shiftSlots);
    });
    (parsed.requests || []).forEach(r => { r.startSlot += shiftSlots; });
    // 옛 기준으로 계산된 후보는 시각이 안 맞으므로 다시 생성하도록 비운다.
    parsed.candidates = [];
  }

  // Pre-page-nav saves stored a numeric wizard step (1~5); map it onto the closest page.
  function pageFromLegacyStep(step) {
    if (step <= 2) return "settings";
    return "schedule";
  }

  // 옛 30분 슬롯 데이터를 새 10분 슬롯 인덱스로 환산 (근무 가능 시간 1칸 -> 3칸으로 확장)
  function migrateOldState(parsed) {
    const migratedAvailable = [];
    (parsed.availableCells || []).forEach(key => {
      const [dayStr, slotStr] = key.split("-");
      const day = parseInt(dayStr, 10);
      const oldSlot = parseInt(slotStr, 10);
      for (let i = 0; i < SLOT_SCALE; i++) {
        migratedAvailable.push(cellKey(day, oldSlot * SLOT_SCALE + i));
      }
    });
    const migratedRequests = (parsed.requests || []).map(r => ({
      ...r,
      startSlot: r.startSlot * SLOT_SCALE
    }));
    return {
      locations: parsed.locations || [],
      travelTimes: parsed.travelTimes || {},
      members: parsed.members || [],
      requests: migratedRequests,
      availableCells: migratedAvailable,
      // 후보 배정 결과는 옛 슬롯 기준으로 계산된 값이라 그대로 옮기지 않고 다시 생성하도록 비워둠
      candidates: [],
      currentPage: parsed.currentPage,
      currentStep: parsed.currentStep
    };
  }

  function loadState() {
    let hadSavedState = false;
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      let parsed = raw ? JSON.parse(raw) : null;
      if (!parsed) {
        const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
        if (oldRaw) {
          const oldParsed = JSON.parse(oldRaw);
          if (oldParsed) {
            parsed = migrateOldState(oldParsed);
            localStorage.removeItem(OLD_STORAGE_KEY);
          }
        }
      }
      if (parsed) {
        migrateStartMinShift(parsed);
        hadSavedState = true;
        state.locations = parsed.locations || [];
        state.travelTimes = parsed.travelTimes || {};
        state.members = parsed.members || [];
        state.requests = parsed.requests || [];
        state.onceLimitedMemberIds = parsed.onceLimitedMemberIds || [];
        state.excludedMemberIds = parsed.excludedMemberIds || [];
        state.onceLimitedMemberIds2 = parsed.onceLimitedMemberIds2 || [];
        state.excludedMemberIds2 = parsed.excludedMemberIds2 || [];
        state.onceLimitedMemberIds3 = parsed.onceLimitedMemberIds3 || [];
        state.excludedMemberIds3 = parsed.excludedMemberIds3 || [];
        availableCells = new Set(parsed.availableCells || []);
        candidates = parsed.candidates || [];
        schedule3Result = { candidateA: (parsed.schedule3Result && parsed.schedule3Result.candidateA) || null };
        // "수업 스케줄 생성1"/"생성2" 메뉴 삭제 이전에 저장된 생성3 결과(schedule3Result.candidateB/C)를
        // 새 저장소(candidates 배열)로 1회 이관한다 — candidates가 비어있을 때만(옛 candidates 값이
        // 남아있다면 그건 이미 폐지된 생성1 페이지의 결과라 더 이상 의미가 없으므로 생성3 쪽을 우선한다).
        if (parsed.schedule3Result && (parsed.schedule3Result.candidateB || parsed.schedule3Result.candidateC)) {
          candidates = [parsed.schedule3Result.candidateB, parsed.schedule3Result.candidateC].filter(Boolean);
        }
        if (PAGE_IDS.indexOf(parsed.currentPage) !== -1) {
          currentPage = parsed.currentPage;
        } else if (OLD_PAGE_TO_NEW[parsed.currentPage]) {
          currentPage = OLD_PAGE_TO_NEW[parsed.currentPage];
        } else if (parsed.currentStep >= 1 && parsed.currentStep <= 5) {
          currentPage = pageFromLegacyStep(parsed.currentStep);
        } else {
          currentPage = "settings";
        }
      }
    } catch (e) {
      console.warn("failed to load saved state", e);
    }
    // First-ever run: seed the trainer's usual branches, 지점 간 이동 시간, 근무 가능 시간
    // 이 비어있지 않도록 기본값을 채워둔다.
    if (!hadSavedState && state.locations.length === 0) {
      state.locations = DEFAULT_LOCATION_NAMES.map(name => ({ id: uid("loc"), name }));
      for (let i = 0; i < state.locations.length; i++) {
        for (let j = i + 1; j < state.locations.length; j++) {
          const locA = state.locations[i], locB = state.locations[j];
          state.travelTimes[pairKey(locA.id, locB.id)] = defaultTravelMinutesFor(locA.name, locB.name);
        }
      }
    }
    if (!hadSavedState && availableCells.size === 0) {
      DEFAULT_BUSINESS_DAY_INDICES.forEach(di => {
        for (let s = DEFAULT_BUSINESS_START_SLOT; s < DEFAULT_BUSINESS_END_SLOT; s++) availableCells.add(cellKey(di, s));
      });
    }
    // Migrate members saved under the old single-branch field (locationId) to the
    // multi-branch array (locationIds), backfilling from their first request if neither is set.
    state.members.forEach(m => {
      if (!Array.isArray(m.locationIds)) {
        m.locationIds = m.locationId ? [m.locationId] : [];
        delete m.locationId;
      }
      if (m.locationIds.length === 0) {
        const firstReq = state.requests.find(r => r.memberId === m.id && r.locationId);
        if (firstReq) m.locationIds = [firstReq.locationId];
      }
      if (typeof m.memo !== "string") m.memo = "";
      if (m.category === "PT 등록") m.category = "등록"; // 구분 문구 변경(PT 등록 → 등록) 마이그레이션
    });
    // Requests no longer pin a single branch of their own — a member's desired time is now
    // eligible at any of their registered branches, decided per-candidate at generation time.
    state.requests.forEach(r => { delete r.locationId; });
    // 회원 구분(상담/등록)이 바뀐 뒤에도 그 회원의 기존 신청들이 옛 구분 기준 길이(예: 상담 30분)를
    // 그대로 갖고 있는 경우를 바로잡는다 — 신청의 길이는 항상 회원의 현재 구분과 일치해야 한다.
    let hadDurationMismatch = false;
    state.requests.forEach(r => {
      const member = state.members.find(m => m.id === r.memberId);
      if (!member) return;
      const correctDuration = sessionDurationFor(member);
      if (r.duration !== correctDuration) { r.duration = correctDuration; hadDurationMismatch = true; }
    });
    if (hadDurationMismatch) candidates = [];
    // 전략(STRATEGIES) 목록이 줄어들어, 더 이상 존재하지 않는 strategyIndex를 가리키는 옛
    // 후보가 남아있으면 "다음 후보" 클릭 시 STRATEGIES[strategyIndex]가 undefined라 에러가
    // 나므로, 그런 후보가 하나라도 있으면 전체를 비워 다시 생성하게 한다.
    if (candidates.some(c => !STRATEGIES[c.strategyIndex])) candidates = [];
    // 삭제된 회원이나 상담 회원(이미 항상 1회로 제한됨)을 가리키는 1회 제한 설정은 정리한다.
    state.onceLimitedMemberIds = state.onceLimitedMemberIds.filter(id => isOnceLimitEligible(memberById(id)));
    // 삭제된 회원을 가리키는 "미배정 회원" 설정은 정리한다.
    state.excludedMemberIds = state.excludedMemberIds.filter(id => !!memberById(id));
    // 스케줄 생성2 전용 설정도 동일하게 정리한다.
    state.onceLimitedMemberIds2 = state.onceLimitedMemberIds2.filter(id => isOnceLimitEligible(memberById(id)));
    state.excludedMemberIds2 = state.excludedMemberIds2.filter(id => !!memberById(id));
    // 스케줄 생성3 전용 설정도 동일하게 정리한다.
    state.onceLimitedMemberIds3 = state.onceLimitedMemberIds3.filter(id => isOnceLimitEligible(memberById(id)));
    state.excludedMemberIds3 = state.excludedMemberIds3.filter(id => !!memberById(id));
    // 일요일 기능이 제거되어(DAYS에서 빠짐), 옛 요일 인덱스 6(일요일)을 가리키던 데이터가 남아있다면 정리한다.
    const hadSunday = state.requests.some(r => r.day >= DAYS.length)
      || Array.from(availableCells).some(k => parseInt(k.split("-")[0], 10) >= DAYS.length);
    if (hadSunday) {
      state.requests = state.requests.filter(r => r.day < DAYS.length);
      availableCells = new Set(Array.from(availableCells).filter(k => parseInt(k.split("-")[0], 10) < DAYS.length));
      // 일요일 배정이 포함됐을 수 있는 기존 후보는 다시 계산하도록 비운다.
      candidates = [];
    }
  }

  function memberById(id) { return state.members.find(m => m.id === id); }

  // 상담 회원은 확보 시간이 짧다(30분) — 그 외(등록 회원)는 기본 수업 시간(60분).
  // 구분이 비어있으면 상담으로 취급한다(다른 곳의 기본값과 동일).
  function sessionDurationFor(member) {
    return (member && (member.category || "상담")) === "상담" ? CONSULT_DURATION_MIN : SESSION_DURATION_MIN;
  }

  // 상담 회원은 최대 1회까지만, 그 외(등록 회원)는 최대 MAX_SESSIONS_PER_MEMBER(2)회까지.
  // "1회 제한 회원"으로 지정된 회원은 구분과 무관하게 최대 1회로 제한된다.
  function maxSessionsFor(member) {
    if (!member) return 1;
    if (currentOnceLimitIds().includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }

  // 상담 회원은 이미 항상 최대 1회로 제한되므로(위 규칙), "1회 제한 회원" 목록에는 표시하지 않는다.
  function isOnceLimitEligible(member) {
    return !!member && (member.category || "상담") !== "상담";
  }

  // "회원 스케줄 추가" 페이지의 회원 탭과 같은 방식: 지점은 풀네임 대신 한 글자 배지(전체
  // 이름은 title 툴팁)로, 그 뒤에 이름을 붙인다 — 지점 풀네임을 쓰면 칩이 너무 길어지기 때문.
  // 지점이 2개 이상인 회원은 배지도 모두 표시한다(회원 탭과 동일).
  // createMemberSelectionWidget(미배정/1회 제한 회원 위젯)이 공통으로 쓴다.
  function appendOnceLimitMemberLabel(container, member) {
    member.locationIds.forEach(locId => {
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
  function compareOnceLimitMembers(a, b) {
    const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
    const aIdx = locOrder.has(a.locationIds[0]) ? locOrder.get(a.locationIds[0]) : Infinity;
    const bIdx = locOrder.has(b.locationIds[0]) ? locOrder.get(b.locationIds[0]) : Infinity;
    return (aIdx - bIdx) || a.name.localeCompare(b.name, "ko");
  }


  function locationById(id) { return state.locations.find(l => l.id === id); }

  // SOLO_TRAVEL_LOCATION_NAMES 세 지점을 모두 등록해둔 회원 id 집합. greedyAssign(생성 시
  // "이동-회원-이동" 금지)과 eligibleSwapMembersFor(수동 교체 시 같은 규칙 적용)가 공용으로 쓴다.
  function soloTravelMemberIds() {
    // 이름이 정확히 하나씩만 매칭돼야 규칙이 어느 지점을 가리키는지 모호하지 않다 — 같은
    // 이름을 가진 지점이 실수로 두 개 등록되면(중복 매칭) 전체 개수가 3개를 넘어서게 되고,
    // 이럴 땐 어느 쪽이 진짜인지 알 수 없으므로 규칙 자체를 비활성화한다(잘못된 지점에
    // 하드 로직을 적용하는 것보다 안전).
    const soloTravelLocationIds = state.locations.filter(l => SOLO_TRAVEL_LOCATION_NAMES.includes(l.name)).map(l => l.id);
    if (soloTravelLocationIds.length !== SOLO_TRAVEL_LOCATION_NAMES.length) return new Set();
    return new Set(state.members.filter(m => soloTravelLocationIds.every(id => m.locationIds.includes(id))).map(m => m.id));
  }

  function memberColor(id) {
    const idx = state.members.findIndex(m => m.id === id);
    if (idx === -1) return BLOCK_COLOR;
    const hue = MEMBER_COLORS[idx % MEMBER_COLORS.length];
    const tier = Math.floor(idx / MEMBER_COLORS.length) % MEMBER_COLOR_SHADE_STEPS.length;
    return shadeColor(hue, MEMBER_COLOR_SHADE_STEPS[tier]);
  }

  function locationColor(locId) {
    const idx = state.locations.findIndex(l => l.id === locId);
    return idx === -1 ? null : MEMBER_COLORS[idx % MEMBER_COLORS.length];
  }

  function pairKey(idA, idB) { return [idA, idB].sort().join("|"); }

  function travelMinutes(locIdA, locIdB) {
    if (!locIdA || !locIdB || locIdA === locIdB) return 0;
    const v = state.travelTimes[pairKey(locIdA, locIdB)];
    return typeof v === "number" && v >= 0 ? v : 0;
  }

  // 드래그로 세션 블록을 옮기는 동안, 놓았을 때 호출할 이동 함수·그 세션의 길이(슬롯 수)·
  // "여기 놓아도 되는지" 실시간으로 검사할 함수를 잠시 들고 있는다. 그리드는 렌더할 때마다
  // 통째로 다시 그려지므로(container.innerHTML = ""), 드래그 시작 시점의 블록 정보를 렌더
  // 함수 바깥(모듈 스코프)에 붙잡아둬야 drop/dragover 이벤트에서 찾을 수 있다. durationSlots는
  // 드래그 중 미리보기를 그 세션 길이만큼(예: 1시간이면 6칸) 보여주기 위한 값이다 — 실제
  // 10분짜리 배경 셀 하나만 강조하면 옮겨질 범위를 알기 어렵다. validator는 놓았을 때 성공할지
  // 실패할지를 미리 보여주기 위한 것으로, 실제 커밋 함수(onMove)와 항상 같은 기준으로 판단해야
  // 한다(각 블록이 canMoveTo로 함께 제공한다). sourceContainer는 드래그가 시작된 그리드
  // 컨테이너 자신이다 — 후보A/B/C처럼 여러 그리드가 동시에 화면에 떠 있을 때, 다른 그리드
  // 위에서 dragover/drop이 걸려도 이 값과 비교해 자신이 시작한 드래그가 아니면 무시한다
  // (그러지 않으면 A에서 시작한 드래그를 B 위에 놓았을 때 B의 좌표로 A의 데이터가 바뀐다).
  let draggingMoveHandler = null;
  let draggingDurationSlots = 1;
  let draggingValidator = null;
  let draggingSourceContainer = null;

  // 모바일 등 터치 환경에는 네이티브 HTML5 드래그(draggable/dragstart)가 아예 붙지 않으므로,
  // Pointer Events로 같은 흐름(누르고 있으면 시작 → 이동 중 미리보기 → 놓으면 커밋)을 별도
  // 구현해 보완한다. 마우스는 이미 네이티브 드래그가 잘 동작하니 그대로 두고(pointerType이
  // "mouse"면 바로 리턴), 터치/펜일 때만 개입한다. 스크롤과 드래그가 똑같이 "손가락으로 누르고
  // 움직이기"라 즉시 드래그를 시작하면 목록을 내리려던 손가락까지 매번 드래그로 뺏어가므로,
  // 일정 시간(LONG_PRESS_MS) 움직임 없이 눌려 있어야만 드래그가 시작되게 해 스크롤과 구분한다.
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_MOVE_TOLERANCE = 10; // px - 대기 중 이만큼 움직이면 스크롤 의도로 보고 드래그 시작을 취소

  // el: 드래그 가능한 블록(cal-block/cal-travel-block) 엘리먼트. container: 그 블록이 속한
  // cal-grid(renderGrid가 그린 컨테이너) - renderGrid가 컨테이너에 심어둔 _dndHelpers(cellAtPoint·
  // showDropPreview·clearDropPreview·clearDropTargets·paintDropTargets)를 그대로 재사용해
  // dragover/drop 네이티브 이벤트 리스너와 동일한 판정 로직을 탄다. meta: { onMove, durationSlots,
  // validator } - 네이티브 dragstart가 draggingMoveHandler 등에 채워 넣던 값과 동일하다.
  function attachTouchDrag(el, container, meta) {
    let timer = null;
    let pointerId = null;
    let startX = 0, startY = 0;
    let active = false;

    function findDropCell(x, y) {
      const helpers = container._dndHelpers;
      if (!helpers) return null;
      const cell = helpers.cellAtPoint(x, y);
      // elementsFromPoint는 화면 전체에서 찾으므로, 후보A/B/C처럼 여러 그리드가 동시에 떠 있을 때
      // 다른 컨테이너의 칸이 잡히지 않도록 이 드래그를 시작한 컨테이너 소속인지 반드시 확인한다.
      return cell && container.contains(cell) ? cell : null;
    }

    function cleanup() {
      if (timer) { clearTimeout(timer); timer = null; }
      pointerId = null;
      // active(이 인스턴스가 실제로 beginDrag까지 진행한 경우)일 때만 전역 드래그 상태를 지운다.
      // 그러지 않으면(멀티터치로 다른 블록을 동시에 누르다 이쪽이 취소되는 경우) 실제로 진행 중인
      // 다른 드래그의 draggingMoveHandler 등을 여기서 지워버려 그 드롭이 조용히 무시될 수 있다.
      if (active) {
        draggingMoveHandler = null;
        draggingValidator = null;
        draggingDurationSlots = 1;
        draggingSourceContainer = null;
        const helpers = container._dndHelpers;
        if (helpers) { helpers.clearDropPreview(); helpers.clearDropTargets(); }
      }
      active = false;
      el.classList.remove("dragging", "touch-drag-pending");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
    }

    function beginDrag() {
      active = true;
      draggingMoveHandler = meta.onMove;
      draggingDurationSlots = meta.durationSlots;
      draggingValidator = meta.validator;
      draggingSourceContainer = container;
      el.classList.remove("touch-drag-pending");
      el.classList.add("dragging");
      const helpers = container._dndHelpers;
      if (helpers) helpers.paintDropTargets();
    }

    function onMove(e) {
      if (e.pointerId !== pointerId) return;
      if (!active) {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE) cleanup();
        return;
      }
      e.preventDefault();
      const cell = findDropCell(e.clientX, e.clientY);
      const helpers = container._dndHelpers;
      if (cell) {
        const day = parseInt(cell.dataset.day, 10);
        const slot = parseInt(cell.dataset.slot, 10);
        const kind = draggingValidator ? draggingValidator(day, slot).kind : "move";
        helpers.showDropPreview(day, slot, kind);
      } else {
        helpers.clearDropPreview();
      }
    }

    function onUp(e) {
      if (e.pointerId !== pointerId) return;
      if (!active) { cleanup(); return; }
      const cell = findDropCell(e.clientX, e.clientY);
      const handler = draggingMoveHandler;
      cleanup();
      if (cell && handler) handler(parseInt(cell.dataset.day, 10), parseInt(cell.dataset.slot, 10));
    }

    function onCancel(e) {
      if (e.pointerId !== pointerId) return;
      cleanup();
    }

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return; // 마우스는 네이티브 드래그(draggable)로 처리
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      el.classList.add("touch-drag-pending");
      el.setPointerCapture(pointerId);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onCancel);
      timer = setTimeout(() => {
        timer = null;
        beginDrag();
      }, LONG_PRESS_MS);
    });
  }

  /* ---------------- Grid rendering ---------------- */
  // options: { blocks: [{day, startSlot, duration, label, loc, sublabel, color, excluded, onDelete, onMove}],
  //   travelBlocks: [{day, startSlot, duration, label, type: "travel" | "break"}] }
  // onDelete(있는 블록만): 마우스 호버 시 우측 상단에 삭제(×) 버튼이 나타난다 (PC 전용 기능).
  // onMove(있는 블록만): 블록을 다른 (day, slot) 셀에 드래그해 놓으면 onMove(day, slot)를 호출한다.
  function renderGrid(container, availableSet, options) {
    options = options || {};
    const rangeStart = typeof options.rangeStartSlot === "number" ? options.rangeStartSlot : 0;
    const rangeEnd = typeof options.rangeEndSlot === "number" ? options.rangeEndSlot : SLOT_COUNT;
    container.innerHTML = "";
    container.style.gridTemplateRows = "30px repeat(" + (rangeEnd - rangeStart) + ", 16px)";

    // corner
    const corner = document.createElement("div");
    corner.className = "cal-head corner";
    corner.style.gridColumn = "1";
    corner.style.gridRow = "1";
    container.appendChild(corner);

    // day headers
    DAYS.forEach((d, di) => {
      const head = document.createElement("div");
      head.className = "cal-head";
      head.textContent = d;
      head.style.gridColumn = String(di + 2);
      head.style.gridRow = "1";
      container.appendChild(head);
    });

    // time labels + background cells
    for (let s = rangeStart; s < rangeEnd; s++) {
      const row = s - rangeStart + 2;
      const isHour = (START_MIN + s * SLOT_MIN) % 60 === 0;
      if (isHour) {
        const label = document.createElement("div");
        label.className = "cal-timelabel" + (s === rangeStart ? " cal-timelabel-first" : "");
        label.textContent = slotLabel(s);
        label.style.gridColumn = "1";
        label.style.gridRow = String(row);
        container.appendChild(label);
      }
      for (let di = 0; di < DAYS.length; di++) {
        const cell = document.createElement("div");
        const key = cellKey(di, s);
        const isAvailable = availableSet.has(key);
        cell.className = "cal-cell" + (isHour ? " hour-start" : "") + (isAvailable ? " available" : "");
        cell.dataset.day = String(di);
        cell.dataset.slot = String(s);
        cell.style.gridColumn = String(di + 2);
        cell.style.gridRow = String(row);
        container.appendChild(cell);
      }
    }

    // travel/break-time indicators (이동·휴식 시간), rendered under the session blocks
    // 표시 범위(rangeStart~rangeEnd) 밖으로 걸치는 부분은 잘라내고, 완전히 범위 밖이면 그리지 않는다.
    (options.travelBlocks || []).forEach(t => {
      const clippedStart = Math.max(t.startSlot, rangeStart);
      const clippedEnd = Math.min(t.startSlot + Math.round(t.duration / SLOT_MIN), rangeEnd);
      if (clippedEnd <= clippedStart) return;
      const travel = document.createElement("div");
      travel.className = t.type === "break" ? "cal-break-block" : "cal-travel-block";
      travel.style.gridColumn = String(t.day + 2);
      travel.style.gridRow = (clippedStart - rangeStart + 2) + " / span " + (clippedEnd - clippedStart);
      travel.title = t.label;
      travel.textContent = t.label;
      // 이동 시간 블록 자체는 옮길 수 있는 데이터가 아니라(두 수업 사이 간격에서 계산되는
      // 값일 뿐), 드래그·클릭 모두 "바로 다음 수업"(t.onMove/t.contextMenuItems가 감싸고
      // 있는 세션)을 이 이동 시간 앞뒤로 당기거나 미루는 동작으로 연결한다. 미리보기 크기는
      // 이동 시간 블록의 짧은 길이가 아니라 실제로 옮겨질 다음 수업의 길이(t.moveDurationSlots)를
      // 써야 얼마만큼의 자리가 필요한지 정확히 보여줄 수 있다.
      if (t.onMove) {
        travel.draggable = true;
        travel.classList.add("draggable");
        travel.addEventListener("dragstart", (e) => {
          draggingMoveHandler = t.onMove;
          draggingDurationSlots = t.moveDurationSlots || durationToSlots(t.duration);
          draggingValidator = t.canMoveTo || null;
          draggingSourceContainer = container;
          travel.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "");
          paintDropTargets();
        });
        travel.addEventListener("dragend", () => {
          travel.classList.remove("dragging");
          draggingMoveHandler = null;
          draggingValidator = null;
          draggingDurationSlots = 1;
          draggingSourceContainer = null;
          clearDropPreview();
          clearDropTargets();
        });
        attachTouchDrag(travel, container, {
          onMove: t.onMove,
          durationSlots: t.moveDurationSlots || durationToSlots(t.duration),
          validator: t.canMoveTo || null
        });
      }
      if (t.contextMenuItems) {
        travel.style.cursor = "pointer";
        travel.addEventListener("click", (e) => {
          e.stopPropagation();
          openContextMenu(e.clientX, e.clientY, t.contextMenuItems(e.clientX, e.clientY));
        });
      }
      container.appendChild(travel);
    });

    // blocks (assigned sessions) on top
    (options.blocks || []).forEach(b => {
      const clippedStart = Math.max(b.startSlot, rangeStart);
      const clippedEnd = Math.min(b.startSlot + durationToSlots(b.duration), rangeEnd);
      if (clippedEnd <= clippedStart) return;
      const block = document.createElement("div");
      block.className = "cal-block" + (b.excluded ? " excluded" : "") + (b.confirmed ? " confirmed" : "");
      // 확정된 일정은 흰색을 넉넉히 섞은 배경으로 칠하고, 테두리는 원래 회원 색상 그대로 두껍게
      // 둘러서 미확정 블록과 한눈에 확 구분되게 한다.
      if (!b.excluded) {
        block.style.background = b.confirmed
          ? "linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.72)), " + b.color
          : b.color;
        if (b.confirmed) block.style.borderColor = b.color;
      }
      block.style.gridColumn = String(b.day + 2);
      block.style.gridRow = (clippedStart - rangeStart + 2) + " / span " + (clippedEnd - clippedStart);
      block.title = b.label + (b.loc ? " (" + b.loc + ")" : "") + (b.sublabel ? " · " + b.sublabel : "");
      const nameEl = document.createElement("span");
      nameEl.className = "name";
      nameEl.textContent = b.label;
      block.appendChild(nameEl);
      if (b.loc) {
        const locEl = document.createElement("span");
        locEl.className = "loc";
        locEl.textContent = b.loc;
        block.appendChild(locEl);
      }
      const timeEl = document.createElement("span");
      timeEl.className = "time";
      timeEl.textContent = b.sublabel || "";
      block.appendChild(timeEl);
      if (b.confirmed) {
        const badge = document.createElement("span");
        badge.className = "cal-block-confirmed-badge";
        badge.textContent = "✓ 확정";
        block.appendChild(badge);
      }
      if (!b.excluded && b.onMove) {
        block.draggable = true;
        block.classList.add("draggable");
        block.addEventListener("dragstart", (e) => {
          draggingMoveHandler = b.onMove;
          draggingDurationSlots = durationToSlots(b.duration);
          draggingValidator = b.canMoveTo || null;
          draggingSourceContainer = container;
          block.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "");
          paintDropTargets();
        });
        block.addEventListener("dragend", () => {
          block.classList.remove("dragging");
          draggingMoveHandler = null;
          draggingValidator = null;
          draggingDurationSlots = 1;
          draggingSourceContainer = null;
          clearDropPreview();
          clearDropTargets();
        });
        attachTouchDrag(block, container, {
          onMove: b.onMove,
          durationSlots: durationToSlots(b.duration),
          validator: b.canMoveTo || null
        });
      }
      if (!b.excluded && b.onDelete) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "cal-block-delete";
        delBtn.title = "삭제";
        delBtn.textContent = "×";
        delBtn.addEventListener("mousedown", (e) => e.stopPropagation());
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          b.onDelete();
        });
        block.appendChild(delBtn);
      }
      if (!b.excluded && b.onClick) {
        block.style.cursor = "pointer";
        block.addEventListener("click", () => b.onClick());
      }
      if (!b.excluded && b.contextMenuItems) {
        block.style.cursor = "pointer";
        block.addEventListener("click", (e) => {
          e.stopPropagation();
          openContextMenu(e.clientX, e.clientY, b.contextMenuItems(e.clientX, e.clientY));
        });
      }
      container.appendChild(block);
    });

    // 세션/이동/빈 시간 블록은 배경 cal-cell 위에 같은 컨테이너의 형제 엘리먼트로 그려지므로,
    // 드래그 중인 포인터가 그 블록 위에 있으면 dragover/drop 이벤트가 (사이에 아무 조상 관계도
    // 없는) cal-cell까지 전달되지 않고 그 블록에서 그냥 끝나버린다(블록엔 dragover/drop 핸들러가
    // 없으므로 브라우저 기본 동작상 드롭이 거부됨) — 그래서 개별 셀에 리스너를 붙이는 대신
    // 컨테이너 하나에만 붙이고, 실제 드롭 위치는 포인터 좌표 아래 쌓인 엘리먼트들 중에서
    // cal-cell을 찾아(document.elementsFromPoint) 판단한다. 이러면 어떤 블록이 위에 덮여
    // 있어도 그 밑의 실제 요일·슬롯을 항상 정확히 찾아낼 수 있다.
    function cellAtPoint(x, y) {
      return document.elementsFromPoint(x, y).find(el => el.classList && el.classList.contains("cal-cell")) || null;
    }
    // 드래그 중인 자리를 셀 하나(10분)가 아니라 옮기는 세션 길이만큼(draggingDurationSlots)
    // 통짜로 미리 보여준다 — 실제 배정 블록과 똑같이 gridRow를 여러 칸 span해서 그린, 클릭은
    // 통과시키는(pointer-events: none) 미리보기 엘리먼트 하나를 그때그때 위치만 옮겨가며 재사용한다.
    let dropPreviewEl = null;
    function clearDropPreview() {
      if (dropPreviewEl) { dropPreviewEl.remove(); dropPreviewEl = null; }
    }
    // 드래그를 시작하는 순간, 포인터가 아직 지나가보지 않은 칸까지 포함해 이 세션이 놓일 수
    // 없는 칸 전부를 한 번에 옅게 표시한다 — 한 칸씩 지나가 봐야만 가능 여부를 알 수 있으면
    // "어디에 놓을 수 있는지" 전체 그림을 파악하기 어렵다. draggingValidator(dragstart에서 붙잡아둔
    // canMoveTo)를 셀마다 한 번씩만(드래그 시작 시 1회) 돌리면 되므로 비용은 크지 않다.
    // "시작 가능한 칸" 하나(10분)만 표시하면, 실제로는 1시간 자리인데도 10분만 되는 것처럼
    // 보여 헷갈린다 — 마우스를 올렸을 때 보이는 실제 미리보기(showDropPreview)와 같은 기준으로,
    // 시작 가능한 칸부터 옮길 세션 길이(draggingDurationSlots)만큼 이어지는 범위 전체를
    // "놓을 수 있음"으로 넓혀서 표시한다.
    function paintDropTargets() {
      if (!draggingValidator) return;
      const reachableByDay = [];
      for (let day = 0; day < DAYS.length; day++) {
        const reachable = new Set();
        for (let slot = rangeStart; slot < rangeEnd; slot++) {
          if (draggingValidator(day, slot).ok) {
            for (let k = 0; k < draggingDurationSlots; k++) reachable.add(slot + k);
          }
        }
        reachableByDay.push(reachable);
      }
      container.querySelectorAll(".cal-cell").forEach(cell => {
        const day = parseInt(cell.dataset.day, 10);
        const slot = parseInt(cell.dataset.slot, 10);
        cell.classList.toggle("cal-cell-blocked", !reachableByDay[day].has(slot));
      });
    }
    function clearDropTargets() {
      container.querySelectorAll(".cal-cell-blocked").forEach(cell => cell.classList.remove("cal-cell-blocked"));
    }
    // kind: "move"(빈 자리로 이동) / "swap"(다른 배정과 맞바꾸기) / "invalid"(놓을 수 없음) —
    // 색으로 세 가지를 구분해서, 놓기 전에 "그냥 옮기는 건지 남의 자리와 맞바뀌는 건지"까지
    // 미리 알 수 있게 한다(맞바꾸기인 줄 모르고 놨다가 놀라는 일이 없도록).
    function showDropPreview(day, startSlot, kind) {
      const clippedStart = Math.max(startSlot, rangeStart);
      const clippedEnd = Math.min(startSlot + draggingDurationSlots, rangeEnd);
      if (clippedEnd <= clippedStart) { clearDropPreview(); return; }
      if (!dropPreviewEl) {
        dropPreviewEl = document.createElement("div");
        dropPreviewEl.className = "cal-drop-preview";
        container.appendChild(dropPreviewEl);
      }
      dropPreviewEl.style.gridColumn = String(day + 2);
      dropPreviewEl.style.gridRow = (clippedStart - rangeStart + 2) + " / span " + (clippedEnd - clippedStart);
      dropPreviewEl.classList.toggle("invalid", kind === "invalid");
      dropPreviewEl.classList.toggle("swap", kind === "swap");
    }
    // 그리드 컨테이너 자체(scheduleGridEl 등)는 요청 편집마다 renderGrid가 재호출돼도 같은
    // DOM 노드가 재사용된다(innerHTML만 비움) — 컨테이너 리스너를 매 렌더마다 새로 붙이면
    // 이전 렌더의 리스너가 계속 쌓여 메모리가 새므로, dataset 플래그로 한 번만 붙인다. 대신
    // cellAtPoint/showDropPreview 등은 이번 렌더의 최신 클로저를 container._dndHelpers에
    // 매 렌더마다 갱신해두고, 리스너는 항상 그 최신 값을 통해서만 호출한다.
    container._dndHelpers = { cellAtPoint, clearDropPreview, clearDropTargets, showDropPreview, paintDropTargets };
    if (!container.dataset.dndBound) {
      container.dataset.dndBound = "1";
      container.addEventListener("dragover", (e) => {
        if (!draggingMoveHandler || draggingSourceContainer !== container) return;
        e.preventDefault();
        const helpers = container._dndHelpers;
        const cell = helpers.cellAtPoint(e.clientX, e.clientY);
        if (cell) {
          const day = parseInt(cell.dataset.day, 10);
          const slot = parseInt(cell.dataset.slot, 10);
          // 검사 함수(canMoveTo)가 없는 블록(구버전 호출부 대비 방어)은 항상 놓을 수 있는 것으로
          // 보여준다 — 실시간 미리보기가 없다고 실제 드롭까지 막지는 않기 때문이다.
          const kind = draggingValidator ? draggingValidator(day, slot).kind : "move";
          helpers.showDropPreview(day, slot, kind);
        } else {
          helpers.clearDropPreview();
        }
      });
      container.addEventListener("dragleave", (e) => {
        if (!container.contains(e.relatedTarget)) container._dndHelpers.clearDropPreview();
      });
      container.addEventListener("drop", (e) => {
        if (!draggingMoveHandler || draggingSourceContainer !== container) return;
        e.preventDefault();
        const helpers = container._dndHelpers;
        helpers.clearDropPreview();
        helpers.clearDropTargets();
        const cell = helpers.cellAtPoint(e.clientX, e.clientY);
        const handler = draggingMoveHandler;
        draggingMoveHandler = null;
        draggingSourceContainer = null;
        if (cell) handler(parseInt(cell.dataset.day, 10), parseInt(cell.dataset.slot, 10));
      });
    }
  }

  /* ---------------- Generic block click menu (그리드 블록 클릭 메뉴) ---------------- */
  let activeContextMenuEl = null;

  function closeContextMenu() {
    if (activeContextMenuEl) {
      activeContextMenuEl.remove();
      activeContextMenuEl = null;
    }
  }

  // items: [{ label, onClick, disabled, danger }] 또는 { separator: true }
  function openContextMenu(x, y, items) {
    closeContextMenu();
    const menu = document.createElement("div");
    menu.className = "block-context-menu";
    items.forEach(it => {
      if (it.separator) {
        const sep = document.createElement("div");
        sep.className = "block-context-menu-sep";
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "block-context-menu-item" + (it.danger ? " danger" : "");
      btn.textContent = it.label;
      btn.disabled = !!it.disabled;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeContextMenu();
        if (it.onClick) it.onClick();
      });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const left = Math.min(x, Math.max(0, window.innerWidth - rect.width - 8));
    const top = Math.min(y, Math.max(0, window.innerHeight - rect.height - 8));
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    activeContextMenuEl = menu;
  }

  document.addEventListener("click", (e) => {
    if (activeContextMenuEl && !activeContextMenuEl.contains(e.target)) closeContextMenu();
  });
  document.addEventListener("contextmenu", (e) => {
    if (activeContextMenuEl && !activeContextMenuEl.contains(e.target)) closeContextMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeContextMenu();
  });
  window.addEventListener("scroll", closeContextMenu, true);
  window.addEventListener("resize", closeContextMenu);

  /* ---------------- Settings page: locations & travel time ---------------- */
  const locationForm = document.getElementById("locationForm");
  const locationNameInput = document.getElementById("locationName");
  const locationHintEl = document.getElementById("locationHint");
  const locationListEl = document.getElementById("locationList");
  const travelTitleEl = document.getElementById("travelTitle");
  const travelMatrixEl = document.getElementById("travelMatrix");

  function membersUsingLocation(locId) {
    return state.members.filter(m => (m.locationIds || []).includes(locId));
  }

  let editingLocationId = null;

  // 기본 설정(근무 가능 시간·지점·이동 시간)이 바뀌면 이미 생성된 수업 스케줄 후보는 더 이상
  // 유효하지 않을 수 있으므로 자동으로 비운다.
  function invalidateCandidates() {
    const hasResult = candidates.length > 0 || !!schedule3Result.candidateA;
    if (!hasResult) return;
    candidates = [];
    schedule3Result = { candidateA: null };
    Object.keys(candidateHistory).forEach(k => delete candidateHistory[k]);
    Object.keys(candidateUndoStack).forEach(k => delete candidateUndoStack[k]);
    Object.keys(candidatePools).forEach(k => delete candidatePools[k]);
    candidateAPool = [];
    renderSchedule3Result();
    generateHint3El.textContent = "기본 설정이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    saveState();
    showToast("기본 설정이 변경되어 생성된 수업 스케줄 후보가 초기화되었습니다", "info");
  }

  function deleteLocation(loc) {
    const affectedMembers = membersUsingLocation(loc.id);
    const remainingLocations = state.locations.filter(l => l.id !== loc.id);
    if (affectedMembers.length > 0 && remainingLocations.length === 0) {
      alert("'" + loc.name + "' 지점을 사용하는 회원 " + affectedMembers.length + "명이 있고, 다른 지점이 없어 삭제할 수 없습니다. 다른 지점을 먼저 등록해주세요.");
      return;
    }
    const fallbackLoc = remainingLocations[0];
    const msg = affectedMembers.length > 0
      ? "'" + loc.name + "' 지점을 사용하는 회원 " + affectedMembers.length + "명이 있습니다. 삭제하면 해당 회원의 지점 목록에서 제외됩니다(지점이 그것뿐이었던 회원은 '" + fallbackLoc.name + "' 지점으로 자동 변경). 계속할까요?"
      : "'" + loc.name + "' 지점을 삭제할까요?";
    if (!confirm(msg)) return;
    state.locations = state.locations.filter(l => l.id !== loc.id);
    affectedMembers.forEach(m => {
      m.locationIds = m.locationIds.filter(id => id !== loc.id);
      if (m.locationIds.length === 0) m.locationIds = [fallbackLoc.id];
    });
    Object.keys(state.travelTimes).forEach(k => {
      if (k.indexOf(loc.id) !== -1) delete state.travelTimes[k];
    });
    // "지점 추가하기"로 개별 신청에 얹어둔 추가 지점도 함께 정리한다.
    state.requests.forEach(r => {
      if (Array.isArray(r.extraLocationIds) && r.extraLocationIds.includes(loc.id)) {
        r.extraLocationIds = r.extraLocationIds.filter(id => id !== loc.id);
      }
    });
    saveState();
    renderLocationList();
    renderTravelMatrix();
    populateMemberLocationSelect();
    renderMemberTable();
    renderRequestList();
    showToast("'" + loc.name + "' 지점이 삭제되었습니다", "danger");
    invalidateCandidates();
  }

  function renderLocationList() {
    locationListEl.innerHTML = "";
    if (state.locations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "generate-hint";
      empty.textContent = "등록된 지점이 없습니다. 지점을 먼저 추가해주세요.";
      locationListEl.appendChild(empty);
      return;
    }
    state.locations.forEach(loc => {
      if (editingLocationId === loc.id) {
        const editChip = document.createElement("span");
        editChip.className = "chip location-chip location-chip-editing";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "location-name-input";
        input.value = loc.name;

        function commit() {
          const trimmed = input.value.trim();
          const changed = trimmed && trimmed !== loc.name;
          if (changed && state.locations.some(l => l.id !== loc.id && l.name === trimmed)) {
            showToast("이미 등록된 지점 이름입니다.", "danger");
            input.focus();
            return;
          }
          if (trimmed) loc.name = trimmed;
          editingLocationId = null;
          saveState();
          renderLocationList();
          renderTravelMatrix();
          populateMemberLocationSelect();
          renderMemberTable();
          renderRequestList();
          if (changed) {
            showToast("지점 이름이 저장되었습니다", "success");
            invalidateCandidates();
          } else {
            renderSchedule3Result();
          }
        }
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { editingLocationId = null; renderLocationList(); }
        });
        input.addEventListener("blur", commit);

        editChip.appendChild(input);
        locationListEl.appendChild(editChip);
        input.focus();
        input.select();
        return;
      }

      const chip = document.createElement("span");
      chip.className = "chip location-chip";

      const nameSpan = document.createElement("span");
      nameSpan.className = "location-chip-name";
      nameSpan.textContent = loc.name;
      nameSpan.title = "클릭해서 이름 수정";
      nameSpan.addEventListener("click", () => {
        editingLocationId = loc.id;
        renderLocationList();
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "×";
      delBtn.title = "삭제";
      delBtn.addEventListener("click", () => deleteLocation(loc));

      chip.appendChild(nameSpan);
      chip.appendChild(delBtn);
      locationListEl.appendChild(chip);
    });
  }

  function renderTravelMatrix() {
    travelMatrixEl.innerHTML = "";
    const locs = state.locations;
    if (locs.length < 2) {
      travelTitleEl.style.display = "none";
      return;
    }
    travelTitleEl.style.display = "";
    for (let i = 0; i < locs.length; i++) {
      for (let j = i + 1; j < locs.length; j++) {
        const a = locs[i], b = locs[j];
        const key = pairKey(a.id, b.id);
        const row = document.createElement("div");
        row.className = "travel-row";

        const label = document.createElement("span");
        label.className = "travel-pair-label";
        label.textContent = a.name + " ↔ " + b.name;

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.className = "travel-min-input";
        input.value = typeof state.travelTimes[key] === "number" ? state.travelTimes[key] : "";
        input.placeholder = "분";
        input.addEventListener("change", () => {
          const v = parseInt(input.value, 10);
          state.travelTimes[key] = isNaN(v) || v < 0 ? 0 : v;
          input.value = state.travelTimes[key];
          saveState();
          showToast("이동 시간이 저장되었습니다", "success");
          invalidateCandidates();
        });

        const suffix = document.createElement("span");
        suffix.className = "travel-suffix";
        suffix.textContent = "분";

        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(suffix);
        travelMatrixEl.appendChild(row);
      }
    }
  }

  function setLocationHint(message) {
    locationHintEl.textContent = message;
    locationHintEl.classList.toggle("generate-hint-error", !!message);
    locationForm.classList.toggle("has-hint", !!message);
  }

  locationForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = locationNameInput.value.trim();
    if (!name) {
      setLocationHint("지점 이름을 입력해주세요.");
      return;
    }
    if (state.locations.some(l => l.name === name)) {
      setLocationHint("이미 등록된 지점 이름입니다.");
      return;
    }
    setLocationHint("");
    const loc = { id: uid("loc"), name };
    state.locations.push(loc);
    // seed travel time with existing locations so nothing is silently 0.
    state.locations.forEach(other => {
      if (other.id !== loc.id) {
        state.travelTimes[pairKey(loc.id, other.id)] = DEFAULT_TRAVEL_MIN;
      }
    });
    locationNameInput.value = "";
    locationNameInput.focus();
    renderLocationList();
    renderTravelMatrix();
    populateMemberLocationSelect();
    renderMemberTable();
    saveState();
    showToast("'" + name + "' 지점이 추가되었습니다", "success");
    invalidateCandidates();
  });

  /* ---------------- Settings page: availability time picker ---------------- */
  const availabilityListEl = document.getElementById("availabilityList");

  function dayRange(di) {
    let start = null, end = null;
    for (let s = 0; s < SLOT_COUNT; s++) {
      if (availableCells.has(cellKey(di, s))) {
        if (start === null) start = s;
        end = s + 1;
      }
    }
    return start === null ? null : { start, end };
  }

  function setDayRange(di, start, end) {
    for (let s = 0; s < SLOT_COUNT; s++) availableCells.delete(cellKey(di, s));
    for (let s = start; s < end; s++) availableCells.add(cellKey(di, s));
  }

  function clearDay(di) {
    for (let s = 0; s < SLOT_COUNT; s++) availableCells.delete(cellKey(di, s));
  }

  // 회원 스케줄 추가 · 수업 스케줄 생성 결과 그리드는 항상 12:00~24:00 전체를 보여주지 않고,
  // 근무 가능 시간(기본 설정)을 모두 포함하는 가장 좁은 "정시" 범위만 보여준다.
  // 예: 14:00~23:30 설정 → 14:00~24:00 표시 / 13:30~23:00 설정 → 13:00~23:00 표시.
  // 회원이 근무 가능 시간 밖의 시간대를 희망 시간으로 등록했더라도 그리드 범위를 넓히지 않는다 —
  // 근무 가능 시간 밖은 어차피 배정될 수 없으므로 굳이 보여줄 필요가 없다. 그 부분은
  // renderGrid에서 범위 밖을 잘라내(clip) 그린다.
  function businessHoursGridRange() {
    let minStart = null, maxEnd = null;
    DAYS.forEach((d, di) => {
      const range = dayRange(di);
      if (!range) return;
      if (minStart === null || range.start < minStart) minStart = range.start;
      if (maxEnd === null || range.end > maxEnd) maxEnd = range.end;
    });
    if (minStart === null) return { rangeStartSlot: 0, rangeEndSlot: SLOT_COUNT };
    const roundedStartMin = Math.floor((START_MIN + minStart * SLOT_MIN) / 60) * 60;
    const roundedEndMin = Math.ceil((START_MIN + maxEnd * SLOT_MIN) / 60) * 60;
    return {
      rangeStartSlot: (roundedStartMin - START_MIN) / SLOT_MIN,
      rangeEndSlot: (roundedEndMin - START_MIN) / SLOT_MIN
    };
  }

  // 시간 선택창에는 30분 단위 옵션만 보여준다 (실제 배정은 여전히 10분 단위로 계산됨).
  const TIME_SELECT_STEP_SLOTS = 30 / SLOT_MIN;

  function fillTimeSelect(sel, kind) {
    // kind: "start" -> slots 0..SLOT_COUNT-1, "end" -> slots 0..SLOT_COUNT, 30분 간격으로만.
    // end는 "마지막으로 시작 가능한 시각"이라 시작과 같은 값(맨 첫 시각 포함)도 고를 수 있어야 한다.
    sel.innerHTML = "";
    const from = 0;
    const to = kind === "start" ? SLOT_COUNT - 1 : SLOT_COUNT;
    for (let s = from; s <= to; s += TIME_SELECT_STEP_SLOTS) {
      const opt = document.createElement("option");
      opt.value = String(s);
      opt.textContent = minutesLabel(START_MIN + s * SLOT_MIN);
      sel.appendChild(opt);
    }
  }

  // 근무 가능 시간(기본 설정) 전용 시간 선택창: 시작은 13:00~22:00, 종료는 14:00~24:00을
  // 30분 단위로 보여주되, 23:00~24:00 구간만 10분 단위로 더 촘촘하게 보여준다.
  function fillAvailabilityTimeSelect(sel, kind) {
    sel.innerHTML = "";
    const slots = [];
    if (kind === "start") {
      for (let m = 12 * 60; m <= 22 * 60; m += 30) slots.push((m - START_MIN) / SLOT_MIN);
    } else {
      const fineFromMin = 23 * 60;
      for (let m = 14 * 60; m <= fineFromMin; m += 30) slots.push((m - START_MIN) / SLOT_MIN);
      for (let m = fineFromMin + 10; m <= 24 * 60; m += 10) slots.push((m - START_MIN) / SLOT_MIN);
    }
    slots.forEach(s => {
      const opt = document.createElement("option");
      opt.value = String(s);
      opt.textContent = minutesLabel(START_MIN + s * SLOT_MIN);
      sel.appendChild(opt);
    });
  }

  function renderAvailabilityList() {
    availabilityListEl.innerHTML = "";
    DAYS.forEach((d, di) => {
      const range = dayRange(di);
      const isOn = !!range;

      const row = document.createElement("div");
      row.className = "avail-day-row" + (isOn ? "" : " avail-day-off");

      const toggle = document.createElement("label");
      toggle.className = "avail-day-toggle";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = isOn;
      const name = document.createElement("span");
      name.className = "avail-day-name";
      name.textContent = d + "요일";
      toggle.appendChild(check);
      toggle.appendChild(name);

      const timeWrap = document.createElement("div");
      timeWrap.className = "avail-day-time";
      const startSel = document.createElement("select");
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "~";
      const endSel = document.createElement("select");
      fillAvailabilityTimeSelect(startSel, "start");
      fillAvailabilityTimeSelect(endSel, "end");
      startSel.value = String(range ? range.start : DEFAULT_BUSINESS_START_SLOT);
      endSel.value = String(range ? range.end : DEFAULT_BUSINESS_END_SLOT);
      startSel.disabled = !isOn;
      endSel.disabled = !isOn;
      timeWrap.appendChild(startSel);
      timeWrap.appendChild(sep);
      timeWrap.appendChild(endSel);

      function applyRange() {
        let start = parseInt(startSel.value, 10);
        let end = parseInt(endSel.value, 10);
        if (end <= start) {
          end = start + 1;
          endSel.value = String(end);
        }
        setDayRange(di, start, end);
        saveState();
        showToast(d + "요일 근무 가능 시간이 저장되었습니다", "success");
        invalidateCandidates();
      }

      check.addEventListener("change", () => {
        row.classList.toggle("avail-day-off", !check.checked);
        startSel.disabled = !check.checked;
        endSel.disabled = !check.checked;
        if (check.checked) {
          applyRange();
        } else {
          clearDay(di);
          saveState();
          showToast(d + "요일 근무 가능 시간이 초기화되었습니다", "info");
          invalidateCandidates();
        }
      });
      startSel.addEventListener("change", applyRange);
      endSel.addEventListener("change", applyRange);

      row.appendChild(toggle);
      row.appendChild(timeWrap);
      availabilityListEl.appendChild(row);
    });
  }

  /* ---------------- Member management page ---------------- */
  const memberForm = document.getElementById("memberForm");
  const memberNameInput = document.getElementById("memberName");
  const memberLocationMsEl = document.getElementById("memberLocationMs");
  const memberLocationControlEl = document.getElementById("memberLocationControl");
  const memberLocationChipsEl = document.getElementById("memberLocationChips");
  const memberLocationDropdownEl = document.getElementById("memberLocationDropdown");
  const memberCategoryMsEl = document.getElementById("memberCategoryMs");
  const memberCategoryControlEl = document.getElementById("memberCategoryControl");
  const memberCategoryDisplayEl = document.getElementById("memberCategoryDisplay");
  const memberCategoryDropdownEl = document.getElementById("memberCategoryDropdown");
  const memberMemoInput = document.getElementById("memberMemo");
  const memberLocationHintEl = document.getElementById("memberLocationHint");
  const memberCategoryHintEl = document.getElementById("memberCategoryHint");
  const memberNameHintEl = document.getElementById("memberNameHint");
  const memberHintEls = [memberLocationHintEl, memberCategoryHintEl, memberNameHintEl];
  function syncMemberHintSpacing() {
    memberForm.classList.toggle("has-hint", memberHintEls.some(el => el.textContent !== ""));
  }
  function setMemberHint(el, message, isError) {
    el.textContent = message;
    el.classList.toggle("generate-hint-error", !!isError);
    syncMemberHintSpacing();
  }
  function clearMemberHints() {
    memberHintEls.forEach(el => { el.textContent = ""; el.classList.remove("generate-hint-error"); });
    syncMemberHintSpacing();
  }
  const memberTableBodyEl = document.getElementById("memberTableBody");
  const memberLocationSortThEl = document.getElementById("memberLocationSortTh");
  const memberLocationSortArrowEl = document.getElementById("memberLocationSortArrow");
  const memberSubmitBtn = memberForm.querySelector("button[type=submit]");
  const requestSummaryEl = document.getElementById("requestSummary");
  const memberTabsEl = document.getElementById("memberTabs");
  const scheduleGridEl = document.getElementById("scheduleGrid");
  const scheduleGridScrollEl = document.getElementById("scheduleGridScroll");
  const scheduleChipRowEl = document.getElementById("scheduleChipRow");
  const scheduleInteractiveEl = document.getElementById("scheduleInteractive");
  const rangeAddRowEl = document.getElementById("rangeAddRow");
  const rangeDayListEl = document.getElementById("rangeDayList");
  const rangeAddBtn = document.getElementById("rangeAddBtn");
  const resetAllSchedulesBtn = document.getElementById("resetAllSchedulesBtn");
  let activeScheduleMemberId = null;

  // "한 번에 추가" 컨트롤: 요일마다 독립된 시작~종료 시간대 선택창을 두고(기본값 "선택안함"),
  // 시간대를 지정한 요일들만 모아 그 범위 안에서 가능한 모든 60분 후보 시작 시각(10분 간격)을
  // 한 번에 희망 시간으로 등록한다.
  const rangeDayRows = DAYS.map((d, di) => {
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
    [startSel, endSel].forEach(sel => {
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
      .filter(r => r.startSel.value !== "" || r.endSel.value !== "")
      .map(r => ({
        day: r.day,
        startSel: r.startSel,
        endSel: r.endSel,
        start: r.startSel.value === "" ? 0 : parseInt(r.startSel.value, 10),
        end: r.endSel.value === "" ? SLOT_COUNT : parseInt(r.endSel.value, 10)
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
    const added = configuredRows.reduce((sum, r) => sum + addDesiredRange(activeMember, r.day, r.start, r.end), 0);
    if (added === 0) {
      alert("추가할 새 시간대가 없습니다. 이미 등록되었거나, 그 범위엔 수업이 들어갈 자리가 없습니다.");
      return;
    }
    configuredRows.forEach(r => { r.startSel.value = ""; r.endSel.value = ""; });
    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
    showToast("일정이 추가 되었습니다.", "success");
  });

  function resetAllRequests() {
    if (state.requests.length === 0) return;
    state.requests = [];
    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
  }

  resetAllSchedulesBtn.addEventListener("click", () => {
    if (state.requests.length === 0) return;
    if (!confirm("스케줄이 등록된 회원의 가능 시간을 모두 지우고 초기화할까요?")) return;
    resetAllRequests();
    showToast("전체 스케줄이 초기화되었습니다", "info");
  });

  /* ---------------- 회원 스케줄 추가: 붙여넣기로 일괄 등록 ---------------- */
  // 트레이너가 평소 쓰는 "이름  요일 시간..." 텍스트를 그대로 붙여넣으면 파싱해서 회원별
  // 희망 시간으로 한 번에 등록한다. 이름 다음에는 요일 토큰(월화수목금토를 이어 붙인 것,
  // 예: 화목)과 시간 토큰이 번갈아 나오고, 시간 토큰의 숫자는 새 요일 토큰이 나오기 전까지
  // 직전 요일 토큰 전체에 적용된다. "화목8910"처럼 요일과 시간 사이에 공백이 없어도
  // 요일 글자 뒤에 남는 숫자를 그대로 시간 토큰으로 이어서 처리한다.
  const DAY_CHAR_TO_INDEX = {};
  DAYS.forEach((d, i) => { DAY_CHAR_TO_INDEX[d] = i; });

  function parseDayGroupToken(token) {
    if (!token || !/^[월화수목금토]+$/.test(token)) return null;
    return Array.from(token).map(ch => DAY_CHAR_TO_INDEX[ch]);
  }

  // 숫자만 이어진 문자열을 "시(오후 기준, 1~12)"들의 나열로 되돌린다. 예: "8910" -> 8시·9시·10시,
  // "730" -> 7시30분, "1030" -> 10시30분, "640" -> 6시40분, "650" -> 6시50분. 앞에서부터 그리디하게
  // 2자리(10/11/12)를 먼저 시도하고, 뒤에 "30"·"40"·"50"이 바로 붙으면 그 분으로 묶는다(백트래킹으로
  // 전체 문자열이 소진되는 경우만 채택).
  const HOUR_DIGIT_MINUTE_SUFFIXES = [30, 40, 50];
  function tokenizeHourDigits(digits) {
    function rec(s) {
      if (s === "") return [];
      for (const len of [2, 1]) {
        if (s.length < len) continue;
        const num = parseInt(s.slice(0, len), 10);
        const valid = len === 2 ? (num === 10 || num === 11 || num === 12) : (num >= 1 && num <= 9);
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
  function hourMarkToStartSlot(mark) {
    const hour24 = (mark.hour % 12) + 12;
    const minutes = hour24 * 60 + mark.minute;
    return (minutes - START_MIN) / SLOT_MIN;
  }

  function hourMarkLabel(mark) {
    const hour24 = (mark.hour % 12) + 12;
    return minutesLabel(hour24 * 60 + mark.minute);
  }

  // "월345"처럼 매시 정각이 연달아 이어진 마크들은, 회원이 그 사이 언제든 시작할 수 있다는
  // 뜻으로 보고 하나의 이어진 구간으로 묶는다(예: 3,4,5시 -> 3시~5시 사이 10분 단위로 전부
  // 희망 시작 시각이 됨). 시간이 하나라도 비면(연속이 아니면) 새 구간으로 나눈다.
  function groupConsecutiveMarks(marks) {
    const groups = [];
    let current = [];
    marks.forEach(mark => {
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
  function expandHourRange(leftMark, rightMark) {
    const leftHour24 = (leftMark.hour % 12) + 12;
    const rightHour24 = (rightMark.hour % 12) + 12;
    if (rightHour24 < leftHour24) return null;
    const marks = [];
    for (let h24 = leftHour24; h24 <= rightHour24; h24++) {
      const hour = h24 === 12 ? 12 : h24 - 12;
      if (h24 === leftHour24 && h24 === rightHour24) {
        marks.push({ hour, minute: leftMark.minute });
        if (rightMark.minute !== leftMark.minute) marks.push({ hour, minute: rightMark.minute });
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
  function parseTimeToken(token) {
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
      if (result.type === "point") result.marks = result.marks.concat([LATE_MARK]);
      else if (result.type === "openStart" || result.type === "openEnd") {
        result.extraPoints = (result.extraPoints || []).concat([LATE_MARK]);
      }
      return result;
    }
    if (token === "") {
      if (hasLateMark) return { type: "point", marks: [LATE_MARK] };
      return { error: "알 수 없는 시간 표기: \"" + originalToken + "\"" };
    }
    // "5까지"는 "~5"(마감 이전부터 5시까지), "4부터"·"5이후"는 "4~"·"5~"(그 시각부터 마감까지)와
    // 같은 뜻이라 동일한 물결 표기로 바꿔서 아래 로직을 그대로 재사용한다.
    const suffixMatch = token.match(/^(\d+)(까지|부터|이후)$/);
    if (suffixMatch) {
      const digits = suffixMatch[1];
      token = suffixMatch[2] === "까지" ? ("~" + digits) : (digits + "~");
    }
    const cleanMatch = token.match(/^[\d~]+/);
    let warning = null;
    if (!cleanMatch) return { error: "알 수 없는 시간 표기: \"" + originalToken + "\"" };
    const clean = cleanMatch[0];
    if (clean.length < token.length) {
      warning = "\"" + originalToken + "\"에서 뒤쪽 문자(\"" + token.slice(clean.length) + "\")는 무시했습니다.";
    }
    const tildeCount = (clean.match(/~/g) || []).length;
    if (tildeCount > 1) return { error: "알 수 없는 시간 표기: \"" + originalToken + "\"", warning };
    if (tildeCount === 1) {
      const [leftStr, rightStr] = clean.split("~");
      if (leftStr !== "" && rightStr !== "") {
        const leftMarks = tokenizeHourDigits(leftStr);
        const rightMarks = tokenizeHourDigits(rightStr);
        if (!leftMarks || leftMarks.length !== 1 || !rightMarks || rightMarks.length !== 1) {
          return { error: "구간 표기 해석 실패: \"" + originalToken + "\"", warning };
        }
        const marks = expandHourRange(leftMarks[0], rightMarks[0]);
        if (!marks) return { error: "구간 표기 해석 실패: \"" + originalToken + "\"", warning };
        return withLateMark({ type: "point", marks, warning });
      }
      if (rightStr === "") {
        // "6630~"처럼 물결 앞에 시각이 여러 개 이어져 있으면, 물결에 맞닿은 마지막 시각(6시30분)을
        // "그 시각부터 마감까지" 열린 시작점으로 삼고, 그 앞의 시각들(6시)은 각각 개별 희망
        // 시작 시각으로 남긴다.
        const marks = tokenizeHourDigits(leftStr);
        if (!marks || marks.length === 0) return { error: "구간 표기 해석 실패: \"" + originalToken + "\"", warning };
        return withLateMark({ type: "openStart", mark: marks[marks.length - 1], extraPoints: marks.slice(0, -1), warning });
      }
      // "~458"처럼 물결 뒤에 시각이 여러 개 이어져 있으면, 물결에 맞닿은 첫 시각(4시)을
      // "마감 이전부터 그 시각까지" 열린 끝점으로 삼고, 그 뒤의 시각들(5시, 8시)은 각각
      // 개별 희망 시작 시각으로 남긴다.
      const marks = tokenizeHourDigits(rightStr);
      if (!marks || marks.length === 0) return { error: "구간 표기 해석 실패: \"" + originalToken + "\"", warning };
      return withLateMark({ type: "openEnd", mark: marks[0], extraPoints: marks.slice(1), warning });
    }
    const marks = tokenizeHourDigits(clean);
    if (!marks) return { error: "시간 해석 실패: \"" + originalToken + "\"", warning };
    return withLateMark({ type: "point", marks, warning });
  }

  // 한 줄("이름  요일 시간...")을 해석한다.
  function parseBulkImportLine(line) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    const name = tokens[0];
    const result = { raw: line.trim(), name, days: [], warnings: [], errors: [], clearAll: false };

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
        result.errors.push("요일 지정 전에 나온 시간 표기라 건너뜁니다: \"" + tok + "\"");
        return;
      }
      const parsed = parseTimeToken(tok);
      if (parsed.warning) result.warnings.push(parsed.warning);
      if (parsed.error) { result.errors.push(parsed.error); return; }
      currentDays.forEach(day => {
        let dayEntry = result.days.find(d => d.day === day);
        if (!dayEntry) { dayEntry = { day, specs: [] }; result.days.push(dayEntry); }
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

  function parseBulkImportText(text) {
    return text.split("\n").map(parseBulkImportLine).filter(Boolean);
  }

  // 마크 배열(연속이면 하나로 묶어)을 미리보기용 문구 조각들로 바꾼다.
  function describeMarks(marks) {
    return groupConsecutiveMarks(marks).map(group =>
      group.length > 1 ? hourMarkLabel(group[0]) + "~" + hourMarkLabel(group[group.length - 1]) : hourMarkLabel(group[0])
    );
  }

  // 파싱된 하루치 스케줄(day.specs)을 사람이 읽을 문구로 만든다 (미리보기 칩용).
  function describeDaySpecs(specs) {
    const parts = [];
    specs.forEach(spec => {
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

  function findMembersByName(name) {
    return state.members.filter(m => m.name === name);
  }

  /* ---- 붙여넣기 모달 ---- */
  const bulkImportConfirmOverlayEl = document.getElementById("bulkImportConfirmOverlay");
  const bulkImportConfirmCloseBtn = document.getElementById("bulkImportConfirmCloseBtn");
  const bulkImportJustAddBtn = document.getElementById("bulkImportJustAddBtn");
  const bulkImportResetAddBtn = document.getElementById("bulkImportResetAddBtn");
  const bulkImportOverlayEl = document.getElementById("bulkImportOverlay");
  const bulkImportOpenBtn = document.getElementById("bulkImportOpenBtn");
  const bulkImportCloseBtn = document.getElementById("bulkImportCloseBtn");
  const bulkImportCancelBtn = document.getElementById("bulkImportCancelBtn");
  const bulkImportBackBtn = document.getElementById("bulkImportBackBtn");
  const bulkImportPreviewBtn = document.getElementById("bulkImportPreviewBtn");
  const bulkImportApplyBtn = document.getElementById("bulkImportApplyBtn");
  const bulkImportTextareaEl = document.getElementById("bulkImportTextarea");
  const bulkImportStepInputEl = document.getElementById("bulkImportStepInput");
  const bulkImportStepPreviewEl = document.getElementById("bulkImportStepPreview");
  const bulkImportPreviewSummaryEl = document.getElementById("bulkImportPreviewSummary");
  const bulkImportPreviewListEl = document.getElementById("bulkImportPreviewList");

  // { parsed, choice: memberId | "__new__" | "__skip__", newLocationId, newCategory }
  let bulkImportRows = [];

  function openBulkImportModal() {
    bulkImportTextareaEl.value = "";
    bulkImportStepInputEl.style.display = "";
    bulkImportStepPreviewEl.style.display = "none";
    bulkImportOverlayEl.classList.add("open");
    setTimeout(() => bulkImportTextareaEl.focus(), 0);
  }

  function closeBulkImportModal() {
    bulkImportOverlayEl.classList.remove("open");
  }

  function closeBulkImportConfirmModal() {
    bulkImportConfirmOverlayEl.classList.remove("open");
  }

  bulkImportOpenBtn.addEventListener("click", () => {
    bulkImportConfirmOverlayEl.classList.add("open");
  });
  bulkImportConfirmCloseBtn.addEventListener("click", closeBulkImportConfirmModal);
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

  function renderBulkImportPreview() {
    const lines = parseBulkImportText(bulkImportTextareaEl.value);
    if (lines.length === 0) {
      alert("붙여넣은 내용이 없습니다.");
      return;
    }
    bulkImportRows = lines.map(parsed => {
      const matches = findMembersByName(parsed.name);
      return {
        parsed,
        choice: matches.length >= 1 ? matches[0].id : "__new__",
        newLocationId: state.locations[0] ? state.locations[0].id : "",
        newCategory: "등록"
      };
    });

    bulkImportPreviewListEl.innerHTML = "";
    let willApply = 0, willCreate = 0, willSkip = 0;

    bulkImportRows.forEach(row => {
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
      matches.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        const locNames = m.locationIds.map(id => locationById(id)).filter(Boolean).map(l => l.name).join("·");
        opt.textContent = "기존 회원 (" + (locNames || "지점 미지정") + ")" + (matches.length > 1 ? " #" + m.id.slice(-4) : "");
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
      state.locations.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc.id;
        opt.textContent = loc.name;
        locSelect.appendChild(opt);
      });
      if (row.newLocationId) locSelect.value = row.newLocationId;
      locSelect.addEventListener("change", () => { row.newLocationId = locSelect.value; });
      const catSelect = document.createElement("select");
      CATEGORY_OPTIONS.forEach(opt => {
        const optionEl = document.createElement("option");
        optionEl.value = opt;
        optionEl.textContent = opt;
        catSelect.appendChild(optionEl);
      });
      catSelect.value = row.newCategory;
      catSelect.addEventListener("change", () => { row.newCategory = catSelect.value; });
      newFields.appendChild(locSelect);
      newFields.appendChild(catSelect);
      head.appendChild(select);
      head.appendChild(newFields);
      rowEl.appendChild(head);

      const scheduleEl = document.createElement("div");
      scheduleEl.className = "bulk-preview-schedule";
      if (parsed.days.length > 0) {
        parsed.days.forEach(dayEntry => {
          const chip = document.createElement("span");
          chip.className = "bulk-preview-day-chip";
          chip.innerHTML = "<b>" + DAYS[dayEntry.day] + "</b> " + describeDaySpecs(dayEntry.specs);
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

      parsed.warnings.forEach(w => {
        const p = document.createElement("p");
        p.className = "bulk-preview-note warning";
        p.textContent = "⚠ " + w;
        rowEl.appendChild(p);
      });
      parsed.errors.forEach(err => {
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
      "기존 회원 적용 " + willApply + "명 · 신규 등록 " + willCreate + "명 · 건너뛰기 " + willSkip + "명" +
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
    bulkImportRows.forEach(row => {
      if (row.choice === "__skip__") return;
      let member, isNew = false;
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
          memo: ""
        };
        isNew = true;
      } else {
        // 기존 회원은 "등록할 시간 없음"도 유효한 지정이다 — 아래에서 기존 스케줄을 모두 지운다.
        member = memberById(row.choice);
        if (!member) return;
      }
      if (!entriesByMemberKey.has(member.id)) {
        entriesByMemberKey.set(member.id, { member, isNew, days: new Map(), explicitClear: false });
      }
      const entry = entriesByMemberKey.get(member.id);
      if (row.parsed.clearAll) entry.explicitClear = true;
      row.parsed.days.forEach(dayEntry => {
        if (!entry.days.has(dayEntry.day)) entry.days.set(dayEntry.day, []);
        entry.days.get(dayEntry.day).push(...dayEntry.specs);
      });
    });

    let appliedCount = 0;
    entriesByMemberKey.forEach(entry => {
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
      state.requests = state.requests.filter(r => r.memberId !== member.id);
      let addedForMember = 0;
      // 연속된 매시 마크(예: 3,4,5시)는 그 사이 전부를 하나의 이어진 희망 구간으로 등록한다.
      function applyMarks(day, marks) {
        groupConsecutiveMarks(marks).forEach(group => {
          const startSlot = hourMarkToStartSlot(group[0]);
          const endSlot = hourMarkToStartSlot(group[group.length - 1]);
          addedForMember += addDesiredRange(member, day, startSlot, endSlot);
        });
      }
      entry.days.forEach((specs, day) => {
        specs.forEach(spec => {
          if (spec.type === "point") {
            applyMarks(day, spec.marks);
          } else if (spec.type === "openStart") {
            applyMarks(day, spec.extraPoints || []);
            addedForMember += addDesiredRange(member, day, hourMarkToStartSlot(spec.mark), SLOT_COUNT);
          } else if (spec.type === "openEnd") {
            addedForMember += addDesiredRange(member, day, 0, hourMarkToStartSlot(spec.mark));
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

    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    saveState();
    renderMemberTable();
    renderRequestList();
    closeBulkImportModal();

    const notes = [];
    if (createdCount) notes.push("신규 " + createdCount + "명");
    if (zeroFitNames.length) notes.push(zeroFitNames.join(", ") + "은(는) 마감 시간 등으로 등록된 시간이 없습니다");
    if (clearedNames.length) notes.push(clearedNames.join(", ") + "은(는) 'x' 지정으로 기존 시간을 모두 삭제했습니다");
    if (emptyRowNames.length) notes.push(emptyRowNames.join(", ") + "은(는) 등록할 시간이 없어 건너뛰었습니다");
    if (unparsedSkippedNames.length) notes.push(unparsedSkippedNames.join(", ") + "은(는) 줄을 해석하지 못해 기존 시간을 그대로 두고 건너뛰었습니다");
    const suffix = notes.length ? " (" + notes.join(" · ") + ")" : "";
    showToast(appliedCount + "명 스케줄 등록 완료" + suffix, (zeroFitNames.length || emptyRowNames.length || clearedNames.length || unparsedSkippedNames.length) ? "info" : "success");
  });

  // Notion 스타일 지점 다중 선택 위젯: 드롭다운에서 클릭 한 번으로 지점을 추가/제거한다.
  let memberFormLocationIds = [];
  let memberLocationDropdownOpen = false;

  function toggleMemberFormLocation(locId) {
    memberFormLocationIds = memberFormLocationIds.includes(locId)
      ? memberFormLocationIds.filter(id => id !== locId)
      : memberFormLocationIds.concat(locId);
    renderMemberLocationControl();
    renderMemberLocationDropdown();
  }

  function renderMemberLocationControl() {
    memberLocationChipsEl.innerHTML = "";
    if (memberFormLocationIds.length === 0) {
      const placeholder = document.createElement("span");
      placeholder.className = "ms-placeholder";
      placeholder.textContent = state.locations.length === 0 ? "등록된 지점 없음" : "선택";
      memberLocationChipsEl.appendChild(placeholder);
      return;
    }
    memberFormLocationIds.forEach(locId => {
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

  function renderMemberLocationDropdown() {
    memberLocationDropdownEl.innerHTML = "";
    if (state.locations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-empty";
      empty.textContent = "설정 페이지에서 지점을 먼저 등록해주세요.";
      memberLocationDropdownEl.appendChild(empty);
      return;
    }
    state.locations.forEach(loc => {
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

  function openMemberLocationDropdown() {
    if (state.locations.length === 0) return;
    memberLocationDropdownOpen = true;
    memberLocationMsEl.classList.add("open");
    memberLocationControlEl.setAttribute("aria-expanded", "true");
  }

  function closeMemberLocationDropdown() {
    memberLocationDropdownOpen = false;
    memberLocationMsEl.classList.remove("open");
    memberLocationControlEl.setAttribute("aria-expanded", "false");
  }

  memberLocationControlEl.addEventListener("click", () => {
    if (memberLocationDropdownOpen) closeMemberLocationDropdown();
    else openMemberLocationDropdown();
  });

  function populateMemberLocationSelect() {
    memberFormLocationIds = memberFormLocationIds.filter(id => state.locations.some(l => l.id === id));
    renderMemberLocationControl();
    renderMemberLocationDropdown();
    const hasLocations = state.locations.length > 0;
    memberSubmitBtn.disabled = !hasLocations;
    memberLocationControlEl.disabled = !hasLocations;
    setMemberHint(memberLocationHintEl, hasLocations ? "" : "설정 페이지에서 지점을 먼저 등록해주세요.", false);
  }

  // 같은 위젯을 재사용한 구분 단일 선택: 클릭 한 번으로 값을 고르고, 고르면 바로 닫힌다.
  let memberFormCategory = "";
  let memberCategoryDropdownOpen = false;

  function renderMemberCategoryControl() {
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

  function renderMemberCategoryDropdown() {
    memberCategoryDropdownEl.innerHTML = "";
    CATEGORY_OPTIONS.forEach(opt => {
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

  function openMemberCategoryDropdown() {
    memberCategoryDropdownOpen = true;
    memberCategoryMsEl.classList.add("open");
    memberCategoryControlEl.setAttribute("aria-expanded", "true");
  }

  function closeMemberCategoryDropdown() {
    memberCategoryDropdownOpen = false;
    memberCategoryMsEl.classList.remove("open");
    memberCategoryControlEl.setAttribute("aria-expanded", "false");
  }

  memberCategoryControlEl.addEventListener("click", () => {
    if (memberCategoryDropdownOpen) closeMemberCategoryDropdown();
    else openMemberCategoryDropdown();
  });

  document.addEventListener("click", (e) => {
    if (memberLocationDropdownOpen && !memberLocationMsEl.contains(e.target)) closeMemberLocationDropdown();
    if (memberCategoryDropdownOpen && !memberCategoryMsEl.contains(e.target)) closeMemberCategoryDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (memberLocationDropdownOpen) closeMemberLocationDropdown();
    if (memberCategoryDropdownOpen) closeMemberCategoryDropdown();
  });

  renderMemberCategoryControl();
  renderMemberCategoryDropdown();

  function deleteMember(member) {
    const reqCount = state.requests.filter(r => r.memberId === member.id).length;
    const msg = reqCount > 0
      ? "'" + member.name + "' 회원을 삭제하면 등록된 가능 시간 " + reqCount + "건도 함께 삭제됩니다. 계속할까요?"
      : "'" + member.name + "' 회원을 삭제할까요?";
    if (!confirm(msg)) return;
    state.members = state.members.filter(m => m.id !== member.id);
    state.requests = state.requests.filter(r => r.memberId !== member.id);
    state.onceLimitedMemberIds = state.onceLimitedMemberIds.filter(id => id !== member.id);
    state.excludedMemberIds = state.excludedMemberIds.filter(id => id !== member.id);
    state.onceLimitedMemberIds2 = state.onceLimitedMemberIds2.filter(id => id !== member.id);
    state.excludedMemberIds2 = state.excludedMemberIds2.filter(id => id !== member.id);
    state.onceLimitedMemberIds3 = state.onceLimitedMemberIds3.filter(id => id !== member.id);
    state.excludedMemberIds3 = state.excludedMemberIds3.filter(id => id !== member.id);
    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    saveState();
    renderMemberTable();
    renderRequestList();
    renderSchedule3Result();
    showToast("'" + member.name + "' 회원이 삭제되었습니다", "danger");
  }

  function setMemberMemo(member, memo) {
    member.memo = memo;
    saveState();
    showToast("메모가 저장되었습니다", "success");
  }

  function setMemberCategory(member, category) {
    member.category = category;
    // 구분이 바뀌면 확보 시간(상담 30분/등록 60분)도 바뀌므로, 이미 등록된 이 회원의
    // 신청들도 새 구분 기준 길이로 맞춰준다 — 안 그러면 예전 구분 기준 길이가 그대로 남아
    // 그리드에는 옛 길이만큼만 자리가 확보된 것처럼 보인다.
    const newDuration = sessionDurationFor(member);
    state.requests.forEach(r => { if (r.memberId === member.id) r.duration = newDuration; });
    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
    showToast("회원 구분이 변경되었습니다", "success");
  }

  let editingMemberNameId = null;

  // 지점 정렬: null(등록순) → "asc" → "desc" → null 순으로 헤더 클릭할 때마다 순환한다.
  let memberLocationSortDir = null;
  memberLocationSortThEl.addEventListener("click", () => {
    memberLocationSortDir = memberLocationSortDir === null ? "asc" : memberLocationSortDir === "asc" ? "desc" : null;
    renderMemberTable();
  });

  function memberPrimaryLocationName(member) {
    const loc = locationById(member.locationIds[0]);
    return loc ? loc.name : "";
  }

  function renderMemberTable() {
    onceLimit3Widget.renderAll();
    excluded3Widget.renderAll();
    memberTableBodyEl.innerHTML = "";
    memberLocationSortArrowEl.textContent =
      memberLocationSortDir === "asc" ? "▲" : memberLocationSortDir === "desc" ? "▼" : "";
    if (state.members.length === 0) {
      const emptyRow = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "generate-hint";
      cell.textContent = "등록된 회원이 없습니다. 위에서 회원을 먼저 등록해주세요.";
      emptyRow.appendChild(cell);
      memberTableBodyEl.appendChild(emptyRow);
      return;
    }
    // 지점이 미지정/삭제된 상태인 회원은 첫 번째 지점으로 자동 보정한다 (지점 미지정 상태를 허용하지 않음).
    if (state.locations.length > 0) {
      let fixedAny = false;
      state.members.forEach(member => {
        const validIds = member.locationIds.filter(id => state.locations.some(l => l.id === id));
        if (validIds.length !== member.locationIds.length) { member.locationIds = validIds; fixedAny = true; }
        if (member.locationIds.length === 0) {
          member.locationIds = [state.locations[0].id];
          fixedAny = true;
        }
      });
      if (fixedAny) saveState();
    }

    const rows = memberLocationSortDir
      ? state.members.slice().sort((a, b) => {
          const cmp = memberPrimaryLocationName(a).localeCompare(memberPrimaryLocationName(b), "ko");
          return memberLocationSortDir === "asc" ? cmp : -cmp;
        })
      : state.members;

    rows.forEach(member => {
      const tr = document.createElement("tr");

      // 지점명
      const locCell = document.createElement("td");
      const locBadgeWrap = document.createElement("div");
      locBadgeWrap.className = "badge-cell";
      member.locationIds.forEach(locId => {
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
      catBadge.className = "chip category-chip" + (categoryValue === "상담" ? " category-chip-consult" : "");
      CATEGORY_OPTIONS.forEach(opt => {
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
          if (changed && state.members.some(m => m.id !== member.id && m.name === trimmed
            && m.locationIds.some(id => member.locationIds.includes(id)))) {
            const proceed = confirm("'" + trimmed + "' 이름의 회원이 같은 지점에 이미 있습니다. 이름만 같은 다른 회원으로 저장할까요?");
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
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { editingMemberNameId = null; renderMemberTable(); }
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
      editIcon.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>';
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
      memoInput.addEventListener("change", () => setMemberMemo(member, memoInput.value));
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
    if (state.members.some(m => m.name === name && m.locationIds.some(id => memberFormLocationIds.includes(id)))) {
      const proceed = confirm("'" + name + "' 이름의 회원이 같은 지점에 이미 있습니다. 이름만 같은 다른 회원으로 등록할까요?");
      if (!proceed) return;
    }
    const member = {
      id: uid("m"),
      name,
      locationIds: memberFormLocationIds.slice(),
      category: memberFormCategory,
      memo: memberMemoInput.value.trim()
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
  const memberBulkImportOverlayEl = document.getElementById("memberBulkImportOverlay");
  const memberBulkImportOpenBtn = document.getElementById("memberBulkImportOpenBtn");
  const memberBulkImportCloseBtn = document.getElementById("memberBulkImportCloseBtn");
  const memberBulkImportCancelBtn = document.getElementById("memberBulkImportCancelBtn");
  const memberBulkImportBackBtn = document.getElementById("memberBulkImportBackBtn");
  const memberBulkImportPreviewBtn = document.getElementById("memberBulkImportPreviewBtn");
  const memberBulkImportApplyBtn = document.getElementById("memberBulkImportApplyBtn");
  const memberBulkImportTextareaEl = document.getElementById("memberBulkImportTextarea");
  const memberBulkImportStepInputEl = document.getElementById("memberBulkImportStepInput");
  const memberBulkImportStepPreviewEl = document.getElementById("memberBulkImportStepPreview");
  const memberBulkImportPreviewSummaryEl = document.getElementById("memberBulkImportPreviewSummary");
  const memberBulkImportPreviewListEl = document.getElementById("memberBulkImportPreviewList");

  // { raw, locationIds, category, name, skip, errors }
  let memberBulkImportRows = [];

  function parseMemberBulkLine(line) {
    const raw = line.trim();
    if (!raw) return null;
    const parts = raw.split("/").map(s => s.trim());
    const row = { raw, locationIds: [], unmatchedLocationNames: [], category: "", name: "", skip: false, errors: [] };
    if (parts.length !== 3) {
      row.errors.push("형식이 맞지 않습니다. \"지점 / 구분 / 이름\" 형식으로 입력해주세요.");
      return row;
    }
    const [locPart, catPart, namePart] = parts;
    const locationNames = locPart.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    if (locationNames.length === 0) row.errors.push("지점을 입력해주세요.");
    locationNames.forEach(n => {
      const loc = state.locations.find(l => l.name === n);
      if (loc) row.locationIds.push(loc.id);
      else row.unmatchedLocationNames.push(n);
    });
    if (row.unmatchedLocationNames.length > 0) {
      row.errors.push("등록되지 않은 지점: " + row.unmatchedLocationNames.join(", "));
    }
    row.category = catPart;
    if (!CATEGORY_OPTIONS.includes(catPart)) {
      row.errors.push("회원 구분은 " + CATEGORY_OPTIONS.join("/") + " 중 하나여야 합니다: \"" + catPart + "\"");
    }
    row.name = namePart;
    if (!namePart) row.errors.push("이름을 입력해주세요.");
    return row;
  }

  function openMemberBulkImportModal() {
    memberBulkImportTextareaEl.value = "";
    memberBulkImportStepInputEl.style.display = "";
    memberBulkImportStepPreviewEl.style.display = "none";
    memberBulkImportOverlayEl.classList.add("open");
    setTimeout(() => memberBulkImportTextareaEl.focus(), 0);
  }

  function closeMemberBulkImportModal() {
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

  function memberBulkRowIsDuplicate(row) {
    return state.members.some(m => m.name === row.name && m.locationIds.some(id => row.locationIds.includes(id)));
  }

  function renderMemberBulkImportPreview() {
    memberBulkImportPreviewListEl.innerHTML = "";
    let willAdd = 0, willSkip = 0, willError = 0;

    memberBulkImportRows.forEach(row => {
      const hasError = row.errors.length > 0;
      const duplicate = !hasError && memberBulkRowIsDuplicate(row);
      if (hasError) willError++;
      else if (row.skip) willSkip++;
      else willAdd++;

      const rowEl = document.createElement("div");
      rowEl.className = "bulk-preview-row" + (row.skip || hasError ? " skip" : "");

      const head = document.createElement("div");
      head.className = "bulk-preview-row-head";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = row.name;
      nameInput.className = "bulk-preview-name";
      nameInput.style.cssText = "border:1px solid var(--border);border-radius:8px;height:32px;padding:0 8px;width:120px;font-family:inherit;";
      nameInput.addEventListener("input", () => {
        row.name = nameInput.value.trim();
        renderMemberBulkImportPreview();
      });
      head.appendChild(nameInput);

      const catSelect = document.createElement("select");
      CATEGORY_OPTIONS.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        catSelect.appendChild(o);
      });
      if (CATEGORY_OPTIONS.includes(row.category)) catSelect.value = row.category;
      catSelect.addEventListener("change", () => {
        row.category = catSelect.value;
        row.errors = row.errors.filter(e => !e.startsWith("회원 구분은"));
        renderMemberBulkImportPreview();
      });
      head.appendChild(catSelect);

      const skipLabel = document.createElement("label");
      skipLabel.style.cssText = "display:inline-flex;align-items:center;gap:4px;font-size:12.5px;color:var(--text-mute);margin-left:auto;";
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
      state.locations.forEach(loc => {
        const label = document.createElement("label");
        label.style.cssText = "display:inline-flex;align-items:center;gap:4px;font-size:12.5px;";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = row.locationIds.includes(loc.id);
        cb.addEventListener("change", () => {
          if (cb.checked) row.locationIds.push(loc.id);
          else row.locationIds = row.locationIds.filter(id => id !== loc.id);
          if (row.locationIds.length > 0) row.errors = row.errors.filter(e => !e.startsWith("지점을") && !e.startsWith("등록되지 않은 지점"));
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
        note.textContent = "같은 지점에 동명 회원이 이미 있습니다. 그대로 등록하면 별도 회원으로 추가됩니다.";
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
    const lines = memberBulkImportTextareaEl.value.split("\n").map(parseMemberBulkLine).filter(Boolean);
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
    const toAdd = memberBulkImportRows.filter(row => row.errors.length === 0 && !row.skip);
    if (toAdd.length === 0) return;
    toAdd.forEach(row => {
      state.members.unshift({
        id: uid("m"),
        name: row.name,
        locationIds: row.locationIds.slice(),
        category: row.category,
        memo: ""
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
  function addDesiredRange(member, day, startSlot, endSlot) {
    if (member.locationIds.length === 0) return 0;
    const duration = sessionDurationFor(member);
    const neededSlots = durationToSlots(duration);
    const existingStarts = new Set(
      state.requests.filter(r => r.memberId === member.id && r.day === day).map(r => r.startSlot)
    );
    // 하루가 끝나기 전에 수업이 끝날 수 있는 시각까지만 시작을 허용한다.
    const maxStart = Math.min(endSlot, SLOT_COUNT - neededSlots);
    let added = 0;
    for (let s = startSlot; s <= maxStart; s++) {
      if (existingStarts.has(s)) continue;
      state.requests.push({
        id: uid("r"),
        memberId: member.id,
        day, startSlot: s, duration
      });
      added++;
    }
    return added;
  }

  function removeRequests(reqIds) {
    const idSet = new Set(reqIds);
    state.requests = state.requests.filter(r => !idSet.has(r.id));
    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    renderRequestList();
    saveState();
  }

  // 표시용으로만 겹치거나 맞닿은 후보들을 하나의 시간대 구간으로 묶는다 (저장 데이터는 그대로 개별 후보).
  function mergeRequestRuns(reqs) {
    const byDay = new Map();
    reqs.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const runs = [];
    byDay.forEach((list, day) => {
      list.sort((a, b) => a.startSlot - b.startSlot);
      let current = null;
      list.forEach(r => {
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
  function requestRunExtraLocationIds(run) {
    return (run.reqs[0] && run.reqs[0].extraLocationIds) || [];
  }

  function setRunExtraLocationIds(run, ids) {
    run.reqs.forEach(r => { r.extraLocationIds = ids.slice(); });
  }

  function addExtraLocationToRun(run, locId) {
    const current = requestRunExtraLocationIds(run);
    if (current.includes(locId)) return;
    setRunExtraLocationIds(run, current.concat([locId]));
    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
    showToast("지점이 추가되었습니다", "success");
  }

  function removeExtraLocationFromRun(run, locId) {
    setRunExtraLocationIds(run, requestRunExtraLocationIds(run).filter(id => id !== locId));
    requestsChangedSinceGenerate = true;
    requestsChangedSinceGenerate2 = true;
    requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
    showToast("지점이 제거되었습니다", "info");
  }

  // 좌클릭(터치는 탭) 시 뜨는 메뉴: 지점 추가하기(이 시간대만 다른 지점에서도 배정 가능해짐 —
  // 회원의 기본 지점과 이미 추가된 지점을 뺀 나머지 지점을 바로 항목으로 보여준다), 이미
  // 추가해둔 지점 제거하기, 그리고 맨 아래에 구분선과 함께 이 가능 시간 자체를 삭제하는 항목을
  // danger 스타일로 넣는다 — 터치 기기는 마우스 호버(×버튼)를 쓸 수 없으므로 이 메뉴가 유일한
  // 삭제 경로이고, PC에서도 호버 ×버튼과 별개로 똑같이 쓸 수 있다.
  function buildRequestRunMenu(member, run, x, y) {
    const excluded = new Set((member.locationIds || []).concat(requestRunExtraLocationIds(run)));
    const addableLocations = state.locations.filter(l => !excluded.has(l.id));
    const items = addableLocations.length > 0
      ? addableLocations.map(l => ({ label: l.name + " 추가하기", onClick: () => addExtraLocationToRun(run, l.id) }))
      : [{ label: "추가할 수 있는 지점이 없습니다", disabled: true }];
    const extraIds = requestRunExtraLocationIds(run);
    if (extraIds.length > 0) {
      items.push({ separator: true });
      extraIds.forEach(id => {
        const loc = locationById(id);
        if (!loc) return;
        items.push({ label: loc.name + " 제거하기", danger: true, onClick: () => removeExtraLocationFromRun(run, id) });
      });
    }
    items.push({ separator: true });
    items.push({ label: "가능 시간 삭제하기", danger: true, onClick: () => removeRequests(run.reqs.map(r => r.id)) });
    return items;
  }

  function renderRequestList() {
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
          link.addEventListener("click", e => {
            e.preventDefault();
            goToPage("members");
          });
          return link;
        })(),
        "에서 먼저 회원을 등록해 주세요."
      );
      requestSummaryEl.style.display = "";
      scheduleInteractiveEl.style.display = "none";
      return;
    }
    scheduleInteractiveEl.style.display = "";

    // 지점 등록 순서(state.locations)를 기준으로 회원 탭을 첫 번째 지점별로 묶어서 표시한다.
    const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
    const sortedMembers = state.members.slice().sort((a, b) => {
      const ao = locOrder.has(a.locationIds[0]) ? locOrder.get(a.locationIds[0]) : Infinity;
      const bo = locOrder.has(b.locationIds[0]) ? locOrder.get(b.locationIds[0]) : Infinity;
      return ao - bo;
    });

    if (!activeScheduleMemberId || !state.members.some(m => m.id === activeScheduleMemberId)) {
      activeScheduleMemberId = null;
    }
    const activeMember = activeScheduleMemberId ? memberById(activeScheduleMemberId) : null;

    const registeredCount = new Set(state.requests.map(r => r.memberId)).size;
    requestSummaryEl.textContent = "등록 " + registeredCount + "명 · 미등록 " + (state.members.length - registeredCount) + "명";
    requestSummaryEl.style.display = "";

    sortedMembers.forEach(member => {
      const reqCount = state.requests.filter(r => r.memberId === member.id).length;
      const hasRequests = reqCount > 0;
      // 탭 안에 삭제(×) 버튼을 함께 넣어야 해서(상담 회원 한정) <button> 중첩을 피하려고 탭 자체는 div로 만든다.
      const tab = document.createElement("div");
      tab.className = "member-tab" +
        (hasRequests ? " has-req" : " no-req") +
        (member.id === activeScheduleMemberId ? " active" : "");
      tab.title = hasRequests ? "가능 시간 " + reqCount + "건 등록됨" : "가능 시간 미등록";

      member.locationIds.forEach(locId => {
        const loc = locationById(locId);
        if (!loc) return;
        const locBadge = document.createElement("span");
        locBadge.className = "tab-loc";
        locBadge.textContent = loc.name.charAt(0);
        locBadge.title = loc.name;
        tab.appendChild(locBadge);
      });
      const tabName = member.name + ((member.category || "상담") === "상담" ? " (상담)" : "");
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

    rangeAddRowEl.style.display = activeMember && activeMember.locationIds.length > 0 ? "" : "none";
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
      hint.textContent = "회원관리에서 '" + activeMember.name + "' 회원의 지점을 먼저 선택해주세요.";
      scheduleChipRowEl.appendChild(hint);
      return;
    }

    const myReqs = state.requests.filter(r => r.memberId === activeMember.id);
    const color = memberColor(activeMember.id);
    const memberLabel = activeMember.name + ((activeMember.category || "상담") === "상담" ? " (상담)" : "");
    // 겹치거나 맞닿은 후보들은 그리드에 하나의 블록으로 합쳐서 그린다.
    // (개별 후보를 각각 그리면 촘촘하게 겹쳐서 알아볼 수 없게 된다.)
    const runs = mergeRequestRuns(myReqs);
    // 신청은 더 이상 지점 하나에 고정되지 않고 회원이 등록한 모든 지점에서 가능하므로,
    // 블록에는 회원의 지점 전체를 함께 보여준다.
    const memberLocNames = activeMember.locationIds
      .map(id => locationById(id))
      .filter(Boolean)
      .map(l => l.name)
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
    myReqs.forEach(r => {
      rangeStartSlot = Math.min(rangeStartSlot, r.startSlot);
      rangeEndSlot = Math.max(rangeEndSlot, r.startSlot + durationToSlots(r.duration));
    });
    renderGrid(scheduleGridEl, availableCells, {
      blocks: runs.map(run => {
        const displayEndSlot = Math.min(run.endSlot + breakSlots, SLOT_COUNT);
        // "지점 추가하기"로 이 시간대에만 추가해둔 지점이 있으면 이름 뒤에 덧붙여 보여준다.
        const extraNames = requestRunExtraLocationIds(run)
          .map(id => locationById(id))
          .filter(Boolean)
          .map(l => l.name);
        return {
          day: run.day,
          startSlot: run.startSlot,
          duration: (displayEndSlot - run.startSlot) * SLOT_MIN,
          label: memberLabel,
          loc: memberLocNames + (extraNames.length > 0 ? " +" + extraNames.join(",") : ""),
          sublabel: slotLabel(run.startSlot) + "~" + minutesLabel(START_MIN + displayEndSlot * SLOT_MIN),
          color,
          onDelete: () => removeRequests(run.reqs.map(r => r.id)),
          contextMenuItems: (x, y) => buildRequestRunMenu(activeMember, run, x, y)
        };
      }),
      rangeStartSlot,
      rangeEndSlot
    });

    if (myReqs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "generate-hint";
      empty.textContent = "위에서 요일별로 시간대를 고르고 \"한 번에 추가\"를 눌러 가능 시간을 추가하세요.";
      scheduleChipRowEl.appendChild(empty);
    }
  }

  /* ---------------- 후보 계산 보조 함수 ---------------- */
  function requestCells(req) {
    const cells = [];
    const slots = durationToSlots(req.duration);
    for (let i = 0; i < slots; i++) cells.push(cellKey(req.day, req.startSlot + i));
    return cells;
  }

  function isWithinAvailability(req) {
    return requestCells(req).every(k => availableCells.has(k));
  }

  // "미배정 회원"으로 지정된 회원의 신청은 후보 생성에서 아예 빼고 계산한다(다른 조건은
  // 그대로 두고 그 회원만 등록조차 안 한 것처럼 취급).
  function isEligibleRequest(req) {
    return isWithinAvailability(req) && !currentExcludedIds().includes(req.memberId);
  }

  // day가 days(회원이 이미 배정된 요일들) 중 하나와 연속된 이틀을 이루는지 확인한다.
  // 일요일은 다루지 않으므로(토~월 사이에 쉬는 일요일이 끼어 있음) 주 경계 wraparound는 연속으로 보지 않는다.
  function isAdjacentDay(day, days) {
    for (const d of days) {
      if (Math.abs(d - day) === 1) return true;
    }
    return false;
  }

  // 회원이 등록한 지점들 중 어디서든 그 신청을 소화할 수 있다고 보고, 배정 시점에
  // 실제로 사용할 지점을 그 순간의 상황(이동 시간)에 맞춰 고른다.
  function candidateLocationsFor(memberId) {
    const member = memberById(memberId);
    return (member && member.locationIds && member.locationIds.length > 0) ? member.locationIds : [null];
  }

  // 회원의 기본 지점들에 더해, 그 신청 하나에만 "지점 추가하기"로 별도로 허용해둔 지점
  // (req.extraLocationIds)까지 합쳐서 돌려준다 — 다른 신청(시간대)에는 영향을 주지 않는다.
  function candidateLocationsForRequest(req) {
    const base = candidateLocationsFor(req.memberId).filter(id => id !== null);
    const extra = (req.extraLocationIds || []).filter(id => !base.includes(id));
    const combined = base.concat(extra);
    return combined.length > 0 ? combined : [null];
  }

  // 두 세션 사이에 실제로 확보해야 하는 최소 간격(분): 쉬는 시간 없이, 지점이 다를 때만 그
  // 이동 시간만큼(BREAK_MIN은 0이라 같은 지점이면 간격이 필요 없다). "스케줄과 이동시간은
  // 겹칠 수 없습니다" 조건의 하한이다. 10분 슬롯 격자에 맞춰 올림한다 — 이동 시간이 슬롯
  // 배수가 아니면(예: 15분) 정확히 그 값에 맞는 시작 시각이 격자 위에 존재할 수 없으므로,
  // 격자에서 표현 가능한 가장 좁은 간격을 "빈 시간 없음"의 기준으로 삼아야 한다.
  function requiredGapMin(locA, locB) {
    const raw = Math.max(BREAK_MIN, travelMinutes(locA, locB));
    return Math.ceil(raw / SLOT_MIN) * SLOT_MIN;
  }

  // tie-break(preferDaytime 옵션)의 "낮 시간대 우선"에 쓴다 — 18시 이전에
  // 시작하는 신청인지만 보면 된다.
  const DAYTIME_END_MIN = 18 * 60;
  function isDaytimeStart(cand) {
    return START_MIN + cand.startSlot * SLOT_MIN < DAYTIME_END_MIN;
  }

  // 하루의 첫 수업이 13:00, 13:30처럼 30분 단위 시각에 시작하는지 본다 — 인원·이동까지
  // 동점일 때만 우선하는 tie-break이다(buildBestChain의 alignedScore). 인원을 줄이면서까지
  // 강제하지는 않는다. 이미 앞 세션에 맞물려 이어지는 두 번째 이후 세션은 관계없다.
  function isHalfHourStart(cand) {
    return (START_MIN + cand.startSlot * SLOT_MIN) % 30 === 0;
  }

  // 그 요일의 지점 간 이동 횟수(시간순으로 지점이 바뀌는 지점 수, 이동 시간이 0분인 지점
  // 쌍은 실제 이동으로 치지 않음)를 센다. "하루 이동은 최소화하며 최대 허용 횟수까지" 조건에 쓴다.
  function dailyTravelCount(chain) {
    let count = 0;
    for (let i = 1; i < chain.length; i++) {
      if (travelMinutes(chain[i - 1].locationId, chain[i].locationId) > 0) count++;
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
  function greedyAssign(eligibleReqs, options, pinned) {
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
    const forceOnceMemberIds = options.forceOnceMemberIds ? new Set(options.forceOnceMemberIds) : null;
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
    eligibleReqs.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const days = [...byDay.keys()].sort((a, b) => a - b);
    const allLocIds = state.locations.map(l => l.id).concat([null]);
    function allMemberIdsForDay(day) {
      return new Set((byDay.get(day) || []).map(r => r.memberId));
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
      if (usedDays && usedDays.size >= maxSessionsFor(memberById(memberId))) return false; // 최대 2회(상담 회원은 최대 1회)
      return true;
    }
    function commit(day, located) {
      assigned.push(located);
      if (!memberDays.has(located.memberId)) memberDays.set(located.memberId, new Set());
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
    function buildBestChain(day, eligibleMemberIds, weightFn, endBefore, onlyLocationId) {
      weightFn = weightFn || (() => 1);
      // 이 함수 실행 동안(= day 하루치 체인을 짜는 동안) 다른 요일의 확정 이동 횟수는 바뀌지
      // 않으므로 한 번만 구해둔다.
      const otherDaysTravelUsed = maxTravelsPerWeek != null ? weeklyTravelUsedExcluding(day) : 0;
      const cands = (byDay.get(day) || []).filter(r => eligibleMemberIds.has(r.memberId)
        && (!endBefore || r.startSlot + durationToSlots(r.duration) <= endBefore.slot));
      const nodes = [];
      cands.forEach(cand => {
        const memberLocs = candidateLocationsForRequest(cand);
        const locs = onlyLocationId ? (memberLocs.includes(onlyLocationId) ? [onlyLocationId] : []) : memberLocs;
        locs.forEach(locId => {
          nodes.push({ cand, locationId: locId, end: cand.startSlot + durationToSlots(cand.duration) });
        });
      });
      nodes.sort((a, b) => a.end - b.end || priorityRank.get(a.cand.id) - priorityRank.get(b.cand.id));

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
      function timeCostOf(n) { return n.travelMinutesSum + n.idleMinutesSum; }
      function addToIndex(node) {
        const k = key(node.end, node.locationId);
        if (!index.has(k)) index.set(k, []);
        const list = index.get(k);
        list.push(node);
        list.sort((a, b) => travelFirst
          ? (a.travelCount - b.travelCount) || (b.dp - a.dp)
            || (travelCountOnly ? 0 : (a.travelMinutesSum - b.travelMinutesSum) || (timeCostOf(a) - timeCostOf(b)) || (b.alignedScore - a.alignedScore) || (a.soloSlackPenalty - b.soloSlackPenalty))
            || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0)
          : (b.dp - a.dp) || (a.travelCount - b.travelCount)
            || (travelCountOnly ? 0 : (a.travelMinutesSum - b.travelMinutesSum) || (timeCostOf(a) - timeCostOf(b)) || (b.alignedScore - a.alignedScore) || (a.soloSlackPenalty - b.soloSlackPenalty))
            || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0));
      }
      function chainScore(node) {
        let s = 0, n = node;
        while (n) { s += priorityRank.get(n.cand.id); n = n.prev; }
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
      function isBetterPair(dpA, countA, travelA, timeCostA, alignedA, slackPenA, daytimeA, groupA, dpB, countB, travelB, timeCostB, alignedB, slackPenB, daytimeB, groupB) {
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
      nodes.forEach(node => {
        // 회원 중복 금지는 "바로 앞 세션"뿐 아니라 체인 전체를 봐야 하므로(usedMembers), 각
        // predLoc(어느 지점에서 왔는지)마다 그 버킷에서 가장 좋은(색인이 이미 그 순서로 정렬된)
        // 항목부터 훑어 회원이 겹치지 않는 첫 항목을 취하고, predLoc들 사이에서는 결과
        // (dp, 이동 횟수, 이동시간+빈시간 합, 정렬 점수, 낮 시간대 점수, 지점 묶기 점수)를
        // 서로 비교해 최종적으로 가장 좋은 것을 고른다.
        let bestPrev = null, bestPrevDp = -Infinity, bestResultTravelOnly = Infinity, bestResultTimeCost = Infinity, bestResultAligned = -Infinity, bestResultSlackPen = Infinity, bestResultDaytime = -Infinity, bestResultGroup = -Infinity, bestTravelCount = Infinity, bestTransitionMin = 0, bestSlackMin = 0;
        allLocIds.forEach(predLoc => {
          const need = requiredGapMin(predLoc, node.locationId);
          const transitionMin = travelMinutes(predLoc, node.locationId);
          // 필요한 간격(need)보다 최대 allowGapMin분까지 더 벌어져도(=설명 안 되는
          // 빈 시간이 그만큼 생겨도) 이어붙일 수 있다 — 10분 단위 슬롯마다 하나씩 확인한다.
          for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {
            const reqEnd = node.cand.startSlot - (need + slackMin) / SLOT_MIN;
            const list = index.get(key(reqEnd, predLoc));
            if (!list) continue;
            for (const prevNode of list) {
              if (prevNode.usedMembers.has(node.cand.memberId)) continue;
              // 숨김 하드 로직: 세 지점을 모두 다니는 회원이 이동으로 도착한 세션이면, 거기서
              // 또 이동으로 이어지는 연결은 막는다("이동-회원-이동" 금지). 같은 지점에서 다른
              // 회원에게 이어지는 것(이동-회원-다른회원-이동)은 transitionMin이 0이라 여기 걸리지 않는다.
              if (soloTravelIds.has(prevNode.cand.memberId)
                && prevNode.arrivedViaTravel && transitionMin > 0) continue;
              const tc = prevNode.travelCount + (transitionMin > 0 ? 1 : 0);
              if (tc > maxTravelsPerDay) continue; // 하루 이동 최대 허용 횟수
              if (maxTravelsPerWeek != null && otherDaysTravelUsed + tc > maxTravelsPerWeek) continue; // 일주일 총 이동 최대 허용 횟수
              const resultTravelOnly = prevNode.travelMinutesSum + transitionMin;
              const resultTimeCost = resultTravelOnly + prevNode.idleMinutesSum + slackMin;
              // 숨김 소프트 로직: 세 지점을 모두 다니는 회원이 같은 지점 앞사람에게서 슬랙(빈 시간)을
              // 써서 이어붙으면 그만큼 페널티를 쌓는다 — 슬랙 없이 붙거나(0) 이동으로 이어지는 경우는 0.
              const slackPenalty = (soloTravelIds.has(node.cand.memberId)
                && transitionMin === 0 && slackMin > 0) ? slackMin : 0;
              const resultSlackPen = prevNode.soloSlackPenalty + slackPenalty;
              if (!bestPrev || isBetterPair(prevNode.dp, tc, resultTravelOnly, resultTimeCost, prevNode.alignedScore, resultSlackPen, prevNode.daytimeScore, prevNode.groupScore, bestPrevDp, bestTravelCount, bestResultTravelOnly, bestResultTimeCost, bestResultAligned, bestResultSlackPen, bestResultDaytime, bestResultGroup)) {
                bestPrevDp = prevNode.dp; bestPrev = prevNode; bestTravelCount = tc;
                bestResultTravelOnly = resultTravelOnly; bestResultTimeCost = resultTimeCost; bestTransitionMin = transitionMin; bestSlackMin = slackMin;
                bestResultAligned = prevNode.alignedScore; bestResultSlackPen = resultSlackPen;
                bestResultDaytime = prevNode.daytimeScore; bestResultGroup = prevNode.groupScore;
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
          node.groupScore = bestPrev.groupScore + (bestPrev.locationId === node.locationId ? 1 : 0); // 지점을 바꾸지 않고 이어지면 +1
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
          const tie = best && node.dp === best.dp && node.travelCount === best.travelCount
            && (travelCountOnly || node.travelMinutesSum === best.travelMinutesSum)
            && (travelCountOnly || nodeTimeCost === bestTimeCost)
            && (travelCountOnly || node.alignedScore === best.alignedScore)
            && (travelCountOnly || node.soloSlackPenalty === best.soloSlackPenalty)
            && (!preferDaytime || node.daytimeScore === best.daytimeScore)
            && (!groupByLocation || node.groupScore === best.groupScore);
          if (!best || isBetterPair(node.dp, node.travelCount, node.travelMinutesSum, nodeTimeCost, node.alignedScore, node.soloSlackPenalty, node.daytimeScore, node.groupScore,
            best.dp, best.travelCount, best.travelMinutesSum, bestTimeCost, best.alignedScore, best.soloSlackPenalty, best.daytimeScore, best.groupScore)
            || (tie && chainScore(node) < chainScore(best))) best = node;
        }
      });

      let chosen = best;
      if (endBefore) {
        // 하루 전체에서 가장 좋은 체인이 아니라, endBefore 앞에 정확히 맞물려 끝나는 체인 중
        // 가장 좋은 것을 고른다 (지점마다 필요한 간격이 달라 위치별로 인덱스를 조회한다).
        chosen = null;
        allLocIds.forEach(loc => {
          const need = requiredGapMin(loc, endBefore.locationId);
          const transitionMin = travelMinutes(loc, endBefore.locationId);
          for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {
            const gapSlots = (need + slackMin) / SLOT_MIN;
            const list = index.get(key(endBefore.slot - gapSlots, loc));
            if (!list || list.length === 0) continue;
            // 이미 버킷 안에서 가장 좋은 순으로 정렬되어 있으니 첫 유효 항목을 쓴다 — 다만
            // 숨김 하드 로직에 걸리는 회원이면("이동-회원-이동") 다음 후보를 본다.
            const node = list.find(n => !(soloTravelIds.has(n.cand.memberId)
              && n.arrivedViaTravel && transitionMin > 0));
            if (!node) continue;
            const nodeTimeCost = timeCostOf(node);
            const chosenTimeCost = chosen ? timeCostOf(chosen) : null;
            if (!chosen || isBetterPair(node.dp, node.travelCount, node.travelMinutesSum, nodeTimeCost, node.alignedScore, node.soloSlackPenalty, node.daytimeScore, node.groupScore, chosen.dp, chosen.travelCount, chosen.travelMinutesSum, chosenTimeCost, chosen.alignedScore, chosen.soloSlackPenalty, chosen.daytimeScore, chosen.groupScore)) {
              chosen = node;
            }
          }
        });
      }

      if (!chosen) return [];
      const chain = [];
      let cur = chosen;
      while (cur) {
        chain.unshift({ id: cur.cand.id, memberId: cur.cand.memberId, day, startSlot: cur.cand.startSlot, duration: cur.cand.duration, locationId: cur.locationId });
        cur = cur.prev;
      }
      return chain;
    }

    // 이미 확정된 체인 뒤에 정확히 맞물리는 다음 신청을, 우선순위가 가장 앞선 것부터 하나씩
    // 이어붙인다(뒤쪽으로만 확장 — 앞쪽 빈 시간은 아래 extendChainBackward가 별도로 채운다).
    function extendExistingChain(day, eligibleMemberIds) {
      let chain = chainByDay.get(day) || [];
      if (chain.length === 0) return;
      const usedMembers = new Set(chain.map(s => s.memberId));
      const dayCands = byDay.get(day) || [];
      let extending = true;
      while (extending) {
        extending = false;
        const chainEnd = chain[chain.length - 1];
        // 숨김 하드 로직: chainEnd가 세 지점을 모두 다니는 회원이고 그 자신도 이동으로
        // 도착했다면, 여기서 또 이동으로 이어붙이는 것은 막는다("이동-회원-이동" 금지,
        // buildBestChain의 동일 로직 참고).
        const chainEndArrivedViaTravel = chain.length >= 2 && chain[chain.length - 2].locationId !== chainEnd.locationId;
        const chainEndIsSoloTravelMember = soloTravelIds.has(chainEnd.memberId) && chainEndArrivedViaTravel;
        // "하루 이동은 최소화"하기 위해, 여러 회원이 동시에 이어붙을 수 있으면 이동 시간이
        // 적게 드는 쪽을 먼저 고르고, 그래도 같으면 우선순위(priorityRank)로 정한다.
        let bestCand = null, bestLocated = null, bestCost = Infinity;
        dayCands.forEach(cand => {
          if (!eligibleMemberIds.has(cand.memberId) || usedMembers.has(cand.memberId)) return;
          let bestLoc = null;
          candidateLocationsForRequest(cand).forEach(locId => {
            const need = requiredGapMin(chainEnd.locationId, locId);
            const actual = (cand.startSlot - (chainEnd.startSlot + durationToSlots(chainEnd.duration))) * SLOT_MIN;
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
          if (!bestCand || bestLoc.cost < bestCost
            || (bestLoc.cost === bestCost && priorityRank.get(cand.id) < priorityRank.get(bestCand.id))) {
            bestCand = cand;
            bestCost = bestLoc.cost;
            bestLocated = { id: cand.id, memberId: cand.memberId, day, startSlot: cand.startSlot, duration: cand.duration, locationId: bestLoc.locId };
          }
        });
        if (bestLocated) {
          const projectedChain = [...chain, bestLocated];
          if (dailyTravelCount(projectedChain) > maxTravelsPerDay) break; // 하루 이동 최대 허용 횟수
          if (maxTravelsPerWeek != null
            && weeklyTravelUsedExcluding(day) + dailyTravelCount(projectedChain) > maxTravelsPerWeek) break; // 일주일 총 이동 최대 허용 횟수
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
      const usedMembers = new Set(chain.map(s => s.memberId));
      const remaining = new Set([...eligibleMemberIds].filter(id => !usedMembers.has(id)));
      if (remaining.size === 0) return;
      const chainStart = chain[0];
      const frontChain = buildBestChain(day, remaining, weightFn, { slot: chainStart.startSlot, locationId: chainStart.locationId });
      if (frontChain.length === 0) return;
      const combined = [...frontChain, ...chain];
      if (dailyTravelCount(combined) > maxTravelsPerDay) return;
      if (maxTravelsPerWeek != null && weeklyTravelUsedExcluding(day) + dailyTravelCount(combined) > maxTravelsPerWeek) return;
      frontChain.forEach(s => {
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
        buildBestChain(day, eligibleMemberIds, weightFn).forEach(s => commit(day, s));
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
      pinned.forEach(p => {
        if (!pinsByDay.has(p.day)) pinsByDay.set(p.day, []);
        pinsByDay.get(p.day).push(p);
      });
      pinsByDay.forEach((dayPins, day) => {
        dayPins.sort((a, b) => a.startSlot - b.startSlot);
        const pinnedMemberIds = new Set(dayPins.map(p => p.memberId));
        const beforeEligible = new Set([...allMemberIdsForDay(day)].filter(id => !pinnedMemberIds.has(id)));
        const firstPin = dayPins[0];
        buildBestChain(day, beforeEligible, fairnessWeight, { slot: firstPin.startSlot, locationId: firstPin.locationId })
          .forEach(s => commit(day, s));
        dayPins.forEach(p => commit(day, p));
      });
    }

    // 지정한 요일에는, 지정한 지점만으로 만들 수 있는 최대(가장 많이 배정되는) 체인을 1단계보다
    // 먼저 확정한다(strengthenCandidate가 모든 요일×지점 조합에 대해 이 옵션을 시도해본다).
    // 그 요일에 이미 확정(고정)된
    // 세션이 있으면 충돌을 피해 건드리지 않는다. 이후 1~3단계는 이 체인 뒤(extendExistingChain)와
    // 나머지 요일에서 평소처럼 진행되므로 "그 지점을 최대한 먼저 배정하고 나머지를 배정"이 된다.
    if (pinnedLocationDay && !(pinned.some(p => p.day === pinnedLocationDay.day)) && (byDay.get(pinnedLocationDay.day) || []).length > 0) {
      buildBestChain(pinnedLocationDay.day, allMemberIdsForDay(pinnedLocationDay.day), fairnessWeight, null, pinnedLocationDay.locationId)
        .forEach(s => commit(pinnedLocationDay.day, s));
    }

    // 1단계: 아직 아무 것도 못 받은 회원들만으로 요일별 체인을 새로 짠다. stage1Order가 그 순서를 정한다.
    // sessionCountFirst(후보B)이면 "아직 못 받은 회원만"이라는 제약을 두지 않는다 —
    // 인원(서로 다른 회원 수) 우선이 아니라 세션 총 개수 자체를 곧바로 최대화하기 위함이다.
    stage1Order.forEach(day => {
      const elig = new Set([...allMemberIdsForDay(day)].filter(id => {
        if (!sessionCountFirst) {
          const usedDays = memberDays.get(id);
          if (usedDays && usedDays.size >= 1) return false;
        }
        return withinCaps(id, day);
      }));
      fillDay(day, elig, fairnessWeight);
    });

    // 2단계: 남는 자리 중 연속된 요일이 아닌 곳부터 추가로 채운다.
    days.forEach(day => {
      const elig = new Set([...allMemberIdsForDay(day)].filter(id => {
        if (!withinCaps(id, day)) return false;
        const usedDays = memberDays.get(id);
        if (usedDays && isAdjacentDay(day, usedDays)) return false;
        return true;
      }));
      fillDay(day, elig);
    });

    // 3단계: 그래도 남는 자리는 연속 요일도 허용해 한도까지 채운다.
    days.forEach(day => {
      const elig = new Set([...allMemberIdsForDay(day)].filter(id => withinCaps(id, day)));
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
      let bestMemberCount = new Set(best.map(r => r.memberId)).size;
      function consider(order) {
        const attempt = runPass(order, allowGapMin);
        const attemptMemberCount = new Set(attempt.map(r => r.memberId)).size;
        if (attemptMemberCount > bestMemberCount
          || (attemptMemberCount === bestMemberCount && attempt.length > best.length)) {
          best = attempt; bestMemberCount = attemptMemberCount;
        }
      }
      if (minimizeUnassigned) {
        consider([...days].sort((a, b) => allMemberIdsForDay(a).size - allMemberIdsForDay(b).size));
      }
      if (externalDayOrder) {
        consider(externalDayOrder.filter(d => byDay.has(d)));
      }
      return best;
    }

    // "이동시간·휴식시간을 제외한 빈 시간은 없도록" 엄격(allowGapMin=0)하게 한 번 배정해보고,
    // 빈 시간을 최대 ALLOWED_GAP_MIN분까지 허용했을 때 실제로 수업(세션) 개수가 늘어나는 경우에만
    // 완화된 결과를 쓴다 — 빈 시간 허용이 세션 수를 늘리지 못한다면(그저 같은 인원을 다르게
    // 배치할 뿐이라면) 빈 시간이 없는 엄격한 배정을 그대로 유지한다.
    const strictResult = runWithGapPolicy(0);
    const looseResult = ALLOWED_GAP_MIN > 0 ? runWithGapPolicy(ALLOWED_GAP_MIN) : strictResult;
    return looseResult.length > strictResult.length ? looseResult : strictResult;
  }

  function totalTravelMinutes(assigned) {
    let total = 0;
    const byDay = new Map();
    assigned.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    byDay.forEach(reqs => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        total += travelMinutes(sorted[i - 1].locationId, sorted[i].locationId);
      }
    });
    return total;
  }

  // 이 후보의 한 주 전체에서 실제로 지점을 옮겨야 했던 횟수(요일별로 이동 시간이 0분보다
  // 큰 전환만 센다 — dailyTravelCount와 같은 기준). "총 이동 n번" 배지에 쓴다.
  function totalTravelCount(assigned) {
    let total = 0;
    const byDay = new Map();
    assigned.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    byDay.forEach(reqs => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        if (travelMinutes(sorted[i - 1].locationId, sorted[i].locationId) > 0) total++;
      }
    });
    return total;
  }

  function buildCandidate(title, desc, sortedReqs, eligibleSet, allMemberIds, options, pinned) {
    const assigned = greedyAssign(sortedReqs.filter(r => eligibleSet.has(r.id)), options, pinned);
    const assignedMemberIds = new Set(assigned.map(r => r.memberId));
    const unassignedMembers = [...allMemberIds]
      .filter(id => !assignedMemberIds.has(id))
      .map(id => memberById(id))
      .filter(Boolean);
    return { title, desc, assigned, unassignedMembers, travelMinutes: totalTravelMinutes(assigned) };
  }

  // 각 전략은 "거의 동시에 경합하는" 신청들 사이에서 jitter 값으로 순서를 정한다.
  // 시작 시각이 정확히 같은 신청끼리만 비교하면, 회원마다 서로 다른 시각을 신청한
  // 실제 데이터에서는 동점이 거의 발생하지 않아 재생성을 눌러도 결과가 바뀌지 않는다.
  // 그래서 시작 시각을 한 세션 길이(CONTENTION_BUCKET_SLOTS) 단위로 묶어, 같은 구간 안에서
  // 겹칠 가능성이 있는 신청들은 모두 jitter로 순서를 섞은 뒤에야 실제 시작 시각으로 정렬한다.
  // jitter가 전부 0이면 항상 같은 결과, 랜덤 값을 주면 그 전략 안에서 다른 배정을 시도해볼 수 있다 (후보별 재생성용).
  const CONTENTION_BUCKET_SLOTS = durationToSlots(SESSION_DURATION_MIN);

  // 요일별로 하루씩 채운다는 전제 아래, "빨리 끝나는 신청부터" 채워나가는 순서를 모든 후보의
  // 공통 뼈대로 쓴다. "이동시간, 휴식시간을 제외한 빈 시간은 없어야 하되, 세션 수가 늘어날
  // 때만 최대 10분까지 예외로 허용" 조건을 지키려면 이 순서가 그리디 배정에서 빈 시간을 가장 적게 남긴다 —
  // 지점별로 묶거나 회원 우선순위를 앞세우면 실제 시간 순서와 어긋나는 신청이 먼저 채워져
  // 자리가 빈 채로 남는 경우가 생기기 때문. 요일을 항상 가장 먼저 비교해야 하는데, 그렇지
  // 않으면 시간대만 이른 다른 요일 신청이 앞서 처리되면서 회원이 정작 필요한 요일 대신
  // 엉뚱한 요일에 먼저 배정받아, 원래라면 채울 수 있었던 같은 날의 빈 시간을 놓치게 된다.
  // 각 후보는 이 뼈대 위에서, 같은 요일·같은 버킷(끝나는 시각)의 신청들 사이의 동점 순서만
  // 서로 다르게 정해 자신의 특성을 낸다.
  function reqEnd(r) { return r.startSlot + durationToSlots(r.duration); }
  function endBucket(r) { return Math.floor(reqEnd(r) / CONTENTION_BUCKET_SLOTS); }
  // 네 후보 모두 같은 뼈대(요일 → 끝나는 시각 → jitter)로 정렬하고,
  // 계산 기준(인원 최대화 → 이동 최소화)도 모두 같다. 지점별로 묶는 힌트는 여기 넣지 않는다 —
  // 바로 위 경고대로 실제 시간 순서와 어긋나는 신청이 먼저 채워져 빈 시간이 남을 수 있다.
  // (그런 "지점별로 묶기"가 필요하면 groupByLocation 옵션으로 buildBestChain의 체인 선택
  // 단계에서만, 이미 완성된 동점 체인들 사이에서 고르게 한다 — 정렬 자체를 건드리지 않는다.)
  // 후보B는 sessionCountFirst 옵션으로, 인원(서로 다른 회원 수)이 아니라 총 수업 건수 자체를
  // 먼저 최대화한다. 후보A는 minimizeUnassigned 옵션으로, 기본 순서와 "대안이
  // 좁은 요일부터 먼저 채우는" 순서를 둘 다 시도해보고 실제로 미배정 회원이 더 적은 쪽을 택한다.
  function defaultSort(eligible, jitter) {
    return [...eligible].sort((a, b) =>
      a.day - b.day
      || (endBucket(a) - endBucket(b))
      || (jitter.get(a.id) - jitter.get(b.id))
      || reqEnd(a) - reqEnd(b));
  }

  // 표시 순서는 사용자가 지정한 순서를 그대로 따른다: A(기본, 미배정 없음 → 총 수업 건수 →
  // 이동 횟수 순으로 비교하되, 신청 가능한 회원이 적은 요일부터 먼저 채우는 대안 순서도 함께
  // 시도해보고 미배정이 더 적은 쪽을 택한다) → B(A와 같은 세 값을 비교하되 인원 대신 총 수업
  // 건수를 먼저 최대화 → 인원(미배정 1명까지 허용) → 이동 횟수).
  const STRATEGIES = [
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
      sort: defaultSort
    },
    {
      title: "후보B - 수업 횟수 최대",
      desc: "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.",
      options: { sessionCountFirst: true, strengthenSearch: "sessions", maxUnassigned: 1 },
      sort: defaultSort
    }
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
  function strengthenCandidate(baseline, sorted, eligibleIds, allMemberIds, options, pinned, primary) {
    // score/isBetter는 candidateSearchScore/isCandidateWorse와 같은 기준(options.maxUnassigned
    // 포함)을 써야 한다 — 여기서만 따로 계산하면 후보B의 "미배정 1명까지 허용" 상한이 이
    // 사전 강화 단계에서는 무시된 채 수업 건수만으로 골라버릴 수 있다.
    let best = baseline;
    let bestScore = candidateSearchScore(best, primary, options.maxUnassigned);
    function consider(opts) {
      const attempt = buildCandidate(baseline.title, baseline.desc, sorted, eligibleIds, allMemberIds, opts, pinned);
      const attemptScore = candidateSearchScore(attempt, primary, options.maxUnassigned);
      if (isCandidateWorse(bestScore, attemptScore)) {
        best = attempt; bestScore = attemptScore;
      }
    }

    // 요일별 1단계 처리 순서(sessionCountFirst)를 반대로 뒤집은 옵션도 함께 시도한다. 후보A
    // (count 우선)와 후보B(sessions 우선)는 이 옵션 하나만 다른데, 그리디 특성상 반대쪽
    // 순서가 스스로 내세운 기준(예: 후보A라면 인원이 동점일 때 총 수업 건수)에서 오히려 더
    // 나은 결과를 우연히 찾아내는 경우가 있다. 뒤집은 옵션에도 아래 day×지점 사전 배정을
    // 똑같이 시도해야, 상대 후보가 자기 자신을 강화할 때 찾아낸 조합까지 놓치지 않는다.
    const flippedOptions = Object.assign({}, options, { sessionCountFirst: !options.sessionCountFirst });
    consider(flippedOptions);

    if (state.locations.length >= 2) {
      [options, flippedOptions].forEach(optsVariant => {
        DAYS.forEach((d, day) => {
          state.locations.forEach(loc => {
            consider(Object.assign({}, optsVariant, { pinnedLocationDay: { day, locationId: loc.id } }));
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
  function repairUnassigned(baseline, sorted, eligibleIds, allMemberIds, options, pinned, primary) {
    let best = baseline;
    let bestScore = candidateSearchScore(best, primary, options.maxUnassigned);
    function tryForce(ids) {
      const forcedOptions = Object.assign({}, options, { forceOnceMemberIds: ids });
      const attempt = buildCandidate(baseline.title, baseline.desc, sorted, eligibleIds, allMemberIds, forcedOptions, pinned);
      const attemptScore = candidateSearchScore(attempt, primary, options.maxUnassigned);
      if (!isCandidateWorse(attemptScore, bestScore)) {
        best = attempt;
        bestScore = attemptScore;
        return true;
      }
      return false;
    }
    if (baseline.unassignedMembers.length > 0 && baseline.unassignedMembers.length <= 6) {
      tryForce(baseline.unassignedMembers.map(m => m.id));
    }
    const tried = new Set();
    let guard = 0;
    while (guard < 6) {
      guard++;
      const target = best.unassignedMembers.find(m => !tried.has(m.id));
      if (!target) break;
      tried.add(target.id);
      tryForce([target.id]);
    }
    return best;
  }

  function buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, jitter, pinned, dayOrder) {
    const strategy = STRATEGIES[strategyIndex];
    const sorted = strategy.sort(eligible, jitter);
    const strategyOptions = typeof strategy.options === "function" ? strategy.options() : strategy.options;
    // dayOrder가 주어지면(재생성 탐색이 매 시도마다 무작위로 섞은 요일 순서 —
    // searchStrategyPool·generateCandidatesAsync 참고) greedyAssign의 stage1DayOrder로 넘겨,
    // 이번 시도에서 그 순서가 기본 순서보다 배정 인원을 늘리는지도 함께 비교하게 한다.
    const globalOptions = {};
    if (dayOrder) globalOptions.stage1DayOrder = dayOrder;
    const options = Object.assign({}, strategyOptions, globalOptions);
    let cand = buildCandidate(strategy.title, strategy.desc, sorted, eligibleIds, allMemberIds, options, pinned);
    // strengthenSearch는 전략의 "이름"(배열 위치가 아니라)에 매인 명시적 플래그다 — 배열 순서가
    // 또 바뀌어도 엉뚱한 후보에 이 사전 탐색이 붙거나 빠지지 않도록.
    if (strategyOptions.strengthenSearch) {
      cand = strengthenCandidate(cand, sorted, eligibleIds, allMemberIds, options, pinned, strategyOptions.strengthenSearch);
      if (cand.unassignedMembers.length > 0) {
        cand = repairUnassigned(cand, sorted, eligibleIds, allMemberIds, options, pinned, strategyOptions.strengthenSearch);
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
  function candidateSearchScore(cand, primary, maxUnassigned) {
    const count = new Set(cand.assigned.map(r => r.memberId)).size;
    const sessions = cand.assigned.length;
    const travel = totalTravelCount(cand.assigned);
    const capOk = (typeof maxUnassigned === "number" && cand.unassignedMembers.length > maxUnassigned) ? 0 : 1;
    const base = primary === "sessions" ? [sessions, count, travel] : [count, sessions, travel];
    return [capOk, base[0], base[1], base[2]];
  }
  function isCandidateWorse(a, b) {
    if (a[0] !== b[0]) return a[0] < b[0];
    if (a[1] !== b[1]) return a[1] < b[1];
    if (a[2] !== b[2]) return a[2] < b[2];
    return a[3] > b[3];
  }
  // 두 candidateSearchScore 튜플이 완전히 동점인지("배치 페이저"용 — 미배정/수업 건수/이동
  // 횟수까지 전부 같아 카드 pill 표시가 동일한 경우만 같은 풀로 묶는다).
  function isCandidateScoreTie(a, b) {
    return !isCandidateWorse(a, b) && !isCandidateWorse(b, a);
  }
  // strategyIndex의 STRATEGIES 정의에서 primary("count" 기본 / "sessions")를 읽어온다.
  // options가 함수(후보I/J)면 strengthenSearch를 쓰지 않으므로 항상 기본값이다.
  function strategyPrimary(strategyIndex) {
    const options = STRATEGIES[strategyIndex].options;
    const strategyOptions = typeof options === "function" ? {} : options;
    return strategyOptions.strengthenSearch === "sessions" ? "sessions" : "count";
  }
  // strategyIndex의 STRATEGIES 정의에서 maxUnassigned(미배정 허용 상한, 없으면 null)를 읽어온다.
  function strategyMaxUnassigned(strategyIndex) {
    const options = STRATEGIES[strategyIndex].options;
    const strategyOptions = typeof options === "function" ? {} : options;
    return typeof strategyOptions.maxUnassigned === "number" ? strategyOptions.maxUnassigned : null;
  }

  // 시드 기반 의사난수: 초기 생성 시에도 여러 조합을 탐색해 그중 최선을 보여주되, 같은
  // 데이터라면 "후보 생성하기"를 몇 번을 눌러도 항상 같은 결과가 나오도록(재현 가능하도록)
  // Math.random() 대신 고정 시드로 만든 난수열을 쓴다.
  function makeSeededRandom(seed) {
    let s = seed >>> 0;
    return function() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
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
  function shuffledDayOrder(randomFn) {
    const order = DAYS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    return order;
  }

  // 무거운 동기 계산 중간에 브라우저가 화면을 다시 그릴 틈을 준다(로딩 스피너·진행률 갱신용).
  // 탭이 백그라운드로 가면(다른 탭/앱으로 이동, 화면 잠금 등) requestAnimationFrame 콜백은
  // 브라우저가 아예 실행하지 않으므로, 그때는 setTimeout만으로 양보해 생성이 멈추지 않고
  // (다소 느려지더라도) 계속 진행되게 한다.
  function yieldToUI() {
    if (document.hidden) {
      return new Promise(resolve => setTimeout(resolve, 0));
    }
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
  // yieldToUI로 화면에 제어권을 넘긴 직후에만 "취소" 버튼 클릭이 실제로 처리됐을 수 있으므로,
  // 그 직후마다 이걸 호출해 취소 여부를 확인한다.
  function checkGenerationCancelled() {
    if (generationCancelRequested) throw new GenerationCancelledError();
  }
  const PROGRESS_YIELD_EVERY = 5; // 이만큼 조합을 만들 때마다 한 번씩 진행률을 갱신하고 화면을 그린다

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
  async function searchStrategyPool(strategyIndex, eligible, eligibleIds, allMemberIds, pinned, attempts, randomFn, onProgress) {
    const zeroJitter = new Map(eligible.map(r => [r.id, 0]));
    const pool = [buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, zeroJitter, pinned)];
    for (let i = 0; i < attempts; i++) {
      const jitter = new Map(eligible.map(r => [r.id, randomFn()]));
      const dayOrder = shuffledDayOrder(randomFn);
      pool.push(buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, jitter, pinned, dayOrder));
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
  const INITIAL_SEARCH_ATTEMPTS = 1000;
  // "다음 후보" 시 전략당 추가로 시도해볼 조합 수. regenerateCandidate는 (generateCandidatesAsync와
  // 달리) searchStrategyPool로 그 전략 하나만의 풀을 새로 만들어 쓰므로 다른 전략 수의 영향을
  // 받지 않는다 — 초기 생성과 다른 값을 쓸 수 있도록 별도로 둔 것뿐이다.
  const REGENERATE_SEARCH_ATTEMPTS = 25;

  // strategyIndex별로 "이미 보여준 배정 결과"를 기록해, 재생성 시 똑같은 조합이 다시 나오는지
  // 판별한다. 배정 결과(assigned)를 이루는 신청 id 집합을 그대로 서명으로 쓴다 — 같은
  // 신청 조합이면 같은 서명이 나온다. (페이지를 새로고침하면 초기화되는 세션 한정 기록.)
  const candidateHistory = {}; // strategyIndex -> Set(signature)
  // strategyIndex별로, 재생성으로 덮어쓰기 전의 이전 후보를 순서대로 쌓아둔다 — "이전 후보
  // 다시보기" 버튼으로 되돌아갈 수 있게(여러 번 재생성했으면 여러 단계 되돌아갈 수 있다).
  // candidateHistory와 마찬가지로 새로고침하면 초기화되는 세션 한정 기록.
  const candidateUndoStack = {}; // strategyIndex -> Candidate[]

  // "배치 페이저"용: 미배정/수업 건수/이동 횟수(후보A는 이동 시간·빈 시간까지) 지표가 완전히
  // 동점인 배치를 최대 이만큼만 서로 다른 배정(서명 기준)으로 모아둔다 — 화면이 지저분해지지
  // 않게 상한을 둔다.
  const MAX_POOL_VARIANTS = 6;
  // strategyIndex별 동점 배치 풀(후보B/C). candidates[strategyIndex]는 항상 이 풀의 한 항목과
  // 같은 객체 참조를 가리킨다 — 페이저가 pool.indexOf(현재 후보)로 현재 위치를 찾기 때문이다.
  // candidateHistory와 마찬가지로 저장하지 않는 세션 한정 기록(새로고침하면 초기화).
  const candidatePools = {}; // strategyIndex -> Candidate[]
  // 후보A(체인 DP)의 동점 배치 풀. schedule3Result.candidateA는 항상 이 배열의 한 항목과
  // 같은 객체 참조를 가리킨다. 세션 한정 기록.
  let candidateAPool = [];

  function candidateSignature(cand) {
    return cand.assigned.map(r => r.id).slice().sort().join(",");
  }

  // onProgress(0~1)를 주기적으로 호출해가며 진행률을 알려준다. 실제로 몇 개를 만들었는지를
  // 세는 "진짜" 진행률이라, 회원 수·기기 성능과 상관없이 항상 정확하다(타이머로 흉내낸
  // 가짜 진행바가 아니다).
  async function generateCandidatesAsync(onProgress) {
    // "미배정 회원"으로 지정된 회원은 애초에 없었던 것처럼 취급한다 — 배정 대상에서도,
    // (배정 실패가 아니라 의도적 제외이므로) 미배정 통계에서도 뺀다.
    const allMemberIds = new Set(
      state.requests.filter(r => !currentExcludedIds().includes(r.memberId)).map(r => r.memberId)
    );
    const eligible = state.requests.filter(isEligibleRequest);
    const eligibleIds = new Set(eligible.map(r => r.id));

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
      const zeroJitter = new Map(eligible.map(r => [r.id, 0]));
      pool.push(buildCandidateFromStrategy(idx, eligible, eligibleIds, allMemberIds, zeroJitter, []));
      completed++;
      for (let i = 0; i < INITIAL_SEARCH_ATTEMPTS; i++) {
        const jitter = new Map(eligible.map(r => [r.id, rand()]));
        const dayOrder = shuffledDayOrder(rand);
        pool.push(buildCandidateFromStrategy(idx, eligible, eligibleIds, allMemberIds, jitter, [], dayOrder));
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
      const myWeeklyCap = (strategyOptions && typeof strategyOptions !== "function" && typeof strategyOptions.maxTravelsPerWeek === "number")
        ? strategyOptions.maxTravelsPerWeek : null;
      const myMaxUnassigned = strategyMaxUnassigned(idx);
      let best = null;
      let bestScore = null;
      pool.forEach(cand => {
        if (myWeeklyCap != null && totalTravelCount(cand.assigned) > myWeeklyCap) return;
        const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
        if (!best || isCandidateWorse(bestScore, score)) { best = cand; bestScore = score; }
      });
      const builtCand = Object.assign({}, best, { title: strategy.title, desc: strategy.desc, strategyIndex: idx });
      // 동점 배치 풀: best와 점수가 완전히 같은 항목들을 서명 중복 제거해 모은다. best 자신은
      // builtCand(같은 배정에 title/desc/strategyIndex만 덧붙인 새 객체)로 바꿔 넣어야, 카드가
      // 참조하는 candidates[idx]와 풀 안의 항목이 같은 객체가 되어 페이저의
      // pool.indexOf(현재 후보) 판별이 성립한다.
      const tied = [];
      const seenSig = new Set();
      pool.forEach(cand => {
        if (myWeeklyCap != null && totalTravelCount(cand.assigned) > myWeeklyCap) return;
        const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
        if (!isCandidateScoreTie(score, bestScore)) return;
        const sig = candidateSignature(cand);
        if (seenSig.has(sig)) return;
        seenSig.add(sig);
        if (tied.length < MAX_POOL_VARIANTS) tied.push(cand === best ? builtCand : cand);
      });
      return { builtCand, tied };
    });

    return {
      built: builtPairs.map(p => p.builtCand),
      pools: builtPairs.map(p => p.tied)
    };
  }

  // 후보 카드 하나만 같은 전략 안에서 다시 계산한다 (동점인 신청들의 순서를 랜덤으로 바꿔 다른 배정을 시도).
  // 확정된 세션이 있으면 그대로 고정하고, 나머지 신청들 안에서만 다시 배정한다.
  // 이번 풀(REGENERATE_SEARCH_ATTEMPTS+1개) 안에 이미 봤던 조합밖에 없으면, 처음 후보로
  // 되돌릴지 사용자에게 물어본다.
  // "다음 후보 보기" 버튼을 켤지 판단한다: 확정(고정)된 세션을 뺀 나머지 신청이 하나도
  // 없으면 다시 계산해봐야 항상 같은(빈) 결과라 "다음 후보"라 부를 게 없다.
  function hasRegenerableEligible(strategyIndex) {
    const prevCand = candidates[strategyIndex];
    const confirmedIds = new Set((prevCand && prevCand.confirmedIds) || []);
    const pinnedIds = new Set(
      (prevCand ? prevCand.assigned.filter(r => confirmedIds.has(r.id)) : []).map(r => r.id)
    );
    return state.requests.some(r => isEligibleRequest(r) && !pinnedIds.has(r.id));
  }

  async function regenerateCandidate(strategyIndex, onProgress) {
    const prevCand = candidates[strategyIndex];
    if (!candidateHistory[strategyIndex]) {
      candidateHistory[strategyIndex] = new Set(prevCand ? [candidateSignature(prevCand)] : []);
    }
    const seen = candidateHistory[strategyIndex];
    const confirmedIds = new Set((prevCand && prevCand.confirmedIds) || []);
    const pinned = prevCand ? prevCand.assigned.filter(r => confirmedIds.has(r.id)) : [];
    const pinnedIds = new Set(pinned.map(r => r.id));
    // "미배정 회원"으로 지정된 회원은 배정 대상·미배정 통계 모두에서 뺀다(단, 이미 확정된
    // 세션은 그대로 유지된다 — 확정은 다른 설정보다 항상 우선한다).
    const allMemberIds = new Set(
      state.requests.filter(r => pinnedIds.has(r.id) || !currentExcludedIds().includes(r.memberId)).map(r => r.memberId)
    );
    const eligible = state.requests.filter(r => isEligibleRequest(r) && !pinnedIds.has(r.id));
    const eligibleIds = new Set(eligible.map(r => r.id));

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
      strategyIndex, eligible, eligibleIds, allMemberIds, pinned, REGENERATE_SEARCH_ATTEMPTS, Math.random, onProgress);
    let baseline = pool[0];
    let baselineScore = candidateSearchScore(baseline, myPrimary, myMaxUnassigned);
    pool.forEach(cand => {
      const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
      if (isCandidateWorse(baselineScore, score)) { baseline = cand; baselineScore = score; }
    });
    // floorCand: baseline과 prevCand 중 더 나은 쪽. "새로운 조합을 못 찾았을 때"도 이 값으로
    // 돌아가야지, baseline으로 그냥 되돌리면 prevCand보다 못한 결과가 화면에 나타날 수 있다
    // (아래 !newCand 분기 참고) — "다음 후보"를 반복 클릭했을 때 수업 건수가 오르내리며
    // 들쭉날쭉해 보이는 문제가 바로 이 지점에서 나고 있었다.
    const floorCand = (prevCand && isCandidateWorse(baselineScore, candidateSearchScore(prevCand, myPrimary, myMaxUnassigned)))
      ? prevCand : baseline;
    const floorScore = candidateSearchScore(floorCand, myPrimary, myMaxUnassigned);

    // 방금 만든 풀(pool) 안에서, 아직 못 본 조합 중 최소 허용선(floor) 이상인 것 중 가장 좋은
    // 것을 고른다 — 별도로 다시 시도하지 않고 이미 계산해둔 (attempts+1)개를 그대로 훑으므로,
    // 추가 계산 없이 예전(REGEN_MAX_ATTEMPTS=10개만 별도 시도)보다 훨씬 많은 후보 중에서 고를
    // 수 있다.
    let newCand = null;
    let newScore = null;
    pool.forEach(cand => {
      const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
      if (isCandidateWorse(score, floorScore)) return; // 최소 허용선보다 못하면 버린다
      const sig = candidateSignature(cand);
      if (seen.has(sig)) return;
      if (!newCand || isCandidateWorse(newScore, score)) { newCand = cand; newScore = score; }
    });
    if (newCand) seen.add(candidateSignature(newCand));

    if (!newCand) {
      // 더 나은 조합을 못 찾았을 때도 사용자에게 묻지 않고, 지금까지 본 조합 기록을 지우고
      // 자동으로 다시 찾는다(다음 클릭 때 새 조합을 탐색할 수 있도록).
      newCand = floorCand; // baseline이 아니라 floorCand — 지금 보다 못한 결과로 되돌리지 않는다.
      candidateHistory[strategyIndex] = new Set([candidateSignature(newCand)]);
      newCand.confirmedIds = [...confirmedIds];
      if (prevCand && prevCand !== newCand) {
        if (!candidateUndoStack[strategyIndex]) candidateUndoStack[strategyIndex] = [];
        candidateUndoStack[strategyIndex].push(prevCand);
      }
      candidates[strategyIndex] = newCand;
      saveState();
      renderSchedule3Result();
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
      pool.forEach(cand => {
        const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
        if (!isCandidateScoreTie(score, newScore)) return;
        const sig = candidateSignature(cand);
        if (seenTieSig.has(sig)) return;
        seenTieSig.add(sig);
        const entry = sig === newCandSig ? newCand : cand;
        entry.confirmedIds = [...confirmedIds];
        if (tied.length < MAX_POOL_VARIANTS) tied.push(entry);
      });
      candidatePools[strategyIndex] = tied;
    }
    if (prevCand) {
      if (!candidateUndoStack[strategyIndex]) candidateUndoStack[strategyIndex] = [];
      candidateUndoStack[strategyIndex].push(prevCand);
    }
    candidates[strategyIndex] = newCand;
    saveState();
    renderSchedule3Result();
    showToast("후보가 재생성되었습니다", "success");
  }

  // "이전 후보 다시보기": 재생성으로 덮어쓰기 전의 후보로 되돌아간다(여러 번 눌러 여러 단계
  // 되돌아갈 수 있음). 되돌아간 후보를 다시 재생성하면, 그 시점부터 새 이력이 쌓인다.
  function restorePreviousCandidate(strategyIndex) {
    const stack = candidateUndoStack[strategyIndex];
    if (!stack || stack.length === 0) return;
    candidates[strategyIndex] = stack.pop();
    saveState();
    renderSchedule3Result();
    showToast("이전 후보로 되돌아갔습니다", "info");
  }

  // 후보 카드의 일정 하나를 확정한다: 재생성해도 이 일정은 고정되고 나머지만 다시 배정된다.
  // container: 후보B/C(candidate) 또는 후보A(result) 객체 — 항상 .assigned와 .confirmedIds를 가진다.
  // onDone: 확정/확정취소/교체 뒤 다시 그릴 함수. 생성3의 카드에서 항상 renderSchedule3Result를
  // 명시적으로 넘겨받아 쓴다.
  function confirmSession(container, reqId, onDone) {
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    if (container.confirmedIds.includes(reqId)) return;
    pushManualUndo(container);
    container.confirmedIds.push(reqId);
    saveState();
    onDone();
    showToast("스케줄이 확정되었습니다", "success");
  }

  // 확정된 일정의 확정을 취소한다.
  function unconfirmSession(container, reqId, onDone) {
    if (!(container.confirmedIds || []).includes(reqId)) return;
    pushManualUndo(container);
    container.confirmedIds = container.confirmedIds.filter(id => id !== reqId);
    saveState();
    onDone();
    showToast("스케줄 확정이 취소되었습니다", "info");
  }

  // "1회 제한 회원" 목록은 생성3 자신의 것(onceLimitedMemberIds3)을 써야 한다 — maxSessionsFor는
  // withSelectionOverride로 감싼 생성 중에만 이 목록을 보므로, 생성이 끝난 뒤 그리드를 클릭해
  // 교체 후보를 고를 때는 직접 참조해야 한다.
  function maxSessionsFor3(member) {
    if (!member) return 1;
    if (state.onceLimitedMemberIds3.includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }

  // 배정된 세션 하나(req)를 다른 회원으로 교체할 수 있는지 훑는다. 요일·시작 시각·길이가
  // 정확히 같은 신청을 가진 회원만 후보로 본다 — 신청은 가능한 시작 시각마다 하나씩 등록돼
  // 있으므로(addDesiredRange), 이 자리에 "신청 가능했던" 회원은 정확히 이 조건으로 걸러진다.
  // 요일·시간·지점은 그대로 유지한 채 사람만 바뀌는 것이므로, 이동 시간·간격 재계산은
  // 필요 없다(그 날의 다른 배정과의 물리적 배치는 달라지지 않는다) — 그날 다른 배정이 없는지,
  // 주간 최대 횟수를 넘지 않는지, 미배정 회원으로 지정돼 있지 않은지, 그 지점을 이용할 수
  // 있는지만 확인하면 된다. 다만 greedyAssign의 "이동-회원-이동 금지" 숨김 하드 로직(위
  // soloTravelMemberIds 참고)은 자리가 아니라 사람에 달린 규칙이라 예외 — req가 양옆 모두
  // 이동으로 이어지는 자리라면, 세 지점을 모두 다니는 회원은 후보에서 뺀다.
  function eligibleSwapMembersFor(container, req) {
    const dayAssigned = container.assigned
      .filter(a => a.day === req.day && a.id !== req.id)
      .sort((a, b) => a.startSlot - b.startSlot);
    const prevAssigned = dayAssigned.filter(a => a.startSlot < req.startSlot).pop() || null;
    const nextAssigned = dayAssigned.find(a => a.startSlot > req.startSlot) || null;
    const arrivedViaTravel = !!prevAssigned && travelMinutes(prevAssigned.locationId, req.locationId) > 0;
    const departsViaTravel = !!nextAssigned && travelMinutes(req.locationId, nextAssigned.locationId) > 0;
    const soloTravelBlocked = arrivedViaTravel && departsViaTravel;
    const soloIds = soloTravelBlocked ? soloTravelMemberIds() : null;

    const results = [];
    const seenMemberIds = new Set();
    state.requests.forEach(other => {
      if (other.memberId === req.memberId) return;
      if (other.day !== req.day || other.startSlot !== req.startSlot || other.duration !== req.duration) return;
      if (seenMemberIds.has(other.memberId)) return;
      const member = memberById(other.memberId);
      if (!member) return;
      if (state.excludedMemberIds3.includes(member.id)) return;
      if (!candidateLocationsForRequest(other).includes(req.locationId)) return;
      if (soloTravelBlocked && soloIds.has(member.id)) return; // 이동-회원-이동 금지
      let weekCount = 0;
      let sameDayCount = 0;
      container.assigned.forEach(a => {
        if (a.memberId !== member.id || a.id === req.id) return;
        weekCount++;
        if (a.day === req.day) sameDayCount++;
      });
      if (sameDayCount > 0) return; // 1일 최대 1회
      if (weekCount >= maxSessionsFor3(member)) return; // 주간 최대 횟수(상담 회원·1회 제한 회원 포함)
      seenMemberIds.add(member.id);
      results.push(member);
    });
    results.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return results;
  }

  // 드래그 이동·자리 맞바꾸기·인원 교체·확정 등 "수동 편집" 하나를 취소할 수 있도록, 편집
  // 직전의 assigned/confirmedIds 스냅샷을 후보 객체(container)별로 최대 20개까지 쌓아둔다.
  // 재생성(regenerateCandidate)이 쓰는 candidateUndoStack과는 별개다 — 그건 "다른 배정 조합
  // 통째로 되돌리기"이고 이건 "방금 한 조정 하나만 되돌리기"라 성격이 다르다. WeakMap을 써서
  // container 객체(candidateA 또는 candidates[i]) 자체를 키로 삼으므로, 재생성으로 그 자리의
  // container 객체가 통째로 새로 만들어지면 자연스럽게 새 빈 되돌리기 이력에서 다시 시작한다.
  // candidateUndoStack과 마찬가지로 저장하지 않으므로 새로고침하면 초기화된다.
  const manualUndoStacks = new WeakMap();
  const MANUAL_UNDO_LIMIT = 20;
  function snapshotContainer(container) {
    return {
      assigned: container.assigned.map(a => ({ ...a })),
      confirmedIds: (container.confirmedIds || []).slice()
    };
  }
  function pushManualUndo(container) {
    if (!manualUndoStacks.has(container)) manualUndoStacks.set(container, []);
    const stack = manualUndoStacks.get(container);
    stack.push(snapshotContainer(container));
    if (stack.length > MANUAL_UNDO_LIMIT) stack.shift();
  }
  function hasManualUndo(container) {
    const stack = manualUndoStacks.get(container);
    return !!stack && stack.length > 0;
  }
  function undoManualEdit(container, onDone) {
    const stack = manualUndoStacks.get(container);
    if (!stack || stack.length === 0) return;
    const snapshot = stack.pop();
    container.assigned = snapshot.assigned;
    container.confirmedIds = snapshot.confirmedIds;
    saveState();
    onDone();
    showToast("방금 편집을 되돌렸습니다", "info");
  }

  // 배정된 세션의 자리(요일·시작 시각·길이·지점)는 그대로 두고 사람만 newMember로 바꿔치기한다.
  // moveSession/attemptSwap과 마찬가지로, 재생성해도 이 자리가 풀리지 않도록 새 회원의 신청
  // id를 confirmedIds에 자동으로 넣는다(사람이 손댄 자리는 알고리즘이 건드리지 않는다는
  // 원칙 — 세 "수동 편집" 함수 모두 같은 보호 수준을 준다).
  function swapSessionMember(container, req, newMember, onDone) {
    const newReq = state.requests.find(r =>
      r.memberId === newMember.id && r.day === req.day && r.startSlot === req.startSlot && r.duration === req.duration);
    if (!newReq) return;
    const idx = container.assigned.findIndex(a => a.id === req.id);
    if (idx === -1) return;
    pushManualUndo(container);
    container.assigned[idx] = {
      id: newReq.id, memberId: newMember.id, day: req.day, startSlot: req.startSlot,
      duration: req.duration, locationId: req.locationId
    };
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    container.confirmedIds = container.confirmedIds.filter(id => id !== req.id);
    container.confirmedIds.push(newReq.id);
    saveState();
    onDone();
    showToast(newMember.name + "(으)로 교체되었습니다", "success");
  }

  // req가 targetDay/targetStartSlot(그 자신의 길이만큼)으로 옮겨갈 때, 실제로 자리를 차지하고
  // 있어서 걸리는 다른 배정을 찾는다(자기 자신은 제외). 있으면 "그 자리로 드래그" = "그 배정과
  // 자리를 맞바꾸고 싶다"는 뜻으로 다룬다.
  function findOccupyingAssigned(container, req, targetDay, targetStartSlot) {
    const durSlots = durationToSlots(req.duration);
    return container.assigned.find(a =>
      a.id !== req.id && a.day === targetDay &&
      targetStartSlot < a.startSlot + durationToSlots(a.duration) &&
      targetStartSlot + durSlots > a.startSlot
    ) || null;
  }

  // 세션 하나를 (targetDay, targetStartSlot)으로 옮길 수 있는지 검사만 하고, 실제로 옮기지는
  // 않는다 — 드래그 중 실시간 유효성 표시(canMoveOrSwapTo)와 실제 커밋(moveSession) 양쪽에서
  // 똑같은 기준으로 재사용하기 위해 분리했다. ignoreIds에 담긴 배정은 "이미 자리를 비운 것"
  // 취급하여 겹침·인원 검사에서 제외한다 — 자리 맞바꾸기(prepareSwap)에서, 상대방이 내가 있던
  // 자리로 옮겨가는 중이라 그 상대방의 현재 자리는 곧 빌 것이므로 걸림돌로 치지 않기 위함이다.
  // 검증 순서: (1) 그 자리에 신청 이력이 있는지 → (2) 그 요일에 이미 이 회원의 다른 배정이
  // 없는지(1일 최대 1회) → (3) 그 자리에서 지점을 그대로 쓸 수 있는지 → (4) 앞뒤 배정과 실제로
  // 겹치지 않고 지점이 다르면 이동 시간까지 확보되는지(requiredGapMin — 단순 시간 겹침만 보면
  // 이동 시간 없이 딱 붙는 물리적으로 불가능한 배치를 허용해버린다) → (5) 이동-회원-이동 금지
  // 숨김 규칙.
  function validateMove(container, req, targetDay, targetStartSlot, ignoreIds) {
    const ignoreSet = new Set([req.id, ...(ignoreIds || [])]);
    if (targetDay === req.day && targetStartSlot === req.startSlot) {
      return { ok: true, noop: true, newReq: req, locationId: req.locationId };
    }
    const newReq = state.requests.find(r =>
      r.memberId === req.memberId && r.day === targetDay && r.startSlot === targetStartSlot && r.duration === req.duration);
    if (!newReq) {
      return { ok: false, message: "이 회원은 해당 시간에 신청한 이력이 없습니다" };
    }
    const sameDayConflict = container.assigned.some(a =>
      !ignoreSet.has(a.id) && a.memberId === req.memberId && a.day === targetDay);
    if (sameDayConflict) {
      return { ok: false, message: "같은 요일에는 하루 최대 1회만 배정할 수 있습니다" };
    }
    const validLocations = candidateLocationsForRequest(newReq);
    const locationId = validLocations.includes(req.locationId) ? req.locationId : validLocations[0];
    if (!locationId) {
      return { ok: false, message: "해당 지점에서는 이 시간을 이용할 수 없습니다" };
    }
    const durSlots = durationToSlots(req.duration);
    const dayAssigned = container.assigned
      .filter(a => a.day === targetDay && !ignoreSet.has(a.id))
      .sort((a, b) => a.startSlot - b.startSlot);
    const prevAssigned = dayAssigned.filter(a => a.startSlot < targetStartSlot).pop() || null;
    const nextAssigned = dayAssigned.find(a => a.startSlot >= targetStartSlot) || null;
    if (prevAssigned) {
      const prevEnd = prevAssigned.startSlot + durationToSlots(prevAssigned.duration);
      const gapSlots = requiredGapMin(prevAssigned.locationId, locationId) / SLOT_MIN;
      if (prevEnd + gapSlots > targetStartSlot) {
        return { ok: false, message: "바로 앞 수업과 시간이 겹치거나 이동 시간이 부족합니다" };
      }
    }
    if (nextAssigned) {
      const gapSlots = requiredGapMin(locationId, nextAssigned.locationId) / SLOT_MIN;
      if (targetStartSlot + durSlots + gapSlots > nextAssigned.startSlot) {
        return { ok: false, message: "바로 다음 수업과 시간이 겹치거나 이동 시간이 부족합니다" };
      }
    }
    const arrivedViaTravel = !!prevAssigned && travelMinutes(prevAssigned.locationId, locationId) > 0;
    const departsViaTravel = !!nextAssigned && travelMinutes(locationId, nextAssigned.locationId) > 0;
    if (arrivedViaTravel && departsViaTravel && soloTravelMemberIds().has(req.memberId)) {
      return { ok: false, message: "이 회원은 이동으로 앞뒤가 막힌 자리에는 배정할 수 없습니다" };
    }
    return { ok: true, newReq, locationId };
  }

  // 배정된 세션 하나를 드래그로 다른 (day, startSlot) 자리로 옮긴다. 자리는 항상 "그 회원이
  // 실제로 신청했던 시간" 중 하나여야 한다 — 신청 이력에 없는 임의의 시간으로는 옮길 수 없다
  // (배정은 항상 실제 신청 중 하나를 고르는 것이라는 시스템 전체의 전제와 같다. addDesiredRange
  // 참고 — 회원이 신청한 범위 안의 모든 10분 간격 시작 시각이 이미 개별 신청으로 등록돼 있으므로,
  // 신청 범위 안이라면 대부분 그대로 맞아떨어진다). 검증은 validateMove에 그대로 맡긴다.
  // 통과하면 옮기고, 재생성해도 이 자리가 풀리지 않도록 자동으로 확정한다(사람이 손댄 자리는
  // 알고리즘이 건드리지 않는다는 기존 확정 로직과 같은 취지).
  function moveSession(container, req, targetDay, targetStartSlot, onDone) {
    const result = validateMove(container, req, targetDay, targetStartSlot);
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    if (result.noop) return;
    const { newReq, locationId } = result;
    const idx = container.assigned.findIndex(a => a.id === req.id);
    if (idx === -1) return;
    pushManualUndo(container);
    container.assigned[idx] = {
      id: newReq.id, memberId: req.memberId, day: targetDay, startSlot: targetStartSlot,
      duration: req.duration, locationId
    };
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    container.confirmedIds = container.confirmedIds.filter(id => id !== req.id);
    container.confirmedIds.push(newReq.id);
    saveState();
    onDone();
    showToast("일정이 이동되었습니다", "success");
  }

  // 자리 맞바꾸기가 가능한지 검사만 한다(prepareSwap) — req를 occupying의 자리로, occupying을
  // req의 자리로 동시에 옮기는 것이므로 두 방향 모두 validateMove를 통과해야 한다. 서로 상대의
  // 현재 자리는 "곧 비워질 자리"라 걸림돌이 아니므로 ignoreIds로 서로를 빼고 검사한다. 길이가
  // 다르면애초에 "맞바꾼다"는 개념이 어색해지므로(한쪽만 옮기면 남는 자리가 생김) 막는다.
  function prepareSwap(container, req, occupying) {
    if (occupying.duration !== req.duration) {
      return { ok: false, message: "길이가 서로 달라 자리를 맞바꿀 수 없습니다" };
    }
    const reqA2 = state.requests.find(r =>
      r.memberId === req.memberId && r.day === occupying.day && r.startSlot === occupying.startSlot && r.duration === req.duration);
    const reqB2 = state.requests.find(r =>
      r.memberId === occupying.memberId && r.day === req.day && r.startSlot === req.startSlot && r.duration === occupying.duration);
    if (!reqA2 || !reqB2) {
      return { ok: false, message: "두 회원 모두 상대방 시간에 신청한 이력이 있어야 자리를 맞바꿀 수 있습니다" };
    }
    const checkA = validateMove(container, req, occupying.day, occupying.startSlot, [occupying.id]);
    if (!checkA.ok) return { ok: false, message: checkA.message };
    const checkB = validateMove(container, occupying, req.day, req.startSlot, [req.id]);
    if (!checkB.ok) return { ok: false, message: checkB.message };
    return { ok: true, reqA2, reqB2, locA: checkA.locationId, locB: checkB.locationId };
  }

  // 드래그로 놓은 자리에 이미 다른 배정이 있을 때, 그 자리로 그냥 옮기는 대신 두 배정의
  // 자리를 서로 맞바꾼다 — "이수정을 금5로, 한지원을 목3에서 이수정이 있던 목4로" 같은 조정을
  // 순서 신경 쓰지 않고 한 번의 드래그로 끝낼 수 있게 해준다.
  function attemptSwap(container, req, occupying, onDone) {
    const plan = prepareSwap(container, req, occupying);
    if (!plan.ok) {
      showToast(plan.message, "error");
      return;
    }
    const idxA = container.assigned.findIndex(a => a.id === req.id);
    const idxB = container.assigned.findIndex(a => a.id === occupying.id);
    if (idxA === -1 || idxB === -1) return;
    pushManualUndo(container);
    container.assigned[idxA] = {
      id: plan.reqA2.id, memberId: req.memberId, day: occupying.day, startSlot: occupying.startSlot,
      duration: req.duration, locationId: plan.locA
    };
    container.assigned[idxB] = {
      id: plan.reqB2.id, memberId: occupying.memberId, day: req.day, startSlot: req.startSlot,
      duration: occupying.duration, locationId: plan.locB
    };
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    container.confirmedIds = container.confirmedIds.filter(id => id !== req.id && id !== occupying.id);
    container.confirmedIds.push(plan.reqA2.id, plan.reqB2.id);
    saveState();
    onDone();
    showToast("두 자리를 맞바꿨습니다", "success");
  }

  // 드래그·클릭으로 세션을 옮기려 할 때 공통으로 쓰는 진입점: 놓을 자리가 비어있으면 그냥
  // 옮기고(moveSession), 이미 다른 배정이 있으면 자리 맞바꾸기를 시도한다(attemptSwap).
  function moveOrSwapSession(container, req, targetDay, targetStartSlot, onDone) {
    const occupying = findOccupyingAssigned(container, req, targetDay, targetStartSlot);
    if (occupying) {
      attemptSwap(container, req, occupying, onDone);
    } else {
      moveSession(container, req, targetDay, targetStartSlot, onDone);
    }
  }

  // 드래그 중 실시간으로 "여기에 놓으면 어떻게 되는지"를 보여주기 위한 판정. 자리가 비어있으면
  // 일반 이동 기준으로, 이미 차 있으면 자리 맞바꾸기 기준으로 판단한다 — moveOrSwapSession이
  // 실제로 어느 쪽을 실행할지와 항상 같은 기준이어야 한다. kind는 미리보기 색을 구분하는 데
  // 쓴다: "move"(빈 자리로 이동 가능) / "swap"(다른 배정과 맞바꾸기 가능) / "invalid"(둘 다 불가).
  function canMoveOrSwapTo(container, req, targetDay, targetStartSlot) {
    const occupying = findOccupyingAssigned(container, req, targetDay, targetStartSlot);
    if (!occupying) {
      const ok = validateMove(container, req, targetDay, targetStartSlot).ok;
      return { ok, kind: ok ? "move" : "invalid" };
    }
    const ok = prepareSwap(container, req, occupying).ok;
    return { ok, kind: ok ? "swap" : "invalid" };
  }

  // 이동 시간 블록 자체는 옮길 수 있는 데이터가 아니다(두 수업 사이 간격에서 계산되는 값일
  // 뿐이라 독립적인 자리가 없다) — 그래서 "이동 시간을 30분 추가/제거한다"는, 실제로는 그
  // 이동 시간 바로 다음 수업(nextReq)을 30분 뒤로 밀거나 앞으로 당겨 그 앞의 간격을 늘리거나
  // 줄이는 것으로 구현한다. moveSession이 신청 이력·겹침·이동 시간 확보 여부를 그대로
  // 검증해주므로, 최소 이동 시간보다 더 줄이려 하면 자연스럽게 거부된다.
  const TRAVEL_SHIFT_SLOTS = 30 / SLOT_MIN;
  function travelShiftMenuItems(container, nextReq, onDone) {
    return [
      {
        label: "다음 수업 30분 뒤로 미루기 (여유 늘리기)",
        onClick: () => moveOrSwapSession(container, nextReq, nextReq.day, nextReq.startSlot + TRAVEL_SHIFT_SLOTS, onDone)
      },
      {
        label: "다음 수업 30분 앞당기기 (여유 줄이기)",
        onClick: () => moveOrSwapSession(container, nextReq, nextReq.day, nextReq.startSlot - TRAVEL_SHIFT_SLOTS, onDone)
      }
    ];
  }

  // 그리드의 배정된 세션 블록을 클릭했을 때 뜨는 메뉴: 맨 위는 확정/확정취소, 그 아래는 같은
  // 요일·시간·지점에 교체 가능한 다른 회원 목록이다 — "확정하시겠습니까?" 확인창 대신 이 목록을
  // 보여주고, 고르면 그 자리 인원만 바로 바뀐다.
  function sessionSwapMenuItems(container, req, isConfirmed, onDone) {
    const member = memberById(req.memberId);
    const items = [{
      label: isConfirmed ? "확정 취소" : "현재 인원(" + (member ? member.name : "?") + ")으로 확정",
      onClick: () => (isConfirmed ? unconfirmSession(container, req.id, onDone) : confirmSession(container, req.id, onDone))
    }, { separator: true }];
    const swapMembers = eligibleSwapMembersFor(container, req);
    if (swapMembers.length === 0) {
      items.push({ label: "교체 가능한 인원 없음", disabled: true });
    } else {
      swapMembers.forEach(m => {
        items.push({ label: m.name + "(으)로 교체", onClick: () => swapSessionMember(container, req, m, onDone) });
      });
    }
    return items;
  }

  function candidateToBlocks(candidate, onDone = renderSchedule3Result) {
    const confirmedIds = new Set(candidate.confirmedIds || []);
    return candidate.assigned.map(r => {
      const m = memberById(r.memberId);
      const loc = locationById(r.locationId);
      const label = m ? m.name + ((m.category || "상담") === "상담" ? " (상담)" : "") : "?";
      const isConfirmed = confirmedIds.has(r.id);
      return {
        day: r.day,
        startSlot: r.startSlot,
        duration: r.duration,
        label: label,
        loc: loc ? loc.name : "",
        sublabel: slotLabel(r.startSlot) + "~" + endLabel(r.startSlot, r.duration),
        color: m ? memberColor(m.id) : BLOCK_COLOR,
        confirmed: isConfirmed,
        contextMenuItems: () => sessionSwapMenuItems(candidate, r, isConfirmed, onDone),
        onMove: (targetDay, targetSlot) => moveOrSwapSession(candidate, r, targetDay, targetSlot, onDone),
        canMoveTo: (targetDay, targetSlot) => canMoveOrSwapTo(candidate, r, targetDay, targetSlot)
      };
    });
  }

  // 같은 요일 안에서 연속된 두 세션 사이, 지점이 달라 실제로 이동이 필요한 구간만 표시한다
  // (쉬는 시간 없음이 규칙이므로 같은 지점이면 표시할 것이 없다).
  function candidateToTravelBlocks(candidate, onDone = renderSchedule3Result) {
    const byDay = new Map();
    candidate.assigned.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const travelBlocks = [];
    byDay.forEach(reqs => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        const startSlot = prev.startSlot + durationToSlots(prev.duration);
        const gapMin = (cur.startSlot - startSlot) * SLOT_MIN;
        if (gapMin <= 0) continue;
        const mins = travelMinutes(prev.locationId, cur.locationId);
        if (mins > 0) {
          travelBlocks.push({
            day: prev.day, startSlot, duration: mins, label: "이동 " + mins + "분", type: "travel",
            moveDurationSlots: durationToSlots(cur.duration),
            onMove: (targetDay, targetSlot) => moveOrSwapSession(candidate, cur, targetDay, targetSlot, onDone),
            canMoveTo: (targetDay, targetSlot) => canMoveOrSwapTo(candidate, cur, targetDay, targetSlot),
            contextMenuItems: () => travelShiftMenuItems(candidate, cur, onDone)
          });
        } else if (BREAK_MIN > 0) {
          // 지점이 같아도(또는 이동 시간이 0분이어도) 최소 BREAK_MIN만큼은 쉬는 시간으로 예약돼 있다.
          const breakMin = Math.min(BREAK_MIN, gapMin);
          travelBlocks.push({ day: prev.day, startSlot, duration: breakMin, label: "휴식 " + breakMin + "분", type: "break" });
        }
      }
    });
    return travelBlocks;
  }


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

  function sessionDurationFor2(member) {
    return (member && (member.category || "상담")) === "상담" ? CONSULT_DURATION_MIN_2 : SESSION_DURATION_MIN_2;
  }

  function maxSessionsFor2(member) {
    if (!member) return 1;
    if (currentOnceLimitIds2().includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }

  // 두 세션 사이에 필요한 최소 간격(분): 쉬는 시간 없이, 지점이 다를 때만 그 이동 시간만큼.
  // 슬롯 격자에 맞춰 올림한다(격자에서 표현 가능한 가장 좁은 간격을 기준으로 삼기 위함).
  function requiredGapMin2(locA, locB) {
    const raw = travelMinutes(locA, locB);
    return raw > 0 ? Math.ceil(raw / SLOT_MIN) * SLOT_MIN : 0;
  }

  function isEligibleRequest2(req) {
    const member = memberById(req.memberId);
    if (!member || currentExcludedIds2().includes(req.memberId)) return false;
    const slots = durationToSlots(sessionDurationFor2(member));
    for (let i = 0; i < slots; i++) {
      if (!availableCells.has(cellKey(req.day, req.startSlot + i))) return false;
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
  function buildDayNodes(dayRequests, weightFn, jitterFn) {
    const nodes = [];
    dayRequests.forEach(r => {
      const member = memberById(r.memberId);
      const duration = sessionDurationFor2(member);
      const end = r.startSlot + durationToSlots(duration);
      candidateLocationsForRequest(r).forEach(locationId => {
        const weight = weightFn(r.memberId, r.startSlot, locationId);
        if (!weight) return;
        nodes.push({ id: r.id, memberId: r.memberId, day: r.day, startSlot: r.startSlot, duration, locationId, end, weight, jitter: jitterFn ? jitterFn() : 0 });
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
  function runChainDP(nodes, maxTravelsPerDay) {
    if (maxTravelsPerDay === undefined) maxTravelsPerDay = MAX_TRAVELS_PER_DAY;
    nodes = nodes.slice().sort((a, b) => a.end - b.end || a.startSlot - b.startSlot);
    const n = nodes.length;
    const dp = new Array(n), tc = new Array(n), tm = new Array(n), idle = new Array(n), js = new Array(n), prev = new Array(n);
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
      let bestDp = node.weight, bestTc = 0, bestTm = 0, bestIdle = 0, bestJs = node.jitter || 0, bestPrev = -1;
      for (let j = 0; j < i; j++) {
        const p = nodes[j];
        if (p.memberId === node.memberId) continue; // 회원당 1일 최대 1회
        const gapNeed = requiredGapMin2(p.locationId, node.locationId);
        const gapActual = (node.startSlot - p.end) * SLOT_MIN;
        if (gapActual < gapNeed) continue;
        const addsTravel = travelMinutes(p.locationId, node.locationId) > 0 ? 1 : 0;
        const newTc = tc[j] + addsTravel;
        if (newTc > maxTravelsPerDay) continue;
        const newDp = dp[j] + node.weight;
        const newTm = tm[j] + travelMinutes(p.locationId, node.locationId);
        const newIdle = idle[j] + (gapActual - gapNeed);
        const newJs = js[j] + (node.jitter || 0);
        if (better(newDp, newTc, newTm, newIdle, newJs, bestDp, bestTc, bestTm, bestIdle, bestJs)) {
          bestDp = newDp; bestTc = newTc; bestTm = newTm; bestIdle = newIdle; bestJs = newJs; bestPrev = j;
        }
      }
      dp[i] = bestDp; tc[i] = bestTc; tm[i] = bestTm; idle[i] = bestIdle; js[i] = bestJs; prev[i] = bestPrev;
    }
    let bestEnd = -1, bestDpAll = 0, bestTcAll = 0, bestTmAll = 0, bestIdleAll = 0, bestJsAll = 0;
    for (let i = 0; i < n; i++) {
      if (bestEnd === -1 || better(dp[i], tc[i], tm[i], idle[i], js[i], bestDpAll, bestTcAll, bestTmAll, bestIdleAll, bestJsAll)) {
        bestDpAll = dp[i]; bestTcAll = tc[i]; bestTmAll = tm[i]; bestIdleAll = idle[i]; bestJsAll = js[i]; bestEnd = i;
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
  async function runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, stage1DayOrder, runRepair, runPolish, polishBudgetMs, seedOffset) {
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
    function now() { return performance.now() - yieldOverheadMs; }
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
    eligibleReqs.forEach(r => {
      if (!reqsByMemberDay.has(r.memberId)) reqsByMemberDay.set(r.memberId, new Map());
      const byDay = reqsByMemberDay.get(r.memberId);
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    function reqsFor(memberId, day) {
      const byDay = reqsByMemberDay.get(memberId);
      return (byDay && byDay.get(day)) || [];
    }
    function reqAt(memberId, day, startSlot) {
      return reqsFor(memberId, day).find(r => r.startSlot === startSlot);
    }

    function isEligibleForDay(memberId, day) {
      const cap = maxSessionsFor2(memberById(memberId));
      if ((assignedCountByMember.get(memberId) || 0) >= cap) return false;
      const days = assignedDaysByMember.get(memberId);
      return !(days && days.has(day));
    }
    function commit(day, node) {
      assignedCountByMember.set(node.memberId, (assignedCountByMember.get(node.memberId) || 0) + 1);
      if (!assignedDaysByMember.has(node.memberId)) assignedDaysByMember.set(node.memberId, new Set());
      assignedDaysByMember.get(node.memberId).add(day);
    }
    function uncommit(day, node) {
      assignedCountByMember.set(node.memberId, assignedCountByMember.get(node.memberId) - 1);
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
      reqsByDay.get(day).forEach(r => {
        if ((assignedCountByMember.get(r.memberId) || 0) !== 0) return;
        candidateLocationsForRequest(r).forEach(locId => {
          if (!membersByLoc.has(locId)) membersByLoc.set(locId, new Set());
          membersByLoc.get(locId).add(r.memberId);
        });
      });
      let dominantLoc = null, dominantCount = -1;
      membersByLoc.forEach((set, locId) => {
        if (set.size > dominantCount) { dominantCount = set.size; dominantLoc = locId; }
      });
      return dominantLoc;
    }

    // 1단계: "미배정 회원 없음"이 최우선 목표이므로, 주어진 요일 순서대로 처리하며 그 시점까지
    // 아직 한 번도 배정받지 못한 회원들만으로 그 요일의 최선 체인(DP)을 짠다.
    stage1DayOrder.forEach(day => {
      const dominantLoc = dominantLocationFor(day);
      const nodes = buildDayNodes(reqsByDay.get(day), (memberId, startSlot, locationId) => {
        if ((assignedCountByMember.get(memberId) || 0) !== 0) return 0;
        return locationId === dominantLoc ? 1.02 : 1;
      }, () => stage1RandomFn());
      const chain = runChainDP(nodes);
      chain.forEach(node => commit(day, node));
      dayChains.set(day, chain);
    });

    // 2단계: 요일별로, 1단계에서 확정된 자리는 압도적으로 큰 가중치로 고정해 절대 빠지지
    // 않게 한 채(그 회원의 다른 자리는 후보에서 제외), 그 주변을 포함해 하루 전체를 다시
    // DP로 짜서 남은 자리를 최대한 채운다 — 코어 시간대든 어디든 상관없이, 확정된 체인을
    // 깨지 않으면서 수업 수를 최대화하는 방향으로 자연스럽게 채워진다.
    const PIN_WEIGHT = 1e6;
    daysWithReqs.forEach(day => {
      const existingChain = dayChains.get(day) || [];
      existingChain.forEach(node => uncommit(day, node));
      const pinnedKeys = new Set(existingChain.map(n => n.memberId + "|" + n.startSlot + "|" + n.locationId));
      const pinnedMemberIds = new Set(existingChain.map(n => n.memberId));
      const nodes = buildDayNodes(reqsByDay.get(day), (memberId, startSlot, locationId) => {
        if (pinnedKeys.has(memberId + "|" + startSlot + "|" + locationId)) return PIN_WEIGHT;
        if (pinnedMemberIds.has(memberId)) return 0; // 이미 확정된 회원은 그 자리 외에는 후보가 아니다
        return isEligibleForDay(memberId, day) ? 1 : 0;
      }, () => stage1RandomFn());
      const chain = runChainDP(nodes);
      chain.forEach(node => commit(day, node));
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
    const submittedIds = new Set(state.requests.map(r => r.memberId));
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
      const candidateDays = daysWithReqs.filter(day =>
        !excludeDays.has(day) && !alreadyUsedDays.has(day) && reqsByDay.get(day).some(r => r.memberId === memberId)
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
          while (insertAt < chain0.length && chain0[insertAt].startSlot < cand.startSlot) insertAt++;
          let feasible = true;
          if (insertAt > 0) {
            const prev = chain0[insertAt - 1];
            const prevEnd = prev.startSlot + durationToSlots(prev.duration);
            if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId)) feasible = false;
          }
          if (feasible && insertAt < chain0.length) {
            const next = chain0[insertAt];
            if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId)) feasible = false;
          }
          if (!feasible) continue;
          const newNode = { id: cand.id, memberId, day, startSlot: cand.startSlot, duration: cand.duration, locationId: cand.locationId, end: cand.end };
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
          chain.forEach(n => {
            const nEnd = n.startSlot + durationToSlots(n.duration);
            if (cand.startSlot < nEnd && n.startSlot < cand.end) overlapping.add(n.memberId);
          });
          let otherMemberId = null;
          if (overlapping.size === 1) {
            otherMemberId = [...overlapping][0];
          } else if (overlapping.size === 0) {
            const sorted = chain.slice().sort((a, b) => a.startSlot - b.startSlot);
            let idx = 0;
            while (idx < sorted.length && sorted[idx].startSlot < cand.startSlot) idx++;
            const prevN = idx > 0 ? sorted[idx - 1] : null;
            const nextN = idx < sorted.length ? sorted[idx] : null;
            const prevBad = prevN && ((cand.startSlot - (prevN.startSlot + durationToSlots(prevN.duration))) * SLOT_MIN
              < requiredGapMin2(prevN.locationId, cand.locationId));
            const nextBad = nextN && ((nextN.startSlot - cand.end) * SLOT_MIN
              < requiredGapMin2(cand.locationId, nextN.locationId));
            if (prevBad && nextBad && prevN.memberId !== nextN.memberId) continue; // 양쪽 다른 두 명이 동시에 막으면 손대지 않는다
            if (prevBad) otherMemberId = prevN.memberId;
            else if (nextBad) otherMemberId = nextN.memberId;
            else continue; // 겹치지도, 간격이 막히지도 않는데 못 들어간다면(주간 cap 등) 건드릴 대상이 없다
          } else {
            continue; // 2명 이상과 직접 겹치면 다루지 않는다
          }
          const otherNode = chain.find(n => n.memberId === otherMemberId);

          const remainingChain = chain.filter(n => n.memberId !== otherMemberId);
          let insertAt = 0;
          while (insertAt < remainingChain.length && remainingChain[insertAt].startSlot < cand.startSlot) insertAt++;
          let feasible = true;
          if (insertAt > 0) {
            const prev = remainingChain[insertAt - 1];
            const prevEnd = prev.startSlot + durationToSlots(prev.duration);
            const gapMin = (cand.startSlot - prevEnd) * SLOT_MIN;
            if (gapMin < requiredGapMin2(prev.locationId, cand.locationId)) feasible = false;
          }
          if (feasible && insertAt < remainingChain.length) {
            const next = remainingChain[insertAt];
            const gapMin = (next.startSlot - cand.end) * SLOT_MIN;
            if (gapMin < requiredGapMin2(cand.locationId, next.locationId)) feasible = false;
          }
          if (!feasible) continue;

          const newNode = { id: cand.id, memberId, day, startSlot: cand.startSlot, duration: cand.duration, locationId: cand.locationId, end: cand.end };
          const newChain = remainingChain.slice();
          newChain.splice(insertAt, 0, newNode);
          if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) continue; // 하루 이동 최대 MAX_TRAVELS_PER_DAY회 제한

          uncommit(day, otherNode);
          commit(day, newNode);
          dayChains.set(day, newChain);

          if (tryPlaceMember(otherMemberId, new Set([...excludeDays, day]), depth + 1)) {
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
        .filter(m => !excludedIdSet2.has(m.id) && submittedIds.has(m.id))
        .map(m => m.id)
        .filter(id => !isCurrentlyAssigned(id));
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
        existingChain.forEach(node => uncommit(day, node));
        const nodes = buildDayNodes(reqsByDay.get(day), (mId, startSlot, locationId) => {
          if (mId === memberId) return REBUILD_TARGET_WEIGHT;
          return isEligibleForDay(mId, day) ? 1 : 0;
        });
        const newChain = runChainDP(nodes); // 하루 이동 최대 MAX_TRAVELS_PER_DAY회 제한은 여기서도 그대로 지킨다
        if (!newChain.some(n => n.memberId === memberId)) {
          existingChain.forEach(node => commit(day, node)); // 이 회원을 못 넣으면 의미가 없으니 되돌린다
          dayChains.set(day, existingChain);
          return false;
        }
        newChain.forEach(node => commit(day, node));
        dayChains.set(day, newChain);
        const afterUnassigned = stillUnassignedIds().length;
        if (afterUnassigned < beforeUnassigned || (afterUnassigned === beforeUnassigned && newChain.length >= existingChain.length)) {
          return true; // 미배정이 줄었거나, 최소한 나빠지지 않았으면 채택
        }
        // 전체적으로 나빠졌으면 되돌린다.
        newChain.forEach(node => uncommit(day, node));
        existingChain.forEach(node => commit(day, node));
        dayChains.set(day, existingChain);
        return false;
      }

      for (const memberId of stillUnassignedIds()) {
        await maybeYield();
        if (now() > REPAIR_DEADLINE) break;
        if (isCurrentlyAssigned(memberId)) continue;
        const candidateDays = daysWithReqs.filter(day => reqsByDay.get(day).some(r => r.memberId === memberId));
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
          .filter(m => !excludedIdSet2.has(m.id))
          .map(m => m.id)
          .filter(id => {
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
      daysWithReqs.forEach(day => {
        const beforeUnassignedCount = stillUnassignedIds().length;
        const beforeTotalSessions = Array.from(dayChains.values()).reduce((sum, c) => sum + c.length, 0);
        const existingChain = dayChains.get(day) || [];
        existingChain.forEach(node => uncommit(day, node));
        const nodes = buildDayNodes(reqsByDay.get(day), (mId, startSlot, locationId) =>
          isEligibleForDay(mId, day) ? 1 : 0
        );
        const newChain = runChainDP(nodes);
        newChain.forEach(node => commit(day, node));
        dayChains.set(day, newChain);
        const afterTotalSessions = Array.from(dayChains.values()).reduce((sum, c) => sum + c.length, 0);
        const worse = stillUnassignedIds().length > beforeUnassignedCount || afterTotalSessions < beforeTotalSessions;
        if (worse) {
          newChain.forEach(node => uncommit(day, node));
          existingChain.forEach(node => commit(day, node));
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
      stage6:
      for (let i = 0; i < daysWithReqs.length && now() < STAGE6_DEADLINE; i++) {
        for (let j = i + 1; j < daysWithReqs.length; j++) {
          await maybeYield();
          if (now() >= STAGE6_DEADLINE) break stage6;
          const dayA = daysWithReqs[i], dayB = daysWithReqs[j];
          const existingA = dayChains.get(dayA) || [];
          const existingB = dayChains.get(dayB) || [];
          const beforeUnassignedCount = stillUnassignedIds().length;
          const beforeTotalSessions = Array.from(dayChains.values()).reduce((sum, c) => sum + c.length, 0);
          const beforePairTravel = totalTravelCount(existingA) + totalTravelCount(existingB);

          // 기존 배치는 여기서 딱 한 번만 커밋 해제한다 — attemptOrder를 여러 번 호출하면서
          // 매번 이걸 다시 해제하면, 이미 해제된 회원을 또 해제하게 되어 배정 카운트가
          // 음수로 내려간다("이미 그 요일에 배정됨" 기록이 사라져 같은 요일에 또 배정
          // 가능하다고 잘못 판단하게 되는 심각한 버그였다 — 화/수요일에 같은 회원이 두 번
          // 배정되던 문제의 원인).
          existingA.forEach(node => uncommit(dayA, node));
          existingB.forEach(node => uncommit(dayB, node));
          dayChains.set(dayA, []);
          dayChains.set(dayB, []);

          // unassigned/totalSessions 계산은 dayChains를 직접 읽으므로(currentlyAssignedMemberIds
          // 참고), 시도 중에는 dayChains도 후보 체인으로 잠깐 채워둬야 정확히 계산되고, 시도가
          // 끝나면 커밋 해제와 함께 dayChains도 다시 비워 다음 시도가 항상 같은 빈 상태에서
          // 시작하도록 한다.
          function attemptOrder(firstDay, secondDay, jitterFn) {
            const firstNodes = buildDayNodes(reqsByDay.get(firstDay), (mId) => isEligibleForDay(mId, firstDay) ? 1 : 0, jitterFn);
            const firstChain = runChainDP(firstNodes);
            firstChain.forEach(node => commit(firstDay, node));
            dayChains.set(firstDay, firstChain);
            const secondNodes = buildDayNodes(reqsByDay.get(secondDay), (mId) => isEligibleForDay(mId, secondDay) ? 1 : 0, jitterFn);
            const secondChain = runChainDP(secondNodes);
            secondChain.forEach(node => commit(secondDay, node));
            dayChains.set(secondDay, secondChain);
            const outcome = {
              unassigned: stillUnassignedIds().length,
              totalSessions: Array.from(dayChains.values()).reduce((sum, c) => sum + c.length, 0),
              pairTravel: totalTravelCount(firstChain) + totalTravelCount(secondChain),
              chainA: firstDay === dayA ? firstChain : secondChain,
              chainB: firstDay === dayA ? secondChain : firstChain
            };
            firstChain.forEach(node => uncommit(firstDay, node));
            secondChain.forEach(node => uncommit(secondDay, node));
            dayChains.set(firstDay, []);
            dayChains.set(secondDay, []);
            return outcome;
          }

          const attempts = [attemptOrder(dayA, dayB, null), attemptOrder(dayB, dayA, null)];
          for (let k = 0; k < 8 && now() < STAGE6_DEADLINE; k++) {
            await maybeYield();
            attempts.push(attemptOrder(dayA, dayB, stage6RandomFn));
            attempts.push(attemptOrder(dayB, dayA, stage6RandomFn));
          }

          let bestOption = null;
          attempts.forEach(opt => {
            if (opt.unassigned > beforeUnassignedCount) return;
            if (opt.totalSessions < beforeTotalSessions) return;
            if (opt.pairTravel >= beforePairTravel) return; // 개선되지 않으면 굳이 바꾸지 않는다
            if (!bestOption || opt.pairTravel < bestOption.pairTravel) bestOption = opt;
          });

          if (bestOption) {
            bestOption.chainA.forEach(node => commit(dayA, node));
            bestOption.chainB.forEach(node => commit(dayB, node));
            dayChains.set(dayA, bestOption.chainA);
            dayChains.set(dayB, bestOption.chainB);
          } else {
            existingA.forEach(node => commit(dayA, node));
            existingB.forEach(node => commit(dayB, node));
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
      const baselineSessions = Array.from(dayChains.values()).reduce((sum, c) => sum + c.length, 0);
      const baselineTravel = Array.from(dayChains.values()).reduce((sum, c) => sum + totalTravelCount(c), 0);
      let bestSnapshot = { unassigned: baselineUnassigned, sessions: baselineSessions, travel: baselineTravel, chains: new Map(dayChains) };

      const polishRandomFn = mulberry32(778899 + seedOffset);
      for (let attempt = 0; attempt < 200 && now() < STAGE65_DEADLINE; attempt++) {
        await maybeYield();
        dayChains.forEach((chain, day) => chain.forEach(node => uncommit(day, node)));
        shuffled(daysWithReqs, polishRandomFn).forEach(day => {
          // 지터를 줘서, 매 시도마다 동점 처리가 달라지게 한다 — 요일 순서만 바꿔서는 항상
          // 시간순으로만 동점이 풀려 "누가 2회를 받는지" 조합이 거의 안 바뀌는 문제가 있었다.
          // 여기서도 지점 뭉치기 보너스를 함께 준다.
          const dominantLoc = dominantLocationFor(day);
          const nodes = buildDayNodes(reqsByDay.get(day), (mId, startSlot, locationId) => {
            if (!isEligibleForDay(mId, day)) return 0;
            return locationId === dominantLoc ? 1.02 : 1;
          }, () => polishRandomFn());
          const chain = runChainDP(nodes);
          chain.forEach(node => commit(day, node));
          dayChains.set(day, chain);
        });
        const attemptUnassigned = stillUnassignedIds().length;
        const attemptSessions = Array.from(dayChains.values()).reduce((sum, c) => sum + c.length, 0);
        const attemptTravel = Array.from(dayChains.values()).reduce((sum, c) => sum + totalTravelCount(c), 0);
        if (attemptUnassigned <= bestSnapshot.unassigned && attemptSessions >= bestSnapshot.sessions && attemptTravel < bestSnapshot.travel) {
          bestSnapshot = { unassigned: attemptUnassigned, sessions: attemptSessions, travel: attemptTravel, chains: new Map(dayChains) };
        }
      }

      dayChains.forEach((chain, day) => chain.forEach(node => uncommit(day, node)));
      bestSnapshot.chains.forEach((chain, day) => {
        chain.forEach(node => commit(day, node));
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
          const prev = sorted[i - 1], cur = sorted[i];
          const gapMin = (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) * SLOT_MIN;
          idle += Math.max(0, gapMin - requiredGapMin2(prev.locationId, cur.locationId));
        }
        return idle;
      }
      // (travelA, idleA)가 (travelB, idleB)보다 나은지 — 이동 횟수를 먼저 보고, 같으면 빈
      // 시간이 더 적은 쪽을 우선한다.
      function isTravelIdleBetter(travelA, idleA, travelB, idleB) {
        if (travelA !== travelB) return travelA < travelB;
        return idleA < idleB;
      }

      function tryRelocateSession(node) {
        const memberId = node.memberId;
        const currentDay = node.day;
        const currentChainWithout = (dayChains.get(currentDay) || []).filter(n => n !== node);
        const beforeCurrentDayTravel = totalTravelCount(dayChains.get(currentDay) || []);
        const beforeCurrentDayIdle = dayIdleMinutes(dayChains.get(currentDay) || []);
        const currentDayWithoutTravel = totalTravelCount(currentChainWithout); // 후보마다 매번 다시 구하지 않도록 한 번만 계산
        const currentDayWithoutIdle = dayIdleMinutes(currentChainWithout);
        let bestMove = null; // { sameDay, targetDay, newTargetChain, deltaTravel, deltaIdle }

        daysWithReqs.forEach(day => {
          if (day !== currentDay) {
            // 이 회원이 그 요일에 이미 다른 세션을 갖고 있으면(있을 리 없지만 안전하게) 건너뛴다.
            if ((dayChains.get(day) || []).some(n => n.memberId === memberId)) return;
          }
          const dayReqsForMember = reqsFor(memberId, day);
          if (dayReqsForMember.length === 0) return;
          const candNodes = buildDayNodes(dayReqsForMember, () => 1);
          const baseChain = day === currentDay ? currentChainWithout : (dayChains.get(day) || []);
          const beforeTargetDayTravel = day === currentDay ? 0 : totalTravelCount(baseChain); // 후보 훑기 전 한 번만
          const beforeTargetDayIdle = day === currentDay ? 0 : dayIdleMinutes(baseChain);
          candNodes.forEach(cand => {
            if (day === currentDay && cand.startSlot === node.startSlot && cand.locationId === node.locationId) return; // 원래 자리
            let insertAt = 0;
            while (insertAt < baseChain.length && baseChain[insertAt].startSlot < cand.startSlot) insertAt++;
            let feasible = true;
            if (insertAt > 0) {
              const prev = baseChain[insertAt - 1];
              const prevEnd = prev.startSlot + durationToSlots(prev.duration);
              if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId)) feasible = false;
            }
            if (feasible && insertAt < baseChain.length) {
              const next = baseChain[insertAt];
              if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId)) feasible = false;
            }
            if (!feasible) return;
            const newNode = { id: cand.id, memberId, day, startSlot: cand.startSlot, duration: cand.duration, locationId: cand.locationId, end: cand.end };
            const newChain = baseChain.slice();
            newChain.splice(insertAt, 0, newNode);
            if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) return;

            let deltaTravel, deltaIdle;
            if (day === currentDay) {
              deltaTravel = totalTravelCount(newChain) - beforeCurrentDayTravel;
              deltaIdle = dayIdleMinutes(newChain) - beforeCurrentDayIdle;
            } else {
              deltaTravel = (currentDayWithoutTravel + totalTravelCount(newChain)) - (beforeCurrentDayTravel + beforeTargetDayTravel);
              deltaIdle = (currentDayWithoutIdle + dayIdleMinutes(newChain)) - (beforeCurrentDayIdle + beforeTargetDayIdle);
            }
            // 이동이 늘면 절대 받아들이지 않고, 이동이 그대로면 빈 시간이 줄 때만 받아들인다.
            const improves = deltaTravel < 0 || (deltaTravel === 0 && deltaIdle < 0);
            if (improves && (!bestMove || isTravelIdleBetter(deltaTravel, deltaIdle, bestMove.deltaTravel, bestMove.deltaIdle))) {
              bestMove = { sameDay: day === currentDay, targetDay: day, newTargetChain: newChain, deltaTravel, deltaIdle };
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
        const addedNode = bestMove.newTargetChain.find(n => n.memberId === memberId);
        commit(bestMove.targetDay, addedNode);
        return true;
      }

      // 자리 하나를 옮기는 것만으로는 못 푸는 경우(두 회원이 서로 상대방의 자리를 원하는
      // 경우)를 위해, 서로 다른 요일에 배정된 두 회원의 자리를 통째로 맞바꾸는 것도 시도한다
      // — 각자 상대방의 (요일·시각)에 실제로 신청이 있고 그 지점도 다닐 수 있어야 하며,
      // 맞바꾼 뒤 두 요일 각각의 간격·이동 제한을 모두 만족해야 한다.
      function insertFeasible(chainWithout, cand) {
        let insertAt = 0;
        while (insertAt < chainWithout.length && chainWithout[insertAt].startSlot < cand.startSlot) insertAt++;
        if (insertAt > 0) {
          const prev = chainWithout[insertAt - 1];
          const prevEnd = prev.startSlot + durationToSlots(prev.duration);
          if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId)) return null;
        }
        if (insertAt < chainWithout.length) {
          const next = chainWithout[insertAt];
          if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId)) return null;
        }
        const newChain = chainWithout.slice();
        newChain.splice(insertAt, 0, cand);
        if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) return null;
        return newChain;
      }

      // "회원|요일|시작슬롯"가 실제 신청 목록에 있는지 매번 배열을 훑지 않고 바로 확인하기
      // 위한 조회용 집합 — 맞바꾸기는 모든 세션 쌍을 다 검사하므로(O(세션 수^2)) 이 조회가
      // 느리면 회원·신청이 많을 때 전체가 크게 느려진다.
      const reqKeySet = new Set(eligibleReqs.map(r => r.memberId + "|" + r.day + "|" + r.startSlot));

      function tryCrossDaySwap(node1, node2) {
        if (node1.day === node2.day || node1.memberId === node2.memberId) return false;
        const day1 = node1.day, day2 = node2.day, member1 = node1.memberId, member2 = node2.memberId;
        if (!reqKeySet.has(member1 + "|" + day2 + "|" + node2.startSlot)) return false;
        if (!reqKeySet.has(member2 + "|" + day1 + "|" + node1.startSlot)) return false;
        const req1InDay2 = reqAt(member1, day2, node2.startSlot);
        const req2InDay1 = reqAt(member2, day1, node1.startSlot);
        if (!candidateLocationsForRequest(req1InDay2).includes(node2.locationId)) return false;
        if (!candidateLocationsForRequest(req2InDay1).includes(node1.locationId)) return false;
        // 회원당 1일 최대 1회 — 등록 회원은 원래 2회를 배정받으므로, member1이 day2에(그
        // 자리를 넘겨줄 node2 말고) 이미 별도로 다른 세션을 갖고 있을 수 있다(반대도 마찬가지).
        // 이 경우 자리를 바꾸면 그 요일에 같은 회원이 두 번 배정되므로 반드시 막아야 한다.
        if ((dayChains.get(day2) || []).some(n => n.memberId === member1)) return false;
        if ((dayChains.get(day1) || []).some(n => n.memberId === member2)) return false;

        const dur1 = sessionDurationFor2(memberById(member1));
        const dur2 = sessionDurationFor2(memberById(member2));
        const newInDay2 = { id: req1InDay2.id, memberId: member1, day: day2, startSlot: node2.startSlot, duration: dur1, locationId: node2.locationId, end: node2.startSlot + durationToSlots(dur1) };
        const newInDay1 = { id: req2InDay1.id, memberId: member2, day: day1, startSlot: node1.startSlot, duration: dur2, locationId: node1.locationId, end: node1.startSlot + durationToSlots(dur2) };

        const chain1 = insertFeasible((dayChains.get(day1) || []).filter(n => n !== node1), newInDay1);
        if (!chain1) return false;
        const chain2 = insertFeasible((dayChains.get(day2) || []).filter(n => n !== node2), newInDay2);
        if (!chain2) return false;

        const beforeTravel = totalTravelCount(dayChains.get(day1) || []) + totalTravelCount(dayChains.get(day2) || []);
        const afterTravel = totalTravelCount(chain1) + totalTravelCount(chain2);
        const beforeIdle = dayIdleMinutes(dayChains.get(day1) || []) + dayIdleMinutes(dayChains.get(day2) || []);
        const afterIdle = dayIdleMinutes(chain1) + dayIdleMinutes(chain2);
        // 이동이 늘면 받아들이지 않고, 이동이 그대로면 빈 시간이 줄 때만 받아들인다.
        if (afterTravel > beforeTravel) return false;
        if (afterTravel === beforeTravel && afterIdle >= beforeIdle) return false;

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
          days: new Map(Array.from(assignedDaysByMember, ([k, v]) => [k, new Set(v)]))
        };
      }
      function restoreChainState(snap) {
        dayChains.clear(); snap.dayChains.forEach((v, k) => dayChains.set(k, v));
        assignedCountByMember.clear(); snap.counts.forEach((v, k) => assignedCountByMember.set(k, v));
        assignedDaysByMember.clear(); snap.days.forEach((v, k) => assignedDaysByMember.set(k, v));
      }
      // placeMemberId를 (excludeDays에 없는) 어느 요일이든 하나 끼워넣어본다 — 빈 자리가
      // 있으면 그대로, 없으면 "정확히 한 명"을 내보내고 그 사람을 재귀적으로 다시 배치해준다
      // (사슬 깊이는 MAX_RELOCATE_EJECT_DEPTH까지). protectedMemberId는 내보내면 안 되는
      // 회원(보통 이 사슬을 시작한 원래 회원 — 안 그러면 그 사람을 다시 내보내 제자리로
      // 돌아가는 식으로 무한히 맴돌 수 있다)이다. touchedDays에 이 과정에서 실제로 배치가
      // 바뀐 요일을 계속 추가해준다(호출한 쪽이 이동·빈 시간 변화를 계산할 때 씀).
      // tryEjectChainMove(자리 재배치)와 trySessionCountSwap(2회 배정 회원 교체) 둘 다 이
      // 헬퍼를 공유한다.
      function tryPlaceMemberChain(placeMemberId, excludeDays, depth, touchedDays, protectedMemberId) {
        if (depth > MAX_RELOCATE_EJECT_DEPTH) return false;
        for (const day of daysWithReqs) {
          if (excludeDays.has(day)) continue;
          if ((dayChains.get(day) || []).some(n => n.memberId === placeMemberId)) continue;
          const reqs = reqsFor(placeMemberId, day);
          if (reqs.length === 0) continue;
          const candNodes = buildDayNodes(reqs, () => 1);
          const chain = dayChains.get(day) || [];

          // 1) 아무도 안 건드리고 바로 끼워넣을 수 있는 자리가 있는지 먼저 본다.
          for (const cand of candNodes) {
            const newNode = { id: cand.id, memberId: placeMemberId, day, startSlot: cand.startSlot, duration: cand.duration, locationId: cand.locationId, end: cand.end };
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
            chain.forEach(n => {
              const nEnd = n.startSlot + durationToSlots(n.duration);
              if (cand.startSlot < nEnd && n.startSlot < cand.end) overlapping.add(n.memberId);
            });
            let otherMemberId = null;
            if (overlapping.size === 1) {
              otherMemberId = [...overlapping][0];
            } else if (overlapping.size === 0) {
              const sorted = chain.slice().sort((a, b) => a.startSlot - b.startSlot);
              let idx = 0;
              while (idx < sorted.length && sorted[idx].startSlot < cand.startSlot) idx++;
              const prevN = idx > 0 ? sorted[idx - 1] : null;
              const nextN = idx < sorted.length ? sorted[idx] : null;
              const prevBad = prevN && ((cand.startSlot - (prevN.startSlot + durationToSlots(prevN.duration))) * SLOT_MIN < requiredGapMin2(prevN.locationId, cand.locationId));
              const nextBad = nextN && ((nextN.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, nextN.locationId));
              if (prevBad && nextBad && prevN.memberId !== nextN.memberId) continue;
              if (prevBad) otherMemberId = prevN.memberId;
              else if (nextBad) otherMemberId = nextN.memberId;
              else continue;
            } else continue;
            if (otherMemberId === protectedMemberId) continue; // 사슬을 시작한 회원을 다시 내보내면 제자리로 돌아갈 뿐이다
            const otherNode = chain.find(n => n.memberId === otherMemberId);
            const remaining = chain.filter(n => n.memberId !== otherMemberId);
            const newNode = { id: cand.id, memberId: placeMemberId, day, startSlot: cand.startSlot, duration: cand.duration, locationId: cand.locationId, end: cand.end };
            const newChain = insertFeasible(remaining, newNode);
            if (!newChain) continue;

            uncommit(day, otherNode);
            commit(day, newNode);
            dayChains.set(day, newChain);
            touchedDays.add(day);

            if (tryPlaceMemberChain(otherMemberId, new Set([...excludeDays, day]), depth + 1, touchedDays, protectedMemberId)) return true;

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
        dayChains.set(currentDay, chain0.filter(n => n !== node));

        const placed = tryPlaceMemberChain(memberId, new Set(), 0, touchedDays, memberId);
        if (!placed) {
          restoreChainState(snap);
          return false;
        }

        let beforeTravel = 0, beforeIdle = 0, afterTravel = 0, afterIdle = 0;
        touchedDays.forEach(day => {
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
        const doubles = [], singles = [];
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
        dayChains.forEach((chain, day) => chain.forEach(n => { if (n.memberId === memberA) aNodes.push({ day, node: n }); }));
        if (aNodes.length !== 2) { restoreChainState(snap); return false; } // 안전망(정상적으로는 항상 2개)
        const removed = aNodes[Math.floor(randomFn() * aNodes.length)];
        uncommit(removed.day, removed.node);
        dayChains.set(removed.day, (dayChains.get(removed.day) || []).filter(n => n !== removed.node));
        touchedDays.add(removed.day);

        const placed = tryPlaceMemberChain(memberB, new Set(), 0, touchedDays, null);
        if (!placed) {
          restoreChainState(snap);
          return false;
        }

        let beforeTravel = 0, beforeIdle = 0, afterTravel = 0, afterIdle = 0;
        touchedDays.forEach(day => {
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
          dayChains.forEach(chain => { sum += totalTravelCount(chain); });
          return sum;
        }
        function saTotalIdle() {
          let sum = 0;
          dayChains.forEach(chain => { sum += dayIdleMinutes(chain); });
          return sum;
        }
        // 이동 1번의 "무게"를 빈 시간 240분(4시간)과 같게 쳐서 비용을 하나의 숫자로 합친다 —
        // 이동이 훨씬 더 중요하지만, 너무 크게 잡으면 온도 스케일과 안 맞아 이동이 늘어나는
        // 이동은 사실상 전부 거부돼버려 담금질의 의미(가끔 나빠지는 이동도 받아들이기)가
        // 없어진다.
        const SA_TRAVEL_WEIGHT = 240;

        function pickRandomNode(randomFn) {
          const all = Array.from(dayChains.values()).flat();
          if (all.length === 0) return null;
          return all[Math.floor(randomFn() * all.length)];
        }

        function saProposeRelocate(randomFn) {
          const node = pickRandomNode(randomFn);
          if (!node) return null;
          const memberId = node.memberId, currentDay = node.day;
          const currentChainWithout = (dayChains.get(currentDay) || []).filter(n => n !== node);

          const options = [];
          daysWithReqs.forEach(day => {
            if (day !== currentDay && (dayChains.get(day) || []).some(n => n.memberId === memberId)) return;
            reqsFor(memberId, day).forEach(r => options.push({ day, startSlot: r.startSlot, req: r }));
          });
          if (options.length === 0) return null;
          const picked = options[Math.floor(randomFn() * options.length)];
          const locOptions = candidateLocationsForRequest(picked.req);
          if (locOptions.length === 0) return null;
          const locationId = locOptions[Math.floor(randomFn() * locOptions.length)];
          if (picked.day === currentDay && picked.startSlot === node.startSlot && locationId === node.locationId) return null;

          const duration = sessionDurationFor2(memberById(memberId));
          const cand = { id: picked.req.id, memberId, day: picked.day, startSlot: picked.startSlot, duration, locationId, end: picked.startSlot + durationToSlots(duration) };
          const baseChain = picked.day === currentDay ? currentChainWithout : (dayChains.get(picked.day) || []);
          const newChain = insertFeasible(baseChain, cand);
          if (!newChain) return null;

          let deltaTravel, deltaIdle;
          if (picked.day === currentDay) {
            deltaTravel = totalTravelCount(newChain) - totalTravelCount(dayChains.get(currentDay) || []);
            deltaIdle = dayIdleMinutes(newChain) - dayIdleMinutes(dayChains.get(currentDay) || []);
          } else {
            const beforeCur = dayChains.get(currentDay) || [];
            const beforeTgt = dayChains.get(picked.day) || [];
            deltaTravel = (totalTravelCount(currentChainWithout) + totalTravelCount(newChain)) - (totalTravelCount(beforeCur) + totalTravelCount(beforeTgt));
            deltaIdle = (dayIdleMinutes(currentChainWithout) + dayIdleMinutes(newChain)) - (dayIdleMinutes(beforeCur) + dayIdleMinutes(beforeTgt));
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
              const addedNode = newChain.find(n => n.memberId === memberId && n.startSlot === picked.startSlot && n.locationId === locationId);
              commit(picked.day, addedNode);
            }
          };
        }

        function saProposeSwap(randomFn) {
          const n1 = pickRandomNode(randomFn);
          const n2 = pickRandomNode(randomFn);
          if (!n1 || !n2 || n1 === n2 || n1.day === n2.day || n1.memberId === n2.memberId) return null;
          const day1 = n1.day, day2 = n2.day, member1 = n1.memberId, member2 = n2.memberId;
          if (!reqKeySet.has(member1 + "|" + day2 + "|" + n2.startSlot)) return null;
          if (!reqKeySet.has(member2 + "|" + day1 + "|" + n1.startSlot)) return null;
          const req1InDay2 = reqAt(member1, day2, n2.startSlot);
          const req2InDay1 = reqAt(member2, day1, n1.startSlot);
          if (!candidateLocationsForRequest(req1InDay2).includes(n2.locationId)) return null;
          if (!candidateLocationsForRequest(req2InDay1).includes(n1.locationId)) return null;
          // 회원당 1일 최대 1회 — member1이 day2에 이미 다른 세션을 갖고 있거나(반대도
          // 마찬가지) 놓치면, 자리를 바꾼 뒤 그 요일에 같은 회원이 두 번 배정될 수 있다.
          if ((dayChains.get(day2) || []).some(n => n.memberId === member1)) return null;
          if ((dayChains.get(day1) || []).some(n => n.memberId === member2)) return null;

          const dur1 = sessionDurationFor2(memberById(member1));
          const dur2 = sessionDurationFor2(memberById(member2));
          const newInDay2 = { id: req1InDay2.id, memberId: member1, day: day2, startSlot: n2.startSlot, duration: dur1, locationId: n2.locationId, end: n2.startSlot + durationToSlots(dur1) };
          const newInDay1 = { id: req2InDay1.id, memberId: member2, day: day1, startSlot: n1.startSlot, duration: dur2, locationId: n1.locationId, end: n1.startSlot + durationToSlots(dur2) };

          const chain1 = insertFeasible((dayChains.get(day1) || []).filter(n => n !== n1), newInDay1);
          if (!chain1) return null;
          const chain2 = insertFeasible((dayChains.get(day2) || []).filter(n => n !== n2), newInDay2);
          if (!chain2) return null;

          const beforeTravel = totalTravelCount(dayChains.get(day1) || []) + totalTravelCount(dayChains.get(day2) || []);
          const afterTravel = totalTravelCount(chain1) + totalTravelCount(chain2);
          const beforeIdle = dayIdleMinutes(dayChains.get(day1) || []) + dayIdleMinutes(dayChains.get(day2) || []);
          const afterIdle = dayIdleMinutes(chain1) + dayIdleMinutes(chain2);
          const cost = (afterTravel - beforeTravel) * SA_TRAVEL_WEIGHT + (afterIdle - beforeIdle);

          return {
            cost,
            apply: () => {
              uncommit(day1, n1);
              uncommit(day2, n2);
              commit(day1, newInDay1);
              commit(day2, newInDay2);
              dayChains.set(day1, chain1);
              dayChains.set(day2, chain2);
            }
          };
        }

        const saRandomFn = mulberry32(552233 + seedOffset);
        let temperature = 200;
        const COOLING_RATE = 0.999;
        let bestSnapshotSA = new Map(dayChains);
        let bestTravelSA = saTotalTravel();
        let bestIdleSA = saTotalIdle();
        let iter = 0;
        while (now() < SA_DEADLINE) {
          await maybeYield();
          iter++;
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
            const proposal = saRandomFn() < 0.35 ? saProposeSwap(saRandomFn) : saProposeRelocate(saRandomFn);
            if (proposal) {
              const accept = proposal.cost <= 0 || saRandomFn() < Math.exp(-proposal.cost / temperature);
              if (accept) {
                proposal.apply();
                applied = true;
              }
            }
          }
          if (applied) {
            const curTravel = saTotalTravel();
            const curIdle = saTotalIdle();
            if (curTravel < bestTravelSA || (curTravel === bestTravelSA && curIdle < bestIdleSA)) {
              bestTravelSA = curTravel;
              bestIdleSA = curIdle;
              bestSnapshotSA = new Map(dayChains);
            }
          }
          temperature = Math.max(1, temperature * COOLING_RATE);
        }
        dayChains.forEach((chain, day) => chain.forEach(node => uncommit(day, node)));
        bestSnapshotSA.forEach((chain, day) => {
          chain.forEach(node => commit(day, node));
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
        const flatNodes = shuffled(Array.from(dayChains.values()).flat(), relocateRandomFn);
        for (const node of flatNodes) {
          await maybeYield();
          if (now() >= POLISH_DEADLINE) break;
          // dayChains가 이전 이동으로 바뀌었을 수 있으니, 이 노드가 여전히 배정되어 있는지 확인한다.
          const stillThere = (dayChains.get(node.day) || []).includes(node);
          if (!stillThere) continue;
          if (tryRelocateSession(node)) { improvedInPass = true; continue; }
          // 빈 자리로 바로 옮길 수 없으면, 3자 연쇄 재배치(자리를 내주고 그 사람은 다른
          // 자리로 보내는 식)로도 개선이 되는지 마지막으로 확인한다.
          if (tryEjectChainMove(node, (dt, di) => dt < 0 || (dt === 0 && di < 0))) improvedInPass = true;
        }
        if (now() >= POLISH_DEADLINE) break;
        // 맞바꾸기: 모든 (서로 다른 요일의) 세션 쌍을 무작위 순서로 훑으며 시도한다.
        const flatNodes2 = shuffled(Array.from(dayChains.values()).flat(), relocateRandomFn);
        outer:
        for (let i = 0; i < flatNodes2.length; i++) {
          for (let k = i + 1; k < flatNodes2.length; k++) {
            await maybeYield();
            if (now() >= POLISH_DEADLINE) break outer;
            const n1 = flatNodes2[i], n2 = flatNodes2[k];
            const n1There = (dayChains.get(n1.day) || []).includes(n1);
            const n2There = (dayChains.get(n2.day) || []).includes(n2);
            if (!n1There || !n2There) continue;
            if (tryCrossDaySwap(n1, n2)) improvedInPass = true;
          }
        }
        // 세션 재분배: 2회 배정 회원 중 한 명의 세션을 내려놓고, 1회 배정 회원 중 한 명을
        // 대신 태워보는 조합도 개선이 되는지 확인한다(trySessionCountSwap 주석 참고).
        for (let attempt = 0; attempt < 60 && now() < POLISH_DEADLINE; attempt++) {
          await maybeYield();
          if (trySessionCountSwap(relocateRandomFn, (dt, di) => dt < 0 || (dt === 0 && di < 0))) improvedInPass = true;
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
      daysWithReqs.forEach(day => {
        const chain = (dayChains.get(day) || []).slice().sort((a, b) => a.startSlot - b.startSlot);
        for (let idx = 1; idx < chain.length; idx++) {
          const prev = chain[idx - 1];
          const node = chain[idx];
          const minStart = prev.startSlot + durationToSlots(prev.duration) + durationToSlots(requiredGapMin2(prev.locationId, node.locationId));
          if (node.startSlot <= minStart) continue;
          const earlierReqs = reqsFor(node.memberId, day).filter(r => r.startSlot >= minStart && r.startSlot < node.startSlot);
          if (earlierReqs.length === 0) continue;
          const earliestSlot = Math.min(...earlierReqs.map(r => r.startSlot));
          node.startSlot = earliestSlot;
          node.end = earliestSlot + durationToSlots(node.duration);
        }
        dayChains.set(day, chain);
      });
    }

    const assigned = [];
    dayChains.forEach(chain => assigned.push(...chain));
    // 가능 시간(신청)을 아예 제출하지 않은 회원은 배정 대상이 아니었으므로 "미배정"에 넣지
    // 않는다 — 신청은 했지만 자리를 못 받은 회원만 미배정으로 표시한다.
    const eligibleMemberIds = state.members
      .filter(m => !excludedIdSet2.has(m.id) && submittedIds.has(m.id))
      .map(m => m.id);
    const assignedMemberIds = new Set(assigned.map(r => r.memberId));
    const unassignedMembers = eligibleMemberIds
      .filter(id => !assignedMemberIds.has(id))
      .map(memberById)
      .filter(Boolean);

    return { assigned, unassignedMembers };
  }

  // 시드가 있는 간단한 의사난수 생성기 — 매번 다른 배열 셔플을 만들되, 필요하면 재현 가능하게.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, randomFn) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // result가 better보다 더 나은 결과인지 비교한다: 미배정 회원 수(적을수록) → 수업 수(많을수록)
  // → 이동 횟수(적을수록) → 총 이동 시간(적을수록) 순.
  function isSchedule2ResultBetter(a, b) {
    if (a.unassignedMembers.length !== b.unassignedMembers.length) {
      return a.unassignedMembers.length < b.unassignedMembers.length;
    }
    if (a.assigned.length !== b.assigned.length) return a.assigned.length > b.assigned.length;
    const travelCountA = totalTravelCount(a.assigned), travelCountB = totalTravelCount(b.assigned);
    if (travelCountA !== travelCountB) return travelCountA < travelCountB;
    const travelMinA = totalTravelMinutes(a.assigned), travelMinB = totalTravelMinutes(b.assigned);
    if (travelMinA !== travelMinB) return travelMinA < travelMinB;
    return schedule2TotalIdleMinutes(a.assigned) < schedule2TotalIdleMinutes(b.assigned);
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
  function schedule2Signature(result) {
    return result.assigned.map(r => r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId).sort().join(",");
  }
  const MAX_POLISH_CANDIDATES = 10; // 다듬기 전 지표 상위권 요일 순서 중 최대 이만큼만 서로 다른 시작점으로 쓴다
  // 담금질 기법은 시드가 다르면 완전히 다른 경로를 헤매므로, 재시작 횟수 자체가 "3명 이상이
  // 요일을 넘나들며 동시에 자리를 맞바꿔야만 나오는 조합"을 찾을 확률을 좌우한다. 24회·120초는
  // 이런 조합을 우연히 밟기엔 다소 부족해 보여, 재시작·예산을 다시 한번 늘렸다(각 시도
  // 자체의 로직은 그대로 두고 "몇 번 더 시도해보는가"만 늘린 것이라 회귀 위험이 낮다).
  const MAX_POLISH_ATTEMPTS = 32; // 요일 순서(위)와 담금질 시드 재시작을 합쳐 최대 이만큼만 다듬어본다
  const TOTAL_POLISH_BUDGET_MS = 240000;
  const MIN_POLISH_BUDGET_MS = 6000; // 시도가 여럿이어도 담금질이 의미 있으려면 한 시도당 최소한 이 정도는 필요하다

  // 여러 요일 순서를 다 시도해보는 동안(특히 회원·신청이 많으면 한 조합에도 시간이 좀
  // 걸릴 수 있어) 화면이 멈춘 것처럼 보이지 않도록, onProgress가 있으면 조합 하나를 끝낼
  // 때마다 진행률을 알리고 화면을 다시 그릴 틈(yieldToUI)을 준다.
  async function generateSchedule2Async(onProgress) {
    const eligibleReqs = state.requests.filter(isEligibleRequest2);
    const reqsByDay = new Map();
    DAYS.forEach((_, d) => reqsByDay.set(d, []));
    eligibleReqs.forEach(r => reqsByDay.get(r.day).push(r));
    const daysWithReqs = Array.from(reqsByDay.keys()).filter(d => reqsByDay.get(d).length > 0);

    const memberCountOf = day => new Set(reqsByDay.get(day).map(r => r.memberId)).size;
    const leastFirst = daysWithReqs.slice().sort((a, b) => memberCountOf(a) - memberCountOf(b));
    const mostFirst = daysWithReqs.slice().sort((a, b) => memberCountOf(b) - memberCountOf(a));
    const ascending = daysWithReqs.slice().sort((a, b) => a - b);
    const descending = daysWithReqs.slice().sort((a, b) => b - a);
    const dayOrdersToTry = [leastFirst, mostFirst, ascending, descending];
    const randomFn = mulberry32(20260823);
    for (let i = 0; i < 400; i++) dayOrdersToTry.push(shuffled(daysWithReqs, randomFn));

    // 회원·신청이 아주 많으면 요일 순서 후보 하나를 시도하는 데도 시간이 걸리므로(복구
    // 단계 포함), 전체 탐색에 시간 예산을 둔다 — 예산을 넘기면 그때까지 찾은 가장 좋은
    // 순서로 넘어간다. 평가한 결과는 전부 기억해둔다 — 다듬기 전 동점 후보를 나중에
    // 다시 골라내야 하므로(아래 참고).
    const SEARCH_DEADLINE = performance.now() + 18000;
    let best = null, bestOrder = null;
    const evaluated = [];
    for (let i = 0; i < dayOrdersToTry.length; i++) {
      const result = await runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, dayOrdersToTry[i], true, false);
      evaluated.push({ order: dayOrdersToTry[i], result });
      if (!best || isSchedule2ResultBetter(result, best)) {
        best = result;
        bestOrder = dayOrdersToTry[i];
      }
      if (onProgress) {
        onProgress((i + 1) / (dayOrdersToTry.length + 1) * 0.55);
        await yieldToUI();
        checkGenerationCancelled();
      }
      if (performance.now() >= SEARCH_DEADLINE) break;
    }
    if (!bestOrder) return { assigned: [], unassignedMembers: [] };

    // 다듬기 전 지표가 최선과 완전히 동점인 요일 순서만 다듬어보면(예전 방식), 다듬기 전엔
    // 살짝 못해 보이지만 다듬고 나면(특히 담금질 기법으로) 더 좋아지는 순서를 놓칠 수 있다
    // (실제로 수동으로 짠 스케줄이 다듬기 전 지표까지는 최선과 같은데, 그 최선 순서를
    // 다듬은 것보다도 이동을 1번 더 줄인 사례로 확인됨 — 즉 "동점"이 아니라 "최선에 가까운"
    // 순서 중에도 다듬으면 더 좋아지는 것이 있을 수 있다는 뜻). 그래서 완전 동점만 고르지
    // 않고, 다듬기 전 지표로 전체 순위를 매겨 상위 MAX_POLISH_CANDIDATES개(서로 다른 배치만)를
    // 고른다 — 다듬기는 항상 "다듬은 뒤 실제로 더 나쁘면 버리는" 방식이라 후보를 넓혀도
    // 손해는 없다.
    const ranked = evaluated.slice().sort((x, y) => {
      if (isSchedule2ResultBetter(x.result, y.result)) return -1;
      if (isSchedule2ResultBetter(y.result, x.result)) return 1;
      return 0;
    });
    const seenSignatures = new Set();
    const polishCandidates = [];
    for (const { order, result } of ranked) {
      const sig = schedule2Signature(result);
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);
      polishCandidates.push(order);
      if (polishCandidates.length >= MAX_POLISH_CANDIDATES) break;
    }
    if (polishCandidates.length === 0) polishCandidates.push(bestOrder);

    // 요일 순서 후보만으로는 부족하다 — 담금질 기법은 시드가 고정돼 있으면 매번 정확히 같은
    // 무작위 경로만 훑어보므로, 사람이 손으로 짠 배치처럼 3명 이상이 요일을 넘나들며 동시에
    // 자리를 맞바꿔야만 나오는 조합은 그 경로를 우연히 밟지 못하면 몇 번을 다시 생성해도
    // 계속 같은 결과에 머문다(실제로 이 문제로 확인됨). 그래서 각 요일 순서 후보를 서로 다른
    // 시드로 여러 번 재시작해서 다듬어본다 — 먼저 후보마다 한 번씩(seedOffset 0)을 채우고,
    // 그러고도 MAX_POLISH_ATTEMPTS에 못 미치면 후보를 돌아가며 시드를 바꿔 재시작을 추가한다.
    const attempts = [];
    for (let round = 0; attempts.length < MAX_POLISH_ATTEMPTS; round++) {
      for (const order of polishCandidates) {
        attempts.push({ order, seedOffset: round * 97711 });
        if (attempts.length >= MAX_POLISH_ATTEMPTS) break;
      }
    }

    // 시도 개수만큼 다듬기 시간 예산을 나누되(최소 예산은 보장), 각 시도를 다듬은 뒤
    // 서로 비교해 실제로 가장 좋은 결과를 택한다.
    const perAttemptBudget = Math.max(MIN_POLISH_BUDGET_MS, Math.floor(TOTAL_POLISH_BUDGET_MS / attempts.length));
    let polished = null;
    const polishedAll = []; // "배치 페이저"용: 다듬은 시도를 전부 기억해뒀다가 동점인 것들을 풀로 묶는다
    for (let i = 0; i < attempts.length; i++) {
      const attempt = await runSchedule2Pipeline(
        eligibleReqs, reqsByDay, daysWithReqs, attempts[i].order, true, true, perAttemptBudget, attempts[i].seedOffset);
      polishedAll.push(attempt);
      if (!polished || isSchedule2ResultBetter(attempt, polished)) polished = attempt;
      if (onProgress) {
        onProgress(0.55 + (i + 1) / attempts.length * 0.45);
        await yieldToUI();
        checkGenerationCancelled();
      }
    }
    // polished와 완전히 동점(미배정 → 수업 수 → 이동 횟수 → 이동 시간 → 빈 시간 전부 동일)인
    // 시도들을 서명 중복 제거해 최대 MAX_POOL_VARIANTS개까지 모은다. polished 자신과 서명이
    // 같은 자리는 (동일 배정을 만든 다른 시도 객체가 아니라) polished 참조 그대로 넣어야,
    // 페이저가 pool.indexOf(result)로 현재 위치를 찾을 수 있다.
    const polishedSig = schedule2Signature(polished);
    const tied = [];
    const seenTieSig = new Set();
    polishedAll.forEach(cand => {
      if (isSchedule2ResultBetter(cand, polished) || isSchedule2ResultBetter(polished, cand)) return;
      const sig = schedule2Signature(cand);
      if (seenTieSig.has(sig)) return;
      seenTieSig.add(sig);
      if (tied.length < MAX_POOL_VARIANTS) tied.push(sig === polishedSig ? polished : cand);
    });
    return { result: polished, pool: tied };
  }

  // result/onDone: 생성3의 후보A 카드에서 항상 그 결과 객체와 renderSchedule3Result를 명시적으로 넘겨받아 쓴다.
  function schedule2ToBlocks(assigned, { result, onDone } = {}) {
    const confirmedIds = new Set((result && result.confirmedIds) || []);
    return assigned.map(r => {
      const m = memberById(r.memberId);
      const loc = locationById(r.locationId);
      const label = m ? m.name + ((m.category || "상담") === "상담" ? " (상담)" : "") : "?";
      const isConfirmed = confirmedIds.has(r.id);
      return {
        day: r.day,
        startSlot: r.startSlot,
        duration: r.duration,
        label,
        loc: loc ? loc.name : "",
        sublabel: slotLabel(r.startSlot) + "~" + endLabel(r.startSlot, r.duration),
        color: m ? memberColor(m.id) : BLOCK_COLOR,
        confirmed: isConfirmed,
        contextMenuItems: () => sessionSwapMenuItems(result, r, isConfirmed, onDone),
        onMove: (targetDay, targetSlot) => moveOrSwapSession(result, r, targetDay, targetSlot, onDone),
        canMoveTo: (targetDay, targetSlot) => canMoveOrSwapTo(result, r, targetDay, targetSlot)
      };
    });
  }

  // 같은 요일 안에서 연속된 두 세션 사이, 지점이 달라 실제로 이동이 필요한 구간만 표시한다
  // (쉬는 시간 없음이 규칙이므로 같은 지점이면 표시할 것이 없다).
  function schedule2ToTravelBlocks(container, onDone = renderSchedule3Result) {
    const assigned = container.assigned;
    const byDay = new Map();
    assigned.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const travelBlocks = [];
    byDay.forEach(reqs => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        const startSlot = prev.startSlot + durationToSlots(prev.duration);
        const mins = travelMinutes(prev.locationId, cur.locationId);
        if (mins > 0) {
          travelBlocks.push({
            day: prev.day, startSlot, duration: mins, label: "이동 " + mins + "분", type: "travel",
            moveDurationSlots: durationToSlots(cur.duration),
            onMove: (targetDay, targetSlot) => moveOrSwapSession(container, cur, targetDay, targetSlot, onDone),
            canMoveTo: (targetDay, targetSlot) => canMoveOrSwapTo(container, cur, targetDay, targetSlot),
            contextMenuItems: () => travelShiftMenuItems(container, cur, onDone)
          });
        }
      }
    });
    return travelBlocks;
  }

  // 같은 요일 안에서 연속된 두 세션 사이, 이동 블록이 차지하는 구간을 뺀 나머지
  // "진짜 빈 시간"을 회색 배경의 빈 시간 블록으로 그리드에 표시하기 위한 좌표를 만든다.
  // (이동 블록과 겹치거나 빈틈이 생기지 않도록, 이동 블록 렌더링과 동일한 반올림을 쓴다.)
  function schedule2ToIdleBlocks(assigned) {
    const byDay = new Map();
    assigned.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const idleBlocks = [];
    byDay.forEach(reqs => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        // 실제 스케줄링 제약(requiredGapMin2)과 같은 반올림을 써야, 알고리즘이 실제로 예약해둔
        // 이동 시간과 화면에 표시되는 "빈 시간" 시작 지점이 어긋나지 않는다.
        const travelSlots = requiredGapMin2(prev.locationId, cur.locationId) / SLOT_MIN;
        const idleStartSlot = prev.startSlot + durationToSlots(prev.duration) + travelSlots;
        const idleEndSlot = cur.startSlot;
        if (idleEndSlot > idleStartSlot) {
          const mins = (idleEndSlot - idleStartSlot) * SLOT_MIN;
          idleBlocks.push({ day: prev.day, startSlot: idleStartSlot, duration: mins, label: "빈 시간 " + mins + "분", type: "break" });
        }
      }
    });
    return idleBlocks;
  }

  // 같은 요일 안에서 연속된 두 세션 사이 간격 중, 이동에 실제로 필요한 시간을 넘어서는
  // "진짜 빈 시간"만 합산한다 — 이동으로 이미 설명되는 구간은 빈 시간으로 치지 않는다.
  function schedule2TotalIdleMinutes(assigned) {
    let idle = 0;
    const byDay = new Map();
    assigned.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    byDay.forEach(reqs => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        const gapMin = (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) * SLOT_MIN;
        const needMin = requiredGapMin2(prev.locationId, cur.locationId);
        idle += Math.max(0, gapMin - needMin);
      }
    });
    return idle;
  }

  // 분을 "150분"처럼 분 단위 배지 텍스트로 바꾼다.
  function formatMinutesLabel(minutes) {
    return Math.round(minutes) + "분";
  }


  /* ---------------- Page navigation (left sidebar, no forced order) ---------------- */
  const pageEls = {
    settings: document.getElementById("pageSettings"),
    schedule3: document.getElementById("pageSchedule3"),
    members: document.getElementById("pageMembers"),
    memberSchedule: document.getElementById("pageMemberSchedule")
  };
  const navItems = document.querySelectorAll(".nav-item");

  function goToPage(pageId) {
    if (!pageEls[pageId]) return;
    currentPage = pageId;
    Object.keys(pageEls).forEach(key => {
      pageEls[key].classList.toggle("active", key === pageId);
    });
    navItems.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === pageId);
    });
    // 이 메뉴에 들어올 때마다 회원 선택은 항상 초기화한다(아무도 선택되지 않은 상태로 시작).
    // 설정 페이지에서 근무 가능 시간을 바꾼 뒤 이 페이지로 넘어와도 그리드가 최신 상태로 보이도록 다시 그린다.
    if (pageId === "memberSchedule") {
      activeScheduleMemberId = null;
      renderRequestList();
    }
    // 회원 스케줄 추가 등에서 신청 데이터가 바뀐 뒤 이 메뉴로 들어오면, 옛 신청 기준으로
    // 계산된 후보는 더 이상 맞지 않으므로 자동으로 비워서 다시 생성하도록 안내한다.
    if (pageId === "schedule3" && requestsChangedSinceGenerate3) {
      requestsChangedSinceGenerate3 = false;
      if (candidates.length > 0 || schedule3Result.candidateA) {
        candidates = [];
        schedule3Result = { candidateA: null };
        Object.keys(candidateHistory).forEach(k => delete candidateHistory[k]);
        Object.keys(candidateUndoStack).forEach(k => delete candidateUndoStack[k]);
        Object.keys(candidatePools).forEach(k => delete candidatePools[k]);
        candidateAPool = [];
        renderSchedule3Result();
        saveState();
        generateHint3El.textContent = "신청 시간이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
      }
    }
    saveState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  navItems.forEach(btn => {
    btn.addEventListener("click", () => goToPage(btn.dataset.page));
  });

  // Extra safety net: flush state if the browser tab itself is being left/closed.
  window.addEventListener("beforeunload", saveState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveState();
  });

  /* ---------------- "수업 스케줄 생성3": 생성1·생성2 엔진을 그대로 재사용해 후보 3개를 한
     화면에 보여준다 (후보A=생성2 결과, 후보B/C=생성1의 후보A/B). 생성1·생성2의 알고리즘 코드는
     여기서 전혀 다시 만들지 않고, withSelectionOverride로 감싸 그대로 호출한다. ---------------- */

  // "미배정 회원"/"1회 제한 회원" 위젯을 만드는 공통 팩토리 — 두 위젯의 구조가 완전히
  // 같아 복붙을 피하려고 일반화했다.
  function createMemberSelectionWidget(opts) {
    const {
      idsKey, conflictIdsKey, conflictMessage,
      eligibleFilter, emptyMembersMessage, chipClass,
      elIds, onChanged
    } = opts;

    const msEl = document.getElementById(elIds.ms);
    const controlEl = document.getElementById(elIds.control);
    const chipRowEl = document.getElementById(elIds.chipRow);
    const dropdownEl = document.getElementById(elIds.dropdown);
    let dropdownOpen = false;

    function add(memberId) {
      if (state[idsKey].includes(memberId)) return;
      if (state[conflictIdsKey].includes(memberId)) {
        alert(conflictMessage);
        return;
      }
      state[idsKey] = state[idsKey].concat(memberId);
      changed();
    }
    function remove(memberId) {
      state[idsKey] = state[idsKey].filter(id => id !== memberId);
      changed();
    }
    function renderChips() {
      chipRowEl.innerHTML = "";
      chipRowEl.appendChild(msEl);
      const selectedMembers = state[idsKey]
        .map(id => memberById(id))
        .filter(m => m && eligibleFilter(m))
        .sort(compareOnceLimitMembers);
      if (selectedMembers.length === 0) {
        const placeholder = document.createElement("span");
        placeholder.className = "ms-placeholder";
        placeholder.textContent = "설정된 회원 없음";
        chipRowEl.appendChild(placeholder);
        return;
      }
      selectedMembers.forEach(m => {
        const chip = document.createElement("span");
        chip.className = chipClass;
        appendOnceLimitMemberLabel(chip, m);
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "×";
        removeBtn.title = "제거";
        removeBtn.addEventListener("click", () => remove(m.id));
        chip.appendChild(removeBtn);
        chipRowEl.appendChild(chip);
      });
    }
    function renderDropdown() {
      dropdownEl.innerHTML = "";
      const eligibleMembers = state.members.filter(eligibleFilter);
      const addable = eligibleMembers
        .filter(m => !state[idsKey].includes(m.id))
        .sort(compareOnceLimitMembers);
      if (eligibleMembers.length === 0) {
        const empty = document.createElement("div");
        empty.className = "ms-empty";
        empty.textContent = emptyMembersMessage;
        dropdownEl.appendChild(empty);
        return;
      }
      if (addable.length === 0) {
        const empty = document.createElement("div");
        empty.className = "ms-empty";
        empty.textContent = "모든 회원이 이미 추가되어 있습니다.";
        dropdownEl.appendChild(empty);
        return;
      }
      addable.forEach(m => {
        const item = document.createElement("div");
        item.className = "ms-option";
        item.setAttribute("role", "option");
        appendOnceLimitMemberLabel(item, m);
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          add(m.id);
        });
        dropdownEl.appendChild(item);
      });
    }
    function open() {
      if (!state.members.some(eligibleFilter)) return;
      dropdownOpen = true;
      msEl.classList.add("open");
      controlEl.setAttribute("aria-expanded", "true");
    }
    function close() {
      dropdownOpen = false;
      msEl.classList.remove("open");
      controlEl.setAttribute("aria-expanded", "false");
    }
    function changed() {
      onChanged();
      saveState();
      renderChips();
      renderDropdown();
    }

    controlEl.addEventListener("click", () => { if (dropdownOpen) close(); else open(); });
    document.addEventListener("click", (e) => { if (dropdownOpen && !msEl.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dropdownOpen) close(); });

    return {
      renderAll() {
        state[idsKey] = state[idsKey].filter(id => { const m = memberById(id); return m && eligibleFilter(m); });
        renderChips();
        renderDropdown();
      }
    };
  }

  // 이 설정은 후보 생성 결과에 바로 영향을 주므로, 이미 생성된 결과가 있으면 즉시 비운다
  // (onOnceLimit2Changed/onExcluded2Changed와 동일한 패턴).
  function onSchedule3SelectionChanged() {
    if (candidates.length > 0 || schedule3Result.candidateA) {
      candidates = [];
      schedule3Result = { candidateA: null };
      Object.keys(candidateHistory).forEach(k => delete candidateHistory[k]);
      Object.keys(candidateUndoStack).forEach(k => delete candidateUndoStack[k]);
      Object.keys(candidatePools).forEach(k => delete candidatePools[k]);
      candidateAPool = [];
      renderSchedule3Result();
      generateHint3El.textContent = "회원 선택이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    } else {
      requestsChangedSinceGenerate3 = true;
    }
  }

  const onceLimit3Widget = createMemberSelectionWidget({
    idsKey: "onceLimitedMemberIds3",
    conflictIdsKey: "excludedMemberIds3",
    conflictMessage: "미배정 회원에 추가되어 있는 회원입니다.\n미배정 회원에서 삭제 후 다시 추가해 주세요.",
    eligibleFilter: isOnceLimitEligible,
    emptyMembersMessage: "등록 회원이 없습니다. (상담 회원은 이미 항상 1회로 제한됩니다)",
    chipClass: "chip",
    elIds: { ms: "onceLimitMs3", control: "onceLimitControl3", chipRow: "onceLimitChipRow3", dropdown: "onceLimitDropdown3" },
    onChanged: onSchedule3SelectionChanged
  });

  const excluded3Widget = createMemberSelectionWidget({
    idsKey: "excludedMemberIds3",
    conflictIdsKey: "onceLimitedMemberIds3",
    conflictMessage: "1회 제한 회원에 추가되어 있는 회원입니다.\n1회 제한 회원에서 삭제 후 다시 추가해 주세요.",
    eligibleFilter: () => true,
    emptyMembersMessage: "등록된 회원이 없습니다.",
    chipClass: "chip chip-excluded",
    elIds: { ms: "excludedMs3", control: "excludedControl3", chipRow: "excludedChipRow3", dropdown: "excludedDropdown3" },
    onChanged: onSchedule3SelectionChanged
  });

  // 생성1(그리디, generateCandidatesAsync)과 생성2(체인 DP, generateSchedule2Async)를 이 페이지의
  // "미배정 회원"/"1회 제한 회원" 목록으로 그대로 호출한다 — 두 함수의 본문은 한 줄도 건드리지
  // 않는다. withSelectionOverride는 동기 호출만 감싸는 게 원칙이지만, 이 두 함수는 내부에
  // await(yieldToUI)가 있어 오버라이드가 그 사이에도 켜져 있다 — 그동안 다른 생성 버튼이 눌리면
  // 서로 다른 페이지의 선택 목록이 뒤섞일 수 있는데, 이건 generationInProgress 가드(세 생성
  // 버튼이 공유)로 원천 차단한다.
  // genA/genBC: 후보A 버튼·후보B·C 버튼이 각각 자신의 엔진만 켜서 호출한다(둘 다 켤 일은 없다).
  // 꺼진 쪽은 이 함수가 관여하지 않고 호출부가 이전 결과를 그대로 유지한다.
  async function generateSchedule3Async(onProgress, { genA = true, genBC = true } = {}) {
    const excludedIds3 = state.excludedMemberIds3;
    const onceLimitIds3 = state.onceLimitedMemberIds3;
    let v1Built = null;
    let v2Result = null;
    if (genBC) {
      const bcWeight = genA ? 0.5 : 1;
      v1Built = await withSelectionOverride(excludedIds3, onceLimitIds3, () =>
        generateCandidatesAsync(progress => onProgress(progress * bcWeight))
      );
    }
    if (genA) {
      const aStart = genBC ? 0.5 : 0;
      const aWeight = genBC ? 0.5 : 1;
      v2Result = await withSelectionOverride(excludedIds3, onceLimitIds3, () =>
        generateSchedule2Async(progress => onProgress(aStart + progress * aWeight))
      );
    }
    onProgress(1);
    return {
      candidateB: v1Built ? (v1Built.built[0] || null) : null, // 생성1의 후보A(전략 0, 인원 최대)
      candidateC: v1Built ? (v1Built.built[1] || null) : null, // 생성1의 후보B(전략 1, 수업 횟수 최대)
      poolsBC: v1Built ? v1Built.pools : null, // strategyIndex -> 배치 페이저용 동점 풀
      candidateA: v2Result ? v2Result.result : null,
      candidateAPool: v2Result ? v2Result.pool : null,
      genA, genBC
    };
  }

  const generateHint3El = document.getElementById("generateHint3");
  const candidates3El = document.getElementById("candidates3");
  const generateBtnA3El = document.getElementById("generateBtnA3");
  const generateBtnA3LabelEl = document.getElementById("generateBtnA3Label");
  const generateBtnA3CancelEl = document.getElementById("generateBtnA3Cancel");
  const generateProgressWrapA3El = document.getElementById("generateProgressWrapA3");
  const generateProgressFillA3El = document.getElementById("generateProgressFillA3");
  const generateProgressTextA3El = document.getElementById("generateProgressTextA3");
  const generateBtnBC3El = document.getElementById("generateBtnBC3");
  const generateBtnBC3LabelEl = document.getElementById("generateBtnBC3Label");
  const generateBtnBC3CancelEl = document.getElementById("generateBtnBC3Cancel");
  const generateProgressWrapBC3El = document.getElementById("generateProgressWrapBC3");
  const generateProgressFillBC3El = document.getElementById("generateProgressFillBC3");
  const generateProgressTextBC3El = document.getElementById("generateProgressTextBC3");

  // 후보A(체인 DP)·후보B/C(그리디, candidates 배열) 카드를 그린다. 후보B/C는 strategyIndex(0/1)를
  // 넘겨받으면 옛 "수업 스케줄 생성1" 페이지에 있던 "↩ 이전 후보"/"↻ 다음 후보" 버튼을 그대로 붙인다
  // (regenerateCandidate/restorePreviousCandidate/candidateHistory/candidateUndoStack 로직은 무변경 —
  // 이 카드가 candidates[strategyIndex]를 직접 읽고 쓰기 때문에 그대로 재사용할 수 있다).
  function renderSchedule3Result() {
    candidates3El.innerHTML = "";
    const gridRange = businessHoursGridRange();

    function buildCard(title, desc, result, blocks, travelBlocks, idleMinutes, strategyIndex, pool) {
      const card = document.createElement("div");
      card.className = "candidate-card";

      const head = document.createElement("div");
      head.className = "candidate-card-head";
      const titleEl = document.createElement("h3");
      titleEl.className = "candidate-title";
      titleEl.textContent = title;
      head.appendChild(titleEl);

      {
        const actions = document.createElement("div");
        actions.className = "candidate-card-actions";

        // 텍스트 라벨 버튼 4개를 한 줄에 나열하면 카드가 좁을 때 제목이 두 줄로 밀려버려서,
        // 아이콘 전용 버튼(툴팁으로 설명 대체)으로 압축하고 그룹 사이에 구분선을 둔다:
        // [편집 취소] | [이전 후보][다음 후보] | [저장]
        function makeIconBtn(iconSvg, label, tooltip) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn btn-ghost icon-btn regen-candidate-btn";
          b.setAttribute("aria-label", label);
          b.title = tooltip;
          b.innerHTML = iconSvg;
          return b;
        }
        function addDivider() {
          const d = document.createElement("span");
          d.className = "action-divider";
          actions.appendChild(d);
        }

        const ICON_UNDO_MANUAL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
        // 드래그 이동·자리 맞바꾸기·인원 교체·확정 등 "방금 한 조정 하나"만 되돌린다 — 아래
        // "이전 후보"(재생성 되돌리기)와는 별개이고, 후보A에도(strategyIndex가 없어 재생성
        // 되돌리기 버튼이 없는) 똑같이 필요하므로 strategyIndex 유무와 무관하게 항상 넣는다.
        const undoManualBtn = makeIconBtn(ICON_UNDO_MANUAL, "편집 취소", "방금 드래그로 옮기거나 맞바꾸거나 교체·확정한 것을 취소합니다.");
        undoManualBtn.disabled = !hasManualUndo(result);
        undoManualBtn.addEventListener("click", () => {
          undoManualEdit(result, renderSchedule3Result);
        });
        actions.appendChild(undoManualBtn);

        if (strategyIndex != null) {
          addDivider();

          const undoStackForThis = candidateUndoStack[strategyIndex] || [];
          const ICON_PREV_CANDIDATE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
          const undoBtn = makeIconBtn(ICON_PREV_CANDIDATE, "이전 후보", "재생성하기 전의 후보로 되돌아갑니다.");
          undoBtn.disabled = undoStackForThis.length === 0;
          undoBtn.addEventListener("click", () => {
            restorePreviousCandidate(strategyIndex);
          });
          actions.appendChild(undoBtn);

          const ICON_REGEN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.65 5.64L1 10m22 4-4.65 4.36A9 9 0 0 1 3.51 15"/></svg>';
          const regenBtn = makeIconBtn(ICON_REGEN, "다음 후보", "이 후보만 같은 전략 안에서 다시 계산합니다.");
          const regenBtnIconHtml = regenBtn.innerHTML;
          regenBtn.disabled = !hasRegenerableEligible(strategyIndex);
          regenBtn.addEventListener("click", async () => {
            regenBtn.disabled = true;
            undoBtn.disabled = true;
            regenBtn.classList.add("icon-btn-loading");
            try {
              // 생성3 자신의 미배정/1회 제한 회원 설정(excludedMemberIds3/onceLimitedMemberIds3)이
              // 적용되도록 반드시 withSelectionOverride로 감싼다 — 그냥 호출하면 currentExcludedIds()가
              // (더 이상 UI가 없어 항상 비어있는) 옛 생성1 설정으로 폴백해버린다.
              await withSelectionOverride(state.excludedMemberIds3, state.onceLimitedMemberIds3, () =>
                regenerateCandidate(strategyIndex, progress => {
                  regenBtn.textContent = Math.round(progress * 100) + "%";
                })
              );
            } finally {
              regenBtn.classList.remove("icon-btn-loading");
              regenBtn.innerHTML = regenBtnIconHtml;
              regenBtn.disabled = !hasRegenerableEligible(strategyIndex);
              undoBtn.disabled = (candidateUndoStack[strategyIndex] || []).length === 0;
            }
          });
          actions.appendChild(regenBtn);
        }

        addDivider();

        const ICON_SAVE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
        const saveImageBtn = makeIconBtn(ICON_SAVE, "이미지로 저장", "이 후보 카드를 이미지로 저장합니다.");
        saveImageBtn.addEventListener("click", () => {
          saveCandidateCardAsImage(card, title);
        });
        actions.appendChild(saveImageBtn);

        head.appendChild(actions);
      }

      card.appendChild(head);

      const descEl = document.createElement("p");
      descEl.className = "candidate-desc";
      descEl.textContent = desc;
      card.appendChild(descEl);

      // "배치 페이저": 미배정/수업 건수/이동 횟수(후보A는 이동 시간·빈 시간까지) 지표가 완전히
      // 동점인 다른 배치가 있으면(pool.length > 1), 재계산 없이 그 풀 안에서 넘나들 수 있게
      // 한다. pool.indexOf(result)가 -1이면(드래그 등 수동 편집으로 지금 화면이 풀의 어떤
      // 항목과도 더 이상 같은 배치가 아니거나, "이전 후보"로 되돌아간 경우) 페이저를 그리지
      // 않는다 — 별도 무효화 로직 없이 참조 동일성만으로 자연스럽게 처리된다.
      if (pool && pool.length > 1) {
        const poolIdx = pool.indexOf(result);
        if (poolIdx !== -1) {
          const pager = document.createElement("div");
          pager.className = "candidate-pool-pager";

          function selectPoolVariant(newIdx) {
            if (strategyIndex != null) candidates[strategyIndex] = pool[newIdx];
            else schedule3Result.candidateA = pool[newIdx];
            saveState();
            renderSchedule3Result();
          }

          const prevBtn = document.createElement("button");
          prevBtn.type = "button";
          prevBtn.className = "btn btn-ghost icon-btn pool-pager-btn";
          prevBtn.setAttribute("aria-label", "이전 배치");
          prevBtn.title = "같은 조건의 다른 배치를 봅니다.";
          prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
          prevBtn.disabled = poolIdx === 0;
          prevBtn.addEventListener("click", () => selectPoolVariant(poolIdx - 1));

          const label = document.createElement("span");
          label.className = "pool-pager-label";
          label.textContent = "배치 " + (poolIdx + 1) + "/" + pool.length;

          const nextBtn = document.createElement("button");
          nextBtn.type = "button";
          nextBtn.className = "btn btn-ghost icon-btn pool-pager-btn";
          nextBtn.setAttribute("aria-label", "다음 배치");
          nextBtn.title = "같은 조건의 다른 배치를 봅니다.";
          nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
          nextBtn.disabled = poolIdx === pool.length - 1;
          nextBtn.addEventListener("click", () => selectPoolVariant(poolIdx + 1));

          pager.appendChild(prevBtn);
          pager.appendChild(label);
          pager.appendChild(nextBtn);
          card.appendChild(pager);
        }
      }

      const stats = document.createElement("div");
      stats.className = "candidate-stats";
      const pill1 = document.createElement("span");
      pill1.className = "stat-pill";
      if (result.unassignedMembers.length > 0) {
        pill1.classList.add("stat-pill-danger");
        pill1.textContent = "미배정 " + result.unassignedMembers.length + "명";
      } else {
        pill1.append("미배정 ");
        const none = document.createElement("span");
        none.className = "stat-pill-muted";
        none.textContent = "없음";
        pill1.appendChild(none);
      }
      stats.appendChild(pill1);
      const pill2 = document.createElement("span");
      pill2.className = "stat-pill";
      pill2.textContent = "수업 " + result.assigned.length + "건";
      stats.appendChild(pill2);
      const pill3 = document.createElement("span");
      pill3.className = "stat-pill";
      pill3.textContent = "이동 " + totalTravelCount(result.assigned) + "번";
      stats.appendChild(pill3);
      if (idleMinutes != null) {
        const pill4 = document.createElement("span");
        if (idleMinutes > 0) {
          pill4.className = "stat-pill stat-pill-idle";
          pill4.textContent = "빈 시간 " + formatMinutesLabel(idleMinutes);
        } else {
          pill4.className = "stat-pill";
          pill4.append("빈 시간 ");
          const none = document.createElement("span");
          none.className = "stat-pill-muted";
          none.textContent = "없음";
          pill4.appendChild(none);
        }
        stats.appendChild(pill4);
      }
      card.appendChild(stats);

      const gridWrap = document.createElement("div");
      gridWrap.className = "grid-scroll";
      const gridEl = document.createElement("div");
      gridEl.className = "cal-grid";
      gridWrap.appendChild(gridEl);
      card.appendChild(gridWrap);

      renderGrid(gridEl, availableCells, {
        blocks,
        travelBlocks,
        rangeStartSlot: gridRange.rangeStartSlot,
        rangeEndSlot: gridRange.rangeEndSlot
      });

      if (result.unassignedMembers.length > 0) {
        const box = document.createElement("div");
        box.className = "unassigned-box unassigned-box-danger";
        box.innerHTML = "<b>미배정 회원 (" + result.unassignedMembers.length + "명)</b> · " +
          result.unassignedMembers.map(m => m.name).join(", ");
        card.appendChild(box);
      }
      // 회원별 배정 세션을 모아 정확히 2회 배정된 회원의 지점(세션마다 다를 수 있어 중복 제거
      // 후 "(첫 글자)"를 이어붙임)과 이름을 보여준다. candidateA(체인 DP)·B/C(그리디) 모두
      // result.assigned에 {memberId, locationId} 형태의 세션을 담고 있어 별도 계산 없이 여기서
      // 바로 집계할 수 있다.
      const sessionsByMember = new Map();
      result.assigned.forEach(r => {
        if (!sessionsByMember.has(r.memberId)) sessionsByMember.set(r.memberId, []);
        sessionsByMember.get(r.memberId).push(r);
      });
      const doubleAssignedMembers = [];
      sessionsByMember.forEach((sessions, memberId) => {
        if (sessions.length !== 2) return;
        const member = memberById(memberId);
        if (!member) return;
        const locNames = [...new Set(sessions.map(s => {
          const loc = locationById(s.locationId);
          return loc ? loc.name : null;
        }).filter(Boolean))];
        const locLabel = locNames.map(name => "(" + name.charAt(0) + ")").join("");
        doubleAssignedMembers.push({ member, locLabel });
      });
      doubleAssignedMembers.sort((a, b) => a.member.name.localeCompare(b.member.name, "ko"));
      if (doubleAssignedMembers.length > 0) {
        const box = document.createElement("div");
        box.className = "unassigned-box double-assigned-box";
        box.innerHTML = "<b>2회 배정 회원 (" + doubleAssignedMembers.length + "명)</b> · " +
          doubleAssignedMembers.map(d => d.locLabel + " " + d.member.name).join(", ");
        card.appendChild(box);
      }

      candidates3El.appendChild(card);
    }

    // 아직 생성하지 않은 후보도 타이틀·설명만 담은 카드로 미리 보여준다 — 실제 배정 결과가
    // 없으니 통계 pill·달력 그리드는 그리지 않는다.
    function buildPlaceholderCard(title, desc) {
      const card = document.createElement("div");
      card.className = "candidate-card candidate-card-placeholder";

      const titleEl = document.createElement("h3");
      titleEl.className = "candidate-title";
      titleEl.textContent = title;
      card.appendChild(titleEl);

      const descEl = document.createElement("p");
      descEl.className = "candidate-desc";
      descEl.textContent = desc;
      card.appendChild(descEl);

      const hint = document.createElement("p");
      hint.className = "candidate-card-placeholder-hint";
      hint.textContent = "아직 생성되지 않았습니다. '후보 생성하기'를 눌러주세요.";
      card.appendChild(hint);

      candidates3El.appendChild(card);
    }

    if (schedule3Result.candidateA) {
      const a = schedule3Result.candidateA;
      buildCard(
        "후보A - 인원 최대 (빈 시간 허용)", "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.", a,
        schedule2ToBlocks(a.assigned, { result: a, onDone: renderSchedule3Result }),
        schedule2ToTravelBlocks(a).concat(schedule2ToIdleBlocks(a.assigned)),
        schedule2TotalIdleMinutes(a.assigned),
        null,
        candidateAPool
      );
    } else {
      buildPlaceholderCard("후보A - 인원 최대 (빈 시간 허용)", "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.");
    }
    const b = candidates[0];
    if (b) {
      buildCard(
        "후보B - 인원 최대 (빈 시간 최소화)", "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.", b,
        candidateToBlocks(b, renderSchedule3Result),
        candidateToTravelBlocks(b),
        schedule2TotalIdleMinutes(b.assigned),
        0,
        candidatePools[0]
      );
    } else {
      buildPlaceholderCard("후보B - 인원 최대 (빈 시간 최소화)", "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.");
    }
    const c = candidates[1];
    if (c) {
      buildCard(
        "후보C - 수업 횟수 최대", "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.", c,
        candidateToBlocks(c, renderSchedule3Result),
        candidateToTravelBlocks(c),
        schedule2TotalIdleMinutes(c.assigned),
        1,
        candidatePools[1]
      );
    } else {
      buildPlaceholderCard("후보C - 수업 횟수 최대", "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.");
    }
  }

  // 후보A와 후보B·C는 소요 시간 차이가 커서(A는 체인 DP+담금질로 수 분, B·C는 그리디
  // 다중 시도로 INITIAL_SEARCH_ATTEMPTS 증가 후 수 분) 버튼을 따로 둔다 — A만 빠르게 다시
  // 보고 싶을 때 B·C의 느린 탐색까지 함께 기다리지 않아도 된다. 다만 두 버튼이 동시에 도는
  // 것까지는 허용하지 않는다(withSelectionOverride가 재진입을 지원하지 않으므로) —
  // generationInProgress 가드를 그대로 공유해 한쪽이 도는 동안 다른 쪽은 토스트로 안내한다.
  async function runGenerate3({ genA, genBC, idleLabel, btnEl, labelEl, cancelEl, progressWrapEl, progressFillEl, progressTextEl }) {
    if (generationInProgress) {
      showToast("다른 후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.", "info");
      return;
    }
    if (state.locations.length === 0) {
      generateHint3El.textContent = "먼저 설정 페이지에서 지점을 등록해주세요.";
      return;
    }
    if (availableCells.size === 0) {
      generateHint3El.textContent = "먼저 설정 페이지에서 근무 가능 시간을 설정해주세요.";
      return;
    }
    if (state.requests.length === 0) {
      generateHint3El.textContent = "먼저 회원 스케줄 추가 페이지에서 가능 시간을 등록해주세요.";
      return;
    }
    generateHint3El.textContent = "";
    generationInProgress = true;
    generationCancelRequested = false;

    // 후보A(체인 DP)는 생성2와 마찬가지로 다듬기 단계가 시간 예산제라 매번 미세하게 결과가
    // 달라질 수 있으므로, 데이터가 그대로 재생성된 경우 새 결과가 기존보다 못하면 이전 결과를
    // 지킨다. 후보B/C(그리디)는 생성1과 마찬가지로 항상 새 결과로 덮어쓴다.
    const prevCandidateA = schedule3Result.candidateA;

    btnEl.disabled = true;
    btnEl.classList.add("loading");
    labelEl.textContent = "후보 생성 중...";
    progressWrapEl.style.display = "";
    progressFillEl.style.width = "0%";
    progressTextEl.textContent = "0%";
    progressWrapEl.setAttribute("aria-valuenow", "0");
    cancelEl.style.display = "";
    cancelEl.disabled = false;
    cancelEl.textContent = "생성 취소";

    await acquireWakeLock();
    try {
      const result = await generateSchedule3Async(progress => {
        const pct = Math.round(progress * 100);
        progressFillEl.style.width = pct + "%";
        progressTextEl.textContent = pct + "%";
        progressWrapEl.setAttribute("aria-valuenow", String(pct));
      }, { genA, genBC });
      requestsChangedSinceGenerate3 = false;
      const usedNewCandidateA = result.genA && (!prevCandidateA || isSchedule2ResultBetter(result.candidateA, prevCandidateA));
      const candidateA = usedNewCandidateA ? result.candidateA : prevCandidateA;
      // 배치 페이저용 풀: 새 후보A가 실제로 채택됐을 때만 새 풀로 교체한다 — 이전 결과를
      // 그대로 지킨 경우엔 그 후보에 맞는 풀(candidateAPool)이 이미 들어있으므로 건드리지 않는다.
      if (usedNewCandidateA) candidateAPool = result.candidateAPool || [];
      if (result.genBC) {
        candidates = [result.candidateB, result.candidateC].filter(Boolean);
        Object.keys(candidateHistory).forEach(k => delete candidateHistory[k]);
        Object.keys(candidateUndoStack).forEach(k => delete candidateUndoStack[k]);
        Object.keys(candidatePools).forEach(k => delete candidatePools[k]);
        candidates.forEach((cand, idx) => {
          candidateHistory[idx] = new Set([candidateSignature(cand)]);
          if (result.poolsBC && result.poolsBC[idx]) candidatePools[idx] = result.poolsBC[idx];
        });
      }
      schedule3Result = { candidateA };
      renderSchedule3Result();
      saveState();
      showToast("후보가 생성되었습니다", "success");
    } catch (err) {
      if (err instanceof GenerationCancelledError) {
        showToast("후보 생성을 취소했습니다", "info");
      } else {
        console.error(err);
        generateHint3El.textContent = "후보 생성 중 오류가 발생했습니다. 다시 시도해주세요.";
        showToast("후보 생성에 실패했습니다", "danger");
      }
    } finally {
      btnEl.disabled = false;
      btnEl.classList.remove("loading");
      labelEl.textContent = idleLabel;
      progressWrapEl.style.display = "none";
      cancelEl.style.display = "none";
      generationInProgress = false;
      generationCancelRequested = false;
      releaseWakeLock();
    }
  }

  generateBtnA3El.addEventListener("click", () => runGenerate3({
    genA: true, genBC: false, idleLabel: "후보A 생성하기",
    btnEl: generateBtnA3El, labelEl: generateBtnA3LabelEl, cancelEl: generateBtnA3CancelEl,
    progressWrapEl: generateProgressWrapA3El, progressFillEl: generateProgressFillA3El, progressTextEl: generateProgressTextA3El
  }));
  generateBtnA3CancelEl.addEventListener("click", () => {
    generationCancelRequested = true;
    generateBtnA3CancelEl.disabled = true;
    generateBtnA3CancelEl.textContent = "취소하는 중...";
  });

  generateBtnBC3El.addEventListener("click", () => runGenerate3({
    genA: false, genBC: true, idleLabel: "후보B·C 생성하기",
    btnEl: generateBtnBC3El, labelEl: generateBtnBC3LabelEl, cancelEl: generateBtnBC3CancelEl,
    progressWrapEl: generateProgressWrapBC3El, progressFillEl: generateProgressFillBC3El, progressTextEl: generateProgressTextBC3El
  }));
  generateBtnBC3CancelEl.addEventListener("click", () => {
    generationCancelRequested = true;
    generateBtnBC3CancelEl.disabled = true;
    generateBtnBC3CancelEl.textContent = "취소하는 중...";
  });

  const candidateRulesBlock3El = document.getElementById("candidateRulesBlock3");
  const candidateRulesToggle3El = document.getElementById("candidateRulesToggle3");
  candidateRulesToggle3El.addEventListener("click", () => {
    const collapsed = candidateRulesBlock3El.classList.toggle("collapsed");
    candidateRulesToggle3El.setAttribute("aria-expanded", String(!collapsed));
  });

  /* ---------------- 데이터 백업 · 복원 ---------------- */
  // localStorage는 브라우저·기기별로 분리돼 있어 자동으로 공유되지 않는다. 다른 기기(예: 외부에서
  // 쓰는 모바일)에서도 같은 데이터를 쓰고 싶을 때, 여기서 만든 백업 코드를 복사해 그 기기에서
  // 붙여넣어 복원한다. 코드 자체는 PIN으로 암호화되어 있어(AES-GCM, PIN 기반 PBKDF2 키 유도),
  // PIN을 모르면 코드 텍스트만으로는 내용을 볼 수 없다 — 메모 앱 등에 코드가 남아 있어도,
  // 또는 공용 기기에서 붙여넣기 화면을 보게 되어도 실제 회원 정보가 그대로 노출되지 않는다.
  const BACKUP_PBKDF2_ITERATIONS = 100000;

  async function deriveBackupKey(pin, salt, usage) {
    const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: BACKUP_PBKDF2_ITERATIONS, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      [usage]
    );
  }

  function backupBytesToBase64(bytes) {
    let binary = "";
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function backupBase64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function encryptBackupText(plainText, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveBackupKey(pin, salt, "encrypt");
    const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText));
    const combined = new Uint8Array(salt.length + iv.length + cipherBuf.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(cipherBuf), salt.length + iv.length);
    return backupBytesToBase64(combined);
  }

  // salt(16B) + iv(12B)가 앞에 오지 않는 텍스트(형식이 다르거나 손상된 코드)는 여기서 걸러진다.
  async function decryptBackupText(base64Text, pin) {
    const combined = backupBase64ToBytes(base64Text.trim());
    if (combined.length <= 28) throw new Error("invalid backup code");
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const cipherBytes = combined.slice(28);
    const key = await deriveBackupKey(pin, salt, "decrypt");
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
    return new TextDecoder().decode(plainBuf);
  }

  const backupExportBtnEl = document.getElementById("backupExportBtn");
  const backupExportResultEl = document.getElementById("backupExportResult");
  const backupExportTextareaEl = document.getElementById("backupExportTextarea");
  const backupExportCopyBtnEl = document.getElementById("backupExportCopyBtn");

  backupExportBtnEl.addEventListener("click", async () => {
    const pin = window.prompt("백업 코드를 암호화할 PIN을 입력하세요. (복원할 때 동일한 PIN이 필요합니다)");
    if (!pin) return;
    const pinConfirm = window.prompt("PIN을 한 번 더 입력해주세요.");
    if (pinConfirm !== pin) {
      alert("입력한 PIN이 서로 달라 백업 코드를 만들지 못했습니다. 다시 시도해주세요.");
      return;
    }
    saveState(); // 화면에 아직 반영 중인 최신 상태까지 포함되도록 내보내기 직전에 저장
    try {
      const backupCode = await encryptBackupText(localStorage.getItem(STORAGE_KEY) || "{}", pin);
      backupExportTextareaEl.value = backupCode;
      backupExportResultEl.style.display = "";
      showToast("백업 코드를 만들었습니다. PIN도 함께 기억해주세요.", "success");
    } catch (e) {
      console.warn("backup export failed", e);
      alert("백업 코드를 만들지 못했습니다.");
    }
  });

  backupExportCopyBtnEl.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(backupExportTextareaEl.value);
      showToast("백업 코드를 복사했습니다", "success");
    } catch (e) {
      backupExportTextareaEl.select();
      showToast("복사에 실패했습니다. 직접 선택해 복사해주세요.", "error");
    }
  });

  const backupImportOverlayEl = document.getElementById("backupImportOverlay");
  const backupImportOpenBtnEl = document.getElementById("backupImportOpenBtn");
  const backupImportCloseBtnEl = document.getElementById("backupImportCloseBtn");
  const backupImportCancelBtnEl = document.getElementById("backupImportCancelBtn");
  const backupImportApplyBtnEl = document.getElementById("backupImportApplyBtn");
  const backupImportTextareaEl = document.getElementById("backupImportTextarea");
  const backupImportPinInputEl = document.getElementById("backupImportPinInput");
  const backupImportHintEl = document.getElementById("backupImportHint");

  function openBackupImportModal() {
    backupImportTextareaEl.value = "";
    backupImportPinInputEl.value = "";
    backupImportHintEl.textContent = "";
    backupImportOverlayEl.classList.add("open");
    setTimeout(() => backupImportTextareaEl.focus(), 0);
  }
  function closeBackupImportModal() {
    backupImportOverlayEl.classList.remove("open");
  }
  backupImportOpenBtnEl.addEventListener("click", openBackupImportModal);
  backupImportCloseBtnEl.addEventListener("click", closeBackupImportModal);
  backupImportCancelBtnEl.addEventListener("click", closeBackupImportModal);
  backupImportOverlayEl.addEventListener("click", (e) => {
    if (e.target === backupImportOverlayEl) closeBackupImportModal();
  });

  backupImportApplyBtnEl.addEventListener("click", async () => {
    const code = backupImportTextareaEl.value.trim();
    const pin = backupImportPinInputEl.value;
    if (!code || !pin) {
      backupImportHintEl.textContent = "백업 코드와 PIN을 모두 입력해주세요.";
      return;
    }
    let plainText;
    try {
      plainText = await decryptBackupText(code, pin);
      JSON.parse(plainText); // 형식 검증(손상되거나 PIN이 맞아도 다른 형식의 데이터면 여기서 걸러짐)
    } catch (e) {
      backupImportHintEl.textContent = "복원에 실패했습니다. 백업 코드와 PIN을 다시 확인해주세요.";
      return;
    }
    if (!confirm("복원하면 이 기기에 현재 저장된 데이터를 덮어씁니다. 계속할까요?")) return;
    suppressAutosave = true;
    localStorage.setItem(STORAGE_KEY, plainText);
    location.reload();
  });

  /* ---------------- Init ---------------- */
  function init() {
    loadState();
    renderLocationList();
    renderTravelMatrix();
    populateMemberLocationSelect();
    renderMemberTable();
    renderAvailabilityList();
    renderRequestList();
    renderSchedule3Result();
    goToPage(currentPage);
  }

  init();
})();
