import {
  BLOCK_COLOR,
  SLOT_MIN,
  MAX_SESSIONS_PER_MEMBER,
  BREAK_MIN,
} from "./constants.js";
import { durationToSlots, endLabel, slotLabel, showToast } from "./utils.js";
import {
  state,
  runtime,
  saveState,
  GenerationCancelledError,
  acquireWakeLock,
  releaseWakeLock,
} from "./state.js";
import {
  memberById,
  locationById,
  memberColor,
  travelMinutes,
  soloTravelMemberIds,
  isOnceLimitEligible,
  appendOnceLimitMemberLabel,
  compareOnceLimitMembers,
} from "./domain.js";
import { withSelectionOverride } from "./selectionOverride.js";
import { renderGrid } from "./grid.js";
import { saveCandidateCardAsImage } from "./imageExport.js";
import {
  generateCandidatesAsync,
  regenerateCandidate,
  candidateHistory,
  candidateUndoStack,
  candidatePools,
  candidateAPools,
  resetCandidateSession,
  MAX_POOL_VARIANTS,
  candidateSignature,
  candidateLocationsForRequest,
  requiredGapMin,
  restorePreviousCandidate,
  hasRegenerableEligible,
  totalTravelCount,
} from "./engine/greedy.js";
import {
  generateSchedule2Async,
  isSchedule2ResultBetter,
  schedule2Signature,
  SCHEDULE2_CARD_COUNT,
  schedule2ToIdleBlocks,
  schedule2TotalIdleMinutes,
} from "./engine/chainDp.js";
import {
  renderRequestList,
  setActiveScheduleMemberId,
} from "./pages/memberSchedule.js";
import { businessHoursGridRange } from "./pages/settings.js";

// 후보 카드의 일정 하나를 확정한다: 재생성해도 이 일정은 고정되고 나머지만 다시 배정된다.
// container: 후보B/C(candidate) 또는 후보A(result) 객체 — 항상 .assigned와 .confirmedIds를 가진다.
// onDone: 확정/확정취소/교체 뒤 다시 그릴 함수. 생성3의 카드에서 항상 renderSchedule3Result를
// 명시적으로 넘겨받아 쓴다.
export function confirmSession(container, reqId, onDone) {
  if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
  if (container.confirmedIds.includes(reqId)) return;
  pushManualUndo(container);
  container.confirmedIds.push(reqId);
  saveState();
  onDone();
  showToast("스케줄이 확정되었습니다", "success");
}

// 확정된 일정의 확정을 취소한다.
export function unconfirmSession(container, reqId, onDone) {
  if (!(container.confirmedIds || []).includes(reqId)) return;
  pushManualUndo(container);
  container.confirmedIds = container.confirmedIds.filter((id) => id !== reqId);
  saveState();
  onDone();
  showToast("스케줄 확정이 취소되었습니다", "info");
}

// "1회 제한 회원" 목록은 생성3 자신의 것(onceLimitedMemberIds3)을 써야 한다 — maxSessionsFor는
// withSelectionOverride로 감싼 생성 중에만 이 목록을 보므로, 생성이 끝난 뒤 그리드를 클릭해
// 교체 후보를 고를 때는 직접 참조해야 한다.
export function maxSessionsFor3(member) {
  if (!member) return 1;
  if (state.onceLimitedMemberIds3.includes(member.id)) return 1;
  return (member.category || "상담") === "상담" ? 1 : MAX_SESSIONS_PER_MEMBER;
}

// 배정된 세션 하나(req)를 다른 회원으로 교체할 수 있는지 훑는다. 요일·시작 시각·길이가
// 정확히 같은 신청을 가진 회원만 후보로 본다 — 신청은 가능한 시작 시각마다 하나씩 등록돼
// 있으므로(addDesiredRange), 이 자리에 "신청 가능했던" 회원은 정확히 이 조건으로 걸러진다.
// 요일·시간·지점은 그대로 유지한 채 사람만 바뀌는 것이므로, 이동 시간·간격 재계산은
// 필요 없다(그 날의 다른 배정과의 물리적 배치는 달라지지 않는다) — 그날 다른 배정이 없는지,
// 주간 최대 횟수를 넘지 않는지, 미배정 회원으로 지정돼 있지 않은지, 그 지점을 이용할 수
// 있는지만 확인하면 된다. 다만 greedyAssign의 "이동-회원-이동 금지" 숨김 하드 로직(위
// soloTravelMemberIds 참고)은 자리가 아니라 사람에 달린 규칙이라 예외 — req가 양옆 모두
// 이동으로 이어지는 자리라면, 세 지점을 모두 다니는 회원은 후보에서 뺀다.
export function eligibleSwapMembersFor(container, req) {
  const dayAssigned = container.assigned
    .filter((a) => a.day === req.day && a.id !== req.id)
    .sort((a, b) => a.startSlot - b.startSlot);
  const prevAssigned =
    dayAssigned.filter((a) => a.startSlot < req.startSlot).pop() || null;
  const nextAssigned =
    dayAssigned.find((a) => a.startSlot > req.startSlot) || null;
  const arrivedViaTravel =
    !!prevAssigned &&
    travelMinutes(prevAssigned.locationId, req.locationId) > 0;
  const departsViaTravel =
    !!nextAssigned &&
    travelMinutes(req.locationId, nextAssigned.locationId) > 0;
  const soloTravelBlocked = arrivedViaTravel && departsViaTravel;
  const soloIds = soloTravelBlocked ? soloTravelMemberIds() : null;

  const results = [];
  const seenMemberIds = new Set();
  state.requests.forEach((other) => {
    if (other.memberId === req.memberId) return;
    if (
      other.day !== req.day ||
      other.startSlot !== req.startSlot ||
      other.duration !== req.duration
    )
      return;
    if (seenMemberIds.has(other.memberId)) return;
    const member = memberById(other.memberId);
    if (!member) return;
    if (state.excludedMemberIds3.includes(member.id)) return;
    if (!candidateLocationsForRequest(other).includes(req.locationId)) return;
    if (soloTravelBlocked && soloIds.has(member.id)) return; // 이동-회원-이동 금지
    let weekCount = 0;
    let sameDayCount = 0;
    container.assigned.forEach((a) => {
      if (a.memberId !== member.id || a.id === req.id) return;
      weekCount++;
      if (a.day === req.day) sameDayCount++;
    });
    if (sameDayCount > 0) return; // 1일 최대 1회
    if (weekCount >= maxSessionsFor3(member)) return; // 주간 최대 횟수(상담 회원·1회 제한 회원 포함)
    seenMemberIds.add(member.id);
    results.push(member);
  });
  results.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return results;
}

// 드래그 이동·자리 맞바꾸기·인원 교체·확정 등 "수동 편집" 하나를 취소할 수 있도록, 편집
// 직전의 assigned/confirmedIds 스냅샷을 후보 객체(container)별로 최대 20개까지 쌓아둔다.
// 재생성(regenerateCandidate)이 쓰는 candidateUndoStack과는 별개다 — 그건 "다른 배정 조합
// 통째로 되돌리기"이고 이건 "방금 한 조정 하나만 되돌리기"라 성격이 다르다. WeakMap을 써서
// container 객체(candidateA 또는 runtime.candidates[i]) 자체를 키로 삼으므로, 재생성으로 그 자리의
// container 객체가 통째로 새로 만들어지면 자연스럽게 새 빈 되돌리기 이력에서 다시 시작한다.
// candidateUndoStack과 마찬가지로 저장하지 않으므로 새로고침하면 초기화된다.
export const manualUndoStacks = new WeakMap();
export const MANUAL_UNDO_LIMIT = 20;
export function snapshotContainer(container) {
  return {
    assigned: container.assigned.map((a) => ({ ...a })),
    confirmedIds: (container.confirmedIds || []).slice(),
  };
}
export function pushManualUndo(container) {
  if (!manualUndoStacks.has(container)) manualUndoStacks.set(container, []);
  const stack = manualUndoStacks.get(container);
  stack.push(snapshotContainer(container));
  if (stack.length > MANUAL_UNDO_LIMIT) stack.shift();
}
export function hasManualUndo(container) {
  const stack = manualUndoStacks.get(container);
  return !!stack && stack.length > 0;
}
export function undoManualEdit(container, onDone) {
  const stack = manualUndoStacks.get(container);
  if (!stack || stack.length === 0) return;
  const snapshot = stack.pop();
  container.assigned = snapshot.assigned;
  container.confirmedIds = snapshot.confirmedIds;
  saveState();
  onDone();
  showToast("방금 편집을 되돌렸습니다", "info");
}

