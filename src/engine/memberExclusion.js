import { state } from "../state.js";
import { memberById } from "../domain.js";
import { withSelectionOverride } from "../selectionOverride.js";
import { generateCandidatesAsync } from "./greedy.js";
import { scheduleMetrics, scheduleViolations } from "./scheduleQuality.js";
import { layoutSignature, pickRepresentative } from "./candidateSelection.js";
import { TEST_BUDGET_SCALE } from "./chainDp.js";

// 알고리즘 튜닝값: 회원 1명을 뺀 탐색 한 번의 그리디 시도 횟수(전략마다). 회원 수만큼 반복하므로 본 생성
// (INITIAL_SEARCH_ATTEMPTS 1000)보다 작게 둔다 — 회원 수에 비례해 생성 시간이 늘어난다(사용자 결정 2026-10-11:
// 몇 분 늘어나는 것은 괜찮고 품질 우선).
// 테스트 하네스가 window.__PT_TEST_BUDGET_SCALE__를 지정했을 때만 후보A 예산과 같은 비율로 줄인다(운영은 그대로).
export const MEMBER_EXCLUSION_ATTEMPTS = Math.max(
  2,
  Math.round(200 * TEST_BUDGET_SCALE),
);
// 이 탐색이 채우는 대표 역할(candidateSelection.js REPRESENTATIVE_ROLES).
const ROLES = ["unassignedSessions", "unassignedTravel"];

// 회원별 추가 탐색 대상: 추천 후보에 배정된 회원(이미 미배정인 회원을 빼도 미배정 수는 늘지 않는다). id 순.
export function memberExclusionTargets(rec) {
  const unassigned = new Set(rec.unassignedMembers.map((m) => m.id));
  return [...new Set(rec.assigned.map((r) => r.memberId))]
    .filter((id) => !unassigned.has(id) && memberById(id))
    .sort();
}

// 미배정 1명 추가·절충 후보 탐색(사용자 결정 2026-10-11): 추천 후보에 배정된 회원을 한 명씩 탐색 내부 조건으로
// 제외하고 그리디 엔진(후보B·C와 같은 진입점, 근무 시간·이동시간·하루 1회·연속 배정 제외 등 필수 제약 그대로)을
// 다시 돌린다. 저장된 '미배정 회원' 설정(state.excludedMemberIds3)은 바꾸지 않는다 — 제외는 이 호출 동안의
// selectionOverride에만 있고, 결과의 unassignedMembers에 제외한 회원을 넣어 원래 배정 대상 기준으로 센다. 하드
// 제약은 override를 푼 뒤 scheduleViolations로 다시 검사해 어긴 결과는 버린다.
// 회원마다 찾은 결과 중 두 역할(수업 증가형·이동 감소형)의 대표만(같은 배치면 하나) onFound로 넘긴다.
// rec: 추천 entry({result, metrics}). onMember(i, total, member): 회원마다 시작 전에, onProgress(i, total, p):
// 그 회원 탐색의 진행률. 취소는 엔진의 checkGenerationCancelled가 GenerationCancelledError로 던진다.
// 반환: { members: 탐색한 회원 수, found: 넘긴 결과 수 }
export async function searchMemberExclusions(
  rec,
  {
    attempts = MEMBER_EXCLUSION_ATTEMPTS,
    workerOptions = {},
    onMember = () => {},
    onProgress = () => {},
    onFound = () => {},
  } = {},
) {
  const ids = memberExclusionTargets(rec.result);
  let found = 0;
  for (let i = 0; i < ids.length; i++) {
    const member = memberById(ids[i]);
    onMember(i, ids.length, member);
    const built = await withSelectionOverride(
      state.excludedMemberIds3.concat(member.id),
      state.onceLimitedMemberIds3,
      () =>
        generateCandidatesAsync((p) => onProgress(i, ids.length, p), {
          ...workerOptions,
          attempts,
        }),
    );
    const seen = new Set();
    const entries = built.built
      .concat(...Object.values(built.pools))
      .filter(Boolean)
      .map((r) => ({
        assigned: r.assigned,
        unassignedMembers: r.unassignedMembers
          .filter((m) => m.id !== member.id)
          .concat(member),
        excludedMemberId: member.id,
      }))
      .filter((r) => {
        const sig = layoutSignature(r);
        return !seen.has(sig) && seen.add(sig) && !scheduleViolations(r).length;
      })
      .map((result) => ({ result, metrics: scheduleMetrics(result) }));
    const picked = [
      ...new Set(
        ROLES.map((role) => pickRepresentative(role, rec, entries)).filter(
          Boolean,
        ),
      ),
    ].map((e) => e.result);
    found += picked.length;
    onFound(picked);
  }
  return { members: ids.length, found };
}
