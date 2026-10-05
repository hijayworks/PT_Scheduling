import { STORAGE_KEY } from "./constants.js";
import { showToast } from "./utils.js";
import {
  CURRENT_SCHEMA_VERSION,
  runtime,
  saveState,
} from "./state.js";

/* ---------------- 데이터 백업 · 복원 ---------------- */
// localStorage는 브라우저·기기별로 분리돼 있어 자동으로 공유되지 않는다. 다른 기기(예: 외부에서
// 쓰는 모바일)에서도 같은 데이터를 쓰고 싶을 때, 여기서 만든 백업 코드를 복사해 그 기기에서
// 붙여넣어 복원한다. 코드 자체는 PIN으로 암호화되어 있어(AES-GCM, PIN 기반 PBKDF2 키 유도),
// PIN을 모르면 코드 텍스트만으로는 내용을 볼 수 없다 — 메모 앱 등에 코드가 남아 있어도,
// 또는 공용 기기에서 붙여넣기 화면을 보게 되어도 실제 회원 정보가 그대로 노출되지 않는다.
export const LEGACY_BACKUP_PBKDF2_ITERATIONS = 100000;
export const BACKUP_PBKDF2_ITERATIONS = 600000;
export const BACKUP_VERSION = 2;
export const BACKUP_PREFIX = "PTB2.";

export async function deriveBackupKey(
  pin,
  salt,
  usage,
  iterations = BACKUP_PBKDF2_ITERATIONS,
) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export function backupBytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function backupBase64ToBytes(base64) {
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
      cipher: envelope.cipher,
    }),
  );
}

export function parseBackupEnvelope(code) {
  const trimmed = code.trim();
  if (!trimmed.startsWith(BACKUP_PREFIX)) return null;
  const envelope = JSON.parse(base64ToText(trimmed.slice(BACKUP_PREFIX.length)));
  if (
    !isPlainObject(envelope) ||
    envelope.backupVersion !== BACKUP_VERSION ||
    !isPlainObject(envelope.kdf) ||
    envelope.kdf.name !== "PBKDF2" ||
    envelope.kdf.hash !== "SHA-256" ||
    !Number.isInteger(envelope.kdf.iterations) ||
    envelope.kdf.iterations < 100000 ||
    typeof envelope.kdf.salt !== "string" ||
    !isPlainObject(envelope.cipher) ||
    envelope.cipher.name !== "AES-GCM" ||
    envelope.cipher.keyLength !== 256 ||
    typeof envelope.cipher.iv !== "string" ||
    typeof envelope.ciphertext !== "string"
  )
    throw new Error("invalid backup envelope");
  return envelope;
}

export async function encryptBackupText(plainText, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const envelope = {
    backupVersion: BACKUP_VERSION,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: BACKUP_PBKDF2_ITERATIONS,
      salt: backupBytesToBase64(salt),
    },
    cipher: {
      name: "AES-GCM",
      keyLength: 256,
      iv: backupBytesToBase64(iv),
    },
    ciphertext: "",
  };
  const key = await deriveBackupKey(
    pin,
    salt,
    "encrypt",
    envelope.kdf.iterations,
  );
  const cipherBuf = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: backupEnvelopeAdditionalData(envelope),
    },
    key,
    new TextEncoder().encode(plainText),
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
    LEGACY_BACKUP_PBKDF2_ITERATIONS,
  );
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBytes,
  );
  return new TextDecoder().decode(plainBuf);
}

export async function decryptBackupText(code, pin) {
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
    envelope.kdf.iterations,
  );
  const plainBuf = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: backupEnvelopeAdditionalData(envelope),
    },
    key,
    backupBase64ToBytes(envelope.ciphertext),
  );
  return new TextDecoder().decode(plainBuf);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertArrayField(data, key) {
  if (data[key] !== undefined && !Array.isArray(data[key]))
    throw new Error(key + " must be an array");
}

function assertOptionalStringArray(value, label) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string"))
    throw new Error(label + " must be a string array");
}