// 배정된 세션의 자리(요일·시작 시각·길이·지점)는 그대로 두고 사람만 newMember로 바꿔치기한다.
// moveSession/attemptSwap과 마찬가지로, 재생성해도 이 자리가 풀리지 않도록 새 회원의 신청
// id를 confirmedIds에 자동으로 넣는다(사람이 손댄 자리는 알고리즘이 건드리지 않는다는
// 원칙 — 세 "수동 편집" 함수 모두 같은 보호 수준을 준다).
export function swapSessionMember(container, req, newMember, onDone) {
  const newReq = state.requests.find(
    (r) =>
      r.memberId === newMember.id &&
      r.day === req.day &&
      r.startSlot === req.startSlot &&
      r.duration === req.duration,
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
    locationId: req.locationId,
  };
  if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
  container.confirmedIds = container.confirmedIds.filter((id) => id !== req.id);
  container.confirmedIds.push(newReq.id);
  saveState();
  onDone();
  showToast(newMember.name + "(으)로 교체되었습니다", "success");
}

// req가 targetDay/targetStartSlot(그 자신의 길이만큼)으로 옮겨갈 때, 실제로 자리를 차지하고
// 있어서 걸리는 다른 배정을 찾는다(자기 자신은 제외). 있으면 "그 자리로 드래그" = "그 배정과
// 자리를 맞바꾸고 싶다"는 뜻으로 다룬다.
export function findOccupyingAssigned(
  container,
  req,
  targetDay,
  targetStartSlot,
) {
  const durSlots = durationToSlots(req.duration);
  return (
    container.assigned.find(
      (a) =>
        a.id !== req.id &&
        a.day === targetDay &&
        targetStartSlot < a.startSlot + durationToSlots(a.duration) &&
        targetStartSlot + durSlots > a.startSlot,
    ) || null
  );
}

// 세션 하나를 (targetDay, targetStartSlot)으로 옮길 수 있는지 검사만 하고, 실제로 옮기지는
// 않는다 — 드래그 중 실시간 유효성 표시(canMoveOrSwapTo)와 실제 커밋(moveSession) 양쪽에서
// 똑같은 기준으로 재사용하기 위해 분리했다. ignoreIds에 담긴 배정은 "이미 자리를 비운 것"
// 취급하여 겹침·인원 검사에서 제외한다 — 자리 맞바꾸기(prepareSwap)에서, 상대방이 내가 있던
// 자리로 옮겨가는 중이라 그 상대방의 현재 자리는 곧 빌 것이므로 걸림돌로 치지 않기 위함이다.
// 검증 순서: (1) 그 자리에 신청 이력이 있는지 → (2) 그 요일에 이미 이 회원의 다른 배정이
// 없는지(1일 최대 1회) → (3) 그 자리에서 지점을 그대로 쓸 수 있는지 → (4) 앞뒤 배정과 실제로
// 겹치지 않고 지점이 다르면 이동 시간까지 확보되는지(requiredGapMin — 단순 시간 겹침만 보면
// 이동 시간 없이 딱 붙는 물리적으로 불가능한 배치를 허용해버린다) → (5) 이동-회원-이동 금지
// 숨김 규칙.
export function validateMove(
  container,
  req,
  targetDay,
  targetStartSlot,
  ignoreIds,
) {
  const ignoreSet = new Set([req.id, ...(ignoreIds || [])]);
  if (targetDay === req.day && targetStartSlot === req.startSlot) {
    return { ok: true, noop: true, newReq: req, locationId: req.locationId };
  }
  const newReq = state.requests.find(
    (r) =>
      r.memberId === req.memberId &&
      r.day === targetDay &&
      r.startSlot === targetStartSlot &&
      r.duration === req.duration,
  );
  if (!newReq) {
    return {
      ok: false,
      message: "이 회원은 해당 시간에 신청한 이력이 없습니다",
    };
  }
  const sameDayConflict = container.assigned.some(
    (a) =>
      !ignoreSet.has(a.id) &&
      a.memberId === req.memberId &&
      a.day === targetDay,
  );
  if (sameDayConflict) {
    return {
      ok: false,
      message: "같은 요일에는 하루 최대 1회만 배정할 수 있습니다",
    };
  }
  const validLocations = candidateLocationsForRequest(newReq);
  const locationId = validLocations.includes(req.locationId)
    ? req.locationId
    : validLocations[0];
  if (!locationId) {
    return {
      ok: false,
      message: "해당 지점에서는 이 시간을 이용할 수 없습니다",
    };
  }
  const durSlots = durationToSlots(req.duration);
  const dayAssigned = container.assigned
    .filter((a) => a.day === targetDay && !ignoreSet.has(a.id))
    .sort((a, b) => a.startSlot - b.startSlot);
  const prevAssigned =
    dayAssigned.filter((a) => a.startSlot < targetStartSlot).pop() || null;
  const nextAssigned =
    dayAssigned.find((a) => a.startSlot >= targetStartSlot) || null;
  if (prevAssigned) {
    const prevEnd =
      prevAssigned.startSlot + durationToSlots(prevAssigned.duration);
    const gapSlots =
      requiredGapMin(prevAssigned.locationId, locationId) / SLOT_MIN;
    if (prevEnd + gapSlots > targetStartSlot) {
      return {
        ok: false,
        message: "바로 앞 수업과 시간이 겹치거나 이동 시간이 부족합니다",
      };
    }
  }
  if (nextAssigned) {
    const gapSlots =
      requiredGapMin(locationId, nextAssigned.locationId) / SLOT_MIN;
    if (targetStartSlot + durSlots + gapSlots > nextAssigned.startSlot) {
      return {
        ok: false,
        message: "바로 다음 수업과 시간이 겹치거나 이동 시간이 부족합니다",
      };
    }
  }
  const arrivedViaTravel =
    !!prevAssigned && travelMinutes(prevAssigned.locationId, locationId) > 0;
  const departsViaTravel =
    !!nextAssigned && travelMinutes(locationId, nextAssigned.locationId) > 0;
  if (
    arrivedViaTravel &&
    departsViaTravel &&
    soloTravelMemberIds().has(req.memberId)
  ) {
    return {
      ok: false,
      message: "이 회원은 이동으로 앞뒤가 막힌 자리에는 배정할 수 없습니다",
    };
  }
  return { ok: true, newReq, locationId };
}

// 배정된 세션 하나를 드래그로 다른 (day, startSlot) 자리로 옮긴다. 자리는 항상 "그 회원이
// 실제로 신청했던 시간" 중 하나여야 한다 — 신청 이력에 없는 임의의 시간으로는 옮길 수 없다
// (배정은 항상 실제 신청 중 하나를 고르는 것이라는 시스템 전체의 전제와 같다. addDesiredRange
// 참고 — 회원이 신청한 범위 안의 모든 10분 간격 시작 시각이 이미 개별 신청으로 등록돼 있으므로,
// 신청 범위 안이라면 대부분 그대로 맞아떨어진다). 검증은 validateMove에 그대로 맡긴다.
// 통과하면 옮기고, 재생성해도 이 자리가 풀리지 않도록 자동으로 확정한다(사람이 손댄 자리는
// 알고리즘이 건드리지 않는다는 기존 확정 로직과 같은 취지).
export function moveSession(
  container,
  req,
  targetDay,
  targetStartSlot,
  onDone,
) {
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
    locationId,
  };
  if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
  container.confirmedIds = container.confirmedIds.filter((id) => id !== req.id);
  container.confirmedIds.push(newReq.id);
  saveState();
  onDone();
  showToast("일정이 이동되었습니다", "success");
}

