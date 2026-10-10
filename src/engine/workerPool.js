import { state, runtime } from "../state.js";
import {
  currentExcludedIds2,
  currentOnceLimitIds2,
} from "../selectionOverride.js";

// 서로 독립인 계산 작업 여러 개를 엔진 Web Worker(engine/engineWorker.js) 여러 개에 나눠
// 돌리는 공용 실행기. 후보A 다듬기(polishWorkerPool.js)와 그리디 탐색(greedy.js의
// generateCandidatesAsync)이 같이 쓴다. 워커는 속도용일 뿐 결과의 유일한 경로가 아니다 —
// 워커를 못 쓰거나 워커가 실패한 작업 자리는 undefined로 남겨, 호출하는 쪽이 메인 스레드에서
// 직접 계산한다. 결과는 항상 작업 번호 자리에 넣으므로, 워커가 끝나는 순서는 최종 결과에
// 영향을 주지 않는다.
const CANCEL_POLL_MS = 100;

// 워커 실패·대체 경고의 공통 표식 — 스모크 테스트가 이 문구로 "조용한 대체"를 잡는다.
export const ENGINE_WORKER_WARNING = "[엔진 워커]";

// scripts/build.js가 engine/engineWorker.js 번들을 이 식별자에 문자열로 넣어준다(define).
// file://로 여는 배포라 워커 스크립트를 별도 파일 URL로 띄울 수 없어 Blob URL로 띄운다.
// 단위 테스트 번들 등 정의되지 않은 빌드에서는 워커를 쓰지 않는다.
function blobWorkerFactory() {
  if (
    typeof Worker === "undefined" ||
    typeof __PT_ENGINE_WORKER_SOURCE__ !== "string"
  )
    return null;
  const url = URL.createObjectURL(
    new Blob([__PT_ENGINE_WORKER_SOURCE__], { type: "text/javascript" }),
  );
  return {
    create: () => new Worker(url),
    dispose: () => URL.revokeObjectURL(url),
  };
}

// 워커가 메인 스레드와 같은 계산을 하도록 넘겨야 하는 공통 상태. kind별 입력은 extra로 더한다.
export function engineWorkerInit(kind, extra) {
  return Object.assign(
    {
      type: "init",
      kind,
      state: {
        members: state.members,
        locations: state.locations,
        travelTimes: state.travelTimes,
        requests: state.requests,
        noConsecutiveDayMemberIds: state.noConsecutiveDayMemberIds,
      },
      availableCells: Array.from(runtime.availableCells),
      excludedIds: (currentExcludedIds2() || []).slice(),
      onceLimitIds: (currentOnceLimitIds2() || []).slice(),
    },
    extra,
  );
}

// taskMessage(i)는 i번 작업의 입력 메시지(워커에는 { type: "run", index: i, ...입력 }으로 감)를
// 만든다 — 작업은 항상 번호 순서대로 나눠준다. 워커는 { index, result } 또는 { index, error }로
// 답한다. 반환값은 taskCount 길이 배열로, 끝난 자리에는 result, 못 끝낸 자리에는 undefined.
// checkCancelled가 던지면(취소) 워커를 모두 끝내고 그 에러를 그대로 던진다.
// createWorker는 테스트에서 가짜 워커를 넣기 위한 것이다.
export async function runTasksInWorkers({
  init,
  taskCount,
  taskMessage,
  workerCount,
  onTaskDone,
  checkCancelled,
  label,
  createWorker,
}) {
  const results = new Array(taskCount);
  const factory = createWorker
    ? { create: createWorker, dispose: () => {} }
    : blobWorkerFactory();
  if (!factory || workerCount <= 0 || taskCount === 0) {
    if (factory) factory.dispose();
    return results;
  }

  const workers = [];
  try {
    for (let k = 0; k < workerCount; k++) workers.push(factory.create());
  } catch (err) {
    console.warn(
      ENGINE_WORKER_WARNING + " " + label + " 워커를 만들지 못해 메인 스레드에서 계산합니다",
      err,
    );
    workers.forEach((w) => w.terminate());
    factory.dispose();
    return results;
  }

  try {
    await new Promise((resolve, reject) => {
      let next = 0;
      let running = workers.length;
      let settled = false;
      const poll = setInterval(() => {
        try {
          if (checkCancelled) checkCancelled();
        } catch (err) {
          finish(err);
        }
      }, CANCEL_POLL_MS);
      function finish(err) {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        if (err) reject(err);
        else resolve();
      }
      workers.forEach((w) => {
        let stopped = false;
        function stop(reason) {
          if (stopped) return;
          stopped = true;
          if (reason)
            console.warn(
              ENGINE_WORKER_WARNING + " " + label + " 워커 실패 — 남은 작업은 메인 스레드에서 계산합니다",
              reason,
            );
          if (--running === 0) finish();
        }
        function runNext() {
          if (settled || next >= taskCount) return stop();
          const index = next++;
          w.postMessage(Object.assign({ type: "run", index }, taskMessage(index)));
        }
        w.onmessage = (event) => {
          if (stopped) return;
          const msg = event.data;
          if (msg.error) return stop(msg.error);
          results[msg.index] = msg.result;
          if (onTaskDone) onTaskDone();
          runNext();
        };
        w.onerror = (event) => {
          if (event && event.preventDefault) event.preventDefault();
          stop((event && event.message) || "worker error");
        };
        w.postMessage(init);
        runNext();
      });
    });
  } finally {
    workers.forEach((w) => w.terminate());
    factory.dispose();
  }
  return results;
}
