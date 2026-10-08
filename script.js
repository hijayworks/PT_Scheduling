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
  var INEFFICIENT_ROUNDTRIP_LOCATION_NAMES = ["마포점", "여의도점", "상암점"];
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
  var COVERAGE_WEIGHT_GAP_THRESHOLD = 1e4;
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
  var TIME_SELECT_STEP_SLOTS = 10 / SLOT_MIN;
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
  var memberPosIndex = { list: null, posById: /* @__PURE__ */ new Map() };
  function memberById(id) {
    const list = state.members;
    if (memberPosIndex.list === list) {
      const pos = memberPosIndex.posById.get(id);
      const m = pos === void 0 ? void 0 : list[pos];
      if (m && m.id === id) return m;
    }
    const found = list.find((m) => m.id === id);
    if (found) {
      const posById = /* @__PURE__ */ new Map();
      list.forEach((m, i) => {
        if (m && !posById.has(m.id)) posById.set(m.id, i);
      });
      memberPosIndex = { list, posById };
    }
    return found;
  }
  var knownLocationCache = { ids: [], set: /* @__PURE__ */ new Set() };
  function knownLocationIdSet() {
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
  function breaksSoloTravel(memberId, prevLocId, locId, nextLocId, soloIds) {
    return soloIds.has(memberId) && !!prevLocId && !!nextLocId && travelMinutes(prevLocId, locId) > 0 && travelMinutes(locId, nextLocId) > 0;
  }
  function chainBreaksSoloTravel(chain, soloIds) {
    for (let i = 1; i + 1 < chain.length; i++) {
      const cur = chain[i];
      if (breaksSoloTravel(
        cur.memberId,
        chain[i - 1].locationId,
        cur.locationId,
        chain[i + 1].locationId,
        soloIds
      ))
        return true;
    }
    return false;
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
    const a = String(idA), b = String(idB);
    return a < b ? a + "|" + b : b + "|" + a;
  }
  function travelMinutes(locIdA, locIdB) {
    if (!locIdA || !locIdB || locIdA === locIdB) return 0;
    const v = state.travelTimes[pairKey(locIdA, locIdB)];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : Infinity;
  }
  function inefficientRoundTripLocationInfo() {
    const matches = state.locations.filter(
      (l) => INEFFICIENT_ROUNDTRIP_LOCATION_NAMES.includes(l.name)
    );
    if (matches.length !== INEFFICIENT_ROUNDTRIP_LOCATION_NAMES.length)
      return null;
    const idByName = new Map(matches.map((l) => [l.name, l.id]));
    return {
      ids: new Set(idByName.values()),
      mapoId: idByName.get("마포점"),
      yeouidoId: idByName.get("여의도점")
    };
  }
  function roundTripOriginLoc(start, prevOf, locOf) {
    const loc = locOf(start);
    let n = prevOf(start);
    while (n != null && locOf(n) === loc) n = prevOf(n);
    return n == null ? null : locOf(n);
  }
  function isInefficientRoundTrip(info, locA, locB, locC) {
    if (!info || locA == null || locB == null || locC == null) return false;
    if (locA !== locC || locA === locB) return false;
    if (!info.ids.has(locA) || !info.ids.has(locB)) return false;
    const isMapoYeouido = locA === info.mapoId && locB === info.yeouidoId || locA === info.yeouidoId && locB === info.mapoId;
    return !isMapoYeouido;
  }

  // src/state.js
  var CURRENT_SCHEMA_VERSION = 1;
  var state = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    // 후보 풀 저장소(원본 슬롯). 화면의 카드·역할은 여기서 매번 파생한다(schedule3.js의
    // candidatePoolEntries → candidateSelection.js의 selectCandidates) — 카드 구조는 저장하지 않는다.
    // candidates: 그리디 전략 0(인원 최대)·전략 1(수업 횟수 최대)의 결과.
    candidates: [],
    // candidateAList: 체인 DP 탐색 그룹 3개의 결과. 배열 길이는 항상 SCHEDULE2_CARD_COUNT(3)와 같다.
    schedule3Result: { candidateAList: [null, null, null] },
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
    suppressAutosave: false,
    storageError: null
  };
  var GenerationCancelledError = class extends Error {
  };
  var wakeLockSentinel = null;
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
    } catch {
      wakeLockSentinel = null;
    }
  }
  async function releaseWakeLock() {
    const sentinel = wakeLockSentinel;
    wakeLockSentinel = null;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
      }
    }
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && runtime.generationInProgress) {
        acquireWakeLock();
      }
    });
  }
  var PAGE_IDS = ["settings", "schedule3", "members", "memberSchedule"];
  var OLD_PAGE_TO_NEW = {
    settings: "settings",
    requests: "schedule3",
    candidates: "schedule3",
    confirm: "schedule3",
    schedule: "schedule3",
    schedule2: "schedule3"
  };
  function emitStorageStatus(ok, error = null) {
    runtime.storageError = ok ? null : error;
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
      window.dispatchEvent(
        new window.CustomEvent("pt-storage-status", {
          detail: { ok, error: error ? String(error.message || error) : null }
        })
      );
    }
  }
  function saveState() {
    if (runtime.suppressAutosave) return true;
    state.schemaVersion = CURRENT_SCHEMA_VERSION;
    state.availableCells = Array.from(runtime.availableCells);
    state.candidates = runtime.candidates;
    state.schedule3Result = runtime.schedule3Result;
    state.currentPage = runtime.currentPage;
    state.startMinBase = START_MIN;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      emitStorageStatus(true);
      return true;
    } catch (error) {
      console.warn("failed to persist state", error);
      emitStorageStatus(false, error);
      return false;
    }
  }
  var LEGACY_START_MIN = 13 * 60;
  function clearParsedScheduleCandidates(parsed) {
    parsed.candidates = [];
    parsed.schedule3Result = { candidateAList: [null, null, null] };
  }
  function candidateInputKey() {
    const sortedJson = (list) => (list || []).map((x) => JSON.stringify(x)).sort().join("\n");
    const text = [
      sortedJson(state.requests),
      // 이름·메모는 배정에 쓰이지 않는다. (지점 이름은 세 지점·비효율 이동 규칙이 읽으므로 넣는다.)
      sortedJson(
        state.members.map((m) => ({
          id: m.id,
          locationIds: m.locationIds,
          category: m.category
        }))
      ),
      sortedJson(state.locations),
      JSON.stringify(Object.entries(state.travelTimes || {}).sort()),
      Array.from(runtime.availableCells).sort().join(","),
      (state.excludedMemberIds3 || []).slice().sort().join(","),
      (state.onceLimitedMemberIds3 || []).slice().sort().join(",")
    ].join("");
    let h1 = 2166136261, h2 = 16777619 ^ text.length;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ c, 1540483477);
    }
    return (h1 >>> 0).toString(36) + "-" + (h2 >>> 0).toString(36);
  }
  function clearRuntimeScheduleCandidates() {
    runtime.candidates = [];
    runtime.schedule3Result = { candidateAList: [null, null, null] };
  }
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
    clearParsedScheduleCandidates(parsed);
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
        const savedSchemaVersion = parsed.schemaVersion === void 0 ? 0 : parsed.schemaVersion;
        if (!Number.isInteger(savedSchemaVersion) || savedSchemaVersion < 0 || savedSchemaVersion > CURRENT_SCHEMA_VERSION)
          throw new Error("unsupported schema version");
        migrateStartMinShift(parsed);
        hadSavedState = true;
        state.schemaVersion = CURRENT_SCHEMA_VERSION;
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
          if (typeof parsed.schedule3Result.inputKey === "string")
            runtime.schedule3Result.inputKey = parsed.schedule3Result.inputKey;
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
    if (hadDurationMismatch) clearRuntimeScheduleCandidates();
    if (runtime.candidates.some(
      (c) => c.strategyIndex < 0 || c.strategyIndex >= STRATEGY_COUNT
    ))
      clearRuntimeScheduleCandidates();
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
      clearRuntimeScheduleCandidates();
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
  function clearPlacementClasses(el) {
    Array.from(el.classList).forEach((name) => {
      if (name.startsWith("grid-col-") || name.startsWith("grid-row-start-") || name.startsWith("grid-row-span-") || name.startsWith("lane-"))
        el.classList.remove(name);
    });
  }
  function setGridPlacement(el, column, rowStart, rowSpan = 1) {
    clearPlacementClasses(el);
    el.classList.add(
      "grid-col-" + column,
      "grid-row-start-" + rowStart,
      "grid-row-span-" + rowSpan
    );
  }
  function blockColorClass(color) {
    if (color === BLOCK_COLOR) return "member-color-fallback";
    let index = 0;
    for (let tier = 0; tier < MEMBER_COLOR_SHADE_STEPS.length; tier++) {
      for (let hue = 0; hue < MEMBER_COLORS.length; hue++) {
        if (shadeColor(MEMBER_COLORS[hue], MEMBER_COLOR_SHADE_STEPS[tier]) === color)
          return "member-color-" + index;
        index++;
      }
    }
    return "member-color-fallback";
  }
  function renderGrid(container, availableSet, options) {
    options = options || {};
    const rangeStart = typeof options.rangeStartSlot === "number" ? options.rangeStartSlot : 0;
    const rangeEnd = typeof options.rangeEndSlot === "number" ? options.rangeEndSlot : SLOT_COUNT;
    container.innerHTML = "";
    Array.from(container.classList).filter((name) => name.startsWith("grid-rows-")).forEach((name) => container.classList.remove(name));
    container.classList.add("grid-rows-" + (rangeEnd - rangeStart));
    const corner = document.createElement("div");
    corner.className = "cal-head corner";
    setGridPlacement(corner, 1, 1);
    container.appendChild(corner);
    DAYS.forEach((d, di) => {
      const head = document.createElement("div");
      head.className = "cal-head";
      head.textContent = d;
      setGridPlacement(head, di + 2, 1);
      container.appendChild(head);
    });
    for (let s = rangeStart; s < rangeEnd; s++) {
      const row = s - rangeStart + 2;
      const isHour = (START_MIN + s * SLOT_MIN) % 60 === 0;
      if (isHour) {
        const label = document.createElement("div");
        label.className = "cal-timelabel" + (s === rangeStart ? " cal-timelabel-first" : "");
        label.textContent = slotLabel(s);
        setGridPlacement(label, 1, row);
        container.appendChild(label);
      }
      for (let di = 0; di < DAYS.length; di++) {
        const cell = document.createElement("div");
        const key = cellKey(di, s);
        const isAvailable = availableSet.has(key);
        cell.className = "cal-cell" + (isHour ? " hour-start" : "") + (isAvailable ? " available" : "");
        cell.dataset.day = String(di);
        cell.dataset.slot = String(s);
        setGridPlacement(cell, di + 2, row);
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
      travel.className = t.type === "idle" ? "cal-idle-block" : t.type === "break" ? "cal-break-block" : "cal-travel-block";
      setGridPlacement(
        travel,
        t.day + 2,
        clippedStart - rangeStart + 2,
        clippedEnd - clippedStart
      );
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
        travel.classList.add("clickable");
        travel.addEventListener("click", (e) => {
          e.stopPropagation();
          openContextMenu(
            travel,
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
      if (!b.excluded) block.classList.add(blockColorClass(b.color));
      setGridPlacement(
        block,
        b.day + 2,
        clippedStart - rangeStart + 2,
        clippedEnd - clippedStart
      );
      if (b.laneCount > 1) {
        const laneCount = Math.min(40, Math.max(2, b.laneCount));
        const lane = Math.min(laneCount - 1, Math.max(0, b.lane || 0));
        block.classList.add("lane-" + laneCount + "-" + lane);
      }
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
        block.classList.add("clickable");
        block.addEventListener("click", () => b.onClick());
      }
      if (!b.excluded && b.contextMenuItems) {
        block.classList.add("clickable");
        block.addEventListener("click", (e) => {
          e.stopPropagation();
          openContextMenu(
            block,
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
      setGridPlacement(
        dropPreviewEl,
        day + 2,
        clippedStart - rangeStart + 2,
        clippedEnd - clippedStart
      );
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
  var activeContextMenuAnchorEl = null;
  function closeContextMenu() {
    if (activeContextMenuEl) {
      activeContextMenuEl.remove();
      activeContextMenuEl = null;
    }
    if (activeContextMenuAnchorEl) {
      activeContextMenuAnchorEl.classList.remove("context-menu-open");
      activeContextMenuAnchorEl = null;
    }
  }
  function openContextMenu(anchorEl, items) {
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
    anchorEl.classList.add("context-menu-open");
    anchorEl.appendChild(menu);
    activeContextMenuAnchorEl = anchorEl;
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
        width: neededWidth || void 0,
        windowWidth: neededWidth || void 0,
        ignoreElements: (el) => el.classList && el.classList.contains("candidate-card-actions"),
        // html2canvas가 repeating-linear-gradient 배경을 그리지 못하고 흰 배경으로 남기는 문제가
        // 있어(이동 시간 블록·제외 회원 블록에 사용 중), 캡처용 복제 문서에서만 무늬를 대표하는
        // 단색으로 바꿔치기한다. 화면에 실제로 보이는 원본 요소는 건드리지 않는다.
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll(".cal-travel-block").forEach((el) => {
            el.classList.add("capture-travel-solid");
          });
          clonedDoc.querySelectorAll(".cal-block.excluded").forEach((el) => {
            el.classList.add("capture-excluded-solid");
          });
          if (neededWidth) {
            const clonedCard = clonedDoc.querySelector(`[${CAPTURE_ATTR}]`);
            if (clonedCard) clonedCard.classList.add("capture-card-wide");
            clonedDoc.querySelectorAll(".grid-scroll").forEach((el) => {
              el.classList.add("capture-grid-scroll");
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
      console.warn("이미지 저장 실패", err);
      showToast("이미지 저장에 실패했습니다.", "error");
    } finally {
      cardEl.removeAttribute(CAPTURE_ATTR);
    }
  }

  // src/engine/chainDpCore.js
  var idleFirst = false;
  function isIdleFirst() {
    return idleFirst;
  }
  function setIdleFirst(on) {
    idleFirst = on;
  }
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
  function buildDayNodes(dayRequests, weightFn, jitterFn, locationsFor = candidateLocationsForRequest) {
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
          jitter: jitterFn ? jitterFn() : 0
        });
      });
    });
    return nodes;
  }
  function runChainDP(nodes, maxTravelsPerDay, ineffInfo, coveragePriority) {
    if (maxTravelsPerDay === void 0) maxTravelsPerDay = MAX_TRAVELS_PER_DAY;
    nodes = nodes.slice().sort((a, b) => a.end - b.end || a.startSlot - b.startSlot);
    const n = nodes.length;
    const dp = new Array(n), tc = new Array(n), tm = new Array(n), idle = new Array(n), js = new Array(n), ineff = new Array(n), prev = new Array(n), twoBackLocIdx = new Array(n);
    const prevOrNull = (k) => prev[k] !== -1 ? prev[k] : null;
    const locOfIndex = (k) => nodes[k].locationId;
    function better2(dpA, ineffA, tcA, tmA, idleA, jsA, dpB, ineffB, tcB, tmB, idleB, jsB) {
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
    const locIndex = /* @__PURE__ */ new Map();
    nodes.forEach((nd) => {
      if (!locIndex.has(nd.locationId)) locIndex.set(nd.locationId, locIndex.size);
    });
    const locIds = Array.from(locIndex.keys());
    const L = locIds.length;
    const travelOf = new Array(L * L), gapNeedOf = new Array(L * L);
    for (let a = 0; a < L; a++)
      for (let b = 0; b < L; b++) {
        travelOf[a * L + b] = travelMinutes(locIds[a], locIds[b]);
        gapNeedOf[a * L + b] = requiredGapMin2(locIds[a], locIds[b]);
      }
    const locIdxOf = nodes.map((nd) => locIndex.get(nd.locationId));
    const ineffOf = new Array((L + 1) * L * L);
    for (let a = 0; a <= L; a++)
      for (let b = 0; b < L; b++)
        for (let c = 0; c < L; c++)
          ineffOf[(a * L + b) * L + c] = isInefficientRoundTrip(
            ineffInfo,
            a === L ? null : locIds[a],
            locIds[b],
            locIds[c]
          ) ? 1 : 0;
    const memberIndex = /* @__PURE__ */ new Map();
    nodes.forEach((nd) => {
      if (!memberIndex.has(nd.memberId))
        memberIndex.set(nd.memberId, memberIndex.size);
    });
    const W = Math.max(1, Math.ceil(memberIndex.size / 32));
    const memberBits = new Uint32Array(n * W);
    const memberIdxOf = nodes.map((nd) => memberIndex.get(nd.memberId));
    const soloIds = soloTravelMemberIds();
    const noTravelOut = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      let bestDp = node.weight, bestIneff = 0, bestTc = 0, bestTm = 0, bestIdle = 0, bestJs = node.jitter || 0, bestPrev = -1;
      const mIdx = memberIdxOf[i];
      const mWord = mIdx >>> 5, mMask = 1 << (mIdx & 31);
      for (let j = 0; j < i; j++) {
        const p = nodes[j];
        if (p.end > node.startSlot) break;
        const pair = locIdxOf[j] * L + locIdxOf[i];
        const gapNeed = gapNeedOf[pair];
        const gapActual = (node.startSlot - p.end) * SLOT_MIN;
        if (gapActual < gapNeed) continue;
        const travel = travelOf[pair];
        const addsTravel = travel > 0 ? 1 : 0;
        const newTc = tc[j] + addsTravel;
        if (newTc > maxTravelsPerDay) continue;
        if (memberBits[j * W + mWord] & mMask) continue;
        if (addsTravel && noTravelOut[j]) continue;
        const newDp = dp[j] + node.weight;
        const newTm = tm[j] + travel;
        const newIdle = idle[j] + (gapActual - gapNeed);
        const newJs = js[j] + (node.jitter || 0);
        const newIneff = ineff[j] + ineffOf[(twoBackLocIdx[j] * L + locIdxOf[j]) * L + locIdxOf[i]];
        if (better2(
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
          bestJs
        )) {
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
      const twoBack = roundTripOriginLoc(i, prevOrNull, locOfIndex);
      twoBackLocIdx[i] = twoBack === null ? L : locIndex.get(twoBack);
      noTravelOut[i] = bestPrev !== -1 && soloIds.has(node.memberId) && travelOf[locIdxOf[bestPrev] * L + locIdxOf[i]] > 0 ? 1 : 0;
      if (bestPrev !== -1)
        memberBits.set(
          memberBits.subarray(bestPrev * W, bestPrev * W + W),
          i * W
        );
      memberBits[i * W + mWord] |= mMask;
    }
    let bestEnd = -1, bestDpAll = 0, bestIneffAll = 0, bestTcAll = 0, bestTmAll = 0, bestIdleAll = 0, bestJsAll = 0;
    for (let i = 0; i < n; i++) {
      if (bestEnd === -1 || better2(
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
        bestJsAll
      )) {
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
    while (cur !== -1 && cur !== void 0) {
      chain.unshift(nodes[cur]);
      cur = prev[cur];
    }
    return chain;
  }

  // src/engine/scheduleCompare.js
  function isSchedule2ResultBetter(a, b) {
    if (a.unassignedMembers.length !== b.unassignedMembers.length) {
      return a.unassignedMembers.length < b.unassignedMembers.length;
    }
    const ineffA = totalInefficientMoveCount(a.assigned), ineffB = totalInefficientMoveCount(b.assigned);
    if (ineffA !== ineffB) return ineffA < ineffB;
    const travelCountA = totalTravelCount(a.assigned), travelCountB = totalTravelCount(b.assigned);
    const idleA = schedule2TotalIdleMinutes(a.assigned), idleB = schedule2TotalIdleMinutes(b.assigned);
    const travelWeight = isIdleFirst() ? 0 : TRAVEL_VALUE_MINUTES;
    const netA = travelCountA * travelWeight + idleA - a.assigned.length * SESSION_VALUE_MINUTES;
    const netB = travelCountB * travelWeight + idleB - b.assigned.length * SESSION_VALUE_MINUTES;
    if (netA !== netB) return netA < netB;
    if (a.assigned.length !== b.assigned.length)
      return a.assigned.length > b.assigned.length;
    if (travelCountA !== travelCountB) return travelCountA < travelCountB;
    const travelMinA = totalTravelMinutes(a.assigned), travelMinB = totalTravelMinutes(b.assigned);
    if (travelMinA !== travelMinB) return travelMinA < travelMinB;
    return idleA < idleB;
  }
  function dropSessionsForBalance(result) {
    const soloIds = soloTravelMemberIds();
    const dayAllowed = (assigned, day) => {
      const chain = assigned.filter((x) => x.day === day).sort((a, b) => a.startSlot - b.startSlot);
      for (let i = 1; i < chain.length; i++) {
        const prev = chain[i - 1], cur2 = chain[i];
        const gapMin = (cur2.startSlot - prev.startSlot - durationToSlots(prev.duration)) * SLOT_MIN;
        if (gapMin < requiredGapMin2(prev.locationId, cur2.locationId))
          return false;
      }
      return !chainBreaksSoloTravel(chain, soloIds);
    };
    let cur = result;
    for (; ; ) {
      const sessionsByMember = /* @__PURE__ */ new Map();
      cur.assigned.forEach(
        (r) => sessionsByMember.set(
          r.memberId,
          (sessionsByMember.get(r.memberId) || 0) + 1
        )
      );
      let best = cur;
      cur.assigned.forEach((r) => {
        if (sessionsByMember.get(r.memberId) < 2) return;
        const cand = { ...cur, assigned: cur.assigned.filter((x) => x !== r) };
        if (!dayAllowed(cand.assigned, r.day)) return;
        if (isSchedule2ResultBetter(cand, best)) best = cand;
      });
      if (best === cur) return cur;
      cur = best;
    }
  }
  function floorIsBetter(a, b) {
    if (!b) return true;
    return a.unassignedMembers.length < b.unassignedMembers.length;
  }
  function schedule2Signature(result) {
    return result.assigned.map(
      (r) => r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId
    ).sort().join(",");
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
            type: "idle"
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

  // src/engine/workerPool.js
  var CANCEL_POLL_MS = 100;
  var ENGINE_WORKER_WARNING = "[엔진 워커]";
  function blobWorkerFactory() {
    if (typeof Worker === "undefined" || false)
      return null;
    const url = URL.createObjectURL(
      new Blob(['(() => {\n  // src/constants.js\n  var DAYS = ["월", "화", "수", "목", "금", "토"];\n  var START_MIN = 12 * 60;\n  var END_MIN = 24 * 60;\n  var SLOT_MIN = 10;\n  var SLOT_COUNT = (END_MIN - START_MIN) / SLOT_MIN;\n  var SESSION_DURATION_MIN = 60;\n  var BREAK_MIN = 0;\n  var ALLOWED_GAP_MIN = 10;\n  var SOLO_TRAVEL_LOCATION_NAMES = ["상암점", "여의도점", "마포점"];\n  var INEFFICIENT_ROUNDTRIP_LOCATION_NAMES = ["마포점", "여의도점", "상암점"];\n  var MAX_SESSIONS_PER_MEMBER = 2;\n  var MAX_TRAVELS_PER_DAY = 2;\n  var FORCE_ONCE_WEIGHT = 1e6;\n  var COVERAGE_WEIGHT_GAP_THRESHOLD = 1e4;\n  var SESSION_DURATION_MIN_2 = 60;\n  var CONSULT_DURATION_MIN_2 = 30;\n  var OLD_SLOT_MIN = 30;\n  var SLOT_SCALE = OLD_SLOT_MIN / SLOT_MIN;\n  var DEFAULT_BUSINESS_START_MIN = 14 * 60;\n  var DEFAULT_BUSINESS_END_MIN = 23 * 60 + 30;\n  var DEFAULT_BUSINESS_START_SLOT = (DEFAULT_BUSINESS_START_MIN - START_MIN) / SLOT_MIN;\n  var DEFAULT_BUSINESS_END_SLOT = (DEFAULT_BUSINESS_END_MIN - START_MIN) / SLOT_MIN;\n\n  // src/utils.js\n  function durationToSlots(min) {\n    return min / SLOT_MIN;\n  }\n  var TIME_SELECT_STEP_SLOTS = 10 / SLOT_MIN;\n\n  // src/selectionOverride.js\n  var selectionOverride = null;\n  async function withSelectionOverride(excludedIds, onceLimitIds, asyncFn) {\n    const prev = selectionOverride;\n    selectionOverride = {\n      excludedIds: excludedIds.slice(),\n      onceLimitIds: onceLimitIds.slice()\n    };\n    try {\n      return await asyncFn();\n    } finally {\n      selectionOverride = prev;\n    }\n  }\n  function currentOnceLimitIds() {\n    return selectionOverride ? selectionOverride.onceLimitIds : state.onceLimitedMemberIds3;\n  }\n  function currentExcludedIds2() {\n    return selectionOverride ? selectionOverride.excludedIds : state.excludedMemberIds3;\n  }\n  function currentOnceLimitIds2() {\n    return selectionOverride ? selectionOverride.onceLimitIds : state.onceLimitedMemberIds3;\n  }\n\n  // src/domain.js\n  var memberPosIndex = { list: null, posById: /* @__PURE__ */ new Map() };\n  function memberById(id) {\n    const list = state.members;\n    if (memberPosIndex.list === list) {\n      const pos = memberPosIndex.posById.get(id);\n      const m = pos === void 0 ? void 0 : list[pos];\n      if (m && m.id === id) return m;\n    }\n    const found = list.find((m) => m.id === id);\n    if (found) {\n      const posById = /* @__PURE__ */ new Map();\n      list.forEach((m, i) => {\n        if (m && !posById.has(m.id)) posById.set(m.id, i);\n      });\n      memberPosIndex = { list, posById };\n    }\n    return found;\n  }\n  var knownLocationCache = { ids: [], set: /* @__PURE__ */ new Set() };\n  function knownLocationIdSet() {\n    const list = state.locations;\n    const ids = knownLocationCache.ids;\n    let same = ids.length === list.length;\n    for (let i = 0; same && i < list.length; i++) same = list[i].id === ids[i];\n    if (!same) {\n      const nextIds = list.map((l) => l.id);\n      knownLocationCache = { ids: nextIds, set: new Set(nextIds) };\n    }\n    return knownLocationCache.set;\n  }\n  function maxSessionsFor(member) {\n    if (!member) return 1;\n    if (currentOnceLimitIds().includes(member.id)) return 1;\n    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;\n  }\n  function soloTravelMemberIds() {\n    const soloTravelLocationIds = state.locations.filter((l) => SOLO_TRAVEL_LOCATION_NAMES.includes(l.name)).map((l) => l.id);\n    if (soloTravelLocationIds.length !== SOLO_TRAVEL_LOCATION_NAMES.length)\n      return /* @__PURE__ */ new Set();\n    return new Set(\n      state.members.filter(\n        (m) => soloTravelLocationIds.every((id) => m.locationIds.includes(id))\n      ).map((m) => m.id)\n    );\n  }\n  function breaksSoloTravel(memberId, prevLocId, locId, nextLocId, soloIds) {\n    return soloIds.has(memberId) && !!prevLocId && !!nextLocId && travelMinutes(prevLocId, locId) > 0 && travelMinutes(locId, nextLocId) > 0;\n  }\n  function chainBreaksSoloTravel(chain, soloIds) {\n    for (let i = 1; i + 1 < chain.length; i++) {\n      const cur = chain[i];\n      if (breaksSoloTravel(\n        cur.memberId,\n        chain[i - 1].locationId,\n        cur.locationId,\n        chain[i + 1].locationId,\n        soloIds\n      ))\n        return true;\n    }\n    return false;\n  }\n  function pairKey(idA, idB) {\n    const a = String(idA), b = String(idB);\n    return a < b ? a + "|" + b : b + "|" + a;\n  }\n  function travelMinutes(locIdA, locIdB) {\n    if (!locIdA || !locIdB || locIdA === locIdB) return 0;\n    const v = state.travelTimes[pairKey(locIdA, locIdB)];\n    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : Infinity;\n  }\n  function inefficientRoundTripLocationInfo() {\n    const matches = state.locations.filter(\n      (l) => INEFFICIENT_ROUNDTRIP_LOCATION_NAMES.includes(l.name)\n    );\n    if (matches.length !== INEFFICIENT_ROUNDTRIP_LOCATION_NAMES.length)\n      return null;\n    const idByName = new Map(matches.map((l) => [l.name, l.id]));\n    return {\n      ids: new Set(idByName.values()),\n      mapoId: idByName.get("마포점"),\n      yeouidoId: idByName.get("여의도점")\n    };\n  }\n  function roundTripOriginLoc(start, prevOf, locOf) {\n    const loc = locOf(start);\n    let n = prevOf(start);\n    while (n != null && locOf(n) === loc) n = prevOf(n);\n    return n == null ? null : locOf(n);\n  }\n  function isInefficientRoundTrip(info, locA, locB, locC) {\n    if (!info || locA == null || locB == null || locC == null) return false;\n    if (locA !== locC || locA === locB) return false;\n    if (!info.ids.has(locA) || !info.ids.has(locB)) return false;\n    const isMapoYeouido = locA === info.mapoId && locB === info.yeouidoId || locA === info.yeouidoId && locB === info.mapoId;\n    return !isMapoYeouido;\n  }\n\n  // src/state.js\n  var CURRENT_SCHEMA_VERSION = 1;\n  var state = {\n    schemaVersion: CURRENT_SCHEMA_VERSION,\n    availableCells: [],\n    // array of "day-slot" strings\n    locations: [],\n    // {id, name}\n    travelTimes: {},\n    // { "locIdA|locIdB": minutes }\n    members: [],\n    // {id, name, locationIds: [locId, ...]}\n    requests: [],\n    // {id, memberId, locationId, day, startSlot, duration}\n    // "수업 스케줄 생성3" 전용 설정 (생성1·생성2 엔진을 withSelectionOverride로 재사용해 후보 3개를 한 화면에 보여줌)\n    onceLimitedMemberIds3: [],\n    // 스케줄 생성3에서 최대 1회만 배정되어야 하는 회원 id 목록\n    excludedMemberIds3: []\n    // 스케줄 생성3에서 후보 생성 시 아예 제외할 회원 id 목록\n  };\n  var runtime = {\n    availableCells: /* @__PURE__ */ new Set(),\n    // 후보 풀 저장소(원본 슬롯). 화면의 카드·역할은 여기서 매번 파생한다(schedule3.js의\n    // candidatePoolEntries → candidateSelection.js의 selectCandidates) — 카드 구조는 저장하지 않는다.\n    // candidates: 그리디 전략 0(인원 최대)·전략 1(수업 횟수 최대)의 결과.\n    candidates: [],\n    // candidateAList: 체인 DP 탐색 그룹 3개의 결과. 배열 길이는 항상 SCHEDULE2_CARD_COUNT(3)와 같다.\n    schedule3Result: { candidateAList: [null, null, null] },\n    // 세 생성 버튼 중 하나라도 계산 중이면 true — 동시에 두 계산이 겹치면 selectionOverride가\n    // 서로 다른 페이지의 회원 선택 목록을 잘못 참조할 수 있어(withSelectionOverride 참고), 이 플래그로 막는다.\n    generationInProgress: false,\n    // 생성2/생성3의 다듬기 파이프라인(담금질 기법 등)은 수 초~수십 초가 걸릴 수 있어, 사용자가\n    // "취소"를 누르면 다음 양보 지점(yieldToUI 직후)에서 즉시 멈출 수 있도록 이 플래그로 신호를\n    // 보낸다. 실제 중단은 GenerationCancelledError를 던져 호출 스택을 그대로 타고 올라가\n    // 각 생성 버튼 핸들러의 catch에서 잡는 방식으로 처리한다.\n    generationCancelRequested: false,\n    currentPage: "settings",\n    // 백업 복원 직후 reload()할 때 beforeunload/visibilitychange 핸들러가 옛 메모리 상태로\n    // saveState()를 한 번 더 실행해 방금 덮어쓴 localStorage를 되돌리지 않도록 막는 플래그.\n    suppressAutosave: false,\n    storageError: null\n  };\n  var GenerationCancelledError = class extends Error {\n  };\n  var wakeLockSentinel = null;\n  async function acquireWakeLock() {\n    if (!("wakeLock" in navigator)) return;\n    try {\n      wakeLockSentinel = await navigator.wakeLock.request("screen");\n    } catch {\n      wakeLockSentinel = null;\n    }\n  }\n  if (typeof document !== "undefined") {\n    document.addEventListener("visibilitychange", () => {\n      if (document.visibilityState === "visible" && runtime.generationInProgress) {\n        acquireWakeLock();\n      }\n    });\n  }\n  var LEGACY_START_MIN = 13 * 60;\n\n  // src/engine/scheduleCompare.js\n  function schedule2TotalIdleMinutes(assigned) {\n    let idle = 0;\n    const byDay = /* @__PURE__ */ new Map();\n    assigned.forEach((r) => {\n      if (!byDay.has(r.day)) byDay.set(r.day, []);\n      byDay.get(r.day).push(r);\n    });\n    byDay.forEach((reqs) => {\n      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);\n      for (let i = 1; i < sorted.length; i++) {\n        const prev = sorted[i - 1], cur = sorted[i];\n        const gapMin = (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) * SLOT_MIN;\n        const needMin = requiredGapMin2(prev.locationId, cur.locationId);\n        idle += Math.max(0, gapMin - needMin);\n      }\n    });\n    return idle;\n  }\n\n  // src/engine/greedy.js\n  function isAdjacentDay(day, days) {\n    for (const d of days) {\n      if (Math.abs(d - day) === 1) return true;\n    }\n    return false;\n  }\n  function candidateLocationsFor(memberId) {\n    const member = memberById(memberId);\n    if (!member || !Array.isArray(member.locationIds)) return [];\n    const knownLocationIds = knownLocationIdSet();\n    return member.locationIds.filter((id) => knownLocationIds.has(id));\n  }\n  function candidateLocationsForRequest(req) {\n    const excluded = req.excludedLocationIds || [];\n    const base = candidateLocationsFor(req.memberId).filter(\n      (id) => id !== null && !excluded.includes(id)\n    );\n    const knownLocationIds = knownLocationIdSet();\n    const extra = (req.extraLocationIds || []).filter(\n      (id) => knownLocationIds.has(id) && !base.includes(id)\n    );\n    return base.concat(extra);\n  }\n  function requiredGapMin(locA, locB) {\n    const raw = Math.max(BREAK_MIN, travelMinutes(locA, locB));\n    return Math.ceil(raw / SLOT_MIN) * SLOT_MIN;\n  }\n  var DAYTIME_END_MIN = 18 * 60;\n  function isDaytimeStart(cand) {\n    return START_MIN + cand.startSlot * SLOT_MIN < DAYTIME_END_MIN;\n  }\n  function isHalfHourStart(cand) {\n    return (START_MIN + cand.startSlot * SLOT_MIN) % 30 === 0;\n  }\n  function dailyTravelCount(chain) {\n    let count = 0;\n    for (let i = 1; i < chain.length; i++) {\n      if (travelMinutes(chain[i - 1].locationId, chain[i].locationId) > 0)\n        count++;\n    }\n    return count;\n  }\n  function dayChainViolation(chain, soloIds) {\n    for (let i = 1; i < chain.length; i++) {\n      const prev = chain[i - 1], cur = chain[i];\n      if ((cur.startSlot - prev.end) * SLOT_MIN < requiredGapMin(prev.locationId, cur.locationId))\n        return "gap";\n    }\n    if (dailyTravelCount(chain) > MAX_TRAVELS_PER_DAY) return "dailyTravel";\n    if (chainBreaksSoloTravel(chain, soloIds)) return "soloTravel";\n    return null;\n  }\n  function dailyInefficientMoveCount(chain, info) {\n    info = info === void 0 ? inefficientRoundTripLocationInfo() : info;\n    const locs = [];\n    chain.forEach((s) => {\n      if (locs[locs.length - 1] !== s.locationId) locs.push(s.locationId);\n    });\n    let count = 0;\n    for (let i = 1; i < locs.length - 1; i++) {\n      if (isInefficientRoundTrip(info, locs[i - 1], locs[i], locs[i + 1]))\n        count++;\n    }\n    return count;\n  }\n  function greedyAssign(eligibleReqs, options, pinned) {\n    options = options || {};\n    pinned = pinned || [];\n    const travelFirst = !!options.travelFirst;\n    const preferDaytime = !!options.preferDaytime;\n    const groupByLocation = !!options.groupByLocation;\n    const minimizeUnassigned = !!options.minimizeUnassigned;\n    const sessionCountFirst = !!options.sessionCountFirst;\n    const pinnedLocationDay = options.pinnedLocationDay || null;\n    const maxTravelsPerDay = options.maxTravelsPerDay || MAX_TRAVELS_PER_DAY;\n    const maxTravelsPerWeek = options.maxTravelsPerWeek || null;\n    const travelCountOnly = !!options.travelCountOnly;\n    const forceOnceMemberIds = options.forceOnceMemberIds ? new Set(options.forceOnceMemberIds) : null;\n    const externalDayOrder = options.stage1DayOrder || null;\n    const forbidInefficient = !!options.forbidInefficient;\n    const soloTravelIds = soloTravelMemberIds();\n    const ineffInfo = inefficientRoundTripLocationInfo();\n    const priorityRank = new Map(eligibleReqs.map((r, i) => [r.id, i]));\n    const byDay = /* @__PURE__ */ new Map();\n    eligibleReqs.forEach((r) => {\n      if (!byDay.has(r.day)) byDay.set(r.day, []);\n      byDay.get(r.day).push(r);\n    });\n    const days = [...byDay.keys()].sort((a, b) => a - b);\n    const allLocIds = state.locations.map((l) => l.id).concat([null]);\n    const memberIdsByDay = /* @__PURE__ */ new Map();\n    function allMemberIdsForDay(day) {\n      let ids = memberIdsByDay.get(day);\n      if (!ids) {\n        ids = new Set((byDay.get(day) || []).map((r) => r.memberId));\n        memberIdsByDay.set(day, ids);\n      }\n      return ids;\n    }\n    const locationsByReq = /* @__PURE__ */ new Map();\n    function locationsForReq(r) {\n      let locs = locationsByReq.get(r);\n      if (!locs) {\n        locs = candidateLocationsForRequest(r);\n        locationsByReq.set(r, locs);\n      }\n      return locs;\n    }\n    const locIndexOf = new Map(allLocIds.map((id, i) => [id, i]));\n    const LOCS = allLocIds.length;\n    const needOfPair = new Array(LOCS * LOCS), travelOfPair = new Array(LOCS * LOCS);\n    allLocIds.forEach(\n      (a, i) => allLocIds.forEach((b, j) => {\n        needOfPair[i * LOCS + j] = requiredGapMin(a, b);\n        travelOfPair[i * LOCS + j] = travelMinutes(a, b);\n      })\n    );\n    const memberBitOf = /* @__PURE__ */ new Map();\n    eligibleReqs.forEach((r) => {\n      if (!memberBitOf.has(r.memberId)) memberBitOf.set(r.memberId, memberBitOf.size);\n    });\n    const MEMBER_WORDS = Math.max(1, Math.ceil(memberBitOf.size / 32));\n    function pairNeed(predIdx, predLoc, locId, locIdx) {\n      return locIdx === void 0 ? requiredGapMin(predLoc, locId) : needOfPair[predIdx * LOCS + locIdx];\n    }\n    function pairTravel(predIdx, predLoc, locId, locIdx) {\n      return locIdx === void 0 ? travelMinutes(predLoc, locId) : travelOfPair[predIdx * LOCS + locIdx];\n    }\n    function runPass(stage1Order, allowGapMin) {\n      const assigned = [];\n      const memberDays = /* @__PURE__ */ new Map();\n      const chainByDay = /* @__PURE__ */ new Map();\n      function withinCaps(memberId, day) {\n        const usedDays = memberDays.get(memberId);\n        if (usedDays && usedDays.has(day)) return false;\n        if (usedDays && usedDays.size >= maxSessionsFor(memberById(memberId)))\n          return false;\n        return true;\n      }\n      function commit(day, located) {\n        assigned.push(located);\n        if (!memberDays.has(located.memberId))\n          memberDays.set(located.memberId, /* @__PURE__ */ new Set());\n        memberDays.get(located.memberId).add(day);\n        if (!chainByDay.has(day)) chainByDay.set(day, []);\n        chainByDay.get(day).push(located);\n      }\n      function weeklyTravelUsedExcluding(day) {\n        let total = 0;\n        chainByDay.forEach((chain, d) => {\n          if (d === day) return;\n          total += dailyTravelCount(chain);\n        });\n        return total;\n      }\n      function buildBestChain(day, eligibleMemberIds, weightFn, endBefore, onlyLocationId, coveragePriority) {\n        weightFn = weightFn || (() => 1);\n        const otherDaysTravelUsed = maxTravelsPerWeek != null ? weeklyTravelUsedExcluding(day) : 0;\n        const cands = (byDay.get(day) || []).filter(\n          (r) => eligibleMemberIds.has(r.memberId) && (!endBefore || r.startSlot + durationToSlots(r.duration) <= endBefore.slot)\n        );\n        const nodes = [];\n        cands.forEach((cand) => {\n          const memberLocs = locationsForReq(cand);\n          const locs = onlyLocationId ? memberLocs.includes(onlyLocationId) ? [onlyLocationId] : [] : memberLocs;\n          locs.forEach((locId) => {\n            nodes.push({\n              cand,\n              locationId: locId,\n              end: cand.startSlot + durationToSlots(cand.duration)\n            });\n          });\n        });\n        nodes.sort(\n          (a, b) => a.end - b.end || priorityRank.get(a.cand.id) - priorityRank.get(b.cand.id)\n        );\n        const index = /* @__PURE__ */ new Map();\n        function indexList(end, locId) {\n          const byEnd = index.get(locId);\n          return byEnd && byEnd.get(end);\n        }\n        function timeCostOf(n) {\n          return n.travelMinutesSum + n.idleMinutesSum;\n        }\n        function addToIndex(node) {\n          let byEnd = index.get(node.locationId);\n          if (!byEnd) {\n            byEnd = /* @__PURE__ */ new Map();\n            index.set(node.locationId, byEnd);\n          }\n          let list = byEnd.get(node.end);\n          if (!list) {\n            list = [];\n            byEnd.set(node.end, list);\n          }\n          list.push(node);\n          list.sort(\n            (a, b) => travelFirst ? a.travelCount - b.travelCount || b.dp - a.dp || a.ineffCount - b.ineffCount || (travelCountOnly ? 0 : a.travelMinutesSum - b.travelMinutesSum || timeCostOf(a) - timeCostOf(b) || b.alignedScore - a.alignedScore || a.soloSlackPenalty - b.soloSlackPenalty) || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0) : (coveragePriority || Math.abs(a.dp - b.dp) >= COVERAGE_WEIGHT_GAP_THRESHOLD ? b.dp - a.dp || a.ineffCount - b.ineffCount : a.ineffCount - b.ineffCount || b.dp - a.dp) || a.travelCount - b.travelCount || (travelCountOnly ? 0 : a.travelMinutesSum - b.travelMinutesSum || timeCostOf(a) - timeCostOf(b) || b.alignedScore - a.alignedScore || a.soloSlackPenalty - b.soloSlackPenalty) || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0)\n          );\n        }\n        function chainScore(node) {\n          let s = 0, n = node;\n          while (n) {\n            s += priorityRank.get(n.cand.id);\n            n = n.prev;\n          }\n          return s;\n        }\n        function isBetterPair(dpA, countA, ineffA, travelA, timeCostA, alignedA, slackPenA, daytimeA, groupA, dpB, countB, ineffB, travelB, timeCostB, alignedB, slackPenB, daytimeB, groupB) {\n          const hardWeightGap = Math.abs(dpA - dpB) >= COVERAGE_WEIGHT_GAP_THRESHOLD;\n          if (travelFirst) {\n            if (countA !== countB) return countA < countB;\n            if (dpA !== dpB) return dpA > dpB;\n            if (ineffA !== ineffB) return ineffA < ineffB;\n          } else if (coveragePriority || hardWeightGap) {\n            if (dpA !== dpB) return dpA > dpB;\n            if (ineffA !== ineffB) return ineffA < ineffB;\n            if (countA !== countB) return countA < countB;\n          } else {\n            if (ineffA !== ineffB) return ineffA < ineffB;\n            if (dpA !== dpB) return dpA > dpB;\n            if (countA !== countB) return countA < countB;\n          }\n          if (travelCountOnly) return false;\n          if (travelA !== travelB) return travelA < travelB;\n          if (timeCostA !== timeCostB) return timeCostA < timeCostB;\n          if (alignedA !== alignedB) return alignedA > alignedB;\n          if (slackPenA !== slackPenB) return slackPenA < slackPenB;\n          if (preferDaytime && daytimeA !== daytimeB) return daytimeA > daytimeB;\n          if (groupByLocation && groupA !== groupB) return groupA > groupB;\n          return false;\n        }\n        const usedBits = new Uint32Array(nodes.length * MEMBER_WORDS);\n        let best = null;\n        nodes.forEach((node, nodeIdx) => {\n          const memberBit = memberBitOf.get(node.cand.memberId);\n          const memberWord = memberBit >>> 5, memberMask = 1 << (memberBit & 31);\n          node.bitBase = nodeIdx * MEMBER_WORDS;\n          let bestPrev = null, bestPrevDp = -Infinity, bestResultTravelOnly = Infinity, bestResultTimeCost = Infinity, bestResultAligned = -Infinity, bestResultSlackPen = Infinity, bestResultDaytime = -Infinity, bestResultGroup = -Infinity, bestTravelCount = Infinity, bestResultIneffCount = Infinity, bestTransitionMin = 0, bestSlackMin = 0;\n          const nodeLocIdx = locIndexOf.get(node.locationId);\n          allLocIds.forEach((predLoc, predIdx) => {\n            const need = pairNeed(predIdx, predLoc, node.locationId, nodeLocIdx);\n            const transitionMin = pairTravel(\n              predIdx,\n              predLoc,\n              node.locationId,\n              nodeLocIdx\n            );\n            for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {\n              const reqEnd2 = node.cand.startSlot - (need + slackMin) / SLOT_MIN;\n              const list = indexList(reqEnd2, predLoc);\n              if (!list) continue;\n              for (const prevNode of list) {\n                if (usedBits[prevNode.bitBase + memberWord] & memberMask) continue;\n                if (soloTravelIds.has(prevNode.cand.memberId) && prevNode.arrivedViaTravel && transitionMin > 0)\n                  continue;\n                const tc = prevNode.travelCount + (transitionMin > 0 ? 1 : 0);\n                if (tc > maxTravelsPerDay) continue;\n                if (maxTravelsPerWeek != null && otherDaysTravelUsed + tc > maxTravelsPerWeek)\n                  continue;\n                const resultTravelOnly = prevNode.travelMinutesSum + transitionMin;\n                const resultTimeCost = resultTravelOnly + prevNode.idleMinutesSum + slackMin;\n                const slackPenalty = soloTravelIds.has(node.cand.memberId) && transitionMin === 0 && slackMin > 0 ? slackMin : 0;\n                const resultSlackPen = prevNode.soloSlackPenalty + slackPenalty;\n                const resultIneffCount = prevNode.ineffCount + (isInefficientRoundTrip(\n                  ineffInfo,\n                  prevNode.twoBackLoc,\n                  prevNode.locationId,\n                  node.locationId\n                ) ? 1 : 0);\n                if (forbidInefficient && resultIneffCount > prevNode.ineffCount)\n                  continue;\n                if (!bestPrev || isBetterPair(\n                  prevNode.dp,\n                  tc,\n                  resultIneffCount,\n                  resultTravelOnly,\n                  resultTimeCost,\n                  prevNode.alignedScore,\n                  resultSlackPen,\n                  prevNode.daytimeScore,\n                  prevNode.groupScore,\n                  bestPrevDp,\n                  bestTravelCount,\n                  bestResultIneffCount,\n                  bestResultTravelOnly,\n                  bestResultTimeCost,\n                  bestResultAligned,\n                  bestResultSlackPen,\n                  bestResultDaytime,\n                  bestResultGroup\n                )) {\n                  bestPrevDp = prevNode.dp;\n                  bestPrev = prevNode;\n                  bestTravelCount = tc;\n                  bestResultIneffCount = resultIneffCount;\n                  bestResultTravelOnly = resultTravelOnly;\n                  bestResultTimeCost = resultTimeCost;\n                  bestTransitionMin = transitionMin;\n                  bestSlackMin = slackMin;\n                  bestResultAligned = prevNode.alignedScore;\n                  bestResultSlackPen = resultSlackPen;\n                  bestResultDaytime = prevNode.daytimeScore;\n                  bestResultGroup = prevNode.groupScore;\n                }\n                break;\n              }\n            }\n          });\n          const daytimeBonus = isDaytimeStart(node.cand) ? 1 : 0;\n          if (bestPrev) {\n            node.dp = bestPrev.dp + weightFn(node.cand.memberId);\n            node.prev = bestPrev;\n            node.travelCount = bestTravelCount;\n            node.ineffCount = bestResultIneffCount;\n            node.travelMinutesSum = bestPrev.travelMinutesSum + bestTransitionMin;\n            node.idleMinutesSum = bestPrev.idleMinutesSum + bestSlackMin;\n            node.alignedScore = bestPrev.alignedScore;\n            node.soloSlackPenalty = bestResultSlackPen;\n            node.daytimeScore = bestPrev.daytimeScore + daytimeBonus;\n            node.groupScore = bestPrev.groupScore + (bestPrev.locationId === node.locationId ? 1 : 0);\n            usedBits.copyWithin(\n              node.bitBase,\n              bestPrev.bitBase,\n              bestPrev.bitBase + MEMBER_WORDS\n            );\n            node.arrivedViaTravel = bestPrev.locationId !== node.locationId;\n          } else {\n            node.dp = weightFn(node.cand.memberId);\n            node.prev = null;\n            node.travelCount = 0;\n            node.ineffCount = 0;\n            node.travelMinutesSum = 0;\n            node.idleMinutesSum = 0;\n            node.alignedScore = isHalfHourStart(node.cand) ? 1 : 0;\n            node.soloSlackPenalty = 0;\n            node.daytimeScore = daytimeBonus;\n            node.groupScore = 0;\n            node.arrivedViaTravel = false;\n          }\n          usedBits[node.bitBase + memberWord] |= memberMask;\n          node.twoBackLoc = roundTripOriginLoc(\n            node,\n            (n) => n.prev,\n            (n) => n.locationId\n          );\n          if (node.dp > -Infinity) {\n            addToIndex(node);\n            const nodeTimeCost = timeCostOf(node);\n            const bestTimeCost = best ? timeCostOf(best) : null;\n            const tie = best && node.dp === best.dp && node.ineffCount === best.ineffCount && node.travelCount === best.travelCount && (travelCountOnly || node.travelMinutesSum === best.travelMinutesSum) && (travelCountOnly || nodeTimeCost === bestTimeCost) && (travelCountOnly || node.alignedScore === best.alignedScore) && (travelCountOnly || node.soloSlackPenalty === best.soloSlackPenalty) && (!preferDaytime || node.daytimeScore === best.daytimeScore) && (!groupByLocation || node.groupScore === best.groupScore);\n            if (!best || isBetterPair(\n              node.dp,\n              node.travelCount,\n              node.ineffCount,\n              node.travelMinutesSum,\n              nodeTimeCost,\n              node.alignedScore,\n              node.soloSlackPenalty,\n              node.daytimeScore,\n              node.groupScore,\n              best.dp,\n              best.travelCount,\n              best.ineffCount,\n              best.travelMinutesSum,\n              bestTimeCost,\n              best.alignedScore,\n              best.soloSlackPenalty,\n              best.daytimeScore,\n              best.groupScore\n            ) || tie && chainScore(node) < chainScore(best))\n              best = node;\n          }\n        });\n        let chosen = best;\n        if (endBefore) {\n          chosen = null;\n          allLocIds.forEach((loc) => {\n            const need = requiredGapMin(loc, endBefore.locationId);\n            const transitionMin = travelMinutes(loc, endBefore.locationId);\n            if (endBefore.noTravelIn && transitionMin > 0) return;\n            for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {\n              const gapSlots = (need + slackMin) / SLOT_MIN;\n              const list = indexList(endBefore.slot - gapSlots, loc);\n              if (!list || list.length === 0) continue;\n              const node = list.find(\n                (n) => !(soloTravelIds.has(n.cand.memberId) && n.arrivedViaTravel && transitionMin > 0)\n              );\n              if (!node) continue;\n              const nodeIneffCount = node.ineffCount + (isInefficientRoundTrip(\n                ineffInfo,\n                node.twoBackLoc,\n                node.locationId,\n                endBefore.locationId\n              ) ? 1 : 0);\n              if (forbidInefficient && nodeIneffCount > node.ineffCount) continue;\n              const nodeTimeCost = timeCostOf(node);\n              const chosenTimeCost = chosen ? timeCostOf(chosen) : null;\n              if (!chosen || isBetterPair(\n                node.dp,\n                node.travelCount,\n                nodeIneffCount,\n                node.travelMinutesSum,\n                nodeTimeCost,\n                node.alignedScore,\n                node.soloSlackPenalty,\n                node.daytimeScore,\n                node.groupScore,\n                chosen.dp,\n                chosen.travelCount,\n                chosen.ineffCount,\n                chosen.travelMinutesSum,\n                chosenTimeCost,\n                chosen.alignedScore,\n                chosen.soloSlackPenalty,\n                chosen.daytimeScore,\n                chosen.groupScore\n              )) {\n                chosen = node;\n              }\n            }\n          });\n        }\n        if (!chosen) return [];\n        const chain = [];\n        let cur = chosen;\n        while (cur) {\n          chain.unshift({\n            id: cur.cand.id,\n            memberId: cur.cand.memberId,\n            day,\n            startSlot: cur.cand.startSlot,\n            duration: cur.cand.duration,\n            locationId: cur.locationId\n          });\n          cur = cur.prev;\n        }\n        return chain;\n      }\n      function extendExistingChain(day, eligibleMemberIds, coveragePriority) {\n        let chain = chainByDay.get(day) || [];\n        if (chain.length === 0) return;\n        const usedMembers = new Set(chain.map((s) => s.memberId));\n        const dayCands = byDay.get(day) || [];\n        let extending = true;\n        while (extending) {\n          extending = false;\n          const chainEnd = chain[chain.length - 1];\n          const chainTwoBackLoc = roundTripOriginLoc(\n            chain.length - 1,\n            (i) => i > 0 ? i - 1 : null,\n            (i) => chain[i].locationId\n          );\n          const chainEndArrivedViaTravel = chain.length >= 2 && chain[chain.length - 2].locationId !== chainEnd.locationId;\n          const chainEndIsSoloTravelMember = soloTravelIds.has(chainEnd.memberId) && chainEndArrivedViaTravel;\n          let bestCand = null, bestLocated = null, bestCost = Infinity;\n          dayCands.forEach((cand) => {\n            if (!eligibleMemberIds.has(cand.memberId) || usedMembers.has(cand.memberId))\n              return;\n            let bestLoc = null;\n            locationsForReq(cand).forEach((locId) => {\n              const need = requiredGapMin(chainEnd.locationId, locId);\n              const actual = (cand.startSlot - (chainEnd.startSlot + durationToSlots(chainEnd.duration))) * SLOT_MIN;\n              if (actual < need || actual > need + allowGapMin) return;\n              const cost = travelMinutes(chainEnd.locationId, locId);\n              if (chainEndIsSoloTravelMember && cost > 0) return;\n              if ((forbidInefficient || !coveragePriority) && isInefficientRoundTrip(\n                ineffInfo,\n                chainTwoBackLoc,\n                chainEnd.locationId,\n                locId\n              ))\n                return;\n              if (!bestLoc || cost < bestLoc.cost) bestLoc = { locId, cost };\n            });\n            if (!bestLoc) return;\n            if (travelFirst && bestLoc.cost > 0) return;\n            if (!bestCand || bestLoc.cost < bestCost || bestLoc.cost === bestCost && priorityRank.get(cand.id) < priorityRank.get(bestCand.id)) {\n              bestCand = cand;\n              bestCost = bestLoc.cost;\n              bestLocated = {\n                id: cand.id,\n                memberId: cand.memberId,\n                day,\n                startSlot: cand.startSlot,\n                duration: cand.duration,\n                locationId: bestLoc.locId\n              };\n            }\n          });\n          if (bestLocated) {\n            const projectedChain = [...chain, bestLocated];\n            if (dailyTravelCount(projectedChain) > maxTravelsPerDay) break;\n            if (maxTravelsPerWeek != null && weeklyTravelUsedExcluding(day) + dailyTravelCount(projectedChain) > maxTravelsPerWeek)\n              break;\n            commit(day, bestLocated);\n            chain = chainByDay.get(day);\n            usedMembers.add(bestCand.memberId);\n            extending = true;\n          }\n        }\n      }\n      function endBeforeOf(chain) {\n        const first = chain[0];\n        const second = chain[1];\n        return {\n          slot: first.startSlot,\n          locationId: first.locationId,\n          noTravelIn: !!second && soloTravelIds.has(first.memberId) && travelMinutes(first.locationId, second.locationId) > 0\n        };\n      }\n      function extendChainBackward(day, eligibleMemberIds, weightFn, coveragePriority) {\n        const chain = chainByDay.get(day) || [];\n        if (chain.length === 0) return;\n        const usedMembers = new Set(chain.map((s) => s.memberId));\n        const remaining = new Set(\n          [...eligibleMemberIds].filter((id) => !usedMembers.has(id))\n        );\n        if (remaining.size === 0) return;\n        const frontChain = buildBestChain(\n          day,\n          remaining,\n          weightFn,\n          endBeforeOf(chain),\n          null,\n          coveragePriority\n        );\n        if (frontChain.length === 0) return;\n        const combined = [...frontChain, ...chain];\n        if (dailyTravelCount(combined) > maxTravelsPerDay) return;\n        if (forbidInefficient && dailyInefficientMoveCount(combined, ineffInfo) > dailyInefficientMoveCount(chain, ineffInfo))\n          return;\n        if (maxTravelsPerWeek != null && weeklyTravelUsedExcluding(day) + dailyTravelCount(combined) > maxTravelsPerWeek)\n          return;\n        frontChain.forEach((s) => {\n          assigned.push(s);\n          if (!memberDays.has(s.memberId)) memberDays.set(s.memberId, /* @__PURE__ */ new Set());\n          memberDays.get(s.memberId).add(day);\n        });\n        chainByDay.set(day, combined);\n      }\n      function fillDay(day, eligibleMemberIds, weightFn, coveragePriority) {\n        if ((chainByDay.get(day) || []).length > 0) {\n          extendExistingChain(day, eligibleMemberIds, coveragePriority);\n          extendChainBackward(day, eligibleMemberIds, weightFn, coveragePriority);\n        } else {\n          buildBestChain(\n            day,\n            eligibleMemberIds,\n            weightFn,\n            null,\n            null,\n            coveragePriority\n          ).forEach((s) => commit(day, s));\n        }\n      }\n      function fairnessWeight(memberId) {\n        if (forceOnceMemberIds && forceOnceMemberIds.has(memberId)) {\n          const usedDays = memberDays.get(memberId);\n          if (!usedDays || usedDays.size === 0) return FORCE_ONCE_WEIGHT;\n        }\n        return 1;\n      }\n      if (pinned.length > 0) {\n        const pinsByDay = /* @__PURE__ */ new Map();\n        pinned.forEach((p) => {\n          if (!pinsByDay.has(p.day)) pinsByDay.set(p.day, []);\n          pinsByDay.get(p.day).push(p);\n        });\n        pinsByDay.forEach((dayPins, day) => {\n          dayPins.sort((a, b) => a.startSlot - b.startSlot);\n          const pinnedMemberIds = new Set(dayPins.map((p) => p.memberId));\n          const beforeEligible = new Set(\n            [...allMemberIdsForDay(day)].filter((id) => !pinnedMemberIds.has(id))\n          );\n          buildBestChain(\n            day,\n            beforeEligible,\n            fairnessWeight,\n            endBeforeOf(dayPins)\n          ).forEach((s) => commit(day, s));\n          dayPins.forEach((p) => commit(day, p));\n        });\n      }\n      if (pinnedLocationDay && !pinned.some((p) => p.day === pinnedLocationDay.day) && (byDay.get(pinnedLocationDay.day) || []).length > 0) {\n        buildBestChain(\n          pinnedLocationDay.day,\n          allMemberIdsForDay(pinnedLocationDay.day),\n          fairnessWeight,\n          null,\n          pinnedLocationDay.locationId\n        ).forEach((s) => commit(pinnedLocationDay.day, s));\n      }\n      stage1Order.forEach((day) => {\n        const elig = new Set(\n          [...allMemberIdsForDay(day)].filter((id) => {\n            if (!sessionCountFirst) {\n              const usedDays = memberDays.get(id);\n              if (usedDays && usedDays.size >= 1) return false;\n            }\n            return withinCaps(id, day);\n          })\n        );\n        fillDay(day, elig, fairnessWeight, !sessionCountFirst);\n      });\n      days.forEach((day) => {\n        const elig = new Set(\n          [...allMemberIdsForDay(day)].filter((id) => {\n            if (!withinCaps(id, day)) return false;\n            const usedDays = memberDays.get(id);\n            if (usedDays && isAdjacentDay(day, usedDays)) return false;\n            return true;\n          })\n        );\n        fillDay(day, elig);\n      });\n      days.forEach((day) => {\n        const elig = new Set(\n          [...allMemberIdsForDay(day)].filter((id) => withinCaps(id, day))\n        );\n        fillDay(day, elig);\n      });\n      return assigned;\n    }\n    function runWithGapPolicy(allowGapMin) {\n      const naturalResult = runPass(days, allowGapMin);\n      if (!minimizeUnassigned && !externalDayOrder) return naturalResult;\n      let best = naturalResult;\n      let bestMemberCount = new Set(best.map((r) => r.memberId)).size;\n      function consider(order) {\n        const attempt = runPass(order, allowGapMin);\n        const attemptMemberCount = new Set(attempt.map((r) => r.memberId)).size;\n        if (attemptMemberCount > bestMemberCount || attemptMemberCount === bestMemberCount && attempt.length > best.length) {\n          best = attempt;\n          bestMemberCount = attemptMemberCount;\n        }\n      }\n      if (minimizeUnassigned) {\n        consider(\n          [...days].sort(\n            (a, b) => allMemberIdsForDay(a).size - allMemberIdsForDay(b).size\n          )\n        );\n      }\n      if (externalDayOrder) {\n        consider(externalDayOrder.filter((d) => byDay.has(d)));\n      }\n      return best;\n    }\n    const strictResult = runWithGapPolicy(0);\n    const looseResult = ALLOWED_GAP_MIN > 0 ? runWithGapPolicy(ALLOWED_GAP_MIN) : strictResult;\n    return looseResult.length > strictResult.length ? looseResult : strictResult;\n  }\n  function totalTravelMinutes(assigned) {\n    let total = 0;\n    const byDay = /* @__PURE__ */ new Map();\n    assigned.forEach((r) => {\n      if (!byDay.has(r.day)) byDay.set(r.day, []);\n      byDay.get(r.day).push(r);\n    });\n    byDay.forEach((reqs) => {\n      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);\n      for (let i = 1; i < sorted.length; i++) {\n        total += travelMinutes(sorted[i - 1].locationId, sorted[i].locationId);\n      }\n    });\n    return total;\n  }\n  function totalTravelCount(assigned) {\n    let total = 0;\n    const byDay = /* @__PURE__ */ new Map();\n    assigned.forEach((r) => {\n      if (!byDay.has(r.day)) byDay.set(r.day, []);\n      byDay.get(r.day).push(r);\n    });\n    byDay.forEach((reqs) => {\n      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);\n      for (let i = 1; i < sorted.length; i++) {\n        if (travelMinutes(sorted[i - 1].locationId, sorted[i].locationId) > 0)\n          total++;\n      }\n    });\n    return total;\n  }\n  function totalInefficientMoveCount(assigned, info) {\n    info = info === void 0 ? inefficientRoundTripLocationInfo() : info;\n    let total = 0;\n    const byDay = /* @__PURE__ */ new Map();\n    assigned.forEach((r) => {\n      if (!byDay.has(r.day)) byDay.set(r.day, []);\n      byDay.get(r.day).push(r);\n    });\n    byDay.forEach((reqs) => {\n      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);\n      total += dailyInefficientMoveCount(sorted, info);\n    });\n    return total;\n  }\n  function buildCandidate(title, desc, sortedReqs, eligibleSet, allMemberIds, options, pinned) {\n    const assigned = greedyAssign(\n      sortedReqs.filter((r) => eligibleSet.has(r.id)),\n      options,\n      pinned\n    );\n    const assignedMemberIds = new Set(assigned.map((r) => r.memberId));\n    const unassignedMembers = [...allMemberIds].filter((id) => !assignedMemberIds.has(id)).map((id) => memberById(id)).filter(Boolean);\n    return {\n      title,\n      desc,\n      assigned,\n      unassignedMembers,\n      travelMinutes: totalTravelMinutes(assigned)\n    };\n  }\n  var CONTENTION_BUCKET_SLOTS = durationToSlots(SESSION_DURATION_MIN);\n  function reqEnd(r) {\n    return r.startSlot + durationToSlots(r.duration);\n  }\n  function endBucket(r) {\n    return Math.floor(reqEnd(r) / CONTENTION_BUCKET_SLOTS);\n  }\n  function defaultSort(eligible, jitter) {\n    return [...eligible].sort(\n      (a, b) => a.day - b.day || endBucket(a) - endBucket(b) || jitter.get(a.id) - jitter.get(b.id) || reqEnd(a) - reqEnd(b)\n    );\n  }\n  var STRATEGIES = [\n    {\n      title: "후보A - 인원 최대",\n      desc: "미배정 없음 → 비효율 이동 없음 → 수업 수·이동 횟수·빈 시간 균형(수업 1건 = 이동 1번) 순으로 배정합니다.",\n      // minimizeUnassigned: 기본 요일 순서로 한 번 배정해보고, 신청 가능한 회원이 적은\n      // 요일부터 먼저 채우는 대안 순서로도 한 번 더 시도해본 뒤, 미배정 회원이 더 적은\n      // 쪽(동점이면 총 세션 수가 많은 쪽)을 택한다 — 예전에는 이 대안 시도를 별도 후보(H)로\n      // 분리해뒀지만, 대안이 기본 순서보다 나쁠 수는 없는 구조라(runWithGapPolicy 참고) 후보A\n      // 자체에 통합했다. 분리해뒀을 때는 후보A와 후보H가 대부분 똑같거나, 다르면 항상 후보H가\n      // 후보A보다 낫거나 같아서 후보A를 고를 이유가 없는 중복이었다.\n      options: { strengthenSearch: "count", minimizeUnassigned: true },\n      sort: defaultSort\n    },\n    {\n      title: "후보B - 수업 횟수 최대",\n      desc: "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.",\n      options: {\n        sessionCountFirst: true,\n        strengthenSearch: "sessions",\n        maxUnassigned: 1\n      },\n      sort: defaultSort\n    }\n  ];\n  function strengthenCandidate(baseline, sorted, eligibleIds, allMemberIds, options, pinned, primary) {\n    let best = baseline;\n    let bestScore = candidateSearchScore(best, primary, options.maxUnassigned);\n    function consider(opts) {\n      const attempt = buildCandidate(\n        baseline.title,\n        baseline.desc,\n        sorted,\n        eligibleIds,\n        allMemberIds,\n        opts,\n        pinned\n      );\n      const attemptScore = candidateSearchScore(\n        attempt,\n        primary,\n        options.maxUnassigned\n      );\n      if (isCandidateWorse(bestScore, attemptScore)) {\n        best = attempt;\n        bestScore = attemptScore;\n      }\n    }\n    const flippedOptions = Object.assign({}, options, {\n      sessionCountFirst: !options.sessionCountFirst\n    });\n    consider(flippedOptions);\n    [options, flippedOptions].forEach(\n      (o) => consider(Object.assign({}, o, { forbidInefficient: true }))\n    );\n    if (state.locations.length >= 2) {\n      [options, flippedOptions].forEach((optsVariant) => {\n        DAYS.forEach((d, day) => {\n          state.locations.forEach((loc) => {\n            consider(\n              Object.assign({}, optsVariant, {\n                pinnedLocationDay: { day, locationId: loc.id }\n              })\n            );\n          });\n        });\n      });\n    }\n    return best;\n  }\n  function repairUnassigned(baseline, sorted, eligibleIds, allMemberIds, options, pinned, primary) {\n    let best = baseline;\n    let bestScore = candidateSearchScore(best, primary, options.maxUnassigned);\n    function tryForce(ids) {\n      const forcedOptions = Object.assign({}, options, {\n        forceOnceMemberIds: ids\n      });\n      const attempt = buildCandidate(\n        baseline.title,\n        baseline.desc,\n        sorted,\n        eligibleIds,\n        allMemberIds,\n        forcedOptions,\n        pinned\n      );\n      const attemptScore = candidateSearchScore(\n        attempt,\n        primary,\n        options.maxUnassigned\n      );\n      if (!isCandidateWorse(attemptScore, bestScore)) {\n        best = attempt;\n        bestScore = attemptScore;\n        return true;\n      }\n      return false;\n    }\n    if (baseline.unassignedMembers.length > 0 && baseline.unassignedMembers.length <= 6) {\n      tryForce(baseline.unassignedMembers.map((m) => m.id));\n    }\n    const tried = /* @__PURE__ */ new Set();\n    let guard = 0;\n    while (guard < 6) {\n      guard++;\n      const target = best.unassignedMembers.find((m) => !tried.has(m.id));\n      if (!target) break;\n      tried.add(target.id);\n      tryForce([target.id]);\n    }\n    return best;\n  }\n  function buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, jitter, pinned, dayOrder) {\n    const strategy = STRATEGIES[strategyIndex];\n    const sorted = strategy.sort(eligible, jitter);\n    const strategyOptions = typeof strategy.options === "function" ? strategy.options() : strategy.options;\n    const globalOptions = {};\n    if (dayOrder) globalOptions.stage1DayOrder = dayOrder;\n    const options = Object.assign({}, strategyOptions, globalOptions);\n    let cand = buildCandidate(\n      strategy.title,\n      strategy.desc,\n      sorted,\n      eligibleIds,\n      allMemberIds,\n      options,\n      pinned\n    );\n    if (strategyOptions.strengthenSearch) {\n      cand = strengthenCandidate(\n        cand,\n        sorted,\n        eligibleIds,\n        allMemberIds,\n        options,\n        pinned,\n        strategyOptions.strengthenSearch\n      );\n      if (cand.unassignedMembers.length > 0) {\n        cand = repairUnassigned(\n          cand,\n          sorted,\n          eligibleIds,\n          allMemberIds,\n          options,\n          pinned,\n          strategyOptions.strengthenSearch\n        );\n      }\n    }\n    cand.strategyIndex = strategyIndex;\n    return cand;\n  }\n  function candidateSearchScore(cand, primary, maxUnassigned) {\n    const count = new Set(cand.assigned.map((r) => r.memberId)).size;\n    const sessions = cand.assigned.length;\n    const travel = totalTravelCount(cand.assigned);\n    const ineff = totalInefficientMoveCount(cand.assigned);\n    const capOk = typeof maxUnassigned === "number" && cand.unassignedMembers.length > maxUnassigned ? 0 : 1;\n    const idle = schedule2TotalIdleMinutes(cand.assigned);\n    const balanced = sessions * SESSION_VALUE_MINUTES - travel * TRAVEL_VALUE_MINUTES - idle;\n    return primary === "sessions" ? [capOk, -ineff, sessions, count, -travel, -idle] : [capOk, count, -ineff, balanced, sessions, -travel, -idle];\n  }\n  function isCandidateWorse(a, b) {\n    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];\n    return false;\n  }\n  function makeSeededRandom(seed) {\n    let s = seed >>> 0;\n    return function() {\n      s |= 0;\n      s = s + 1831565813 | 0;\n      let t = Math.imul(s ^ s >>> 15, 1 | s);\n      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;\n      return ((t ^ t >>> 14) >>> 0) / 4294967296;\n    };\n  }\n  function shuffledDayOrder(randomFn) {\n    const order = DAYS.map((_, i) => i);\n    for (let i = order.length - 1; i > 0; i--) {\n      const j = Math.floor(randomFn() * (i + 1));\n      const tmp = order[i];\n      order[i] = order[j];\n      order[j] = tmp;\n    }\n    return order;\n  }\n  function yieldToUI() {\n    if (typeof document === "undefined" || document.hidden) {\n      return new Promise((resolve) => setTimeout(resolve, 0));\n    }\n    return new Promise(\n      (resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))\n    );\n  }\n  function checkGenerationCancelled() {\n    if (runtime.generationCancelRequested) throw new GenerationCancelledError();\n  }\n  function* greedyAttemptInputs(strategyIndex, eligible, attempts) {\n    const rand = makeSeededRandom(strategyIndex + 1);\n    yield { jitter: new Map(eligible.map((r) => [r.id, 0])), dayOrder: void 0 };\n    for (let i = 0; i < attempts; i++) {\n      const jitter = new Map(eligible.map((r) => [r.id, rand()]));\n      const dayOrder = shuffledDayOrder(rand);\n      yield { jitter, dayOrder };\n    }\n  }\n  var TRAVEL_VALUE_MINUTES = 60;\n  var SESSION_VALUE_MINUTES = TRAVEL_VALUE_MINUTES;\n\n  // src/engine/chainDpCore.js\n  var idleFirst = false;\n  function isIdleFirst() {\n    return idleFirst;\n  }\n  function setIdleFirst(on) {\n    idleFirst = on;\n  }\n  function sessionDurationFor2(member) {\n    return (member && (member.category || "상담")) === "상담" ? CONSULT_DURATION_MIN_2 : SESSION_DURATION_MIN_2;\n  }\n  function maxSessionsFor2(member) {\n    if (!member) return 1;\n    if (currentOnceLimitIds2().includes(member.id)) return 1;\n    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;\n  }\n  function requiredGapMin2(locA, locB) {\n    const raw = travelMinutes(locA, locB);\n    return raw > 0 ? Math.ceil(raw / SLOT_MIN) * SLOT_MIN : 0;\n  }\n  function buildDayNodes(dayRequests, weightFn, jitterFn, locationsFor = candidateLocationsForRequest) {\n    const nodes = [];\n    dayRequests.forEach((r) => {\n      const member = memberById(r.memberId);\n      const duration = sessionDurationFor2(member);\n      const end = r.startSlot + durationToSlots(duration);\n      locationsFor(r).forEach((locationId) => {\n        const weight = weightFn(r.memberId, r.startSlot, locationId);\n        if (!weight) return;\n        nodes.push({\n          id: r.id,\n          memberId: r.memberId,\n          day: r.day,\n          startSlot: r.startSlot,\n          duration,\n          locationId,\n          end,\n          weight,\n          jitter: jitterFn ? jitterFn() : 0\n        });\n      });\n    });\n    return nodes;\n  }\n  function runChainDP(nodes, maxTravelsPerDay, ineffInfo, coveragePriority) {\n    if (maxTravelsPerDay === void 0) maxTravelsPerDay = MAX_TRAVELS_PER_DAY;\n    nodes = nodes.slice().sort((a, b) => a.end - b.end || a.startSlot - b.startSlot);\n    const n = nodes.length;\n    const dp = new Array(n), tc = new Array(n), tm = new Array(n), idle = new Array(n), js = new Array(n), ineff = new Array(n), prev = new Array(n), twoBackLocIdx = new Array(n);\n    const prevOrNull = (k) => prev[k] !== -1 ? prev[k] : null;\n    const locOfIndex = (k) => nodes[k].locationId;\n    function better(dpA, ineffA, tcA, tmA, idleA, jsA, dpB, ineffB, tcB, tmB, idleB, jsB) {\n      const hardWeightGap = Math.abs(dpA - dpB) >= COVERAGE_WEIGHT_GAP_THRESHOLD;\n      if (coveragePriority || hardWeightGap) {\n        if (dpA !== dpB) return dpA > dpB;\n        if (ineffA !== ineffB) return ineffA < ineffB;\n      } else {\n        if (ineffA !== ineffB) return ineffA < ineffB;\n        if (dpA !== dpB) return dpA > dpB;\n      }\n      if (idleFirst && idleA !== idleB) return idleA < idleB;\n      if (tcA !== tcB) return tcA < tcB;\n      if (tmA !== tmB) return tmA < tmB;\n      if (idleA !== idleB) return idleA < idleB;\n      return jsA < jsB;\n    }\n    const locIndex = /* @__PURE__ */ new Map();\n    nodes.forEach((nd) => {\n      if (!locIndex.has(nd.locationId)) locIndex.set(nd.locationId, locIndex.size);\n    });\n    const locIds = Array.from(locIndex.keys());\n    const L = locIds.length;\n    const travelOf = new Array(L * L), gapNeedOf = new Array(L * L);\n    for (let a = 0; a < L; a++)\n      for (let b = 0; b < L; b++) {\n        travelOf[a * L + b] = travelMinutes(locIds[a], locIds[b]);\n        gapNeedOf[a * L + b] = requiredGapMin2(locIds[a], locIds[b]);\n      }\n    const locIdxOf = nodes.map((nd) => locIndex.get(nd.locationId));\n    const ineffOf = new Array((L + 1) * L * L);\n    for (let a = 0; a <= L; a++)\n      for (let b = 0; b < L; b++)\n        for (let c = 0; c < L; c++)\n          ineffOf[(a * L + b) * L + c] = isInefficientRoundTrip(\n            ineffInfo,\n            a === L ? null : locIds[a],\n            locIds[b],\n            locIds[c]\n          ) ? 1 : 0;\n    const memberIndex = /* @__PURE__ */ new Map();\n    nodes.forEach((nd) => {\n      if (!memberIndex.has(nd.memberId))\n        memberIndex.set(nd.memberId, memberIndex.size);\n    });\n    const W = Math.max(1, Math.ceil(memberIndex.size / 32));\n    const memberBits = new Uint32Array(n * W);\n    const memberIdxOf = nodes.map((nd) => memberIndex.get(nd.memberId));\n    const soloIds = soloTravelMemberIds();\n    const noTravelOut = new Uint8Array(n);\n    for (let i = 0; i < n; i++) {\n      const node = nodes[i];\n      let bestDp = node.weight, bestIneff = 0, bestTc = 0, bestTm = 0, bestIdle = 0, bestJs = node.jitter || 0, bestPrev = -1;\n      const mIdx = memberIdxOf[i];\n      const mWord = mIdx >>> 5, mMask = 1 << (mIdx & 31);\n      for (let j = 0; j < i; j++) {\n        const p = nodes[j];\n        if (p.end > node.startSlot) break;\n        const pair = locIdxOf[j] * L + locIdxOf[i];\n        const gapNeed = gapNeedOf[pair];\n        const gapActual = (node.startSlot - p.end) * SLOT_MIN;\n        if (gapActual < gapNeed) continue;\n        const travel = travelOf[pair];\n        const addsTravel = travel > 0 ? 1 : 0;\n        const newTc = tc[j] + addsTravel;\n        if (newTc > maxTravelsPerDay) continue;\n        if (memberBits[j * W + mWord] & mMask) continue;\n        if (addsTravel && noTravelOut[j]) continue;\n        const newDp = dp[j] + node.weight;\n        const newTm = tm[j] + travel;\n        const newIdle = idle[j] + (gapActual - gapNeed);\n        const newJs = js[j] + (node.jitter || 0);\n        const newIneff = ineff[j] + ineffOf[(twoBackLocIdx[j] * L + locIdxOf[j]) * L + locIdxOf[i]];\n        if (better(\n          newDp,\n          newIneff,\n          newTc,\n          newTm,\n          newIdle,\n          newJs,\n          bestDp,\n          bestIneff,\n          bestTc,\n          bestTm,\n          bestIdle,\n          bestJs\n        )) {\n          bestDp = newDp;\n          bestIneff = newIneff;\n          bestTc = newTc;\n          bestTm = newTm;\n          bestIdle = newIdle;\n          bestJs = newJs;\n          bestPrev = j;\n        }\n      }\n      dp[i] = bestDp;\n      ineff[i] = bestIneff;\n      tc[i] = bestTc;\n      tm[i] = bestTm;\n      idle[i] = bestIdle;\n      js[i] = bestJs;\n      prev[i] = bestPrev;\n      const twoBack = roundTripOriginLoc(i, prevOrNull, locOfIndex);\n      twoBackLocIdx[i] = twoBack === null ? L : locIndex.get(twoBack);\n      noTravelOut[i] = bestPrev !== -1 && soloIds.has(node.memberId) && travelOf[locIdxOf[bestPrev] * L + locIdxOf[i]] > 0 ? 1 : 0;\n      if (bestPrev !== -1)\n        memberBits.set(\n          memberBits.subarray(bestPrev * W, bestPrev * W + W),\n          i * W\n        );\n      memberBits[i * W + mWord] |= mMask;\n    }\n    let bestEnd = -1, bestDpAll = 0, bestIneffAll = 0, bestTcAll = 0, bestTmAll = 0, bestIdleAll = 0, bestJsAll = 0;\n    for (let i = 0; i < n; i++) {\n      if (bestEnd === -1 || better(\n        dp[i],\n        ineff[i],\n        tc[i],\n        tm[i],\n        idle[i],\n        js[i],\n        bestDpAll,\n        bestIneffAll,\n        bestTcAll,\n        bestTmAll,\n        bestIdleAll,\n        bestJsAll\n      )) {\n        bestDpAll = dp[i];\n        bestIneffAll = ineff[i];\n        bestTcAll = tc[i];\n        bestTmAll = tm[i];\n        bestIdleAll = idle[i];\n        bestJsAll = js[i];\n        bestEnd = i;\n      }\n    }\n    const chain = [];\n    let cur = bestEnd;\n    while (cur !== -1 && cur !== void 0) {\n      chain.unshift(nodes[cur]);\n      cur = prev[cur];\n    }\n    return chain;\n  }\n\n  // src/engine/rng.js\n  function mulberry32(seed) {\n    return function() {\n      seed |= 0;\n      seed = seed + 1831565813 | 0;\n      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);\n      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;\n      return ((t ^ t >>> 14) >>> 0) / 4294967296;\n    };\n  }\n  function shuffled(arr, randomFn) {\n    const a = arr.slice();\n    for (let i = a.length - 1; i > 0; i--) {\n      const j = Math.floor(randomFn() * (i + 1));\n      [a[i], a[j]] = [a[j], a[i]];\n    }\n    return a;\n  }\n\n  // src/engine/chainDpPolish.js\n  function findEarlierRequestForLocation(requests, minStart, currentStart, locationId) {\n    let earliest = null;\n    requests.forEach((r) => {\n      if (r.startSlot < minStart || r.startSlot >= currentStart) return;\n      if (!candidateLocationsForRequest(r).includes(locationId)) return;\n      if (!earliest || r.startSlot < earliest.startSlot) earliest = r;\n    });\n    return earliest;\n  }\n  function moveNodeToRequest(node, request) {\n    node.id = request.id;\n    node.startSlot = request.startSlot;\n    node.end = request.startSlot + durationToSlots(node.duration);\n  }\n  async function runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, stage1DayOrder, runRepair, runPolish, polishBudgetMs, seedOffset) {\n    seedOffset = seedOffset || 0;\n    const ineffInfo = inefficientRoundTripLocationInfo();\n    const soloIds = soloTravelMemberIds();\n    function dayChainAllowed(chain) {\n      return !dayChainViolation(chain, soloIds);\n    }\n    let yieldOverheadMs = 0;\n    function now() {\n      return performance.now() - yieldOverheadMs;\n    }\n    let lastYieldAt = performance.now();\n    const YIELD_INTERVAL_MS = 48;\n    async function maybeYield() {\n      checkGenerationCancelled();\n      const t = performance.now();\n      if (t - lastYieldAt < YIELD_INTERVAL_MS) return;\n      await yieldToUI();\n      yieldOverheadMs += performance.now() - t;\n      lastYieldAt = performance.now();\n      checkGenerationCancelled();\n    }\n    const stage1RandomFn = mulberry32(112233 + seedOffset);\n    const assignedCountByMember = /* @__PURE__ */ new Map();\n    const assignedDaysByMember = /* @__PURE__ */ new Map();\n    const dayChains = /* @__PURE__ */ new Map();\n    const REPAIR_DEADLINE = now() + 3e3;\n    const reqsByMemberDay = /* @__PURE__ */ new Map();\n    eligibleReqs.forEach((r) => {\n      if (!reqsByMemberDay.has(r.memberId))\n        reqsByMemberDay.set(r.memberId, /* @__PURE__ */ new Map());\n      const byDay = reqsByMemberDay.get(r.memberId);\n      if (!byDay.has(r.day)) byDay.set(r.day, []);\n      byDay.get(r.day).push(r);\n    });\n    function reqsFor(memberId, day) {\n      const byDay = reqsByMemberDay.get(memberId);\n      return byDay && byDay.get(day) || [];\n    }\n    function reqAt(memberId, day, startSlot) {\n      return reqsFor(memberId, day).find((r) => r.startSlot === startSlot);\n    }\n    const locationsByReq = /* @__PURE__ */ new Map();\n    function locationsForReq(r) {\n      let locs = locationsByReq.get(r);\n      if (!locs) {\n        locs = candidateLocationsForRequest(r);\n        locationsByReq.set(r, locs);\n      }\n      return locs;\n    }\n    function dayNodes(dayRequests, weightFn, jitterFn) {\n      return buildDayNodes(dayRequests, weightFn, jitterFn, locationsForReq);\n    }\n    function isEligibleForDay(memberId, day) {\n      const cap = maxSessionsFor2(memberById(memberId));\n      if ((assignedCountByMember.get(memberId) || 0) >= cap) return false;\n      const days = assignedDaysByMember.get(memberId);\n      return !(days && days.has(day));\n    }\n    function commit(day, node) {\n      assignedCountByMember.set(\n        node.memberId,\n        (assignedCountByMember.get(node.memberId) || 0) + 1\n      );\n      if (!assignedDaysByMember.has(node.memberId))\n        assignedDaysByMember.set(node.memberId, /* @__PURE__ */ new Set());\n      assignedDaysByMember.get(node.memberId).add(day);\n    }\n    function uncommit(day, node) {\n      assignedCountByMember.set(\n        node.memberId,\n        assignedCountByMember.get(node.memberId) - 1\n      );\n      assignedDaysByMember.get(node.memberId).delete(day);\n    }\n    function dominantLocationFor(day) {\n      const membersByLoc = /* @__PURE__ */ new Map();\n      reqsByDay.get(day).forEach((r) => {\n        if ((assignedCountByMember.get(r.memberId) || 0) !== 0) return;\n        locationsForReq(r).forEach((locId) => {\n          if (!membersByLoc.has(locId)) membersByLoc.set(locId, /* @__PURE__ */ new Set());\n          membersByLoc.get(locId).add(r.memberId);\n        });\n      });\n      let dominantLoc = null, dominantCount = -1;\n      membersByLoc.forEach((set, locId) => {\n        if (set.size > dominantCount) {\n          dominantCount = set.size;\n          dominantLoc = locId;\n        }\n      });\n      return dominantLoc;\n    }\n    stage1DayOrder.forEach((day) => {\n      const dominantLoc = dominantLocationFor(day);\n      const nodes = dayNodes(\n        reqsByDay.get(day),\n        (memberId, startSlot, locationId) => {\n          if ((assignedCountByMember.get(memberId) || 0) !== 0) return 0;\n          return locationId === dominantLoc ? 1.02 : 1;\n        },\n        () => stage1RandomFn()\n      );\n      const chain = runChainDP(nodes, void 0, ineffInfo, true);\n      chain.forEach((node) => commit(day, node));\n      dayChains.set(day, chain);\n    });\n    const PIN_WEIGHT = 1e6;\n    daysWithReqs.forEach((day) => {\n      const existingChain = dayChains.get(day) || [];\n      existingChain.forEach((node) => uncommit(day, node));\n      const pinnedKeys = new Set(\n        existingChain.map(\n          (n) => n.memberId + "|" + n.startSlot + "|" + n.locationId\n        )\n      );\n      const pinnedMemberIds = new Set(existingChain.map((n) => n.memberId));\n      const nodes = dayNodes(\n        reqsByDay.get(day),\n        (memberId, startSlot, locationId) => {\n          if (pinnedKeys.has(memberId + "|" + startSlot + "|" + locationId))\n            return PIN_WEIGHT;\n          if (pinnedMemberIds.has(memberId)) return 0;\n          return isEligibleForDay(memberId, day) ? 1 : 0;\n        },\n        () => stage1RandomFn()\n      );\n      const chain = runChainDP(nodes, void 0, ineffInfo);\n      chain.forEach((node) => commit(day, node));\n      dayChains.set(day, chain);\n    });\n    const MAX_EJECTION_DEPTH = 3;\n    const submittedIds = new Set(state.requests.map((r) => r.memberId));\n    function isCurrentlyAssigned(memberId) {\n      return (assignedCountByMember.get(memberId) || 0) > 0;\n    }\n    const excludedIdSet2 = new Set(currentExcludedIds2());\n    function tryPlaceMember(memberId, excludeDays, depth) {\n      if (depth > MAX_EJECTION_DEPTH) return false;\n      if (now() > REPAIR_DEADLINE) return false;\n      const alreadyUsedDays = assignedDaysByMember.get(memberId) || /* @__PURE__ */ new Set();\n      const candidateDays = daysWithReqs.filter(\n        (day) => !excludeDays.has(day) && !alreadyUsedDays.has(day) && reqsByDay.get(day).some((r) => r.memberId === memberId)\n      );\n      for (const day of candidateDays) {\n        const chain0 = dayChains.get(day) || [];\n        const dayReqsForMember = reqsFor(memberId, day);\n        const candNodes = dayNodes(dayReqsForMember, () => 1);\n        for (const cand of candNodes) {\n          let insertAt = 0;\n          while (insertAt < chain0.length && chain0[insertAt].startSlot < cand.startSlot)\n            insertAt++;\n          let feasible = true;\n          if (insertAt > 0) {\n            const prev = chain0[insertAt - 1];\n            const prevEnd = prev.startSlot + durationToSlots(prev.duration);\n            if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId))\n              feasible = false;\n          }\n          if (feasible && insertAt < chain0.length) {\n            const next = chain0[insertAt];\n            if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId))\n              feasible = false;\n          }\n          if (!feasible) continue;\n          const newNode = {\n            id: cand.id,\n            memberId,\n            day,\n            startSlot: cand.startSlot,\n            duration: cand.duration,\n            locationId: cand.locationId,\n            end: cand.end\n          };\n          const newChain = chain0.slice();\n          newChain.splice(insertAt, 0, newNode);\n          if (!dayChainAllowed(newChain)) continue;\n          commit(day, newNode);\n          dayChains.set(day, newChain);\n          return true;\n        }\n        for (const cand of candNodes) {\n          const chain = dayChains.get(day) || [];\n          const overlapping = /* @__PURE__ */ new Set();\n          chain.forEach((n) => {\n            const nEnd = n.startSlot + durationToSlots(n.duration);\n            if (cand.startSlot < nEnd && n.startSlot < cand.end)\n              overlapping.add(n.memberId);\n          });\n          let otherMemberId = null;\n          if (overlapping.size === 1) {\n            otherMemberId = [...overlapping][0];\n          } else if (overlapping.size === 0) {\n            const sorted = chain.slice().sort((a, b) => a.startSlot - b.startSlot);\n            let idx = 0;\n            while (idx < sorted.length && sorted[idx].startSlot < cand.startSlot)\n              idx++;\n            const prevN = idx > 0 ? sorted[idx - 1] : null;\n            const nextN = idx < sorted.length ? sorted[idx] : null;\n            const prevBad = prevN && (cand.startSlot - (prevN.startSlot + durationToSlots(prevN.duration))) * SLOT_MIN < requiredGapMin2(prevN.locationId, cand.locationId);\n            const nextBad = nextN && (nextN.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, nextN.locationId);\n            if (prevBad && nextBad && prevN.memberId !== nextN.memberId) continue;\n            if (prevBad) otherMemberId = prevN.memberId;\n            else if (nextBad) otherMemberId = nextN.memberId;\n            else continue;\n          } else {\n            continue;\n          }\n          const otherNode = chain.find((n) => n.memberId === otherMemberId);\n          const remainingChain = chain.filter(\n            (n) => n.memberId !== otherMemberId\n          );\n          let insertAt = 0;\n          while (insertAt < remainingChain.length && remainingChain[insertAt].startSlot < cand.startSlot)\n            insertAt++;\n          let feasible = true;\n          if (insertAt > 0) {\n            const prev = remainingChain[insertAt - 1];\n            const prevEnd = prev.startSlot + durationToSlots(prev.duration);\n            const gapMin = (cand.startSlot - prevEnd) * SLOT_MIN;\n            if (gapMin < requiredGapMin2(prev.locationId, cand.locationId))\n              feasible = false;\n          }\n          if (feasible && insertAt < remainingChain.length) {\n            const next = remainingChain[insertAt];\n            const gapMin = (next.startSlot - cand.end) * SLOT_MIN;\n            if (gapMin < requiredGapMin2(cand.locationId, next.locationId))\n              feasible = false;\n          }\n          if (!feasible) continue;\n          const newNode = {\n            id: cand.id,\n            memberId,\n            day,\n            startSlot: cand.startSlot,\n            duration: cand.duration,\n            locationId: cand.locationId,\n            end: cand.end\n          };\n          const newChain = remainingChain.slice();\n          newChain.splice(insertAt, 0, newNode);\n          if (!dayChainAllowed(newChain)) continue;\n          uncommit(day, otherNode);\n          commit(day, newNode);\n          dayChains.set(day, newChain);\n          if (tryPlaceMember(\n            otherMemberId,\n            /* @__PURE__ */ new Set([...excludeDays, day]),\n            depth + 1\n          )) {\n            return true;\n          }\n          uncommit(day, newNode);\n          commit(day, otherNode);\n          dayChains.set(day, chain);\n        }\n      }\n      return false;\n    }\n    function stillUnassignedIds() {\n      return state.members.filter((m) => !excludedIdSet2.has(m.id) && submittedIds.has(m.id)).map((m) => m.id).filter((id) => !isCurrentlyAssigned(id));\n    }\n    if (runRepair) {\n      let tryRebuildDayFor = function(memberId, day) {\n        const beforeUnassigned = stillUnassignedIds().length;\n        const existingChain = dayChains.get(day) || [];\n        existingChain.forEach((node) => uncommit(day, node));\n        const nodes = dayNodes(reqsByDay.get(day), (mId) => {\n          if (mId === memberId) return REBUILD_TARGET_WEIGHT;\n          return isEligibleForDay(mId, day) ? 1 : 0;\n        });\n        const newChain = runChainDP(nodes, void 0, ineffInfo);\n        if (!newChain.some((n) => n.memberId === memberId)) {\n          existingChain.forEach((node) => commit(day, node));\n          dayChains.set(day, existingChain);\n          return false;\n        }\n        newChain.forEach((node) => commit(day, node));\n        dayChains.set(day, newChain);\n        const afterUnassigned = stillUnassignedIds().length;\n        if (afterUnassigned < beforeUnassigned || afterUnassigned === beforeUnassigned && newChain.length >= existingChain.length) {\n          return true;\n        }\n        newChain.forEach((node) => uncommit(day, node));\n        existingChain.forEach((node) => commit(day, node));\n        dayChains.set(day, existingChain);\n        return false;\n      };\n      for (const memberId of stillUnassignedIds()) {\n        await maybeYield();\n        if (isCurrentlyAssigned(memberId)) continue;\n        tryPlaceMember(memberId, /* @__PURE__ */ new Set(), 0);\n      }\n      const REBUILD_TARGET_WEIGHT = 1e6;\n      for (const memberId of stillUnassignedIds()) {\n        await maybeYield();\n        if (now() > REPAIR_DEADLINE) break;\n        if (isCurrentlyAssigned(memberId)) continue;\n        const candidateDays = daysWithReqs.filter(\n          (day) => reqsByDay.get(day).some((r) => r.memberId === memberId)\n        );\n        for (const day of candidateDays) {\n          if (tryRebuildDayFor(memberId, day)) break;\n        }\n      }\n      let addedExtra = true;\n      let extraPassCount = 0;\n      while (addedExtra && extraPassCount < 5) {\n        addedExtra = false;\n        extraPassCount++;\n        const extraCandidateIds = state.members.filter((m) => !excludedIdSet2.has(m.id)).map((m) => m.id).filter((id) => {\n          const count = assignedCountByMember.get(id) || 0;\n          return count > 0 && count < maxSessionsFor2(memberById(id));\n        });\n        for (const memberId of extraCandidateIds) {\n          await maybeYield();\n          if (tryPlaceMember(memberId, /* @__PURE__ */ new Set(), 0)) addedExtra = true;\n        }\n      }\n    }\n    if (runPolish) {\n      let fewerTravelOrIdle = function(travelA, idleA, travelB, idleB) {\n        if (isIdleFirst() && idleA !== idleB) return idleA < idleB;\n        return travelA < travelB;\n      }, dayIdleMinutes = function(chain) {\n        const sorted = [...chain].sort((a, b) => a.startSlot - b.startSlot);\n        let idle = 0;\n        for (let i = 1; i < sorted.length; i++) {\n          const prev = sorted[i - 1], cur = sorted[i];\n          const gapMin = (cur.startSlot - (prev.startSlot + durationToSlots(prev.duration))) * SLOT_MIN;\n          idle += Math.max(\n            0,\n            gapMin - requiredGapMin2(prev.locationId, cur.locationId)\n          );\n        }\n        return idle;\n      }, isTravelIdleBetter = function(travelA, idleA, travelB, idleB, ineffA, ineffB) {\n        ineffA = ineffA || 0;\n        ineffB = ineffB || 0;\n        if (ineffA !== ineffB) return ineffA < ineffB;\n        if (isIdleFirst() && idleA !== idleB) return idleA < idleB;\n        const scoreA = travelA * TRAVEL_VALUE_MINUTES + idleA;\n        const scoreB = travelB * TRAVEL_VALUE_MINUTES + idleB;\n        if (scoreA !== scoreB) return scoreA < scoreB;\n        if (travelA !== travelB) return travelA < travelB;\n        return idleA < idleB;\n      }, travelIdleImproves = function(deltaTravel, deltaIdle, deltaIneff) {\n        deltaIneff = deltaIneff || 0;\n        if (deltaIneff > 0) return false;\n        if (deltaIneff < 0) return true;\n        if (isIdleFirst() && deltaIdle !== 0) return deltaIdle < 0;\n        if (deltaTravel > 0) return false;\n        if (deltaTravel === 0) return deltaIdle < 0;\n        return deltaIdle <= -deltaTravel * TRAVEL_VALUE_MINUTES;\n      }, tryRelocateSession = function(node) {\n        const memberId = node.memberId;\n        const currentDay = node.day;\n        const currentChainWithout = (dayChains.get(currentDay) || []).filter(\n          (n) => n !== node\n        );\n        const beforeCurrentDayTravel = totalTravelCount(\n          dayChains.get(currentDay) || []\n        );\n        const beforeCurrentDayIdle = dayIdleMinutes(\n          dayChains.get(currentDay) || []\n        );\n        const beforeCurrentDayIneff = dailyInefficientMoveCount(\n          dayChains.get(currentDay) || [],\n          ineffInfo\n        );\n        const currentDayWithoutTravel = totalTravelCount(currentChainWithout);\n        const currentDayWithoutIdle = dayIdleMinutes(currentChainWithout);\n        const currentDayWithoutIneff = dailyInefficientMoveCount(\n          currentChainWithout,\n          ineffInfo\n        );\n        let bestMove = null;\n        const leavingAllowed = dayChainAllowed(currentChainWithout);\n        daysWithReqs.forEach((day) => {\n          if (day !== currentDay) {\n            if (!leavingAllowed) return;\n            if ((dayChains.get(day) || []).some((n) => n.memberId === memberId))\n              return;\n          }\n          const dayReqsForMember = reqsFor(memberId, day);\n          if (dayReqsForMember.length === 0) return;\n          const candNodes = dayNodes(dayReqsForMember, () => 1);\n          const baseChain = day === currentDay ? currentChainWithout : dayChains.get(day) || [];\n          const beforeTargetDayTravel = day === currentDay ? 0 : totalTravelCount(baseChain);\n          const beforeTargetDayIdle = day === currentDay ? 0 : dayIdleMinutes(baseChain);\n          const beforeTargetDayIneff = day === currentDay ? 0 : dailyInefficientMoveCount(baseChain, ineffInfo);\n          candNodes.forEach((cand) => {\n            if (day === currentDay && cand.startSlot === node.startSlot && cand.locationId === node.locationId)\n              return;\n            let insertAt = 0;\n            while (insertAt < baseChain.length && baseChain[insertAt].startSlot < cand.startSlot)\n              insertAt++;\n            let feasible = true;\n            if (insertAt > 0) {\n              const prev = baseChain[insertAt - 1];\n              const prevEnd = prev.startSlot + durationToSlots(prev.duration);\n              if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId))\n                feasible = false;\n            }\n            if (feasible && insertAt < baseChain.length) {\n              const next = baseChain[insertAt];\n              if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId))\n                feasible = false;\n            }\n            if (!feasible) return;\n            const newNode = {\n              id: cand.id,\n              memberId,\n              day,\n              startSlot: cand.startSlot,\n              duration: cand.duration,\n              locationId: cand.locationId,\n              end: cand.end\n            };\n            const newChain = baseChain.slice();\n            newChain.splice(insertAt, 0, newNode);\n            if (!dayChainAllowed(newChain)) return;\n            let deltaTravel, deltaIdle, deltaIneff;\n            if (day === currentDay) {\n              deltaTravel = totalTravelCount(newChain) - beforeCurrentDayTravel;\n              deltaIdle = dayIdleMinutes(newChain) - beforeCurrentDayIdle;\n              deltaIneff = dailyInefficientMoveCount(newChain, ineffInfo) - beforeCurrentDayIneff;\n            } else {\n              deltaTravel = currentDayWithoutTravel + totalTravelCount(newChain) - (beforeCurrentDayTravel + beforeTargetDayTravel);\n              deltaIdle = currentDayWithoutIdle + dayIdleMinutes(newChain) - (beforeCurrentDayIdle + beforeTargetDayIdle);\n              deltaIneff = currentDayWithoutIneff + dailyInefficientMoveCount(newChain, ineffInfo) - (beforeCurrentDayIneff + beforeTargetDayIneff);\n            }\n            const improves = travelIdleImproves(\n              deltaTravel,\n              deltaIdle,\n              deltaIneff\n            );\n            if (improves && (!bestMove || isTravelIdleBetter(\n              deltaTravel,\n              deltaIdle,\n              bestMove.deltaTravel,\n              bestMove.deltaIdle,\n              deltaIneff,\n              bestMove.deltaIneff\n            ))) {\n              bestMove = {\n                sameDay: day === currentDay,\n                targetDay: day,\n                newTargetChain: newChain,\n                deltaTravel,\n                deltaIdle,\n                deltaIneff\n              };\n            }\n          });\n        });\n        if (!bestMove) return false;\n        uncommit(currentDay, node);\n        if (bestMove.sameDay) {\n          dayChains.set(currentDay, bestMove.newTargetChain);\n        } else {\n          dayChains.set(currentDay, currentChainWithout);\n          dayChains.set(bestMove.targetDay, bestMove.newTargetChain);\n        }\n        const addedNode = bestMove.newTargetChain.find(\n          (n) => n.memberId === memberId\n        );\n        commit(bestMove.targetDay, addedNode);\n        return true;\n      }, insertFeasible = function(chainWithout, cand) {\n        let insertAt = 0;\n        while (insertAt < chainWithout.length && chainWithout[insertAt].startSlot < cand.startSlot)\n          insertAt++;\n        if (insertAt > 0) {\n          const prev = chainWithout[insertAt - 1];\n          const prevEnd = prev.startSlot + durationToSlots(prev.duration);\n          if (cand.startSlot < prevEnd || (cand.startSlot - prevEnd) * SLOT_MIN < requiredGapMin2(prev.locationId, cand.locationId))\n            return null;\n        }\n        if (insertAt < chainWithout.length) {\n          const next = chainWithout[insertAt];\n          if (next.startSlot < cand.end || (next.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, next.locationId))\n            return null;\n        }\n        const newChain = chainWithout.slice();\n        newChain.splice(insertAt, 0, cand);\n        if (!dayChainAllowed(newChain)) return null;\n        return newChain;\n      }, tryCrossDaySwap = function(node1, node2) {\n        if (node1.day === node2.day || node1.memberId === node2.memberId)\n          return false;\n        const day1 = node1.day, day2 = node2.day, member1 = node1.memberId, member2 = node2.memberId;\n        if (!reqKeySet.has(member1 + "|" + day2 + "|" + node2.startSlot))\n          return false;\n        if (!reqKeySet.has(member2 + "|" + day1 + "|" + node1.startSlot))\n          return false;\n        const req1InDay2 = reqAt(member1, day2, node2.startSlot);\n        const req2InDay1 = reqAt(member2, day1, node1.startSlot);\n        if (!locationsForReq(req1InDay2).includes(node2.locationId))\n          return false;\n        if (!locationsForReq(req2InDay1).includes(node1.locationId))\n          return false;\n        if ((dayChains.get(day2) || []).some((n) => n.memberId === member1))\n          return false;\n        if ((dayChains.get(day1) || []).some((n) => n.memberId === member2))\n          return false;\n        const dur1 = sessionDurationFor2(memberById(member1));\n        const dur2 = sessionDurationFor2(memberById(member2));\n        const newInDay2 = {\n          id: req1InDay2.id,\n          memberId: member1,\n          day: day2,\n          startSlot: node2.startSlot,\n          duration: dur1,\n          locationId: node2.locationId,\n          end: node2.startSlot + durationToSlots(dur1)\n        };\n        const newInDay1 = {\n          id: req2InDay1.id,\n          memberId: member2,\n          day: day1,\n          startSlot: node1.startSlot,\n          duration: dur2,\n          locationId: node1.locationId,\n          end: node1.startSlot + durationToSlots(dur2)\n        };\n        const chain1 = insertFeasible(\n          (dayChains.get(day1) || []).filter((n) => n !== node1),\n          newInDay1\n        );\n        if (!chain1) return false;\n        const chain2 = insertFeasible(\n          (dayChains.get(day2) || []).filter((n) => n !== node2),\n          newInDay2\n        );\n        if (!chain2) return false;\n        const beforeTravel = totalTravelCount(dayChains.get(day1) || []) + totalTravelCount(dayChains.get(day2) || []);\n        const afterTravel = totalTravelCount(chain1) + totalTravelCount(chain2);\n        const beforeIdle = dayIdleMinutes(dayChains.get(day1) || []) + dayIdleMinutes(dayChains.get(day2) || []);\n        const afterIdle = dayIdleMinutes(chain1) + dayIdleMinutes(chain2);\n        const beforeIneff = dailyInefficientMoveCount(dayChains.get(day1) || [], ineffInfo) + dailyInefficientMoveCount(dayChains.get(day2) || [], ineffInfo);\n        const afterIneff = dailyInefficientMoveCount(chain1, ineffInfo) + dailyInefficientMoveCount(chain2, ineffInfo);\n        if (!travelIdleImproves(\n          afterTravel - beforeTravel,\n          afterIdle - beforeIdle,\n          afterIneff - beforeIneff\n        ))\n          return false;\n        uncommit(day1, node1);\n        uncommit(day2, node2);\n        commit(day1, newInDay1);\n        commit(day2, newInDay2);\n        dayChains.set(day1, chain1);\n        dayChains.set(day2, chain2);\n        return true;\n      }, snapshotChainState = function() {\n        return {\n          dayChains: new Map(dayChains),\n          counts: new Map(assignedCountByMember),\n          days: new Map(\n            Array.from(assignedDaysByMember, ([k, v]) => [k, new Set(v)])\n          )\n        };\n      }, restoreChainState = function(snap) {\n        dayChains.clear();\n        snap.dayChains.forEach((v, k) => dayChains.set(k, v));\n        assignedCountByMember.clear();\n        snap.counts.forEach((v, k) => assignedCountByMember.set(k, v));\n        assignedDaysByMember.clear();\n        snap.days.forEach((v, k) => assignedDaysByMember.set(k, v));\n      }, tryPlaceMemberChain = function(placeMemberId, excludeDays, depth, touchedDays, protectedMemberId) {\n        if (depth > MAX_RELOCATE_EJECT_DEPTH) return false;\n        for (const day of daysWithReqs) {\n          if (excludeDays.has(day)) continue;\n          if ((dayChains.get(day) || []).some((n) => n.memberId === placeMemberId))\n            continue;\n          const reqs = reqsFor(placeMemberId, day);\n          if (reqs.length === 0) continue;\n          const candNodes = dayNodes(reqs, () => 1);\n          const chain = dayChains.get(day) || [];\n          for (const cand of candNodes) {\n            const newNode = {\n              id: cand.id,\n              memberId: placeMemberId,\n              day,\n              startSlot: cand.startSlot,\n              duration: cand.duration,\n              locationId: cand.locationId,\n              end: cand.end\n            };\n            const newChain = insertFeasible(chain, newNode);\n            if (newChain) {\n              dayChains.set(day, newChain);\n              commit(day, newNode);\n              touchedDays.add(day);\n              return true;\n            }\n          }\n          for (const cand of candNodes) {\n            const overlapping = /* @__PURE__ */ new Set();\n            chain.forEach((n) => {\n              const nEnd = n.startSlot + durationToSlots(n.duration);\n              if (cand.startSlot < nEnd && n.startSlot < cand.end)\n                overlapping.add(n.memberId);\n            });\n            let otherMemberId = null;\n            if (overlapping.size === 1) {\n              otherMemberId = [...overlapping][0];\n            } else if (overlapping.size === 0) {\n              const sorted = chain.slice().sort((a, b) => a.startSlot - b.startSlot);\n              let idx = 0;\n              while (idx < sorted.length && sorted[idx].startSlot < cand.startSlot)\n                idx++;\n              const prevN = idx > 0 ? sorted[idx - 1] : null;\n              const nextN = idx < sorted.length ? sorted[idx] : null;\n              const prevBad = prevN && (cand.startSlot - (prevN.startSlot + durationToSlots(prevN.duration))) * SLOT_MIN < requiredGapMin2(prevN.locationId, cand.locationId);\n              const nextBad = nextN && (nextN.startSlot - cand.end) * SLOT_MIN < requiredGapMin2(cand.locationId, nextN.locationId);\n              if (prevBad && nextBad && prevN.memberId !== nextN.memberId)\n                continue;\n              if (prevBad) otherMemberId = prevN.memberId;\n              else if (nextBad) otherMemberId = nextN.memberId;\n              else continue;\n            } else continue;\n            if (otherMemberId === protectedMemberId) continue;\n            const otherNode = chain.find((n) => n.memberId === otherMemberId);\n            const remaining = chain.filter((n) => n.memberId !== otherMemberId);\n            const newNode = {\n              id: cand.id,\n              memberId: placeMemberId,\n              day,\n              startSlot: cand.startSlot,\n              duration: cand.duration,\n              locationId: cand.locationId,\n              end: cand.end\n            };\n            const newChain = insertFeasible(remaining, newNode);\n            if (!newChain) continue;\n            uncommit(day, otherNode);\n            commit(day, newNode);\n            dayChains.set(day, newChain);\n            touchedDays.add(day);\n            if (tryPlaceMemberChain(\n              otherMemberId,\n              /* @__PURE__ */ new Set([...excludeDays, day]),\n              depth + 1,\n              touchedDays,\n              protectedMemberId\n            ))\n              return true;\n            uncommit(day, newNode);\n            commit(day, otherNode);\n            dayChains.set(day, chain);\n          }\n        }\n        return false;\n      }, tryEjectChainMove = function(node, acceptFn) {\n        const snap = snapshotChainState();\n        const memberId = node.memberId;\n        const currentDay = node.day;\n        const touchedDays = /* @__PURE__ */ new Set([currentDay]);\n        const chain0 = dayChains.get(currentDay) || [];\n        uncommit(currentDay, node);\n        dayChains.set(\n          currentDay,\n          chain0.filter((n) => n !== node)\n        );\n        const placed = tryPlaceMemberChain(\n          memberId,\n          /* @__PURE__ */ new Set(),\n          0,\n          touchedDays,\n          memberId\n        );\n        const allowed = placed && [...touchedDays].every((d) => dayChainAllowed(dayChains.get(d) || []));\n        if (!allowed) {\n          restoreChainState(snap);\n          return false;\n        }\n        let beforeTravel = 0, beforeIdle = 0, beforeIneff = 0, afterTravel = 0, afterIdle = 0, afterIneff = 0;\n        touchedDays.forEach((day) => {\n          beforeTravel += totalTravelCount(snap.dayChains.get(day) || []);\n          beforeIdle += dayIdleMinutes(snap.dayChains.get(day) || []);\n          beforeIneff += dailyInefficientMoveCount(\n            snap.dayChains.get(day) || [],\n            ineffInfo\n          );\n          afterTravel += totalTravelCount(dayChains.get(day) || []);\n          afterIdle += dayIdleMinutes(dayChains.get(day) || []);\n          afterIneff += dailyInefficientMoveCount(\n            dayChains.get(day) || [],\n            ineffInfo\n          );\n        });\n        const deltaTravel = afterTravel - beforeTravel;\n        const deltaIdle = afterIdle - beforeIdle;\n        const deltaIneff = afterIneff - beforeIneff;\n        if (acceptFn(deltaTravel, deltaIdle, deltaIneff)) return true;\n        restoreChainState(snap);\n        return false;\n      }, trySessionCountSwap = function(randomFn, acceptFn) {\n        const doubles = [], singles = [];\n        assignedCountByMember.forEach((count, id) => {\n          if (count === 0) return;\n          if (maxSessionsFor2(memberById(id)) < 2) return;\n          if (count === 2) doubles.push(id);\n          else if (count === 1) singles.push(id);\n        });\n        if (doubles.length === 0 || singles.length === 0) return false;\n        const memberA = doubles[Math.floor(randomFn() * doubles.length)];\n        const memberB = singles[Math.floor(randomFn() * singles.length)];\n        if (memberA === memberB) return false;\n        const snap = snapshotChainState();\n        const touchedDays = /* @__PURE__ */ new Set();\n        const aNodes = [];\n        dayChains.forEach(\n          (chain, day) => chain.forEach((n) => {\n            if (n.memberId === memberA) aNodes.push({ day, node: n });\n          })\n        );\n        if (aNodes.length !== 2) {\n          restoreChainState(snap);\n          return false;\n        }\n        const removed = aNodes[Math.floor(randomFn() * aNodes.length)];\n        uncommit(removed.day, removed.node);\n        dayChains.set(\n          removed.day,\n          (dayChains.get(removed.day) || []).filter((n) => n !== removed.node)\n        );\n        touchedDays.add(removed.day);\n        const placed = tryPlaceMemberChain(\n          memberB,\n          /* @__PURE__ */ new Set(),\n          0,\n          touchedDays,\n          null\n        );\n        const allowed = placed && [...touchedDays].every((d) => dayChainAllowed(dayChains.get(d) || []));\n        if (!allowed) {\n          restoreChainState(snap);\n          return false;\n        }\n        let beforeTravel = 0, beforeIdle = 0, beforeIneff = 0, afterTravel = 0, afterIdle = 0, afterIneff = 0;\n        touchedDays.forEach((day) => {\n          beforeTravel += totalTravelCount(snap.dayChains.get(day) || []);\n          beforeIdle += dayIdleMinutes(snap.dayChains.get(day) || []);\n          beforeIneff += dailyInefficientMoveCount(\n            snap.dayChains.get(day) || [],\n            ineffInfo\n          );\n          afterTravel += totalTravelCount(dayChains.get(day) || []);\n          afterIdle += dayIdleMinutes(dayChains.get(day) || []);\n          afterIneff += dailyInefficientMoveCount(\n            dayChains.get(day) || [],\n            ineffInfo\n          );\n        });\n        const deltaTravel = afterTravel - beforeTravel;\n        const deltaIdle = afterIdle - beforeIdle;\n        const deltaIneff = afterIneff - beforeIneff;\n        if (acceptFn(deltaTravel, deltaIdle, deltaIneff)) return true;\n        restoreChainState(snap);\n        return false;\n      };\n      const polishStart = now();\n      const polishBudget = polishBudgetMs || 8e3;\n      const POLISH_DEADLINE = polishStart + polishBudget;\n      const STAGE6_DEADLINE = polishStart + polishBudget * 0.25;\n      const STAGE65_DEADLINE = polishStart + polishBudget * 0.55;\n      const SA_DEADLINE = polishStart + polishBudget * 0.8;\n      daysWithReqs.forEach((day) => {\n        const beforeUnassignedCount = stillUnassignedIds().length;\n        const beforeTotalSessions = Array.from(dayChains.values()).reduce(\n          (sum, c) => sum + c.length,\n          0\n        );\n        const existingChain = dayChains.get(day) || [];\n        const beforeIneff = dailyInefficientMoveCount(existingChain, ineffInfo);\n        existingChain.forEach((node) => uncommit(day, node));\n        const nodes = dayNodes(\n          reqsByDay.get(day),\n          (mId) => isEligibleForDay(mId, day) ? 1 : 0\n        );\n        const newChain = runChainDP(nodes, void 0, ineffInfo);\n        newChain.forEach((node) => commit(day, node));\n        dayChains.set(day, newChain);\n        const afterTotalSessions = Array.from(dayChains.values()).reduce(\n          (sum, c) => sum + c.length,\n          0\n        );\n        const afterIneff = dailyInefficientMoveCount(newChain, ineffInfo);\n        const worse = stillUnassignedIds().length > beforeUnassignedCount || afterIneff > beforeIneff || afterIneff === beforeIneff && afterTotalSessions < beforeTotalSessions;\n        if (worse) {\n          newChain.forEach((node) => uncommit(day, node));\n          existingChain.forEach((node) => commit(day, node));\n          dayChains.set(day, existingChain);\n        }\n      });\n      const stage6RandomFn = mulberry32(445566 + seedOffset);\n      stage6: for (let i = 0; i < daysWithReqs.length && now() < STAGE6_DEADLINE; i++) {\n        for (let j = i + 1; j < daysWithReqs.length; j++) {\n          let attemptOrder = function(firstDay, secondDay, jitterFn) {\n            const firstNodes = dayNodes(\n              reqsByDay.get(firstDay),\n              (mId) => isEligibleForDay(mId, firstDay) ? 1 : 0,\n              jitterFn\n            );\n            const firstChain = runChainDP(firstNodes, void 0, ineffInfo);\n            firstChain.forEach((node) => commit(firstDay, node));\n            dayChains.set(firstDay, firstChain);\n            const secondNodes = dayNodes(\n              reqsByDay.get(secondDay),\n              (mId) => isEligibleForDay(mId, secondDay) ? 1 : 0,\n              jitterFn\n            );\n            const secondChain = runChainDP(secondNodes, void 0, ineffInfo);\n            secondChain.forEach((node) => commit(secondDay, node));\n            dayChains.set(secondDay, secondChain);\n            const outcome = {\n              unassigned: stillUnassignedIds().length,\n              totalSessions: Array.from(dayChains.values()).reduce(\n                (sum, c) => sum + c.length,\n                0\n              ),\n              pairTravel: totalTravelCount(firstChain) + totalTravelCount(secondChain),\n              pairIdle: dayIdleMinutes(firstChain) + dayIdleMinutes(secondChain),\n              pairIneff: dailyInefficientMoveCount(firstChain, ineffInfo) + dailyInefficientMoveCount(secondChain, ineffInfo),\n              chainA: firstDay === dayA ? firstChain : secondChain,\n              chainB: firstDay === dayA ? secondChain : firstChain\n            };\n            firstChain.forEach((node) => uncommit(firstDay, node));\n            secondChain.forEach((node) => uncommit(secondDay, node));\n            dayChains.set(firstDay, []);\n            dayChains.set(secondDay, []);\n            return outcome;\n          };\n          await maybeYield();\n          if (now() >= STAGE6_DEADLINE) break stage6;\n          const dayA = daysWithReqs[i], dayB = daysWithReqs[j];\n          const existingA = dayChains.get(dayA) || [];\n          const existingB = dayChains.get(dayB) || [];\n          const beforeUnassignedCount = stillUnassignedIds().length;\n          const beforeTotalSessions = Array.from(dayChains.values()).reduce(\n            (sum, c) => sum + c.length,\n            0\n          );\n          const beforePairTravel = totalTravelCount(existingA) + totalTravelCount(existingB);\n          const beforePairIdle = dayIdleMinutes(existingA) + dayIdleMinutes(existingB);\n          const beforePairIneff = dailyInefficientMoveCount(existingA, ineffInfo) + dailyInefficientMoveCount(existingB, ineffInfo);\n          existingA.forEach((node) => uncommit(dayA, node));\n          existingB.forEach((node) => uncommit(dayB, node));\n          dayChains.set(dayA, []);\n          dayChains.set(dayB, []);\n          const attempts = [\n            attemptOrder(dayA, dayB, null),\n            attemptOrder(dayB, dayA, null)\n          ];\n          for (let k = 0; k < 8 && now() < STAGE6_DEADLINE; k++) {\n            await maybeYield();\n            attempts.push(attemptOrder(dayA, dayB, stage6RandomFn));\n            attempts.push(attemptOrder(dayB, dayA, stage6RandomFn));\n          }\n          let bestOption = null;\n          attempts.forEach((opt) => {\n            if (opt.unassigned > beforeUnassignedCount) return;\n            if (opt.pairIneff > beforePairIneff) return;\n            if (opt.pairIneff === beforePairIneff) {\n              if (opt.totalSessions < beforeTotalSessions) return;\n              if (!fewerTravelOrIdle(\n                opt.pairTravel,\n                opt.pairIdle,\n                beforePairTravel,\n                beforePairIdle\n              ))\n                return;\n            }\n            const better = !bestOption || opt.pairIneff < bestOption.pairIneff || opt.pairIneff === bestOption.pairIneff && fewerTravelOrIdle(\n              opt.pairTravel,\n              opt.pairIdle,\n              bestOption.pairTravel,\n              bestOption.pairIdle\n            );\n            if (better) bestOption = opt;\n          });\n          if (bestOption) {\n            bestOption.chainA.forEach((node) => commit(dayA, node));\n            bestOption.chainB.forEach((node) => commit(dayB, node));\n            dayChains.set(dayA, bestOption.chainA);\n            dayChains.set(dayB, bestOption.chainB);\n          } else {\n            existingA.forEach((node) => commit(dayA, node));\n            existingB.forEach((node) => commit(dayB, node));\n            dayChains.set(dayA, existingA);\n            dayChains.set(dayB, existingB);\n          }\n        }\n      }\n      const baselineUnassigned = stillUnassignedIds().length;\n      const baselineSessions = Array.from(dayChains.values()).reduce(\n        (sum, c) => sum + c.length,\n        0\n      );\n      const baselineTravel = Array.from(dayChains.values()).reduce(\n        (sum, c) => sum + totalTravelCount(c),\n        0\n      );\n      const baselineIneff = Array.from(dayChains.values()).reduce(\n        (sum, c) => sum + dailyInefficientMoveCount(c, ineffInfo),\n        0\n      );\n      const baselineIdle = Array.from(dayChains.values()).reduce(\n        (sum, c) => sum + dayIdleMinutes(c),\n        0\n      );\n      let bestSnapshot = {\n        unassigned: baselineUnassigned,\n        sessions: baselineSessions,\n        travel: baselineTravel,\n        idle: baselineIdle,\n        ineff: baselineIneff,\n        chains: new Map(dayChains)\n      };\n      const polishRandomFn = mulberry32(778899 + seedOffset);\n      for (let attempt = 0; attempt < 200 && now() < STAGE65_DEADLINE; attempt++) {\n        await maybeYield();\n        dayChains.forEach(\n          (chain, day) => chain.forEach((node) => uncommit(day, node))\n        );\n        shuffled(daysWithReqs, polishRandomFn).forEach((day) => {\n          const dominantLoc = dominantLocationFor(day);\n          const nodes = dayNodes(\n            reqsByDay.get(day),\n            (mId, startSlot, locationId) => {\n              if (!isEligibleForDay(mId, day)) return 0;\n              return locationId === dominantLoc ? 1.02 : 1;\n            },\n            () => polishRandomFn()\n          );\n          const chain = runChainDP(nodes, void 0, ineffInfo);\n          chain.forEach((node) => commit(day, node));\n          dayChains.set(day, chain);\n        });\n        const attemptUnassigned = stillUnassignedIds().length;\n        const attemptSessions = Array.from(dayChains.values()).reduce(\n          (sum, c) => sum + c.length,\n          0\n        );\n        const attemptTravel = Array.from(dayChains.values()).reduce(\n          (sum, c) => sum + totalTravelCount(c),\n          0\n        );\n        const attemptIneff = Array.from(dayChains.values()).reduce(\n          (sum, c) => sum + dailyInefficientMoveCount(c, ineffInfo),\n          0\n        );\n        const attemptIdle = Array.from(dayChains.values()).reduce(\n          (sum, c) => sum + dayIdleMinutes(c),\n          0\n        );\n        const accept = attemptUnassigned <= bestSnapshot.unassigned && (attemptIneff < bestSnapshot.ineff || attemptIneff === bestSnapshot.ineff && attemptSessions >= bestSnapshot.sessions && fewerTravelOrIdle(\n          attemptTravel,\n          attemptIdle,\n          bestSnapshot.travel,\n          bestSnapshot.idle\n        ));\n        if (accept) {\n          bestSnapshot = {\n            unassigned: attemptUnassigned,\n            sessions: attemptSessions,\n            travel: attemptTravel,\n            idle: attemptIdle,\n            ineff: attemptIneff,\n            chains: new Map(dayChains)\n          };\n        }\n      }\n      dayChains.forEach(\n        (chain, day) => chain.forEach((node) => uncommit(day, node))\n      );\n      bestSnapshot.chains.forEach((chain, day) => {\n        chain.forEach((node) => commit(day, node));\n        dayChains.set(day, chain);\n      });\n      const reqKeySet = new Set(\n        eligibleReqs.map((r) => r.memberId + "|" + r.day + "|" + r.startSlot)\n      );\n      const MAX_RELOCATE_EJECT_DEPTH = 3;\n      {\n        let saTotalTravel = function() {\n          let sum = 0;\n          dayChains.forEach((chain) => {\n            sum += totalTravelCount(chain);\n          });\n          return sum;\n        }, saTotalIdle = function() {\n          let sum = 0;\n          dayChains.forEach((chain) => {\n            sum += dayIdleMinutes(chain);\n          });\n          return sum;\n        }, saTotalIneff = function() {\n          let sum = 0;\n          dayChains.forEach((chain) => {\n            sum += dailyInefficientMoveCount(chain, ineffInfo);\n          });\n          return sum;\n        }, pickRandomNode = function(randomFn) {\n          const all = Array.from(dayChains.values()).flat();\n          if (all.length === 0) return null;\n          return all[Math.floor(randomFn() * all.length)];\n        }, saProposeRelocate = function(randomFn) {\n          const node = pickRandomNode(randomFn);\n          if (!node) return null;\n          const memberId = node.memberId, currentDay = node.day;\n          const currentChainWithout = (dayChains.get(currentDay) || []).filter(\n            (n) => n !== node\n          );\n          const options = [];\n          daysWithReqs.forEach((day) => {\n            if (day !== currentDay && (dayChains.get(day) || []).some((n) => n.memberId === memberId))\n              return;\n            reqsFor(memberId, day).forEach(\n              (r) => options.push({ day, startSlot: r.startSlot, req: r })\n            );\n          });\n          if (options.length === 0) return null;\n          const picked = options[Math.floor(randomFn() * options.length)];\n          if (picked.day !== currentDay && !dayChainAllowed(currentChainWithout))\n            return null;\n          const locOptions = locationsForReq(picked.req);\n          if (locOptions.length === 0) return null;\n          const locationId = locOptions[Math.floor(randomFn() * locOptions.length)];\n          if (picked.day === currentDay && picked.startSlot === node.startSlot && locationId === node.locationId)\n            return null;\n          const duration = sessionDurationFor2(memberById(memberId));\n          const cand = {\n            id: picked.req.id,\n            memberId,\n            day: picked.day,\n            startSlot: picked.startSlot,\n            duration,\n            locationId,\n            end: picked.startSlot + durationToSlots(duration)\n          };\n          const baseChain = picked.day === currentDay ? currentChainWithout : dayChains.get(picked.day) || [];\n          const newChain = insertFeasible(baseChain, cand);\n          if (!newChain) return null;\n          let deltaTravel, deltaIdle, deltaIneff;\n          if (picked.day === currentDay) {\n            deltaTravel = totalTravelCount(newChain) - totalTravelCount(dayChains.get(currentDay) || []);\n            deltaIdle = dayIdleMinutes(newChain) - dayIdleMinutes(dayChains.get(currentDay) || []);\n            deltaIneff = dailyInefficientMoveCount(newChain, ineffInfo) - dailyInefficientMoveCount(\n              dayChains.get(currentDay) || [],\n              ineffInfo\n            );\n          } else {\n            const beforeCur = dayChains.get(currentDay) || [];\n            const beforeTgt = dayChains.get(picked.day) || [];\n            deltaTravel = totalTravelCount(currentChainWithout) + totalTravelCount(newChain) - (totalTravelCount(beforeCur) + totalTravelCount(beforeTgt));\n            deltaIdle = dayIdleMinutes(currentChainWithout) + dayIdleMinutes(newChain) - (dayIdleMinutes(beforeCur) + dayIdleMinutes(beforeTgt));\n            deltaIneff = dailyInefficientMoveCount(currentChainWithout, ineffInfo) + dailyInefficientMoveCount(newChain, ineffInfo) - (dailyInefficientMoveCount(beforeCur, ineffInfo) + dailyInefficientMoveCount(beforeTgt, ineffInfo));\n          }\n          const cost = deltaTravel * SA_TRAVEL_WEIGHT + deltaIdle;\n          return {\n            cost,\n            deltaIneff,\n            apply: () => {\n              uncommit(currentDay, node);\n              if (picked.day === currentDay) {\n                dayChains.set(currentDay, newChain);\n              } else {\n                dayChains.set(currentDay, currentChainWithout);\n                dayChains.set(picked.day, newChain);\n              }\n              const addedNode = newChain.find(\n                (n) => n.memberId === memberId && n.startSlot === picked.startSlot && n.locationId === locationId\n              );\n              commit(picked.day, addedNode);\n            }\n          };\n        }, saProposeSwap = function(randomFn) {\n          const n1 = pickRandomNode(randomFn);\n          const n2 = pickRandomNode(randomFn);\n          if (!n1 || !n2 || n1 === n2 || n1.day === n2.day || n1.memberId === n2.memberId)\n            return null;\n          const day1 = n1.day, day2 = n2.day, member1 = n1.memberId, member2 = n2.memberId;\n          if (!reqKeySet.has(member1 + "|" + day2 + "|" + n2.startSlot))\n            return null;\n          if (!reqKeySet.has(member2 + "|" + day1 + "|" + n1.startSlot))\n            return null;\n          const req1InDay2 = reqAt(member1, day2, n2.startSlot);\n          const req2InDay1 = reqAt(member2, day1, n1.startSlot);\n          if (!locationsForReq(req1InDay2).includes(n2.locationId))\n            return null;\n          if (!locationsForReq(req2InDay1).includes(n1.locationId))\n            return null;\n          if ((dayChains.get(day2) || []).some((n) => n.memberId === member1))\n            return null;\n          if ((dayChains.get(day1) || []).some((n) => n.memberId === member2))\n            return null;\n          const dur1 = sessionDurationFor2(memberById(member1));\n          const dur2 = sessionDurationFor2(memberById(member2));\n          const newInDay2 = {\n            id: req1InDay2.id,\n            memberId: member1,\n            day: day2,\n            startSlot: n2.startSlot,\n            duration: dur1,\n            locationId: n2.locationId,\n            end: n2.startSlot + durationToSlots(dur1)\n          };\n          const newInDay1 = {\n            id: req2InDay1.id,\n            memberId: member2,\n            day: day1,\n            startSlot: n1.startSlot,\n            duration: dur2,\n            locationId: n1.locationId,\n            end: n1.startSlot + durationToSlots(dur2)\n          };\n          const chain1 = insertFeasible(\n            (dayChains.get(day1) || []).filter((n) => n !== n1),\n            newInDay1\n          );\n          if (!chain1) return null;\n          const chain2 = insertFeasible(\n            (dayChains.get(day2) || []).filter((n) => n !== n2),\n            newInDay2\n          );\n          if (!chain2) return null;\n          const beforeTravel = totalTravelCount(dayChains.get(day1) || []) + totalTravelCount(dayChains.get(day2) || []);\n          const afterTravel = totalTravelCount(chain1) + totalTravelCount(chain2);\n          const beforeIdle = dayIdleMinutes(dayChains.get(day1) || []) + dayIdleMinutes(dayChains.get(day2) || []);\n          const afterIdle = dayIdleMinutes(chain1) + dayIdleMinutes(chain2);\n          const beforeIneff = dailyInefficientMoveCount(dayChains.get(day1) || [], ineffInfo) + dailyInefficientMoveCount(dayChains.get(day2) || [], ineffInfo);\n          const afterIneff = dailyInefficientMoveCount(chain1, ineffInfo) + dailyInefficientMoveCount(chain2, ineffInfo);\n          const cost = (afterTravel - beforeTravel) * SA_TRAVEL_WEIGHT + (afterIdle - beforeIdle);\n          return {\n            cost,\n            deltaIneff: afterIneff - beforeIneff,\n            apply: () => {\n              uncommit(day1, n1);\n              uncommit(day2, n2);\n              commit(day1, newInDay1);\n              commit(day2, newInDay2);\n              dayChains.set(day1, chain1);\n              dayChains.set(day2, chain2);\n            }\n          };\n        }, saAccepts = function(cost, deltaIneff) {\n          if (deltaIneff > 0) return false;\n          if (deltaIneff < 0) return true;\n          return cost <= 0 || saRandomFn() < Math.exp(-cost / temperature);\n        };\n        const SA_TRAVEL_WEIGHT = isIdleFirst() ? 0.01 : TRAVEL_VALUE_MINUTES;\n        const saRandomFn = mulberry32(552233 + seedOffset);\n        const SA_START_TEMP = 200, SA_END_TEMP = 1;\n        const saStart = now();\n        const saDuration = Math.max(1, SA_DEADLINE - saStart);\n        let temperature = SA_START_TEMP;\n        let bestSnapshotSA = new Map(dayChains);\n        let bestTravelSA = saTotalTravel();\n        let bestIdleSA = saTotalIdle();\n        let bestIneffSA = saTotalIneff();\n        while (now() < SA_DEADLINE) {\n          await maybeYield();\n          const elapsedFrac = Math.min(1, (now() - saStart) / saDuration);\n          temperature = SA_START_TEMP * Math.pow(SA_END_TEMP / SA_START_TEMP, elapsedFrac);\n          let applied = false;\n          const moveRoll = saRandomFn();\n          if (moveRoll < 0.15) {\n            applied = trySessionCountSwap(saRandomFn, (dt, di, dineff) => {\n              const cost = dt * SA_TRAVEL_WEIGHT + di;\n              return saAccepts(cost, dineff);\n            });\n          } else if (moveRoll < 0.35) {\n            const node = pickRandomNode(saRandomFn);\n            if (node) {\n              applied = tryEjectChainMove(node, (dt, di, dineff) => {\n                const cost = dt * SA_TRAVEL_WEIGHT + di;\n                return saAccepts(cost, dineff);\n              });\n            }\n          } else {\n            const proposal = saRandomFn() < 0.35 ? saProposeSwap(saRandomFn) : saProposeRelocate(saRandomFn);\n            if (proposal) {\n              const accept = saAccepts(proposal.cost, proposal.deltaIneff);\n              if (accept) {\n                proposal.apply();\n                applied = true;\n              }\n            }\n          }\n          if (applied) {\n            const curTravel = saTotalTravel();\n            const curIdle = saTotalIdle();\n            const curIneff = saTotalIneff();\n            const curScore = curTravel * SA_TRAVEL_WEIGHT + curIdle;\n            const bestScore = bestTravelSA * SA_TRAVEL_WEIGHT + bestIdleSA;\n            if (curIneff < bestIneffSA || curIneff === bestIneffSA && (curScore < bestScore || curScore === bestScore && curTravel < bestTravelSA)) {\n              bestTravelSA = curTravel;\n              bestIdleSA = curIdle;\n              bestIneffSA = curIneff;\n              bestSnapshotSA = new Map(dayChains);\n            }\n          }\n        }\n        dayChains.forEach(\n          (chain, day) => chain.forEach((node) => uncommit(day, node))\n        );\n        bestSnapshotSA.forEach((chain, day) => {\n          chain.forEach((node) => commit(day, node));\n          dayChains.set(day, chain);\n        });\n      }\n      const relocateRandomFn = mulberry32(334455 + seedOffset);\n      let improvedInPass = true;\n      let passCount = 0;\n      while (improvedInPass && passCount < 30 && now() < POLISH_DEADLINE) {\n        await maybeYield();\n        improvedInPass = false;\n        passCount++;\n        const flatNodes = shuffled(\n          Array.from(dayChains.values()).flat(),\n          relocateRandomFn\n        );\n        for (const node of flatNodes) {\n          await maybeYield();\n          if (now() >= POLISH_DEADLINE) break;\n          const stillThere = (dayChains.get(node.day) || []).includes(node);\n          if (!stillThere) continue;\n          if (tryRelocateSession(node)) {\n            improvedInPass = true;\n            continue;\n          }\n          if (tryEjectChainMove(node, travelIdleImproves)) improvedInPass = true;\n        }\n        if (now() >= POLISH_DEADLINE) break;\n        const flatNodes2 = shuffled(\n          Array.from(dayChains.values()).flat(),\n          relocateRandomFn\n        );\n        outer: for (let i = 0; i < flatNodes2.length; i++) {\n          for (let k = i + 1; k < flatNodes2.length; k++) {\n            await maybeYield();\n            if (now() >= POLISH_DEADLINE) break outer;\n            const n1 = flatNodes2[i], n2 = flatNodes2[k];\n            const n1There = (dayChains.get(n1.day) || []).includes(n1);\n            const n2There = (dayChains.get(n2.day) || []).includes(n2);\n            if (!n1There || !n2There) continue;\n            if (tryCrossDaySwap(n1, n2)) improvedInPass = true;\n          }\n        }\n        for (let attempt = 0; attempt < 60 && now() < POLISH_DEADLINE; attempt++) {\n          await maybeYield();\n          if (trySessionCountSwap(relocateRandomFn, travelIdleImproves))\n            improvedInPass = true;\n        }\n      }\n      daysWithReqs.forEach((day) => {\n        const chain = (dayChains.get(day) || []).slice().sort((a, b) => a.startSlot - b.startSlot);\n        for (let idx = 1; idx < chain.length; idx++) {\n          const prev = chain[idx - 1];\n          const node = chain[idx];\n          const minStart = prev.startSlot + durationToSlots(prev.duration) + durationToSlots(requiredGapMin2(prev.locationId, node.locationId));\n          if (node.startSlot <= minStart) continue;\n          const earlierReq = findEarlierRequestForLocation(\n            reqsFor(node.memberId, day),\n            minStart,\n            node.startSlot,\n            node.locationId\n          );\n          if (!earlierReq) continue;\n          moveNodeToRequest(node, earlierReq);\n        }\n        dayChains.set(day, chain);\n      });\n    }\n    const assigned = [];\n    dayChains.forEach((chain) => assigned.push(...chain));\n    const eligibleMemberIds = state.members.filter((m) => !excludedIdSet2.has(m.id) && submittedIds.has(m.id)).map((m) => m.id);\n    const assignedMemberIds = new Set(assigned.map((r) => r.memberId));\n    const unassignedMembers = eligibleMemberIds.filter((id) => !assignedMemberIds.has(id)).map(memberById).filter(Boolean);\n    return { assigned, unassignedMembers };\n  }\n\n  // src/engine/engineWorker.js\n  var ctx = null;\n  var greedyCursor = null;\n  function greedyInput(strategyIndex, attempt) {\n    if (!greedyCursor || greedyCursor.strategyIndex !== strategyIndex || greedyCursor.attempt > attempt) {\n      greedyCursor = {\n        strategyIndex,\n        attempt: -1,\n        input: null,\n        gen: greedyAttemptInputs(strategyIndex, ctx.eligible, ctx.attempts)\n      };\n    }\n    while (greedyCursor.attempt < attempt) {\n      greedyCursor.input = greedyCursor.gen.next().value;\n      greedyCursor.attempt++;\n    }\n    return greedyCursor.input;\n  }\n  var handlers = {\n    async polish(msg) {\n      const result = await runSchedule2Pipeline(\n        ctx.eligibleReqs,\n        ctx.reqsByDay,\n        ctx.daysWithReqs,\n        msg.order,\n        true,\n        true,\n        msg.budgetMs,\n        msg.seedOffset\n      );\n      return {\n        assigned: result.assigned,\n        unassignedMemberIds: result.unassignedMembers.map((m) => m.id)\n      };\n    },\n    async greedy(msg) {\n      const input = greedyInput(msg.strategyIndex, msg.attempt);\n      const cand = buildCandidateFromStrategy(\n        msg.strategyIndex,\n        ctx.eligible,\n        ctx.eligibleIdSet,\n        ctx.allMemberIdSet,\n        input.jitter,\n        [],\n        input.dayOrder\n      );\n      cand.unassignedMembers = cand.unassignedMembers.map((m) => m.id);\n      return cand;\n    }\n  };\n  self.onmessage = async (event) => {\n    const msg = event.data;\n    if (msg.type === "init") {\n      Object.assign(state, msg.state);\n      runtime.availableCells = new Set(msg.availableCells);\n      setIdleFirst(!!msg.idleFirst);\n      ctx = msg;\n      if (msg.kind === "greedy") {\n        ctx.eligibleIdSet = new Set(msg.eligibleIds);\n        ctx.allMemberIdSet = new Set(msg.allMemberIds);\n      }\n      greedyCursor = null;\n      return;\n    }\n    if (msg.type !== "run") return;\n    try {\n      const result = await withSelectionOverride(\n        ctx.excludedIds,\n        ctx.onceLimitIds,\n        () => handlers[ctx.kind](msg)\n      );\n      self.postMessage({ index: msg.index, result });\n    } catch (err) {\n      self.postMessage({\n        index: msg.index,\n        error: String(err && err.stack || err)\n      });\n    }\n  };\n})();\n'], { type: "text/javascript" })
    );
    return {
      create: () => new Worker(url),
      dispose: () => URL.revokeObjectURL(url)
    };
  }
  function engineWorkerInit(kind, extra) {
    return Object.assign(
      {
        type: "init",
        kind,
        state: {
          members: state.members,
          locations: state.locations,
          travelTimes: state.travelTimes,
          requests: state.requests
        },
        availableCells: Array.from(runtime.availableCells),
        excludedIds: (currentExcludedIds2() || []).slice(),
        onceLimitIds: (currentOnceLimitIds2() || []).slice()
      },
      extra
    );
  }
  async function runTasksInWorkers({
    init: init2,
    taskCount,
    taskMessage,
    workerCount,
    onTaskDone,
    checkCancelled,
    label,
    createWorker
  }) {
    const results = new Array(taskCount);
    const factory = createWorker ? { create: createWorker, dispose: () => {
    } } : blobWorkerFactory();
    if (!factory || workerCount <= 0 || taskCount === 0) {
      if (factory) factory.dispose();
      return results;
    }
    const workers = [];
    try {
      for (let k = 0; k < workerCount; k++) workers.push(factory.create());
    } catch (err) {
      console.warn(
        ENGINE_WORKER_WARNING + " " + label + " 워커를 만들지 못해 메인 스레드에서 계산합니다",
        err
      );
      workers.forEach((w) => w.terminate());
      factory.dispose();
      return results;
    }
    try {
      await new Promise((resolve, reject) => {
        let next = 0;
        let running = workers.length;
        let settled = false;
        const poll = setInterval(() => {
          try {
            if (checkCancelled) checkCancelled();
          } catch (err) {
            finish(err);
          }
        }, CANCEL_POLL_MS);
        function finish(err) {
          if (settled) return;
          settled = true;
          clearInterval(poll);
          if (err) reject(err);
          else resolve();
        }
        workers.forEach((w) => {
          let stopped = false;
          function stop(reason) {
            if (stopped) return;
            stopped = true;
            if (reason)
              console.warn(
                ENGINE_WORKER_WARNING + " " + label + " 워커 실패 — 남은 작업은 메인 스레드에서 계산합니다",
                reason
              );
            if (--running === 0) finish();
          }
          function runNext() {
            if (settled || next >= taskCount) return stop();
            const index = next++;
            w.postMessage(Object.assign({ type: "run", index }, taskMessage(index)));
          }
          w.onmessage = (event) => {
            if (stopped) return;
            const msg = event.data;
            if (msg.error) return stop(msg.error);
            results[msg.index] = msg.result;
            if (onTaskDone) onTaskDone();
            runNext();
          };
          w.onerror = (event) => {
            if (event && event.preventDefault) event.preventDefault();
            stop(event && event.message || "worker error");
          };
          w.postMessage(init2);
          runNext();
        });
      });
    } finally {
      workers.forEach((w) => w.terminate());
      factory.dispose();
    }
    return results;
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
    if (!member || !Array.isArray(member.locationIds)) return [];
    const knownLocationIds = knownLocationIdSet();
    return member.locationIds.filter((id) => knownLocationIds.has(id));
  }
  function candidateLocationsForRequest(req) {
    const excluded = req.excludedLocationIds || [];
    const base = candidateLocationsFor(req.memberId).filter(
      (id) => id !== null && !excluded.includes(id)
    );
    const knownLocationIds = knownLocationIdSet();
    const extra = (req.extraLocationIds || []).filter(
      (id) => knownLocationIds.has(id) && !base.includes(id)
    );
    return base.concat(extra);
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
  function dayChainViolation(chain, soloIds) {
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1], cur = chain[i];
      if ((cur.startSlot - prev.end) * SLOT_MIN < requiredGapMin(prev.locationId, cur.locationId))
        return "gap";
    }
    if (dailyTravelCount(chain) > MAX_TRAVELS_PER_DAY) return "dailyTravel";
    if (chainBreaksSoloTravel(chain, soloIds)) return "soloTravel";
    return null;
  }
  function dailyInefficientMoveCount(chain, info) {
    info = info === void 0 ? inefficientRoundTripLocationInfo() : info;
    const locs = [];
    chain.forEach((s) => {
      if (locs[locs.length - 1] !== s.locationId) locs.push(s.locationId);
    });
    let count = 0;
    for (let i = 1; i < locs.length - 1; i++) {
      if (isInefficientRoundTrip(info, locs[i - 1], locs[i], locs[i + 1]))
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
    const forbidInefficient = !!options.forbidInefficient;
    const soloTravelIds = soloTravelMemberIds();
    const ineffInfo = inefficientRoundTripLocationInfo();
    const priorityRank = new Map(eligibleReqs.map((r, i) => [r.id, i]));
    const byDay = /* @__PURE__ */ new Map();
    eligibleReqs.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const days = [...byDay.keys()].sort((a, b) => a - b);
    const allLocIds = state.locations.map((l) => l.id).concat([null]);
    const memberIdsByDay = /* @__PURE__ */ new Map();
    function allMemberIdsForDay(day) {
      let ids = memberIdsByDay.get(day);
      if (!ids) {
        ids = new Set((byDay.get(day) || []).map((r) => r.memberId));
        memberIdsByDay.set(day, ids);
      }
      return ids;
    }
    const locationsByReq = /* @__PURE__ */ new Map();
    function locationsForReq(r) {
      let locs = locationsByReq.get(r);
      if (!locs) {
        locs = candidateLocationsForRequest(r);
        locationsByReq.set(r, locs);
      }
      return locs;
    }
    const locIndexOf = new Map(allLocIds.map((id, i) => [id, i]));
    const LOCS = allLocIds.length;
    const needOfPair = new Array(LOCS * LOCS), travelOfPair = new Array(LOCS * LOCS);
    allLocIds.forEach(
      (a, i) => allLocIds.forEach((b, j) => {
        needOfPair[i * LOCS + j] = requiredGapMin(a, b);
        travelOfPair[i * LOCS + j] = travelMinutes(a, b);
      })
    );
    const memberBitOf = /* @__PURE__ */ new Map();
    eligibleReqs.forEach((r) => {
      if (!memberBitOf.has(r.memberId)) memberBitOf.set(r.memberId, memberBitOf.size);
    });
    const MEMBER_WORDS = Math.max(1, Math.ceil(memberBitOf.size / 32));
    function pairNeed(predIdx, predLoc, locId, locIdx) {
      return locIdx === void 0 ? requiredGapMin(predLoc, locId) : needOfPair[predIdx * LOCS + locIdx];
    }
    function pairTravel(predIdx, predLoc, locId, locIdx) {
      return locIdx === void 0 ? travelMinutes(predLoc, locId) : travelOfPair[predIdx * LOCS + locIdx];
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
      function buildBestChain(day, eligibleMemberIds, weightFn, endBefore, onlyLocationId, coveragePriority) {
        weightFn = weightFn || (() => 1);
        const otherDaysTravelUsed = maxTravelsPerWeek != null ? weeklyTravelUsedExcluding(day) : 0;
        const cands = (byDay.get(day) || []).filter(
          (r) => eligibleMemberIds.has(r.memberId) && (!endBefore || r.startSlot + durationToSlots(r.duration) <= endBefore.slot)
        );
        const nodes = [];
        cands.forEach((cand) => {
          const memberLocs = locationsForReq(cand);
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
        function indexList(end, locId) {
          const byEnd = index.get(locId);
          return byEnd && byEnd.get(end);
        }
        function timeCostOf(n) {
          return n.travelMinutesSum + n.idleMinutesSum;
        }
        function addToIndex(node) {
          let byEnd = index.get(node.locationId);
          if (!byEnd) {
            byEnd = /* @__PURE__ */ new Map();
            index.set(node.locationId, byEnd);
          }
          let list = byEnd.get(node.end);
          if (!list) {
            list = [];
            byEnd.set(node.end, list);
          }
          list.push(node);
          list.sort(
            (a, b) => travelFirst ? a.travelCount - b.travelCount || b.dp - a.dp || a.ineffCount - b.ineffCount || (travelCountOnly ? 0 : a.travelMinutesSum - b.travelMinutesSum || timeCostOf(a) - timeCostOf(b) || b.alignedScore - a.alignedScore || a.soloSlackPenalty - b.soloSlackPenalty) || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0) : (coveragePriority || Math.abs(a.dp - b.dp) >= COVERAGE_WEIGHT_GAP_THRESHOLD ? b.dp - a.dp || a.ineffCount - b.ineffCount : a.ineffCount - b.ineffCount || b.dp - a.dp) || a.travelCount - b.travelCount || (travelCountOnly ? 0 : a.travelMinutesSum - b.travelMinutesSum || timeCostOf(a) - timeCostOf(b) || b.alignedScore - a.alignedScore || a.soloSlackPenalty - b.soloSlackPenalty) || (preferDaytime ? b.daytimeScore - a.daytimeScore : 0) || (groupByLocation ? b.groupScore - a.groupScore : 0)
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
        function isBetterPair(dpA, countA, ineffA, travelA, timeCostA, alignedA, slackPenA, daytimeA, groupA, dpB, countB, ineffB, travelB, timeCostB, alignedB, slackPenB, daytimeB, groupB) {
          const hardWeightGap = Math.abs(dpA - dpB) >= COVERAGE_WEIGHT_GAP_THRESHOLD;
          if (travelFirst) {
            if (countA !== countB) return countA < countB;
            if (dpA !== dpB) return dpA > dpB;
            if (ineffA !== ineffB) return ineffA < ineffB;
          } else if (coveragePriority || hardWeightGap) {
            if (dpA !== dpB) return dpA > dpB;
            if (ineffA !== ineffB) return ineffA < ineffB;
            if (countA !== countB) return countA < countB;
          } else {
            if (ineffA !== ineffB) return ineffA < ineffB;
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
        const usedBits = new Uint32Array(nodes.length * MEMBER_WORDS);
        let best = null;
        nodes.forEach((node, nodeIdx) => {
          const memberBit = memberBitOf.get(node.cand.memberId);
          const memberWord = memberBit >>> 5, memberMask = 1 << (memberBit & 31);
          node.bitBase = nodeIdx * MEMBER_WORDS;
          let bestPrev = null, bestPrevDp = -Infinity, bestResultTravelOnly = Infinity, bestResultTimeCost = Infinity, bestResultAligned = -Infinity, bestResultSlackPen = Infinity, bestResultDaytime = -Infinity, bestResultGroup = -Infinity, bestTravelCount = Infinity, bestResultIneffCount = Infinity, bestTransitionMin = 0, bestSlackMin = 0;
          const nodeLocIdx = locIndexOf.get(node.locationId);
          allLocIds.forEach((predLoc, predIdx) => {
            const need = pairNeed(predIdx, predLoc, node.locationId, nodeLocIdx);
            const transitionMin = pairTravel(
              predIdx,
              predLoc,
              node.locationId,
              nodeLocIdx
            );
            for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {
              const reqEnd2 = node.cand.startSlot - (need + slackMin) / SLOT_MIN;
              const list = indexList(reqEnd2, predLoc);
              if (!list) continue;
              for (const prevNode of list) {
                if (usedBits[prevNode.bitBase + memberWord] & memberMask) continue;
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
                const resultIneffCount = prevNode.ineffCount + (isInefficientRoundTrip(
                  ineffInfo,
                  prevNode.twoBackLoc,
                  prevNode.locationId,
                  node.locationId
                ) ? 1 : 0);
                if (forbidInefficient && resultIneffCount > prevNode.ineffCount)
                  continue;
                if (!bestPrev || isBetterPair(
                  prevNode.dp,
                  tc,
                  resultIneffCount,
                  resultTravelOnly,
                  resultTimeCost,
                  prevNode.alignedScore,
                  resultSlackPen,
                  prevNode.daytimeScore,
                  prevNode.groupScore,
                  bestPrevDp,
                  bestTravelCount,
                  bestResultIneffCount,
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
                  bestResultIneffCount = resultIneffCount;
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
            node.ineffCount = bestResultIneffCount;
            node.travelMinutesSum = bestPrev.travelMinutesSum + bestTransitionMin;
            node.idleMinutesSum = bestPrev.idleMinutesSum + bestSlackMin;
            node.alignedScore = bestPrev.alignedScore;
            node.soloSlackPenalty = bestResultSlackPen;
            node.daytimeScore = bestPrev.daytimeScore + daytimeBonus;
            node.groupScore = bestPrev.groupScore + (bestPrev.locationId === node.locationId ? 1 : 0);
            usedBits.copyWithin(
              node.bitBase,
              bestPrev.bitBase,
              bestPrev.bitBase + MEMBER_WORDS
            );
            node.arrivedViaTravel = bestPrev.locationId !== node.locationId;
          } else {
            node.dp = weightFn(node.cand.memberId);
            node.prev = null;
            node.travelCount = 0;
            node.ineffCount = 0;
            node.travelMinutesSum = 0;
            node.idleMinutesSum = 0;
            node.alignedScore = isHalfHourStart(node.cand) ? 1 : 0;
            node.soloSlackPenalty = 0;
            node.daytimeScore = daytimeBonus;
            node.groupScore = 0;
            node.arrivedViaTravel = false;
          }
          usedBits[node.bitBase + memberWord] |= memberMask;
          node.twoBackLoc = roundTripOriginLoc(
            node,
            (n) => n.prev,
            (n) => n.locationId
          );
          if (node.dp > -Infinity) {
            addToIndex(node);
            const nodeTimeCost = timeCostOf(node);
            const bestTimeCost = best ? timeCostOf(best) : null;
            const tie = best && node.dp === best.dp && node.ineffCount === best.ineffCount && node.travelCount === best.travelCount && (travelCountOnly || node.travelMinutesSum === best.travelMinutesSum) && (travelCountOnly || nodeTimeCost === bestTimeCost) && (travelCountOnly || node.alignedScore === best.alignedScore) && (travelCountOnly || node.soloSlackPenalty === best.soloSlackPenalty) && (!preferDaytime || node.daytimeScore === best.daytimeScore) && (!groupByLocation || node.groupScore === best.groupScore);
            if (!best || isBetterPair(
              node.dp,
              node.travelCount,
              node.ineffCount,
              node.travelMinutesSum,
              nodeTimeCost,
              node.alignedScore,
              node.soloSlackPenalty,
              node.daytimeScore,
              node.groupScore,
              best.dp,
              best.travelCount,
              best.ineffCount,
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
            if (endBefore.noTravelIn && transitionMin > 0) return;
            for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {
              const gapSlots = (need + slackMin) / SLOT_MIN;
              const list = indexList(endBefore.slot - gapSlots, loc);
              if (!list || list.length === 0) continue;
              const node = list.find(
                (n) => !(soloTravelIds.has(n.cand.memberId) && n.arrivedViaTravel && transitionMin > 0)
              );
              if (!node) continue;
              const nodeIneffCount = node.ineffCount + (isInefficientRoundTrip(
                ineffInfo,
                node.twoBackLoc,
                node.locationId,
                endBefore.locationId
              ) ? 1 : 0);
              if (forbidInefficient && nodeIneffCount > node.ineffCount) continue;
              const nodeTimeCost = timeCostOf(node);
              const chosenTimeCost = chosen ? timeCostOf(chosen) : null;
              if (!chosen || isBetterPair(
                node.dp,
                node.travelCount,
                nodeIneffCount,
                node.travelMinutesSum,
                nodeTimeCost,
                node.alignedScore,
                node.soloSlackPenalty,
                node.daytimeScore,
                node.groupScore,
                chosen.dp,
                chosen.travelCount,
                chosen.ineffCount,
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
      function extendExistingChain(day, eligibleMemberIds, coveragePriority) {
        let chain = chainByDay.get(day) || [];
        if (chain.length === 0) return;
        const usedMembers = new Set(chain.map((s) => s.memberId));
        const dayCands = byDay.get(day) || [];
        let extending = true;
        while (extending) {
          extending = false;
          const chainEnd = chain[chain.length - 1];
          const chainTwoBackLoc = roundTripOriginLoc(
            chain.length - 1,
            (i) => i > 0 ? i - 1 : null,
            (i) => chain[i].locationId
          );
          const chainEndArrivedViaTravel = chain.length >= 2 && chain[chain.length - 2].locationId !== chainEnd.locationId;
          const chainEndIsSoloTravelMember = soloTravelIds.has(chainEnd.memberId) && chainEndArrivedViaTravel;
          let bestCand = null, bestLocated = null, bestCost = Infinity;
          dayCands.forEach((cand) => {
            if (!eligibleMemberIds.has(cand.memberId) || usedMembers.has(cand.memberId))
              return;
            let bestLoc = null;
            locationsForReq(cand).forEach((locId) => {
              const need = requiredGapMin(chainEnd.locationId, locId);
              const actual = (cand.startSlot - (chainEnd.startSlot + durationToSlots(chainEnd.duration))) * SLOT_MIN;
              if (actual < need || actual > need + allowGapMin) return;
              const cost = travelMinutes(chainEnd.locationId, locId);
              if (chainEndIsSoloTravelMember && cost > 0) return;
              if ((forbidInefficient || !coveragePriority) && isInefficientRoundTrip(
                ineffInfo,
                chainTwoBackLoc,
                chainEnd.locationId,
                locId
              ))
                return;
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
      function endBeforeOf(chain) {
        const first = chain[0];
        const second = chain[1];
        return {
          slot: first.startSlot,
          locationId: first.locationId,
          noTravelIn: !!second && soloTravelIds.has(first.memberId) && travelMinutes(first.locationId, second.locationId) > 0
        };
      }
      function extendChainBackward(day, eligibleMemberIds, weightFn, coveragePriority) {
        const chain = chainByDay.get(day) || [];
        if (chain.length === 0) return;
        const usedMembers = new Set(chain.map((s) => s.memberId));
        const remaining = new Set(
          [...eligibleMemberIds].filter((id) => !usedMembers.has(id))
        );
        if (remaining.size === 0) return;
        const frontChain = buildBestChain(
          day,
          remaining,
          weightFn,
          endBeforeOf(chain),
          null,
          coveragePriority
        );
        if (frontChain.length === 0) return;
        const combined = [...frontChain, ...chain];
        if (dailyTravelCount(combined) > maxTravelsPerDay) return;
        if (forbidInefficient && dailyInefficientMoveCount(combined, ineffInfo) > dailyInefficientMoveCount(chain, ineffInfo))
          return;
        if (maxTravelsPerWeek != null && weeklyTravelUsedExcluding(day) + dailyTravelCount(combined) > maxTravelsPerWeek)
          return;
        frontChain.forEach((s) => {
          assigned.push(s);
          if (!memberDays.has(s.memberId)) memberDays.set(s.memberId, /* @__PURE__ */ new Set());
          memberDays.get(s.memberId).add(day);
        });
        chainByDay.set(day, combined);
      }
      function fillDay(day, eligibleMemberIds, weightFn, coveragePriority) {
        if ((chainByDay.get(day) || []).length > 0) {
          extendExistingChain(day, eligibleMemberIds, coveragePriority);
          extendChainBackward(day, eligibleMemberIds, weightFn, coveragePriority);
        } else {
          buildBestChain(
            day,
            eligibleMemberIds,
            weightFn,
            null,
            null,
            coveragePriority
          ).forEach((s) => commit(day, s));
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
          buildBestChain(
            day,
            beforeEligible,
            fairnessWeight,
            endBeforeOf(dayPins)
          ).forEach((s) => commit(day, s));
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
        fillDay(day, elig, fairnessWeight, !sessionCountFirst);
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
  function totalInefficientMoveCount(assigned, info) {
    info = info === void 0 ? inefficientRoundTripLocationInfo() : info;
    let total = 0;
    const byDay = /* @__PURE__ */ new Map();
    assigned.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    byDay.forEach((reqs) => {
      const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
      total += dailyInefficientMoveCount(sorted, info);
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
      desc: "미배정 없음 → 비효율 이동 없음 → 수업 수·이동 횟수·빈 시간 균형(수업 1건 = 이동 1번) 순으로 배정합니다.",
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
    [options, flippedOptions].forEach(
      (o) => consider(Object.assign({}, o, { forbidInefficient: true }))
    );
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
    const ineff = totalInefficientMoveCount(cand.assigned);
    const capOk = typeof maxUnassigned === "number" && cand.unassignedMembers.length > maxUnassigned ? 0 : 1;
    const idle = schedule2TotalIdleMinutes(cand.assigned);
    const balanced = sessions * SESSION_VALUE_MINUTES - travel * TRAVEL_VALUE_MINUTES - idle;
    return primary === "sessions" ? [capOk, -ineff, sessions, count, -travel, -idle] : [capOk, count, -ineff, balanced, sessions, -travel, -idle];
  }
  function isCandidateWorse(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
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
    if (typeof document === "undefined" || document.hidden) {
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
        checkGenerationCancelled();
      }
    }
    if (onProgress) onProgress(1);
    return pool;
  }
  var INITIAL_SEARCH_ATTEMPTS = 1e3;
  function* greedyAttemptInputs(strategyIndex, eligible, attempts) {
    const rand = makeSeededRandom(strategyIndex + 1);
    yield { jitter: new Map(eligible.map((r) => [r.id, 0])), dayOrder: void 0 };
    for (let i = 0; i < attempts; i++) {
      const jitter = new Map(eligible.map((r) => [r.id, rand()]));
      const dayOrder = shuffledDayOrder(rand);
      yield { jitter, dayOrder };
    }
  }
  var MAX_GREEDY_WORKERS = 4;
  function defaultGreedyWorkerCount() {
    const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency || 1;
    return Math.max(0, Math.min(MAX_GREEDY_WORKERS, cores - 1));
  }
  var MAX_POOL_VARIANTS = 9;
  var TRAVEL_VALUE_MINUTES = 60;
  var SESSION_VALUE_MINUTES = TRAVEL_VALUE_MINUTES;
  var candidatePools = {};
  var candidateAPools = {};
  function resetCandidateSession() {
    Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
    Object.keys(candidateAPools).forEach((k) => delete candidateAPools[k]);
  }
  function candidateSignature(cand) {
    return cand.assigned.map((r) => r.id).slice().sort().join(",");
  }
  async function buildGreedySearchPool(eligible, eligibleIds, allMemberIds, onProgress, workerOptions = {}) {
    const searchAttempts = workerOptions.attempts !== void 0 ? workerOptions.attempts : INITIAL_SEARCH_ATTEMPTS;
    const perStrategy = searchAttempts + 1;
    const totalBuilds = STRATEGIES.length * perStrategy;
    let completed = 0;
    const pool = await runTasksInWorkers({
      init: engineWorkerInit("greedy", {
        eligible,
        eligibleIds: [...eligibleIds],
        allMemberIds: [...allMemberIds],
        attempts: searchAttempts
      }),
      taskCount: totalBuilds,
      taskMessage: (i) => ({
        strategyIndex: Math.floor(i / perStrategy),
        attempt: i % perStrategy
      }),
      workerCount: workerOptions.workerCount !== void 0 ? workerOptions.workerCount : defaultGreedyWorkerCount(),
      onTaskDone: () => {
        completed++;
        if (completed % PROGRESS_YIELD_EVERY === 0)
          onProgress(completed / totalBuilds);
      },
      checkCancelled: checkGenerationCancelled,
      label: "그리디",
      createWorker: workerOptions.createWorker
    });
    pool.forEach((cand) => {
      if (cand)
        cand.unassignedMembers = cand.unassignedMembers.map(memberById).filter(Boolean);
    });
    if (completed < totalBuilds) {
      for (let idx = 0; idx < STRATEGIES.length; idx++) {
        let i = idx * perStrategy;
        for (const input of greedyAttemptInputs(
          idx,
          eligible,
          searchAttempts
        )) {
          if (!pool[i]) {
            pool[i] = buildCandidateFromStrategy(
              idx,
              eligible,
              eligibleIds,
              allMemberIds,
              input.jitter,
              [],
              input.dayOrder
            );
            completed++;
            if (completed % PROGRESS_YIELD_EVERY === 0) {
              onProgress(completed / totalBuilds);
              await yieldToUI();
              checkGenerationCancelled();
            }
          }
          i++;
        }
      }
    }
    onProgress(1);
    return pool;
  }
  async function generateCandidatesAsync(onProgress, workerOptions = {}) {
    const allMemberIds = new Set(
      state.requests.filter((r) => !currentExcludedIds().includes(r.memberId)).map((r) => r.memberId)
    );
    const eligible = state.requests.filter(isEligibleRequest);
    const eligibleIds = new Set(eligible.map((r) => r.id));
    const pool = await buildGreedySearchPool(
      eligible,
      eligibleIds,
      allMemberIds,
      onProgress,
      workerOptions
    );
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

  // src/engine/rng.js
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

  // src/engine/chainDpPolish.js
  function findEarlierRequestForLocation(requests, minStart, currentStart, locationId) {
    let earliest = null;
    requests.forEach((r) => {
      if (r.startSlot < minStart || r.startSlot >= currentStart) return;
      if (!candidateLocationsForRequest(r).includes(locationId)) return;
      if (!earliest || r.startSlot < earliest.startSlot) earliest = r;
    });
    return earliest;
  }
  function moveNodeToRequest(node, request) {
    node.id = request.id;
    node.startSlot = request.startSlot;
    node.end = request.startSlot + durationToSlots(node.duration);
  }
  async function runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, stage1DayOrder, runRepair, runPolish, polishBudgetMs, seedOffset) {
    seedOffset = seedOffset || 0;
    const ineffInfo = inefficientRoundTripLocationInfo();
    const soloIds = soloTravelMemberIds();
    function dayChainAllowed(chain) {
      return !dayChainViolation(chain, soloIds);
    }
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
    const locationsByReq = /* @__PURE__ */ new Map();
    function locationsForReq(r) {
      let locs = locationsByReq.get(r);
      if (!locs) {
        locs = candidateLocationsForRequest(r);
        locationsByReq.set(r, locs);
      }
      return locs;
    }
    function dayNodes(dayRequests, weightFn, jitterFn) {
      return buildDayNodes(dayRequests, weightFn, jitterFn, locationsForReq);
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
        locationsForReq(r).forEach((locId) => {
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
      const nodes = dayNodes(
        reqsByDay.get(day),
        (memberId, startSlot, locationId) => {
          if ((assignedCountByMember.get(memberId) || 0) !== 0) return 0;
          return locationId === dominantLoc ? 1.02 : 1;
        },
        () => stage1RandomFn()
      );
      const chain = runChainDP(nodes, void 0, ineffInfo, true);
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
      const nodes = dayNodes(
        reqsByDay.get(day),
        (memberId, startSlot, locationId) => {
          if (pinnedKeys.has(memberId + "|" + startSlot + "|" + locationId))
            return PIN_WEIGHT;
          if (pinnedMemberIds.has(memberId)) return 0;
          return isEligibleForDay(memberId, day) ? 1 : 0;
        },
        () => stage1RandomFn()
      );
      const chain = runChainDP(nodes, void 0, ineffInfo);
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
        const candNodes = dayNodes(dayReqsForMember, () => 1);
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
          if (!dayChainAllowed(newChain)) continue;
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
          if (!dayChainAllowed(newChain)) continue;
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
        const nodes = dayNodes(reqsByDay.get(day), (mId) => {
          if (mId === memberId) return REBUILD_TARGET_WEIGHT;
          return isEligibleForDay(mId, day) ? 1 : 0;
        });
        const newChain = runChainDP(nodes, void 0, ineffInfo);
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
      let fewerTravelOrIdle = function(travelA, idleA, travelB, idleB) {
        if (isIdleFirst() && idleA !== idleB) return idleA < idleB;
        return travelA < travelB;
      }, dayIdleMinutes = function(chain) {
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
      }, isTravelIdleBetter = function(travelA, idleA, travelB, idleB, ineffA, ineffB) {
        ineffA = ineffA || 0;
        ineffB = ineffB || 0;
        if (ineffA !== ineffB) return ineffA < ineffB;
        if (isIdleFirst() && idleA !== idleB) return idleA < idleB;
        const scoreA = travelA * TRAVEL_VALUE_MINUTES + idleA;
        const scoreB = travelB * TRAVEL_VALUE_MINUTES + idleB;
        if (scoreA !== scoreB) return scoreA < scoreB;
        if (travelA !== travelB) return travelA < travelB;
        return idleA < idleB;
      }, travelIdleImproves = function(deltaTravel, deltaIdle, deltaIneff) {
        deltaIneff = deltaIneff || 0;
        if (deltaIneff > 0) return false;
        if (deltaIneff < 0) return true;
        if (isIdleFirst() && deltaIdle !== 0) return deltaIdle < 0;
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
        const beforeCurrentDayIneff = dailyInefficientMoveCount(
          dayChains.get(currentDay) || [],
          ineffInfo
        );
        const currentDayWithoutTravel = totalTravelCount(currentChainWithout);
        const currentDayWithoutIdle = dayIdleMinutes(currentChainWithout);
        const currentDayWithoutIneff = dailyInefficientMoveCount(
          currentChainWithout,
          ineffInfo
        );
        let bestMove = null;
        const leavingAllowed = dayChainAllowed(currentChainWithout);
        daysWithReqs.forEach((day) => {
          if (day !== currentDay) {
            if (!leavingAllowed) return;
            if ((dayChains.get(day) || []).some((n) => n.memberId === memberId))
              return;
          }
          const dayReqsForMember = reqsFor(memberId, day);
          if (dayReqsForMember.length === 0) return;
          const candNodes = dayNodes(dayReqsForMember, () => 1);
          const baseChain = day === currentDay ? currentChainWithout : dayChains.get(day) || [];
          const beforeTargetDayTravel = day === currentDay ? 0 : totalTravelCount(baseChain);
          const beforeTargetDayIdle = day === currentDay ? 0 : dayIdleMinutes(baseChain);
          const beforeTargetDayIneff = day === currentDay ? 0 : dailyInefficientMoveCount(baseChain, ineffInfo);
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
            if (!dayChainAllowed(newChain)) return;
            let deltaTravel, deltaIdle, deltaIneff;
            if (day === currentDay) {
              deltaTravel = totalTravelCount(newChain) - beforeCurrentDayTravel;
              deltaIdle = dayIdleMinutes(newChain) - beforeCurrentDayIdle;
              deltaIneff = dailyInefficientMoveCount(newChain, ineffInfo) - beforeCurrentDayIneff;
            } else {
              deltaTravel = currentDayWithoutTravel + totalTravelCount(newChain) - (beforeCurrentDayTravel + beforeTargetDayTravel);
              deltaIdle = currentDayWithoutIdle + dayIdleMinutes(newChain) - (beforeCurrentDayIdle + beforeTargetDayIdle);
              deltaIneff = currentDayWithoutIneff + dailyInefficientMoveCount(newChain, ineffInfo) - (beforeCurrentDayIneff + beforeTargetDayIneff);
            }
            const improves = travelIdleImproves(
              deltaTravel,
              deltaIdle,
              deltaIneff
            );
            if (improves && (!bestMove || isTravelIdleBetter(
              deltaTravel,
              deltaIdle,
              bestMove.deltaTravel,
              bestMove.deltaIdle,
              deltaIneff,
              bestMove.deltaIneff
            ))) {
              bestMove = {
                sameDay: day === currentDay,
                targetDay: day,
                newTargetChain: newChain,
                deltaTravel,
                deltaIdle,
                deltaIneff
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
        if (!dayChainAllowed(newChain)) return null;
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
        if (!locationsForReq(req1InDay2).includes(node2.locationId))
          return false;
        if (!locationsForReq(req2InDay1).includes(node1.locationId))
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
        const beforeIneff = dailyInefficientMoveCount(dayChains.get(day1) || [], ineffInfo) + dailyInefficientMoveCount(dayChains.get(day2) || [], ineffInfo);
        const afterIneff = dailyInefficientMoveCount(chain1, ineffInfo) + dailyInefficientMoveCount(chain2, ineffInfo);
        if (!travelIdleImproves(
          afterTravel - beforeTravel,
          afterIdle - beforeIdle,
          afterIneff - beforeIneff
        ))
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
          const candNodes = dayNodes(reqs, () => 1);
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
        const allowed = placed && [...touchedDays].every((d) => dayChainAllowed(dayChains.get(d) || []));
        if (!allowed) {
          restoreChainState(snap);
          return false;
        }
        let beforeTravel = 0, beforeIdle = 0, beforeIneff = 0, afterTravel = 0, afterIdle = 0, afterIneff = 0;
        touchedDays.forEach((day) => {
          beforeTravel += totalTravelCount(snap.dayChains.get(day) || []);
          beforeIdle += dayIdleMinutes(snap.dayChains.get(day) || []);
          beforeIneff += dailyInefficientMoveCount(
            snap.dayChains.get(day) || [],
            ineffInfo
          );
          afterTravel += totalTravelCount(dayChains.get(day) || []);
          afterIdle += dayIdleMinutes(dayChains.get(day) || []);
          afterIneff += dailyInefficientMoveCount(
            dayChains.get(day) || [],
            ineffInfo
          );
        });
        const deltaTravel = afterTravel - beforeTravel;
        const deltaIdle = afterIdle - beforeIdle;
        const deltaIneff = afterIneff - beforeIneff;
        if (acceptFn(deltaTravel, deltaIdle, deltaIneff)) return true;
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
        const allowed = placed && [...touchedDays].every((d) => dayChainAllowed(dayChains.get(d) || []));
        if (!allowed) {
          restoreChainState(snap);
          return false;
        }
        let beforeTravel = 0, beforeIdle = 0, beforeIneff = 0, afterTravel = 0, afterIdle = 0, afterIneff = 0;
        touchedDays.forEach((day) => {
          beforeTravel += totalTravelCount(snap.dayChains.get(day) || []);
          beforeIdle += dayIdleMinutes(snap.dayChains.get(day) || []);
          beforeIneff += dailyInefficientMoveCount(
            snap.dayChains.get(day) || [],
            ineffInfo
          );
          afterTravel += totalTravelCount(dayChains.get(day) || []);
          afterIdle += dayIdleMinutes(dayChains.get(day) || []);
          afterIneff += dailyInefficientMoveCount(
            dayChains.get(day) || [],
            ineffInfo
          );
        });
        const deltaTravel = afterTravel - beforeTravel;
        const deltaIdle = afterIdle - beforeIdle;
        const deltaIneff = afterIneff - beforeIneff;
        if (acceptFn(deltaTravel, deltaIdle, deltaIneff)) return true;
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
        const beforeIneff = dailyInefficientMoveCount(existingChain, ineffInfo);
        existingChain.forEach((node) => uncommit(day, node));
        const nodes = dayNodes(
          reqsByDay.get(day),
          (mId) => isEligibleForDay(mId, day) ? 1 : 0
        );
        const newChain = runChainDP(nodes, void 0, ineffInfo);
        newChain.forEach((node) => commit(day, node));
        dayChains.set(day, newChain);
        const afterTotalSessions = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + c.length,
          0
        );
        const afterIneff = dailyInefficientMoveCount(newChain, ineffInfo);
        const worse = stillUnassignedIds().length > beforeUnassignedCount || afterIneff > beforeIneff || afterIneff === beforeIneff && afterTotalSessions < beforeTotalSessions;
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
            const firstNodes = dayNodes(
              reqsByDay.get(firstDay),
              (mId) => isEligibleForDay(mId, firstDay) ? 1 : 0,
              jitterFn
            );
            const firstChain = runChainDP(firstNodes, void 0, ineffInfo);
            firstChain.forEach((node) => commit(firstDay, node));
            dayChains.set(firstDay, firstChain);
            const secondNodes = dayNodes(
              reqsByDay.get(secondDay),
              (mId) => isEligibleForDay(mId, secondDay) ? 1 : 0,
              jitterFn
            );
            const secondChain = runChainDP(secondNodes, void 0, ineffInfo);
            secondChain.forEach((node) => commit(secondDay, node));
            dayChains.set(secondDay, secondChain);
            const outcome = {
              unassigned: stillUnassignedIds().length,
              totalSessions: Array.from(dayChains.values()).reduce(
                (sum, c) => sum + c.length,
                0
              ),
              pairTravel: totalTravelCount(firstChain) + totalTravelCount(secondChain),
              pairIdle: dayIdleMinutes(firstChain) + dayIdleMinutes(secondChain),
              pairIneff: dailyInefficientMoveCount(firstChain, ineffInfo) + dailyInefficientMoveCount(secondChain, ineffInfo),
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
          const beforePairIdle = dayIdleMinutes(existingA) + dayIdleMinutes(existingB);
          const beforePairIneff = dailyInefficientMoveCount(existingA, ineffInfo) + dailyInefficientMoveCount(existingB, ineffInfo);
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
            if (opt.pairIneff > beforePairIneff) return;
            if (opt.pairIneff === beforePairIneff) {
              if (opt.totalSessions < beforeTotalSessions) return;
              if (!fewerTravelOrIdle(
                opt.pairTravel,
                opt.pairIdle,
                beforePairTravel,
                beforePairIdle
              ))
                return;
            }
            const better2 = !bestOption || opt.pairIneff < bestOption.pairIneff || opt.pairIneff === bestOption.pairIneff && fewerTravelOrIdle(
              opt.pairTravel,
              opt.pairIdle,
              bestOption.pairTravel,
              bestOption.pairIdle
            );
            if (better2) bestOption = opt;
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
      const baselineIneff = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + dailyInefficientMoveCount(c, ineffInfo),
        0
      );
      const baselineIdle = Array.from(dayChains.values()).reduce(
        (sum, c) => sum + dayIdleMinutes(c),
        0
      );
      let bestSnapshot = {
        unassigned: baselineUnassigned,
        sessions: baselineSessions,
        travel: baselineTravel,
        idle: baselineIdle,
        ineff: baselineIneff,
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
          const nodes = dayNodes(
            reqsByDay.get(day),
            (mId, startSlot, locationId) => {
              if (!isEligibleForDay(mId, day)) return 0;
              return locationId === dominantLoc ? 1.02 : 1;
            },
            () => polishRandomFn()
          );
          const chain = runChainDP(nodes, void 0, ineffInfo);
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
        const attemptIneff = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + dailyInefficientMoveCount(c, ineffInfo),
          0
        );
        const attemptIdle = Array.from(dayChains.values()).reduce(
          (sum, c) => sum + dayIdleMinutes(c),
          0
        );
        const accept = attemptUnassigned <= bestSnapshot.unassigned && (attemptIneff < bestSnapshot.ineff || attemptIneff === bestSnapshot.ineff && attemptSessions >= bestSnapshot.sessions && fewerTravelOrIdle(
          attemptTravel,
          attemptIdle,
          bestSnapshot.travel,
          bestSnapshot.idle
        ));
        if (accept) {
          bestSnapshot = {
            unassigned: attemptUnassigned,
            sessions: attemptSessions,
            travel: attemptTravel,
            idle: attemptIdle,
            ineff: attemptIneff,
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
        }, saTotalIneff = function() {
          let sum = 0;
          dayChains.forEach((chain) => {
            sum += dailyInefficientMoveCount(chain, ineffInfo);
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
          if (picked.day !== currentDay && !dayChainAllowed(currentChainWithout))
            return null;
          const locOptions = locationsForReq(picked.req);
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
          let deltaTravel, deltaIdle, deltaIneff;
          if (picked.day === currentDay) {
            deltaTravel = totalTravelCount(newChain) - totalTravelCount(dayChains.get(currentDay) || []);
            deltaIdle = dayIdleMinutes(newChain) - dayIdleMinutes(dayChains.get(currentDay) || []);
            deltaIneff = dailyInefficientMoveCount(newChain, ineffInfo) - dailyInefficientMoveCount(
              dayChains.get(currentDay) || [],
              ineffInfo
            );
          } else {
            const beforeCur = dayChains.get(currentDay) || [];
            const beforeTgt = dayChains.get(picked.day) || [];
            deltaTravel = totalTravelCount(currentChainWithout) + totalTravelCount(newChain) - (totalTravelCount(beforeCur) + totalTravelCount(beforeTgt));
            deltaIdle = dayIdleMinutes(currentChainWithout) + dayIdleMinutes(newChain) - (dayIdleMinutes(beforeCur) + dayIdleMinutes(beforeTgt));
            deltaIneff = dailyInefficientMoveCount(currentChainWithout, ineffInfo) + dailyInefficientMoveCount(newChain, ineffInfo) - (dailyInefficientMoveCount(beforeCur, ineffInfo) + dailyInefficientMoveCount(beforeTgt, ineffInfo));
          }
          const cost = deltaTravel * SA_TRAVEL_WEIGHT + deltaIdle;
          return {
            cost,
            deltaIneff,
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
          if (!locationsForReq(req1InDay2).includes(n2.locationId))
            return null;
          if (!locationsForReq(req2InDay1).includes(n1.locationId))
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
          const beforeIneff = dailyInefficientMoveCount(dayChains.get(day1) || [], ineffInfo) + dailyInefficientMoveCount(dayChains.get(day2) || [], ineffInfo);
          const afterIneff = dailyInefficientMoveCount(chain1, ineffInfo) + dailyInefficientMoveCount(chain2, ineffInfo);
          const cost = (afterTravel - beforeTravel) * SA_TRAVEL_WEIGHT + (afterIdle - beforeIdle);
          return {
            cost,
            deltaIneff: afterIneff - beforeIneff,
            apply: () => {
              uncommit(day1, n1);
              uncommit(day2, n2);
              commit(day1, newInDay1);
              commit(day2, newInDay2);
              dayChains.set(day1, chain1);
              dayChains.set(day2, chain2);
            }
          };
        }, saAccepts = function(cost, deltaIneff) {
          if (deltaIneff > 0) return false;
          if (deltaIneff < 0) return true;
          return cost <= 0 || saRandomFn() < Math.exp(-cost / temperature);
        };
        const SA_TRAVEL_WEIGHT = isIdleFirst() ? 0.01 : TRAVEL_VALUE_MINUTES;
        const saRandomFn = mulberry32(552233 + seedOffset);
        const SA_START_TEMP = 200, SA_END_TEMP = 1;
        const saStart = now();
        const saDuration = Math.max(1, SA_DEADLINE - saStart);
        let temperature = SA_START_TEMP;
        let bestSnapshotSA = new Map(dayChains);
        let bestTravelSA = saTotalTravel();
        let bestIdleSA = saTotalIdle();
        let bestIneffSA = saTotalIneff();
        while (now() < SA_DEADLINE) {
          await maybeYield();
          const elapsedFrac = Math.min(1, (now() - saStart) / saDuration);
          temperature = SA_START_TEMP * Math.pow(SA_END_TEMP / SA_START_TEMP, elapsedFrac);
          let applied = false;
          const moveRoll = saRandomFn();
          if (moveRoll < 0.15) {
            applied = trySessionCountSwap(saRandomFn, (dt, di, dineff) => {
              const cost = dt * SA_TRAVEL_WEIGHT + di;
              return saAccepts(cost, dineff);
            });
          } else if (moveRoll < 0.35) {
            const node = pickRandomNode(saRandomFn);
            if (node) {
              applied = tryEjectChainMove(node, (dt, di, dineff) => {
                const cost = dt * SA_TRAVEL_WEIGHT + di;
                return saAccepts(cost, dineff);
              });
            }
          } else {
            const proposal = saRandomFn() < 0.35 ? saProposeSwap(saRandomFn) : saProposeRelocate(saRandomFn);
            if (proposal) {
              const accept = saAccepts(proposal.cost, proposal.deltaIneff);
              if (accept) {
                proposal.apply();
                applied = true;
              }
            }
          }
          if (applied) {
            const curTravel = saTotalTravel();
            const curIdle = saTotalIdle();
            const curIneff = saTotalIneff();
            const curScore = curTravel * SA_TRAVEL_WEIGHT + curIdle;
            const bestScore = bestTravelSA * SA_TRAVEL_WEIGHT + bestIdleSA;
            if (curIneff < bestIneffSA || curIneff === bestIneffSA && (curScore < bestScore || curScore === bestScore && curTravel < bestTravelSA)) {
              bestTravelSA = curTravel;
              bestIdleSA = curIdle;
              bestIneffSA = curIneff;
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
          const earlierReq = findEarlierRequestForLocation(
            reqsFor(node.memberId, day),
            minStart,
            node.startSlot,
            node.locationId
          );
          if (!earlierReq) continue;
          moveNodeToRequest(node, earlierReq);
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

  // src/engine/polishWorkerPool.js
  var LOGICAL_CORES_PER_POLISH_WORKER = 4;
  var MAX_POLISH_WORKERS = 4;
  function defaultPolishWorkerCount(attemptCount) {
    const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency || 1;
    return Math.max(
      1,
      Math.min(
        attemptCount,
        MAX_POLISH_WORKERS,
        Math.floor(cores / LOGICAL_CORES_PER_POLISH_WORKER)
      )
    );
  }
  async function runPolishAttemptsInWorkers(base, attempts, budgetMs, onAttemptDone, options = {}) {
    const raw = await runTasksInWorkers({
      init: engineWorkerInit("polish", {
        idleFirst: isIdleFirst(),
        eligibleReqs: base.eligibleReqs,
        reqsByDay: base.reqsByDay,
        daysWithReqs: base.daysWithReqs
      }),
      taskCount: attempts.length,
      taskMessage: (i) => ({
        order: attempts[i].order,
        seedOffset: attempts[i].seedOffset,
        budgetMs
      }),
      workerCount: options.workerCount !== void 0 ? options.workerCount : defaultPolishWorkerCount(attempts.length),
      onTaskDone: onAttemptDone,
      checkCancelled: checkGenerationCancelled,
      label: "다듬기",
      createWorker: options.createWorker
    });
    return raw.map(
      (r) => r ? {
        assigned: r.assigned,
        unassignedMembers: r.unassignedMemberIds.map(memberById).filter(Boolean)
      } : void 0
    );
  }

  // src/engine/chainDp.js
  var SCHEDULE2_CARD_COUNT = 3;
  var IDLE_FIRST_CARD_INDEX = 0;
  var TEST_BUDGET_SCALE = typeof window !== "undefined" && window.__PT_TEST_BUDGET_SCALE__ > 0 && window.__PT_TEST_BUDGET_SCALE__ <= 1 && window.__PT_TEST_BUDGET_SCALE__ || 1;
  function scaledBudgetMs(fullMs, minMs) {
    return Math.max(minMs, Math.round(fullMs * TEST_BUDGET_SCALE));
  }
  var PER_GROUP_DAY_ORDER_SHUFFLES = 400;
  var PER_GROUP_SEARCH_DEADLINE_MS = scaledBudgetMs(3e4, 50);
  var PER_GROUP_MAX_POLISH_CANDIDATES = 16;
  var PER_GROUP_MAX_POLISH_ATTEMPTS = 48;
  var PER_GROUP_TOTAL_POLISH_BUDGET_MS = scaledBudgetMs(42e4, 480);
  var MIN_POLISH_BUDGET_MS = scaledBudgetMs(6e3, 10);
  var TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS = scaledBudgetMs(9e4, 100);
  var TARGET_MATCH_ALT_BASE_BUDGET_MS = scaledBudgetMs(8e3, 20);
  var TARGET_MATCH_ALT_BASE_DAY_ORDER_SHUFFLES = 40;
  function groupByDay(reqs) {
    const reqsByDay = /* @__PURE__ */ new Map();
    DAYS.forEach((_, d) => reqsByDay.set(d, []));
    reqs.forEach((r) => reqsByDay.get(r.day).push(r));
    const daysWithReqs = Array.from(reqsByDay.keys()).filter(
      (d) => reqsByDay.get(d).length > 0
    );
    return { reqsByDay, daysWithReqs };
  }
  function fixedDayOrders(daysWithReqs, reqsByDay) {
    const memberCountOf = (day) => new Set(reqsByDay.get(day).map((r) => r.memberId)).size;
    return [
      daysWithReqs.slice().sort((a, b) => memberCountOf(a) - memberCountOf(b)),
      daysWithReqs.slice().sort((a, b) => memberCountOf(b) - memberCountOf(a)),
      daysWithReqs.slice().sort((a, b) => a - b),
      daysWithReqs.slice().sort((a, b) => b - a)
    ];
  }
  async function searchWithinBase(reqs, reqsByDay, daysWithReqs, shuffleCount, deadlineMs, seedBase, randomFn, onEval) {
    const dayOrdersToTry = fixedDayOrders(daysWithReqs, reqsByDay);
    for (let k = 0; k < shuffleCount; k++)
      dayOrdersToTry.push(shuffled(daysWithReqs, randomFn));
    const deadline = performance.now() + deadlineMs;
    let best = null, bestOrder = null, bestSeedOffset = null;
    const evaluated = [];
    for (let i = 0; i < dayOrdersToTry.length; i++) {
      const seedOffset = seedBase + i;
      const result = await runSchedule2Pipeline(
        reqs,
        reqsByDay,
        daysWithReqs,
        dayOrdersToTry[i],
        true,
        false,
        void 0,
        seedOffset
      );
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
  async function runSchedule2RestartGroup(eligibleReqsMaster, groupSeed, groupIndex, onProgress, targetFloor) {
    const randomFn = mulberry32(groupSeed);
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
      randomFn,
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
          randomFn,
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
    let completedAttempts = 0;
    const fromWorkers = await runPolishAttemptsInWorkers(
      { eligibleReqs, reqsByDay, daysWithReqs },
      attempts,
      perAttemptBudget,
      () => {
        completedAttempts++;
        if (onProgress)
          onProgress(0.55 + completedAttempts / attempts.length * 0.45);
      }
    );
    let bestPolished = null;
    const allPolished = [];
    for (let i = 0; i < attempts.length; i++) {
      let raw = fromWorkers[i];
      if (!raw) {
        raw = await runSchedule2Pipeline(
          eligibleReqs,
          reqsByDay,
          daysWithReqs,
          attempts[i].order,
          true,
          true,
          perAttemptBudget,
          attempts[i].seedOffset
        );
        completedAttempts++;
        if (onProgress) {
          onProgress(0.55 + completedAttempts / attempts.length * 0.45);
          await yieldToUI();
          checkGenerationCancelled();
        }
      }
      const attempt = dropSessionsForBalance(raw);
      allPolished.push(attempt);
      if (!bestPolished || isSchedule2ResultBetter(attempt, bestPolished))
        bestPolished = attempt;
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
  async function generateSchedule2Async(onProgress, options = {}) {
    const eligibleReqs = state.requests.filter(isEligibleRequest2);
    const GREEDY_BASELINE_PROGRESS_SHARE = 0.08;
    const greedyBaseline = await generateCandidatesAsync(
      (p) => {
        if (onProgress) onProgress(p * GREEDY_BASELINE_PROGRESS_SHARE);
      },
      { attempts: options.greedyAttempts }
    );
    const cardProgressShare = 1 - GREEDY_BASELINE_PROGRESS_SHARE;
    const cards = [];
    let targetFloor = null;
    for (let g = 0; g < SCHEDULE2_CARD_COUNT; g++) {
      const groupSeed = 20260823 + g * 104729;
      const groupStart = GREEDY_BASELINE_PROGRESS_SHARE + g / SCHEDULE2_CARD_COUNT * cardProgressShare;
      let card;
      setIdleFirst(g === IDLE_FIRST_CARD_INDEX);
      try {
        card = await runSchedule2RestartGroup(
          eligibleReqs,
          groupSeed,
          g,
          (p) => {
            if (onProgress)
              onProgress(
                groupStart + p / SCHEDULE2_CARD_COUNT * cardProgressShare
              );
          },
          targetFloor
        );
      } finally {
        setIdleFirst(false);
      }
      cards.push(
        card || { result: { assigned: [], unassignedMembers: [] }, pool: [] }
      );
      if (card && card.result && floorIsBetter(card.result, targetFloor))
        targetFloor = card.result;
    }
    for (const idleMode of [false, true]) {
      if (!targetFloor) break;
      setIdleFirst(idleMode);
      try {
        let considerAsCandidate = function(result) {
          if (!result || floorIsBetter(targetFloor, result)) return;
          if (!best || isSchedule2ResultBetter(result, best)) best = result;
        };
        let best = null;
        const externalCandidates = (greedyBaseline.built || []).concat(runtime.candidates || []).concat([].concat(...greedyBaseline.pools || [])).map((cand) => {
          if (!cand || !cand.assigned) return null;
          return {
            assigned: cand.assigned,
            unassignedMembers: cand.unassignedMembers || []
          };
        }).filter(Boolean);
        cards.forEach((c) => considerAsCandidate(c.result));
        externalCandidates.forEach((asResult) => considerAsCandidate(asResult));
        if (best) {
          let addTie = function(result) {
            if (!result) return;
            if (isSchedule2ResultBetter(best, result) || isSchedule2ResultBetter(result, best))
              return;
            const sig = schedule2Signature(result);
            if (seenTieSig.has(sig)) return;
            seenTieSig.add(sig);
            if (bestPool.length < MAX_POOL_VARIANTS)
              bestPool.push(sig === bestSig ? best : result);
          };
          const bestSig = schedule2Signature(best);
          const bestPool = [];
          const seenTieSig = /* @__PURE__ */ new Set();
          addTie(best);
          cards.forEach((c) => {
            addTie(c.result);
            (c.pool || []).forEach(addTie);
          });
          externalCandidates.forEach(addTie);
          for (let g = 0; g < cards.length; g++) {
            const c = cards[g];
            if (g === IDLE_FIRST_CARD_INDEX !== idleMode) continue;
            if (!c.result || floorIsBetter(targetFloor, c.result)) continue;
            if (!isSchedule2ResultBetter(best, c.result)) continue;
            cards[g] = { result: best, pool: bestPool.slice() };
          }
        }
      } finally {
        setIdleFirst(false);
      }
    }
    if (onProgress) onProgress(1);
    return cards;
  }

  // src/engine/scheduleQuality.js
  function byDaySorted(assigned) {
    const byDay = /* @__PURE__ */ new Map();
    assigned.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    byDay.forEach((reqs) => reqs.sort((a, b) => a.startSlot - b.startSlot));
    return byDay;
  }
  function targetMemberIds() {
    const excluded = new Set(currentExcludedIds());
    const submitted = new Set(state.requests.map((r) => r.memberId));
    return state.members.filter((m) => submitted.has(m.id) && !excluded.has(m.id)).map((m) => m.id);
  }
  function scheduleMetrics(result) {
    const assigned = result.assigned;
    const sessionsByMember = /* @__PURE__ */ new Map();
    assigned.forEach(
      (r) => sessionsByMember.set(
        r.memberId,
        (sessionsByMember.get(r.memberId) || 0) + 1
      )
    );
    const targets = targetMemberIds();
    const onceOnly = targets.filter(
      (id) => sessionsByMember.get(id) === 1 && maxSessionsFor(memberById(id)) > 1
    ).length;
    let longestIdleMinutes = 0;
    let spanMinutes = 0;
    let lastEndMinute = 0;
    byDaySorted(assigned).forEach((reqs) => {
      for (let i = 1; i < reqs.length; i++) {
        const prev = reqs[i - 1], cur = reqs[i];
        const gap = (cur.startSlot - prev.startSlot - durationToSlots(prev.duration)) * SLOT_MIN - requiredGapMin(prev.locationId, cur.locationId);
        longestIdleMinutes = Math.max(longestIdleMinutes, gap);
      }
      const first = reqs[0], last = reqs[reqs.length - 1];
      const endMin = last.startSlot * SLOT_MIN + last.duration;
      spanMinutes += endMin - first.startSlot * SLOT_MIN;
      lastEndMinute = Math.max(lastEndMinute, START_MIN + endMin);
    });
    return {
      targetMembers: targets.length,
      assignedMembers: targets.filter((id) => sessionsByMember.has(id)).length,
      unassigned: result.unassignedMembers.length,
      sessions: assigned.length,
      onceOnly,
      travelCount: totalTravelCount(assigned),
      travelMinutes: totalTravelMinutes(assigned),
      inefficientMoves: totalInefficientMoveCount(assigned),
      idleMinutes: schedule2TotalIdleMinutes(assigned),
      longestIdleMinutes,
      workDays: new Set(assigned.map((r) => r.day)).size,
      spanMinutes,
      lastEndMinute
    };
  }
  var HARD_RULES = {
    notRequested: "회원이 신청한 시간에만 배정한다",
    excluded: "제외 회원은 배정하지 않는다",
    location: "허용된 지점에만 배정한다",
    availability: "근무 가능 시간에만 배정한다",
    maxSessions: "최대 수업 횟수를 넘지 않는다",
    sameDay: "같은 회원은 하루 2회 배정되지 않는다",
    gap: "수업끼리 겹치지 않고, 다른 지점 사이에는 이동시간을 확보한다",
    dailyTravel: `하루 이동은 ${MAX_TRAVELS_PER_DAY}회를 넘지 않는다`,
    soloTravel: "세 지점 회원은 이동-회원-이동으로 배정하지 않는다",
    unassigned: "미배정 목록과 실제 배정 상태가 일치한다"
  };
  function scheduleViolations(result) {
    const out = [];
    const add = (rule, detail) => out.push({ rule, message: `${HARD_RULES[rule]} — ${detail}` });
    const requestsById = new Map(state.requests.map((r) => [r.id, r]));
    const excluded = new Set(currentExcludedIds());
    const soloIds = soloTravelMemberIds();
    const sessionsByMember = /* @__PURE__ */ new Map();
    const where = (r) => `${r.memberId}@${r.day}-${r.startSlot}`;
    result.assigned.forEach((r) => {
      sessionsByMember.set(
        r.memberId,
        (sessionsByMember.get(r.memberId) || 0) + 1
      );
      const req = requestsById.get(r.id);
      if (!req || req.memberId !== r.memberId || req.day !== r.day || req.startSlot !== r.startSlot) {
        add("notRequested", where(r));
        return;
      }
      if (excluded.has(r.memberId)) add("excluded", where(r));
      if (!candidateLocationsForRequest(req).includes(r.locationId))
        add("location", `${where(r)} ${r.locationId}`);
      for (let i = 0; i < durationToSlots(r.duration); i++) {
        if (!runtime.availableCells.has(cellKey(r.day, r.startSlot + i))) {
          add("availability", where(r));
          break;
        }
      }
    });
    sessionsByMember.forEach((n, id) => {
      const max = maxSessionsFor(memberById(id));
      if (n > max) add("maxSessions", `${id} ${n}회 > ${max}회`);
    });
    byDaySorted(result.assigned).forEach((reqs, day) => {
      const seen = /* @__PURE__ */ new Set();
      reqs.forEach((r) => {
        if (seen.has(r.memberId)) add("sameDay", where(r));
        seen.add(r.memberId);
      });
      for (let i = 1; i < reqs.length; i++) {
        const prev = reqs[i - 1], cur = reqs[i];
        const gapMin = (cur.startSlot - prev.startSlot - durationToSlots(prev.duration)) * SLOT_MIN;
        if (gapMin < BREAK_MIN || gapMin < travelMinutes(prev.locationId, cur.locationId))
          add("gap", `${where(prev)} → ${where(cur)}`);
      }
      let travels = 0;
      for (let i = 1; i < reqs.length; i++)
        if (travelMinutes(reqs[i - 1].locationId, reqs[i].locationId) > 0)
          travels++;
      if (travels > MAX_TRAVELS_PER_DAY) add("dailyTravel", `${day}요일`);
      for (let i = 1; i + 1 < reqs.length; i++) {
        const r = reqs[i];
        if (soloIds.has(r.memberId) && travelMinutes(reqs[i - 1].locationId, r.locationId) > 0 && travelMinutes(r.locationId, reqs[i + 1].locationId) > 0)
          add("soloTravel", where(r));
      }
    });
    const assignedIds = new Set(sessionsByMember.keys());
    const expectedUnassigned = targetMemberIds().filter((id) => !assignedIds.has(id)).sort();
    const reportedUnassigned = result.unassignedMembers.map((m) => m.id).sort();
    if (expectedUnassigned.join() !== reportedUnassigned.join())
      add(
        "unassigned",
        `실제 [${expectedUnassigned}] / 보고 [${reportedUnassigned}]`
      );
    return out;
  }

  // src/engine/candidateSelection.js
  var QUALITY_AXES = [
    ["unassigned", -1],
    ["sessions", 1],
    ["inefficientMoves", -1],
    ["travelCount", -1],
    ["idleMinutes", -1]
  ];
  var CANDIDATE_ROLES = [
    { role: "sessions", label: "수업 우선", axis: "sessions" },
    { role: "travel", label: "이동 최소", axis: "travelCount" },
    { role: "idle", label: "공강 최소", axis: "idleMinutes" }
  ];
  var MAX_CANDIDATE_CARDS = 3;
  var MAX_CARD_VARIANTS = 3;
  var VARIANT_MIN_PLACEMENT_CHANGES = 1;
  var sessionKey = (r) => `${r.memberId}|${r.day}|${r.startSlot}|${r.locationId}`;
  var placementKey = (r) => `${r.memberId}|${r.day}|${r.locationId}`;
  function layoutSignature(result) {
    return result.assigned.map(sessionKey).sort().join(",");
  }
  function qualityKey(metrics) {
    return QUALITY_AXES.map(([k]) => metrics[k]).join("|");
  }
  function placementChanges(a, b) {
    const inB = new Set(b.assigned.map(placementKey));
    return a.assigned.filter((r) => !inB.has(placementKey(r))).length;
  }
  function dominates(ma, mb) {
    let strictly = false;
    for (const [k, dir] of QUALITY_AXES) {
      const d = (ma[k] - mb[k]) * dir;
      if (d < 0) return false;
      if (d > 0) strictly = true;
    }
    return strictly;
  }
  function tradeoffDeltas(base, b) {
    return QUALITY_AXES.map(([k]) => k).concat("travelMinutes").filter((k) => b[k] !== base[k]).map((k) => ({ key: k, delta: b[k] - base[k] }));
  }
  var DELTA_LABELS = {
    unassigned: ["미배정", "명"],
    sessions: ["수업", ""],
    inefficientMoves: ["비효율 이동", ""],
    travelCount: ["이동", ""],
    idleMinutes: ["빈 시간", "분"],
    travelMinutes: ["이동 시간", "분"]
  };
  function formatTradeoff(deltas) {
    return deltas.map(({ key, delta }) => {
      const [label, unit] = DELTA_LABELS[key];
      return `${label} ${delta > 0 ? "+" : ""}${delta}${unit}`;
    }).join(" / ");
  }
  var better = (a, b) => isSchedule2ResultBetter(a.result, b.result);
  var bestOf = (list) => list.reduce((x, y) => better(y, x) ? y : x);
  function byTravelThenSignature(x, y) {
    return x.metrics.travelMinutes - y.metrics.travelMinutes || (layoutSignature(x.result) < layoutSignature(y.result) ? -1 : 1);
  }
  function pickVariants(group) {
    const kept = [group[0]];
    let rest = group.slice(1);
    const distance = (e) => Math.min(...kept.map((k) => placementChanges(e.result, k.result)));
    let similar = 0;
    for (; ; ) {
      const scored = rest.map((e) => ({ e, d: distance(e) }));
      similar += scored.filter((x) => x.d < VARIANT_MIN_PLACEMENT_CHANGES).length;
      rest = scored.filter((x) => x.d >= VARIANT_MIN_PLACEMENT_CHANGES).map((x) => x.e);
      if (!rest.length || kept.length >= MAX_CARD_VARIANTS) break;
      const far = scored.filter((x) => x.d >= VARIANT_MIN_PLACEMENT_CHANGES).reduce((x, y) => y.d > x.d ? y : x);
      kept.push(far.e);
      rest = rest.filter((e) => e !== far.e);
    }
    return { kept, similar, overLimit: rest.length };
  }
  function selectCandidates(entries) {
    const seen = /* @__PURE__ */ new Set();
    const firstOfSignature = (e) => {
      const sig = layoutSignature(e.result);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    };
    const fixed = entries.filter((e) => e.fixed).filter(firstOfSignature);
    const fixedCount = seen.size;
    const autoEntries = entries.filter((e) => !e.fixed);
    let mergedIntoFixed = 0;
    const unique = autoEntries.filter((e) => {
      const sig = layoutSignature(e.result);
      if (seen.has(sig)) {
        if (fixed.some((f) => layoutSignature(f.result) === sig))
          mergedIntoFixed++;
        return false;
      }
      seen.add(sig);
      return true;
    });
    const groupMap = /* @__PURE__ */ new Map();
    unique.forEach((e) => {
      const k = qualityKey(e.metrics);
      if (!groupMap.has(k)) groupMap.set(k, []);
      groupMap.get(k).push(e);
    });
    const groups = [...groupMap.values()].map((g) => g.sort(byTravelThenSignature)).sort((g, h) => byTravelThenSignature(g[0], h[0]));
    const head = (g) => g[0];
    const rec = groups.length ? bestOf(groups.map(head)) : null;
    const eligible = groups.filter(
      (g) => head(g).metrics.unassigned <= rec.metrics.unassigned
    );
    const gated = groups.filter((g) => !eligible.includes(g));
    const isParetoIn = (g, pool) => !pool.some((h) => dominates(h[0].metrics, g[0].metrics));
    const pareto = eligible.filter((g) => isParetoIn(g, eligible));
    const count = (list) => list.reduce((n, g) => n + g.length, 0);
    let similarRemoved = 0, variantLimitRemoved = 0;
    const variantsOf = /* @__PURE__ */ new Map();
    pareto.forEach((g) => {
      const { kept, similar, overLimit } = pickVariants(g);
      similarRemoved += similar;
      variantLimitRemoved += overLimit;
      variantsOf.set(g, kept);
    });
    const recGroup = pareto.find((g) => head(g) === rec);
    const deltasOf = (m) => rec ? tradeoffDeltas(rec.metrics, m) : [];
    const cardOf = (g, role, label) => ({
      role,
      label,
      metrics: head(g).metrics,
      variants: variantsOf.get(g) || g,
      deltas: deltasOf(head(g).metrics)
    });
    const cards = recGroup ? [cardOf(recGroup, "recommended", "추천")] : [];
    const used = /* @__PURE__ */ new Set([recGroup]);
    const qualifies = (g, axis) => {
      const dir = QUALITY_AXES.find(([k]) => k === axis)[1];
      return (head(g).metrics[axis] - rec.metrics[axis]) * dir > 0;
    };
    CANDIDATE_ROLES.forEach(({ role, label, axis }) => {
      if (cards.length >= MAX_CANDIDATE_CARDS) return;
      const pool = pareto.filter((g2) => !used.has(g2) && qualifies(g2, axis));
      if (!pool.length) return;
      const dir = QUALITY_AXES.find(([k]) => k === axis)[1];
      const bestVal = Math.max(...pool.map((g2) => head(g2).metrics[axis] * dir));
      const pick = bestOf(
        pool.filter((g2) => head(g2).metrics[axis] * dir === bestVal).map(head)
      );
      const g = pool.find((x) => head(x) === pick);
      used.add(g);
      cards.push(cardOf(g, role, label));
    });
    const hiddenOf = (g, reason) => ({
      ...cardOf(g, null, null),
      reason,
      qualifiesFor: CANDIDATE_ROLES.filter(({ axis }) => qualifies(g, axis)).map(
        (r) => r.label
      )
    });
    const hidden = gated.filter((g) => isParetoIn(g, groups)).map((g) => hiddenOf(g, "unassigned-gate")).concat(
      pareto.filter((g) => !used.has(g)).map(
        (g) => hiddenOf(
          g,
          !CANDIDATE_ROLES.some(({ axis }) => qualifies(g, axis)) ? "unlabeled" : cards.length >= MAX_CANDIDATE_CARDS ? "card-limit" : "role-taken"
        )
      )
    );
    fixed.forEach(
      (e) => cards.push({
        role: "edited",
        label: "내가 수정한 후보",
        metrics: e.metrics,
        variants: [e],
        deltas: deltasOf(e.metrics)
      })
    );
    return {
      cards,
      hidden,
      stats: {
        generated: entries.length,
        fixedCards: fixedCount,
        mergedIntoFixed,
        exactUnique: unique.length,
        exactDuplicates: autoEntries.length - unique.length - mergedIntoFixed,
        qualityGroups: groups.length,
        gatedGroups: gated.length,
        gatedLayouts: count(gated),
        paretoGroups: pareto.length,
        dominatedGroups: eligible.length - pareto.length,
        dominatedLayouts: count(eligible.filter((g) => !pareto.includes(g))),
        similarRemoved,
        variantLimitRemoved,
        cardsShown: cards.length
      }
    };
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
    saveState();
    renderRequestList();
    showToast("일정이 추가 되었습니다.", "success");
  });
  function resetAllRequests() {
    if (state.requests.length === 0) return;
    state.requests = [];
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
  function parseHourMarks(s) {
    if (!s.includes(":")) return tokenizeHourDigits(s);
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour < 1 || hour > 12 || minute >= 60 || minute % SLOT_MIN !== 0)
      return null;
    return [{ hour, minute }];
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
  function parseTimeToken(token, single = false) {
    const originalToken = token;
    token = token.replace(/-/g, "~");
    token = token.replace(
      /(\d{1,2})시(\d{1,2})분/g,
      (_, hour, minute) => hour + ":" + minute.padStart(2, "0")
    );
    token = token.replace(/(\d)시/g, "$1");
    if (single && /^\d{3,4}$/.test(token)) {
      const hour = parseInt(token.slice(0, -2), 10);
      const minute = parseInt(token.slice(-2), 10);
      if (hour < 1 || hour > 12 || minute >= 60 || minute % SLOT_MIN !== 0)
        return { error: '시간 해석 실패: "' + originalToken + '"' };
      return { type: "point", marks: [{ hour, minute }] };
    }
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
    const suffixMatch = token.match(/^([\d:]+)(까지|부터|이후)$/);
    if (suffixMatch) {
      const digits = suffixMatch[1];
      token = suffixMatch[2] === "까지" ? "~" + digits : digits + "~";
    }
    const cleanMatch = token.match(/^[\d~:]+/);
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
        const leftMarks = parseHourMarks(leftStr);
        const rightMarks = parseHourMarks(rightStr);
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
        const marks3 = parseHourMarks(leftStr);
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
      const marks2 = parseHourMarks(rightStr);
      if (!marks2 || marks2.length === 0)
        return { error: '구간 표기 해석 실패: "' + originalToken + '"', warning };
      return withLateMark({
        type: "openEnd",
        mark: marks2[0],
        extraPoints: marks2.slice(1),
        warning
      });
    }
    const marks = parseHourMarks(clean);
    if (!marks)
      return { error: '시간 해석 실패: "' + originalToken + '"', warning };
    return withLateMark({ type: "point", marks, warning });
  }
  function parseBulkImportLine(line) {
    const tokens = line.replace(/\//g, ",").replace(/(\d)\s*시\s*(\d{1,2})\s*분/g, "$1시$2분").trim().split(/\s+/).filter(Boolean);
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
    let currentLocationId = null;
    let currentLocationUnknown = false;
    function applyTimeToken(tok, single) {
      if (currentLocationUnknown) return;
      if (!currentDays) {
        result.errors.push(
          '요일 지정 전에 나온 시간 표기라 건너뜁니다: "' + tok + '"'
        );
        return;
      }
      const parsed = parseTimeToken(tok, single);
      if (parsed.warning) result.warnings.push(parsed.warning);
      if (parsed.error) {
        result.errors.push(parsed.error);
        return;
      }
      currentDays.forEach((day) => {
        let dayEntry = result.days.find(
          (d) => d.day === day && d.locationId === currentLocationId
        );
        if (!dayEntry) {
          dayEntry = { day, locationId: currentLocationId, specs: [] };
          result.days.push(dayEntry);
        }
        dayEntry.specs.push(parsed);
      });
    }
    tokens.slice(1).forEach((spaceTok) => {
      const locMatch = spaceTok.match(/^[(（]([^)）]+)[)）]/);
      if (locMatch) {
        const loc = findLocationByLooseName(locMatch[1].trim());
        currentLocationId = loc ? loc.id : null;
        currentLocationUnknown = !loc;
        if (!loc)
          result.errors.push(
            '등록되지 않은 지점이라 그 지점의 시간은 건너뜁니다: "' + locMatch[1] + '"'
          );
        spaceTok = spaceTok.slice(locMatch[0].length);
      }
      const pieces = spaceTok.split(",").filter(Boolean);
      pieces.forEach((piece) => {
        piece.match(/[월화수목금토]+[^월화수목금토]*|[^월화수목금토]+/g).forEach((seg) => {
          let tok = seg;
          const dayPrefixMatch = tok.match(/^[월화수목금토]+/);
          if (dayPrefixMatch) {
            currentDays = parseDayGroupToken(dayPrefixMatch[0]);
            tok = tok.slice(dayPrefixMatch[0].length);
            if (tok === "") return;
          }
          applyTimeToken(tok, pieces.length > 1);
        });
      });
    });
    result.days.sort((a, b) => a.day - b.day);
    return result;
  }
  function findLocationByLooseName(name) {
    const bare = (n) => n.replace(/점$/, "");
    return state.locations.find((l) => l.name === name) || state.locations.find((l) => bare(l.name) === bare(name));
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
    bulkImportStepInputEl.hidden = false;
    bulkImportStepPreviewEl.hidden = true;
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
    bulkImportStepInputEl.hidden = false;
    bulkImportStepPreviewEl.hidden = true;
  });
  function renderBulkImportPreview() {
    const lines = parseBulkImportText(bulkImportTextareaEl.value);
    if (lines.length === 0) {
      alert("붙여넣은 내용이 없습니다.");
      return;
    }
    bulkImportRows = lines.map((parsed) => {
      const matches = findMembersByName(parsed.name);
      const firstLoc = parsed.days.find((d) => d.locationId);
      return {
        parsed,
        choice: matches.length >= 1 ? matches[0].id : "__new__",
        newLocationId: firstLoc ? firstLoc.locationId : state.locations[0] ? state.locations[0].id : "",
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
      select.classList.toggle("is-new-member", select.value === "__new__");
      select.addEventListener("change", () => {
        row.choice = select.value;
        select.classList.toggle("is-new-member", select.value === "__new__");
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
          const loc = locationById(dayEntry.locationId);
          const dayEl = document.createElement("b");
          dayEl.textContent = DAYS[dayEntry.day];
          chip.append(
            dayEl,
            " " + (loc ? "(" + loc.name + ") " : "") + describeDaySpecs(dayEntry.specs)
          );
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
        newFields.hidden = row.choice !== "__new__";
      }
      renderRowState();
      bulkImportPreviewListEl.appendChild(rowEl);
      if (row.choice === "__skip__") willSkip++;
      else if (row.choice === "__new__") willCreate++;
      else willApply++;
    });
    bulkImportPreviewSummaryEl.innerHTML = "기존 회원 적용 " + willApply + "명 · 신규 등록 " + willCreate + "명 · 건너뛰기 " + willSkip + "명<br>적용 대상 회원의 기존 스케줄은 모두 지우고 아래 내용으로 교체합니다.";
    bulkImportStepInputEl.hidden = true;
    bulkImportStepPreviewEl.hidden = false;
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
        const key = dayEntry.day + "|" + (dayEntry.locationId || "");
        if (!entry.days.has(key))
          entry.days.set(key, {
            day: dayEntry.day,
            locationId: dayEntry.locationId,
            specs: []
          });
        entry.days.get(key).specs.push(...dayEntry.specs);
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
      let day, locId;
      function addRange(startSlot, endSlot) {
        addedForMember += addDesiredRange(member, day, startSlot, endSlot, locId);
      }
      function applyMarks(marks) {
        groupConsecutiveMarks(marks).forEach((group) => {
          addRange(
            hourMarkToStartSlot(group[0]),
            hourMarkToStartSlot(group[group.length - 1])
          );
        });
      }
      [...entry.days.values()].sort((a, b) => !!a.locationId - !!b.locationId).forEach((dayEntry) => {
        day = dayEntry.day;
        locId = dayEntry.locationId;
        dayEntry.specs.forEach((spec) => {
          if (spec.type === "point") {
            applyMarks(spec.marks);
          } else if (spec.type === "openStart") {
            applyMarks(spec.extraPoints || []);
            addRange(hourMarkToStartSlot(spec.mark), SLOT_COUNT);
          } else if (spec.type === "openEnd") {
            addRange(0, hourMarkToStartSlot(spec.mark));
            applyMarks(spec.extraPoints || []);
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
        const colorIndex = state.locations.findIndex((l) => l.id === locId);
        if (colorIndex >= 0)
          locBadge.classList.add("location-color-" + colorIndex % 8);
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
      memoInput.classList.add("member-memo-input");
      memoInput.addEventListener("input", () => {
        const lineHeight = 20;
        memoInput.rows = Math.max(1, Math.ceil(memoInput.scrollHeight / lineHeight));
      });
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
    memberBulkImportStepInputEl.hidden = false;
    memberBulkImportStepPreviewEl.hidden = true;
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
    memberBulkImportStepInputEl.hidden = false;
    memberBulkImportStepPreviewEl.hidden = true;
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
      nameInput.className = "bulk-preview-name bulk-preview-name-input";
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
      skipLabel.className = "bulk-preview-skip-label";
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
        label.className = "bulk-preview-location-label";
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
    memberBulkImportStepInputEl.hidden = true;
    memberBulkImportStepPreviewEl.hidden = false;
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
  function addDesiredRange(member, day, startSlot, endSlot, locationId) {
    if (member.locationIds.length === 0) return 0;
    const duration = sessionDurationFor(member);
    const neededSlots = durationToSlots(duration);
    const existingByStart = new Map(
      state.requests.filter((r) => r.memberId === member.id && r.day === day).map((r) => [r.startSlot, r])
    );
    const isBase = locationId && member.locationIds.includes(locationId);
    const maxStart = Math.min(endSlot, SLOT_COUNT - neededSlots);
    let added = 0;
    for (let s = startSlot; s <= maxStart; s++) {
      const existing = existingByStart.get(s);
      if (existing) {
        if (!locationId) continue;
        if (existing.excludedLocationIds)
          existing.excludedLocationIds = existing.excludedLocationIds.filter(
            (id) => id !== locationId
          );
        if (!isBase && !(existing.extraLocationIds || []).includes(locationId))
          existing.extraLocationIds = (existing.extraLocationIds || []).concat(
            locationId
          );
        continue;
      }
      const req = {
        id: uid("r"),
        memberId: member.id,
        day,
        startSlot: s,
        duration
      };
      if (locationId) {
        req.excludedLocationIds = member.locationIds.filter(
          (id) => id !== locationId
        );
        if (!isBase) req.extraLocationIds = [locationId];
      }
      state.requests.push(req);
      added++;
    }
    return added;
  }
  function removeRequests(reqIds) {
    const idSet = new Set(reqIds);
    state.requests = state.requests.filter((r) => !idSet.has(r.id));
    renderRequestList();
    saveState();
  }
  function requestAllowedLocationIds(member, r) {
    const base = member.locationIds || [];
    const excluded = r.excludedLocationIds || [];
    return base.filter((id) => !excluded.includes(id)).concat((r.extraLocationIds || []).filter((id) => !base.includes(id)));
  }
  function mergeRequestRuns(member, reqs) {
    const byDay = /* @__PURE__ */ new Map();
    reqs.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const runs = [];
    byDay.forEach((list, day) => {
      list.sort((a, b) => a.startSlot - b.startSlot);
      const currentByKey = /* @__PURE__ */ new Map();
      let dayRuns = [];
      list.forEach((r) => {
        const rEnd = r.startSlot + durationToSlots(r.duration);
        const allowed = requestAllowedLocationIds(member, r).sort();
        const key = allowed.join(",");
        const current = currentByKey.get(key);
        if (current && r.startSlot <= current.endSlot) {
          current.endSlot = Math.max(current.endSlot, rEnd);
          current.ownReqs.push(r);
        } else {
          const run = { day, endSlot: rEnd, allowed, ownReqs: [r] };
          currentByKey.set(key, run);
          dayRuns.push(run);
        }
      });
      const firstStart = (run) => run.ownReqs[0].startSlot;
      const lastStart = (run) => run.ownReqs[run.ownReqs.length - 1].startSlot;
      dayRuns.forEach((run) => run.sharedReqs = []);
      const folded = /* @__PURE__ */ new Set();
      [...dayRuns].sort((a, b) => b.allowed.length - a.allowed.length).forEach((wide) => {
        const narrows = dayRuns.filter(
          (n) => n.allowed.length < wide.allowed.length && n.allowed.every((id) => wide.allowed.includes(id)) && firstStart(wide) <= lastStart(n) + 1 && lastStart(wide) >= firstStart(n) - 1
        );
        const covered = new Set(narrows.flatMap((n) => n.allowed));
        if (!wide.allowed.every((id) => covered.has(id))) return;
        narrows.forEach(
          (n) => n.sharedReqs.push(...wide.ownReqs, ...wide.sharedReqs)
        );
        folded.add(wide);
      });
      dayRuns = dayRuns.filter((run) => !folded.has(run));
      dayRuns.forEach((run) => {
        run.reqs = run.ownReqs.concat(run.sharedReqs).sort((a, b) => a.startSlot - b.startSlot);
        run.startSlot = run.reqs[0].startSlot;
        run.endSlot = Math.max(
          ...run.reqs.map((r) => r.startSlot + durationToSlots(r.duration))
        );
      });
      dayRuns.sort((a, b) => a.startSlot - b.startSlot);
      let cluster = [];
      let clusterEnd = -1;
      let laneEnds = [];
      const flush = () => cluster.forEach((run) => run.laneCount = laneEnds.length);
      dayRuns.forEach((run) => {
        if (run.startSlot >= clusterEnd) {
          flush();
          cluster = [];
          laneEnds = [];
        }
        let lane = laneEnds.findIndex((end) => end <= run.startSlot);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = run.endSlot;
        run.lane = lane;
        cluster.push(run);
        clusterEnd = Math.max(clusterEnd, run.endSlot);
      });
      flush();
      runs.push(...dayRuns);
    });
    runs.sort((a, b) => a.day - b.day || a.startSlot - b.startSlot);
    return runs;
  }
  function removeRequestRun(member, run) {
    run.sharedReqs.forEach((r) => {
      run.allowed.forEach((id) => {
        if (member.locationIds.includes(id))
          r.excludedLocationIds = (r.excludedLocationIds || []).concat(id);
        else
          r.extraLocationIds = (r.extraLocationIds || []).filter((x) => x !== id);
      });
    });
    removeRequests(run.ownReqs.map((r) => r.id));
  }
  function requestRunExtraLocationIds(run) {
    return run.ownReqs[0].extraLocationIds || [];
  }
  function setRunExtraLocationIds(run, ids) {
    run.ownReqs.forEach((r) => {
      r.extraLocationIds = ids.slice();
    });
  }
  function addExtraLocationToRun(run, locId) {
    const current = requestRunExtraLocationIds(run);
    if (current.includes(locId)) return;
    setRunExtraLocationIds(run, current.concat([locId]));
    saveState();
    renderRequestList();
    showToast("지점이 추가되었습니다", "success");
  }
  function removeExtraLocationFromRun(run, locId) {
    setRunExtraLocationIds(
      run,
      requestRunExtraLocationIds(run).filter((id) => id !== locId)
    );
    saveState();
    renderRequestList();
    showToast("지점이 제거되었습니다", "info");
  }
  function requestRunExcludedLocationIds(run) {
    return run.ownReqs[0].excludedLocationIds || [];
  }
  function setRunExcludedLocationIds(run, ids) {
    run.ownReqs.forEach((r) => {
      r.excludedLocationIds = ids.slice();
    });
  }
  function excludeBaseLocationFromRun(run, locId) {
    const current = requestRunExcludedLocationIds(run);
    if (current.includes(locId)) return;
    setRunExcludedLocationIds(run, current.concat([locId]));
    saveState();
    renderRequestList();
    showToast("지점이 제거되었습니다", "info");
  }
  function restoreBaseLocationToRun(run, locId) {
    setRunExcludedLocationIds(
      run,
      requestRunExcludedLocationIds(run).filter((id) => id !== locId)
    );
    saveState();
    renderRequestList();
    showToast("지점이 복원되었습니다", "success");
  }
  function buildRequestRunMenu(member, run) {
    const excludedBaseIds = requestRunExcludedLocationIds(run);
    const extraIds = requestRunExtraLocationIds(run);
    const excluded = new Set((member.locationIds || []).concat(extraIds));
    const addableLocations = state.locations.filter((l) => !excluded.has(l.id));
    const items = addableLocations.length > 0 ? addableLocations.map((l) => ({
      label: l.name + " 추가",
      onClick: () => addExtraLocationToRun(run, l.id)
    })) : [{ label: "추가할 수 있는 지점이 없습니다", disabled: true }];
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
    const activeBaseIds = (member.locationIds || []).filter(
      (id) => !excludedBaseIds.includes(id)
    );
    const candidateCount = activeBaseIds.length + extraIds.length;
    if (activeBaseIds.length > 0 && candidateCount > 1) {
      items.push({ separator: true });
      activeBaseIds.forEach((id) => {
        const loc = locationById(id);
        if (!loc) return;
        items.push({
          label: loc.name + " 제거",
          danger: true,
          onClick: () => excludeBaseLocationFromRun(run, id)
        });
      });
    }
    if (excludedBaseIds.length > 0) {
      items.push({ separator: true });
      excludedBaseIds.forEach((id) => {
        const loc = locationById(id);
        if (!loc) return;
        items.push({
          label: loc.name + " 복원",
          onClick: () => restoreBaseLocationToRun(run, id)
        });
      });
    }
    items.push({ separator: true });
    items.push({
      label: "가능 시간 삭제",
      danger: true,
      onClick: () => removeRequestRun(member, run)
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
      requestSummaryEl.hidden = false;
      scheduleInteractiveEl.hidden = true;
      return;
    }
    scheduleInteractiveEl.hidden = false;
    const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
    const sortedMembers = state.members.map((member, index) => ({ member, index })).sort((a, b) => {
      const ao = locOrder.has(a.member.locationIds[0]) ? locOrder.get(a.member.locationIds[0]) : Infinity;
      const bo = locOrder.has(b.member.locationIds[0]) ? locOrder.get(b.member.locationIds[0]) : Infinity;
      return ao - bo || b.index - a.index;
    }).map((entry) => entry.member);
    if (!activeScheduleMemberId || !state.members.some((m) => m.id === activeScheduleMemberId)) {
      activeScheduleMemberId = null;
    }
    const activeMember = activeScheduleMemberId ? memberById(activeScheduleMemberId) : null;
    const registeredCount = new Set(state.requests.map((r) => r.memberId)).size;
    requestSummaryEl.textContent = "등록 " + registeredCount + "명 · 미등록 " + (state.members.length - registeredCount) + "명";
    requestSummaryEl.hidden = false;
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
    rangeAddRowEl.hidden = !(activeMember && activeMember.locationIds.length > 0);
    scheduleGridScrollEl.hidden = !activeMember;
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
    const runs = mergeRequestRuns(activeMember, myReqs);
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
        const excludedBaseIds = requestRunExcludedLocationIds(run);
        const memberLocNames = activeMember.locationIds.filter((id) => !excludedBaseIds.includes(id)).map((id) => locationById(id)).filter(Boolean).map((l) => l.name).join(" · ");
        const extraNames = requestRunExtraLocationIds(run).map((id) => locationById(id)).filter(Boolean).map((l) => l.name);
        return {
          day: run.day,
          startSlot: run.startSlot,
          duration: (displayEndSlot - run.startSlot) * SLOT_MIN,
          label: memberLabel,
          loc: memberLocNames && extraNames.length > 0 ? memberLocNames + " +" + extraNames.join(",") : memberLocNames || extraNames.join(","),
          sublabel: slotLabel(run.startSlot) + "~" + minutesLabel(START_MIN + displayEndSlot * SLOT_MIN),
          color,
          lane: run.lane,
          laneCount: run.laneCount,
          onDelete: () => removeRequestRun(activeMember, run),
          contextMenuItems: () => buildRequestRunMenu(activeMember, run)
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
    const soloIds = soloTravelMemberIds();
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
      if (breaksSoloTravel(
        member.id,
        prevAssigned && prevAssigned.locationId,
        req.locationId,
        nextAssigned && nextAssigned.locationId,
        soloIds
      ))
        return;
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
  function planMove(container, req, targetDay, targetStartSlot, ignoreIds) {
    const ignoreSet = /* @__PURE__ */ new Set([req.id, ...ignoreIds || []]);
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
    return { ok: true, newReq, locationId };
  }
  var DAY_CHAIN_VIOLATION_MESSAGES = {
    gap: "수업 시간이 겹치거나 지점 간 이동 시간이 부족합니다",
    dailyTravel: `하루 이동이 최대 ${MAX_TRAVELS_PER_DAY}회를 넘습니다`,
    soloTravel: "세 지점 회원이 이동으로 앞뒤가 막힌 자리에 놓입니다"
  };
  function editedDaysViolation(container, removedIds, placed) {
    const days = new Set(placed.map((p) => p.day));
    container.assigned.forEach((a) => {
      if (removedIds.includes(a.id)) days.add(a.day);
    });
    const soloIds = soloTravelMemberIds();
    for (const day of [...days].sort((x, y) => x - y)) {
      const chain = container.assigned.filter((a) => a.day === day && !removedIds.includes(a.id)).concat(placed.filter((p) => p.day === day)).map((a) => ({
        ...a,
        end: a.startSlot + durationToSlots(a.duration)
      })).sort((x, y) => x.startSlot - y.startSlot);
      const violation = dayChainViolation(chain, soloIds);
      if (violation)
        return DAYS[day] + "요일: " + DAY_CHAIN_VIOLATION_MESSAGES[violation];
    }
    return null;
  }
  function validateMove(container, req, targetDay, targetStartSlot) {
    if (targetDay === req.day && targetStartSlot === req.startSlot) {
      return { ok: true, noop: true, newReq: req, locationId: req.locationId };
    }
    const plan = planMove(container, req, targetDay, targetStartSlot);
    if (!plan.ok) return plan;
    const message = editedDaysViolation(
      container,
      [req.id],
      [
        {
          memberId: req.memberId,
          day: targetDay,
          startSlot: targetStartSlot,
          duration: req.duration,
          locationId: plan.locationId
        }
      ]
    );
    return message ? { ok: false, message } : plan;
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
    const checkA = planMove(container, req, occupying.day, occupying.startSlot, [
      occupying.id
    ]);
    if (!checkA.ok) return { ok: false, message: checkA.message };
    const checkB = planMove(container, occupying, req.day, req.startSlot, [
      req.id
    ]);
    if (!checkB.ok) return { ok: false, message: checkB.message };
    const message = editedDaysViolation(
      container,
      [req.id, occupying.id],
      [
        {
          ...req,
          day: occupying.day,
          startSlot: occupying.startSlot,
          locationId: checkA.locationId
        },
        {
          ...occupying,
          day: req.day,
          startSlot: req.startSlot,
          locationId: checkB.locationId
        }
      ]
    );
    if (message) return { ok: false, message };
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
    if (pageId === "schedule3") dropStaleCandidates();
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
  async function generateSchedule3Async(onProgress) {
    const excludedIds3 = state.excludedMemberIds3;
    const onceLimitIds3 = state.onceLimitedMemberIds3;
    const v1Built = await withSelectionOverride(
      excludedIds3,
      onceLimitIds3,
      () => generateCandidatesAsync(
        (progress) => onProgress(progress * 0.5, "후보 탐색")
      )
    );
    const v2Result = await withSelectionOverride(
      excludedIds3,
      onceLimitIds3,
      () => generateSchedule2Async(
        (progress) => onProgress(0.5 + progress * 0.5, "비교·최적화")
      )
    );
    onProgress(1, "후보 정리");
    return {
      candidateB: v1Built.built[0] || null,
      // 그리디 전략 0(인원 최대)
      candidateC: v1Built.built[1] || null,
      // 그리디 전략 1(수업 횟수 최대)
      poolsBC: v1Built.pools,
      // strategyIndex -> 동점 풀
      candidateAList: v2Result.map((c) => c.result),
      // 체인 DP 탐색 그룹 3개
      candidateAPools: v2Result.map((c) => c.pool)
      // 그룹 인덱스 -> 동점 풀
    };
  }
  var generateHint3El = document.getElementById("generateHint3");
  var candidates3El = document.getElementById("candidates3");
  var generateBtn3El = document.getElementById("generateBtn3");
  var generateBtn3LabelEl = document.getElementById("generateBtn3Label");
  var generateBtn3CancelEl = document.getElementById("generateBtn3Cancel");
  var generateProgressWrap3El = document.getElementById(
    "generateProgressWrap3"
  );
  var generateProgressFill3El = document.getElementById(
    "generateProgressFill3"
  );
  var generateProgressText3El = document.getElementById(
    "generateProgressText3"
  );
  var GENERATE3_IDLE_LABEL = "수업 스케줄 후보 생성";
  function isUserEdited(result) {
    return !!result && Array.isArray(result.confirmedIds) && result.confirmedIds.length > 0;
  }
  function dropStaleCandidates() {
    const slots = runtime.schedule3Result.candidateAList.concat(runtime.candidates).filter(Boolean);
    if (slots.length === 0) return false;
    const key = candidateInputKey();
    const saved = runtime.schedule3Result.inputKey;
    if (saved === key) return false;
    if (saved === void 0 && slots.every((r) => scheduleViolations(r).length === 0)) {
      runtime.schedule3Result.inputKey = key;
      saveState();
      return false;
    }
    clearRuntimeScheduleCandidates();
    resetCandidateSession();
    renderSchedule3Result();
    saveState();
    generateHint3El.textContent = "회원·신청·설정이 변경되어 기존 후보(내가 수정한 후보 포함)가 초기화되었습니다. 후보를 다시 생성해주세요.";
    return true;
  }
  function keepsUserEditedSlot(prev) {
    return isUserEdited(prev);
  }
  function candidatePoolEntries() {
    const slots = [];
    runtime.schedule3Result.candidateAList.forEach(
      (result, i) => slots.push({
        key: "A" + (i + 1),
        result,
        pool: candidateAPools[i],
        store: (r) => runtime.schedule3Result.candidateAList[i] = r
      })
    );
    runtime.candidates.forEach(
      (result, i) => slots.push({
        key: i === 0 ? "B" : "C",
        result,
        pool: candidatePools[i],
        store: (r) => runtime.candidates[i] = r
      })
    );
    const entries = [];
    slots.forEach((slot) => {
      if (!slot.result) return;
      const fixed = isUserEdited(slot.result);
      const layouts = [slot.result].concat(
        fixed ? [] : (slot.pool || []).filter((r) => r !== slot.result)
      );
      layouts.forEach(
        (result, i) => entries.push({
          key: i ? slot.key + "#" + i : slot.key,
          result,
          metrics: scheduleMetrics(result),
          fixed,
          slot
        })
      );
    });
    return entries;
  }
  var shownVariantByCard = /* @__PURE__ */ new Map();
  var CARD_DESC = {
    recommended: "미배정 → 비효율 이동 → 수업·이동·빈 시간 균형(수업 1건 = 이동 1번 = 빈 시간 60분) 순으로 가장 나은 후보입니다.",
    edited: "직접 옮기거나 확정한 후보입니다. 다시 생성해도 지워지지 않습니다."
  };
  function renderSchedule3Result() {
    candidates3El.innerHTML = "";
    const gridRange = businessHoursGridRange();
    const { cards } = selectCandidates(candidatePoolEntries());
    if (cards.length === 0) {
      const card = document.createElement("div");
      card.className = "candidate-card candidate-card-placeholder";
      const hint = document.createElement("p");
      hint.className = "candidate-card-placeholder-hint";
      hint.textContent = "아직 후보가 없습니다. '" + GENERATE3_IDLE_LABEL + "'을 눌러주세요.";
      card.appendChild(hint);
      candidates3El.appendChild(card);
      return;
    }
    let promoted = false;
    cards.forEach((c) => {
      const cardKey = c.role === "edited" ? "edited:" + layoutSignature(c.variants[0].result) : qualityKey(c.metrics);
      const shownSig = shownVariantByCard.get(cardKey);
      const idx = Math.max(
        0,
        c.variants.findIndex((v) => layoutSignature(v.result) === shownSig)
      );
      const entry = c.variants[idx];
      if (entry.slot.result !== entry.result) {
        entry.slot.store(entry.result);
        entry.slot.result = entry.result;
        promoted = true;
      }
      buildCard(c, entry.result, idx, (newIdx) => {
        shownVariantByCard.set(
          cardKey,
          layoutSignature(c.variants[newIdx].result)
        );
        renderSchedule3Result();
      });
    });
    if (promoted) saveState();
    if (cards.filter((c) => c.role !== "edited").length === 1) {
      const note = document.createElement("p");
      note.className = "pool-pager-hint candidates-note";
      note.textContent = "장단점이 다른 후보가 없어 추천 후보만 보여줍니다.";
      candidates3El.appendChild(note);
    }
    function buildCard(c, result, variantIdx, onSelectVariant) {
      const title = c.label;
      const desc = c.role === "recommended" ? CARD_DESC.recommended : c.role === "edited" ? CARD_DESC.edited + (c.deltas.length ? " 추천 대비 " + formatTradeoff(c.deltas) : "") : "추천 대비 " + formatTradeoff(c.deltas);
      const blocks = schedule2ToBlocks(result.assigned, {
        result,
        onDone: renderSchedule3Result
      });
      const travelBlocks = schedule2ToTravelBlocks(
        result,
        renderSchedule3Result
      ).concat(schedule2ToIdleBlocks(result.assigned));
      const idleMinutes = schedule2TotalIdleMinutes(result.assigned);
      const card = document.createElement("div");
      card.className = "candidate-card";
      const head = document.createElement("div");
      head.className = "candidate-card-head";
      const titleEl = document.createElement("h3");
      titleEl.className = "candidate-title";
      titleEl.textContent = title;
      head.appendChild(titleEl);
      const actions = document.createElement("div");
      actions.className = "candidate-card-actions";
      function makeIconBtn(iconSvg, label, tooltip) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-ghost icon-btn regen-candidate-btn";
        b.setAttribute("aria-label", label);
        b.title = tooltip;
        b.innerHTML = iconSvg;
        return b;
      }
      const undoManualBtn = makeIconBtn(
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
        "편집 취소",
        "방금 드래그로 옮기거나 맞바꾸거나 교체·확정한 것을 취소합니다."
      );
      undoManualBtn.disabled = !hasManualUndo(result);
      undoManualBtn.addEventListener("click", () => {
        undoManualEdit(result, renderSchedule3Result);
      });
      actions.appendChild(undoManualBtn);
      const divider = document.createElement("span");
      divider.className = "action-divider";
      actions.appendChild(divider);
      const saveImageBtn = makeIconBtn(
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
        "이미지로 저장",
        "이 후보 카드를 이미지로 저장합니다."
      );
      saveImageBtn.addEventListener("click", () => {
        saveCandidateCardAsImage(card, title);
      });
      actions.appendChild(saveImageBtn);
      head.appendChild(actions);
      card.appendChild(head);
      const descEl = document.createElement("p");
      descEl.className = "candidate-desc";
      descEl.textContent = desc;
      card.appendChild(descEl);
      if (c.variants.length > 1) {
        const pager = document.createElement("div");
        pager.className = "candidate-pool-pager";
        const pagerBtn = (label2, points, disabled, newIdx) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn btn-ghost icon-btn pool-pager-btn";
          b.setAttribute("aria-label", label2);
          b.title = "같은 품질의 다른 배치를 봅니다.";
          b.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="' + points + '"/></svg>';
          b.disabled = disabled;
          b.addEventListener("click", () => onSelectVariant(newIdx));
          return b;
        };
        const label = document.createElement("span");
        label.className = "pool-pager-label";
        label.textContent = "배치 " + (variantIdx + 1) + "/" + c.variants.length;
        pager.append(
          pagerBtn(
            "이전 배치",
            "15 18 9 12 15 6",
            variantIdx === 0,
            variantIdx - 1
          ),
          label,
          pagerBtn(
            "다음 배치",
            "9 18 15 12 9 6",
            variantIdx === c.variants.length - 1,
            variantIdx + 1
          )
        );
        card.appendChild(pager);
        const pagerHint = document.createElement("p");
        pagerHint.className = "pool-pager-hint";
        pagerHint.textContent = "새로고침하면 이 목록은 사라질 수 있어요.";
        card.appendChild(pagerHint);
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
      const ineffCount = totalInefficientMoveCount(result.assigned);
      const pillIneff = document.createElement("span");
      pillIneff.className = ineffCount > 0 ? "stat-pill stat-pill-danger" : "stat-pill";
      pillIneff.textContent = "비효율 이동 " + ineffCount + "번";
      stats.appendChild(pillIneff);
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
        const title2 = document.createElement("b");
        title2.textContent = "미배정 회원 (" + result.unassignedMembers.length + "명)";
        box.append(
          title2,
          " · ",
          result.unassignedMembers.map((m) => m.name).join(", ")
        );
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
        (a, b) => a.member.name.localeCompare(b.member.name, "ko")
      );
      if (doubleAssignedMembers.length > 0) {
        const box = document.createElement("div");
        box.className = "unassigned-box double-assigned-box";
        const title2 = document.createElement("b");
        title2.textContent = "2회 배정 회원 (" + doubleAssignedMembers.length + "명)";
        box.append(
          title2,
          " · ",
          doubleAssignedMembers.map((d) => d.locLabel + " " + d.member.name).join(", ")
        );
        card.appendChild(box);
      }
      candidates3El.appendChild(card);
    }
  }
  async function runGenerate3() {
    if (runtime.generationInProgress) {
      showToast("후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.", "info");
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
    dropStaleCandidates();
    generateHint3El.textContent = "";
    runtime.generationInProgress = true;
    runtime.generationCancelRequested = false;
    const inputKey = candidateInputKey();
    const prevCandidateAList = runtime.schedule3Result.candidateAList;
    const prevCandidates = runtime.candidates;
    generateBtn3El.disabled = true;
    generateBtn3El.classList.add("loading");
    generateBtn3LabelEl.textContent = "후보 생성 중...";
    generateProgressWrap3El.hidden = false;
    generateProgressFill3El.className = "generate-progress-fill progress-pct-0";
    generateProgressText3El.textContent = "후보 탐색 0%";
    generateProgressWrap3El.setAttribute("aria-valuenow", "0");
    generateBtn3CancelEl.hidden = false;
    generateBtn3CancelEl.disabled = false;
    generateBtn3CancelEl.textContent = "생성 취소";
    await acquireWakeLock();
    try {
      let pickCandidateASlot = function(prev, freshResult, freshPool) {
        const pool = (freshPool || []).slice();
        if (!prev || isSchedule2ResultBetter(freshResult, prev)) {
          if (!pool.includes(freshResult)) {
            if (pool.length >= MAX_POOL_VARIANTS)
              pool.length = MAX_POOL_VARIANTS - 1;
            pool.unshift(freshResult);
          }
          return { candidate: freshResult, pool };
        }
        if (!isSchedule2ResultBetter(prev, freshResult)) {
          const prevSig = schedule2Signature(prev);
          const tiedPool = pool.map(
            (c) => schedule2Signature(c) === prevSig ? prev : c
          );
          if (!tiedPool.includes(prev)) {
            tiedPool.unshift(prev);
            if (tiedPool.length > MAX_POOL_VARIANTS)
              tiedPool.length = MAX_POOL_VARIANTS;
          }
          return { candidate: prev, pool: tiedPool };
        }
        return { candidate: prev, pool: null };
      };
      const result = await generateSchedule3Async((progress, phase) => {
        const pct = Math.round(progress * 100);
        generateProgressFill3El.className = "generate-progress-fill progress-pct-" + pct;
        generateProgressText3El.textContent = phase + " " + pct + "%";
        generateProgressWrap3El.setAttribute("aria-valuenow", String(pct));
      });
      const candidateAList = [];
      for (let i = 0; i < SCHEDULE2_CARD_COUNT; i++) {
        const prev = prevCandidateAList[i] || null;
        const fresh = result.candidateAList[i] || null;
        if (!fresh || keepsUserEditedSlot(prev)) {
          candidateAList.push(prev);
          continue;
        }
        setIdleFirst(i === IDLE_FIRST_CARD_INDEX);
        let picked;
        try {
          picked = pickCandidateASlot(prev, fresh, result.candidateAPools[i]);
        } finally {
          setIdleFirst(false);
        }
        candidateAList.push(picked.candidate);
        if (picked.pool !== null) candidateAPools[i] = picked.pool;
      }
      const freshBC = [result.candidateB, result.candidateC];
      const slotsBC = freshBC.map((fresh, idx) => {
        const prev = prevCandidates[idx] || null;
        if (keepsUserEditedSlot(prev)) return { candidate: prev, pool: null };
        return { candidate: fresh, pool: result.poolsBC[idx] || [] };
      });
      const keptBC = slotsBC.filter((s) => s.candidate);
      Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
      keptBC.forEach((s, idx) => {
        if (s.pool) candidatePools[idx] = s.pool;
      });
      runtime.candidates = keptBC.map((s) => s.candidate);
      runtime.schedule3Result = { candidateAList, inputKey };
      if (dropStaleCandidates()) return;
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
      generateBtn3El.disabled = false;
      generateBtn3El.classList.remove("loading");
      generateBtn3LabelEl.textContent = GENERATE3_IDLE_LABEL;
      generateProgressWrap3El.hidden = true;
      generateBtn3CancelEl.hidden = true;
      runtime.generationInProgress = false;
      runtime.generationCancelRequested = false;
      releaseWakeLock();
    }
  }
  generateBtn3El.addEventListener("click", () => runGenerate3());
  generateBtn3CancelEl.addEventListener("click", () => {
    runtime.generationCancelRequested = true;
    generateBtn3CancelEl.disabled = true;
    generateBtn3CancelEl.textContent = "취소하는 중...";
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
      if (Array.isArray(r.excludedLocationIds) && r.excludedLocationIds.includes(loc.id)) {
        r.excludedLocationIds = r.excludedLocationIds.filter(
          (id) => id !== loc.id
        );
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
      travelTitleEl.hidden = true;
      return;
    }
    travelTitleEl.hidden = false;
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
  var LEGACY_BACKUP_PBKDF2_ITERATIONS = 1e5;
  var BACKUP_PBKDF2_ITERATIONS = 6e5;
  var BACKUP_VERSION = 2;
  var BACKUP_PREFIX = "PTB2.";
  var BACKUP_PASSWORD_MIN_LENGTH = 12;
  var RESTORE_RECOVERY_KEY = "pt_schedule_restore_recovery_v1";
  function isValidBackupPassword(password) {
    return typeof password === "string" && password.length >= BACKUP_PASSWORD_MIN_LENGTH;
  }
  async function deriveBackupKey(pin, salt, usage, iterations = BACKUP_PBKDF2_ITERATIONS) {
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
        iterations,
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
  function textToBase64(text) {
    return backupBytesToBase64(new TextEncoder().encode(text));
  }
  function base64ToText(base64) {
    return new TextDecoder().decode(backupBase64ToBytes(base64));
  }
  function backupEnvelopeAdditionalData(envelope) {
    return new TextEncoder().encode(
      JSON.stringify({
        backupVersion: envelope.backupVersion,
        kdf: envelope.kdf,
        cipher: envelope.cipher
      })
    );
  }
  function parseBackupEnvelope(code) {
    const trimmed = code.trim();
    if (!trimmed.startsWith(BACKUP_PREFIX)) return null;
    const envelope = JSON.parse(base64ToText(trimmed.slice(BACKUP_PREFIX.length)));
    if (!isPlainObject(envelope) || envelope.backupVersion !== BACKUP_VERSION || !isPlainObject(envelope.kdf) || envelope.kdf.name !== "PBKDF2" || envelope.kdf.hash !== "SHA-256" || !Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < 1e5 || typeof envelope.kdf.salt !== "string" || !isPlainObject(envelope.cipher) || envelope.cipher.name !== "AES-GCM" || envelope.cipher.keyLength !== 256 || typeof envelope.cipher.iv !== "string" || typeof envelope.ciphertext !== "string")
      throw new Error("invalid backup envelope");
    return envelope;
  }
  async function encryptBackupText(plainText, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const envelope = {
      backupVersion: BACKUP_VERSION,
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: BACKUP_PBKDF2_ITERATIONS,
        salt: backupBytesToBase64(salt)
      },
      cipher: {
        name: "AES-GCM",
        keyLength: 256,
        iv: backupBytesToBase64(iv)
      },
      ciphertext: ""
    };
    const key = await deriveBackupKey(
      pin,
      salt,
      "encrypt",
      envelope.kdf.iterations
    );
    const cipherBuf = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: backupEnvelopeAdditionalData(envelope)
      },
      key,
      new TextEncoder().encode(plainText)
    );
    envelope.ciphertext = backupBytesToBase64(new Uint8Array(cipherBuf));
    return BACKUP_PREFIX + textToBase64(JSON.stringify(envelope));
  }
  async function decryptLegacyBackupText(base64Text, pin) {
    const combined = backupBase64ToBytes(base64Text.trim());
    if (combined.length <= 28) throw new Error("invalid legacy backup code");
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const cipherBytes = combined.slice(28);
    const key = await deriveBackupKey(
      pin,
      salt,
      "decrypt",
      LEGACY_BACKUP_PBKDF2_ITERATIONS
    );
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBytes
    );
    return new TextDecoder().decode(plainBuf);
  }
  async function decryptBackupText(code, pin) {
    const envelope = parseBackupEnvelope(code);
    if (!envelope) return decryptLegacyBackupText(code, pin);
    const salt = backupBase64ToBytes(envelope.kdf.salt);
    const iv = backupBase64ToBytes(envelope.cipher.iv);
    if (salt.length !== 16 || iv.length !== 12)
      throw new Error("invalid backup envelope parameters");
    const key = await deriveBackupKey(
      pin,
      salt,
      "decrypt",
      envelope.kdf.iterations
    );
    const plainBuf = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: backupEnvelopeAdditionalData(envelope)
      },
      key,
      backupBase64ToBytes(envelope.ciphertext)
    );
    return new TextDecoder().decode(plainBuf);
  }
  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function assertArrayField(data, key) {
    if (data[key] !== void 0 && !Array.isArray(data[key]))
      throw new Error(key + " must be an array");
  }
  function assertOptionalStringArray(value, label) {
    if (value === void 0) return;
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string"))
      throw new Error(label + " must be a string array");
  }
  function validateBackupState(data) {
    if (!isPlainObject(data)) throw new Error("backup root must be an object");
    if (data.schemaVersion !== void 0 && (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 0 || data.schemaVersion > CURRENT_SCHEMA_VERSION))
      throw new Error("unsupported schema version");
    ["locations", "members", "requests", "availableCells", "candidates"].forEach(
      (key) => assertArrayField(data, key)
    );
    if (data.travelTimes !== void 0 && !isPlainObject(data.travelTimes))
      throw new Error("travelTimes must be an object");
    if (data.schedule3Result !== void 0 && !isPlainObject(data.schedule3Result))
      throw new Error("schedule3Result must be an object");
    assertOptionalStringArray(
      data.onceLimitedMemberIds3,
      "onceLimitedMemberIds3"
    );
    assertOptionalStringArray(data.excludedMemberIds3, "excludedMemberIds3");
    const locations = data.locations || [];
    const members = data.members || [];
    const requests = data.requests || [];
    const locationIds = /* @__PURE__ */ new Set();
    locations.forEach((loc, i) => {
      if (!isPlainObject(loc) || typeof loc.id !== "string" || !loc.id || typeof loc.name !== "string" || !loc.name)
        throw new Error("invalid location at index " + i);
      if (locationIds.has(loc.id)) throw new Error("duplicate location id");
      locationIds.add(loc.id);
    });
    const memberIds = /* @__PURE__ */ new Set();
    members.forEach((member, i) => {
      if (!isPlainObject(member) || typeof member.id !== "string" || !member.id || typeof member.name !== "string")
        throw new Error("invalid member at index " + i);
      if (memberIds.has(member.id)) throw new Error("duplicate member id");
      memberIds.add(member.id);
      if (member.locationIds !== void 0) {
        assertOptionalStringArray(member.locationIds, "member.locationIds");
        if (member.locationIds.some((id) => !locationIds.has(id)))
          throw new Error("member references unknown location");
      } else if (member.locationId !== void 0 && (typeof member.locationId !== "string" || !locationIds.has(member.locationId))) {
        throw new Error("member references unknown legacy location");
      }
      if (member.memo !== void 0 && typeof member.memo !== "string")
        throw new Error("member.memo must be a string");
    });
    const requestIds = /* @__PURE__ */ new Set();
    requests.forEach((req, i) => {
      if (!isPlainObject(req) || typeof req.id !== "string" || !req.id || typeof req.memberId !== "string" || !memberIds.has(req.memberId) || !Number.isInteger(req.day) || req.day < 0 || req.day >= 7 || !Number.isInteger(req.startSlot) || req.startSlot < 0 || typeof req.duration !== "number" || !Number.isFinite(req.duration) || req.duration <= 0)
        throw new Error("invalid request at index " + i);
      if (requestIds.has(req.id)) throw new Error("duplicate request id");
      requestIds.add(req.id);
      assertOptionalStringArray(
        req.extraLocationIds,
        "request.extraLocationIds"
      );
      assertOptionalStringArray(
        req.excludedLocationIds,
        "request.excludedLocationIds"
      );
      for (const id of (req.extraLocationIds || []).concat(
        req.excludedLocationIds || []
      )) {
        if (!locationIds.has(id))
          throw new Error("request references unknown location");
      }
    });
    (data.availableCells || []).forEach((key) => {
      if (typeof key !== "string" || !/^\d+-\d+$/.test(key))
        throw new Error("invalid available cell");
      const [day, slot] = key.split("-").map(Number);
      if (!Number.isInteger(day) || day < 0 || day >= 7 || !Number.isInteger(slot) || slot < 0)
        throw new Error("invalid available cell range");
    });
    Object.entries(data.travelTimes || {}).forEach(([key, value]) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
        throw new Error("invalid travel time");
      const ids = key.split("|");
      if (ids.length !== 2 || !locationIds.has(ids[0]) || !locationIds.has(ids[1]))
        throw new Error("travel time references unknown location");
    });
    return data;
  }
  function parseAndValidateBackupText(plainText) {
    return validateBackupState(JSON.parse(plainText));
  }
  function createPortableBackupState(data) {
    const validated = validateBackupState(data);
    const portable = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      locations: validated.locations || [],
      travelTimes: validated.travelTimes || {},
      members: validated.members || [],
      requests: validated.requests || [],
      availableCells: validated.availableCells || [],
      onceLimitedMemberIds3: validated.onceLimitedMemberIds3 || [],
      excludedMemberIds3: validated.excludedMemberIds3 || [],
      startMinBase: validated.startMinBase
    };
    if (portable.startMinBase === void 0) delete portable.startMinBase;
    return portable;
  }
  function prepareBackupStateForRestore(data) {
    const validated = validateBackupState(data);
    const restored = {
      ...validated,
      schemaVersion: validated.schemaVersion === void 0 ? 0 : validated.schemaVersion,
      // 후보A/B/C와 페이지 위치는 원본 데이터에서 다시 만들 수 있는 파생/세션 상태다.
      // 오래된 후보가 새 코드에서 stale하게 살아나는 일을 막기 위해 복원 시 항상 버린다.
      candidates: [],
      schedule3Result: { candidateAList: [null, null, null] }
    };
    delete restored.currentPage;
    delete restored.currentStep;
    return restored;
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
    const password = window.prompt(
      "백업 비밀번호를 입력하세요. 복원할 때 동일한 비밀번호가 필요합니다.\n12자 이상의 긴 비밀번호를 권장합니다."
    );
    if (!password) return;
    if (!isValidBackupPassword(password)) {
      alert("새 백업 비밀번호는 12자 이상으로 입력해주세요.");
      return;
    }
    const passwordConfirm = window.prompt("백업 비밀번호를 한 번 더 입력해주세요.");
    if (passwordConfirm !== password) {
      alert(
        "입력한 백업 비밀번호가 서로 달라 백업 코드를 만들지 못했습니다. 다시 시도해주세요."
      );
      return;
    }
    if (!saveState()) {
      alert(
        "최신 데이터를 브라우저에 저장하지 못해 백업 코드를 만들지 않았습니다. 저장 오류를 먼저 해결해주세요."
      );
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const portable = createPortableBackupState(saved);
      const backupCode = await encryptBackupText(
        JSON.stringify(portable),
        password
      );
      backupExportTextareaEl.value = backupCode;
      backupExportResultEl.hidden = false;
      showToast("백업 코드를 만들었습니다. 백업 비밀번호도 함께 기억해주세요.", "success");
    } catch (e) {
      console.warn("backup export failed", e);
      alert("백업 코드를 만들지 못했습니다.");
    }
  });
  backupExportCopyBtnEl.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(backupExportTextareaEl.value);
      showToast("백업 코드를 복사했습니다", "success");
    } catch {
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
    const password = backupImportPinInputEl.value;
    if (!code || !password) {
      backupImportHintEl.textContent = "백업 코드와 백업 비밀번호를 모두 입력해주세요.";
      return;
    }
    let parsedBackup;
    try {
      const plainText = await decryptBackupText(code, password);
      parsedBackup = prepareBackupStateForRestore(
        parseAndValidateBackupText(plainText)
      );
    } catch (e) {
      console.warn("backup import validation failed", e);
      backupImportHintEl.textContent = "복원에 실패했습니다. 백업 코드가 손상되었거나 현재 데이터 형식과 맞지 않습니다.";
      return;
    }
    if (!confirm("복원하면 이 기기에 현재 저장된 데이터를 덮어씁니다. 계속할까요?"))
      return;
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    try {
      window.sessionStorage.setItem(
        RESTORE_RECOVERY_KEY,
        JSON.stringify({
          createdAt: Date.now(),
          state: currentRaw
        })
      );
    } catch (e) {
      console.warn("restore recovery snapshot failed", e);
      backupImportHintEl.textContent = "복원 전 안전 복구 데이터를 저장하지 못해 복원을 진행하지 않았습니다.";
      return;
    }
    runtime.suppressAutosave = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedBackup));
    } catch (e) {
      runtime.suppressAutosave = false;
      console.warn("backup import save failed", e);
      backupImportHintEl.textContent = "복원 데이터를 저장하지 못했습니다. 현재 데이터는 그대로 유지됩니다.";
      return;
    }
    location.reload();
  });
  function readRestoreRecoverySnapshot(storage = typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : null) {
    if (!storage) return null;
    const raw = storage.getItem(RESTORE_RECOVERY_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || parsed.state !== null && typeof parsed.state !== "string")
        return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function restoreRecoverySnapshot(storage = typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : null, targetStorage = typeof localStorage !== "undefined" ? localStorage : null) {
    if (!storage || !targetStorage) return false;
    const snapshot = readRestoreRecoverySnapshot(storage);
    if (!snapshot) return false;
    if (snapshot.state === null) targetStorage.removeItem(STORAGE_KEY);
    else targetStorage.setItem(STORAGE_KEY, snapshot.state);
    storage.removeItem(RESTORE_RECOVERY_KEY);
    return true;
  }
  function renderRestoreRecoveryBanner() {
    const host = document.querySelector(".settings-section--backup");
    if (!host) return;
    const snapshot = readRestoreRecoverySnapshot();
    if (!snapshot) return;
    const banner = document.createElement("div");
    banner.className = "restore-recovery-banner";
    const text = document.createElement("p");
    text.textContent = "백업을 복원했습니다. 문제가 있다면 이 탭을 닫기 전에 복원 전 데이터로 되돌릴 수 있습니다.";
    banner.appendChild(text);
    const actions = document.createElement("div");
    actions.className = "restore-recovery-actions";
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "btn btn-ghost";
    undoBtn.textContent = "복원 전 데이터로 되돌리기";
    undoBtn.addEventListener("click", () => {
      if (!confirm("복원 전 데이터로 되돌릴까요? 현재 복원된 데이터는 덮어써집니다."))
        return;
      try {
        runtime.suppressAutosave = true;
        if (!restoreRecoverySnapshot()) throw new Error("snapshot missing");
        location.reload();
      } catch (e) {
        runtime.suppressAutosave = false;
        console.warn("restore recovery failed", e);
        showToast("복원 전 데이터로 되돌리지 못했습니다.", "error");
      }
    });
    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "btn btn-ghost";
    dismissBtn.textContent = "복구 지점 삭제";
    dismissBtn.addEventListener("click", () => {
      if (typeof window !== "undefined" && window.sessionStorage)
        window.sessionStorage.removeItem(RESTORE_RECOVERY_KEY);
      banner.remove();
    });
    actions.append(undoBtn, dismissBtn);
    banner.appendChild(actions);
    host.appendChild(banner);
  }
  renderRestoreRecoveryBanner();

  // src/main.js
  var storageErrorBannerEl = document.getElementById("storageErrorBanner");
  function renderStorageStatus() {
    if (!storageErrorBannerEl) return;
    storageErrorBannerEl.hidden = !runtime.storageError;
  }
  window.addEventListener("pt-storage-status", renderStorageStatus);
  function init() {
    loadState();
    renderLocationList();
    renderTravelMatrix();
    populateMemberLocationSelect();
    renderMemberTable();
    renderAvailabilityList();
    renderRequestList();
    dropStaleCandidates();
    renderSchedule3Result();
    goToPage(runtime.currentPage);
    renderStorageStatus();
  }
  init();
})();
