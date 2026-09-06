// tests/unit.js가 esbuild로 이 파일 하나를 번들링해 Node에서 곧바로 요구(require)한다.
// 여기서 다시 내보내는 함수/값만 단위 테스트 대상이 된다 — 새 순수 함수를 테스트하고
// 싶으면 이 파일에 export를 추가하면 된다.
export { minutesLabel, slotLabel, endLabel, cellKey, durationToSlots } from "../../src/utils.js";
export { travelMinutes, pairKey } from "../../src/domain.js";
export { state } from "../../src/state.js";
export {
  mulberry32,
  shuffled,
  isSchedule2ResultBetter,
  floorIsBetter,
  schedule2Signature,
  runChainDP,
} from "../../src/engine/chainDp.js";
