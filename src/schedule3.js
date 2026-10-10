import {
  BLOCK_COLOR,
  SLOT_MIN,
  MAX_SESSIONS_PER_MEMBER,
  MAX_TRAVELS_PER_DAY,
  DAYS,
} from "./constants.js";
import { durationToSlots, endLabel, slotLabel, showToast } from "./utils.js";
import {
  state,
  runtime,
  saveState,
  GenerationCancelledError,
  acquireWakeLock,
  releaseWakeLock,
  candidateInputKey,
  clearRuntimeScheduleCandidates,
} from "./state.js";
import {
  memberById,
  locationById,
  memberColor,
  travelMinutes,
  soloTravelMemberIds,
  breaksSoloTravel,
  memberDayViolation,
  unassignedMembersFor,
  isOnceLimitEligible,
  appendOnceLimitMemberLabel,
  compareOnceLimitMembers,
} from "./domain.js";
import { withSelectionOverride } from "./selectionOverride.js";
import { renderGrid } from "./grid.js";
import { saveCandidateCardAsImage } from "./imageExport.js";
import {
  renderCandidateCompare,
  renderReoptimizeProposal,
} from "./candidateCompare.js";
import {
  generateCandidatesAsync,
  candidatePools,
  candidateAPools,
  resetCandidateSession,
  MAX_POOL_VARIANTS,
  candidateLocationsForRequest,
  dayChainViolation,
  isWithinAvailability,
  totalTravelCount,
  totalInefficientMoveCount,
} from "./engine/greedy.js";
import {
  generateSchedule2Async,
  isSchedule2ResultBetter,
  schedule2Signature,
  SCHEDULE2_CARD_COUNT,
  IDLE_FIRST_CARD_INDEX,
  schedule2ToIdleBlocks,
  schedule2TotalIdleMinutes,
} from "./engine/chainDp.js";
import { setIdleFirst } from "./engine/chainDpCore.js";
import {
  scheduleMetrics,
  scheduleViolations,
  HARD_RULES,
} from "./engine/scheduleQuality.js";
import {
  selectCandidates,
  layoutSignature,
  qualityKey,
  formatTradeoff,
  selectReoptimization,
} from "./engine/candidateSelection.js";
import { pinKey, pinsFromResult } from "./engine/pins.js";
import { assignmentDiff } from "./engine/candidateDiff.js";
import {
  levelPlan,
  generateForLevel,
  proposalSource,
  originsFromHistory,
  createLocalSearch,
  nextLocalLevel,
  continueLocalSearch,
  addWiderProposal,
} from "./engine/localReoptimize.js";
import {
  renderRequestList,
  setActiveScheduleMemberId,
} from "./pages/memberSchedule.js";
import { businessHoursGridRange } from "./pages/settings.js";

// 후보 카드의 일정 하나를 확정한다: 확정한 후보는 수정 후보가 되어 재생성해도 덮어쓰지 않고(runGenerate3의
// keepsUserEditedSlot), 확정 일정을 고정한 채 나머지를 다시 짜는 것은 재최적화(runReoptimize3)다.
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
  const soloIds = soloTravelMemberIds();

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
    if (
      breaksSoloTravel(
        member.id,
        prevAssigned && prevAssigned.locationId,
        req.locationId,
        nextAssigned && nextAssigned.locationId,
        soloIds,
      )
    )
      return; // 이동-회원-이동 금지
    const otherDays = container.assigned
      .filter((a) => a.memberId === member.id && a.id !== req.id)
      .map((a) => a.day);
    if (memberDayViolation(member.id, req.day, otherDays)) return; // 1일 최대 1회·연속 요일 배정 제외
    if (otherDays.length >= maxSessionsFor3(member)) return; // 주간 최대 횟수(상담 회원·1회 제한 회원 포함)
    seenMemberIds.add(member.id);
    results.push(member);
  });
  results.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return results;
}

// 드래그 이동·자리 맞바꾸기·인원 교체·확정 등 "수동 편집" 하나를 취소할 수 있도록, 편집
// 직전의 assigned/unassignedMembers/confirmedIds 스냅샷을 후보 객체(container)별로 최대 20개까지 쌓아둔다.
// WeakMap을 써서 container 객체(저장 슬롯의 결과) 자체를 키로 삼으므로, 다시 생성해 그 자리의
// container 객체가 통째로 새로 만들어지면 자연스럽게 새 빈 되돌리기 이력에서 다시 시작한다.
// 저장하지 않으므로 새로고침하면 초기화된다. 스택 배열의 truncated(한도 때문에 가장 오래된 스냅샷을 버린 적
// 있음)와 스냅샷의 reoptApplied(재최적화 적용 직전 상태)는 원래 위치 판정(originsFromHistory)이 읽는 런타임 표시다.
export const manualUndoStacks = new WeakMap();
export const MANUAL_UNDO_LIMIT = 20;
export function snapshotContainer(container) {
  return {
    assigned: container.assigned.map((a) => ({ ...a })),
    unassignedMembers: (container.unassignedMembers || []).slice(),
    confirmedIds: (container.confirmedIds || []).slice(),
  };
}
export function pushManualUndo(container, mark) {
  if (!manualUndoStacks.has(container)) manualUndoStacks.set(container, []);
  const stack = manualUndoStacks.get(container);
  stack.push({ ...snapshotContainer(container), ...mark });
  if (stack.length > MANUAL_UNDO_LIMIT) {
    stack.shift();
    stack.truncated = true;
  }
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
  container.unassignedMembers = snapshot.unassignedMembers;
  container.confirmedIds = snapshot.confirmedIds;
  saveState();
  onDone();
  showToast("방금 편집을 되돌렸습니다", "info");
}