// 자리 맞바꾸기가 가능한지 검사만 한다(prepareSwap) — req를 occupying의 자리로, occupying을
// req의 자리로 동시에 옮기는 것이므로 두 방향 모두 validateMove를 통과해야 한다. 서로 상대의
// 현재 자리는 "곧 비워질 자리"라 걸림돌이 아니므로 ignoreIds로 서로를 빼고 검사한다. 길이가
// 다르면애초에 "맞바꾼다"는 개념이 어색해지므로(한쪽만 옮기면 남는 자리가 생김) 막는다.
export function prepareSwap(container, req, occupying) {
  if (occupying.duration !== req.duration) {
    return { ok: false, message: "길이가 서로 달라 자리를 맞바꿀 수 없습니다" };
  }
  const reqA2 = state.requests.find(
    (r) =>
      r.memberId === req.memberId &&
      r.day === occupying.day &&
      r.startSlot === occupying.startSlot &&
      r.duration === req.duration,
  );
  const reqB2 = state.requests.find(
    (r) =>
      r.memberId === occupying.memberId &&
      r.day === req.day &&
      r.startSlot === req.startSlot &&
      r.duration === occupying.duration,
  );
  if (!reqA2 || !reqB2) {
    return {
      ok: false,
      message:
        "두 회원 모두 상대방 시간에 신청한 이력이 있어야 자리를 맞바꿀 수 있습니다",
    };
  }
  const checkA = validateMove(
    container,
    req,
    occupying.day,
    occupying.startSlot,
    [occupying.id],
  );
  if (!checkA.ok) return { ok: false, message: checkA.message };
  const checkB = validateMove(container, occupying, req.day, req.startSlot, [
    req.id,
  ]);
  if (!checkB.ok) return { ok: false, message: checkB.message };
  return {
    ok: true,
    reqA2,
    reqB2,
    locA: checkA.locationId,
    locB: checkB.locationId,
  };
}

// 드래그로 놓은 자리에 이미 다른 배정이 있을 때, 그 자리로 그냥 옮기는 대신 두 배정의
// 자리를 서로 맞바꾼다 — "이수정을 금5로, 한지원을 목3에서 이수정이 있던 목4로" 같은 조정을
// 순서 신경 쓰지 않고 한 번의 드래그로 끝낼 수 있게 해준다.
export function attemptSwap(container, req, occupying, onDone) {
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
    locationId: plan.locA,
  };
  container.assigned[idxB] = {
    id: plan.reqB2.id,
    memberId: occupying.memberId,
    day: req.day,
    startSlot: req.startSlot,
    duration: occupying.duration,
    locationId: plan.locB,
  };
  if (!Array.isArray(container.confirmedIds)) container.confirmedIds = [];
  container.confirmedIds = container.confirmedIds.filter(
    (id) => id !== req.id && id !== occupying.id,
  );
  container.confirmedIds.push(plan.reqA2.id, plan.reqB2.id);
  saveState();
  onDone();
  showToast("두 자리를 맞바꿨습니다", "success");
}

// 드래그·클릭으로 세션을 옮기려 할 때 공통으로 쓰는 진입점: 놓을 자리가 비어있으면 그냥
// 옮기고(moveSession), 이미 다른 배정이 있으면 자리 맞바꾸기를 시도한다(attemptSwap).
export function moveOrSwapSession(
  container,
  req,
  targetDay,
  targetStartSlot,
  onDone,
) {
  const occupying = findOccupyingAssigned(
    container,
    req,
    targetDay,
    targetStartSlot,
  );
  if (occupying) {
    attemptSwap(container, req, occupying, onDone);
  } else {
    moveSession(container, req, targetDay, targetStartSlot, onDone);
  }
}

// 드래그 중 실시간으로 "여기에 놓으면 어떻게 되는지"를 보여주기 위한 판정. 자리가 비어있으면
// 일반 이동 기준으로, 이미 차 있으면 자리 맞바꾸기 기준으로 판단한다 — moveOrSwapSession이
// 실제로 어느 쪽을 실행할지와 항상 같은 기준이어야 한다. kind는 미리보기 색을 구분하는 데
// 쓴다: "move"(빈 자리로 이동 가능) / "swap"(다른 배정과 맞바꾸기 가능) / "invalid"(둘 다 불가).
export function canMoveOrSwapTo(container, req, targetDay, targetStartSlot) {
  const occupying = findOccupyingAssigned(
    container,
    req,
    targetDay,
    targetStartSlot,
  );
  if (!occupying) {
    const ok = validateMove(container, req, targetDay, targetStartSlot).ok;
    return { ok, kind: ok ? "move" : "invalid" };
  }
  const ok = prepareSwap(container, req, occupying).ok;
  return { ok, kind: ok ? "swap" : "invalid" };
}

// 이동 시간 블록 자체는 옮길 수 있는 데이터가 아니다(두 수업 사이 간격에서 계산되는 값일
// 뿐이라 독립적인 자리가 없다) — 그래서 "이동 시간을 30분 추가/제거한다"는, 실제로는 그
// 이동 시간 바로 다음 수업(nextReq)을 30분 뒤로 밀거나 앞으로 당겨 그 앞의 간격을 늘리거나
// 줄이는 것으로 구현한다. moveSession이 신청 이력·겹침·이동 시간 확보 여부를 그대로
// 검증해주므로, 최소 이동 시간보다 더 줄이려 하면 자연스럽게 거부된다.
export const TRAVEL_SHIFT_SLOTS = 30 / SLOT_MIN;
export function travelShiftMenuItems(container, nextReq, onDone) {
  return [
    {
      label: "다음 수업 30분 뒤로 미루기 (여유 늘리기)",
      onClick: () =>
        moveOrSwapSession(
          container,
          nextReq,
          nextReq.day,
          nextReq.startSlot + TRAVEL_SHIFT_SLOTS,
          onDone,
        ),
    },
    {
      label: "다음 수업 30분 앞당기기 (여유 줄이기)",
      onClick: () =>
        moveOrSwapSession(
          container,
          nextReq,
          nextReq.day,
          nextReq.startSlot - TRAVEL_SHIFT_SLOTS,
          onDone,
        ),
    },
  ];
}

// "수업 스케줄 생성2"(engine/chainDp.js) 결과를 그리드에 그릴 수 있는, 드래그·컨텍스트메뉴가
// 달린 블록 객체로 바꾸는 어댑터. moveOrSwapSession 등 이 파일의 편집 함수에 의존하므로
// 여기에 둔다(engine/chainDp.js에 두면 엔진이 페이지를 import하는 순환이 생긴다).
// result/onDone: 생성3의 후보A 카드에서 항상 그 결과 객체와 renderSchedule3Result를 명시적으로 넘겨받아 쓴다.
export function schedule2ToBlocks(assigned, { result, onDone } = {}) {
  const confirmedIds = new Set((result && result.confirmedIds) || []);
  return assigned.map((r) => {
    const m = memberById(r.memberId);
    const loc = locationById(r.locationId);
    const label = m
      ? m.name + ((m.category || "상담") === "상담" ? " (상담)" : "")
      : "?";
    const isConfirmed = confirmedIds.has(r.id);
    return {
      day: r.day,
      startSlot: r.startSlot,
      duration: r.duration,
      label,
      loc: loc ? loc.name : "",
      sublabel:
        slotLabel(r.startSlot) + "~" + endLabel(r.startSlot, r.duration),
      color: m ? memberColor(m.id) : BLOCK_COLOR,
      confirmed: isConfirmed,
      contextMenuItems: () =>
        sessionSwapMenuItems(result, r, isConfirmed, onDone),
      onMove: (targetDay, targetSlot) =>
        moveOrSwapSession(result, r, targetDay, targetSlot, onDone),
      canMoveTo: (targetDay, targetSlot) =>
        canMoveOrSwapTo(result, r, targetDay, targetSlot),
    };
  });
}

