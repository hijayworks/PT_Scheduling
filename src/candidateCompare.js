import { DAYS } from "./constants.js";
import { minutesLabel, slotLabel } from "./utils.js";
import { memberById, locationById } from "./domain.js";
import {
  metricDiff,
  assignmentDiff,
  summarizeMetricDiff,
  formatDelta,
} from "./engine/candidateDiff.js";

// 추천안과 다른 후보 하나의 상세 비교 패널. 무엇을 얻고 무엇을 포기하는지(요약 문장), 지표별
// 절대값·차이, 회원별 실제 배정 차이를 보여준다. 계산은 candidateDiff.js의 순수 함수가 한다.
// base/other: { label, result, metrics }

const UNITS = {
  unassigned: "명",
  sessions: "회",
  inefficientMoves: "회",
  travelCount: "회",
  travelMinutes: "분",
  idleMinutes: "분",
  workDays: "일",
  spanMinutes: "분",
};
const CLOCK_KEYS = new Set(["firstStartMinute", "lastEndMinute"]);
const formatValue = (key, v) =>
  CLOCK_KEYS.has(key) ? (v ? minutesLabel(v) : "-") : v + UNITS[key];

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

function placeLabel(p) {
  const loc = locationById(p.locationId);
  return `${DAYS[p.day]} ${slotLabel(p.startSlot)} ${loc ? loc.name : "?"}`;
}

const STATUS_LABELS = { assigned: "미배정 → 배정", unassigned: "배정 → 미배정" };

function changeLabel(c) {
  if (!c.from) return "수업 추가 " + placeLabel(c.to);
  if (!c.to) return "수업 빠짐 " + placeLabel(c.from);
  const what = [
    c.dayChanged && "요일",
    c.startChanged && "시작 시각",
    c.locationChanged && "지점",
  ].filter(Boolean);
  return `${placeLabel(c.from)} → ${placeLabel(c.to)} (${what.join("·")} 변경)`;
}

export function renderCandidateCompare(container, base, other, onClose) {
  container.innerHTML = "";
  container.hidden = false;

  const head = el("div", "candidate-compare-head");
  head.appendChild(
    el("h3", "candidate-compare-title", `${base.label} ↔ ${other.label} 비교`),
  );
  const closeBtn = el("button", "btn btn-ghost candidate-compare-close", "닫기");
  closeBtn.type = "button";
  closeBtn.addEventListener("click", onClose);
  head.appendChild(closeBtn);
  container.appendChild(head);

  const diff = metricDiff(base.metrics, other.metrics);
  const summary = el("p", "candidate-compare-summary");
  summary.append(
    el("b", null, "이 후보를 고르면 "),
    summarizeMetricDiff(diff),
  );
  container.appendChild(summary);
  appendMetricTable(container, base, other, diff, "추천 대비");
  appendAssignmentDiff(container, base, other);
}

