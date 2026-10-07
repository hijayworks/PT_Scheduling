// 두 후보의 차이를 계산하는 순수 함수들(state·DOM을 읽지 않는다). 후보 비교 UI가 쓰고, 이후 부분
// 재최적화에서 "다시 최적화한 결과가 원래 결과와 무엇이 달라졌는지"를 보여줄 때도 그대로 쓴다.
//   metricDiff(base, other): scheduleMetrics 두 개 → 지표별 절대값·차이·좋아졌는지
//   assignmentDiff(base, other): 결과 {assigned} 두 개 → 회원별 배정 변화
//   summarizeMetricDiff(diff): "빈 시간 -60분 대신 수업 -1 / 이동 +1" 한 문장

// 업무 정책값: 비교 지표와 좋은 방향(+1 클수록 좋음, -1 작을수록 좋음, 0 방향 없음). 근무 부담은
// 체류 시간(요일별 첫 수업 시작~마지막 수업 종료의 합)으로 본다. 첫 시작·마지막 종료는 일정이 통째로
// 앞당겨지거나 밀린 것일 뿐일 수 있어 좋고 나쁨을 판정하지 않는 참고 정보다(10~20시 → 9~19시는 개선
// 아님). 근무일 수와 체류 시간은 비교·설명용이고 후보 선정(QUALITY_AXES)에는 쓰지 않는다.
export const COMPARE_METRICS = [
  { key: "unassigned", label: "미배정 회원", dir: -1 },
  { key: "sessions", label: "총 수업", dir: 1 },
  { key: "inefficientMoves", label: "비효율 이동", dir: -1 },
  { key: "travelCount", label: "이동 횟수", dir: -1 },
  { key: "travelMinutes", label: "이동 시간", dir: -1 },
  { key: "idleMinutes", label: "빈 시간", dir: -1 },
  { key: "workDays", label: "근무일 수", dir: -1 },
  { key: "spanMinutes", label: "체류 시간(요일 합)", dir: -1 },
  { key: "firstStartMinute", label: "첫 수업 시작", dir: 0 },
  { key: "lastEndMinute", label: "마지막 수업 종료", dir: 0 },
];

// UI 표현값: 차이 한 개를 짧게 쓸 때의 이름과 단위("수업 +1", "빈 시간 -60분"). 카드의 trade-off
// 문구(candidateSelection.formatTradeoff)도 이 표기를 쓴다.
const DELTA_LABELS = {
  unassigned: ["미배정", "명"],
  sessions: ["수업", ""],
  inefficientMoves: ["비효율 이동", ""],
  travelCount: ["이동", ""],
  travelMinutes: ["이동 시간", "분"],
  idleMinutes: ["빈 시간", "분"],
  workDays: ["근무일", "일"],
  spanMinutes: ["체류 시간", "분"],
  firstStartMinute: ["첫 시작", "분"],
  lastEndMinute: ["마지막 종료", "분"],
};
export function formatDelta(key, delta) {
  const [label, unit] = DELTA_LABELS[key];
  return `${label} ${delta > 0 ? "+" : ""}${delta}${unit}`;
}

// [{key, label, base, value, delta, effect: "better"|"worse"|"same"|"neutral"}] — COMPARE_METRICS 순서.
// neutral: 값은 달라졌지만 방향이 없는 지표(dir 0).
export function metricDiff(base, other) {
  return COMPARE_METRICS.map(({ key, label, dir }) => {
    const delta = other[key] - base[key];
    const effect =
      delta === 0
        ? "same"
        : dir === 0
          ? "neutral"
          : delta * dir > 0
            ? "better"
            : "worse";
    return { key, label, base: base[key], value: other[key], delta, effect };
  });
}

// 얻는 것(좋아진 지표)을 앞에, 포기하는 것(나빠진 지표)을 뒤에 둔 한 문장. 차이가 없는 지표는 뺀다.
// 방향 없는 지표의 변화는 판정에 넣지 않고 끝에 " · 참고: …"로만 붙인다.
export function summarizeMetricDiff(diff) {
  const list = (effect) =>
    diff
      .filter((d) => d.effect === effect)
      .map((d) => formatDelta(d.key, d.delta))
      .join(" / ");
  const gains = list("better"),
    losses = list("worse"),
    neutral = list("neutral");
  const note = neutral ? ` · 참고: ${neutral}` : "";
  if (gains && losses) return `${gains} 대신 ${losses}${note}`;
  if (gains) return `${gains} (나빠지는 지표 없음)${note}`;
  if (losses) return `나아지는 지표 없이 ${losses}${note}`;
  if (neutral) return `좋아지거나 나빠지는 지표 없음${note}`;
  return "지표는 모두 같고 배치만 다릅니다";
}