// 배정된 세션의 자리(요일·시작 시각·길이·지점)는 그대로 두고 사람만 newMember로 바꿔치기한다.
// moveSession/attemptSwap과 마찬가지로, 재생성해도 이 자리가 풀리지 않도록 새 회원의 신청
// id를 confirmedIds에 자동으로 넣는다(사람이 손댄 자리는 알고리즘이 건드리지 않는다는
// 원칙 — 세 "수동 편집" 함수 모두 같은 보호 수준을 준다). 사람이 바뀌므로 미배정 명단은 바뀐
// 배정 기준으로 다시 만든다(새 회원은 빠지고, 마지막 수업을 잃은 원래 회원은 들어간다).
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
  container.unassignedMembers = unassignedMembersFor(container.assigned);
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

// 수동 이동 하나의 회원 단위 검사: (1) 그 자리에 신청 이력이 있는지 → (2) 수업 전체(시작~종료)가
// 근무 가능 시간 안인지(자동 생성과 같은 isWithinAvailability — 근무 시간 밖 신청도 저장될 수 있다)
// → (3) 회원 요일 규칙(1일 최대 1회·연속 요일 배정 제외, memberDayViolation) → (4) 그 자리에서 지점을 그대로 쓸 수
// 있는지. ignoreIds의
// 배정은 "이미 자리를 비운 것"으로 친다(맞바꾸기에서 상대가 곧 비울 자리). 앞뒤 수업과의 간격 등
// 요일 체인 규칙은 여기서 보지 않고 editedDaysViolation이 최종 결과로 검사한다.
function planMove(container, req, targetDay, targetStartSlot, ignoreIds) {
  const ignoreSet = new Set([req.id, ...(ignoreIds || [])]);
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
  if (!isWithinAvailability(newReq)) {
    return {
      ok: false,
      message: "근무 가능 시간 밖이라 이 자리로 옮길 수 없습니다",
    };
  }
  const dayViolation = memberDayViolation(
    req.memberId,
    targetDay,
    container.assigned
      .filter((a) => !ignoreSet.has(a.id) && a.memberId === req.memberId)
      .map((a) => a.day),
  );
  if (dayViolation) {
    return {
      ok: false,
      message:
        dayViolation === "sameDay"
          ? "같은 요일에는 하루 최대 1회만 배정할 수 있습니다"
          : "연속 배정 제외 회원이라 연속된 요일에는 배정할 수 없습니다",
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
  return { ok: true, newReq, locationId };
}

const DAY_CHAIN_VIOLATION_MESSAGES = {
  gap: "수업 시간이 겹치거나 지점 간 이동 시간이 부족합니다",
  dailyTravel: `하루 이동이 최대 ${MAX_TRAVELS_PER_DAY}회를 넘습니다`,
  soloTravel: "세 지점 회원이 이동으로 앞뒤가 막힌 자리에 놓입니다",
};

// 수동 편집(removedIds 배정을 빼고 placed 배정을 넣음)을 적용한 최종 결과에서, 바뀐 요일마다
// 하루 체인 전체를 자동 생성과 같은 하드 제약(dayChainViolation)으로 검사한다. 옮긴 수업의 앞뒤만
// 보면 수업이 빠진 요일에서 새로 이어지는 수업(이동시간 부족, 이웃 세 지점 회원의 이동-회원-이동)
// 이나 같은 요일 맞바꾸기에서 두 자리가 함께 만드는 위반을 놓친다. 위반이 없으면 null, 있으면 메시지.
function editedDaysViolation(container, removedIds, placed) {
  const days = new Set(placed.map((p) => p.day));
  container.assigned.forEach((a) => {
    if (removedIds.includes(a.id)) days.add(a.day);
  });
  const soloIds = soloTravelMemberIds();
  for (const day of [...days].sort((x, y) => x - y)) {
    const chain = container.assigned
      .filter((a) => a.day === day && !removedIds.includes(a.id))
      .concat(placed.filter((p) => p.day === day))
      .map((a) => ({
        ...a,
        end: a.startSlot + durationToSlots(a.duration),
      }))
      .sort((x, y) => x.startSlot - y.startSlot);
    const violation = dayChainViolation(chain, soloIds);
    if (violation)
      return DAYS[day] + "요일: " + DAY_CHAIN_VIOLATION_MESSAGES[violation];
  }
  return null;
}

// 세션 하나를 (targetDay, targetStartSlot)으로 옮길 수 있는지 검사만 하고, 실제로 옮기지는
// 않는다 — 드래그 중 실시간 유효성 표시(canMoveOrSwapTo)와 실제 커밋(moveSession) 양쪽에서
// 똑같은 기준으로 재사용하기 위해 분리했다. 회원 단위 검사(planMove) 뒤, 출발 요일과 도착 요일의
// 최종 체인을 검사한다(editedDaysViolation).
export function validateMove(container, req, targetDay, targetStartSlot) {
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
        locationId: plan.locationId,
      },
    ],
  );
  return message ? { ok: false, message } : plan;
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
// req의 자리로 동시에 옮기는 것이므로 두 방향 모두 회원 단위 검사(planMove)를 통과하고, 두
// 이동을 함께 반영한 최종 체인이 하드 제약을 지켜야 한다. 서로 상대의 현재 자리는 "곧 비워질
// 자리"라 회원 단위 검사에서는 ignoreIds로 서로를 뺀다. 길이가 다르면 애초에 "맞바꾼다"는
// 개념이 어색해지므로(한쪽만 옮기면 남는 자리가 생김) 막는다.
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
  const checkA = planMove(container, req, occupying.day, occupying.startSlot, [
    occupying.id,
  ]);
  if (!checkA.ok) return { ok: false, message: checkA.message };
  const checkB = planMove(container, occupying, req.day, req.startSlot, [
    req.id,
  ]);
  if (!checkB.ok) return { ok: false, message: checkB.message };
  // 두 이동을 모두 반영한 최종 체인으로 한 번에 검사한다 — 같은 요일 맞바꾸기에서 각 이동을
  // 따로 보면 상대의 새 자리를 모른 채 판단하게 된다.
  const message = editedDaysViolation(
    container,
    [req.id, occupying.id],
    [
      {
        ...req,
        day: occupying.day,
        startSlot: occupying.startSlot,
        locationId: checkA.locationId,
      },
      {
        ...occupying,
        day: req.day,
        startSlot: req.startSlot,
        locationId: checkB.locationId,
      },
    ],
  );
  if (message) return { ok: false, message };
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
  if (pageId === "schedule3") dropStaleCandidates();
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

