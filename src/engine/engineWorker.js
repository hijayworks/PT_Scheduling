// 후보 생성 엔진의 Web Worker 진입점. scripts/build.js가 이 파일을 따로 번들링해 script.js
// 안에 문자열로 넣고, workerPool.js가 그 문자열로 Blob 워커를 띄운다(file:// 배포라 워커 파일을
// URL로 못 읽음). 작업 종류(kind):
//   - "polish": 후보A 다듬기 시도 하나(runSchedule2Pipeline, runPolish=true) — polishWorkerPool.js
//   - "greedy": 그리디 탐색 시도 하나(buildCandidateFromStrategy) — greedy.js의 generateCandidatesAsync
// 메인 스레드가 넘겨준 상태를 그대로 재현한 뒤 같은 함수를 돌리므로, 같은 입력이면 메인
// 스레드에서 돌린 것과 같은 결과가 나온다. 회원 객체는 메인 스레드의 state.members 참조로
// 되돌려야 하므로 id만 보낸다.
import { state, runtime } from "../state.js";
import { withSelectionOverride } from "../selectionOverride.js";
import { setIdleFirst } from "./chainDpCore.js";
import { runSchedule2Pipeline } from "./chainDpPolish.js";
import { buildCandidateFromStrategy, greedyAttemptInputs } from "./greedy.js";

let ctx = null;
// 그리디: 전략별 시도 입력 생성기와 마지막으로 만든 시도 번호. 시도 입력은 시드 난수에서
// 순서대로 나오므로, 받은 시도 번호까지 생성기를 따라가 메인 스레드와 같은 입력을 얻는다
// (작업은 번호 순서대로 나눠주므로 대개 앞으로만 간다 — 뒤로 가야 하면 처음부터 다시 만든다).
let greedyCursor = null;

function greedyInput(strategyIndex, attempt) {
  if (
    !greedyCursor ||
    greedyCursor.strategyIndex !== strategyIndex ||
    greedyCursor.attempt > attempt
  ) {
    greedyCursor = {
      strategyIndex,
      attempt: -1,
      input: null,
      gen: greedyAttemptInputs(strategyIndex, ctx.eligible, ctx.attempts),
    };
  }
  while (greedyCursor.attempt < attempt) {
    greedyCursor.input = greedyCursor.gen.next().value;
    greedyCursor.attempt++;
  }
  return greedyCursor.input;
}

const handlers = {
  async polish(msg) {
    const result = await runSchedule2Pipeline(
      ctx.eligibleReqs,
      ctx.reqsByDay,
      ctx.daysWithReqs,
      msg.order,
      true,
      true,
      msg.budgetMs,
      msg.seedOffset,
    );
    return {
      assigned: result.assigned,
      unassignedMemberIds: result.unassignedMembers.map((m) => m.id),
    };
  },
  async greedy(msg) {
    const input = greedyInput(msg.strategyIndex, msg.attempt);
    const cand = buildCandidateFromStrategy(
      msg.strategyIndex,
      ctx.eligible,
      ctx.eligibleIdSet,
      ctx.allMemberIdSet,
      input.jitter,
      [],
      input.dayOrder,
    );
    // 키 순서를 그대로 두려고 같은 자리의 값만 id로 바꾼다(메인 스레드가 되돌린다).
    cand.unassignedMembers = cand.unassignedMembers.map((m) => m.id);
    return cand;
  },
};

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === "init") {
    Object.assign(state, msg.state);
    runtime.availableCells = new Set(msg.availableCells);
    setIdleFirst(!!msg.idleFirst);
    ctx = msg;
    if (msg.kind === "greedy") {
      ctx.eligibleIdSet = new Set(msg.eligibleIds);
      ctx.allMemberIdSet = new Set(msg.allMemberIds);
    }
    greedyCursor = null;
    return;
  }
  if (msg.type !== "run") return;
  try {
    const result = await withSelectionOverride(
      ctx.excludedIds,
      ctx.onceLimitIds,
      () => handlers[ctx.kind](msg),
    );
    self.postMessage({ index: msg.index, result });
  } catch (err) {
    self.postMessage({
      index: msg.index,
      error: String((err && err.stack) || err),
    });
  }
};
