// 후보A 다듬기 시도 하나(runSchedule2Pipeline, runPolish=true)를 메인 스레드 밖에서 실행하는
// Web Worker 진입점. scripts/build.js가 이 파일을 따로 번들링해 script.js 안에 문자열로 넣고,
// polishWorkerPool.js가 그 문자열로 Blob 워커를 띄운다(file:// 배포라 워커 파일을 URL로 못 읽음).
// 다듬기 시도끼리는 서로 독립이라(같은 입력·시드·예산이면 메인 스레드에서 돌린 것과 같은 계산),
// 여기서는 메인 스레드가 넘겨준 상태를 그대로 재현한 뒤 파이프라인만 돌려 결과를 돌려준다.
import { state } from "../state.js";
import { withSelectionOverride } from "../selectionOverride.js";
import { setIdleFirst } from "./chainDpCore.js";
import { runSchedule2Pipeline } from "./chainDpPolish.js";

let ctx = null;

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === "init") {
    Object.assign(state, msg.state);
    setIdleFirst(msg.idleFirst);
    ctx = msg;
    return;
  }
  if (msg.type !== "run") return;
  try {
    const result = await withSelectionOverride(
      ctx.excludedIds,
      ctx.onceLimitIds,
      () =>
        runSchedule2Pipeline(
          ctx.eligibleReqs,
          ctx.reqsByDay,
          ctx.daysWithReqs,
          msg.order,
          true,
          true,
          msg.budgetMs,
          msg.seedOffset,
        ),
    );
    // 회원 객체는 메인 스레드의 state.members 참조로 다시 바꿔야 하므로 id만 보낸다.
    self.postMessage({
      index: msg.index,
      assigned: result.assigned,
      unassignedMemberIds: result.unassignedMembers.map((m) => m.id),
    });
  } catch (err) {
    self.postMessage({
      index: msg.index,
      error: String((err && err.stack) || err),
    });
  }
};