// 같은 요일 안에서 연속된 두 세션 사이, 지점이 달라 실제로 이동이 필요한 구간만 표시한다
// (쉬는 시간 없음이 규칙이므로 같은 지점이면 표시할 것이 없다). onDone은 호출부가 항상
// 명시적으로 넘긴다(재생성용 렌더 함수를 기본값으로 암묵 참조하지 않는다).
export function schedule2ToTravelBlocks(container, onDone) {
  const assigned = container.assigned;
  const byDay = new Map();
  assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  const travelBlocks = [];
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1],
        cur = sorted[i];
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
          onMove: (targetDay, targetSlot) =>
            moveOrSwapSession(container, cur, targetDay, targetSlot, onDone),
          canMoveTo: (targetDay, targetSlot) =>
            canMoveOrSwapTo(container, cur, targetDay, targetSlot),
          contextMenuItems: () => travelShiftMenuItems(container, cur, onDone),
        });
      }
    }
  });
  return travelBlocks;
}

// req와 같은 요일·같은 지점에 배정된 다른 회원들 중, req의 자리로 맞바꿔도 되는(prepareSwap
// 통과) 회원만 골라낸다 — "다른 회원으로 교체"(eligibleSwapMembersFor)와 달리 시작 시각이
// 같을 필요는 없다(자리를 서로 맞바꾸는 것이므로 각자 원래 자리로 옮겨가면 그만이다). 같은
// 지점으로 제한하는 이유는, 지점이 다르면 "맞교체"라는 조작이 사용자 입장에서 자연스럽지
// 않기 때문(멀리 떨어진 자리끼리의 맞교체는 드래그로 직접 하도록 남겨둔다).
export function eligibleMutualSwapsFor(container, req) {
  const results = [];
  const seenMemberIds = new Set();
  container.assigned.forEach((occupying) => {
    if (occupying.id === req.id) return;
    if (occupying.day !== req.day || occupying.locationId !== req.locationId)
      return;
    if (
      occupying.memberId === req.memberId ||
      seenMemberIds.has(occupying.memberId)
    )
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

// 그리드의 배정된 세션 블록을 클릭했을 때 뜨는 메뉴: 맨 위는 확정/확정취소, 그 아래는 같은
// 요일·시간·지점에 교체 가능한 다른 회원 목록이다 — "확정하시겠습니까?" 확인창 대신 이 목록을
// 보여주고, 고르면 그 자리 인원만 바로 바뀐다. 그 아래에는 같은 요일·지점에 배정된 다른
// 회원과 자리를 통째로 맞바꾸는 "맞교체" 목록을 더한다(드래그로 하는 attemptSwap과 동일한
// 동작을 메뉴에서도 고를 수 있게 한 것).
export function sessionSwapMenuItems(container, req, isConfirmed, onDone) {
  const member = memberById(req.memberId);
  const items = [
    {
      label: isConfirmed
        ? "확정 취소"
        : "현재 인원(" + (member ? member.name : "?") + ")으로 확정",
      onClick: () =>
        isConfirmed
          ? unconfirmSession(container, req.id, onDone)
          : confirmSession(container, req.id, onDone),
    },
    { separator: true },
  ];
  const swapMembers = eligibleSwapMembersFor(container, req);
  if (swapMembers.length === 0) {
    items.push({ label: "교체 가능한 인원 없음", disabled: true });
  } else {
    swapMembers.forEach((m) => {
      items.push({
        label: m.name + "(으)로 교체",
        onClick: () => swapSessionMember(container, req, m, onDone),
      });
    });
  }
  const mutualSwaps = eligibleMutualSwapsFor(container, req);
  if (mutualSwaps.length > 0) {
    items.push({ separator: true });
    mutualSwaps.forEach(({ member: m, occupying }) => {
      items.push({
        label: m.name + " 회원과 맞교체",
        onClick: () => attemptSwap(container, req, occupying, onDone),
      });
    });
  }
  return items;
}

export function candidateToBlocks(candidate, onDone = renderSchedule3Result) {
  const confirmedIds = new Set(candidate.confirmedIds || []);
  return candidate.assigned.map((r) => {
    const m = memberById(r.memberId);
    const loc = locationById(r.locationId);
    const label = m
      ? m.name + ((m.category || "상담") === "상담" ? " (상담)" : "")
      : "?";
    const isConfirmed = confirmedIds.has(r.id);
    return {
      day: r.day,
      startSlot: r.startSlot,
      duration: r.duration,
      label: label,
      loc: loc ? loc.name : "",
      sublabel:
        slotLabel(r.startSlot) + "~" + endLabel(r.startSlot, r.duration),
      color: m ? memberColor(m.id) : BLOCK_COLOR,
      confirmed: isConfirmed,
      contextMenuItems: () =>
        sessionSwapMenuItems(candidate, r, isConfirmed, onDone),
      onMove: (targetDay, targetSlot) =>
        moveOrSwapSession(candidate, r, targetDay, targetSlot, onDone),
      canMoveTo: (targetDay, targetSlot) =>
        canMoveOrSwapTo(candidate, r, targetDay, targetSlot),
    };
  });
}

// 같은 요일 안에서 연속된 두 세션 사이, 지점이 달라 실제로 이동이 필요한 구간만 표시한다
// (쉬는 시간 없음이 규칙이므로 같은 지점이면 표시할 것이 없다).
export function candidateToTravelBlocks(
  candidate,
  onDone = renderSchedule3Result,
) {
  const byDay = new Map();
  candidate.assigned.forEach((r) => {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  });
  const travelBlocks = [];
  byDay.forEach((reqs) => {
    const sorted = [...reqs].sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1],
        cur = sorted[i];
      const startSlot = prev.startSlot + durationToSlots(prev.duration);
      const gapMin = (cur.startSlot - startSlot) * SLOT_MIN;
      if (gapMin <= 0) continue;
      const mins = travelMinutes(prev.locationId, cur.locationId);
      if (mins > 0) {
        travelBlocks.push({
          day: prev.day,
          startSlot,
          duration: mins,
          label: "이동 " + mins + "분",
          type: "travel",
          moveDurationSlots: durationToSlots(cur.duration),
          onMove: (targetDay, targetSlot) =>
            moveOrSwapSession(candidate, cur, targetDay, targetSlot, onDone),
          canMoveTo: (targetDay, targetSlot) =>
            canMoveOrSwapTo(candidate, cur, targetDay, targetSlot),
          contextMenuItems: () => travelShiftMenuItems(candidate, cur, onDone),
        });
      } else if (BREAK_MIN > 0) {
        // 지점이 같아도(또는 이동 시간이 0분이어도) 최소 BREAK_MIN만큼은 쉬는 시간으로 예약돼 있다.
        const breakMin = Math.min(BREAK_MIN, gapMin);
        travelBlocks.push({
          day: prev.day,
          startSlot,
          duration: breakMin,
          label: "휴식 " + breakMin + "분",
          type: "break",
        });
      }
    }
  });
  return travelBlocks;
}

// 분을 "150분"처럼 분 단위 배지 텍스트로 바꾼다.
export function formatMinutesLabel(minutes) {
  return Math.round(minutes) + "분";
}

/* ---------------- Page navigation (left sidebar, no forced order) ---------------- */
export const pageEls = {
  settings: document.getElementById("pageSettings"),
  schedule3: document.getElementById("pageSchedule3"),
  members: document.getElementById("pageMembers"),
  memberSchedule: document.getElementById("pageMemberSchedule"),
};
export const navItems = document.querySelectorAll(".nav-item");

export function goToPage(pageId) {
  if (!pageEls[pageId]) return;
  runtime.currentPage = pageId;
  Object.keys(pageEls).forEach((key) => {
    pageEls[key].classList.toggle("active", key === pageId);
  });
  navItems.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });
  // 이 메뉴에 들어올 때마다 회원 선택은 항상 초기화한다(아무도 선택되지 않은 상태로 시작).
  // 설정 페이지에서 근무 가능 시간을 바꾼 뒤 이 페이지로 넘어와도 그리드가 최신 상태로 보이도록 다시 그린다.
  if (pageId === "memberSchedule") {
    setActiveScheduleMemberId(null);
    renderRequestList();
  }
  // 회원 스케줄 추가 등에서 신청 데이터가 바뀐 뒤 이 메뉴로 들어오면, 옛 신청 기준으로
  // 계산된 후보는 더 이상 맞지 않으므로 자동으로 비워서 다시 생성하도록 안내한다.
  if (pageId === "schedule3" && runtime.requestsChangedSinceGenerate3) {
    runtime.requestsChangedSinceGenerate3 = false;
    if (
      runtime.candidates.length > 0 ||
      runtime.schedule3Result.candidateAList.some(Boolean)
    ) {
      runtime.candidates = [];
      runtime.schedule3Result = { candidateAList: [null, null, null] };
      resetCandidateSession();
      renderSchedule3Result();
      saveState();
      generateHint3El.textContent =
        "신청 시간이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
    }
  }
  saveState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => goToPage(btn.dataset.page));
});

