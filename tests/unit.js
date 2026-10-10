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
const esbuild = require("esbuild");

const lib = require("./loadLib.js");

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
// 비동기 테스트는 등록만 해두고, 동기 테스트가 모두 끝난 뒤 맨 아래에서 순서대로 실행한다.
const asyncTests = [];
function testAsync(name, fn) {
  asyncTests.push({ name, fn });
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

/* ---------------- backup.js: 복원 schema 검증 ---------------- */
function validBackupFixture() {
  return {
    locations: [
      { id: "L1", name: "마포점" },
      { id: "L2", name: "여의도점" },
    ],
    travelTimes: { "L1|L2": 20 },
    members: [
      {
        id: "M1",
        name: "홍길동",
        locationIds: ["L1"],
        category: "등록",
        memo: "",
      },
    ],
    requests: [
      {
        id: "R1",
        memberId: "M1",
        day: 0,
        startSlot: 6,
        duration: 60,
        extraLocationIds: ["L2"],
        excludedLocationIds: [],
      },
    ],
    availableCells: ["0-6", "0-7"],
    candidates: [],
    onceLimitedMemberIds3: [],
    excludedMemberIds3: [],
    schedule3Result: { candidateAList: [null, null, null] },
  };
}

test("backup schema: 정상 백업은 통과", () => {
  const data = validBackupFixture();
  assertEqual(lib.validateBackupState(data), data);
  assertEqual(
    lib.parseAndValidateBackupText(JSON.stringify(data)).members[0].id,
    "M1",
  );
});

test("backup schema: root/주요 컬렉션 타입이 잘못되면 거부", () => {
  let threw = false;
  try {
    lib.validateBackupState([]);
  } catch {
    threw = true;
  }
  assert(threw, "배열 root는 거부해야 함");

  threw = false;
  try {
    lib.validateBackupState({ ...validBackupFixture(), members: {} });
  } catch {
    threw = true;
  }
  assert(threw, "members가 배열이 아니면 거부해야 함");
});

test("backup schema: 존재하지 않는 회원/지점 참조를 거부", () => {
  const badMember = validBackupFixture();
  badMember.requests[0].memberId = "MISSING";
  let threw = false;
  try {
    lib.validateBackupState(badMember);
  } catch {
    threw = true;
  }
  assert(threw, "request가 없는 회원을 참조하면 거부해야 함");

  const badLocation = validBackupFixture();
  badLocation.members[0].locationIds = ["DELETED"];
  threw = false;
  try {
    lib.validateBackupState(badLocation);
  } catch {
    threw = true;
  }
  assert(threw, "회원이 없는 지점을 참조하면 거부해야 함");
});

test("backup schema: 손상된 근무 셀/이동시간을 거부", () => {
  const badCell = validBackupFixture();
  badCell.availableCells = ["not-a-cell"];
  let threw = false;
  try {
    lib.validateBackupState(badCell);
  } catch {
    threw = true;
  }
  assert(threw, "잘못된 available cell을 거부해야 함");

  const badTravel = validBackupFixture();
  badTravel.travelTimes["L1|L2"] = -10;
  threw = false;
  try {
    lib.validateBackupState(badTravel);
  } catch {
    threw = true;
  }
  assert(threw, "음수 이동시간을 거부해야 함");
});

test("backup schema: 미래 schemaVersion은 거부하고 구버전/미지정은 허용", () => {
  const current = validBackupFixture();
  current.schemaVersion = lib.CURRENT_SCHEMA_VERSION;
  assertEqual(lib.validateBackupState(current), current);

  const legacy = validBackupFixture();
  delete legacy.schemaVersion;
  assertEqual(lib.validateBackupState(legacy), legacy);

  const future = validBackupFixture();
  future.schemaVersion = lib.CURRENT_SCHEMA_VERSION + 1;
  let threw = false;
  try {
    lib.validateBackupState(future);
  } catch {
    threw = true;
  }
  assert(threw, "미래 schemaVersion은 현재 코드에서 복원하면 안 됨");
});

test("portable backup: 파생 후보와 페이지 상태를 제외하고 schemaVersion을 기록", () => {
  const data = validBackupFixture();
  data.schemaVersion = lib.CURRENT_SCHEMA_VERSION;
  data.candidates = [{ assigned: [{ id: "derived" }] }];
  data.schedule3Result = {
    candidateAList: [{ assigned: [{ id: "derivedA" }] }, null, null],
  };
  data.currentPage = "schedule3";
  const portable = lib.createPortableBackupState(data);
  assertEqual(portable.schemaVersion, lib.CURRENT_SCHEMA_VERSION);
  assert(portable.candidates === undefined, "후보B/C는 portable backup에서 제외해야 함");
  assert(
    portable.schedule3Result === undefined,
    "후보A는 portable backup에서 제외해야 함",
  );
  assert(portable.currentPage === undefined, "현재 페이지는 백업 대상이 아님");
  assertEqual(portable.members[0].id, "M1");
});

test("backup restore: 구형 백업에 후보가 있어도 복원 시 모두 초기화", () => {
  const data = validBackupFixture();
  data.candidates = [{ assigned: [{ id: "oldB" }] }];
  data.schedule3Result = {
    candidateAList: [{ assigned: [{ id: "oldA" }] }, null, null],
  };
  data.currentPage = "schedule3";
  const restored = lib.prepareBackupStateForRestore(data);
  assertEqual(restored.candidates, []);
  assertEqual(restored.schedule3Result.candidateAList, [null, null, null]);
  assert(restored.currentPage === undefined);
});

test("backup envelope: version과 KDF 파라미터를 코드 자체에서 읽을 수 있음", () => {
  const envelope = {
    backupVersion: lib.BACKUP_VERSION,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: lib.BACKUP_PBKDF2_ITERATIONS,
      salt: "AA==",
    },
    cipher: {
      name: "AES-GCM",
      keyLength: 256,
      iv: "AA==",
    },
    ciphertext: "AA==",
  };
  const encoded = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64");
  const parsed = lib.parseBackupEnvelope(lib.BACKUP_PREFIX + encoded);
  assertEqual(parsed.backupVersion, 2);
  assertEqual(parsed.kdf.iterations, 600000);
  assertEqual(lib.parseBackupEnvelope("legacy-base64-code"), null);
});

test("backup password: 새 백업은 12자 이상만 허용", () => {
  assertEqual(lib.BACKUP_PASSWORD_MIN_LENGTH, 12);
  assert(!lib.isValidBackupPassword("12345678901"), "11자는 거부해야 함");
  assert(lib.isValidBackupPassword("123456789012"), "12자는 허용해야 함");
  assert(
    lib.isValidBackupPassword("coffee-river-train"),
    "긴 passphrase를 허용해야 함",
  );
});

test("restore recovery: session snapshot에서 기존 localStorage를 복원", () => {
  const sessionData = new Map();
  const localData = new Map([["pt_schedule_state_v3", "new-state"]]);
  const fakeSession = {
    getItem: (k) => sessionData.has(k) ? sessionData.get(k) : null,
    setItem: (k, v) => sessionData.set(k, v),
    removeItem: (k) => sessionData.delete(k),
  };
  const fakeLocal = {
    getItem: (k) => localData.has(k) ? localData.get(k) : null,
    setItem: (k, v) => localData.set(k, v),
    removeItem: (k) => localData.delete(k),
  };
  fakeSession.setItem(
    lib.RESTORE_RECOVERY_KEY,
    JSON.stringify({ createdAt: 1, state: "old-state" }),
  );
  assertEqual(lib.readRestoreRecoverySnapshot(fakeSession).state, "old-state");
  assert(lib.restoreRecoverySnapshot(fakeSession, fakeLocal));
  assertEqual(fakeLocal.getItem("pt_schedule_state_v3"), "old-state");
  assertEqual(fakeSession.getItem(lib.RESTORE_RECOVERY_KEY), null);
});

test("restore recovery: 이전에 저장 데이터가 없던 상태도 되돌릴 수 있음", () => {
  const sessionData = new Map();
  const localData = new Map([["pt_schedule_state_v3", "restored-state"]]);
  const fakeSession = {
    getItem: (k) => sessionData.has(k) ? sessionData.get(k) : null,
    setItem: (k, v) => sessionData.set(k, v),
    removeItem: (k) => sessionData.delete(k),
  };
  const fakeLocal = {
    getItem: (k) => localData.has(k) ? localData.get(k) : null,
    setItem: (k, v) => localData.set(k, v),
    removeItem: (k) => localData.delete(k),
  };
  fakeSession.setItem(
    lib.RESTORE_RECOVERY_KEY,
    JSON.stringify({ createdAt: 1, state: null }),
  );
  assert(lib.restoreRecoverySnapshot(fakeSession, fakeLocal));
  assertEqual(fakeLocal.getItem("pt_schedule_state_v3"), null);
});