// 복원 데이터는 암호화에 성공했다는 이유만으로 신뢰하지 않는다. 구버전 백업과의 호환성을
// 위해 필드 자체는 optional로 두되, 존재하는 필드는 현재 코드가 안전하게 다룰 수 있는 타입과
// 참조 관계인지 확인한다. 명백히 손상된 백업은 localStorage에 쓰기 전에 여기서 거부한다.
export function validateBackupState(data) {
  if (!isPlainObject(data)) throw new Error("backup root must be an object");

  ["locations", "members", "requests", "availableCells", "candidates"].forEach(
    (key) => assertArrayField(data, key),
  );
  if (data.travelTimes !== undefined && !isPlainObject(data.travelTimes))
    throw new Error("travelTimes must be an object");
  if (
    data.schedule3Result !== undefined &&
    !isPlainObject(data.schedule3Result)
  )
    throw new Error("schedule3Result must be an object");

  assertOptionalStringArray(
    data.onceLimitedMemberIds3,
    "onceLimitedMemberIds3",
  );
  assertOptionalStringArray(data.excludedMemberIds3, "excludedMemberIds3");

  const locations = data.locations || [];
  const members = data.members || [];
  const requests = data.requests || [];
  const locationIds = new Set();
  locations.forEach((loc, i) => {
    if (
      !isPlainObject(loc) ||
      typeof loc.id !== "string" ||
      !loc.id ||
      typeof loc.name !== "string" ||
      !loc.name
    )
      throw new Error("invalid location at index " + i);
    if (locationIds.has(loc.id)) throw new Error("duplicate location id");
    locationIds.add(loc.id);
  });

  const memberIds = new Set();
  members.forEach((member, i) => {
    if (
      !isPlainObject(member) ||
      typeof member.id !== "string" ||
      !member.id ||
      typeof member.name !== "string"
    )
      throw new Error("invalid member at index " + i);
    if (memberIds.has(member.id)) throw new Error("duplicate member id");
    memberIds.add(member.id);

    if (member.locationIds !== undefined) {
      assertOptionalStringArray(member.locationIds, "member.locationIds");
      if (member.locationIds.some((id) => !locationIds.has(id)))
        throw new Error("member references unknown location");
    } else if (
      member.locationId !== undefined &&
      (typeof member.locationId !== "string" ||
        !locationIds.has(member.locationId))
    ) {
      throw new Error("member references unknown legacy location");
    }
    if (member.memo !== undefined && typeof member.memo !== "string")
      throw new Error("member.memo must be a string");
  });

  const requestIds = new Set();
  requests.forEach((req, i) => {
    if (
      !isPlainObject(req) ||
      typeof req.id !== "string" ||
      !req.id ||
      typeof req.memberId !== "string" ||
      !memberIds.has(req.memberId) ||
      !Number.isInteger(req.day) ||
      req.day < 0 ||
      req.day >= 7 ||
      !Number.isInteger(req.startSlot) ||
      req.startSlot < 0 ||
      typeof req.duration !== "number" ||
      !Number.isFinite(req.duration) ||
      req.duration <= 0
    )
      throw new Error("invalid request at index " + i);
    if (requestIds.has(req.id)) throw new Error("duplicate request id");
    requestIds.add(req.id);

    assertOptionalStringArray(
      req.extraLocationIds,
      "request.extraLocationIds",
    );
    assertOptionalStringArray(
      req.excludedLocationIds,
      "request.excludedLocationIds",
    );
    for (const id of (req.extraLocationIds || []).concat(
      req.excludedLocationIds || [],
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
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    )
      throw new Error("invalid travel time");
    const ids = key.split("|");
    if (
      ids.length !== 2 ||
      !locationIds.has(ids[0]) ||
      !locationIds.has(ids[1])
    )
      throw new Error("travel time references unknown location");
  });

  return data;
}

export function parseAndValidateBackupText(plainText) {
  return validateBackupState(JSON.parse(plainText));
}

export function createPortableBackupState(data) {
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
    startMinBase: validated.startMinBase,
  };
  if (portable.startMinBase === undefined) delete portable.startMinBase;
  return portable;
}