// Extra safety net: flush state if the browser tab itself is being left/closed.
window.addEventListener("beforeunload", saveState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveState();
});

/* ---------------- "수업 스케줄 생성3": 생성1·생성2 엔진을 그대로 재사용해 후보 3개를 한
     화면에 보여준다 (후보A=생성2 결과, 후보B/C=생성1의 후보A/B). 생성1·생성2의 알고리즘 코드는
     여기서 전혀 다시 만들지 않고, withSelectionOverride로 감싸 그대로 호출한다. ---------------- */

// "미배정 회원"/"1회 제한 회원" 위젯을 만드는 공통 팩토리 — 두 위젯의 구조가 완전히
// 같아 복붙을 피하려고 일반화했다.
export function createMemberSelectionWidget(opts) {
  const {
    idsKey,
    conflictIdsKey,
    conflictMessage,
    eligibleFilter,
    emptyMembersMessage,
    chipClass,
    elIds,
    onChanged,
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
    const selectedMembers = state[idsKey]
      .map((id) => memberById(id))
      .filter((m) => m && eligibleFilter(m))
      .sort(compareOnceLimitMembers);
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
    const addable = eligibleMembers
      .filter((m) => !state[idsKey].includes(m.id))
      .sort(compareOnceLimitMembers);
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
    },
  };
}

// 이 설정은 후보 생성 결과에 바로 영향을 주므로, 이미 생성된 결과가 있으면 즉시 비운다
// (onOnceLimit2Changed/onExcluded2Changed와 동일한 패턴).
export function onSchedule3SelectionChanged() {
  if (
    runtime.candidates.length > 0 ||
    runtime.schedule3Result.candidateAList.some(Boolean)
  ) {
    runtime.candidates = [];
    runtime.schedule3Result = { candidateAList: [null, null, null] };
    resetCandidateSession();
    renderSchedule3Result();
    generateHint3El.textContent =
      "회원 선택이 변경되어 기존 후보가 초기화되었습니다. 후보를 다시 생성해주세요.";
  } else {
    runtime.requestsChangedSinceGenerate3 = true;
  }
}

export const onceLimit3Widget = createMemberSelectionWidget({
  idsKey: "onceLimitedMemberIds3",
  conflictIdsKey: "excludedMemberIds3",
  conflictMessage:
    "미배정 회원에 추가되어 있는 회원입니다.\n미배정 회원에서 삭제 후 다시 추가해 주세요.",
  eligibleFilter: isOnceLimitEligible,
  emptyMembersMessage:
    "등록 회원이 없습니다. (상담 회원은 이미 항상 1회로 제한됩니다)",
  chipClass: "chip",
  elIds: {
    ms: "onceLimitMs3",
    control: "onceLimitControl3",
    chipRow: "onceLimitChipRow3",
    dropdown: "onceLimitDropdown3",
  },
  onChanged: onSchedule3SelectionChanged,
});

export const excluded3Widget = createMemberSelectionWidget({
  idsKey: "excludedMemberIds3",
  conflictIdsKey: "onceLimitedMemberIds3",
  conflictMessage:
    "1회 제한 회원에 추가되어 있는 회원입니다.\n1회 제한 회원에서 삭제 후 다시 추가해 주세요.",
  eligibleFilter: () => true,
  emptyMembersMessage: "등록된 회원이 없습니다.",
  chipClass: "chip chip-excluded",
  elIds: {
    ms: "excludedMs3",
    control: "excludedControl3",
    chipRow: "excludedChipRow3",
    dropdown: "excludedDropdown3",
  },
  onChanged: onSchedule3SelectionChanged,
});

// 생성1(그리디, generateCandidatesAsync)과 생성2(체인 DP, generateSchedule2Async)를 이 페이지의
// "미배정 회원"/"1회 제한 회원" 목록으로 그대로 호출한다 — 두 함수의 본문은 한 줄도 건드리지
// 않는다. withSelectionOverride는 동기 호출만 감싸는 게 원칙이지만, 이 두 함수는 내부에
// await(yieldToUI)가 있어 오버라이드가 그 사이에도 켜져 있다 — 그동안 다른 생성 버튼이 눌리면
// 서로 다른 페이지의 선택 목록이 뒤섞일 수 있는데, 이건 runtime.generationInProgress 가드(세 생성
// 버튼이 공유)로 원천 차단한다.
// genA/genBC: 후보A 버튼·후보B·C 버튼이 각각 자신의 엔진만 켜서 호출한다(둘 다 켤 일은 없다).
// 꺼진 쪽은 이 함수가 관여하지 않고 호출부가 이전 결과를 그대로 유지한다.
export async function generateSchedule3Async(
  onProgress,
  { genA = true, genBC = true } = {},
) {
  const excludedIds3 = state.excludedMemberIds3;
  const onceLimitIds3 = state.onceLimitedMemberIds3;
  let v1Built = null;
  let v2Result = null;
  if (genBC) {
    const bcWeight = genA ? 0.5 : 1;
    v1Built = await withSelectionOverride(excludedIds3, onceLimitIds3, () =>
      generateCandidatesAsync((progress) => onProgress(progress * bcWeight)),
    );
  }
  if (genA) {
    const aStart = genBC ? 0.5 : 0;
    const aWeight = genBC ? 0.5 : 1;
    v2Result = await withSelectionOverride(excludedIds3, onceLimitIds3, () =>
      generateSchedule2Async((progress) =>
        onProgress(aStart + progress * aWeight),
      ),
    );
  }
  onProgress(1);
  return {
    candidateB: v1Built ? v1Built.built[0] || null : null, // 생성1의 후보A(전략 0, 인원 최대)
    candidateC: v1Built ? v1Built.built[1] || null : null, // 생성1의 후보B(전략 1, 수업 횟수 최대)
    poolsBC: v1Built ? v1Built.pools : null, // strategyIndex -> 배치 페이저용 동점 풀
    candidateAList: v2Result ? v2Result.map((c) => c.result) : null, // 후보A-1/A-2/A-3
    candidateAPools: v2Result ? v2Result.map((c) => c.pool) : null, // 카드 인덱스 -> 배치 페이저용 동점 풀
    genA,
    genBC,
  };
}

export const generateHint3El = document.getElementById("generateHint3");
export const candidates3El = document.getElementById("candidates3");
export const generateBtnA3El = document.getElementById("generateBtnA3");
export const generateBtnA3LabelEl =
  document.getElementById("generateBtnA3Label");
export const generateBtnA3CancelEl = document.getElementById(
  "generateBtnA3Cancel",
);
export const generateProgressWrapA3El = document.getElementById(
  "generateProgressWrapA3",
);
export const generateProgressFillA3El = document.getElementById(
  "generateProgressFillA3",
);
export const generateProgressTextA3El = document.getElementById(
  "generateProgressTextA3",
);
export const generateBtnBC3El = document.getElementById("generateBtnBC3");
export const generateBtnBC3LabelEl = document.getElementById(
  "generateBtnBC3Label",
);
export const generateBtnBC3CancelEl = document.getElementById(
  "generateBtnBC3Cancel",
);
export const generateProgressWrapBC3El = document.getElementById(
  "generateProgressWrapBC3",
);
export const generateProgressFillBC3El = document.getElementById(
  "generateProgressFillBC3",
);
export const generateProgressTextBC3El = document.getElementById(
  "generateProgressTextBC3",
);

