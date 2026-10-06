import {
  START_MIN,
  SLOT_MIN,
  SLOT_SCALE,
  DAYS,
  STORAGE_KEY,
  OLD_STORAGE_KEY,
  DEFAULT_LOCATION_NAMES,
  DEFAULT_BUSINESS_DAY_INDICES,
  DEFAULT_BUSINESS_START_SLOT,
  DEFAULT_BUSINESS_END_SLOT,
  STRATEGY_COUNT,
  defaultTravelMinutesFor,
} from "./constants.js";
import { cellKey, uid } from "./utils.js";
// domain.js도 state.js를 import한다(순환) — 두 모듈 다 이 바인딩들을 함수 몸통 안에서만
// 쓰고 모듈 최상단 평가 시점에는 쓰지 않으므로 ES 모듈 순환 import로 안전하게 동작한다.
import {
  memberById,
  isOnceLimitEligible,
  sessionDurationFor,
  pairKey,
} from "./domain.js";

/* ---------------- State ---------------- */
export const CURRENT_SCHEMA_VERSION = 1;

export let state = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  availableCells: [], // array of "day-slot" strings
  locations: [], // {id, name}
  travelTimes: {}, // { "locIdA|locIdB": minutes }
  members: [], // {id, name, locationIds: [locId, ...]}
  requests: [], // {id, memberId, locationId, day, startSlot, duration}
  // "수업 스케줄 생성3" 전용 설정 (생성1·생성2 엔진을 withSelectionOverride로 재사용해 후보 3개를 한 화면에 보여줌)
  onceLimitedMemberIds3: [], // 스케줄 생성3에서 최대 1회만 배정되어야 하는 회원 id 목록
  excludedMemberIds3: [], // 스케줄 생성3에서 후보 생성 시 아예 제외할 회원 id 목록
};

// state 객체 자체는 절대 재대입하지 않고 항상 속성만 바꾼다(위 loadState 등 참고). candidates/
// schedule3Result처럼 통째로 재대입되는 값들은 ES 모듈 import 바인딩이 읽기 전용이라 그대로
// 내보낼 수 없으므로, 이 하나의 mutable 객체의 속성으로 모아 다른 모듈에서도 재대입 대신
// 속성 대입(runtime.candidates = ...)으로 바꾸게 한다.
export const runtime = {
  availableCells: new Set(),
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
  storageError: null,
};

export class GenerationCancelledError extends Error {}

// 후보 생성 중(수 초~수 분) 모바일 화면이 꺼져 진행이 중단된 것처럼 보이지 않도록 Wake Lock을
// 건다. 브라우저가 탭 전환/화면 잠금 시 잠금을 자동 해제하므로, 다시 보이는 시점에
// generationInProgress가 여전히 true면 재요청한다. 미지원 브라우저에서는 조용히 무시한다.
let wakeLockSentinel = null;
export async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
  } catch {
    wakeLockSentinel = null;
  }
}
export async function releaseWakeLock() {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  if (sentinel) {
    try {
      await sentinel.release();
    } catch {
      // 이미 해제된 잠금을 다시 해제하려 할 때 등 — 무해하므로 무시한다.
    }
  }
}
// 엔진 Web Worker(engine/engineWorker.js)도 이 모듈을 불러오는데 워커에는 document가 없다.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && runtime.generationInProgress) {
      acquireWakeLock();
    }
  });
}

export const PAGE_IDS = ["settings", "schedule3", "members", "memberSchedule"];
// Pages from before the sidebar redesign ("requests"/"candidates"/"confirm"), and "schedule"/"schedule2"
// from before those menus were removed, all live under "schedule3" now.
export const OLD_PAGE_TO_NEW = {
  settings: "settings",
  requests: "schedule3",
  candidates: "schedule3",
  confirm: "schedule3",
  schedule: "schedule3",
  schedule2: "schedule3",
};

/* ---------------- Persistence ---------------- */
function emitStorageStatus(ok, error = null) {
  runtime.storageError = ok ? null : error;
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    typeof window.CustomEvent === "function"
  ) {
    window.dispatchEvent(
      new window.CustomEvent("pt-storage-status", {
        detail: { ok, error: error ? String(error.message || error) : null },
      }),
    );
  }
}