// "수업 스케줄 생성" 페이지의 연속 요일 배정 제외 회원. 미배정·1회 제한과 함께 선택해도 각 제한을
// 그대로 지키면 되므로 충돌 목록이 없다. 상담 회원(주 1회)에게는 영향이 없지만 구분이 바뀔 수 있어
// 모든 회원을 고를 수 있게 둔다(구분 변경으로 선택이 조용히 지워지지 않게).
export const noConsecutive3Widget = createMemberSelectionWidget({
  idsKey: "noConsecutiveDayMemberIds",
  eligibleFilter: () => true,
  emptyMembersMessage: "등록된 회원이 없습니다.",
  chipClass: "chip",
  elIds: {
    ms: "noConsecutiveMs",
    control: "noConsecutiveControl",
    chipRow: "noConsecutiveChipRow",
    dropdown: "noConsecutiveDropdown",
  },
  onChanged: onSchedule3SelectionChanged,
});

// 후보 생성 엔진(그리디 탐색 generateCandidatesAsync, 체인 DP 다듬기 generateSchedule2Async)을 이
// 페이지의 "미배정 회원"/"1회 제한 회원" 목록으로 차례로 호출한다 — 두 함수의 본문은 건드리지
// 않는다. withSelectionOverride는 동기 호출만 감싸는 게 원칙이지만, 이 두 함수는 내부에
// await(yieldToUI)가 있어 오버라이드가 그 사이에도 켜져 있다 — 그동안 생성 버튼이 다시 눌리지
// 않도록 runtime.generationInProgress 가드로 막는다.
// onProgress(진행률 0~1, 단계 이름): 앞 절반은 그리디 탐색("후보 탐색"), 뒤 절반은 체인 DP 다듬기
// ("비교·최적화")다. 사용자에게는 엔진 이름 대신 단계 이름만 보여준다.
// pins: 재최적화의 고정 세션(engine/pins.js) — 두 엔진 모두 그 자리를 그대로 두고 나머지만 짠다.
export async function generateSchedule3Async(onProgress, pins = []) {
  const excludedIds3 = state.excludedMemberIds3;
  const onceLimitIds3 = state.onceLimitedMemberIds3;
  const v1Built = await withSelectionOverride(excludedIds3, onceLimitIds3, () =>
    generateCandidatesAsync(
      (progress) => onProgress(progress * 0.5, "후보 탐색"),
      {},
      pins,
    ),
  );
  const v2Result = await withSelectionOverride(
    excludedIds3,
    onceLimitIds3,
    () =>
      generateSchedule2Async(
        (progress) => onProgress(0.5 + progress * 0.5, "비교·최적화"),
        { pins },
      ),
  );
  onProgress(1, "후보 정리");
  return {
    candidateB: v1Built.built[0] || null, // 그리디 전략 0(인원 최대)
    candidateC: v1Built.built[1] || null, // 그리디 전략 1(수업 횟수 최대)
    poolsBC: v1Built.pools, // strategyIndex -> 동점 풀
    candidateAList: v2Result.map((c) => c.result), // 체인 DP 탐색 그룹 3개
    candidateAPools: v2Result.map((c) => c.pool), // 그룹 인덱스 -> 동점 풀
  };
}

export const generateHint3El = document.getElementById("generateHint3");
export const candidates3El = document.getElementById("candidates3");
export const generateBtn3El = document.getElementById("generateBtn3");
export const generateBtn3LabelEl = document.getElementById("generateBtn3Label");
export const generateBtn3CancelEl =
  document.getElementById("generateBtn3Cancel");
export const generateProgressWrap3El = document.getElementById(
  "generateProgressWrap3",
);
export const generateProgressFill3El = document.getElementById(
  "generateProgressFill3",
);
export const generateProgressText3El = document.getElementById(
  "generateProgressText3",
);
export const GENERATE3_IDLE_LABEL = "수업 스케줄 후보 생성";

// 사용자가 옮기거나 맞바꾸거나 교체·확정한 결과인지(사람의 의도가 담겼는지). 수동 편집은 모두
// 손댄 자리를 confirmedIds에 넣으므로 이것 하나로 판단한다.
export function isUserEdited(result) {
  return (
    !!result &&
    Array.isArray(result.confirmedIds) &&
    result.confirmedIds.length > 0
  );
}

// 후보는 생성 당시 입력(schedule3Result.inputKey)과 현재 입력(candidateInputKey)이 같을 때만 유효하다.
// 다르면 사용자가 수정한 후보까지 모두 비운다 — 사람이 손댔다고 해서 더 이상 맞지 않는 스케줄을 남기지
// 않는다. inputKey가 없는 저장분(이 정책 이전 데이터)은 현재 입력 키를 기록하고, 입력이 같은 경우와
// 똑같이 후보마다 하드 제약을 다시 검사한다. 입력이 같아도 수동 편집 검사가 빠져 있던 시절의 저장분이
// 하드 제약을 어길 수 있으므로 dropInvalidCandidates로 위반 후보만 비운다. 비웠으면 true.
export function dropStaleCandidates() {
  const slots = runtime.schedule3Result.candidateAList
    .concat(runtime.candidates)
    .filter(Boolean);
  if (slots.length === 0) return false;
  // 미배정 명단은 배정에서 파생되는 값이라, 저장분이 어긋나 있으면 버리지 않고 다시 계산한다.
  const idKey = (list) =>
    list
      .map((m) => m.id)
      .sort()
      .join();
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
  if (saved === key || saved === undefined) {
    // 키가 없으면 생성 당시 입력을 알 수 없으니 현재 입력 기준으로 후보마다 다시 검사한다.
    runtime.schedule3Result.inputKey = key;
    if (dropInvalidCandidates()) return true;
    if (repaired || saved === undefined) saveState();
    return false;
  }
  clearRuntimeScheduleCandidates();
  resetCandidateSession();
  renderSchedule3Result();
  saveState();
  generateHint3El.textContent =
    "회원·신청·설정이 변경되어 기존 후보(내가 수정한 후보 포함)가 초기화되었습니다. 후보를 다시 생성해주세요.";
  return true;
}

