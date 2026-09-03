#!/usr/bin/env node
// index.html을 headless 브라우저로 열어 핵심 사용 흐름(데이터 로드 → 후보A/B/C 생성 →
// 저장 → 새로고침 후 유지)이 깨지지 않았는지 확인하는 E2E 스모크 테스트.
// MCP의 대화형 Playwright 브라우저와는 별개의 독립 프로세스를 띄우므로 그 브라우저가
// 사용 중이어도 영향받지 않는다.
//
// 후보A(체인DP) 생성은 카드 3장 각각이 시간 예산제 다듬기(최대 90초/카드, 데이터 크기와
// 무관하게 시간 비율로 식히는 방식)를 쓰므로 트리비얼한 입력에서도 수 분이 걸릴 수 있다.
// 리팩터링 중 빠르게 반복 확인할 때는 SMOKE_SKIP_A=1로 그 부분만 건너뛸 수 있다 — 최종
// 검증 때는 반드시 SMOKE_SKIP_A 없이 한 번 더 돌릴 것.
"use strict";

const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const INDEX_URL = "file://" + path.join(ROOT, "index.html");
const STORAGE_KEY = "pt_schedule_state_v3";
const SKIP_A = process.env.SMOKE_SKIP_A === "1";

// 트레이너 근무 가능 시간(월요일 14:00~17:00)과 그 안에 들어오는 회원 희망 시간 하나를
// 미리 채워서, 실제 UI(커스텀 드롭다운·그리드 클릭)를 조작하지 않고도 두 생성 엔진
// (그리디/체인DP)이 실제로 배정 가능한 입력을 갖도록 한다. request는 실제 UI가 만드는
// 형태(addDesiredRange)를 그대로 따른다 — locationId 필드는 없고(위치는 member.locationIds로
// 결정됨), duration은 희망 구간 길이가 아니라 회원 구분별 확정 세션 길이(등록=60분)다.
function buildSeedState() {
  const day = 0; // 월
  const cells = [];
  for (let slot = 12; slot < 30; slot++) cells.push(day + "-" + slot); // 14:00~17:00 (10분 슬롯)
  return {
    locations: [{ id: "loc1", name: "테스트지점" }],
    travelTimes: {},
    members: [{ id: "mem1", name: "테스터", locationIds: ["loc1"], category: "등록" }],
    requests: [{ id: "req1", memberId: "mem1", day, startSlot: 12, duration: 60 }],
    onceLimitedMemberIds3: [],
    excludedMemberIds3: [],
    availableCells: cells,
    currentPage: "schedule3",
    startMinBase: 720
  };
}

async function readState(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function clickGenerateAndWait(page, buttonSelector, timeoutMs) {
  await page.click(buttonSelector);
  await page.waitForFunction(
    (sel) => !document.querySelector(sel).disabled,
    buttonSelector,
    { timeout: timeoutMs }
  );
}

async function main() {
  const failures = [];
  const assert = (cond, msg) => { if (!cond) failures.push(msg); };

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) => failures.push("페이지 런타임 에러: " + err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") failures.push("콘솔 에러: " + msg.text());
    });

    await page.addInitScript(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: STORAGE_KEY, data: buildSeedState() }
    );

    await page.goto(INDEX_URL);
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });

    // 후보B·C(그리디) 생성 — 보통 수 초 안에 끝남, 상태 로드/렌더링/저장 경로를 빠르게 확인
    await clickGenerateAndWait(page, "#generateBtnBC3", 60 * 1000);
    let state = await readState(page);
    assert(
      state && Array.isArray(state.candidates) && state.candidates.length > 0,
      "후보B·C 생성 결과가 비어있음 (그리디 엔진 회귀 의심)"
    );

    if (SKIP_A) {
      console.log("SMOKE_SKIP_A=1 — 후보A(체인DP) 검증은 건너뜀");
    } else {
      // 후보A(체인DP) 생성 — 카드 3장 × 그룹당 최대 7분(PER_GROUP_TOTAL_POLISH_BUDGET_MS)
      // 시간 예산제 다듬기라, 회원 1명짜리 트리비얼한 입력은 물론 회원 8명짜리로도 실측
      // 90초에 진행률 22%(선형 추정 시 40분 이상)로 확인됨. 이건 이번 모듈 분리 작업과
      // 무관한 기존 알고리즘 설계(시간 비율 기반 담금질) 특성이라 여기서 고치지 않고,
      // 테스트 타임아웃만 넉넉히 잡는다 — CI처럼 매번 자동으로 도는 환경이 아니라면
      // SMOKE_SKIP_A=1로 이 구간을 건너뛰고 필요할 때만 수동으로 전체 검증하는 걸 권장.
      await clickGenerateAndWait(page, "#generateBtnA3", 45 * 60 * 1000);
      state = await readState(page);
      assert(
        state && state.schedule3Result && state.schedule3Result.candidateAList
          && state.schedule3Result.candidateAList.some(Boolean),
        "후보A 생성 결과가 비어있음 (체인DP 엔진 회귀 의심)"
      );
    }

    // 새로고침 후에도 데이터와 생성 결과가 유지되는지(localStorage 로드 경로 회귀 확인)
    await page.reload();
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    const reloadedMemberCount = await page.evaluate(() => {
      const raw = localStorage.getItem("pt_schedule_state_v3");
      return raw ? JSON.parse(raw).members.length : -1;
    });
    assert(reloadedMemberCount === 1, "새로고침 후 회원 데이터가 유지되지 않음");

    // 회원관리 페이지가 정상적으로 회원 1명을 렌더링하는지(페이지 전환 + 렌더링 회귀 확인)
    await page.click('.nav-item[data-page="members"]');
    await page.waitForSelector("#pageMembers.active", { timeout: 5000 });
    const memberRowCount = await page.locator("#memberTableBody tr").count();
    assert(memberRowCount === 1, "회원관리 표에 회원이 정상적으로 표시되지 않음 (실제: " + memberRowCount + "행)");
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error("FAIL — 스모크 테스트 실패:");
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  console.log("PASS — 스모크 테스트 통과" + (SKIP_A ? " (후보A 생략)" : " (후보A/B/C 생성, 새로고침 유지, 회원 목록 렌더링 확인됨)"));
}

main().catch((err) => {
  console.error("스모크 테스트 실행 중 예외 발생:", err);
  process.exit(1);
});
