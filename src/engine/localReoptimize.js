// 국소 재최적화(5b-2) 영향 범위 정책의 단일 소유자. 사용자가 고정한 세션(seed, pins.js)에서 시작해
// "무엇을 움직일 수 있는가"만 Level별로 넓힌다. 범위 밖 기존 세션은 임시 고정(pins)으로 넘겨 엔진 API를
// 바꾸지 않는다. "어디로 갈 수 있는가"(목적지)는 제한하지 않는다 — 움직일 수 있는 세션과 미배정 회원은
// 기존 엔진의 신청 가능 범위 안 어디로든 갈 수 있다(사용자 결정 2026-10-07, 5b-2a 측정 단계).
//   L1: seed가 있는 요일에서 seed 바로 앞·뒤 세션 1개씩 + 원래 위치를 알면 원래 요일에서 빈자리 앞·뒤 1개씩
//   L2: seed 요일 전체 + 원래 위치를 알면 원래 요일 전체 (시간 근접 ±N분 기준은 근거가 없어 두지 않는다)
//   L3: L2 + L2에서 움직일 수 있는 회원·seed 회원의 다른 요일 세션 전부
//   full: 사용자 고정 말고 전부(5b-1 전체 재최적화와 같다)
// 지금은 측정(tests/reoptimize.js --levels)만 쓴다. 정지 규칙·범위 비율 fallback 임계값·목적지 제한은 측정
// 후 사용자가 정한다.
import { pinKey } from "./pins.js";

export const IMPACT_LEVELS = ["L1", "L2", "L3", "full"];

const asPin = (a) => ({
  id: a.id,
  memberId: a.memberId,
  day: a.day,
  startSlot: a.startSlot,
  duration: a.duration,
  locationId: a.locationId,
});

// current: 지금 카드, userPins: 사용자 고정(pinsFromResult), origins: 옮기기 전 자리 [{day, startSlot}]
// (모르면 []). 반환 { pins: 사용자 고정 + 임시 고정, movable: 움직일 수 있는 current 세션, total,
// userPinned, tempPinned }.
export function impactRegion(current, userPins, level, origins = []) {
  if (!IMPACT_LEVELS.includes(level))
    throw new Error("알 수 없는 영향 범위 Level: " + level);
  const userKeys = new Set(userPins.map(pinKey));
  const free = current.assigned.filter((a) => !userKeys.has(pinKey(a)));
  const open = new Set();
  if (level === "full") free.forEach((a) => open.add(a));
  else if (level === "L1") {
    // 그 요일의 움직일 수 있는 세션 중 slot 바로 앞(시작 < slot)과 바로 뒤(시작 ≥ slot) 하나씩.
    const around = (day, slot) => {
      const list = free
        .filter((a) => a.day === day)
        .sort((a, b) => a.startSlot - b.startSlot);
      const next = list.findIndex((a) => a.startSlot >= slot);
      const before = next < 0 ? list[list.length - 1] : list[next - 1];
      [before, list[next]].forEach((a) => a && open.add(a));
    };
    userPins.forEach((p) => around(p.day, p.startSlot));
    origins.forEach((o) => around(o.day, o.startSlot));
  } else {
    const days = new Set(userPins.concat(origins).map((x) => x.day));
    free.filter((a) => days.has(a.day)).forEach((a) => open.add(a));
    if (level === "L3") {
      const members = new Set(
        userPins.map((p) => p.memberId).concat([...open].map((a) => a.memberId)),
      );
      free.filter((a) => members.has(a.memberId)).forEach((a) => open.add(a));
    }
  }
  const temp = free.filter((a) => !open.has(a));
  return {
    pins: userPins.concat(temp.map(asPin)),
    movable: free.filter((a) => open.has(a)),
    total: current.assigned.length,
    userPinned: current.assigned.length - free.length,
    tempPinned: temp.length,
  };
}

// Level 진행: levels 순서대로 영향 범위를 만들고 reoptimize(pins, level)(→ selectReoptimization 결과)를
// 부른다. 측정 단계라 성공해도 멈추지 않고 전부 계산한다. 움직일 세션이 없으면 생성하지 않고(skipped
// "empty"), 범위가 바로 앞 Level과 같으면 다시 생성하지 않고 그 결과를 쓴다(sameAs).
// 취소(GenerationCancelledError)와 엔진 오류는 잡지 않는다 — 다음 Level·전체 fallback으로 넘어가지 않고
// 그대로 호출한 쪽으로 올라간다(조용한 fallback 금지).
// 반환 [{ level, region, outcome, ms, skipped?, sameAs? }]
export async function runImpactLevels(
  current,
  userPins,
  origins,
  reoptimize,
  levels = IMPACT_LEVELS,
) {
  const out = [];
  let prev = null;
  for (const level of levels) {
    const region = impactRegion(current, userPins, level, origins);
    const key = region.movable.map(pinKey).sort().join(",");
    if (!region.movable.length) {
      out.push({ level, region, outcome: null, ms: 0, skipped: "empty" });
      continue;
    }
    if (prev && prev.key === key) {
      out.push({ level, region, outcome: prev.entry.outcome, ms: 0, sameAs: prev.entry.level });
      continue;
    }
    const t = Date.now();
    const outcome = await reoptimize(region.pins, level);
    const entry = { level, region, outcome, ms: Date.now() - t };
    out.push(entry);
    prev = { key, entry };
  }
  return out;
}