// 현재 입력 기준으로 하드 제약(근무 가능 시간 등, scheduleViolations)을 어긴 후보만 비우고 알린다 —
// 정상 후보는 사용자가 수정·확정한 것도 그대로 둔다. 그 슬롯의 동점 풀도 함께 비운다(풀의 배치는
// 손대기 전 것이라 남겨두면 비운 카드가 다른 배치로 되살아난다). 비웠으면 true.
function dropInvalidCandidates() {
  const rules = new Set();
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
  const keptBC = runtime.candidates.filter((r) => !(r && isInvalid(r)));
  if (keptBC.length !== runtime.candidates.length) {
    dropped += runtime.candidates.length - keptBC.length;
    // 후보B·C 풀은 candidates 배열 위치를 따르므로, 위치가 당겨지면 함께 비운다(카드는 그대로 보인다).
    Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
    runtime.candidates = keptBC;
  }
  if (dropped === 0) return false;
  renderSchedule3Result();
  saveState();
  const reasons = [...rules].map((rule) => HARD_RULES[rule]).join(", ");
  // 입력 변경 무효화(dropStaleCandidates)와 구분되게, 입력은 그대로이고 위반 후보만 비웠다고 알린다.
  const kept =
    runtime.schedule3Result.candidateAList.some(Boolean) ||
    runtime.candidates.length > 0;
  generateHint3El.textContent = kept
    ? `저장된 후보 중 필수 조건(${reasons})을 어긴 후보 ${dropped}개만 초기화했습니다. ` +
      "나머지 후보(내가 수정한 후보 포함)는 그대로 두었습니다."
    : `저장된 후보가 모두 필수 조건(${reasons})을 어겨 초기화되었습니다. 후보를 다시 생성해주세요.`;
  showToast(`필수 조건을 어긴 후보 ${dropped}개를 초기화했습니다`, "error");
  return true;
}

// 다시 생성할 때 슬롯 하나에 둘 결과: 사용자가 손댄 이전 결과는 덮어쓰지 않고 그대로 지킨다.
// (입력이 바뀌었으면 runGenerate3가 먼저 dropStaleCandidates로 비우므로 여기까지 오지 않는다.)
export function keepsUserEditedSlot(prev) {
  return isUserEdited(prev);
}

// 저장된 후보 슬롯(candidateAList 3개 + candidates 2개)과 세션 한정 동점 풀을 후보 선정 정책
// (selectCandidates)의 입력으로 바꾼다. 슬롯 구조는 엔진별 저장 위치일 뿐 화면의 카드와는 무관하다.
// 사용자가 손댄 슬롯은 fixed로 넣고, 그 슬롯의 동점 풀(손대기 전 배치들)은 넣지 않는다.
// entry.slot.store(result): 그 배치를 원래 슬롯에 저장한다(보고 있는 배치를 편집할 수 있게).
export function candidatePoolEntries() {
  const slots = [];
  runtime.schedule3Result.candidateAList.forEach((result, i) =>
    slots.push({
      key: "A" + (i + 1),
      result,
      pool: candidateAPools[i],
      store: (r) => (runtime.schedule3Result.candidateAList[i] = r),
    }),
  );
  runtime.candidates.forEach((result, i) =>
    slots.push({
      key: i === 0 ? "B" : "C",
      result,
      pool: candidatePools[i],
      store: (r) => (runtime.candidates[i] = r),
    }),
  );
  const entries = [];
  slots.forEach((slot) => {
    if (!slot.result) return;
    const fixed = isUserEdited(slot.result);
    const layouts = [slot.result].concat(
      fixed ? [] : (slot.pool || []).filter((r) => r !== slot.result),
    );
    layouts.forEach((result, i) =>
      entries.push({
        key: i ? slot.key + "#" + i : slot.key,
        result,
        metrics: scheduleMetrics(result),
        fixed,
        slot,
      }),
    );
  });
  return entries;
}

// 카드마다 지금 보고 있는 배치(서명). 카드 키는 자동 카드면 품질 키, 수정 카드면 그 배치 서명.
// 세션 한정 — 새로고침하면 각 카드의 첫 배치부터 다시 보인다.
const shownVariantByCard = new Map();
// 추천안과 비교 중인 카드 키(세션 한정). 그 카드가 사라지면 비교 패널도 닫힌다.
let compareCardKey = null;
export const candidateCompare3El = document.getElementById("candidateCompare3");

const CARD_DESC = {
  recommended:
    "미배정 → 비효율 이동 → 수업·이동·빈 시간 균형(수업 1건 = 이동 1번 = 빈 시간 60분) 순으로 가장 나은 후보입니다.",
  edited:
    "직접 옮기거나 확정한 후보입니다. 다시 생성해도 유지되지만, 회원·신청·설정이 바뀌면 함께 초기화됩니다.",
};

