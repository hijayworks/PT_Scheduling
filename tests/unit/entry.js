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
  chainBreaksSoloTravel,
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
  groupBudgets,
  PER_GROUP_SEARCH_DEADLINE_MS,
  TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS,
  TARGET_MATCH_ALT_BASE_BUDGET_MS,
  PER_GROUP_TOTAL_POLISH_BUDGET_MS,
  MIN_POLISH_BUDGET_MS,
} from "../../src/engine/chainDp.js";
export { scheduleMetrics, scheduleViolations, HARD_RULES } from "../../src/engine/scheduleQuality.js";
export {
  QUALITY_AXES,
  layoutSignature,
  qualityKey,
  placementChanges,
  dominates,
  formatTradeoff,
  selectCandidates,
  selectReoptimization,
  keepsSessions,
  revertUnneededChanges,
  byTravelThenSignature,
  MAX_CARD_VARIANTS,
  pickVariants,
} from "../../src/engine/candidateSelection.js";
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
  candidateInputKey,
  loadState,
  runtime,
  GenerationCancelledError,
} from "../../src/state.js";
export {
  isUserEdited,
  keepsUserEditedSlot,
  candidatePoolEntries,
  dropStaleCandidates,
  validateMove,
  prepareSwap,
  reoptimizedCard,
  applyReoptimizedCard,
  moveSession,
  confirmSession,
  unconfirmSession,
  undoManualEdit,
  manualUndoStacks,
  MANUAL_UNDO_LIMIT,
} from "../../src/schedule3.js";
export { candidateAPools, candidatePools } from "../../src/engine/greedy.js";
export {
  metricDiff,
  assignmentDiff,
  summarizeMetricDiff,
  COMPARE_METRICS,
} from "../../src/engine/candidateDiff.js";

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
export { pinKey, pinsFromResult, missingPins } from "../../src/engine/pins.js";
export {
  IMPACT_LEVELS,
  impactRegion,
  runImpactLevels,
  LOCAL_LEVELS,
  LOCAL_REOPTIMIZE_BUDGET_SCALE,
  levelPlan,
  generateForLevel,
  proposalSource,
  originsFromHistory,
  ORIGIN_STATUS,
  createLocalSearch,
  nextLocalLevel,
  continueLocalSearch,
  addWiderProposal,
} from "../../src/engine/localReoptimize.js";