export function saveState() {
  if (runtime.suppressAutosave) return true;
  state.schemaVersion = CURRENT_SCHEMA_VERSION;
  state.availableCells = Array.from(runtime.availableCells);
  state.candidates = runtime.candidates;
  state.schedule3Result = runtime.schedule3Result;
  state.currentPage = runtime.currentPage;
  state.startMinBase = START_MIN; // 슬롯 인덱스가 어느 시작 시각을 기준으로 저장됐는지 기록 (마이그레이션용)
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

// 근무 가능 시간 시작 선택창에 12:00, 12:30을 추가하면서 하루 슬롯의 기준 시각이 13:00에서
// 12:00으로 1시간(6슬롯) 당겨졌다. 옛 기준(13:00 또는 그 이전 버전)으로 저장된 슬롯 인덱스는
// 그대로 두면 시각이 1시간씩 밀려 보이므로, 새 기준에 맞게 전부 +shiftSlots만큼 옮겨준다.
// 이미 새 기준으로 저장된 데이터(startMinBase === START_MIN)는 다시 옮기지 않는다.
const LEGACY_START_MIN = 13 * 60;

function clearParsedScheduleCandidates(parsed) {
  parsed.candidates = [];
  parsed.schedule3Result = { candidateAList: [null, null, null] };
}

// 후보 유효성에 영향을 주는 입력(신청, 회원 정보, 지점, 이동시간, 근무 가능 시간, 제외/1회 제한)의
// 지문. 생성할 때 schedule3Result.inputKey로 함께 저장하고, 현재 입력과 다르면 후보를 사용자가 수정한
// 것까지 모두 버린다(schedule3.js의 dropStaleCandidates). 배열 순서는 의미가 없으므로 정렬해서 만든다.
export function candidateInputKey() {
  const sortedJson = (list) =>
    (list || [])
      .map((x) => JSON.stringify(x))
      .sort()
      .join("\n");
  const text = [
    sortedJson(state.requests),
    // 이름·메모는 배정에 쓰이지 않는다. (지점 이름은 세 지점·비효율 이동 규칙이 읽으므로 넣는다.)
    sortedJson(
      state.members.map((m) => ({
        id: m.id,
        locationIds: m.locationIds,
        category: m.category,
      })),
    ),
    sortedJson(state.locations),
    JSON.stringify(Object.entries(state.travelTimes || {}).sort()),
    Array.from(runtime.availableCells).sort().join(","),
    (state.excludedMemberIds3 || []).slice().sort().join(","),
    (state.onceLimitedMemberIds3 || []).slice().sort().join(","),
  ].join("\u0001");
  // 32비트 곱셈 해시 두 개(FNV-1a 계열) — 암호용이 아니라 입력이 바뀌었는지만 본다.
  let h1 = 0x811c9dc5,
    h2 = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(36) + "-" + (h2 >>> 0).toString(36);
}

export function clearRuntimeScheduleCandidates() {
  runtime.candidates = [];
  runtime.schedule3Result = { candidateAList: [null, null, null] };
}

export function migrateStartMinShift(parsed) {
  const savedBase =
    typeof parsed.startMinBase === "number"
      ? parsed.startMinBase
      : LEGACY_START_MIN;
  if (savedBase === START_MIN) return;
  const shiftSlots = (savedBase - START_MIN) / SLOT_MIN;
  parsed.availableCells = (parsed.availableCells || []).map((key) => {
    const [dayStr, slotStr] = key.split("-");
    return cellKey(parseInt(dayStr, 10), parseInt(slotStr, 10) + shiftSlots);
  });
  (parsed.requests || []).forEach((r) => {
    r.startSlot += shiftSlots;
  });
  // 옛 기준으로 계산된 후보A/B/C는 시각이 안 맞으므로 모두 다시 생성하도록 비운다.
  clearParsedScheduleCandidates(parsed);
}

// Pre-page-nav saves stored a numeric wizard step (1~5); map it onto the closest page.
function pageFromLegacyStep(step) {
  if (step <= 2) return "settings";
  return OLD_PAGE_TO_NEW.schedule;
}

// 옛 30분 슬롯 데이터를 새 10분 슬롯 인덱스로 환산 (근무 가능 시간 1칸 -> 3칸으로 확장)
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
    startSlot: r.startSlot * SLOT_SCALE,
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
    currentStep: parsed.currentStep,
  };
}

