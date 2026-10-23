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
  var STORAGE_KEY = "pt_schedule_state_v5";
  var PREVIOUS_STORAGE_KEY = "pt_schedule_state_v4";
  var LEGACY_STORAGE_KEY = "pt_schedule_state_v3";
  var OLD_STORAGE_KEY = "pt_schedule_state_v2";
  var OLD_SLOT_MIN = 30;
  var SLOT_SCALE = OLD_SLOT_MIN / SLOT_MIN;
  var DEFAULT_LOCATION_NAMES = ["여의도점", "상암점", "마포점"];
  var LOCATION_PALETTE = [
    { name: "민트", color: "#50d2c2" },
    { name: "보라", color: "#8c88ff" },
    { name: "파랑", color: "#5da7ff" },
    { name: "코랄", color: "#e69a8d" },
    { name: "웜 옐로우", color: "#d8b36a" },
    { name: "세이지 그린", color: "#8db58a" }
  ];
  var DEFAULT_LOCATION_COLORS = {
    여의도점: "#50d2c2",
    상암점: "#8c88ff",
    마포점: "#5da7ff"
  };
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
  function withSelectionOverrideSync(excludedIds, onceLimitIds, fn) {
    const prev = selectionOverride;
    selectionOverride = {
      excludedIds: excludedIds.slice(),
      onceLimitIds: onceLimitIds.slice()
    };
    try {
      const out = fn();
      if (out && typeof out.then === "function")
        throw new Error("withSelectionOverrideSync는 동기 함수만 감쌀 수 있습니다");
      return out;
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
  function isAdjacentDay(day, days) {
    for (const d of days) {
      if (Math.abs(d - day) === 1) return true;
    }
    return false;
  }
  function memberDayViolation(memberId, day, otherDays) {
    for (const d of otherDays) if (d === day) return "sameDay";
    if (isAdjacentDay(day, otherDays) && (state.noConsecutiveDayMemberIds || []).includes(memberId))
      return "consecutiveDay";
    return null;
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
  function locationColorIndex(locId) {
    const loc = locationById(locId);
    return loc ? LOCATION_PALETTE.findIndex((p) => p.color === loc.color) : -1;
  }
  function locationColorClass(locId) {
    const idx = locationColorIndex(locId);
    return idx === -1 ? "location-color-fallback" : "location-color-" + idx;
  }
  function pairKey(idA, idB) {
    const a = String(idA), b = String(idB);
    return a < b ? a + "|" + b : b + "|" + a;
  }
  function isValidTravelMinutes(v) {
    return typeof v === "number" && Number.isFinite(v) && v >= 0;
  }
  function parseTravelMinutesInput(text) {
    const trimmed = String(text == null ? "" : text).trim();
    if (trimmed === "") return null;
    const v = Number(trimmed);
    return Number.isInteger(v) && isValidTravelMinutes(v) ? v : null;
  }
  function travelMinutes(locIdA, locIdB) {
    if (!locIdA || !locIdB || locIdA === locIdB) return 0;
    const v = state.travelTimes[pairKey(locIdA, locIdB)];
    return isValidTravelMinutes(v) ? v : Infinity;
  }
  function scheduleTargetMemberIds() {
    const excluded = new Set(currentExcludedIds());
    const submitted = new Set(state.requests.map((r) => r.memberId));
    return state.members.filter((m) => submitted.has(m.id) && !excluded.has(m.id)).map((m) => m.id);
  }
  function unassignedMembersFor(assigned, targetIds = scheduleTargetMemberIds()) {
    const assignedIds = new Set(assigned.map((r) => r.memberId));
    return [...targetIds].filter((id) => !assignedIds.has(id)).map((id) => memberById(id)).filter(Boolean);
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
  var CURRENT_SCHEMA_VERSION = 3;
  var state = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    availableCells: [],
    // array of "day-slot" strings
    locations: [],
    // {id, name, color} — color는 LOCATION_PALETTE의 색(표시 전용)
    travelTimes: {},
    // { "locIdA|locIdB": minutes }
    members: [],
    // {id, name, locationIds: [locId, ...]}
    requests: [],
    // {id, memberId, locationId, day, startSlot, duration}
    // "수업 스케줄 생성3" 전용 설정 (생성1·생성2 엔진을 withSelectionOverride로 재사용해 후보 3개를 한 화면에 보여줌)
    onceLimitedMemberIds3: [],
    // 스케줄 생성3에서 최대 1회만 배정되어야 하는 회원 id 목록
    excludedMemberIds3: [],
    // 스케줄 생성3에서 후보 생성 시 아예 제외할 회원 id 목록
    // "수업 스케줄 생성"의 연속 요일 배정 제외 회원 id 목록 — 두 수업 사이에 최소 하루를 둔다
    // (정책: domain.js의 memberDayViolation). 엔진이 state에서 바로 읽는다(selectionOverride 대상 아님).
    noConsecutiveDayMemberIds: []
  };
  var runtime = {
    availableCells: /* @__PURE__ */ new Set(),
    // 후보 풀 저장소(원본 슬롯). 화면의 카드·역할은 여기서 매번 파생한다(schedule3.js의
    // candidatePoolEntries → candidateSelection.js의 selectCandidates) — 카드 구조는 저장하지 않는다.
    // candidates: 그리디 전략 0(인원 최대)·전략 1(수업 횟수 최대)의 결과.
    candidates: [],
    // candidateAList: 체인 DP 탐색 그룹 3개의 결과. 배열 길이는 항상 SCHEDULE2_CARD_COUNT(3)와 같다.
    // extraCandidates(선택): 회원별 추가 탐색이 찾은 미배정 1명 추가·절충 후보(schedule3.js extraCandidates).
    //   본 생성의 그리디 시도 전체에서 고른 조건별 대표도 여기 둔다(schedule3.js addSearchRepresentatives).
    // extraSearch(선택): '미배정 1명 추가안 더 찾기' 상태 { baseSig: 기준 추천 배치 서명, done: 끝까지 마쳤는지 }.
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
    storageError: null,
    // 저장분이 있는데 읽지 못했으면(미래 schemaVersion·손상) 기본값으로 덮어쓰지 않도록 저장을 막는다.
    loadError: null,
    // 재최적화 실행 계측(schedule3.js logReoptimize): 세션 한정, 저장하지 않는다.
    reoptimizeLog: []
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
    if (runtime.loadError) {
      emitStorageStatus(false, runtime.loadError);
      return false;
    }
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
      // 지점 색상은 표시 전용이라 넣지 않는다 — 색만 바꿔도 후보가 지워지지 않고, 색상 이관 전에 저장된 키와도 같다.
      sortedJson(
        state.members.map((m) => ({
          id: m.id,
          locationIds: m.locationIds,
          category: m.category
        }))
      ),
      sortedJson(state.locations.map((l) => ({ id: l.id, name: l.name }))),
      JSON.stringify(Object.entries(state.travelTimes || {}).sort()),
      Array.from(runtime.availableCells).sort().join(","),
      (state.excludedMemberIds3 || []).slice().sort().join(","),
      (state.onceLimitedMemberIds3 || []).slice().sort().join(","),
      // 연속 요일 배정 제외는 비어 있으면 넣지 않는다 — 이 설정 이전에 저장된 inputKey와 같게 유지해,
      // 업데이트만으로 기존 후보가 "입력이 바뀜"으로 지워지지 않게 한다.
      ...(state.noConsecutiveDayMemberIds || []).length ? ["noConsecutive:" + state.noConsecutiveDayMemberIds.slice().sort().join(",")] : []
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
  function addLocation(name, color, id = uid("loc")) {
    const loc = { id, name, color };
    state.locations.push(loc);
    fillLocationColors(state.locations);
    state.locations.forEach((other) => {
      if (other.id !== loc.id)
        state.travelTimes[pairKey(loc.id, other.id)] = defaultTravelMinutesFor(
          loc.name,
          other.name
        );
    });
    return loc;
  }
  function fillLocationColors(locations) {
    const valid = (c) => LOCATION_PALETTE.some((p) => p.color === c);
    const used = new Set(locations.map((l) => l.color).filter(valid));
    const missing = locations.filter((l) => !valid(l.color));
    missing.forEach((loc) => {
      const byName = DEFAULT_LOCATION_COLORS[loc.name];
      if (byName && !used.has(byName)) used.add(loc.color = byName);
    });
    missing.filter((l) => !valid(l.color)).forEach((loc, i) => {
      const free = LOCATION_PALETTE.find((p) => !used.has(p.color));
      loc.color = free ? free.color : LOCATION_PALETTE[i % LOCATION_PALETTE.length].color;
      used.add(loc.color);
    });
  }
  function parseSavedObject(raw) {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("saved state must be an object");
    return parsed;
  }
  function loadState() {
    let hadSavedState = false;
    let raw = null;
    runtime.loadError = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      let parsed = null;
      if (raw !== null) {
        parsed = parseSavedObject(raw);
      } else {
        const legacyRaw = [PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY].map((k) => localStorage.getItem(k)).find((v) => v !== null);
        if (legacyRaw !== void 0) parsed = parseSavedObject(legacyRaw);
      }
      if (!parsed && raw === null) {
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
        state.noConsecutiveDayMemberIds = Array.isArray(
          parsed.noConsecutiveDayMemberIds
        ) ? parsed.noConsecutiveDayMemberIds.filter((id) => typeof id === "string") : [];
        runtime.availableCells = new Set(parsed.availableCells || []);
        runtime.candidates = parsed.candidates || [];
        if (parsed.schedule3Result && Array.isArray(parsed.schedule3Result.candidateAList)) {
          const list = parsed.schedule3Result.candidateAList.slice(0, 3);
          while (list.length < 3) list.push(null);
          runtime.schedule3Result = { candidateAList: list };
          if (typeof parsed.schedule3Result.inputKey === "string")
            runtime.schedule3Result.inputKey = parsed.schedule3Result.inputKey;
          const extras = parsed.schedule3Result.extraCandidates;
          if (Array.isArray(extras))
            runtime.schedule3Result.extraCandidates = extras.filter(
              (r) => r && Array.isArray(r.assigned) && Array.isArray(r.unassignedMembers)
            );
          const meta = parsed.schedule3Result.extraSearch;
          if (meta && typeof meta.baseSig === "string" && typeof meta.done === "boolean")
            runtime.schedule3Result.extraSearch = {
              baseSig: meta.baseSig,
              done: meta.done
            };
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
      if (raw !== null) {
        runtime.loadError = e;
        runtime.storageError = e;
      }
    }
    if (!hadSavedState && state.locations.length === 0) {
      DEFAULT_LOCATION_NAMES.forEach((name) => addLocation(name));
    }
    if (!hadSavedState && runtime.availableCells.size === 0) {
      DEFAULT_BUSINESS_DAY_INDICES.forEach((di) => {
        for (let s = DEFAULT_BUSINESS_START_SLOT; s < DEFAULT_BUSINESS_END_SLOT; s++)
          runtime.availableCells.add(cellKey(di, s));
      });
    }
    fillLocationColors(state.locations);
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
    state.noConsecutiveDayMemberIds = state.noConsecutiveDayMemberIds.filter(
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
  function attachTouchDrag(el2, container, meta) {
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
      el2.classList.remove("dragging", "touch-drag-pending");
      el2.removeEventListener("pointermove", onMove);
      el2.removeEventListener("pointerup", onUp);
      el2.removeEventListener("pointercancel", onCancel);
    }
    function beginDrag() {
      active = true;
      draggingMoveHandler = meta.onMove;
      draggingDurationSlots = meta.durationSlots;
      draggingValidator = meta.validator;
      draggingSourceContainer = container;
      el2.classList.remove("touch-drag-pending");
      el2.classList.add("dragging");
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
    el2.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      el2.classList.add("touch-drag-pending");
      el2.setPointerCapture(pointerId);
      el2.addEventListener("pointermove", onMove);
      el2.addEventListener("pointerup", onUp);
      el2.addEventListener("pointercancel", onCancel);
      timer = setTimeout(() => {
        timer = null;
        beginDrag();
      }, LONG_PRESS_MS);
    });
  }
  function clearPlacementClasses(el2) {
    Array.from(el2.classList).forEach((name) => {
      if (name.startsWith("grid-col-") || name.startsWith("grid-row-start-") || name.startsWith("grid-row-span-") || name.startsWith("lane-"))
        el2.classList.remove(name);
    });
  }
  function setGridPlacement(el2, column, rowStart, rowSpan = 1) {
    clearPlacementClasses(el2);
    el2.classList.add(
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
      if (!b.excluded) block.classList.add(b.colorClass || blockColorClass(b.color));
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
      return document.elementsFromPoint(x, y).find((el2) => el2.classList && el2.classList.contains("cal-cell")) || null;
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
    const overflow = gridWrap ? Math.max(0, gridWrap.scrollWidth - gridWrap.clientWidth) : 0;
    const neededWidth = overflow ? cardEl.offsetWidth + overflow : null;
    const neededWindowWidth = overflow ? document.documentElement.clientWidth + overflow : null;
    const CAPTURE_ATTR = "data-capture-card";
    cardEl.setAttribute(CAPTURE_ATTR, "");
    try {
      const canvas = await html2canvas(cardEl, {
        backgroundColor: "#ffffff",
        scale: 2,
        width: neededWidth || void 0,
        windowWidth: neededWindowWidth || void 0,
        ignoreElements: (el2) => el2.classList && (el2.classList.contains("candidate-card-actions") || el2.classList.contains("reopt-row")),
        // html2canvas가 repeating-linear-gradient 배경을 그리지 못하고 흰 배경으로 남기는 문제가
        // 있어(이동 시간 블록·제외 회원 블록에 사용 중), 캡처용 복제 문서에서만 무늬를 대표하는
        // 단색으로 바꿔치기한다. 화면에 실제로 보이는 원본 요소는 건드리지 않는다.
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll(".cal-travel-block").forEach((el2) => {
            el2.classList.add("capture-travel-solid");
          });
          clonedDoc.querySelectorAll(".cal-block.excluded").forEach((el2) => {
            el2.classList.add("capture-excluded-solid");
          });
          if (neededWidth) {
            const clonedCard = clonedDoc.querySelector(`[${CAPTURE_ATTR}]`);
            if (clonedCard) clonedCard.classList.add("capture-card-wide");
            clonedDoc.querySelectorAll(".grid-scroll").forEach((el2) => {
              el2.classList.add("capture-grid-scroll");
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
        const weight = weightFn(r.memberId, r.startSlot, locationId, r.day);
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

  // src/engine/pins.js
  function pinKey(r) {
    return r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId;
  }
  function pinsFromResult(result) {
    const ids = new Set(result && result.confirmedIds || []);
    return result.assigned.filter((r) => ids.has(r.id)).map((r) => ({
      id: r.id,
      memberId: r.memberId,
      day: r.day,
      startSlot: r.startSlot,
      duration: r.duration,
      locationId: r.locationId
    }));
  }
  function missingPins(assigned, pins) {
    if (!pins || pins.length === 0) return [];
    const keys = new Set(assigned.map(pinKey));
    return pins.filter((p) => !keys.has(pinKey(p)));
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
  function dropSessionsForBalance(result, pins = []) {
    const pinned = new Set(pins.map(pinKey));
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
        if (pinned.has(pinKey(r))) return;
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
      new Blob([`(() => {
  // src/constants.js
  var DAYS = ["월", "화", "수", "목", "금", "토"];
  var START_MIN = 12 * 60;
  var END_MIN = 24 * 60;
  var SLOT_MIN = 10;
  var SLOT_COUNT = (END_MIN - START_MIN) / SLOT_MIN;
  var SESSION_DURATION_MIN = 60;
  var BREAK_MIN = 0;
  var ALLOWED_GAP_MIN = 10;
  var SOLO_TRAVEL_LOCATION_NAMES = ["상암점", "여의도점", "마포점"];
  var INEFFICIENT_ROUNDTRIP_LOCATION_NAMES = ["마포점", "여의도점", "상암점"];
  var MAX_SESSIONS_PER_MEMBER = 2;
  var MAX_TRAVELS_PER_DAY = 2;
  var FORCE_ONCE_WEIGHT = 1e6;
  var COVERAGE_WEIGHT_GAP_THRESHOLD = 1e4;
  var SESSION_DURATION_MIN_2 = 60;
  var CONSULT_DURATION_MIN_2 = 30;
  var OLD_SLOT_MIN = 30;
  var SLOT_SCALE = OLD_SLOT_MIN / SLOT_MIN;
  var DEFAULT_BUSINESS_START_MIN = 14 * 60;
  var DEFAULT_BUSINESS_END_MIN = 23 * 60 + 30;
  var DEFAULT_BUSINESS_START_SLOT = (DEFAULT_BUSINESS_START_MIN - START_MIN) / SLOT_MIN;
  var DEFAULT_BUSINESS_END_SLOT = (DEFAULT_BUSINESS_END_MIN - START_MIN) / SLOT_MIN;

  // src/utils.js
  function durationToSlots(min) {
    return min / SLOT_MIN;
  }
  var TIME_SELECT_STEP_SLOTS = 10 / SLOT_MIN;

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
  function maxSessionsFor(member) {
    if (!member) return 1;
    if (currentOnceLimitIds().includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }
  function isAdjacentDay(day, days) {
    for (const d of days) {
      if (Math.abs(d - day) === 1) return true;
    }
    return false;
  }
  function memberDayViolation(memberId, day, otherDays) {
    for (const d of otherDays) if (d === day) return "sameDay";
    if (isAdjacentDay(day, otherDays) && (state.noConsecutiveDayMemberIds || []).includes(memberId))
      return "consecutiveDay";
    return null;
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
  function pairKey(idA, idB) {
    const a = String(idA), b = String(idB);
    return a < b ? a + "|" + b : b + "|" + a;
  }
  function isValidTravelMinutes(v) {
    return typeof v === "number" && Number.isFinite(v) && v >= 0;
  }
  function travelMinutes(locIdA, locIdB) {
    if (!locIdA || !locIdB || locIdA === locIdB) return 0;
    const v = state.travelTimes[pairKey(locIdA, locIdB)];
    return isValidTravelMinutes(v) ? v : Infinity;
  }
  function scheduleTargetMemberIds() {
    const excluded = new Set(currentExcludedIds());
    const submitted = new Set(state.requests.map((r) => r.memberId));
    return state.members.filter((m) => submitted.has(m.id) && !excluded.has(m.id)).map((m) => m.id);
  }
  function unassignedMembersFor(assigned, targetIds = scheduleTargetMemberIds()) {
    const assignedIds = new Set(assigned.map((r) => r.memberId));
    return [...targetIds].filter((id) => !assignedIds.has(id)).map((id) => memberById(id)).filter(Boolean);
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
  var CURRENT_SCHEMA_VERSION = 3;
  var state = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    availableCells: [],
    // array of "day-slot" strings
    locations: [],
    // {id, name, color} — color는 LOCATION_PALETTE의 색(표시 전용)
    travelTimes: {},
    // { "locIdA|locIdB": minutes }
    members: [],
    // {id, name, locationIds: [locId, ...]}
    requests: [],
    // {id, memberId, locationId, day, startSlot, duration}
    // "수업 스케줄 생성3" 전용 설정 (생성1·생성2 엔진을 withSelectionOverride로 재사용해 후보 3개를 한 화면에 보여줌)
    onceLimitedMemberIds3: [],
    // 스케줄 생성3에서 최대 1회만 배정되어야 하는 회원 id 목록
    excludedMemberIds3: [],
    // 스케줄 생성3에서 후보 생성 시 아예 제외할 회원 id 목록
    // "수업 스케줄 생성"의 연속 요일 배정 제외 회원 id 목록 — 두 수업 사이에 최소 하루를 둔다
    // (정책: domain.js의 memberDayViolation). 엔진이 state에서 바로 읽는다(selectionOverride 대상 아님).
    noConsecutiveDayMemberIds: []
  };
  var runtime = {
    availableCells: /* @__PURE__ */ new Set(),
    // 후보 풀 저장소(원본 슬롯). 화면의 카드·역할은 여기서 매번 파생한다(schedule3.js의
    // candidatePoolEntries → candidateSelection.js의 selectCandidates) — 카드 구조는 저장하지 않는다.
    // candidates: 그리디 전략 0(인원 최대)·전략 1(수업 횟수 최대)의 결과.
    candidates: [],
    // candidateAList: 체인 DP 탐색 그룹 3개의 결과. 배열 길이는 항상 SCHEDULE2_CARD_COUNT(3)와 같다.
    // extraCandidates(선택): 회원별 추가 탐색이 찾은 미배정 1명 추가·절충 후보(schedule3.js extraCandidates).
    //   본 생성의 그리디 시도 전체에서 고른 조건별 대표도 여기 둔다(schedule3.js addSearchRepresentatives).
    // extraSearch(선택): '미배정 1명 추가안 더 찾기' 상태 { baseSig: 기준 추천 배치 서명, done: 끝까지 마쳤는지 }.
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
    storageError: null,
    // 저장분이 있는데 읽지 못했으면(미래 schemaVersion·손상) 기본값으로 덮어쓰지 않도록 저장을 막는다.
    loadError: null,
    // 재최적화 실행 계측(schedule3.js logReoptimize): 세션 한정, 저장하지 않는다.
    reoptimizeLog: []
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
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && runtime.generationInProgress) {
        acquireWakeLock();
      }
    });
  }
  var LEGACY_START_MIN = 13 * 60;

  // src/engine/pins.js
  function pinKey(r) {
    return r.memberId + "|" + r.day + "|" + r.startSlot + "|" + r.locationId;
  }

  // src/engine/scheduleCompare.js
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

  // src/engine/greedy.js
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
        if (!usedDays) return true;
        if (memberDayViolation(memberId, day, usedDays)) return false;
        if (usedDays.size >= maxSessionsFor(memberById(memberId)))
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
        [...pinned].sort((a, b) => a.day - b.day || a.startSlot - b.startSlot).forEach((p) => commit(p.day, { ...p }));
        [...new Set(pinned.map((p) => p.day))].forEach(
          (day) => extendChainBackward(
            day,
            new Set(
              [...allMemberIdsForDay(day)].filter((id) => withinCaps(id, day))
            ),
            fairnessWeight
          )
        );
      }
      if (pinnedLocationDay && !pinned.some((p) => p.day === pinnedLocationDay.day) && (byDay.get(pinnedLocationDay.day) || []).length > 0) {
        buildBestChain(
          pinnedLocationDay.day,
          new Set(
            [...allMemberIdsForDay(pinnedLocationDay.day)].filter(
              (id) => withinCaps(id, pinnedLocationDay.day)
            )
          ),
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
    const unassignedMembers = unassignedMembersFor(assigned, allMemberIds);
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
  function* greedyAttemptInputs(strategyIndex, eligible, attempts) {
    const rand = makeSeededRandom(strategyIndex + 1);
    yield { jitter: new Map(eligible.map((r) => [r.id, 0])), dayOrder: void 0 };
    for (let i = 0; i < attempts; i++) {
      const jitter = new Map(eligible.map((r) => [r.id, rand()]));
      const dayOrder = shuffledDayOrder(rand);
      yield { jitter, dayOrder };
    }
  }
  var TRAVEL_VALUE_MINUTES = 60;
  var SESSION_VALUE_MINUTES = TRAVEL_VALUE_MINUTES;

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
  function buildDayNodes(dayRequests, weightFn, jitterFn, locationsFor = candidateLocationsForRequest) {
    const nodes = [];
    dayRequests.forEach((r) => {
      const member = memberById(r.memberId);
      const duration = sessionDurationFor2(member);
      const end = r.startSlot + durationToSlots(duration);
      locationsFor(r).forEach((locationId) => {
        const weight = weightFn(r.memberId, r.startSlot, locationId, r.day);
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
    function better(dpA, ineffA, tcA, tmA, idleA, jsA, dpB, ineffB, tcB, tmB, idleB, jsB) {
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
        if (better(
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
      if (bestEnd === -1 || better(
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
  async function runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, stage1DayOrder, runRepair, runPolish, polishBudgetMs, seedOffset, pins = []) {
    seedOffset = seedOffset || 0;
    const pinByKey = new Map(pins.map((p) => [pinKey(p), p]));
    const pinNodesByDay = /* @__PURE__ */ new Map();
    pins.forEach((p) => {
      if (!pinNodesByDay.has(p.day)) pinNodesByDay.set(p.day, []);
      pinNodesByDay.get(p.day).push({ ...p, end: p.startSlot + durationToSlots(p.duration) });
    });
    pinNodesByDay.forEach((list) => list.sort((a, b) => a.startSlot - b.startSlot));
    function isPinned(node) {
      return pinByKey.size > 0 && pinByKey.has(pinKey(node));
    }
    function keepsPins(day, chain) {
      const dayPins = pinNodesByDay.get(day);
      if (!dayPins) return true;
      const keys = new Set(chain.map(pinKey));
      return dayPins.every((p) => keys.has(pinKey(p)));
    }
    const FIXED_PIN_WEIGHT = 1e9;
    const ineffInfo = inefficientRoundTripLocationInfo();
    const soloIds = soloTravelMemberIds();
    function dayChainAllowed(chain, day) {
      return !dayChainViolation(chain, soloIds) && keepsPins(day, chain);
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
      const withPins = pinByKey.size === 0 ? weightFn : (memberId, startSlot, locationId, day) => pinByKey.has(pinKey({ memberId, day, startSlot, locationId })) ? FIXED_PIN_WEIGHT : weightFn(memberId, startSlot, locationId, day);
      return buildDayNodes(dayRequests, withPins, jitterFn, locationsForReq);
    }
    function dayBlocked(memberId, day, leavingDay) {
      const days = assignedDaysByMember.get(memberId);
      if (!days || days.size === 0) return false;
      const others = leavingDay === void 0 ? days : [...days].filter((d) => d !== leavingDay);
      return !!memberDayViolation(memberId, day, others);
    }
    function isEligibleForDay(memberId, day) {
      const cap = maxSessionsFor2(memberById(memberId));
      if ((assignedCountByMember.get(memberId) || 0) >= cap) return false;
      return !dayBlocked(memberId, day);
    }
    function countSession(day, node) {
      assignedCountByMember.set(
        node.memberId,
        (assignedCountByMember.get(node.memberId) || 0) + 1
      );
      if (!assignedDaysByMember.has(node.memberId))
        assignedDaysByMember.set(node.memberId, /* @__PURE__ */ new Set());
      assignedDaysByMember.get(node.memberId).add(day);
    }
    function commit(day, node) {
      if (!isPinned(node)) countSession(day, node);
    }
    pinNodesByDay.forEach((list, day) => list.forEach((p) => countSession(day, p)));
    function uncommit(day, node) {
      if (isPinned(node)) return;
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
      let chain = runChainDP(nodes, void 0, ineffInfo, true);
      if (!keepsPins(day, chain)) chain = (pinNodesByDay.get(day) || []).slice();
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
      let chain = runChainDP(nodes, void 0, ineffInfo);
      if (!keepsPins(day, chain)) chain = existingChain;
      chain.forEach((node) => commit(day, node));
      dayChains.set(day, chain);
    });
    const MAX_EJECTION_DEPTH = 3;
    const targetMemberIds = scheduleTargetMemberIds();
    function isCurrentlyAssigned(memberId) {
      return (assignedCountByMember.get(memberId) || 0) > 0;
    }
    const excludedIdSet2 = new Set(currentExcludedIds2());
    function tryPlaceMember(memberId, excludeDays, depth) {
      if (depth > MAX_EJECTION_DEPTH) return false;
      if (now() > REPAIR_DEADLINE) return false;
      const candidateDays = daysWithReqs.filter(
        (day) => !excludeDays.has(day) && !dayBlocked(memberId, day) && reqsByDay.get(day).some((r) => r.memberId === memberId)
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
          if (!dayChainAllowed(newChain, day)) continue;
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
          if (isPinned(otherNode)) continue;
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
          if (!dayChainAllowed(newChain, day)) continue;
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
      return targetMemberIds.filter((id) => !isCurrentlyAssigned(id));
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
        if (!newChain.some((n) => n.memberId === memberId) || !keepsPins(day, newChain)) {
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
        if (isPinned(node)) return false;
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
        const leavingAllowed = dayChainAllowed(currentChainWithout, currentDay);
        daysWithReqs.forEach((day) => {
          if (day !== currentDay) {
            if (!leavingAllowed) return;
            if (dayBlocked(memberId, day, currentDay)) return;
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
            if (!dayChainAllowed(newChain, day)) return;
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
        if (!dayChainAllowed(newChain, cand.day)) return null;
        return newChain;
      }, tryCrossDaySwap = function(node1, node2) {
        if (node1.day === node2.day || node1.memberId === node2.memberId)
          return false;
        if (isPinned(node1) || isPinned(node2)) return false;
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
        if (dayBlocked(member1, day2, day1)) return false;
        if (dayBlocked(member2, day1, day2)) return false;
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
          if (dayBlocked(placeMemberId, day)) continue;
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
            if (isPinned(otherNode)) continue;
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
        if (isPinned(node)) return false;
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
        const allowed = placed && [...touchedDays].every(
          (d) => dayChainAllowed(dayChains.get(d) || [], d)
        );
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
        if (isPinned(removed.node)) {
          restoreChainState(snap);
          return false;
        }
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
        const allowed = placed && [...touchedDays].every(
          (d) => dayChainAllowed(dayChains.get(d) || [], d)
        );
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
        const worse = !keepsPins(day, newChain) || stillUnassignedIds().length > beforeUnassignedCount || afterIneff > beforeIneff || afterIneff === beforeIneff && afterTotalSessions < beforeTotalSessions;
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
            if (!keepsPins(dayA, opt.chainA) || !keepsPins(dayB, opt.chainB))
              return;
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
            const better = !bestOption || opt.pairIneff < bestOption.pairIneff || opt.pairIneff === bestOption.pairIneff && fewerTravelOrIdle(
              opt.pairTravel,
              opt.pairIdle,
              bestOption.pairTravel,
              bestOption.pairIdle
            );
            if (better) bestOption = opt;
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
        const accept = daysWithReqs.every((d) => keepsPins(d, dayChains.get(d) || [])) && attemptUnassigned <= bestSnapshot.unassigned && (attemptIneff < bestSnapshot.ineff || attemptIneff === bestSnapshot.ineff && attemptSessions >= bestSnapshot.sessions && fewerTravelOrIdle(
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
          const all = Array.from(dayChains.values()).flat().filter((n) => !isPinned(n));
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
            if (day !== currentDay && dayBlocked(memberId, day, currentDay))
              return;
            reqsFor(memberId, day).forEach(
              (r) => options.push({ day, startSlot: r.startSlot, req: r })
            );
          });
          if (options.length === 0) return null;
          const picked = options[Math.floor(randomFn() * options.length)];
          if (picked.day !== currentDay && !dayChainAllowed(currentChainWithout, currentDay))
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
          if (dayBlocked(member1, day2, day1)) return null;
          if (dayBlocked(member2, day1, day2)) return null;
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
          if (isPinned(node)) continue;
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
    const unassignedMembers = unassignedMembersFor(assigned, targetMemberIds);
    return { assigned, unassignedMembers };
  }

  // src/engine/engineWorker.js
  var ctx = null;
  var greedyCursor = null;
  function greedyInput(strategyIndex, attempt) {
    if (!greedyCursor || greedyCursor.strategyIndex !== strategyIndex || greedyCursor.attempt > attempt) {
      greedyCursor = {
        strategyIndex,
        attempt: -1,
        input: null,
        gen: greedyAttemptInputs(strategyIndex, ctx.eligible, ctx.attempts)
      };
    }
    while (greedyCursor.attempt < attempt) {
      greedyCursor.input = greedyCursor.gen.next().value;
      greedyCursor.attempt++;
    }
    return greedyCursor.input;
  }
  var handlers = {
    async polish(msg) {
      const result = await runSchedule2Pipeline(
        ctx.eligibleReqs,
        ctx.reqsByDay,
        ctx.daysWithReqs,
        msg.order,
        true,
        true,
        msg.budgetMs,
        msg.seedOffset,
        ctx.pins || []
      );
      return {
        assigned: result.assigned,
        unassignedMemberIds: result.unassignedMembers.map((m) => m.id)
      };
    },
    async greedy(msg) {
      const input = greedyInput(msg.strategyIndex, msg.attempt);
      const cand = buildCandidateFromStrategy(
        msg.strategyIndex,
        ctx.eligible,
        ctx.eligibleIdSet,
        ctx.allMemberIdSet,
        input.jitter,
        ctx.pins || [],
        input.dayOrder
      );
      cand.unassignedMembers = cand.unassignedMembers.map((m) => m.id);
      return cand;
    }
  };
  self.onmessage = async (event) => {
    const msg = event.data;
    if (msg.type === "init") {
      Object.assign(state, msg.state);
      runtime.availableCells = new Set(msg.availableCells);
      setIdleFirst(!!msg.idleFirst);
      ctx = msg;
      if (msg.kind === "greedy") {
        ctx.eligibleIdSet = new Set(msg.eligibleIds);
        ctx.allMemberIdSet = new Set(msg.allMemberIds);
      }
      greedyCursor = null;
      return;
    }
    if (msg.type !== "run") return;
    try {
      const result = await withSelectionOverride(
        ctx.excludedIds,
        ctx.onceLimitIds,
        () => handlers[ctx.kind](msg)
      );
      self.postMessage({ index: msg.index, result });
    } catch (err) {
      self.postMessage({
        index: msg.index,
        error: String(err && err.stack || err)
      });
    }
  };
})();
`], { type: "text/javascript" })
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
          requests: state.requests,
          noConsecutiveDayMemberIds: state.noConsecutiveDayMemberIds
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
        if (!usedDays) return true;
        if (memberDayViolation(memberId, day, usedDays)) return false;
        if (usedDays.size >= maxSessionsFor(memberById(memberId)))
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
        [...pinned].sort((a, b) => a.day - b.day || a.startSlot - b.startSlot).forEach((p) => commit(p.day, { ...p }));
        [...new Set(pinned.map((p) => p.day))].forEach(
          (day) => extendChainBackward(
            day,
            new Set(
              [...allMemberIdsForDay(day)].filter((id) => withinCaps(id, day))
            ),
            fairnessWeight
          )
        );
      }
      if (pinnedLocationDay && !pinned.some((p) => p.day === pinnedLocationDay.day) && (byDay.get(pinnedLocationDay.day) || []).length > 0) {
        buildBestChain(
          pinnedLocationDay.day,
          new Set(
            [...allMemberIdsForDay(pinnedLocationDay.day)].filter(
              (id) => withinCaps(id, pinnedLocationDay.day)
            )
          ),
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
    const unassignedMembers = unassignedMembersFor(assigned, allMemberIds);
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
  function copyLayout(r) {
    const out = {
      ...r,
      assigned: r.assigned.map((a) => ({ ...a })),
      unassignedMembers: (r.unassignedMembers || []).slice()
    };
    if (Array.isArray(r.confirmedIds)) out.confirmedIds = r.confirmedIds.slice();
    return out;
  }
  function candidateSignature(cand) {
    return cand.assigned.map((r) => r.id).slice().sort().join(",");
  }
  async function buildGreedySearchPool(eligible, eligibleIds, allMemberIds, onProgress, workerOptions = {}, pins = [], runSync = (fn) => fn()) {
    const searchAttempts = workerOptions.attempts !== void 0 ? workerOptions.attempts : INITIAL_SEARCH_ATTEMPTS;
    const perStrategy = searchAttempts + 1;
    const totalBuilds = STRATEGIES.length * perStrategy;
    let completed = 0;
    const pool = await runTasksInWorkers({
      init: runSync(
        () => engineWorkerInit("greedy", {
          eligible,
          eligibleIds: [...eligibleIds],
          allMemberIds: [...allMemberIds],
          attempts: searchAttempts,
          pins
        })
      ),
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
            pool[i] = runSync(
              () => buildCandidateFromStrategy(
                idx,
                eligible,
                eligibleIds,
                allMemberIds,
                input.jitter,
                pins,
                input.dayOrder
              )
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
  function greedySearchInputs() {
    const eligible = state.requests.filter(isEligibleRequest);
    return {
      eligible,
      eligibleIds: new Set(eligible.map((r) => r.id)),
      allMemberIds: new Set(scheduleTargetMemberIds())
    };
  }
  function greedySearchKey(attempts, pins) {
    return JSON.stringify([
      candidateInputKey(),
      currentExcludedIds(),
      currentOnceLimitIds(),
      attempts !== void 0 ? attempts : INITIAL_SEARCH_ATTEMPTS,
      pins
    ]);
  }
  async function generateCandidatesAsync(onProgress, workerOptions = {}, pins = []) {
    const { eligible, eligibleIds, allMemberIds } = greedySearchInputs();
    const searchKey = greedySearchKey(workerOptions.attempts, pins);
    const pool = await buildGreedySearchPool(
      eligible,
      eligibleIds,
      allMemberIds,
      onProgress,
      workerOptions,
      pins
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
      const builtCand = Object.assign(copyLayout(best), {
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
          tied.push(cand === best ? builtCand : copyLayout(cand));
      });
      if (!tied.includes(builtCand)) {
        if (tied.length >= MAX_POOL_VARIANTS) tied.length = MAX_POOL_VARIANTS - 1;
        tied.unshift(builtCand);
      }
      return { builtCand, tied };
    });
    return {
      built: builtPairs.map((p) => p.builtCand),
      pools: builtPairs.map((p) => p.tied),
      all: pool,
      searchKey
    };
  }

  // src/engine/candidateDiff.js
  var COMPARE_METRICS = [
    { key: "unassigned", label: "미배정 회원", dir: -1 },
    { key: "sessions", label: "총 수업", dir: 1 },
    { key: "inefficientMoves", label: "비효율 이동", dir: -1 },
    { key: "travelCount", label: "이동 횟수", dir: -1 },
    { key: "travelMinutes", label: "이동 시간", dir: -1 },
    { key: "idleMinutes", label: "빈 시간", dir: -1 },
    { key: "workDays", label: "근무일 수", dir: -1 },
    { key: "spanMinutes", label: "체류 시간(요일 합)", dir: -1 },
    { key: "firstStartMinute", label: "첫 수업 시작", dir: 0 },
    { key: "lastEndMinute", label: "마지막 수업 종료", dir: 0 }
  ];
  var DELTA_LABELS = {
    unassigned: ["미배정", "명"],
    sessions: ["수업", ""],
    inefficientMoves: ["비효율 이동", ""],
    travelCount: ["이동", ""],
    travelMinutes: ["이동 시간", "분"],
    idleMinutes: ["빈 시간", "분"],
    workDays: ["근무일", "일"],
    spanMinutes: ["체류 시간", "분"],
    firstStartMinute: ["첫 시작", "분"],
    lastEndMinute: ["마지막 종료", "분"]
  };
  function formatDelta(key, delta) {
    const [label, unit] = DELTA_LABELS[key];
    return `${label} ${delta > 0 ? "+" : ""}${delta}${unit}`;
  }
  function metricDiff(base, other) {
    return COMPARE_METRICS.map(({ key, label, dir }) => {
      const delta = other[key] - base[key];
      const effect = delta === 0 ? "same" : dir === 0 ? "neutral" : delta * dir > 0 ? "better" : "worse";
      return { key, label, base: base[key], value: other[key], delta, effect };
    });
  }
  function summarizeMetricDiff(diff) {
    const list = (effect) => diff.filter((d) => d.effect === effect).map((d) => formatDelta(d.key, d.delta)).join(" / ");
    const gains = list("better"), losses = list("worse"), neutral = list("neutral");
    const note = neutral ? ` · 참고: ${neutral}` : "";
    if (gains && losses) return `${gains} 대신 ${losses}${note}`;
    if (gains) return `${gains} (나빠지는 지표 없음)${note}`;
    if (losses) return `나아지는 지표 없이 ${losses}${note}`;
    if (neutral) return `좋아지거나 나빠지는 지표 없음${note}`;
    return "지표는 모두 같고 배치만 다릅니다";
  }
  var sameSession = (a, b) => a.day === b.day && a.startSlot === b.startSlot && a.locationId === b.locationId;
  var bySlot = (a, b) => a.day - b.day || a.startSlot - b.startSlot;
  function pairSessions(from, to) {
    let a = from.slice().sort(bySlot), b = to.slice().sort(bySlot);
    const pairs = [];
    const take = (match) => {
      a = a.filter((x) => {
        const i = b.findIndex((y) => match(x, y));
        if (i < 0) return true;
        pairs.push([x, b[i]]);
        b.splice(i, 1);
        return false;
      });
    };
    take(sameSession);
    const unchanged = pairs.length;
    take((x, y) => x.day === y.day);
    take(() => true);
    return pairs.slice(unchanged).concat(a.map((x) => [x, null]), b.map((y) => [null, y]));
  }
  var place = (r) => r && { day: r.day, startSlot: r.startSlot, locationId: r.locationId };
  function assignmentDiff(base, other) {
    const byMember = (result) => {
      const map = /* @__PURE__ */ new Map();
      result.assigned.forEach((r) => {
        if (!map.has(r.memberId)) map.set(r.memberId, []);
        map.get(r.memberId).push(r);
      });
      return map;
    };
    const a = byMember(base), b = byMember(other);
    const ids = [.../* @__PURE__ */ new Set([...a.keys(), ...b.keys()])].sort();
    const members = [];
    const countShift = [];
    ids.forEach((memberId) => {
      const from = a.get(memberId) || [], to = b.get(memberId) || [];
      const changes = pairSessions(from, to).map(([x, y]) => ({
        from: place(x),
        to: place(y),
        dayChanged: !!(x && y) && x.day !== y.day,
        startChanged: !!(x && y) && x.startSlot !== y.startSlot,
        locationChanged: !!(x && y) && x.locationId !== y.locationId
      }));
      if (!changes.length) return;
      countShift.push(to.length - from.length);
      const status = !from.length ? "assigned" : !to.length ? "unassigned" : "moved";
      members.push({ memberId, status, changes });
    });
    const all = members.flatMap((m) => m.changes);
    const countOf = (pred) => all.filter(pred).length;
    return {
      members,
      counts: {
        changedMembers: members.length,
        changedSessions: all.length,
        dayChanges: countOf((c) => c.dayChanged),
        startChanges: countOf((c) => c.startChanged),
        locationChanges: countOf((c) => c.locationChanged),
        // 같은 요일·지점에서 시작 시각만 바뀐 세션 수.
        startOnlyChanges: countOf(
          (c) => c.startChanged && !c.dayChanged && !c.locationChanged
        ),
        newlyAssigned: members.filter((m) => m.status === "assigned").length,
        newlyUnassigned: members.filter((m) => m.status === "unassigned").length,
        sessionsAdded: countOf((c) => !c.from),
        sessionsRemoved: countOf((c) => !c.to),
        // 회원 간 수업 재배분: 수업 횟수가 줄어든/늘어난 회원 수(미배정 전환·신규 배정 포함)와 회원별
        // 횟수 증감의 절대값 합. 총 수업이 같아도 A -1회·B +1회면 각 1명, 증감 총량 2.
        membersFewer: countShift.filter((d) => d < 0).length,
        membersMore: countShift.filter((d) => d > 0).length,
        sessionCountShift: countShift.reduce((n, d) => n + Math.abs(d), 0)
      }
    };
  }

  // src/candidateCompare.js
  var UNITS = {
    unassigned: "명",
    sessions: "회",
    inefficientMoves: "회",
    travelCount: "회",
    travelMinutes: "분",
    idleMinutes: "분",
    workDays: "일",
    spanMinutes: "분"
  };
  var CLOCK_KEYS = /* @__PURE__ */ new Set(["firstStartMinute", "lastEndMinute"]);
  var formatValue = (key, v) => CLOCK_KEYS.has(key) ? v ? minutesLabel(v) : "-" : v + UNITS[key];
  var el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== void 0) e.textContent = text;
    return e;
  };
  function placeLabel(p) {
    const loc = locationById(p.locationId);
    return `${DAYS[p.day]} ${slotLabel(p.startSlot)} ${loc ? loc.name : "?"}`;
  }
  var STATUS_LABELS = { assigned: "미배정 → 배정", unassigned: "배정 → 미배정" };
  function changeLabel(c) {
    if (!c.from) return "수업 추가 " + placeLabel(c.to);
    if (!c.to) return "수업 빠짐 " + placeLabel(c.from);
    const what = [
      c.dayChanged && "요일",
      c.startChanged && "시작 시각",
      c.locationChanged && "지점"
    ].filter(Boolean);
    return `${placeLabel(c.from)} → ${placeLabel(c.to)} (${what.join("·")} 변경)`;
  }
  function renderCandidateCompare(container, base, other, onClose) {
    container.innerHTML = "";
    container.hidden = false;
    const head = el("div", "candidate-compare-head");
    head.appendChild(
      el("h3", "candidate-compare-title", `${base.label} ↔ ${other.label} 비교`)
    );
    const closeBtn = el("button", "btn btn-ghost candidate-compare-close", "닫기");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", onClose);
    head.appendChild(closeBtn);
    container.appendChild(head);
    const diff = metricDiff(base.metrics, other.metrics);
    const summary = el("p", "candidate-compare-summary");
    summary.append(
      el("b", null, "이 후보를 고르면 "),
      summarizeMetricDiff(diff)
    );
    container.appendChild(summary);
    appendMetricTable(container, base, other, diff, "추천 대비");
    appendAssignmentDiff(container, base, other);
  }
  function renderReoptimizeProposal(container, p) {
    container.innerHTML = "";
    container.hidden = false;
    const chosen = p.proposals[p.selected];
    const head = el("div", "candidate-compare-head");
    head.appendChild(
      el(
        "h3",
        "candidate-compare-title",
        chosen ? "재최적화 — " + chosen.label : "재최적화"
      )
    );
    container.appendChild(head);
    if (p.proposals.length > 1) {
      const choices = el("div", "reopt-choices");
      p.proposals.forEach((x, i) => {
        const n = assignmentDiff(p.current.result, x.result).counts;
        const b = el(
          "button",
          "btn btn-ghost reopt-choice",
          `${x.label} · 회원 ${n.changedMembers}명 변경`
        );
        b.type = "button";
        b.setAttribute("aria-pressed", String(i === p.selected));
        b.addEventListener("click", () => p.onSelect(i));
        choices.appendChild(b);
      });
      container.appendChild(choices);
    }
    if (chosen) appendProposal(container, p, chosen);
    if (p.notice) container.appendChild(el("p", "reopt-notice", p.notice));
    const actions = el("div", "reopt-actions");
    const button = (cls, label, onClick) => {
      const b = el("button", "btn " + cls, label);
      b.type = "button";
      b.addEventListener("click", onClick);
      actions.appendChild(b);
      return b;
    };
    if (chosen) button("btn-primary reopt-apply", "적용", p.onApply);
    button("btn-ghost reopt-discard", chosen ? "버리기" : "닫기", p.onDiscard);
    if (p.widen) {
      const w = button("btn-ghost reopt-widen", p.widen.label, p.onWiden);
      w.title = p.widen.scope + " 범위로 다시 찾습니다";
      actions.appendChild(el("span", "reopt-hint", p.widen.hint));
    }
    container.appendChild(actions);
  }
  function appendProposal(container, p, chosen) {
    const { counts } = assignmentDiff(p.current.result, chosen.result);
    const changed = `회원 ${counts.changedMembers}명(수업 ${counts.changedSessions}개)의 일정이 바뀝니다.`;
    container.appendChild(
      el(
        "p",
        "candidate-compare-summary",
        chosen.local ? `유지할 수업 ${p.keptCount}개는 그대로 두고 ${chosen.scope} 범위의 수업만 다시 짰습니다. ${changed} 적게 바꾸는 대신 더 큰 개선을 놓쳤을 수 있습니다(가장 좋은 일정이라는 뜻은 아닙니다). 적용하기 전까지 지금 카드는 바뀌지 않습니다.` : `유지할 수업 ${p.keptCount}개는 그대로 두고 나머지 일정 전체를 다시 짰습니다. ${changed} 적용하기 전까지 지금 카드는 바뀌지 않습니다.`
      )
    );
    const diff = metricDiff(p.current.metrics, chosen.metrics);
    const list = (effect) => diff.filter((d) => d.effect === effect).map((d) => formatDelta(d.key, d.delta)).join(" / ") || "없음";
    const gains = el("p", "reopt-effect reopt-better");
    gains.append(el("b", null, "좋아지는 것 "), list("better"));
    const losses = el("p", "reopt-effect reopt-worse");
    losses.append(el("b", null, "나빠지는 것 "), list("worse"));
    container.append(gains, losses);
    if (chosen.variantCount > 1) {
      const pager = el("div", "candidate-pool-pager");
      const btn = (label, idx) => {
        const b = el("button", "btn btn-ghost reopt-variant-btn", label);
        b.type = "button";
        b.disabled = idx < 0 || idx >= chosen.variantCount;
        b.addEventListener("click", () => p.onVariant(idx));
        return b;
      };
      pager.append(
        btn("이전 배치", chosen.variantIdx - 1),
        el(
          "span",
          "pool-pager-label",
          `같은 품질의 배치 ${chosen.variantIdx + 1}/${chosen.variantCount}`
        ),
        btn("다음 배치", chosen.variantIdx + 1)
      );
      container.appendChild(pager);
    }
    appendMetricTable(
      container,
      { ...p.current, label: "지금 카드" },
      { ...chosen, label: "제안" },
      diff,
      "지금 대비"
    );
    appendAssignmentDiff(container, p.current, chosen);
    if (p.proposals.length > 1) {
      const base = p.proposals[0];
      const other = p.selected === 0 ? p.proposals[p.proposals.length - 1] : chosen;
      const n = (x) => assignmentDiff(p.current.result, x.result).counts;
      const pairDiff = metricDiff(base.metrics, other.metrics);
      container.appendChild(
        el("h4", "candidate-compare-subtitle", `${base.label}과 ${other.label} 비교`)
      );
      container.appendChild(
        el(
          "p",
          "candidate-compare-summary reopt-pair",
          `${base.label}: 회원 ${n(base).changedMembers}명 변경 / ${other.label}: 회원 ${n(other).changedMembers}명 변경. ${other.label}을 고르면 ${summarizeMetricDiff(pairDiff)}`
        )
      );
      appendMetricTable(container, base, other, pairDiff, "차이");
      appendAssignmentDiff(container, base, other, "두 제안의 배정 차이");
    }
  }
  function appendMetricTable(container, base, other, diff, deltaHeader) {
    const table = el("table", "candidate-compare-table");
    const thead = el("thead");
    const hr = el("tr");
    ["지표", base.label, other.label, deltaHeader].forEach(
      (t) => hr.appendChild(el("th", null, t))
    );
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el("tbody");
    diff.forEach((d) => {
      const tr = el("tr");
      tr.appendChild(el("th", null, d.label));
      tr.appendChild(el("td", null, formatValue(d.key, d.base)));
      tr.appendChild(el("td", null, formatValue(d.key, d.value)));
      tr.appendChild(
        el(
          "td",
          "compare-delta compare-" + d.effect,
          d.effect === "same" ? "같음" : (d.delta > 0 ? "+" : "") + d.delta + (CLOCK_KEYS.has(d.key) ? "분" : UNITS[d.key])
        )
      );
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const tableWrap = el("div", "candidate-compare-table-wrap");
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);
  }
  function appendAssignmentDiff(container, base, other, title = "배정 차이") {
    const { members, counts } = assignmentDiff(base.result, other.result);
    container.appendChild(el("h4", "candidate-compare-subtitle", title));
    const countText = [
      `변경 회원 ${counts.changedMembers}명`,
      `요일 변경 ${counts.dayChanges}`,
      `시작 시각 변경 ${counts.startChanges}`,
      `지점 변경 ${counts.locationChanges}`,
      `미배정 → 배정 ${counts.newlyAssigned}명`,
      `배정 → 미배정 ${counts.newlyUnassigned}명`
    ].join(" · ");
    container.appendChild(el("p", "candidate-compare-counts", countText));
    if (members.length === 0) {
      container.appendChild(
        el("p", "candidate-compare-counts", "배정이 완전히 같습니다.")
      );
      return;
    }
    const list = el("ul", "candidate-compare-members");
    members.map((m) => ({ ...m, member: memberById(m.memberId) })).sort(
      (x, y) => (x.member ? x.member.name : "").localeCompare(
        y.member ? y.member.name : "",
        "ko"
      )
    ).forEach((m) => {
      const li = el("li");
      li.appendChild(el("b", null, m.member ? m.member.name : "(삭제된 회원)"));
      if (STATUS_LABELS[m.status])
        li.appendChild(
          el(
            "span",
            "compare-status compare-status-" + m.status,
            STATUS_LABELS[m.status]
          )
        );
      li.append(" " + m.changes.map(changeLabel).join(", "));
      list.appendChild(li);
    });
    container.appendChild(list);
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
  async function runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, stage1DayOrder, runRepair, runPolish, polishBudgetMs, seedOffset, pins = []) {
    seedOffset = seedOffset || 0;
    const pinByKey = new Map(pins.map((p) => [pinKey(p), p]));
    const pinNodesByDay = /* @__PURE__ */ new Map();
    pins.forEach((p) => {
      if (!pinNodesByDay.has(p.day)) pinNodesByDay.set(p.day, []);
      pinNodesByDay.get(p.day).push({ ...p, end: p.startSlot + durationToSlots(p.duration) });
    });
    pinNodesByDay.forEach((list) => list.sort((a, b) => a.startSlot - b.startSlot));
    function isPinned(node) {
      return pinByKey.size > 0 && pinByKey.has(pinKey(node));
    }
    function keepsPins(day, chain) {
      const dayPins = pinNodesByDay.get(day);
      if (!dayPins) return true;
      const keys = new Set(chain.map(pinKey));
      return dayPins.every((p) => keys.has(pinKey(p)));
    }
    const FIXED_PIN_WEIGHT = 1e9;
    const ineffInfo = inefficientRoundTripLocationInfo();
    const soloIds = soloTravelMemberIds();
    function dayChainAllowed(chain, day) {
      return !dayChainViolation(chain, soloIds) && keepsPins(day, chain);
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
      const withPins = pinByKey.size === 0 ? weightFn : (memberId, startSlot, locationId, day) => pinByKey.has(pinKey({ memberId, day, startSlot, locationId })) ? FIXED_PIN_WEIGHT : weightFn(memberId, startSlot, locationId, day);
      return buildDayNodes(dayRequests, withPins, jitterFn, locationsForReq);
    }
    function dayBlocked(memberId, day, leavingDay) {
      const days = assignedDaysByMember.get(memberId);
      if (!days || days.size === 0) return false;
      const others = leavingDay === void 0 ? days : [...days].filter((d) => d !== leavingDay);
      return !!memberDayViolation(memberId, day, others);
    }
    function isEligibleForDay(memberId, day) {
      const cap = maxSessionsFor2(memberById(memberId));
      if ((assignedCountByMember.get(memberId) || 0) >= cap) return false;
      return !dayBlocked(memberId, day);
    }
    function countSession(day, node) {
      assignedCountByMember.set(
        node.memberId,
        (assignedCountByMember.get(node.memberId) || 0) + 1
      );
      if (!assignedDaysByMember.has(node.memberId))
        assignedDaysByMember.set(node.memberId, /* @__PURE__ */ new Set());
      assignedDaysByMember.get(node.memberId).add(day);
    }
    function commit(day, node) {
      if (!isPinned(node)) countSession(day, node);
    }
    pinNodesByDay.forEach((list, day) => list.forEach((p) => countSession(day, p)));
    function uncommit(day, node) {
      if (isPinned(node)) return;
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
      let chain = runChainDP(nodes, void 0, ineffInfo, true);
      if (!keepsPins(day, chain)) chain = (pinNodesByDay.get(day) || []).slice();
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
      let chain = runChainDP(nodes, void 0, ineffInfo);
      if (!keepsPins(day, chain)) chain = existingChain;
      chain.forEach((node) => commit(day, node));
      dayChains.set(day, chain);
    });
    const MAX_EJECTION_DEPTH = 3;
    const targetMemberIds2 = scheduleTargetMemberIds();
    function isCurrentlyAssigned(memberId) {
      return (assignedCountByMember.get(memberId) || 0) > 0;
    }
    const excludedIdSet2 = new Set(currentExcludedIds2());
    function tryPlaceMember(memberId, excludeDays, depth) {
      if (depth > MAX_EJECTION_DEPTH) return false;
      if (now() > REPAIR_DEADLINE) return false;
      const candidateDays = daysWithReqs.filter(
        (day) => !excludeDays.has(day) && !dayBlocked(memberId, day) && reqsByDay.get(day).some((r) => r.memberId === memberId)
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
          if (!dayChainAllowed(newChain, day)) continue;
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
          if (isPinned(otherNode)) continue;
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
          if (!dayChainAllowed(newChain, day)) continue;
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
      return targetMemberIds2.filter((id) => !isCurrentlyAssigned(id));
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
        if (!newChain.some((n) => n.memberId === memberId) || !keepsPins(day, newChain)) {
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
        if (isPinned(node)) return false;
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
        const leavingAllowed = dayChainAllowed(currentChainWithout, currentDay);
        daysWithReqs.forEach((day) => {
          if (day !== currentDay) {
            if (!leavingAllowed) return;
            if (dayBlocked(memberId, day, currentDay)) return;
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
            if (!dayChainAllowed(newChain, day)) return;
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
        if (!dayChainAllowed(newChain, cand.day)) return null;
        return newChain;
      }, tryCrossDaySwap = function(node1, node2) {
        if (node1.day === node2.day || node1.memberId === node2.memberId)
          return false;
        if (isPinned(node1) || isPinned(node2)) return false;
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
        if (dayBlocked(member1, day2, day1)) return false;
        if (dayBlocked(member2, day1, day2)) return false;
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
          if (dayBlocked(placeMemberId, day)) continue;
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
            if (isPinned(otherNode)) continue;
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
        if (isPinned(node)) return false;
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
        const allowed = placed && [...touchedDays].every(
          (d) => dayChainAllowed(dayChains.get(d) || [], d)
        );
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
        if (isPinned(removed.node)) {
          restoreChainState(snap);
          return false;
        }
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
        const allowed = placed && [...touchedDays].every(
          (d) => dayChainAllowed(dayChains.get(d) || [], d)
        );
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
        const worse = !keepsPins(day, newChain) || stillUnassignedIds().length > beforeUnassignedCount || afterIneff > beforeIneff || afterIneff === beforeIneff && afterTotalSessions < beforeTotalSessions;
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
            if (!keepsPins(dayA, opt.chainA) || !keepsPins(dayB, opt.chainB))
              return;
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
        const accept = daysWithReqs.every((d) => keepsPins(d, dayChains.get(d) || [])) && attemptUnassigned <= bestSnapshot.unassigned && (attemptIneff < bestSnapshot.ineff || attemptIneff === bestSnapshot.ineff && attemptSessions >= bestSnapshot.sessions && fewerTravelOrIdle(
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
          const all = Array.from(dayChains.values()).flat().filter((n) => !isPinned(n));
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
            if (day !== currentDay && dayBlocked(memberId, day, currentDay))
              return;
            reqsFor(memberId, day).forEach(
              (r) => options.push({ day, startSlot: r.startSlot, req: r })
            );
          });
          if (options.length === 0) return null;
          const picked = options[Math.floor(randomFn() * options.length)];
          if (picked.day !== currentDay && !dayChainAllowed(currentChainWithout, currentDay))
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
          if (dayBlocked(member1, day2, day1)) return null;
          if (dayBlocked(member2, day1, day2)) return null;
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
          if (isPinned(node)) continue;
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
    const unassignedMembers = unassignedMembersFor(assigned, targetMemberIds2);
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
        daysWithReqs: base.daysWithReqs,
        pins: base.pins || []
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
  function groupBudgets(scale = 1) {
    if (!(scale > 0) || !Number.isFinite(scale))
      throw new Error("budgetScale은 0보다 큰 유한한 수여야 합니다: " + scale);
    const ms = (x) => scale === 1 ? x : Math.max(1, Math.round(x * scale));
    return {
      search: ms(PER_GROUP_SEARCH_DEADLINE_MS),
      targetExtra: ms(TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS),
      altBase: ms(TARGET_MATCH_ALT_BASE_BUDGET_MS),
      polishTotal: ms(PER_GROUP_TOTAL_POLISH_BUDGET_MS),
      minPolish: ms(MIN_POLISH_BUDGET_MS)
    };
  }
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
  async function searchWithinBase(reqs, reqsByDay, daysWithReqs, shuffleCount, deadlineMs, seedBase, randomFn, onEval, pins) {
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
        seedOffset,
        pins
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
  async function runSchedule2RestartGroup(eligibleReqsMaster, groupSeed, groupIndex, onProgress, targetFloor, pins = [], budgetScale = 1) {
    const budget = groupBudgets(budgetScale);
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
      budget.search,
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
      },
      pins
    );
    let evaluated = primary.evaluated, best = primary.best, bestOrder = primary.bestOrder, bestSeedOffset = primary.bestSeedOffset;
    if (targetFloor && best && floorIsBetter(targetFloor, best)) {
      const extraDeadline = performance.now() + budget.targetExtra;
      let altRestartCount = 0;
      while (performance.now() < extraDeadline && floorIsBetter(targetFloor, best)) {
        altRestartCount++;
        const altReqs = shuffled(eligibleReqsMaster, randomFn);
        const altGrouping = groupByDay(altReqs);
        const altBudget = Math.min(
          budget.altBase,
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
          },
          pins
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
      budget.minPolish,
      Math.floor(budget.polishTotal / attempts.length)
    );
    let completedAttempts = 0;
    const fromWorkers = await runPolishAttemptsInWorkers(
      { eligibleReqs, reqsByDay, daysWithReqs, pins },
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
          attempts[i].seedOffset,
          pins
        );
        completedAttempts++;
        if (onProgress) {
          onProgress(0.55 + completedAttempts / attempts.length * 0.45);
          await yieldToUI();
          checkGenerationCancelled();
        }
      }
      const attempt = dropSessionsForBalance(raw, pins);
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
    const pins = options.pins || [];
    const GREEDY_BASELINE_PROGRESS_SHARE = 0.08;
    const reusable = options.greedyResult && options.greedyResult.searchKey === greedySearchKey(options.greedyAttempts, pins);
    const greedyBaseline = reusable ? options.greedyResult : await generateCandidatesAsync(
      (p) => {
        if (onProgress) onProgress(p * GREEDY_BASELINE_PROGRESS_SHARE);
      },
      { attempts: options.greedyAttempts },
      pins
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
          targetFloor,
          pins,
          options.budgetScale
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
          if (missingPins(cand.assigned, pins).length) return null;
          return copyLayout({
            assigned: cand.assigned,
            unassignedMembers: cand.unassignedMembers || []
          });
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
            const own = copyLayout(best);
            cards[g] = {
              result: own,
              pool: bestPool.map((r) => r === best ? own : copyLayout(r))
            };
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
    let firstStartMinute = 0;
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
      const startMin = START_MIN + first.startSlot * SLOT_MIN;
      firstStartMinute = firstStartMinute ? Math.min(firstStartMinute, startMin) : startMin;
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
      firstStartMinute,
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
    consecutiveDay: "연속 요일 배정 제외 회원은 연속된 요일에 배정하지 않는다",
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
    const noConsecutive = new Set(state.noConsecutiveDayMemberIds || []);
    const daysByMember = /* @__PURE__ */ new Map();
    result.assigned.forEach((r) => {
      if (!noConsecutive.has(r.memberId)) return;
      if (!daysByMember.has(r.memberId)) daysByMember.set(r.memberId, /* @__PURE__ */ new Set());
      daysByMember.get(r.memberId).add(r.day);
    });
    daysByMember.forEach((days, id) => {
      days.forEach((d) => {
        if (days.has(d + 1)) add("consecutiveDay", `${id} ${d}·${d + 1}요일`);
      });
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
  var REPRESENTATIVE_ROLES = [
    { role: "recommended", label: "추천·균형" },
    { role: "sessions", label: "수업 수 우선·공강 허용" },
    { role: "sessionsNoIdle", label: "수업 수 우선·공강 없음" },
    { role: "travelTradeoff", label: "이동 절충·수업 수 우선" },
    { role: "unassignedSessions", label: "미배정 1명 추가·수업 증가" },
    { role: "unassignedTravel", label: "미배정 1명 추가·이동 감소" }
  ];
  var UNASSIGNED_TRADEOFF_MIN_SESSIONS = 2;
  var UNASSIGNED_TRADEOFF_MIN_TRAVEL = 2;
  function unassignedTradeoff(rec, m) {
    const plusOne = m.unassigned === rec.unassigned + 1;
    return {
      sessionsUp: plusOne && m.sessions - rec.sessions >= UNASSIGNED_TRADEOFF_MIN_SESSIONS,
      travelDown: plusOne && rec.travelCount - m.travelCount >= UNASSIGNED_TRADEOFF_MIN_TRAVEL
    };
  }
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
  function formatTradeoff(deltas) {
    return deltas.map(({ key, delta }) => formatDelta(key, delta)).join(" / ");
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
  function extreme(list, key, dir) {
    if (!list.length) return list;
    const top = Math.max(...list.map((e) => e.metrics[key] * dir));
    return list.filter((e) => e.metrics[key] * dir === top);
  }
  function pickRepresentative(role, rec, list) {
    const r = rec.metrics;
    const pick = (l) => l.length ? bestOf(l) : null;
    const same = list.filter((e) => e.metrics.unassigned === r.unassigned);
    switch (role) {
      case "recommended":
        return rec;
      case "sessions":
        return pick(extreme(same, "sessions", 1));
      case "sessionsNoIdle":
        return pick(
          extreme(
            same.filter((e) => e.metrics.idleMinutes === 0),
            "sessions",
            1
          )
        );
      case "travelTradeoff": {
        const top = pickRepresentative("sessions", rec, list).metrics;
        return pick(
          extreme(
            extreme(
              same.filter((e) => e.metrics.travelCount < top.travelCount),
              "sessions",
              1
            ),
            "travelCount",
            -1
          )
        );
      }
      case "unassignedSessions":
        return pick(
          extreme(
            extreme(
              list.filter((e) => unassignedTradeoff(r, e.metrics).sessionsUp),
              "sessions",
              1
            ),
            "travelCount",
            -1
          )
        );
      case "unassignedTravel":
        return pick(
          extreme(
            extreme(
              list.filter((e) => unassignedTradeoff(r, e.metrics).travelDown),
              "travelCount",
              -1
            ),
            "sessions",
            1
          )
        );
      default:
        throw new Error("unknown role " + role);
    }
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
    const m = (g) => head(g).metrics;
    const heads = groups.map(head);
    const rec = heads.length ? bestOf(heads) : null;
    const picks = /* @__PURE__ */ new Map();
    if (rec)
      REPRESENTATIVE_ROLES.forEach(({ role }) => {
        const e = pickRepresentative(role, rec, heads);
        picks.set(role, e ? groups.find((g) => head(g) === e) : null);
      });
    const deltasOf = (metrics) => rec ? tradeoffDeltas(rec.metrics, metrics) : [];
    let similarRemoved = 0, variantLimitRemoved = 0;
    const cardOfGroup = /* @__PURE__ */ new Map();
    const cards = [];
    const rows = REPRESENTATIVE_ROLES.map(({ role, label }) => {
      const g = picks.get(role) || null;
      if (!g) return { role, label, card: null };
      if (!cardOfGroup.has(g)) {
        const { kept, similar, overLimit } = pickVariants(g);
        similarRemoved += similar;
        variantLimitRemoved += overLimit;
        const card2 = {
          role,
          roles: [],
          label: "",
          metrics: m(g),
          variants: kept,
          deltas: deltasOf(m(g))
        };
        cardOfGroup.set(g, card2);
        cards.push(card2);
      }
      const card = cardOfGroup.get(g);
      card.roles.push({ role, label });
      card.label = card.roles.map((r) => r.label).join(" · ");
      return { role, label, card };
    });
    fixed.forEach(
      (e) => cards.push({
        role: "edited",
        roles: [],
        label: "내가 수정한 후보",
        metrics: e.metrics,
        variants: [e],
        deltas: deltasOf(e.metrics)
      })
    );
    const count = (list) => list.reduce((n, g) => n + g.length, 0);
    return {
      cards,
      rows,
      stats: {
        generated: entries.length,
        fixedCards: fixedCount,
        mergedIntoFixed,
        exactUnique: unique.length,
        exactDuplicates: autoEntries.length - unique.length - mergedIntoFixed,
        qualityGroups: groups.length,
        shownGroups: cardOfGroup.size,
        notShownLayouts: count(groups.filter((g) => !cardOfGroup.has(g))),
        rolesFound: rows.filter((r) => r.card).length,
        similarRemoved,
        variantLimitRemoved,
        cardsShown: cards.length
      }
    };
  }
  function representativeAdditions(entries, extra, isValid = () => true) {
    let rest = extra;
    for (; ; ) {
      const inRest = new Set(rest);
      const picked = selectCandidates(entries.concat(rest)).cards.flatMap((c) => c.variants).filter((e) => inRest.has(e));
      const bad = new Set(picked.filter((e) => !isValid(e.result)));
      if (!bad.size) return picked;
      rest = rest.filter((e) => !bad.has(e));
    }
  }
  function keepsSessions(current, result) {
    return result.unassignedMembers.length <= current.unassignedMembers.length && result.assigned.length >= current.assigned.length;
  }
  var STABILITY_KEYS = [
    "changedMembers",
    "changedSessions",
    "dayChanges",
    "locationChanges",
    "startOnlyChanges"
  ];
  function byStability(current) {
    const cache = /* @__PURE__ */ new Map();
    const counts = (e) => {
      if (!cache.has(e.result))
        cache.set(e.result, assignmentDiff(current, e.result).counts);
      return cache.get(e.result);
    };
    return (x, y) => {
      for (const k of STABILITY_KEYS) {
        const d = counts(x)[k] - counts(y)[k];
        if (d) return d;
      }
      return 0;
    };
  }
  function revertUnneededChanges(current, pins, base) {
    let result = base;
    for (let progress = true; progress; ) {
      progress = false;
      for (const { memberId } of assignmentDiff(current, result).members) {
        const cand = {
          assigned: result.assigned.filter((a) => a.memberId !== memberId).concat(current.assigned.filter((a) => a.memberId === memberId)),
          unassignedMembers: result.unassignedMembers.filter((m) => m.id !== memberId).concat(current.unassignedMembers.filter((m) => m.id === memberId))
        };
        if (missingPins(cand.assigned, pins).length || scheduleViolations(cand).length || !keepsSessions(current, cand) || isSchedule2ResultBetter(base, cand))
          continue;
        result = cand;
        progress = true;
      }
    }
    return result;
  }
  function selectReoptimization(current, results, pins) {
    const stats = { results: results.length, missingPins: 0, hardViolations: 0, fewerSessions: 0 };
    const passed = results.filter((r) => {
      if (missingPins(r.assigned, pins).length) return stats.missingPins++, false;
      if (scheduleViolations(r).length) return stats.hardViolations++, false;
      return true;
    });
    stats.passed = passed.length;
    const none = (reason) => ({ status: "no-better", reason, proposal: null, variants: [], improving: [], stats });
    if (!passed.length) return none("none");
    const eligible = passed.filter((r) => keepsSessions(current, r));
    stats.fewerSessions = passed.length - eligible.length;
    const bestIn = (list) => list.reduce((x, y) => isSchedule2ResultBetter(y, x) ? y : x);
    const best = eligible.length ? bestIn(eligible) : null;
    if (!best || !isSchedule2ResultBetter(best, current)) {
      if (passed.some((r) => !keepsSessions(current, r) && isSchedule2ResultBetter(r, current)))
        return none("fewer-sessions");
      if (!best || isSchedule2ResultBetter(current, best)) return none("worse");
      const cur = layoutSignature(current);
      return none(eligible.some((r) => layoutSignature(r) === cur) ? "same-layout" : "equal-quality");
    }
    const seen = /* @__PURE__ */ new Set();
    const improving = eligible.filter((r) => isSchedule2ResultBetter(r, current)).filter((r) => {
      const sig = layoutSignature(r);
      return !seen.has(sig) && seen.add(sig);
    }).map((result) => ({ result, metrics: scheduleMetrics(result) }));
    const stable = byStability(current);
    const byStableThenSignature = (x, y) => stable(x, y) || byTravelThenSignature(x, y);
    const group = improving.filter((e) => !isSchedule2ResultBetter(best, e.result)).sort(byStableThenSignature);
    const revSeen = /* @__PURE__ */ new Set();
    const reverted = pickVariants(group).kept.map((e) => revertUnneededChanges(current, pins, e.result)).filter((r) => {
      const sig = layoutSignature(r);
      return !revSeen.has(sig) && revSeen.add(sig);
    }).map((result) => ({ result, metrics: scheduleMetrics(result) }));
    const top = bestIn(reverted.map((e) => e.result));
    const { kept } = pickVariants(
      reverted.filter((e) => !isSchedule2ResultBetter(top, e.result)).sort(byStableThenSignature)
    );
    return { status: "improved", reason: null, proposal: kept[0], variants: kept, improving, stats };
  }

  // src/engine/memberExclusion.js
  var MEMBER_EXCLUSION_ATTEMPTS = Math.max(
    2,
    Math.round(200 * TEST_BUDGET_SCALE)
  );
  var EXCLUSION_ROLES = ["unassignedSessions", "unassignedTravel"];
  function memberExclusionTargets(rec) {
    const unassigned = new Set(rec.unassignedMembers.map((m) => m.id));
    return [...new Set(rec.assigned.map((r) => r.memberId))].filter((id) => !unassigned.has(id) && memberById(id)).sort();
  }
  function exclusionRepresentatives(rec, member, pool) {
    const seen = /* @__PURE__ */ new Set();
    const entries = [];
    pool.forEach((r) => {
      if (!r) return;
      const result = {
        assigned: r.assigned,
        unassignedMembers: r.unassignedMembers.filter((m) => m.id !== member.id).concat(member),
        excludedMemberId: member.id
      };
      const sig = layoutSignature(result);
      if (seen.has(sig)) return;
      seen.add(sig);
      const metrics = scheduleMetrics(result);
      const q = unassignedTradeoff(rec.metrics, metrics);
      if ((q.sessionsUp || q.travelDown) && !scheduleViolations(result).length)
        entries.push({ result, metrics });
    });
    return [
      ...new Set(
        EXCLUSION_ROLES.map((role) => pickRepresentative(role, rec, entries)).filter(
          Boolean
        )
      )
    ].map((e) => e.result);
  }
  async function searchMemberExclusions(rec, {
    attempts = MEMBER_EXCLUSION_ATTEMPTS,
    workerOptions = {},
    onMember = () => {
    },
    onProgress = () => {
    },
    onFound = () => {
    }
  } = {}) {
    const ids = memberExclusionTargets(rec.result);
    let found = 0;
    for (let i = 0; i < ids.length; i++) {
      const member = memberById(ids[i]);
      onMember(i, ids.length, member);
      checkGenerationCancelled();
      const inSelection = (fn) => withSelectionOverrideSync(
        state.excludedMemberIds3.concat(member.id),
        state.onceLimitedMemberIds3,
        fn
      );
      const { eligible, eligibleIds, allMemberIds } = inSelection(greedySearchInputs);
      const pool = await buildGreedySearchPool(
        eligible,
        eligibleIds,
        allMemberIds,
        (p) => onProgress(i, ids.length, p),
        { ...workerOptions, attempts },
        [],
        inSelection
      );
      const picked = exclusionRepresentatives(rec, member, pool);
      found += picked.length;
      onFound(picked);
    }
    return { members: ids.length, found };
  }

  // src/engine/localReoptimize.js
  var IMPACT_LEVELS = ["L1", "L2", "L3", "full"];
  var LOCAL_LEVELS = ["L1", "L2", "L3"];
  var LOCAL_REOPTIMIZE_BUDGET_SCALE = 0.1;
  function levelPlan(level) {
    return level === "full" ? { withBC: true, budgetScale: void 0 } : { withBC: false, budgetScale: LOCAL_REOPTIMIZE_BUDGET_SCALE };
  }
  async function generateForLevel(level, pins, engines) {
    const plan = levelPlan(level);
    const bc = plan.withBC ? await engines.bc(pins) : [];
    const a = await engines.a(pins, plan.budgetScale);
    return { bc, a };
  }
  function proposalSource(proposal, gen) {
    const sig = layoutSignature(proposal);
    const has = (list) => list.some((r) => r && layoutSignature(r) === sig);
    const inA = has(gen.a), inBC = has(gen.bc);
    return inA && inBC ? "A+BC" : inA ? "A" : inBC ? "BC" : "R";
  }
  var asPin = (a) => ({
    id: a.id,
    memberId: a.memberId,
    day: a.day,
    startSlot: a.startSlot,
    duration: a.duration,
    locationId: a.locationId
  });
  function impactRegion(current, userPins, level, origins = []) {
    if (!IMPACT_LEVELS.includes(level))
      throw new Error("알 수 없는 영향 범위 Level: " + level);
    const userKeys = new Set(userPins.map(pinKey));
    const free = current.assigned.filter((a) => !userKeys.has(pinKey(a)));
    const open = /* @__PURE__ */ new Set();
    if (level === "full") free.forEach((a) => open.add(a));
    else if (level === "L1") {
      const around = (day, slot) => {
        const list = free.filter((a) => a.day === day).sort((a, b) => a.startSlot - b.startSlot);
        const next = list.findIndex((a) => a.startSlot >= slot);
        const before = next < 0 ? list[list.length - 1] : list[next - 1];
        [before, list[next]].forEach((a) => a && open.add(a));
      };
      userPins.forEach((p) => around(p.day, p.startSlot));
      origins.forEach((o) => around(o.day, o.startSlot));
    } else {
      const days = new Set(userPins.concat(origins).map((x) => x.day));
      free.filter((a) => days.has(a.day)).forEach((a) => open.add(a));
      if (level === "L3") {
        const members = new Set(
          userPins.map((p) => p.memberId).concat([...open].map((a) => a.memberId))
        );
        free.filter((a) => members.has(a.memberId)).forEach((a) => open.add(a));
      }
    }
    const temp = free.filter((a) => !open.has(a));
    return {
      pins: userPins.concat(temp.map(asPin)),
      movable: free.filter((a) => open.has(a)),
      total: current.assigned.length,
      userPinned: current.assigned.length - free.length,
      tempPinned: temp.length
    };
  }
  async function runImpactLevels(current, userPins, origins, reoptimize, levels = IMPACT_LEVELS) {
    const out = [];
    let prev = null;
    for (const level of levels) {
      const region = impactRegion(current, userPins, level, origins);
      const key = region.movable.map(pinKey).sort().join(",");
      if (!region.movable.length) {
        out.push({ level, region, outcome: null, ms: 0, skipped: "empty" });
        continue;
      }
      if (prev && prev.key === key) {
        out.push({ level, region, outcome: prev.entry.outcome, ms: 0, sameAs: prev.entry.level });
        continue;
      }
      const t = Date.now();
      const outcome = await reoptimize(region.pins, level);
      const entry = { level, region, outcome, ms: Date.now() - t };
      out.push(entry);
      prev = { key, entry };
    }
    return out;
  }
  var ORIGIN_STATUS = {
    known: "known",
    // 원래 위치를 믿을 수 있게 앎(origins 1개 이상)
    noMove: "no-move",
    // 생성 이후 기록이 온전하고, 고정한 수업 중 옮겨서 자리를 비운 것이 없음
    afterApply: "after-apply",
    // 마지막 재최적화 적용 이후 옮긴 고정 수업 없음(적용 이전 기록은 무시)
    noHistory: "no-history",
    // 되돌리기 기록 없음(새로고침 등)
    truncated: "truncated",
    // 되돌리기 기록이 한도를 넘어 잘림 — 기준 상태를 모름
    ambiguous: "ambiguous"
    // 비운 자리와 옮긴 고정 수업을 짝지을 수 없음
  };
  function originsFromHistory(current, userPins, stack) {
    const none = (status) => ({ origins: [], status });
    const snaps = stack || [];
    let applied = -1;
    for (let i = snaps.length - 1; i >= 0 && applied < 0; i--)
      if (snaps[i].reoptApplied) applied = i;
    if (applied < 0 && stack && stack.truncated) return none(ORIGIN_STATUS.truncated);
    if (!snaps.length) return none(ORIGIN_STATUS.noHistory);
    const base = applied < 0 ? snaps[0] : snaps[applied + 1] || current;
    const baseKeys = new Set(base.assigned.map(pinKey));
    const nowKeys = new Set(current.assigned.map(pinKey));
    const pinKeys = new Set(userPins.map(pinKey));
    const origins = [];
    for (const memberId of new Set(userPins.map((p) => p.memberId))) {
      const vacated = base.assigned.filter((a) => a.memberId === memberId && !nowKeys.has(pinKey(a)));
      const added = current.assigned.filter((a) => a.memberId === memberId && !baseKeys.has(pinKey(a)));
      const p = added.filter((a) => pinKeys.has(pinKey(a))).length;
      if (p === 0) continue;
      if (added.length > p || vacated.length > p) return none(ORIGIN_STATUS.ambiguous);
      for (const a of vacated) origins.push({ day: a.day, startSlot: a.startSlot });
    }
    if (origins.length) return { origins, status: ORIGIN_STATUS.known };
    return none(applied < 0 ? ORIGIN_STATUS.noMove : ORIGIN_STATUS.afterApply);
  }
  var regionKey = (r) => r.movable.map(pinKey).sort().join(",");
  function createLocalSearch(current, userPins, origins = []) {
    return {
      current,
      userPins,
      origins,
      next: 0,
      lastKey: null,
      fullKey: regionKey(impactRegion(current, userPins, "full", origins)),
      steps: []
    };
  }
  function examine(search, i, lastKey) {
    const level = LOCAL_LEVELS[i];
    const region = impactRegion(search.current, search.userPins, level, search.origins);
    const key = regionKey(region);
    const skipped = !region.movable.length ? "empty" : key === lastKey ? "same-as-previous" : key === search.fullKey ? "same-as-full" : null;
    return { level, region, key, skipped };
  }
  function nextLocalLevel(search) {
    let lastKey = search.lastKey;
    for (let i = search.next; i < LOCAL_LEVELS.length; i++) {
      const e = examine(search, i, lastKey);
      if (!e.skipped) return e.level;
      if (e.region.movable.length) lastKey = e.key;
    }
    return null;
  }
  async function continueLocalSearch(search, reoptimize, stopWhen) {
    while (search.next < LOCAL_LEVELS.length) {
      const e = examine(search, search.next, search.lastKey);
      if (e.skipped) {
        search.next++;
        if (e.region.movable.length) search.lastKey = e.key;
        search.steps.push({ level: e.level, skipped: e.skipped });
        continue;
      }
      const outcome = await reoptimize(e.region.pins, e.level);
      search.next++;
      search.lastKey = e.key;
      search.steps.push({ level: e.level, status: outcome.status });
      if (stopWhen(outcome)) return { level: e.level, region: e.region, outcome };
    }
    return null;
  }
  function addWiderProposal(proposals, entry) {
    const best = proposals[proposals.length - 1];
    if (best && !isSchedule2ResultBetter(entry.variants[0].result, best.variants[0].result))
      return false;
    proposals.push(entry);
    return true;
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
      memberHintEls.some((el2) => el2.textContent !== "")
    );
  }
  function setMemberHint(el2, message, isError) {
    el2.textContent = message;
    el2.classList.toggle("generate-hint-error", !!isError);
    syncMemberHintSpacing();
  }
  function clearMemberHints() {
    memberHintEls.forEach((el2) => {
      el2.textContent = "";
      el2.classList.remove("generate-hint-error");
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
  var JOINED_MARK_MAX_GAP_MIN = 60;
  function groupConsecutiveMarks(marks, continuous = false) {
    const groups = [];
    let current = [];
    marks.forEach((mark) => {
      if (current.length > 0) {
        const prevHour24 = current[current.length - 1].hour % 12 + 12;
        const hour24 = mark.hour % 12 + 12;
        const prev = current[current.length - 1];
        const gap = hour24 * 60 + mark.minute - (prevHour24 * 60 + prev.minute);
        const joinable = gap > 0 && gap <= JOINED_MARK_MAX_GAP_MIN || continuous && hour24 === prevHour24 + 1;
        if (!joinable) {
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
    const leftAt = leftHour24 * 60 + leftMark.minute;
    const rightAt = rightHour24 * 60 + rightMark.minute;
    if (rightAt < leftAt) return null;
    if (rightAt === leftAt)
      return [{ hour: leftMark.hour, minute: leftMark.minute }];
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
  function allHourDigitSplits(digits, limit = 20) {
    const completable = /* @__PURE__ */ new Map();
    const pieces = (rest) => {
      const out = [];
      for (const len of [2, 1]) {
        if (rest.length < len) continue;
        const hour = parseInt(rest.slice(0, len), 10);
        const valid = len === 2 ? hour >= 10 && hour <= 12 : hour >= 1;
        if (!valid) continue;
        const after = rest.slice(len);
        HOUR_DIGIT_MINUTE_SUFFIXES.forEach((minute) => {
          if (after.slice(0, 2) === String(minute))
            out.push({ mark: { hour, minute }, rest: after.slice(2) });
        });
        out.push({ mark: { hour, minute: 0 }, rest: after });
      }
      return out;
    };
    const canFinish = (rest) => {
      if (rest === "") return true;
      if (!completable.has(rest))
        completable.set(
          rest,
          pieces(rest).some((p) => canFinish(p.rest))
        );
      return completable.get(rest);
    };
    const splits = [];
    (function walk(rest, acc) {
      if (splits.length >= limit) return;
      if (rest === "") {
        splits.push(acc);
        return;
      }
      pieces(rest).forEach((p) => {
        if (canFinish(p.rest)) walk(p.rest, acc.concat([p.mark]));
      });
    })(digits, []);
    return splits;
  }
  function hourMarkReadings(s) {
    if (s.includes(":")) {
      const marks = parseHourMarks(s);
      return marks ? [marks] : [];
    }
    if (/^(1[0-2]|[1-9])$/.test(s))
      return [[{ hour: parseInt(s, 10), minute: 0 }]];
    const readings = [];
    if (/^\d{3,4}$/.test(s)) {
      const hour = parseInt(s.slice(0, -2), 10);
      const minute = parseInt(s.slice(-2), 10);
      if (hour >= 1 && hour <= 12 && minute < 60 && minute % SLOT_MIN === 0)
        readings.push([{ hour, minute }]);
    }
    const same = (a, b) => a.length === b.length && a.every((m, i) => m.hour === b[i].hour && m.minute === b[i].minute);
    allHourDigitSplits(s).forEach((split) => {
      if (!readings.some((r) => same(r, split))) readings.push(split);
    });
    return readings;
  }
  function marksInTimeOrder(marks) {
    const at = (m) => (m.hour % 12 + 12) * 60 + m.minute;
    return marks.every((m, i) => i === 0 || at(m) > at(marks[i - 1]));
  }
  function parseTimeToken(token) {
    const originalToken = token;
    token = token.replace(/-/g, "~");
    token = token.replace(
      /(\d{1,2})시(\d{1,2})분/g,
      (_, hour, minute) => hour + ":" + minute.padStart(2, "0")
    );
    token = token.replace(/(\d)시/g, "$1");
    const LATE_MARK = { hour: 10, minute: 30 };
    let hasLateMark = false;
    if (token.endsWith("늦은시간")) {
      hasLateMark = true;
      token = token.slice(0, -"늦은시간".length);
    }
    function withLateMark(result) {
      if (!hasLateMark || result.error) return result;
      result.extraPoints = (result.extraPoints || []).concat([LATE_MARK]);
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
    let candidates;
    let ambiguousPart = clean;
    let failMessage = '시간 해석 실패: "' + originalToken + '"';
    if (tildeCount === 1) {
      const [leftStr, rightStr] = clean.split("~");
      failMessage = '구간 표기 해석 실패: "' + originalToken + '"';
      if (leftStr !== "" && rightStr !== "") {
        const ends = (str) => hourMarkReadings(str).filter((m) => m.length === 1);
        const lefts = ends(leftStr);
        const rights = ends(rightStr);
        ambiguousPart = lefts.length > 1 ? leftStr : rightStr;
        candidates = [];
        lefts.forEach(
          ([l]) => rights.forEach(([r]) => {
            const marks = expandHourRange(l, r);
            if (marks)
              candidates.push({
                spec: { type: "point", marks, range: true },
                unordered: false
              });
          })
        );
        if (lefts.length && rights.length && !candidates.length)
          failMessage = '시작이 끝보다 늦은 범위입니다: "' + originalToken + '"';
      } else if (rightStr === "") {
        ambiguousPart = leftStr;
        candidates = hourMarkReadings(leftStr).filter((marks) => marks.length > 0).map((marks) => ({
          spec: {
            type: "openStart",
            mark: marks[marks.length - 1],
            extraPoints: marks.slice(0, -1)
          },
          unordered: !marksInTimeOrder(marks)
        }));
      } else {
        ambiguousPart = rightStr;
        candidates = hourMarkReadings(rightStr).filter((marks) => marks.length > 0).map((marks) => ({
          spec: {
            type: "openEnd",
            mark: marks[0],
            extraPoints: marks.slice(1)
          },
          unordered: !marksInTimeOrder(marks)
        }));
      }
    } else {
      candidates = [];
      hourMarkReadings(clean).forEach((marks) => {
        const unordered = !marksInTimeOrder(marks);
        candidates.push({ spec: { type: "point", marks }, unordered });
        if (groupConsecutiveMarks(marks, true).length !== groupConsecutiveMarks(marks).length)
          candidates.push({
            spec: { type: "point", marks, continuous: true },
            unordered
          });
      });
    }
    const options = [];
    candidates.forEach(({ spec, unordered }) => {
      withLateMark(spec);
      const key = describeClockOption(spec);
      if (!options.some((o) => o.key === key))
        options.push({ key, spec, unordered });
    });
    if (options.length === 0) return { error: failMessage, warning };
    if (options.length === 1 && !options[0].unordered)
      return Object.assign(options[0].spec, { warning });
    return { ambiguous: true, token: ambiguousPart, warning, options };
  }
  var MAX_TIME_CHOICES = 4;
  function pointSpecGroups(spec) {
    return spec.range ? [spec.marks] : groupConsecutiveMarks(spec.marks, spec.continuous);
  }
  var markMinutes = (mark) => (mark.hour % 12 + 12) * 60 + mark.minute;
  function daySpecItems(specs) {
    const items = [];
    specs.forEach((spec, specIndex) => {
      const add = (groups) => groups.forEach((marks) => items.push({ marks, specIndex }));
      const extra = groupConsecutiveMarks(spec.extraPoints || []);
      if (spec.type === "point") {
        add(pointSpecGroups(spec));
        add(extra);
      } else if (spec.type === "openStart") {
        add(extra);
        items.push({ openStart: spec.mark });
      } else if (spec.type === "openEnd") {
        items.push({ openEnd: spec.mark });
        add(extra);
      }
    });
    return items.reduce((joined, item) => {
      const prev = joined[joined.length - 1];
      const gap = prev && prev.marks && item.marks && prev.specIndex !== item.specIndex ? markMinutes(item.marks[0]) - markMinutes(prev.marks[prev.marks.length - 1]) : 0;
      if (gap > 0 && gap <= JOINED_MARK_MAX_GAP_MIN)
        joined[joined.length - 1] = {
          marks: prev.marks.concat(item.marks),
          specIndex: item.specIndex
        };
      else joined.push(item);
      return joined;
    }, []);
  }
  function groupLabel(group) {
    return group.length > 1 ? hourMarkLabel(group[0]) + "~" + hourMarkLabel(group[group.length - 1]) : hourMarkLabel(group[0]);
  }
  function describeClockOption(spec) {
    const groups = (groupsOfMarks) => groupsOfMarks.map(
      (group) => group.length > 1 ? hourMarkLabel(group[0]) + "~" + hourMarkLabel(group[group.length - 1]) + " 사이 시작" : hourMarkLabel(group[0]) + " 시작"
    );
    const extra = groups(groupConsecutiveMarks(spec.extraPoints || []));
    let parts;
    if (spec.type === "openStart")
      parts = extra.concat([hourMarkLabel(spec.mark) + "~마감"]);
    else if (spec.type === "openEnd")
      parts = ["시작~" + hourMarkLabel(spec.mark)].concat(extra);
    else parts = groups(pointSpecGroups(spec)).concat(extra);
    return parts.join(" · ");
  }
  function existingLocationId(name) {
    const loc = findLocationByLooseName(name);
    return loc ? loc.id : null;
  }
  function parseBulkImportLine(line, resolveLocation = existingLocationId, sectionLocationId = null, resolutions = []) {
    const tokens = line.replace(/\//g, ",").replace(/(\d)\s*시\s*(\d{1,2})\s*분/g, "$1시$2분").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    const name = tokens[0];
    const result = {
      raw: line.trim(),
      name,
      days: [],
      warnings: [],
      errors: [],
      ambiguities: [],
      // [{ token, options:[{ key, spec, unordered }], choice: key | null }]
      locationIds: [],
      // 괄호로 적은 지점(시간 해석과 무관, 신규 회원 기본 지점 추론용)
      clearAll: false
    };
    if (tokens.length === 2 && /^x$/i.test(tokens[1])) {
      result.clearAll = true;
      return result;
    }
    let currentDays = null;
    let currentLocationId = sectionLocationId;
    let currentLocationUnknown = false;
    function applyTimeToken(tok) {
      if (currentLocationUnknown) return;
      if (!currentDays) {
        result.errors.push(
          '요일 지정 전에 나온 시간 표기라 건너뜁니다: "' + tok + '"'
        );
        return;
      }
      let parsed = parseTimeToken(tok);
      if (parsed.warning) result.warnings.push(parsed.warning);
      if (parsed.error) {
        result.errors.push(parsed.error);
        return;
      }
      if (parsed.ambiguous) {
        const picked = parsed.options.find(
          (o) => o.key === resolutions[result.ambiguities.length]
        );
        result.ambiguities.push({
          token: parsed.token,
          options: parsed.options,
          choice: picked ? picked.key : null
        });
        if (!picked) return;
        parsed = picked.spec;
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
        const locId = resolveLocation(locMatch[1].trim());
        currentLocationId = locId;
        currentLocationUnknown = !locId;
        if (locId && !result.locationIds.includes(locId))
          result.locationIds.push(locId);
        if (!locId)
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
          applyTimeToken(tok);
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
  function parseBulkSectionHeader(line) {
    const m = line.trim().match(/^[[［]\s*([^\]］]+?)\s*[\]］]$/);
    return m ? m[1] : null;
  }
  function planBulkImport(text) {
    const newLocations = [];
    const resolveLocation = bulkLocationResolver(newLocations);
    let sectionLocationId = null;
    const rows = [];
    text.split("\n").forEach((line, lineIndex) => {
      const header = parseBulkSectionHeader(line);
      if (header !== null) {
        sectionLocationId = resolveLocation(header);
        return;
      }
      const parsed = parseBulkImportLine(
        line,
        resolveLocation,
        sectionLocationId
      );
      if (!parsed) return;
      rows.push({
        parsed,
        line,
        lineIndex,
        sectionLocationId,
        choice: bulkMemberChoice(parsed.name),
        newLocationId: defaultNewLocationId(parsed, sectionLocationId),
        newCategory: "등록"
      });
    });
    return { rows, newLocations };
  }
  function bulkLocationResolver(newLocations) {
    const bare = (n) => n.replace(/점$/, "");
    return (name) => {
      const existing = existingLocationId(name);
      if (existing) return existing;
      let pending = newLocations.find((l) => bare(l.name) === bare(name));
      if (!pending) {
        const defaultName = DEFAULT_LOCATION_NAMES.find(
          (n) => bare(n) === bare(name)
        );
        pending = { id: uid("loc"), name: defaultName || name };
        newLocations.push(pending);
      }
      return pending.id;
    };
  }
  function defaultNewLocationId(parsed, sectionLocationId) {
    return sectionLocationId || parsed.locationIds[0] || (state.locations[0] ? state.locations[0].id : "");
  }
  function bulkMemberChoice(name) {
    const matches = findMembersByName(name);
    if (matches.length === 0) return "__new__";
    return matches.length === 1 ? matches[0].id : "";
  }
  function reparseBulkRow(plan, row, line, resolutions) {
    if (parseBulkSectionHeader(line) !== null)
      return { error: "지점 제목 줄은 '뒤로'에서 고쳐주세요." };
    const parsed = parseBulkImportLine(
      line,
      bulkLocationResolver(plan.newLocations),
      row.sectionLocationId,
      resolutions
    );
    if (!parsed) return { error: "이름과 요일·시간을 적어주세요." };
    if (parsed.name !== row.parsed.name)
      row.choice = bulkMemberChoice(parsed.name);
    if (!row.newLocationId)
      row.newLocationId = defaultNewLocationId(parsed, row.sectionLocationId);
    row.parsed = parsed;
    row.line = line;
    return {};
  }
  function chooseBulkAmbiguity(plan, row, index, key) {
    const resolutions = row.parsed.ambiguities.map((a) => a.choice);
    resolutions[index] = key;
    return reparseBulkRow(plan, row, row.line, resolutions);
  }
  function editBulkImportRow(plan, row, line) {
    return reparseBulkRow(plan, row, line, []);
  }
  function hasUnresolvedTime(row) {
    return row.parsed.ambiguities.some((a) => !a.choice);
  }
  function createsNewMember(row) {
    return row.parsed.days.length > 0 || row.parsed.clearAll || row.parsed.ambiguities.length > 0;
  }
  function applyBulkImportPlan(plan) {
    const editing = plan.rows.filter(
      (r) => r.draftLine !== void 0 && r.draftLine.trim() !== r.line.trim()
    );
    if (editing.length)
      return {
        error: "고치는 중인 줄이 있습니다. 그 줄의 '적용'(고친 내용 반영) 또는 '취소'를 먼저 눌러주세요: " + editing.map((r) => r.parsed.name).join(", ")
      };
    const active = plan.rows.filter((r) => r.choice !== "__skip__");
    const unchosen = active.filter((r) => r.choice === "");
    if (unchosen.length)
      return {
        error: "같은 이름의 회원이 여러 명입니다. 미리보기에서 회원을 골라주세요: " + unchosen.map((r) => r.parsed.name).join(", ")
      };
    const unresolved = active.filter(hasUnresolvedTime);
    if (unresolved.length)
      return {
        error: "시간 해석을 확인해야 하는 줄이 있습니다. 미리보기에서 해석을 고르거나, '수정'으로 줄을 고치거나, 건너뛰기로 바꿔주세요: " + unresolved.map((r) => r.parsed.name).join(", ")
      };
    const noLocation = active.filter(
      (r) => r.choice === "__new__" && createsNewMember(r) && !r.newLocationId
    );
    if (noLocation.length)
      return {
        error: "신규 회원의 지점을 정할 수 없습니다. 지점 제목([지점])을 붙이거나 설정에서 지점을 먼저 등록해주세요: " + noLocation.map((r) => r.parsed.name).join(", ")
      };
    const usedLocationIds = /* @__PURE__ */ new Set();
    active.forEach((r) => {
      if (r.choice === "__new__" && createsNewMember(r))
        usedLocationIds.add(r.newLocationId);
      r.parsed.days.forEach((d) => usedLocationIds.add(d.locationId));
    });
    const createdLocations = plan.newLocations.filter((l) => usedLocationIds.has(l.id)).map((l) => addLocation(l.name, void 0, l.id));
    const report = {
      createdLocations,
      createdCount: 0,
      appliedCount: 0,
      zeroFitNames: [],
      // 파싱은 됐지만 마감 시간 등으로 실제 등록된 시간이 하나도 없는 회원
      emptyRowNames: [],
      // 신규 회원인데 등록할 시간이 없어 건너뛴 줄
      clearedNames: [],
      // 기존 회원이고 "이름 x"로 명시 지정해 기존 스케줄을 모두 지운 회원
      unparsedSkippedNames: []
      // 기존 회원인데 오타 등으로 파싱이 안 돼(명시적 x가 아님) 건드리지 않고 건너뛴 줄
    };
    const entriesByMemberKey = /* @__PURE__ */ new Map();
    active.forEach((row) => {
      let member, isNew = false, key;
      if (row.choice === "__new__") {
        if (!createsNewMember(row)) {
          report.emptyRowNames.push(row.parsed.name);
          return;
        }
        key = "new:" + row.parsed.name;
        member = entriesByMemberKey.has(key) ? entriesByMemberKey.get(key).member : {
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
        key = member.id;
      }
      if (!entriesByMemberKey.has(key)) {
        entriesByMemberKey.set(key, {
          member,
          isNew,
          days: /* @__PURE__ */ new Map(),
          explicitClear: false
        });
      }
      const entry = entriesByMemberKey.get(key);
      if (row.parsed.clearAll) entry.explicitClear = true;
      row.parsed.days.forEach((dayEntry) => {
        const dayKey = dayEntry.day + "|" + (dayEntry.locationId || "");
        if (!entry.days.has(dayKey))
          entry.days.set(dayKey, {
            day: dayEntry.day,
            locationId: dayEntry.locationId,
            specs: []
          });
        entry.days.get(dayKey).specs.push(...dayEntry.specs);
      });
    });
    entriesByMemberKey.forEach((entry) => {
      const member = entry.member;
      if (entry.isNew) {
        state.members.unshift(member);
        report.createdCount++;
      } else if (entry.days.size === 0 && !entry.explicitClear) {
        report.unparsedSkippedNames.push(member.name);
        return;
      }
      state.requests = state.requests.filter((r) => r.memberId !== member.id);
      let addedForMember = 0;
      let day, locId;
      function addRange(startSlot, endSlot) {
        addedForMember += addDesiredRange(member, day, startSlot, endSlot, locId);
      }
      [...entry.days.values()].sort((a, b) => !!a.locationId - !!b.locationId).forEach((dayEntry) => {
        day = dayEntry.day;
        locId = dayEntry.locationId;
        daySpecItems(dayEntry.specs).forEach((item) => {
          if (item.marks)
            addRange(
              hourMarkToStartSlot(item.marks[0]),
              hourMarkToStartSlot(item.marks[item.marks.length - 1])
            );
          else if (item.openStart)
            addRange(hourMarkToStartSlot(item.openStart), SLOT_COUNT);
          else addRange(0, hourMarkToStartSlot(item.openEnd));
        });
      });
      report.appliedCount++;
      if (entry.days.size === 0) {
        if (!entry.isNew) report.clearedNames.push(member.name);
      } else if (addedForMember === 0) {
        report.zeroFitNames.push(member.name);
      }
    });
    return report;
  }
  function describeDaySpecs(specs) {
    return daySpecItems(specs).map(
      (item) => item.marks ? groupLabel(item.marks) : item.openStart ? hourMarkLabel(item.openStart) + "~마감" : "시작~" + hourMarkLabel(item.openEnd)
    ).join(", ");
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
  var bulkImportPlan = { rows: [], newLocations: [] };
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
  function bulkLocationLabel(locId) {
    const loc = locationById(locId);
    if (loc) return loc.name;
    const pending = bulkImportPlan.newLocations.find((l) => l.id === locId);
    return pending ? pending.name + "·새 지점" : "";
  }
  function renderBulkImportSummary() {
    const rows = bulkImportPlan.rows;
    const newNames = new Set(
      rows.filter((r) => r.choice === "__new__" && createsNewMember(r)).map((r) => r.parsed.name)
    );
    const linked = new Set(
      rows.filter((r) => memberById(r.choice)).map((r) => r.choice)
    );
    const unchosen = rows.filter((r) => r.choice === "").length;
    const unresolved = rows.filter(
      (r) => r.choice !== "__skip__" && hasUnresolvedTime(r)
    ).length;
    const skipped = rows.filter((r) => r.choice === "__skip__").length;
    const parts = [];
    if (bulkImportPlan.newLocations.length)
      parts.push(
        "생성 예정 지점 " + bulkImportPlan.newLocations.map((l) => l.name).join("·")
      );
    parts.push("신규 회원 " + newNames.size + "명");
    parts.push("기존 회원 연결 " + linked.size + "명");
    if (unchosen) parts.push("동명이인 선택 필요 " + unchosen + "명");
    if (unresolved) parts.push("해석 확인 필요 " + unresolved + "줄");
    parts.push("건너뛰기 " + skipped + "명");
    bulkImportPreviewSummaryEl.textContent = "";
    bulkImportPreviewSummaryEl.append(
      parts.join(" · "),
      document.createElement("br"),
      "적용 대상 회원의 기존 스케줄은 모두 지우고 아래 내용으로 교체합니다. '일괄 등록'을 누르기 전에는 아무것도 바뀌지 않습니다."
    );
  }
  function renderBulkImportPreview() {
    const plan = planBulkImport(bulkImportTextareaEl.value);
    if (plan.rows.length === 0) {
      alert("붙여넣은 내용이 없습니다.");
      return;
    }
    bulkImportPlan = plan;
    bulkImportPreviewListEl.innerHTML = "";
    plan.rows.forEach(
      (row) => bulkImportPreviewListEl.appendChild(renderBulkPreviewRow(row))
    );
    renderBulkImportSummary();
    bulkImportStepInputEl.hidden = true;
    bulkImportStepPreviewEl.hidden = false;
  }
  function renderBulkPreviewRow(row) {
    const plan = bulkImportPlan;
    const parsed = row.parsed;
    const matches = findMembersByName(parsed.name);
    function rerender() {
      rowEl.replaceWith(renderBulkPreviewRow(row));
      renderBulkImportSummary();
    }
    const rowEl = document.createElement("div");
    rowEl.className = "bulk-preview-row";
    const head = document.createElement("div");
    head.className = "bulk-preview-row-head";
    const nameEl = document.createElement("span");
    nameEl.className = "bulk-preview-name";
    nameEl.textContent = parsed.name;
    head.appendChild(nameEl);
    const select = document.createElement("select");
    if (matches.length > 1) {
      const pickOpt = document.createElement("option");
      pickOpt.value = "";
      pickOpt.textContent = "동명이인 — 회원 선택";
      select.appendChild(pickOpt);
    }
    matches.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      const locNames = m.locationIds.map((id) => locationById(id)).filter(Boolean).map((l) => l.name).join("·");
      opt.textContent = "기존 회원 연결 (" + (locNames || "지점 미지정") + " · " + (m.category || "구분 없음") + ")" + (matches.length > 1 ? " #" + m.id.slice(-4) : "");
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
      renderBulkImportSummary();
    });
    const newFields = document.createElement("div");
    newFields.className = "bulk-preview-new-fields";
    const locSelect = document.createElement("select");
    if (!row.newLocationId) {
      const pickOpt = document.createElement("option");
      pickOpt.value = "";
      pickOpt.textContent = "지점 선택";
      locSelect.appendChild(pickOpt);
    }
    state.locations.map((l) => l.id).concat(plan.newLocations.map((l) => l.id)).forEach((locId) => {
      const opt = document.createElement("option");
      opt.value = locId;
      opt.textContent = bulkLocationLabel(locId);
      locSelect.appendChild(opt);
    });
    locSelect.value = row.newLocationId;
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
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-ghost btn-small bulk-preview-edit-btn";
    editBtn.textContent = "수정";
    head.appendChild(editBtn);
    rowEl.appendChild(head);
    const editor = document.createElement("div");
    editor.className = "bulk-preview-editor";
    editor.hidden = true;
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "bulk-preview-edit-input";
    editInput.setAttribute("aria-label", parsed.name + " 줄 수정");
    const editApplyBtn = document.createElement("button");
    editApplyBtn.type = "button";
    editApplyBtn.className = "btn btn-primary btn-small";
    editApplyBtn.textContent = "적용";
    const editCancelBtn = document.createElement("button");
    editCancelBtn.type = "button";
    editCancelBtn.className = "btn btn-ghost btn-small";
    editCancelBtn.textContent = "취소";
    const editError = document.createElement("p");
    editError.className = "bulk-preview-note error";
    editError.hidden = true;
    editor.append(editInput, editApplyBtn, editCancelBtn, editError);
    rowEl.appendChild(editor);
    function closeEditor() {
      delete row.draftLine;
      editor.hidden = true;
    }
    if (row.draftLine !== void 0) {
      editInput.value = row.draftLine;
      editor.hidden = false;
    }
    editBtn.addEventListener("click", () => {
      if (row.draftLine === void 0) row.draftLine = row.line.trim();
      editInput.value = row.draftLine;
      editError.hidden = true;
      editor.hidden = false;
      editInput.focus();
    });
    editInput.addEventListener("input", () => {
      row.draftLine = editInput.value;
    });
    function applyEdit() {
      const result = editBulkImportRow(plan, row, editInput.value);
      if (result.error) {
        editError.textContent = "✕ " + result.error;
        editError.hidden = false;
        return;
      }
      const lines = bulkImportTextareaEl.value.split("\n");
      lines[row.lineIndex] = row.line;
      bulkImportTextareaEl.value = lines.join("\n");
      delete row.draftLine;
      rerender();
    }
    editApplyBtn.addEventListener("click", applyEdit);
    editCancelBtn.addEventListener("click", closeEditor);
    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyEdit();
      else if (e.key === "Escape") {
        e.stopPropagation();
        closeEditor();
      }
    });
    parsed.ambiguities.forEach((amb, index) => {
      const box = document.createElement("div");
      box.className = "bulk-preview-ambiguity";
      box.classList.toggle("resolved", !!amb.choice);
      const tooMany = amb.options.length > MAX_TIME_CHOICES;
      if (!amb.choice) {
        const title = document.createElement("p");
        title.className = "bulk-preview-ambiguity-title";
        title.textContent = "⚠ " + amb.token + (tooMany ? " — 해석 확인 필요" : " — 어떻게 등록할까요?");
        box.appendChild(title);
      }
      const raw = document.createElement("p");
      raw.className = "bulk-preview-ambiguity-raw";
      const rawLabel = document.createElement("span");
      rawLabel.className = "bulk-preview-ambiguity-raw-label";
      rawLabel.textContent = "원문";
      raw.append(rawLabel, highlightedRaw(parsed, index));
      box.appendChild(raw);
      const hintText = tooMany ? "해석할 수 있는 경우가 너무 많아 고를 수 없습니다. '수정'에서 쉼표(,)·물결(~)·콜론(:)으로 나눠 적어주세요. (예: 11,12 · 1~2 · 11:10)" : amb.options.some((o) => o.unordered) ? "적은 순서대로 시각이 늘어나지 않거나 같은 시각이 반복됩니다. 맞으면 고르고, 아니면 '수정'으로 고쳐주세요." : "";
      if (hintText) {
        const hint = document.createElement("p");
        hint.className = "bulk-preview-ambiguity-hint";
        hint.textContent = hintText;
        box.appendChild(hint);
      }
      if (tooMany) {
        rowEl.appendChild(box);
        return;
      }
      const options = document.createElement("div");
      options.className = "bulk-preview-ambiguity-options";
      amb.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-small bulk-preview-ambiguity-option";
        btn.classList.toggle("selected", amb.choice === opt.key);
        btn.setAttribute("aria-pressed", String(amb.choice === opt.key));
        btn.dataset.key = opt.key;
        btn.textContent = opt.key + (opt.unordered ? " (시간순 아님)" : "");
        btn.addEventListener("click", () => {
          chooseBulkAmbiguity(plan, row, index, opt.key);
          rerender();
        });
        options.appendChild(btn);
      });
      box.appendChild(options);
      rowEl.appendChild(box);
    });
    const scheduleEl = document.createElement("div");
    scheduleEl.className = "bulk-preview-schedule";
    rowEl.appendChild(scheduleEl);
    function renderSchedule() {
      scheduleEl.innerHTML = "";
      if (parsed.days.length > 0) {
        parsed.days.forEach((dayEntry) => {
          const chip2 = document.createElement("span");
          chip2.className = "bulk-preview-day-chip";
          const locName = bulkLocationLabel(dayEntry.locationId);
          const dayEl = document.createElement("b");
          dayEl.textContent = DAYS[dayEntry.day];
          chip2.append(
            dayEl,
            " " + (locName ? "(" + locName + ") " : "") + describeDaySpecs(dayEntry.specs)
          );
          scheduleEl.appendChild(chip2);
        });
        return;
      }
      const chip = document.createElement("span");
      chip.className = "bulk-preview-day-chip";
      const existing = memberById(row.choice);
      if (parsed.clearAll && existing) {
        chip.classList.add("bulk-preview-day-chip-clear");
        chip.textContent = "기존 가능 시간 전체 삭제";
      } else if (parsed.clearAll && row.choice === "__new__") {
        chip.textContent = "신청 시간 없이 회원만 등록";
      } else if (hasUnresolvedTime(row)) {
        chip.className = "bulk-preview-schedule-hint";
        chip.textContent = "해석을 고르거나 수정하면 등록할 시간이 표시됩니다";
      } else {
        chip.textContent = "등록할 시간 없음";
      }
      scheduleEl.appendChild(chip);
    }
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
      rowEl.classList.toggle(
        "needs-review",
        row.choice !== "__skip__" && hasUnresolvedTime(row)
      );
      select.classList.toggle("is-new-member", row.choice === "__new__");
      newFields.hidden = row.choice !== "__new__";
      renderSchedule();
    }
    renderRowState();
    return rowEl;
  }
  function highlightedRaw(parsed, index) {
    const token = parsed.ambiguities[index].token;
    const nth = parsed.ambiguities.slice(0, index).filter((a) => a.token === token).length;
    const found = [
      ...parsed.raw.matchAll(new RegExp("(?<!\\d)" + token + "(?!\\d)", "g"))
    ][nth];
    const code = document.createElement("code");
    const mark = document.createElement("mark");
    mark.textContent = token;
    if (!found) {
      code.textContent = parsed.raw;
      const span = document.createElement("span");
      span.append(code, " 중 ", mark);
      return span;
    }
    code.append(
      parsed.raw.slice(0, found.index),
      mark,
      parsed.raw.slice(found.index + token.length)
    );
    return code;
  }
  bulkImportPreviewBtn.addEventListener("click", renderBulkImportPreview);
  bulkImportApplyBtn.addEventListener("click", () => {
    const report = applyBulkImportPlan(bulkImportPlan);
    if (report.error) {
      alert(report.error);
      const openEditor = bulkImportPreviewListEl.querySelector(
        ".bulk-preview-editor:not([hidden]) input"
      );
      if (openEditor) openEditor.focus();
      return;
    }
    saveState();
    if (report.createdLocations.length) {
      renderLocationList();
      renderTravelMatrix();
      populateMemberLocationSelect();
    }
    renderMemberTable();
    renderRequestList();
    closeBulkImportModal();
    const { zeroFitNames, emptyRowNames, clearedNames, unparsedSkippedNames } = report;
    const notes = [];
    if (report.createdLocations.length)
      notes.push(
        "지점 " + report.createdLocations.map((l) => l.name).join("·") + " 생성"
      );
    if (report.createdCount) notes.push("신규 " + report.createdCount + "명");
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
      report.appliedCount + "명 스케줄 등록 완료" + suffix,
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
    state.noConsecutiveDayMemberIds = state.noConsecutiveDayMemberIds.filter(
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
    noConsecutive3Widget.renderAll();
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
        locBadge.classList.add(locationColorClass(locId));
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
        memoInput.rows = Math.max(
          1,
          Math.ceil(memoInput.scrollHeight / lineHeight)
        );
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
      const otherDays = container.assigned.filter((a) => a.memberId === member.id && a.id !== req.id).map((a) => a.day);
      if (memberDayViolation(member.id, req.day, otherDays)) return;
      if (otherDays.length >= maxSessionsFor3(member)) return;
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
      unassignedMembers: (container.unassignedMembers || []).slice(),
      confirmedIds: (container.confirmedIds || []).slice()
    };
  }
  function pushManualUndo(container, mark) {
    if (!manualUndoStacks.has(container)) manualUndoStacks.set(container, []);
    const stack = manualUndoStacks.get(container);
    stack.push({ ...snapshotContainer(container), ...mark });
    if (stack.length > MANUAL_UNDO_LIMIT) {
      stack.shift();
      stack.truncated = true;
    }
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
    container.unassignedMembers = snapshot.unassignedMembers;
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
    container.unassignedMembers = unassignedMembersFor(container.assigned);
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
    if (!isWithinAvailability(newReq)) {
      return {
        ok: false,
        message: "근무 가능 시간 밖이라 이 자리로 옮길 수 없습니다"
      };
    }
    const dayViolation = memberDayViolation(
      req.memberId,
      targetDay,
      container.assigned.filter((a) => !ignoreSet.has(a.id) && a.memberId === req.memberId).map((a) => a.day)
    );
    if (dayViolation) {
      return {
        ok: false,
        message: dayViolation === "sameDay" ? "같은 요일에는 하루 최대 1회만 배정할 수 있습니다" : "연속 배정 제외 회원이라 연속된 요일에는 배정할 수 없습니다"
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
        // 수업 블록은 실제 배정된 지점(id)의 색으로 칠한다(표시 전용).
        colorClass: locationColorClass(r.locationId),
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
      if (conflictIdsKey && state[conflictIdsKey].includes(memberId)) {
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
  var noConsecutive3Widget = createMemberSelectionWidget({
    idsKey: "noConsecutiveDayMemberIds",
    eligibleFilter: () => true,
    emptyMembersMessage: "등록된 회원이 없습니다.",
    chipClass: "chip",
    elIds: {
      ms: "noConsecutiveMs",
      control: "noConsecutiveControl",
      chipRow: "noConsecutiveChipRow",
      dropdown: "noConsecutiveDropdown"
    },
    onChanged: onSchedule3SelectionChanged
  });
  async function generateSchedule3Async(onProgress, pins = []) {
    const excludedIds3 = state.excludedMemberIds3;
    const onceLimitIds3 = state.onceLimitedMemberIds3;
    const v1Built = await withSelectionOverride(
      excludedIds3,
      onceLimitIds3,
      () => generateCandidatesAsync(
        (progress) => onProgress(progress * 0.5, "후보 탐색"),
        {},
        pins
      )
    );
    const v2Result = await withSelectionOverride(
      excludedIds3,
      onceLimitIds3,
      () => generateSchedule2Async(
        (progress) => onProgress(0.5 + progress * 0.5, "비교·최적화"),
        { pins, greedyResult: v1Built }
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
      candidateAPools: v2Result.map((c) => c.pool),
      // 그룹 인덱스 -> 동점 풀
      greedyAll: v1Built.all
      // 그리디 시도 전체(세션 한정, addSearchRepresentatives용)
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
  var extraSearchBtn3El = document.getElementById("extraSearchBtn3");
  var EXTRA_SEARCH3_LABEL = "미배정 1명 추가안 더 찾기";
  var EXTRA_SEARCH_MISSING_TEXT = {
    notRun: "아직 찾지 않음 — '" + EXTRA_SEARCH3_LABEL + "'로 찾습니다",
    stale: "추천안이 바뀌어 다시 찾아야 함 — '" + EXTRA_SEARCH3_LABEL + "'로 찾습니다",
    incomplete: "탐색을 끝까지 하지 않음 — '" + EXTRA_SEARCH3_LABEL + "'로 다시 찾습니다",
    done: "탐색에서 조건을 충족하는 후보를 찾지 못함"
  };
  function isUserEdited(result) {
    return !!result && Array.isArray(result.confirmedIds) && result.confirmedIds.length > 0;
  }
  function dropStaleCandidates() {
    const slots = runtime.schedule3Result.candidateAList.concat(runtime.candidates, extraCandidates()).filter(Boolean);
    if (slots.length === 0) return false;
    const idKey = (list) => list.map((m) => m.id).sort().join();
    let repaired = false;
    slots.forEach((r) => {
      const fresh = unassignedMembersFor(r.assigned);
      if (idKey(r.unassignedMembers || []) !== idKey(fresh)) {
        r.unassignedMembers = fresh;
        repaired = true;
      }
    });
    const key = candidateInputKey();
    const saved = runtime.schedule3Result.inputKey;
    if (saved === key || saved === void 0) {
      runtime.schedule3Result.inputKey = key;
      if (dropInvalidCandidates()) return true;
      if (repaired || saved === void 0) saveState();
      return false;
    }
    clearRuntimeScheduleCandidates();
    resetCandidateSession();
    renderSchedule3Result();
    saveState();
    generateHint3El.textContent = "회원·신청·설정이 변경되어 기존 후보(내가 수정한 후보 포함)가 초기화되었습니다. 후보를 다시 생성해주세요.";
    return true;
  }
  function dropInvalidCandidates() {
    const rules = /* @__PURE__ */ new Set();
    const isInvalid = (r) => {
      const violations = scheduleViolations(r);
      violations.forEach((v) => rules.add(v.rule));
      return violations.length > 0;
    };
    let dropped = 0;
    runtime.schedule3Result.candidateAList.forEach((r, i) => {
      if (r && isInvalid(r)) {
        runtime.schedule3Result.candidateAList[i] = null;
        delete candidateAPools[i];
        dropped++;
      }
    });
    const extras = extraCandidates();
    const keptExtras = extras.filter((r) => !isInvalid(r));
    if (keptExtras.length !== extras.length) {
      dropped += extras.length - keptExtras.length;
      runtime.schedule3Result.extraCandidates = keptExtras;
    }
    const keptBC = runtime.candidates.filter((r) => !(r && isInvalid(r)));
    if (keptBC.length !== runtime.candidates.length) {
      dropped += runtime.candidates.length - keptBC.length;
      Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
      runtime.candidates = keptBC;
    }
    if (dropped === 0) return false;
    renderSchedule3Result();
    saveState();
    const reasons = [...rules].map((rule) => HARD_RULES[rule]).join(", ");
    const kept = runtime.schedule3Result.candidateAList.some(Boolean) || runtime.candidates.length > 0 || extraCandidates().length > 0;
    generateHint3El.textContent = kept ? `저장된 후보 중 필수 조건(${reasons})을 어긴 후보 ${dropped}개만 초기화했습니다. 나머지 후보(내가 수정한 후보 포함)는 그대로 두었습니다.` : `저장된 후보가 모두 필수 조건(${reasons})을 어겨 초기화되었습니다. 후보를 다시 생성해주세요.`;
    showToast(`필수 조건을 어긴 후보 ${dropped}개를 초기화했습니다`, "error");
    return true;
  }
  function extraCandidates() {
    return runtime.schedule3Result.extraCandidates || [];
  }
  function addSearchRepresentatives(results) {
    const entries = candidatePoolEntries();
    const seen = new Set(entries.map((e) => layoutSignature(e.result)));
    const extra = [];
    (results || []).forEach((r) => {
      if (!r) return;
      const result = {
        assigned: r.assigned.slice(),
        unassignedMembers: r.unassignedMembers.slice()
      };
      const sig = layoutSignature(result);
      if (seen.has(sig)) return;
      seen.add(sig);
      extra.push({ result, metrics: scheduleMetrics(result) });
    });
    const added = representativeAdditions(
      entries,
      extra,
      (r) => !scheduleViolations(r).length
    ).map((e) => e.result);
    runtime.schedule3Result.extraCandidates = extraCandidates().concat(added);
    return added.length;
  }
  function extraSearchStatus(meta, recSig) {
    if (!meta) return "notRun";
    if (meta.baseSig !== recSig) return "stale";
    return meta.done ? "done" : "incomplete";
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
    extraCandidates().forEach(
      (result, i) => slots.push({
        key: "X" + (i + 1),
        result,
        pool: null,
        store: (r) => runtime.schedule3Result.extraCandidates[i] = r
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
  var cardKeyOf = (c) => c.role === "edited" ? "edited:" + layoutSignature(c.variants[0].result) : qualityKey(c.metrics);
  function shownVariantIndex(c) {
    const meta = runtime.schedule3Result.extraSearch;
    const sig = shownVariantByCard.has(cardKeyOf(c)) ? shownVariantByCard.get(cardKeyOf(c)) : c.role === "recommended" && meta ? meta.baseSig : void 0;
    return Math.max(
      0,
      c.variants.findIndex((v) => layoutSignature(v.result) === sig)
    );
  }
  function shownRecommendation() {
    const card = selectCandidates(candidatePoolEntries()).rows[0].card;
    return card ? card.variants[shownVariantIndex(card)] : null;
  }
  var compareCardKey = null;
  var candidateCompare3El = document.getElementById("candidateCompare3");
  var candidateSummary3El = document.getElementById("candidateSummary3");
  var ROLE_DESC = {
    recommended: "미배정 → 비효율 이동 → 수업·이동·빈 시간 균형(수업 1건 = 이동 1번 = 빈 시간 60분) 순으로 가장 나은 후보입니다.",
    sessions: "추천과 미배정 수가 같은 후보 중, 탐색한 후보 가운데 수업이 가장 많은 후보입니다(공강 허용).",
    sessionsNoIdle: "추천과 미배정 수가 같고 공강(필수 이동시간을 뺀 수업 사이 빈 시간)이 0분인 후보 중, 탐색한 후보 가운데 수업이 가장 많은 후보입니다.",
    travelTradeoff: "추천과 미배정 수가 같고 '수업 수 우선·공강 허용' 후보보다 이동이 적은 후보 중, 탐색한 후보 가운데 수업이 가장 많은 후보입니다.",
    unassignedSessions: "추천보다 미배정이 1명 많은 대신 수업이 2건 이상 많은 후보 중, 탐색한 후보 가운데 수업이 가장 많은 후보입니다.",
    unassignedTravel: "추천보다 미배정이 1명 많은 대신 이동이 2회 이상 적은 후보 중, 탐색한 후보 가운데 이동이 가장 적은 후보입니다."
  };
  var CARD_DESC = {
    edited: "직접 옮기거나 확정한 후보입니다. 다시 생성해도 유지되지만, 회원·신청·설정이 바뀌면 함께 초기화됩니다."
  };
  function renderSchedule3Result() {
    candidates3El.innerHTML = "";
    candidateSummary3El.hidden = true;
    candidateSummary3El.innerHTML = "";
    candidateCompare3El.hidden = true;
    candidateCompare3El.innerHTML = "";
    reoptimize3El.hidden = true;
    reoptimize3El.innerHTML = "";
    const gridRange = businessHoursGridRange();
    const { cards, rows } = selectCandidates(candidatePoolEntries());
    extraSearchBtn3El.hidden = !rows[0].card;
    if (cards.length === 0) {
      reoptSession = null;
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
    const shown = /* @__PURE__ */ new Map();
    const keyOf = cardKeyOf;
    const shownIdx = shownVariantIndex;
    const recShown = rows[0].card ? rows[0].card.variants[shownIdx(rows[0].card)].result : null;
    renderCandidateSummary(rows);
    cards.forEach((c) => {
      const cardKey = keyOf(c);
      const idx = shownIdx(c);
      const entry = c.variants[idx];
      if (entry.slot.result !== entry.result) {
        entry.slot.store(entry.result);
        entry.slot.result = entry.result;
        promoted = true;
      }
      shown.set(cardKey, { card: c, entry });
      buildCard(c, cardKey, entry.result, idx, (newIdx) => {
        shownVariantByCard.set(
          cardKey,
          layoutSignature(c.variants[newIdx].result)
        );
        renderSchedule3Result();
      });
    });
    if (promoted) saveState();
    renderReoptimizeProposal3(
      [...shown.values()].filter((x) => x.card.role === "edited").map((x) => x.entry.result)
    );
    const rec = [...shown.values()].find((x) => x.card.role === "recommended");
    const target = shown.get(compareCardKey);
    if (rec && target && target !== rec) {
      const side = ({ card, entry }) => ({
        label: card.label,
        result: entry.result,
        metrics: entry.metrics
      });
      renderCandidateCompare(candidateCompare3El, side(rec), side(target), () => {
        compareCardKey = null;
        renderSchedule3Result();
      });
    }
    function renderCandidateSummary(rows2) {
      if (!rows2.some((r) => r.card)) return;
      candidateSummary3El.hidden = false;
      const title = document.createElement("h3");
      title.className = "candidate-compare-title";
      title.textContent = "대표 후보 비교";
      const wrap = document.createElement("div");
      wrap.className = "candidate-compare-table-wrap";
      const table = document.createElement("table");
      table.className = "candidate-compare-table candidate-summary-table";
      const thead = document.createElement("thead");
      const htr = document.createElement("tr");
      ["대표 조건", "미배정", "수업", "이동", "공강 시간", "비고"].forEach((t) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = t;
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      const tbody = document.createElement("tbody");
      rows2.forEach((r) => {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.scope = "row";
        th.textContent = r.label;
        tr.appendChild(th);
        const td = (text) => {
          const cell = document.createElement("td");
          cell.textContent = text;
          tr.appendChild(cell);
          return cell;
        };
        if (!r.card) {
          const status = EXCLUSION_ROLES.includes(r.role) ? extraSearchStatus(
            runtime.schedule3Result.extraSearch,
            recShown && layoutSignature(recShown)
          ) : "done";
          const cell = td(EXTRA_SEARCH_MISSING_TEXT[status]);
          cell.colSpan = 5;
          cell.className = "candidate-summary-missing";
        } else {
          const m = r.card.metrics;
          td(m.unassigned ? m.unassigned + "명" : "없음");
          td(m.sessions + "건");
          td(m.travelCount + "번");
          td(m.idleMinutes ? formatMinutesLabel(m.idleMinutes) : "없음");
          const first = r.card.roles[0];
          td(first.role === r.role ? "" : "'" + first.label + "' 카드와 같은 배치");
        }
        tbody.appendChild(tr);
      });
      table.append(thead, tbody);
      wrap.appendChild(table);
      const note = document.createElement("p");
      note.className = "pool-pager-hint";
      note.textContent = "공강 시간은 필수 이동시간을 뺀 수업 사이 빈 시간입니다. 같은 배치를 고른 조건은 아래에서 카드 하나로 보여줍니다. 미배정 1명 추가 조건은 '" + EXTRA_SEARCH3_LABEL + "'로 회원을 한 명씩 빼고 다시 탐색해 찾습니다(회원 수에 따라 수 분~수십 분).";
      candidateSummary3El.append(title, wrap, note);
    }
    function buildCard(c, cardKey, result, variantIdx, onSelectVariant) {
      const title = c.label;
      const recIds = new Set(
        (recShown && recShown.unassignedMembers || []).map((m) => m.id)
      );
      const newlyUnassigned = recShown ? result.unassignedMembers.filter((m) => !recIds.has(m.id)) : [];
      const versus = (newlyUnassigned.length ? " 추천 대비 새로 미배정: " + newlyUnassigned.map((m) => m.name).join(", ") + "." : "") + (c.deltas.length ? " 추천 대비 " + formatTradeoff(c.deltas) : "");
      const desc = c.role === "recommended" ? c.roles.map((r) => ROLE_DESC[r.role]).join(" ") : c.role === "edited" ? CARD_DESC.edited + versus : c.roles.map((r) => ROLE_DESC[r.role]).join(" ") + versus;
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
      if (c.role !== "recommended" && cards[0].role === "recommended") {
        const comparing = compareCardKey === cardKey;
        const compareBtn = document.createElement("button");
        compareBtn.type = "button";
        compareBtn.className = "btn btn-ghost compare-candidate-btn";
        compareBtn.textContent = "추천안과 비교";
        compareBtn.setAttribute("aria-pressed", String(comparing));
        compareBtn.setAttribute("aria-controls", "candidateCompare3");
        compareBtn.addEventListener("click", () => {
          compareCardKey = comparing ? null : cardKey;
          renderSchedule3Result();
          if (!candidateCompare3El.hidden)
            candidateCompare3El.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
        });
        actions.appendChild(compareBtn);
      }
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
        "방금 드래그로 옮기거나 맞바꾸거나 교체·확정하거나 재최적화를 적용한 것을 취소합니다."
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
      const keptCount = c.role === "edited" ? pinsFromResult(result).length : 0;
      if (keptCount > 0) {
        const row = document.createElement("div");
        row.className = "reopt-row";
        const reoptBtn = document.createElement("button");
        reoptBtn.type = "button";
        reoptBtn.className = "btn btn-ghost btn-small reopt-btn";
        reoptBtn.textContent = "나머지 일정 다시 최적화";
        reoptBtn.disabled = runtime.generationInProgress;
        reoptBtn.addEventListener("click", () => runReoptimize3(result));
        const hint = document.createElement("span");
        hint.className = "reopt-hint";
        hint.textContent = "옮기거나 확정한 유지할 수업 " + keptCount + "개는 그대로 둡니다.";
        row.append(reoptBtn, hint);
        card.appendChild(row);
      }
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
  function setCardReoptButtonsDisabled(disabled) {
    candidates3El.querySelectorAll(".reopt-btn").forEach((b) => b.disabled = disabled);
  }
  function startGenerationProgress(label, cancelLabel) {
    setCardReoptButtonsDisabled(true);
    generateBtn3El.disabled = true;
    extraSearchBtn3El.disabled = true;
    generateBtn3El.classList.add("loading");
    generateBtn3LabelEl.textContent = label;
    generateProgressWrap3El.hidden = false;
    generateProgressFill3El.className = "generate-progress-fill progress-pct-0";
    generateProgressText3El.textContent = "후보 탐색 0%";
    generateProgressWrap3El.setAttribute("aria-valuenow", "0");
    generateBtn3CancelEl.hidden = false;
    generateBtn3CancelEl.disabled = false;
    generateBtn3CancelEl.textContent = cancelLabel;
  }
  function showGenerationProgress(progress, phase) {
    const pct = Math.round(progress * 100);
    generateProgressFill3El.className = "generate-progress-fill progress-pct-" + pct;
    generateProgressText3El.textContent = phase + " " + pct + "%";
    generateProgressWrap3El.setAttribute("aria-valuenow", String(pct));
  }
  function endGenerationProgress() {
    generateBtn3El.disabled = false;
    extraSearchBtn3El.disabled = false;
    generateBtn3El.classList.remove("loading");
    generateBtn3LabelEl.textContent = GENERATE3_IDLE_LABEL;
    generateProgressWrap3El.hidden = true;
    generateBtn3CancelEl.hidden = true;
    runtime.generationInProgress = false;
    runtime.generationCancelRequested = false;
    setCardReoptButtonsDisabled(false);
    releaseWakeLock();
  }
  var reoptimize3El = document.getElementById("reoptimize3");
  var reoptSession = null;
  var reoptRunSeq = 0;
  var editStateSig = (r) => layoutSignature(r) + "#" + (r.confirmedIds || []).slice().sort().join(",");
  var LEVEL_LABELS = {
    L1: "고정한 수업 바로 앞뒤",
    L2: "고정한 요일 전체",
    L3: "관련 회원의 다른 요일까지",
    full: "전체 일정"
  };
  var REOPT_LOG_LIMIT = 50;
  function logReoptimize(entry) {
    runtime.reoptimizeLog.push(entry);
    if (runtime.reoptimizeLog.length > REOPT_LOG_LIMIT)
      runtime.reoptimizeLog.shift();
    console.info("[재최적화]", JSON.stringify(entry));
  }
  function renderReoptimizeProposal3(editedResults) {
    const s = reoptSession;
    if (!s) return;
    if (!editedResults.includes(s.target) || editStateSig(s.target) !== s.targetSig) {
      reoptSession = null;
      return;
    }
    const next = nextLocalLevel(s.search);
    const side = (result) => ({ result, metrics: scheduleMetrics(result) });
    renderReoptimizeProposal(reoptimize3El, {
      current: side(s.target),
      keptCount: s.keptCount,
      proposals: s.proposals.map((p, i) => ({
        label: i === 0 ? p.level === "full" ? "전체 일정 탐색 결과" : "변경 최소화 제안" : "더 넓은 탐색 결과",
        scope: LEVEL_LABELS[p.level],
        local: p.level !== "full",
        ...p.variants[p.variantIdx],
        variantIdx: p.variantIdx,
        variantCount: p.variants.length
      })),
      selected: s.selected,
      notice: s.localExhausted && !s.proposals.length ? REOPT_LOCAL_EXHAUSTED : s.notice,
      // 다음 단계: 남은 국소 Level이 있으면 "더 넓게 찾아보기", 없으면 전체 탐색(이미 했으면 없음).
      widen: next ? {
        label: "더 넓게 찾아보기",
        scope: LEVEL_LABELS[next],
        hint: "다음 범위: " + LEVEL_LABELS[next]
      } : s.fullDone ? null : {
        label: "전체 일정 다시 탐색",
        scope: LEVEL_LABELS.full,
        hint: "전체 일정을 다시 짭니다. 시간이 오래 걸릴 수 있습니다."
      },
      onSelect: (i) => {
        s.selected = i;
        renderSchedule3Result();
      },
      onVariant: (idx) => {
        s.proposals[s.selected].variantIdx = idx;
        renderSchedule3Result();
      },
      onApply: applyReoptimization,
      onDiscard: () => {
        logReoptimize({
          event: "discard",
          run: s.run,
          proposalLevels: s.proposals.map((p) => p.level),
          widened: s.widened
        });
        reoptSession = null;
        renderSchedule3Result();
        showToast("재최적화 제안을 버렸습니다", "info");
      },
      onWiden: () => runReoptimizeStep(s, "widen")
    });
    if (runtime.generationInProgress)
      reoptimize3El.querySelectorAll("button").forEach((b) => b.disabled = true);
  }
  function reoptimizedCard(target, chosen) {
    const pinned = new Set(pinsFromResult(target).map(pinKey));
    const assigned = chosen.assigned.map((a) => ({ ...a }));
    return {
      assigned,
      unassignedMembers: chosen.unassignedMembers.slice(),
      confirmedIds: assigned.filter((a) => pinned.has(pinKey(a))).map((a) => a.id)
    };
  }
  function applyReoptimizedCard(target, chosen) {
    pushManualUndo(target, { reoptApplied: true });
    Object.assign(target, reoptimizedCard(target, chosen));
  }
  function applyReoptimization() {
    const s = reoptSession;
    if (!s || !s.proposals.length) return;
    const p = s.proposals[s.selected];
    logReoptimize({
      event: "apply",
      run: s.run,
      level: p.level,
      kind: p.level === "full" ? "full" : "local",
      proposalIndex: s.selected,
      proposalLevels: s.proposals.map((x) => x.level),
      widened: s.widened
    });
    applyReoptimizedCard(s.target, p.variants[p.variantIdx].result);
    reoptSession = null;
    saveState();
    renderSchedule3Result();
    showToast(
      "재최적화 제안을 적용했습니다. 편집 취소로 되돌릴 수 있습니다.",
      "success"
    );
  }
  var REOPT_NO_BETTER = {
    "fewer-sessions": "수업 수를 줄이지 않고는 지금보다 나은 배치를 찾지 못했습니다. 지금 카드를 그대로 둡니다.",
    default: "지금보다 나은 배치를 찾지 못했습니다. 지금 카드를 그대로 둡니다."
  };
  var REOPT_LOCAL_EXHAUSTED = "변경 범위를 제한한 탐색에서는 더 나은 일정을 찾지 못했습니다.";
  async function runReoptimize3(target) {
    if (runtime.generationInProgress) {
      showToast("후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.", "info");
      return;
    }
    if (dropStaleCandidates()) return;
    const userPins = pinsFromResult(target);
    const sel = [state.excludedMemberIds3, state.onceLimitedMemberIds3];
    const violations = await withSelectionOverride(
      ...sel,
      () => scheduleViolations(target)
    );
    if (userPins.length === 0 || violations.length) {
      generateHint3El.textContent = violations.length ? "이 카드에 규칙 위반이 있어 다시 최적화할 수 없습니다: " + violations[0].message : "유지할 수업이 없어 다시 최적화할 수 없습니다.";
      return;
    }
    const { origins, status: originStatus } = originsFromHistory(
      target,
      userPins,
      manualUndoStacks.get(target)
    );
    reoptSession = {
      run: ++reoptRunSeq,
      target,
      targetSig: editStateSig(target),
      keptCount: userPins.length,
      userPins,
      originStatus,
      search: createLocalSearch(target, userPins, origins),
      proposals: [],
      selected: 0,
      widened: 0,
      fullDone: false,
      localExhausted: false,
      notice: null
    };
    await runReoptimizeStep(reoptSession, "first");
  }
  async function runReoptimizeStep(s, mode) {
    if (runtime.generationInProgress) {
      showToast("후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.", "info");
      return;
    }
    if (dropStaleCandidates()) return;
    const sel = [state.excludedMemberIds3, state.onceLimitedMemberIds3];
    const inputKey = candidateInputKey();
    if (mode === "widen") s.widened++;
    generateHint3El.textContent = "";
    s.notice = null;
    runtime.generationInProgress = true;
    runtime.generationCancelRequested = false;
    renderSchedule3Result();
    startGenerationProgress("나머지 일정 다시 최적화 중...", "다시 최적화 취소");
    generateProgressWrap3El.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    await acquireWakeLock();
    const stale = () => candidateInputKey() !== inputKey || editStateSig(s.target) !== s.targetSig;
    const reoptimize = async (pins, level) => {
      const plan = levelPlan(level);
      const phase = LEVEL_LABELS[level] + " 범위";
      const t0 = performance.now();
      const gen = await generateForLevel(level, pins, {
        bc: async (p) => {
          const bc = await withSelectionOverride(
            ...sel,
            () => generateCandidatesAsync(
              (progress) => showGenerationProgress(progress * 0.5, "후보 탐색"),
              {},
              p
            )
          );
          return bc.built.concat(bc.pools.flat()).filter(Boolean);
        },
        a: async (p, budgetScale) => {
          const cards = await withSelectionOverride(
            ...sel,
            () => generateSchedule2Async(
              (progress) => plan.withBC ? showGenerationProgress(0.5 + progress * 0.5, "비교·최적화") : showGenerationProgress(progress, phase),
              { pins: p, budgetScale }
            )
          );
          return cards.flatMap((c) => [c.result].concat(c.pool || []));
        }
      });
      if (stale()) throw new ReoptimizeStaleError();
      const out = await withSelectionOverride(
        ...sel,
        () => selectReoptimization(s.target, gen.bc.concat(gen.a), pins)
      );
      const changed = out.proposal ? assignmentDiff(s.target, out.proposal.result).counts : null;
      logReoptimize({
        event: "level",
        run: s.run,
        mode,
        level,
        ms: Math.round(performance.now() - t0),
        budgetScale: plan.budgetScale === void 0 ? 1 : plan.budgetScale,
        status: out.status,
        reason: out.reason,
        source: out.proposal ? proposalSource(out.proposal.result, gen) : null,
        changedMembers: changed && changed.changedMembers,
        changedSessions: changed && changed.changedSessions,
        originStatus: s.originStatus,
        originCount: s.search.origins.length
      });
      return out;
    };
    const entryOf = (level, out) => ({ level, variants: out.variants, variantIdx: 0 });
    try {
      if (mode === "first") {
        const found = await continueLocalSearch(
          s.search,
          reoptimize,
          (out) => out.status === "improved"
        );
        if (found) {
          s.proposals.push(entryOf(found.level, found.outcome));
          showToast("변경 최소화 제안을 확인해주세요", "success");
        } else {
          s.localExhausted = true;
          showToast("변경 범위 안에서는 더 나은 배치를 찾지 못했습니다", "info");
        }
      } else {
        const local = nextLocalLevel(s.search);
        const found = local ? await continueLocalSearch(s.search, reoptimize, () => true) : { level: "full", outcome: await reoptimize(s.userPins, "full") };
        if (!local) s.fullDone = true;
        const added = found && found.outcome.status === "improved" && addWiderProposal(s.proposals, entryOf(found.level, found.outcome));
        if (added) {
          s.localExhausted = false;
          showToast(
            s.proposals.length > 1 ? "더 넓게 찾은 결과를 비교해 고를 수 있습니다" : "재최적화 제안을 확인해주세요",
            "success"
          );
        } else if (!s.proposals.length && s.fullDone) {
          generateHint3El.textContent = REOPT_NO_BETTER[found.outcome.reason] || REOPT_NO_BETTER.default;
          reoptSession = null;
          showToast("더 나은 배치를 찾지 못했습니다", "info");
        } else {
          s.notice = LEVEL_LABELS[found.level] + " 범위까지 넓혀도 더 나은 결과를 찾지 못했습니다.";
          showToast("더 나은 결과를 찾지 못했습니다", "info");
        }
      }
    } catch (err) {
      logReoptimize({
        event: "abort",
        run: s.run,
        mode,
        reason: err instanceof GenerationCancelledError ? "cancelled" : err instanceof ReoptimizeStaleError ? "stale" : "error"
      });
      if (err instanceof GenerationCancelledError) {
        if (!s.proposals.length && !s.localExhausted) reoptSession = null;
        showToast("다시 최적화를 취소했습니다", "info");
      } else if (err instanceof ReoptimizeStaleError) {
        reoptSession = null;
        if (candidateInputKey() !== inputKey) dropStaleCandidates();
        else
          generateHint3El.textContent = "다시 최적화하는 동안 카드가 바뀌어 결과를 버렸습니다. 다시 시도해주세요.";
      } else {
        console.error(err);
        if (!s.proposals.length && !s.localExhausted) reoptSession = null;
        generateHint3El.textContent = "다시 최적화 중 오류가 발생했습니다. 다시 시도해주세요.";
        showToast("다시 최적화에 실패했습니다", "danger");
      }
    } finally {
      endGenerationProgress();
      renderSchedule3Result();
      if (!reoptimize3El.hidden)
        reoptimize3El.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  var ReoptimizeStaleError = class extends Error {
  };
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
    const prevExtras = extraCandidates();
    startGenerationProgress("후보 생성 중...", "생성 취소");
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
      const result = await generateSchedule3Async(showGenerationProgress);
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
      runtime.schedule3Result = {
        candidateAList,
        inputKey,
        extraCandidates: prevExtras.filter(keepsUserEditedSlot)
      };
      addSearchRepresentatives(result.greedyAll);
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
      endGenerationProgress();
    }
  }
  async function runExtraSearch3() {
    if (runtime.generationInProgress) {
      showToast("후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.", "info");
      return;
    }
    if (dropStaleCandidates()) return;
    const base = shownRecommendation();
    if (!base) return;
    const baseSig = layoutSignature(base.result);
    const meta = { baseSig, done: false };
    runtime.schedule3Result.extraSearch = meta;
    generateHint3El.textContent = "";
    runtime.generationInProgress = true;
    runtime.generationCancelRequested = false;
    const inputKey = candidateInputKey();
    const startedAt = performance.now();
    let label = "";
    let added = 0;
    startGenerationProgress("추가 탐색 중...", "추가 탐색 취소");
    await acquireWakeLock();
    try {
      renderSchedule3Result();
      saveState();
      const stats = await searchMemberExclusions(base, {
        onMember: (i, n, member) => {
          label = "회원별 추가 탐색 " + (i + 1) + "/" + n + "명 (" + member.name + ")";
          showGenerationProgress(i / n, label);
        },
        onProgress: (i, n, p) => showGenerationProgress((i + p) / n, label),
        onFound: (results) => {
          if (candidateInputKey() !== inputKey) return;
          const have = new Set(extraCandidates().map(layoutSignature));
          const fresh = results.filter((r) => !have.has(layoutSignature(r))).map((r) => ({ ...r, baseSig }));
          if (!fresh.length) return;
          added += fresh.length;
          runtime.schedule3Result.extraCandidates = extraCandidates().concat(fresh);
          renderSchedule3Result();
          saveState();
        }
      });
      console.info(
        "[회원별 추가 탐색]",
        JSON.stringify({
          ...stats,
          added,
          ms: Math.round(performance.now() - startedAt)
        })
      );
      if (dropStaleCandidates()) return;
      meta.done = true;
      const now = shownRecommendation();
      const sameBase = !!now && layoutSignature(now.result) === baseSig;
      renderSchedule3Result();
      saveState();
      if (!sameBase)
        showToast(
          "탐색 중 추천안이 바뀌어 완료로 처리하지 않았습니다. 바뀐 추천안으로 다시 찾아주세요",
          "info"
        );
      else
        showToast(
          added ? "미배정 1명 추가안 " + added + "개를 찾았습니다" : "조건을 충족하는 미배정 1명 추가안을 찾지 못했습니다",
          added ? "success" : "info"
        );
    } catch (err) {
      if (err instanceof GenerationCancelledError) {
        showToast(
          "추가 탐색을 취소했습니다. 기존 후보와 지금까지 찾은 후보는 유지됩니다",
          "info"
        );
      } else {
        console.error(err);
        generateHint3El.textContent = "추가 탐색 중 오류가 발생했습니다. 기존 후보와 지금까지 찾은 후보는 그대로 두었습니다.";
        showToast("추가 탐색에 실패했습니다", "danger");
      }
    } finally {
      endGenerationProgress();
    }
  }
  generateBtn3El.addEventListener("click", () => runGenerate3());
  extraSearchBtn3El.addEventListener("click", () => runExtraSearch3());
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
  var locationColorPickerEl = document.getElementById(
    "locationColorPicker"
  );
  var travelTitleEl = document.getElementById("travelTitle");
  var travelMatrixEl = document.getElementById("travelMatrix");
  function membersUsingLocation(locId) {
    return state.members.filter((m) => (m.locationIds || []).includes(locId));
  }
  var editingLocationId = null;
  var colorEditingLocationId = null;
  var newLocationColor = null;
  function buildColorPicker(name, selected, onPick, labelledBy) {
    const group = document.createElement("div");
    group.className = "color-swatches";
    group.setAttribute("role", "radiogroup");
    if (labelledBy) group.setAttribute("aria-labelledby", labelledBy);
    LOCATION_PALETTE.forEach((p, i) => {
      const label = document.createElement("label");
      label.className = "color-swatch location-color-" + i;
      label.title = p.name;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = p.color;
      input.checked = p.color === selected;
      input.setAttribute("aria-label", p.name);
      input.addEventListener("change", () => onPick(p.color));
      label.appendChild(input);
      group.appendChild(label);
    });
    return group;
  }
  function renderNewLocationColorPicker() {
    const used = new Set(state.locations.map((l) => l.color));
    if (!LOCATION_PALETTE.some((p) => p.color === newLocationColor))
      newLocationColor = (LOCATION_PALETTE.find((p) => !used.has(p.color)) || LOCATION_PALETTE[0]).color;
    locationColorPickerEl.innerHTML = "";
    locationColorPickerEl.appendChild(
      buildColorPicker(
        "newLocationColor",
        newLocationColor,
        (c) => newLocationColor = c,
        "locationColorLabel"
      )
    );
  }
  function setLocationColor(loc, color) {
    loc.color = color;
    colorEditingLocationId = null;
    saveState();
    renderLocationList();
    renderMemberTable();
    renderSchedule3Result();
    showToast("'" + loc.name + "' 지점 색상이 저장되었습니다", "success");
  }
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
    renderNewLocationColorPicker();
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
      chip.className = "chip location-chip " + locationColorClass(loc.id);
      const colorBtn = document.createElement("button");
      colorBtn.type = "button";
      colorBtn.className = "location-color-btn";
      const colorOpen = colorEditingLocationId === loc.id;
      colorBtn.setAttribute("aria-expanded", String(colorOpen));
      colorBtn.setAttribute("aria-label", "'" + loc.name + "' 색상 변경");
      colorBtn.title = "색상 변경";
      colorBtn.addEventListener("click", () => {
        colorEditingLocationId = colorOpen ? null : loc.id;
        renderLocationList();
      });
      chip.appendChild(colorBtn);
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
      if (colorOpen)
        chip.appendChild(
          buildColorPicker(
            "locationColor-" + loc.id,
            loc.color,
            (c) => setLocationColor(loc, c)
          )
        );
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
          const v = parseTravelMinutesInput(input.value);
          if (v === null) {
            const prev = state.travelTimes[key];
            input.value = isValidTravelMinutes(prev) ? prev : "";
            showToast(
              "이동 시간은 0 이상의 정수(분)로 입력해주세요 (이동 시간이 없으면 0)",
              "error"
            );
            return;
          }
          state.travelTimes[key] = v;
          input.value = v;
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
    addLocation(name, newLocationColor);
    newLocationColor = null;
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
  function availabilityTimeOptionSlots(kind) {
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
    return slots;
  }
  function fillAvailabilityTimeSelect(sel, kind, selected) {
    sel.innerHTML = "";
    const slots = availabilityTimeOptionSlots(kind);
    if (Number.isInteger(selected) && !slots.includes(selected)) {
      slots.push(selected);
      slots.sort((a, b) => a - b);
    }
    slots.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = String(s);
      opt.textContent = minutesLabel(START_MIN + s * SLOT_MIN);
      sel.appendChild(opt);
    });
    if (Number.isInteger(selected)) sel.value = String(selected);
  }
  function correctedAvailabilityEnd(start, end) {
    if (end > start) return end;
    const next = availabilityTimeOptionSlots("end").find((s) => s > start);
    return next === void 0 ? null : next;
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
      fillAvailabilityTimeSelect(
        startSel,
        "start",
        range ? range.start : DEFAULT_BUSINESS_START_SLOT
      );
      fillAvailabilityTimeSelect(
        endSel,
        "end",
        range ? range.end : DEFAULT_BUSINESS_END_SLOT
      );
      startSel.disabled = !isOn;
      endSel.disabled = !isOn;
      timeWrap.appendChild(startSel);
      timeWrap.appendChild(sep);
      timeWrap.appendChild(endSel);
      function applyRange() {
        const start = parseInt(startSel.value, 10);
        const picked = parseInt(endSel.value, 10);
        const end = correctedAvailabilityEnd(start, picked);
        if (end === null) {
          renderAvailabilityList();
          showToast(d + "요일 근무 종료 시간이 시작보다 늦어야 합니다", "error");
          return;
        }
        endSel.value = String(end);
        setDayRange(di, start, end);
        saveState();
        const endText = minutesLabel(START_MIN + end * SLOT_MIN);
        showToast(
          d + "요일 근무 가능 시간이 저장되었습니다" + (end !== picked ? " (종료를 " + endText + "로 맞춤)" : ""),
          "success"
        );
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
    assertOptionalStringArray(
      data.noConsecutiveDayMemberIds,
      "noConsecutiveDayMemberIds"
    );
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
      noConsecutiveDayMemberIds: validated.noConsecutiveDayMemberIds || [],
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
