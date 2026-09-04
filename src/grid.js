import { DAYS, SLOT_COUNT, SLOT_MIN, START_MIN } from "./constants.js";
import { cellKey, durationToSlots, slotLabel } from "./utils.js";

export let draggingMoveHandler = null;
export let draggingDurationSlots = 1;
export let draggingValidator = null;
export let draggingSourceContainer = null;

// 모바일 등 터치 환경에는 네이티브 HTML5 드래그(draggable/dragstart)가 아예 붙지 않으므로,
// Pointer Events로 같은 흐름(누르고 있으면 시작 → 이동 중 미리보기 → 놓으면 커밋)을 별도
// 구현해 보완한다. 마우스는 이미 네이티브 드래그가 잘 동작하니 그대로 두고(pointerType이
// "mouse"면 바로 리턴), 터치/펜일 때만 개입한다. 스크롤과 드래그가 똑같이 "손가락으로 누르고
// 움직이기"라 즉시 드래그를 시작하면 목록을 내리려던 손가락까지 매번 드래그로 뺏어가므로,
// 일정 시간(LONG_PRESS_MS) 움직임 없이 눌려 있어야만 드래그가 시작되게 해 스크롤과 구분한다.
export const LONG_PRESS_MS = 450;
export const LONG_PRESS_MOVE_TOLERANCE = 10; // px - 대기 중 이만큼 움직이면 스크롤 의도로 보고 드래그 시작을 취소

