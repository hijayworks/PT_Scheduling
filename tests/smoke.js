#!/usr/bin/env node
// index.html을 headless 브라우저로 열어 핵심 사용 흐름(데이터 로드 → 후보 생성 → 후보 카드 표시 →
// 확정한 후보 보존 → 저장 → 새로고침 후 유지)이 깨지지 않았는지 확인하는 E2E 스모크 테스트.
// MCP의 대화형 Playwright 브라우저와는 별개의 독립 프로세스를 띄우므로 그 브라우저가
// 사용 중이어도 영향받지 않는다.
//
// 후보A(체인DP) 생성은 카드 3장 각각이 시간 예산제 다듬기(최대 90초/카드, 데이터 크기와
// 무관하게 시간 비율로 식히는 방식)를 쓰므로 트리비얼한 입력에서도 수 분이 걸릴 수 있다.
// 그래서 기본값으로는 chainDp.js의 window.__PT_TEST_BUDGET_SCALE__ 훅을 이용해 모든 시간
// 예산을 비례 축소해(SMOKE_A_BUDGET_SCALE, 기본 0.005) 몇 초 안에 끝내면서도 실제 코드
// 경로(탐색→다듬기→담금질)는 그대로 exercise한다 — 결과 품질이 아니라 "안 깨졌는지"만
// 보는 스모크 테스트 목적에 맞다. 실제 운영 예산 그대로(수 분~수십 분) 돌려 진짜 성능/품질까지
// 확인하려면 SMOKE_FULL_BUDGET_A=1을 쓴다.
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const INDEX_URL = "file://" + path.join(ROOT, "index.html");
const STORAGE_KEY = "pt_schedule_state_v3";
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