// 후보 카드를 그린다. 카드는 저장된 후보 풀에서 매번 selectCandidates로 파생한다(역할·추천 여부·
// trade-off 문구는 저장하지 않는다).
export function renderSchedule3Result() {
  candidates3El.innerHTML = "";
  candidateCompare3El.hidden = true;
  candidateCompare3El.innerHTML = "";
  reoptimize3El.hidden = true;
  reoptimize3El.innerHTML = "";
  const gridRange = businessHoursGridRange();
  const { cards } = selectCandidates(candidatePoolEntries());

  if (cards.length === 0) {
    reoptSession = null;
    const card = document.createElement("div");
    card.className = "candidate-card candidate-card-placeholder";
    const hint = document.createElement("p");
    hint.className = "candidate-card-placeholder-hint";
    hint.textContent =
      "아직 후보가 없습니다. '" + GENERATE3_IDLE_LABEL + "'을 눌러주세요.";
    card.appendChild(hint);
    candidates3El.appendChild(card);
    return;
  }

  let promoted = false;
  const shown = new Map(); // 카드 키 → {card, entry}
  cards.forEach((c) => {
    const cardKey =
      c.role === "edited"
        ? "edited:" + layoutSignature(c.variants[0].result)
        : qualityKey(c.metrics);
    const shownSig = shownVariantByCard.get(cardKey);
    const idx = Math.max(
      0,
      c.variants.findIndex((v) => layoutSignature(v.result) === shownSig),
    );
    const entry = c.variants[idx];
    // 보고 있는 배치가 세션 한정 동점 풀에만 있으면 원래 슬롯에 저장한다 — 그래야 이 카드에서
    // 한 편집이 저장되고 새로고침 뒤에도 남는다(같은 슬롯의 배치는 모두 같은 품질이라 같은 카드다).
    if (entry.slot.result !== entry.result) {
      entry.slot.store(entry.result);
      entry.slot.result = entry.result;
      promoted = true;
    }
    shown.set(cardKey, { card: c, entry });
    buildCard(c, cardKey, entry.result, idx, (newIdx) => {
      shownVariantByCard.set(
        cardKey,
        layoutSignature(c.variants[newIdx].result),
      );
      renderSchedule3Result();
    });
  });
  if (promoted) saveState();
  renderReoptimizeProposal3(
    [...shown.values()]
      .filter((x) => x.card.role === "edited")
      .map((x) => x.entry.result),
  );
  const rec = [...shown.values()].find((x) => x.card.role === "recommended");
  const target = shown.get(compareCardKey);
  if (rec && target && target !== rec) {
    const side = ({ card, entry }) => ({
      label: card.label,
      result: entry.result,
      metrics: entry.metrics,
    });
    renderCandidateCompare(candidateCompare3El, side(rec), side(target), () => {
      compareCardKey = null;
      renderSchedule3Result();
    });
  }
  if (cards.filter((c) => c.role !== "edited").length === 1) {
    const note = document.createElement("p");
    note.className = "pool-pager-hint candidates-note";
    note.textContent = "장단점이 다른 후보가 없어 추천 후보만 보여줍니다.";
    candidates3El.appendChild(note);
  }

  function buildCard(c, cardKey, result, variantIdx, onSelectVariant) {
    const title = c.label;
    const desc =
      c.role === "recommended"
        ? CARD_DESC.recommended
        : c.role === "edited"
          ? CARD_DESC.edited +
            (c.deltas.length ? " 추천 대비 " + formatTradeoff(c.deltas) : "")
          : "추천 대비 " + formatTradeoff(c.deltas);
    const blocks = schedule2ToBlocks(result.assigned, {
      result,
      onDone: renderSchedule3Result,
    });
    const travelBlocks = schedule2ToTravelBlocks(
      result,
      renderSchedule3Result,
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
            block: "start",
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
    // 드래그 이동·자리 맞바꾸기·인원 교체·확정·재최적화 적용 등 "방금 한 조정 하나"만 되돌린다.
    const undoManualBtn = makeIconBtn(
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
      "편집 취소",
      "방금 드래그로 옮기거나 맞바꾸거나 교체·확정하거나 재최적화를 적용한 것을 취소합니다.",
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
      "이 후보 카드를 이미지로 저장합니다.",
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
      hint.textContent =
        "옮기거나 확정한 유지할 수업 " + keptCount + "개는 그대로 둡니다.";
      row.append(reoptBtn, hint);
      card.appendChild(row);
    }

    // 배치 페이저: 품질 지표가 같지만 회원·요일·지점 배정이 다른 배치(variant)를 넘겨 본다.
    if (c.variants.length > 1) {
      const pager = document.createElement("div");
      pager.className = "candidate-pool-pager";
      const pagerBtn = (label, points, disabled, newIdx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-ghost icon-btn pool-pager-btn";
        b.setAttribute("aria-label", label);
        b.title = "같은 품질의 다른 배치를 봅니다.";
        b.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="' +
          points +
          '"/></svg>';
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
          variantIdx - 1,
        ),
        label,
        pagerBtn(
          "다음 배치",
          "9 18 15 12 9 6",
          variantIdx === c.variants.length - 1,
          variantIdx + 1,
        ),
      );
      card.appendChild(pager);
      // 동점 풀은 저장하지 않는 세션 한정 기록이라 새로고침하면 줄어들 수 있다.
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
    pillIneff.className =
      ineffCount > 0 ? "stat-pill stat-pill-danger" : "stat-pill";
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
      rangeEndSlot: gridRange.rangeEndSlot,
    });

    if (result.unassignedMembers.length > 0) {
      const box = document.createElement("div");
      box.className = "unassigned-box unassigned-box-danger";
      const title = document.createElement("b");
      title.textContent =
        "미배정 회원 (" + result.unassignedMembers.length + "명)";
      box.append(
        title,
        " · ",
        result.unassignedMembers.map((m) => m.name).join(", "),
      );
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
      const title = document.createElement("b");
      title.textContent =
        "2회 배정 회원 (" + doubleAssignedMembers.length + "명)";
      box.append(
        title,
        " · ",
        doubleAssignedMembers
          .map((d) => d.locLabel + " " + d.member.name)
          .join(", "),
      );
      card.appendChild(box);
    }

    candidates3El.appendChild(card);
  }
}

// 생성·재최적화 공통 진행 표시. 취소 버튼은 runtime.generationCancelRequested를 켠다.
// 카드의 "나머지 일정 다시 최적화" 버튼은 그릴 때 generationInProgress를 읽으므로, 생성 중에 그려진
// 카드는 생성이 끝나도 비활성으로 남는다 — 진행 표시를 켜고 끌 때 함께 맞춘다.
function setCardReoptButtonsDisabled(disabled) {
  candidates3El
    .querySelectorAll(".reopt-btn")
    .forEach((b) => (b.disabled = disabled));
}
function startGenerationProgress(label, cancelLabel) {
  setCardReoptButtonsDisabled(true);
  generateBtn3El.disabled = true;
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
  generateProgressFill3El.className =
    "generate-progress-fill progress-pct-" + pct;
  generateProgressText3El.textContent = phase + " " + pct + "%";
  generateProgressWrap3El.setAttribute("aria-valuenow", String(pct));
}
function endGenerationProgress() {
  generateBtn3El.disabled = false;
  generateBtn3El.classList.remove("loading");
  generateBtn3LabelEl.textContent = GENERATE3_IDLE_LABEL;
  generateProgressWrap3El.hidden = true;
  generateBtn3CancelEl.hidden = true;
  runtime.generationInProgress = false;
  runtime.generationCancelRequested = false;
  setCardReoptButtonsDisabled(false);
  releaseWakeLock();
}

