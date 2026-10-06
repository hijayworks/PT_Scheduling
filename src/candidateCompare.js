import { DAYS } from "./constants.js";
import { minutesLabel, slotLabel } from "./utils.js";
import { memberById, locationById } from "./domain.js";
import {
  metricDiff,
  assignmentDiff,
  summarizeMetricDiff,
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
};
const formatValue = (key, v) =>
  key === "lastEndMinute" ? (v ? minutesLabel(v) : "-") : v + UNITS[key];

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

  const table = el("table", "candidate-compare-table");
  const thead = el("thead");
  const hr = el("tr");
  ["지표", base.label, other.label, "추천 대비"].forEach((t) =>
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
              (d.key === "lastEndMinute" ? "분" : UNITS[d.key]),
      ),
    );
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const tableWrap = el("div", "candidate-compare-table-wrap");
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  const { members, counts } = assignmentDiff(base.result, other.result);
  container.appendChild(el("h4", "candidate-compare-subtitle", "배정 차이"));
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