// 후보A(체인 DP)·후보B/C(그리디, runtime.candidates 배열) 카드를 그린다. 후보B/C는 strategyIndex(0/1)를
// 넘겨받으면 옛 "수업 스케줄 생성1" 페이지에 있던 "↩ 이전 후보"/"↻ 다음 후보" 버튼을 그대로 붙인다
// (regenerateCandidate/restorePreviousCandidate/candidateHistory/candidateUndoStack 로직은 무변경 —
// 이 카드가 runtime.candidates[strategyIndex]를 직접 읽고 쓰기 때문에 그대로 재사용할 수 있다).
export function renderSchedule3Result() {
  candidates3El.innerHTML = "";
  const gridRange = businessHoursGridRange();

  // 후보A(체인 DP)는 왼쪽 열에, 후보B·C(그리디)는 오른쪽 열에 고정되도록 두 열을 별도
  // 컨테이너로 분리한다 — 하나의 CSS auto-fit 그리드에 순서대로 흘려보내면 폭에 따라
  // 후보A와 후보B·C가 같은 열에 섞여버리기 때문이다.
  const colLeft = document.createElement("div");
  colLeft.className = "candidates-col";
  const colRight = document.createElement("div");
  colRight.className = "candidates-col";
  candidates3El.appendChild(colLeft);
  candidates3El.appendChild(colRight);

  function buildCard(
    title,
    desc,
    result,
    blocks,
    travelBlocks,
    idleMinutes,
    strategyIndex,
    pool,
    onSelectPoolVariant,
    columnEl,
  ) {
    const card = document.createElement("div");
    card.className = "candidate-card";

    const head = document.createElement("div");
    head.className = "candidate-card-head";
    const titleEl = document.createElement("h3");
    titleEl.className = "candidate-title";
    titleEl.textContent = title;
    head.appendChild(titleEl);

    {
      const actions = document.createElement("div");
      actions.className = "candidate-card-actions";

      // 텍스트 라벨 버튼 4개를 한 줄에 나열하면 카드가 좁을 때 제목이 두 줄로 밀려버려서,
      // 아이콘 전용 버튼(툴팁으로 설명 대체)으로 압축하고 그룹 사이에 구분선을 둔다:
      // [편집 취소] | [이전 후보][다음 후보] | [저장]
      function makeIconBtn(iconSvg, label, tooltip) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-ghost icon-btn regen-candidate-btn";
        b.setAttribute("aria-label", label);
        b.title = tooltip;
        b.innerHTML = iconSvg;
        return b;
      }
      function addDivider() {
        const d = document.createElement("span");
        d.className = "action-divider";
        actions.appendChild(d);
      }

      const ICON_UNDO_MANUAL =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
      // 드래그 이동·자리 맞바꾸기·인원 교체·확정 등 "방금 한 조정 하나"만 되돌린다 — 아래
      // "이전 후보"(재생성 되돌리기)와는 별개이고, 후보A에도(strategyIndex가 없어 재생성
      // 되돌리기 버튼이 없는) 똑같이 필요하므로 strategyIndex 유무와 무관하게 항상 넣는다.
      const undoManualBtn = makeIconBtn(
        ICON_UNDO_MANUAL,
        "편집 취소",
        "방금 드래그로 옮기거나 맞바꾸거나 교체·확정한 것을 취소합니다.",
      );
      undoManualBtn.disabled = !hasManualUndo(result);
      undoManualBtn.addEventListener("click", () => {
        undoManualEdit(result, renderSchedule3Result);
      });
      actions.appendChild(undoManualBtn);

      if (strategyIndex != null) {
        addDivider();

        const undoStackForThis = candidateUndoStack[strategyIndex] || [];
        const ICON_PREV_CANDIDATE =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
        const undoBtn = makeIconBtn(
          ICON_PREV_CANDIDATE,
          "이전 후보",
          "재생성하기 전의 후보로 되돌아갑니다.",
        );
        undoBtn.disabled = undoStackForThis.length === 0;
        undoBtn.addEventListener("click", () => {
          restorePreviousCandidate(strategyIndex, renderSchedule3Result);
        });
        actions.appendChild(undoBtn);

        const ICON_REGEN =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.65 5.64L1 10m22 4-4.65 4.36A9 9 0 0 1 3.51 15"/></svg>';
        const regenBtn = makeIconBtn(
          ICON_REGEN,
          "다음 후보",
          "이 후보만 같은 전략 안에서 다시 계산합니다.",
        );
        const regenBtnIconHtml = regenBtn.innerHTML;
        regenBtn.disabled = !hasRegenerableEligible(strategyIndex);
        regenBtn.addEventListener("click", async () => {
          regenBtn.disabled = true;
          undoBtn.disabled = true;
          regenBtn.classList.add("icon-btn-loading");
          try {
            // 생성3 자신의 미배정/1회 제한 회원 설정(excludedMemberIds3/onceLimitedMemberIds3)이
            // 적용되도록 반드시 withSelectionOverride로 감싼다 — 그냥 호출하면 currentExcludedIds()가
            // (더 이상 UI가 없어 항상 비어있는) 옛 생성1 설정으로 폴백해버린다.
            await withSelectionOverride(
              state.excludedMemberIds3,
              state.onceLimitedMemberIds3,
              () =>
                regenerateCandidate(
                  strategyIndex,
                  (progress) => {
                    regenBtn.textContent = Math.round(progress * 100) + "%";
                  },
                  renderSchedule3Result,
                ),
            );
          } finally {
            regenBtn.classList.remove("icon-btn-loading");
            regenBtn.innerHTML = regenBtnIconHtml;
            regenBtn.disabled = !hasRegenerableEligible(strategyIndex);
            undoBtn.disabled =
              (candidateUndoStack[strategyIndex] || []).length === 0;
          }
        });
        actions.appendChild(regenBtn);
      }

      addDivider();

      const ICON_SAVE =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      const saveImageBtn = makeIconBtn(
        ICON_SAVE,
        "이미지로 저장",
        "이 후보 카드를 이미지로 저장합니다.",
      );
      saveImageBtn.addEventListener("click", () => {
        saveCandidateCardAsImage(card, title);
      });
      actions.appendChild(saveImageBtn);

      head.appendChild(actions);
    }

    card.appendChild(head);

    const descEl = document.createElement("p");
    descEl.className = "candidate-desc";
    descEl.textContent = desc;
    card.appendChild(descEl);

    // "배치 페이저": 미배정/수업 건수/이동 횟수(후보A는 이동 시간·빈 시간까지) 지표가 완전히
    // 동점인 다른 배치가 있으면(pool.length > 1), 재계산 없이 그 풀 안에서 넘나들 수 있게
    // 한다. pool.indexOf(result)가 -1이면(드래그 등 수동 편집으로 지금 화면이 풀의 어떤
    // 항목과도 더 이상 같은 배치가 아니거나, "이전 후보"로 되돌아간 경우) 페이저를 그리지
    // 않는다 — 별도 무효화 로직 없이 참조 동일성만으로 자연스럽게 처리된다.
    if (pool && pool.length > 1) {
      const poolIdx = pool.indexOf(result);
      if (poolIdx !== -1) {
        const pager = document.createElement("div");
        pager.className = "candidate-pool-pager";

        function selectPoolVariant(newIdx) {
          onSelectPoolVariant(newIdx);
          saveState();
          renderSchedule3Result();
        }

        const prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.className = "btn btn-ghost icon-btn pool-pager-btn";
        prevBtn.setAttribute("aria-label", "이전 배치");
        prevBtn.title = "같은 조건의 다른 배치를 봅니다.";
        prevBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
        prevBtn.disabled = poolIdx === 0;
        prevBtn.addEventListener("click", () => selectPoolVariant(poolIdx - 1));

        const label = document.createElement("span");
        label.className = "pool-pager-label";
        label.textContent = "배치 " + (poolIdx + 1) + "/" + pool.length;

        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "btn btn-ghost icon-btn pool-pager-btn";
        nextBtn.setAttribute("aria-label", "다음 배치");
        nextBtn.title = "같은 조건의 다른 배치를 봅니다.";
        nextBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        nextBtn.disabled = poolIdx === pool.length - 1;
        nextBtn.addEventListener("click", () => selectPoolVariant(poolIdx + 1));

        pager.appendChild(prevBtn);
        pager.appendChild(label);
        pager.appendChild(nextBtn);
        card.appendChild(pager);

        // 동점 풀(candidateAPools/poolsBC)은 새로고침하면 사라지는 세션 한정 기록이라
        // (state에 저장되지 않음), 페이저가 뜬 김에 그 사실을 안내해 둔다.
        const pagerHint = document.createElement("p");
        pagerHint.className = "pool-pager-hint";
        pagerHint.textContent = "새로고침하면 이 목록은 사라질 수 있어요.";
        card.appendChild(pagerHint);
      }
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
      rangeEndSlot: gridRange.rangeEndSlot,
    });

    if (result.unassignedMembers.length > 0) {
      const box = document.createElement("div");
      box.className = "unassigned-box unassigned-box-danger";
      box.innerHTML =
        "<b>미배정 회원 (" +
        result.unassignedMembers.length +
        "명)</b> · " +
        result.unassignedMembers.map((m) => m.name).join(", ");
      card.appendChild(box);
    }
    // 회원별 배정 세션을 모아 정확히 2회 배정된 회원의 지점(세션마다 다를 수 있어 중복 제거
    // 후 "(첫 글자)"를 이어붙임)과 이름을 보여준다. candidateA(체인 DP)·B/C(그리디) 모두
    // result.assigned에 {memberId, locationId} 형태의 세션을 담고 있어 별도 계산 없이 여기서
    // 바로 집계할 수 있다.
    const sessionsByMember = new Map();
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
          sessions
            .map((s) => {
              const loc = locationById(s.locationId);
              return loc ? loc.name : null;
            })
            .filter(Boolean),
        ),
      ];
      const locLabel = locNames
        .map((name) => "(" + name.charAt(0) + ")")
        .join("");
      doubleAssignedMembers.push({ member, locLabel });
    });
    doubleAssignedMembers.sort((a, b) =>
      a.member.name.localeCompare(b.member.name, "ko"),
    );
    if (doubleAssignedMembers.length > 0) {
      const box = document.createElement("div");
      box.className = "unassigned-box double-assigned-box";
      box.innerHTML =
        "<b>2회 배정 회원 (" +
        doubleAssignedMembers.length +
        "명)</b> · " +
        doubleAssignedMembers
          .map((d) => d.locLabel + " " + d.member.name)
          .join(", ");
      card.appendChild(box);
    }

    columnEl.appendChild(card);
  }

  // 아직 생성하지 않은 후보도 타이틀·설명만 담은 카드로 미리 보여준다 — 실제 배정 결과가
  // 없으니 통계 pill·달력 그리드는 그리지 않는다.
  function buildPlaceholderCard(title, desc, columnEl) {
    const card = document.createElement("div");
    card.className = "candidate-card candidate-card-placeholder";

    const titleEl = document.createElement("h3");
    titleEl.className = "candidate-title";
    titleEl.textContent = title;
    card.appendChild(titleEl);

    const descEl = document.createElement("p");
    descEl.className = "candidate-desc";
    descEl.textContent = desc;
    card.appendChild(descEl);

    const hint = document.createElement("p");
    hint.className = "candidate-card-placeholder-hint";
    hint.textContent =
      "아직 생성되지 않았습니다. '후보 생성하기'를 눌러주세요.";
    card.appendChild(hint);

    columnEl.appendChild(card);
  }

  // 후보A는 서로 독립적으로 탐색된 카드 3장(후보A-1/A-2/A-3)이다 — 카드끼리는 굳이
  // 동점일 필요가 없고(서로 다른 요일 순서 시드에서 출발해 실제로 배치가 다를 수 있다),
  // 카드 안의 배치 페이저만 그 카드 자신의 탐색에서 나온 동점을 다룬다.
  for (let i = 0; i < SCHEDULE2_CARD_COUNT; i++) {
    const aTitle = "후보A-" + (i + 1) + " - 인원 최대 (빈 시간 허용)";
    const aDesc =
      "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.";
    const a = runtime.schedule3Result.candidateAList[i];
    if (a) {
      buildCard(
        aTitle,
        aDesc,
        a,
        schedule2ToBlocks(a.assigned, {
          result: a,
          onDone: renderSchedule3Result,
        }),
        schedule2ToTravelBlocks(a, renderSchedule3Result).concat(
          schedule2ToIdleBlocks(a.assigned),
        ),
        schedule2TotalIdleMinutes(a.assigned),
        null,
        candidateAPools[i],
        (newIdx) => {
          runtime.schedule3Result.candidateAList[i] =
            candidateAPools[i][newIdx];
        },
        colLeft,
      );
    } else {
      buildPlaceholderCard(aTitle, aDesc, colLeft);
    }
  }
  const b = runtime.candidates[0];
  if (b) {
    buildCard(
      "후보B - 인원 최대 (빈 시간 최소화)",
      "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.",
      b,
      candidateToBlocks(b, renderSchedule3Result),
      candidateToTravelBlocks(b),
      schedule2TotalIdleMinutes(b.assigned),
      0,
      candidatePools[0],
      (newIdx) => {
        runtime.candidates[0] = candidatePools[0][newIdx];
      },
      colRight,
    );
  } else {
    buildPlaceholderCard(
      "후보B - 인원 최대 (빈 시간 최소화)",
      "미배정 없음 → 수업 횟수 최대 → 이동 횟수 최저 순으로 배정합니다.",
      colRight,
    );
  }
  const c = runtime.candidates[1];
  if (c) {
    buildCard(
      "후보C - 수업 횟수 최대",
      "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.",
      c,
      candidateToBlocks(c, renderSchedule3Result),
      candidateToTravelBlocks(c),
      schedule2TotalIdleMinutes(c.assigned),
      1,
      candidatePools[1],
      (newIdx) => {
        runtime.candidates[1] = candidatePools[1][newIdx];
      },
      colRight,
    );
  } else {
    buildPlaceholderCard(
      "후보C - 수업 횟수 최대",
      "수업 횟수 최대 → 인원 최대 (미배정 1명까지 허용) → 이동 횟수 최저 순으로 배정합니다.",
      colRight,
    );
  }
}

