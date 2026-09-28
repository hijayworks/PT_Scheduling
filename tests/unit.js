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

/* ---------------- engine/greedy.js ---------------- */
test("candidateLocationsForRequest: excludedLocationIds는 기본 지점에서 빼고, extraLocationIds는 더한다", () => {
  lib.state.members = [{ id: "m1", locationIds: ["L1", "L2"] }];
  assertEqual(
    lib.candidateLocationsForRequest({ memberId: "m1" }),
    ["L1", "L2"],
    "제외/추가가 없으면 기본 지점 그대로",
  );
  assertEqual(
    lib.candidateLocationsForRequest({
      memberId: "m1",
      excludedLocationIds: ["L1"],
      extraLocationIds: ["L3"],
    }),
    ["L2", "L3"],
    "제외한 기본 지점은 빠지고 추가 지점은 더해짐",
  );
});

/* ---------------- domain.js: isInefficientRoundTrip(비효율 이동 왕복 판정) ---------------- */
function ineffLocations(extra) {
  return [
    { id: "M", name: "마포점" },
    { id: "Y", name: "여의도점" },
    { id: "S", name: "상암점" },
  ].concat(extra || []);
}
test("isInefficientRoundTrip: 마포↔여의도 왕복만 허용, 상암이 낀 왕복은 전부 비효율", () => {
  lib.state.locations = ineffLocations();
  const info = lib.inefficientRoundTripLocationInfo();
  assert(!!info, "지점 이름이 정확히 하나씩 매칭되면 활성화돼야 함");
  assertEqual(lib.isInefficientRoundTrip(info, "M", "Y", "M"), false, "마포>여의도>마포는 허용");
  assertEqual(lib.isInefficientRoundTrip(info, "Y", "M", "Y"), false, "여의도>마포>여의도는 허용");
  assertEqual(lib.isInefficientRoundTrip(info, "M", "S", "M"), true, "마포>상암>마포는 비효율");
  assertEqual(lib.isInefficientRoundTrip(info, "S", "M", "S"), true, "상암>마포>상암은 비효율");
  assertEqual(lib.isInefficientRoundTrip(info, "S", "Y", "S"), true, "상암>여의도>상암은 비효율");
  assertEqual(lib.isInefficientRoundTrip(info, "Y", "S", "Y"), true, "여의도>상암>여의도는 비효율");
});
test("isInefficientRoundTrip: 같은 지점 반복이나 왕복이 아니면 비효율 아님", () => {
  lib.state.locations = ineffLocations();
  const info = lib.inefficientRoundTripLocationInfo();
  assertEqual(lib.isInefficientRoundTrip(info, "M", "M", "M"), false, "실제 이동이 없으면 왕복이 아님");
  assertEqual(lib.isInefficientRoundTrip(info, "M", "Y", "S"), false, "제자리로 돌아오지 않으면 왕복이 아님");
});
test("isInefficientRoundTrip: 관계없는 지점이 끼면 규칙 대상이 아님", () => {
  lib.state.locations = ineffLocations([{ id: "X", name: "기타점" }]);
  const info = lib.inefficientRoundTripLocationInfo();
  assertEqual(lib.isInefficientRoundTrip(info, "M", "X", "M"), false, "기타점은 세 지점에 속하지 않음");
});
test("inefficientRoundTripLocationInfo: 지점 이름이 중복 매칭되면 규칙 비활성화", () => {
  lib.state.locations = ineffLocations([{ id: "M2", name: "마포점" }]);
  assertEqual(lib.inefficientRoundTripLocationInfo(), null, "마포점이 2개면 어느 쪽인지 모호하므로 비활성화");
});
test("dailyInefficientMoveCount: 하루 체인에서 비효율 왕복만 센다", () => {
  lib.state.locations = ineffLocations();
  const info = lib.inefficientRoundTripLocationInfo();
  const chain = [
    { locationId: "M" },
    { locationId: "Y" },
    { locationId: "M" }, // 마포>여의도>마포: 허용, 카운트 안 됨
    { locationId: "S" },
    { locationId: "M" }, // 여의도>마포>상암은 왕복 아님, 마포>상암>마포는 비효율
  ];
  assertEqual(lib.dailyInefficientMoveCount(chain, info), 1);
});
test("dailyInefficientMoveCount: 상암에서 연달아 여러 건 해도 마포>상암>마포는 비효율", () => {
  lib.state.locations = ineffLocations();
  const info = lib.inefficientRoundTripLocationInfo();
  const locs = ["M", "S", "S", "M"];
  assertEqual(lib.dailyInefficientMoveCount(locs.map((locationId) => ({ locationId })), info), 1);
  assertEqual(lib.roundTripOriginLoc(2, (i) => (i > 0 ? i - 1 : null), (i) => locs[i]), "M");
  assertEqual(lib.roundTripOriginLoc(0, (i) => (i > 0 ? i - 1 : null), (i) => locs[i]), null);
});

