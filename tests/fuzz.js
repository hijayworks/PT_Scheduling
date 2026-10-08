#!/usr/bin/env node
// 퍼즈/프로퍼티 테스트: 시드마다 무작위 입력(회원·지점·이동시간·신청·근무 셀·제외/1회 제한)을
// 만들어 후보B·C(매 시드)와 후보A(일부 시드, 축소 예산 + 가짜 시계)를 실제 생성 진입점으로
// 만들고, 표시 후보와 동점 배치 전부가 하드 제약(scheduleQuality.js의 HARD_RULES)을 지키는지
// 검사한다. 특정 정답 배치가 아니라 "어떤 입력이든 규칙은 지킨다"만 본다.
// 재최적화(5a): 시드마다 생성한 결과에서 세션 1~3개(절반은 같은 요일 2개 이상)를 고정으로 골라 같은
// 입력을 고정 세션과 함께 다시 생성하고, 그 결과 전부가 하드 제약에 더해 고정 유지(pinKept)·고정
// 회원 횟수(pinQuota)를 지키는지 본다. 고정을 고른 결과를 "지금 카드"로 두고 selectReoptimization이
// 내준 제안·동점 variant·개선 목록 전부가 고정 유지·하드 제약·총 수업 수와 미배정 수 유지를 지키고 지금
// 카드보다 엄격히 나은지, 제안·variant가 개선 결과 중 품질 최선보다 낮지 않은지(reoptProposal, 5b-1)도 본다.
// 국소 재최적화(5b-2a): 같은 고정에서 모든 Level의 영향 범위 구조(impactRegion)를 검사하고, 시드가 고른
// Level 하나의 범위(나머지 기존 세션은 임시 고정)로 다시 생성해 위 규칙을 그 고정 집합으로 똑같이 본다.
//
// 모든 입력은 시드 하나로 결정되고 후보A도 가짜 시계라, 같은 시드는 항상 같은 결과를 낸다.
//
//   node tests/fuzz.js                       CI 기본: 시드 1~FUZZ_CI_COUNT, 후보A는 FUZZ_A_EVERY번째마다
//   node tests/fuzz.js --seed 137            시드 하나만 다시 실행(실패 재현용, 입력 요약 출력)
//   node tests/fuzz.js --start 1000 --count 5000 --a-every 50   수동 stress
//   node tests/fuzz.js --dump 137            시드 137의 입력 state를 JSON으로 출력(골든 케이스 형식)
//   --attempts N    그리디 시도 횟수(기본 FUZZ_ATTEMPTS)
//   --no-shrink     실패 시 입력 축소(회원을 하나씩 빼며 같은 규칙 위반이 남는지 확인) 생략
//
// 실패하면 시드, 재현 명령, 위반 규칙, 축소한 입력 state 파일 경로를 출력하고 exit 1.
// 축소한 입력은 tests/golden/에 그대로 넣어 회귀 케이스로 만들 수 있는 형식이다.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCaseRunner } = require("./caseRunner.js");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
// 알고리즘 튜닝값(테스트 예산): CI에서 돌릴 시드 수, 그리디 시도 횟수, 후보A를 돌릴 간격.
const FUZZ_CI_COUNT = 200;
const FUZZ_ATTEMPTS = 2;
const FUZZ_A_EVERY = 10;
const FUZZ_A_GREEDY_ATTEMPTS = 1;
const attempts = opt("--attempts", FUZZ_ATTEMPTS);
const aEvery = opt("--a-every", FUZZ_A_EVERY);
// 과거에 위반을 낸 시드: 범위와 상관없이 항상 후보A까지 함께 돌린다(회귀 방지).
// 1963·1355·1804·4979 — 후보A 다듬기가 회원을 빼며 이동시간이 누락된 지점 쌍을 이어 붙임(gap).
const REGRESSION_SEEDS = [1963, 1355, 1804, 4979];