export function prepareBackupStateForRestore(data) {
  const validated = validateBackupState(data);
  const restored = {
    ...validated,
    schemaVersion:
      validated.schemaVersion === undefined
        ? 0
        : validated.schemaVersion,
    // 후보A/B/C와 페이지 위치는 원본 데이터에서 다시 만들 수 있는 파생/세션 상태다.
    // 오래된 후보가 새 코드에서 stale하게 살아나는 일을 막기 위해 복원 시 항상 버린다.
    candidates: [],
    schedule3Result: { candidateAList: [null, null, null] },
  };
  delete restored.currentPage;
  delete restored.currentStep;
  return restored;
}

export const backupExportBtnEl = document.getElementById("backupExportBtn");
export const backupExportResultEl =
  document.getElementById("backupExportResult");
export const backupExportTextareaEl = document.getElementById(
  "backupExportTextarea",
);
export const backupExportCopyBtnEl = document.getElementById(
  "backupExportCopyBtn",
);

backupExportBtnEl.addEventListener("click", async () => {
  const pin = window.prompt(
    "백업 코드를 암호화할 PIN을 입력하세요. (복원할 때 동일한 PIN이 필요합니다)",
  );
  if (!pin) return;
  const pinConfirm = window.prompt("PIN을 한 번 더 입력해주세요.");
  if (pinConfirm !== pin) {
    alert(
      "입력한 PIN이 서로 달라 백업 코드를 만들지 못했습니다. 다시 시도해주세요.",
    );
    return;
  }
  saveState(); // 화면에 아직 반영 중인 최신 상태까지 포함되도록 내보내기 직전에 저장
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const portable = createPortableBackupState(saved);
    const backupCode = await encryptBackupText(
      JSON.stringify(portable),
      pin,
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
  } catch {
    backupExportTextareaEl.select();
    showToast("복사에 실패했습니다. 직접 선택해 복사해주세요.", "error");
  }
});

export const backupImportOverlayEl = document.getElementById(
  "backupImportOverlay",
);
export const backupImportOpenBtnEl = document.getElementById(
  "backupImportOpenBtn",
);
export const backupImportCloseBtnEl = document.getElementById(
  "backupImportCloseBtn",
);
export const backupImportCancelBtnEl = document.getElementById(
  "backupImportCancelBtn",
);
export const backupImportApplyBtnEl = document.getElementById(
  "backupImportApplyBtn",
);
export const backupImportTextareaEl = document.getElementById(
  "backupImportTextarea",
);
export const backupImportPinInputEl = document.getElementById(
  "backupImportPinInput",
);
export const backupImportHintEl = document.getElementById("backupImportHint");

export function openBackupImportModal() {
  backupImportTextareaEl.value = "";
  backupImportPinInputEl.value = "";
  backupImportHintEl.textContent = "";
  backupImportOverlayEl.classList.add("open");
  setTimeout(() => backupImportTextareaEl.focus(), 0);
}
export function closeBackupImportModal() {
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
  let parsedBackup;
  try {
    const plainText = await decryptBackupText(code, pin);
    parsedBackup = prepareBackupStateForRestore(
      parseAndValidateBackupText(plainText),
    );
  } catch (e) {
    console.warn("backup import validation failed", e);
    backupImportHintEl.textContent =
      "복원에 실패했습니다. 백업 코드가 손상되었거나 현재 데이터 형식과 맞지 않습니다.";
    return;
  }
  if (
    !confirm("복원하면 이 기기에 현재 저장된 데이터를 덮어씁니다. 계속할까요?")
  )
    return;
  // 복호화·schema 검증·사용자 확인이 모두 끝난 뒤에야 현재 데이터를 덮어쓴다.
  // 이 시점 이전에는 localStorage를 전혀 건드리지 않으므로 잘못된 백업으로 현재 데이터가
  // 손상되지 않는다.
  runtime.suppressAutosave = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedBackup));
  } catch (e) {
    runtime.suppressAutosave = false;
    console.warn("backup import save failed", e);
    backupImportHintEl.textContent =
      "복원 데이터를 저장하지 못했습니다. 현재 데이터는 그대로 유지됩니다.";
    return;
  }
  location.reload();
});