// 재최적화(5b-2b): 상담 회원(주 1회, 30분)이 월 12:00~18:00 어디든 가능하다. 기본 카드는 B(12:30) · A(14:00, 확정)
// · C(16:00) · D(16:30)라 빈 시간이 150분이다. L1(A 바로 앞뒤 B·C만 움직임, D는 임시 고정)은 B를 A 앞으로 당겨
// 빈 시간 −60분인 변경 최소화 제안을 내고, 전체 탐색은 C·D까지 당겨 빈 시간 0을 만든다(더 나은 결과 → 비교).
// tight: A(12:00, 확정) · B(12:30) · C(13:00) — 빈 시간이 없어 어느 범위에서도 더 나은 배치가 없다.
function buildReoptSeedState(layout = "default") {
  const cells = [];
  for (let slot = 0; slot < 36; slot++) cells.push("0-" + slot);
  const ids = layout === "tight" ? ["A", "B", "C"] : ["A", "B", "C", "D"];
  const requests = [];
  ids.forEach((m) => {
    for (let slot = 0; slot <= 33; slot++)
      requests.push({ id: m + "_" + slot, memberId: m, day: 0, startSlot: slot, duration: 30 });
  });
  const at = (m, slot) => ({ id: m + "_" + slot, memberId: m, day: 0, startSlot: slot, duration: 30, locationId: "loc1" });
  const card =
    layout === "tight"
      ? { assigned: [at("A", 0), at("B", 3), at("C", 6)], unassignedMembers: [], confirmedIds: ["A_0"] }
      : { assigned: [at("B", 3), at("A", 12), at("C", 24), at("D", 27)], unassignedMembers: [], confirmedIds: ["A_12"] };
  return {
    locations: [{ id: "loc1", name: "테스트지점" }],
    travelTimes: {},
    members: ids.map((id) => ({ id, name: "회원" + id, locationIds: ["loc1"], category: "상담" })),
    requests,
    onceLimitedMemberIds3: [],
    excludedMemberIds3: [],
    availableCells: cells,
    currentPage: "schedule3",
    startMinBase: 720,
    candidates: [card],
    schedule3Result: { candidateAList: [null, null, null] },
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
    await page.addInitScript(() => {
      window.__PT_CSP_VIOLATIONS__ = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__PT_CSP_VIOLATIONS__.push({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
        });
      });
    });
    page.on("pageerror", (err) => failures.push("페이지 런타임 에러: " + err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") failures.push("콘솔 에러: " + msg.text());
      // 엔진 워커가 실패하면 메인 스레드로 조용히 대체되므로(결과는 맞지만 느려짐) 경고도 잡는다
      // (src/engine/workerPool.js의 ENGINE_WORKER_WARNING 표식).
      if (msg.type() === "warning" && msg.text().includes("[엔진 워커]"))
        failures.push("엔진 워커 대체 발생: " + msg.text());
    });
    // 그리디 탐색(후보B·C)·후보A 다듬기가 실제로 Web Worker 경로를 탔는지 확인하기 위해 워커가
    // 보낸 결과 메시지 수를 센다.
    await page.addInitScript(() => {
      window.__PT_WORKER_MESSAGES__ = 0;
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener("message", () => window.__PT_WORKER_MESSAGES__++);
        }
      };
    });

    // 처음 열 때만 시드를 넣는다 — 매번 넣으면 새로고침 때 저장된 생성 결과까지 덮어써서
    // "새로고침 후 유지"를 검증할 수 없다.
    await page.addInitScript(
      ({ key, data }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
      },
      { key: STORAGE_KEY, data: buildSeedState() }
    );
    if (!FULL_BUDGET_A) {
      await page.addInitScript(
        (scale) => {
          window.__PT_TEST_BUDGET_SCALE__ = scale;
        },
        A_BUDGET_SCALE
      );
    }

    await page.goto(INDEX_URL);
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });

    // 후보 생성(그리디 탐색 + 체인 DP 다듬기). 기본값은 위에서 주입한 __PT_TEST_BUDGET_SCALE__로
    // 체인 DP의 시간 예산을 축소해 몇 초 안에 끝난다. SMOKE_FULL_BUDGET_A=1이면 실제 운영 예산
    // 그대로 돌린다(트리비얼한 입력도 몇 분~수십 분).
    const generateTimeout = FULL_BUDGET_A ? 45 * 60 * 1000 : 2 * 60 * 1000;
    await clickGenerateAndWait(page, "#generateBtn3", generateTimeout);
    let state = await readState(page);
    assert(
      state && Array.isArray(state.candidates) && state.candidates.length > 0,
      "그리디 후보 슬롯이 비어있음 (그리디 엔진 회귀 의심)"
    );
    assert(
      state && state.schedule3Result && state.schedule3Result.candidateAList
        && state.schedule3Result.candidateAList.some(Boolean),
      "체인 DP 후보 슬롯이 비어있음 (체인DP 엔진 회귀 의심)"
    );
    const workerMessages = await page.evaluate(() => window.__PT_WORKER_MESSAGES__);
    assert(
      workerMessages > 0,
      "후보 생성이 Web Worker를 쓰지 않음 (워커 생성·CSP·번들 회귀 의심)"
    );
    const cardTitles = () => page.locator("#candidates3 .candidate-title").allTextContents();
    let titles = await cardTitles();
    assert(
      titles.length === 1 && titles[0] === "추천",
      "후보 카드가 '추천' 한 장이 아님 (실제: " + JSON.stringify(titles) + ")"
    );
    const pageText = await page.locator("#pageSchedule3").innerText();
    assert(!/후보\s?[ABC]/.test(pageText), "화면에 엔진 이름(후보A/B/C)이 노출됨");

    // 수업 블록을 눌러 확정하면 그 후보는 '내가 수정한 후보'가 되고, 다시 생성해도 지워지지 않는다.
    // 블록은 드래그 가능해서 Playwright의 포인터 클릭이 드래그 처리와 엉킨다(메뉴가 열렸다가
    // 다시 그려짐). 메뉴 동작만 확인하면 되므로 DOM click 이벤트로 연다.
    await page.locator("#candidates3 .cal-block.clickable").first().evaluate((el) => el.click());
    await page
      .locator(".block-context-menu-item", { hasText: "확정" })
      .first()
      .evaluate((el) => el.click());
    titles = await cardTitles();
    assert(
      titles.includes("내가 수정한 후보") && !titles.includes("추천"),
      "확정한 후보가 '내가 수정한 후보'로 바뀌지 않음 (실제: " + JSON.stringify(titles) + ")"
    );
    await clickGenerateAndWait(page, "#generateBtn3", generateTimeout);
    titles = await cardTitles();
    assert(
      titles.includes("내가 수정한 후보"),
      "다시 생성한 뒤 '내가 수정한 후보'가 사라짐 (실제: " + JSON.stringify(titles) + ")"
    );

    // strict style CSP에서 html2canvas 캡처 경로도 실제로 동작하는지 확인한다.
    // 후보 생성 직후 첫 카드의 이미지 저장 버튼을 눌러 다운로드 완료까지 기다린다.
    const imageSaveBtn = page
      .locator('button[aria-label="이미지로 저장"]')
      .first();
    if (await imageSaveBtn.count()) {
      const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
      await imageSaveBtn.click();
      await downloadPromise;
    } else {
      failures.push("이미지 저장 버튼을 찾지 못함");
    }

    // 새로고침 후에도 데이터와 생성 결과가 유지되는지(localStorage 로드 경로 회귀 확인)
    await page.reload();
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    const reloadedMemberCount = await page.evaluate(() => {
      const raw = localStorage.getItem("pt_schedule_state_v3");
      return raw ? JSON.parse(raw).members.length : -1;
    });
    assert(reloadedMemberCount === 1, "새로고침 후 회원 데이터가 유지되지 않음");
    titles = await cardTitles();
    assert(
      titles.includes("내가 수정한 후보"),
      "새로고침 후 '내가 수정한 후보'가 유지되지 않음 (실제: " + JSON.stringify(titles) + ")"
    );

    // 회원관리 페이지가 정상적으로 회원 1명을 렌더링하는지(페이지 전환 + 렌더링 회귀 확인)
    await page.click('.nav-item[data-page="members"]');
    await page.waitForSelector("#pageMembers.active", { timeout: 5000 });
    const memberRowCount = await page.locator("#memberTableBody tr").count();
    assert(memberRowCount === 1, "회원관리 표에 회원이 정상적으로 표시되지 않음 (실제: " + memberRowCount + "행)");

    // 신청이 바뀌면(전체 스케줄 초기화) 새로고침을 거쳐도 '내가 수정한 후보'까지 비워진다. 예전에는
    // 런타임 플래그로만 표시해서 새로고침하면 플래그가 사라지고 옛 수정 후보가 남았다.
    await page.click('.nav-item[data-page="memberSchedule"]');
    page.once("dialog", (d) => d.accept());
    await page.click("#resetAllSchedulesBtn");
    await page.reload();
    await page.click('.nav-item[data-page="schedule3"]');
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    titles = await cardTitles();
    assert(
      titles.length === 0,
      "신청이 바뀐 뒤 새로고침하자 옛 후보가 남음 (실제: " + JSON.stringify(titles) + ")"
    );


    const cspViolations = await page.evaluate(() => window.__PT_CSP_VIOLATIONS__ || []);
    assert(
      cspViolations.length === 0,
      "CSP 위반 발생: " + JSON.stringify(cspViolations),
    );

    // 후보 비교: 골든 CASE-09 생성 결과(추천 + 공강 최소)를 넣고 '추천안과 비교'를 연다. 이 저장
    // 상태에는 inputKey가 없어 기존 저장분 경로(하드 제약 재검사 후 인정)도 함께 지난다.
    const cmp = await browser.newPage();
    const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "compare-CASE-09.state.json"), "utf8");
    await cmp.addInitScript((d) => {
      if (!localStorage.getItem("pt_schedule_state_v3")) localStorage.setItem("pt_schedule_state_v3", d);
    }, fixture);
    await cmp.goto(INDEX_URL);
    await cmp.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    const cmpTitles = await cmp.locator("#candidates3 .candidate-title").allTextContents();
    assert(
      JSON.stringify(cmpTitles) === JSON.stringify(["추천", "공강 최소"]),
      "비교용 저장 상태의 카드가 다름 (실제: " + JSON.stringify(cmpTitles) + ")"
    );
    await cmp.locator(".compare-candidate-btn").first().click();
    const panel = cmp.locator("#candidateCompare3");
    const panelText = (await panel.isVisible()) ? await panel.innerText() : "";
    assert(panelText.includes("빈 시간 -60분 / 체류 시간 -120분 대신 수업 -1"), "비교 요약 문장이 다름: " + panelText);
    assert((await panel.locator("tbody tr").count()) === 10, "비교 지표가 10개가 아님");
    assert(panelText.includes("변경 회원 2명"), "배정 차이 회원 수가 다름");
    await cmp.locator(".candidate-compare-close").click();
    assert(!(await panel.isVisible()), "닫기를 눌러도 비교 패널이 남음");

    // 모바일 폭에서는 긴 회원·지점명이나 넓은 표가 있어도 페이지 전체가 가로로 스크롤되지 않는다
    // (넓은 시간표·비교 표는 각자의 래퍼 안에서만 스크롤).
    const longState = JSON.parse(fixture);
    longState.members.forEach((m) => (m.name = "아주긴회원이름".repeat(6) + m.name));
    longState.locations.forEach((l) => (l.name = "아주긴지점이름ABCDEFGHIJKLMNOP".repeat(2) + l.name));
    for (const width of [320, 360, 390]) {
      const mob = await browser.newPage({ viewport: { width, height: 800 } });
      await mob.addInitScript((d) => {
        if (!localStorage.getItem("pt_schedule_state_v3")) localStorage.setItem("pt_schedule_state_v3", d);
      }, JSON.stringify(longState));
      await mob.goto(INDEX_URL);
      await mob.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
      await mob.locator(".compare-candidate-btn").first().click();
      const scrollWidth = await mob.evaluate(() => document.documentElement.scrollWidth);
      assert(scrollWidth <= width, `${width}px 화면에서 페이지가 가로로 스크롤됨 (scrollWidth ${scrollWidth})`);
      await mob.close();
    }

    // 재최적화(5b-2b): 취소(카드 그대로) → L1 변경 최소화 제안(전체 자동 실행 없음) → 버리기 → 다시 → 전체 일정
    // 다시 탐색(더 나은 결과는 기존 제안과 함께 비교) → 넓은 결과 적용(확정은 사용자 고정만) → 되돌리기 → 새로고침.
    const openReoptPage = async (layout) => {
      const page = await browser.newPage();
      const log = [];
      page.on("pageerror", (err) => failures.push("재최적화 페이지 런타임 에러: " + err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") failures.push("재최적화 콘솔 에러: " + msg.text());
        if (msg.text().startsWith("[재최적화]")) log.push(JSON.parse(msg.text().slice("[재최적화] ".length)));
      });
      const seed = buildReoptSeedState(layout);
      await page.addInitScript(
        ({ key, data, scale }) => {
          if (scale) window.__PT_TEST_BUDGET_SCALE__ = scale;
          if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
        },
        { key: STORAGE_KEY, data: seed, scale: FULL_BUDGET_A ? 0 : A_BUDGET_SCALE }
      );
      await page.goto(INDEX_URL);
      await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
      return { page, log, seed };
    };
    const { page: ro, log: reoptLog, seed: reoptSeed } = await openReoptPage("default");
    const editedCard = async () => (await readState(ro)).candidates[0];
    const seedJson = JSON.stringify(reoptSeed.candidates[0].assigned.map((a) => a.id).sort());
    const editedIds = async () => JSON.stringify((await editedCard()).assigned.map((a) => a.id).sort());
    const reoptBtn = ro.locator("#candidates3 .reopt-btn");
    const reoptPanel = ro.locator("#reoptimize3");
    assert((await reoptBtn.count()) === 1, "수정 카드에 '나머지 일정 다시 최적화' 버튼이 없음");
    const hintText = await ro.locator("#candidates3 .reopt-hint").innerText().catch(() => "");
    assert(hintText.includes("유지할 수업 1개"), "유지할 수업 수 안내가 다름: " + hintText);
    const waitIdle = (page = ro) =>
      page.waitForFunction(() => !document.querySelector("#generateBtn3").disabled, null, { timeout: generateTimeout });
    const levelsRun = (log) => log.map((e) => e.level + "×" + e.budgetScale).join(",");

    await reoptBtn.click();
    await ro.click("#generateBtn3Cancel");
    await waitIdle();
    assert(!(await reoptPanel.isVisible()), "재최적화를 취소했는데 제안이 나타남");
    assert((await editedIds()) === seedJson, "재최적화 취소 뒤 카드가 바뀜");

    reoptLog.length = 0;
    await reoptBtn.click();
    await waitIdle();
    const proposalText = (await reoptPanel.isVisible()) ? await reoptPanel.innerText() : "";
    assert(proposalText.includes("변경 최소화 제안"), "변경 최소화 제안 패널이 나타나지 않음: " + (await ro.locator("#generateHint3").innerText()) + " / " + levelsRun(reoptLog));
    assert(levelsRun(reoptLog) === "L1×0.1", "L1에서 개선을 찾았으면 그 Level에서 멈춰야 함(전체 자동 실행 금지): " + levelsRun(reoptLog));
    assert(proposalText.includes("유지할 수업 1개") && proposalText.includes("고정한 수업 바로 앞뒤 범위"), "제안에 유지할 수업 수·범위가 없음");
    assert(proposalText.includes("가장 좋은 일정이라는 뜻은 아닙니다"), "변경 최소화 제안이 최선이 아님을 알리지 않음");
    assert(/좋아지는 것\s*빈 시간 -\d+분/.test(proposalText), "제안 요약에 빈 시간 개선이 없음: " + proposalText);
    assert(proposalText.includes("나빠지는 것"), "제안 요약에 나빠지는 것 줄이 없음");
    assert((await reoptPanel.locator("tbody tr").count()) === 10, "제안 지표가 10개가 아님");
    assert(/회원 1명\(수업 1개\)의 일정이 바뀝니다/.test(proposalText) && proposalText.includes("배정 차이"), "변경 회원·세션 수·상세가 없음");
    // L2·L3 범위는 전체와 같아 국소로 다시 돌리지 않으므로 다음 단계는 전체 탐색이다.
    assert((await reoptPanel.locator(".reopt-widen").innerText()) === "전체 일정 다시 탐색", "다음 단계 버튼이 전체 일정 다시 탐색이 아님");
    assert((await editedIds()) === seedJson, "제안을 보여주기만 했는데 카드가 바뀜");

    await ro.setViewportSize({ width: 320, height: 800 });
    const reoptScroll = await ro.evaluate(() => document.documentElement.scrollWidth);
    assert(reoptScroll <= 320, `320px 화면에서 재최적화 제안 때문에 페이지가 가로로 스크롤됨 (scrollWidth ${reoptScroll})`);
    if (process.env.SMOKE_SHOT_DIR) {
      await reoptPanel.screenshot({ path: path.join(process.env.SMOKE_SHOT_DIR, "reopt-320.png") });
      await ro.setViewportSize({ width: 1280, height: 900 });
      await ro.locator("#candidates3 .candidate-card").first().screenshot({ path: path.join(process.env.SMOKE_SHOT_DIR, "reopt-card.png") });
      await reoptPanel.screenshot({ path: path.join(process.env.SMOKE_SHOT_DIR, "reopt-desktop.png") });
    }
    await ro.setViewportSize({ width: 1280, height: 720 });
    await ro.click("#reoptimize3 .reopt-discard");
    assert(!(await reoptPanel.isVisible()), "버리기 뒤에도 제안 패널이 남음");
    assert((await editedIds()) === seedJson, "버리기 뒤 카드가 바뀜");

    reoptLog.length = 0;
    await reoptBtn.click();
    await waitIdle();
    await ro.click("#reoptimize3 .reopt-widen");
    await waitIdle();
    assert(levelsRun(reoptLog) === "L1×0.1,full×1", "전체 탐색은 버튼을 눌렀을 때 운영 예산으로 한 번만 돌아야 함: " + levelsRun(reoptLog));
    const choices = reoptPanel.locator(".reopt-choice");
    const widerText = (await reoptPanel.isVisible()) ? await reoptPanel.innerText() : "";
    assert((await choices.count()) === 2, "더 넓게 찾은 더 나은 결과와 변경 최소화 제안을 함께 보여주지 않음: " + widerText);
    assert((await choices.first().getAttribute("aria-pressed")) === "true", "더 넓은 결과가 변경 최소화 제안 선택을 자동으로 덮어씀");
    assert(widerText.includes("변경 최소화 제안과 더 넓은 탐색 결과 비교") && widerText.includes("두 제안의 배정 차이"), "두 제안 비교가 없음");
    assert((await reoptPanel.locator(".reopt-widen").count()) === 0, "전체 탐색 뒤에도 더 넓게 찾기 버튼이 남음");
    assert((await editedIds()) === seedJson, "더 넓게 찾기만 했는데 카드가 바뀜");
    if (process.env.SMOKE_SHOT_DIR) await reoptPanel.screenshot({ path: path.join(process.env.SMOKE_SHOT_DIR, "reopt-compare.png") });
    await choices.nth(1).click();
    await ro.click("#reoptimize3 .reopt-apply");
    let applied = await editedCard();
    assert((await editedIds()) !== seedJson, "적용했는데 카드가 그대로임");
    assert(
      applied.assigned.some((a) => a.id === "A_12" && a.locationId === "loc1") &&
        JSON.stringify(applied.confirmedIds) === JSON.stringify(["A_12"]),
      "적용 뒤 유지할 수업(A 14:00)만 확정 상태여야 함(임시 고정 제외): " + JSON.stringify(applied)
    );
    assert(!(await reoptPanel.isVisible()), "적용 뒤에도 제안 패널이 남음");
    const undoBtn = ro.locator('#candidates3 button[aria-label="편집 취소"]');
    if (await undoBtn.isEnabled()) await undoBtn.click();
    else failures.push("적용 뒤 편집 취소(되돌리기) 버튼이 비활성");
    assert((await editedIds()) === seedJson, "되돌리기로 재최적화 전 카드가 복원되지 않음");
    await ro.reload();
    await ro.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    assert((await editedIds()) === seedJson, "되돌린 카드가 새로고침 뒤 유지되지 않음");

    // 국소 범위에서 모두 실패: 전체 탐색을 자동으로 시작하지 않고 안내 + 전체 일정 다시 탐색 버튼만 보인다.
    const { page: tp, log: tightLog } = await openReoptPage("tight");
    const tightPanel = tp.locator("#reoptimize3");
    await tp.click("#candidates3 .reopt-btn");
    await waitIdle(tp);
    const tightText = (await tightPanel.isVisible()) ? await tightPanel.innerText() : "";
    assert(tightText.includes("변경 범위를 제한한 탐색에서는 더 나은 일정을 찾지 못했습니다."), "국소 실패 안내가 없음: " + tightText);
    assert(!levelsRun(tightLog).includes("full"), "국소 실패 뒤 전체 탐색이 자동으로 시작됨: " + levelsRun(tightLog));
    assert((await tightPanel.locator(".reopt-apply").count()) === 0, "제안이 없는데 적용 버튼이 있음");
    if (process.env.SMOKE_SHOT_DIR) await tightPanel.screenshot({ path: path.join(process.env.SMOKE_SHOT_DIR, "reopt-local-exhausted.png") });
    await tp.click("#reoptimize3 .reopt-widen");
    await waitIdle(tp);
    assert(levelsRun(tightLog).endsWith("full×1"), "전체 일정 다시 탐색이 운영 예산으로 돌지 않음: " + levelsRun(tightLog));
    assert(!(await tightPanel.isVisible()), "전체 탐색에서도 나은 결과가 없으면 패널을 닫아야 함");
    assert((await tp.locator("#generateHint3").innerText()).includes("지금보다 나은 배치를 찾지 못했습니다"), "전체 탐색 실패 안내가 없음");
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error("FAIL — 스모크 테스트 실패:");
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  const aNote = FULL_BUDGET_A ? "체인 DP 실제 운영 예산으로 검증" : "체인 DP 예산 축소 검증";
  console.log(
    "PASS — 스모크 테스트 통과 (" + aNote + ", 후보 생성·추천 카드, 확정 후보 보존(재생성·새로고침), 신청 변경 시 수정 후보 무효화, 후보 비교 패널, 재최적화 취소·변경 최소화 제안·버리기·전체 탐색 비교·적용·되돌리기·국소 실패 안내, 모바일 가로 스크롤 없음, 회원 목록 렌더링 확인됨)"
  );
}

main().catch((err) => {
  console.error("스모크 테스트 실행 중 예외 발생:", err);
  process.exit(1);
});