/* ---------------- 입력 생성기 ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOT_COUNT = 72; // 12:00~24:00, 10분 슬롯
const DAY_COUNT = 6; // 월~토
const NAMED_LOCATIONS = ["마포점", "여의도점", "상암점"]; // 비효율 왕복·세 지점 회원 규칙이 켜지는 이름
// 시드 % 길이로 경계 조건 하나를 반드시 끼운다 — CI 시드 범위 안에서 각 경계가 고르게 나온다.
// 나머지 차원은 시드 난수로 섞는다.
const SCENARIOS = [
  "members-0",
  "members-1",
  "members-32",
  "members-33",
  "members-64",
  "members-65",
  "single-location",
  "four-locations",
  "same-time",
  "sparse-cells",
  "odd-travel",
  "missing-travel",
  "heavy-requester",
  "excluded-once-overlap",
  "no-allowed-location",
  "random",
];

function fuzzInput(seed) {
  const rand = mulberry32(seed);
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const chance = (p) => rand() < p;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const scenario = SCENARIOS[seed % SCENARIOS.length];

  // 지점과 이동시간
  const locCount =
    scenario === "single-location"
      ? 1
      : scenario === "four-locations"
        ? 4
        : pick([1, 2, 3, 3, 3]);
  let names;
  if (locCount >= 3)
    names = NAMED_LOCATIONS.concat("기타점").slice(0, locCount);
  else if (chance(0.5))
    names = NAMED_LOCATIONS.slice()
      .sort(() => rand() - 0.5)
      .slice(0, locCount);
  else names = ["가점", "나점"].slice(0, locCount);
  names.sort(() => rand() - 0.5);
  const locations = names.map((name, i) => ({ id: "L" + (i + 1), name }));
  const locIds = locations.map((l) => l.id);
  const travelTimes = {};
  const pairs = [];
  locIds.forEach((a, i) =>
    locIds.slice(i + 1).forEach((b) => pairs.push([a, b])),
  );
  const missingPair =
    scenario === "missing-travel" && pairs.length ? pick(pairs) : null;
  pairs.forEach((pair) => {
    if (pair === missingPair || chance(0.05)) return; // 이동시간 누락
    travelTimes[pair.join("|")] =
      scenario === "odd-travel"
        ? pick([5, 7, 15, 25, 35, 45, 55])
        : pick([0, 10, 15, 20, 30, 30, 40, 60]);
  });

  // 회원
  const forcedCount = /^members-(\d+)$/.exec(scenario);
  const n = forcedCount ? Number(forcedCount[1]) : int(2, 20);
  const big = n >= 32;
  const members = [];
  for (let i = 0; i < n; i++) {
    const category = chance(0.3) ? "상담" : "등록";
    let memberLocs = locIds.filter(() => chance(0.5));
    if (!memberLocs.length) memberLocs = [pick(locIds)];
    if (scenario === "no-allowed-location" && chance(0.4))
      memberLocs = chance(0.5) ? [] : ["DELETED"];
    members.push({
      id: "M" + i,
      name: "회원" + i,
      locationIds: memberLocs,
      category,
    });
  }

  // 근무 가능 셀
  const cells = new Set();
  if (scenario === "sparse-cells") {
    const runs = int(1, 4);
    for (let k = 0; k < runs; k++) {
      const day = int(0, DAY_COUNT - 1),
        start = int(0, SLOT_COUNT - 3),
        len = int(1, 8);
      for (let s = start; s < Math.min(SLOT_COUNT, start + len); s++)
        cells.add(day + "-" + s);
    }
  } else if (!chance(0.03)) {
    for (let day = 0; day < DAY_COUNT; day++) {
      if (day === 5 ? !chance(0.3) : chance(0.15)) continue;
      const from = chance(0.7) ? 12 : int(0, 40),
        to = chance(0.7) ? 69 : int(from + 1, SLOT_COUNT);
      for (let s = from; s < to; s++) cells.add(day + "-" + s);
    }
  }

  // 신청: 앱과 같이 "시작 가능 시각 구간"마다 10분 간격 신청 하나씩(같은 회원·요일·시각은 하나).
  const requests = [];
  const seenStart = new Set();
  const sameTime = { day: int(0, 4), start: int(30, 50), len: int(0, 6) };
  members.forEach((m, mi) => {
    const duration = m.category === "상담" ? 30 : 60;
    const need = duration / 10;
    const heavy = scenario === "heavy-requester" && mi === 0;
    const dayCount = heavy ? DAY_COUNT : big ? 1 : int(1, 3);
    const days = heavy
      ? [0, 1, 2, 3, 4, 5]
      : [
          ...new Set(
            Array.from({ length: dayCount }, () => int(0, DAY_COUNT - 1)),
          ),
        ];
    days.forEach((day) => {
      const ranges = heavy ? int(2, 4) : 1;
      for (let k = 0; k < ranges; k++) {
        let d = day,
          start,
          len;
        if (scenario === "same-time") ({ day: d, start, len } = sameTime);
        else if (heavy) [start, len] = [int(0, 40), int(10, 30)];
        else [start, len] = [int(0, 66), big ? int(0, 6) : int(0, 18)];
        // 신청 하나(구간)에만 적용되는 지점 제한: 기본 지점 일부 제거·다른 지점 추가.
        const restrict = {};
        if (chance(0.15))
          restrict.excludedLocationIds = m.locationIds.filter(() =>
            chance(scenario === "no-allowed-location" ? 0.9 : 0.4),
          );
        if (chance(0.1))
          restrict.extraLocationIds = [chance(0.8) ? pick(locIds) : "DELETED"];
        for (
          let s = start;
          s <= Math.min(start + len, SLOT_COUNT - need);
          s++
        ) {
          const key = m.id + "|" + d + "|" + s;
          if (seenStart.has(key)) continue;
          seenStart.add(key);
          requests.push({
            id: "r" + requests.length,
            memberId: m.id,
            day: d,
            startSlot: s,
            duration,
            ...restrict,
          });
        }
      }
    });
  });

  // 제외·1회 제한(1회 제한은 앱과 같이 등록 회원만). 겹침 시나리오는 같은 회원을 둘 다에 넣는다.
  const excluded = members.filter(() => chance(0.1)).map((m) => m.id);
  const onceLimited = members
    .filter((m) => m.category === "등록" && chance(0.2))
    .map((m) => m.id);
  if (scenario === "excluded-once-overlap") {
    members
      .filter((m) => m.category === "등록")
      .slice(0, 3)
      .forEach((m) => {
        if (!excluded.includes(m.id)) excluded.push(m.id);
        if (!onceLimited.includes(m.id)) onceLimited.push(m.id);
      });
  }

  return {
    id: "FUZZ-" + seed,
    description: "퍼즈 시드 " + seed + " / " + scenario,
    scenario,
    locations,
    travelTimes,
    members,
    requests,
    availableCells: [...cells],
    onceLimitedMemberIds3: onceLimited,
    excludedMemberIds3: excluded,
  };
}

/* ---------------- 실행 ---------------- */
if (flag("--dump")) {
  console.log(JSON.stringify(fuzzInput(opt("--dump")), null, 2));
  process.exit(0);
}