// 재최적화(5a·5b-2b) 세션 — 세션 한정, 저장하지 않는다. 적용하기 전까지 수정 카드(target)는 바꾸지 않는다.
// { run, target, targetSig, keptCount, userPins, originStatus, search(localReoptimize 국소 탐색 상태), proposals,
//   selected, widened, fullDone, localExhausted, notice }
//   run: 계측에서 한 재최적화 세션의 Level 실행·적용·버리기를 묶는 번호. widened: "더 넓게 찾아보기"를 누른 횟수.
//   proposals: [{ level, variants, variantIdx }] — 첫 번째가 처음 찾은 제안(국소면 "변경 최소화 제안"), 뒤는
//   "더 넓게 찾아보기"·전체 탐색으로 찾은, 앞보다 엄격히 나은 제안(addWiderProposal). 자동으로 덮어쓰지 않는다.
//   localExhausted: L1~L3가 모두 개선을 못 찾았다(전체 재최적화는 사용자가 고를 때만 돈다).
// target이 화면에서 사라지거나(무효화·초기화) 계산 뒤에 바뀌었으면(편집·되돌리기) 세션은 버린다.
export const reoptimize3El = document.getElementById("reoptimize3");
let reoptSession = null;
let reoptRunSeq = 0;
const editStateSig = (r) =>
  layoutSignature(r) + "#" + (r.confirmedIds || []).slice().sort().join(",");
// UI 표현값: Level별 범위 설명.
const LEVEL_LABELS = {
  L1: "고정한 수업 바로 앞뒤",
  L2: "고정한 요일 전체",
  L3: "관련 회원의 다른 요일까지",
  full: "전체 일정",
};
// 계측(5b-2b): 세션 한정 메모리(runtime.reoptimizeLog)와 console.info에만 남긴다 — 저장 schema는 바꾸지 않는다.
//   event "level": run·mode(first|widen)·level·실제 경과 ms·budgetScale·status·reason·source(엔진/단계)·
//     changedMembers/changedSessions(제안이 지금 카드 대비 바꾼 회원·세션 수)·originStatus(ORIGIN_STATUS)·originCount
//   event "abort": run·mode·reason(cancelled|stale|error) — Level 도중 중단
//   event "apply" / "discard": run·적용한 제안 level·kind(local|full)·proposalIndex·proposalLevels·widened
const REOPT_LOG_LIMIT = 50;
function logReoptimize(entry) {
  runtime.reoptimizeLog.push(entry);
  if (runtime.reoptimizeLog.length > REOPT_LOG_LIMIT)
    runtime.reoptimizeLog.shift();
  console.info("[재최적화]", JSON.stringify(entry));
}

function renderReoptimizeProposal3(editedResults) {
  const s = reoptSession;
  if (!s) return;
  if (
    !editedResults.includes(s.target) ||
    editStateSig(s.target) !== s.targetSig
  ) {
    reoptSession = null;
    return;
  }
  const next = nextLocalLevel(s.search);
  const side = (result) => ({ result, metrics: scheduleMetrics(result) });
  renderReoptimizeProposal(reoptimize3El, {
    current: side(s.target),
    keptCount: s.keptCount,
    proposals: s.proposals.map((p, i) => ({
      label:
        i === 0
          ? p.level === "full"
            ? "전체 일정 탐색 결과"
            : "변경 최소화 제안"
          : "더 넓은 탐색 결과",
      scope: LEVEL_LABELS[p.level],
      local: p.level !== "full",
      ...p.variants[p.variantIdx],
      variantIdx: p.variantIdx,
      variantCount: p.variants.length,
    })),
    selected: s.selected,
    notice:
      s.localExhausted && !s.proposals.length
        ? REOPT_LOCAL_EXHAUSTED
        : s.notice,
    // 다음 단계: 남은 국소 Level이 있으면 "더 넓게 찾아보기", 없으면 전체 탐색(이미 했으면 없음).
    widen: next
      ? {
          label: "더 넓게 찾아보기",
          scope: LEVEL_LABELS[next],
          hint: "다음 범위: " + LEVEL_LABELS[next],
        }
      : s.fullDone
        ? null
        : {
            label: "전체 일정 다시 탐색",
            scope: LEVEL_LABELS.full,
            hint: "전체 일정을 다시 짭니다. 시간이 오래 걸릴 수 있습니다.",
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
        widened: s.widened,
      });
      reoptSession = null;
      renderSchedule3Result();
      showToast("재최적화 제안을 버렸습니다", "info");
    },
    onWiden: () => runReoptimizeStep(s, "widen"),
  });
  // 더 넓게 찾는 동안에는 지금 제안을 적용·버리기·다시 넓히기 할 수 없다(취소는 진행 표시의 버튼으로).
  if (runtime.generationInProgress)
    reoptimize3El.querySelectorAll("button").forEach((b) => (b.disabled = true));
}

// 제안을 반영한 수정 카드 내용. 확정(confirmedIds)은 사용자가 고정한 수업만 그대로 남긴다 — 국소 탐색의
// 임시 고정(범위 밖 기존 세션)은 확정이 아니다.
export function reoptimizedCard(target, chosen) {
  const pinned = new Set(pinsFromResult(target).map(pinKey));
  const assigned = chosen.assigned.map((a) => ({ ...a }));
  return {
    assigned,
    unassignedMembers: chosen.unassignedMembers.slice(),
    confirmedIds: assigned.filter((a) => pinned.has(pinKey(a))).map((a) => a.id),
  };
}