// 후보A와 후보B·C는 소요 시간 차이가 커서(A는 체인 DP+담금질로 수 분, B·C는 그리디
// 다중 시도로 INITIAL_SEARCH_ATTEMPTS 증가 후 수 분) 버튼을 따로 둔다 — A만 빠르게 다시
// 보고 싶을 때 B·C의 느린 탐색까지 함께 기다리지 않아도 된다. 다만 두 버튼이 동시에 도는
// 것까지는 허용하지 않는다(withSelectionOverride가 재진입을 지원하지 않으므로) —
// runtime.generationInProgress 가드를 그대로 공유해 한쪽이 도는 동안 다른 쪽은 토스트로 안내한다.
export async function runGenerate3({
  genA,
  genBC,
  idleLabel,
  btnEl,
  labelEl,
  cancelEl,
  progressWrapEl,
  progressFillEl,
  progressTextEl,
}) {
  if (runtime.generationInProgress) {
    showToast(
      "다른 후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.",
      "info",
    );
    return;
  }
  if (state.locations.length === 0) {
    generateHint3El.textContent = "먼저 설정 페이지에서 지점을 등록해주세요.";
    return;
  }
  if (runtime.availableCells.size === 0) {
    generateHint3El.textContent =
      "먼저 설정 페이지에서 근무 가능 시간을 설정해주세요.";
    return;
  }
  if (state.requests.length === 0) {
    generateHint3El.textContent =
      "먼저 회원 스케줄 추가 페이지에서 가능 시간을 등록해주세요.";
    return;
  }
  generateHint3El.textContent = "";
  runtime.generationInProgress = true;
  runtime.generationCancelRequested = false;

  // 후보A-1/A-2/A-3(체인 DP)는 생성2와 마찬가지로 다듬기 단계가 시간 예산제라 매번 미세하게
  // 결과가 달라질 수 있으므로, 데이터가 그대로 재생성된 경우 카드마다(자기 자신의 이전
  // 결과와 비교해) 새 결과가 기존보다 못하면 이전 결과를 지킨다. 후보B/C(그리디)는 생성1과
  // 마찬가지로 항상 새 결과로 덮어쓴다.
  const prevCandidateAList = runtime.schedule3Result.candidateAList;

  btnEl.disabled = true;
  btnEl.classList.add("loading");
  labelEl.textContent = "후보 생성 중...";
  progressWrapEl.style.display = "";
  progressFillEl.style.width = "0%";
  progressTextEl.textContent = "0%";
  progressWrapEl.setAttribute("aria-valuenow", "0");
  cancelEl.style.display = "";
  cancelEl.disabled = false;
  cancelEl.textContent = "생성 취소";

  await acquireWakeLock();
  try {
    const result = await generateSchedule3Async(
      (progress) => {
        const pct = Math.round(progress * 100);
        progressFillEl.style.width = pct + "%";
        progressTextEl.textContent = pct + "%";
        progressWrapEl.setAttribute("aria-valuenow", String(pct));
      },
      { genA, genBC },
    );
    runtime.requestsChangedSinceGenerate3 = false;
    // 카드 하나(prev/fresh)를 비교해 채택할 후보와 그 풀을 정한다: 새 결과가 실제로 더
    // 나으면 새 후보·새 풀을 그대로 채택하고, 완전 동점(화면 깜빡임을 막기 위해 기존에
    // 표시하던 후보를 그대로 유지하는 경우)이면 새로 찾은 동점 풀(freshPool)은 그대로
    // 쓰되 prev와 서명이 같은 자리를 (새로 만든 시도 객체가 아니라) prev 참조로 바꿔 넣는다
    // — 이걸 빠뜨리면 새 탐색이 진짜 동점 배치를 찾아내고도 페이저가 뜨지 않는다(실제로
    // 이 문제로 확인됨). 새 결과가 기존보다 못하면 기존 후보·풀을 그대로 지킨다(pool: null
    // 은 "풀을 건드리지 않는다"는 신호).
    function pickCandidateASlot(prev, freshResult, freshPool) {
      const newIsBetter = !prev || isSchedule2ResultBetter(freshResult, prev);
      if (newIsBetter) {
        const pool = freshPool || [];
        if (!pool.includes(freshResult)) {
          if (pool.length >= MAX_POOL_VARIANTS)
            pool.length = MAX_POOL_VARIANTS - 1;
          pool.unshift(freshResult);
        }
        return { candidate: freshResult, pool };
      }
      const newIsWorse = prev && isSchedule2ResultBetter(prev, freshResult);
      if (!newIsWorse) {
        const prevSig = schedule2Signature(prev);
        const pool = (freshPool || []).map((c) =>
          schedule2Signature(c) === prevSig ? prev : c,
        );
        // freshPool이 이번 탐색에서 찾은 "다른" 동점 배치들이라 prev와 서명이 겹치는 자리가
        // 하나도 없을 수 있다(지표는 완전히 같지만 구체적인 배치는 다른 경우) — 그러면 위
        // map이 아무것도 못 바꿔 pool에 prev가 참조로 들어있지 않게 되고, 페이저가
        // pool.indexOf(prev)로 현재 위치를 못 찾아 조용히 사라진다(실제로 이 문제로
        // 확인됨). prev를 앞에 직접 추가해 항상 pool 안에 있도록 보장한다.
        if (!pool.includes(prev)) {
          pool.unshift(prev);
          if (pool.length > MAX_POOL_VARIANTS) pool.length = MAX_POOL_VARIANTS;
        }
        return { candidate: prev, pool };
      }
      return { candidate: prev, pool: null };
    }
    const candidateAList = [];
    for (let i = 0; i < SCHEDULE2_CARD_COUNT; i++) {
      const prev = prevCandidateAList[i] || null;
      const fresh =
        result.genA && result.candidateAList ? result.candidateAList[i] : null;
      if (fresh) {
        const picked = pickCandidateASlot(
          prev,
          fresh,
          result.candidateAPools && result.candidateAPools[i],
        );
        candidateAList.push(picked.candidate);
        if (picked.pool !== null) candidateAPools[i] = picked.pool;
      } else {
        candidateAList.push(prev);
      }
    }
    if (result.genBC) {
      runtime.candidates = [result.candidateB, result.candidateC].filter(
        Boolean,
      );
      Object.keys(candidateHistory).forEach((k) => delete candidateHistory[k]);
      Object.keys(candidateUndoStack).forEach(
        (k) => delete candidateUndoStack[k],
      );
      Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
      runtime.candidates.forEach((cand, idx) => {
        candidateHistory[idx] = new Set([candidateSignature(cand)]);
        if (result.poolsBC && result.poolsBC[idx])
          candidatePools[idx] = result.poolsBC[idx];
      });
    }
    runtime.schedule3Result = { candidateAList };
    renderSchedule3Result();
    saveState();
    showToast("후보가 생성되었습니다", "success");
  } catch (err) {
    if (err instanceof GenerationCancelledError) {
      showToast("후보 생성을 취소했습니다", "info");
    } else {
      console.error(err);
      generateHint3El.textContent =
        "후보 생성 중 오류가 발생했습니다. 다시 시도해주세요.";
      showToast("후보 생성에 실패했습니다", "danger");
    }
  } finally {
    btnEl.disabled = false;
    btnEl.classList.remove("loading");
    labelEl.textContent = idleLabel;
    progressWrapEl.style.display = "none";
    cancelEl.style.display = "none";
    runtime.generationInProgress = false;
    runtime.generationCancelRequested = false;
    releaseWakeLock();
  }
}

