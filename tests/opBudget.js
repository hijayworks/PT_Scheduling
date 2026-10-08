#!/usr/bin/env node
// 국소 재최적화(5b-2) 운영 예산 측정: 실제 Chromium에서 앱과 같은 엔진 진입점·엔진 Web Worker·운영 시간
// 예산(벽시계, __PT_TEST_BUDGET_SCALE__ 없음)으로 Level(L1~L3) × 후보A 예산 배율(budgetScale)을 잰다.
// Node의 caseRunner는 다듬기를 워커 없이 순차로 돌리고 가짜 시계를 써서 운영 시간과 다르다.
//   - L1~L3: 5b-2b 계획대로 후보B·C 없이 후보A만(후보A 안 그리디 기준선은 유지), 배율마다
//   - 전체: 앱의 재최적화 그대로(후보B·C + 후보A, 배율 1)
// 입력은 tests/reoptimize.js --cards로 내보낸 손댄 카드(5b-2a와 같은 시드)다. 원래 위치는 아는 경우로 잰다.
// 측정만 한다(CI 아님). 실행 하나가 수십 분 걸리므로 순차로 돌리고 실행마다 결과를 --json에 저장한다.
// 다른 무거운 작업과 같이 돌리면 같은 벽시계 예산 안의 탐색량이 줄어 결과가 달라진다.
//
//   node tests/reoptimize.js --levels --cards cards.json --case CASE-01
//   node tests/opBudget.js --cards cards.json --runs CASE-01:move2:1,CASE-07:move2:2 [--budgets 1,0.5,0.25,0.1] --json out.json
//   node tests/opBudget.js --report out.json     저장한 결과 요약만 출력
//   --full-budget 0.01 --budgets 0.01   도구 점검용 짧은 실행
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const ROOT = path.resolve(__dirname, "..");
const LOCAL_LEVELS = ["L1", "L2", "L3"];

function report(out) {
  console.log(
    `\n운영 예산 측정 — ${out.cpu}, 다듬기 워커 기본값, 실행 ${out.runs.length}건 (시간은 실측 초, 후보A 안 그리디 기준선 포함)`,
  );
  for (const r of out.runs) {
    console.log(
      `\n${r.id} — 세션 ${r.total}, 고정 ${r.pins}, 전체(B·C+A ×1): ${fmtRes(r.full)}`,
    );
    console.log(
      "Level\t움직임/임시 고정\t배율\t시간 s\t결과\t변경 회원/세션\t지금 카드 대비\t같은 Level ×1 대비\t전체 대비",
    );
    for (const e of r.levels) {
      if (e.skipped) {
        console.log(`${e.level}\t${e.movable}/${e.temp}\t-\t-\t${e.skipped}`);
        continue;
      }
      console.log(
        [
          e.level,
          `${e.movable}/${e.temp}`,
          "×" + e.budget,
          (e.res.ms / 1000).toFixed(0),
          e.res.status === "improved" ? "개선" : e.res.reason,
          e.res.counts
            ? `${e.res.counts.changedMembers}/${e.res.counts.changedSessions}`
            : "-",
          e.res.summary || "-",
          cmpText(e.vsBase1),
          cmpText(e.vsFull),
        ].join("\t"),
      );
    }
  }
}
const fmtRes = (res) =>
  `${(res.ms / 1000).toFixed(0)}s(B·C ${(res.bcMs / 1000).toFixed(0)}s), ` +
  (res.status === "improved"
    ? `개선, 변경 회원/세션 ${res.counts.changedMembers}/${res.counts.changedSessions}, ${res.summary}`
    : res.reason);
// 비교 기준(base) 대비 이 결과(other).
const cmpText = (c) =>
  !c
    ? "-"
    : c.otherBetter
      ? "더 나음: " + c.summary
      : c.baseBetter
        ? "더 나쁨: " + c.summary
        : "동점";

if (opt("--report")) {
  report(JSON.parse(fs.readFileSync(opt("--report"), "utf8")));
  process.exit(0);
}