/* ---------------- greedy.js: 후보 생성 우선순위(미배정 없음 > 비효율 이동 > 수업 횟수) ---------------- */
// 세 회원 A(마포, 0~60분)·B(상암, 70~130분)·C(마포, 140~200분)를 하루 한 체인에 이어붙일 수
// 있게 구성한다 — A→B→C를 다 이으면 마포>상암>마포 왕복(비효율)이 생기고, B에서 멈추면
// 비효율 없이 2명만 배정된다. 지점 간 이동 시간은 10분(=1슬롯)으로 둬 정확히 필요한 간격만큼만
// 벌려 세션을 이어 붙인다.
function ineffPriorityFixture() {
  lib.state.locations = ineffLocations();
  lib.state.travelTimes = {
    [lib.pairKey("M", "S")]: 10,
    [lib.pairKey("M", "Y")]: 10,
    [lib.pairKey("Y", "S")]: 10,
  };
  lib.state.members = [
    { id: "A", locationIds: ["M"], category: "상담" },
    { id: "B", locationIds: ["S"], category: "상담" },
    { id: "C", locationIds: ["M"], category: "상담" },
  ];
  return [
    { id: "a", memberId: "A", day: 0, startSlot: 0, duration: 60 }, // M, 슬롯 0~6
    { id: "b", memberId: "B", day: 0, startSlot: 7, duration: 60 }, // S, 슬롯 7~13 (간격 1슬롯=10분)
    { id: "c", memberId: "C", day: 0, startSlot: 14, duration: 60 }, // M, 슬롯 14~20 (간격 1슬롯)
  ];
}
test("greedyAssign 우선순위: 비효율 이동 최소화가 수업 횟수 최대보다 우선한다(sessionCountFirst)", () => {
  const reqs = ineffPriorityFixture();
  const assigned = lib.greedyAssign(reqs, { sessionCountFirst: true }, []);
  const memberIds = new Set(assigned.map((r) => r.memberId));
  assertEqual(memberIds.has("C"), false, "C까지 이으면 비효율 왕복이 생기므로 제외해야 함");
  assertEqual(memberIds.has("A") && memberIds.has("B"), true, "A·B는 비효율 없이 배정 가능해야 함");
  const info = lib.inefficientRoundTripLocationInfo();
  assertEqual(lib.totalInefficientMoveCount(assigned, info), 0);
});
test("greedyAssign 우선순위: 미배정 인원 없음이 비효율 이동 최소화보다 우선한다(기본 커버리지 단계)", () => {
  const reqs = ineffPriorityFixture();
  const assigned = lib.greedyAssign(reqs, {}, []);
  const memberIds = new Set(assigned.map((r) => r.memberId));
  assertEqual(memberIds.size, 3, "세 회원 모두 배정 가능하면(첫 세션 확보) 커버리지가 우선이라 다 배정돼야 함");
  const info = lib.inefficientRoundTripLocationInfo();
  assertEqual(
    lib.totalInefficientMoveCount(assigned, info),
    1,
    "이 경우엔 비효율 왕복 1회를 감수하고서라도 전원 배정해야 함",
  );
});

test("greedyAssign forbidInefficient: 다른 요일로 돌려 미배정 없음 + 비효율 없음을 찾는다", () => {
  // C가 화요일에도 신청했다 — 기본 커버리지는 월요일에서 A>B>C 비효율 체인으로 C를 먼저 잡지만,
  // 비효율을 하드 금지하면 C를 화요일로 보내 둘 다 만족한다.
  const reqs = ineffPriorityFixture().concat([
    { id: "c2", memberId: "C", day: 1, startSlot: 0, duration: 60 },
  ]);
  const info = lib.inefficientRoundTripLocationInfo();
  assertEqual(lib.totalInefficientMoveCount(lib.greedyAssign(reqs, {}, []), info), 1);
  const forbid = lib.greedyAssign(reqs, { forbidInefficient: true }, []);
  assertEqual(new Set(forbid.map((r) => r.memberId)).size, 3);
  assertEqual(lib.totalInefficientMoveCount(forbid, info), 0);
});

