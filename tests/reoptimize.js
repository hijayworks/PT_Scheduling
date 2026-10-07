#!/usr/bin/env node
// 재최적화(5a) 측정 리포트: 골든 케이스마다 고정 없이 생성한 결과 중 추천안(isSchedule2ResultBetter
// 최선)을 "사용자가 손댄 카드"로 바꾼 뒤(세션을 실제 신청 자리로 옮기면 그 자리가 고정된다 — 앱의
// 수동 이동과 같은 검사 validateMove), 고정 세션과 함께 후보A·B·C를 다시 생성해 잰다:
//   - 엔진별 고정 세션 유지율과 하드 제약 위반(표시 후보 + 동점 배치 전부)
//   - 지금 카드 대비 제안 결과(selectReoptimization): 개선 / 같은 배치 / 동점 / 더 나쁨 / 없음
//   - 같은 날 고정 2개(sameDay)와 다른 날 고정 2개(otherDay)에서 후보B·C가 후보A보다 얼마나 못한지
//     (그리디는 같은 날 고정 세션 사이 빈 시간을 채우지 않는다 — greedy.js 고정 처리 주석)
//   - 고정 개수(1/2/3개)별 생성 시간
//   - [5] 5b-1 안정성 측정(앱 미반영): 같은 개선 풀(selectReoptimization의 improving)에서 품질 최선(Q)과
//     안정성 정렬 S1(변경 회원 우선)·S2(변경 심각도 우선), 각각의 되돌리기 패스(+R)가 고른 결과의
//     변경량·품질, 풀 크기, (품질, 안정성) Pareto 대안 수, 되돌리기 처리 순서 민감도
// 측정만 한다 — 실패 조건이 없어 CI에서 돌리지 않는다.
//
//   node tests/reoptimize.js                  기본 예산(아래 상수)
//   node tests/reoptimize.js --case CASE-03   한 케이스만
//   node tests/reoptimize.js --seeds 3        시나리오마다 시드 수
//   node tests/reoptimize.js --attempts 200 --a-scale 0.02
//   node tests/reoptimize.js --json out.json  실행 기록 전체 저장(케이스를 나눠 돌린 뒤 --merge로 합친다)
//   node tests/reoptimize.js --merge a.json b.json ...   저장한 기록들을 합쳐 요약만 출력
//   node tests/reoptimize.js --levels [--case CASE-03] [--scenario move1] [--json out.json]   [6] 국소 재최적화 Level 측정
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
// 5b-1 측정 대상 안정성 정렬(사전식, 작을수록 안정). 같으면 품질(추천 비교 기준) → 이동 시간 → 배치 서명.
const STABILITY_ORDERS = {
  S1: ["members", "sessions", "dayChanges", "locationChanges", "startOnly"],
  S2: [
    "statusChanges",
    "dayChanges",
    "locationChanges",
    "members",
    "sessions",
    "startOnly",
  ],
};
// Q·S1/Q·S2(참고): 품질은 Q와 같은 동률 그룹 안에서만 안정성 정렬로 고른다(품질 희생 0).
// 앱: 실제 selectReoptimization 제안(5b-1 정책 Q·S1+R — variant마다 되돌린 뒤 가장 안정한 것).
const POLICIES = ["Q", "S1", "S2", "S1+R", "S2+R", "Q+R", "Q·S1", "Q·S2", "Q·S1+R", "앱"];
const CHANGE_COLUMNS = [
  ["members", "변경 회원"],
  ["sessions", "변경 세션"],
  ["dayChanges", "요일 변경"],
  ["locationChanges", "지점 변경"],
  ["startOnly", "시작 시각만"],
  ["newlyAssigned", "신규 배정"],
  ["added", "수업 추가"],
  ["removed", "수업 제거"],
  ["membersFewer", "횟수 감소 회원"],
  ["membersMore", "횟수 증가 회원"],
  ["sessionCountShift", "횟수 증감 총량"],
  ["newlyUnassigned", "배정→미배정"],
];
const QUALITY_COLUMNS = [
  ["idleMinutes", "빈 시간"],
  ["travelCount", "이동 횟수"],
  ["travelMinutes", "이동 시간"],
  ["spanMinutes", "체류 시간"],
  ["sessions", "수업"],
];
// [6] 5b-2a 국소 재최적화 측정(--levels, 앱 미반영): 같은 손댄 카드에서 영향 범위 L1/L2/L3/전체를 모두
// 생성해(성공해도 멈추지 않음) Level별 해결률·변경량·전체 대비 품질, 원래 위치 유무, 범위 크기, 그리디 기여,
// 예산 배율, 정지 규칙 (a)/(b)/(c)를 비교한다.
const LEVELS_MODE = args.includes("--levels");
// 알고리즘 튜닝값(측정): 국소 Level(L1~L3)의 후보A 호출 단위 예산 배율(chainDp.groupBudgets). 전체는 항상 ×1.
// 원래 위치를 아는 경우는 배율 전부, 모르는 경우는 ×1만 잰다.
const LEVEL_BUDGETS = [1, 0.5, 0.25];
const LEVEL_CONFIGS = LEVEL_BUDGETS.map((budget) => ({ origin: "known", budget })).concat([
  { origin: "unknown", budget: 1 },
]);
const STOP_RULES = [
  ["a", "(a) 첫 성공 정지"],
  ["b", "(b) 첫 성공 + 한 Level 더"],
  ["c", "(c) 항상 전체까지 비교"],
];
// 되돌리기 순서 민감도: 기본(회원 id 오름차순) 외에 내림차순과 시드 셔플 이만큼.
const REVERT_SHUFFLES = 6;
const quantile = (xs, q) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
};
const dist = (xs) => `${fmt(avg(xs))}/${fmt(quantile(xs, 0.5))}/${fmt(quantile(xs, 0.9))}`;
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
    "시나리오\t실행\t개선\t(이전 정책 개선)\t수업 감소만 개선\t같은 배치\t동점(다른 배치)\t더 나쁨\tgate 통과 없음",
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
          n((r) => r.oldImproved),
          list.length,
        ),
        pct(
          n((r) => r.reason === "fewer-sessions"),
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

  console.log("\n[2-1] 고정 수별 개선 성공률과 지금 카드 대비 변경량(개선된 실행 평균)");
  console.log(
    "고정 수\t실행\t개선\t변경 회원\t변경 세션\t요일 변경\t시작 시각만 변경\t수업 추가/빠짐\tB·C ms\tA ms",
  );
  [...new Set(runs.map((r) => r.pins))]
    .sort((a, b) => a - b)
    .forEach((p) => {
      const list = runs.filter((r) => r.pins === p);
      const ok = list.filter((r) => r.change);
      const c = (k) => fmt(avg(ok.map((r) => r.change[k])));
      console.log(
        [
          p,
          list.length,
          `${ok.length} (${pct(ok.length, list.length)})`,
          c("members"),
          c("sessions"),
          c("dayChanges"),
          c("startOnly"),
          `${c("added")}/${c("removed")}`,
          Math.round(avg(list.map((r) => r.ms.bc))),
          Math.round(avg(list.map((r) => r.ms.a))),
        ].join("\t"),
      );
    });

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

  summarizeStability(runs);

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

function summarizeStability(runs) {
  const list = runs.filter((r) => r.stab);
  console.log(
    `\n[5] 5b-1 안정성 측정 — 개선 풀이 있는 실행 ${list.length}건 / 전체 ${runs.length}건 (지금 카드 대비, 평균/중앙값/p90)`,
  );
  console.log(
    `제안 자격: 수업 유지 gate(총 수업 ≥, 미배정 ≤) 개선 ${pct(runs.filter((r) => r.status === "improved").length, runs.length)} · 회원별 횟수 감소까지 금지했다면 ${pct(runs.filter((r) => r.perMemberImproved).length, runs.length)} · gate 없음 ${pct(runs.filter((r) => r.oldImproved).length, runs.length)}`,
  );
  if (!list.length) return;
  const pool = list.map((r) => r.stab.pool);
  console.log(
    `개선 풀(서로 다른 배치) 크기 ${dist(pool)}, 풀이 1개뿐이라 S1/S2가 고를 여지가 없던 실행 ${pct(pool.filter((n) => n === 1).length, list.length)}`,
  );
  console.log(
    "현재 카드(0-change 기준점) 절대값: " +
      QUALITY_COLUMNS.map(
        ([k, label]) => `${label} ${dist(list.map((r) => r.stab.current[k]))}`,
      ).join(", "),
  );
  console.log(
    "\n[5-1] 변경량 (정책별, 평균/중앙값/p90)\n정책\t" +
      CHANGE_COLUMNS.map((c) => c[1]).join("\t"),
  );
  console.log(["현재(0)"].concat(CHANGE_COLUMNS.map(() => "0/0/0")).join("\t"));
  POLICIES.forEach((p) =>
    console.log(
      [p]
        .concat(
          CHANGE_COLUMNS.map(([k]) =>
            dist(list.map((r) => r.stab.policies[p].change[k])),
          ),
        )
        .join("\t"),
    ),
  );
  console.log(
    "\n[5-1b] 회원 간 재배분 발생 비율\n정책\t횟수 감소 회원 있음\t배정→미배정 있음(신규 배정과 맞바뀜)",
  );
  POLICIES.forEach((p) =>
    console.log(
      [
        p,
        pct(list.filter((r) => r.stab.policies[p].change.membersFewer > 0).length, list.length),
        pct(list.filter((r) => r.stab.policies[p].change.newlyUnassigned > 0).length, list.length),
      ].join("\t"),
    ),
  );
  console.log(
    "\n[5-2] 품질 변화 (정책 - 지금 카드, 평균/중앙값/p90)\n정책\t" +
      QUALITY_COLUMNS.map((c) => c[1]).join("\t"),
  );
  POLICIES.forEach((p) =>
    console.log(
      [p]
        .concat(
          QUALITY_COLUMNS.map(([k]) =>
            dist(
              list.map((r) => r.stab.policies[p].metrics[k] - r.stab.current[k]),
            ),
          ),
        )
        .join("\t"),
    ),
  );
  console.log(
    "\n[5-3] Q 대비 (같은 실행)\n정책\tQ와 다른 배치\tQ가 품질상 엄격히 나음\t" +
      QUALITY_COLUMNS.map((c) => c[1] + "(정책-Q)").join("\t"),
  );
  POLICIES.filter((p) => p !== "Q").forEach((p) =>
    console.log(
      [
        p,
        pct(list.filter((r) => r.stab.policies[p].sig !== r.stab.policies.Q.sig).length, list.length),
        pct(list.filter((r) => r.stab.policies[p].qBetter).length, list.length),
      ]
        .concat(
          QUALITY_COLUMNS.map(([k]) =>
            dist(
              list.map(
                (r) => r.stab.policies[p].metrics[k] - r.stab.policies.Q.metrics[k],
              ),
            ),
          ),
        )
        .join("\t"),
    ),
  );
  console.log("\n[5-4] (품질, 안정성) Pareto 대안 — 첫 장 = 가장 안정적인 개선안, 이후는 덜 안정적이지만 품질이 엄격히 나은 것만");
  console.log("정렬\t앞면 크기(평균/중앙값/p90)\t대안 있음(2개 이상)\t3개 초과(잘림)\t앞면 끝이 Q 품질이면서 Q보다 변경 회원 적음");
  ["S1", "S2"].forEach((p) => {
    const f = list.map((r) => r.stab.front[p]);
    console.log(
      [
        p,
        dist(f.map((x) => x.size)),
        pct(f.filter((x) => x.size >= 2).length, list.length),
        pct(f.filter((x) => x.size > 3).length, list.length),
        pct(f.filter((x) => x.lastFewerMembersThanQ).length, list.length),
      ].join("\t"),
    );
  });
  console.log("\n[5-5] 되돌리기 패스(R) — 기본 순서: 회원 id 오름차순, 바뀐 것이 없을 때까지 반복");
  console.log(
    `기준\t1명 이상 되돌린 실행\t되돌린 회원 수\t줄어든 변경 세션\t순서 민감도: 결과가 순서마다 다른 실행\t순서 간 변경 회원 수 최대 차이(평균/최대)`,
  );
  ["S1", "S2", "Q", "Q·S1"].forEach((p) => {
    const rv = list.map((r) => r.stab.revert[p]);
    console.log(
      [
        p + "+R",
        pct(rv.filter((x) => x.reverted > 0).length, list.length),
        dist(rv.map((x) => x.reverted)),
        dist(rv.map((x) => x.sessionsSaved)),
        pct(rv.filter((x) => x.orderVariants > 1).length, list.length),
        `${fmt(avg(rv.map((x) => x.memberSpread)))}/${Math.max(...rv.map((x) => x.memberSpread))}`,
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
    merged.mode = r.mode;
    merged.runs.push(...r.runs);
  });
  (merged.mode === "levels" ? summarizeLevels : summarize)(merged);
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
const onlyScenario = opt("--scenario");
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
  // 옮기기 전 자리(국소 재최적화 측정의 "원래 위치를 아는 경우"). 앱에서는 되돌리기 스택이 있을 때만 안다.
  const origins = [];
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
      origins.push({ day: s.day, startSlot: s.startSlot });
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
  return { card, origins };
}

// 지금 카드 → 결과의 변경량(5b-1 안정성 지표). 짝짓기는 candidateDiff.assignmentDiff 그대로다.
function changeOf(current, result) {
  const d = lib.assignmentDiff(current, result);
  return {
    members: d.counts.changedMembers,
    sessions: d.counts.changedSessions,
    statusChanges: d.counts.newlyAssigned + d.counts.newlyUnassigned,
    dayChanges: d.counts.dayChanges,
    locationChanges: d.counts.locationChanges,
    startOnly: d.counts.startOnlyChanges,
    newlyAssigned: d.counts.newlyAssigned,
    added: d.counts.sessionsAdded,
    removed: d.counts.sessionsRemoved,
    membersFewer: d.counts.membersFewer,
    membersMore: d.counts.membersMore,
    sessionCountShift: d.counts.sessionCountShift,
    newlyUnassigned: d.counts.newlyUnassigned,
  };
}
const changedMemberIds = (current, result) =>
  lib.assignmentDiff(current, result).members.map((m) => m.memberId);
// 품질 순서(추천 비교 기준 → 이동 시간 → 배치 서명). 음수면 x가 앞.
const byQuality = (x, y) =>
  lib.isSchedule2ResultBetter(x.result, y.result)
    ? -1
    : lib.isSchedule2ResultBetter(y.result, x.result)
      ? 1
      : lib.byTravelThenSignature(x, y);
const byQualityClass = (x, y) =>
  lib.isSchedule2ResultBetter(x.result, y.result)
    ? -1
    : lib.isSchedule2ResultBetter(y.result, x.result)
      ? 1
      : 0;
const byStability = (keys) => (x, y) => {
  for (const k of keys) if (x.change[k] !== y.change[k]) return x.change[k] - y.change[k];
  return 0;
};

// 되돌리기 패스: 결과에서 바뀐 회원을 order 순서로 하나씩 지금 카드의 원래 배치로 되돌려 보고, 고정 유지·
// 하드 제약·수업 유지 gate(keepsSessions)·base보다 품질이 나빠지지 않음을 모두 만족할 때만 유지한다. 바뀐 것이
// 없을 때까지 반복한다.
function revertPass(current, pins, base, order) {
  let result = base;
  for (let progress = true; progress; ) {
    progress = false;
    for (const id of order(changedMemberIds(current, result))) {
      const cand = {
        assigned: result.assigned
          .filter((a) => a.memberId !== id)
          .concat(current.assigned.filter((a) => a.memberId === id)),
        unassignedMembers: result.unassignedMembers
          .filter((m) => m.id !== id)
          .concat(current.unassignedMembers.filter((m) => m.id === id)),
      };
      if (
        lib.missingPins(cand.assigned, pins).length ||
        lib.scheduleViolations(cand).length ||
        !lib.keepsSessions(current, cand) ||
        lib.isSchedule2ResultBetter(base, cand)
      )
        continue;
      result = cand;
      progress = true;
    }
  }
  return result;
}

// 개선 풀(out.improving)에서 정책별 선택·되돌리기·Pareto 앞면을 잰다. 선택 상태 안에서 호출한다.
function stabilityMeasure(card, pins, out, rand) {
  const entryOf = (result) => ({
    result,
    metrics: lib.scheduleMetrics(result),
    change: changeOf(card, result),
  });
  const pool = out.improving.map((e) => entryOf(e.result));
  // Q: 5b-1 이전 앱 정책(품질 최선 → 이동 시간 → 배치 서명). 앱 제안은 이제 Q·S1+R이다.
  const picked = {
    Q: pool.slice().sort(byQuality)[0],
    앱: entryOf(out.proposal.result),
  };
  if (pool.some((e) => lib.isSchedule2ResultBetter(e.result, picked.앱.result)))
    throw new Error("앱 제안이 품질 최선(Q)보다 낮음");
  Object.entries(STABILITY_ORDERS).forEach(([p, keys]) => {
    picked[p] = pool.slice().sort((x, y) => byStability(keys)(x, y) || byQuality(x, y))[0];
    picked["Q·" + p] = pool
      .slice()
      .sort(
        (x, y) =>
          byQualityClass(x, y) ||
          byStability(keys)(x, y) ||
          lib.byTravelThenSignature(x, y),
      )[0];
  });
  const shuffle = (list) =>
    list
      .map((x) => [rand(), x])
      .sort((a, b) => a[0] - b[0])
      .map((p) => p[1]);
  const orders = [
    (ids) => ids.slice().sort(),
    (ids) => ids.slice().sort().reverse(),
  ];
  for (let i = 0; i < REVERT_SHUFFLES; i++) orders.push((ids) => shuffle(ids));
  const revert = {};
  ["S1", "S2", "Q", "Q·S1"].forEach((p) => {
    const finals = orders.map((order) => entryOf(revertPass(card, pins, picked[p].result, order)));
    const r = finals[0];
    // S+R은 S보다 어떤 변경 지표도 늘면 안 된다(되돌린 회원의 변경만 사라진다).
    finals.forEach((f) =>
      Object.keys(f.change).forEach((k) => {
        if (f.change[k] > picked[p].change[k])
          throw new Error(`${p}+R이 ${k}를 늘림: ${picked[p].change[k]} → ${f.change[k]}`);
      }),
    );
    if (lib.isSchedule2ResultBetter(picked[p].result, r.result))
      throw new Error(p + "+R이 품질을 낮춤");
    picked[p + "+R"] = r;
    const members = finals.map((f) => f.change.members);
    revert[p] = {
      reverted: picked[p].change.members - r.change.members,
      sessionsSaved: picked[p].change.sessions - r.change.sessions,
      orderVariants: new Set(finals.map((f) => lib.layoutSignature(f.result))).size,
      memberSpread: Math.max(...members) - Math.min(...members),
    };
  });
  // Pareto 앞면: 안정성 순으로 훑으며 지금까지 고른 것보다 품질이 엄격히 나은 것만 더한다.
  const front = {};
  Object.entries(STABILITY_ORDERS).forEach(([p, keys]) => {
    const kept = [];
    pool
      .slice()
      .sort((x, y) => byStability(keys)(x, y) || byQuality(x, y))
      .forEach((e) => {
        if (!kept.length || lib.isSchedule2ResultBetter(e.result, kept[kept.length - 1].result))
          kept.push(e);
      });
    const last = kept[kept.length - 1];
    front[p] = {
      size: kept.length,
      lastFewerMembersThanQ:
        !lib.isSchedule2ResultBetter(picked.Q.result, last.result) &&
        last.change.members < picked.Q.change.members,
    };
  });
  const qSig = lib.layoutSignature(picked.Q.result);
  return {
    pool: pool.length,
    current: lib.scheduleMetrics(card),
    policies: Object.fromEntries(
      POLICIES.map((p) => [
        p,
        {
          change: picked[p].change,
          metrics: picked[p].metrics,
          sig: p === "Q" ? qSig : lib.layoutSignature(picked[p].result) === qSig ? qSig : "other",
          qBetter: lib.isSchedule2ResultBetter(picked.Q.result, picked[p].result),
        },
      ]),
    ),
    front,
    revert,
  };
}

// 같은 고정(임시 고정 포함)·예산이면 결과가 같으므로 한 실행 안에서 생성 결과를 재사용한다. 예산 배율은
// 후보A에만 걸리므로 후보B·C는 고정이 같으면 재사용한다(시간은 원래 생성 시간을 그대로 비용으로 센다).
async function levelMeasure(c, card, pins, origins, sel) {
  const cache = new Map();
  const outcomeOf = (levelPins, g) => {
    const A = ["A1", "A2", "A3"].flatMap((e) => resultsOf(g, e));
    const BC = ["B", "C"].flatMap((e) => resultsOf(g, e));
    const out = lib.selectReoptimization(card, A.concat(BC), levelPins);
    const o = {
      status: out.status,
      reason: out.reason,
      proposal: out.proposal ? out.proposal.result : null,
      ms: { bc: g.B.ms, a: g.A1.ms },
    };
    if (out.status === "improved") {
      const sig = lib.layoutSignature(o.proposal);
      const inA = A.some((r) => lib.layoutSignature(r) === sig);
      const inBC = BC.some((r) => lib.layoutSignature(r) === sig);
      o.source = inA && inBC ? "A+BC" : inA ? "A" : inBC ? "BC" : "R";
      // B/C 기여: B·C 결과를 빼고 같은 선택을 했을 때 제안이 없어지는지(essential), 품질이 낮아지는지(quality).
      const aOnly = lib.selectReoptimization(card, A, levelPins);
      o.bc =
        aOnly.status !== "improved"
          ? "essential"
          : lib.isSchedule2ResultBetter(o.proposal, aOnly.proposal.result)
            ? "quality"
            : "none";
    }
    return o;
  };
  const gen = async (levelPins, budget) => {
    const key = levelPins.map(lib.pinKey).sort().join(",");
    if (!cache.has(key + "@" + budget)) {
      const bc = cache.get(key + "@bc");
      const g = await runner.generate(c, {
        attempts,
        withA: true,
        withBC: !bc,
        pins: levelPins,
        aBudgetScale: budget,
      });
      if (bc) Object.assign(g, bc);
      else cache.set(key + "@bc", { B: g.B, C: g.C });
      cache.set(
        key + "@" + budget,
        await lib.withSelectionOverride(...sel, async () => outcomeOf(levelPins, g)),
      );
    }
    return cache.get(key + "@" + budget);
  };
  const configs = [];
  for (const cfg of LEVEL_CONFIGS) {
    const levels = await lib.runImpactLevels(
      card,
      pins,
      cfg.origin === "known" ? origins : [],
      (p, level) => gen(p, level === "full" ? 1 : cfg.budget),
    );
    configs.push({ ...cfg, levels });
  }
  return lib.withSelectionOverride(...sel, async () => levelSummaryOf(card, configs));
}

// 실행 하나의 Level·정지 규칙 결과를 JSON으로 저장할 수 있는 숫자로 바꾼다(제안 객체는 버린다).
function levelSummaryOf(card, configs) {
  const isB = lib.isSchedule2ResultBetter;
  const cardM = lib.scheduleMetrics(card);
  const fullOut = configs[0].levels.find((e) => e.level === "full").outcome;
  const fullProp = fullOut && fullOut.status === "improved" ? fullOut.proposal : null;
  const fullM = fullProp && lib.scheduleMetrics(fullProp);
  const fullCh = fullProp && changeOf(card, fullProp);
  const describe = (prop) => {
    const m = lib.scheduleMetrics(prop);
    const ch = changeOf(card, prop);
    const d = {
      change: ch,
      quality: Object.fromEntries(QUALITY_COLUMNS.map(([k]) => [k, m[k] - cardM[k]])),
    };
    if (fullProp) {
      d.fullBetter = isB(fullProp, prop);
      d.levelBetter = isB(prop, fullProp);
      d.vsFull = Object.fromEntries(
        QUALITY_COLUMNS.map(([k]) => [k, m[k] - fullM[k]]).concat([
          ["changedMembers", ch.members - fullCh.members],
          ["changedSessions", ch.sessions - fullCh.sessions],
        ]),
      );
      // 이 결과가 전체 재최적화 대비 얻는 것 대신 포기하는 것(전체가 엄격히 나을 때만).
      d.tradeoff = d.fullBetter ? lib.summarizeMetricDiff(lib.metricDiff(fullM, m)) : null;
    }
    return d;
  };
  const stable = byStability(STABILITY_ORDERS.S1);
  // 품질(추천 비교 기준)이 나은 쪽, 같으면 덜 바뀐 쪽, 그것도 같으면 앞(더 좁은) Level.
  const better = (x, y) =>
    !y
      ? x
      : isB(y.prop, x.prop)
        ? y
        : isB(x.prop, y.prop)
          ? x
          : stable(y, x) < 0
            ? y
            : x;
  return {
    fullImproved: !!fullProp,
    configs: configs.map((cfg) => {
      const seq = cfg.levels.map((e) => {
        const o = e.outcome;
        const improved = !!o && o.status === "improved";
        const generated = !e.skipped && !e.sameAs;
        return {
          level: e.level,
          region: {
            total: e.region.total,
            user: e.region.userPinned,
            movable: e.region.movable.length,
            temp: e.region.tempPinned,
          },
          skipped: e.skipped || null,
          sameAs: e.sameAs || null,
          generated,
          improved,
          reason: o ? o.reason : null,
          msBC: generated ? o.ms.bc : 0,
          msA: generated ? o.ms.a : 0,
          // 이 범위를 단독으로 한 번 생성하는 비용(앞 Level과 같아 재생성하지 않았어도).
          soloMs: o ? o.ms.bc + o.ms.a : 0,
          source: improved ? o.source : null,
          bc: improved ? o.bc : null,
          prop: improved ? o.proposal : null,
          change: improved ? changeOf(card, o.proposal) : null,
        };
      });
      const cost = (end) => seq.slice(0, end + 1).reduce((t, e) => t + e.msBC + e.msA, 0);
      const gens = (end) => seq.slice(0, end + 1).filter((e) => e.generated).length;
      const first = seq.findIndex((e) => e.improved);
      const last = seq.length - 1;
      const ok = seq.filter((e) => e.improved);
      const cPick = ok.length ? ok.reduce((x, y) => better(x, y)) : null;
      const picks =
        first < 0
          ? { a: [null, last], b: [null, last], c: [null, last] }
          : {
              a: [seq[first], first],
              b: [
                better(seq[first], seq[Math.min(first + 1, last)].improved ? seq[Math.min(first + 1, last)] : null),
                Math.min(first + 1, last),
              ],
              c: [cPick, last],
            };
      const rules = Object.fromEntries(
        Object.entries(picks).map(([k, [pick, end]]) => [
          k,
          {
            level: pick ? pick.level : null,
            improved: !!pick,
            cost: cost(end),
            gens: gens(end),
            ...(pick ? describe(pick.prop) : {}),
            cBetter: !!pick && isB(cPick.prop, pick.prop),
          },
        ]),
      );
      return {
        origin: cfg.origin,
        budget: cfg.budget,
        seq: seq.map(({ prop, ...rest }) => ({
          ...rest,
          ...(prop ? describe(prop) : {}),
        })),
        rules,
      };
    }),
  };
}

function summarizeLevels(report) {
  const runs = report.runs.filter((r) => !r.skipped);
  const cfgOf = (r, origin, budget) =>
    r.configs.find((x) => x.origin === origin && x.budget === budget);
  const LV = ["L1", "L2", "L3", "full"];
  const lvName = (l) => (l === "full" ? "전체" : l);
  const m = (xs) => fmt(avg(xs));
  const qCols = QUALITY_COLUMNS.map(([k, label]) => [k, label]);
  console.log(
    `\n국소 재최적화(5b-2a) 측정 — 그리디 ${report.attempts}회, 후보A 예산 ×${report.aScale}(가짜 시계) × Level 배율 ${LEVEL_BUDGETS.join("/")}(전체는 ×1), 실행 ${runs.length}건(건너뜀 ${report.runs.length - runs.length}), 전체 재최적화 개선 ${pct(runs.filter((r) => r.fullImproved).length, runs.length)}`,
  );
  console.log("시간은 8병렬 실측(ms)이라 상대값만 의미가 있다. 후보A 시간에는 후보A 안의 그리디 기준선이 포함된다.");

  console.log("\n[6-1] Level별 범위 크기 (평균/중앙값/p90) — 열린 비율 = 움직일 수 있는 세션 / 전체 세션");
  console.log("원래 위치\tLevel\t전체 세션\t사용자 고정\t움직일 수 있음\t임시 고정\t열린 비율\t빈 범위(생성 안 함)\t앞 Level과 같음(재생성 안 함)");
  ["known", "unknown"].forEach((origin) =>
    LV.forEach((l) => {
      const es = runs.map((r) => cfgOf(r, origin, 1).seq.find((e) => e.level === l));
      console.log(
        [
          origin === "known" ? "앎" : "모름",
          lvName(l),
          dist(es.map((e) => e.region.total)),
          dist(es.map((e) => e.region.user)),
          dist(es.map((e) => e.region.movable)),
          dist(es.map((e) => e.region.temp)),
          dist(es.map((e) => (e.region.total ? Math.round((e.region.movable / e.region.total) * 100) : 0))) + "%",
          pct(es.filter((e) => e.skipped).length, es.length),
          pct(es.filter((e) => e.sameAs).length, es.length),
        ].join("\t"),
      );
    }),
  );

  const levelTable = (origin, budget) => {
    console.log(
      "Level\t실행\t개선\t변경 회원\t변경 세션\t요일 변경\t시작 시각만\t재배분 있음\t횟수 증감 총량\t" +
        qCols.map(([, l]) => l + "Δ").join("\t") +
        "\t|전체 대비(둘 다 개선)\t건수\t전체가 엄격히 나음\tLevel이 엄격히 나음\t" +
        qCols.map(([, l]) => l + "(L-전체)").join("\t") +
        "\t변경 회원(L-전체)\t생성 ms",
    );
    LV.forEach((l) => {
      const es = runs.map((r) => cfgOf(r, origin, budget).seq.find((e) => e.level === l));
      const ok = es.filter((e) => e.improved);
      const both = ok.filter((e) => e.vsFull);
      const gen = es.filter((e) => e.generated);
      console.log(
        [
          lvName(l),
          es.length,
          `${ok.length} (${pct(ok.length, es.length)})`,
          m(ok.map((e) => e.change.members)),
          m(ok.map((e) => e.change.sessions)),
          m(ok.map((e) => e.change.dayChanges)),
          m(ok.map((e) => e.change.startOnly)),
          pct(ok.filter((e) => e.change.membersFewer > 0).length, ok.length),
          m(ok.map((e) => e.change.sessionCountShift)),
          ...qCols.map(([k]) => m(ok.map((e) => e.quality[k]))),
          "|",
          both.length,
          pct(both.filter((e) => e.fullBetter).length, both.length),
          pct(both.filter((e) => e.levelBetter).length, both.length),
          ...qCols.map(([k]) => m(both.map((e) => e.vsFull[k]))),
          m(both.map((e) => e.vsFull.changedMembers)),
          Math.round(avg(gen.map((e) => e.msBC + e.msA))),
        ].join("\t"),
      );
    });
  };
  console.log("\n[6-2] Level별 결과 — 원래 위치 앎, 예산 ×1 (변경량·품질Δ는 개선된 실행 평균, 지금 카드 대비)");
  levelTable("known", 1);
  console.log("\n[6-2b] 같은 표 — 원래 위치 모름, 예산 ×1");
  levelTable("unknown", 1);

  const firstLevelDist = (origin, budget) => {
    const rs = runs.map((r) => cfgOf(r, origin, budget).rules.a);
    return LV.map((l) => `${lvName(l)} ${pct(rs.filter((x) => x.level === l).length, rs.length)}`)
      .concat([`없음 ${pct(rs.filter((x) => !x.improved).length, rs.length)}`])
      .join(" / ");
  };
  console.log("\n[6-3] 원래 위치 정보 유무 (예산 ×1)");
  console.log(
    "원래 위치\t처음 개선을 찾은 Level\tL1 해결\tL2 해결\tL3 해결\t전체까지 필요(fallback)\t(a) 변경 회원\t(a) 전체가 엄격히 나음\t(a) 빈 시간(a-전체)\t(a) 이동(a-전체)",
  );
  ["known", "unknown"].forEach((origin) => {
    const cs = runs.map((r) => cfgOf(r, origin, 1));
    const solved = (l) => pct(cs.filter((x) => x.seq.find((e) => e.level === l).improved).length, cs.length);
    const a = cs.map((x) => x.rules.a).filter((x) => x.improved);
    const av = a.filter((x) => x.vsFull);
    console.log(
      [
        origin === "known" ? "앎" : "모름",
        firstLevelDist(origin, 1),
        solved("L1"),
        solved("L2"),
        solved("L3"),
        pct(a.filter((x) => x.level === "full").length, cs.length),
        m(a.map((x) => x.change.members)),
        pct(av.filter((x) => x.fullBetter).length, av.length),
        m(av.map((x) => x.vsFull.idleMinutes)),
        m(av.map((x) => x.vsFull.travelCount)),
      ].join("\t"),
    );
  });
  const diffRegion = runs.filter((r) =>
    ["L1", "L2", "L3"].some(
      (l) =>
        cfgOf(r, "known", 1).seq.find((e) => e.level === l).region.movable !==
        cfgOf(r, "unknown", 1).seq.find((e) => e.level === l).region.movable,
    ),
  ).length;
  console.log(`원래 위치를 알면 L1~L3 범위가 달라지는 실행 ${pct(diffRegion, runs.length)} (나머지는 원래 위치가 이미 범위 안 — 같은 요일 이동 등)`);

  console.log("\n[6-4] 그리디(B/C) 기여 — 원래 위치 앎, 예산 ×1 (새로 생성한 Level만)");
  console.log(
    "Level\t개선\tA가 만든 제안\tB/C만 만든 제안\tA·B/C 같은 배치\t되돌리기로 생긴 배치\tB/C 빼면 제안 없음\tB/C 빼면 품질 낮아짐\tB/C 무기여\tB/C ms\t후보A ms",
  );
  LV.forEach((l) => {
    const es = runs.map((r) => cfgOf(r, "known", 1).seq.find((e) => e.level === l)).filter((e) => e.generated);
    const ok = es.filter((e) => e.improved);
    const n = (f) => pct(ok.filter(f).length, ok.length);
    console.log(
      [
        lvName(l),
        ok.length,
        n((e) => e.source === "A"),
        n((e) => e.source === "BC"),
        n((e) => e.source === "A+BC"),
        n((e) => e.source === "R"),
        n((e) => e.bc === "essential"),
        n((e) => e.bc === "quality"),
        n((e) => e.bc === "none"),
        Math.round(avg(es.map((e) => e.msBC))),
        Math.round(avg(es.map((e) => e.msA))),
      ].join("\t"),
    );
  });

  console.log("\n[6-5] 예산 배율별 (원래 위치 앎, L1~L3 배율 적용, 전체는 ×1)");
  console.log("배율\tLevel\t개선\t후보A ms(새로 생성한 것)\t변경 회원\t전체가 엄격히 나음(둘 다 개선)\t빈 시간(L-전체)");
  LEVEL_BUDGETS.forEach((b) =>
    ["L1", "L2", "L3"].forEach((l) => {
      const es = runs.map((r) => cfgOf(r, "known", b).seq.find((e) => e.level === l));
      const ok = es.filter((e) => e.improved);
      const both = ok.filter((e) => e.vsFull);
      console.log(
        [
          "×" + b,
          l,
          pct(ok.length, es.length),
          Math.round(avg(es.filter((e) => e.generated).map((e) => e.msA))),
          m(ok.map((e) => e.change.members)),
          pct(both.filter((e) => e.fullBetter).length, both.length),
          m(both.map((e) => e.vsFull.idleMinutes)),
        ].join("\t"),
      );
    }),
  );
  console.log("배율\tL1~L3 안에서 개선 찾음\t(a) 비용 ms\t(a) 생성 횟수\t(a) 전체가 엄격히 나음\t처음 개선을 찾은 Level");
  LEVEL_BUDGETS.forEach((b) => {
    const a = runs.map((r) => cfgOf(r, "known", b).rules.a);
    const av = a.filter((x) => x.vsFull);
    console.log(
      [
        "×" + b,
        pct(a.filter((x) => x.improved && x.level !== "full").length, a.length),
        Math.round(avg(a.map((x) => x.cost))),
        m(a.map((x) => x.gens)),
        pct(av.filter((x) => x.fullBetter).length, av.length),
        firstLevelDist("known", b),
      ].join("\t"),
    );
  });

  const ruleTable = (origin, budget) => {
    console.log(
      "정지 규칙\t개선 찾음\t생성 횟수\t비용 ms\t변경 회원\t변경 세션\t요일 변경\t시작 시각만\t" +
        qCols.map(([, l]) => l + "Δ").join("\t") +
        "\t전체가 엄격히 나음\t(c)가 엄격히 나음\t" +
        qCols.map(([, l]) => l + "(규칙-전체)").join("\t") +
        "\t변경 회원(규칙-전체)",
    );
    const fullCost = avg(
      runs.map((r) => cfgOf(r, origin, budget).seq.find((e) => e.level === "full").soloMs),
    );
    STOP_RULES.forEach(([k, label]) => {
      const rs = runs.map((r) => cfgOf(r, origin, budget).rules[k]);
      const ok = rs.filter((x) => x.improved);
      const v = ok.filter((x) => x.vsFull);
      console.log(
        [
          label,
          pct(ok.length, rs.length),
          m(rs.map((x) => x.gens)),
          Math.round(avg(rs.map((x) => x.cost))),
          m(ok.map((x) => x.change.members)),
          m(ok.map((x) => x.change.sessions)),
          m(ok.map((x) => x.change.dayChanges)),
          m(ok.map((x) => x.change.startOnly)),
          ...qCols.map(([q]) => m(ok.map((x) => x.quality[q]))),
          pct(v.filter((x) => x.fullBetter).length, v.length),
          pct(ok.filter((x) => x.cBetter).length, ok.length),
          ...qCols.map(([q]) => m(v.map((x) => x.vsFull[q]))),
          m(v.map((x) => x.vsFull.changedMembers)),
        ].join("\t"),
      );
    });
    console.log(`(참고) 전체 재최적화만 1번: 비용 ${Math.round(fullCost)} ms`);
  };
  console.log("\n[6-6] 정지 규칙 비교 — 원래 위치 앎, 예산 ×1 (품질Δ는 지금 카드 대비, 규칙-전체는 둘 다 개선된 실행)");
  ruleTable("known", 1);
  console.log("\n[6-6b] 같은 표 — 원래 위치 모름, 예산 ×1");
  ruleTable("unknown", 1);

  console.log("\n[6-7] 첫 성공에서 멈춰도 되는 비율 (원래 위치 앎, 예산 ×1)");
  ["known", "unknown"].forEach((origin) => {
    const a = runs.map((r) => ({ r, a: cfgOf(r, origin, 1).rules.a })).filter((x) => x.a.improved);
    const local = a.filter((x) => x.a.level !== "full");
    console.log(
      `${origin === "known" ? "앎" : "모름"}: (a)가 개선을 찾은 ${a.length}건 중 L1~L3에서 멈춘 ${local.length}건 — 전체보다 품질이 낮지 않음 ${pct(local.filter((x) => !x.a.fullBetter).length, local.length)}, (c)보다 낮지 않음 ${pct(local.filter((x) => !x.a.cBetter).length, local.length)}, 그중 변경 회원이 전체보다 적음 ${pct(local.filter((x) => !x.a.fullBetter && x.a.vsFull && x.a.vsFull.changedMembers < 0).length, local.length)}`,
    );
  });
  const bad = runs
    .map((r) => ({ r, a: cfgOf(r, "known", 1).rules.a }))
    .filter((x) => x.a.improved && x.a.fullBetter)
    .sort(
      (x, y) =>
        x.a.vsFull.sessions - y.a.vsFull.sessions ||
        y.a.vsFull.travelCount - x.a.vsFull.travelCount ||
        y.a.vsFull.idleMinutes - x.a.vsFull.idleMinutes,
    );
  console.log(`\n[6-8] 첫 성공에서 멈추면 전체보다 품질이 낮아지는 실행 ${bad.length}건 (원래 위치 앎, ×1; 손실 큰 순, 최대 10건)`);
  bad.slice(0, 10).forEach(({ r, a }) =>
    console.log(
      `${r.case} ${r.scenario}#${r.seed}: ${a.level}에서 멈춤 — 변경 회원 ${a.change.members}명(전체 ${a.change.members - a.vsFull.changedMembers}명, ${a.vsFull.changedMembers > 0 ? "+" : ""}${a.vsFull.changedMembers}), 전체 대비 ${a.tradeoff}`,
    ),
  );
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
    mode: LEVELS_MODE ? "levels" : "full",
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
    for (const sc of SCENARIOS.filter((x) => !onlyScenario || x.id === onlyScenario)) {
      for (let seed = 1; seed <= seeds; seed++) {
        const rand = lib.mulberry32(hashSeed(c.id + "|" + sc.id + "|" + seed));
        const prep = await lib.withSelectionOverride(...sel, async () => {
          const recommended = bestOf(
            ENGINES.flatMap((e) => resultsOf(free, e)),
          );
          const edited = editedCard(recommended, sc, rand);
          if (!edited) return null;
          const { card, origins } = edited;
          const violations = lib.scheduleViolations(card);
          if (violations.length)
            throw new Error(
              c.id + " 손댄 카드가 하드 제약 위반: " + violations[0].message,
            );
          return { card, origins, pins: lib.pinsFromResult(card) };
        });
        const base = { case: c.id, scenario: sc.id, seed };
        if (!prep) {
          report.runs.push({ ...base, skipped: true });
          continue;
        }
        const { card, pins, origins } = prep;
        if (LEVELS_MODE) {
          const rec = await levelMeasure(c, card, pins, origins, sel);
          report.runs.push({ ...base, pins: pins.length, ...rec });
          console.log(
            `${c.id} ${sc.id}#${seed}: 고정 ${pins.length}, ` +
              rec.configs[0].seq.map((e) => `${e.level} ${e.region.movable}/${e.region.total} ${e.skipped || (e.sameAs ? "=" + e.sameAs : e.improved ? "개선" : e.reason)}`).join(", "),
          );
          continue;
        }
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
              ) || "R(되돌린 배치)"
            : null;
          // 이전 정책(수업 유지 조건 없이 비교 기준만)으로도 개선이었는지 — 같은 시드의 이전 측정과 비교용.
          const gated = all.filter(
            (r) =>
              !lib.missingPins(r.assigned, pins).length &&
              !lib.scheduleViolations(r).length,
          );
          const oldImproved =
            gated.length > 0 && lib.isSchedule2ResultBetter(bestOf(gated), card);
          // 회원별 횟수 감소까지 금지했다면 개선이었는지(재배분 허용 결정의 영향 확인용).
          const memberGated = gated.filter((r) => {
            const left = new Map();
            card.assigned.forEach((a) => left.set(a.memberId, (left.get(a.memberId) || 0) + 1));
            r.assigned.forEach((a) => left.has(a.memberId) && left.set(a.memberId, left.get(a.memberId) - 1));
            return [...left.values()].every((n) => n <= 0);
          });
          const perMemberImproved =
            memberGated.length > 0 &&
            lib.isSchedule2ResultBetter(bestOf(memberGated), card);
          const stab =
            out.status === "improved"
              ? stabilityMeasure(
                  card,
                  pins,
                  out,
                  lib.mulberry32(hashSeed(c.id + "|" + sc.id + "|" + seed + "|revert")),
                )
              : null;
          // 제안이 지금 카드에서 얼마나 바뀌는지(5b "현재 스케줄과의 차이" 비용 판단용).
          const change = out.proposal ? changeOf(card, out.proposal.result) : null;
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
            oldImproved,
            perMemberImproved,
            stab,
            change,
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
  (LEVELS_MODE ? summarizeLevels : summarize)(report);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
