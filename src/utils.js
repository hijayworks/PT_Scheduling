import { START_MIN, SLOT_MIN } from "./constants.js";

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
