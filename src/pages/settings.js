import {
  DAYS,
  SLOT_MIN,
  SLOT_COUNT,
  START_MIN,
  DEFAULT_TRAVEL_MIN,
  DEFAULT_BUSINESS_START_SLOT,
  DEFAULT_BUSINESS_END_SLOT,
} from "../constants.js";
import { cellKey, minutesLabel, uid, showToast } from "../utils.js";
import { state, runtime, saveState } from "../state.js";
import { pairKey } from "../domain.js";
import {
  candidateHistory,
  candidateUndoStack,
  candidatePools,
  candidateAPools,
} from "../engine/greedy.js";
import { renderSchedule3Result, generateHint3El } from "../schedule3.js";
import {
  populateMemberLocationSelect,
  renderMemberTable,
  renderRequestList,
} from "./memberSchedule.js";

/* ---------------- Settings page: locations & travel time ---------------- */
export const locationForm = document.getElementById("locationForm");
export const locationNameInput = document.getElementById("locationName");
export const locationHintEl = document.getElementById("locationHint");
export const locationListEl = document.getElementById("locationList");
export const travelTitleEl = document.getElementById("travelTitle");
export const travelMatrixEl = document.getElementById("travelMatrix");

export function membersUsingLocation(locId) {
  return state.members.filter((m) => (m.locationIds || []).includes(locId));
}

export let editingLocationId = null;

// 기본 설정(근무 가능 시간·지점·이동 시간)이 바뀌면 이미 생성된 수업 스케줄 후보는 더 이상
// 유효하지 않을 수 있으므로 자동으로 비운다.
export function invalidateCandidates() {
  const hasResult =
    runtime.candidates.length > 0 ||
    runtime.schedule3Result.candidateAList.some(Boolean);
  if (!hasResult) return;
  runtime.candidates = [];
  runtime.schedule3Result = { candidateAList: [null, null, null] };
  Object.keys(candidateHistory).forEach((k) => delete candidateHistory[k]);
  Object.keys(candidateUndoStack).forEach((k) => delete candidateUndoStack[k]);
  Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
  Object.keys(candidateAPools).forEach((k) => delete candidateAPools[k]);
  renderSchedule3Result();
  generateHint3El.textContent =
    "기본 설정이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
  saveState();
  showToast(
    "기본 설정이 변경되어 생성된 수업 스케줄 후보가 초기화되었습니다",
    "info",
  );
}

