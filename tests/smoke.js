#!/usr/bin/env node
// index.html을 headless 브라우저로 열어 핵심 사용 흐름(데이터 로드 → 후보A/B/C 생성 →
// 저장 → 새로고침 후 유지)이 깨지지 않았는지 확인하는 E2E 스모크 테스트.
// MCP의 대화형 Playwright 브라우저와는 별개의 독립 프로세스를 띄우므로 그 브라우저가
// 사용 중이어도 영향받지 않는다.
//
// 후보A(체인DP) 생성은 카드 3장 각각이 시간 예산제 다듬기(최대 90초/카드, 데이터 크기와
// 무관하게 시간 비율로 식히는 방식)를 쓰므로 트리비얼한 입력에서도 수 분이 걸릴 수 있다.
// 그래서 기본값으로는 chainDp.js의 window.__PT_TEST_BUDGET_SCALE__ 훅을 이용해 모든 시간
// 예산을 비례 축소해(SMOKE_A_BUDGET_SCALE, 기본 0.005) 몇 초 안에 끝내면서도 실제 코드
// 경로(탐색→다듬기→담금질)는 그대로 exercise한다 — 결과 품질이 아니라 "안 깨졌는지"만
// 보는 스모크 테스트 목적에 맞다. 완전히 건너뛰려면 SMOKE_SKIP_A=1, 실제 운영 예산 그대로
// (수 분~수십 분) 돌려 진짜 성능/품질까지 확인하려면 SMOKE_FULL_BUDGET_A=1을 쓴다.
"use strict";

const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const INDEX_URL = "file://" + path.join(ROOT, "index.html");
const STORAGE_KEY = "pt_schedule_state_v3";
const SKIP_A = process.env.SMOKE_SKIP_A === "1";
const FULL_BUDGET_A = process.env.SMOKE_FULL_BUDGET_A === "1";
const A_BUDGET_SCALE = Number(process.env.SMOKE_A_BUDGET_SCALE || "0.005");

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
    if (!SKIP_A && !FULL_BUDGET_A) {
      await page.addInitScript(
        (scale) => {
          window.__PT_TEST_BUDGET_SCALE__ = scale;
        },
        A_BUDGET_SCALE
      );
    }

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
      // 후보A(체인DP) 생성. 기본값은 위에서 주입한 __PT_TEST_BUDGET_SCALE__로 모든 시간
      // 예산을 축소해 몇 초 안에 끝난다. SMOKE_FULL_BUDGET_A=1이면 실제 운영 예산(카드 3장 ×
      // 그룹당 최대 7분) 그대로 돌린다 — 회원 1명짜리 트리비얼한 입력도 실측 몇 분~수십 분이
      // 걸릴 수 있으므로(시간 비율 기반 담금질이라 데이터 크기와 무관), 그만큼 타임아웃도
      // 늘어난다.
      await clickGenerateAndWait(
        page,
        "#generateBtnA3",
        FULL_BUDGET_A ? 45 * 60 * 1000 : 60 * 1000
      );
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
  const aNote = SKIP_A
    ? "후보A 생략"
    : FULL_BUDGET_A
      ? "후보A 실제 운영 예산으로 검증"
      : "후보A 예산 축소 검증";
  console.log(
    "PASS — 스모크 테스트 통과 (" + aNote + ", 후보B/C 생성, 새로고침 유지, 회원 목록 렌더링 확인됨)"
  );
}

main().catch((err) => {
  console.error("스모크 테스트 실행 중 예외 발생:", err);
  process.exit(1);
});