// 제안을 수정 카드에 반영한다: 이전 상태를 수동 편집 되돌리기 스택에 넣어 기존 "편집 취소"로 원복할 수 있다.
// 적용 표시(reoptApplied): 원래 위치 판정은 이 적용 이후의 편집만 본다(엔진이 옮긴 자리·이미 반영된 원점은 원점이
// 아님). 편집 취소로 이 스냅샷을 꺼내면 표시도 함께 사라져 적용 전 기록을 다시 쓴다.
export function applyReoptimizedCard(target, chosen) {
  pushManualUndo(target, { reoptApplied: true });
  Object.assign(target, reoptimizedCard(target, chosen));
}

// 고른 제안을 수정 카드에 반영한다.
export function applyReoptimization() {
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
    widened: s.widened,
  });
  applyReoptimizedCard(s.target, p.variants[p.variantIdx].result);
  reoptSession = null;
  saveState();
  renderSchedule3Result();
  showToast(
    "재최적화 제안을 적용했습니다. 편집 취소로 되돌릴 수 있습니다.",
    "success",
  );
}

const REOPT_NO_BETTER = {
  "fewer-sessions":
    "수업 수를 줄이지 않고는 지금보다 나은 배치를 찾지 못했습니다. 지금 카드를 그대로 둡니다.",
  default: "지금보다 나은 배치를 찾지 못했습니다. 지금 카드를 그대로 둡니다.",
};
const REOPT_LOCAL_EXHAUSTED =
  "변경 범위를 제한한 탐색에서는 더 나은 일정을 찾지 못했습니다.";

// 수정 카드(target)의 옮기거나 확정한 수업(pinsFromResult)은 그대로 두고, 그 주변부터 범위를 넓혀 가며(L1→L2→L3)
// 다시 짜서 처음 찾은 개선안을 "변경 최소화 제안"으로 보여준다. 다른 후보 슬롯과 target은 바꾸지 않는다.
export async function runReoptimize3(target) {
  if (runtime.generationInProgress) {
    showToast("후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.", "info");
    return;
  }
  if (dropStaleCandidates()) return;
  const userPins = pinsFromResult(target);
  const sel = [state.excludedMemberIds3, state.onceLimitedMemberIds3];
  const violations = await withSelectionOverride(...sel, () =>
    scheduleViolations(target),
  );
  if (userPins.length === 0 || violations.length) {
    generateHint3El.textContent = violations.length
      ? "이 카드에 규칙 위반이 있어 다시 최적화할 수 없습니다: " +
        violations[0].message
      : "유지할 수업이 없어 다시 최적화할 수 없습니다.";
    return;
  }
  const { origins, status: originStatus } = originsFromHistory(
    target,
    userPins,
    manualUndoStacks.get(target),
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
    notice: null,
  };
  await runReoptimizeStep(reoptSession, "first");
}

