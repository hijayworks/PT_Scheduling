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
//   node tests/diversity.js --state dir      케이스별 앱 저장 상태(생성 결과 포함)를 dir/CASE-xx.state.json으로
//                                            — 같은 결과를 브라우저에 넣어 화면을 비교할 때 쓴다
"use strict";

const fs = require("fs");
const path = require("path");
const { createCaseRunner } = require("./caseRunner.js");

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
// lib(예산 전역 반영)을 caseRunner가 먼저 불러온 뒤에 불러야 한다.
const { signature, diversitySummary } = require("./candidateDiversity.js");
const { lib } = runner;

const GOLDEN_DIR = path.join(__dirname, "golden");
const onlyCase = opt("--case");
const files = fs
  .readdirSync(GOLDEN_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !onlyCase || f === onlyCase + ".json")
  .sort();
const KEY_ORDER = ["A1", "A2", "A3", "B", "C"];
// 표 열: Pareto 축 + tie-break(이동 시간).
const COLUMNS = [
  ["unassigned", "미배정"],
  ["sessions", "수업"],
  ["inefficientMoves", "비효율"],
  ["travelCount", "이동"],
  ["idleMinutes", "빈시간"],
  ["travelMinutes", "이동분"],
];
const LABEL = Object.fromEntries(COLUMNS);
const metricRow = (m) => COLUMNS.map(([k]) => m[k]).join("/");
const HIDDEN_REASON = {
  "unassigned-gate": "미배정 gate(추천보다 미배정 많음)",
  unlabeled: "unlabeled Pareto",
  "role-taken": "같은 역할을 더 나은 후보가 차지",
  "card-limit": "카드 수 상한",
};
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
  const selectionTotals = { cases: 0 };
  const roleCount = {};
  const hiddenAll = [];
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

    if (opt("--state")) {
      const { state, runtime } = lib;
      const slot = (k) => (gen[k] ? gen[k].result : null);
      fs.writeFileSync(
        path.join(opt("--state"), c.id + ".state.json"),
        JSON.stringify({
          schemaVersion: 1,
          startMinBase: 720,
          currentPage: "schedule3",
          locations: state.locations,
          travelTimes: state.travelTimes,
          members: state.members,
          requests: state.requests,
          availableCells: [...runtime.availableCells],
          onceLimitedMemberIds3: state.onceLimitedMemberIds3,
          excludedMemberIds3: state.excludedMemberIds3,
          candidates: [slot("B"), slot("C")].filter(Boolean),
          schedule3Result: { candidateAList: ["A1", "A2", "A3"].map(slot) },
        }),
      );
    }

    // 후보 선정: 표시 카드 5장과 각 엔진의 동점 풀 전체를 하나의 후보 풀로 본다.
    const entries = [];
    for (const key of KEY_ORDER) {
      if (!gen[key]) continue;
      const { result, pool } = gen[key];
      const layouts = [result].concat((pool || []).filter((r) => r !== result));
      for (let i = 0; i < layouts.length; i++)
        entries.push({
          key: i ? `${key}#${i}` : key,
          result: layouts[i],
          metrics: await runner.metricsOf(c, layouts[i]),
        });
    }
    const sel = await lib.withSelectionOverride(
      c.excludedMemberIds3 || [],
      c.onceLimitedMemberIds3 || [],
      async () => lib.selectCandidates(entries),
    );
    selectionTotals.cases++;
    Object.entries(sel.stats).forEach(
      ([k, v]) => (selectionTotals[k] = (selectionTotals[k] || 0) + v),
    );
    sel.cards.forEach(
      (cd) => (roleCount[cd.label] = (roleCount[cd.label] || 0) + 1),
    );
    sel.hidden.forEach((h) => hiddenAll.push({ caseId: c.id, ...h }));
    const describe = (cd) => ({
      role: cd.label,
      keys: cd.variants.map((v) => v.key),
      metrics: cd.metrics,
      tradeoff: lib.formatTradeoff(cd.deltas),
      // 첫 배치 대비 회원·요일·지점 배정 차이
      variantChanges: cd.variants
        .slice(1)
        .map((v) => lib.placementChanges(v.result, cd.variants[0].result)),
      // 유사도 기준 검토용: 같은 품질의 모든 고유 배치가 대표 배치와 다른 회원·요일·지점 배정 수
      groupChanges: [
        ...new Map(
          entries
            .filter(
              (e) => lib.qualityKey(e.metrics) === lib.qualityKey(cd.metrics),
            )
            .map((e) => [signature(e.result), e]),
        ).values(),
      ]
        .filter((e) => signature(e.result) !== signature(cd.variants[0].result))
        .map((e) => lib.placementChanges(e.result, cd.variants[0].result))
        .sort((a, b) => a - b),
      reason: cd.reason,
      qualifiesFor: cd.qualifiesFor,
    });

    report.cases[c.id] = {
      selection: {
        stats: sel.stats,
        cards: sel.cards.map(describe),
        hidden: sel.hidden.map(describe),
      },
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
      "  후보\t" + COLUMNS.map(([, l]) => l).join("\t") + "\t동점배치",
    );
    cands.forEach((x) =>
      console.log(
        `  ${x.key}\t` +
          COLUMNS.map(([k]) => x.metrics[k]).join("\t") +
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

    const st = sel.stats;
    console.log(
      `  [선정] 생성 ${st.generated} → exact unique ${st.exactUnique}(중복 ${st.exactDuplicates}) → 품질 그룹 ${st.qualityGroups} → 미배정 gate 제거 그룹 ${st.gatedGroups}(배치 ${st.gatedLayouts}) → Pareto 그룹 ${st.paretoGroups}(지배 제거: 그룹 ${st.dominatedGroups}, 배치 ${st.dominatedLayouts}) → 카드 ${st.cardsShown}`,
    );
    console.log(
      `         유사 variant 제거 ${st.similarRemoved}, variant 상한 초과 ${st.variantLimitRemoved}`,
    );
    console.log(
      `  카드\t역할\t${COLUMNS.map(([, l]) => l).join("/")}\t추천 대비\tvariant(첫 배치 대비 배정 차이)\t출처`,
    );
    sel.cards.forEach((cd, i) => {
      const d = describe(cd);
      console.log(
        `  ${i + 1}\t${d.role}\t${metricRow(d.metrics)}\t${d.tradeoff || "-"}\t${d.keys.length}(${d.variantChanges.join(",") || "-"})\t${d.keys.join(",")}\t그룹 배정 차이 [${d.groupChanges.join(",")}]`,
      );
    });
    sel.hidden.forEach((h) => {
      const d = describe(h);
      console.log(
        `  숨김\t${HIDDEN_REASON[d.reason]}${d.qualifiesFor.length ? "(" + d.qualifiesFor.join(",") + ")" : ""}\t${metricRow(d.metrics)}\t${d.tradeoff}\t${d.keys.length}\t${d.keys.join(",")}`,
      );
    });
  }
  console.log(
    `\n선정 합계(${selectionTotals.cases}개 케이스): 생성 ${selectionTotals.generated}, exact unique ${selectionTotals.exactUnique}(중복 ${selectionTotals.exactDuplicates}), 품질 그룹 ${selectionTotals.qualityGroups}, 미배정 gate 제거 그룹 ${selectionTotals.gatedGroups}(배치 ${selectionTotals.gatedLayouts}), Pareto 그룹 ${selectionTotals.paretoGroups}(지배 제거 그룹 ${selectionTotals.dominatedGroups}/배치 ${selectionTotals.dominatedLayouts}), 카드 ${selectionTotals.cardsShown}, 유사 variant 제거 ${selectionTotals.similarRemoved}, variant 상한 초과 ${selectionTotals.variantLimitRemoved}`,
  );
  console.log(
    "역할별 카드: " +
      Object.entries(roleCount)
        .map(([r, n]) => `${r} ${n}`)
        .join(", "),
  );
  console.log(
    `숨긴 그룹(gate로 빠진 Pareto 포함) ${hiddenAll.length}개: ` +
      (hiddenAll
        .map(
          (h) =>
            `${h.caseId} ${HIDDEN_REASON[h.reason]} [${lib.formatTradeoff(h.deltas)}]`,
        )
        .join("; ") || "없음"),
  );
  report.selectionTotals = selectionTotals;
  report.roleCount = roleCount;
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