// 재최적화 제안 패널(5b-2b): 지금 수정 카드(current) 대비 고른 제안이 무엇이 좋아지고 나빠지는지, 지표, 유지되는
// 수업 수, 변경 회원·세션 수, 회원별 배정 차이와 [적용]/[버리기]/[더 넓게 찾아보기 | 전체 일정 다시 탐색].
// 국소 제안은 "변경 최소화 제안"이며 가장 좋은 일정이라는 뜻이 아님을 문구로 밝힌다. 제안이 여럿이면(더 넓게 찾은
// 더 나은 결과) 고를 수 있게 하고, 첫 제안(변경 최소화)과 다른 제안의 차이를 지표·배정 차이로 보여준다.
// p: { current, keptCount, proposals: [{ label, scope, local, result, metrics, variantIdx, variantCount }],
//      selected, notice, widen: { label, scope, hint } | null, onSelect(i), onVariant(idx), onApply, onDiscard, onWiden }
export function renderReoptimizeProposal(container, p) {
  container.innerHTML = "";
  container.hidden = false;
  const chosen = p.proposals[p.selected];
  const head = el("div", "candidate-compare-head");
  head.appendChild(
    el(
      "h3",
      "candidate-compare-title",
      chosen ? "재최적화 — " + chosen.label : "재최적화",
    ),
  );
  container.appendChild(head);
  if (p.proposals.length > 1) {
    const choices = el("div", "reopt-choices");
    p.proposals.forEach((x, i) => {
      const n = assignmentDiff(p.current.result, x.result).counts;
      const b = el(
        "button",
        "btn btn-ghost reopt-choice",
        `${x.label} · 회원 ${n.changedMembers}명 변경`,
      );
      b.type = "button";
      b.setAttribute("aria-pressed", String(i === p.selected));
      b.addEventListener("click", () => p.onSelect(i));
      choices.appendChild(b);
    });
    container.appendChild(choices);
  }
  if (chosen) appendProposal(container, p, chosen);
  if (p.notice) container.appendChild(el("p", "reopt-notice", p.notice));
  const actions = el("div", "reopt-actions");
  const button = (cls, label, onClick) => {
    const b = el("button", "btn " + cls, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    actions.appendChild(b);
    return b;
  };
  if (chosen) button("btn-primary reopt-apply", "적용", p.onApply);
  button("btn-ghost reopt-discard", chosen ? "버리기" : "닫기", p.onDiscard);
  if (p.widen) {
    const w = button("btn-ghost reopt-widen", p.widen.label, p.onWiden);
    w.title = p.widen.scope + " 범위로 다시 찾습니다";
    actions.appendChild(el("span", "reopt-hint", p.widen.hint));
  }
  container.appendChild(actions);
}

function appendProposal(container, p, chosen) {
  const { counts } = assignmentDiff(p.current.result, chosen.result);
  const changed = `회원 ${counts.changedMembers}명(수업 ${counts.changedSessions}개)의 일정이 바뀝니다.`;
  container.appendChild(
    el(
      "p",
      "candidate-compare-summary",
      chosen.local
        ? `유지할 수업 ${p.keptCount}개는 그대로 두고 ${chosen.scope} 범위의 수업만 다시 짰습니다. ${changed} 적게 바꾸는 대신 더 큰 개선을 놓쳤을 수 있습니다(가장 좋은 일정이라는 뜻은 아닙니다). 적용하기 전까지 지금 카드는 바뀌지 않습니다.`
        : `유지할 수업 ${p.keptCount}개는 그대로 두고 나머지 일정 전체를 다시 짰습니다. ${changed} 적용하기 전까지 지금 카드는 바뀌지 않습니다.`,
    ),
  );
  const diff = metricDiff(p.current.metrics, chosen.metrics);
  const list = (effect) =>
    diff
      .filter((d) => d.effect === effect)
      .map((d) => formatDelta(d.key, d.delta))
      .join(" / ") || "없음";
  const gains = el("p", "reopt-effect reopt-better");
  gains.append(el("b", null, "좋아지는 것 "), list("better"));
  const losses = el("p", "reopt-effect reopt-worse");
  losses.append(el("b", null, "나빠지는 것 "), list("worse"));
  container.append(gains, losses);
  if (chosen.variantCount > 1) {
    const pager = el("div", "candidate-pool-pager");
    const btn = (label, idx) => {
      const b = el("button", "btn btn-ghost reopt-variant-btn", label);
      b.type = "button";
      b.disabled = idx < 0 || idx >= chosen.variantCount;
      b.addEventListener("click", () => p.onVariant(idx));
      return b;
    };
    pager.append(
      btn("이전 배치", chosen.variantIdx - 1),
      el(
        "span",
        "pool-pager-label",
        `같은 품질의 배치 ${chosen.variantIdx + 1}/${chosen.variantCount}`,
      ),
      btn("다음 배치", chosen.variantIdx + 1),
    );
    container.appendChild(pager);
  }
  appendMetricTable(
    container,
    { ...p.current, label: "지금 카드" },
    { ...chosen, label: "제안" },
    diff,
    "지금 대비",
  );
  appendAssignmentDiff(container, p.current, chosen);
  // 변경 최소화 제안과 더 넓게 찾은 제안의 차이: 고른 것이 첫 제안이면 마지막(가장 나은) 제안과 비교한다.
  if (p.proposals.length > 1) {
    const base = p.proposals[0];
    const other = p.selected === 0 ? p.proposals[p.proposals.length - 1] : chosen;
    const n = (x) => assignmentDiff(p.current.result, x.result).counts;
    const pairDiff = metricDiff(base.metrics, other.metrics);
    container.appendChild(
      el("h4", "candidate-compare-subtitle", `${base.label}과 ${other.label} 비교`),
    );
    container.appendChild(
      el(
        "p",
        "candidate-compare-summary reopt-pair",
        `${base.label}: 회원 ${n(base).changedMembers}명 변경 / ${other.label}: 회원 ${n(other).changedMembers}명 변경. ${other.label}을 고르면 ${summarizeMetricDiff(pairDiff)}`,
      ),
    );
    appendMetricTable(container, base, other, pairDiff, "차이");
    appendAssignmentDiff(container, base, other, "두 제안의 배정 차이");
  }
}

function appendMetricTable(container, base, other, diff, deltaHeader) {
  const table = el("table", "candidate-compare-table");
  const thead = el("thead");
  const hr = el("tr");
  ["지표", base.label, other.label, deltaHeader].forEach((t) =>
    hr.appendChild(el("th", null, t)),
  );
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el("tbody");
  diff.forEach((d) => {
    const tr = el("tr");
    tr.appendChild(el("th", null, d.label));
    tr.appendChild(el("td", null, formatValue(d.key, d.base)));
    tr.appendChild(el("td", null, formatValue(d.key, d.value)));
    tr.appendChild(
      el(
        "td",
        "compare-delta compare-" + d.effect,
        d.effect === "same"
          ? "같음"
          : (d.delta > 0 ? "+" : "") +
              d.delta +
              (CLOCK_KEYS.has(d.key) ? "분" : UNITS[d.key]),
      ),
    );
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const tableWrap = el("div", "candidate-compare-table-wrap");
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);
}

function appendAssignmentDiff(container, base, other, title = "배정 차이") {
  const { members, counts } = assignmentDiff(base.result, other.result);
  container.appendChild(el("h4", "candidate-compare-subtitle", title));
  const countText = [
    `변경 회원 ${counts.changedMembers}명`,
    `요일 변경 ${counts.dayChanges}`,
    `시작 시각 변경 ${counts.startChanges}`,
    `지점 변경 ${counts.locationChanges}`,
    `미배정 → 배정 ${counts.newlyAssigned}명`,
    `배정 → 미배정 ${counts.newlyUnassigned}명`,
  ].join(" · ");
  container.appendChild(el("p", "candidate-compare-counts", countText));
  if (members.length === 0) {
    container.appendChild(
      el("p", "candidate-compare-counts", "배정이 완전히 같습니다."),
    );
    return;
  }
  const list = el("ul", "candidate-compare-members");
  members
    .map((m) => ({ ...m, member: memberById(m.memberId) }))
    .sort((x, y) =>
      (x.member ? x.member.name : "").localeCompare(
        y.member ? y.member.name : "",
        "ko",
      ),
    )
    .forEach((m) => {
      const li = el("li");
      li.appendChild(el("b", null, m.member ? m.member.name : "(삭제된 회원)"));
      if (STATUS_LABELS[m.status])
        li.appendChild(
          el(
            "span",
            "compare-status compare-status-" + m.status,
            STATUS_LABELS[m.status],
          ),
        );
      li.append(" " + m.changes.map(changeLabel).join(", "));
      list.appendChild(li);
    });
  container.appendChild(list);
}
