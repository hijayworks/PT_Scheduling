#!/usr/bin/env node
// 재최적화(5a) 측정 리포트: 골든 케이스마다 고정 없이 생성한 결과 중 추천안(isSchedule2ResultBetter
// 최선)을 "사용자가 손댄 카드"로 바꾼 뒤(세션을 실제 신청 자리로 옮기면 그 자리가 고정된다 — 앱의
// 수동 이동과 같은 검사 validateMove), 고정 세션과 함께 후보A·B·C를 다시 생성해 잰다:
//   - 엔진별 고정 세션 유지율과 하드 제약 위반(표시 후보 + 동점 배치 전부)
//   - 지금 카드 대비 제안 결과(selectReoptimization): 개선 / 같은 배치 / 동점 / 더 나쁨 / 없음
//   - 같은 날 고정 2개(sameDay)와 다른 날 고정 2개(otherDay)에서 후보B·C가 후보A보다 얼마나 못한지
//     (그리디는 같은 날 고정 세션 사이 빈 시간을 채우지 않는다 — greedy.js 고정 처리 주석)
//   - 고정 개수(1/2/3개)별 생성 시간
// 측정만 한다 — 실패 조건이 없어 CI에서 돌리지 않는다.
//
//   node tests/reoptimize.js                  기본 예산(아래 상수)
//   node tests/reoptimize.js --case CASE-03   한 케이스만
//   node tests/reoptimize.js --seeds 3        시나리오마다 시드 수
//   node tests/reoptimize.js --attempts 200 --a-scale 0.02
//   node tests/reoptimize.js --json out.json  실행 기록 전체 저장(케이스를 나눠 돌린 뒤 --merge로 합친다)
//   node tests/reoptimize.js --merge a.json b.json ...   저장한 기록들을 합쳐 요약만 출력
"use strict";

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
// 알고리즘 튜닝값(측정 예산): 운영(그리디 1000회, 후보A 실제 시간 예산)보다 훨씬 작다. 같은 예산으로
// 고정 없음/있음을 비교하므로 상대 비교(유지율·위반·시간 비율)에는 충분하지만, 개선 성공률은
// 예산이 클수록 달라질 수 있다.
const REOPT_ATTEMPTS = 50;
const REOPT_A_SCALE = 0.005;
const REOPT_SEEDS = 2;
// 시나리오: 옮긴(=고정된) 세션 수와 추가로 확정만 한 세션의 요일.
const SCENARIOS = [
  { id: "move1", label: "1개 옮김(고정 1)", moves: 1 },
  { id: "move2", label: "2개 옮김(고정 2)", moves: 2 },
  { id: "move3", label: "3개 옮김(고정 3)", moves: 3 },
  {
    id: "sameDay",
    label: "1개 옮김 + 같은 날 1개 확정(같은 날 고정 2)",
    moves: 1,
    confirm: "same",
  },
  {
    id: "otherDay",
    label: "1개 옮김 + 다른 날 1개 확정(다른 날 고정 2)",
    moves: 1,
    confirm: "other",
  },
];
const ENGINES = ["A1", "A2", "A3", "B", "C"];
const COLUMNS = [
  ["unassigned", "미배정"],
  ["sessions", "수업"],
  ["inefficientMoves", "비효율"],
  ["travelCount", "이동"],
  ["idleMinutes", "빈시간"],
];
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 + "%" : "-");
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (x) => (Math.round(x * 100) / 100).toString();

