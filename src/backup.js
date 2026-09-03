import { STORAGE_KEY } from "./constants.js";
import { showToast } from "./utils.js";
import { runtime, saveState } from "./state.js";

/* ---------------- 데이터 백업 · 복원 ---------------- */
// localStorage는 브라우저·기기별로 분리돼 있어 자동으로 공유되지 않는다. 다른 기기(예: 외부에서
// 쓰는 모바일)에서도 같은 데이터를 쓰고 싶을 때, 여기서 만든 백업 코드를 복사해 그 기기에서
// 붙여넣어 복원한다. 코드 자체는 PIN으로 암호화되어 있어(AES-GCM, PIN 기반 PBKDF2 키 유도),
// PIN을 모르면 코드 텍스트만으로는 내용을 볼 수 없다 — 메모 앱 등에 코드가 남아 있어도,
// 또는 공용 기기에서 붙여넣기 화면을 보게 되어도 실제 회원 정보가 그대로 노출되지 않는다.
export const BACKUP_PBKDF2_ITERATIONS = 100000;

export async function deriveBackupKey(pin, salt, usage) {
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
      iterations: BACKUP_PBKDF2_ITERATIONS,
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

export async function encryptBackupText(plainText, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(pin, salt, "encrypt");
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText),
  );
  const combined = new Uint8Array(
    salt.length + iv.length + cipherBuf.byteLength,
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipherBuf), salt.length + iv.length);
  return backupBytesToBase64(combined);
}

// salt(16B) + iv(12B)가 앞에 오지 않는 텍스트(형식이 다르거나 손상된 코드)는 여기서 걸러진다.
export async function decryptBackupText(base64Text, pin) {
  const combined = backupBase64ToBytes(base64Text.trim());
  if (combined.length <= 28) throw new Error("invalid backup code");
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const cipherBytes = combined.slice(28);
  const key = await deriveBackupKey(pin, salt, "decrypt");
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBytes,
  );
  return new TextDecoder().decode(plainBuf);
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
    const backupCode = await encryptBackupText(
      localStorage.getItem(STORAGE_KEY) || "{}",
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
  } catch (e) {
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
  let plainText;
  try {
    plainText = await decryptBackupText(code, pin);
    JSON.parse(plainText); // 형식 검증(손상되거나 PIN이 맞아도 다른 형식의 데이터면 여기서 걸러짐)
  } catch (e) {
    backupImportHintEl.textContent =
      "복원에 실패했습니다. 백업 코드와 PIN을 다시 확인해주세요.";
    return;
  }
  if (
    !confirm("복원하면 이 기기에 현재 저장된 데이터를 덮어씁니다. 계속할까요?")
  )
    return;
  runtime.suppressAutosave = true;
  localStorage.setItem(STORAGE_KEY, plainText);
  location.reload();
});