async function bundle() {
  const worker = await esbuild.build({
    entryPoints: [path.join(ROOT, "src/engine/engineWorker.js")],
    bundle: true,
    format: "iife",
    target: "es2020",
    write: false,
    logLevel: "silent",
    charset: "utf8",
  });
  const main = await esbuild.build({
    entryPoints: [path.join(__dirname, "opBudget/entry.js")],
    bundle: true,
    format: "iife",
    target: "es2020",
    write: false,
    logLevel: "silent",
    charset: "utf8",
    define: {
      __PT_ENGINE_WORKER_SOURCE__: JSON.stringify(worker.outputFiles[0].text),
    },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pt-opbudget-"));
  fs.writeFileSync(path.join(dir, "bundle.js"), main.outputFiles[0].text);
  fs.writeFileSync(
    path.join(dir, "index.html"),
    '<!doctype html><meta charset="utf-8"><body><script src="bundle.js"></script>',
  );
  return "file://" + path.join(dir, "index.html");
}

(async () => {
  const cards = JSON.parse(fs.readFileSync(opt("--cards"), "utf8"));
  const budgets = opt("--budgets", "1,0.5,0.25,0.1").split(",").map(Number);
  const runIds = opt("--runs").split(",");
  // 도구 점검용: 전체 단계의 후보A 배율(기본 1 = 운영 예산).
  const fullBudget = Number(opt("--full-budget", 1));
  const jsonPath = opt("--json");
  const { chromium } = require("playwright");
  const url = await bundle();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error")
      console.log("[browser]", m.text());
  });
  await page.goto(url);
  const out = {
    cpu: os.cpus()[0].model + " × " + os.cpus().length,
    budgets,
    runs: [],
  };
  const save = () =>
    jsonPath && fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2) + "\n");
  for (const id of runIds) {
    const [caseId, scenario, seed] = id.split(":");
    const c = cards.find(
      (x) => x.case === caseId && x.scenario === scenario && x.seed === Number(seed),
    );
    if (!c) throw new Error("카드 없음: " + id);
    await page.evaluate(([s, card]) => window.PT.load(s, card), [c.state, c.card]);
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const runOne = (key, level, budget, withBC) =>
      ev(
        (a) => window.PT.run(a),
        { key, pins: c.pins, origins: c.origins, level, budget, withBC },
      );
    const r = { id, pins: c.pins.length, levels: [] };
    out.runs.push(r);
    const t = Date.now();
    r.full = await runOne("full", "full", fullBudget, true);
    const fullRegion = await ev((a) => window.PT.region(...a), [c.pins, "full", c.origins]);
    r.total = fullRegion.total;
    console.log(`${id} 전체: ${fmtRes(r.full)}`);
    save();
    let prevKey = null;
    for (const level of LOCAL_LEVELS) {
      const reg = await ev((a) => window.PT.region(...a), [c.pins, level, c.origins]);
      const base = { level, movable: reg.movable, temp: reg.temp };
      // 앱에 연결할 Level 진행과 같은 구조적 skip: 빈 범위, 앞 Level과 같은 범위, 전체와 같은 범위.
      const skipped = !reg.movable
        ? "빈 범위"
        : reg.key === prevKey
          ? "앞 Level과 같음"
          : reg.key === fullRegion.key
            ? "전체와 같음"
            : null;
      prevKey = reg.key;
      if (skipped) {
        r.levels.push({ ...base, skipped });
        continue;
      }
      for (const budget of budgets) {
        const key = level + "@" + budget;
        const res = await runOne(key, level, budget, false);
        const e = { ...base, budget, res };
        e.vsFull = await ev((a) => window.PT.compare(...a), ["full", key]);
        if (budget !== 1)
          e.vsBase1 = await ev((a) => window.PT.compare(...a), [level + "@1", key]);
        r.levels.push(e);
        console.log(
          `${id} ${level} ×${budget}: ${(res.ms / 1000).toFixed(0)}s ${res.status === "improved" ? "개선 " + res.counts.changedMembers + "명 " + res.summary : res.reason} | 전체 대비 ${cmpText(e.vsFull)}`,
        );
        save();
      }
    }
    console.log(`${id} 끝 (${Math.round((Date.now() - t) / 60000)}분)`);
  }
  await browser.close();
  report(out);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
