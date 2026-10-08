#!/usr/bin/env node
// 후보 다양성 리포트: 골든 데이터셋 케이스마다 후보 A-1/A-2/A-3/B/C를 실제 생성 진입점으로 만들고,
// 사용자에게 실제로 몇 개의 서로 다른 선택지를 보여주는지 잰다(판정 기준은 candidateDiversity.js).
// 측정만 한다 — 실패 조건이 없어 CI에서 돌리지 않는다.
//
//   node tests/diversity.js                  기본 예산(아래 상수)
//   node tests/diversity.js --attempts 1000  후보B·C 그리디 시도 횟수(운영값 1000)
//   node tests/diversity.js --a-scale 0.05   후보A 시간 예산 비율(가짜 시계라 결과는 결정적)
//   node tests/diversity.js --case CASE-03   한 케이스만
//   node tests/diversity.js --json out.json  케이스별 요약·쌍별 관계를 파일로 저장
"use strict";

const fs = require("fs");
const path = require("path");
const { createCaseRunner } = require("./caseRunner.js");
const {
  QUALITY_KEYS,
  signature,
  diversitySummary,
} = require("./candidateDiversity.js");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
// 알고리즘 튜닝값(측정 예산): 운영(그리디 1000회, 후보A 실제 시간 예산)보다 작다. 예산이 작으면
// 후보A가 덜 수렴해 카드끼리 실제보다 더 다르게(또는 그리디 결과로 대체돼 더 같게) 나올 수
// 있으므로, 결론을 내기 전에 큰 예산으로 한 번 더 확인한다.
const DIVERSITY_ATTEMPTS = 200;
const DIVERSITY_A_SCALE = 0.02;
const attempts = Number(opt("--attempts", DIVERSITY_ATTEMPTS));
const runner = createCaseRunner({
  aScale: Number(opt("--a-scale", DIVERSITY_A_SCALE)),
});

const GOLDEN_DIR = path.join(__dirname, "golden");
const onlyCase = opt("--case");
const files = fs
  .readdirSync(GOLDEN_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !onlyCase || f === onlyCase + ".json")
  .sort();
const KEY_ORDER = ["A1", "A2", "A3", "B", "C"];
const LABEL = Object.fromEntries(
  QUALITY_KEYS.map(([k, , label]) => [k, label]),
);
const pct = (x) => Math.round(x * 100) + "%";
const signed = (n) => (n > 0 ? "+" : "") + n;

(async () => {
  console.log(
    `후보 다양성 — 그리디 시도 ${attempts}회, 후보A 예산 ×${globalThis.__PT_TEST_BUDGET_SCALE__}(가짜 시계)`,
  );
  const report = {
    attempts,
    aScale: globalThis.__PT_TEST_BUDGET_SCALE__,
    cases: {},
  };
  const totals = {
    shown: 0,
    exactUnique: 0,
    qualityTypes: 0,
    pareto: 0,
    paretoQualityTypes: 0,
  };
  const relationCount = {};
  for (const file of files) {
    const c = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, file), "utf8"));
    runner.loadCase(c);
    const gen = await runner.generate(c, { attempts, withA: true });
    const cands = [];
    for (const key of KEY_ORDER) {
      if (!gen[key]) continue;
      const { result, pool } = gen[key];
      cands.push({
        key,
        result,
        metrics: await runner.metricsOf(c, result),
        ties: new Set([result].concat(pool || []).map(signature)).size,
      });
    }
    const s = diversitySummary(cands);
    report.cases[c.id] = {
      ...s,
      metrics: Object.fromEntries(cands.map((x) => [x.key, x.metrics])),
      ties: Object.fromEntries(cands.map((x) => [x.key, x.ties])),
    };
    Object.keys(totals).forEach(
      (k) => (totals[k] += k === "pareto" ? s.pareto.length : s[k]),
    );
    s.pairs.forEach(
      (p) => (relationCount[p.relation] = (relationCount[p.relation] || 0) + 1),
    );

    console.log(
      `\n${c.id} — 표시 ${s.shown}, exact unique ${s.exactUnique}, 품질 유형 ${s.qualityTypes}, 지배되지 않은 후보 ${s.pareto.join(",")}(품질 유형 ${s.paretoQualityTypes})`,
    );
    console.log(
      "  후보\t" + QUALITY_KEYS.map(([, , l]) => l).join("\t") + "\t동점배치",
    );
    cands.forEach((x) =>
      console.log(
        `  ${x.key}\t` +
          QUALITY_KEYS.map(([k]) => x.metrics[k]).join("\t") +
          `\t${x.ties}`,
      ),
    );
    console.log("  쌍\t관계\t배정겹침\t회원·요일겹침\t차이(뒤-앞)");
    s.pairs.forEach((p) =>
      console.log(
        `  ${p.a}-${p.b}\t${p.relation}${p.winner ? "(" + p.winner + " 우세)" : ""}\t${pct(p.sessionSimilarity)}\t${pct(p.memberDaySimilarity)}\t` +
          Object.entries(p.deltas)
            .map(([k, d]) => `${LABEL[k]} ${signed(d)}`)
            .join(", "),
      ),
    );
  }
  console.log(
    `\n합계(${files.length}개 케이스): 표시 ${totals.shown}, exact unique ${totals.exactUnique}, 품질 유형 ${totals.qualityTypes}, 지배되지 않은 후보 ${totals.pareto}(품질 유형 ${totals.paretoQualityTypes})`,
  );
  console.log(
    "쌍별 관계: " +
      ["duplicate", "same-quality", "dominated", "trade-off"]
        .map((r) => `${r} ${relationCount[r] || 0}`)
        .join(", "),
  );
  if (opt("--json"))
    fs.writeFileSync(opt("--json"), JSON.stringify(report, null, 2) + "\n");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
