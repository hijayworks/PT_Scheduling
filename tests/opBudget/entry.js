// tests/opBudget.js가 esbuild로 브라우저용(IIFE) 번들을 만들어 실제 Chromium에 올리는 엔트리. 앱과 같은
// 엔진 진입점(generateCandidatesAsync·generateSchedule2Async, 엔진 Web Worker, 운영 시간 예산)을 그대로
// 부르고, 결과 비교에 필요한 순수 함수만 window.PT로 내보낸다. 앱 화면(schedule3.js 등)은 불러오지 않는다.
import { state, runtime } from "../../src/state.js";
import { withSelectionOverride } from "../../src/selectionOverride.js";
import { generateCandidatesAsync } from "../../src/engine/greedy.js";
import { generateSchedule2Async } from "../../src/engine/chainDp.js";
import { selectReoptimization } from "../../src/engine/candidateSelection.js";
import { isSchedule2ResultBetter } from "../../src/engine/scheduleCompare.js";
import { scheduleMetrics } from "../../src/engine/scheduleQuality.js";
import {
  assignmentDiff,
  metricDiff,
  summarizeMetricDiff,
} from "../../src/engine/candidateDiff.js";
import { impactRegion } from "../../src/engine/localReoptimize.js";
import { pinKey } from "../../src/engine/pins.js";

let sel = [[], []];
let card = null;
const proposals = new Map();

function load(s, c) {
  state.locations = s.locations;
  state.travelTimes = s.travelTimes;
  state.members = s.members;
  state.requests = s.requests;
  runtime.availableCells = new Set(s.availableCells);
  runtime.candidates = [];
  sel = [s.excludedMemberIds3, s.onceLimitedMemberIds3];
  const byId = new Map(state.members.map((m) => [m.id, m]));
  card = {
    assigned: c.assigned,
    unassignedMembers: c.unassignedIds.map((id) => byId.get(id)),
  };
  proposals.clear();
}

function region(pins, level, origins) {
  const r = impactRegion(card, pins, level, origins);
  return {
    key: r.movable.map(pinKey).sort().join(","),
    total: r.total,
    movable: r.movable.length,
    temp: r.tempPinned,
  };
}

// 한 Level·예산으로 재최적화 한 번. withBC면 앱의 전체 재최적화처럼 후보B·C도 만든다.
async function run({ key, pins, origins, level, budget, withBC }) {
  const r = impactRegion(card, pins, level, origins);
  return withSelectionOverride(...sel, async () => {
    const t0 = performance.now();
    const results = [];
    let bcMs = 0;
    if (withBC) {
      const bc = await generateCandidatesAsync(() => {}, {}, r.pins);
      results.push(...bc.built.filter(Boolean), ...bc.pools.flat());
      bcMs = performance.now() - t0;
    }
    const cards = await generateSchedule2Async(() => {}, {
      pins: r.pins,
      budgetScale: budget,
    });
    cards.forEach((c) => results.push(c.result, ...(c.pool || [])));
    const ms = performance.now() - t0;
    const out = selectReoptimization(card, results, r.pins);
    const res = {
      ms: Math.round(ms),
      bcMs: Math.round(bcMs),
      status: out.status,
      reason: out.reason,
    };
    if (out.status === "improved") {
      const p = out.proposal.result;
      proposals.set(key, p);
      res.counts = assignmentDiff(card, p).counts;
      res.quality = metricDiff(scheduleMetrics(card), scheduleMetrics(p));
      res.summary = summarizeMetricDiff(res.quality);
    }
    return res;
  });
}

// base 대비 other: { otherBetter, baseBetter, summary(base → other에서 얻는 것 대신 포기하는 것) }.
function compare(baseKey, otherKey) {
  const a = proposals.get(baseKey),
    b = proposals.get(otherKey);
  if (!a || !b) return null;
  return withSelectionOverride(...sel, () => ({
    otherBetter: isSchedule2ResultBetter(b, a),
    baseBetter: isSchedule2ResultBetter(a, b),
    summary: summarizeMetricDiff(metricDiff(scheduleMetrics(a), scheduleMetrics(b))),
    changedMembers: [
      assignmentDiff(card, a).counts.changedMembers,
      assignmentDiff(card, b).counts.changedMembers,
    ],
  }));
}

window.PT = { load, region, run, compare };
