import { state } from "../state.js";
import { memberById } from "../domain.js";
import {
  currentExcludedIds2,
  currentOnceLimitIds2,
} from "../selectionOverride.js";
import { isIdleFirst } from "./chainDpCore.js";
import { checkGenerationCancelled } from "./greedy.js";

// 후보A 카드 하나의 다듬기 시도(chainDp.js의 attempts, 기본 48개)를 Web Worker 여러 개에
// 나눠 동시에 돌린다. 시도끼리는 서로 독립이고 시도마다 시간 예산(실측정 ms)이 따로 있어,
// 순서대로 돌리면 "시도 수 × 예산"만큼 기다려야 했다 — 워커 N개면 대기 시간이 약 1/N이 된다.
//
// 단, 시간 예산이 실측정 시간이라 워커끼리 CPU를 나눠 쓰면 시도 하나가 같은 시간 안에 하는
// 탐색량 자체가 줄어 품질이 떨어진다. 실측(Intel i5-8279U, 물리 4/논리 8코어, 고정 작업량):
// 워커 2개는 시도당 1.01배, 3개는 1.22배, 4개는 1.44배 느려졌다(터보 클럭 하락·하이퍼스레드
// 공유). 그래서 논리 코어 4개당 워커 1개만 쓴다 — 하이퍼스레딩 기기에선 물리 코어의 절반,
// 고성능/저전력 코어가 섞인 기기(Apple Silicon·모바일)에서도 고성능 코어 수 안에 들어가,
// 시도 하나가 받는 계산량은 순차 실행과 같게 유지된다.
//
// 알고리즘 튜닝값: 논리 코어 몇 개당 워커 1개를 쓸지, 그리고 워커 수 상한.
export const LOGICAL_CORES_PER_POLISH_WORKER = 4;
export const MAX_POLISH_WORKERS = 4;
const CANCEL_POLL_MS = 100;

export function defaultPolishWorkerCount(attemptCount) {
  const cores =
    (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 1;
  return Math.max(
    1,
    Math.min(
      attemptCount,
      MAX_POLISH_WORKERS,
      Math.floor(cores / LOGICAL_CORES_PER_POLISH_WORKER),
    ),
  );
}

// scripts/build.js가 engine/polishWorker.js 번들을 이 식별자에 문자열로 넣어준다(define).
// 단위 테스트 번들 등 정의되지 않은 빌드에서는 워커를 쓰지 않는다.
function blobWorkerFactory() {
  if (
    typeof Worker === "undefined" ||
    typeof __PT_POLISH_WORKER_SOURCE__ !== "string"
  )
    return null;
  const url = URL.createObjectURL(
    new Blob([__PT_POLISH_WORKER_SOURCE__], { type: "text/javascript" }),
  );
  return {
    create: () => new Worker(url),
    dispose: () => URL.revokeObjectURL(url),
  };
}

// attempts[i] = { order, seedOffset }. 반환값은 attempts와 같은 길이의 배열로, 워커가 끝낸
// 시도 자리에는 runSchedule2Pipeline과 같은 모양의 결과({assigned, unassignedMembers})가,
// 워커를 못 쓰거나 워커가 실패한 시도 자리에는 undefined가 들어 있다 — 호출하는 쪽이
// undefined 자리를 메인 스레드에서 직접 계산한다(워커는 속도용일 뿐 결과의 유일한 경로가
// 아니다). 결과는 항상 시도 번호 자리에 넣으므로, 끝나는 순서와 무관하게 순차 실행과 같은
// 순서로 비교된다. 취소(runtime.generationCancelRequested)되면 워커를 모두 끝내고
// GenerationCancelledError를 던진다.
// options.createWorker/workerCount는 테스트에서 가짜 워커를 넣기 위한 것이다.
export async function runPolishAttemptsInWorkers(
  base,
  attempts,
  budgetMs,
  onAttemptDone,
  options = {},
) {
  const results = new Array(attempts.length);
  const factory = options.createWorker
    ? { create: options.createWorker, dispose: () => {} }
    : blobWorkerFactory();
  const count =
    options.workerCount !== undefined
      ? options.workerCount
      : defaultPolishWorkerCount(attempts.length);
  if (!factory || count <= 0) {
    if (factory) factory.dispose();
    return results;
  }

  const workers = [];
  try {
    for (let k = 0; k < count; k++) workers.push(factory.create());
  } catch (err) {
    console.warn("다듬기 워커를 만들지 못해 메인 스레드에서 다듬습니다", err);
    workers.forEach((w) => w.terminate());
    factory.dispose();
    return results;
  }

  const init = {
    type: "init",
    state: {
      members: state.members,
      locations: state.locations,
      travelTimes: state.travelTimes,
      requests: state.requests,
    },
    excludedIds: (currentExcludedIds2() || []).slice(),
    onceLimitIds: (currentOnceLimitIds2() || []).slice(),
    idleFirst: isIdleFirst(),
    eligibleReqs: base.eligibleReqs,
    reqsByDay: base.reqsByDay,
    daysWithReqs: base.daysWithReqs,
  };

  try {
    await new Promise((resolve, reject) => {
      let next = 0;
      let running = workers.length;
      let settled = false;
      const poll = setInterval(() => {
        try {
          checkGenerationCancelled();
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
          if (reason) console.warn("다듬기 워커 실패 — 남은 시도는 메인 스레드에서 다듬습니다", reason);
          if (--running === 0) finish();
        }
        function runNext() {
          if (settled || next >= attempts.length) return stop();
          const index = next++;
          w.postMessage({
            type: "run",
            index,
            order: attempts[index].order,
            seedOffset: attempts[index].seedOffset,
            budgetMs,
          });
        }
        w.onmessage = (event) => {
          if (stopped) return;
          const msg = event.data;
          if (msg.error) return stop(msg.error);
          results[msg.index] = {
            assigned: msg.assigned,
            unassignedMembers: msg.unassignedMemberIds
              .map(memberById)
              .filter(Boolean),
          };
          if (onAttemptDone) onAttemptDone();
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