export function loadState() {
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
      const savedSchemaVersion =
        parsed.schemaVersion === undefined ? 0 : parsed.schemaVersion;
      if (
        !Number.isInteger(savedSchemaVersion) ||
        savedSchemaVersion < 0 ||
        savedSchemaVersion > CURRENT_SCHEMA_VERSION
      )
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
      // 후보A가 카드 1장(candidateA)에서 카드 3장(candidateAList)으로 바뀌기 전에 저장된
      // 데이터는 옛 단일 후보를 0번 칸으로 옮겨온다 — 버리지 않고 그대로 보여준다.
      if (
        parsed.schedule3Result &&
        Array.isArray(parsed.schedule3Result.candidateAList)
      ) {
        const list = parsed.schedule3Result.candidateAList.slice(0, 3);
        while (list.length < 3) list.push(null);
        runtime.schedule3Result = { candidateAList: list };
        // inputKey가 없으면(이 정책 이전 저장분) "모름"으로 두고 dropStaleCandidates가 처리한다.
        if (typeof parsed.schedule3Result.inputKey === "string")
          runtime.schedule3Result.inputKey = parsed.schedule3Result.inputKey;
      } else {
        const legacyCandidateA =
          (parsed.schedule3Result && parsed.schedule3Result.candidateA) || null;
        runtime.schedule3Result = {
          candidateAList: [legacyCandidateA, null, null],
        };
      }
      // "수업 스케줄 생성1"/"생성2" 메뉴 삭제 이전에 저장된 생성3 결과(schedule3Result.candidateB/C)를
      // 새 저장소(candidates 배열)로 1회 이관한다 — candidates가 비어있을 때만(옛 candidates 값이
      // 남아있다면 그건 이미 폐지된 생성1 페이지의 결과라 더 이상 의미가 없으므로 생성3 쪽을 우선한다).
      if (
        parsed.schedule3Result &&
        (parsed.schedule3Result.candidateB || parsed.schedule3Result.candidateC)
      ) {
        runtime.candidates = [
          parsed.schedule3Result.candidateB,
          parsed.schedule3Result.candidateC,
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
  // First-ever run: seed the trainer's usual branches, 지점 간 이동 시간, 근무 가능 시간
  // 이 비어있지 않도록 기본값을 채워둔다.
  if (!hadSavedState && state.locations.length === 0) {
    state.locations = DEFAULT_LOCATION_NAMES.map((name) => ({
      id: uid("loc"),
      name,
    }));
    for (let i = 0; i < state.locations.length; i++) {
      for (let j = i + 1; j < state.locations.length; j++) {
        const locA = state.locations[i],
          locB = state.locations[j];
        state.travelTimes[pairKey(locA.id, locB.id)] = defaultTravelMinutesFor(
          locA.name,
          locB.name,
        );
      }
    }
  }
  if (!hadSavedState && runtime.availableCells.size === 0) {
    DEFAULT_BUSINESS_DAY_INDICES.forEach((di) => {
      for (
        let s = DEFAULT_BUSINESS_START_SLOT;
        s < DEFAULT_BUSINESS_END_SLOT;
        s++
      )
        runtime.availableCells.add(cellKey(di, s));
    });
  }
  // Migrate members saved under the old single-branch field (locationId) to the
  // multi-branch array (locationIds), backfilling from their first request if neither is set.
  state.members.forEach((m) => {
    if (!Array.isArray(m.locationIds)) {
      m.locationIds = m.locationId ? [m.locationId] : [];
      delete m.locationId;
    }
    if (m.locationIds.length === 0) {
      const firstReq = state.requests.find(
        (r) => r.memberId === m.id && r.locationId,
      );
      if (firstReq) m.locationIds = [firstReq.locationId];
    }
    if (typeof m.memo !== "string") m.memo = "";
    if (m.category === "PT 등록") m.category = "등록"; // 구분 문구 변경(PT 등록 → 등록) 마이그레이션
  });
  // Requests no longer pin a single branch of their own — a member's desired time is now
  // eligible at any of their registered branches, decided per-candidate at generation time.
  state.requests.forEach((r) => {
    delete r.locationId;
  });
  // 회원 구분(상담/등록)이 바뀐 뒤에도 그 회원의 기존 신청들이 옛 구분 기준 길이(예: 상담 30분)를
  // 그대로 갖고 있는 경우를 바로잡는다 — 신청의 길이는 항상 회원의 현재 구분과 일치해야 한다.
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
  // 전략(STRATEGIES) 목록이 줄어들어, 더 이상 존재하지 않는 strategyIndex를 가리키는 옛
  // 후보가 남아있으면 "다음 후보" 클릭 시 STRATEGIES[strategyIndex]가 undefined라 에러가
  // 나므로, 그런 후보가 하나라도 있으면 전체를 비워 다시 생성하게 한다.
  if (
    runtime.candidates.some(
      (c) => c.strategyIndex < 0 || c.strategyIndex >= STRATEGY_COUNT,
    )
  )
    clearRuntimeScheduleCandidates();
  // 삭제된 회원이나 상담 회원(이미 항상 1회로 제한됨)을 가리키는 1회 제한 설정은 정리한다.
  state.onceLimitedMemberIds3 = state.onceLimitedMemberIds3.filter((id) =>
    isOnceLimitEligible(memberById(id)),
  );
  state.excludedMemberIds3 = state.excludedMemberIds3.filter(
    (id) => !!memberById(id),
  );
  // 일요일 기능이 제거되어(DAYS에서 빠짐), 옛 요일 인덱스 6(일요일)을 가리키던 데이터가 남아있다면 정리한다.
  const hadSunday =
    state.requests.some((r) => r.day >= DAYS.length) ||
    Array.from(runtime.availableCells).some(
      (k) => parseInt(k.split("-")[0], 10) >= DAYS.length,
    );
  if (hadSunday) {
    state.requests = state.requests.filter((r) => r.day < DAYS.length);
    runtime.availableCells = new Set(
      Array.from(runtime.availableCells).filter(
        (k) => parseInt(k.split("-")[0], 10) < DAYS.length,
      ),
    );
    // 일요일 배정이 포함됐을 수 있는 기존 후보A/B/C는 모두 다시 계산하도록 비운다.
    clearRuntimeScheduleCandidates();
  }
}