generateBtnA3El.addEventListener("click", () =>
  runGenerate3({
    genA: true,
    genBC: false,
    idleLabel: "후보A 생성하기",
    btnEl: generateBtnA3El,
    labelEl: generateBtnA3LabelEl,
    cancelEl: generateBtnA3CancelEl,
    progressWrapEl: generateProgressWrapA3El,
    progressFillEl: generateProgressFillA3El,
    progressTextEl: generateProgressTextA3El,
  }),
);
generateBtnA3CancelEl.addEventListener("click", () => {
  runtime.generationCancelRequested = true;
  generateBtnA3CancelEl.disabled = true;
  generateBtnA3CancelEl.textContent = "취소하는 중...";
});

generateBtnBC3El.addEventListener("click", () =>
  runGenerate3({
    genA: false,
    genBC: true,
    idleLabel: "후보B·C 생성하기",
    btnEl: generateBtnBC3El,
    labelEl: generateBtnBC3LabelEl,
    cancelEl: generateBtnBC3CancelEl,
    progressWrapEl: generateProgressWrapBC3El,
    progressFillEl: generateProgressFillBC3El,
    progressTextEl: generateProgressTextBC3El,
  }),
);
generateBtnBC3CancelEl.addEventListener("click", () => {
  runtime.generationCancelRequested = true;
  generateBtnBC3CancelEl.disabled = true;
  generateBtnBC3CancelEl.textContent = "취소하는 중...";
});

export const candidateRulesBlock3El = document.getElementById(
  "candidateRulesBlock3",
);
export const candidateRulesToggle3El = document.getElementById(
  "candidateRulesToggle3",
);
candidateRulesToggle3El.addEventListener("click", () => {
  const collapsed = candidateRulesBlock3El.classList.toggle("collapsed");
  candidateRulesToggle3El.setAttribute("aria-expanded", String(!collapsed));
});
