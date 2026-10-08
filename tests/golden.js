#!/usr/bin/env node
// 골든 데이터셋: tests/golden/*.json 대표 입력마다 후보를 실제로 생성해
//  1) 후보A·B·C의 표시 후보와 동점 배치 전부에 하드 제약 위반이 없는지(scheduleViolations),
//  2) 후보B·C의 품질 지표(scheduleMetrics)가 케이스에 기록된 하한(expect)보다 나빠지지 않았는지
// 확인하고, 케이스별 지표·소요 시간을 표로 출력한다. 정확한 배치가 아니라 품질 하한만
// 고정하므로, 알고리즘이 더 좋은 다른 배치를 찾으면 그대로 통과한다.
//
// 후보A는 축소 예산 + 가짜 시계(tests/caseRunner.js)로 하드 제약만 확인한다(A constraint
// smoke). 시간 예산제라 품질은 예산에 좌우되므로 하한 검사는 하지 않는다.
//
//   node tests/golden.js                     CI 기본: 후보A·B·C, 그리디 시도 GOLDEN_ATTEMPTS회
//   node tests/golden.js --attempts 1000     운영과 같은 시도 횟수(하한 검사는 건너뜀)
//   node tests/golden.js --no-a              후보A 생략
//   node tests/golden.js --a-scale 0.05      후보A 시간 예산 비율(기본 0.002)
//   node tests/golden.js --a-real-clock      후보A를 실제 시계로(결과가 실행마다 달라질 수 있음)
//   node tests/golden.js --case CASE-03      한 케이스만
//   node tests/golden.js --json out.json     지표를 파일로 저장
//   node tests/golden.js --baseline out.json 저장해 둔 지표와 비교해 차이를 표시
//   node tests/golden.js --write-floors      현재 지표로 하한을 올린다(나빠지는 값은 거부)
//   node tests/golden.js --write-floors --allow-regression  하한을 낮추는 기록을 명시적으로 허용
//
// 케이스 형식은 앱 state와 같다(locations·travelTimes·members·onceLimitedMemberIds3·
// excludedMemberIds3 + requests 또는 ranges, availableCells 또는 hours — caseRunner.js의
// loadCase 참고). 실제 데이터를 익명화해 넣을 때는 앱 state를 그대로 쓰면 된다.
"use strict";

const fs = require("fs");
const path = require("path");
const { createCaseRunner } = require("./caseRunner.js");
const {
  FLOOR_KEYS,
  FLOOR_CANDIDATES,
  meetsFloor,
  floorsFrom,
  floorRegressions,
} = require("./goldenFloors.js");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
// 알고리즘 튜닝값: CI용 그리디 시도 횟수(운영은 INITIAL_SEARCH_ATTEMPTS=1000). 시드가 고정이라
// 같은 횟수면 항상 같은 결과가 나온다 — expect 하한은 이 횟수로 측정한 값이다.
const GOLDEN_ATTEMPTS = 20;
const attempts = Number(opt("--attempts", GOLDEN_ATTEMPTS));
const withA = !flag("--no-a");
// 알고리즘 튜닝값: 후보A 제약 스모크 안의 그리디 기준선 시도 횟수. 품질이 아니라 제약만 보므로 작게 둔다.
const A_GREEDY_ATTEMPTS = 5;
const writeFloors = flag("--write-floors");
const allowRegression = flag("--allow-regression");
const runner = createCaseRunner({
  aScale: Number(opt("--a-scale", 0.002)),
  realClock: flag("--a-real-clock"),
});

const GOLDEN_DIR = path.join(__dirname, "golden");
const onlyCase = opt("--case");
const files = fs
  .readdirSync(GOLDEN_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !onlyCase || f === onlyCase + ".json")
  .sort();

const COLS = [
  ["unassigned", "미배정"],
  ["sessions", "수업"],
  ["onceOnly", "1회만"],
  ["travelCount", "이동"],
  ["travelMinutes", "이동분"],
  ["inefficientMoves", "비효율"],
  ["idleMinutes", "빈시간"],
  ["longestIdleMinutes", "최장빈"],
  ["workDays", "근무일"],
  ["spanMinutes", "근무분"],
];

function caseText(c) {
  // 원소가 값뿐인 짧은 배열은 한 줄로 써서 사람이 읽기 쉽게 둔다.
  return (
    JSON.stringify(c, null, 2).replace(
      /\[\s+([^[\]{}]*?)\s+\]/g,
      (_, inner) => "[" + inner.replace(/\s*\n\s*/g, " ") + "]",
    ) + "\n"
  );
}