export function deleteLocation(loc) {
  const affectedMembers = membersUsingLocation(loc.id);
  const remainingLocations = state.locations.filter((l) => l.id !== loc.id);
  if (affectedMembers.length > 0 && remainingLocations.length === 0) {
    alert(
      "'" +
        loc.name +
        "' 지점을 사용하는 회원 " +
        affectedMembers.length +
        "명이 있고, 다른 지점이 없어 삭제할 수 없습니다. 다른 지점을 먼저 등록해주세요.",
    );
    return;
  }
  const fallbackLoc = remainingLocations[0];
  const msg =
    affectedMembers.length > 0
      ? "'" +
        loc.name +
        "' 지점을 사용하는 회원 " +
        affectedMembers.length +
        "명이 있습니다. 삭제하면 해당 회원의 지점 목록에서 제외됩니다(지점이 그것뿐이었던 회원은 '" +
        fallbackLoc.name +
        "' 지점으로 자동 변경). 계속할까요?"
      : "'" + loc.name + "' 지점을 삭제할까요?";
  if (!confirm(msg)) return;
  state.locations = state.locations.filter((l) => l.id !== loc.id);
  affectedMembers.forEach((m) => {
    m.locationIds = m.locationIds.filter((id) => id !== loc.id);
    if (m.locationIds.length === 0) m.locationIds = [fallbackLoc.id];
  });
  Object.keys(state.travelTimes).forEach((k) => {
    if (k.indexOf(loc.id) !== -1) delete state.travelTimes[k];
  });
  // "지점 추가하기"로 개별 신청에 얹어둔 추가 지점도 함께 정리한다.
  state.requests.forEach((r) => {
    if (
      Array.isArray(r.extraLocationIds) &&
      r.extraLocationIds.includes(loc.id)
    ) {
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

export function renderLocationList() {
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
      const editChip = document.createElement("span");
      editChip.className = "chip location-chip location-chip-editing";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "location-name-input";
      input.value = loc.name;

      function commit() {
        const trimmed = input.value.trim();
        const changed = trimmed && trimmed !== loc.name;
        if (
          changed &&
          state.locations.some((l) => l.id !== loc.id && l.name === trimmed)
        ) {
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

export function renderTravelMatrix() {
  travelMatrixEl.innerHTML = "";
  const locs = state.locations;
  if (locs.length < 2) {
    travelTitleEl.style.display = "none";
    return;
  }
  travelTitleEl.style.display = "";
  for (let i = 0; i < locs.length; i++) {
    for (let j = i + 1; j < locs.length; j++) {
      const a = locs[i],
        b = locs[j];
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
      input.value =
        typeof state.travelTimes[key] === "number"
          ? state.travelTimes[key]
          : "";
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

export function setLocationHint(message) {
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
  // seed travel time with existing locations so nothing is silently 0.
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

/* ---------------- Settings page: availability time picker ---------------- */
export const availabilityListEl = document.getElementById("availabilityList");

export function dayRange(di) {
  let start = null,
    end = null;
  for (let s = 0; s < SLOT_COUNT; s++) {
    if (runtime.availableCells.has(cellKey(di, s))) {
      if (start === null) start = s;
      end = s + 1;
    }
  }
  return start === null ? null : { start, end };
}

export function setDayRange(di, start, end) {
  for (let s = 0; s < SLOT_COUNT; s++)
    runtime.availableCells.delete(cellKey(di, s));
  for (let s = start; s < end; s++) runtime.availableCells.add(cellKey(di, s));
}

export function clearDay(di) {
  for (let s = 0; s < SLOT_COUNT; s++)
    runtime.availableCells.delete(cellKey(di, s));
}

// 회원 스케줄 추가 · 수업 스케줄 생성 결과 그리드는 항상 12:00~24:00 전체를 보여주지 않고,
// 근무 가능 시간(기본 설정)을 모두 포함하는 가장 좁은 "정시" 범위만 보여준다.
// 예: 14:00~23:30 설정 → 14:00~24:00 표시 / 13:30~23:00 설정 → 13:00~23:00 표시.
// 회원이 근무 가능 시간 밖의 시간대를 희망 시간으로 등록했더라도 그리드 범위를 넓히지 않는다 —
// 근무 가능 시간 밖은 어차피 배정될 수 없으므로 굳이 보여줄 필요가 없다. 그 부분은
// renderGrid에서 범위 밖을 잘라내(clip) 그린다.
export function businessHoursGridRange() {
  let minStart = null,
    maxEnd = null;
  DAYS.forEach((d, di) => {
    const range = dayRange(di);
    if (!range) return;
    if (minStart === null || range.start < minStart) minStart = range.start;
    if (maxEnd === null || range.end > maxEnd) maxEnd = range.end;
  });
  if (minStart === null) return { rangeStartSlot: 0, rangeEndSlot: SLOT_COUNT };
  const roundedStartMin =
    Math.floor((START_MIN + minStart * SLOT_MIN) / 60) * 60;
  const roundedEndMin = Math.ceil((START_MIN + maxEnd * SLOT_MIN) / 60) * 60;
  return {
    rangeStartSlot: (roundedStartMin - START_MIN) / SLOT_MIN,
    rangeEndSlot: (roundedEndMin - START_MIN) / SLOT_MIN,
  };
}

// 시간 선택창에는 30분 단위 옵션만 보여준다 (실제 배정은 여전히 10분 단위로 계산됨).
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

// 근무 가능 시간(기본 설정) 전용 시간 선택창: 시작은 13:00~22:00, 종료는 14:00~24:00을
// 30분 단위로 보여주되, 23:00~24:00 구간만 10분 단위로 더 촘촘하게 보여준다.
export function fillAvailabilityTimeSelect(sel, kind) {
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

export function renderAvailabilityList() {
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
