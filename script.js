(function () {
  "use strict";

  /* ---------------- Constants ---------------- */
  const DAYS = ["월", "화", "수", "목", "금", "토"];
  const START_MIN = 12 * 60;  // 12:00 (정오) — 근무 가능 시간 시작 선택창에 12:00, 12:30도 넣기 위해 13:00에서 당김
  const END_MIN = 24 * 60;    // 24:00 (오전 12시)
  const SLOT_MIN = 10;
  const SLOT_COUNT = (END_MIN - START_MIN) / SLOT_MIN;
  const SESSION_DURATION_MIN = 50; // 수업(등록 회원) 시간
  const CONSULT_DURATION_MIN = 30; // 상담 회원은 확보 시간이 더 짧음
  const BREAK_MIN = 10; // 수업 사이 최소 쉬는 시간 (배정 시 requiredGapMin에서 항상 강제)
  const ALLOWED_GAP_MIN = 10; // 이동시간·휴식시간을 제외하고 추가로 허용되는 공강(설명 안 되는 빈 시간)
  const BLOCK_COLOR = "#4f46e5"; // 회원 미지정 등 예외 상황의 기본 블록 배경색
  // 회원별 블록 배경색(등록 순서대로 순환, 고정 순서 — 절대 임의로 섞지 않음). 색맹 시뮬레이션
  // 기준으로 인접 색끼리 구분이 되도록 검증된 팔레트: blue/orange/aqua/yellow/magenta/green/
  // violet/red. 자극적인 원색 빨강 대신 톤을 낮춘 빨강을 써서 눈에 피로하지 않게 했다.
  const MEMBER_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  // 검증된 색상은 8개뿐이라 회원이 9명을 넘으면 그대로 반복돼 서로 다른 회원이 똑같은 색을
  // 갖게 된다. 새 색상을 만들어내는 대신(색맹 검증이 안 됨), 같은 8색을 유지한 채 명도만
  // 단계적으로 어둡게 낮춰(글자는 항상 흰색이라 어둡게 할수록 대비는 오히려 좋아진다) 8명
  // 단위로 순환한다 — 24명(8색 × 3단계)까지는 겹치지 않는다.
  const MEMBER_COLOR_SHADE_STEPS = [0, 0.22, 0.4];
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
  const MAX_TRAVELS_PER_DAY = 3; // 하루 지점 간 이동은 최소화하되, 하더라도 최대 3회까지
  const REQUIRED_MEMBER_WEIGHT = 1e6; // "필수 배정 회원"이 1단계 배정에서 다른 회원들보다 항상 우선하도록 주는 가중치

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
  // 첫 실행 시 기본으로 채워둘 근무 가능 시간: 월~금 14:00~23:40 (토요일은 비워둠)
  const DEFAULT_BUSINESS_DAY_INDICES = [0, 1, 2, 3, 4]; // 월~금
  const DEFAULT_BUSINESS_START_MIN = 14 * 60;   // 14:00
  const DEFAULT_BUSINESS_END_MIN = 23 * 60 + 40; // 23:40 (마지막으로 시작 가능한 시각)

  /* ---------------- State ---------------- */
  let state = {
    availableCells: [],   // array of "day-slot" strings
    locations: [],         // {id, name}
    travelTimes: {},       // { "locIdA|locIdB": minutes }
    members: [],          // {id, name, locationIds: [locId, ...]}
    requests: [],         // {id, memberId, locationId, day, startSlot, duration}
    onceLimitedMemberIds: [],  // 이번 후보 생성에서 최대 1회만 배정되어야 하는 회원 id 목록
    excludedMemberIds: [],  // "미배정 회원": 후보 생성에서 아예 제외할 회원 id 목록
    requiredMemberIds: [],  // "필수 배정 회원": 가능하면 무조건 1회 이상 배정되어야 하는 회원 id 목록
    priorityMapoDouble: false  // "마포점 우선 2회 배정": 마포점 회원의 2번째 수업을 다른 지점보다 먼저 배정
  };
  let availableCells = new Set();
  let candidates = [];          // computed candidates
  // 회원 스케줄 추가(신청 시간 추가/삭제) 등 신청 데이터가 바뀌면 true로 표시해둔다.
  // "수업 스케줄 생성" 메뉴로 들어올 때 이 값이 true면, 최신 신청과 맞지 않는 옛 후보를 자동으로 비운다.
  let requestsChangedSinceGenerate = false;
  const PAGE_IDS = ["settings", "schedule", "members", "memberSchedule"];
  // Pages from before the sidebar redesign ("requests"/"candidates"/"confirm") all live under "schedule" now.
  const OLD_PAGE_TO_NEW = { settings: "settings", requests: "schedule", candidates: "schedule", confirm: "schedule" };
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

  function saveState() {
    state.availableCells = Array.from(availableCells);
    state.candidates = candidates;
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
        state.requiredMemberIds = parsed.requiredMemberIds || [];
        state.priorityMapoDouble = !!parsed.priorityMapoDouble;
        availableCells = new Set(parsed.availableCells || []);
        candidates = parsed.candidates || [];
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
        const startSlot = (DEFAULT_BUSINESS_START_MIN - START_MIN) / SLOT_MIN;
        const endSlot = (DEFAULT_BUSINESS_END_MIN - START_MIN) / SLOT_MIN;
        for (let s = startSlot; s < endSlot; s++) availableCells.add(cellKey(di, s));
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
    // 옛 버전에서는 그리드 클릭 1회가 수업(50분)+쉬는시간(10분)을 합친 60분을 예약했다.
    // 이제 쉬는 시간은 배정 시점에 항상 강제되므로, 신청 자체는 실제 수업 길이(50분)만
    // 차지하도록 옮겨서 촘촘한 후보가 나오게 한다.
    let hadOldClickDuration = false;
    state.requests.forEach(r => {
      if (r.duration === 60) { r.duration = SESSION_DURATION_MIN; hadOldClickDuration = true; }
    });
    // 신청 길이가 바뀌었으니, 옛 길이 기준으로 계산된 기존 후보는 다시 생성하도록 비운다.
    if (hadOldClickDuration) candidates = [];
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
    // 삭제된 회원이나 상담 회원(이미 항상 1회로 제한됨)을 가리키는 1회 제한 설정은 정리한다.
    state.onceLimitedMemberIds = state.onceLimitedMemberIds.filter(id => isOnceLimitEligible(memberById(id)));
    // 삭제된 회원을 가리키는 "미배정 회원" 설정은 정리한다.
    state.excludedMemberIds = state.excludedMemberIds.filter(id => !!memberById(id));
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

  // 상담 회원은 확보 시간이 짧다(30분) — 그 외(등록 회원)는 기본 수업 시간(50분).
  // 구분이 비어있으면 상담으로 취급한다(다른 곳의 기본값과 동일).
  function sessionDurationFor(member) {
    return (member && (member.category || "상담")) === "상담" ? CONSULT_DURATION_MIN : SESSION_DURATION_MIN;
  }

  // 상담 회원은 최대 1회까지만, 그 외(등록 회원)는 최대 MAX_SESSIONS_PER_MEMBER(2)회까지.
  // "1회 제한 회원"으로 지정된 회원은 구분과 무관하게 최대 1회로 제한된다.
  function maxSessionsFor(member) {
    if (!member) return 1;
    if (state.onceLimitedMemberIds.includes(member.id)) return 1;
    return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
  }

  // 상담 회원은 이미 항상 최대 1회로 제한되므로(위 규칙), "1회 제한 회원" 목록에는 표시하지 않는다.
  function isOnceLimitEligible(member) {
    return !!member && (member.category || "상담") !== "상담";
  }

  function locationById(id) { return state.locations.find(l => l.id === id); }

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

  /* ---------------- Grid rendering ---------------- */
  // options: { blocks: [{day, startSlot, duration, label, loc, sublabel, color, excluded, onDelete}],
  //   travelBlocks: [{day, startSlot, duration, label, type: "travel" | "break"}] }
  // onDelete(있는 블록만): 마우스 호버 시 우측 상단에 삭제(×) 버튼이 나타난다 (PC 전용 기능).
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
      container.appendChild(block);
    });
  }

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
    if (candidates.length === 0) return;
    candidates = [];
    generateHintEl.textContent = "";
    renderCandidates();
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
            renderCandidates();
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
      startSel.value = String(range ? range.start : 0);
      endSel.value = String(range ? range.end : SLOT_COUNT);
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

  // 등록된 시간에 마우스를 올리면 나타나는 삭제(×) 버튼은 PC(마우스)에서만 허용. 터치 기기에서는 안내만 띄운다.
  scheduleGridScrollEl.addEventListener("touchstart", (e) => {
    e.preventDefault();
    alert("일정에 마우스를 올렸을 때 나타나는 × 버튼으로 삭제하는 기능은 PC에서만 가능합니다. PC로 접속해서 삭제해주세요.");
  }, { passive: false });

  // "한 번에 추가" 컨트롤: 요일마다 독립된 시작~종료 시간대 선택창을 두고(기본값 "선택안함"),
  // 시간대를 지정한 요일들만 모아 그 범위 안에서 가능한 모든 50분 후보 시작 시각(10분 간격)을
  // 한 번에 희망 시간으로 등록한다.
  const rangeDayRows = DAYS.map((d, di) => {
    const row = document.createElement("div");
    row.className = "range-day-row";

    const name = document.createElement("span");
    name.className = "range-day-name";
    name.textContent = d;

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

    row.appendChild(name);
    row.appendChild(startSel);
    row.appendChild(sep);
    row.appendChild(endSel);
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
      alert("추가할 새 시간대가 없습니다. 이미 등록되었거나, 그 범위엔 50분 수업이 들어갈 자리가 없습니다.");
      return;
    }
    configuredRows.forEach(r => { r.startSel.value = ""; r.endSel.value = ""; });
    requestsChangedSinceGenerate = true;
    saveState();
    renderRequestList();
    showToast("일정이 추가 되었습니다.", "success");
  });

  resetAllSchedulesBtn.addEventListener("click", () => {
    if (state.requests.length === 0) return;
    if (!confirm("스케줄이 등록된 회원의 가능 시간을 모두 지우고 초기화할까요?")) return;
    state.requests = [];
    requestsChangedSinceGenerate = true;
    saveState();
    renderRequestList();
    showToast("전체 스케줄이 초기화되었습니다", "info");
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
    state.requiredMemberIds = state.requiredMemberIds.filter(id => id !== member.id);
    requestsChangedSinceGenerate = true;
    saveState();
    renderMemberTable();
    renderRequestList();
    renderCandidates();
    showToast("'" + member.name + "' 회원이 삭제되었습니다", "danger");
  }

  function setMemberMemo(member, memo) {
    member.memo = memo;
    saveState();
    showToast("메모가 저장되었습니다", "success");
  }

  function setMemberCategory(member, category) {
    member.category = category;
    // 구분이 바뀌면 확보 시간(상담 30분/등록 50분)도 바뀌므로, 이미 등록된 이 회원의
    // 신청들도 새 구분 기준 길이로 맞춰준다 — 안 그러면 예전 구분 기준 길이가 그대로 남아
    // 그리드에는 옛 길이만큼만 자리가 확보된 것처럼 보인다.
    const newDuration = sessionDurationFor(member);
    state.requests.forEach(r => { if (r.memberId === member.id) r.duration = newDuration; });
    requestsChangedSinceGenerate = true;
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
    renderOnceLimitUI();
    renderExcludedUI();
    renderRequiredUI();
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

  function renderRequestList() {
    memberTabsEl.innerHTML = "";
    scheduleGridEl.innerHTML = "";
    scheduleChipRowEl.innerHTML = "";

    if (state.members.length === 0) {
      requestSummaryEl.textContent = "등록된 회원이 없습니다.";
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

    // 그리드에는 실제로 확보되는 시간을 하나의 블록으로 보여준다: 마지막으로 시작 가능한
    // 수업이 끝난 뒤에는 항상 최소 휴식 시간(BREAK_MIN)이 따라붙으므로, 종료 시각을 그만큼
    // 더 늦춰서 보여준다 (별도 구간으로 나누지 않고 하나의 블록에 합쳐서). 마감 시간은 넘지 않는다.
    const breakSlots = durationToSlots(BREAK_MIN);

    const scheduleGridRange = businessHoursGridRange();
    renderGrid(scheduleGridEl, availableCells, {
      blocks: runs.map(run => {
        const displayEndSlot = Math.min(run.endSlot + breakSlots, SLOT_COUNT);
        return {
          day: run.day,
          startSlot: run.startSlot,
          duration: (displayEndSlot - run.startSlot) * SLOT_MIN,
          label: memberLabel,
          loc: memberLocNames,
          sublabel: slotLabel(run.startSlot) + "~" + minutesLabel(START_MIN + displayEndSlot * SLOT_MIN),
          color,
          onDelete: () => removeRequests(run.reqs.map(r => r.id))
        };
      }),
      rangeStartSlot: scheduleGridRange.rangeStartSlot,
      rangeEndSlot: scheduleGridRange.rangeEndSlot
    });

    if (myReqs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "generate-hint";
      empty.textContent = "위에서 요일별로 시간대를 고르고 \"한 번에 추가\"를 눌러 가능 시간을 추가하세요.";
      scheduleChipRowEl.appendChild(empty);
    }
  }

  /* ---------------- Candidates page ---------------- */
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
    return isWithinAvailability(req) && !state.excludedMemberIds.includes(req.memberId);
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

  // 두 세션 사이에 실제로 확보해야 하는 최소 간격(분): 같은 지점이어도 최소 BREAK_MIN(쉬는
  // 시간), 지점이 다르면 그 위에 이동 시간만큼 더. "스케줄과 이동시간은 겹칠 수 없습니다"
  // 조건의 하한이다. 10분 슬롯 격자에 맞춰 올림한다 — 이동 시간이 슬롯 배수가 아니면(예: 15분)
  // 정확히 그 값에 맞는 시작 시각이 격자 위에 존재할 수 없으므로, 격자에서 표현 가능한 가장
  // 좁은 간격을 "빈 시간 없음"의 기준으로 삼아야 한다.
  function requiredGapMin(locA, locB) {
    const raw = Math.max(BREAK_MIN, travelMinutes(locA, locB));
    return Math.ceil(raw / SLOT_MIN) * SLOT_MIN;
  }

  // "후보F" 전용 tie-break(preferDaytime 옵션)의 "낮 시간대 우선"에 쓴다 — 18시 이전에
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
  // 최소화하되 기본 최대 3회까지(options.maxTravelsPerDay로 후보마다 강화 가능, 예: 후보E는 2회) 하며, 스케줄과 이동시간은
  // 겹치지 않게, 그리고 "이동시간·휴식시간을 제외한 빈 시간은 없도록" 한다. 다만 빈 시간을
  // 최대 ALLOWED_GAP_MIN분까지 허용했을 때 실제로 배정되는 수업(세션) 개수가 늘어난다면,
  // 그만큼만 예외로 허용한다(맨 아래 runWithGapPolicy 참고).
  //
  // 근무 가능 시간이 예를 들어 15시부터라고 해서 그 요일의 첫 세션이 꼭 15시부터일 필요는
  // 없다 — 오히려 "일단 제일 이른 신청부터 채우고 본다"는 방식은, 이르지만 고립된(그 뒤로
  // 아무도 이어붙일 수 없는) 신청을 먼저 확정해버려서 뒤에 왔으면 빈틈없이 꽉 채울 수 있었던
  // 더 나은 무리(cluster)를 놓치고, 그 사이에 허용 범위를 넘는 공강만 남기기 쉽다. 그래서 요일별로
  // "이 지점에서, 이 시각부터, 앞으로 이어지는 신청이 있는가"만 이어붙이는 최장 체인을 DP로
  // 찾는다 — 체인 안의 인접한 두 세션 사이 간격은 항상 requiredGapMin 이상, requiredGapMin +
  // allowGapMin 이하여야 하므로, 완성된 체인에는 정의상 그 한도를 넘는 공강이 생기지
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
  //   preferDaytime: 인원·이동까지 같으면("후보F") 낮 시간대(18시 이전 시작) 세션이 많이
  //   들어간 체인을 우선한다 — 저녁보다 낮에 몰아 배정하면 그만큼 그날 안에서 이동할 수 있는
  //   여지(뒤에 이어붙일 다른 회원)가 늘어나 결과적으로 이동을 줄이는 데 도움이 된다는 전제.
  //   groupByLocation: 그 다음으로(또는 preferDaytime 없이 바로) 같은 지점이 연달아
  //   이어지는(지점을 덜 옮겨다니는) 체인을 우선한다.
  //   minimizeUnassigned("후보G"): 기본 순서로 한 번 배정해보고, 1단계(아직 아무 것도 못
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
    const pinnedLocationDay = options.pinnedLocationDay || null; // { day, locationId } — 후보H/I
    const priorityDoubleLocationId = options.priorityDoubleLocationId || null; // "마포점 우선 2회 배정" 체크박스
    const maxTravelsPerDay = options.maxTravelsPerDay || MAX_TRAVELS_PER_DAY; // 후보E는 2회로 강화
    const maxTravelsPerWeek = options.maxTravelsPerWeek || null; // 일주일 총 이동 횟수 한도(후보B·C·D)
    // 후보A: 인원 → 이동 횟수까지만 비교하고 멈춘다 — 이동 시간, 이동시간+빈시간 합, 정렬,
    // 슬랙 같은 세부 기준은 쓰지 않는다("인원을 최대화하도록 배정합니다. 동점이면 이동
    // 횟수가 적은 쪽을 우선합니다."에 정확히 대응시키기 위함).
    const travelCountOnly = !!options.travelCountOnly;

    // 숨김 하드 로직(회원 개인 사정으로 인한 예외, 후보 조건에는 노출하지 않음): 상암점·여의도점·
    // 마포점 세 지점을 모두 다니는 회원은 "이동-회원-이동"(도착도 이동, 떠날 때도 이동 — 그
    // 지점에 그 회원 혼자만 있는 경우)으로 배정될 수 없다. 같은 지점에서 다른 회원과 붙어
    // 있으면(이동-회원-다른회원-이동) 괜찮다. buildBestChain predecessor 탐색에서, 이 회원
    // 자신도 이동으로 도착한 노드일 때 그 다음도 이동으로 이어지려는 연결만 걸러낸다(아래
    // arrivedViaTravel/soloTravelMemberIds 참고).
    const SOLO_TRAVEL_LOCATION_NAMES = ["상암점", "여의도점", "마포점"];
    const soloTravelLocationIds = state.locations.filter(l => SOLO_TRAVEL_LOCATION_NAMES.includes(l.name)).map(l => l.id);
    const soloTravelMemberIds = soloTravelLocationIds.length === SOLO_TRAVEL_LOCATION_NAMES.length
      ? new Set(state.members.filter(m => soloTravelLocationIds.every(id => m.locationIds.includes(id))).map(m => m.id))
      : new Set();

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
    // 요일을 처리하는 순서만 바꿀 수 있다 — minimizeUnassigned 옵션("후보G")이 이 순서를
    // 두 가지로 각각 시도해보고 더 나은 쪽을 고르는 데 쓴다. allowGapMin은 이번 실행에서
    // 세션 사이에 추가로 허용할 공강(분) 한도다 — 아래 runWithGapPolicy가 0(엄격)과
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
    // onlyLocationId가 있으면(후보H/I의 "지점 우선 배정" 사전 단계), 그 지점을 등록해둔
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
        const memberLocs = candidateLocationsFor(cand.memberId);
        const locs = onlyLocationId ? (memberLocs.includes(onlyLocationId) ? [onlyLocationId] : []) : memberLocs;
        locs.forEach(locId => {
          nodes.push({ cand, locationId: locId, end: cand.startSlot + durationToSlots(cand.duration) });
        });
      });
      nodes.sort((a, b) => a.end - b.end || priorityRank.get(a.cand.id) - priorityRank.get(b.cand.id));

      // "하루 이동은 최소화"를 실제로 반영하려면, 인원(가중치 합)이 같은 체인들 사이에서는
      // 이동 횟수가 더 적은 쪽을 골라야 한다(travelFirst 옵션이 켜지면 이 둘의 우선순위를
      // 아예 뒤집어, 이동 횟수를 인원보다 먼저 비교한다). travelCountOnly 옵션("후보A")이
      // 켜지면 여기서 비교를 멈춘다. 아니면 그마저 동점일 때 이동 시간 합이 더 적은 쪽을,
      // 그마저 동점이면 이동 시간 합 + 빈 시간(슬랙) 합이 더 적은 쪽을(=이동 시간이 같다면
      // 결국 빈 시간이 적은 쪽을) 고르고, 그다음으로 하루의 첫 수업이 30분 단위 시각(예:
      // 13:00, 13:30)에 시작하는 체인을 우선한다 — 인원을 줄이면서까지 정렬을 강제하지는
      // 않고, 이미 동점인 대안들 사이에서만 고른다. preferDaytime 옵션("후보F")이
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
      // 연장선인 숨김 소프트 선호다 — 그런 회원이 같은 지점 앞사람에게서 공강 슬랙을 써서
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
          // 공강이 그만큼 생겨도) 이어붙일 수 있다 — 10분 단위 슬롯마다 하나씩 확인한다.
          for (let slackMin = 0; slackMin <= allowGapMin; slackMin += SLOT_MIN) {
            const reqEnd = node.cand.startSlot - (need + slackMin) / SLOT_MIN;
            const list = index.get(key(reqEnd, predLoc));
            if (!list) continue;
            for (const prevNode of list) {
              if (prevNode.usedMembers.has(node.cand.memberId)) continue;
              // 숨김 하드 로직: 세 지점을 모두 다니는 회원이 이동으로 도착한 세션이면, 거기서
              // 또 이동으로 이어지는 연결은 막는다("이동-회원-이동" 금지). 같은 지점에서 다른
              // 회원에게 이어지는 것(이동-회원-다른회원-이동)은 transitionMin이 0이라 여기 걸리지 않는다.
              if (soloTravelMemberIds.has(prevNode.cand.memberId)
                && prevNode.arrivedViaTravel && transitionMin > 0) continue;
              const tc = prevNode.travelCount + (transitionMin > 0 ? 1 : 0);
              if (tc > maxTravelsPerDay) continue; // 하루 이동 최대 허용 횟수
              if (maxTravelsPerWeek != null && otherDaysTravelUsed + tc > maxTravelsPerWeek) continue; // 일주일 총 이동 최대 허용 횟수
              const resultTravelOnly = prevNode.travelMinutesSum + transitionMin;
              const resultTimeCost = resultTravelOnly + prevNode.idleMinutesSum + slackMin;
              // 숨김 소프트 로직: 세 지점을 모두 다니는 회원이 같은 지점 앞사람에게서 슬랙(공강)을
              // 써서 이어붙으면 그만큼 페널티를 쌓는다 — 슬랙 없이 붙거나(0) 이동으로 이어지는 경우는 0.
              const slackPenalty = (soloTravelMemberIds.has(node.cand.memberId)
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
            const node = list.find(n => !(soloTravelMemberIds.has(n.cand.memberId)
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
        const chainEndIsSoloTravelMember = soloTravelMemberIds.has(chainEnd.memberId) && chainEndArrivedViaTravel;
        // "하루 이동은 최소화"하기 위해, 여러 회원이 동시에 이어붙을 수 있으면 이동 시간이
        // 적게 드는 쪽을 먼저 고르고, 그래도 같으면 우선순위(priorityRank)로 정한다.
        let bestCand = null, bestLocated = null, bestCost = Infinity;
        dayCands.forEach(cand => {
          if (!eligibleMemberIds.has(cand.memberId) || usedMembers.has(cand.memberId)) return;
          let bestLoc = null;
          candidateLocationsFor(cand.memberId).forEach(locId => {
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
    // 조건보다 낮은 가중치여야 한다"는 결정에 따라 제거했다). 다만 "필수 배정 회원"으로 지정된
    // 회원은 이 1단계에서 압도적으로 큰 가중치를 줘서, 다른 회원 여러 명을 태우는 조합보다
    // 항상 우선 선택되게 한다 — 이렇게 하면 가능한 자리가 있는 한 사실상 무조건 배정된다.
    function fairnessWeight(memberId) {
      return state.requiredMemberIds.includes(memberId) ? REQUIRED_MEMBER_WEIGHT : 1;
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
    // 먼저 확정한다("후보H": 수요일 상암점, "후보I": 금요일 마포점). 그 요일에 이미 확정(고정)된
    // 세션이 있으면 충돌을 피해 건드리지 않는다. 이후 1~3단계는 이 체인 뒤(extendExistingChain)와
    // 나머지 요일에서 평소처럼 진행되므로 "그 지점을 최대한 먼저 배정하고 나머지를 배정"이 된다.
    if (pinnedLocationDay && !(pinned.some(p => p.day === pinnedLocationDay.day)) && (byDay.get(pinnedLocationDay.day) || []).length > 0) {
      buildBestChain(pinnedLocationDay.day, allMemberIdsForDay(pinnedLocationDay.day), fairnessWeight, null, pinnedLocationDay.locationId)
        .forEach(s => commit(pinnedLocationDay.day, s));
    }

    // 1단계: 아직 아무 것도 못 받은 회원들만으로 요일별 체인을 새로 짠다. stage1Order가 그 순서를 정한다.
    stage1Order.forEach(day => {
      const elig = new Set([...allMemberIdsForDay(day)].filter(id => {
        const usedDays = memberDays.get(id);
        if (usedDays && usedDays.size >= 1) return false;
        return withinCaps(id, day);
      }));
      fillDay(day, elig, fairnessWeight);
    });

    // 1.5단계("마포점 우선 2회 배정" 체크박스): 지정된 지점(마포점) 소속 회원 중 1단계에서
    // 이미 1회 배정된 회원의 2번째 세션을, 다른 회원들의 2번째 세션(2·3단계)보다 먼저 채운다.
    if (priorityDoubleLocationId) {
      days.forEach(day => {
        const elig = new Set([...allMemberIdsForDay(day)].filter(id => {
          if (!withinCaps(id, day)) return false;
          const usedDays = memberDays.get(id);
          if (!usedDays || usedDays.size !== 1) return false; // 이미 1회 배정된 회원만
          const member = memberById(id);
          return !!member && member.locationIds.includes(priorityDoubleLocationId);
        }));
        fillDay(day, elig);
      });
    }

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

    // 주어진 공강 허용 한도(allowGapMin)로 배정을 한 번 완결한다. 기본은 요일 순서
    // 그대로 한 번 실행한다. minimizeUnassigned 옵션("후보G")이 켜지면, "신청 가능한
    // 회원이 적은(대안이 좁은) 요일부터 먼저 채우면 미배정이 줄어들 것"이라는 가설로
    // 1단계 처리 순서를 바꿔 한 번 더 실행해보고, 두 결과 중 실제로 배정된 회원 수가
    // 더 많은 쪽을 택한다(동점이면 총 세션 수가 많은 쪽, 그래도 동점이면 기본 순서를 우선한다).
    // 이 순서 바꾸기는 그 자체로 항상 더 나은 결과를 보장하는 게 아니라(체인이 서로 얽혀
    // 있으면 오히려 다른 요일의 체인을 갈라놓아 더 나빠질 수도 있다), 그래서 두 결과를 직접
    // 비교해 "적어도 기본 순서보다 나쁘지는 않은" 결과만 채택해야 "미배정 최소화"라는 이름에
    // 맞는다.
    function runWithGapPolicy(allowGapMin) {
      const naturalResult = runPass(days, allowGapMin);
      if (!minimizeUnassigned) return naturalResult;

      const sizeAscOrder = [...days].sort((a, b) => allMemberIdsForDay(a).size - allMemberIdsForDay(b).size);
      const altResult = runPass(sizeAscOrder, allowGapMin);
      const naturalMemberCount = new Set(naturalResult.map(r => r.memberId)).size;
      const altMemberCount = new Set(altResult.map(r => r.memberId)).size;
      if (altMemberCount > naturalMemberCount) return altResult;
      if (altMemberCount === naturalMemberCount && altResult.length > naturalResult.length) return altResult;
      return naturalResult;
    }

    // "이동시간·휴식시간을 제외한 빈 시간은 없도록" 엄격(allowGapMin=0)하게 한 번 배정해보고,
    // 공강을 최대 ALLOWED_GAP_MIN분까지 허용했을 때 실제로 수업(세션) 개수가 늘어나는 경우에만
    // 완화된 결과를 쓴다 — 공강 허용이 세션 수를 늘리지 못한다면(그저 같은 인원을 다르게
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

  // 회원이 등록한 가능 시간 총합(분)을, 회원 스케줄 추가 그리드에 보이는 것과 같은 방식으로
  // 계산한다 — 각 구간(run)마다 마지막 수업 뒤에 붙는 최소 휴식 시간(BREAK_MIN)까지 포함해서
  // 더한다. 등록/상담 회원 모두 이 총합이 1시간(60분) 이하면 애초에 같은 날 두 번째 수업을
  // 넣을 시간이 물리적으로 없으므로(수업+휴식이 최소 40~60분), 1회만 배정되어도 예외적인
  // 상황이 아니다.
  function totalAvailableMinutesFor(memberId) {
    const breakSlots = durationToSlots(BREAK_MIN);
    const runs = mergeRequestRuns(state.requests.filter(r => r.memberId === memberId));
    return runs.reduce((sum, run) => {
      const displayEndSlot = Math.min(run.endSlot + breakSlots, SLOT_COUNT);
      return sum + (displayEndSlot - run.startSlot) * SLOT_MIN;
    }, 0);
  }

  function buildCandidate(title, desc, sortedReqs, eligibleSet, allMemberIds, options, pinned) {
    const assigned = greedyAssign(sortedReqs.filter(r => eligibleSet.has(r.id)), options, pinned);
    const assignedMemberIds = new Set(assigned.map(r => r.memberId));
    const unassignedMembers = [...allMemberIds]
      .filter(id => !assignedMemberIds.has(id))
      .map(id => memberById(id))
      .filter(Boolean);
    const sessionCountByMember = new Map();
    assigned.forEach(r => sessionCountByMember.set(r.memberId, (sessionCountByMember.get(r.memberId) || 0) + 1));
    // "1회 제한 회원"으로 선택된 회원이나, 가능 시간을 1시간 이하로만 등록해 애초에 2회를
    // 받을 수 없었던 회원은 원래부터 1회만 배정되는 게 정상이므로, 예외적으로 1회만 배정된
    // 회원을 알려주는 이 목록에는 표시하지 않는다.
    const singleAssignedMembers = [...assignedMemberIds]
      .filter(id => sessionCountByMember.get(id) === 1
        && !state.onceLimitedMemberIds.includes(id)
        && totalAvailableMinutesFor(id) > 60)
      .map(id => memberById(id))
      .filter(Boolean);
    return { title, desc, assigned, unassignedMembers, singleAssignedMembers, travelMinutes: totalTravelMinutes(assigned) };
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
  // 후보B·C·D는 maxTravelsPerWeek 옵션으로 일주일 총 이동 횟수 한도를 각각 5회·4회·3회로
  // 제한한다. 후보E는 maxTravelsPerDay 옵션으로 하루 이동 횟수 한도를 2회로 강화한다.
  // 후보F는 preferDaytime 옵션으로 "인원·이동까지 같으면 낮 시간대(18시
  // 이전 시작) 우선"을 추가한다. 후보G는 minimizeUnassigned 옵션으로, 기본 순서와 "대안이
  // 좁은 요일부터 먼저 채우는" 순서를 둘 다 시도해보고 실제로 미배정 회원이 더 적은 쪽을 택한다.
  function defaultSort(eligible, jitter) {
    return [...eligible].sort((a, b) =>
      a.day - b.day
      || (endBucket(a) - endBucket(b))
      || (jitter.get(a.id) - jitter.get(b.id))
      || reqEnd(a) - reqEnd(b));
  }

  // 후보H/I("지점 우선 배정")용: 이름으로 지점을 찾아 { day, locationId } 형태로 돌려준다.
  // 지점 이름이 바뀌었거나 삭제됐으면 null을 돌려주고, 이때 greedyAssign은 이 사전 단계를
  // 그냥 건너뛴다(다른 조건은 정상 적용, 에러 없이 후보A와 같은 배치가 된다).
  function pinnedLocationDayFor(day, locationName) {
    const loc = state.locations.find(l => l.name === locationName);
    return loc ? { day, locationId: loc.id } : null;
  }

  // "마포점 우선 2회 배정" 체크박스용: 이름으로 지점을 찾는다. 지점이 삭제/개명되어 없으면
  // null을 돌려주고, greedyAssign은 이때 그 옵션을 그냥 무시한다.
  function locationIdByName(locationName) {
    const loc = state.locations.find(l => l.name === locationName);
    return loc ? loc.id : null;
  }

  // 표시 순서는 사용자가 지정한 순서를 그대로 따른다: A(기본, 인원 → 이동 횟수까지만
  // 비교하고 멈춘다) → B(A와 기준은 같고 일주일 총 이동 횟수를 5회로 제한) → C(A와 기준은
  // 같고 일주일 총 이동 횟수를 4회로 제한) → D(A와 기준은 같고 일주일 총 이동 횟수를 3회로
  // 제한) → E(A와 기준은 같고 하루 이동 횟수를 2회로 강화) → F(A의 동점 기준에 낮 시간대
  // 우선을 한 단계 더 추가한 대안) → G(A와 기준은 같고 요일 처리 순서를 바꿔보는 대안) →
  // H/I(특정 요일에 특정 지점을 최대한 먼저 배정하는 대안).
  const STRATEGIES = [
    {
      title: "후보A - 수업 횟수 최대화",
      desc: "인원을 최대화하도록 배정합니다. 동점이면 이동 횟수가 적은 쪽을 우선합니다.",
      options: { travelCountOnly: true },
      sort: defaultSort
    },
    {
      title: "후보B - 일주일 총 이동 횟수 5회",
      desc: "후보A와 같은 기준이지만, 일주일 총 이동 횟수를 5회까지로 제한합니다.",
      options: { maxTravelsPerWeek: 5 },
      sort: defaultSort
    },
    {
      title: "후보C - 일주일 총 이동 횟수 4회",
      desc: "후보A와 같은 기준이지만, 일주일 총 이동 횟수를 4회까지로 제한합니다.",
      options: { maxTravelsPerWeek: 4 },
      sort: defaultSort
    },
    {
      title: "후보D - 일주일 총 이동 횟수 3회",
      desc: "후보A와 같은 기준이지만, 일주일 총 이동 횟수를 3회까지로 제한합니다.",
      options: { maxTravelsPerWeek: 3 },
      sort: defaultSort
    },
    {
      title: "후보E - 하루 이동 횟수 2회",
      desc: "후보A와 같은 기준이지만, 하루 이동 횟수를 최대 2회까지로 제한합니다.",
      options: { maxTravelsPerDay: 2 },
      sort: defaultSort
    },
    {
      title: "후보F - 낮 시간대 우선",
      desc: "후보A와 같은 기준이지만, 그마저 동점이면 18시 이전에 시작하는 수업이 많은 배치를 우선합니다.",
      options: { preferDaytime: true },
      sort: defaultSort
    },
    {
      title: "후보G - 미배정 최소화",
      desc: "후보A와 같은 기준이지만, 신청 가능한 회원이 적은 요일부터 먼저 채우는 방식도 함께 시도해보고 미배정 회원이 더 적은 쪽을 택합니다.",
      options: { minimizeUnassigned: true },
      sort: defaultSort
    },
    {
      title: "후보H - 수요일 상암점 우선",
      desc: "후보A와 같은 기준이지만, 수요일에는 상암점 수업을 최대한 먼저 배정한 뒤 나머지를 배정합니다.",
      options: () => ({ pinnedLocationDay: pinnedLocationDayFor(2, "상암점") }), // 수 = index 2
      sort: defaultSort
    },
    {
      title: "후보I - 금요일 마포점 우선",
      desc: "후보A와 같은 기준이지만, 금요일에는 마포점 수업을 최대한 먼저 배정한 뒤 나머지를 배정합니다.",
      options: () => ({ pinnedLocationDay: pinnedLocationDayFor(4, "마포점") }), // 금 = index 4
      sort: defaultSort
    }
  ];

  // 후보A는 스스로 "인원 최대화 → 동점이면 이동 횟수 최소화"를 기준으로 내세우지만, 그리디
  // 알고리즘은 요일을 처리하는 순서에 따라 이 기준으로도 최선이 아닌 결과를 낼 수 있다 —
  // 실제로 특정 요일·지점을 먼저 채우는 후보H/I가 우연히 후보A보다 더 나은(인원은 같고
  // 이동은 더 적은) 조합을 찾아내는 경우가 있었다. 그래서 후보A는 모든 (요일, 지점) 조합을
  // "그 요일엔 그 지점부터 최대한 채운다"는 사전 단계로 하나씩 시도해보고, 그중 baseline보다
  // 나은 결과가 있으면 그걸로 교체한다 — 후보H/I와 같은 메커니즘을 후보A 안에서 전수
  // 조사하는 셈이다. 지점이 1개뿐이면 사전 단계를 시도할 의미가 없으므로 건너뛴다.
  // 비교 기준은 인원 → 총 수업 건수 → 이동 횟수 순이다: 인원과 이동 횟수만 비교하면(총
  // 수업 건수를 보지 않으면) 인원은 같고 이동만 더 적은 조합이 실제로는 누군가의 2번째
  // 수업 자리를 희생해 이동을 줄인 것일 수 있어, 후보A 제목이 내세우는 "수업 횟수 최대화"를
  // 오히려 후퇴시킬 수 있다(실제로 28건 → 27건으로 줄어드는 문제가 있었다). 총 수업 건수를
  // 이동 횟수보다 먼저 비교해 이런 후퇴를 막는다.
  function strengthenCandidateA(baseline, sorted, eligibleIds, allMemberIds, options, pinned) {
    if (state.locations.length < 2) return baseline;
    let best = baseline;
    let bestCount = new Set(best.assigned.map(r => r.memberId)).size;
    let bestSessions = best.assigned.length;
    let bestTravel = totalTravelCount(best.assigned);
    DAYS.forEach((d, day) => {
      state.locations.forEach(loc => {
        const pinOptions = Object.assign({}, options, { pinnedLocationDay: { day, locationId: loc.id } });
        const attempt = buildCandidate(baseline.title, baseline.desc, sorted, eligibleIds, allMemberIds, pinOptions, pinned);
        const attemptCount = new Set(attempt.assigned.map(r => r.memberId)).size;
        const attemptSessions = attempt.assigned.length;
        const attemptTravel = totalTravelCount(attempt.assigned);
        const better = attemptCount > bestCount
          || (attemptCount === bestCount && attemptSessions > bestSessions)
          || (attemptCount === bestCount && attemptSessions === bestSessions && attemptTravel < bestTravel);
        if (better) {
          best = attempt; bestCount = attemptCount; bestSessions = attemptSessions; bestTravel = attemptTravel;
        }
      });
    });
    return best;
  }

  function buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, jitter, pinned) {
    const strategy = STRATEGIES[strategyIndex];
    const sorted = strategy.sort(eligible, jitter);
    const strategyOptions = typeof strategy.options === "function" ? strategy.options() : strategy.options;
    // "마포점 우선 2회 배정" 체크박스: 모든 후보 전략에 공통으로 적용되는 전역 옵션이므로,
    // 전략별 options 위에 덧씌운다.
    const options = state.priorityMapoDouble
      ? Object.assign({}, strategyOptions, { priorityDoubleLocationId: locationIdByName("마포점") })
      : strategyOptions;
    let cand = buildCandidate(strategy.title, strategy.desc, sorted, eligibleIds, allMemberIds, options, pinned);
    if (strategyIndex === 0) {
      cand = strengthenCandidateA(cand, sorted, eligibleIds, allMemberIds, options, pinned);
    }
    cand.strategyIndex = strategyIndex;
    return cand;
  }

  // strategyIndex별로 "이미 보여준 배정 결과"를 기록해, 재생성 시 똑같은 조합이 다시 나오는지
  // 판별한다. 배정 결과(assigned)를 이루는 신청 id 집합을 그대로 서명으로 쓴다 — 같은
  // 신청 조합이면 같은 서명이 나온다. (페이지를 새로고침하면 초기화되는 세션 한정 기록.)
  const candidateHistory = {}; // strategyIndex -> Set(signature)
  const REGEN_MAX_ATTEMPTS = 10; // 이만큼 시도해도 못 보던 조합이 안 나오면 "새 후보 없음"으로 본다.
  // strategyIndex별로, 재생성으로 덮어쓰기 전의 이전 후보를 순서대로 쌓아둔다 — "이전 후보
  // 다시보기" 버튼으로 되돌아갈 수 있게(여러 번 재생성했으면 여러 단계 되돌아갈 수 있다).
  // candidateHistory와 마찬가지로 새로고침하면 초기화되는 세션 한정 기록.
  const candidateUndoStack = {}; // strategyIndex -> Candidate[]

  function candidateSignature(cand) {
    return cand.assigned.map(r => r.id).slice().sort().join(",");
  }

  function generateCandidates() {
    // "미배정 회원"으로 지정된 회원은 애초에 없었던 것처럼 취급한다 — 배정 대상에서도,
    // (배정 실패가 아니라 의도적 제외이므로) 미배정 통계에서도 뺀다.
    const allMemberIds = new Set(
      state.requests.filter(r => !state.excludedMemberIds.includes(r.memberId)).map(r => r.memberId)
    );
    const eligible = state.requests.filter(isEligibleRequest);
    const eligibleIds = new Set(eligible.map(r => r.id));
    // 모든 후보는 처음 생성할 때 재현 가능하도록 jitter를 0으로 시작한다(후보마다 계산
    // 기준 자체가 달라 굳이 무작위로 섞지 않아도 서로 다른 배치가 나온다).
    const zeroJitter = new Map(eligible.map(r => [r.id, 0]));

    const built = STRATEGIES.map((strategy, idx) =>
      buildCandidateFromStrategy(idx, eligible, eligibleIds, allMemberIds, zeroJitter));
    built.forEach((cand, idx) => { candidateHistory[idx] = new Set([candidateSignature(cand)]); });
    return built;
  }

  // 후보 카드 하나만 같은 전략 안에서 다시 계산한다 (동점인 신청들의 순서를 랜덤으로 바꿔 다른 배정을 시도).
  // 확정된 세션이 있으면 그대로 고정하고, 나머지 신청들 안에서만 다시 배정한다.
  // 이미 봤던 조합만 계속 나오면(REGEN_MAX_ATTEMPTS번 시도해도 새 조합이 없으면), 처음 후보로
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

  function regenerateCandidate(strategyIndex) {
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
      state.requests.filter(r => pinnedIds.has(r.id) || !state.excludedMemberIds.includes(r.memberId)).map(r => r.memberId)
    );
    const eligible = state.requests.filter(r => isEligibleRequest(r) && !pinnedIds.has(r.id));
    const eligibleIds = new Set(eligible.map(r => r.id));

    // 재생성은 "다른 배치를 보여주는 것"이 목적이지, "후보 조건"의 우선순위(인원 최대화 →
    // 이동 횟수 최소화)보다 못한 결과로 후퇴하는 것은 아니다. 기준(jitter 0) 결과의 총 수업
    // 수·총 이동 횟수를 최소 허용선으로 삼아, 그보다 수업이 적거나(수업 수가 같은데) 이동이
    // 더 많은 시도는 아무리 새로운 조합이어도 버린다 — 안 그러면 동점 tie-break가 요일 처리
    // 순서에 따라 우연히 더 나쁜 조합으로 이어질 수 있는데, 그런 결과까지 "새 후보"로
    // 보여주면 안 된다.
    const zeroJitter = new Map(eligible.map(r => [r.id, 0]));
    const baseline = buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, zeroJitter, pinned);
    const minAcceptableSessions = baseline.assigned.length;
    const maxAcceptableTravelCountAtMinSessions = totalTravelCount(baseline.assigned);

    let newCand = null;
    for (let i = 0; i < REGEN_MAX_ATTEMPTS; i++) {
      const jitter = new Map(eligible.map(r => [r.id, Math.random()]));
      const attempt = buildCandidateFromStrategy(strategyIndex, eligible, eligibleIds, allMemberIds, jitter, pinned);
      if (attempt.assigned.length < minAcceptableSessions) continue; // 기준보다 수업이 적으면 버린다
      // 수업 수가 기준과 동점일 때만 이동 횟수를 비교한다 — 수업 수가 기준보다 많다면
      // "인원 최대화"가 "이동 횟수 최소화"보다 우선이므로 이동이 늘어도 받아들인다.
      if (attempt.assigned.length === minAcceptableSessions
        && totalTravelCount(attempt.assigned) > maxAcceptableTravelCountAtMinSessions) continue;
      const sig = candidateSignature(attempt);
      if (!seen.has(sig)) {
        newCand = attempt;
        seen.add(sig);
        break;
      }
    }

    if (!newCand) {
      if (!confirm("새로운 후보지가 없습니다. 처음 후보지부터 다시 표시하시겠습니까?")) return;
      newCand = baseline;
      candidateHistory[strategyIndex] = new Set([candidateSignature(newCand)]);
      newCand.confirmedIds = [...confirmedIds];
      if (prevCand) {
        if (!candidateUndoStack[strategyIndex]) candidateUndoStack[strategyIndex] = [];
        candidateUndoStack[strategyIndex].push(prevCand);
      }
      candidates[strategyIndex] = newCand;
      saveState();
      renderCandidates();
      showToast("처음 후보로 다시 표시되었습니다", "info");
      return;
    }

    newCand.confirmedIds = [...confirmedIds];
    if (prevCand) {
      if (!candidateUndoStack[strategyIndex]) candidateUndoStack[strategyIndex] = [];
      candidateUndoStack[strategyIndex].push(prevCand);
    }
    candidates[strategyIndex] = newCand;
    saveState();
    renderCandidates();
    showToast("후보가 재생성되었습니다", "success");
  }

  // "이전 후보 다시보기": 재생성으로 덮어쓰기 전의 후보로 되돌아간다(여러 번 눌러 여러 단계
  // 되돌아갈 수 있음). 되돌아간 후보를 다시 재생성하면, 그 시점부터 새 이력이 쌓인다.
  function restorePreviousCandidate(strategyIndex) {
    const stack = candidateUndoStack[strategyIndex];
    if (!stack || stack.length === 0) return;
    candidates[strategyIndex] = stack.pop();
    saveState();
    renderCandidates();
    showToast("이전 후보로 되돌아갔습니다", "info");
  }

  // 후보 카드의 일정 하나를 확정한다: 재생성해도 이 일정은 고정되고 나머지만 다시 배정된다.
  function confirmCandidateSession(candidate, reqId) {
    if (!confirm("스케줄을 확정하시겠습니까?")) return;
    if (!Array.isArray(candidate.confirmedIds)) candidate.confirmedIds = [];
    if (!candidate.confirmedIds.includes(reqId)) candidate.confirmedIds.push(reqId);
    saveState();
    renderCandidates();
    showToast("스케줄이 확정되었습니다", "success");
  }

  // 확정된 일정을 다시 눌러 확정을 취소한다.
  function unconfirmCandidateSession(candidate, reqId) {
    if (!confirm("확정된 스케줄을 취소하시겠습니까?")) return;
    candidate.confirmedIds = (candidate.confirmedIds || []).filter(id => id !== reqId);
    saveState();
    renderCandidates();
    showToast("스케줄 확정이 취소되었습니다", "info");
  }

  function candidateToBlocks(candidate) {
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
        onClick: isConfirmed
          ? () => unconfirmCandidateSession(candidate, r.id)
          : () => confirmCandidateSession(candidate, r.id)
      };
    });
  }

  // 같은 요일 안에서 연속된 두 세션 사이마다 블록을 만든다: 지점이 바뀌면 이동 시간,
  // 같은 지점이면(또는 이동 시간이 0분이면) 최소로 보장되는 휴식 시간을 표시한다.
  function candidateToTravelBlocks(candidate) {
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
          travelBlocks.push({ day: prev.day, startSlot, duration: mins, label: "이동 " + mins + "분", type: "travel" });
        } else {
          // 지점이 같아도(또는 이동 시간이 0분이어도) 최소 BREAK_MIN만큼은 쉬는 시간으로 예약돼 있다.
          const breakMin = Math.min(BREAK_MIN, gapMin);
          travelBlocks.push({ day: prev.day, startSlot, duration: breakMin, label: "휴식 " + breakMin + "분", type: "break" });
        }
      }
    });
    return travelBlocks;
  }

  const candidatesEl = document.getElementById("candidates");
  const generateHintEl = document.getElementById("generateHint");
  const minSessionFilterInputEl = document.getElementById("minSessionFilterInput");
  const candidateFilterHiddenCountEl = document.getElementById("candidateFilterHiddenCount");
  minSessionFilterInputEl.addEventListener("input", () => renderCandidates());

  // 한 번 설정해두고 매번 열어보지 않아도 되도록, 현재 걸려있는 "1회 제한 회원"은 칩으로 항상
  // 보여주고(× 로 제거), "+ 추가" 버튼을 눌렀을 때만 아직 추가되지 않은 회원 목록을 드롭다운으로 띄운다.
  const onceLimitMsEl = document.getElementById("onceLimitMs");
  const onceLimitControlEl = document.getElementById("onceLimitControl");
  const onceLimitChipRowEl = document.getElementById("onceLimitChipRow");
  const onceLimitDropdownEl = document.getElementById("onceLimitDropdown");
  let onceLimitDropdownOpen = false;

  // "회원 스케줄 추가" 페이지의 회원 탭과 같은 방식: 지점은 풀네임 대신 한 글자 배지(전체
  // 이름은 title 툴팁)로, 그 뒤에 이름을 붙인다 — 지점 풀네임을 쓰면 칩이 너무 길어지기 때문.
  function appendOnceLimitMemberLabel(container, member) {
    const loc = locationById(member.locationIds[0]);
    if (loc) {
      const badge = document.createElement("span");
      badge.className = "tab-loc";
      badge.textContent = loc.name.charAt(0);
      badge.title = loc.name;
      container.appendChild(badge);
    }
    const nameEl = document.createElement("span");
    nameEl.textContent = member.name;
    container.appendChild(nameEl);
  }

  function onOnceLimitChanged() {
    // 이 옵션은 후보 생성 결과에 바로 영향을 주므로, 이미 생성된 후보가 있으면 즉시 비운다.
    if (candidates.length > 0) {
      candidates = [];
      renderCandidates();
      generateHintEl.textContent = "1회 제한 회원 설정이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    } else {
      requestsChangedSinceGenerate = true;
    }
    saveState();
    renderOnceLimitChips();
    renderOnceLimitDropdown();
  }

  function addOnceLimitMember(memberId) {
    if (state.onceLimitedMemberIds.includes(memberId)) return;
    if (state.excludedMemberIds.includes(memberId)) {
      alert("미배정 회원에 추가되어 있는 회원입니다.\n미배정 회원에서 삭제 후 다시 추가해 주세요.");
      return;
    }
    state.onceLimitedMemberIds = state.onceLimitedMemberIds.concat(memberId);
    onOnceLimitChanged();
  }

  function removeOnceLimitMember(memberId) {
    state.onceLimitedMemberIds = state.onceLimitedMemberIds.filter(id => id !== memberId);
    onOnceLimitChanged();
  }

  // 지점 등록 순서로 먼저 묶고, 같은 지점 안에서는 이름을 가나다순으로 정렬한다.
  function compareOnceLimitMembers(a, b) {
    const locOrder = new Map(state.locations.map((l, i) => [l.id, i]));
    const aIdx = locOrder.has(a.locationIds[0]) ? locOrder.get(a.locationIds[0]) : Infinity;
    const bIdx = locOrder.has(b.locationIds[0]) ? locOrder.get(b.locationIds[0]) : Infinity;
    return (aIdx - bIdx) || a.name.localeCompare(b.name, "ko");
  }

  function renderOnceLimitChips() {
    onceLimitChipRowEl.innerHTML = "";
    // "+ 추가" 버튼은 회원 칩이 몇 개든 항상 목록 맨 앞(같은 자리)에 오도록 매번 다시 붙인다.
    onceLimitChipRowEl.appendChild(onceLimitMsEl);
    const selectedMembers = state.onceLimitedMemberIds
      .map(id => memberById(id))
      .filter(isOnceLimitEligible)
      .sort(compareOnceLimitMembers);
    if (selectedMembers.length === 0) {
      const placeholder = document.createElement("span");
      placeholder.className = "ms-placeholder";
      placeholder.textContent = "설정된 회원 없음";
      onceLimitChipRowEl.appendChild(placeholder);
      return;
    }
    selectedMembers.forEach(m => {
      const chip = document.createElement("span");
      chip.className = "chip";
      appendOnceLimitMemberLabel(chip, m);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.title = "제거";
      removeBtn.addEventListener("click", () => removeOnceLimitMember(m.id));
      chip.appendChild(removeBtn);
      onceLimitChipRowEl.appendChild(chip);
    });
  }

  function renderOnceLimitDropdown() {
    onceLimitDropdownEl.innerHTML = "";
    const eligibleMembers = state.members.filter(isOnceLimitEligible);
    const addable = eligibleMembers
      .filter(m => !state.onceLimitedMemberIds.includes(m.id))
      .sort(compareOnceLimitMembers);
    if (eligibleMembers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-empty";
      empty.textContent = "등록 회원이 없습니다. (상담 회원은 이미 항상 1회로 제한됩니다)";
      onceLimitDropdownEl.appendChild(empty);
      return;
    }
    if (addable.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-empty";
      empty.textContent = "모든 회원이 이미 추가되어 있습니다.";
      onceLimitDropdownEl.appendChild(empty);
      return;
    }
    addable.forEach(m => {
      const item = document.createElement("div");
      item.className = "ms-option";
      item.setAttribute("role", "option");
      appendOnceLimitMemberLabel(item, m);
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        addOnceLimitMember(m.id);
      });
      onceLimitDropdownEl.appendChild(item);
    });
  }

  function openOnceLimitDropdown() {
    if (!state.members.some(isOnceLimitEligible)) return;
    onceLimitDropdownOpen = true;
    onceLimitMsEl.classList.add("open");
    onceLimitControlEl.setAttribute("aria-expanded", "true");
  }

  function closeOnceLimitDropdown() {
    onceLimitDropdownOpen = false;
    onceLimitMsEl.classList.remove("open");
    onceLimitControlEl.setAttribute("aria-expanded", "false");
  }

  onceLimitControlEl.addEventListener("click", () => {
    if (onceLimitDropdownOpen) closeOnceLimitDropdown();
    else openOnceLimitDropdown();
  });

  function renderOnceLimitUI() {
    state.onceLimitedMemberIds = state.onceLimitedMemberIds.filter(id => isOnceLimitEligible(memberById(id)));
    renderOnceLimitChips();
    renderOnceLimitDropdown();
  }

  document.addEventListener("click", (e) => {
    if (onceLimitDropdownOpen && !onceLimitMsEl.contains(e.target)) closeOnceLimitDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && onceLimitDropdownOpen) closeOnceLimitDropdown();
  });

  // "미배정 회원": 선택한 회원은 후보 생성에서 아예 제외한다(1회 제한 회원과 같은 칩+드롭다운
  // UI를 그대로 따른다). 구분과 무관하게 모든 회원이 대상이다.
  const excludedMsEl = document.getElementById("excludedMs");
  const excludedControlEl = document.getElementById("excludedControl");
  const excludedChipRowEl = document.getElementById("excludedChipRow");
  const excludedDropdownEl = document.getElementById("excludedDropdown");
  let excludedDropdownOpen = false;

  function onExcludedChanged() {
    // 이 옵션은 후보 생성 결과에 바로 영향을 주므로, 이미 생성된 후보가 있으면 즉시 비운다.
    if (candidates.length > 0) {
      candidates = [];
      renderCandidates();
      generateHintEl.textContent = "미배정 회원 설정이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    } else {
      requestsChangedSinceGenerate = true;
    }
    saveState();
    renderExcludedChips();
    renderExcludedDropdown();
  }

  function addExcludedMember(memberId) {
    if (state.excludedMemberIds.includes(memberId)) return;
    if (state.onceLimitedMemberIds.includes(memberId)) {
      alert("1회 제한 회원에 추가되어 있는 회원입니다.\n1회 제한 회원에서 삭제 후 다시 추가해 주세요.");
      return;
    }
    if (state.requiredMemberIds.includes(memberId)) {
      alert("필수 배정 회원에 추가되어 있는 회원입니다.\n필수 배정 회원에서 삭제 후 다시 추가해 주세요.");
      return;
    }
    state.excludedMemberIds = state.excludedMemberIds.concat(memberId);
    onExcludedChanged();
  }

  function removeExcludedMember(memberId) {
    state.excludedMemberIds = state.excludedMemberIds.filter(id => id !== memberId);
    onExcludedChanged();
  }

  function renderExcludedChips() {
    excludedChipRowEl.innerHTML = "";
    // "+ 추가" 버튼은 회원 칩이 몇 개든 항상 목록 맨 앞(같은 자리)에 오도록 매번 다시 붙인다.
    excludedChipRowEl.appendChild(excludedMsEl);
    const selectedMembers = state.excludedMemberIds
      .map(id => memberById(id))
      .filter(Boolean)
      .sort(compareOnceLimitMembers);
    if (selectedMembers.length === 0) {
      const placeholder = document.createElement("span");
      placeholder.className = "ms-placeholder";
      placeholder.textContent = "설정된 회원 없음";
      excludedChipRowEl.appendChild(placeholder);
      return;
    }
    selectedMembers.forEach(m => {
      const chip = document.createElement("span");
      chip.className = "chip chip-excluded";
      appendOnceLimitMemberLabel(chip, m);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.title = "제거";
      removeBtn.addEventListener("click", () => removeExcludedMember(m.id));
      chip.appendChild(removeBtn);
      excludedChipRowEl.appendChild(chip);
    });
  }

  function renderExcludedDropdown() {
    excludedDropdownEl.innerHTML = "";
    const addable = state.members
      .filter(m => !state.excludedMemberIds.includes(m.id))
      .sort(compareOnceLimitMembers);
    if (state.members.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-empty";
      empty.textContent = "등록된 회원이 없습니다.";
      excludedDropdownEl.appendChild(empty);
      return;
    }
    if (addable.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-empty";
      empty.textContent = "모든 회원이 이미 추가되어 있습니다.";
      excludedDropdownEl.appendChild(empty);
      return;
    }
    addable.forEach(m => {
      const item = document.createElement("div");
      item.className = "ms-option";
      item.setAttribute("role", "option");
      appendOnceLimitMemberLabel(item, m);
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        addExcludedMember(m.id);
      });
      excludedDropdownEl.appendChild(item);
    });
  }

  function openExcludedDropdown() {
    if (state.members.length === 0) return;
    excludedDropdownOpen = true;
    excludedMsEl.classList.add("open");
    excludedControlEl.setAttribute("aria-expanded", "true");
  }

  function closeExcludedDropdown() {
    excludedDropdownOpen = false;
    excludedMsEl.classList.remove("open");
    excludedControlEl.setAttribute("aria-expanded", "false");
  }

  excludedControlEl.addEventListener("click", () => {
    if (excludedDropdownOpen) closeExcludedDropdown();
    else openExcludedDropdown();
  });

  function renderExcludedUI() {
    state.excludedMemberIds = state.excludedMemberIds.filter(id => !!memberById(id));
    renderExcludedChips();
    renderExcludedDropdown();
  }

  document.addEventListener("click", (e) => {
    if (excludedDropdownOpen && !excludedMsEl.contains(e.target)) closeExcludedDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && excludedDropdownOpen) closeExcludedDropdown();
  });

  // "필수 배정 회원": 선택한 회원은 가능하다면 무조건 1회 이상 배정한다(미배정 회원·1회 제한
  // 회원과 같은 칩+드롭다운 UI를 그대로 따른다). "미배정 회원"과는 의미가 정반대라 동시에
  // 지정할 수 없고, "1회 제한 회원"과는 함께 지정하면 정확히 1회로 배정된다.
  const requiredMsEl = document.getElementById("requiredMs");
  const requiredControlEl = document.getElementById("requiredControl");
  const requiredChipRowEl = document.getElementById("requiredChipRow");
  const requiredDropdownEl = document.getElementById("requiredDropdown");
  let requiredDropdownOpen = false;

  function onRequiredChanged() {
    // 이 옵션은 후보 생성 결과에 바로 영향을 주므로, 이미 생성된 후보가 있으면 즉시 비운다.
    if (candidates.length > 0) {
      candidates = [];
      renderCandidates();
      generateHintEl.textContent = "필수 배정 회원 설정이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    } else {
      requestsChangedSinceGenerate = true;
    }
    saveState();
    renderRequiredChips();
    renderRequiredDropdown();
  }

  function addRequiredMember(memberId) {
    if (state.requiredMemberIds.includes(memberId)) return;
    if (state.excludedMemberIds.includes(memberId)) {
      alert("미배정 회원에 추가되어 있는 회원입니다.\n미배정 회원에서 삭제 후 다시 추가해 주세요.");
      return;
    }
    if (!state.requests.some(r => r.memberId === memberId)) {
      alert("회원 스케줄이 없습니다. 회원 스케줄을 추가해 주세요.");
      return;
    }
    state.requiredMemberIds = state.requiredMemberIds.concat(memberId);
    onRequiredChanged();
  }

  function removeRequiredMember(memberId) {
    state.requiredMemberIds = state.requiredMemberIds.filter(id => id !== memberId);
    onRequiredChanged();
  }

  function renderRequiredChips() {
    requiredChipRowEl.innerHTML = "";
    // "+ 추가" 버튼은 회원 칩이 몇 개든 항상 목록 맨 앞(같은 자리)에 오도록 매번 다시 붙인다.
    requiredChipRowEl.appendChild(requiredMsEl);
    const selectedMembers = state.requiredMemberIds
      .map(id => memberById(id))
      .filter(Boolean)
      .sort(compareOnceLimitMembers);
    if (selectedMembers.length === 0) {
      const placeholder = document.createElement("span");
      placeholder.className = "ms-placeholder";
      placeholder.textContent = "설정된 회원 없음";
      requiredChipRowEl.appendChild(placeholder);
      return;
    }
    selectedMembers.forEach(m => {
      const chip = document.createElement("span");
      chip.className = "chip";
      appendOnceLimitMemberLabel(chip, m);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.title = "제거";
      removeBtn.addEventListener("click", () => removeRequiredMember(m.id));
      chip.appendChild(removeBtn);
      requiredChipRowEl.appendChild(chip);
    });
  }

  function renderRequiredDropdown() {
    requiredDropdownEl.innerHTML = "";
    const addable = state.members
      .filter(m => !state.requiredMemberIds.includes(m.id))
      .sort(compareOnceLimitMembers);
    if (state.members.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-empty";
      empty.textContent = "등록된 회원이 없습니다.";
      requiredDropdownEl.appendChild(empty);
      return;
    }
    if (addable.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-empty";
      empty.textContent = "모든 회원이 이미 추가되어 있습니다.";
      requiredDropdownEl.appendChild(empty);
      return;
    }
    addable.forEach(m => {
      const item = document.createElement("div");
      item.className = "ms-option";
      item.setAttribute("role", "option");
      appendOnceLimitMemberLabel(item, m);
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        addRequiredMember(m.id);
      });
      requiredDropdownEl.appendChild(item);
    });
  }

  function openRequiredDropdown() {
    if (state.members.length === 0) return;
    requiredDropdownOpen = true;
    requiredMsEl.classList.add("open");
    requiredControlEl.setAttribute("aria-expanded", "true");
  }

  function closeRequiredDropdown() {
    requiredDropdownOpen = false;
    requiredMsEl.classList.remove("open");
    requiredControlEl.setAttribute("aria-expanded", "false");
  }

  requiredControlEl.addEventListener("click", () => {
    if (requiredDropdownOpen) closeRequiredDropdown();
    else openRequiredDropdown();
  });

  function renderRequiredUI() {
    state.requiredMemberIds = state.requiredMemberIds.filter(id => !!memberById(id));
    renderRequiredChips();
    renderRequiredDropdown();
  }

  document.addEventListener("click", (e) => {
    if (requiredDropdownOpen && !requiredMsEl.contains(e.target)) closeRequiredDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && requiredDropdownOpen) closeRequiredDropdown();
  });

  const priorityMapoDoubleCheckboxEl = document.getElementById("priorityMapoDoubleCheckbox");
  priorityMapoDoubleCheckboxEl.addEventListener("change", () => {
    state.priorityMapoDouble = priorityMapoDoubleCheckboxEl.checked;
    // 이 옵션은 후보 생성 결과에 바로 영향을 주므로, 이미 생성된 후보가 있으면 즉시 비운다.
    if (candidates.length > 0) {
      candidates = [];
      renderCandidates();
      generateHintEl.textContent = "마포점 우선 2회 배정 설정이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    } else {
      requestsChangedSinceGenerate = true;
    }
    saveState();
  });

  const candidateRulesBlockEl = document.getElementById("candidateRulesBlock");
  const candidateRulesToggleEl = document.getElementById("candidateRulesToggle");
  candidateRulesToggleEl.addEventListener("click", () => {
    const collapsed = candidateRulesBlockEl.classList.toggle("collapsed");
    candidateRulesToggleEl.setAttribute("aria-expanded", String(!collapsed));
  });

  document.getElementById("generateBtn").addEventListener("click", () => {
    if (state.locations.length === 0) {
      generateHintEl.textContent = "먼저 설정 페이지에서 지점을 등록해주세요.";
      return;
    }
    if (availableCells.size === 0) {
      generateHintEl.textContent = "먼저 설정 페이지에서 근무 가능 시간을 설정해주세요.";
      return;
    }
    if (state.requests.length === 0) {
      generateHintEl.textContent = "먼저 회원 스케줄 추가 페이지에서 가능 시간을 등록해주세요.";
      return;
    }
    generateHintEl.textContent = "";
    candidates = generateCandidates();
    Object.keys(candidateUndoStack).forEach(k => delete candidateUndoStack[k]); // 새로 생성하면 이전 후보 이력도 초기화
    requestsChangedSinceGenerate = false;
    renderCandidates();
    saveState();
    showToast("후보가 생성되었습니다", "success");
  });

  function renderCandidates() {
    candidatesEl.innerHTML = "";

    // "수업 N건 이상 후보만 보기": 이미 계산된 후보 중 보여줄 것만 고르는 화면 필터일 뿐,
    // 후보 자체를 다시 계산하지는 않는다. 값이 비었거나 숫자가 아니면 필터를 걸지 않는다(0건 이상).
    const minSessions = Math.max(0, parseInt(minSessionFilterInputEl.value, 10) || 0);
    const visibleCandidates = candidates.filter(cand => cand.assigned.length >= minSessions);
    const hiddenCount = candidates.length - visibleCandidates.length;
    // 필터에 걸려 일부만 안 보이는 걸 못 알아채고 "후보가 이것밖에 없나" 오해하지 않도록,
    // 숨겨진 개수를 필터 바로 아래에 작게 표시한다.
    candidateFilterHiddenCountEl.textContent = hiddenCount > 0 ? hiddenCount + "개 숨김" : "";

    if (candidates.length > 0 && visibleCandidates.length === 0) {
      const empty = document.createElement("p");
      empty.className = "generate-hint";
      empty.textContent = "수업 " + minSessions + "건 이상인 후보가 없습니다.";
      candidatesEl.appendChild(empty);
    }

    visibleCandidates.forEach((cand) => {
      const card = document.createElement("div");
      card.className = "candidate-card";

      const head = document.createElement("div");
      head.className = "candidate-card-head";

      if (cand.title) {
        const title = document.createElement("h3");
        title.className = "candidate-title";
        title.textContent = cand.title;
        head.appendChild(title);
      }

      const actions = document.createElement("div");
      actions.className = "candidate-card-actions";

      const undoStackForThis = candidateUndoStack[cand.strategyIndex] || [];
      const undoBtn = document.createElement("button");
      undoBtn.type = "button";
      undoBtn.className = "btn btn-ghost btn-small regen-candidate-btn";
      undoBtn.textContent = "↩ 이전 후보";
      undoBtn.title = "재생성하기 전의 후보로 되돌아갑니다.";
      undoBtn.disabled = undoStackForThis.length === 0;
      undoBtn.addEventListener("click", () => {
        restorePreviousCandidate(cand.strategyIndex);
      });
      actions.appendChild(undoBtn);

      const regenBtn = document.createElement("button");
      regenBtn.type = "button";
      regenBtn.className = "btn btn-ghost btn-small regen-candidate-btn";
      regenBtn.textContent = "↻ 다음 후보";
      regenBtn.title = "이 후보만 같은 전략 안에서 다시 계산합니다.";
      regenBtn.disabled = !hasRegenerableEligible(cand.strategyIndex);
      regenBtn.addEventListener("click", () => {
        regenerateCandidate(cand.strategyIndex);
      });
      actions.appendChild(regenBtn);
      head.appendChild(actions);

      card.appendChild(head);

      if (cand.desc) {
        const desc = document.createElement("p");
        desc.className = "candidate-desc";
        desc.textContent = cand.desc;
        card.appendChild(desc);
      }

      const stats = document.createElement("div");
      stats.className = "candidate-stats";
      const pill1 = document.createElement("span");
      pill1.className = "stat-pill";
      if (cand.unassignedMembers.length > 0) {
        pill1.textContent = "미배정 " + cand.unassignedMembers.length + "명";
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
      pill2.textContent = "수업 " + cand.assigned.length + "건";
      stats.appendChild(pill2);
      const pill3 = document.createElement("span");
      pill3.className = "stat-pill";
      pill3.textContent = "이동 " + totalTravelCount(cand.assigned) + "번";
      stats.appendChild(pill3);
      card.appendChild(stats);

      const gridWrap = document.createElement("div");
      gridWrap.className = "grid-scroll";
      const gridEl = document.createElement("div");
      gridEl.className = "cal-grid";
      gridWrap.appendChild(gridEl);
      card.appendChild(gridWrap);

      const gridRange = businessHoursGridRange();
      renderGrid(gridEl, availableCells, {
        blocks: candidateToBlocks(cand),
        travelBlocks: candidateToTravelBlocks(cand),
        rangeStartSlot: gridRange.rangeStartSlot,
        rangeEndSlot: gridRange.rangeEndSlot
      });

      if (cand.unassignedMembers.length > 0) {
        const box = document.createElement("div");
        box.className = "unassigned-box unassigned-box-danger";
        box.innerHTML = "<b>미배정 회원 (" + cand.unassignedMembers.length + "명)</b> · " +
          cand.unassignedMembers.map(m => m.name).join(", ");
        card.appendChild(box);
      }

      if (cand.singleAssignedMembers.length > 0) {
        const box = document.createElement("div");
        box.className = "unassigned-box single-assigned-box";
        box.innerHTML = "<b>1회 배정 회원 (" + cand.singleAssignedMembers.length + "명)</b> · " +
          cand.singleAssignedMembers.map(m => m.name).join(", ");
        card.appendChild(box);
      }

      candidatesEl.appendChild(card);
    });
  }

  /* ---------------- Page navigation (left sidebar, no forced order) ---------------- */
  const pageEls = {
    settings: document.getElementById("pageSettings"),
    schedule: document.getElementById("pageSchedule"),
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
    if (pageId === "schedule" && requestsChangedSinceGenerate) {
      requestsChangedSinceGenerate = false;
      if (candidates.length > 0) {
        candidates = [];
        renderCandidates();
        saveState();
        generateHintEl.textContent = "신청 시간이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
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

  /* ---------------- Init ---------------- */
  function init() {
    loadState();
    renderLocationList();
    renderTravelMatrix();
    populateMemberLocationSelect();
    renderMemberTable();
    renderAvailabilityList();
    renderRequestList();
    priorityMapoDoubleCheckboxEl.checked = state.priorityMapoDouble;
    if (candidates.length) renderCandidates();
    goToPage(currentPage);
  }

  init();
})();