function summarize(report) {
  const runs = report.runs.filter((r) => !r.skipped);
  console.log(
    `\n재최적화 측정 — 그리디 시도 ${report.attempts}회, 후보A 예산 ×${report.aScale}(가짜 시계), 실행 ${runs.length}건(건너뜀 ${report.runs.length - runs.length})`,
  );

  console.log("\n[1] 엔진별 고정 유지·하드 제약 (표시 후보 + 동점 배치 전부)");
  console.log("엔진\t검사\t고정 유지\t하드 위반");
  ENGINES.forEach((e) => {
    let total = 0,
      kept = 0,
      hard = 0;
    runs.forEach((r) => {
      const s = r.engines[e];
      if (!s) return;
      total += s.total;
      kept += s.kept;
      hard += s.hard;
    });
    console.log(`${e}\t${total}\t${kept} (${pct(kept, total)})\t${hard}`);
  });

  console.log(
    "\n[2] 지금 카드 대비 제안 (selectReoptimization, 비교 기준 isSchedule2ResultBetter)",
  );
  console.log(
    "시나리오\t실행\t개선\t같은 배치\t동점(다른 배치)\t더 나쁨\tgate 통과 없음",
  );
  SCENARIOS.forEach((sc) => {
    const list = runs.filter((r) => r.scenario === sc.id);
    const n = (f) => list.filter(f).length;
    console.log(
      [
        sc.id,
        list.length,
        pct(
          n((r) => r.status === "improved"),
          list.length,
        ),
        pct(
          n((r) => r.reason === "same-layout"),
          list.length,
        ),
        pct(
          n((r) => r.reason === "equal-quality"),
          list.length,
        ),
        pct(
          n((r) => r.reason === "worse"),
          list.length,
        ),
        pct(
          n((r) => r.reason === "none"),
          list.length,
        ),
      ].join("\t"),
    );
  });
  const improved = runs.filter((r) => r.status === "improved");
  if (improved.length) {
    console.log(
      "개선된 실행의 평균 변화(제안 - 지금 카드): " +
        COLUMNS.map(
          ([k, label]) =>
            `${label} ${fmt(avg(improved.map((r) => r.proposal[k] - r.current[k])))}`,
        ).join(", "),
    );
    console.log(
      "제안을 만든 엔진: " +
        Object.entries(
          improved.reduce(
            (acc, r) => (
              (acc[r.proposalFrom] = (acc[r.proposalFrom] || 0) + 1),
              acc
            ),
            {},
          ),
        )
          .map(([k, v]) => `${k} ${v}`)
          .join(", "),
    );
  }

  console.log(
    "\n[3] 후보B·C가 후보A보다 못한 정도 (같은 날 고정 2 vs 다른 날 고정 2)",
  );
  console.log(
    "시나리오\t엔진\t실행\tA가 더 나음\t평균 차이(엔진 - A 최선): 수업/이동/빈시간\t고정 요일 빈시간(엔진/A)",
  );
  ["sameDay", "otherDay"].forEach((id) => {
    const list = runs.filter((r) => r.scenario === id);
    ["B", "C"].forEach((e) => {
      const xs = list.filter((r) => r.vsA[e]);
      const d = (k) => fmt(avg(xs.map((r) => r.vsA[e].delta[k])));
      console.log(
        [
          id,
          e,
          xs.length,
          pct(xs.filter((r) => r.vsA[e].aBetter).length, xs.length),
          `${d("sessions")}/${d("travelCount")}/${d("idleMinutes")}`,
          `${fmt(avg(xs.map((r) => r.vsA[e].pinDayIdle)))}/${fmt(avg(xs.map((r) => r.vsA[e].pinDayIdleA)))}`,
        ].join("\t"),
      );
    });
  });

  console.log("\n[4] 생성 시간 (같은 예산, 고정 없음 대비)");
  console.log("시나리오\t고정 수\tB·C ms(고정 없음)\tA ms(고정 없음)");
  SCENARIOS.forEach((sc) => {
    const list = runs.filter((r) => r.scenario === sc.id);
    console.log(
      [
        sc.id,
        fmt(avg(list.map((r) => r.pins))),
        `${Math.round(avg(list.map((r) => r.ms.bc)))} (${Math.round(avg(list.map((r) => r.ms.bcFree)))})`,
        `${Math.round(avg(list.map((r) => r.ms.a)))} (${Math.round(avg(list.map((r) => r.ms.aFree)))})`,
      ].join("\t"),
    );
  });
}

