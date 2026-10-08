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
  memberById,
  knownLocationIdSet,
  maxSessionsFor,
  soloTravelMemberIds,
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
  generateSchedule2Async,
} from "../../src/engine/chainDp.js";
export { scheduleMetrics, scheduleViolations, HARD_RULES } from "../../src/engine/scheduleQuality.js";
export { setIdleFirst } from "../../src/engine/chainDpCore.js";
export {
  candidateLocationsForRequest,
  greedyAssign,
  dailyInefficientMoveCount,
  totalInefficientMoveCount,
  candidateSearchScore,
  isCandidateWorse,
  generateCandidatesAsync,
  buildGreedySearchPool,
  isEligibleRequest,
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
  runSchedule2Pipeline,
} from "../../src/engine/chainDpPolish.js";
export { runPolishAttemptsInWorkers } from "../../src/engine/polishWorkerPool.js";
export { withSelectionOverride } from "../../src/selectionOverride.js";
export {
  migrateStartMinShift,
  clearRuntimeScheduleCandidates,
  runtime,
  GenerationCancelledError,
} from "../../src/state.js";
export { candidatePreservesConfirmed } from "../../src/schedule3.js";

export {
  BACKUP_VERSION,
  BACKUP_PREFIX,
  BACKUP_PBKDF2_ITERATIONS,
  BACKUP_PASSWORD_MIN_LENGTH,
  RESTORE_RECOVERY_KEY,
  isValidBackupPassword,
  parseBackupEnvelope,
  validateBackupState,
  parseAndValidateBackupText,
  createPortableBackupState,
  prepareBackupStateForRestore,
  readRestoreRecoverySnapshot,
  restoreRecoverySnapshot,
} from "../../src/backup.js";
export {
  CURRENT_SCHEMA_VERSION,
  saveState,
} from "../../src/state.js";
