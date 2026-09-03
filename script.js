// 이 파일은 자동 생성됩니다 — src/ 아래 파일을 수정한 뒤 `npm run build`를 실행하세요.
// (`npm install`이 pre-commit 훅을 설치해두면, git commit 시 이 훅이 자동으로 다시
// 빌드합니다 — scripts/install-git-hooks.js, README 참고. 훅이 없다면 CI가 이 파일이
// src/와 어긋난 채 커밋되는 것을 잡아준다.) 이 파일을 직접 고치면 다음 빌드에서 조용히
// 덮어써집니다.
(() => {
  // src/constants.js
  var DAYS = ["월", "화", "수", "목", "금", "토"];
  var START_MIN = 12 * 60;
  var END_MIN = 24 * 60;
  var SLOT_MIN = 10;
  var SLOT_COUNT = (END_MIN - START_MIN) / SLOT_MIN;
  var SESSION_DURATION_MIN = 60;
  var CONSULT_DURATION_MIN = 30;
  var BREAK_MIN = 0;
  var ALLOWED_GAP_MIN = 10;
  var SOLO_TRAVEL_LOCATION_NAMES = ["상암점", "여의도점", "마포점"];
  var BLOCK_COLOR = "#4f46e5";
  var MEMBER_COLORS = [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
    "#4a3aa7",
    "#e34948"
  ];
  var MEMBER_COLOR_SHADE_STEPS = [0, 0.18, 0.33, 0.46, 0.58];
  function shadeColor(hex, darkenRatio) {
    if (!darkenRatio) return hex;
    const num = parseInt(hex.slice(1), 16);
    const r = num >> 16 & 255, g = num >> 8 & 255, b = num & 255;
    const mix = (c) => Math.round(c * (1 - darkenRatio));
    return "#" + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  var CATEGORY_OPTIONS = ["상담", "등록"];
  var STRATEGY_COUNT = 2;
  var MAX_SESSIONS_PER_MEMBER = 2;
  var MAX_TRAVELS_PER_DAY = 2;
  var FORCE_ONCE_WEIGHT = 1e6;
  var SESSION_DURATION_MIN_2 = 60;
  var CONSULT_DURATION_MIN_2 = 30;
  var STORAGE_KEY = "pt_schedule_state_v3";
  var OLD_STORAGE_KEY = "pt_schedule_state_v2";
  var OLD_SLOT_MIN = 30;
  var SLOT_SCALE = OLD_SLOT_MIN / SLOT_MIN;
  var DEFAULT_LOCATION_NAMES = ["여의도점", "상암점", "마포점"];
  var DEFAULT_TRAVEL_MIN = 30;
  var DEFAULT_TRAVEL_PAIRS = [
    ["여의도점", "상암점", 60],
    ["여의도점", "마포점", 30],
    ["상암점", "마포점", 30]
  ];
  function defaultTravelMinutesFor(nameA, nameB) {
    const pair = DEFAULT_TRAVEL_PAIRS.find(
      ([a, b]) => a === nameA && b === nameB || a === nameB && b === nameA
    );
    return pair ? pair[2] : DEFAULT_TRAVEL_MIN;
  }
  var DEFAULT_BUSINESS_DAY_INDICES = [0, 1, 2, 3, 4];
  var DEFAULT_BUSINESS_START_MIN = 14 * 60;
  var DEFAULT_BUSINESS_END_MIN = 23 * 60 + 30;
  var DEFAULT_BUSINESS_START_SLOT = (DEFAULT_BUSINESS_START_MIN - START_MIN) / SLOT_MIN;
  var DEFAULT_BUSINESS_END_SLOT = (DEFAULT_BUSINESS_END_MIN - START_MIN) / SLOT_MIN;

  // src/utils.js
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
  function cellKey(day, slot) {
    return day + "-" + slot;
  }
  function durationToSlots(min) {
    return min / SLOT_MIN;
  }
  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9);
  }
  var toastContainerEl = null;
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
      toast.addEventListener("transitionend", () => toast.remove(), {
        once: true
      });
    }, 2200);
  }

  // src/selectionOverride.js
  var selectionOverride = null;
  async function withSelectionOverride(excludedIds, onceLimitIds, asyncFn) {
    const prev = selectionOverride;
    selectionOverride = {
      excludedIds: excludedIds.slice(),
      onceLimitIds: onceLimitIds.slice()
    };
    try {
      return await asyncFn();
    } finally {
      selectionOverride = prev;
    }
  }
  function currentExcludedIds() {
    return selectionOverride ? selectionOverride.excludedIds : state.excludedMemberIds3;
  }
  function currentOnceLimitIds() {
    return selectionOverride ? selectionOverride.onceLimitIds : state.onceLimitedMemberIds3;
  }
  function currentExcludedIds2() {
    return selectionOverride ? selectionOverride.excludedIds : state.excludedMemberIds3;
  }
  function currentOnceLimitIds2() {
    return selectionOverride ? selectionOverride.onceLimitIds : state.onceLimitedMemberIds3;
  }

  // src/domain.js
  function memberById(id) {
    return state.members.find((m) => m.id === id);
  }
  function sessionDurationFor(member) {
    if (!member) return CONSULT_DURATION_MIN;
    return (member.category || "상담") === "상담" ? CONSULT_DURATION_MIN : SESSION_DURATION_MIN;
  }
  function maxSessionsFor(member) {
    if (!member) return 1;
    if (currentOnceLimitIds().includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }
  function isOnceLimitEligible(member) {
    return !!member && (member.category || "상담") !== "상담";
  }
  function appendOnceLimitMemberLabel(container, member) {
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
  function compareOnceLimitMembers(a, b) {
    const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
    const aIdx = locOrder.has(a.locationIds[0]) ? locOrder.get(a.locationIds[0]) : Infinity;
    const bIdx = locOrder.has(b.locationIds[0]) ? locOrder.get(b.locationIds[0]) : Infinity;
    return aIdx - bIdx || a.name.localeCompare(b.name, "ko");
  }
  function locationById(id) {
    return state.locations.find((l) => l.id === id);
  }
  function soloTravelMemberIds() {
    const soloTravelLocationIds = state.locations.filter((l) => SOLO_TRAVEL_LOCATION_NAMES.includes(l.name)).map((l) => l.id);
    if (soloTravelLocationIds.length !== SOLO_TRAVEL_LOCATION_NAMES.length)
      return /* @__PURE__ */ new Set();
    return new Set(
      state.members.filter(
        (m) => soloTravelLocationIds.every((id) => m.locationIds.includes(id))
      ).map((m) => m.id)
    );
  }
  function memberColor(id) {
    const idx = state.members.findIndex((m) => m.id === id);
    if (idx === -1) return BLOCK_COLOR;
    const hue = MEMBER_COLORS[idx % MEMBER_COLORS.length];
    const tier = Math.floor(idx / MEMBER_COLORS.length) % MEMBER_COLOR_SHADE_STEPS.length;
    return shadeColor(hue, MEMBER_COLOR_SHADE_STEPS[tier]);
  }
  function locationColor(locId) {
    const idx = state.locations.findIndex((l) => l.id === locId);
    return idx === -1 ? null : MEMBER_COLORS[idx % MEMBER_COLORS.length];
  }
  function pairKey(idA, idB) {
    return [idA, idB].sort().join("|");
  }
  function travelMinutes(locIdA, locIdB) {
    if (!locIdA || !locIdB || locIdA === locIdB) return 0;
    const v = state.travelTimes[pairKey(locIdA, locIdB)];
    return typeof v === "number" && v >= 0 ? v : 0;
  }

  // src/state.js
  var state = {
    availableCells: [],
    // array of "day-slot" strings
    locations: [],
    // {id, name}
    travelTimes: {},
    // { "locIdA|locIdB": minutes }
    members: [],
    // {id, name, locationIds: [locId, ...]}
    requests: [],
    // {id, memberId, locationId, day, startSlot, duration}
    // "수업 스케줄 생성3" 전용 설정 (생성1·생성2 엔진을 withSelectionOverride로 재사용해 후보 3개를 한 화면에 보여줌)
    onceLimitedMemberIds3: [],
    // 스케줄 생성3에서 최대 1회만 배정되어야 하는 회원 id 목록
    excludedMemberIds3: []
    // 스케줄 생성3에서 후보 생성 시 아예 제외할 회원 id 목록
  };
  var runtime = {
    availableCells: /* @__PURE__ */ new Set(),
    // "수업 스케줄 생성3"의 후보B(전략0, 인원 최대)·후보C(전략1, 수업 횟수 최대) 저장소.
    // 옛 "수업 스케줄 생성1" 페이지가 쓰던 배열을 그대로 재사용한다 — regenerateCandidate/
    // restorePreviousCandidate/candidateHistory/candidateUndoStack이 이 배열과 strategyIndex를
    // 그대로 참조하므로, 생성1의 "재생성"·"이전 후보 다시보기" 기능을 생성3에 그대로 이식할 수 있다.
    candidates: [],
    // "수업 스케줄 생성3"의 후보A-1/A-2/A-3(체인 DP, 서로 독립적으로 탐색된 별도 카드 3장).
    // 후보B/C는 candidates 배열 참고. 배열 길이는 항상 SCHEDULE2_CARD_COUNT(3)와 같다.
    schedule3Result: { candidateAList: [null, null, null] },
    // 회원 스케줄 추가(신청 시간 추가/삭제) 등 신청 데이터가 바뀌면 true로 표시해둔다.
    // "수업 스케줄 생성" 메뉴로 들어올 때 이 값이 true면, 최신 신청과 맞지 않는 옛 후보를 자동으로 비운다.
    requestsChangedSinceGenerate3: false,
    // 세 생성 버튼 중 하나라도 계산 중이면 true — 동시에 두 계산이 겹치면 selectionOverride가
    // 서로 다른 페이지의 회원 선택 목록을 잘못 참조할 수 있어(withSelectionOverride 참고), 이 플래그로 막는다.
    generationInProgress: false,
    // 생성2/생성3의 다듬기 파이프라인(담금질 기법 등)은 수 초~수십 초가 걸릴 수 있어, 사용자가
    // "취소"를 누르면 다음 양보 지점(yieldToUI 직후)에서 즉시 멈출 수 있도록 이 플래그로 신호를
    // 보낸다. 실제 중단은 GenerationCancelledError를 던져 호출 스택을 그대로 타고 올라가
    // 각 생성 버튼 핸들러의 catch에서 잡는 방식으로 처리한다.
    generationCancelRequested: false,
    currentPage: "settings",
    // 백업 복원 직후 reload()할 때 beforeunload/visibilitychange 핸들러가 옛 메모리 상태로
    // saveState()를 한 번 더 실행해 방금 덮어쓴 localStorage를 되돌리지 않도록 막는 플래그.
    suppressAutosave: false
  };
  var GenerationCancelledError = class extends Error {
  };
  var wakeLockSentinel = null;
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
      try {
        await sentinel.release();
      } catch (err) {
      }
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && runtime.generationInProgress) {
      acquireWakeLock();
    }
  });
  var PAGE_IDS = ["settings", "schedule3", "members", "memberSchedule"];
  var OLD_PAGE_TO_NEW = {
    settings: "settings",
    requests: "schedule3",
    candidates: "schedule3",
    confirm: "schedule3",
    schedule: "schedule3",
    schedule2: "schedule3"
  };
  function saveState() {
    if (runtime.suppressAutosave) return;
    state.availableCells = Array.from(runtime.availableCells);
    state.candidates = runtime.candidates;
    state.schedule3Result = runtime.schedule3Result;
    state.currentPage = runtime.currentPage;
    state.startMinBase = START_MIN;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  var LEGACY_START_MIN = 13 * 60;
  function migrateStartMinShift(parsed) {
    const savedBase = typeof parsed.startMinBase === "number" ? parsed.startMinBase : LEGACY_START_MIN;
    if (savedBase === START_MIN) return;
    const shiftSlots = (savedBase - START_MIN) / SLOT_MIN;
    parsed.availableCells = (parsed.availableCells || []).map((key) => {
      const [dayStr, slotStr] = key.split("-");
      return cellKey(parseInt(dayStr, 10), parseInt(slotStr, 10) + shiftSlots);
    });
    (parsed.requests || []).forEach((r) => {
      r.startSlot += shiftSlots;
    });
    parsed.candidates = [];
  }
  function pageFromLegacyStep(step) {
    if (step <= 2) return "settings";
    return OLD_PAGE_TO_NEW.schedule;
  }
  function migrateOldState(parsed) {
    const migratedAvailable = [];
    (parsed.availableCells || []).forEach((key) => {
      const [dayStr, slotStr] = key.split("-");
      const day = parseInt(dayStr, 10);
      const oldSlot = parseInt(slotStr, 10);
      for (let i = 0; i < SLOT_SCALE; i++) {
        migratedAvailable.push(cellKey(day, oldSlot * SLOT_SCALE + i));
      }
    });
    const migratedRequests = (parsed.requests || []).map((r) => ({
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
        state.onceLimitedMemberIds3 = parsed.onceLimitedMemberIds3 || [];
        state.excludedMemberIds3 = parsed.excludedMemberIds3 || [];
        runtime.availableCells = new Set(parsed.availableCells || []);
        runtime.candidates = parsed.candidates || [];
        if (parsed.schedule3Result && Array.isArray(parsed.schedule3Result.candidateAList)) {
          const list = parsed.schedule3Result.candidateAList.slice(0, 3);
          while (list.length < 3) list.push(null);
          runtime.schedule3Result = { candidateAList: list };
        } else {
          const legacyCandidateA = parsed.schedule3Result && parsed.schedule3Result.candidateA || null;
          runtime.schedule3Result = {
            candidateAList: [legacyCandidateA, null, null]
          };
        }
        if (parsed.schedule3Result && (parsed.schedule3Result.candidateB || parsed.schedule3Result.candidateC)) {
          runtime.candidates = [
            parsed.schedule3Result.candidateB,
            parsed.schedule3Result.candidateC
          ].filter(Boolean);
        }
        if (PAGE_IDS.indexOf(parsed.currentPage) !== -1) {
          runtime.currentPage = parsed.currentPage;
        } else if (OLD_PAGE_TO_NEW[parsed.currentPage]) {
          runtime.currentPage = OLD_PAGE_TO_NEW[parsed.currentPage];
        } else if (parsed.currentStep >= 1 && parsed.currentStep <= 5) {
          runtime.currentPage = pageFromLegacyStep(parsed.currentStep);
        } else {
          runtime.currentPage = "settings";
        }
      }
    } catch (e) {
      console.warn("failed to load saved state", e);
    }
    if (!hadSavedState && state.locations.length === 0) {
      state.locations = DEFAULT_LOCATION_NAMES.map((name) => ({
        id: uid("loc"),
        name
      }));
      for (let i = 0; i < state.locations.length; i++) {
        for (let j = i + 1; j < state.locations.length; j++) {
          const locA = state.locations[i], locB = state.locations[j];
          state.travelTimes[pairKey(locA.id, locB.id)] = defaultTravelMinutesFor(
            locA.name,
            locB.name
          );
        }
      }
    }
    if (!hadSavedState && runtime.availableCells.size === 0) {
      DEFAULT_BUSINESS_DAY_INDICES.forEach((di) => {
        for (let s = DEFAULT_BUSINESS_START_SLOT; s < DEFAULT_BUSINESS_END_SLOT; s++)
          runtime.availableCells.add(cellKey(di, s));
      });
    }
    state.members.forEach((m) => {
      if (!Array.isArray(m.locationIds)) {
        m.locationIds = m.locationId ? [m.locationId] : [];
        delete m.locationId;
      }
      if (m.locationIds.length === 0) {
        const firstReq = state.requests.find(
          (r) => r.memberId === m.id && r.locationId
        );
        if (firstReq) m.locationIds = [firstReq.locationId];
      }
      if (typeof m.memo !== "string") m.memo = "";
      if (m.category === "PT 등록") m.category = "등록";
    });
    state.requests.forEach((r) => {
      delete r.locationId;
    });
    let hadDurationMismatch = false;
    state.requests.forEach((r) => {
      const member = state.members.find((m) => m.id === r.memberId);
      if (!member) return;
      const correctDuration = sessionDurationFor(member);
      if (r.duration !== correctDuration) {
        r.duration = correctDuration;
        hadDurationMismatch = true;
      }
    });
    if (hadDurationMismatch) runtime.candidates = [];
    if (runtime.candidates.some(
      (c) => c.strategyIndex < 0 || c.strategyIndex >= STRATEGY_COUNT
    ))
      runtime.candidates = [];
    state.onceLimitedMemberIds3 = state.onceLimitedMemberIds3.filter(
      (id) => isOnceLimitEligible(memberById(id))
    );
    state.excludedMemberIds3 = state.excludedMemberIds3.filter(
      (id) => !!memberById(id)
    );
    const hadSunday = state.requests.some((r) => r.day >= DAYS.length) || Array.from(runtime.availableCells).some(
      (k) => parseInt(k.split("-")[0], 10) >= DAYS.length
    );
    if (hadSunday) {
      state.requests = state.requests.filter((r) => r.day < DAYS.length);
      runtime.availableCells = new Set(
        Array.from(runtime.availableCells).filter(
          (k) => parseInt(k.split("-")[0], 10) < DAYS.length
        )
      );
      runtime.candidates = [];
    }
  }

  // src/grid.js
  var draggingMoveHandler = null;
  var draggingDurationSlots = 1;
  var draggingValidator = null;
  var draggingSourceContainer = null;
  var LONG_PRESS_MS = 450;
  var LONG_PRESS_MOVE_TOLERANCE = 10;
  function attachTouchDrag(el, container, meta) {
    let timer = null;
    let pointerId = null;
    let startX = 0, startY = 0;
    let active = false;
    function findDropCell(x, y) {
      const helpers = container._dndHelpers;
      if (!helpers) return null;
      const cell = helpers.cellAtPoint(x, y);
      return cell && container.contains(cell) ? cell : null;
    }
    function cleanup() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pointerId = null;
      if (active) {
        draggingMoveHandler = null;
        draggingValidator = null;
        draggingDurationSlots = 1;
        draggingSourceContainer = null;
        const helpers = container._dndHelpers;
        if (helpers) {
          helpers.clearDropPreview();
          helpers.clearDropTargets();
        }
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
      if (!active) {
        cleanup();
        return;
      }
      const cell = findDropCell(e.clientX, e.clientY);
      const handler = draggingMoveHandler;
      cleanup();
      if (cell && handler)
        handler(parseInt(cell.dataset.day, 10), parseInt(cell.dataset.slot, 10));
    }
    function onCancel(e) {
      if (e.pointerId !== pointerId) return;
      cleanup();
    }
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
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
  function renderGrid(container, availableSet, options) {
    options = options || {};
    const rangeStart = typeof options.rangeStartSlot === "number" ? options.rangeStartSlot : 0;
    const rangeEnd = typeof options.rangeEndSlot === "number" ? options.rangeEndSlot : SLOT_COUNT;
    container.innerHTML = "";
    container.style.gridTemplateRows = "30px repeat(" + (rangeEnd - rangeStart) + ", 16px)";
    const corner = document.createElement("div");
    corner.className = "cal-head corner";
    corner.style.gridColumn = "1";
    corner.style.gridRow = "1";
    container.appendChild(corner);
    DAYS.forEach((d, di) => {
      const head = document.createElement("div");
      head.className = "cal-head";
      head.textContent = d;
      head.style.gridColumn = String(di + 2);
      head.style.gridRow = "1";
      container.appendChild(head);
    });
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
    (options.travelBlocks || []).forEach((t) => {
      const clippedStart = Math.max(t.startSlot, rangeStart);
      const clippedEnd = Math.min(
        t.startSlot + Math.round(t.duration / SLOT_MIN),
        rangeEnd
      );
      if (clippedEnd <= clippedStart) return;
      const travel = document.createElement("div");
      travel.className = t.type === "break" ? "cal-break-block" : "cal-travel-block";
      travel.style.gridColumn = String(t.day + 2);
      travel.style.gridRow = clippedStart - rangeStart + 2 + " / span " + (clippedEnd - clippedStart);
      travel.title = t.label;
      travel.textContent = t.label;
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
          openContextMenu(
            e.clientX,
            e.clientY,
            t.contextMenuItems(e.clientX, e.clientY)
          );
        });
      }
      container.appendChild(travel);
    });
    (options.blocks || []).forEach((b) => {
      const clippedStart = Math.max(b.startSlot, rangeStart);
      const clippedEnd = Math.min(
        b.startSlot + durationToSlots(b.duration),
        rangeEnd
      );
      if (clippedEnd <= clippedStart) return;
      const block = document.createElement("div");
      block.className = "cal-block" + (b.excluded ? " excluded" : "") + (b.confirmed ? " confirmed" : "");
      if (!b.excluded) {
        block.style.background = b.confirmed ? "linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.72)), " + b.color : b.color;
        if (b.confirmed) block.style.borderColor = b.color;
      }
      block.style.gridColumn = String(b.day + 2);
      block.style.gridRow = clippedStart - rangeStart + 2 + " / span " + (clippedEnd - clippedStart);
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
          openContextMenu(
            e.clientX,
            e.clientY,
            b.contextMenuItems(e.clientX, e.clientY)
          );
        });
      }
      container.appendChild(block);
    });
    function cellAtPoint(x, y) {
      return document.elementsFromPoint(x, y).find((el) => el.classList && el.classList.contains("cal-cell")) || null;
    }
    let dropPreviewEl = null;
    function clearDropPreview() {
      if (dropPreviewEl) {
        dropPreviewEl.remove();
        dropPreviewEl = null;
      }
    }
    function paintDropTargets() {
      if (!draggingValidator) return;
      const reachableByDay = [];
      for (let day = 0; day < DAYS.length; day++) {
        const reachable = /* @__PURE__ */ new Set();
        for (let slot = rangeStart; slot < rangeEnd; slot++) {
          if (draggingValidator(day, slot).ok) {
            for (let k = 0; k < draggingDurationSlots; k++)
              reachable.add(slot + k);
          }
        }
        reachableByDay.push(reachable);
      }
      container.querySelectorAll(".cal-cell").forEach((cell) => {
        const day = parseInt(cell.dataset.day, 10);
        const slot = parseInt(cell.dataset.slot, 10);
        cell.classList.toggle("cal-cell-blocked", !reachableByDay[day].has(slot));
      });
    }
    function clearDropTargets() {
      container.querySelectorAll(".cal-cell-blocked").forEach((cell) => cell.classList.remove("cal-cell-blocked"));
    }
    function showDropPreview(day, startSlot, kind) {
      const clippedStart = Math.max(startSlot, rangeStart);
      const clippedEnd = Math.min(startSlot + draggingDurationSlots, rangeEnd);
      if (clippedEnd <= clippedStart) {
        clearDropPreview();
        return;
      }
      if (!dropPreviewEl) {
        dropPreviewEl = document.createElement("div");
        dropPreviewEl.className = "cal-drop-preview";
        container.appendChild(dropPreviewEl);
      }
      dropPreviewEl.style.gridColumn = String(day + 2);
      dropPreviewEl.style.gridRow = clippedStart - rangeStart + 2 + " / span " + (clippedEnd - clippedStart);
      dropPreviewEl.classList.toggle("invalid", kind === "invalid");
      dropPreviewEl.classList.toggle("swap", kind === "swap");
    }
    container._dndHelpers = {
      cellAtPoint,
      clearDropPreview,
      clearDropTargets,
      showDropPreview,
      paintDropTargets
    };
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
          const kind = draggingValidator ? draggingValidator(day, slot).kind : "move";
          helpers.showDropPreview(day, slot, kind);
        } else {
          helpers.clearDropPreview();
        }
      });
      container.addEventListener("dragleave", (e) => {
        if (!container.contains(e.relatedTarget))
          container._dndHelpers.clearDropPreview();
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
        if (cell)
          handler(
            parseInt(cell.dataset.day, 10),
            parseInt(cell.dataset.slot, 10)
          );
      });
    }
  }
  var activeContextMenuEl = null;
  function closeContextMenu() {
    if (activeContextMenuEl) {
      activeContextMenuEl.remove();
      activeContextMenuEl = null;
    }
  }
  function openContextMenu(x, y, items) {
    closeContextMenu();
    const menu = document.createElement("div");
    menu.className = "block-context-menu";
    items.forEach((it) => {
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
    if (activeContextMenuEl && !activeContextMenuEl.contains(e.target))
      closeContextMenu();
  });
  document.addEventListener("contextmenu", (e) => {
    if (activeContextMenuEl && !activeContextMenuEl.contains(e.target))
      closeContextMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeContextMenu();
  });
  window.addEventListener("scroll", closeContextMenu, true);
  window.addEventListener("resize", closeContextMenu);

  // src/imageExport.js
  async function saveCandidateCardAsImage(cardEl, title) {
    if (typeof html2canvas !== "function") {
      showToast("이미지 저장 기능을 불러오지 못했습니다.", "error");
      return;
    }
    const gridWrap = cardEl.querySelector(".grid-scroll");
    const neededWidth = gridWrap ? cardEl.offsetWidth + Math.max(0, gridWrap.scrollWidth - gridWrap.clientWidth) : null;
    const CAPTURE_ATTR = "data-capture-card";
    cardEl.setAttribute(CAPTURE_ATTR, "");
    try {
      const canvas = await html2canvas(cardEl, {
        backgroundColor: "#ffffff",
        scale: 2,
        ignoreElements: (el) => el.classList && el.classList.contains("candidate-card-actions"),
        // html2canvas가 repeating-linear-gradient 배경을 그리지 못하고 흰 배경으로 남기는 문제가
        // 있어(이동 시간 블록·제외 회원 블록에 사용 중), 캡처용 복제 문서에서만 무늬를 대표하는
        // 단색으로 바꿔치기한다. 화면에 실제로 보이는 원본 요소는 건드리지 않는다.
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll(".cal-travel-block").forEach((el) => {
            el.style.background = "#ffedd5";
          });
          clonedDoc.querySelectorAll(".cal-block.excluded").forEach((el) => {
            el.style.background = "#e5e7eb";
          });
          if (neededWidth) {
            const clonedCard = clonedDoc.querySelector(`[${CAPTURE_ATTR}]`);
            if (clonedCard) {
              clonedCard.style.width = neededWidth + "px";
              clonedCard.style.maxWidth = "none";
            }
            clonedDoc.querySelectorAll(".grid-scroll").forEach((el) => {
              el.style.overflow = "visible";
            });
          }
        }
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast("이미지 저장에 실패했습니다.", "error");
          return;
        }
        const dateLabel = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const filename = title.replace(/[\\/:*?"<>|]/g, "") + "_" + dateLabel + ".png";
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const file = new File([blob], filename, { type: "image/png" });
        if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
            return;
          } catch (err) {
            if (err && err.name === "AbortError") return;
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

  // src/engine/greedy.js
  function requestCells(req) {
    const cells = [];
    const slots = durationToSlots(req.duration);
    for (let i = 0; i < slots; i++)
      cells.push(cellKey(req.day, req.startSlot + i));
    return cells;
  }
  function isWithinAvailability(req) {
    return requestCells(req).every((k) => runtime.availableCells.has(k));
  }
  function isEligibleRequest(req) {
    return isWithinAvailability(req) && !currentExcludedIds().includes(req.memberId);
  }
  function isAdjacentDay(day, days) {
    for (const d of days) {
      if (Math.abs(d - day) === 1) return true;
    }
    return false;
  }
  function candidateLocationsFor(memberId) {
    const member = memberById(memberId);
    return member && member.locationIds && member.locationIds.length > 0 ? member.locationIds : [null];
  }
  function candidateLocationsForRequest(req) {
    const base = candidateLocationsFor(req.memberId).filter((id) => id !== null);
    const extra = (req.extraLocationIds || []).filter((id) => !base.includes(id));
    const combined = base.concat(extra);
    return combined.length > 0 ? combined : [null];
  }
  function requiredGapMin(locA, locB) {
    const raw = Math.max(BREAK_MIN, travelMinutes(locA, locB));
    return Math.ceil(raw / SLOT_MIN) * SLOT_MIN;
  }
  var DAYTIME_END_MIN = 18 * 60;
  function isDaytimeStart(cand) {
    return START_MIN + cand.startSlot * SLOT_MIN < DAYTIME_END_MIN;
  }
  function isHalfHourStart(cand) {
    return (START_MIN + cand.startSlot * SLOT_MIN) % 30 === 0;
  }
  function dailyTravelCount(chain) {
    let count = 0;
    for (let i = 1; i < chain.length; i++) {
      if (travelMinutes(chain[i - 1].locationId, chain[i].locationId) > 0)
        count++;
    }
    return count;
  }
  function greedyAssign(eligibleReqs, options, pinned) {
    options = options || {};
    pinned = pinned || [];
    const travelFirst = !!options.travelFirst;
    const preferDaytime = !!options.preferDaytime;
    const groupByLocation = !!options.groupByLocation;
    const minimizeUnassigned = !!options.minimizeUnassigned;
    const sessionCountFirst = !!options.sessionCountFirst;
    const pinnedLocationDay = options.pinnedLocationDay || null;
    const maxTravelsPerDay = options.maxTravelsPerDay || MAX_TRAVELS_PER_DAY;
    const maxTravelsPerWeek = options.maxTravelsPerWeek || null;
    const travelCountOnly = !!options.travelCountOnly;
    const forceOnceMemberIds = options.forceOnceMemberIds ? new Set(options.forceOnceMemberIds) : null;
    const externalDayOrder = options.stage1DayOrder || null;
    const soloTravelIds = soloTravelMemberIds();
    const priorityRank = new Map(eligibleReqs.map((r, i) => [r.id, i]));
    const byDay = /* @__PURE__ */ new Map();
    eligibleReqs.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const days = [...byDay.keys()].sort((a, b) => a - b);
    const allLocIds = state.locations.map((l) => l.id).concat([null]);
    function allMemberIdsForDay(day) {
      return new Set((byDay.get(day) || []).map((r) => r.memberId));
    }
    function runPass(stage1Order, allowGapMin) {
      const assigned = [];
      const memberDays = /* @__PURE__ */ new Map();
      const chainByDay = /* @__PURE__ */ new Map();
      function withinCaps(memberId, day) {
        const usedDays = memberDays.get(memberId);
        if (usedDays && usedDays.has(day)) return false;
        if (usedDays && usedDays.size >= maxSessionsFor(memberById(memberId)))
          return false;
        return true;
      }
      function commit(day, located) {
        assigned.push(located);
        if (!memberDays.has(located.memberId))
          memberDays.set(located.memberId, /* @__PURE__ */ new Set());
        memberDays.get(located.memberId).add(day);
        if (!chainByDay.has(day)) chainByDay.set(day, []);
        chainByDay.get(day).push(located);
      }
      function weeklyTravelUsedExcluding(day) {
        let total = 0;
        chainByDay.forEach((chain, d) => {
          if (d === day) return;
          total += dailyTravelCount(chain);
        });
        return total;
      }
      function buildBestChain(day, eligibleMemberIds, weightFn, endBefore, onlyLocationId) {
        weightFn = weightFn || (() => 1);
        const otherDaysTravelUsed = maxTravelsPerWeek != null ? weeklyTravelUsedExcluding(day) : 0;
        const cands = (byDay.get(day) || []).filter(
          (r) => eligibleMemberIds.has(r.memberId) && (!endBefore || r.startSlot + durationToSlots(r.duration) <= endBefore.slot)
        );
        const nodes = [];
        cands.forEach((cand) => {
          const memberLocs = candidateLocationsForRequest(cand);
          const locs = onlyLocationId ? memberLocs.includes(onlyLocationId) ? [onlyLocationId] : [] : memberLocs;
          locs.forEach((locId) => {
            nodes.push({
              cand,
              locationId: locId,
              end: cand.startSlot + durationToSlots(cand.duration)
            });
          });
        });
        nodes.sort(
          (a, b) => a.end - b.end || priorityRank.get(a.cand.id) - priorityRank.get(b.cand.id)
        );
        const index = /* @__PURE__ */ new Map();
        const key = (end, locId) => end + "|" + locId;
        function timeCostOf(n) {
          return n.travelMinutesSum + n.idleMinutesSum;
        }
        function addToIndex(node) {
          const k = key(node.end, node.locationId);
          if (!index.has(k)) index.set(k, []);
          const list = index.get(k);
          list.push(node);
          list.sort(
            (a, b) => travelFirst ? a.travelCount - b.travelCount || b.dp - a.dp || (travelCountOnly ? 0 : a.travelMinutesSum - b.travelMinutesSum || timeCostOf(a) - timeCostOf(b) || b.alignedScore - a.alignedScore || a.soloSlackPenalty - b.soloSlackPenalty) || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0) : b.dp - a.dp || a.travelCount - b.travelCount || (travelCountOnly ? 0 : a.travelMinutesSum - b.travelMinutesSum || timeCostOf(a) - timeCostOf(b) || b.alignedScore - a.alignedScore || a.soloSlackPenalty - b.soloSlackPenalty) || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0)
          );
        }
        function chainScore(node) {
          let s = 0, n = node;
          while (n) {
            s += priorityRank.get(n.cand.id);
            n = n.prev;
          }
          return s;
        }
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
        nodes.forEach((node) => {
          let bestPrev = null, bestPrevDp = -Infinity, bestResultTravelOnly = Infinity, bestResultTimeCost = Infinity, bestResultAligned = -Infinity, bestResultSlackPen = Infinity, bestResultDaytime = -Infinity, bestResultGroup = -Infinity, bestTravelCount = Infinity, bestTransitionMin = 0, bestSlackMin = 0;
          allLocIds.forEach((predLoc) => {
            const need = requiredGapMin(predLoc, node.locationId);
            const transitionMin = travelMinutes(predLoc, node.locationId);
            for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {
              const reqEnd2 = node.cand.startSlot - (need + slackMin) / SLOT_MIN;
              const list = index.get(key(reqEnd2, predLoc));
              if (!list) continue;
              for (const prevNode of list) {
                if (prevNode.usedMembers.has(node.cand.memberId)) continue;
                if (soloTravelIds.has(prevNode.cand.memberId) && prevNode.arrivedViaTravel && transitionMin > 0)
                  continue;
                const tc = prevNode.travelCount + (transitionMin > 0 ? 1 : 0);
                if (tc > maxTravelsPerDay) continue;
                if (maxTravelsPerWeek != null && otherDaysTravelUsed + tc > maxTravelsPerWeek)
                  continue;
                const resultTravelOnly = prevNode.travelMinutesSum + transitionMin;
                const resultTimeCost = resultTravelOnly + prevNode.idleMinutesSum + slackMin;
                const slackPenalty = soloTravelIds.has(node.cand.memberId) && transitionMin === 0 && slackMin > 0 ? slackMin : 0;
                const resultSlackPen = prevNode.soloSlackPenalty + slackPenalty;
                if (!bestPrev || isBetterPair(
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
                  bestResultGroup
                )) {
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
                break;
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
            node.alignedScore = bestPrev.alignedScore;
            node.soloSlackPenalty = bestResultSlackPen;
            node.daytimeScore = bestPrev.daytimeScore + daytimeBonus;
            node.groupScore = bestPrev.groupScore + (bestPrev.locationId === node.locationId ? 1 : 0);
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
            node.usedMembers = /* @__PURE__ */ new Set([node.cand.memberId]);
            node.arrivedViaTravel = false;
          }
          if (node.dp > -Infinity) {
            addToIndex(node);
            const nodeTimeCost = timeCostOf(node);
            const bestTimeCost = best ? timeCostOf(best) : null;
            const tie = best && node.dp === best.dp && node.travelCount === best.travelCount && (travelCountOnly || node.travelMinutesSum === best.travelMinutesSum) && (travelCountOnly || nodeTimeCost === bestTimeCost) && (travelCountOnly || node.alignedScore === best.alignedScore) && (travelCountOnly || node.soloSlackPenalty === best.soloSlackPenalty) && (!preferDaytime || node.daytimeScore === best.daytimeScore) && (!groupByLocation || node.groupScore === best.groupScore);
            if (!best || isBetterPair(
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
              best.groupScore
            ) || tie && chainScore(node) < chainScore(best))
              best = node;
          }
        });
        let chosen = best;
        if (endBefore) {
          chosen = null;
          allLocIds.forEach((loc) => {
            const need = requiredGapMin(loc, endBefore.locationId);
            const transitionMin = travelMinutes(loc, endBefore.locationId);
            for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {
              const gapSlots = (need + slackMin) / SLOT_MIN;
              const list = index.get(key(endBefore.slot - gapSlots, loc));
              if (!list || list.length === 0) continue;
              const node = list.find(
                (n) => !(soloTravelIds.has(n.cand.memberId) && n.arrivedViaTravel && transitionMin > 0)
              );
              if (!node) continue;
              const nodeTimeCost = timeCostOf(node);
              const chosenTimeCost = chosen ? timeCostOf(chosen) : null;
              if (!chosen || isBetterPair(
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
                chosen.groupScore
              )) {
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
            locationId: cur.locationId
          });
          cur = cur.prev;
        }
        return chain;
      }
      function extendExistingChain(day, eligibleMemberIds) {
        let chain = chainByDay.get(day) || [];
        if (chain.length === 0) return;
        const usedMembers = new Set(chain.map((s) => s.memberId));
        const dayCands = byDay.get(day) || [];
        let extending = true;
        while (extending) {
          extending = false;
          const chainEnd = chain[chain.length - 1];
          const chainEndArrivedViaTravel = chain.length >= 2 && chain[chain.length - 2].locationId !== chainEnd.locationId;
          const chainEndIsSoloTravelMember = soloTravelIds.has(chainEnd.memberId) && chainEndArrivedViaTravel;
          let bestCand = null, bestLocated = null, bestCost = Infinity;
          dayCands.forEach((cand) => {
            if (!eligibleMemberIds.has(cand.memberId) || usedMembers.has(cand.memberId))
              return;
            let bestLoc = null;
            candidateLocationsForRequest(cand).forEach((locId) => {
              const need = requiredGapMin(chainEnd.locationId, locId);
              const actual = (cand.startSlot - (chainEnd.startSlot + durationToSlots(chainEnd.duration))) * SLOT_MIN;
              if (actual < need || actual > need + allowGapMin) return;
              const cost = travelMinutes(chainEnd.locationId, locId);
              if (chainEndIsSoloTravelMember && cost > 0) return;
              if (!bestLoc || cost < bestLoc.cost) bestLoc = { locId, cost };
            });
            if (!bestLoc) return;
            if (travelFirst && bestLoc.cost > 0) return;
            if (!bestCand || bestLoc.cost < bestCost || bestLoc.cost === bestCost && priorityRank.get(cand.id) < priorityRank.get(bestCand.id)) {
              bestCand = cand;
              bestCost = bestLoc.cost;
              bestLocated = {
                id: cand.id,
                memberId: cand.memberId,
                day,
                startSlot: cand.startSlot,
                duration: cand.duration,
                locationId: bestLoc.locId
              };
            }
          });
          if (bestLocated) {
            const projectedChain = [...chain, bestLocated];
            if (dailyTravelCount(projectedChain) > maxTravelsPerDay) break;
            if (maxTravelsPerWeek != null && weeklyTravelUsedExcluding(day) + dailyTravelCount(projectedChain) > maxTravelsPerWeek)
              break;
            commit(day, bestLocated);
            chain = chainByDay.get(day);
            usedMembers.add(bestCand.memberId);
            extending = true;
          }
        }
      }
      function extendChainBackward(day, eligibleMemberIds, weightFn) {
        const chain = chainByDay.get(day) || [];
        if (chain.length === 0) return;
        const usedMembers = new Set(chain.map((s) => s.memberId));
        const remaining = new Set(
          [...eligibleMemberIds].filter((id) => !usedMembers.has(id))
        );
        if (remaining.size === 0) return;
        const chainStart = chain[0];
        const frontChain = buildBestChain(day, remaining, weightFn, {
          slot: chainStart.startSlot,
          locationId: chainStart.locationId
        });
        if (frontChain.length === 0) return;
        const combined = [...frontChain, ...chain];
        if (dailyTravelCount(combined) > maxTravelsPerDay) return;
        if (maxTravelsPerWeek != null && weeklyTravelUsedExcluding(day) + dailyTravelCount(combined) > maxTravelsPerWeek)
          return;
        frontChain.forEach((s) => {
          assigned.push(s);
          if (!memberDays.has(s.memberId)) memberDays.set(s.memberId, /* @__PURE__ */ new Set());
          memberDays.get(s.memberId).add(day);
        });
        chainByDay.set(day, combined);
      }
      function fillDay(day, eligibleMemberIds, weightFn) {
        if ((chainByDay.get(day) || []).length > 0) {
          extendExistingChain(day, eligibleMemberIds);
          extendChainBackward(day, eligibleMemberIds, weightFn);
        } else {
          buildBestChain(day, eligibleMemberIds, weightFn).forEach(
            (s) => commit(day, s)
          );
        }
      }
      function fairnessWeight(memberId) {
        if (forceOnceMemberIds && forceOnceMemberIds.has(memberId)) {
          const usedDays = memberDays.get(memberId);
          if (!usedDays || usedDays.size === 0) return FORCE_ONCE_WEIGHT;
        }
        return 1;
      }
      if (pinned.length > 0) {
        const pinsByDay = /* @__PURE__ */ new Map();
        pinned.forEach((p) => {
          if (!pinsByDay.has(p.day)) pinsByDay.set(p.day, []);
          pinsByDay.get(p.day).push(p);
        });
        pinsByDay.forEach((dayPins, day) => {
          dayPins.sort((a, b) => a.startSlot - b.startSlot);
          const pinnedMemberIds = new Set(dayPins.map((p) => p.memberId));
          const beforeEligible = new Set(
            [...allMemberIdsForDay(day)].filter((id) => !pinnedMemberIds.has(id))
          );
          const firstPin = dayPins[0];
          buildBestChain(day, beforeEligible, fairnessWeight, {
            slot: firstPin.startSlot,
            locationId: firstPin.locationId
          }).forEach((s) => commit(day, s));
          dayPins.forEach((p) => commit(day, p));
        });
      }
      if (pinnedLocationDay && !pinned.some((p) => p.day === pinnedLocationDay.day) && (byDay.get(pinnedLocationDay.day) || []).length > 0) {
        buildBestChain(
          pinnedLocationDay.day,
          allMemberIdsForDay(pinnedLocationDay.day),
          fairnessWeight,
          null,
          pinnedLocationDay.locationId
        ).forEach((s) => commit(pinnedLocationDay.day, s));
      }
      stage1Order.forEach((day) => {
        const elig = new Set(
          [...allMemberIdsForDay(day)].filter((id) => {
            if (!sessionCountFirst) {
              const usedDays = memberDays.get(id);
              if (usedDays && usedDays.size >= 1) return false;
            }
            return withinCaps(id, day);
          })
        );
        fillDay(day, elig, fairnessWeight);
      });
      days.forEach((day) => {
        const elig = new Set(
          [...allMemberIdsForDay(day)].filter((id) => {
            if (!withinCaps(id, day)) return false;
            const usedDays = memberDays.get(id);
            if (usedDays && isAdjacentDay(day, usedDays)) return false;
            return true;
          })
        );
        fillDay(day, elig);
      });
      days.forEach((day) => {
        const elig = new Set(
          [...allMemberIdsForDay(day)].filter((id) => withinCaps(id, day))
        );
        fillDay(day, elig);
      });
      return assigned;
    }
    function runWithGapPolicy(allowGapMin) {
      const naturalResult = runPass(days, allowGapMin);
      if (!minimizeUnassigned && !externalDayOrder) return naturalResult;
      let best = naturalResult;
      let bestMemberCount = new Set(best.map((r) => r.memberId)).size;
      function consider(order) {
        const attempt = runPass(order, allowGapMin);
        const attemptMemberCount = new Set(attempt.map((r) => r.memberId)).size;
        if (attemptMemberCount > bestMemberCount || attemptMemberCount === bestMemberCount && attempt.length > best.length) {
          best = attempt;
          bestMemberCount = attemptMemberCount;
        }
      }
      if (minimizeUnassigned) {
        consider(
          [...days].sort(
            (a, b) => allMemberIdsForDay(a).size - allMemberIdsForDay(b).size
          )
        );
      }
      if (externalDayOrder) {
        consider(externalDayOrder.filter((d) => byDay.has(d)));
      }
      return best;
    }
    const strictResult = runWithGapPolicy(0);
    const looseResult = ALLOWED_GAP_MIN > 0 ? runWithGapPolicy(ALLOWED_GAP_MIN) : strictResult;
    return looseResult.length > strictResult.length ? looseResult : strictResult;
  }
  function totalTravelMinutes(assigned) {
    let total = 0;
    const byDay = /* @__PURE__ */ new Map();
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
  function totalTravelCount(assigned) {
    let total = 0;
    const byDay = /* @__PURE__ */ new Map();
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
  function buildCandidate(title, desc, sortedReqs, eligibleSet, allMemberIds, options, pinned) {
    const assigned = greedyAssign(
      sortedReqs.filter((r) => eligibleSet.has(r.id)),
      options,
      pinned
    );
    const assignedMemberIds = new Set(assigned.map((r) => r.memberId));
    const unassignedMembers = [...allMemberIds].filter((id) => !assignedMemberIds.has(id)).map((id) => memberById(id)).filter(Boolean);
    return {
      title,
      desc,
      assigned,
      unassignedMembers,
      travelMinutes: totalTravelMinutes(assigned)
    };
  }
  var CONTENTION_BUCKET_SLOTS = durationToSlots(SESSION_DURATION_MIN);
  function reqEnd(r) {
    return r.startSlot + durationToSlots(r.duration);
  }
  function endBucket(r) {
    return Math.floor(reqEnd(r) / CONTENTION_BUCKET_SLOTS);
  }
  function defaultSort(eligible, jitter) {
    return [...eligible].sort(
      (a, b) => a.day - b.day || endBucket(a) - endBucket(b) || jitter.get(a.id) - jitter.get(b.id) || reqEnd(a) - reqEnd(b)
    );
  }
  var STRATEGIES = [
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
      options: {
        sessionCountFirst: true,
        strengthenSearch: "sessions",
        maxUnassigned: 1
      },
      sort: defaultSort
    }
  ];
  function strengthenCandidate(baseline, sorted, eligibleIds, allMemberIds, options, pinned, primary) {
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
        pinned
      );
      const attemptScore = candidateSearchScore(
        attempt,
        primary,
        options.maxUnassigned
      );
      if (isCandidateWorse(bestScore, attemptScore)) {
        best = attempt;
        bestScore = attemptScore;
      }
    }
    const flippedOptions = Object.assign({}, options, {
      sessionCountFirst: !options.sessionCountFirst
    });
    consider(flippedOptions);
    if (state.locations.length >= 2) {
      [options, flippedOptions].forEach((optsVariant) => {
        DAYS.forEach((d, day) => {
          state.locations.forEach((loc) => {
            consider(
              Object.assign({}, optsVariant, {
                pinnedLocationDay: { day, locationId: loc.id }
              })
            );
          });
        });
      });
    }
    return best;
  }
  function repairUnassigned(baseline, sorted, eligibleIds, allMemberIds, options, pinned, primary) {
    let best = baseline;
    let bestScore = candidateSearchScore(best, primary, options.maxUnassigned);
    function tryForce(ids) {
      const forcedOptions = Object.assign({}, options, {
        forceOnceMemberIds: ids
      });
      const attempt = buildCandidate(
        baseline.title,
        baseline.desc,
        sorted,
        eligibleIds,
        allMemberIds,
        forcedOptions,
        pinned
      );
      const attemptScore = candidateSearchScore(
        attempt,
        primary,
        options.maxUnassigned
      );
      if (!isCandidateWorse(attemptScore, bestScore)) {
        best = attempt;
        bestScore = attemptScore;
        return true;
      }
      return false;
    }
    if (baseline.unassignedMembers.length > 0 && baseline.unassignedMembers.length <= 6) {
      tryForce(baseline.unassignedMembers.map((m) => m.id));
    }
    const tried = /* @__PURE__ */ new Set();
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
  function buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, jitter, pinned, dayOrder) {
    const strategy = STRATEGIES[strategyIndex];
    const sorted = strategy.sort(eligible, jitter);
    const strategyOptions = typeof strategy.options === "function" ? strategy.options() : strategy.options;
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
      pinned
    );
    if (strategyOptions.strengthenSearch) {
      cand = strengthenCandidate(
        cand,
        sorted,
        eligibleIds,
        allMemberIds,
        options,
        pinned,
        strategyOptions.strengthenSearch
      );
      if (cand.unassignedMembers.length > 0) {
        cand = repairUnassigned(
          cand,
          sorted,
          eligibleIds,
          allMemberIds,
          options,
          pinned,
          strategyOptions.strengthenSearch
        );
      }
    }
    cand.strategyIndex = strategyIndex;
    return cand;
  }
  function candidateSearchScore(cand, primary, maxUnassigned) {
    const count = new Set(cand.assigned.map((r) => r.memberId)).size;
    const sessions = cand.assigned.length;
    const travel = totalTravelCount(cand.assigned);
    const capOk = typeof maxUnassigned === "number" && cand.unassignedMembers.length > maxUnassigned ? 0 : 1;
    const base = primary === "sessions" ? [sessions, count, travel] : [count, sessions, travel];
    return [capOk, base[0], base[1], base[2]];
  }
  function isCandidateWorse(a, b) {
    if (a[0] !== b[0]) return a[0] < b[0];
    if (a[1] !== b[1]) return a[1] < b[1];
    if (a[2] !== b[2]) return a[2] < b[2];
    return a[3] > b[3];
  }
  function isCandidateScoreTie(a, b) {
    return !isCandidateWorse(a, b) && !isCandidateWorse(b, a);
  }
  function strategyPrimary(strategyIndex) {
    const options = STRATEGIES[strategyIndex].options;
    const strategyOptions = typeof options === "function" ? {} : options;
    return strategyOptions.strengthenSearch === "sessions" ? "sessions" : "count";
  }
  function strategyMaxUnassigned(strategyIndex) {
    const options = STRATEGIES[strategyIndex].options;
    const strategyOptions = typeof options === "function" ? {} : options;
    return typeof strategyOptions.maxUnassigned === "number" ? strategyOptions.maxUnassigned : null;
  }
  function makeSeededRandom(seed) {
    let s = seed >>> 0;
    return function() {
      s |= 0;
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffledDayOrder(randomFn) {
    const order = DAYS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    return order;
  }
  function yieldToUI() {
    if (document.hidden) {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }
    return new Promise(
      (resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))
    );
  }
  function checkGenerationCancelled() {
    if (runtime.generationCancelRequested) throw new GenerationCancelledError();
  }
  var PROGRESS_YIELD_EVERY = 5;
  async function searchStrategyPool(strategyIndex, eligible, eligibleIds, allMemberIds, pinned, attempts, randomFn, onProgress) {
    const zeroJitter = new Map(eligible.map((r) => [r.id, 0]));
    const pool = [
      buildCandidateFromStrategy(
        strategyIndex,
        eligible,
        eligibleIds,
        allMemberIds,
        zeroJitter,
        pinned
      )
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
          dayOrder
        )
      );
      if (onProgress && (i + 1) % PROGRESS_YIELD_EVERY === 0) {
        onProgress((i + 1) / (attempts + 1));
        await yieldToUI();
      }
    }
    if (onProgress) onProgress(1);
    return pool;
  }
  var INITIAL_SEARCH_ATTEMPTS = 1e3;
  var REGENERATE_SEARCH_ATTEMPTS = 25;
  var candidateHistory = {};
  var candidateUndoStack = {};
  var MAX_POOL_VARIANTS = 9;
  var TRAVEL_VALUE_MINUTES = 60;
  var candidatePools = {};
  var candidateAPools = {};
  function resetCandidateSession() {
    Object.keys(candidateHistory).forEach((k) => delete candidateHistory[k]);
    Object.keys(candidateUndoStack).forEach((k) => delete candidateUndoStack[k]);
    Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
    Object.keys(candidateAPools).forEach((k) => delete candidateAPools[k]);
  }
  function candidateSignature(cand) {
    return cand.assigned.map((r) => r.id).slice().sort().join(",");
  }
  async function generateCandidatesAsync(onProgress) {
    const allMemberIds = new Set(
      state.requests.filter((r) => !currentExcludedIds().includes(r.memberId)).map((r) => r.memberId)
    );
    const eligible = state.requests.filter(isEligibleRequest);
    const eligibleIds = new Set(eligible.map((r) => r.id));
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
          []
        )
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
            dayOrder
          )
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
      const myWeeklyCap = strategyOptions && typeof strategyOptions !== "function" && typeof strategyOptions.maxTravelsPerWeek === "number" ? strategyOptions.maxTravelsPerWeek : null;
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
        strategyIndex: idx
      });
      const tied = [];
      const seenSig = /* @__PURE__ */ new Set();
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
      if (!tied.includes(builtCand)) {
        if (tied.length >= MAX_POOL_VARIANTS) tied.length = MAX_POOL_VARIANTS - 1;
        tied.unshift(builtCand);
      }
      return { builtCand, tied };
    });
    return {
      built: builtPairs.map((p) => p.builtCand),
      pools: builtPairs.map((p) => p.tied)
    };
  }
  function hasRegenerableEligible(strategyIndex) {
    const prevCand = runtime.candidates[strategyIndex];
    const confirmedIds = new Set(prevCand && prevCand.confirmedIds || []);
    const pinnedIds = new Set(
      (prevCand ? prevCand.assigned.filter((r) => confirmedIds.has(r.id)) : []).map((r) => r.id)
    );
    return state.requests.some(
      (r) => isEligibleRequest(r) && !pinnedIds.has(r.id)
    );
  }
  async function regenerateCandidate(strategyIndex, onProgress, onDone) {
    const prevCand = runtime.candidates[strategyIndex];
    if (!candidateHistory[strategyIndex]) {
      candidateHistory[strategyIndex] = new Set(
        prevCand ? [candidateSignature(prevCand)] : []
      );
    }
    const seen = candidateHistory[strategyIndex];
    const confirmedIds = new Set(prevCand && prevCand.confirmedIds || []);
    const pinned = prevCand ? prevCand.assigned.filter((r) => confirmedIds.has(r.id)) : [];
    const pinnedIds = new Set(pinned.map((r) => r.id));
    const allMemberIds = new Set(
      state.requests.filter(
        (r) => pinnedIds.has(r.id) || !currentExcludedIds().includes(r.memberId)
      ).map((r) => r.memberId)
    );
    const eligible = state.requests.filter(
      (r) => isEligibleRequest(r) && !pinnedIds.has(r.id)
    );
    const eligibleIds = new Set(eligible.map((r) => r.id));
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
      onProgress
    );
    let baseline = pool[0];
    let baselineScore = candidateSearchScore(
      baseline,
      myPrimary,
      myMaxUnassigned
    );
    pool.forEach((cand) => {
      const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
      if (isCandidateWorse(baselineScore, score)) {
        baseline = cand;
        baselineScore = score;
      }
    });
    const floorCand = prevCand && isCandidateWorse(
      baselineScore,
      candidateSearchScore(prevCand, myPrimary, myMaxUnassigned)
    ) ? prevCand : baseline;
    const floorScore = candidateSearchScore(
      floorCand,
      myPrimary,
      myMaxUnassigned
    );
    let newCand = null;
    let newScore = null;
    pool.forEach((cand) => {
      const score = candidateSearchScore(cand, myPrimary, myMaxUnassigned);
      if (isCandidateWorse(score, floorScore)) return;
      const sig = candidateSignature(cand);
      if (seen.has(sig)) return;
      if (!newCand || isCandidateWorse(newScore, score)) {
        newCand = cand;
        newScore = score;
      }
    });
    if (newCand) seen.add(candidateSignature(newCand));
    if (!newCand) {
      newCand = floorCand;
      candidateHistory[strategyIndex] = /* @__PURE__ */ new Set([candidateSignature(newCand)]);
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
    {
      const newCandSig = candidateSignature(newCand);
      const tied = [];
      const seenTieSig = /* @__PURE__ */ new Set();
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
  function restorePreviousCandidate(strategyIndex, onDone) {
    const stack = candidateUndoStack[strategyIndex];
    if (!stack || stack.length === 0) return;
    runtime.candidates[strategyIndex] = stack.pop();
    saveState();
    onDone();
    showToast("이전 후보로 되돌아갔습니다", "info");
  }

  // src/engine/chainDp.js
  function sessionDurationFor2(member) {
    return (member && (member.category || "상담")) === "상담" ? CONSULT_DURATION_MIN_2 : SESSION_DURATION_MIN_2;
  }
  function maxSessionsFor2(member) {
    if (!member) return 1;
    if (currentOnceLimitIds2().includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }
  function requiredGapMin2(locA, locB) {
    const raw = travelMinutes(locA, locB);
    return raw > 0 ? Math.ceil(raw / SLOT_MIN) * SLOT_MIN : 0;
  }
  function isEligibleRequest2(req) {
    const member = memberById(req.memberId);
    if (!member || currentExcludedIds2().includes(req.memberId)) return false;
    const slots = durationToSlots(sessionDurationFor2(member));
    for (let i = 0; i < slots; i++) {
      if (!runtime.availableCells.has(cellKey(req.day, req.startSlot + i)))
        return false;
    }
    return true;
  }
  function buildDayNodes(dayRequests, weightFn, jitterFn) {
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
          jitter: jitterFn ? jitterFn() : 0
        });
      });
    });
    return nodes;
  }
  function runChainDP(nodes, maxTravelsPerDay) {
    if (maxTravelsPerDay === void 0) maxTravelsPerDay = MAX_TRAVELS_PER_DAY;
    nodes = nodes.slice().sort((a, b) => a.end - b.end || a.startSlot - b.startSlot);
    const n = nodes.length;
    const dp = new Array(n), tc = new Array(n), tm = new Array(n), idle = new Array(n), js = new Array(n), prev = new Array(n);
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
        if (p.memberId === node.memberId) continue;
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
        if (better(
          newDp,
          newTc,
          newTm,
          newIdle,
          newJs,
          bestDp,
          bestTc,
          bestTm,
          bestIdle,
          bestJs
        )) {
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
    let bestEnd = -1, bestDpAll = 0, bestTcAll = 0, bestTmAll = 0, bestIdleAll = 0, bestJsAll = 0;
    for (let i = 0; i < n; i++) {
      if (bestEnd === -1 || better(
        dp[i],
        tc[i],
        tm[i],
        idle[i],
        js[i],
        bestDpAll,
        bestTcAll,
        bestTmAll,
        bestIdleAll,
        bestJsAll
      )) {
        bestDpAll = dp[i];
        bestTcAll = tc[i];
        bestTmAll = tm[i];
        bestIdleAll = idle[i];
        bestJsAll = js[i];
        bestEnd = i;
      }
    }
    const chain = [];
    const used = /* @__PURE__ */ new Set();
    let cur = bestEnd;
    while (cur !== -1 && cur !== void 0) {
      const node = nodes[cur];
      if (!used.has(node.memberId)) {
        chain.unshift(node);
        used.add(node.memberId);
      }
      cur = prev[cur];
    }
    return chain;
  }
  async function runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, stage1DayOrder, runRepair, runPolish, polishBudgetMs, seedOffset) {
    seedOffset = seedOffset || 0;
    let yieldOverheadMs = 0;
    function now() {
      return performance.now() - yieldOverheadMs;
    }
    let lastYieldAt = performance.now();
    const YIELD_INTERVAL_MS = 48;
    async function maybeYield() {
      checkGenerationCancelled();
      const t = performance.now();
      if (t - lastYieldAt < YIELD_INTERVAL_MS) return;
      await yieldToUI();
      yieldOverheadMs += performance.now() - t;
      lastYieldAt = performance.now();
      checkGenerationCancelled();
    }
    const stage1RandomFn = mulberry32(112233 + seedOffset);
    const assignedCountByMember = /* @__PURE__ */ new Map();
    const assignedDaysByMember = /* @__PURE__ */ new Map();
    const dayChains = /* @__PURE__ */ new Map();
    const REPAIR_DEADLINE = now() + 3e3;
    const reqsByMemberDay = /* @__PURE__ */ new Map();
    eligibleReqs.forEach((r) => {
      if (!reqsByMemberDay.has(r.memberId))
        reqsByMemberDay.set(r.memberId, /* @__PURE__ */ new Map());
      const byDay = reqsByMemberDay.get(r.memberId);
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    function reqsFor(memberId, day) {
      const byDay = reqsByMemberDay.get(memberId);
      return byDay && byDay.get(day) || [];
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
        (assignedCountByMember.get(node.memberId) || 0) + 1
      );
      if (!assignedDaysByMember.has(node.memberId))
        assignedDaysByMember.set(node.memberId, /* @__PURE__ */ new Set());
      assignedDaysByMember.get(node.memberId).add(day);
    }
    function uncommit(day, node) {
      assignedCountByMember.set(
        node.memberId,
        assignedCountByMember.get(node.memberId) - 1
      );
      assignedDaysByMember.get(node.memberId).delete(day);
    }
    function dominantLocationFor(day) {
      const membersByLoc = /* @__PURE__ */ new Map();
      reqsByDay.get(day).forEach((r) => {
        if ((assignedCountByMember.get(r.memberId) || 0) !== 0) return;
        candidateLocationsForRequest(r).forEach((locId) => {
          if (!membersByLoc.has(locId)) membersByLoc.set(locId, /* @__PURE__ */ new Set());
          membersByLoc.get(locId).add(r.memberId);
        });
      });
      let dominantLoc = null, dominantCount = -1;
      membersByLoc.forEach((set, locId) => {
        if (set.size > dominantCount) {
          dominantCount = set.size;
          dominantLoc = locId;
        }
      });
      return dominantLoc;
    }
    stage1DayOrder.forEach((day) => {
      const dominantLoc = dominantLocationFor(day);
      const nodes = buildDayNodes(
        reqsByDay.get(day),
        (memberId, startSlot, locationId) => {
          if ((assignedCountByMember.get(memberId) || 0) !== 0) return 0;
          return locationId === dominantLoc ? 1.02 : 1;
        },
        () => stage1RandomFn()
      );
      const chain = runChainDP(nodes);
      chain.forEach((node) => commit(day, node));
      dayChains.set(day, chain);
    });
    const PIN_WEIGHT = 1e6;
    daysWithReqs.forEach((day) => {
      const existingChain = dayChains.get(day) || [];
      existingChain.forEach((node) => uncommit(day, node));
      const pinnedKeys = new Set(
        existingChain.map(
          (n) => n.memberId + "|" + n.startSlot + "|" + n.locationId
        )
      );
      const pinnedMemberIds = new Set(existingChain.map((n) => n.memberId));
      const nodes = buildDayNodes(
        reqsByDay.get(day),
        (memberId, startSlot, locationId) => {
          if (pinnedKeys.has(memberId + "|" + startSlot + "|" + locationId))
            return PIN_WEIGHT;
          if (pinnedMemberIds.has(memberId)) return 0;
          return isEligibleForDay(memberId, day) ? 1 : 0;
        },
        () => stage1RandomFn()
      );
      const chain = runChainDP(nodes);
      chain.forEach((node) => commit(day, node));
      dayChains.set(day, chain);
    });
    const MAX_EJECTION_DEPTH = 3;
    const submittedIds = new Set(state.requests.map((r) => r.memberId));
    function isCurrentlyAssigned(memberId) {
      return (assignedCountByMember.get(memberId) || 0) > 0;
    }
    const excludedIdSet2 = new Set(currentExcludedIds2());
    function tryPlaceMember(memberId, excludeDays, depth) {
      if (depth > MAX_EJECTION_DEPTH) return false;
      if (now() > REPAIR_DEADLINE) return false;
      const alreadyUsedDays = assignedDaysByMember.get(memberId) || /* @__PURE__ */ new Set();
      const candidateDays = daysWithReqs.filter(
        (day) => !excludeDays.has(day) && !alreadyUsedDays.has(day) && reqsByDay.get(day).some((r) => r.memberId === memberId)
      );
      for (const day of candidateDays) {
        const chain0 = dayChains.get(day) || [];
        const dayReqsForMember = reqsFor(memberId, day);
        const candNodes = buildDayNodes(dayReqsForMember, () => 1);
        for (const cand of candNodes) {
          let insertAt = 0;
          while (insertAt < chain0.length && chain0[insertAt].startSlot < cand.startSlot)
            insertAt++;
          let feasible = true;
          if (insertAt > 0) {
            const prev = chain0[insertAt - 1];
            const prevEnd = prev.startSlot + durationToSlots(prev.duration);
            if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId))
              feasible = false;
          }
          if (feasible && insertAt < chain0.length) {
            const next = chain0[insertAt];
            if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId))
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
            end: cand.end
          };
          const newChain = chain0.slice();
          newChain.splice(insertAt, 0, newNode);
          if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) continue;
          commit(day, newNode);
          dayChains.set(day, newChain);
          return true;
        }
        for (const cand of candNodes) {
          const chain = dayChains.get(day) || [];
          const overlapping = /* @__PURE__ */ new Set();
          chain.forEach((n) => {
            const nEnd = n.startSlot + durationToSlots(n.duration);
            if (cand.startSlot < nEnd && n.startSlot < cand.end)
              overlapping.add(n.memberId);
          });
          let otherMemberId = null;
          if (overlapping.size === 1) {
            otherMemberId = [...overlapping][0];
          } else if (overlapping.size === 0) {
            const sorted = chain.slice().sort((a, b) => a.startSlot - b.startSlot);
            let idx = 0;
            while (idx < sorted.length && sorted[idx].startSlot < cand.startSlot)
              idx++;
            const prevN = idx > 0 ? sorted[idx - 1] : null;
            const nextN = idx < sorted.length ? sorted[idx] : null;
            const prevBad = prevN && (cand.startSlot - (prevN.startSlot + durationToSlots(prevN.duration))) * SLOT_MIN < requiredGapMin2(prevN.locationId, cand.locationId);
            const nextBad = nextN && (nextN.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, nextN.locationId);
            if (prevBad && nextBad && prevN.memberId !== nextN.memberId) continue;
            if (prevBad) otherMemberId = prevN.memberId;
            else if (nextBad) otherMemberId = nextN.memberId;
            else continue;
          } else {
            continue;
          }
          const otherNode = chain.find((n) => n.memberId === otherMemberId);
          const remainingChain = chain.filter(
            (n) => n.memberId !== otherMemberId
          );
          let insertAt = 0;
          while (insertAt < remainingChain.length && remainingChain[insertAt].startSlot < cand.startSlot)
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
            end: cand.end
          };
          const newChain = remainingChain.slice();
          newChain.splice(insertAt, 0, newNode);
          if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) continue;
          uncommit(day, otherNode);
          commit(day, newNode);
          dayChains.set(day, newChain);
          if (tryPlaceMember(
            otherMemberId,
            /* @__PURE__ */ new Set([...excludeDays, day]),
            depth + 1
          )) {
            return true;
          }
          uncommit(day, newNode);
          commit(day, otherNode);
          dayChains.set(day, chain);
        }
      }
      return false;
    }
    function stillUnassignedIds() {
      return state.members.filter((m) => !excludedIdSet2.has(m.id) && submittedIds.has(m.id)).map((m) => m.id).filter((id) => !isCurrentlyAssigned(id));
    }
    if (runRepair) {
      let tryRebuildDayFor = function(memberId, day) {
        const beforeUnassigned = stillUnassignedIds().length;
        const existingChain = dayChains.get(day) || [];
        existingChain.forEach((node) => uncommit(day, node));
        const nodes = buildDayNodes(
          reqsByDay.get(day),
          (mId, startSlot, locationId) => {
            if (mId === memberId) return REBUILD_TARGET_WEIGHT;
            return isEligibleForDay(mId, day) ? 1 : 0;
          }
        );
        const newChain = runChainDP(nodes);
        if (!newChain.some((n) => n.memberId === memberId)) {
          existingChain.forEach((node) => commit(day, node));
          dayChains.set(day, existingChain);
          return false;
        }
        newChain.forEach((node) => commit(day, node));
        dayChains.set(day, newChain);
        const afterUnassigned = stillUnassignedIds().length;
        if (afterUnassigned < beforeUnassigned || afterUnassigned === beforeUnassigned && newChain.length >= existingChain.length) {
          return true;
        }
        newChain.forEach((node) => uncommit(day, node));
        existingChain.forEach((node) => commit(day, node));
        dayChains.set(day, existingChain);
        return false;
      };
      for (const memberId of stillUnassignedIds()) {
        await maybeYield();
        if (isCurrentlyAssigned(memberId)) continue;
        tryPlaceMember(memberId, /* @__PURE__ */ new Set(), 0);
      }
      const REBUILD_TARGET_WEIGHT = 1e6;
      for (const memberId of stillUnassignedIds()) {
        await maybeYield();
        if (now() > REPAIR_DEADLINE) break;
        if (isCurrentlyAssigned(memberId)) continue;
        const candidateDays = daysWithReqs.filter(
          (day) => reqsByDay.get(day).some((r) => r.memberId === memberId)
        );
        for (const day of candidateDays) {
          if (tryRebuildDayFor(memberId, day)) break;
        }
      }
      let addedExtra = true;
      let extraPassCount = 0;
      while (addedExtra && extraPassCount < 5) {
        addedExtra = false;
        extraPassCount++;
        const extraCandidateIds = state.members.filter((m) => !excludedIdSet2.has(m.id)).map((m) => m.id).filter((id) => {
          const count = assignedCountByMember.get(id) || 0;
          return count > 0 && count < maxSessionsFor2(memberById(id));
        });
        for (const memberId of extraCandidateIds) {
          await maybeYield();
          if (tryPlaceMember(memberId, /* @__PURE__ */ new Set(), 0)) addedExtra = true;
        }
      }
    }
    if (runPolish) {
      let dayIdleMinutes = function(chain) {
        const sorted = [...chain].sort((a, b) => a.startSlot - b.startSlot);
        let idle = 0;
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1], cur = sorted[i];
          const gapMin = (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) * SLOT_MIN;
          idle += Math.max(
            0,
            gapMin - requiredGapMin2(prev.locationId, cur.locationId)
          );
        }
        return idle;
      }, isTravelIdleBetter = function(travelA, idleA, travelB, idleB) {
        const scoreA = travelA * TRAVEL_VALUE_MINUTES + idleA;
        const scoreB = travelB * TRAVEL_VALUE_MINUTES + idleB;
        if (scoreA !== scoreB) return scoreA < scoreB;
        if (travelA !== travelB) return travelA < travelB;
        return idleA < idleB;
      }, travelIdleImproves = function(deltaTravel, deltaIdle) {
        if (deltaTravel > 0) return false;
        if (deltaTravel === 0) return deltaIdle < 0;
        return deltaIdle <= -deltaTravel * TRAVEL_VALUE_MINUTES;
      }, tryRelocateSession = function(node) {
        const memberId = node.memberId;
        const currentDay = node.day;
        const currentChainWithout = (dayChains.get(currentDay) || []).filter(
          (n) => n !== node
        );
        const beforeCurrentDayTravel = totalTravelCount(
          dayChains.get(currentDay) || []
        );
        const beforeCurrentDayIdle = dayIdleMinutes(
          dayChains.get(currentDay) || []
        );
        const currentDayWithoutTravel = totalTravelCount(currentChainWithout);
        const currentDayWithoutIdle = dayIdleMinutes(currentChainWithout);
        let bestMove = null;
        daysWithReqs.forEach((day) => {
          if (day !== currentDay) {
            if ((dayChains.get(day) || []).some((n) => n.memberId === memberId))
              return;
          }
          const dayReqsForMember = reqsFor(memberId, day);
          if (dayReqsForMember.length === 0) return;
          const candNodes = buildDayNodes(dayReqsForMember, () => 1);
          const baseChain = day === currentDay ? currentChainWithout : dayChains.get(day) || [];
          const beforeTargetDayTravel = day === currentDay ? 0 : totalTravelCount(baseChain);
          const beforeTargetDayIdle = day === currentDay ? 0 : dayIdleMinutes(baseChain);
          candNodes.forEach((cand) => {
            if (day === currentDay && cand.startSlot === node.startSlot && cand.locationId === node.locationId)
              return;
            let insertAt = 0;
            while (insertAt < baseChain.length && baseChain[insertAt].startSlot < cand.startSlot)
              insertAt++;
            let feasible = true;
            if (insertAt > 0) {
              const prev = baseChain[insertAt - 1];
              const prevEnd = prev.startSlot + durationToSlots(prev.duration);
              if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId))
                feasible = false;
            }
            if (feasible && insertAt < baseChain.length) {
              const next = baseChain[insertAt];
              if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId))
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
              end: cand.end
            };
            const newChain = baseChain.slice();
            newChain.splice(insertAt, 0, newNode);
            if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) return;
            let deltaTravel, deltaIdle;
            if (day === currentDay) {
              deltaTravel = totalTravelCount(newChain) - beforeCurrentDayTravel;
              deltaIdle = dayIdleMinutes(newChain) - beforeCurrentDayIdle;
            } else {
              deltaTravel = currentDayWithoutTravel + totalTravelCount(newChain) - (beforeCurrentDayTravel + beforeTargetDayTravel);
              deltaIdle = currentDayWithoutIdle + dayIdleMinutes(newChain) - (beforeCurrentDayIdle + beforeTargetDayIdle);
            }
            const improves = travelIdleImproves(deltaTravel, deltaIdle);
            if (improves && (!bestMove || isTravelIdleBetter(
              deltaTravel,
              deltaIdle,
              bestMove.deltaTravel,
              bestMove.deltaIdle
            ))) {
              bestMove = {
                sameDay: day === currentDay,
                targetDay: day,
                newTargetChain: newChain,
                deltaTravel,
                deltaIdle
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
          (n) => n.memberId === memberId
        );
        commit(bestMove.targetDay, addedNode);
        return true;
      }, insertFeasible = function(chainWithout, cand) {
        let insertAt = 0;
        while (insertAt < chainWithout.length && chainWithout[insertAt].startSlot < cand.startSlot)
          insertAt++;
        if (insertAt > 0) {
          const prev = chainWithout[insertAt - 1];
          const prevEnd = prev.startSlot + durationToSlots(prev.duration);
          if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId))
            return null;
        }
        if (insertAt < chainWithout.length) {
          const next = chainWithout[insertAt];
          if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId))
            return null;
        }
        const newChain = chainWithout.slice();
        newChain.splice(insertAt, 0, cand);
        if (dailyTravelCount(newChain) > MAX_TRAVELS_PER_DAY) return null;
        return newChain;
      }, tryCrossDaySwap = function(node1, node2) {
        if (node1.day === node2.day || node1.memberId === node2.memberId)
          return false;
        const day1 = node1.day, day2 = node2.day, member1 = node1.memberId, member2 = node2.memberId;
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
          end: node2.startSlot + durationToSlots(dur1)
        };
        const newInDay1 = {
          id: req2InDay1.id,
          memberId: member2,
          day: day1,
          startSlot: node1.startSlot,
          duration: dur2,
          locationId: node1.locationId,
          end: node1.startSlot + durationToSlots(dur2)
        };
        const chain1 = insertFeasible(
          (dayChains.get(day1) || []).filter((n) => n !== node1),
          newInDay1
        );
        if (!chain1) return false;
        const chain2 = insertFeasible(
          (dayChains.get(day2) || []).filter((n) => n !== node2),
          newInDay2
        );
        if (!chain2) return false;
        const beforeTravel = totalTravelCount(dayChains.get(day1) || []) + totalTravelCount(dayChains.get(day2) || []);
        const afterTravel = totalTravelCount(chain1) + totalTravelCount(chain2);
        const beforeIdle = dayIdleMinutes(dayChains.get(day1) || []) + dayIdleMinutes(dayChains.get(day2) || []);
        const afterIdle = dayIdleMinutes(chain1) + dayIdleMinutes(chain2);
        if (!travelIdleImproves(afterTravel - beforeTravel, afterIdle - beforeIdle))
          return false;
        uncommit(day1, node1);
        uncommit(day2, node2);
        commit(day1, newInDay1);
        commit(day2, newInDay2);
        dayChains.set(day1, chain1);
        dayChains.set(day2, chain2);
        return true;
      }, snapshotChainState = function() {
        return {
          dayChains: new Map(dayChains),
          counts: new Map(assignedCountByMember),
          days: new Map(
            Array.from(assignedDaysByMember, ([k, v]) => [k, new Set(v)])
          )
        };
      }, restoreChainState = function(snap) {
        dayChains.clear();
        snap.dayChains.forEach((v, k) => dayChains.set(k, v));
        assignedCountByMember.clear();
        snap.counts.forEach((v, k) => assignedCountByMember.set(k, v));
        assignedDaysByMember.clear();
        snap.days.forEach((v, k) => assignedDaysByMember.set(k, v));
      }, tryPlaceMemberChain = function(placeMemberId, excludeDays, depth, touchedDays, protectedMemberId) {
        if (depth > MAX_RELOCATE_EJECT_DEPTH) return false;
        for (const day of daysWithReqs) {
          if (excludeDays.has(day)) continue;
          if ((dayChains.get(day) || []).some((n) => n.memberId === placeMemberId))
            continue;
          const reqs = reqsFor(placeMemberId, day);
          if (reqs.length === 0) continue;
          const candNodes = buildDayNodes(reqs, () => 1);
          const chain = dayChains.get(day) || [];
          for (const cand of candNodes) {
            const newNode = {
              id: cand.id,
              memberId: placeMemberId,
              day,
              startSlot: cand.startSlot,
              duration: cand.duration,
              locationId: cand.locationId,
              end: cand.end
            };
            const newChain = insertFeasible(chain, newNode);
            if (newChain) {
              dayChains.set(day, newChain);
              commit(day, newNode);
              touchedDays.add(day);
              return true;
            }
          }
          for (const cand of candNodes) {
            const overlapping = /* @__PURE__ */ new Set();
            chain.forEach((n) => {
              const nEnd = n.startSlot + durationToSlots(n.duration);
              if (cand.startSlot < nEnd && n.startSlot < cand.end)
                overlapping.add(n.memberId);
            });
            let otherMemberId = null;
            if (overlapping.size === 1) {
              otherMemberId = [...overlapping][0];
            } else if (overlapping.size === 0) {
              const sorted = chain.slice().sort((a, b) => a.startSlot - b.startSlot);
              let idx = 0;
              while (idx < sorted.length && sorted[idx].startSlot < cand.startSlot)
                idx++;
              const prevN = idx > 0 ? sorted[idx - 1] : null;
              const nextN = idx < sorted.length ? sorted[idx] : null;
              const prevBad = prevN && (cand.startSlot - (prevN.startSlot + durationToSlots(prevN.duration))) * SLOT_MIN < requiredGapMin2(prevN.locationId, cand.locationId);
              const nextBad = nextN && (nextN.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, nextN.locationId);
              if (prevBad && nextBad && prevN.memberId !== nextN.memberId)
                continue;
              if (prevBad) otherMemberId = prevN.memberId;
              else if (nextBad) otherMemberId = nextN.memberId;
              else continue;
            } else continue;
            if (otherMemberId === protectedMemberId) continue;
            const otherNode = chain.find((n) => n.memberId === otherMemberId);
            const remaining = chain.filter((n) => n.memberId !== otherMemberId);
            const newNode = {
              id: cand.id,
              memberId: placeMemberId,
              day,
              startSlot: cand.startSlot,
              duration: cand.duration,
              locationId: cand.locationId,
              end: cand.end
            };
            const newChain = insertFeasible(remaining, newNode);
            if (!newChain) continue;
            uncommit(day, otherNode);
            commit(day, newNode);
            dayChains.set(day, newChain);
            touchedDays.add(day);
            if (tryPlaceMemberChain(
              otherMemberId,
              /* @__PURE__ */ new Set([...excludeDays, day]),
              depth + 1,
              touchedDays,
              protectedMemberId
            ))
              return true;
            uncommit(day, newNode);
            commit(day, otherNode);
            dayChains.set(day, chain);
          }
        }
        return false;
      }, tryEjectChainMove = function(node, acceptFn) {
        const snap = snapshotChainState();
        const memberId = node.memberId;
        const currentDay = node.day;
        const touchedDays = /* @__PURE__ */ new Set([currentDay]);
        const chain0 = dayChains.get(currentDay) || [];
        uncommit(currentDay, node);
        dayChains.set(
          currentDay,
          chain0.filter((n) => n !== node)
        );
        const placed = tryPlaceMemberChain(
          memberId,
          /* @__PURE__ */ new Set(),
          0,
          touchedDays,
          memberId
        );
        if (!placed) {
          restoreChainState(snap);
          return false;
        }
        let beforeTravel = 0, beforeIdle = 0, afterTravel = 0, afterIdle = 0;
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
      }, trySessionCountSwap = function(randomFn, acceptFn) {
        const doubles = [], singles = [];
        assignedCountByMember.forEach((count, id) => {
          if (count === 0) return;
          if (maxSessionsFor2(memberById(id)) < 2) return;
          if (count === 2) doubles.push(id);
          else if (count === 1) singles.push(id);
        });
        if (doubles.length === 0 || singles.length === 0) return false;
        const memberA = doubles[Math.floor(randomFn() * doubles.length)];
        const memberB = singles[Math.floor(randomFn() * singles.length)];
        if (memberA === memberB) return false;
        const snap = snapshotChainState();
        const touchedDays = /* @__PURE__ */ new Set();
        const aNodes = [];
        dayChains.forEach(
          (chain, day) => chain.forEach((n) => {
            if (n.memberId === memberA) aNodes.push({ day, node: n });
          })
        );
        if (aNodes.length !== 2) {
          restoreChainState(snap);
          return false;
        }
        const removed = aNodes[Math.floor(randomFn() * aNodes.length)];
        uncommit(removed.day, removed.node);
        dayChains.set(
          removed.day,
          (dayChains.get(removed.day) || []).filter((n) => n !== removed.node)
        );
        touchedDays.add(removed.day);
        const placed = tryPlaceMemberChain(
          memberB,
          /* @__PURE__ */ new Set(),
          0,
          touchedDays,
          null
        );
        if (!placed) {
          restoreChainState(snap);
          return false;
        }
        let beforeTravel = 0, beforeIdle = 0, afterTravel = 0, afterIdle = 0;
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
      };
      const polishStart = now();
      const polishBudget = polishBudgetMs || 8e3;
      const POLISH_DEADLINE = polishStart + polishBudget;
      const STAGE6_DEADLINE = polishStart + polishBudget * 0.25;
      const STAGE65_DEADLINE = polishStart + polishBudget * 0.55;
      const SA_DEADLINE = polishStart + polishBudget * 0.8;
      daysWithReqs.forEach((day) => {
        const beforeUnassignedCount = stillUnassignedIds().length;
        const beforeTotalSessions = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + c.length,
          0
        );
        const existingChain = dayChains.get(day) || [];
        existingChain.forEach((node) => uncommit(day, node));
        const nodes = buildDayNodes(
          reqsByDay.get(day),
          (mId, startSlot, locationId) => isEligibleForDay(mId, day) ? 1 : 0
        );
        const newChain = runChainDP(nodes);
        newChain.forEach((node) => commit(day, node));
        dayChains.set(day, newChain);
        const afterTotalSessions = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + c.length,
          0
        );
        const worse = stillUnassignedIds().length > beforeUnassignedCount || afterTotalSessions < beforeTotalSessions;
        if (worse) {
          newChain.forEach((node) => uncommit(day, node));
          existingChain.forEach((node) => commit(day, node));
          dayChains.set(day, existingChain);
        }
      });
      const stage6RandomFn = mulberry32(445566 + seedOffset);
      stage6: for (let i = 0; i < daysWithReqs.length && now() < STAGE6_DEADLINE; i++) {
        for (let j = i + 1; j < daysWithReqs.length; j++) {
          let attemptOrder = function(firstDay, secondDay, jitterFn) {
            const firstNodes = buildDayNodes(
              reqsByDay.get(firstDay),
              (mId) => isEligibleForDay(mId, firstDay) ? 1 : 0,
              jitterFn
            );
            const firstChain = runChainDP(firstNodes);
            firstChain.forEach((node) => commit(firstDay, node));
            dayChains.set(firstDay, firstChain);
            const secondNodes = buildDayNodes(
              reqsByDay.get(secondDay),
              (mId) => isEligibleForDay(mId, secondDay) ? 1 : 0,
              jitterFn
            );
            const secondChain = runChainDP(secondNodes);
            secondChain.forEach((node) => commit(secondDay, node));
            dayChains.set(secondDay, secondChain);
            const outcome = {
              unassigned: stillUnassignedIds().length,
              totalSessions: Array.from(dayChains.values()).reduce(
                (sum, c) => sum + c.length,
                0
              ),
              pairTravel: totalTravelCount(firstChain) + totalTravelCount(secondChain),
              chainA: firstDay === dayA ? firstChain : secondChain,
              chainB: firstDay === dayA ? secondChain : firstChain
            };
            firstChain.forEach((node) => uncommit(firstDay, node));
            secondChain.forEach((node) => uncommit(secondDay, node));
            dayChains.set(firstDay, []);
            dayChains.set(secondDay, []);
            return outcome;
          };
          await maybeYield();
          if (now() >= STAGE6_DEADLINE) break stage6;
          const dayA = daysWithReqs[i], dayB = daysWithReqs[j];
          const existingA = dayChains.get(dayA) || [];
          const existingB = dayChains.get(dayB) || [];
          const beforeUnassignedCount = stillUnassignedIds().length;
          const beforeTotalSessions = Array.from(dayChains.values()).reduce(
            (sum, c) => sum + c.length,
            0
          );
          const beforePairTravel = totalTravelCount(existingA) + totalTravelCount(existingB);
          existingA.forEach((node) => uncommit(dayA, node));
          existingB.forEach((node) => uncommit(dayB, node));
          dayChains.set(dayA, []);
          dayChains.set(dayB, []);
          const attempts = [
            attemptOrder(dayA, dayB, null),
            attemptOrder(dayB, dayA, null)
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
            if (opt.pairTravel >= beforePairTravel) return;
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
      const baselineUnassigned = stillUnassignedIds().length;
      const baselineSessions = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + c.length,
        0
      );
      const baselineTravel = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + totalTravelCount(c),
        0
      );
      let bestSnapshot = {
        unassigned: baselineUnassigned,
        sessions: baselineSessions,
        travel: baselineTravel,
        chains: new Map(dayChains)
      };
      const polishRandomFn = mulberry32(778899 + seedOffset);
      for (let attempt = 0; attempt < 200 && now() < STAGE65_DEADLINE; attempt++) {
        await maybeYield();
        dayChains.forEach(
          (chain, day) => chain.forEach((node) => uncommit(day, node))
        );
        shuffled(daysWithReqs, polishRandomFn).forEach((day) => {
          const dominantLoc = dominantLocationFor(day);
          const nodes = buildDayNodes(
            reqsByDay.get(day),
            (mId, startSlot, locationId) => {
              if (!isEligibleForDay(mId, day)) return 0;
              return locationId === dominantLoc ? 1.02 : 1;
            },
            () => polishRandomFn()
          );
          const chain = runChainDP(nodes);
          chain.forEach((node) => commit(day, node));
          dayChains.set(day, chain);
        });
        const attemptUnassigned = stillUnassignedIds().length;
        const attemptSessions = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + c.length,
          0
        );
        const attemptTravel = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + totalTravelCount(c),
          0
        );
        if (attemptUnassigned <= bestSnapshot.unassigned && attemptSessions >= bestSnapshot.sessions && attemptTravel < bestSnapshot.travel) {
          bestSnapshot = {
            unassigned: attemptUnassigned,
            sessions: attemptSessions,
            travel: attemptTravel,
            chains: new Map(dayChains)
          };
        }
      }
      dayChains.forEach(
        (chain, day) => chain.forEach((node) => uncommit(day, node))
      );
      bestSnapshot.chains.forEach((chain, day) => {
        chain.forEach((node) => commit(day, node));
        dayChains.set(day, chain);
      });
      const reqKeySet = new Set(
        eligibleReqs.map((r) => r.memberId + "|" + r.day + "|" + r.startSlot)
      );
      const MAX_RELOCATE_EJECT_DEPTH = 3;
      {
        let saTotalTravel = function() {
          let sum = 0;
          dayChains.forEach((chain) => {
            sum += totalTravelCount(chain);
          });
          return sum;
        }, saTotalIdle = function() {
          let sum = 0;
          dayChains.forEach((chain) => {
            sum += dayIdleMinutes(chain);
          });
          return sum;
        }, pickRandomNode = function(randomFn) {
          const all = Array.from(dayChains.values()).flat();
          if (all.length === 0) return null;
          return all[Math.floor(randomFn() * all.length)];
        }, saProposeRelocate = function(randomFn) {
          const node = pickRandomNode(randomFn);
          if (!node) return null;
          const memberId = node.memberId, currentDay = node.day;
          const currentChainWithout = (dayChains.get(currentDay) || []).filter(
            (n) => n !== node
          );
          const options = [];
          daysWithReqs.forEach((day) => {
            if (day !== currentDay && (dayChains.get(day) || []).some((n) => n.memberId === memberId))
              return;
            reqsFor(memberId, day).forEach(
              (r) => options.push({ day, startSlot: r.startSlot, req: r })
            );
          });
          if (options.length === 0) return null;
          const picked = options[Math.floor(randomFn() * options.length)];
          const locOptions = candidateLocationsForRequest(picked.req);
          if (locOptions.length === 0) return null;
          const locationId = locOptions[Math.floor(randomFn() * locOptions.length)];
          if (picked.day === currentDay && picked.startSlot === node.startSlot && locationId === node.locationId)
            return null;
          const duration = sessionDurationFor2(memberById(memberId));
          const cand = {
            id: picked.req.id,
            memberId,
            day: picked.day,
            startSlot: picked.startSlot,
            duration,
            locationId,
            end: picked.startSlot + durationToSlots(duration)
          };
          const baseChain = picked.day === currentDay ? currentChainWithout : dayChains.get(picked.day) || [];
          const newChain = insertFeasible(baseChain, cand);
          if (!newChain) return null;
          let deltaTravel, deltaIdle;
          if (picked.day === currentDay) {
            deltaTravel = totalTravelCount(newChain) - totalTravelCount(dayChains.get(currentDay) || []);
            deltaIdle = dayIdleMinutes(newChain) - dayIdleMinutes(dayChains.get(currentDay) || []);
          } else {
            const beforeCur = dayChains.get(currentDay) || [];
            const beforeTgt = dayChains.get(picked.day) || [];
            deltaTravel = totalTravelCount(currentChainWithout) + totalTravelCount(newChain) - (totalTravelCount(beforeCur) + totalTravelCount(beforeTgt));
            deltaIdle = dayIdleMinutes(currentChainWithout) + dayIdleMinutes(newChain) - (dayIdleMinutes(beforeCur) + dayIdleMinutes(beforeTgt));
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
                (n) => n.memberId === memberId && n.startSlot === picked.startSlot && n.locationId === locationId
              );
              commit(picked.day, addedNode);
            }
          };
        }, saProposeSwap = function(randomFn) {
          const n1 = pickRandomNode(randomFn);
          const n2 = pickRandomNode(randomFn);
          if (!n1 || !n2 || n1 === n2 || n1.day === n2.day || n1.memberId === n2.memberId)
            return null;
          const day1 = n1.day, day2 = n2.day, member1 = n1.memberId, member2 = n2.memberId;
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
            end: n2.startSlot + durationToSlots(dur1)
          };
          const newInDay1 = {
            id: req2InDay1.id,
            memberId: member2,
            day: day1,
            startSlot: n1.startSlot,
            duration: dur2,
            locationId: n1.locationId,
            end: n1.startSlot + durationToSlots(dur2)
          };
          const chain1 = insertFeasible(
            (dayChains.get(day1) || []).filter((n) => n !== n1),
            newInDay1
          );
          if (!chain1) return null;
          const chain2 = insertFeasible(
            (dayChains.get(day2) || []).filter((n) => n !== n2),
            newInDay2
          );
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
        };
        const SA_TRAVEL_WEIGHT = TRAVEL_VALUE_MINUTES;
        const saRandomFn = mulberry32(552233 + seedOffset);
        const SA_START_TEMP = 200, SA_END_TEMP = 1;
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
          temperature = SA_START_TEMP * Math.pow(SA_END_TEMP / SA_START_TEMP, elapsedFrac);
          let applied = false;
          const moveRoll = saRandomFn();
          if (moveRoll < 0.15) {
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
            const curScore = curTravel * TRAVEL_VALUE_MINUTES + curIdle;
            const bestScore = bestTravelSA * TRAVEL_VALUE_MINUTES + bestIdleSA;
            if (curScore < bestScore || curScore === bestScore && curTravel < bestTravelSA) {
              bestTravelSA = curTravel;
              bestIdleSA = curIdle;
              bestSnapshotSA = new Map(dayChains);
            }
          }
        }
        dayChains.forEach(
          (chain, day) => chain.forEach((node) => uncommit(day, node))
        );
        bestSnapshotSA.forEach((chain, day) => {
          chain.forEach((node) => commit(day, node));
          dayChains.set(day, chain);
        });
      }
      const relocateRandomFn = mulberry32(334455 + seedOffset);
      let improvedInPass = true;
      let passCount = 0;
      while (improvedInPass && passCount < 30 && now() < POLISH_DEADLINE) {
        await maybeYield();
        improvedInPass = false;
        passCount++;
        const flatNodes = shuffled(
          Array.from(dayChains.values()).flat(),
          relocateRandomFn
        );
        for (const node of flatNodes) {
          await maybeYield();
          if (now() >= POLISH_DEADLINE) break;
          const stillThere = (dayChains.get(node.day) || []).includes(node);
          if (!stillThere) continue;
          if (tryRelocateSession(node)) {
            improvedInPass = true;
            continue;
          }
          if (tryEjectChainMove(node, travelIdleImproves)) improvedInPass = true;
        }
        if (now() >= POLISH_DEADLINE) break;
        const flatNodes2 = shuffled(
          Array.from(dayChains.values()).flat(),
          relocateRandomFn
        );
        outer: for (let i = 0; i < flatNodes2.length; i++) {
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
        for (let attempt = 0; attempt < 60 && now() < POLISH_DEADLINE; attempt++) {
          await maybeYield();
          if (trySessionCountSwap(relocateRandomFn, travelIdleImproves))
            improvedInPass = true;
        }
      }
      daysWithReqs.forEach((day) => {
        const chain = (dayChains.get(day) || []).slice().sort((a, b) => a.startSlot - b.startSlot);
        for (let idx = 1; idx < chain.length; idx++) {
          const prev = chain[idx - 1];
          const node = chain[idx];
          const minStart = prev.startSlot + durationToSlots(prev.duration) + durationToSlots(requiredGapMin2(prev.locationId, node.locationId));
          if (node.startSlot <= minStart) continue;
          const earlierReqs = reqsFor(node.memberId, day).filter(
            (r) => r.startSlot >= minStart && r.startSlot < node.startSlot
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
    const eligibleMemberIds = state.members.filter((m) => !excludedIdSet2.has(m.id) && submittedIds.has(m.id)).map((m) => m.id);
    const assignedMemberIds = new Set(assigned.map((r) => r.memberId));
    const unassignedMembers = eligibleMemberIds.filter((id) => !assignedMemberIds.has(id)).map(memberById).filter(Boolean);
    return { assigned, unassignedMembers };
  }
  function mulberry32(seed) {
    return function() {
      seed |= 0;
      seed = seed + 1831565813 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
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
  function isSchedule2ResultBetter(a, b) {
    if (a.unassignedMembers.length !== b.unassignedMembers.length) {
      return a.unassignedMembers.length < b.unassignedMembers.length;
    }
    if (a.assigned.length !== b.assigned.length)
      return a.assigned.length > b.assigned.length;
    const travelCountA = totalTravelCount(a.assigned), travelCountB = totalTravelCount(b.assigned);
    const idleA = schedule2TotalIdleMinutes(a.assigned), idleB = schedule2TotalIdleMinutes(b.assigned);
    if (travelCountA !== travelCountB) {
      const netA = travelCountA * TRAVEL_VALUE_MINUTES + idleA;
      const netB = travelCountB * TRAVEL_VALUE_MINUTES + idleB;
      if (netA !== netB) return netA < netB;
    }
    const travelMinA = totalTravelMinutes(a.assigned), travelMinB = totalTravelMinutes(b.assigned);
    if (travelMinA !== travelMinB) return travelMinA < travelMinB;
    return idleA < idleB;
  }
  function floorIsBetter(a, b) {
    if (!b) return true;
    if (a.unassignedMembers.length !== b.unassignedMembers.length) {
      return a.unassignedMembers.length < b.unassignedMembers.length;
    }
    return a.assigned.length > b.assigned.length;
  }
  function schedule2Signature(result) {
    return result.assigned.map(
      (r) => r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId
    ).sort().join(",");
  }
  var SCHEDULE2_CARD_COUNT = 3;
  var PER_GROUP_DAY_ORDER_SHUFFLES = 400;
  var PER_GROUP_SEARCH_DEADLINE_MS = 3e4;
  var PER_GROUP_MAX_POLISH_CANDIDATES = 16;
  var PER_GROUP_MAX_POLISH_ATTEMPTS = 48;
  var PER_GROUP_TOTAL_POLISH_BUDGET_MS = 42e4;
  var MIN_POLISH_BUDGET_MS = 6e3;
  var TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS = 9e4;
  var TARGET_MATCH_ALT_BASE_BUDGET_MS = 8e3;
  var TARGET_MATCH_ALT_BASE_DAY_ORDER_SHUFFLES = 40;
  async function runSchedule2RestartGroup(eligibleReqsMaster, groupSeed, groupIndex, onProgress, targetFloor) {
    const randomFn = mulberry32(groupSeed);
    function groupByDay(reqs) {
      const reqsByDay2 = /* @__PURE__ */ new Map();
      DAYS.forEach((_, d) => reqsByDay2.set(d, []));
      reqs.forEach((r) => reqsByDay2.get(r.day).push(r));
      const daysWithReqs2 = Array.from(reqsByDay2.keys()).filter(
        (d) => reqsByDay2.get(d).length > 0
      );
      return { reqsByDay: reqsByDay2, daysWithReqs: daysWithReqs2 };
    }
    function fixedDayOrders(daysWithReqs2, reqsByDay2) {
      const memberCountOf = (day) => new Set(reqsByDay2.get(day).map((r) => r.memberId)).size;
      return [
        daysWithReqs2.slice().sort((a, b) => memberCountOf(a) - memberCountOf(b)),
        daysWithReqs2.slice().sort((a, b) => memberCountOf(b) - memberCountOf(a)),
        daysWithReqs2.slice().sort((a, b) => a - b),
        daysWithReqs2.slice().sort((a, b) => b - a)
      ];
    }
    async function searchWithinBase(reqs, reqsByDay2, daysWithReqs2, shuffleCount, deadlineMs, seedBase, onEval) {
      const dayOrdersToTry = fixedDayOrders(daysWithReqs2, reqsByDay2);
      for (let k = 0; k < shuffleCount; k++)
        dayOrdersToTry.push(shuffled(daysWithReqs2, randomFn));
      const deadline = performance.now() + deadlineMs;
      let best2 = null, bestOrder2 = null, bestSeedOffset2 = null;
      const evaluated2 = [];
      for (let i = 0; i < dayOrdersToTry.length; i++) {
        const seedOffset = seedBase + i;
        const result = await runSchedule2Pipeline(
          reqs,
          reqsByDay2,
          daysWithReqs2,
          dayOrdersToTry[i],
          true,
          false,
          void 0,
          seedOffset
        );
        evaluated2.push({ order: dayOrdersToTry[i], seedOffset, result });
        if (!best2 || isSchedule2ResultBetter(result, best2)) {
          best2 = result;
          bestOrder2 = dayOrdersToTry[i];
          bestSeedOffset2 = seedOffset;
        }
        if (onEval) await onEval();
        if (performance.now() >= deadline) break;
      }
      return { evaluated: evaluated2, best: best2, bestOrder: bestOrder2, bestSeedOffset: bestSeedOffset2 };
    }
    let eligibleReqs = shuffled(eligibleReqsMaster, randomFn);
    let grouping = groupByDay(eligibleReqs);
    let reqsByDay = grouping.reqsByDay, daysWithReqs = grouping.daysWithReqs;
    let progressMax = 0;
    const primary = await searchWithinBase(
      eligibleReqs,
      reqsByDay,
      daysWithReqs,
      PER_GROUP_DAY_ORDER_SHUFFLES,
      PER_GROUP_SEARCH_DEADLINE_MS,
      groupIndex * 5e6,
      async () => {
        if (onProgress) {
          progressMax = Math.min(
            0.55,
            progressMax + 0.55 / (PER_GROUP_DAY_ORDER_SHUFFLES + 4)
          );
          onProgress(progressMax);
          await yieldToUI();
          checkGenerationCancelled();
        }
      }
    );
    let evaluated = primary.evaluated, best = primary.best, bestOrder = primary.bestOrder, bestSeedOffset = primary.bestSeedOffset;
    if (targetFloor && best && floorIsBetter(targetFloor, best)) {
      const extraDeadline = performance.now() + TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS;
      let altRestartCount = 0;
      while (performance.now() < extraDeadline && floorIsBetter(targetFloor, best)) {
        altRestartCount++;
        const altReqs = shuffled(eligibleReqsMaster, randomFn);
        const altGrouping = groupByDay(altReqs);
        const altBudget = Math.min(
          TARGET_MATCH_ALT_BASE_BUDGET_MS,
          Math.max(0, extraDeadline - performance.now())
        );
        const alt = await searchWithinBase(
          altReqs,
          altGrouping.reqsByDay,
          altGrouping.daysWithReqs,
          TARGET_MATCH_ALT_BASE_DAY_ORDER_SHUFFLES,
          altBudget,
          groupIndex * 5e6 + altRestartCount * 1e6,
          async () => {
            if (onProgress) {
              progressMax = Math.min(0.549, progressMax + 2e-3);
              onProgress(progressMax);
              await yieldToUI();
              checkGenerationCancelled();
            }
          }
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
    const ranked = evaluated.slice().sort((x, y) => {
      if (isSchedule2ResultBetter(x.result, y.result)) return -1;
      if (isSchedule2ResultBetter(y.result, x.result)) return 1;
      return 0;
    });
    const seenSignatures = /* @__PURE__ */ new Set();
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
    const attempts = polishCandidates.map((c) => ({
      order: c.order,
      seedOffset: c.seedOffset
    }));
    for (let round = 1; attempts.length < PER_GROUP_MAX_POLISH_ATTEMPTS; round++) {
      for (const c of polishCandidates) {
        attempts.push({
          order: c.order,
          seedOffset: groupIndex * 5e6 + round * 97711
        });
        if (attempts.length >= PER_GROUP_MAX_POLISH_ATTEMPTS) break;
      }
    }
    const perAttemptBudget = Math.max(
      MIN_POLISH_BUDGET_MS,
      Math.floor(PER_GROUP_TOTAL_POLISH_BUDGET_MS / attempts.length)
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
        attempts[i].seedOffset
      );
      allPolished.push(attempt);
      if (!bestPolished || isSchedule2ResultBetter(attempt, bestPolished))
        bestPolished = attempt;
      if (onProgress) {
        onProgress(0.55 + (i + 1) / attempts.length * 0.45);
        await yieldToUI();
        checkGenerationCancelled();
      }
    }
    const bestSig = schedule2Signature(bestPolished);
    const tied = [];
    const seenTieSig = /* @__PURE__ */ new Set();
    allPolished.forEach((cand) => {
      if (isSchedule2ResultBetter(cand, bestPolished) || isSchedule2ResultBetter(bestPolished, cand))
        return;
      const sig = schedule2Signature(cand);
      if (seenTieSig.has(sig)) return;
      seenTieSig.add(sig);
      if (tied.length < MAX_POOL_VARIANTS)
        tied.push(sig === bestSig ? bestPolished : cand);
    });
    if (!tied.includes(bestPolished)) {
      if (tied.length >= MAX_POOL_VARIANTS) tied.length = MAX_POOL_VARIANTS - 1;
      tied.unshift(bestPolished);
    }
    return { result: bestPolished, pool: tied };
  }
  async function generateSchedule2Async(onProgress) {
    const eligibleReqs = state.requests.filter(isEligibleRequest2);
    const cards = [];
    let targetFloor = null;
    for (let g = 0; g < SCHEDULE2_CARD_COUNT; g++) {
      const groupSeed = 20260823 + g * 104729;
      const groupStart = g / SCHEDULE2_CARD_COUNT;
      const card = await runSchedule2RestartGroup(
        eligibleReqs,
        groupSeed,
        g,
        (p) => {
          if (onProgress) onProgress(groupStart + p / SCHEDULE2_CARD_COUNT);
        },
        targetFloor
      );
      cards.push(
        card || { result: { assigned: [], unassignedMembers: [] }, pool: [] }
      );
      if (card && card.result && floorIsBetter(card.result, targetFloor))
        targetFloor = card.result;
    }
    if (onProgress) onProgress(1);
    return cards;
  }
  function schedule2ToIdleBlocks(assigned) {
    const byDay = /* @__PURE__ */ new Map();
    assigned.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const idleBlocks = [];
    byDay.forEach((reqs) => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        const travelSlots = requiredGapMin2(prev.locationId, cur.locationId) / SLOT_MIN;
        const idleStartSlot = prev.startSlot + durationToSlots(prev.duration) + travelSlots;
        const idleEndSlot = cur.startSlot;
        if (idleEndSlot > idleStartSlot) {
          const mins = (idleEndSlot - idleStartSlot) * SLOT_MIN;
          idleBlocks.push({
            day: prev.day,
            startSlot: idleStartSlot,
            duration: mins,
            label: "빈 시간 " + mins + "분",
            type: "break"
          });
        }
      }
    });
    return idleBlocks;
  }
  function schedule2TotalIdleMinutes(assigned) {
    let idle = 0;
    const byDay = /* @__PURE__ */ new Map();
    assigned.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    byDay.forEach((reqs) => {
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

  // src/pages/memberSchedule.js
  var memberForm = document.getElementById("memberForm");
  var memberNameInput = document.getElementById("memberName");
  var memberLocationMsEl = document.getElementById("memberLocationMs");
  var memberLocationControlEl = document.getElementById(
    "memberLocationControl"
  );
  var memberLocationChipsEl = document.getElementById(
    "memberLocationChips"
  );
  var memberLocationDropdownEl = document.getElementById(
    "memberLocationDropdown"
  );
  var memberCategoryMsEl = document.getElementById("memberCategoryMs");
  var memberCategoryControlEl = document.getElementById(
    "memberCategoryControl"
  );
  var memberCategoryDisplayEl = document.getElementById(
    "memberCategoryDisplay"
  );
  var memberCategoryDropdownEl = document.getElementById(
    "memberCategoryDropdown"
  );
  var memberMemoInput = document.getElementById("memberMemo");
  var memberLocationHintEl = document.getElementById("memberLocationHint");
  var memberCategoryHintEl = document.getElementById("memberCategoryHint");
  var memberNameHintEl = document.getElementById("memberNameHint");
  var memberHintEls = [
    memberLocationHintEl,
    memberCategoryHintEl,
    memberNameHintEl
  ];
  function syncMemberHintSpacing() {
    memberForm.classList.toggle(
      "has-hint",
      memberHintEls.some((el) => el.textContent !== "")
    );
  }
  function setMemberHint(el, message, isError) {
    el.textContent = message;
    el.classList.toggle("generate-hint-error", !!isError);
    syncMemberHintSpacing();
  }
  function clearMemberHints() {
    memberHintEls.forEach((el) => {
      el.textContent = "";
      el.classList.remove("generate-hint-error");
    });
    syncMemberHintSpacing();
  }
  var memberTableBodyEl = document.getElementById("memberTableBody");
  var memberLocationSortThEl = document.getElementById(
    "memberLocationSortTh"
  );
  var memberLocationSortArrowEl = document.getElementById(
    "memberLocationSortArrow"
  );
  var memberSubmitBtn = memberForm.querySelector("button[type=submit]");
  var requestSummaryEl = document.getElementById("requestSummary");
  var memberTabsEl = document.getElementById("memberTabs");
  var scheduleGridEl = document.getElementById("scheduleGrid");
  var scheduleGridScrollEl = document.getElementById("scheduleGridScroll");
  var scheduleChipRowEl = document.getElementById("scheduleChipRow");
  var scheduleInteractiveEl = document.getElementById(
    "scheduleInteractive"
  );
  var rangeAddRowEl = document.getElementById("rangeAddRow");
  var rangeDayListEl = document.getElementById("rangeDayList");
  var rangeAddBtn = document.getElementById("rangeAddBtn");
  var resetAllSchedulesBtn = document.getElementById(
    "resetAllSchedulesBtn"
  );
  var activeScheduleMemberId = null;
  function setActiveScheduleMemberId(id) {
    activeScheduleMemberId = id;
  }
  var rangeDayRows = DAYS.map((d, di) => {
    const row = document.createElement("div");
    row.className = "range-day-row";
    const name = document.createElement("span");
    name.className = "range-day-name";
    name.textContent = d;
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
      sel.value = "";
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
    const configuredRows = rangeDayRows.filter((r) => r.startSel.value !== "" || r.endSel.value !== "").map((r) => ({
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
      if (r.end < r.start) {
        alert(DAYS[r.day] + "요일의 종료 시간이 시작 시간보다 빠를 수 없습니다.");
        return;
      }
    }
    const added = configuredRows.reduce(
      (sum, r) => sum + addDesiredRange(activeMember, r.day, r.start, r.end),
      0
    );
    if (added === 0) {
      alert(
        "추가할 새 시간대가 없습니다. 이미 등록되었거나, 그 범위엔 수업이 들어갈 자리가 없습니다."
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
  function resetAllRequests() {
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
  var DAY_CHAR_TO_INDEX = {};
  DAYS.forEach((d, i) => {
    DAY_CHAR_TO_INDEX[d] = i;
  });
  function parseDayGroupToken(token) {
    if (!token || !/^[월화수목금토]+$/.test(token)) return null;
    return Array.from(token).map((ch) => DAY_CHAR_TO_INDEX[ch]);
  }
  var HOUR_DIGIT_MINUTE_SUFFIXES = [30, 40, 50];
  function tokenizeHourDigits(digits) {
    function rec(s) {
      if (s === "") return [];
      for (const len of [2, 1]) {
        if (s.length < len) continue;
        const num = parseInt(s.slice(0, len), 10);
        const valid = len === 2 ? num === 10 || num === 11 || num === 12 : num >= 1 && num <= 9;
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
  function hourMarkToStartSlot(mark) {
    const hour24 = mark.hour % 12 + 12;
    const minutes = hour24 * 60 + mark.minute;
    return (minutes - START_MIN) / SLOT_MIN;
  }
  function hourMarkLabel(mark) {
    const hour24 = mark.hour % 12 + 12;
    return minutesLabel(hour24 * 60 + mark.minute);
  }
  function groupConsecutiveMarks(marks) {
    const groups = [];
    let current = [];
    marks.forEach((mark) => {
      if (current.length > 0) {
        const prevHour24 = current[current.length - 1].hour % 12 + 12;
        const hour24 = mark.hour % 12 + 12;
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
  function expandHourRange(leftMark, rightMark) {
    const leftHour24 = leftMark.hour % 12 + 12;
    const rightHour24 = rightMark.hour % 12 + 12;
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
  function parseTimeToken(token) {
    const originalToken = token;
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
      warning = '"' + originalToken + '"에서 뒤쪽 문자("' + token.slice(clean.length) + '")는 무시했습니다.';
    }
    const tildeCount = (clean.match(/~/g) || []).length;
    if (tildeCount > 1)
      return { error: '알 수 없는 시간 표기: "' + originalToken + '"', warning };
    if (tildeCount === 1) {
      const [leftStr, rightStr] = clean.split("~");
      if (leftStr !== "" && rightStr !== "") {
        const leftMarks = tokenizeHourDigits(leftStr);
        const rightMarks = tokenizeHourDigits(rightStr);
        if (!leftMarks || leftMarks.length !== 1 || !rightMarks || rightMarks.length !== 1) {
          return {
            error: '구간 표기 해석 실패: "' + originalToken + '"',
            warning
          };
        }
        const marks3 = expandHourRange(leftMarks[0], rightMarks[0]);
        if (!marks3)
          return {
            error: '구간 표기 해석 실패: "' + originalToken + '"',
            warning
          };
        return withLateMark({ type: "point", marks: marks3, warning });
      }
      if (rightStr === "") {
        const marks3 = tokenizeHourDigits(leftStr);
        if (!marks3 || marks3.length === 0)
          return {
            error: '구간 표기 해석 실패: "' + originalToken + '"',
            warning
          };
        return withLateMark({
          type: "openStart",
          mark: marks3[marks3.length - 1],
          extraPoints: marks3.slice(0, -1),
          warning
        });
      }
      const marks2 = tokenizeHourDigits(rightStr);
      if (!marks2 || marks2.length === 0)
        return { error: '구간 표기 해석 실패: "' + originalToken + '"', warning };
      return withLateMark({
        type: "openEnd",
        mark: marks2[0],
        extraPoints: marks2.slice(1),
        warning
      });
    }
    const marks = tokenizeHourDigits(clean);
    if (!marks)
      return { error: '시간 해석 실패: "' + originalToken + '"', warning };
    return withLateMark({ type: "point", marks, warning });
  }
  function parseBulkImportLine(line) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    const name = tokens[0];
    const result = {
      raw: line.trim(),
      name,
      days: [],
      warnings: [],
      errors: [],
      clearAll: false
    };
    if (tokens.length === 2 && /^x$/i.test(tokens[1])) {
      result.clearAll = true;
      return result;
    }
    let currentDays = null;
    function applyTimeToken(tok) {
      if (!currentDays) {
        result.errors.push(
          '요일 지정 전에 나온 시간 표기라 건너뜁니다: "' + tok + '"'
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
  function parseBulkImportText(text) {
    return text.split("\n").map(parseBulkImportLine).filter(Boolean);
  }
  function describeMarks(marks) {
    return groupConsecutiveMarks(marks).map(
      (group) => group.length > 1 ? hourMarkLabel(group[0]) + "~" + hourMarkLabel(group[group.length - 1]) : hourMarkLabel(group[0])
    );
  }
  function describeDaySpecs(specs) {
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
  function findMembersByName(name) {
    return state.members.filter((m) => m.name === name);
  }
  var bulkImportConfirmOverlayEl = document.getElementById(
    "bulkImportConfirmOverlay"
  );
  var bulkImportConfirmCloseBtn = document.getElementById(
    "bulkImportConfirmCloseBtn"
  );
  var bulkImportJustAddBtn = document.getElementById(
    "bulkImportJustAddBtn"
  );
  var bulkImportResetAddBtn = document.getElementById(
    "bulkImportResetAddBtn"
  );
  var bulkImportOverlayEl = document.getElementById("bulkImportOverlay");
  var bulkImportOpenBtn = document.getElementById("bulkImportOpenBtn");
  var bulkImportCloseBtn = document.getElementById("bulkImportCloseBtn");
  var bulkImportCancelBtn = document.getElementById(
    "bulkImportCancelBtn"
  );
  var bulkImportBackBtn = document.getElementById("bulkImportBackBtn");
  var bulkImportPreviewBtn = document.getElementById(
    "bulkImportPreviewBtn"
  );
  var bulkImportApplyBtn = document.getElementById("bulkImportApplyBtn");
  var bulkImportTextareaEl = document.getElementById("bulkImportTextarea");
  var bulkImportStepInputEl = document.getElementById(
    "bulkImportStepInput"
  );
  var bulkImportStepPreviewEl = document.getElementById(
    "bulkImportStepPreview"
  );
  var bulkImportPreviewSummaryEl = document.getElementById(
    "bulkImportPreviewSummary"
  );
  var bulkImportPreviewListEl = document.getElementById(
    "bulkImportPreviewList"
  );
  var bulkImportRows = [];
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
    if (state.requests.length === 0) {
      openBulkImportModal();
      return;
    }
    bulkImportConfirmOverlayEl.classList.add("open");
  });
  bulkImportConfirmCloseBtn.addEventListener(
    "click",
    closeBulkImportConfirmModal
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
  function renderBulkImportPreview() {
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
        newCategory: "등록"
      };
    });
    bulkImportPreviewListEl.innerHTML = "";
    let willApply = 0, willCreate = 0, willSkip = 0;
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
        const locNames = m.locationIds.map((id) => locationById(id)).filter(Boolean).map((l) => l.name).join("·");
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
    bulkImportPreviewSummaryEl.innerHTML = "기존 회원 적용 " + willApply + "명 · 신규 등록 " + willCreate + "명 · 건너뛰기 " + willSkip + "명<br>적용 대상 회원의 기존 스케줄은 모두 지우고 아래 내용으로 교체합니다.";
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
    const zeroFitNames = [];
    const emptyRowNames = [];
    const clearedNames = [];
    const unparsedSkippedNames = [];
    const entriesByMemberKey = /* @__PURE__ */ new Map();
    bulkImportRows.forEach((row) => {
      if (row.choice === "__skip__") return;
      let member, isNew = false;
      if (row.choice === "__new__") {
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
        member = memberById(row.choice);
        if (!member) return;
      }
      if (!entriesByMemberKey.has(member.id)) {
        entriesByMemberKey.set(member.id, {
          member,
          isNew,
          days: /* @__PURE__ */ new Map(),
          explicitClear: false
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
        unparsedSkippedNames.push(member.name);
        return;
      }
      state.requests = state.requests.filter((r) => r.memberId !== member.id);
      let addedForMember = 0;
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
              SLOT_COUNT
            );
          } else if (spec.type === "openEnd") {
            addedForMember += addDesiredRange(
              member,
              day,
              0,
              hourMarkToStartSlot(spec.mark)
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
        zeroFitNames.join(", ") + "은(는) 마감 시간 등으로 등록된 시간이 없습니다"
      );
    if (clearedNames.length)
      notes.push(
        clearedNames.join(", ") + "은(는) 'x' 지정으로 기존 시간을 모두 삭제했습니다"
      );
    if (emptyRowNames.length)
      notes.push(
        emptyRowNames.join(", ") + "은(는) 등록할 시간이 없어 건너뛰었습니다"
      );
    if (unparsedSkippedNames.length)
      notes.push(
        unparsedSkippedNames.join(", ") + "은(는) 줄을 해석하지 못해 기존 시간을 그대로 두고 건너뛰었습니다"
      );
    const suffix = notes.length ? " (" + notes.join(" · ") + ")" : "";
    showToast(
      appliedCount + "명 스케줄 등록 완료" + suffix,
      zeroFitNames.length || emptyRowNames.length || clearedNames.length || unparsedSkippedNames.length ? "info" : "success"
    );
  });
  var memberFormLocationIds = [];
  var memberLocationDropdownOpen = false;
  function toggleMemberFormLocation(locId) {
    memberFormLocationIds = memberFormLocationIds.includes(locId) ? memberFormLocationIds.filter((id) => id !== locId) : memberFormLocationIds.concat(locId);
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
  function renderMemberLocationDropdown() {
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
    memberFormLocationIds = memberFormLocationIds.filter(
      (id) => state.locations.some((l) => l.id === id)
    );
    renderMemberLocationControl();
    renderMemberLocationDropdown();
    const hasLocations = state.locations.length > 0;
    memberSubmitBtn.disabled = !hasLocations;
    memberLocationControlEl.disabled = !hasLocations;
    setMemberHint(
      memberLocationHintEl,
      hasLocations ? "" : "설정 페이지에서 지점을 먼저 등록해주세요.",
      false
    );
  }
  var memberFormCategory = "";
  var memberCategoryDropdownOpen = false;
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
  function deleteMember(member) {
    const reqCount = state.requests.filter(
      (r) => r.memberId === member.id
    ).length;
    const msg = reqCount > 0 ? "'" + member.name + "' 회원을 삭제하면 등록된 가능 시간 " + reqCount + "건도 함께 삭제됩니다. 계속할까요?" : "'" + member.name + "' 회원을 삭제할까요?";
    if (!confirm(msg)) return;
    state.members = state.members.filter((m) => m.id !== member.id);
    state.requests = state.requests.filter((r) => r.memberId !== member.id);
    state.onceLimitedMemberIds3 = state.onceLimitedMemberIds3.filter(
      (id) => id !== member.id
    );
    state.excludedMemberIds3 = state.excludedMemberIds3.filter(
      (id) => id !== member.id
    );
    runtime.requestsChangedSinceGenerate3 = true;
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
    const newDuration = sessionDurationFor(member);
    state.requests.forEach((r) => {
      if (r.memberId === member.id) r.duration = newDuration;
    });
    runtime.requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
    showToast("회원 구분이 변경되었습니다", "success");
  }
  var editingMemberNameId = null;
  var memberLocationSortDir = null;
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
    memberLocationSortArrowEl.textContent = memberLocationSortDir === "asc" ? "▲" : memberLocationSortDir === "desc" ? "▼" : "";
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
    if (state.locations.length > 0) {
      let fixedAny = false;
      state.members.forEach((member) => {
        const validIds = member.locationIds.filter(
          (id) => state.locations.some((l) => l.id === id)
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
    const rows = memberLocationSortDir ? state.members.slice().sort((a, b) => {
      const cmp = memberPrimaryLocationName(a).localeCompare(
        memberPrimaryLocationName(b),
        "ko"
      );
      return memberLocationSortDir === "asc" ? cmp : -cmp;
    }) : state.members;
    rows.forEach((member) => {
      const tr = document.createElement("tr");
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
      const catCell = document.createElement("td");
      const catBadge = document.createElement("select");
      const categoryValue = member.category || "상담";
      catBadge.className = "chip category-chip" + (categoryValue === "상담" ? " category-chip-consult" : "");
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
      const nameCell = document.createElement("td");
      const nameWrap = document.createElement("span");
      nameWrap.className = "member-name-cell";
      nameCell.appendChild(nameWrap);
      if (editingMemberNameId === member.id) {
        let commit = function() {
          const trimmed = input.value.trim();
          const changed = trimmed && trimmed !== member.name;
          if (changed && state.members.some(
            (m) => m.id !== member.id && m.name === trimmed && m.locationIds.some((id) => member.locationIds.includes(id))
          )) {
            const proceed = confirm(
              "'" + trimmed + "' 이름의 회원이 같은 지점에 이미 있습니다. 이름만 같은 다른 회원으로 저장할까요?"
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
        };
        const input = document.createElement("input");
        input.type = "text";
        input.value = member.name;
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
      editIcon.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>';
      nameSpan.appendChild(editIcon);
      nameWrap.appendChild(nameSpan);
      tr.appendChild(nameCell);
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
      memoInput.addEventListener(
        "change",
        () => setMemberMemo(member, memoInput.value)
      );
      memoCell.appendChild(memoInput);
      tr.appendChild(memoCell);
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
    if (state.members.some(
      (m) => m.name === name && m.locationIds.some((id) => memberFormLocationIds.includes(id))
    )) {
      const proceed = confirm(
        "'" + name + "' 이름의 회원이 같은 지점에 이미 있습니다. 이름만 같은 다른 회원으로 등록할까요?"
      );
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
  var memberBulkImportOverlayEl = document.getElementById(
    "memberBulkImportOverlay"
  );
  var memberBulkImportOpenBtn = document.getElementById(
    "memberBulkImportOpenBtn"
  );
  var memberBulkImportCloseBtn = document.getElementById(
    "memberBulkImportCloseBtn"
  );
  var memberBulkImportCancelBtn = document.getElementById(
    "memberBulkImportCancelBtn"
  );
  var memberBulkImportBackBtn = document.getElementById(
    "memberBulkImportBackBtn"
  );
  var memberBulkImportPreviewBtn = document.getElementById(
    "memberBulkImportPreviewBtn"
  );
  var memberBulkImportApplyBtn = document.getElementById(
    "memberBulkImportApplyBtn"
  );
  var memberBulkImportTextareaEl = document.getElementById(
    "memberBulkImportTextarea"
  );
  var memberBulkImportStepInputEl = document.getElementById(
    "memberBulkImportStepInput"
  );
  var memberBulkImportStepPreviewEl = document.getElementById(
    "memberBulkImportStepPreview"
  );
  var memberBulkImportPreviewSummaryEl = document.getElementById(
    "memberBulkImportPreviewSummary"
  );
  var memberBulkImportPreviewListEl = document.getElementById(
    "memberBulkImportPreviewList"
  );
  var memberBulkImportRows = [];
  function parseMemberBulkLine(line) {
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
      errors: []
    };
    if (parts.length !== 3) {
      row.errors.push(
        '형식이 맞지 않습니다. "지점 / 구분 / 이름" 형식으로 입력해주세요.'
      );
      return row;
    }
    const [locPart, catPart, namePart] = parts;
    const locationNames = locPart.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    if (locationNames.length === 0) row.errors.push("지점을 입력해주세요.");
    locationNames.forEach((n) => {
      const loc = state.locations.find((l) => l.name === n);
      if (loc) row.locationIds.push(loc.id);
      else row.unmatchedLocationNames.push(n);
    });
    if (row.unmatchedLocationNames.length > 0) {
      row.errors.push(
        "등록되지 않은 지점: " + row.unmatchedLocationNames.join(", ")
      );
    }
    row.category = catPart;
    if (!CATEGORY_OPTIONS.includes(catPart)) {
      row.errors.push(
        "회원 구분은 " + CATEGORY_OPTIONS.join("/") + ' 중 하나여야 합니다: "' + catPart + '"'
      );
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
    return state.members.some(
      (m) => m.name === row.name && m.locationIds.some((id) => row.locationIds.includes(id))
    );
  }
  function renderMemberBulkImportPreview() {
    memberBulkImportPreviewListEl.innerHTML = "";
    let willAdd = 0, willSkip = 0, willError = 0;
    memberBulkImportRows.forEach((row) => {
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
      state.locations.forEach((loc) => {
        const label = document.createElement("label");
        label.style.cssText = "display:inline-flex;align-items:center;gap:4px;font-size:12.5px;";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = row.locationIds.includes(loc.id);
        cb.addEventListener("change", () => {
          if (cb.checked) row.locationIds.push(loc.id);
          else row.locationIds = row.locationIds.filter((id) => id !== loc.id);
          if (row.locationIds.length > 0)
            row.errors = row.errors.filter(
              (e) => !e.startsWith("지점을") && !e.startsWith("등록되지 않은 지점")
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
    const toAdd = memberBulkImportRows.filter(
      (row) => row.errors.length === 0 && !row.skip
    );
    if (toAdd.length === 0) return;
    toAdd.forEach((row) => {
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
  function addDesiredRange(member, day, startSlot, endSlot) {
    if (member.locationIds.length === 0) return 0;
    const duration = sessionDurationFor(member);
    const neededSlots = durationToSlots(duration);
    const existingStarts = new Set(
      state.requests.filter((r) => r.memberId === member.id && r.day === day).map((r) => r.startSlot)
    );
    const maxStart = Math.min(endSlot, SLOT_COUNT - neededSlots);
    let added = 0;
    for (let s = startSlot; s <= maxStart; s++) {
      if (existingStarts.has(s)) continue;
      state.requests.push({
        id: uid("r"),
        memberId: member.id,
        day,
        startSlot: s,
        duration
      });
      added++;
    }
    return added;
  }
  function removeRequests(reqIds) {
    const idSet = new Set(reqIds);
    state.requests = state.requests.filter((r) => !idSet.has(r.id));
    runtime.requestsChangedSinceGenerate3 = true;
    renderRequestList();
    saveState();
  }
  function mergeRequestRuns(reqs) {
    const byDay = /* @__PURE__ */ new Map();
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
  function requestRunExtraLocationIds(run) {
    return run.reqs[0] && run.reqs[0].extraLocationIds || [];
  }
  function setRunExtraLocationIds(run, ids) {
    run.reqs.forEach((r) => {
      r.extraLocationIds = ids.slice();
    });
  }
  function addExtraLocationToRun(run, locId) {
    const current = requestRunExtraLocationIds(run);
    if (current.includes(locId)) return;
    setRunExtraLocationIds(run, current.concat([locId]));
    runtime.requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
    showToast("지점이 추가되었습니다", "success");
  }
  function removeExtraLocationFromRun(run, locId) {
    setRunExtraLocationIds(
      run,
      requestRunExtraLocationIds(run).filter((id) => id !== locId)
    );
    runtime.requestsChangedSinceGenerate3 = true;
    saveState();
    renderRequestList();
    showToast("지점이 제거되었습니다", "info");
  }
  function buildRequestRunMenu(member, run, x, y) {
    const excluded = new Set(
      (member.locationIds || []).concat(requestRunExtraLocationIds(run))
    );
    const addableLocations = state.locations.filter((l) => !excluded.has(l.id));
    const items = addableLocations.length > 0 ? addableLocations.map((l) => ({
      label: l.name + " 추가",
      onClick: () => addExtraLocationToRun(run, l.id)
    })) : [{ label: "추가할 수 있는 지점이 없습니다", disabled: true }];
    const extraIds = requestRunExtraLocationIds(run);
    if (extraIds.length > 0) {
      items.push({ separator: true });
      extraIds.forEach((id) => {
        const loc = locationById(id);
        if (!loc) return;
        items.push({
          label: loc.name + " 제거",
          danger: true,
          onClick: () => removeExtraLocationFromRun(run, id)
        });
      });
    }
    items.push({ separator: true });
    items.push({
      label: "가능 시간 삭제",
      danger: true,
      onClick: () => removeRequests(run.reqs.map((r) => r.id))
    });
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
          link.addEventListener("click", (e) => {
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
    const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
    const sortedMembers = state.members.slice().sort((a, b) => {
      const ao = locOrder.has(a.locationIds[0]) ? locOrder.get(a.locationIds[0]) : Infinity;
      const bo = locOrder.has(b.locationIds[0]) ? locOrder.get(b.locationIds[0]) : Infinity;
      return ao - bo;
    });
    if (!activeScheduleMemberId || !state.members.some((m) => m.id === activeScheduleMemberId)) {
      activeScheduleMemberId = null;
    }
    const activeMember = activeScheduleMemberId ? memberById(activeScheduleMemberId) : null;
    const registeredCount = new Set(state.requests.map((r) => r.memberId)).size;
    requestSummaryEl.textContent = "등록 " + registeredCount + "명 · 미등록 " + (state.members.length - registeredCount) + "명";
    requestSummaryEl.style.display = "";
    sortedMembers.forEach((member) => {
      const reqCount = state.requests.filter(
        (r) => r.memberId === member.id
      ).length;
      const hasRequests = reqCount > 0;
      const tab = document.createElement("div");
      tab.className = "member-tab" + (hasRequests ? " has-req" : " no-req") + (member.id === activeScheduleMemberId ? " active" : "");
      tab.title = hasRequests ? "가능 시간 " + reqCount + "건 등록됨" : "가능 시간 미등록";
      member.locationIds.forEach((locId) => {
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
    const myReqs = state.requests.filter((r) => r.memberId === activeMember.id);
    const color = memberColor(activeMember.id);
    const memberLabel = activeMember.name + ((activeMember.category || "상담") === "상담" ? " (상담)" : "");
    const runs = mergeRequestRuns(myReqs);
    const memberLocNames = activeMember.locationIds.map((id) => locationById(id)).filter(Boolean).map((l) => l.name).join(" · ");
    const breakSlots = durationToSlots(BREAK_MIN);
    const scheduleGridRange = businessHoursGridRange();
    let rangeStartSlot = scheduleGridRange.rangeStartSlot;
    let rangeEndSlot = scheduleGridRange.rangeEndSlot;
    myReqs.forEach((r) => {
      rangeStartSlot = Math.min(rangeStartSlot, r.startSlot);
      rangeEndSlot = Math.max(
        rangeEndSlot,
        r.startSlot + durationToSlots(r.duration)
      );
    });
    renderGrid(scheduleGridEl, runtime.availableCells, {
      blocks: runs.map((run) => {
        const displayEndSlot = Math.min(run.endSlot + breakSlots, SLOT_COUNT);
        const extraNames = requestRunExtraLocationIds(run).map((id) => locationById(id)).filter(Boolean).map((l) => l.name);
        return {
          day: run.day,
          startSlot: run.startSlot,
          duration: (displayEndSlot - run.startSlot) * SLOT_MIN,
          label: memberLabel,
          loc: memberLocNames + (extraNames.length > 0 ? " +" + extraNames.join(",") : ""),
          sublabel: slotLabel(run.startSlot) + "~" + minutesLabel(START_MIN + displayEndSlot * SLOT_MIN),
          color,
          onDelete: () => removeRequests(run.reqs.map((r) => r.id)),
          contextMenuItems: (x, y) => buildRequestRunMenu(activeMember, run, x, y)
        };
      }),
      rangeStartSlot,
      rangeEndSlot
    });
    if (myReqs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "generate-hint";
      empty.textContent = '위에서 요일별로 시간대를 고르고 "한 번에 추가"를 눌러 가능 시간을 추가하세요.';
      scheduleChipRowEl.appendChild(empty);
    }
  }

  // src/schedule3.js
  function confirmSession(container, reqId, onDone) {
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    if (container.confirmedIds.includes(reqId)) return;
    pushManualUndo(container);
    container.confirmedIds.push(reqId);
    saveState();
    onDone();
    showToast("스케줄이 확정되었습니다", "success");
  }
  function unconfirmSession(container, reqId, onDone) {
    if (!(container.confirmedIds || []).includes(reqId)) return;
    pushManualUndo(container);
    container.confirmedIds = container.confirmedIds.filter((id) => id !== reqId);
    saveState();
    onDone();
    showToast("스케줄 확정이 취소되었습니다", "info");
  }
  function maxSessionsFor3(member) {
    if (!member) return 1;
    if (state.onceLimitedMemberIds3.includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }
  function eligibleSwapMembersFor(container, req) {
    const dayAssigned = container.assigned.filter((a) => a.day === req.day && a.id !== req.id).sort((a, b) => a.startSlot - b.startSlot);
    const prevAssigned = dayAssigned.filter((a) => a.startSlot < req.startSlot).pop() || null;
    const nextAssigned = dayAssigned.find((a) => a.startSlot > req.startSlot) || null;
    const arrivedViaTravel = !!prevAssigned && travelMinutes(prevAssigned.locationId, req.locationId) > 0;
    const departsViaTravel = !!nextAssigned && travelMinutes(req.locationId, nextAssigned.locationId) > 0;
    const soloTravelBlocked = arrivedViaTravel && departsViaTravel;
    const soloIds = soloTravelBlocked ? soloTravelMemberIds() : null;
    const results = [];
    const seenMemberIds = /* @__PURE__ */ new Set();
    state.requests.forEach((other) => {
      if (other.memberId === req.memberId) return;
      if (other.day !== req.day || other.startSlot !== req.startSlot || other.duration !== req.duration)
        return;
      if (seenMemberIds.has(other.memberId)) return;
      const member = memberById(other.memberId);
      if (!member) return;
      if (state.excludedMemberIds3.includes(member.id)) return;
      if (!candidateLocationsForRequest(other).includes(req.locationId)) return;
      if (soloTravelBlocked && soloIds.has(member.id)) return;
      let weekCount = 0;
      let sameDayCount = 0;
      container.assigned.forEach((a) => {
        if (a.memberId !== member.id || a.id === req.id) return;
        weekCount++;
        if (a.day === req.day) sameDayCount++;
      });
      if (sameDayCount > 0) return;
      if (weekCount >= maxSessionsFor3(member)) return;
      seenMemberIds.add(member.id);
      results.push(member);
    });
    results.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return results;
  }
  var manualUndoStacks = /* @__PURE__ */ new WeakMap();
  var MANUAL_UNDO_LIMIT = 20;
  function snapshotContainer(container) {
    return {
      assigned: container.assigned.map((a) => ({ ...a })),
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
  function swapSessionMember(container, req, newMember, onDone) {
    const newReq = state.requests.find(
      (r) => r.memberId === newMember.id && r.day === req.day && r.startSlot === req.startSlot && r.duration === req.duration
    );
    if (!newReq) return;
    const idx = container.assigned.findIndex((a) => a.id === req.id);
    if (idx === -1) return;
    pushManualUndo(container);
    container.assigned[idx] = {
      id: newReq.id,
      memberId: newMember.id,
      day: req.day,
      startSlot: req.startSlot,
      duration: req.duration,
      locationId: req.locationId
    };
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    container.confirmedIds = container.confirmedIds.filter((id) => id !== req.id);
    container.confirmedIds.push(newReq.id);
    saveState();
    onDone();
    showToast(newMember.name + "(으)로 교체되었습니다", "success");
  }
  function findOccupyingAssigned(container, req, targetDay, targetStartSlot) {
    const durSlots = durationToSlots(req.duration);
    return container.assigned.find(
      (a) => a.id !== req.id && a.day === targetDay && targetStartSlot < a.startSlot + durationToSlots(a.duration) && targetStartSlot + durSlots > a.startSlot
    ) || null;
  }
  function validateMove(container, req, targetDay, targetStartSlot, ignoreIds) {
    const ignoreSet = /* @__PURE__ */ new Set([req.id, ...ignoreIds || []]);
    if (targetDay === req.day && targetStartSlot === req.startSlot) {
      return { ok: true, noop: true, newReq: req, locationId: req.locationId };
    }
    const newReq = state.requests.find(
      (r) => r.memberId === req.memberId && r.day === targetDay && r.startSlot === targetStartSlot && r.duration === req.duration
    );
    if (!newReq) {
      return {
        ok: false,
        message: "이 회원은 해당 시간에 신청한 이력이 없습니다"
      };
    }
    const sameDayConflict = container.assigned.some(
      (a) => !ignoreSet.has(a.id) && a.memberId === req.memberId && a.day === targetDay
    );
    if (sameDayConflict) {
      return {
        ok: false,
        message: "같은 요일에는 하루 최대 1회만 배정할 수 있습니다"
      };
    }
    const validLocations = candidateLocationsForRequest(newReq);
    const locationId = validLocations.includes(req.locationId) ? req.locationId : validLocations[0];
    if (!locationId) {
      return {
        ok: false,
        message: "해당 지점에서는 이 시간을 이용할 수 없습니다"
      };
    }
    const durSlots = durationToSlots(req.duration);
    const dayAssigned = container.assigned.filter((a) => a.day === targetDay && !ignoreSet.has(a.id)).sort((a, b) => a.startSlot - b.startSlot);
    const prevAssigned = dayAssigned.filter((a) => a.startSlot < targetStartSlot).pop() || null;
    const nextAssigned = dayAssigned.find((a) => a.startSlot >= targetStartSlot) || null;
    if (prevAssigned) {
      const prevEnd = prevAssigned.startSlot + durationToSlots(prevAssigned.duration);
      const gapSlots = requiredGapMin(prevAssigned.locationId, locationId) / SLOT_MIN;
      if (prevEnd + gapSlots > targetStartSlot) {
        return {
          ok: false,
          message: "바로 앞 수업과 시간이 겹치거나 이동 시간이 부족합니다"
        };
      }
    }
    if (nextAssigned) {
      const gapSlots = requiredGapMin(locationId, nextAssigned.locationId) / SLOT_MIN;
      if (targetStartSlot + durSlots + gapSlots > nextAssigned.startSlot) {
        return {
          ok: false,
          message: "바로 다음 수업과 시간이 겹치거나 이동 시간이 부족합니다"
        };
      }
    }
    const arrivedViaTravel = !!prevAssigned && travelMinutes(prevAssigned.locationId, locationId) > 0;
    const departsViaTravel = !!nextAssigned && travelMinutes(locationId, nextAssigned.locationId) > 0;
    if (arrivedViaTravel && departsViaTravel && soloTravelMemberIds().has(req.memberId)) {
      return {
        ok: false,
        message: "이 회원은 이동으로 앞뒤가 막힌 자리에는 배정할 수 없습니다"
      };
    }
    return { ok: true, newReq, locationId };
  }
  function moveSession(container, req, targetDay, targetStartSlot, onDone) {
    const result = validateMove(container, req, targetDay, targetStartSlot);
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    if (result.noop) return;
    const { newReq, locationId } = result;
    const idx = container.assigned.findIndex((a) => a.id === req.id);
    if (idx === -1) return;
    pushManualUndo(container);
    container.assigned[idx] = {
      id: newReq.id,
      memberId: req.memberId,
      day: targetDay,
      startSlot: targetStartSlot,
      duration: req.duration,
      locationId
    };
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    container.confirmedIds = container.confirmedIds.filter((id) => id !== req.id);
    container.confirmedIds.push(newReq.id);
    saveState();
    onDone();
    showToast("일정이 이동되었습니다", "success");
  }
  function prepareSwap(container, req, occupying) {
    if (occupying.duration !== req.duration) {
      return { ok: false, message: "길이가 서로 달라 자리를 맞바꿀 수 없습니다" };
    }
    const reqA2 = state.requests.find(
      (r) => r.memberId === req.memberId && r.day === occupying.day && r.startSlot === occupying.startSlot && r.duration === req.duration
    );
    const reqB2 = state.requests.find(
      (r) => r.memberId === occupying.memberId && r.day === req.day && r.startSlot === req.startSlot && r.duration === occupying.duration
    );
    if (!reqA2 || !reqB2) {
      return {
        ok: false,
        message: "두 회원 모두 상대방 시간에 신청한 이력이 있어야 자리를 맞바꿀 수 있습니다"
      };
    }
    const checkA = validateMove(
      container,
      req,
      occupying.day,
      occupying.startSlot,
      [occupying.id]
    );
    if (!checkA.ok) return { ok: false, message: checkA.message };
    const checkB = validateMove(container, occupying, req.day, req.startSlot, [
      req.id
    ]);
    if (!checkB.ok) return { ok: false, message: checkB.message };
    return {
      ok: true,
      reqA2,
      reqB2,
      locA: checkA.locationId,
      locB: checkB.locationId
    };
  }
  function attemptSwap(container, req, occupying, onDone) {
    const plan = prepareSwap(container, req, occupying);
    if (!plan.ok) {
      showToast(plan.message, "error");
      return;
    }
    const idxA = container.assigned.findIndex((a) => a.id === req.id);
    const idxB = container.assigned.findIndex((a) => a.id === occupying.id);
    if (idxA === -1 || idxB === -1) return;
    pushManualUndo(container);
    container.assigned[idxA] = {
      id: plan.reqA2.id,
      memberId: req.memberId,
      day: occupying.day,
      startSlot: occupying.startSlot,
      duration: req.duration,
      locationId: plan.locA
    };
    container.assigned[idxB] = {
      id: plan.reqB2.id,
      memberId: occupying.memberId,
      day: req.day,
      startSlot: req.startSlot,
      duration: occupying.duration,
      locationId: plan.locB
    };
    if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
    container.confirmedIds = container.confirmedIds.filter(
      (id) => id !== req.id && id !== occupying.id
    );
    container.confirmedIds.push(plan.reqA2.id, plan.reqB2.id);
    saveState();
    onDone();
    showToast("두 자리를 맞바꿨습니다", "success");
  }
  function moveOrSwapSession(container, req, targetDay, targetStartSlot, onDone) {
    const occupying = findOccupyingAssigned(
      container,
      req,
      targetDay,
      targetStartSlot
    );
    if (occupying) {
      attemptSwap(container, req, occupying, onDone);
    } else {
      moveSession(container, req, targetDay, targetStartSlot, onDone);
    }
  }
  function canMoveOrSwapTo(container, req, targetDay, targetStartSlot) {
    const occupying = findOccupyingAssigned(
      container,
      req,
      targetDay,
      targetStartSlot
    );
    if (!occupying) {
      const ok2 = validateMove(container, req, targetDay, targetStartSlot).ok;
      return { ok: ok2, kind: ok2 ? "move" : "invalid" };
    }
    const ok = prepareSwap(container, req, occupying).ok;
    return { ok, kind: ok ? "swap" : "invalid" };
  }
  var TRAVEL_SHIFT_SLOTS = 30 / SLOT_MIN;
  function travelShiftMenuItems(container, nextReq, onDone) {
    return [
      {
        label: "다음 수업 30분 뒤로 미루기 (여유 늘리기)",
        onClick: () => moveOrSwapSession(
          container,
          nextReq,
          nextReq.day,
          nextReq.startSlot + TRAVEL_SHIFT_SLOTS,
          onDone
        )
      },
      {
        label: "다음 수업 30분 앞당기기 (여유 줄이기)",
        onClick: () => moveOrSwapSession(
          container,
          nextReq,
          nextReq.day,
          nextReq.startSlot - TRAVEL_SHIFT_SLOTS,
          onDone
        )
      }
    ];
  }
  function schedule2ToBlocks(assigned, { result, onDone } = {}) {
    const confirmedIds = new Set(result && result.confirmedIds || []);
    return assigned.map((r) => {
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
  function schedule2ToTravelBlocks(container, onDone) {
    const assigned = container.assigned;
    const byDay = /* @__PURE__ */ new Map();
    assigned.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const travelBlocks = [];
    byDay.forEach((reqs) => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        const startSlot = prev.startSlot + durationToSlots(prev.duration);
        const mins = travelMinutes(prev.locationId, cur.locationId);
        if (mins > 0) {
          travelBlocks.push({
            day: prev.day,
            startSlot,
            duration: mins,
            label: "이동 " + mins + "분",
            type: "travel",
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
  function eligibleMutualSwapsFor(container, req) {
    const results = [];
    const seenMemberIds = /* @__PURE__ */ new Set();
    container.assigned.forEach((occupying) => {
      if (occupying.id === req.id) return;
      if (occupying.day !== req.day || occupying.locationId !== req.locationId)
        return;
      if (occupying.memberId === req.memberId || seenMemberIds.has(occupying.memberId))
        return;
      if (!prepareSwap(container, req, occupying).ok) return;
      const member = memberById(occupying.memberId);
      if (!member) return;
      seenMemberIds.add(occupying.memberId);
      results.push({ member, occupying });
    });
    results.sort((a, b) => a.member.name.localeCompare(b.member.name, "ko"));
    return results;
  }
  function sessionSwapMenuItems(container, req, isConfirmed, onDone) {
    const member = memberById(req.memberId);
    const items = [
      {
        label: isConfirmed ? "확정 취소" : "현재 인원(" + (member ? member.name : "?") + ")으로 확정",
        onClick: () => isConfirmed ? unconfirmSession(container, req.id, onDone) : confirmSession(container, req.id, onDone)
      },
      { separator: true }
    ];
    const swapMembers = eligibleSwapMembersFor(container, req);
    if (swapMembers.length === 0) {
      items.push({ label: "교체 가능한 인원 없음", disabled: true });
    } else {
      swapMembers.forEach((m) => {
        items.push({
          label: m.name + "(으)로 교체",
          onClick: () => swapSessionMember(container, req, m, onDone)
        });
      });
    }
    const mutualSwaps = eligibleMutualSwapsFor(container, req);
    if (mutualSwaps.length > 0) {
      items.push({ separator: true });
      mutualSwaps.forEach(({ member: m, occupying }) => {
        items.push({
          label: m.name + " 회원과 맞교체",
          onClick: () => attemptSwap(container, req, occupying, onDone)
        });
      });
    }
    return items;
  }
  function candidateToBlocks(candidate, onDone = renderSchedule3Result) {
    const confirmedIds = new Set(candidate.confirmedIds || []);
    return candidate.assigned.map((r) => {
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
        contextMenuItems: () => sessionSwapMenuItems(candidate, r, isConfirmed, onDone),
        onMove: (targetDay, targetSlot) => moveOrSwapSession(candidate, r, targetDay, targetSlot, onDone),
        canMoveTo: (targetDay, targetSlot) => canMoveOrSwapTo(candidate, r, targetDay, targetSlot)
      };
    });
  }
  function candidateToTravelBlocks(candidate, onDone = renderSchedule3Result) {
    const byDay = /* @__PURE__ */ new Map();
    candidate.assigned.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const travelBlocks = [];
    byDay.forEach((reqs) => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], cur = sorted[i];
        const startSlot = prev.startSlot + durationToSlots(prev.duration);
        const gapMin = (cur.startSlot - startSlot) * SLOT_MIN;
        if (gapMin <= 0) continue;
        const mins = travelMinutes(prev.locationId, cur.locationId);
        if (mins > 0) {
          travelBlocks.push({
            day: prev.day,
            startSlot,
            duration: mins,
            label: "이동 " + mins + "분",
            type: "travel",
            moveDurationSlots: durationToSlots(cur.duration),
            onMove: (targetDay, targetSlot) => moveOrSwapSession(candidate, cur, targetDay, targetSlot, onDone),
            canMoveTo: (targetDay, targetSlot) => canMoveOrSwapTo(candidate, cur, targetDay, targetSlot),
            contextMenuItems: () => travelShiftMenuItems(candidate, cur, onDone)
          });
        } else if (BREAK_MIN > 0) {
          const breakMin = Math.min(BREAK_MIN, gapMin);
          travelBlocks.push({
            day: prev.day,
            startSlot,
            duration: breakMin,
            label: "휴식 " + breakMin + "분",
            type: "break"
          });
        }
      }
    });
    return travelBlocks;
  }
  function formatMinutesLabel(minutes) {
    return Math.round(minutes) + "분";
  }
  var pageEls = {
    settings: document.getElementById("pageSettings"),
    schedule3: document.getElementById("pageSchedule3"),
    members: document.getElementById("pageMembers"),
    memberSchedule: document.getElementById("pageMemberSchedule")
  };
  var navItems = document.querySelectorAll(".nav-item");
  function goToPage(pageId) {
    if (!pageEls[pageId]) return;
    runtime.currentPage = pageId;
    Object.keys(pageEls).forEach((key) => {
      pageEls[key].classList.toggle("active", key === pageId);
    });
    navItems.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === pageId);
    });
    if (pageId === "memberSchedule") {
      setActiveScheduleMemberId(null);
      renderRequestList();
    }
    if (pageId === "schedule3" && runtime.requestsChangedSinceGenerate3) {
      runtime.requestsChangedSinceGenerate3 = false;
      if (runtime.candidates.length > 0 || runtime.schedule3Result.candidateAList.some(Boolean)) {
        runtime.candidates = [];
        runtime.schedule3Result = { candidateAList: [null, null, null] };
        resetCandidateSession();
        renderSchedule3Result();
        saveState();
        generateHint3El.textContent = "신청 시간이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
      }
    }
    saveState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => goToPage(btn.dataset.page));
  });
  window.addEventListener("beforeunload", saveState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveState();
  });
  function createMemberSelectionWidget(opts) {
    const {
      idsKey,
      conflictIdsKey,
      conflictMessage,
      eligibleFilter,
      emptyMembersMessage,
      chipClass,
      elIds,
      onChanged
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
      state[idsKey] = state[idsKey].filter((id) => id !== memberId);
      changed();
    }
    function renderChips() {
      chipRowEl.innerHTML = "";
      chipRowEl.appendChild(msEl);
      const selectedMembers = state[idsKey].map((id) => memberById(id)).filter((m) => m && eligibleFilter(m)).sort(compareOnceLimitMembers);
      if (selectedMembers.length === 0) {
        const placeholder = document.createElement("span");
        placeholder.className = "ms-placeholder";
        placeholder.textContent = "설정된 회원 없음";
        chipRowEl.appendChild(placeholder);
        return;
      }
      selectedMembers.forEach((m) => {
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
      const addable = eligibleMembers.filter((m) => !state[idsKey].includes(m.id)).sort(compareOnceLimitMembers);
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
      addable.forEach((m) => {
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
    controlEl.addEventListener("click", () => {
      if (dropdownOpen) close();
      else open();
    });
    document.addEventListener("click", (e) => {
      if (dropdownOpen && !msEl.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dropdownOpen) close();
    });
    return {
      renderAll() {
        state[idsKey] = state[idsKey].filter((id) => {
          const m = memberById(id);
          return m && eligibleFilter(m);
        });
        renderChips();
        renderDropdown();
      }
    };
  }
  function onSchedule3SelectionChanged() {
    if (runtime.candidates.length > 0 || runtime.schedule3Result.candidateAList.some(Boolean)) {
      runtime.candidates = [];
      runtime.schedule3Result = { candidateAList: [null, null, null] };
      resetCandidateSession();
      renderSchedule3Result();
      generateHint3El.textContent = "회원 선택이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    } else {
      runtime.requestsChangedSinceGenerate3 = true;
    }
  }
  var onceLimit3Widget = createMemberSelectionWidget({
    idsKey: "onceLimitedMemberIds3",
    conflictIdsKey: "excludedMemberIds3",
    conflictMessage: "미배정 회원에 추가되어 있는 회원입니다.\n미배정 회원에서 삭제 후 다시 추가해 주세요.",
    eligibleFilter: isOnceLimitEligible,
    emptyMembersMessage: "등록 회원이 없습니다. (상담 회원은 이미 항상 1회로 제한됩니다)",
    chipClass: "chip",
    elIds: {
      ms: "onceLimitMs3",
      control: "onceLimitControl3",
      chipRow: "onceLimitChipRow3",
      dropdown: "onceLimitDropdown3"
    },
    onChanged: onSchedule3SelectionChanged
  });
  var excluded3Widget = createMemberSelectionWidget({
    idsKey: "excludedMemberIds3",
    conflictIdsKey: "onceLimitedMemberIds3",
    conflictMessage: "1회 제한 회원에 추가되어 있는 회원입니다.\n1회 제한 회원에서 삭제 후 다시 추가해 주세요.",
    eligibleFilter: () => true,
    emptyMembersMessage: "등록된 회원이 없습니다.",
    chipClass: "chip chip-excluded",
    elIds: {
      ms: "excludedMs3",
      control: "excludedControl3",
      chipRow: "excludedChipRow3",
      dropdown: "excludedDropdown3"
    },
    onChanged: onSchedule3SelectionChanged
  });
  async function generateSchedule3Async(onProgress, { genA = true, genBC = true } = {}) {
    const excludedIds3 = state.excludedMemberIds3;
    const onceLimitIds3 = state.onceLimitedMemberIds3;
    let v1Built = null;
    let v2Result = null;
    if (genBC) {
      const bcWeight = genA ? 0.5 : 1;
      v1Built = await withSelectionOverride(
        excludedIds3,
        onceLimitIds3,
        () => generateCandidatesAsync((progress) => onProgress(progress * bcWeight))
      );
    }
    if (genA) {
      const aStart = genBC ? 0.5 : 0;
      const aWeight = genBC ? 0.5 : 1;
      v2Result = await withSelectionOverride(
        excludedIds3,
        onceLimitIds3,
        () => generateSchedule2Async(
          (progress) => onProgress(aStart + progress * aWeight)
        )
      );
    }
    onProgress(1);
    return {
      candidateB: v1Built ? v1Built.built[0] || null : null,
      // 생성1의 후보A(전략 0, 인원 최대)
      candidateC: v1Built ? v1Built.built[1] || null : null,
      // 생성1의 후보B(전략 1, 수업 횟수 최대)
      poolsBC: v1Built ? v1Built.pools : null,
      // strategyIndex -> 배치 페이저용 동점 풀
      candidateAList: v2Result ? v2Result.map((c) => c.result) : null,
      // 후보A-1/A-2/A-3
      candidateAPools: v2Result ? v2Result.map((c) => c.pool) : null,
      // 카드 인덱스 -> 배치 페이저용 동점 풀
      genA,
      genBC
    };
  }
  var generateHint3El = document.getElementById("generateHint3");
  var candidates3El = document.getElementById("candidates3");
  var generateBtnA3El = document.getElementById("generateBtnA3");
  var generateBtnA3LabelEl = document.getElementById("generateBtnA3Label");
  var generateBtnA3CancelEl = document.getElementById(
    "generateBtnA3Cancel"
  );
  var generateProgressWrapA3El = document.getElementById(
    "generateProgressWrapA3"
  );
  var generateProgressFillA3El = document.getElementById(
    "generateProgressFillA3"
  );
  var generateProgressTextA3El = document.getElementById(
    "generateProgressTextA3"
  );
  var generateBtnBC3El = document.getElementById("generateBtnBC3");
  var generateBtnBC3LabelEl = document.getElementById(
    "generateBtnBC3Label"
  );
  var generateBtnBC3CancelEl = document.getElementById(
    "generateBtnBC3Cancel"
  );
  var generateProgressWrapBC3El = document.getElementById(
    "generateProgressWrapBC3"
  );
  var generateProgressFillBC3El = document.getElementById(
    "generateProgressFillBC3"
  );
  var generateProgressTextBC3El = document.getElementById(
    "generateProgressTextBC3"
  );
  function renderSchedule3Result() {
    candidates3El.innerHTML = "";
    const gridRange = businessHoursGridRange();
    const colLeft = document.createElement("div");
    colLeft.className = "runtime.candidates-col";
    const colRight = document.createElement("div");
    colRight.className = "runtime.candidates-col";
    candidates3El.appendChild(colLeft);
    candidates3El.appendChild(colRight);
    function buildCard(title, desc, result, blocks, travelBlocks, idleMinutes, strategyIndex, pool, onSelectPoolVariant, columnEl) {
      const card = document.createElement("div");
      card.className = "candidate-card";
      const head = document.createElement("div");
      head.className = "candidate-card-head";
      const titleEl = document.createElement("h3");
      titleEl.className = "candidate-title";
      titleEl.textContent = title;
      head.appendChild(titleEl);
      {
        let makeIconBtn = function(iconSvg, label, tooltip) {
          const b2 = document.createElement("button");
          b2.type = "button";
          b2.className = "btn btn-ghost icon-btn regen-candidate-btn";
          b2.setAttribute("aria-label", label);
          b2.title = tooltip;
          b2.innerHTML = iconSvg;
          return b2;
        }, addDivider = function() {
          const d = document.createElement("span");
          d.className = "action-divider";
          actions.appendChild(d);
        };
        const actions = document.createElement("div");
        actions.className = "candidate-card-actions";
        const ICON_UNDO_MANUAL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
        const undoManualBtn = makeIconBtn(
          ICON_UNDO_MANUAL,
          "편집 취소",
          "방금 드래그로 옮기거나 맞바꾸거나 교체·확정한 것을 취소합니다."
        );
        undoManualBtn.disabled = !hasManualUndo(result);
        undoManualBtn.addEventListener("click", () => {
          undoManualEdit(result, renderSchedule3Result);
        });
        actions.appendChild(undoManualBtn);
        if (strategyIndex != null) {
          addDivider();
          const undoStackForThis = candidateUndoStack[strategyIndex] || [];
          const ICON_PREV_CANDIDATE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
          const undoBtn = makeIconBtn(
            ICON_PREV_CANDIDATE,
            "이전 후보",
            "재생성하기 전의 후보로 되돌아갑니다."
          );
          undoBtn.disabled = undoStackForThis.length === 0;
          undoBtn.addEventListener("click", () => {
            restorePreviousCandidate(strategyIndex, renderSchedule3Result);
          });
          actions.appendChild(undoBtn);
          const ICON_REGEN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.65 5.64L1 10m22 4-4.65 4.36A9 9 0 0 1 3.51 15"/></svg>';
          const regenBtn = makeIconBtn(
            ICON_REGEN,
            "다음 후보",
            "이 후보만 같은 전략 안에서 다시 계산합니다."
          );
          const regenBtnIconHtml = regenBtn.innerHTML;
          regenBtn.disabled = !hasRegenerableEligible(strategyIndex);
          regenBtn.addEventListener("click", async () => {
            regenBtn.disabled = true;
            undoBtn.disabled = true;
            regenBtn.classList.add("icon-btn-loading");
            try {
              await withSelectionOverride(
                state.excludedMemberIds3,
                state.onceLimitedMemberIds3,
                () => regenerateCandidate(
                  strategyIndex,
                  (progress) => {
                    regenBtn.textContent = Math.round(progress * 100) + "%";
                  },
                  renderSchedule3Result
                )
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
        const saveImageBtn = makeIconBtn(
          ICON_SAVE,
          "이미지로 저장",
          "이 후보 카드를 이미지로 저장합니다."
        );
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
      if (pool && pool.length > 1) {
        const poolIdx = pool.indexOf(result);
        if (poolIdx !== -1) {
          let selectPoolVariant = function(newIdx) {
            onSelectPoolVariant(newIdx);
            saveState();
            renderSchedule3Result();
          };
          const pager = document.createElement("div");
          pager.className = "candidate-pool-pager";
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
          const pagerHint = document.createElement("p");
          pagerHint.className = "pool-pager-hint";
          pagerHint.textContent = "새로고침하면 이 목록은 사라질 수 있어요.";
          card.appendChild(pagerHint);
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
      renderGrid(gridEl, runtime.availableCells, {
        blocks,
        travelBlocks,
        rangeStartSlot: gridRange.rangeStartSlot,
        rangeEndSlot: gridRange.rangeEndSlot
      });
      if (result.unassignedMembers.length > 0) {
        const box = document.createElement("div");
        box.className = "unassigned-box unassigned-box-danger";
        box.innerHTML = "<b>미배정 회원 (" + result.unassignedMembers.length + "명)</b> · " + result.unassignedMembers.map((m) => m.name).join(", ");
        card.appendChild(box);
      }
      const sessionsByMember = /* @__PURE__ */ new Map();
      result.assigned.forEach((r) => {
        if (!sessionsByMember.has(r.memberId))
          sessionsByMember.set(r.memberId, []);
        sessionsByMember.get(r.memberId).push(r);
      });
      const doubleAssignedMembers = [];
      sessionsByMember.forEach((sessions, memberId) => {
        if (sessions.length !== 2) return;
        const member = memberById(memberId);
        if (!member) return;
        const locNames = [
          ...new Set(
            sessions.map((s) => {
              const loc = locationById(s.locationId);
              return loc ? loc.name : null;
            }).filter(Boolean)
          )
        ];
        const locLabel = locNames.map((name) => "(" + name.charAt(0) + ")").join("");
        doubleAssignedMembers.push({ member, locLabel });
      });
      doubleAssignedMembers.sort(
        (a, b2) => a.member.name.localeCompare(b2.member.name, "ko")
      );
      if (doubleAssignedMembers.length > 0) {
        const box = document.createElement("div");
        box.className = "unassigned-box double-assigned-box";
        box.innerHTML = "<b>2회 배정 회원 (" + doubleAssignedMembers.length + "명)</b> · " + doubleAssignedMembers.map((d) => d.locLabel + " " + d.member.name).join(", ");
        card.appendChild(box);
      }
      columnEl.appendChild(card);
    }
    function buildPlaceholderCard(title, desc, columnEl) {
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
      columnEl.appendChild(card);
    }
    for (let i = 0; i < SCHEDULE2_CARD_COUNT; i++) {
      const aTitle = "후보A-" + (i + 1) + " - 인원 최대 (빈 시간 허용)";
      const aDesc = "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.";
      const a = runtime.schedule3Result.candidateAList[i];
      if (a) {
        buildCard(
          aTitle,
          aDesc,
          a,
          schedule2ToBlocks(a.assigned, {
            result: a,
            onDone: renderSchedule3Result
          }),
          schedule2ToTravelBlocks(a, renderSchedule3Result).concat(
            schedule2ToIdleBlocks(a.assigned)
          ),
          schedule2TotalIdleMinutes(a.assigned),
          null,
          candidateAPools[i],
          (newIdx) => {
            runtime.schedule3Result.candidateAList[i] = candidateAPools[i][newIdx];
          },
          colLeft
        );
      } else {
        buildPlaceholderCard(aTitle, aDesc, colLeft);
      }
    }
    const b = runtime.candidates[0];
    if (b) {
      buildCard(
        "후보B - 인원 최대 (빈 시간 최소화)",
        "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.",
        b,
        candidateToBlocks(b, renderSchedule3Result),
        candidateToTravelBlocks(b),
        schedule2TotalIdleMinutes(b.assigned),
        0,
        candidatePools[0],
        (newIdx) => {
          runtime.candidates[0] = candidatePools[0][newIdx];
        },
        colRight
      );
    } else {
      buildPlaceholderCard(
        "후보B - 인원 최대 (빈 시간 최소화)",
        "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.",
        colRight
      );
    }
    const c = runtime.candidates[1];
    if (c) {
      buildCard(
        "후보C - 수업 횟수 최대",
        "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.",
        c,
        candidateToBlocks(c, renderSchedule3Result),
        candidateToTravelBlocks(c),
        schedule2TotalIdleMinutes(c.assigned),
        1,
        candidatePools[1],
        (newIdx) => {
          runtime.candidates[1] = candidatePools[1][newIdx];
        },
        colRight
      );
    } else {
      buildPlaceholderCard(
        "후보C - 수업 횟수 최대",
        "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.",
        colRight
      );
    }
  }
  async function runGenerate3({
    genA,
    genBC,
    idleLabel,
    btnEl,
    labelEl,
    cancelEl,
    progressWrapEl,
    progressFillEl,
    progressTextEl
  }) {
    if (runtime.generationInProgress) {
      showToast(
        "다른 후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.",
        "info"
      );
      return;
    }
    if (state.locations.length === 0) {
      generateHint3El.textContent = "먼저 설정 페이지에서 지점을 등록해주세요.";
      return;
    }
    if (runtime.availableCells.size === 0) {
      generateHint3El.textContent = "먼저 설정 페이지에서 근무 가능 시간을 설정해주세요.";
      return;
    }
    if (state.requests.length === 0) {
      generateHint3El.textContent = "먼저 회원 스케줄 추가 페이지에서 가능 시간을 등록해주세요.";
      return;
    }
    generateHint3El.textContent = "";
    runtime.generationInProgress = true;
    runtime.generationCancelRequested = false;
    const prevCandidateAList = runtime.schedule3Result.candidateAList;
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
      let pickCandidateASlot = function(prev, freshResult, freshPool) {
        const newIsBetter = !prev || isSchedule2ResultBetter(freshResult, prev);
        if (newIsBetter) {
          const pool = freshPool || [];
          if (!pool.includes(freshResult)) {
            if (pool.length >= MAX_POOL_VARIANTS)
              pool.length = MAX_POOL_VARIANTS - 1;
            pool.unshift(freshResult);
          }
          return { candidate: freshResult, pool };
        }
        const newIsWorse = prev && isSchedule2ResultBetter(prev, freshResult);
        if (!newIsWorse) {
          const prevSig = schedule2Signature(prev);
          const pool = (freshPool || []).map(
            (c) => schedule2Signature(c) === prevSig ? prev : c
          );
          if (!pool.includes(prev)) {
            pool.unshift(prev);
            if (pool.length > MAX_POOL_VARIANTS) pool.length = MAX_POOL_VARIANTS;
          }
          return { candidate: prev, pool };
        }
        return { candidate: prev, pool: null };
      };
      const result = await generateSchedule3Async(
        (progress) => {
          const pct = Math.round(progress * 100);
          progressFillEl.style.width = pct + "%";
          progressTextEl.textContent = pct + "%";
          progressWrapEl.setAttribute("aria-valuenow", String(pct));
        },
        { genA, genBC }
      );
      runtime.requestsChangedSinceGenerate3 = false;
      const candidateAList = [];
      for (let i = 0; i < SCHEDULE2_CARD_COUNT; i++) {
        const prev = prevCandidateAList[i] || null;
        const fresh = result.genA && result.candidateAList ? result.candidateAList[i] : null;
        if (fresh) {
          const picked = pickCandidateASlot(
            prev,
            fresh,
            result.candidateAPools && result.candidateAPools[i]
          );
          candidateAList.push(picked.candidate);
          if (picked.pool !== null) candidateAPools[i] = picked.pool;
        } else {
          candidateAList.push(prev);
        }
      }
      if (result.genBC) {
        runtime.candidates = [result.candidateB, result.candidateC].filter(
          Boolean
        );
        Object.keys(candidateHistory).forEach((k) => delete candidateHistory[k]);
        Object.keys(candidateUndoStack).forEach(
          (k) => delete candidateUndoStack[k]
        );
        Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
        runtime.candidates.forEach((cand, idx) => {
          candidateHistory[idx] = /* @__PURE__ */ new Set([candidateSignature(cand)]);
          if (result.poolsBC && result.poolsBC[idx])
            candidatePools[idx] = result.poolsBC[idx];
        });
      }
      runtime.schedule3Result = { candidateAList };
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
      runtime.generationInProgress = false;
      runtime.generationCancelRequested = false;
      releaseWakeLock();
    }
  }
  generateBtnA3El.addEventListener(
    "click",
    () => runGenerate3({
      genA: true,
      genBC: false,
      idleLabel: "후보A 생성하기",
      btnEl: generateBtnA3El,
      labelEl: generateBtnA3LabelEl,
      cancelEl: generateBtnA3CancelEl,
      progressWrapEl: generateProgressWrapA3El,
      progressFillEl: generateProgressFillA3El,
      progressTextEl: generateProgressTextA3El
    })
  );
  generateBtnA3CancelEl.addEventListener("click", () => {
    runtime.generationCancelRequested = true;
    generateBtnA3CancelEl.disabled = true;
    generateBtnA3CancelEl.textContent = "취소하는 중...";
  });
  generateBtnBC3El.addEventListener(
    "click",
    () => runGenerate3({
      genA: false,
      genBC: true,
      idleLabel: "후보B·C 생성하기",
      btnEl: generateBtnBC3El,
      labelEl: generateBtnBC3LabelEl,
      cancelEl: generateBtnBC3CancelEl,
      progressWrapEl: generateProgressWrapBC3El,
      progressFillEl: generateProgressFillBC3El,
      progressTextEl: generateProgressTextBC3El
    })
  );
  generateBtnBC3CancelEl.addEventListener("click", () => {
    runtime.generationCancelRequested = true;
    generateBtnBC3CancelEl.disabled = true;
    generateBtnBC3CancelEl.textContent = "취소하는 중...";
  });
  var candidateRulesBlock3El = document.getElementById(
    "candidateRulesBlock3"
  );
  var candidateRulesToggle3El = document.getElementById(
    "candidateRulesToggle3"
  );
  candidateRulesToggle3El.addEventListener("click", () => {
    const collapsed = candidateRulesBlock3El.classList.toggle("collapsed");
    candidateRulesToggle3El.setAttribute("aria-expanded", String(!collapsed));
  });

  // src/pages/settings.js
  var locationForm = document.getElementById("locationForm");
  var locationNameInput = document.getElementById("locationName");
  var locationHintEl = document.getElementById("locationHint");
  var locationListEl = document.getElementById("locationList");
  var travelTitleEl = document.getElementById("travelTitle");
  var travelMatrixEl = document.getElementById("travelMatrix");
  function membersUsingLocation(locId) {
    return state.members.filter((m) => (m.locationIds || []).includes(locId));
  }
  var editingLocationId = null;
  function invalidateCandidates() {
    const hasResult = runtime.candidates.length > 0 || runtime.schedule3Result.candidateAList.some(Boolean);
    if (!hasResult) return;
    runtime.candidates = [];
    runtime.schedule3Result = { candidateAList: [null, null, null] };
    resetCandidateSession();
    renderSchedule3Result();
    generateHint3El.textContent = "기본 설정이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    saveState();
    showToast(
      "기본 설정이 변경되어 생성된 수업 스케줄 후보가 초기화되었습니다",
      "info"
    );
  }
  function deleteLocation(loc) {
    const affectedMembers = membersUsingLocation(loc.id);
    const remainingLocations = state.locations.filter((l) => l.id !== loc.id);
    if (affectedMembers.length > 0 && remainingLocations.length === 0) {
      alert(
        "'" + loc.name + "' 지점을 사용하는 회원 " + affectedMembers.length + "명이 있고, 다른 지점이 없어 삭제할 수 없습니다. 다른 지점을 먼저 등록해주세요."
      );
      return;
    }
    const fallbackLoc = remainingLocations[0];
    const msg = affectedMembers.length > 0 ? "'" + loc.name + "' 지점을 사용하는 회원 " + affectedMembers.length + "명이 있습니다. 삭제하면 해당 회원의 지점 목록에서 제외됩니다(지점이 그것뿐이었던 회원은 '" + fallbackLoc.name + "' 지점으로 자동 변경). 계속할까요?" : "'" + loc.name + "' 지점을 삭제할까요?";
    if (!confirm(msg)) return;
    state.locations = state.locations.filter((l) => l.id !== loc.id);
    affectedMembers.forEach((m) => {
      m.locationIds = m.locationIds.filter((id) => id !== loc.id);
      if (m.locationIds.length === 0) m.locationIds = [fallbackLoc.id];
    });
    Object.keys(state.travelTimes).forEach((k) => {
      if (k.indexOf(loc.id) !== -1) delete state.travelTimes[k];
    });
    state.requests.forEach((r) => {
      if (Array.isArray(r.extraLocationIds) && r.extraLocationIds.includes(loc.id)) {
        r.extraLocationIds = r.extraLocationIds.filter((id) => id !== loc.id);
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
    state.locations.forEach((loc) => {
      if (editingLocationId === loc.id) {
        let commit = function() {
          const trimmed = input.value.trim();
          const changed = trimmed && trimmed !== loc.name;
          if (changed && state.locations.some((l) => l.id !== loc.id && l.name === trimmed)) {
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
        };
        const editChip = document.createElement("span");
        editChip.className = "chip location-chip location-chip-editing";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "location-name-input";
        input.value = loc.name;
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            editingLocationId = null;
            renderLocationList();
          }
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
    if (state.locations.some((l) => l.name === name)) {
      setLocationHint("이미 등록된 지점 이름입니다.");
      return;
    }
    setLocationHint("");
    const loc = { id: uid("loc"), name };
    state.locations.push(loc);
    state.locations.forEach((other) => {
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
  var availabilityListEl = document.getElementById("availabilityList");
  function dayRange(di) {
    let start = null, end = null;
    for (let s = 0; s < SLOT_COUNT; s++) {
      if (runtime.availableCells.has(cellKey(di, s))) {
        if (start === null) start = s;
        end = s + 1;
      }
    }
    return start === null ? null : { start, end };
  }
  function setDayRange(di, start, end) {
    for (let s = 0; s < SLOT_COUNT; s++)
      runtime.availableCells.delete(cellKey(di, s));
    for (let s = start; s < end; s++) runtime.availableCells.add(cellKey(di, s));
  }
  function clearDay(di) {
    for (let s = 0; s < SLOT_COUNT; s++)
      runtime.availableCells.delete(cellKey(di, s));
  }
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
  var TIME_SELECT_STEP_SLOTS = 30 / SLOT_MIN;
  function fillTimeSelect(sel, kind) {
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
  function fillAvailabilityTimeSelect(sel, kind) {
    sel.innerHTML = "";
    const slots = [];
    if (kind === "start") {
      for (let m = 12 * 60; m <= 22 * 60; m += 30)
        slots.push((m - START_MIN) / SLOT_MIN);
    } else {
      const fineFromMin = 23 * 60;
      for (let m = 14 * 60; m <= fineFromMin; m += 30)
        slots.push((m - START_MIN) / SLOT_MIN);
      for (let m = fineFromMin + 10; m <= 24 * 60; m += 10)
        slots.push((m - START_MIN) / SLOT_MIN);
    }
    slots.forEach((s) => {
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

  // src/backup.js
  var BACKUP_PBKDF2_ITERATIONS = 1e5;
  async function deriveBackupKey(pin, salt, usage) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(pin),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: BACKUP_PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      [usage]
    );
  }
  function backupBytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
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
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plainText)
    );
    const combined = new Uint8Array(
      salt.length + iv.length + cipherBuf.byteLength
    );
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(cipherBuf), salt.length + iv.length);
    return backupBytesToBase64(combined);
  }
  async function decryptBackupText(base64Text, pin) {
    const combined = backupBase64ToBytes(base64Text.trim());
    if (combined.length <= 28) throw new Error("invalid backup code");
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const cipherBytes = combined.slice(28);
    const key = await deriveBackupKey(pin, salt, "decrypt");
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBytes
    );
    return new TextDecoder().decode(plainBuf);
  }
  var backupExportBtnEl = document.getElementById("backupExportBtn");
  var backupExportResultEl = document.getElementById("backupExportResult");
  var backupExportTextareaEl = document.getElementById(
    "backupExportTextarea"
  );
  var backupExportCopyBtnEl = document.getElementById(
    "backupExportCopyBtn"
  );
  backupExportBtnEl.addEventListener("click", async () => {
    const pin = window.prompt(
      "백업 코드를 암호화할 PIN을 입력하세요. (복원할 때 동일한 PIN이 필요합니다)"
    );
    if (!pin) return;
    const pinConfirm = window.prompt("PIN을 한 번 더 입력해주세요.");
    if (pinConfirm !== pin) {
      alert(
        "입력한 PIN이 서로 달라 백업 코드를 만들지 못했습니다. 다시 시도해주세요."
      );
      return;
    }
    saveState();
    try {
      const backupCode = await encryptBackupText(
        localStorage.getItem(STORAGE_KEY) || "{}",
        pin
      );
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
  var backupImportOverlayEl = document.getElementById(
    "backupImportOverlay"
  );
  var backupImportOpenBtnEl = document.getElementById(
    "backupImportOpenBtn"
  );
  var backupImportCloseBtnEl = document.getElementById(
    "backupImportCloseBtn"
  );
  var backupImportCancelBtnEl = document.getElementById(
    "backupImportCancelBtn"
  );
  var backupImportApplyBtnEl = document.getElementById(
    "backupImportApplyBtn"
  );
  var backupImportTextareaEl = document.getElementById(
    "backupImportTextarea"
  );
  var backupImportPinInputEl = document.getElementById(
    "backupImportPinInput"
  );
  var backupImportHintEl = document.getElementById("backupImportHint");
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
      JSON.parse(plainText);
    } catch (e) {
      backupImportHintEl.textContent = "복원에 실패했습니다. 백업 코드와 PIN을 다시 확인해주세요.";
      return;
    }
    if (!confirm("복원하면 이 기기에 현재 저장된 데이터를 덮어씁니다. 계속할까요?"))
      return;
    runtime.suppressAutosave = true;
    localStorage.setItem(STORAGE_KEY, plainText);
    location.reload();
  });

  // src/main.js
  function init() {
    loadState();
    renderLocationList();
    renderTravelMatrix();
    populateMemberLocationSelect();
    renderMemberTable();
    renderAvailabilityList();
    renderRequestList();
    renderSchedule3Result();
    goToPage(runtime.currentPage);
  }
  init();
})();
