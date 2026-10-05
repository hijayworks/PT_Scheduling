import { memberById } from "../domain.js";
import { isIdleFirst } from "./chainDpCore.js";
import { checkGenerationCancelled } from "./greedy.js";
import { engineWorkerInit, runTasksInWorkers } from "./workerPool.js";

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

// attempts[i] = { order, seedOffset }. 반환값은 attempts와 같은 길이의 배열로, 워커가 끝낸
// 시도 자리에는 runSchedule2Pipeline과 같은 모양의 결과({assigned, unassignedMembers})가,
// 워커를 못 쓰거나 워커가 실패한 시도 자리에는 undefined가 들어 있다 — 호출하는 쪽이
// undefined 자리를 메인 스레드에서 직접 계산한다(workerPool.js 참고).
// options.createWorker/workerCount는 테스트에서 가짜 워커를 넣기 위한 것이다.
export async function runPolishAttemptsInWorkers(
  base,
  attempts,
  budgetMs,
  onAttemptDone,
  options = {},
) {
  const raw = await runTasksInWorkers({
    init: engineWorkerInit("polish", {
      idleFirst: isIdleFirst(),
      eligibleReqs: base.eligibleReqs,
      reqsByDay: base.reqsByDay,
      daysWithReqs: base.daysWithReqs,
    }),
    taskCount: attempts.length,
    taskMessage: (i) => ({
      order: attempts[i].order,
      seedOffset: attempts[i].seedOffset,
      budgetMs,
    }),
    workerCount:
      options.workerCount !== undefined
        ? options.workerCount
        : defaultPolishWorkerCount(attempts.length),
    onTaskDone: onAttemptDone,
    checkCancelled: checkGenerationCancelled,
    label: "다듬기",
    createWorker: options.createWorker,
  });
  // 회원 객체는 메인 스레드의 state.members 참조로 되돌린다(워커는 id만 보낸다).
  return raw.map((r) =>
    r
      ? {
          assigned: r.assigned,
          unassignedMembers: r.unassignedMemberIds
            .map(memberById)
            .filter(Boolean),
        }
      : undefined,
  );
}
