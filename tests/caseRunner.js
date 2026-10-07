// 골든 데이터셋(tests/golden.js)과 퍼즈 테스트(tests/fuzz.js)가 공유하는 실행기: 케이스(앱
// state 형식)를 state/runtime에 싣고, 후보B·C(그리디)와 후보A-1~3(체인DP)을 실제 생성 진입점으로
// 만든 뒤, 표시 후보와 동점 배치 전부를 scheduleViolations로 검사한다.
"use strict";

// aScale: 후보A 시간 예산 축소 비율(chainDp.js의 TEST_BUDGET_SCALE 훅). 모듈을 불러오기 전에
// 정해야 하므로 lib 로드도 여기서 한다.
function createCaseRunner({ aScale = 0.01, realClock = false } = {}) {
  globalThis.__PT_TEST_BUDGET_SCALE__ = aScale;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  const lib = require("./loadLib.js");

  const toSlot = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h * 60 + m - 12 * 60) / 10; // START_MIN 12:00, SLOT_MIN 10
  };

  // 신청은 requests(앱 그대로) 또는 ranges([회원, 요일, 첫 시작, 마지막 시작, 지점?]), 근무 가능
  // 시간은 availableCells 또는 hours({요일: [시작, 끝)})로 받는다.
  function loadCase(c) {
    const { state, runtime } = lib;
    state.locations = c.locations;
    state.travelTimes = c.travelTimes;
    state.members = c.members;
    state.onceLimitedMemberIds3 = c.onceLimitedMemberIds3 || [];
    state.excludedMemberIds3 = c.excludedMemberIds3 || [];
    runtime.candidates = [];
    if (c.availableCells) runtime.availableCells = new Set(c.availableCells);
    else {
      runtime.availableCells = new Set();
      Object.entries(c.hours).forEach(([day, [from, to]]) => {
        for (let s = toSlot(from); s < toSlot(to); s++)
          runtime.availableCells.add(day + "-" + s);
      });
    }
    if (c.requests) state.requests = c.requests;
    else {
      state.requests = [];
      const byId = new Map(c.members.map((m) => [m.id, m]));
      c.ranges.forEach(([memberId, day, first, last, locId]) =>
        lib.addDesiredRange(
          byId.get(memberId),
          day,
          toSlot(first),
          toSlot(last),
          locId,
        ),
      );
      // addDesiredRange는 무작위 id를 붙인다 — 실행마다 결과가 같도록 순서대로 다시 매긴다.
      state.requests.forEach((r, i) => (r.id = "r" + i));
    }
  }

  const selection = (c) => [
    c.excludedMemberIds3 || [],
    c.onceLimitedMemberIds3 || [],
  ];

  // 후보A의 시간 예산은 performance.now() 기준이라 실제 시계로는 같은 입력도 실행마다 결과가
  // 달라진다. 기본은 호출마다 1ms씩 흐르는 가짜 시계로 바꿔 결과를 결정적으로(같은 입력 → 같은
  // 결과) 만든다 — 실패를 시드로 재현할 수 있어야 하기 때문이다.
  async function withClock(fn) {
    if (realClock) return fn();
    const realNow = performance.now;
    let fakeNow = 0;
    performance.now = () => (fakeNow += 1);
    try {
      return await fn();
    } finally {
      performance.now = realNow;
    }
  }

  // 반환: { B|C|A1|A2|A3: { result, pool, ms } }. withA면 후보A 안의 그리디 기준선은
  // aAttempts회(생략하면 attempts회)만 돈다. pins: 재최적화의 고정 세션(engine/pins.js).
  // aBudgetScale: 후보A 호출 단위 예산 배율(chainDp.groupBudgets, 생략하면 aScale 그대로).
  // withBC: false면 후보B·C를 만들지 않는다(같은 입력·고정이면 결과가 같아 측정에서 재사용할 때).
  async function generate(
    c,
    { attempts, withA, aAttempts = attempts, pins = [], aBudgetScale, withBC = true },
  ) {
    const out = {};
    let t = Date.now();
    if (withBC) {
      const bc = await lib.withSelectionOverride(...selection(c), () =>
        lib.generateCandidatesAsync(
          () => {},
          { workerCount: 0, attempts },
          pins,
        ),
      );
      const bcMs = Date.now() - t;
      out.B = { result: bc.built[0], pool: bc.pools[0], ms: bcMs };
      out.C = { result: bc.built[1], pool: bc.pools[1], ms: bcMs };
    }
    if (withA) {
      t = Date.now();
      const cards = await withClock(() =>
        lib.withSelectionOverride(...selection(c), () =>
          lib.generateSchedule2Async(() => {}, {
            greedyAttempts: aAttempts,
            pins,
            budgetScale: aBudgetScale,
          }),
        ),
      );
      const aMs = Date.now() - t;
      cards.forEach((card, i) => {
        out["A" + (i + 1)] = { result: card.result, pool: card.pool, ms: aMs };
      });
    }
    return out;
  }

  // 화면에 고를 수 있게 보여주는 동점 배치(pool)까지 모두 검사한다.
  // 반환: [{ key, tie, violation: {rule, message} }] — tie는 0이면 표시 후보, n이면 동점 배치 n번.
  // withSelectionOverride는 끝난 뒤 마이크로태스크에서 이전 값을 되돌리므로, 겹쳐 부르면 오래된
  // 선택이 남을 수 있다 — 동기 본문이라도 반드시 await한다.
  async function violationsOf(c, generated) {
    const out = [];
    await lib.withSelectionOverride(...selection(c), async () => {
      Object.entries(generated).forEach(([key, { result, pool }]) =>
        [result]
          .concat(pool || [])
          .forEach((r, tie) =>
            lib
              .scheduleViolations(r)
              .forEach((violation) => out.push({ key, tie, violation })),
          ),
      );
    });
    return out;
  }

  function metricsOf(c, result) {
    return lib.withSelectionOverride(...selection(c), async () =>
      lib.scheduleMetrics(result),
    );
  }

  return { lib, loadCase, generate, violationsOf, metricsOf };
}

module.exports = { createCaseRunner };