const sameSession = (a, b) =>
  a.day === b.day &&
  a.startSlot === b.startSlot &&
  a.locationId === b.locationId;
const bySlot = (a, b) => a.day - b.day || a.startSlot - b.startSlot;

// 한 회원의 세션 두 목록을 짝짓는다: 완전히 같은 세션은 변화 없음으로 빼고, 같은 요일끼리 먼저,
// 남은 것은 요일·시각 순서대로 짝짓는다. 짝이 없는 세션은 추가(from null)·삭제(to null)다.
function pairSessions(from, to) {
  let a = from.slice().sort(bySlot),
    b = to.slice().sort(bySlot);
  const pairs = [];
  const take = (match) => {
    a = a.filter((x) => {
      const i = b.findIndex((y) => match(x, y));
      if (i < 0) return true;
      pairs.push([x, b[i]]);
      b.splice(i, 1);
      return false;
    });
  };
  take(sameSession);
  const unchanged = pairs.length;
  take((x, y) => x.day === y.day);
  take(() => true);
  return pairs
    .slice(unchanged)
    .concat(a.map((x) => [x, null]), b.map((y) => [null, y]));
}

const place = (r) =>
  r && { day: r.day, startSlot: r.startSlot, locationId: r.locationId };

// base → other로 바꿀 때 회원별 배정 변화. 배정 유무는 assigned만 본다(미배정 = 세션 0개).
// 반환 {members: [{memberId, status, changes}], counts}
//   status: "assigned"(미배정 → 배정) | "unassigned"(배정 → 미배정) | "moved"(배정 유지, 세션 변경)
//   changes: [{from, to, dayChanged, startChanged, locationChanged}] — from/to는 {day, startSlot,
//     locationId} 또는 null(세션 추가·삭제). 세 플래그는 from·to가 모두 있을 때만 의미가 있다.
//   counts.newlyUnassigned: 기존 배정 회원이 미배정이 된 수 — 미배정 총수가 같아도 신규 배정과 맞바뀌면 0이 아니다.
export function assignmentDiff(base, other) {
  const byMember = (result) => {
    const map = new Map();
    result.assigned.forEach((r) => {
      if (!map.has(r.memberId)) map.set(r.memberId, []);
      map.get(r.memberId).push(r);
    });
    return map;
  };
  const a = byMember(base),
    b = byMember(other);
  const ids = [...new Set([...a.keys(), ...b.keys()])].sort();
  const members = [];
  const countShift = [];
  ids.forEach((memberId) => {
    const from = a.get(memberId) || [],
      to = b.get(memberId) || [];
    const changes = pairSessions(from, to).map(([x, y]) => ({
      from: place(x),
      to: place(y),
      dayChanged: !!(x && y) && x.day !== y.day,
      startChanged: !!(x && y) && x.startSlot !== y.startSlot,
      locationChanged: !!(x && y) && x.locationId !== y.locationId,
    }));
    if (!changes.length) return;
    countShift.push(to.length - from.length);
    const status = !from.length
      ? "assigned"
      : !to.length
        ? "unassigned"
        : "moved";
    members.push({ memberId, status, changes });
  });
  const all = members.flatMap((m) => m.changes);
  const countOf = (pred) => all.filter(pred).length;
  return {
    members,
    counts: {
      changedMembers: members.length,
      changedSessions: all.length,
      dayChanges: countOf((c) => c.dayChanged),
      startChanges: countOf((c) => c.startChanged),
      locationChanges: countOf((c) => c.locationChanged),
      // 같은 요일·지점에서 시작 시각만 바뀐 세션 수.
      startOnlyChanges: countOf(
        (c) => c.startChanged && !c.dayChanged && !c.locationChanged,
      ),
      newlyAssigned: members.filter((m) => m.status === "assigned").length,
      newlyUnassigned: members.filter((m) => m.status === "unassigned").length,
      sessionsAdded: countOf((c) => !c.from),
      sessionsRemoved: countOf((c) => !c.to),
      // 회원 간 수업 재배분: 수업 횟수가 줄어든/늘어난 회원 수(미배정 전환·신규 배정 포함)와 회원별
      // 횟수 증감의 절대값 합. 총 수업이 같아도 A -1회·B +1회면 각 1명, 증감 총량 2.
      membersFewer: countShift.filter((d) => d < 0).length,
      membersMore: countShift.filter((d) => d > 0).length,
      sessionCountShift: countShift.reduce((n, d) => n + Math.abs(d), 0),
    },
  };
}