if (args[0] === "--merge") {
  const merged = { runs: [] };
  args.slice(1).forEach((f) => {
    const r = JSON.parse(fs.readFileSync(f, "utf8"));
    merged.attempts = r.attempts;
    merged.aScale = r.aScale;
    merged.runs.push(...r.runs);
  });
  summarize(merged);
  process.exit(0);
}

const { createCaseRunner } = require("./caseRunner.js");
const attempts = Number(opt("--attempts", REOPT_ATTEMPTS));
const seeds = Number(opt("--seeds", REOPT_SEEDS));
const runner = createCaseRunner({
  aScale: Number(opt("--a-scale", REOPT_A_SCALE)),
});
const { lib } = runner;

const GOLDEN_DIR = path.join(__dirname, "golden");
const onlyCase = opt("--case");
const files = fs
  .readdirSync(GOLDEN_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !onlyCase || f === onlyCase + ".json")
  .sort();

const resultsOf = (generated, key) =>
  generated[key]
    ? [generated[key].result].concat(generated[key].pool || [])
    : [];
const bestOf = (list) =>
  list.reduce((x, y) => (lib.isSchedule2ResultBetter(y, x) ? y : x));
function hashSeed(text) {
  let h = 0;
  for (const ch of text) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h;
}

// 추천안을 시나리오대로 손댄 카드로 만든다. 옮길 수 없으면 null.
function editedCard(recommended, sc, rand) {
  const card = {
    assigned: recommended.assigned.map((a) => ({ ...a })),
    unassignedMembers: recommended.unassignedMembers.slice(),
    confirmedIds: [],
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const shuffle = (list) =>
    list
      .map((x) => [rand(), x])
      .sort((a, b) => a[0] - b[0])
      .map((p) => p[1]);
  const eligible = lib.state.requests.filter(lib.isEligibleRequest);
  let lastMoved = null;
  for (let m = 0; m < sc.moves; m++) {
    let moved = false;
    for (const s of shuffle(
      card.assigned.filter((a) => !card.confirmedIds.includes(a.id)),
    )) {
      const targets = shuffle(
        eligible.filter(
          (r) =>
            r.memberId === s.memberId &&
            r.duration === s.duration &&
            !(r.day === s.day && r.startSlot === s.startSlot),
        ),
      );
      const target = targets.find((r) => {
        const v = lib.validateMove(card, s, r.day, r.startSlot);
        return v.ok && !v.noop;
      });
      if (!target) continue;
      const v = lib.validateMove(card, s, target.day, target.startSlot);
      const idx = card.assigned.indexOf(s);
      card.assigned[idx] = {
        ...s,
        id: v.newReq.id,
        day: target.day,
        startSlot: target.startSlot,
        locationId: v.locationId,
      };
      card.confirmedIds.push(v.newReq.id);
      lastMoved = card.assigned[idx];
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  if (sc.confirm) {
    const options = card.assigned.filter(
      (a) =>
        !card.confirmedIds.includes(a.id) &&
        (sc.confirm === "same"
          ? a.day === lastMoved.day
          : a.day !== lastMoved.day),
    );
    if (!options.length) return null;
    card.confirmedIds.push(pick(options).id);
  }
  return card;
}

function dayIdle(result, day) {
  return lib.scheduleMetrics({
    assigned: result.assigned.filter((a) => a.day === day),
    unassignedMembers: [],
  }).idleMinutes;
}

(async () => {
  console.log(
    `재최적화 측정 — 그리디 시도 ${attempts}회, 후보A 예산 ×${globalThis.__PT_TEST_BUDGET_SCALE__}(가짜 시계), 케이스 ${files.length}개 × 시나리오 ${SCENARIOS.length}개 × 시드 ${seeds}개`,
  );
  const report = {
    attempts,
    aScale: globalThis.__PT_TEST_BUDGET_SCALE__,
    runs: [],
  };
  for (const file of files) {
    const c = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, file), "utf8"));
    runner.loadCase(c);
    // 첫 생성은 JIT 예열이 섞여 느리다 — 버리고 두 번째 생성을 고정 없음 기준(시간 포함)으로 쓴다.
    await runner.generate(c, { attempts, withA: true });
    const free = await runner.generate(c, { attempts, withA: true });
    const sel = [c.excludedMemberIds3 || [], c.onceLimitedMemberIds3 || []];
    for (const sc of SCENARIOS) {
      for (let seed = 1; seed <= seeds; seed++) {
        const rand = lib.mulberry32(hashSeed(c.id + "|" + sc.id + "|" + seed));
        const prep = await lib.withSelectionOverride(...sel, async () => {
          const recommended = bestOf(
            ENGINES.flatMap((e) => resultsOf(free, e)),
          );
          const card = editedCard(recommended, sc, rand);
          if (!card) return null;
          const violations = lib.scheduleViolations(card);
          if (violations.length)
            throw new Error(
              c.id + " 손댄 카드가 하드 제약 위반: " + violations[0].message,
            );
          return { card, pins: lib.pinsFromResult(card) };
        });
        const base = { case: c.id, scenario: sc.id, seed };
        if (!prep) {
          report.runs.push({ ...base, skipped: true });
          continue;
        }
        const { card, pins } = prep;
        const pinned = await runner.generate(c, {
          attempts,
          withA: true,
          pins,
        });
        const record = await lib.withSelectionOverride(...sel, async () => {
          const engines = {};
          ENGINES.forEach((e) => {
            const list = resultsOf(pinned, e);
            engines[e] = {
              total: list.length,
              kept: list.filter(
                (r) => !lib.missingPins(r.assigned, pins).length,
              ).length,
              hard: list.filter((r) => lib.scheduleViolations(r).length).length,
            };
          });
          const all = ENGINES.flatMap((e) => resultsOf(pinned, e));
          const out = lib.selectReoptimization(card, all, pins);
          const fromKey = out.proposal
            ? ENGINES.find((e) =>
                resultsOf(pinned, e).some(
                  (r) =>
                    lib.layoutSignature(r) ===
                    lib.layoutSignature(out.proposal.result),
                ),
              )
            : null;
          const aBest = bestOf(
            ["A1", "A2", "A3"].flatMap((e) => resultsOf(pinned, e)),
          );
          const aMetrics = lib.scheduleMetrics(aBest);
          const pinDays = [...new Set(pins.map((p) => p.day))].filter(
            (d) => pins.filter((p) => p.day === d).length >= 2,
          );
          const vsA = {};
          ["B", "C"].forEach((e) => {
            const r = pinned[e].result;
            const m = lib.scheduleMetrics(r);
            vsA[e] = {
              aBetter: lib.isSchedule2ResultBetter(aBest, r),
              delta: Object.fromEntries(
                COLUMNS.map(([k]) => [k, m[k] - aMetrics[k]]),
              ),
              pinDayIdle: pinDays.reduce((sum, d) => sum + dayIdle(r, d), 0),
              pinDayIdleA: pinDays.reduce(
                (sum, d) => sum + dayIdle(aBest, d),
                0,
              ),
            };
          });
          return {
            ...base,
            pins: pins.length,
            engines,
            status: out.status,
            reason: out.reason,
            proposalFrom: fromKey,
            current: lib.scheduleMetrics(card),
            proposal: out.proposal ? out.proposal.metrics : null,
            variants: out.variants.length,
            vsA,
            ms: {
              bc: pinned.B.ms,
              a: pinned.A1.ms,
              bcFree: free.B.ms,
              aFree: free.A1.ms,
            },
          };
        });
        report.runs.push(record);
        console.log(
          `${c.id} ${sc.id}#${seed}: 고정 ${record.pins}, ${record.status}${record.reason ? "(" + record.reason + ")" : " ← " + record.proposalFrom}, 유지 ${ENGINES.map((e) => record.engines[e].kept + "/" + record.engines[e].total).join(" ")}`,
        );
      }
    }
  }
  if (opt("--json"))
    fs.writeFileSync(opt("--json"), JSON.stringify(report, null, 2) + "\n");
  summarize(report);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