(async () => {
  const baseline = opt("--baseline")
    ? JSON.parse(fs.readFileSync(opt("--baseline"), "utf8"))
    : null;
  const report = { attempts, withA, cases: {} };
  const failures = [];
  const regressions = [];
  const pendingWrites = [];
  console.log(
    `골든 데이터셋 — 그리디 시도 ${attempts}회${withA ? `, 후보A 예산 ×${globalThis.__PT_TEST_BUDGET_SCALE__}(${flag("--a-real-clock") ? "실제" : "가짜"} 시계, 제약만 검사)` : ""}`,
  );
  console.log(
    ["케이스", "후보", "배정"]
      .concat(
        COLS.map((c) => c[1]),
        ["ms"],
      )
      .join("\t"),
  );
  for (const file of files) {
    const filePath = path.join(GOLDEN_DIR, file);
    const c = JSON.parse(fs.readFileSync(filePath, "utf8"));
    runner.loadCase(c);
    const gen = await runner.generate(c, {
      attempts,
      withA,
      aAttempts: A_GREEDY_ATTEMPTS,
    });
    (await runner.violationsOf(c, gen)).forEach(({ key, tie, violation }) =>
      failures.push(`${c.id} ${key}${tie ? " 동점#" + tie : ""}: ${violation}`),
    );
    report.cases[c.id] = {};
    const floorsAttempts = c.expect && c.expect.attempts;
    for (const [key, { result, ms }] of Object.entries(gen)) {
      const m = await runner.metricsOf(c, result);
      report.cases[c.id][key] = { ...m, ms };
      const prev =
        baseline && baseline.cases[c.id] && baseline.cases[c.id][key];
      const cell = (k) =>
        prev && prev[k] !== m[k]
          ? `${m[k]}(${m[k] - prev[k] > 0 ? "+" : ""}${m[k] - prev[k]})`
          : String(m[k]);
      console.log(
        [c.id, key, `${m.assignedMembers}/${m.targetMembers}`]
          .concat(
            COLS.map(([k]) => cell(k)),
            [prev ? `${ms}(${prev.ms})` : String(ms)],
          )
          .join("\t"),
      );
      // 하한 기록 모드에서는 아래 래칫 검사가 하한 비교를 대신한다.
      if (
        !writeFloors &&
        floorsAttempts === attempts &&
        FLOOR_CANDIDATES.includes(key)
      ) {
        Object.entries(c.expect[key] || {}).forEach(([fk, bound]) => {
          const metric = FLOOR_KEYS[fk][0];
          if (!meetsFloor(fk, m[metric], bound))
            failures.push(
              `${c.id} ${key}: ${metric} ${m[metric]} — 하한 ${fk}=${bound} 위반`,
            );
        });
      }
    }
    if (writeFloors) {
      const next = { attempts };
      FLOOR_CANDIDATES.forEach(
        (k) => (next[k] = floorsFrom(report.cases[c.id][k])),
      );
      regressions.push(...floorRegressions(c.id, c.expect, next));
      pendingWrites.push([filePath, { ...c, expect: next }]);
    } else if (floorsAttempts !== attempts) {
      console.log(
        `  (${c.id}: 하한은 시도 ${floorsAttempts}회 기준이라 검사 생략)`,
      );
    }
  }
  if (opt("--json"))
    fs.writeFileSync(opt("--json"), JSON.stringify(report, null, 2) + "\n");
  if (failures.length) {
    failures.forEach((f) => console.error("FAIL: " + f));
    console.error(`${failures.length}개 실패 (골든 데이터셋)`);
    if (writeFloors)
      console.error("하드 제약 위반이 있어 하한을 기록하지 않았습니다.");
    process.exit(1);
  }
  if (writeFloors) {
    if (regressions.length && !allowRegression) {
      regressions.forEach((r) => console.error("REGRESSION: " + r));
      console.error(
        "하한이 나빠지는 기록은 거부합니다 — 의도한 변경이면 --allow-regression을 붙이고 PR에 이유를 적으세요. 아무 파일도 바꾸지 않았습니다.",
      );
      process.exit(1);
    }
    regressions.forEach((r) => console.log("하한 낮춤(허용됨): " + r));
    pendingWrites.forEach(([p, c]) => fs.writeFileSync(p, caseText(c)));
    console.log(`${pendingWrites.length}개 케이스 하한 기록`);
  }
  console.log(`${files.length}개 케이스 통과 (골든 데이터셋)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
