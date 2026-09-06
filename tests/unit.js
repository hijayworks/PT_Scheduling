#!/usr/bin/env node
// src/ 안의 순수 로직(유틸·도메인 계산·후보A 체인DP 알고리즘)에 대한 빠른 단위 테스트.
// 브라우저를 통째로 띄우는 tests/smoke.js와 달리, esbuild로 tests/unit/entry.js 하나만
// Node용(CJS)으로 번들링해 그 자리에서 바로 실행한다 — 수 초가 아니라 수십 ms 안에 끝난다.
//
// src 모듈들은 브라우저에서 돌아가는 걸 전제하므로(예: state.js 최상단의
// document.addEventListener), 임포트 시점에 필요한 최소한의 전역만 흉내 낸다. 실제로
// 호출하는 함수(runChainDP 등)는 DOM을 전혀 건드리지 않으므로 이 정도 흉내로 충분하다.
"use strict";

const path = require("path");
const Module = require("module");
const esbuild = require("esbuild");

globalThis.document = globalThis.document || {
  addEventListener() {},
  hidden: false,
};
globalThis.window = globalThis.window || globalThis;
// navigator·performance는 Node 22부터 이미 전역으로 존재해(단, wakeLock 등은 없음) 여기서
// 굳이 덮어쓰지 않는다 — 다시 대입하면 getter 전용이라 TypeError가 난다. 테스트 대상
// 함수들은 애초에 navigator를 쓰지 않는다.
globalThis.localStorage = globalThis.localStorage || {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

const ENTRY = path.join(__dirname, "unit", "entry.js");
const built = esbuild.buildSync({
  entryPoints: [ENTRY],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const mod = new Module(ENTRY);
mod.filename = ENTRY;
mod.paths = Module._nodeModulePaths(path.dirname(ENTRY));
mod._compile(built.outputFiles[0].text, ENTRY);
const lib = mod.exports;

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (err) {
    fail++;
    console.error("FAIL: " + name);
    console.error("  " + (err && err.stack ? err.stack : err));
  }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error((msg ? msg + " — " : "") + "expected " + e + ", got " + a);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

/* ---------------- utils.js ---------------- */
test("minutesLabel: 절대 분을 HH:MM으로 변환", () => {
  assertEqual(lib.minutesLabel(0), "00:00");
  assertEqual(lib.minutesLabel(75), "01:15");
});
test("cellKey/durationToSlots", () => {
  assertEqual(lib.cellKey(2, 5), "2-5");
  assertEqual(lib.durationToSlots(60), 6); // SLOT_MIN=10
});
test("slotLabel/endLabel: START_MIN(12:00) 기준으로 계산", () => {
  assertEqual(lib.slotLabel(0), "12:00");
  assertEqual(lib.endLabel(0, 30), "12:30");
});

/* ---------------- domain.js ---------------- */
test("pairKey: 인자 순서와 무관하게 같은 키", () => {
  assertEqual(lib.pairKey("a", "b"), lib.pairKey("b", "a"));
});
test("travelMinutes: 같은 지점/기록 없음은 0, 등록된 값은 순서 무관", () => {
  lib.state.travelTimes = {};
  assertEqual(lib.travelMinutes("L1", "L1"), 0);
  assertEqual(lib.travelMinutes("L1", "L2"), 0); // 기록 없음
  lib.state.travelTimes[lib.pairKey("L1", "L2")] = 15;
  assertEqual(lib.travelMinutes("L1", "L2"), 15);
  assertEqual(lib.travelMinutes("L2", "L1"), 15);
});

/* ---------------- chainDp.js: 순수 비교/유틸 함수 ---------------- */
test("mulberry32: 같은 시드는 항상 같은 수열, 다른 시드는 다른 수열", () => {
  const seq = (seed) => {
    const rnd = lib.mulberry32(seed);
    return [rnd(), rnd(), rnd()];
  };
  assertEqual(seq(42), seq(42));
  assert(JSON.stringify(seq(1)) !== JSON.stringify(seq(2)));
});
test("shuffled: 원본을 바꾸지 않고 같은 원소 집합을 반환", () => {
  const original = [1, 2, 3, 4, 5];
  const result = lib.shuffled(original, lib.mulberry32(7));
  assertEqual(original, [1, 2, 3, 4, 5]);
  assertEqual(
    result.slice().sort(),
    original.slice().sort(),
  );
});
function scheduleResult(assigned, unassignedCount) {
  return { assigned, unassignedMembers: new Array(unassignedCount).fill("m") };
}
test("isSchedule2ResultBetter: 미배정이 적은 쪽이 항상 우선", () => {
  const fewerUnassigned = scheduleResult([], 0);
  const moreSessionsButUnassigned = scheduleResult(
    [{ day: 0, startSlot: 0, locationId: "L1" }],
    1,
  );
  assert(lib.isSchedule2ResultBetter(fewerUnassigned, moreSessionsButUnassigned));
  assert(!lib.isSchedule2ResultBetter(moreSessionsButUnassigned, fewerUnassigned));
});
test("isSchedule2ResultBetter: 미배정이 같으면 수업 수가 많은 쪽이 우선", () => {
  const more = scheduleResult([{ day: 0, startSlot: 0, locationId: "L1" }], 0);
  const fewer = scheduleResult([], 0);
  assert(lib.isSchedule2ResultBetter(more, fewer));
});
test("floorIsBetter: 비교 대상(b)이 없으면 항상 true", () => {
  assert(lib.floorIsBetter(scheduleResult([], 0), null));
});
test("schedule2Signature: 배정 순서와 무관하게 같은 배치는 같은 서명", () => {
  const assigned = [
    { memberId: "m1", day: 0, startSlot: 0, locationId: "L1" },
    { memberId: "m2", day: 1, startSlot: 5, locationId: "L2" },
  ];
  assertEqual(
    lib.schedule2Signature({ assigned }),
    lib.schedule2Signature({ assigned: assigned.slice().reverse() }),
  );
});

/* ---------------- chainDp.js: runChainDP (핵심 DP) ---------------- */
function node({ id, memberId, startSlot, duration, locationId, weight }) {
  return {
    id,
    memberId,
    day: 0,
    startSlot,
    duration,
    locationId,
    end: startSlot + duration / 10, // SLOT_MIN=10
    weight: weight === undefined ? 1 : weight,
    jitter: 0,
  };
}
test("runChainDP: 겹치지 않는 두 신청은 둘 다 채택된다", () => {
  const chain = lib.runChainDP([
    node({ id: "a", memberId: "m1", startSlot: 0, duration: 30, locationId: "L1" }),
    node({ id: "b", memberId: "m2", startSlot: 3, duration: 30, locationId: "L1" }),
  ]);
  assertEqual(chain.map((n) => n.id).sort(), ["a", "b"]);
});
test("runChainDP: 완전히 겹치는 신청 중 가중치가 큰 쪽만 채택된다", () => {
  const chain = lib.runChainDP([
    node({ id: "small", memberId: "m1", startSlot: 0, duration: 60, locationId: "L1", weight: 1 }),
    node({ id: "big", memberId: "m2", startSlot: 0, duration: 60, locationId: "L1", weight: 5 }),
  ]);
  assertEqual(chain.map((n) => n.id), ["big"]);
});
test("runChainDP: 같은 회원이 하루에 두 번 배정되지 않는다(비인접 안전망)", () => {
  // A(0~2)->B(2~4)->A(4~6): DP 전이 규칙은 '바로 앞' 노드와만 회원 중복을 비교하므로,
  // A가 인접하지 않게 두 번 낀 조합도 전이 자체는 막히지 않는다 — 최종 조립 단계의
  // 안전망(runChainDP 안 used Set)이 이걸 걸러내야 한다.
  const chain = lib.runChainDP([
    node({ id: "a1", memberId: "A", startSlot: 0, duration: 20, locationId: "L1" }),
    node({ id: "b1", memberId: "B", startSlot: 2, duration: 20, locationId: "L1" }),
    node({ id: "a2", memberId: "A", startSlot: 4, duration: 20, locationId: "L1" }),
  ]);
  const memberIds = chain.map((n) => n.memberId);
  assertEqual(new Set(memberIds).size, memberIds.length, "회원이 하루에 두 번 배정됨");
});
test("runChainDP: maxTravelsPerDay를 넘는 이동은 거부된다", () => {
  lib.state.travelTimes = {
    [lib.pairKey("L1", "L2")]: 10,
    [lib.pairKey("L2", "L3")]: 10,
    [lib.pairKey("L1", "L3")]: 10,
  };
  const chain = lib.runChainDP(
    [
      node({ id: "a", memberId: "m1", startSlot: 0, duration: 20, locationId: "L1" }),
      node({ id: "b", memberId: "m2", startSlot: 3, duration: 20, locationId: "L2" }),
      node({ id: "c", memberId: "m3", startSlot: 6, duration: 20, locationId: "L3" }),
    ],
    1, // 이동 최대 1회까지만 허용
  );
  let travelCount = 0;
  for (let i = 1; i < chain.length; i++) {
    if (lib.travelMinutes(chain[i - 1].locationId, chain[i].locationId) > 0) travelCount++;
  }
  assert(travelCount <= 1, "이동 횟수 상한을 넘김");
});

console.log(pass + "개 통과, " + fail + "개 실패 (단위 테스트)");
if (fail > 0) process.exit(1);