const runner = createCaseRunner({ aScale: 0.002 });
const { lib } = runner;
// 고정 세션과 함께 다시 생성한 결과에만 적용하는 규칙(engine/pins.js).
const PIN_RULES = {
  pinKept: "고정 세션은 같은 회원·요일·시작 시각·지점에 그대로 남는다",
  pinQuota: "고정 세션도 회원 최대 횟수와 하루 1회에 포함한다",
  reoptProposal:
    "재최적화 제안은 고정·하드 제약을 지키고, 총 수업 수를 줄이거나 미배정을 늘리지 않으며, 지금 카드보다 낫고, 개선 결과 중 품질 최선보다 낮지 않다",
  impactRegion:
    "국소 재최적화 영향 범위는 사용자 고정을 항상 포함하고, 움직일 세션과 고정이 겹치지 않고 합쳐 전체이며, Level이 오를수록 줄지 않는다",
};
const RULES = Object.keys(lib.HARD_RULES).concat(Object.keys(PIN_RULES));
const ruleText = (r) => lib.HARD_RULES[r] || PIN_RULES[r];

// 시드 입력에서 결정적으로 고정 세션을 고른다: 생성된 결과 하나에서 1~3개, 절반은 세션이 2개 이상인
// 요일에서 2개를 함께 고른다(그리디가 같은 날 고정 사이를 채우지 않는 경로를 지나가게).
// 반환 { pins, source } — source는 고정을 고른 결과(재최적화의 "지금 카드").
function pinsFor(input, generated) {
  let h = 0;
  for (const ch of input.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  const rand = mulberry32(h ^ 0x5bd1e995);
  const sources = Object.keys(generated)
    .sort()
    .filter((k) => generated[k].result.assigned.length);
  if (!sources.length) return { pins: [], source: null };
  const source = generated[sources[Math.floor(rand() * sources.length)]].result;
  const assigned = source.assigned
    .slice()
    .sort((a, b) => a.day - b.day || a.startSlot - b.startSlot);
  const pick = (list) => list.splice(Math.floor(rand() * list.length), 1)[0];
  const pins = [];
  const busyDays = [...new Set(assigned.map((a) => a.day))].filter(
    (d) => assigned.filter((a) => a.day === d).length >= 2,
  );
  const rest = assigned.slice();
  if (busyDays.length && rand() < 0.5) {
    const day = busyDays[Math.floor(rand() * busyDays.length)];
    const sameDay = rest.filter((a) => a.day === day);
    pins.push(pick(sameDay), pick(sameDay));
  }
  const k = 1 + Math.floor(rand() * 3);
  while (pins.length < k) {
    const left = rest.filter((a) => !pins.includes(a));
    if (!left.length) break;
    pins.push(pick(left));
  }
  return { pins: pins.map((a) => ({ ...a })), source };
}

// 고정 회원별 [최대 횟수 초과 또는 같은 날 2회인 결과 수, 횟수 압박 기회]. 기회: 고정 회원이 고정한
// 요일 말고도 신청한 요일이 남은 횟수보다 많아 엔진이 고정을 잊으면 초과할 수 있는 경우.
async function pinQuotaCheck(input, pins, results) {
  let bad = 0,
    opp = 0;
  await lib.withSelectionOverride(
    input.excludedMemberIds3,
    input.onceLimitedMemberIds3,
    async () => {
      const members = [...new Set(pins.map((p) => p.memberId))];
      const eligible = lib.state.requests.filter(lib.isEligibleRequest);
      members.forEach((id) => {
        const cap = lib.maxSessionsFor(lib.memberById(id));
        const pinnedDays = new Set(pins.filter((p) => p.memberId === id).map((p) => p.day));
        const otherDays = new Set(
          eligible.filter((r) => r.memberId === id && !pinnedDays.has(r.day)).map((r) => r.day),
        );
        if (otherDays.size > cap - pinnedDays.size) opp++;
      });
      results.forEach((r) => {
        const broke = members.some((id) => {
          const mine = r.assigned.filter((a) => a.memberId === id);
          return (
            mine.length > lib.maxSessionsFor(lib.memberById(id)) ||
            new Set(mine.map((a) => a.day)).size < mine.length
          );
        });
        if (broke) bad++;
      });
    },
  );
  return { bad, opp };
}

// [selectReoptimization이 내준 결과 중 규칙을 어긴 수(품질 최선보다 낮은 제안 포함), 기회]. 기회: 고정·하드 제약을 통과해 제안 후보가
// 된 결과 수. "수업을 줄였지만 비교 기준으로는 더 나은" 결과는 무작위 입력에서 거의 나오지 않아(gate를
// 빼는 변이도 여기서는 잡히지 않았다) 그 경로는 단위 테스트("수업을 줄여 공강을 줄인 결과는…")가 지킨다.
async function reoptProposalCheck(input, current, pins, results) {
  const assignedMembers = (r) => new Set(r.assigned.map((a) => a.memberId)).size;
  const keeps = (r) =>
    r.assigned.length >= current.assigned.length &&
    assignedMembers(r) >= assignedMembers(current);
  return lib.withSelectionOverride(
    input.excludedMemberIds3,
    input.onceLimitedMemberIds3,
    async () => {
      const out = lib.selectReoptimization(current, results, pins);
      // 5b-1: 제안(되돌리기 후 포함)은 품질 최선(Q)보다 낮으면 안 된다 — 안정성 때문에 품질을 희생하지 않는다.
      const belowQ = ({ result: r }) =>
        out.improving.some((e) => lib.isSchedule2ResultBetter(e.result, r));
      const bad =
        out.variants
          .concat(out.improving)
          .filter(
            ({ result: r }) =>
              lib.missingPins(r.assigned, pins).length ||
              lib.scheduleViolations(r).length ||
              !keeps(r) ||
              !lib.isSchedule2ResultBetter(r, current),
          ).length + out.variants.filter(belowQ).length;
      return { bad, opp: out.stats.passed || 0 };
    },
  );
}

// 프로퍼티가 헛돌지 않았는지(위반할 기회 자체가 있었는지) 규칙별로 센다 — 기회가 0이면 그
// 규칙은 이번 실행에서 사실상 검증되지 않은 것이다.
async function opportunities(input, generated) {
  const ops = {};
  const bump = (rule) => (ops[rule] = (ops[rule] || 0) + 1);
  const eligible = lib.state.requests.filter(lib.isEligibleRequest);
  const results = Object.values(generated).flatMap((g) =>
    [g.result].concat(g.pool || []),
  );
  results.forEach((r) => {
    if (r.assigned.length)
      ["notRequested", "availability", "location"].forEach(bump);
    if (r.unassignedMembers.length) bump("unassigned");
    const byDay = new Map();
    r.assigned.forEach((a) => {
      if (!byDay.has(a.day)) byDay.set(a.day, []);
      byDay.get(a.day).push(a);
    });
    byDay.forEach((list) => {
      list.sort((a, b) => a.startSlot - b.startSlot);
      let travels = 0;
      for (let i = 1; i < list.length; i++) {
        if (list[i - 1].locationId !== list[i].locationId) {
          bump("gap");
          if (lib.travelMinutes(list[i - 1].locationId, list[i].locationId) > 0)
            travels++;
        }
      }
      if (travels === 2) bump("dailyTravel");
    });
  });
  // 입력 쪽 기회: 제외 회원이 근무 셀 안 신청을 냈는지, 최대 1회 회원이 2개 요일 이상 신청했는지,
  // 같은 회원이 하루에 겹치지 않는 신청을 2개 이상 냈는지, 세 지점 회원이 있는지.
  const inCells = lib.state.requests.filter((r) =>
    [...Array(r.duration / 10).keys()].every((k) =>
      lib.runtime.availableCells.has(r.day + "-" + (r.startSlot + k)),
    ),
  );
  if (inCells.some((r) => input.excludedMemberIds3.includes(r.memberId)))
    bump("excluded");
  const daysByMember = new Map();
  eligible.forEach((r) => {
    if (!daysByMember.has(r.memberId)) daysByMember.set(r.memberId, new Set());
    daysByMember.get(r.memberId).add(r.day);
  });
  // withSelectionOverride는 끝난 뒤 마이크로태스크에서 이전 값을 되돌린다 — await하지 않으면 다음
  // 시드의 생성 도중에 이 시드의 선택 목록이 되살아난다(실제로 이 하네스 버그로 거짓 위반이 났다).
  let maxOpp = false;
  await lib.withSelectionOverride(
    input.excludedMemberIds3,
    input.onceLimitedMemberIds3,
    async () => {
      daysByMember.forEach((days, id) => {
        if (days.size >= 2 && lib.maxSessionsFor(lib.memberById(id)) === 1)
          maxOpp = true;
      });
    },
  );
  if (maxOpp) bump("maxSessions");
  const spread = new Map();
  eligible.forEach((r) => {
    const k = r.memberId + "|" + r.day;
    const s = spread.get(k) || [Infinity, -Infinity];
    spread.set(k, [Math.min(s[0], r.startSlot), Math.max(s[1], r.startSlot)]);
  });
  if ([...spread.values()].some(([a, b]) => b - a >= 6)) bump("sameDay");
  if (lib.soloTravelMemberIds().size) bump("soloTravel");
  return ops;
}

function withoutMember(input, id) {
  const keep = (x) => x !== id;
  return {
    ...input,
    members: input.members.filter((m) => m.id !== id),
    requests: input.requests.filter((r) => r.memberId !== id),
    excludedMemberIds3: input.excludedMemberIds3.filter(keep),
    onceLimitedMemberIds3: input.onceLimitedMemberIds3.filter(keep),
  };
}

// 고정 세션과 함께 다시 생성해 하드 제약·고정 유지·고정 회원 횟수·재최적화 제안을 검사한다(키 앞에 prefix).
async function pinnedRun(input, opts, source, pins, prefix, generated, violations) {
  const pinnedRaw = await runner.generate(input, { ...opts, pins });
  const pinned = Object.fromEntries(
    Object.entries(pinnedRaw).map(([k, v]) => [prefix + k, v]),
  );
  Object.assign(generated, pinned);
  violations.push(...(await runner.violationsOf(input, pinned)));
  const results = Object.values(pinned).flatMap((g) => [g.result].concat(g.pool || []));
  Object.entries(pinned).forEach(([key, g]) =>
    [g.result].concat(g.pool || []).forEach((r, tie) => {
      const missing = lib.missingPins(r.assigned, pins);
      if (missing.length)
        violations.push({
          key,
          tie,
          violation: {
            rule: "pinKept",
            message: `${PIN_RULES.pinKept} — ${missing.map(lib.pinKey).join(", ")}`,
          },
        });
    }),
  );
  const quota = await pinQuotaCheck(input, pins, results);
  for (let i = 0; i < quota.bad; i++)
    violations.push({
      key: prefix + "고정",
      tie: 0,
      violation: { rule: "pinQuota", message: PIN_RULES.pinQuota },
    });
  const reopt = await reoptProposalCheck(input, source, pins, results);
  for (let i = 0; i < reopt.bad; i++)
    violations.push({
      key: prefix + "재최적화 제안",
      tie: 0,
      violation: { rule: "reoptProposal", message: PIN_RULES.reoptProposal },
    });
  return { pinKept: results.length, pinQuota: quota.opp, reoptProposal: reopt.opp };
}

// 시드에서 결정적으로 Level(L1~L3)과 원래 위치(절반은 모름, 절반은 고정 회원의 다른 신청 자리)를 고르고
// 모든 Level의 영향 범위를 만든다.
function impactLevelFor(input, source, pins) {
  let h = 0;
  for (const ch of input.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  const rand = mulberry32(h ^ 0x1b873593);
  const level = ["L1", "L2", "L3"][Math.floor(rand() * 3)];
  const origins = [];
  if (rand() < 0.5)
    pins.forEach((p) => {
      const reqs = lib.state.requests.filter((r) => r.memberId === p.memberId);
      const r = reqs[Math.floor(rand() * reqs.length)];
      if (r) origins.push({ day: r.day, startSlot: r.startSlot });
    });
  const regions = Object.fromEntries(
    lib.IMPACT_LEVELS.map((l) => [l, lib.impactRegion(source, pins, l, origins)]),
  );
  return { level, origins, regions };
}

// 영향 범위 구조 규칙 위반 메시지 목록.
function impactRegionViolations(source, pins, regions) {
  const bad = [];
  let prev = null;
  lib.IMPACT_LEVELS.forEach((l) => {
    const r = regions[l];
    const pinned = new Set(r.pins.map(lib.pinKey));
    const open = new Set(r.movable.map(lib.pinKey));
    if (!pins.every((p) => pinned.has(lib.pinKey(p)))) bad.push(l + ": 사용자 고정이 빠짐");
    if (r.movable.some((a) => pinned.has(lib.pinKey(a)))) bad.push(l + ": 움직일 세션이 고정에도 있음");
    if (pinned.size + open.size !== source.assigned.length) bad.push(l + ": 고정 + 움직임 ≠ 전체 세션");
    if (prev && [...prev].some((k) => !open.has(k))) bad.push(l + ": 앞 Level보다 범위가 줄어듦");
    prev = open;
  });
  return bad;
}

// 한 시드 실행: 위반 목록과(엔진이 예외를 던지면 그것도 실패) 기회 집계를 돌려준다. 고정 없이 한 번,
// 그 결과에서 고른 고정 세션과 함께 한 번, Level 영향 범위로 한 번 생성한다(키는 "고정 B", "L2 B"처럼 붙인다).
async function check(input, withA) {
  runner.loadCase(input);
  try {
    const opts = { attempts, withA, aAttempts: FUZZ_A_GREEDY_ATTEMPTS };
    const generated = await runner.generate(input, opts);
    const violations = await runner.violationsOf(input, generated);
    const { pins, source } = pinsFor(input, generated);
    const pinOps = { pinKept: 0, pinQuota: 0, reoptProposal: 0, impactRegion: 0 };
    const addOps = (o) => Object.keys(o).forEach((k) => (pinOps[k] += o[k]));
    if (pins.length) {
      addOps(await pinnedRun(input, opts, source, pins, "고정 ", generated, violations));
      // 5b-2a: 같은 사용자 고정에서 Level 하나의 영향 범위(나머지는 임시 고정)로 다시 생성한다.
      const { level, origins, regions } = impactLevelFor(input, source, pins);
      const bad = impactRegionViolations(source, pins, regions);
      bad.forEach((message) =>
        violations.push({ key: "영향 범위", tie: 0, violation: { rule: "impactRegion", message } }),
      );
      pinOps.impactRegion++;
      const region = regions[level];
      if (region.movable.length && region.tempPinned) {
        addOps(await pinnedRun(input, opts, source, region.pins, `${level}${origins.length ? "+원위치" : ""} `, generated, violations));
      }
    }
    return { generated, violations, pinOps };
  } catch (err) {
    return {
      generated: {},
      pinOps: {},
      violations: [
        {
          key: "-",
          tie: 0,
          violation: {
            rule: "crash",
            message: "엔진 예외: " + (err && err.stack ? err.stack : err),
          },
        },
      ],
    };
  }
}

// 같은 규칙 위반이 남는 한 회원을 하나씩 뺀다(최대 300번 재실행).
async function shrink(input, rule, withA) {
  let cur = input;
  let budget = 300;
  for (let changed = true; changed && budget > 0;) {
    changed = false;
    for (const m of cur.members) {
      if (--budget < 0) break;
      const cand = withoutMember(cur, m.id);
      const { violations } = await check(cand, withA);
      if (violations.some((v) => v.violation.rule === rule)) {
        cur = cand;
        changed = true;
        break;
      }
    }
  }
  return cur;
}

(async () => {
  const single = flag("--seed");
  const start = single ? opt("--seed") : opt("--start", 1);
  const count = single ? 1 : opt("--count", FUZZ_CI_COUNT);
  const t0 = Date.now();
  const tally = Object.fromEntries(
    RULES.map((r) => [r, { violations: 0, opportunities: 0 }]),
  );
  const byScenario = {};
  const failures = [];
  let resultsChecked = 0,
    aRuns = 0;
  const seeds = Array.from({ length: count }, (_, i) => start + i);
  if (!single) seeds.push(...REGRESSION_SEEDS);
  for (const seed of seeds) {
    const input = fuzzInput(seed);
    const withA =
      single ||
      REGRESSION_SEEDS.includes(seed) ||
      (aEvery > 0 && seed % aEvery === 0);
    if (withA) aRuns++;
    byScenario[input.scenario] = (byScenario[input.scenario] || 0) + 1;
    const { generated, violations, pinOps } = await check(input, withA);
    Object.values(generated).forEach(
      (g) => (resultsChecked += 1 + (g.pool || []).length),
    );
    Object.entries(await opportunities(input, generated))
      .concat(Object.entries(pinOps))
      .forEach(([rule, n]) => (tally[rule].opportunities += n));
    violations.forEach((v) => {
      if (tally[v.violation.rule]) tally[v.violation.rule].violations++;
    });
    if (single)
      console.log(
        `시드 ${seed} (${input.scenario}): 회원 ${input.members.length}명, 지점 ${input.locations.length}개, 신청 ${input.requests.length}개, 근무 셀 ${input.availableCells.length}개, 제외 ${input.excludedMemberIds3.length}, 1회 제한 ${input.onceLimitedMemberIds3.length}`,
      );
    if (violations.length) failures.push({ seed, input, violations, withA });
  }

  console.log(
    `퍼즈 — 시드 ${start}~${start + count - 1}${single ? "" : " + 회귀 " + REGRESSION_SEEDS.length}(${seeds.length}건, 후보A ${aRuns}건), 그리디 시도 ${attempts}회, 검사한 후보·동점 배치 ${resultsChecked}개, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  console.log(
    "시나리오: " +
      Object.entries(byScenario)
        .map(([k, v]) => `${k} ${v}`)
        .join(", "),
  );
  console.log("프로퍼티\t위반\t기회\t규칙");
  RULES.forEach((r) =>
    console.log(
      `${r}\t${tally[r].violations}\t${tally[r].opportunities}\t${ruleText(r)}`,
    ),
  );

  // 시드가 충분히 많은데 어떤 규칙도 위반할 기회가 한 번도 없었다면, 생성기가 그 규칙을
  // 헛돌게 만든 것이다(통과해도 검증한 게 아님) — 실패로 본다.
  const vacuous =
    count >= 100 ? RULES.filter((r) => tally[r].opportunities === 0) : [];
  vacuous.forEach((r) =>
    console.error(
      `FAIL: ${r} 규칙을 위반할 기회가 한 번도 없었음 — 생성기를 조정해야 함`,
    ),
  );
  if (!failures.length && !vacuous.length) {
    console.log(`${seeds.length}개 시드 통과 (퍼즈)`);
    return;
  }
  for (const f of failures.slice(0, 5)) {
    const first = f.violations[0].violation;
    console.error(
      `\nFAIL: 시드 ${f.seed} (${f.input.scenario}) — ${f.violations.length}건 위반`,
    );
    f.violations
      .slice(0, 5)
      .forEach(({ key, tie, violation }) =>
        console.error(
          `  ${key}${tie ? " 동점#" + tie : ""}: ${violation.message}`,
        ),
      );
    console.error(`  재현: node tests/fuzz.js --seed ${f.seed}`);
    const minimal = flag("--no-shrink")
      ? f.input
      : await shrink(f.input, first.rule, f.withA);
    const file = path.join(os.tmpdir(), `pt-fuzz-${f.seed}.json`);
    fs.writeFileSync(file, JSON.stringify(minimal, null, 2) + "\n");
    console.error(
      `  입력 state(회원 ${f.input.members.length}명 → 축소 ${minimal.members.length}명): ${file}`,
    );
    const text = JSON.stringify(minimal);
    if (text.length <= 4000) console.error(text);
  }
  console.error(`\n${failures.length}개 시드 실패 (퍼즈)`);
  process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
