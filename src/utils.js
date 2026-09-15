import { START_MIN, SLOT_MIN, SLOT_COUNT } from "./constants.js";

/* ---------------- Utils ---------------- */
export function minutesLabel(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

export function slotLabel(slotIndex) {
  return minutesLabel(START_MIN + slotIndex * SLOT_MIN);
}

export function endLabel(startSlot, durationMin) {
  return minutesLabel(START_MIN + startSlot * SLOT_MIN + durationMin);
}

export function cellKey(day, slot) {
  return day + "-" + slot;
}

export function durationToSlots(min) {
  return min / SLOT_MIN;
}

export function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// 시간 선택창에는 30분 단위 옵션만 보여준다 (실제 배정은 여전히 10분 단위로 계산됨).
// settings.js와 memberSchedule.js가 서로를 import하는 순환 참조 상태에서 memberSchedule.js가
// 모듈 최상위(top-level)에서 이 함수를 즉시 호출하기 때문에, settings.js 쪽에 두면 초기화
// 순서에 따라 정의되기 전에 호출될 수 있어(빌드 시 var 호이스팅으로 조용히 깨짐) 두 모듈보다
// 하위 계층인 이곳에 둔다.
export const TIME_SELECT_STEP_SLOTS = 30 / SLOT_MIN;

export function fillTimeSelect(sel, kind) {
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

/* ---------------- Toast notifications ---------------- */
let toastContainerEl = null;
export function showToast(message, type) {
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
      once: true,
    });
  }, 2200);
}