/* ---------------- isSchedule2ResultBetter: 비효율 이동 우선순위 ---------------- */
test("isSchedule2ResultBetter: 미배정이 같으면 비효율 이동이 적은 쪽이 수업 수보다 우선", () => {
  lib.state.locations = ineffLocations();
  lib.state.travelTimes = {};
  const moreSessionsButIneff = scheduleResult(
    [
      { memberId: "A", day: 0, startSlot: 0, locationId: "M" },
      { memberId: "B", day: 0, startSlot: 10, locationId: "S" },
      { memberId: "C", day: 0, startSlot: 20, locationId: "M" },
    ],
    0,
  );
  const fewerSessionsNoIneff = scheduleResult(
    [
      { memberId: "A", day: 0, startSlot: 0, locationId: "M" },
      { memberId: "B", day: 0, startSlot: 10, locationId: "S" },
    ],
    0,
  );
  assert(
    lib.isSchedule2ResultBetter(fewerSessionsNoIneff, moreSessionsButIneff),
    "비효율 왕복이 없는 쪽이 수업 수가 적어도 이겨야 함",
  );
  assert(!lib.isSchedule2ResultBetter(moreSessionsButIneff, fewerSessionsNoIneff));
});

test("isSchedule2ResultBetter: 빈 시간 최소화 모드에서는 이동 횟수보다 빈 시간이 우선", () => {
  lib.state.locations = ineffLocations();
  lib.state.travelTimes = { [lib.pairKey("M", "S")]: 20 };
  const s = (memberId, startSlot, locationId) => ({ memberId, day: 0, startSlot, locationId, duration: 50 });
  // 이동 0·빈 시간 50분 vs 이동 1(20분)·빈 시간 0분
  const noTravelIdle50 = scheduleResult([s("A", 0, "M"), s("B", 10, "M")], 0);
  const oneTravelLessIdle = scheduleResult([s("A", 0, "M"), s("B", 7, "S")], 0);
  assert(lib.isSchedule2ResultBetter(noTravelIdle50, oneTravelLessIdle), "기본 모드는 이동 1번 = 60분");
  lib.setIdleFirst(true);
  try {
    assert(lib.isSchedule2ResultBetter(oneTravelLessIdle, noTravelIdle50), "빈 시간 모드는 빈 시간이 적은 쪽");
  } finally {
    lib.setIdleFirst(false);
  }
});

/* ---------------- candidateSearchScore: 미배정 → 비효율 이동 → 수업 수 ---------------- */
test("candidateSearchScore: 인원이 비효율 이동보다, 비효율 이동이 수업 수보다 우선", () => {
  lib.state.locations = ineffLocations();
  lib.state.travelTimes = {};
  const s = (memberId, startSlot, locationId) => ({ memberId, day: 0, startSlot, locationId, duration: 50 });
  const score = (assigned) => lib.candidateSearchScore({ assigned, unassignedMembers: [] }, "count", null);
  const threeMembersIneff = score([s("A", 0, "M"), s("B", 10, "S"), s("C", 20, "M")]);
  const twoMembersClean = score([s("A", 0, "M"), s("B", 10, "S")]);
  assert(lib.isCandidateWorse(twoMembersClean, threeMembersIneff), "인원이 많은 쪽이 비효율 이동이 있어도 이겨야 함");
  const moreSessionsIneff = score([s("A", 0, "M"), s("B", 10, "S"), s("A", 20, "M")]);
  const fewerSessionsClean = score([s("A", 0, "M"), s("B", 10, "S")]);
  assert(lib.isCandidateWorse(moreSessionsIneff, fewerSessionsClean), "인원이 같으면 비효율 이동 없는 쪽이 수업 수보다 우선");
});

console.log(pass + "개 통과, " + fail + "개 실패 (단위 테스트)");
if (fail > 0) process.exit(1);