// el: 드래그 가능한 블록(cal-block/cal-travel-block) 엘리먼트. container: 그 블록이 속한
// cal-grid(renderGrid가 그린 컨테이너) - renderGrid가 컨테이너에 심어둔 _dndHelpers(cellAtPoint·
// showDropPreview·clearDropPreview·clearDropTargets·paintDropTargets)를 그대로 재사용해
// dragover/drop 네이티브 이벤트 리스너와 동일한 판정 로직을 탄다. meta: { onMove, durationSlots,
// validator } - 네이티브 dragstart가 draggingMoveHandler 등에 채워 넣던 값과 동일하다.
export function attachTouchDrag(el, container, meta) {
  let timer = null;
  let pointerId = null;
  let startX = 0,
    startY = 0;
  let active = false;

  function findDropCell(x, y) {
    const helpers = container._dndHelpers;
    if (!helpers) return null;
    const cell = helpers.cellAtPoint(x, y);
    // elementsFromPoint는 화면 전체에서 찾으므로, 후보A/B/C처럼 여러 그리드가 동시에 떠 있을 때
    // 다른 컨테이너의 칸이 잡히지 않도록 이 드래그를 시작한 컨테이너 소속인지 반드시 확인한다.
    return cell && container.contains(cell) ? cell : null;
  }

  function cleanup() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pointerId = null;
    // active(이 인스턴스가 실제로 beginDrag까지 진행한 경우)일 때만 전역 드래그 상태를 지운다.
    // 그러지 않으면(멀티터치로 다른 블록을 동시에 누르다 이쪽이 취소되는 경우) 실제로 진행 중인
    // 다른 드래그의 draggingMoveHandler 등을 여기서 지워버려 그 드롭이 조용히 무시될 수 있다.
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
      const dx = e.clientX - startX,
        dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE) cleanup();
      return;
    }
    e.preventDefault();
    const cell = findDropCell(e.clientX, e.clientY);
    const helpers = container._dndHelpers;
    if (cell) {
      const day = parseInt(cell.dataset.day, 10);
      const slot = parseInt(cell.dataset.slot, 10);
      const kind = draggingValidator
        ? draggingValidator(day, slot).kind
        : "move";
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
    if (e.pointerType === "mouse") return; // 마우스는 네이티브 드래그(draggable)로 처리
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

/* ---------------- Grid rendering ---------------- */
// options: { blocks: [{day, startSlot, duration, label, loc, sublabel, color, excluded, onDelete, onMove}],
//   travelBlocks: [{day, startSlot, duration, label, type: "travel" | "break"}] }
// onDelete(있는 블록만): 마우스 호버 시 우측 상단에 삭제(×) 버튼이 나타난다 (PC 전용 기능).
// onMove(있는 블록만): 블록을 다른 (day, slot) 셀에 드래그해 놓으면 onMove(day, slot)를 호출한다.
export function renderGrid(container, availableSet, options) {
  options = options || {};
  const rangeStart =
    typeof options.rangeStartSlot === "number" ? options.rangeStartSlot : 0;
  const rangeEnd =
    typeof options.rangeEndSlot === "number"
      ? options.rangeEndSlot
      : SLOT_COUNT;
  container.innerHTML = "";
  container.style.gridTemplateRows =
    "30px repeat(" + (rangeEnd - rangeStart) + ", 16px)";

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
      label.className =
        "cal-timelabel" + (s === rangeStart ? " cal-timelabel-first" : "");
      label.textContent = slotLabel(s);
      label.style.gridColumn = "1";
      label.style.gridRow = String(row);
      container.appendChild(label);
    }
    for (let di = 0; di < DAYS.length; di++) {
      const cell = document.createElement("div");
      const key = cellKey(di, s);
      const isAvailable = availableSet.has(key);
      cell.className =
        "cal-cell" +
        (isHour ? " hour-start" : "") +
        (isAvailable ? " available" : "");
      cell.dataset.day = String(di);
      cell.dataset.slot = String(s);
      cell.style.gridColumn = String(di + 2);
      cell.style.gridRow = String(row);
      container.appendChild(cell);
    }
  }

  // travel/break-time indicators (이동·휴식 시간), rendered under the session blocks
  // 표시 범위(rangeStart~rangeEnd) 밖으로 걸치는 부분은 잘라내고, 완전히 범위 밖이면 그리지 않는다.
  (options.travelBlocks || []).forEach((t) => {
    const clippedStart = Math.max(t.startSlot, rangeStart);
    const clippedEnd = Math.min(
      t.startSlot + Math.round(t.duration / SLOT_MIN),
      rangeEnd,
    );
    if (clippedEnd <= clippedStart) return;
    const travel = document.createElement("div");
    travel.className =
      t.type === "idle"
        ? "cal-idle-block"
        : t.type === "break"
          ? "cal-break-block"
          : "cal-travel-block";
    travel.style.gridColumn = String(t.day + 2);
    travel.style.gridRow =
      clippedStart - rangeStart + 2 + " / span " + (clippedEnd - clippedStart);
    travel.title = t.label;
    travel.textContent = t.label;
    // 이동 시간 블록 자체는 옮길 수 있는 데이터가 아니라(두 수업 사이 간격에서 계산되는
    // 값일 뿐), 드래그·클릭 모두 "바로 다음 수업"(t.onMove/t.contextMenuItems가 감싸고
    // 있는 세션)을 이 이동 시간 앞뒤로 당기거나 미루는 동작으로 연결한다. 미리보기 크기는
    // 이동 시간 블록의 짧은 길이가 아니라 실제로 옮겨질 다음 수업의 길이(t.moveDurationSlots)를
    // 써야 얼마만큼의 자리가 필요한지 정확히 보여줄 수 있다.
    if (t.onMove) {
      travel.draggable = true;
      travel.classList.add("draggable");
      travel.addEventListener("dragstart", (e) => {
        draggingMoveHandler = t.onMove;
        draggingDurationSlots =
          t.moveDurationSlots || durationToSlots(t.duration);
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
        validator: t.canMoveTo || null,
      });
    }
    if (t.contextMenuItems) {
      travel.style.cursor = "pointer";
      travel.addEventListener("click", (e) => {
        e.stopPropagation();
        openContextMenu(
          e.clientX,
          e.clientY,
          t.contextMenuItems(e.clientX, e.clientY),
        );
      });
    }
    container.appendChild(travel);
  });

  // blocks (assigned sessions) on top
  (options.blocks || []).forEach((b) => {
    const clippedStart = Math.max(b.startSlot, rangeStart);
    const clippedEnd = Math.min(
      b.startSlot + durationToSlots(b.duration),
      rangeEnd,
    );
    if (clippedEnd <= clippedStart) return;
    const block = document.createElement("div");
    block.className =
      "cal-block" +
      (b.excluded ? " excluded" : "") +
      (b.confirmed ? " confirmed" : "");
    // 확정된 일정은 흰색을 넉넉히 섞은 배경으로 칠하고, 테두리는 원래 회원 색상 그대로 두껍게
    // 둘러서 미확정 블록과 한눈에 확 구분되게 한다.
    if (!b.excluded) {
      block.style.background = b.confirmed
        ? "linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.72)), " +
          b.color
        : b.color;
      if (b.confirmed) block.style.borderColor = b.color;
    }
    block.style.gridColumn = String(b.day + 2);
    block.style.gridRow =
      clippedStart - rangeStart + 2 + " / span " + (clippedEnd - clippedStart);
    block.title =
      b.label +
      (b.loc ? " (" + b.loc + ")" : "") +
      (b.sublabel ? " · " + b.sublabel : "");
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
        validator: b.canMoveTo || null,
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
          b.contextMenuItems(e.clientX, e.clientY),
        );
      });
    }
    container.appendChild(block);
  });

  // 세션/이동/빈 시간 블록은 배경 cal-cell 위에 같은 컨테이너의 형제 엘리먼트로 그려지므로,
  // 드래그 중인 포인터가 그 블록 위에 있으면 dragover/drop 이벤트가 (사이에 아무 조상 관계도
  // 없는) cal-cell까지 전달되지 않고 그 블록에서 그냥 끝나버린다(블록엔 dragover/drop 핸들러가
  // 없으므로 브라우저 기본 동작상 드롭이 거부됨) — 그래서 개별 셀에 리스너를 붙이는 대신
  // 컨테이너 하나에만 붙이고, 실제 드롭 위치는 포인터 좌표 아래 쌓인 엘리먼트들 중에서
  // cal-cell을 찾아(document.elementsFromPoint) 판단한다. 이러면 어떤 블록이 위에 덮여
  // 있어도 그 밑의 실제 요일·슬롯을 항상 정확히 찾아낼 수 있다.
  function cellAtPoint(x, y) {
    return (
      document
        .elementsFromPoint(x, y)
        .find((el) => el.classList && el.classList.contains("cal-cell")) || null
    );
  }
  // 드래그 중인 자리를 셀 하나(10분)가 아니라 옮기는 세션 길이만큼(draggingDurationSlots)
  // 통짜로 미리 보여준다 — 실제 배정 블록과 똑같이 gridRow를 여러 칸 span해서 그린, 클릭은
  // 통과시키는(pointer-events: none) 미리보기 엘리먼트 하나를 그때그때 위치만 옮겨가며 재사용한다.
  let dropPreviewEl = null;
  function clearDropPreview() {
    if (dropPreviewEl) {
      dropPreviewEl.remove();
      dropPreviewEl = null;
    }
  }
  // 드래그를 시작하는 순간, 포인터가 아직 지나가보지 않은 칸까지 포함해 이 세션이 놓일 수
  // 없는 칸 전부를 한 번에 옅게 표시한다 — 한 칸씩 지나가 봐야만 가능 여부를 알 수 있으면
  // "어디에 놓을 수 있는지" 전체 그림을 파악하기 어렵다. draggingValidator(dragstart에서 붙잡아둔
  // canMoveTo)를 셀마다 한 번씩만(드래그 시작 시 1회) 돌리면 되므로 비용은 크지 않다.
  // "시작 가능한 칸" 하나(10분)만 표시하면, 실제로는 1시간 자리인데도 10분만 되는 것처럼
  // 보여 헷갈린다 — 마우스를 올렸을 때 보이는 실제 미리보기(showDropPreview)와 같은 기준으로,
  // 시작 가능한 칸부터 옮길 세션 길이(draggingDurationSlots)만큼 이어지는 범위 전체를
  // "놓을 수 있음"으로 넓혀서 표시한다.
  function paintDropTargets() {
    if (!draggingValidator) return;
    const reachableByDay = [];
    for (let day = 0; day < DAYS.length; day++) {
      const reachable = new Set();
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
    container
      .querySelectorAll(".cal-cell-blocked")
      .forEach((cell) => cell.classList.remove("cal-cell-blocked"));
  }
  // kind: "move"(빈 자리로 이동) / "swap"(다른 배정과 맞바꾸기) / "invalid"(놓을 수 없음) —
  // 색으로 세 가지를 구분해서, 놓기 전에 "그냥 옮기는 건지 남의 자리와 맞바뀌는 건지"까지
  // 미리 알 수 있게 한다(맞바꾸기인 줄 모르고 놨다가 놀라는 일이 없도록).
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
    dropPreviewEl.style.gridRow =
      clippedStart - rangeStart + 2 + " / span " + (clippedEnd - clippedStart);
    dropPreviewEl.classList.toggle("invalid", kind === "invalid");
    dropPreviewEl.classList.toggle("swap", kind === "swap");
  }
  // 그리드 컨테이너 자체(scheduleGridEl 등)는 요청 편집마다 renderGrid가 재호출돼도 같은
  // DOM 노드가 재사용된다(innerHTML만 비움) — 컨테이너 리스너를 매 렌더마다 새로 붙이면
  // 이전 렌더의 리스너가 계속 쌓여 메모리가 새므로, dataset 플래그로 한 번만 붙인다. 대신
  // cellAtPoint/showDropPreview 등은 이번 렌더의 최신 클로저를 container._dndHelpers에
  // 매 렌더마다 갱신해두고, 리스너는 항상 그 최신 값을 통해서만 호출한다.
  container._dndHelpers = {
    cellAtPoint,
    clearDropPreview,
    clearDropTargets,
    showDropPreview,
    paintDropTargets,
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
        // 검사 함수(canMoveTo)가 없는 블록(구버전 호출부 대비 방어)은 항상 놓을 수 있는 것으로
        // 보여준다 — 실시간 미리보기가 없다고 실제 드롭까지 막지는 않기 때문이다.
        const kind = draggingValidator
          ? draggingValidator(day, slot).kind
          : "move";
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
          parseInt(cell.dataset.slot, 10),
        );
    });
  }
}

/* ---------------- Generic block click menu (그리드 블록 클릭 메뉴) ---------------- */
export let activeContextMenuEl = null;

export function closeContextMenu() {
  if (activeContextMenuEl) {
    activeContextMenuEl.remove();
    activeContextMenuEl = null;
  }
}

// items: [{ label, onClick, disabled, danger }] 또는 { separator: true }
export function openContextMenu(x, y, items) {
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
