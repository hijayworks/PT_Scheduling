// tests/unit.js가 esbuild로 이 파일 하나를 번들링해 Node에서 곧바로 요구(require)한다.
// 여기서 다시 내보내는 함수/값만 단위 테스트 대상이 된다 — 새 순수 함수를 테스트하고
// 싶으면 이 파일에 export를 추가하면 된다.
export { minutesLabel, slotLabel, endLabel, cellKey, durationToSlots } from "../../src/utils.js";
export {
  travelMinutes,
  pairKey,
  inefficientRoundTripLocationInfo,
  isInefficientRoundTrip,
  roundTripOriginLoc,
} from "../../src/domain.js";
export { state } from "../../src/state.js";
export {
  mulberry32,
  shuffled,
  isSchedule2ResultBetter,
  floorIsBetter,
  dropSessionsForBalance,
  schedule2Signature,
  runChainDP,
} from "../../src/engine/chainDp.js";
export { setIdleFirst } from "../../src/engine/chainDpCore.js";
export {
  candidateLocationsForRequest,
  greedyAssign,
  dailyInefficientMoveCount,
  totalInefficientMoveCount,
  candidateSearchScore,
  isCandidateWorse,
} from "../../src/engine/greedy.js";
export {
  parseBulkImportLine,
  hourMarkToStartSlot,
  addDesiredRange,
  mergeRequestRuns,
  removeRequestRun,
} from "../../src/pages/memberSchedule.js";

export {
  findEarlierRequestForLocation,
  moveNodeToRequest,
} from "../../src/engine/chainDpPolish.js";
export {
  migrateStartMinShift,
  clearRuntimeScheduleCandidates,
  runtime,
} from "../../src/state.js";
export { candidatePreservesConfirmed } from "../../src/schedule3.js";

export {
  validateBackupState,
  parseAndValidateBackupText,
} from "../../src/backup.js";