// 재최적화 한 단계. mode: "first"(L1부터 처음 개선까지) | "widen"(다음 국소 Level 하나, 남은 게 없으면 전체).
// 취소하면 이후 Level을 돌리지 않고 지금까지의 제안을 그대로 둔다(첫 단계면 세션을 버림). 엔진 오류는 다음 범위나
// 전체로 조용히 넘어가지 않고 오류로 알린다.
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
    block: "center",
  });
  await acquireWakeLock();
  const stale = () =>
    candidateInputKey() !== inputKey || editStateSig(s.target) !== s.targetSig;
  // 한 Level 생성 + 제안 선택 + 계측. 입력이나 카드가 바뀌었으면 그 뒤 Level은 돌리지 않는다.
  const reoptimize = async (pins, level) => {
    const plan = levelPlan(level);
    const phase = LEVEL_LABELS[level] + " 범위";
    const t0 = performance.now();
    const gen = await generateForLevel(level, pins, {
      bc: async (p) => {
        const bc = await withSelectionOverride(...sel, () =>
          generateCandidatesAsync(
            (progress) => showGenerationProgress(progress * 0.5, "후보 탐색"),
            {},
            p,
          ),
        );
        return bc.built.concat(bc.pools.flat()).filter(Boolean);
      },
      a: async (p, budgetScale) => {
        const cards = await withSelectionOverride(...sel, () =>
          generateSchedule2Async(
            (progress) =>
              plan.withBC
                ? showGenerationProgress(0.5 + progress * 0.5, "비교·최적화")
                : showGenerationProgress(progress, phase),
            { pins: p, budgetScale },
          ),
        );
        return cards.flatMap((c) => [c.result].concat(c.pool || []));
      },
    });
    if (stale()) throw new ReoptimizeStaleError();
    const out = await withSelectionOverride(...sel, () =>
      selectReoptimization(s.target, gen.bc.concat(gen.a), pins),
    );
    const changed = out.proposal
      ? assignmentDiff(s.target, out.proposal.result).counts
      : null;
    logReoptimize({
      event: "level",
      run: s.run,
      mode,
      level,
      ms: Math.round(performance.now() - t0),
      budgetScale: plan.budgetScale === undefined ? 1 : plan.budgetScale,
      status: out.status,
      reason: out.reason,
      source: out.proposal ? proposalSource(out.proposal.result, gen) : null,
      changedMembers: changed && changed.changedMembers,
      changedSessions: changed && changed.changedSessions,
      originStatus: s.originStatus,
      originCount: s.search.origins.length,
    });
    return out;
  };
  const entryOf = (level, out) => ({ level, variants: out.variants, variantIdx: 0 });
  try {
    if (mode === "first") {
      const found = await continueLocalSearch(
        s.search,
        reoptimize,
        (out) => out.status === "improved",
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
      const found = local
        ? await continueLocalSearch(s.search, reoptimize, () => true)
        : { level: "full", outcome: await reoptimize(s.userPins, "full") };
      if (!local) s.fullDone = true;
      const added =
        found &&
        found.outcome.status === "improved" &&
        addWiderProposal(s.proposals, entryOf(found.level, found.outcome));
      if (added) {
        s.localExhausted = false;
        showToast(
          s.proposals.length > 1
            ? "더 넓게 찾은 결과를 비교해 고를 수 있습니다"
            : "재최적화 제안을 확인해주세요",
          "success",
        );
      } else if (!s.proposals.length && s.fullDone) {
        // 국소도 전체도 지금 카드보다 나은 결과가 없다.
        generateHint3El.textContent =
          REOPT_NO_BETTER[found.outcome.reason] || REOPT_NO_BETTER.default;
        reoptSession = null;
        showToast("더 나은 배치를 찾지 못했습니다", "info");
      } else {
        s.notice =
          LEVEL_LABELS[found.level] +
          " 범위까지 넓혀도 더 나은 결과를 찾지 못했습니다.";
        showToast("더 나은 결과를 찾지 못했습니다", "info");
      }
    }
  } catch (err) {
    logReoptimize({
      event: "abort",
      run: s.run,
      mode,
      reason:
        err instanceof GenerationCancelledError
          ? "cancelled"
          : err instanceof ReoptimizeStaleError
            ? "stale"
            : "error",
    });
    if (err instanceof GenerationCancelledError) {
      if (!s.proposals.length && !s.localExhausted) reoptSession = null;
      showToast("다시 최적화를 취소했습니다", "info");
    } else if (err instanceof ReoptimizeStaleError) {
      reoptSession = null;
      if (candidateInputKey() !== inputKey) dropStaleCandidates();
      else
        generateHint3El.textContent =
          "다시 최적화하는 동안 카드가 바뀌어 결과를 버렸습니다. 다시 시도해주세요.";
    } else {
      console.error(err);
      if (!s.proposals.length && !s.localExhausted) reoptSession = null;
      generateHint3El.textContent =
        "다시 최적화 중 오류가 발생했습니다. 다시 시도해주세요.";
      showToast("다시 최적화에 실패했습니다", "danger");
    }
  } finally {
    endGenerationProgress();
    renderSchedule3Result();
    if (!reoptimize3El.hidden)
      reoptimize3El.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
// 재최적화 도중 입력이나 수정 카드가 바뀌었음 — 이후 Level을 돌리지 않고 결과를 버린다.
class ReoptimizeStaleError extends Error {}

// 후보 생성: 그리디 탐색과 체인 DP 다듬기를 모두 돌려 저장 슬롯(후보 풀)을 새로 채운다. 사용자가
// 손댄 슬롯(keepsUserEditedSlot)은 덮어쓰지 않는다. 체인 DP 슬롯은 다듬기가 시간 예산제라 매번
// 미세하게 달라지므로, 새 결과가 이전 결과보다 못하면 이전 결과를 지킨다(데이터가 그대로일 때 다시
// 생성해도 나빠지지 않게).
export async function runGenerate3() {
  if (runtime.generationInProgress) {
    showToast("후보 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.", "info");
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
  dropStaleCandidates();
  generateHint3El.textContent = "";
  runtime.generationInProgress = true;
  runtime.generationCancelRequested = false;
  const inputKey = candidateInputKey();

  const prevCandidateAList = runtime.schedule3Result.candidateAList;
  const prevCandidates = runtime.candidates;

  startGenerationProgress("후보 생성 중...", "생성 취소");

  await acquireWakeLock();
  try {
    const result = await generateSchedule3Async(showGenerationProgress);
    // 체인 DP 슬롯 하나(prev/fresh)를 비교해 채택할 결과와 그 풀을 정한다: 새 결과가 실제로 더
    // 나으면 새 결과·새 풀을 채택하고, 완전 동점이면 새 풀을 쓰되 prev와 서명이 같은 자리를 prev
    // 참조로 바꿔 넣는다(prev가 풀에 없으면 앞에 추가). 새 결과가 더 못하면 기존 결과·풀을
    // 지킨다(pool: null은 "풀을 건드리지 않는다"는 신호).
    function pickCandidateASlot(prev, freshResult, freshPool) {
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
        const tiedPool = pool.map((c) =>
          schedule2Signature(c) === prevSig ? prev : c,
        );
        if (!tiedPool.includes(prev)) {
          tiedPool.unshift(prev);
          if (tiedPool.length > MAX_POOL_VARIANTS)
            tiedPool.length = MAX_POOL_VARIANTS;
        }
        return { candidate: prev, pool: tiedPool };
      }
      return { candidate: prev, pool: null };
    }
    const candidateAList = [];
    for (let i = 0; i < SCHEDULE2_CARD_COUNT; i++) {
      const prev = prevCandidateAList[i] || null;
      const fresh = result.candidateAList[i] || null;
      if (!fresh || keepsUserEditedSlot(prev)) {
        candidateAList.push(prev);
        continue;
      }
      // 빈 시간 최소화 탐색 그룹은 그 기준으로 이전 결과와 비교한다.
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
    // 기존 저장 형식 그대로: candidates는 [그리디 전략 0, 전략 1] 순서(빈 슬롯은 빼고), 풀도 같은 위치.
    // 사용자가 손댄 슬롯은 선정에 동점 풀을 쓰지 않으므로 풀을 두지 않는다.
    const keptBC = slotsBC.filter((s) => s.candidate);
    Object.keys(candidatePools).forEach((k) => delete candidatePools[k]);
    keptBC.forEach((s, idx) => {
      if (s.pool) candidatePools[idx] = s.pool;
    });
    runtime.candidates = keptBC.map((s) => s.candidate);
    runtime.schedule3Result = { candidateAList, inputKey };
    // 생성하는 동안 입력이 바뀌었으면 방금 결과도 맞지 않는다.
    if (dropStaleCandidates()) return;
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
    endGenerationProgress();
  }
}

generateBtn3El.addEventListener("click", () => runGenerate3());
generateBtn3CancelEl.addEventListener("click", () => {
  runtime.generationCancelRequested = true;
  generateBtn3CancelEl.disabled = true;
  generateBtn3CancelEl.textContent = "취소하는 중...";
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