test("saveState: localStorage 쓰기 실패를 밖으로 던지지 않고 false 반환", () => {
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error("quota exceeded");
  };
  let result;
  try {
    result = lib.saveState();
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
    lib.runtime.storageError = null;
  }
  assertEqual(result, false);
});

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
test("travelMinutes: 같은 지점은 0, 이동시간 누락은 연결 불가능, 등록된 값은 순서 무관", () => {
  lib.state.travelTimes = {};
  assertEqual(lib.travelMinutes("L1", "L1"), 0);
  assertEqual(
    lib.travelMinutes("L1", "L2"),
    Infinity,
    "서로 다른 지점의 이동시간 누락을 0분으로 간주하면 안 됨",
  );
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
test("runChainDP: 같은 회원이 비인접 위치에 있어도 전이 단계에서 하루 1회를 지킨다", () => {
  const chain = lib.runChainDP([
    node({ id: "a1", memberId: "A", startSlot: 0, duration: 20, locationId: "L1" }),
    node({ id: "b1", memberId: "B", startSlot: 2, duration: 20, locationId: "L1" }),
    node({ id: "a2", memberId: "A", startSlot: 4, duration: 20, locationId: "L1" }),
  ]);
  const memberIds = chain.map((n) => n.memberId);
  assertEqual(new Set(memberIds).size, memberIds.length, "회원이 하루에 두 번 배정됨");
});

test("runChainDP: A→B→A 중복 경로를 3점으로 세어 유효한 3인 체인을 놓치지 않는다", () => {
  // 입력 순서상 기존 구현은 A1→B→A2를 3점으로 고른 뒤 reconstruction에서 A1을 지워
  // 2명만 반환할 수 있었다. 동시에 실제 유효한 3인 체인이 있으므로 결과는 반드시 3명이어야 한다.
  const chain = lib.runChainDP([
    node({ id: "a1", memberId: "A", startSlot: 0, duration: 20, locationId: "L1" }),
    node({ id: "c1", memberId: "C", startSlot: 0, duration: 20, locationId: "L1" }),
    node({ id: "b1", memberId: "B", startSlot: 2, duration: 20, locationId: "L1" }),
    node({ id: "d1", memberId: "D", startSlot: 2, duration: 20, locationId: "L1" }),
    node({ id: "a2", memberId: "A", startSlot: 4, duration: 20, locationId: "L1" }),
    node({ id: "e1", memberId: "E", startSlot: 4, duration: 20, locationId: "L1" }),
  ]);
  const memberIds = chain.map((n) => n.memberId);
  assertEqual(chain.length, 3, "유효한 3인 체인이 있는데 중복 경로 후처리 때문에 2명으로 줄면 안 됨");
  assertEqual(new Set(memberIds).size, 3, "결과 3명은 모두 서로 다른 회원이어야 함");
});

test("runChainDP: 이동시간이 누락된 서로 다른 지점 세션은 연속 배정하지 않는다", () => {
  lib.state.travelTimes = {};
  const chain = lib.runChainDP([
    node({ id: "a", memberId: "A", startSlot: 0, duration: 20, locationId: "L1" }),
    node({ id: "b", memberId: "B", startSlot: 2, duration: 20, locationId: "L2" }),
  ]);
  assertEqual(chain.length, 1, "이동시간을 모르는 지점 사이를 0분 이동으로 연결하면 안 됨");
});
test("runChainDP: 이동시간 설정을 바꾸면 다음 호출부터 바로 반영된다", () => {
  // 지점 쌍 이동시간은 호출마다 새로 구한다 — 호출 사이에 캐시가 남으면 설정 변경 후에도
  // 옛 이동시간으로 배정하게 된다.
  const nodes = () => [
    node({ id: "a", memberId: "A", startSlot: 0, duration: 20, locationId: "L1" }),
    node({ id: "b", memberId: "B", startSlot: 3, duration: 20, locationId: "L2" }),
  ];
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 10 };
  assertEqual(lib.runChainDP(nodes()).length, 2, "10분 간격이면 이동 10분으로 연결 가능");
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 20 };
  assertEqual(lib.runChainDP(nodes()).length, 1, "이동 20분으로 바꾸면 10분 간격은 연결 불가");
});
test("runChainDP: 회원이 32명을 넘어도 하루 1회 제한을 지킨다", () => {
  // 회원 중복 검사가 비트셋(32명 단위 word)이므로 word 경계를 넘는 회원도 확인한다.
  lib.state.travelTimes = {};
  const nodes = [];
  for (let k = 0; k < 40; k++)
    nodes.push(node({ id: "x" + k, memberId: "m" + k, startSlot: k * 2, duration: 20, locationId: "L1" }));
  nodes.push(node({ id: "dup", memberId: "m35", startSlot: 80, duration: 20, locationId: "L1", weight: 5 }));
  const chain = lib.runChainDP(nodes);
  const ids = chain.map((n) => n.memberId);
  assertEqual(new Set(ids).size, ids.length, "33번째 이후 회원이 하루에 두 번 배정됨");
  assert(ids.includes("m35"), "가중치가 큰 자리로라도 m35는 배정돼야 함");
});
test("runChainDP: 입력 순서와 무관하게 앞 세션이 끝난 뒤 시작하는 세션만 잇는다", () => {
  lib.state.travelTimes = {};
  const chain = lib.runChainDP([
    node({ id: "late", memberId: "C", startSlot: 6, duration: 20, locationId: "L1" }),
    node({ id: "long", memberId: "A", startSlot: 0, duration: 60, locationId: "L1" }),
    node({ id: "mid", memberId: "B", startSlot: 3, duration: 20, locationId: "L1" }),
  ]);
  assertEqual(chain.map((n) => n.id), ["long", "late"]);
});
test("memberById: 회원 추가·삭제·교체가 바로 반영된다", () => {
  lib.state.members = [{ id: "A", name: "a" }, { id: "B", name: "b" }];
  assertEqual(lib.memberById("B").name, "b");
  lib.state.members.unshift({ id: "C", name: "c" });
  assertEqual(lib.memberById("B").name, "b", "앞에 추가돼 위치가 밀려도 같은 회원");
  assertEqual(lib.memberById("C").name, "c");
  lib.state.members[1] = { id: "A", name: "a2" };
  assertEqual(lib.memberById("A").name, "a2", "같은 자리에 바꿔 끼운 회원");
  lib.state.members = lib.state.members.filter((m) => m.id !== "B");
  assertEqual(lib.memberById("B"), undefined, "삭제된 회원");
  lib.state.members[0] = { id: "D", name: "d" };
  assertEqual(lib.memberById("D").name, "d", "다른 id로 바꿔 끼운 회원");
  assertEqual(lib.memberById("C"), undefined, "바꿔 끼워져 사라진 회원");
});
test("knownLocationIdSet: 지점 추가·삭제·교체가 바로 반영된다", () => {
  lib.state.locations = [{ id: "L1", name: "1" }];
  assert(lib.knownLocationIdSet().has("L1"));
  lib.state.locations.push({ id: "L2", name: "2" });
  assert(lib.knownLocationIdSet().has("L2"), "추가된 지점");
  lib.state.locations[0] = { id: "L9", name: "9" };
  assert(!lib.knownLocationIdSet().has("L1"), "교체돼 사라진 지점");
  lib.state.locations = [];
  assertEqual(lib.knownLocationIdSet().size, 0);
});
test("pairKey: 문자열 정렬 순서로 키를 만든다(저장된 이동시간 키와 호환)", () => {
  assertEqual(lib.pairKey("L2", "L10"), "L10|L2");
  assertEqual(lib.pairKey("loc_b", "loc_a"), "loc_a|loc_b");
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
  lib.state.locations = [
    { id: "L1", name: "1" },
    { id: "L2", name: "2" },
    { id: "L3", name: "3" },
  ];
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

test("candidateLocationsForRequest: 허용 가능한 실제 지점이 하나도 없으면 빈 배열", () => {
  lib.state.locations = [{ id: "L1", name: "1" }];
  lib.state.members = [{ id: "m1", locationIds: ["DELETED"] }];
  assertEqual(
    lib.candidateLocationsForRequest({ memberId: "m1" }),
    [],
    "삭제된 지점 id를 가짜 null 지점으로 배정하면 안 됨",
  );
  assertEqual(
    lib.candidateLocationsForRequest({
      memberId: "m1",
      extraLocationIds: ["ALSO_DELETED"],
    }),
    [],
    "존재하지 않는 추가 지점도 후보에 포함하면 안 됨",
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
test("greedyAssign: 회원이 32명을 넘어도 같은 회원을 하루에 두 번 배정하지 않는다", () => {
  // 체인 안 회원 중복 검사가 비트셋(32명 단위 word)이므로 word 경계를 넘는 회원도 확인한다.
  lib.state.locations = [{ id: "L1", name: "1" }];
  lib.state.travelTimes = {};
  lib.state.onceLimitedMemberIds3 = [];
  lib.state.members = [];
  const reqs = [];
  for (let k = 0; k < 40; k++) {
    lib.state.members.push({ id: "m" + k, locationIds: ["L1"], category: "등록" });
    // 회원마다 빈틈없이 이어지는 자기 자리와, 다음 회원 자리에도 신청을 하나 더 둔다 — 하루 1회
    // 제한이 깨지면 같은 회원이 연달아 들어갈 수 있다.
    reqs.push({ id: "a" + k, memberId: "m" + k, day: 0, startSlot: k * 3, duration: 30 });
    reqs.push({ id: "b" + k, memberId: "m" + k, day: 0, startSlot: (k + 1) * 3, duration: 30 });
  }
  const assigned = lib.greedyAssign(reqs, { sessionCountFirst: true }, []);
  const perDay = new Set();
  assigned.forEach((r) => {
    const k = r.memberId + "|" + r.day;
    assert(!perDay.has(k), r.memberId + "가 같은 날 두 번 배정됨");
    perDay.add(k);
  });
  assertEqual(assigned.length, 40, "40명 모두 하루 1회씩 배정돼야 함");
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

/* ---------------- 수업 1건 = 이동 1번 환산 비교 ---------------- */
test("수업 1건 늘리려고 이동 2번 늘리면 더 나쁨, 이동 1번이면 수업 많은 쪽", () => {
  lib.state.locations = ineffLocations();
  lib.state.travelTimes = { [lib.pairKey("M", "Y")]: 20 };
  const s = (memberId, startSlot, locationId) => ({
    memberId,
    day: 0,
    startSlot,
    locationId,
    duration: 50,
  });
  const twoNoTravel = [s("A", 0, "M"), s("B", 5, "M")]; // 수업 2·이동 0
  const threeTwoTravel = [s("A", 0, "M"), s("B", 7, "Y"), s("A", 14, "M")]; // 수업 3·이동 2
  const threeOneTravel = [s("A", 0, "M"), s("B", 5, "M"), s("A", 12, "Y")]; // 수업 3·이동 1
  const r = (assigned) => scheduleResult(assigned, 0);
  assert(
    lib.isSchedule2ResultBetter(r(twoNoTravel), r(threeTwoTravel)),
    "수업 1건 < 이동 2번",
  );
  assert(
    lib.isSchedule2ResultBetter(r(threeOneTravel), r(twoNoTravel)),
    "점수 동점이면 수업 많은 쪽",
  );
  const score = (assigned) =>
    lib.candidateSearchScore(
      { assigned, unassignedMembers: [] },
      "count",
      null,
    );
  assert(
    lib.isCandidateWorse(score(threeTwoTravel), score(twoNoTravel)),
    "그리디 후보도 같은 기준",
  );
  assert(lib.isCandidateWorse(score(twoNoTravel), score(threeOneTravel)));
});

test("dropSessionsForBalance: 이동+빈 시간만 만드는 끝 수업은 빼고, 유일한 수업·손해인 수업은 안 뺀다", () => {
  lib.state.locations = ineffLocations();
  lib.state.travelTimes = { [lib.pairKey("M", "Y")]: 20 };
  const s = (memberId, startSlot, locationId) => ({ memberId, day: 0, startSlot, locationId, duration: 50 });
  // A의 두 번째 수업(Y)이 이동 1번 + 빈 시간 30분을 만든다 → 빼는 게 낫다.
  const lastA = s("A", 15, "Y");
  const dropped = lib.dropSessionsForBalance(scheduleResult([s("A", 0, "M"), s("B", 5, "M"), lastA], 0));
  assertEqual(dropped.assigned.length, 2);
  assert(!dropped.assigned.includes(lastA));
  // 같은 배치라도 B의 유일한 수업이면 빼지 않는다.
  const onlyB = scheduleResult([s("A", 0, "M"), s("B", 15, "Y")], 0);
  assertEqual(lib.dropSessionsForBalance(onlyB).assigned.length, 2);
  // 빈 시간 없이 이동 1번만 만드는 수업은 수업 1건 = 이동 1번이라 동점 → 빼지 않는다.
  const tie = scheduleResult([s("A", 0, "M"), s("B", 5, "M"), s("A", 12, "Y")], 0);
  assertEqual(lib.dropSessionsForBalance(tie).assigned.length, 3);
});

/* ---------------- 붙여넣기 일괄 등록 파싱 ---------------- */
function bulkLocations() {
  return [
    { id: "M", name: "마포점" },
    { id: "Y", name: "여의도점" },
    { id: "S", name: "상암점" },
  ];
}
// 파싱 결과를 "요일|지점|시작시각들"로 요약한다(시각은 그리드 기준 HH:MM).
function bulkSummary(line) {
  const parsed = lib.parseBulkImportLine(line);
  assertEqual(parsed.errors, [], line);
  return parsed.days.map(
    (d) =>
      d.day +
      "|" +
      (d.locationId || "") +
      "|" +
      d.specs
        .flatMap((s) => s.marks)
        .map((m) => lib.slotLabel(lib.hourMarkToStartSlot(m)))
        .join(","),
  );
}
test("일괄 등록: 시·분 표기와 / 구분", () => {
  lib.state.locations = bulkLocations();
  assertEqual(bulkSummary("홍길동  월 4시 10분/4시20분"), ["0||16:10,16:20"]);
  assertEqual(bulkSummary("홍길동 화 12시30분"), ["1||12:30"]);
  assertEqual(bulkSummary("홍길동 목 2시, 3시 금 4시,5시"), ["3||14:00,15:00", "4||16:00,17:00"]);
  // 기존 뜻은 그대로: 쉼표 없는 "410"은 4시·10시, 하이픈은 물결과 같다.
  assertEqual(bulkSummary("홍길동 월410"), ["0||16:00,22:00"]);
  assertEqual(bulkSummary("홍길동 월2-4"), ["0||14:00,15:00,16:00"]);
  assert(lib.parseBulkImportLine("홍길동 월 4시 5분").errors.length > 0, "10분 단위가 아니면 오류");
});
test("일괄 등록: 분이 붙은 범위 표기", () => {
  lib.state.locations = bulkLocations();
  const specs = (line) => {
    const parsed = lib.parseBulkImportLine(line);
    assertEqual(parsed.errors, [], line);
    return parsed.days[0].specs.map((s) =>
      s.type === "point"
        ? s.marks.map((m) => lib.slotLabel(lib.hourMarkToStartSlot(m))).join(",")
        : s.type + " " + lib.slotLabel(lib.hourMarkToStartSlot(s.mark)),
    );
  };
  assertEqual(specs("홍길동 월 4시10분~6시"), ["16:10,17:00,18:00"]);
  assertEqual(specs("홍길동 월 4시 10분-6시 30분"), ["16:10,17:00,18:30"]);
  assertEqual(specs("홍길동 월 4시~6시30분"), ["16:00,17:00,18:30"]);
  assertEqual(specs("홍길동 월 4시10분~"), ["openStart 16:10"]);
  assertEqual(specs("홍길동 월 ~6시30분"), ["openEnd 18:30"]);
  assertEqual(specs("홍길동 월 4시10분부터"), ["openStart 16:10"]);
  assertEqual(specs("홍길동 월 6시30분까지"), ["openEnd 18:30"]);
  assert(lib.parseBulkImportLine("홍길동 월 4시5분~6시").errors.length > 0, "10분 단위가 아니면 오류");
});
test("일괄 등록: (지점) 표기", () => {
  lib.state.locations = bulkLocations();
  assertEqual(bulkSummary("홍길동 (마포)월89 (여의도)월9"), ["0|M|20:00,21:00", "0|Y|21:00"]);
  const unknown = lib.parseBulkImportLine("홍길동 (강남)월8 화9");
  assertEqual(unknown.days, []);
  assert(unknown.errors.length === 1, "등록되지 않은 지점은 오류로 알리고 그 시간은 건너뜀");
});
// index.html 안내 문구가 실제 정책과 어긋나지 않게 한다(예전 "5678 → 각각 정시" 안내는 실제
// 동작인 17:00~20:00 연속 구간과 달랐다).
const indexHtml = require("fs").readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("일괄 등록 안내의 예시 결과는 실제 미리보기 해석과 같다", () => {
  lib.state.locations = bulkLocations();
  const modal = indexHtml.slice(indexHtml.indexOf('id="bulkImportStepInput"'));
  const examples = [...modal.matchAll(/<li><code>([^<]+)<\/code> → <span>([^<]+)<\/span><\/li>/g)];
  assert(examples.length >= 10, "예시를 찾지 못함: " + examples.length);
  examples.forEach(([, line, expected]) => {
    const parsed = lib.parseBulkImportLine(line);
    assertEqual(parsed.errors.concat(parsed.warnings), [], line);
    // 미리보기 칩("월 (마포점) 17:00~20:00")을 같은 해석끼리 요일만 묶어 한 줄로 만든다.
    const groups = new Map();
    parsed.days.forEach((d) => {
      const loc = lib.state.locations.find((l) => l.id === d.locationId);
      const text = (loc ? "(" + loc.name + ") " : "") + lib.describeDaySpecs(d.specs);
      if (!groups.has(text)) groups.set(text, []);
      groups.get(text).push(lib.DAYS[d.day]);
    });
    const actual = parsed.clearAll
      ? "기존 가능 시간 전체 삭제"
      : [...groups].map(([text, days]) => days.join("·") + " " + text).join(" / ");
    assertEqual(actual, expected, line);
  });
});
test("후보 조건 안내의 숫자·역할 이름은 정책값과 같다", () => {
  const rules = indexHtml.slice(
    indexHtml.indexOf('id="candidateRulesList3"'),
    indexHtml.indexOf('id="excludedBlock3"'),
  );
  assert(rules.length > 0, "후보 조건 목록을 찾지 못함");
  [
    `등록 회원 ${lib.SESSION_DURATION_MIN}분, 상담 회원 ${lib.CONSULT_DURATION_MIN}분`,
    `하루 최대 1회, 주 최대 ${lib.MAX_SESSIONS_PER_MEMBER}회`,
    `하루 지점 간 이동은 최대 ${lib.MAX_TRAVELS_PER_DAY}회`,
    `추천 포함 최대 ${lib.MAX_CANDIDATE_CARDS}개`,
    "'추천'만 나올 수도",
    // 역할 카드는 정책 순서(CANDIDATE_ROLES)대로 채워지므로 안내도 그 순서로 적는다.
    lib.CANDIDATE_ROLES.map((r) => `'${r.label}'`).join(""),
  ].forEach((phrase) =>
    assert(rules.replace(/\([^)]*\)·?/g, "").includes(phrase), "후보 조건에 없음: " + phrase),
  );
});

/* ---------------- 지점별 가능 시간 블록 합치기 ---------------- */
// addDesiredRange로 월요일 신청을 만들고, mergeRequestRuns가 만든 블록을 "지점들 시작~끝"으로 요약한다.
function requestBlocks(baseLocs, ranges) {
  lib.state.locations = bulkLocations();
  lib.state.requests = [];
  const member = { id: "m1", name: "홍", locationIds: baseLocs, category: "등록" };
  lib.state.members = [member];
  const slot = (hour) => lib.hourMarkToStartSlot({ hour, minute: 0 });
  ranges.forEach(([from, to, loc]) => lib.addDesiredRange(member, 0, slot(from), slot(to), loc));
  const runs = lib.mergeRequestRuns(member, lib.state.requests);
  const summary = runs.map(
    (r) => r.allowed.join("") + " " + lib.slotLabel(r.startSlot) + "~" + lib.slotLabel(r.endSlot),
  );
  return { member, runs, summary };
}
test("mergeRequestRuns: 공통 시각은 맞닿은 지점 블록이 함께 덮는다", () => {
  assertEqual(requestBlocks(["M", "Y"], [[5, 8, "M"], [8, 9, "Y"]]).summary, ["M 17:00~21:00", "Y 20:00~22:00"]);
  // 기본 지점이 아닌 지점도 같다.
  assertEqual(requestBlocks(["M"], [[5, 8, "M"], [8, 9, "Y"]]).summary, ["M 17:00~21:00", "Y 20:00~22:00"]);
});
test("mergeRequestRuns: 어떤 지점도 화면에서 사라지지 않는다", () => {
  const shown = (summary) => new Set(summary.flatMap((s) => Array.from(s.split(" ")[0])));
  // 지점 표기 없는 시간 옆의 여의도 전용 시간 — 마포가 남아야 한다.
  const plain = requestBlocks(["M", "Y"], [[5, 8, null], [8, 9, "Y"]]).summary;
  assertEqual(plain, ["MY 17:00~21:00", "Y 20:10~22:00"]);
  // 마포 시간 안에 여의도 시간이 들어 있는 경우 — 여의도가 남아야 한다.
  assert(shown(requestBlocks(["M", "Y"], [[5, 8, "M"], [6, 7, "Y"]]).summary).has("Y"));
  // 지점 3개 — 여의도가 남아야 한다.
  const three = shown(requestBlocks(["M", "Y", "S"], [[5, 8, "M"], [8, 9, "Y"], [8, 10, "S"]]).summary);
  assertEqual([...three].sort(), ["M", "S", "Y"]);
});
test("removeRequestRun: 지점 블록을 지우면 공통 시각은 다른 지점 블록에 남는다", () => {
  const { member, runs } = requestBlocks(["M", "Y"], [[5, 8, "M"], [8, 9, "Y"]]);
  lib.removeRequestRun(member, runs.find((r) => r.allowed.join("") === "M"));
  const after = lib.mergeRequestRuns(member, lib.state.requests);
  assertEqual(after.map((r) => r.allowed.join("") + " " + lib.slotLabel(r.startSlot)), ["Y 20:00"]);
});

/* ---------------- 회귀: 후보A 무결성 / migration / 확정 ---------------- */
test("후보A 빈 시간 압축: 현재 지점에서 가능한 더 이른 신청만 선택", () => {
  lib.state.members = [
    { id: "m1", name: "홍", locationIds: ["M", "Y"], category: "등록" },
  ];
  const requests = [
    {
      id: "m-only",
      memberId: "m1",
      day: 0,
      startSlot: 6,
      duration: 60,
      excludedLocationIds: ["Y"],
    },
    {
      id: "y-ok",
      memberId: "m1",
      day: 0,
      startSlot: 8,
      duration: 60,
      excludedLocationIds: ["M"],
    },
  ];
  const found = lib.findEarlierRequestForLocation(requests, 6, 10, "Y");
  assertEqual(found && found.id, "y-ok", "더 이른 마포 전용 신청으로 당기면 안 됨");
});

test("후보A 빈 시간 압축: 시간 변경 시 request id와 startSlot을 함께 갱신", () => {
  const node = { id: "old", startSlot: 10, duration: 60, end: 16 };
  lib.moveNodeToRequest(node, { id: "new", startSlot: 8 });
  assertEqual(
    { id: node.id, startSlot: node.startSlot, end: node.end },
    { id: "new", startSlot: 8, end: 14 },
  );
});

test("START_MIN migration: request/근무 슬롯 이동 후 후보A/B/C를 모두 초기화", () => {
  const parsed = {
    startMinBase: 13 * 60,
    availableCells: ["0-0"],
    requests: [{ id: "r1", startSlot: 0 }],
    candidates: [{ assigned: [{ id: "b" }] }],
    schedule3Result: {
      candidateAList: [{ assigned: [{ id: "a" }] }, null, null],
    },
  };
  lib.migrateStartMinShift(parsed);
  assertEqual(parsed.availableCells, ["0-6"]);
  assertEqual(parsed.requests[0].startSlot, 6);
  assertEqual(parsed.candidates, []);
  assertEqual(parsed.schedule3Result.candidateAList, [null, null, null]);
});

test("runtime 후보 전체 초기화: 후보A/B/C가 함께 제거됨", () => {
  lib.runtime.candidates = [{ id: "b" }];
  lib.runtime.schedule3Result = {
    candidateAList: [{ id: "a1" }, { id: "a2" }, null],
  };
  lib.clearRuntimeScheduleCandidates();
  assertEqual(lib.runtime.candidates, []);
  assertEqual(lib.runtime.schedule3Result.candidateAList, [null, null, null]);
});


/* ---------------- polishWorkerPool.js: 후보A 다듬기 Web Worker 병렬화 ---------------- */
// 브라우저 Worker와 같은 모양(postMessage/onmessage/onerror/terminate)의 가짜 워커.
// reply(worker, msg)가 "run" 메시지마다 응답을 정한다.
/* ---------------- scheduleQuality.js: 품질 지표·하드 제약 검사 ---------------- */
// 여의도↔상암 이동시간은 일부러 등록하지 않는다(누락). S는 세 지점을 모두 다니는 회원, X는 제외 회원.
function qualityFixture() {
  lib.state.locations = [
    { id: "L1", name: "마포점" },
    { id: "L2", name: "여의도점" },
    { id: "L3", name: "상암점" },
  ];
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 30, [lib.pairKey("L1", "L3")]: 30 };
  lib.state.members = [
    { id: "A", name: "a", locationIds: ["L1"], category: "등록" },
    { id: "B", name: "b", locationIds: ["L1", "L2"], category: "등록" },
    { id: "S", name: "s", locationIds: ["L1", "L2", "L3"], category: "등록" },
    { id: "X", name: "x", locationIds: ["L1"], category: "등록" },
    { id: "C", name: "c", locationIds: ["L3"], category: "상담" },
  ];
  lib.state.excludedMemberIds3 = ["X"];
  lib.state.onceLimitedMemberIds3 = [];
  lib.state.noConsecutiveDayMemberIds = [];
  lib.runtime.availableCells = new Set();
  lib.state.requests = [];
  [0, 1].forEach((day) => {
    for (let s = 0; s <= 40; s++) lib.runtime.availableCells.add(day + "-" + s);
    lib.state.members.forEach((m) => {
      for (let s = 0; s <= 30; s++)
        lib.state.requests.push({ id: m.id + day + "_" + s, memberId: m.id, day, startSlot: s, duration: m.category === "상담" ? 30 : 60 });
    });
  });
}
function at(memberId, day, startSlot, locationId) {
  const req = lib.state.requests.find((r) => r.id === memberId + day + "_" + startSlot);
  return { ...req, locationId };
}
// 월: A(마포 12:00) → B(마포 13:00). 화: S(마포 12:00) → 이동 30분 → 빈 30분 → C(상암 14:00, 상담 30분).
function validQualityResult() {
  return {
    assigned: [at("A", 0, 0, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")],
    unassignedMembers: [],
  };
}

test("품질 지표: 수업·이동·빈 시간·근무 시간을 계산한다", () => {
  qualityFixture();
  const m = lib.scheduleMetrics(validQualityResult());
  assertEqual(
    [m.targetMembers, m.assignedMembers, m.unassigned, m.sessions, m.onceOnly],
    [4, 4, 0, 4, 3],
    "제외 회원은 대상에서 빠지고, 상담 회원은 1회만 받아도 '1회만'이 아님",
  );
  assertEqual([m.travelCount, m.travelMinutes, m.inefficientMoves], [1, 30, 0]);
  assertEqual([m.idleMinutes, m.longestIdleMinutes], [30, 30], "이동에 쓴 30분은 빈 시간이 아님");
  assertEqual(
    [m.workDays, m.spanMinutes, m.firstStartMinute, m.lastEndMinute],
    [2, 120 + 150, 12 * 60, 12 * 60 + 150],
  );
});

test("하드 제약 검사: 정상 스케줄은 위반이 없다", () => {
  qualityFixture();
  assertEqual(lib.scheduleViolations(validQualityResult()), []);
});

// 검사기가 실제로 각 위반을 잡아내는지 하나씩 깨뜨려 본다 — 검사기가 조용히 통과시키면
// 골든 데이터셋의 "위반 0건"도 의미가 없어진다.
test("하드 제약 검사: 규칙마다 위반을 잡아낸다", () => {
  const cases = [
    ["notRequested", (r) => (r.assigned[0] = { ...r.assigned[0], startSlot: 35 })],
    ["excluded", (r) => r.assigned.push(at("X", 1, 20, "L1"))],
    ["location", (r) => (r.assigned[3] = at("C", 1, 12, "L1"))],
    ["availability", () => lib.runtime.availableCells.delete("0-2")],
    ["maxSessions", (r) => {
      lib.state.onceLimitedMemberIds3 = ["B"];
      r.assigned.push(at("B", 1, 20, "L1"));
    }],
    ["sameDay", (r) => r.assigned.push(at("A", 0, 20, "L1"))],
    ["gap", (r) => (r.assigned[1] = at("B", 0, 3, "L1"))],
    ["gap", (r) => (r.assigned[1] = at("B", 0, 6, "L2"))],
    // 상암 → 여의도 이동시간 누락: 간격이 아무리 넓어도 연속 배정하면 안 된다.
    ["gap", (r) => r.assigned.push(at("B", 1, 30, "L2"))],
    ["dailyTravel", (r) => r.assigned.push(at("A", 1, 18, "L1"), at("B", 1, 27, "L2"))],
    // 월: A(마포) → 이동 → S(상암) → 이동 → B(마포). S는 앞뒤가 모두 이동이다.
    ["soloTravel", (r) => {
      r.assigned = [at("A", 0, 0, "L1"), at("S", 0, 9, "L3"), at("B", 0, 18, "L1"), at("C", 1, 12, "L3")];
    }],
    ["unassigned", (r) => r.assigned.shift()],
  ];
  cases.forEach(([expected, mutate]) => {
    qualityFixture();
    const r = validQualityResult();
    mutate(r);
    const violations = lib.scheduleViolations(r);
    assert(
      violations.some((v) => v.rule === expected),
      expected + " 위반을 잡지 못함: " + JSON.stringify(violations),
    );
  });
});

test("하드 제약 검사: 격자에 안 맞는 이동시간(15분)도 실제 이동시간 기준으로 판정한다", () => {
  qualityFixture();
  lib.state.travelTimes[lib.pairKey("L1", "L2")] = 15;
  const withB = (slot) => ({
    assigned: [at("A", 0, 0, "L1"), at("B", 0, slot, "L2"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")],
    unassignedMembers: [],
  });
  assert(lib.scheduleViolations(withB(7)).some((v) => v.rule === "gap"), "간격 10분 < 이동 15분은 위반");
  assertEqual(lib.scheduleViolations(withB(8)), [], "간격 20분 ≥ 이동 15분은 정상");
});

// 확정 세션 앞을 채울 때: 월요일 S(세 지점 회원, 상암 12:30)가 확정돼 있고 바로 뒤 B(마포)로
// 이동해 떠난다. 그 앞에 A(마포 12:00)를 붙이면 S가 이동-회원-이동에 끼므로 붙이면 안 된다.
test("세 지점 회원 앞에 확정 세션 이전 체인을 붙여 이동-회원-이동을 만들지 않는다", () => {
  qualityFixture();
  const pinned = [at("S", 0, 9, "L3"), at("B", 0, 18, "L1")];
  const eligible = lib.state.requests.filter((r) => r.memberId === "A" && r.day === 0);
  const assigned = lib.greedyAssign(eligible, {}, pinned);
  const result = { assigned, unassignedMembers: [] };
  assertEqual(
    lib.scheduleViolations(result).filter((v) => v.rule === "soloTravel"),
    [],
    JSON.stringify(assigned.map((a) => [a.memberId, a.startSlot, a.locationId])),
  );
});

test("세 지점 회원 규칙: 이동으로 도착해 이동으로 떠나는 자리만 위반이다", () => {
  qualityFixture();
  lib.state.travelTimes[lib.pairKey("L2", "L3")] = 30;
  const solo = lib.soloTravelMemberIds();
  const chain = (...pairs) => pairs.map(([memberId, locationId]) => ({ memberId, locationId }));
  assert(lib.chainBreaksSoloTravel(chain(["A", "L1"], ["S", "L3"], ["B", "L2"]), solo), "이동-S-이동");
  assert(!lib.chainBreaksSoloTravel(chain(["A", "L3"], ["S", "L3"], ["B", "L2"]), solo), "같은 지점 도착");
  assert(!lib.chainBreaksSoloTravel(chain(["A", "L1"], ["B", "L3"], ["C", "L2"]), solo), "세 지점 회원 아님");
  assert(!lib.chainBreaksSoloTravel(chain(["A", "L1"], ["S", "L3"]), solo), "끝 자리는 떠나는 이동 없음");
});
test("체인DP는 세 지점 회원을 이동-회원-이동 자리에 배정하지 않는다", () => {
  qualityFixture();
  lib.state.travelTimes[lib.pairKey("L2", "L3")] = 30;
  const chain = lib.runChainDP([
    node({ id: "a", memberId: "A", startSlot: 0, duration: 60, locationId: "L1" }),
    node({ id: "s", memberId: "S", startSlot: 9, duration: 60, locationId: "L3" }),
    node({ id: "b", memberId: "B", startSlot: 18, duration: 60, locationId: "L2" }),
  ]);
  assert(chain.length >= 2, "규칙을 지키는 2인 체인은 있음");
  assert(!lib.chainBreaksSoloTravel(chain, lib.soloTravelMemberIds()), chain.map((n) => n.id).join("→"));
});

/* ---------------- candidateDiversity.js: 후보 다양성 판정 ---------------- */
const diversity = require("./candidateDiversity.js");
function divCand(key, sessions, metrics) {
  const base = { unassigned: 0, sessions: sessions.length, inefficientMoves: 0, travelCount: 0, travelMinutes: 0, idleMinutes: 0 };
  return {
    key,
    result: { assigned: sessions.map(([memberId, day, startSlot, locationId]) => ({ memberId, day, startSlot, locationId })), unassignedMembers: [] },
    metrics: { ...base, ...metrics },
  };
}
test("후보 다양성: 배정이 같으면 중복, 지표만 같으면 구조만 다름, 장단점이 갈리면 trade-off", () => {
  const a = divCand("A", [["m1", 0, 0, "L1"], ["m2", 0, 6, "L1"]]);
  const sameLayout = divCand("A'", [["m2", 0, 6, "L1"], ["m1", 0, 0, "L1"]]);
  const shifted = divCand("S", [["m1", 0, 1, "L1"], ["m2", 0, 7, "L1"]]);
  const moreButTravel = divCand("T", [["m1", 0, 0, "L1"], ["m2", 0, 6, "L1"], ["m3", 0, 12, "L2"]], { travelCount: 1 });
  const worse = divCand("W", [["m1", 1, 0, "L1"], ["m2", 1, 6, "L1"]], { idleMinutes: 30 });
  assertEqual(diversity.pairRelation(a, sameLayout).relation, "duplicate");
  const s = diversity.pairRelation(a, shifted);
  assertEqual([s.relation, s.sessionSimilarity, s.memberDaySimilarity], ["same-quality", 0, 1]);
  const t = diversity.pairRelation(a, moreButTravel);
  assertEqual([t.relation, t.deltas], ["trade-off", { sessions: 1, travelCount: 1 }]);
  assertEqual(diversity.pairRelation(worse, a).winner, "A", "빈 시간만 많은 쪽이 진다");
  const sum = diversity.diversitySummary([a, sameLayout, shifted, moreButTravel, worse]);
  assertEqual([sum.shown, sum.exactUnique, sum.qualityTypes], [5, 4, 3]);
  assertEqual(sum.pareto, ["A", "A'", "S", "T"], "W만 지배당함");
  assertEqual(sum.paretoQualityTypes, 2, "A·A'·S는 품질이 같아 선택지 하나, T가 둘째");
});

/* ---------------- candidateSelection.js: 후보 풀에서 사용자 카드 선정 ---------------- */
// qualityFixture: 마포(L1)·여의도(L2)·상암(L3), 마포↔여의도·마포↔상암 30분. C는 상암 상담 30분.
function selEntry(key, sessions, unassigned = []) {
  const result = { assigned: sessions.map((s) => at(...s)), unassignedMembers: unassigned };
  return { key, result, metrics: lib.scheduleMetrics(result) };
}
// 월: A·B(마포), 화: S(마포) → 이동 → C(상암). 미배정 0, 수업 4, 이동 1, 빈 시간 0.
const SEL_BASE = [["A", 0, 0, "L1"], ["B", 0, 6, "L1"], ["S", 1, 0, "L1"], ["C", 1, 9, "L3"]];
test("후보 선정: 같은 배치는 하나로 합치고, 시작 시각만 다른 같은 품질 배치는 variant로 남기지 않는다", () => {
  qualityFixture();
  const base = selEntry("base", SEL_BASE);
  const dup = selEntry("dup", SEL_BASE);
  const shifted = selEntry("shifted", [["A", 0, 0, "L1"], ["B", 0, 6, "L1"], ["S", 1, 1, "L1"], ["C", 1, 10, "L3"]]);
  const daysSwapped = selEntry("swapped", [["A", 1, 0, "L1"], ["B", 1, 6, "L1"], ["S", 0, 0, "L1"], ["C", 0, 9, "L3"]]);
  const sel = lib.selectCandidates([base, dup, shifted, daysSwapped]);
  assertEqual(sel.cards.map((c) => c.label), ["추천"]);
  const keys = sel.cards[0].variants.map((v) => v.key);
  assertEqual([keys.length, keys.includes("swapped"), keys.includes("base") !== keys.includes("shifted")], [2, true, true], "시작 시각만 다른 둘 중 하나만");
  const st = sel.stats;
  assertEqual([st.exactDuplicates, st.qualityGroups, st.similarRemoved], [1, 1, 1]);
});
test("후보 선정: 결과는 후보 풀의 입력 순서와 무관하다", () => {
  qualityFixture();
  const list = [
    selEntry("base", SEL_BASE),
    selEntry("swapped", [["A", 1, 0, "L1"], ["B", 1, 6, "L1"], ["S", 0, 0, "L1"], ["C", 0, 9, "L3"]]),
    selEntry("more", SEL_BASE.concat([["A", 1, 15, "L1"]])),
  ];
  const view = (sel) => sel.cards.map((c) => [c.label, c.variants.map((v) => v.key)]);
  assertEqual(view(lib.selectCandidates(list)), view(lib.selectCandidates(list.slice().reverse())));
});
test("후보 선정: variant가 넘치면 이미 고른 배치와 회원·요일·지점 배정이 더 많이 다른 배치를 먼저 고른다", () => {
  const layout = (key, days) => ({ key, result: { assigned: days.map((day, i) => ({ memberId: "m" + i, day, startSlot: 0, locationId: "L1" })) } });
  const rep = layout("rep", [0, 0, 0, 0]);
  const near1 = layout("near1", [1, 0, 0, 0]);
  const near2 = layout("near2", [0, 1, 0, 0]);
  const far = layout("far", [1, 1, 1, 1]);
  const { kept, similar, overLimit } = lib.pickVariants([rep, near1, near2, far]);
  assertEqual([kept.map((e) => e.key), similar, overLimit], [["rep", "far", "near1"], 0, 1]);
});
test("후보 선정: 같은 품질 배치는 회원·요일 배정이 달라도 카드 하나에 최대 3개 variant만 둔다", () => {
  qualityFixture();
  const layouts = [
    SEL_BASE,
    [["S", 0, 0, "L1"], ["C", 0, 9, "L3"], ["A", 1, 0, "L1"], ["B", 1, 6, "L1"]],
    [["A", 0, 0, "L1"], ["S", 0, 6, "L1"], ["B", 1, 0, "L1"], ["C", 1, 9, "L3"]],
    [["B", 0, 0, "L1"], ["S", 0, 6, "L1"], ["A", 1, 0, "L1"], ["C", 1, 9, "L3"]],
  ];
  const sel = lib.selectCandidates(layouts.map((l, i) => selEntry("v" + i, l)));
  assertEqual(sel.cards.length, 1);
  assertEqual(sel.cards[0].variants.length, lib.MAX_CARD_VARIANTS);
  assertEqual(sel.stats.variantLimitRemoved, 1);
});
test("후보 선정: 모든 축에서 같거나 못한 후보는 지우고, 추천안보다 나은 축이 있을 때만 역할을 붙인다", () => {
  qualityFixture();
  const base = selEntry("base", SEL_BASE);
  const worse = selEntry("worse", [["A", 0, 0, "L1"], ["B", 0, 9, "L1"], ["S", 1, 0, "L1"], ["C", 1, 9, "L3"]]);
  const more = selEntry("more", SEL_BASE.concat([["A", 1, 15, "L1"]]));
  const sel = lib.selectCandidates([worse, more, base]);
  assertEqual(
    sel.cards.map((c) => [c.label, c.variants[0].key, lib.formatTradeoff(c.deltas)]),
    [
      ["추천", "base", ""],
      ["수업 우선", "more", "수업 +1 / 비효율 이동 +1 / 이동 +1 / 이동 시간 +30분"],
    ],
    "이동 최소·공강 최소는 추천안보다 나은 후보가 없어 만들지 않는다",
  );
  assertEqual([sel.stats.dominatedGroups, sel.stats.dominatedLayouts, sel.hidden.length], [1, 1, 0]);
});
test("후보 선정: 추천보다 나은 지표가 있는 후보가 없으면 추천 카드 하나만 보인다", () => {
  qualityFixture();
  const base = selEntry("base", SEL_BASE);
  const worse = selEntry("worse", [["A", 0, 0, "L1"], ["B", 0, 9, "L1"], ["S", 1, 0, "L1"], ["C", 1, 9, "L3"]]);
  assertEqual(lib.selectCandidates([worse, base]).cards.map((c) => c.label), ["추천"]);
});
test("후보 선정: 미배정이 추천안보다 많은 대안은 Pareto여도 카드로 보이지 않고 gate 사유로 보고한다", () => {
  qualityFixture();
  const base = selEntry("base", SEL_BASE);
  const lessTravel = selEntry("less", [["A", 0, 0, "L1"], ["B", 0, 6, "L1"], ["S", 0, 12, "L1"]], [{ id: "C" }]);
  const sel = lib.selectCandidates([base, lessTravel]);
  assertEqual(sel.cards.map((c) => c.label), ["추천"]);
  assertEqual(sel.hidden.map((h) => [h.reason, h.variants[0].key, lib.formatTradeoff(h.deltas)]), [
    ["unassigned-gate", "less", "미배정 +1명 / 수업 -1 / 이동 -1 / 이동 시간 -30분"],
  ]);
  assertEqual([sel.stats.gatedGroups, sel.stats.gatedLayouts], [1, 1]);
});
test("후보 선정: 사용자가 수정한 후보는 지배당해도 지우지 않고, 추천 역할 없이 따로 보여준다", () => {
  qualityFixture();
  const base = selEntry("base", SEL_BASE);
  const edited = { ...selEntry("edited", [["A", 0, 0, "L1"], ["B", 0, 9, "L1"], ["S", 1, 0, "L1"], ["C", 1, 9, "L3"]]), fixed: true };
  const sel = lib.selectCandidates([edited, base]);
  assertEqual(
    sel.cards.map((c) => [c.role, c.label, c.variants[0].key, lib.formatTradeoff(c.deltas)]),
    [
      ["recommended", "추천", "base", ""],
      ["edited", "내가 수정한 후보", "edited", "빈 시간 +30분"],
    ],
  );
});
test("후보 선정: 자동 배치가 사용자 수정 후보와 완전히 같으면 수정 후보 하나로 합치고 추천은 나머지에서 고른다", () => {
  qualityFixture();
  const edited = { ...selEntry("edited", SEL_BASE), fixed: true };
  const sameAuto = selEntry("auto", SEL_BASE);
  const other = selEntry("other", [["A", 0, 0, "L1"], ["B", 0, 9, "L1"], ["S", 1, 0, "L1"], ["C", 1, 9, "L3"]]);
  const sel = lib.selectCandidates([edited, sameAuto, other]);
  assertEqual(sel.cards.map((c) => [c.label, c.variants[0].key]), [["추천", "other"], ["내가 수정한 후보", "edited"]]);
  assertEqual([sel.stats.mergedIntoFixed, sel.stats.exactDuplicates], [1, 0]);
});

test("후보 풀: 사용자가 손댄 슬롯은 수정 후보로 넣고, 그 슬롯의 동점 풀은 넣지 않는다", () => {
  qualityFixture();
  const edited = { ...selEntry("e", SEL_BASE).result, confirmedIds: ["A0_0"] };
  const auto = selEntry("a", SEL_BASE).result;
  const autoTie = selEntry("t", [["A", 1, 0, "L1"], ["B", 1, 6, "L1"], ["S", 0, 0, "L1"], ["C", 0, 9, "L3"]]).result;
  lib.runtime.schedule3Result = { candidateAList: [edited, auto, null] };
  lib.runtime.candidates = [];
  lib.candidateAPools[0] = [edited, autoTie];
  lib.candidateAPools[1] = [auto, autoTie];
  const entries = lib.candidatePoolEntries();
  assertEqual(entries.map((e) => [e.key, e.fixed]), [["A1", true], ["A2", false], ["A2#1", false]]);
  assert(lib.keepsUserEditedSlot(edited) && !lib.keepsUserEditedSlot(auto), "손댄 슬롯만 다시 생성에서 지킨다");
  delete lib.candidateAPools[0];
  delete lib.candidateAPools[1];
  lib.runtime.schedule3Result = { candidateAList: [null, null, null] };
});

/* ---------------- candidateDiff.js: 후보 비교(지표 차이·배정 차이) ---------------- */
const CMP_BASE = { unassigned: 0, sessions: 10, inefficientMoves: 0, travelCount: 2, travelMinutes: 60, idleMinutes: 90, workDays: 4, spanMinutes: 600, firstStartMinute: 10 * 60, lastEndMinute: 20 * 60 };
test("후보 비교: 모든 지표의 절대값, 추천 대비 차이, 좋아졌는지를 돌려준다", () => {
  const other = { ...CMP_BASE, sessions: 9, travelCount: 3, idleMinutes: 30, spanMinutes: 570, lastEndMinute: 19 * 60 + 30 };
  const diff = lib.metricDiff(CMP_BASE, other);
  assertEqual(diff.map((d) => d.key), lib.COMPARE_METRICS.map((m) => m.key));
  assertEqual(
    diff.filter((d) => d.effect !== "same").map((d) => [d.key, d.base, d.value, d.delta, d.effect]),
    [
      ["sessions", 10, 9, -1, "worse"],
      ["travelCount", 2, 3, 1, "worse"],
      ["idleMinutes", 90, 30, -60, "better"],
      ["spanMinutes", 600, 570, -30, "better"],
      ["lastEndMinute", 1200, 1170, -30, "neutral"],
    ],
  );
});
test("후보 비교: 근무 부담은 체류 시간으로 판정하고, 첫 시작·마지막 종료는 방향 없는 참고 정보다", () => {
  // 하루 10:00~20:00(체류 600분) 기준
  const shift = (first, last) => ({ ...CMP_BASE, firstStartMinute: first * 60, lastEndMinute: last * 60, spanMinutes: (last - first) * 60 });
  const effects = (o) => lib.metricDiff(CMP_BASE, o).filter((d) => d.effect !== "same").map((d) => [d.key, d.delta, d.effect]);
  assertEqual(
    effects(shift(9, 19)),
    [["firstStartMinute", -60, "neutral"], ["lastEndMinute", -60, "neutral"]],
    "일정 전체가 1시간 앞당겨진 것은 개선이 아님",
  );
  assertEqual(effects(shift(10, 19)), [["spanMinutes", -60, "better"], ["lastEndMinute", -60, "neutral"]], "일찍 끝나서 체류가 줄면 개선");
  assertEqual(effects(shift(11, 20)), [["spanMinutes", -60, "better"], ["firstStartMinute", 60, "neutral"]], "늦게 시작해서 체류가 줄면 개선");
  assertEqual(lib.summarizeMetricDiff(lib.metricDiff(CMP_BASE, shift(9, 19))), "좋아지거나 나빠지는 지표 없음 · 참고: 첫 시작 -60분 / 마지막 종료 -60분");
  assertEqual(lib.summarizeMetricDiff(lib.metricDiff(CMP_BASE, shift(10, 19))), "체류 시간 -60분 (나빠지는 지표 없음) · 참고: 마지막 종료 -60분");
});
test("후보 선정: 근무일 수와 체류 시간은 Pareto 핵심 축에 넣지 않는다", () => {
  const axes = lib.QUALITY_AXES.map(([k]) => k);
  assert(!axes.includes("workDays") && !axes.includes("spanMinutes") && !axes.includes("lastEndMinute"), axes.join(","));
});
test("후보 비교: 요약 문장은 얻는 것을 앞에, 포기하는 것을 뒤에 쓰고 차이가 없는 지표는 뺀다", () => {
  const sum = (o) => lib.summarizeMetricDiff(lib.metricDiff(CMP_BASE, { ...CMP_BASE, ...o }));
  assertEqual(sum({ sessions: 9, travelCount: 3, idleMinutes: 30 }), "빈 시간 -60분 대신 수업 -1 / 이동 +1");
  assertEqual(sum({ idleMinutes: 30 }), "빈 시간 -60분 (나빠지는 지표 없음)");
  assertEqual(sum({ workDays: 5 }), "나아지는 지표 없이 근무일 +1일");
  assertEqual(sum({}), "지표는 모두 같고 배치만 다릅니다");
});
test("배정 차이: 회원별 요일·시작 시각·지점 변경과 배정↔미배정, 수업 추가·빠짐을 구분한다", () => {
  const s = (memberId, day, startSlot, locationId) => ({ memberId, day, startSlot, locationId });
  const base = { assigned: [s("A", 0, 0, "L1"), s("A", 2, 6, "L1"), s("B", 1, 0, "L1"), s("C", 0, 12, "L2"), s("D", 3, 0, "L1"), s("E", 0, 6, "L1")] };
  const other = { assigned: [s("A", 2, 6, "L1"), s("A", 4, 3, "L2"), s("B", 1, 9, "L1"), s("D", 3, 0, "L1"), s("D", 4, 0, "L1"), s("F", 1, 6, "L1"), s("E", 0, 6, "L1")] };
  const { members, counts } = lib.assignmentDiff(base, other);
  assertEqual(
    members.map((m) => [m.memberId, m.status, m.changes.map((c) => [c.from && c.from.day, c.to && c.to.day, c.dayChanged, c.startChanged, c.locationChanged])]),
    [
      ["A", "moved", [[0, 4, true, true, true]]], // 수요일 수업은 그대로, 월 → 금(시각·지점도 바뀜)
      ["B", "moved", [[1, 1, false, true, false]]],
      ["C", "unassigned", [[0, null, false, false, false]]],
      ["D", "moved", [[null, 4, false, false, false]]], // 수업 추가
      ["F", "assigned", [[null, 1, false, false, false]]],
    ],
  );
  assertEqual(counts, {
    changedMembers: 5,
    changedSessions: 5,
    dayChanges: 1,
    startChanges: 2,
    locationChanges: 1,
    startOnlyChanges: 1, // B만(A는 요일·지점도 바뀜)
    newlyAssigned: 1,
    newlyUnassigned: 1,
    sessionsAdded: 2,
    sessionsRemoved: 1,
    // 재배분: C 1→0, D 1→2, F 0→1
    membersFewer: 1,
    membersMore: 2,
    sessionCountShift: 3,
  });
});
test("배정 차이: 세션 순서만 다르고 배정이 같으면 변화가 없고, 같은 요일 안의 이동은 요일 변경이 아니다", () => {
  const s = (memberId, day, startSlot, locationId) => ({ memberId, day, startSlot, locationId });
  const base = { assigned: [s("A", 0, 0, "L1"), s("A", 2, 0, "L1")] };
  assertEqual(lib.assignmentDiff(base, { assigned: base.assigned.slice().reverse() }).members, []);
  const moved = lib.assignmentDiff(base, { assigned: [s("A", 2, 3, "L1"), s("A", 0, 0, "L1")] });
  assertEqual(moved.counts.dayChanges, 0);
  assertEqual(moved.counts.startChanges, 1);
});

/* ---------------- schedule3.js: 입력이 바뀌면 후보(수정 후보 포함)를 무효화 ---------------- */
// 생성 당시 입력과 현재 입력이 다르면 사람이 수정한 후보도 남기지 않는다.
function staleFixture(inputKey) {
  qualityFixture();
  const edited = { ...validQualityResult(), confirmedIds: [at("A", 0, 0, "L1").id] };
  lib.runtime.schedule3Result = { candidateAList: [edited, validQualityResult(), null] };
  if (inputKey !== undefined) lib.runtime.schedule3Result.inputKey = inputKey;
  lib.runtime.candidates = [validQualityResult()];
}
const hasAnyCandidate = () => lib.runtime.schedule3Result.candidateAList.some(Boolean) || lib.runtime.candidates.length > 0;
const CANDIDATE_INPUT_CHANGES = {
  "회원 신청": () => lib.state.requests.pop(),
  "회원 지점": () => lib.state.members[0].locationIds.push("L2"),
  "회원 구분": () => (lib.state.members[0].category = "상담"),
  "지점": () => lib.state.locations.push({ id: "L4", name: "새 지점" }),
  "지점 이름(세 지점·비효율 이동 규칙이 읽음)": () => (lib.state.locations[2].name = "새 이름"),
  "이동시간": () => (lib.state.travelTimes[lib.pairKey("L1", "L2")] = 40),
  "근무 가능 시간": () => lib.runtime.availableCells.delete("0-40"),
  "제외 회원": () => lib.state.excludedMemberIds3.push("B"),
  "1회 제한 회원": () => lib.state.onceLimitedMemberIds3.push("A"),
  "연속 요일 배정 제외 회원": () => lib.state.noConsecutiveDayMemberIds.push("A"),
};
Object.entries(CANDIDATE_INPUT_CHANGES).forEach(([what, change]) => {
  test(`후보 무효화: ${what}이(가) 바뀌면 내가 수정한 후보도 기존 후보와 함께 비운다`, () => {
    qualityFixture();
    staleFixture(lib.candidateInputKey());
    assert(!lib.dropStaleCandidates() && hasAnyCandidate(), "입력이 같으면 그대로 둔다");
    change();
    assert(lib.dropStaleCandidates(), "비웠다고 알려야 한다");
    assert(!hasAnyCandidate(), "수정 후보까지 모두 비운다");
  });
});
test("후보 무효화: 회원 이름·메모나 배열 순서만 바뀌면 입력이 같은 것으로 본다", () => {
  qualityFixture();
  const key = lib.candidateInputKey();
  lib.state.members[0].name = "새 이름";
  lib.state.members[0].memo = "메모";
  lib.state.requests.reverse();
  lib.state.members.reverse();
  lib.runtime.availableCells = new Set([...lib.runtime.availableCells].reverse());
  assertEqual(lib.candidateInputKey(), key);
});
test("후보 무효화: inputKey가 없는 기존 저장 후보는 하드 제약을 지키면 현재 입력 기준으로 인정한다", () => {
  staleFixture(undefined);
  assert(!lib.dropStaleCandidates() && hasAnyCandidate());
  assertEqual(lib.runtime.schedule3Result.inputKey, lib.candidateInputKey());
});
toastTest("후보 무효화: inputKey가 없는 기존 저장 후보가 모두 현재 입력으로 하드 제약을 어기면 모두 비운다", () => {
  staleFixture(undefined);
  lib.state.requests = lib.state.requests.filter((r) => r.id !== at("A", 0, 0, "L1").id); // 배정된 신청이 사라짐
  assert(lib.dropStaleCandidates() && !hasAnyCandidate());
});
test("후보 무효화: 저장된 inputKey는 새로고침(loadState) 후에도 남고, 없거나 문자열이 아니면 '모름'으로 읽는다", () => {
  const originalGetItem = globalThis.localStorage.getItem;
  const load = (schedule3Result) => {
    globalThis.localStorage.getItem = () => JSON.stringify({ schemaVersion: 1, startMinBase: 12 * 60, locations: [{ id: "L1", name: "마포점" }], schedule3Result });
    lib.loadState();
    return lib.runtime.schedule3Result.inputKey;
  };
  try {
    assertEqual(load({ candidateAList: [null, null, null], inputKey: "k1" }), "k1");
    assertEqual(load({ candidateAList: [null, null, null] }), undefined);
    assertEqual(load({ candidateAList: [null, null, null], inputKey: 3 }), undefined);
  } finally {
    globalThis.localStorage.getItem = originalGetItem;
  }
});

/* ---------------- schedule3.js: 수동 이동·맞바꾸기의 하드 제약 ---------------- */
// 수동 편집은 옮기는 회원 본인만이 아니라, 수업이 빠진 요일과 들어간 요일의 최종 체인 전체가
// 자동 생성과 같은 하드 제약을 지켜야 한다.
function manualFixture() {
  qualityFixture();
  lib.state.excludedMemberIds3 = [];
  // 상암·여의도만 다니는(세 지점 회원 아님) 60분 회원 D.
  lib.state.members.push({ id: "D", name: "d", locationIds: ["L2", "L3"], category: "등록" });
  [0, 1].forEach((day) => {
    for (let s = 0; s <= 30; s++) lib.state.requests.push({ id: "D" + day + "_" + s, memberId: "D", day, startSlot: s, duration: 60 });
  });
}
test("수동 이동: 들어간 요일의 이웃 세 지점 회원이 이동-회원-이동 자리에 놓이면 막는다", () => {
  manualFixture();
  // 화: S(상암 13:30) → 이동 → B(마포 15:00). A(마포)를 화 12:00에 넣으면 S가 이동으로 도착해 이동으로 떠난다.
  const a = at("A", 0, 0, "L1");
  const container = { assigned: [a, at("S", 1, 9, "L3"), at("B", 1, 18, "L1")], confirmedIds: [] };
  const r = lib.validateMove(container, a, 1, 0);
  assert(!r.ok, "이웃 S가 이동-회원-이동");
});
test("수동 이동: 수업이 빠진 요일에 이동-회원-이동 자리가 생기면 막는다", () => {
  manualFixture();
  // 월: A(마포) → C(상암, 상담 30분) → S(상암) → B(마포). C가 빠지면 S가 이동으로 도착해 이동으로 떠난다.
  const c = at("C", 0, 9, "L3");
  const container = { assigned: [at("A", 0, 0, "L1"), c, at("S", 0, 12, "L3"), at("B", 0, 21, "L1")], confirmedIds: [] };
  assert(!lib.validateMove(container, c, 1, 0).ok, "출발 요일 S가 이동-회원-이동");
});
test("수동 이동: 수업이 빠지며 이동시간이 없는 서로 다른 지점이 이어지면 막는다", () => {
  manualFixture(); // 여의도↔상암 이동시간 없음(연결 불가)
  const a = at("A", 0, 6, "L1");
  const container = { assigned: [at("D", 0, 0, "L2"), a, at("C", 0, 15, "L3")], confirmedIds: [] };
  assert(!lib.validateMove(container, a, 1, 0).ok, "D(여의도) → C(상암) 직접 연결");
});
test("수동 맞바꾸기: 같은 요일 두 이동을 모두 반영한 최종 체인으로 하루 이동 상한을 검사한다", () => {
  manualFixture();
  lib.state.travelTimes[lib.pairKey("L2", "L3")] = 30;
  // 월: D(상암) → B(여의도) → A(마포) → S(마포) = 이동 2회. D와 A를 맞바꾸면 마포→여의도→상암→마포 = 3회.
  // 각 이동을 상대 없이 따로 보면 둘 다 이동 2회라 통과한다.
  const d = at("D", 0, 0, "L3");
  const a = at("A", 0, 18, "L1");
  const container = { assigned: [d, at("B", 0, 9, "L2"), a, at("S", 0, 27, "L1")], confirmedIds: [] };
  assert(!lib.prepareSwap(container, d, a).ok, "맞바꾼 결과 이동 3회");
});
test("수동 이동·맞바꾸기: 하드 제약을 지키는 결과는 허용한다", () => {
  manualFixture();
  const a = at("A", 0, 0, "L1");
  const b = at("B", 0, 6, "L1");
  const container = { assigned: [a, b, at("S", 1, 0, "L1")], confirmedIds: [] };
  const moved = lib.validateMove(container, a, 1, 9);
  assertEqual([moved.ok, moved.locationId], [true, "L1"]);
  assert(lib.prepareSwap(container, a, b).ok, "같은 지점 앞뒤 맞바꾸기");
});

/* ---------------- schedule3.js: 수동 편집은 근무 가능 시간·미배정 명단까지 지킨다 ---------------- */
const noopDone = () => {};
// 수동 편집·후보 정리 함수는 끝에 showToast(requestAnimationFrame)를 부른다.
function toastTest(name, fn) {
  test(name, () => {
    const realRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = () => {};
    try {
      fn();
    } finally {
      globalThis.requestAnimationFrame = realRaf;
    }
  });
}
const ids = (members) => members.map((m) => m.id);
const nonUnassignedViolations = (r) => lib.scheduleViolations(r).filter((v) => v.rule !== "unassigned");
toastTest("수동 이동: 근무하지 않는 요일로는 회원이 신청했더라도 옮기지 않는다", () => {
  manualFixture();
  for (let s = 0; s <= 40; s++) lib.runtime.availableCells.delete("1-" + s); // 화요일 근무 없음
  const a = at("A", 0, 0, "L1");
  const container = { assigned: [a], confirmedIds: [] };
  assert(!lib.validateMove(container, a, 1, 0).ok, "화요일은 근무 불가");
  lib.moveSession(container, a, 1, 0, noopDone);
  assertEqual(container.assigned, [a], "배정이 바뀌지 않아야 함");
  assertEqual(container.confirmedIds, [], "자동 확정도 하지 않아야 함");
});
toastTest("수동 이동: 수업 종료가 근무 가능 시간을 넘어가는 자리로는 옮기지 않는다", () => {
  manualFixture();
  for (let s = 10; s <= 40; s++) lib.runtime.availableCells.delete("1-" + s); // 화 12:00~13:40
  const a = at("A", 0, 0, "L1");
  const container = { assigned: [a], confirmedIds: [] };
  assert(!lib.validateMove(container, a, 1, 6).ok, "13:00~14:00 수업은 13:40 근무 종료를 넘김");
  assert(lib.validateMove(container, a, 1, 4).ok, "12:40~13:40 수업은 근무 시간 안");
});
toastTest("수동 맞바꾸기: 근무 가능 시간 밖 자리로 가는 맞바꾸기는 막는다", () => {
  manualFixture();
  // 기존 저장분에 근무 시간 밖 배정(B 화 14:00)이 남아 있어도, A를 그 자리로 보내는 맞바꾸기는 막는다.
  for (let s = 10; s <= 40; s++) lib.runtime.availableCells.delete("1-" + s);
  const a = at("A", 0, 0, "L1");
  const b = at("B", 1, 12, "L1");
  assert(!lib.prepareSwap({ assigned: [a, b], confirmedIds: [] }, a, b).ok);
});
toastTest("회원 교체: 미배정 회원으로 교체하면 미배정 명단에서 빠진다", () => {
  qualityFixture();
  // A가 월·화 2회, B는 미배정. A의 화요일 수업을 B로 교체하면 둘 다 수업이 있다.
  const a1 = at("A", 1, 0, "L1");
  const container = {
    assigned: [at("A", 0, 0, "L1"), a1, at("S", 0, 12, "L1"), at("C", 1, 12, "L3")],
    unassignedMembers: [lib.memberById("B")],
    confirmedIds: [],
  };
  assertEqual(nonUnassignedViolations(container), [], "픽스처 확인");
  const b = lib.eligibleSwapMembersFor(container, a1).find((m) => m.id === "B");
  assert(b, "B는 교체 후보");
  lib.swapSessionMember(container, a1, b, noopDone);
  assertEqual(ids(container.unassignedMembers), []);
  assertEqual(lib.scheduleViolations(container), []);
});
toastTest("회원 교체: 마지막 수업을 잃은 회원은 미배정 명단에 들어간다", () => {
  qualityFixture();
  const a = at("A", 0, 0, "L1");
  const container = { assigned: [a, at("B", 0, 6, "L1")], unassignedMembers: [lib.memberById("S"), lib.memberById("C")], confirmedIds: [] };
  const s = lib.eligibleSwapMembersFor(container, a).find((m) => m.id === "S");
  assert(s, "S는 교체 후보");
  lib.swapSessionMember(container, a, s, noopDone);
  assertEqual(ids(container.unassignedMembers).sort(), ["A", "C"]);
  assertEqual(lib.scheduleViolations(container), []);
});
toastTest("수동 편집: 이동·맞바꾸기·교체 결과는 하드 제약 위반이 0건이다", () => {
  manualFixture();
  const base = () => ({
    assigned: [at("A", 0, 0, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")],
    unassignedMembers: [lib.memberById("D"), lib.memberById("X")],
    confirmedIds: [],
  });
  assertEqual(lib.scheduleViolations(base()), [], "픽스처 확인");
  const moved = base();
  lib.moveSession(moved, moved.assigned[0], 1, 20, noopDone);
  assertEqual(moved.confirmedIds.length, 1, "이동됨");
  assertEqual(lib.scheduleViolations(moved), []);
  const swapped = base();
  lib.attemptSwap(swapped, swapped.assigned[0], swapped.assigned[1], noopDone);
  assertEqual(swapped.confirmedIds.length, 2, "맞바꿔짐");
  assertEqual(lib.scheduleViolations(swapped), []);
  const replaced = base();
  const x = lib.eligibleSwapMembersFor(replaced, replaced.assigned[0]).find((m) => m.id === "X");
  assert(x, "X는 교체 후보");
  lib.swapSessionMember(replaced, replaced.assigned[0], x, noopDone);
  assertEqual(ids(replaced.unassignedMembers).sort(), ["A", "D"], "A가 미배정으로");
  assertEqual(lib.scheduleViolations(replaced), []);
});
toastTest("미배정 명단: 배정 대상(제외되지 않고 신청을 낸 실존 회원) 중 수업이 없는 회원이다", () => {
  qualityFixture();
  lib.state.members.push({ id: "N", name: "n", locationIds: ["L1"], category: "등록" }); // 신청 없음
  lib.state.requests.push({ id: "GHOST", memberId: "GONE", day: 0, startSlot: 0, duration: 60 }); // 삭제된 회원
  assertEqual(lib.scheduleTargetMemberIds(), ["A", "B", "S", "C"]);
  assertEqual(ids(lib.unassignedMembersFor([at("A", 0, 0, "L1"), at("S", 1, 0, "L1")])), ["B", "C"]);
});

/* ---------------- schedule3.js: 저장된 후보의 미배정 명단 재계산·필수 제약 위반 후보 정리 ---------------- */
toastTest("저장 후보: 미배정 명단이 실제 배정과 어긋나면 배정 기준으로 다시 계산하고 후보는 남긴다", () => {
  qualityFixture();
  const stale = { ...validQualityResult(), unassignedMembers: [lib.memberById("B")], confirmedIds: [at("A", 0, 0, "L1").id] };
  lib.runtime.schedule3Result = { candidateAList: [stale, null, null], inputKey: lib.candidateInputKey() };
  lib.runtime.candidates = [];
  assert(!lib.dropStaleCandidates(), "비운 후보 없음");
  assertEqual(lib.runtime.schedule3Result.candidateAList[0], stale, "수정 후보 유지");
  assertEqual(stale.unassignedMembers, []);
});
toastTest("저장 후보: 근무 가능 시간을 어긴 후보만 비우고 정상 후보(수정 후보 포함)는 남긴다", () => {
  qualityFixture();
  for (let s = 30; s <= 40; s++) lib.runtime.availableCells.delete("1-" + s); // 화 17:00 이후 근무 없음
  const edited = { ...validQualityResult(), confirmedIds: [at("A", 0, 0, "L1").id] };
  const invalid = {
    assigned: [at("A", 1, 28, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")],
    unassignedMembers: [],
    confirmedIds: [at("A", 1, 28, "L1").id],
  };
  assertEqual(lib.scheduleViolations(invalid).map((v) => v.rule), ["availability"], "픽스처 확인");
  const valid = validQualityResult();
  lib.runtime.schedule3Result = { candidateAList: [edited, invalid, null], inputKey: lib.candidateInputKey() };
  lib.runtime.candidates = [valid, invalid];
  assert(lib.dropStaleCandidates(), "비운 후보가 있다고 알려야 함");
  assertEqual(lib.runtime.schedule3Result.candidateAList, [edited, null, null]);
  assertEqual(lib.runtime.candidates, [valid]);
});
toastTest("저장 후보: 새로고침(loadState) 후에도 근무 시간 밖 수정 후보는 남지 않는다", () => {
  qualityFixture();
  for (let s = 30; s <= 40; s++) lib.runtime.availableCells.delete("1-" + s);
  const invalid = {
    assigned: [at("A", 1, 28, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")],
    unassignedMembers: [],
    confirmedIds: [at("A", 1, 28, "L1").id],
  };
  lib.runtime.schedule3Result = { candidateAList: [invalid, validQualityResult(), null], inputKey: lib.candidateInputKey() };
  lib.runtime.candidates = [];
  const saved = JSON.stringify({ ...lib.state, schemaVersion: 1, startMinBase: 12 * 60, availableCells: [...lib.runtime.availableCells], schedule3Result: lib.runtime.schedule3Result, candidates: [] });
  const originalGetItem = globalThis.localStorage.getItem;
  globalThis.localStorage.getItem = () => saved;
  try {
    lib.loadState();
  } finally {
    globalThis.localStorage.getItem = originalGetItem;
  }
  assert(lib.dropStaleCandidates());
  const list = lib.runtime.schedule3Result.candidateAList;
  assertEqual([list[0], !!list[1]], [null, true], "위반 후보만 비움");
  assertEqual(lib.state.requests.length, JSON.parse(saved).requests.length, "신청 원본 유지");
});

toastTest("저장 후보: inputKey가 없는 저장분도 후보별로 검사해 근무 시간 위반 후보만 비우고, 정상 수정·확정 후보는 새로고침 후에도 남는다", () => {
  qualityFixture();
  for (let s = 30; s <= 40; s++) lib.runtime.availableCells.delete("1-" + s); // 화 17:00 이후 근무 없음
  const editedIds = [at("A", 0, 0, "L1").id];
  const edited = { ...validQualityResult(), confirmedIds: editedIds };
  const invalid = {
    assigned: [at("A", 1, 28, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")],
    unassignedMembers: [],
    confirmedIds: [at("A", 1, 28, "L1").id],
  };
  // inputKey 없음 = 무효화 정책 이전 저장분
  const legacy = { ...lib.state, schemaVersion: 1, startMinBase: 12 * 60, availableCells: [...lib.runtime.availableCells], schedule3Result: { candidateAList: [edited, invalid, null] }, candidates: [validQualityResult(), invalid] };
  const originalGetItem = globalThis.localStorage.getItem;
  const originalSetItem = globalThis.localStorage.setItem;
  let stored = JSON.stringify(legacy);
  globalThis.localStorage.getItem = () => stored;
  globalThis.localStorage.setItem = (k, v) => (stored = v);
  try {
    lib.loadState();
    assertEqual(lib.runtime.schedule3Result.inputKey, undefined, "픽스처 확인: 키 없음");
    assert(lib.dropStaleCandidates(), "위반 후보를 비웠다고 알려야 함");
    const check = (when) => {
      const list = lib.runtime.schedule3Result.candidateAList;
      assertEqual(list.map(Boolean), [true, false, false], when + ": 위반 후보만 비움");
      assertEqual(list[0].confirmedIds, editedIds, when + ": 확정 상태 유지");
      assertEqual(list[0].assigned, edited.assigned, when + ": 수정 배치 유지");
      assertEqual(lib.runtime.candidates.length, 1, when + ": 정상 B/C 후보 유지");
      assertEqual(lib.runtime.schedule3Result.inputKey, lib.candidateInputKey(), when + ": 현재 입력 키 기록");
    };
    check("정리 직후");
    assertEqual(JSON.parse(stored).schedule3Result.inputKey, lib.candidateInputKey(), "키까지 저장");
    lib.loadState(); // 새로고침
    assert(!lib.dropStaleCandidates(), "새로고침 뒤에는 더 비울 후보가 없음");
    check("새로고침 후");
  } finally {
    globalThis.localStorage.getItem = originalGetItem;
    globalThis.localStorage.setItem = originalSetItem;
  }
});
toastTest("저장 후보: inputKey가 없고 위반 후보도 없으면 현재 입력 키를 기록해 저장한다", () => {
  staleFixture(undefined);
  const originalSetItem = globalThis.localStorage.setItem;
  let stored = null;
  globalThis.localStorage.setItem = (k, v) => (stored = v);
  try {
    assert(!lib.dropStaleCandidates() && hasAnyCandidate());
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }
  assertEqual(stored && JSON.parse(stored).schedule3Result.inputKey, lib.candidateInputKey());
});

/* ---------------- 설정: 이동 시간·근무 가능 시간 입력 ---------------- */
test("이동 시간 입력: 빈칸·잘못된 값은 0분으로 바꾸지 않고 거부하며, 명시적 0은 0분이다", () => {
  ["", "  ", "abc", "-1", "1.5", "Infinity"].forEach((t) =>
    assertEqual(lib.parseTravelMinutesInput(t), null, JSON.stringify(t)),
  );
  assertEqual(lib.parseTravelMinutesInput("0"), 0);
  assertEqual(lib.parseTravelMinutesInput(" 30 "), 30);
});
test("근무 가능 시간: 종료가 시작보다 이르면 선택창에 있는 가장 가까운 종료 시각으로 보정한다", () => {
  const slot = (h, m) => (h * 60 + m - 12 * 60) / 10;
  const endOptions = lib.availabilityTimeOptionSlots("end");
  assertEqual(lib.correctedAvailabilityEnd(slot(17, 30), slot(17, 0)), slot(18, 0));
  assertEqual(lib.correctedAvailabilityEnd(slot(17, 30), slot(17, 30)), slot(18, 0));
  assertEqual(lib.correctedAvailabilityEnd(slot(14, 0), slot(23, 30)), slot(23, 30), "정상 범위는 그대로");
  lib.availabilityTimeOptionSlots("start").forEach((start) => {
    const end = lib.correctedAvailabilityEnd(start, start);
    assert(end > start && endOptions.includes(end), "시작 " + start + " → 종료 " + end + "는 선택창에 있어야 함");
  });
});

/* ---------------- goldenFloors.js: 골든 품질 하한 래칫 ---------------- */
const goldenFloors = require("./goldenFloors.js");
function floorSet(sessions, travel) {
  const f = { maxUnassigned: 0, minSessions: sessions, maxInefficientMoves: 0, maxTravelCount: travel, maxIdleMinutes: 0 };
  return { attempts: 20, B: f, C: f };
}
test("골든 하한은 좋아지는 방향으로만 기록된다", () => {
  const prev = floorSet(16, 2);
  assertEqual(goldenFloors.floorRegressions("X", prev, floorSet(17, 1)), [], "수업↑·이동↓는 허용");
  assertEqual(goldenFloors.floorRegressions("X", prev, floorSet(16, 2)), [], "그대로도 허용");
  assertEqual(goldenFloors.floorRegressions("X", null, floorSet(1, 9)), [], "처음 기록은 비교 대상 없음");
  const worse = goldenFloors.floorRegressions("X", prev, floorSet(15, 3));
  assertEqual(worse.length, 4, "B·C 각각 수업↓·이동↑ 모두 거부: " + JSON.stringify(worse));
});
test("골든 하한의 기준 시도 횟수가 바뀌면 기록을 거부한다", () => {
  const next = floorSet(16, 2);
  next.attempts = 5;
  assertEqual(goldenFloors.floorRegressions("X", floorSet(16, 2), next).length, 1);
});

/* ---------------- 고정 세션(5a 재최적화): 엔진 불변조건 ---------------- */
// 지점 하나, 월~목 고정 4개. P(상담, 최대 1회)는 수요일 고정 + 월요일 신청, R(등록, 최대 2회)은
// 목요일 고정 + 월·화·목 신청. 월·화 고정 앞 빈 시간에 P·R이 정확히 맞물려 들어갈 수 있다.
function pinQuotaFixture() {
  lib.state.locations = [{ id: "L1", name: "1" }];
  lib.state.travelTimes = {};
  lib.state.onceLimitedMemberIds3 = [];
  lib.state.excludedMemberIds3 = [];
  lib.state.members = [
    { id: "Q1", locationIds: ["L1"], category: "등록" },
    { id: "Q2", locationIds: ["L1"], category: "등록" },
    { id: "P", locationIds: ["L1"], category: "상담" },
    { id: "R", locationIds: ["L1"], category: "등록" },
  ];
  const req = (id, memberId, day, startSlot, duration) => ({ id, memberId, day, startSlot, duration });
  const reqs = [
    req("q1", "Q1", 0, 30, 60),
    req("q2", "Q2", 1, 30, 60),
    req("pWed", "P", 2, 30, 30),
    req("pMon", "P", 0, 27, 30), // 월 27~30, Q1 고정(30) 바로 앞
    req("rThu", "R", 3, 30, 60),
    req("rMon", "R", 0, 21, 60), // 월 21~27, P(27) 앞
    req("rTue", "R", 1, 24, 60), // 화 24~30, Q2 고정(30) 바로 앞
    req("rThu2", "R", 3, 24, 60), // 목 24~30, 자기 고정 바로 앞(같은 날)
  ];
  const byId = new Map(reqs.map((r) => [r.id, r]));
  const pin = (id) => Object.assign({ locationId: "L1" }, byId.get(id));
  // 월·화 고정이 먼저 처리되도록 순서를 둔다(뒤 요일 고정 회원의 횟수가 아직 안 잡힌 상태).
  return { reqs, pins: ["q1", "q2", "pWed", "rThu"].map(pin) };
}
function sessionsPerMember(assigned) {
  const n = {};
  assigned.forEach((r) => (n[r.memberId] = (n[r.memberId] || 0) + 1));
  return n;
}
function assertPinInvariants(assigned, pins, label) {
  assertEqual(lib.missingPins(assigned, pins), [], label + ": 고정 세션은 같은 자리에 남아야 함");
  const perDay = new Set();
  assigned.forEach((r) => {
    const k = r.memberId + "|" + r.day;
    assert(!perDay.has(k), label + ": " + r.memberId + "가 같은 날 두 번 배정됨");
    perDay.add(k);
  });
  const n = sessionsPerMember(assigned);
  Object.keys(n).forEach((id) =>
    assert(n[id] <= lib.maxSessionsFor(lib.memberById(id)), label + ": " + id + " " + n[id] + "회 > 최대"),
  );
}
test("고정 세션: 그리디는 고정 세션을 회원 최대 횟수에 이미 사용된 수업으로 센다", () => {
  const { reqs, pins } = pinQuotaFixture();
  const assigned = lib.greedyAssign(reqs, {}, pins);
  assertPinInvariants(assigned, pins, "그리디");
  const n = sessionsPerMember(assigned);
  assertEqual(n.P, 1, "1회 회원이 이미 1회 고정됐으면 추가 배정하지 않음");
  assertEqual(n.R, 2, "2회 회원이 1회 고정됐으면 남은 탐색에서 1회만 추가");
});
test("고정 세션: 1회 제한 회원이 고정되면 그리디는 다른 요일에 추가 배정하지 않는다", () => {
  const { reqs, pins } = pinQuotaFixture();
  lib.state.onceLimitedMemberIds3 = ["R"];
  try {
    const assigned = lib.greedyAssign(reqs, {}, pins);
    assertPinInvariants(assigned, pins, "그리디 1회 제한");
    assertEqual(sessionsPerMember(assigned).R, 1);
  } finally {
    lib.state.onceLimitedMemberIds3 = [];
  }
});
test("고정 세션: 그리디 지점 우선 사전 단계도 고정 회원의 최대 횟수를 넘기지 않는다", () => {
  const { reqs, pins } = pinQuotaFixture();
  // 월요일 지점 우선 배정은 고정 앞 체인보다 먼저가 아니라 고정이 없는 요일에만 돈다 — 고정 없는
  // 금요일에 P(이미 수요일 고정, 최대 1회)만 신청해 둔다.
  const withFri = reqs.concat([{ id: "pFri", memberId: "P", day: 4, startSlot: 0, duration: 30 }]);
  const assigned = lib.greedyAssign(withFri, { pinnedLocationDay: { day: 4, locationId: "L1" } }, pins);
  assertPinInvariants(assigned, pins, "지점 우선 사전 단계");
  assertEqual(sessionsPerMember(assigned).P, 1);
});
test("고정 세션: 그리디는 고정 앞 체인을 붙인 하루 전체로 이동 상한을 검사한다", () => {
  // 같은 날 고정 3개(1→2→1)가 이미 이동 2회를 쓴다. X(2점)가 첫 고정 앞에 이동으로 붙으면 3회.
  lib.state.locations = [{ id: "L1", name: "1" }, { id: "L2", name: "2" }];
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 10 };
  lib.state.onceLimitedMemberIds3 = [];
  lib.state.members = ["P1", "P2", "P3", "X"].map((id) => ({ id, locationIds: id === "X" || id === "P2" ? ["L2"] : ["L1"], category: "상담" }));
  const reqs = [
    { id: "p1", memberId: "P1", day: 0, startSlot: 10, duration: 30 },
    { id: "p2", memberId: "P2", day: 0, startSlot: 14, duration: 30 },
    { id: "p3", memberId: "P3", day: 0, startSlot: 18, duration: 30 },
    { id: "x", memberId: "X", day: 0, startSlot: 6, duration: 30 },
  ];
  const loc = { p1: "L1", p2: "L2", p3: "L1" };
  const pins = reqs.slice(0, 3).map((r) => ({ ...r, locationId: loc[r.id] }));
  const assigned = lib.greedyAssign(reqs, {}, pins);
  assertPinInvariants(assigned, pins, "이동 상한");
  assertEqual(lib.scheduleViolations({ assigned, unassignedMembers: [lib.memberById("X")] }).map((v) => v.rule).filter((r) => r === "dailyTravel"), []);
  assert(!assigned.some((r) => r.memberId === "X"), "X를 넣으면 하루 이동이 3회가 된다");
});
test("고정 세션: 고정이 없으면 그리디 결과는 고정 인자 생략과 같다", () => {
  const { reqs } = pinQuotaFixture();
  assertEqual(lib.greedyAssign(reqs, {}, []), lib.greedyAssign(reqs, {}));
});
test("고정 세션: 결과에서 확정 id의 배정만 고정으로 꺼내고, 배정에 없는 옛 확정 id는 무시한다", () => {
  const result = {
    assigned: [
      { id: "a", memberId: "M1", day: 0, startSlot: 3, duration: 60, locationId: "L1" },
      { id: "b", memberId: "M2", day: 1, startSlot: 5, duration: 30, locationId: "L2" },
    ],
    confirmedIds: ["b", "gone"],
  };
  assertEqual(lib.pinsFromResult(result), [result.assigned[1]]);
  assertEqual(lib.pinsFromResult({ assigned: result.assigned }), []);
});
test("고정 세션: 지점이 바뀌면 같은 시각이어도 고정이 유지되지 않은 것으로 본다", () => {
  const pin = { id: "a", memberId: "M1", day: 0, startSlot: 3, duration: 60, locationId: "L1" };
  assertEqual(lib.missingPins([pin], [pin]), []);
  assertEqual(lib.missingPins([{ ...pin, locationId: "L2" }], [pin]), [pin]);
  assertEqual(lib.missingPins([{ ...pin, startSlot: 4 }], [pin]), [pin]);
  assertEqual(lib.missingPins([], []), []);
});

// 후보A 파이프라인(runSchedule2Pipeline) 한 번 실행: 요일 순서 하나, 다듬기 포함.
async function runPipelineWithPins(reqs, pins, { seedOffset = 0, budgetMs = 150, order } = {}) {
  lib.state.requests = reqs;
  const days = [...new Set(reqs.map((r) => r.day))].sort((a, b) => a - b);
  const reqsByDay = new Map(days.map((d) => [d, reqs.filter((r) => r.day === d)]));
  const realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  try {
    return await lib.runSchedule2Pipeline(reqs, reqsByDay, days, order || days, true, true, budgetMs, seedOffset, pins);
  } finally {
    globalThis.requestAnimationFrame = realRaf;
  }
}
testAsync("고정 세션: 후보A는 모든 단계에서 고정 세션을 회원 최대 횟수에 이미 사용된 수업으로 센다", async () => {
  const { reqs, pins } = pinQuotaFixture();
  const days = [0, 1, 2, 3];
  // 요일 순서·시드를 바꿔도(고정 요일보다 다른 요일을 먼저 짜도) 같은 불변조건을 지켜야 한다.
  for (const order of [days, days.slice().reverse()])
    for (const seedOffset of [0, 1, 2]) {
      const result = await runPipelineWithPins(reqs, pins, { order, seedOffset });
      const label = "후보A order=" + order + " seed=" + seedOffset;
      assertPinInvariants(result.assigned, pins, label);
      assertEqual(sessionsPerMember(result.assigned).P, 1, label + ": 1회 회원 추가 배정 금지");
      assertEqual(sessionsPerMember(result.assigned).R, 2, label + ": 2회 회원은 1회만 추가");
    }
});
testAsync("고정 세션: 후보A 다듬기는 옮기면 이동이 줄어드는 고정 세션도 같은 자리에 둔다", async () => {
  lib.state.locations = [{ id: "L1", name: "1" }, { id: "L2", name: "2" }];
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 20 };
  lib.state.onceLimitedMemberIds3 = [];
  lib.state.excludedMemberIds3 = [];
  lib.state.members = [
    { id: "A", locationIds: ["L1"], category: "상담" },
    { id: "B", locationIds: ["L1", "L2"], category: "상담" },
    { id: "C", locationIds: ["L1"], category: "상담" },
  ];
  const reqs = [
    { id: "a0", memberId: "A", day: 0, startSlot: 0, duration: 30 },
    { id: "b3", memberId: "B", day: 0, startSlot: 3, duration: 30 },
    { id: "b5", memberId: "B", day: 0, startSlot: 5, duration: 30 },
    { id: "c6", memberId: "C", day: 0, startSlot: 6, duration: 30 },
    { id: "c10", memberId: "C", day: 0, startSlot: 10, duration: 30 },
  ];
  // 고정 없이는 A0·B3·C6이 모두 L1에서 이동 없이 이어진다.
  const free = await runPipelineWithPins(reqs, []);
  assert(free.assigned.every((r) => r.locationId === "L1"), "고정 없이는 이동 없는 배치가 최선이어야 함(픽스처 확인)");
  // B를 L2·슬롯 5에 고정하면 이동 2번이 생기지만, 고정은 그대로 남아야 한다.
  const pin = { id: "b5", memberId: "B", day: 0, startSlot: 5, duration: 30, locationId: "L2" };
  for (const seedOffset of [0, 1, 2]) {
    for (const idleFirst of [false, true]) {
      lib.setIdleFirst(idleFirst);
      try {
        const result = await runPipelineWithPins(reqs, [pin], { seedOffset });
        assertPinInvariants(result.assigned, [pin], "seed=" + seedOffset + " idleFirst=" + idleFirst);
        assertEqual(lib.scheduleViolations(result).filter((v) => v.rule !== "availability"), []);
      } finally {
        lib.setIdleFirst(false);
      }
    }
  }
});
test("고정 세션: 수업 균형 빼기는 고정 세션을 빼지 않는다", () => {
  lib.state.locations = ineffLocations();
  lib.state.travelTimes = { [lib.pairKey("M", "Y")]: 20 };
  const s = (memberId, startSlot, locationId) => ({ memberId, day: 0, startSlot, locationId, duration: 50 });
  const lastA = s("A", 15, "Y");
  const result = scheduleResult([s("A", 0, "M"), s("B", 5, "M"), lastA], 0);
  assertEqual(lib.dropSessionsForBalance(result).assigned.length, 2, "고정이 없으면 빼는 경우(픽스처 확인)");
  assertEqual(lib.dropSessionsForBalance(result, [lastA]).assigned.length, 3);
});

// 재최적화 제안: qualityFixture의 정상 결과(화요일 빈 시간 30분)를 지금 수정 카드로, 화요일 S를 고정으로 둔다.
function reoptFixture() {
  qualityFixture();
  const current = validQualityResult();
  const pins = [at("S", 1, 0, "L1")];
  const r = (assigned) => ({ assigned, unassignedMembers: [] });
  const mon = [at("A", 0, 0, "L1"), at("B", 0, 6, "L1")];
  return {
    current,
    pins,
    // 화요일 C를 9로 당겨 빈 시간 0
    better: r(mon.concat([at("S", 1, 0, "L1"), at("C", 1, 9, "L3")])),
    // 같은 품질의 다른 배치: A가 화요일로(요일이 바뀐 배정 1건)
    betterVariant: r([at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("A", 1, 6, "L1"), at("C", 1, 15, "L3")]),
    // S(고정)를 3으로 옮겨 빈 시간 0 — 비교 기준으로는 better와 같지만 고정을 옮겼다
    movesPin: r(mon.concat([at("S", 1, 3, "L1"), at("C", 1, 12, "L3")])),
    // 수업 1건 추가(A 화요일 6) — 그러나 C까지 이동시간이 없다(하드 제약 위반)
    violatesHard: r(mon.concat([at("S", 1, 0, "L1"), at("A", 1, 6, "L1"), at("C", 1, 12, "L3")])),
  };
}
test("재최적화 제안: 고정을 지키고 추천 비교 기준으로 더 나은 결과를 제안하고, 같은 품질의 다른 배치를 함께 준다", () => {
  const f = reoptFixture();
  const out = lib.selectReoptimization(f.current, [f.betterVariant, f.better], f.pins);
  assertEqual(out.status, "improved");
  assert(lib.isSchedule2ResultBetter(out.proposal.result, f.current));
  assertEqual(out.variants.length, 2);
  assertEqual(out.variants[0], out.proposal);
  // 결과 순서와 무관하게 같은 제안
  const again = lib.selectReoptimization(f.current, [f.better, f.betterVariant], f.pins);
  assertEqual(lib.layoutSignature(again.proposal.result), lib.layoutSignature(out.proposal.result));
});
test("재최적화 제안: 고정 세션을 옮기거나 하드 제약을 어긴 결과는 비교 기준으로 더 나아도 제안하지 않는다", () => {
  const f = reoptFixture();
  assert(lib.isSchedule2ResultBetter(f.movesPin, f.current) && lib.isSchedule2ResultBetter(f.violatesHard, f.current), "픽스처 확인");
  const out = lib.selectReoptimization(f.current, [f.movesPin, f.violatesHard], f.pins);
  assertEqual([out.status, out.reason, out.proposal], ["no-better", "none", null]);
  assertEqual([out.stats.missingPins, out.stats.hardViolations], [1, 1]);
  const mixed = lib.selectReoptimization(f.current, [f.violatesHard, f.movesPin, f.better], f.pins);
  assertEqual(lib.layoutSignature(mixed.proposal.result), lib.layoutSignature(f.better));
});
test("재최적화 제안: 지금 카드보다 낫지 않으면 지금 카드를 유지하고 이유(같은 배치·동점·더 나쁨)를 구분한다", () => {
  const f = reoptFixture();
  const same = lib.selectReoptimization(f.current, [JSON.parse(JSON.stringify(f.current))], f.pins);
  assertEqual([same.status, same.reason], ["no-better", "same-layout"]);
  const swapped = { assigned: [at("B", 0, 0, "L1"), at("A", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")], unassignedMembers: [] };
  assertEqual(lib.selectReoptimization(f.current, [swapped], f.pins).reason, "equal-quality");
  const fewer = { assigned: f.current.assigned.filter((x) => x.memberId !== "B"), unassignedMembers: [lib.memberById("B")] };
  assertEqual(lib.selectReoptimization(f.current, [fewer], f.pins).reason, "worse");
});
test("재최적화 제안: 나빠지지 않음은 개별 지표가 아니라 추천 비교 기준이다(수업 1건이 늘면 빈 시간이 늘어도 제안)", () => {
  const f = reoptFixture();
  const moreIdle = { assigned: f.current.assigned.concat([at("S", 0, 14, "L1")]), unassignedMembers: [] };
  const out = lib.selectReoptimization(f.current, [moreIdle], f.pins);
  assertEqual(out.status, "improved");
  assert(out.proposal.metrics.idleMinutes > lib.scheduleMetrics(f.current).idleMinutes, "빈 시간은 늘었어야 함(픽스처 확인)");
});
test("재최적화 제안: 수업을 줄여 공강을 줄인 결과는 비교 기준으로 더 나아도 제안하지 않는다", () => {
  const f = reoptFixture();
  // 지금 카드: 월요일 S(14:00, B 뒤 빈 80분)를 더 넣은 카드. 그 1건을 빼면 수업 -1·빈 시간 -80분.
  const current = { assigned: f.current.assigned.concat([at("S", 0, 20, "L1")]), unassignedMembers: [] };
  const dropped = f.current;
  assert(lib.isSchedule2ResultBetter(dropped, current), "비교 기준으로는 더 나아야 함(픽스처 확인)");
  const out = lib.selectReoptimization(current, [dropped], f.pins);
  assertEqual([out.status, out.reason, out.proposal], ["no-better", "fewer-sessions", null]);
  assertEqual(out.stats.fewerSessions, 1);
  // 수업 수를 지킨 더 나은 결과가 함께 있으면 그것을 제안한다(S를 B 바로 뒤로).
  const kept = { assigned: f.current.assigned.concat([at("S", 0, 12, "L1")]), unassignedMembers: [] };
  const mixed = lib.selectReoptimization(current, [dropped, kept], f.pins);
  assertEqual(mixed.status, "improved");
  assertEqual(lib.layoutSignature(mixed.proposal.result), lib.layoutSignature(kept));
  // 미배정이 늘어난 결과도 같은 이유로 제안하지 않는다.
  const unassignedMore = { assigned: f.current.assigned.filter((x) => x.memberId !== "B"), unassignedMembers: [lib.memberById("B")] };
  assertEqual(lib.selectReoptimization(f.current, [unassignedMore], f.pins).reason, "worse");
});

test("재최적화 제안: 총 수업과 미배정 수가 유지되면 회원 간 수업 재배분(A -1회, B +1회)은 허용하고 재배분 정도를 센다", () => {
  const f = reoptFixture();
  // 지금 카드: 화요일 A(13:30) 앞에 빈 30분. A를 1회로 줄이고 B를 화요일에 넣으면 총 수업은 같고 빈 시간 0.
  const mon = [at("A", 0, 0, "L1"), at("B", 0, 6, "L1")];
  const current = { assigned: mon.concat([at("S", 1, 0, "L1"), at("A", 1, 9, "L1"), at("C", 1, 18, "L3")]), unassignedMembers: [] };
  const shifted = { assigned: mon.concat([at("S", 1, 0, "L1"), at("B", 1, 6, "L1"), at("C", 1, 15, "L3")]), unassignedMembers: [] };
  assert(lib.isSchedule2ResultBetter(shifted, current), "비교 기준으로는 더 나아야 함(픽스처 확인)");
  assertEqual(lib.scheduleViolations(shifted), [], "위반 없음(픽스처 확인)");
  assert(lib.keepsSessions(current, shifted));
  const out = lib.selectReoptimization(current, [shifted], f.pins);
  assertEqual(out.status, "improved");
  assertEqual(out.improving.map((e) => lib.layoutSignature(e.result)), [lib.layoutSignature(shifted)]);
  const { counts } = lib.assignmentDiff(current, shifted);
  assertEqual([counts.membersFewer, counts.membersMore, counts.sessionCountShift, counts.newlyUnassigned], [1, 1, 2, 0]);
});

test("재최적화 제안: 지금 카드와 더 비슷해도 품질이 낮은 결과는 고르지 않는다", () => {
  const f = reoptFixture();
  // 덜 바뀜: C만 10으로(빈 시간 30 → 10분). 더 나음: C를 9로 + 월요일 S 추가(수업 +1, 빈 시간 0) — 회원 2명 변경.
  const fewerChanges = { assigned: [at("A", 0, 0, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 10, "L3")], unassignedMembers: [] };
  const best = { assigned: f.better.assigned.concat([at("S", 0, 12, "L1")]), unassignedMembers: [] };
  assert(lib.isSchedule2ResultBetter(fewerChanges, f.current) && lib.isSchedule2ResultBetter(best, fewerChanges), "픽스처 확인");
  assertEqual(
    [lib.assignmentDiff(f.current, fewerChanges).counts.changedMembers, lib.assignmentDiff(f.current, best).counts.changedMembers],
    [1, 2],
    "픽스처 확인",
  );
  for (const results of [[fewerChanges, best], [best, fewerChanges]]) {
    const out = lib.selectReoptimization(f.current, results, f.pins);
    assertEqual(lib.layoutSignature(out.proposal.result), lib.layoutSignature(best));
    assertEqual(out.variants.length, 1, "품질이 낮은 결과는 variant로도 주지 않음");
  }
});
test("재최적화 제안: 품질이 완전히 같으면 지금 카드와 가장 비슷한 배치(변경 회원이 적은 쪽)를 먼저 제안한다", () => {
  const f = reoptFixture();
  // 지금 카드: 월요일 B → A 순서. 두 결과 모두 화요일 C를 9로 당겨 품질이 같다.
  // keepsOrder는 C만 바뀌고, restoresOrder는 월요일 A·B도 맞바꿔 3명이 바뀐다(한 명씩 되돌리면 겹쳐서 되돌리기로는 못 줄인다).
  const current = { assigned: [at("B", 0, 0, "L1"), at("A", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 12, "L3")], unassignedMembers: [] };
  const keepsOrder = { assigned: [at("B", 0, 0, "L1"), at("A", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 9, "L3")], unassignedMembers: [] };
  const restoresOrder = f.better;
  assert(!lib.isSchedule2ResultBetter(keepsOrder, restoresOrder) && !lib.isSchedule2ResultBetter(restoresOrder, keepsOrder), "픽스처 확인: 동점");
  assert(lib.layoutSignature(restoresOrder) < lib.layoutSignature(keepsOrder), "픽스처 확인: 서명 순서로는 restoresOrder가 앞");
  for (const results of [[restoresOrder, keepsOrder], [keepsOrder, restoresOrder]]) {
    const out = lib.selectReoptimization(current, results, f.pins);
    // 둘은 시작 시각만 달라(같은 회원·요일·지점) 유사 배치로 합쳐지고 제안 하나만 남는다.
    assertEqual(out.variants.map((v) => lib.layoutSignature(v.result)), [lib.layoutSignature(keepsOrder)]);
  }
});
test("재최적화 제안: 품질·고정·하드 제약을 지키면서 지금 자리로 되돌릴 수 있는 회원은 되돌린다", () => {
  const f = reoptFixture();
  // 수요일에 혼자 수업하는 D: 시작 시각을 바꿔도 품질이 같으므로 바꿀 이유가 없다.
  lib.state.members.push({ id: "D", name: "d", locationIds: ["L1"], category: "등록" });
  for (let s = 0; s <= 40; s++) lib.runtime.availableCells.add("2-" + s);
  for (let s = 0; s <= 30; s++) lib.state.requests.push({ id: "D2_" + s, memberId: "D", day: 2, startSlot: s, duration: 60 });
  const current = { assigned: f.current.assigned.concat([at("D", 2, 0, "L1")]), unassignedMembers: [] };
  const kept = { assigned: f.better.assigned.concat([at("D", 2, 0, "L1")]), unassignedMembers: [] };
  const moved = { assigned: f.better.assigned.concat([at("D", 2, 3, "L1")]), unassignedMembers: [] };
  assertEqual(lib.scheduleViolations(moved), [], "픽스처 확인");
  const out = lib.selectReoptimization(current, [moved], f.pins);
  assertEqual(lib.layoutSignature(out.proposal.result), lib.layoutSignature(kept));
  assertEqual(lib.assignmentDiff(current, out.proposal.result).members.map((m) => m.memberId), ["C"]);
  // 품질을 낮추는 되돌리기(C를 원래 12로)는 하지 않는다.
  assertEqual(lib.layoutSignature(lib.revertUnneededChanges(current, f.pins, kept)), lib.layoutSignature(kept));
});

// 국소 재최적화(5b-2a) 영향 범위. 세션 id = 회원+요일. 월: A0 B0 C0(seed, 옮겨 온 자리) D0 E0(확정만),
// 화: B1 G1, 수: G2 H2 I2, 목: C3. C는 원래 수요일 6에 있었다(그 자리는 비어 있다).
function impactFixture() {
  const s = (memberId, day, startSlot) => ({ id: memberId + day, memberId, day, startSlot, duration: 60, locationId: "L1" });
  const current = {
    assigned: [s("A", 0, 0), s("B", 0, 6), s("C", 0, 12), s("D", 0, 18), s("E", 0, 24), s("B", 1, 0), s("G", 1, 12), s("G", 2, 0), s("H", 2, 12), s("I", 2, 24), s("C", 3, 0)],
    unassignedMembers: [],
  };
  const userPins = [s("C", 0, 12), s("E", 0, 24)];
  return { current, userPins, origins: [{ day: 2, startSlot: 6 }] };
}
const movableIds = (region) => region.movable.map((a) => a.id).sort();
test("영향 범위: L1은 고정한 세션 바로 앞·뒤 1개씩, 원래 위치를 알면 원래 요일 빈자리 앞·뒤 1개씩만 움직일 수 있다", () => {
  const f = impactFixture();
  assertEqual(movableIds(lib.impactRegion(f.current, f.userPins, "L1")), ["B0", "D0"]);
  assertEqual(movableIds(lib.impactRegion(f.current, f.userPins, "L1", f.origins)), ["B0", "D0", "G2", "H2"]);
});
test("영향 범위: L2는 고정한 요일 전체와 원래 요일 전체, L3는 그 회원들의 다른 요일 세션까지, 전체는 사용자 고정만 남긴다", () => {
  const f = impactFixture();
  const ids = (level, origins) => movableIds(lib.impactRegion(f.current, f.userPins, level, origins));
  assertEqual(ids("L2"), ["A0", "B0", "D0"]);
  assertEqual(ids("L2", f.origins), ["A0", "B0", "D0", "G2", "H2", "I2"]);
  assertEqual(ids("L3"), ["A0", "B0", "B1", "C3", "D0"]); // C3: 고정한 회원 C의 다른 요일
  assertEqual(ids("L3", f.origins), ["A0", "B0", "B1", "C3", "D0", "G1", "G2", "H2", "I2"]);
  assertEqual(ids("full"), ["A0", "B0", "B1", "C3", "D0", "G1", "G2", "H2", "I2"]);
});
test("영향 범위: 사용자 고정은 어느 Level에서도 움직이지 않고, 범위 밖 세션은 모두 임시 고정되며, Level이 오를수록 범위가 줄지 않는다", () => {
  const f = impactFixture();
  let prev = [];
  for (const origins of [[], f.origins]) {
    prev = [];
    for (const level of lib.IMPACT_LEVELS) {
      const r = lib.impactRegion(f.current, f.userPins, level, origins);
      const pinned = new Set(r.pins.map(lib.pinKey));
      assert(f.userPins.every((p) => pinned.has(lib.pinKey(p))), level + ": 사용자 고정 유지");
      assert(r.movable.every((a) => !pinned.has(lib.pinKey(a))), level + ": 움직일 세션은 고정에 없음");
      assertEqual(r.pins.length + r.movable.length, r.total, level + ": 고정 + 움직임 = 전체");
      assertEqual([r.userPinned, r.tempPinned], [2, r.total - 2 - r.movable.length], level);
      assert(prev.every((id) => movableIds(r).includes(id)), level + ": 앞 Level 범위 포함");
      prev = movableIds(r);
    }
  }
  let threw = false;
  try {
    lib.impactRegion(f.current, f.userPins, "L4");
  } catch {
    threw = true;
  }
  assert(threw, "알 수 없는 Level은 거부");
});
testAsync("Level 진행: 움직일 세션이 없거나 앞 Level과 범위가 같으면 다시 생성하지 않는다", async () => {
  const s = (memberId, day, startSlot) => ({ id: memberId + day, memberId, day, startSlot, duration: 60, locationId: "L1" });
  // 월: C(고정) X, 화: Y — L1·L2·L3는 모두 {X}, 전체는 {X, Y}.
  const current = { assigned: [s("C", 0, 0), s("X", 0, 6), s("Y", 1, 0)], unassignedMembers: [] };
  const calls = [];
  const out = await lib.runImpactLevels(current, [s("C", 0, 0)], [], async (pins, level) => (calls.push([level, pins.length]), level));
  assertEqual(calls, [["L1", 2], ["full", 1]]);
  assertEqual(out.map((e) => [e.level, e.outcome, e.sameAs || null]), [["L1", "L1", null], ["L2", "L1", "L1"], ["L3", "L1", "L1"], ["full", "full", null]]);
  const lonely = { assigned: [s("C", 0, 0), s("Y", 1, 0)], unassignedMembers: [] };
  const out2 = await lib.runImpactLevels(lonely, [s("C", 0, 0)], [], async (pins, level) => level);
  assertEqual(out2.map((e) => e.skipped || e.outcome), ["empty", "empty", "empty", "full"]);
});
testAsync("Level 진행: 취소나 엔진 오류는 다음 Level·전체로 넘어가지 않고 그대로 실패한다", async () => {
  const f = impactFixture();
  for (const err of [new lib.GenerationCancelledError(), new Error("엔진 오류")]) {
    const calls = [];
    let caught = null;
    try {
      await lib.runImpactLevels(f.current, f.userPins, [], async (pins, level) => {
        calls.push(level);
        throw err;
      });
    } catch (e) {
      caught = e;
    }
    assert(caught === err, "같은 오류가 올라와야 함");
    assertEqual(calls, ["L1"]);
  }
});
test("후보A 예산 배율: 생략하거나 1이면 운영 예산 그대로이고, 0 이하·숫자 아님은 거부한다", () => {
  const ops = {
    search: lib.PER_GROUP_SEARCH_DEADLINE_MS,
    targetExtra: lib.TARGET_MATCH_EXTRA_SEARCH_BUDGET_MS,
    altBase: lib.TARGET_MATCH_ALT_BASE_BUDGET_MS,
    polishTotal: lib.PER_GROUP_TOTAL_POLISH_BUDGET_MS,
    minPolish: lib.MIN_POLISH_BUDGET_MS,
  };
  assert(Object.values(ops).every((x) => x > 0), "상수를 내보냈는지 확인");
  assertEqual(lib.groupBudgets(), ops);
  assertEqual(lib.groupBudgets(undefined), ops);
  assertEqual(lib.groupBudgets(1), ops);
  assertEqual(lib.groupBudgets(0.5).polishTotal, Math.round(ops.polishTotal / 2));
  for (const bad of [0, -1, NaN, Infinity, "0.5", null]) {
    let threw = false;
    try {
      lib.groupBudgets(bad);
    } catch {
      threw = true;
    }
    assert(threw, "거부해야 함: " + bad);
  }
});

// 국소 재최적화 앱 흐름(5b-2b). reoptimize 가짜: Level별 결과를 정해 두고 호출 순서를 기록한다.
function fakeLevels(byLevel) {
  const calls = [];
  const fn = async (pins, level) => {
    calls.push(level);
    const r = byLevel[level];
    if (r instanceof Error) throw r;
    return { status: r || "no-better", reason: r ? null : "equal-quality", level };
  };
  return { calls, fn };
}
const improved = (o) => o.status === "improved";
testAsync("국소 탐색: L1에서 개선안을 찾으면 그 Level에서 멈추고 L2를 자동으로 돌리지 않는다", async () => {
  const f = impactFixture();
  const search = lib.createLocalSearch(f.current, f.userPins, f.origins);
  const fake = fakeLevels({ L1: "improved", L2: "improved" });
  const found = await lib.continueLocalSearch(search, fake.fn, improved);
  assertEqual([found.level, fake.calls], ["L1", ["L1"]]);
  assertEqual(lib.nextLocalLevel(search), "L2");
});
testAsync("국소 탐색: 더 넓게 찾아보기는 다음 Level부터 이어서 한 Level씩 돌리고, 끝낸 Level은 다시 생성하지 않는다", async () => {
  const f = impactFixture();
  const search = lib.createLocalSearch(f.current, f.userPins, []);
  const fake = fakeLevels({ L1: "improved" });
  await lib.continueLocalSearch(search, fake.fn, improved);
  const widen = () => lib.continueLocalSearch(search, fake.fn, () => true);
  assertEqual((await widen()).level, "L2");
  assertEqual((await widen()).level, "L3");
  assertEqual(await widen(), null, "국소 Level을 다 보면 null(전체는 따로)");
  assertEqual(fake.calls, ["L1", "L2", "L3"]);
  assertEqual(lib.nextLocalLevel(search), null);
});
testAsync("국소 탐색: L1~L3가 모두 실패해도 전체 재최적화를 자동으로 돌리지 않는다", async () => {
  const f = impactFixture();
  const search = lib.createLocalSearch(f.current, f.userPins, []);
  const fake = fakeLevels({});
  assertEqual(await lib.continueLocalSearch(search, fake.fn, improved), null);
  assertEqual(fake.calls, ["L1", "L2", "L3"]);
  // 원래 위치를 알면 이 픽스처의 L3는 전체와 같은 범위라 국소로 돌리지 않는다(전체는 사용자가 고를 때만).
  const known = lib.createLocalSearch(f.current, f.userPins, f.origins);
  const fake2 = fakeLevels({});
  assertEqual(await lib.continueLocalSearch(known, fake2.fn, improved), null);
  assertEqual([fake2.calls, known.steps[2].skipped], [["L1", "L2"], "same-as-full"]);
});
testAsync("국소 탐색: 범위가 비었거나 앞 Level과 같거나 전체와 같으면 그 Level은 생성하지 않는다", async () => {
  const s = (memberId, day, startSlot) => ({ id: memberId + day, memberId, day, startSlot, duration: 60, locationId: "L1" });
  // 월: C(고정) X, 화: Y — L1·L2·L3 = {X}(L2·L3는 앞과 같음), 전체 = {X, Y}.
  const current = { assigned: [s("C", 0, 0), s("X", 0, 6), s("Y", 1, 0)], unassignedMembers: [] };
  const search = lib.createLocalSearch(current, [s("C", 0, 0)], []);
  const fake = fakeLevels({});
  await lib.continueLocalSearch(search, fake.fn, improved);
  assertEqual(fake.calls, ["L1"]);
  assertEqual(search.steps.map((x) => x.skipped || x.status), ["no-better", "same-as-previous", "same-as-previous"]);
  // 월: C(고정) X만 — L1부터 전체와 같은 범위라 국소 Level을 돌리지 않는다(전체 탐색만 남음).
  const only = { assigned: [s("C", 0, 0), s("X", 0, 6)], unassignedMembers: [] };
  const search2 = lib.createLocalSearch(only, [s("C", 0, 0)], []);
  assertEqual(lib.nextLocalLevel(search2), null);
  const fake2 = fakeLevels({});
  assertEqual(await lib.continueLocalSearch(search2, fake2.fn, improved), null);
  assertEqual(fake2.calls, []);
});
testAsync("국소 탐색: 취소하면 이후 Level을 돌리지 않고, 취소한 Level은 끝나지 않은 것으로 남는다", async () => {
  const f = impactFixture();
  const search = lib.createLocalSearch(f.current, f.userPins, f.origins);
  const cancel = new lib.GenerationCancelledError();
  const fake = fakeLevels({ L2: cancel });
  let caught = null;
  try {
    await lib.continueLocalSearch(search, fake.fn, improved);
  } catch (e) {
    caught = e;
  }
  assert(caught === cancel, "취소가 그대로 올라와야 함");
  assertEqual(fake.calls, ["L1", "L2"]);
  assertEqual(lib.nextLocalLevel(search), "L2");
});
testAsync("국소 Level은 외부 후보B·C를 부르지 않고 후보A만 국소 예산 배율로 부른다", async () => {
  assertEqual(lib.LOCAL_REOPTIMIZE_BUDGET_SCALE, 0.1);
  for (const level of lib.LOCAL_LEVELS) {
    const calls = [];
    const gen = await lib.generateForLevel(level, ["p"], {
      bc: async () => (calls.push("bc"), ["b"]),
      a: async (pins, scale) => (calls.push("a×" + scale), ["a"]),
    });
    assertEqual([calls, gen], [["a×0.1"], { bc: [], a: ["a"] }], level);
  }
});
testAsync("전체 재최적화는 후보B·C와 후보A를 모두 운영 예산(배율 생략)으로 부른다", async () => {
  const calls = [];
  const gen = await lib.generateForLevel("full", ["p"], {
    bc: async () => (calls.push("bc"), ["b"]),
    a: async (pins, scale) => (calls.push("a×" + scale), ["a"]),
  });
  assertEqual([calls, gen], [["bc", "a×undefined"], { bc: ["b"], a: ["a"] }]);
  assertEqual(lib.groupBudgets(lib.levelPlan("full").budgetScale), lib.groupBudgets(1), "배율 생략 = 운영 예산");
});
test("더 넓게 찾은 결과가 지금 제안보다 엄격히 낫지 않으면 기존 국소 제안을 그대로 둔다", () => {
  const f = reoptFixture();
  const local = { level: "L1", variants: [{ result: f.better }], variantIdx: 0 };
  const proposals = [local];
  for (const r of [f.current, f.betterVariant]) {
    assertEqual(lib.addWiderProposal(proposals, { level: "L2", variants: [{ result: r }] }), false);
    assertEqual(proposals, [local]);
  }
});
test("더 넓게 찾은 결과가 더 좋아도 기존 국소 제안을 덮어쓰지 않고 둘 다 남겨 사용자가 고르게 한다", () => {
  const f = reoptFixture();
  const fewer = { assigned: [at("A", 0, 0, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("C", 1, 10, "L3")], unassignedMembers: [] };
  const best = { assigned: f.better.assigned.concat([at("S", 0, 12, "L1")]), unassignedMembers: [] };
  assert(lib.isSchedule2ResultBetter(best, fewer), "픽스처 확인");
  const local = { level: "L1", variants: [{ result: fewer }], variantIdx: 0 };
  const proposals = [local];
  assertEqual(lib.addWiderProposal(proposals, { level: "L2", variants: [{ result: best }] }), true);
  assert(proposals[0] === local && proposals[0].variants[0].result === fewer, "첫 제안(변경 최소화)은 그대로");
  assertEqual(proposals.map((p) => p.level), ["L1", "L2"]);
  // 그다음 넓힌 결과는 지금까지 가장 좋은 제안(L2)보다 나아야 더해진다.
  assertEqual(lib.addWiderProposal(proposals, { level: "L3", variants: [{ result: f.better }] }), false);
});
test("재최적화 적용: 확정(confirmedIds)에는 사용자가 고정한 수업만 남고 국소 탐색의 임시 고정은 들어가지 않는다", () => {
  const f = reoptFixture();
  // 사용자 고정은 화요일 S뿐. 제안은 월요일 A·B(임시 고정되었던 자리)를 그대로 두고 C만 옮겼다.
  const target = { ...f.current, confirmedIds: [at("S", 1, 0, "L1").id] };
  const out = lib.reoptimizedCard(target, f.better);
  assertEqual(out.confirmedIds, [at("S", 1, 0, "L1").id]);
  assertEqual(lib.layoutSignature(out), lib.layoutSignature(f.better));
  assert(out.assigned !== f.better.assigned && out.assigned[0] !== f.better.assigned[0], "제안 객체를 복사");
});
testAsync("원래 위치를 모르면(되돌리기 기록 없음) 현재 위치만으로 국소 탐색이 정상 동작한다", async () => {
  const f = impactFixture();
  const none = lib.originsFromHistory(f.current, f.userPins, undefined);
  assertEqual(none, { origins: [], status: "no-history" });
  const search = lib.createLocalSearch(f.current, f.userPins, none.origins);
  const seen = [];
  const found = await lib.continueLocalSearch(
    search,
    async (pins, level) => (seen.push(lib.impactRegion(f.current, f.userPins, level).movable.length), { status: "improved" }),
    improved,
  );
  assertEqual([found.level, found.region.movable.map((a) => a.id).sort(), seen], ["L1", ["B0", "D0"], [2]]);
});
// 원래 위치 판정(originsFromHistory)은 실제 편집 함수(moveSession·confirm/unconfirm·편집 취소·재최적화 적용)가 쌓은
// 되돌리기 스택으로 검사한다. 월: A(마포 12:00) B(마포 13:00), 화: S(마포 12:00) A(마포 14:00).
function originFlow() {
  qualityFixture();
  lib.state.excludedMemberIds3 = [];
  const card = { assigned: [at("A", 0, 0, "L1"), at("B", 0, 6, "L1"), at("S", 1, 0, "L1"), at("A", 1, 12, "L1")], unassignedMembers: [], confirmedIds: [] };
  const noop = () => {};
  const find = (memberId, day) => card.assigned.find((a) => a.memberId === memberId && a.day === day);
  const realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => {}; // showToast
  return {
    card,
    move: (memberId, day, toDay, toSlot) => {
      const before = JSON.stringify(card.assigned);
      lib.moveSession(card, find(memberId, day), toDay, toSlot, noop);
      assert(JSON.stringify(card.assigned) !== before, "픽스처 확인: " + memberId + " 이동이 막힘");
    },
    confirm: (memberId, day) => lib.confirmSession(card, find(memberId, day).id, noop),
    unconfirm: (memberId, day) => lib.unconfirmSession(card, find(memberId, day).id, noop),
    undo: () => lib.undoManualEdit(card, noop),
    origin: () => lib.originsFromHistory(card, lib.pinsFromResult(card), lib.manualUndoStacks.get(card)),
    done: () => (globalThis.requestAnimationFrame = realRaf),
  };
}
const originCase = (fn) => () => {
  const f = originFlow();
  try {
    fn(f);
  } finally {
    f.done();
  }
};
test("원래 위치: 고정 수업을 옮기면 처음 자리만 원점이고, 연속으로 옮겨도 중간 자리는 원점이 아니다", originCase((f) => {
  f.move("A", 0, 0, 18);
  assertEqual(f.origin(), { origins: [{ day: 0, startSlot: 0 }], status: "known" });
  f.move("A", 0, 0, 24);
  assertEqual(f.origin(), { origins: [{ day: 0, startSlot: 0 }], status: "known" });
}));
test("원래 위치: 옮겼다 제자리로 돌려놓거나 확정만 했으면 원점이 없다(이동 없음)", originCase((f) => {
  f.move("A", 0, 0, 18);
  f.move("A", 0, 0, 0);
  assertEqual(f.origin(), { origins: [], status: "no-move" });
  f.confirm("B", 0);
  assertEqual(f.origin(), { origins: [], status: "no-move" });
}));
test("원래 위치: 편집 취소로 이동을 되돌리면 그 이동의 원점도 사라진다", originCase((f) => {
  f.move("A", 0, 0, 18);
  f.confirm("B", 0);
  f.undo();
  f.undo();
  assertEqual(f.origin(), { origins: [], status: "no-history" }, "기록이 비면 현재 위치만");
}));
test("원래 위치: 새로고침으로 되돌리기 기록이 없으면 이동이 없었다고 보지 않고 '기록 없음'으로 구분한다", originCase((f) => {
  f.move("A", 0, 0, 18);
  lib.manualUndoStacks.delete(f.card);
  assertEqual(f.origin(), { origins: [], status: "no-history" });
}));
test("원래 위치: 재최적화를 적용한 뒤 새 편집 없이 다시 재최적화하면 적용 전 이동·엔진이 옮긴 자리를 원점으로 쓰지 않는다", originCase((f) => {
  f.move("A", 0, 0, 18);
  // 제안: B가 A의 원래 자리(월 12:00)를 메우고, 엔진이 고정 회원 A의 고정 아닌 화요일 수업을 14:00 → 15:00으로 옮겼다.
  const proposal = { assigned: [f.card.assigned[0], at("B", 0, 0, "L1"), at("S", 1, 0, "L1"), at("A", 1, 18, "L1")], unassignedMembers: [] };
  lib.applyReoptimizedCard(f.card, proposal);
  assertEqual(f.origin(), { origins: [], status: "after-apply" });
  // 적용 뒤 새로 옮긴 고정 수업의 원점만 쓴다.
  f.move("A", 0, 0, 24);
  assertEqual(f.origin(), { origins: [{ day: 0, startSlot: 18 }], status: "known" });
  // 새 이동과 적용을 편집 취소하면 적용 표시도 함께 꺼져 적용 전 기록(첫 이동의 원점)을 다시 쓴다.
  f.undo();
  f.undo();
  assertEqual(f.origin(), { origins: [{ day: 0, startSlot: 0 }], status: "known" });
}));
test("원래 위치: 편집이 되돌리기 한도(20개)를 넘으면 남은 가장 오래된 상태(중간 위치)를 원점으로 쓰지 않는다", originCase((f) => {
  f.move("A", 0, 0, 18);
  for (let i = 0; i < 19; i++) (i % 2 ? f.unconfirm : f.confirm)("B", 0);
  f.move("A", 0, 0, 24); // 21번째 편집: 가장 오래된 스냅샷은 A가 중간 위치(월 15:00)에 있던 상태
  assertEqual(lib.manualUndoStacks.get(f.card).length, lib.MANUAL_UNDO_LIMIT);
  assertEqual(f.origin(), { origins: [], status: "truncated" });
  // 잘린 뒤라도 재최적화를 적용하면 그 이후 기록은 온전하다.
  lib.applyReoptimizedCard(f.card, { assigned: f.card.assigned, unassignedMembers: [] });
  assertEqual(f.origin().status, "after-apply");
}));
test("원래 위치: 옮긴 수업의 확정만 취소하면 같은 회원의 다른 확정 수업이 남아 있어도 옛 자리를 원점으로 쓰지 않는다", originCase((f) => {
  f.confirm("A", 1);
  f.move("A", 0, 0, 18);
  f.unconfirm("A", 0);
  assertEqual(lib.pinsFromResult(f.card).map((p) => p.day), [1], "픽스처 확인: A 화요일만 고정");
  assertEqual(f.origin(), { origins: [], status: "no-move" });
}));
test("원래 위치: 한 회원의 두 수업을 옮기고 하나만 확정 취소하면 어느 빈 자리가 원점인지 몰라 현재 위치만 쓴다", originCase((f) => {
  f.move("A", 0, 0, 18);
  f.move("A", 1, 1, 24);
  assertEqual(f.origin(), { origins: [{ day: 0, startSlot: 0 }, { day: 1, startSlot: 12 }], status: "known" });
  f.unconfirm("A", 1);
  assertEqual(f.origin(), { origins: [], status: "ambiguous" });
}));
test("계측: 제안 배치를 만든 엔진(후보A / B·C / 둘 다 / 되돌리기)을 구분한다", () => {
  const f = reoptFixture();
  assertEqual(lib.proposalSource(f.better, { a: [f.better], bc: [] }), "A");
  assertEqual(lib.proposalSource(f.better, { a: [], bc: [f.better] }), "BC");
  assertEqual(lib.proposalSource(f.better, { a: [f.better], bc: [f.better] }), "A+BC");
  assertEqual(lib.proposalSource(f.better, { a: [f.current], bc: [] }), "R");
});

function fakeWorkerFactory(reply) {
  const created = [];
  return {
    created,
    create() {
      const w = {
        terminated: false,
        onmessage: null,
        onerror: null,
        postMessage(msg) {
          if (msg.type === "run") setTimeout(() => !w.terminated && reply(w, msg), 1 + (msg.index % 3));
        },
        terminate() {
          w.terminated = true;
        },
      };
      created.push(w);
      return w;
    },
  };
}
const poolAttempts = Array.from({ length: 7 }, (_, i) => ({ order: [0], seedOffset: i }));

testAsync("다듬기 워커 결과는 끝나는 순서와 무관하게 시도 번호 자리에 들어간다", async () => {
  lib.state.members = [{ id: "U1", name: "u1" }];
  const factory = fakeWorkerFactory((w, msg) =>
    w.onmessage({ data: { index: msg.index, result: { assigned: [{ id: "s" + msg.seedOffset }], unassignedMemberIds: ["U1"] } } }),
  );
  let done = 0;
  const results = await lib.runPolishAttemptsInWorkers({}, poolAttempts, 10, () => done++, {
    createWorker: factory.create,
    workerCount: 3,
  });
  assertEqual(results.map((r) => r.assigned[0].id), poolAttempts.map((a) => "s" + a.seedOffset));
  assertEqual(done, poolAttempts.length);
  assert(results[0].unassignedMembers[0] === lib.state.members[0], "미배정 회원은 메인 스레드의 회원 객체여야 함");
  assert(factory.created.every((w) => w.terminated), "끝나면 워커를 모두 종료해야 함");
});

testAsync("다듬기 워커가 실패한 시도는 비워 두어 메인 스레드가 다시 계산하게 한다", async () => {
  let failed = null;
  const factory = fakeWorkerFactory((w, msg) => {
    if (failed === null) {
      failed = msg.index;
      return w.onmessage({ data: { index: msg.index, error: "boom" } });
    }
    w.onmessage({ data: { index: msg.index, result: { assigned: [], unassignedMemberIds: [] } } });
  });
  const warn = console.warn;
  console.warn = () => {};
  let results;
  try {
    results = await lib.runPolishAttemptsInWorkers({}, poolAttempts, 10, null, {
      createWorker: factory.create,
      workerCount: 2,
    });
  } finally {
    console.warn = warn;
  }
  results.forEach((r, i) =>
    assert(i === failed ? r === undefined : r !== undefined, "시도 " + i + " 결과 자리 오류"),
  );
});

testAsync("다듬기 워커 실행 중 취소하면 워커를 모두 종료하고 취소 에러를 던진다", async () => {
  const factory = fakeWorkerFactory(() => {}); // 응답하지 않는 워커
  setTimeout(() => (lib.runtime.generationCancelRequested = true), 20);
  let threw = null;
  try {
    await lib.runPolishAttemptsInWorkers({}, poolAttempts, 10, null, {
      createWorker: factory.create,
      workerCount: 2,
    });
  } catch (err) {
    threw = err;
  } finally {
    lib.runtime.generationCancelRequested = false;
  }
  assert(threw instanceof lib.GenerationCancelledError, "취소 에러를 던져야 함: " + threw);
  assert(factory.created.every((w) => w.terminated), "취소 시 워커를 모두 종료해야 함");
});

// 실제 엔진 워커 번들(src/engine/engineWorker.js)을 Node worker_threads에서 브라우저 Worker와
// 같은 모양으로 감싼다. fakeClock이면 워커 안 performance.now()를 호출마다 1ms씩 흐르는 가짜
// 시계로 바꿔 시간 예산을 결정적으로 만든다.
let engineWorkerBundle = null;
function createThreadWorker(fakeClock) {
  const { Worker: ThreadWorker } = require("worker_threads");
  if (!engineWorkerBundle)
    engineWorkerBundle = esbuild.buildSync({
      entryPoints: [path.join(__dirname, "..", "src", "engine", "engineWorker.js")],
      bundle: true,
      format: "iife",
      platform: "neutral",
      write: false,
      logLevel: "silent",
    }).outputFiles[0].text;
  const prelude =
    "const { parentPort } = require('worker_threads');" +
    (fakeClock ? "let fakeNow = 0; performance.now = () => (fakeNow += 1);" : "") +
    "globalThis.self = { postMessage: (m) => parentPort.postMessage(m) };" +
    "parentPort.on('message', (data) => self.onmessage({ data }));";
  const t = new ThreadWorker(prelude + engineWorkerBundle, { eval: true });
  return {
    postMessage: (m) => t.postMessage(m),
    terminate: () => t.terminate(),
    set onmessage(fn) {
      t.on("message", (data) => fn({ data }));
    },
    set onerror(fn) {
      t.on("error", (err) => fn({ message: String(err) }));
    },
  };
}

// 실제 워커 번들(src/engine/engineWorker.js)을 Node worker_threads에서 돌려, 메인 스레드에서
// 같은 시도를 다듬은 결과와 같은지 확인한다 — 파이프라인이 새로 읽게 된 상태를 워커에 넘기는
// 걸 빠뜨리면 결과가 조용히 달라지므로 그 회귀를 잡는다. 시간 예산을 결정적으로 만들기 위해
// 양쪽 다 performance.now()를 호출마다 1ms씩 흐르는 가짜 시계로 바꾼다.
function polishWorkerFixture() {
  lib.state.locations = [
    { id: "L1", name: "마포점" },
    { id: "L2", name: "여의도점" },
    { id: "L3", name: "상암점" },
  ];
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 20, [lib.pairKey("L1", "L3")]: 30, [lib.pairKey("L2", "L3")]: 40 };
  const rand = lib.mulberry32(6);
  lib.state.members = [];
  lib.state.requests = [];
  for (let i = 0; i < 10; i++) {
    const locs = ["L1", "L2", "L3"].filter(() => rand() < 0.5);
    if (!locs.length) locs.push("L1");
    const cat = rand() < 0.7 ? "등록" : "상담";
    lib.state.members.push({ id: "M" + i, name: "m" + i, locationIds: locs, category: cat });
    for (const day of [0, 1, 2, 3].filter(() => rand() < 0.6)) {
      const start = 20 + Math.floor(rand() * 20);
      for (let s = start; s < start + 6; s++)
        lib.state.requests.push({ id: "R" + i + "_" + day + "_" + s, memberId: "M" + i, day, startSlot: s, duration: cat === "상담" ? 30 : 60 });
    }
  }
  const eligibleReqs = lib.state.requests.filter((r) => r.memberId !== "M0");
  const reqsByDay = new Map([0, 1, 2, 3].map((d) => [d, eligibleReqs.filter((r) => r.day === d)]));
  const daysWithReqs = [0, 1, 2, 3].filter((d) => reqsByDay.get(d).length);
  const attempts = [
    { order: daysWithReqs, seedOffset: 1 },
    { order: daysWithReqs.slice().reverse(), seedOffset: 2 },
    { order: daysWithReqs, seedOffset: 97711 },
  ];
  return { eligibleReqs, reqsByDay, daysWithReqs, attempts };
}
const polishSig = (r) => JSON.stringify([
  r.assigned.map((a) => [a.id, a.memberId, a.day, a.startSlot, a.locationId]),
  r.unassignedMembers.map((m) => m.id),
]);
// 같은 시도를 워커(가짜 시계)와 메인 스레드(가짜 시계)에서 다듬어 [워커 결과, 메인 결과] 쌍을 돌려준다.
async function polishBothWays({ eligibleReqs, reqsByDay, daysWithReqs, attempts }, pins) {
  const realNow = performance.now;
  const realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  try {
    return await lib.withSelectionOverride(["M0"], ["M2"], async () => {
      const fromWorkers = await lib.runPolishAttemptsInWorkers(
        { eligibleReqs, reqsByDay, daysWithReqs, pins },
        attempts,
        400,
        null,
        { createWorker: () => createThreadWorker(true), workerCount: 2 },
      );
      const pairs = [];
      for (let i = 0; i < attempts.length; i++) {
        let fakeNow = 0;
        performance.now = () => (fakeNow += 1);
        const local = await lib.runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, attempts[i].order, true, true, 400, attempts[i].seedOffset, pins);
        performance.now = realNow;
        pairs.push([fromWorkers[i], local]);
      }
      return pairs;
    });
  } finally {
    performance.now = realNow;
    globalThis.requestAnimationFrame = realRaf;
  }
}
testAsync("워커에서 다듬은 결과는 메인 스레드에서 다듬은 결과와 같다", async () => {
  const { eligibleReqs, reqsByDay, daysWithReqs, attempts } = polishWorkerFixture();
  const sig = polishSig;
  const realNow = performance.now;
  const realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  const localSigsByMode = [];
  try {
    for (const idleFirst of [false, true]) {
      const localSigs = [];
      localSigsByMode.push(localSigs);
      lib.setIdleFirst(idleFirst);
      try {
        await lib.withSelectionOverride(["M0"], ["M2"], async () => {
          const fromWorkers = await lib.runPolishAttemptsInWorkers(
            { eligibleReqs, reqsByDay, daysWithReqs },
            attempts,
            400,
            null,
            { createWorker: () => createThreadWorker(true), workerCount: 2 },
          );
          for (let i = 0; i < attempts.length; i++) {
            let fakeNow = 0;
            performance.now = () => (fakeNow += 1);
            const local = await lib.runSchedule2Pipeline(eligibleReqs, reqsByDay, daysWithReqs, attempts[i].order, true, true, 400, attempts[i].seedOffset);
            performance.now = realNow;
            localSigs.push(sig(local));
            assert(fromWorkers[i], "워커 결과가 비어 있음(시도 " + i + ")");
            assertEqual(sig(fromWorkers[i]), sig(local), "idleFirst=" + idleFirst + " 시도 " + i);
          }
        });
      } finally {
        lib.setIdleFirst(false);
      }
    }
  } finally {
    performance.now = realNow;
    globalThis.requestAnimationFrame = realRaf;
  }
  // 이 데이터가 빈 시간 최소화 모드 전달 누락을 구분할 수 있어야 위 비교가 의미 있다.
  assert(
    localSigsByMode[0].some((s, i) => s !== localSigsByMode[1][i]),
    "테스트 데이터에서 빈 시간 최소화 모드가 결과를 바꾸지 않음 — 데이터를 조정해야 함",
  );
});

// 고정 세션이 다듬기 워커에 전달되지 않으면 워커만 고정 없이 다듬어 결과가 조용히 달라진다.
testAsync("고정 세션: 워커에서 다듬은 결과는 같은 고정 세션을 받아 메인 스레드와 같다", async () => {
  const fixture = polishWorkerFixture();
  const free = await polishBothWays(fixture, []);
  // 시도 2의 배정 일부(유효한 결과의 부분집합이라 서로 충돌하지 않음)를 고정해 시도 0·1을 흔든다.
  const pins = free[2][1].assigned.filter((_, i) => i % 3 === 0).map((a) => ({ ...a }));
  assert(pins.length >= 2, "고정할 세션이 있어야 함");
  const pinned = await polishBothWays(fixture, pins);
  pinned.forEach(([worker, local], i) => {
    assert(worker, "워커 결과가 비어 있음(시도 " + i + ")");
    assertEqual(polishSig(worker), polishSig(local), "고정 시도 " + i);
    assertEqual(lib.missingPins(local.assigned, pins), [], "고정 시도 " + i + " 고정 유지");
  });
  assert(
    pinned.some(([, local], i) => polishSig(local) !== polishSig(free[i][1])),
    "테스트 데이터에서 고정이 결과를 바꾸지 않음 — 데이터를 조정해야 함",
  );
});

// 워커 응답을 시도 번호에 따라 0~16ms씩 늦게 전달해, 워커 완료 순서가 번호 순서와 달라지게 한다.
function withScrambledReplies(worker) {
  let handler = null;
  worker.onmessage = (event) =>
    setTimeout(() => handler(event), (event.data.index * 7919) % 17);
  return {
    postMessage: (m) => worker.postMessage(m),
    terminate: () => worker.terminate(),
    set onmessage(fn) {
      handler = fn;
    },
    set onerror(fn) {
      worker.onerror = fn;
    },
  };
}

// 그리디 탐색은 시간 예산 없이 시드 난수로만 정해지므로, 워커 수와 무관하게 순차 실행과
// 결과(최선 후보·동점 풀 전체)가 바이트 단위로 같아야 한다. 워커가 끝나는 순서가 결과 선택에
// 영향을 주면 이 비교가 깨진다.
testAsync("그리디 탐색은 워커 수와 무관하게 순차 실행과 결과가 같다", async () => {
  lib.state.locations = [
    { id: "L1", name: "마포점" },
    { id: "L2", name: "여의도점" },
    { id: "L3", name: "상암점" },
  ];
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 20, [lib.pairKey("L1", "L3")]: 30, [lib.pairKey("L2", "L3")]: 40 };
  lib.state.members = [
    { id: "G0", name: "g0", locationIds: ["L1"], category: "등록" },
    { id: "G1", name: "g1", locationIds: ["L1", "L2"], category: "등록" },
    { id: "G2", name: "g2", locationIds: ["L2"], category: "상담" },
    { id: "G3", name: "g3", locationIds: ["L2"], category: "등록" },
    { id: "G4", name: "g4", locationIds: ["L1"], category: "등록" },
  ];
  lib.state.excludedMemberIds3 = ["G3"];
  lib.state.onceLimitedMemberIds3 = ["G1"];
  lib.state.requests = [];
  lib.runtime.availableCells = new Set();
  [0, 1].forEach((day) => {
    for (let s = 0; s < 20; s++) lib.runtime.availableCells.add(day + "-" + s);
    lib.state.members.slice(0, 4).forEach((m, k) => {
      for (let s = 3 * ((k + day) % 3); s < 3 * ((k + day) % 3) + 3; s++)
        lib.state.requests.push({ id: "q" + k + "_" + day + "_" + s, memberId: m.id, day, startSlot: s, duration: m.category === "상담" ? 30 : 60 });
    });
  });
  // G1만 신청한 요일 — 1회 제한(G1)이 있으면 G1은 한 번만, 없으면 두 번 배정될 수 있다.
  for (let s = 0; s < 20; s++) lib.runtime.availableCells.add("2-" + s);
  for (let s = 0; s < 3; s++)
    lib.state.requests.push({ id: "only1_" + s, memberId: "G1", day: 2, startSlot: s, duration: 60 });
  // 근무 셀 밖 신청만 낸 회원 — 항상 미배정이고, 워커가 근무 셀을 못 받으면 결과가 달라진다.
  lib.state.requests.push({ id: "out", memberId: "G4", day: 1, startSlot: 40, duration: 60 });
  const snapshot = (r) =>
    JSON.stringify({ built: r.built, pools: r.pools });
  const realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  try {
    const sequential = snapshot(await lib.generateCandidatesAsync(() => {}, { workerCount: 0, attempts: 120 }));
    const eligible = lib.state.requests.filter(lib.isEligibleRequest);
    const eligibleIds = new Set(eligible.map((r) => r.id));
    const allMemberIds = new Set(
      lib.state.requests.filter((r) => !lib.state.excludedMemberIds3.includes(r.memberId)).map((r) => r.memberId),
    );
    const sequentialPool = JSON.stringify(
      await lib.buildGreedySearchPool(eligible, eligibleIds, allMemberIds, () => {}, { workerCount: 0, attempts: 120 }),
    );
    // 이 데이터에서 1회 제한이 결과를 실제로 바꿔야, 워커가 1회 제한 목록을 빠뜨렸을 때 위
    // 비교가 깨진다.
    lib.state.onceLimitedMemberIds3 = [];
    const withoutOnceLimit = snapshot(await lib.generateCandidatesAsync(() => {}, { workerCount: 0, attempts: 120 }));
    lib.state.onceLimitedMemberIds3 = ["G1"];
    assert(withoutOnceLimit !== sequential, "테스트 데이터에서 1회 제한이 결과를 바꾸지 않음 — 데이터를 조정해야 함");
    // 고정 세션도 워커에 그대로 전달돼야 한다(빠뜨리면 워커 쪽 시도만 고정 없이 계산된다).
    // G1(1회 제한)을 월요일 여의도점에 고정하면 G1의 수요일 배정과 월요일 G0 자리가 함께 바뀐다.
    const pins = [{ id: "q1_0_3", memberId: "G1", day: 0, startSlot: 3, duration: 60, locationId: "L2" }];
    const pinnedSeq = snapshot(await lib.generateCandidatesAsync(() => {}, { workerCount: 0, attempts: 120 }, pins));
    assert(pinnedSeq !== sequential, "테스트 데이터에서 고정이 결과를 바꾸지 않음 — 데이터를 조정해야 함");
    const pinnedPar = await lib.generateCandidatesAsync(() => {}, {
      workerCount: 2,
      attempts: 120,
      createWorker: () => withScrambledReplies(createThreadWorker(false)),
    }, pins);
    assertEqual(snapshot(pinnedPar), pinnedSeq, "고정 세션 + 워커 2개");
    pinnedPar.pools.flat().forEach((c) => assertEqual(lib.missingPins(c.assigned, pins), [], "고정 유지"));
    let anyUnassigned = false;
    for (const workerCount of [1, 2, 3]) {
      const parallel = await lib.generateCandidatesAsync(() => {}, {
        workerCount,
        attempts: 120,
        // 시도 번호마다 응답을 다르게 지연시켜 완료 순서를 일부러 섞는다.
        createWorker: () => withScrambledReplies(createThreadWorker(false)),
      });
      assertEqual(snapshot(parallel), sequential, "워커 " + workerCount + "개");
      // 최종 선택만이 아니라 시도 결과 배열 전체가 순차 실행과 같은 자리·순서여야 한다.
      const parallelPool = await lib.buildGreedySearchPool(eligible, eligibleIds, allMemberIds, () => {}, {
        workerCount,
        attempts: 120,
        createWorker: () => withScrambledReplies(createThreadWorker(false)),
      });
      assertEqual(JSON.stringify(parallelPool), sequentialPool, "워커 " + workerCount + "개 시도 배열");
      parallel.pools.flat().forEach((c) =>
        c.unassignedMembers.forEach((m) => {
          anyUnassigned = true;
          assert(lib.state.members.includes(m), "미배정 회원은 메인 스레드의 회원 객체여야 함");
        }),
      );
    }
    assert(anyUnassigned, "테스트 데이터에 미배정 회원이 있어야 회원 객체 복원을 확인할 수 있음");
  } finally {
    globalThis.requestAnimationFrame = realRaf;
    lib.state.excludedMemberIds3 = [];
    lib.state.onceLimitedMemberIds3 = [];
  }
});

/* ---------------- 연속 요일 배정 제외 회원 ---------------- */
// N(등록, 최대 2회)은 같은 시각에 요일마다 신청한다. 지점 하나라 이동·간격은 영향이 없다.
function noConsecutiveFixture(days) {
  lib.state.locations = [{ id: "L1", name: "1" }];
  lib.state.travelTimes = {};
  lib.state.excludedMemberIds3 = [];
  lib.state.onceLimitedMemberIds3 = [];
  lib.state.noConsecutiveDayMemberIds = ["N"];
  lib.state.members = [{ id: "N", name: "n", locationIds: ["L1"], category: "등록" }];
  lib.runtime.availableCells = new Set();
  lib.state.requests = [];
  [0, 1, 2, 3, 4, 5].forEach((day) => {
    for (let s = 0; s <= 40; s++) lib.runtime.availableCells.add(day + "-" + s);
  });
  days.forEach((day) =>
    lib.state.requests.push({ id: "N" + day, memberId: "N", day, startSlot: 12, duration: 60 }),
  );
  return lib.state.requests.slice();
}
const daysOf = (assigned, id) => assigned.filter((a) => a.memberId === id).map((a) => a.day).sort();
const consecutiveViolations = (r) => lib.scheduleViolations(r).filter((v) => v.rule === "consecutiveDay");
function resetNoConsecutive() {
  lib.state.noConsecutiveDayMemberIds = [];
  lib.state.onceLimitedMemberIds3 = [];
}

test("연속 요일 배정 제외: 월·화~금·토는 금지, 월·수·화·목·월·금·토·월은 허용, 같은 요일은 하루 1회 규칙", () => {
  noConsecutiveFixture([]);
  try {
    for (let d = 0; d < 5; d++) assertEqual(lib.memberDayViolation("N", d + 1, [d]), "consecutiveDay", d + "·" + (d + 1));
    assertEqual(lib.memberDayViolation("N", 2, [0]), null, "월·수");
    assertEqual(lib.memberDayViolation("N", 3, [1]), null, "화·목");
    assertEqual(lib.memberDayViolation("N", 4, new Set([0])), null, "월·금");
    assertEqual(lib.memberDayViolation("N", 0, [5]), null, "토·월은 일요일이 끼어 연속이 아님");
    assertEqual(lib.memberDayViolation("N", 1, [1]), "sameDay");
    assertEqual(lib.memberDayViolation("O", 1, [0]), null, "선택하지 않은 회원은 연속 요일 허용");
  } finally {
    resetNoConsecutive();
  }
});
test("연속 요일 배정 제외: scheduleViolations는 시간·지점이 달라도 연속 요일 배정을 위반으로 잡는다", () => {
  noConsecutiveFixture([0, 1, 2]);
  try {
    const r = (days) => ({ assigned: days.map((d) => ({ ...lib.state.requests.find((q) => q.day === d), locationId: "L1" })), unassignedMembers: [] });
    assertEqual(consecutiveViolations(r([0, 1])).length, 1, "월·화");
    assertEqual(consecutiveViolations(r([0, 2])), [], "월·수");
    lib.state.noConsecutiveDayMemberIds = [];
    assertEqual(consecutiveViolations(r([0, 1])), [], "선택 회원이 없으면 위반 아님");
  } finally {
    resetNoConsecutive();
  }
});
test("연속 요일 배정 제외: 그리디는 연속 요일만 가능하면 제한을 풀지 않고 1회만 배정한다", () => {
  const reqs = noConsecutiveFixture([0, 1]);
  try {
    assertEqual(daysOf(lib.greedyAssign(reqs, {}), "N"), [0]);
    lib.state.noConsecutiveDayMemberIds = [];
    assertEqual(daysOf(lib.greedyAssign(reqs, {}), "N"), [0, 1], "선택하지 않으면 기존대로 월·화 2회");
  } finally {
    resetNoConsecutive();
  }
});
test("연속 요일 배정 제외: 그리디는 월·화·수 신청이면 월·수로 2회를 배정한다", () => {
  const reqs = noConsecutiveFixture([0, 1, 2]);
  try {
    assertEqual(daysOf(lib.greedyAssign(reqs, {}), "N"), [0, 2]);
  } finally {
    resetNoConsecutive();
  }
});
test("연속 요일 배정 제외: 1회 제한 회원과 함께 선택되면 1회만 배정한다", () => {
  const reqs = noConsecutiveFixture([0, 2]);
  lib.state.onceLimitedMemberIds3 = ["N"];
  try {
    assertEqual(lib.greedyAssign(reqs, {}).length, 1);
  } finally {
    resetNoConsecutive();
  }
});
test("연속 요일 배정 제외: 그리디는 고정 세션의 앞뒤 요일에도 추가 배정하지 않는다", () => {
  const reqs = noConsecutiveFixture([1, 2, 4]);
  try {
    const pin = { ...reqs[0], locationId: "L1" }; // 화 고정
    assertEqual(daysOf(lib.greedyAssign(reqs, {}, [pin]), "N"), [1, 4], "수는 화 다음날이라 금으로");
  } finally {
    resetNoConsecutive();
  }
});
// 다듬기 파이프라인(후보A) 결과를 가짜 시계로 결정적으로 만든다.
async function pipelineOnce(reqs, seedOffset, pins = []) {
  const realNow = performance.now;
  const realRaf = globalThis.requestAnimationFrame;
  let fakeNow = 0;
  performance.now = () => (fakeNow += 1);
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  try {
    const reqsByDay = new Map();
    reqs.forEach((r) => {
      if (!reqsByDay.has(r.day)) reqsByDay.set(r.day, []);
      reqsByDay.get(r.day).push(r);
    });
    const days = [...reqsByDay.keys()].sort((a, b) => a - b);
    return await lib.runSchedule2Pipeline(reqs, reqsByDay, days, days, true, true, 400, seedOffset, pins);
  } finally {
    performance.now = realNow;
    globalThis.requestAnimationFrame = realRaf;
  }
}
testAsync("연속 요일 배정 제외: 후보A 다듬기는 연속 요일만 가능하면 1회, 월·화·수면 월·수로 배정한다", async () => {
  try {
    assertEqual(daysOf((await pipelineOnce(noConsecutiveFixture([0, 1]), 0)).assigned, "N"), [0]);
    assertEqual(daysOf((await pipelineOnce(noConsecutiveFixture([0, 1, 2]), 0)).assigned, "N"), [0, 2]);
    const pin = { ...noConsecutiveFixture([1, 2, 4])[0], locationId: "L1" };
    assertEqual(daysOf((await pipelineOnce(lib.state.requests.slice(), 0, [pin])).assigned, "N"), [1, 4], "고정 화요일 다음날 제외");
  } finally {
    resetNoConsecutive();
  }
});
// 여러 회원이 서로 자리를 다투는 무작위 입력에서 다듬기(이동·맞바꾸기·연쇄·담금질)가 만든 결과 전부.
testAsync("연속 요일 배정 제외: 후보A 다듬기의 이동·맞바꾸기·연쇄 재배치도 연속 요일을 만들지 않는다", async () => {
  const rand = lib.mulberry32(42);
  lib.state.locations = [{ id: "L1", name: "1" }, { id: "L2", name: "2" }];
  lib.state.travelTimes = { [lib.pairKey("L1", "L2")]: 20 };
  lib.state.excludedMemberIds3 = [];
  lib.state.onceLimitedMemberIds3 = [];
  lib.state.members = [];
  lib.state.requests = [];
  lib.runtime.availableCells = new Set();
  for (let day = 0; day < 6; day++) for (let s = 0; s <= 60; s++) lib.runtime.availableCells.add(day + "-" + s);
  for (let i = 0; i < 14; i++) {
    const locs = rand() < 0.5 ? ["L1"] : rand() < 0.5 ? ["L2"] : ["L1", "L2"];
    lib.state.members.push({ id: "M" + i, name: "m" + i, locationIds: locs, category: "등록" });
    for (let day = 0; day < 6; day++) {
      if (rand() < 0.4) continue;
      const start = 6 + Math.floor(rand() * 30);
      for (let s = start; s < start + 8; s++)
        lib.state.requests.push({ id: "R" + i + "_" + day + "_" + s, memberId: "M" + i, day, startSlot: s, duration: 60 });
    }
  }
  lib.state.noConsecutiveDayMemberIds = lib.state.members.filter((_, i) => i % 2 === 0).map((m) => m.id);
  try {
    let checked = 0;
    for (const seed of [0, 1, 2, 3]) {
      const r = await pipelineOnce(lib.state.requests.slice(), seed);
      assertEqual(lib.scheduleViolations(r), [], "시드 " + seed);
      checked += r.assigned.filter((a) => lib.state.noConsecutiveDayMemberIds.includes(a.memberId)).length;
    }
    assert(checked > 0, "선택 회원이 실제로 배정돼야 검사한 것");
  } finally {
    resetNoConsecutive();
  }
});
toastTest("연속 요일 배정 제외: 수동 이동은 연속 요일로 막고 하루 건너 요일로는 허용한다", () => {
  noConsecutiveFixture([0, 1, 2, 3]);
  try {
    const at2 = (day) => ({ ...lib.state.requests.find((q) => q.day === day), locationId: "L1" });
    const container = { assigned: [at2(0), at2(3)], confirmedIds: [] };
    const r = lib.validateMove(container, container.assigned[1], 1, 12);
    assert(!r.ok && /연속 요일/.test(r.message), "목→화는 월 다음날: " + JSON.stringify(r));
    assert(lib.validateMove(container, container.assigned[1], 2, 12).ok, "목→수는 월과 하루 건너");
    lib.state.noConsecutiveDayMemberIds = [];
    assert(lib.validateMove(container, container.assigned[1], 1, 12).ok, "선택하지 않으면 허용");
  } finally {
    resetNoConsecutive();
  }
});
toastTest("연속 요일 배정 제외: 맞바꾸기로 연속 요일이 되면 막고, 회원 교체 후보에서도 뺀다", () => {
  noConsecutiveFixture([0, 1, 2]);
  try {
    lib.state.members.push({ id: "O", name: "o", locationIds: ["L1"], category: "등록" });
    [1, 2].forEach((day) => lib.state.requests.push({ id: "O" + day, memberId: "O", day, startSlot: 12, duration: 60 }));
    const atM = (id, day) => ({ ...lib.state.requests.find((q) => q.memberId === id && q.day === day), locationId: "L1" });
    // N: 월·수, O: 화. N의 수요일과 O의 화요일을 맞바꾸면 N이 월·화가 된다.
    const n0 = atM("N", 0), n2 = atM("N", 2), o1 = atM("O", 1);
    const container = { assigned: [n0, n2, o1], unassignedMembers: [], confirmedIds: [] };
    assertEqual(consecutiveViolations(container), [], "픽스처 확인");
    const swap = lib.prepareSwap(container, n2, o1);
    assert(!swap.ok && /연속 요일/.test(swap.message), JSON.stringify(swap));
    // O의 화요일 자리를 N으로 교체하면 N이 월·화·수가 되므로 후보가 아니다(같은 시각 신청은 있음).
    const solo = { assigned: [n0, o1], unassignedMembers: [], confirmedIds: [] };
    assert(!lib.eligibleSwapMembersFor(solo, o1).some((m) => m.id === "N"), "월 배정된 N은 화요일 자리로 교체 불가");
    lib.state.noConsecutiveDayMemberIds = [];
    assert(lib.eligibleSwapMembersFor(solo, o1).some((m) => m.id === "N"), "선택하지 않으면 교체 후보");
  } finally {
    resetNoConsecutive();
  }
});
test("연속 요일 배정 제외: 새로고침(loadState) 후 유지하고, 옛 저장분·손상값·삭제된 회원은 빈 목록·정리로 읽는다", () => {
  const originalGetItem = globalThis.localStorage.getItem;
  const load = (extra) => {
    globalThis.localStorage.getItem = () => JSON.stringify({ schemaVersion: 1, startMinBase: 12 * 60, locations: [{ id: "L1", name: "마포점" }], members: [{ id: "M1", name: "a", locationIds: ["L1"], category: "등록" }], ...extra });
    lib.loadState();
    return lib.state.noConsecutiveDayMemberIds;
  };
  try {
    assertEqual(load({ noConsecutiveDayMemberIds: ["M1"] }), ["M1"]);
    assertEqual(load({}), [], "옛 저장분(필드 없음)은 빈 목록");
    assertEqual(load({ noConsecutiveDayMemberIds: "M1" }), [], "배열이 아니면 비움");
    assertEqual(load({ noConsecutiveDayMemberIds: ["M1", "gone", 3] }), ["M1"], "없는 회원·문자열 아닌 값 정리");
  } finally {
    globalThis.localStorage.getItem = originalGetItem;
    resetNoConsecutive();
  }
});
test("연속 요일 배정 제외: 백업에 포함되고 복원 시 유지되며, 문자열 배열이 아니면 거부한다", () => {
  const data = { ...validBackupFixture(), noConsecutiveDayMemberIds: ["M1"] };
  assertEqual(lib.createPortableBackupState(data).noConsecutiveDayMemberIds, ["M1"]);
  assertEqual(lib.prepareBackupStateForRestore(lib.createPortableBackupState(data)).noConsecutiveDayMemberIds, ["M1"]);
  assertEqual(lib.createPortableBackupState(validBackupFixture()).noConsecutiveDayMemberIds, [], "옛 백업은 빈 목록");
  let threw = false;
  try {
    lib.validateBackupState({ ...validBackupFixture(), noConsecutiveDayMemberIds: [1] });
  } catch {
    threw = true;
  }
  assert(threw, "숫자 목록은 거부");
});
test("연속 요일 배정 제외: 선택이 없으면 입력 지문이 필드가 없을 때와 같고(기존 후보 유지), 워커에도 목록을 넘긴다", () => {
  qualityFixture();
  lib.state.noConsecutiveDayMemberIds = [];
  const key = lib.candidateInputKey();
  delete lib.state.noConsecutiveDayMemberIds;
  assertEqual(lib.candidateInputKey(), key);
  lib.state.noConsecutiveDayMemberIds = ["A"];
  try {
    assertEqual(lib.engineWorkerInit("greedy", {}).state.noConsecutiveDayMemberIds, ["A"]);
  } finally {
    resetNoConsecutive();
  }
});

(async () => {
  for (const { name, fn } of asyncTests) {
    try {
      await fn();
      pass++;
    } catch (err) {
      fail++;
      console.error("FAIL: " + name);
      console.error("  " + (err && err.stack ? err.stack : err));
    }
  }
  console.log(pass + "개 통과, " + fail + "개 실패 (단위 테스트)");
  if (fail > 0) process.exit(1);
})();
