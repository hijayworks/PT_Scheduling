#!/usr/bin/env node
// index.html을 headless 브라우저로 열어 핵심 사용 흐름(데이터 로드 → 후보 생성 → 후보 카드 표시 →
// 확정한 후보 보존 → 저장 → 새로고침 후 유지)이 깨지지 않았는지 확인하는 E2E 스모크 테스트.
// MCP의 대화형 Playwright 브라우저와는 별개의 독립 프로세스를 띄우므로 그 브라우저가
// 사용 중이어도 영향받지 않는다.
// 기본 검사는 로컬 HTTP 서버(127.0.0.1)에서 열고, README의 파일 직접 실행(file://)은 임시 persistent profile로
// 저장·새로고침·브라우저 재실행만 따로 확인한다. 시드는 처음 한 번만 넣는다(새로고침은 저장된 데이터를 그대로 읽는다).
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
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "pt_schedule_state_v4";
// 구버전 앱(schemaVersion 1)의 저장 키와, 그 마지막 배포 빌드. 구버전 탭과의 저장 호환성 검사에 쓴다(CI는 fetch-depth 0으로 받아야 한다).
const LEGACY_STORAGE_KEY = "pt_schedule_state_v3";
const LEGACY_APP_COMMIT = "fa0d4babb3ffa9da6e0e4978a65fa42c2235980b";
const BACKUP_PASSWORD = "smoke-backup-password";
// 앱이 읽지 않는 별도 키 — 시드를 넣을 때 한 번 기록한다. 새로고침된 문서가 시작될 때 이 키가 없으면 저장소가 통째로 사라진 것이다.
const SEED_LOG_KEY = "__smoke_seed_log__";
const BLANK_HTML = "<!doctype html><title>smoke seed</title>";
// 교체·새로고침 단계 반복 횟수 — CI(Linux)에서만 간헐적으로 새로고침 때 저장소가 비어 있던 현상을 다시 확인한다.
const SWAP_REPEAT = Number(process.env.SMOKE_SWAP_REPEAT || "20");
// 실패 진단 기록(스크린샷·저장값·콘솔). CI가 실패 시 아티팩트로 올린다.
const ARTIFACT_DIR = path.join(ROOT, "test-artifacts");
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

// 수동 편집·설정 입력: 월·수만 근무(12:00~18:00), 회원A는 근무하지 않는 화요일에도 신청했다. 카드는 A가 월·수 2회,
// B(수요일 신청)는 미배정. 두 지점 사이 이동 시간은 30분.
function buildManualEditSeedState() {
  const cells = [];
  [0, 2].forEach((day) => {
    for (let slot = 0; slot < 36; slot++) cells.push(day + "-" + slot);
  });
  const requests = [];
  const addRequests = (memberId, days) =>
    days.forEach((day) => {
      for (let slot = 0; slot <= 30; slot++)
        requests.push({ id: memberId + day + "_" + slot, memberId, day, startSlot: slot, duration: 60 });
    });
  addRequests("A", [0, 1, 2]);
  addRequests("B", [2]);
  const at = (memberId, day, slot) => ({ id: memberId + day + "_" + slot, memberId, day, startSlot: slot, duration: 60, locationId: "loc1" });
  const memberB = { id: "B", name: "회원B", locationIds: ["loc1"], category: "등록" };
  return {
    locations: [{ id: "loc1", name: "테스트지점" }, { id: "loc2", name: "둘째지점" }],
    travelTimes: { "loc1|loc2": 30 },
    members: [{ id: "A", name: "회원A", locationIds: ["loc1"], category: "등록" }, memberB],
    requests,
    onceLimitedMemberIds3: [],
    excludedMemberIds3: [],
    availableCells: cells,
    currentPage: "schedule3",
    startMinBase: 720,
    candidates: [{ assigned: [at("A", 0, 0), at("A", 2, 0)], unassignedMembers: [memberB], confirmedIds: [], strategyIndex: 0 }],
    schedule3Result: { candidateAList: [null, null, null] },
  };
}

// 알림(utils.showToast)이 만드는 DOM(.toast-container > .toast.toast-{type}.show)을 그대로 붙여 공통 알림 스타일을
// 잰다. showToast는 번들 밖으로 노출되지 않고 2.2초 뒤 사라지므로 같은 구조를 직접 만든다.
const TOAST_SAMPLES = [
  "저장됨",
  "더 넓게 찾은 결과를 비교해 고를 수 있습니다",
  "백업 코드를 만들었습니다. 백업 비밀번호도 함께 기억해주세요.",
  "https://example.com/" + "averyveryverylongtokenwithoutanyspaces".repeat(4),
];
async function measureToasts(page, messages) {
  return page.evaluate((messages) => {
    const box = document.createElement("div");
    box.className = "toast-container";
    document.body.appendChild(box);
    const els = messages.map((m) => {
      const el = document.createElement("div");
      el.className = "toast toast-success show";
      el.textContent = m;
      box.appendChild(el);
      return el;
    });
    const pageScroll = document.documentElement.scrollWidth;
    const out = els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { message: messages[i], left: r.left, right: r.right, width: r.width, height: r.height, overflow: el.scrollWidth - el.clientWidth, pageScroll };
    });
    box.remove();
    return out;
  }, messages);
}

async function readState(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

// 기본 검사는 로컬 HTTP 서버에서 연다(실제 배포와 같은 http origin). 앱이 쓰는 정적 파일과 시드용 빈 페이지만 낸다.
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
// /legacy/ 아래는 구버전 앱(LEGACY_APP_COMMIT 빌드)을 같은 origin에서 낸다 — localStorage를 공유하는 구버전 탭을 재현한다.
function startServer(legacyRoot) {
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (pathname === "/__smoke_blank") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(BLANK_HTML);
    }
    let root = ROOT;
    if (pathname.startsWith("/legacy/")) {
      root = legacyRoot;
      pathname = pathname.slice("/legacy".length);
    }
    const file = path.join(root, pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": (MIME[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// 시드는 처음 한 번만, 같은 origin의 빈 페이지에서 넣는다. 그 뒤 새로고침은 저장된 데이터를 그대로 읽는다(재주입 없음).
// 문서가 시작될 때마다 저장소 키 목록을 window.__smoke_doc_start__에 남겨 새로고침 때 저장소가 비었는지 판별한다.
async function openWithSeed(page, seed, site) {
  await page.addInitScript(() => {
    window.__smoke_doc_start__ = { url: location.href, origin: location.origin, keys: Object.keys(localStorage) };
  });
  await page.goto(site.blank);
  const injection = await page.evaluate(
    ({ key, data, logKey }) => {
      const record = { at: new Date().toISOString(), url: location.href, origin: location.origin, keysBefore: Object.keys(localStorage) };
      localStorage.setItem(key, data);
      localStorage.setItem(logKey, JSON.stringify(record));
      return record;
    },
    { key: STORAGE_KEY, data: typeof seed === "string" ? seed : JSON.stringify(seed), logKey: SEED_LOG_KEY }
  );
  await page.goto(site.index);
  try {
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
  } catch (err) {
    // 시드를 넣은 뒤 앱이 생성 페이지로 열리지 않으면 URL·origin·저장소 상태를 남기고 멈춘다(CI가 아티팩트로 올린다).
    const dir = path.join(ARTIFACT_DIR, "open-seed");
    fs.mkdirSync(dir, { recursive: true });
    const name = Date.now() + "-" + new URL(site.index).protocol.replace(":", "");
    const state = await page.evaluate((key) => ({
      url: location.href,
      origin: location.origin,
      keys: Object.keys(localStorage),
      docStart: window.__smoke_doc_start__,
      storedBytes: (localStorage.getItem(key) || "").length,
      activePage: (document.querySelector(".page.active") || {}).id || null,
      body: document.body ? document.body.innerText.slice(0, 500) : null,
    }), STORAGE_KEY).catch((e) => ({ evaluateError: String(e) }));
    fs.writeFileSync(path.join(dir, name + ".json"), JSON.stringify({ site, injection, state }, null, 2));
    await page.screenshot({ path: path.join(dir, name + ".png"), fullPage: true }).catch(() => {});
    throw new Error("시드를 넣은 뒤 생성 페이지가 열리지 않음: " + JSON.stringify({ injection, state }) + "\n" + err.message);
  }
  return injection;
}

// 새로고침된 문서가 시작될 때 시드 기록 키가 없으면 앱 오류가 아니라 환경(브라우저) 저장소 유실로 분류한다. 그래도 실패로 센다.
async function reloadChecked(page, label, failures) {
  await page.reload();
  const docStart = await page.evaluate(() => window.__smoke_doc_start__);
  const lost = !docStart || !docStart.keys.includes(SEED_LOG_KEY);
  if (lost) failures.push("[환경 저장소 유실] " + label + ": 새로고침된 문서가 시작될 때 저장소가 비어 있음 " + JSON.stringify(docStart));
  return { docStart, lost };
}

// 수동 편집 픽스처를 연다. 교체·새로고침 검사가 실패하면 원인을 볼 수 있도록 콘솔과 시드 주입 기록을 모은다.
async function openManualEditPage(page, site, failures) {
  const pageConsole = [];
  page.on("console", (msg) => pageConsole.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (err) => {
    pageConsole.push({ type: "pageerror", text: err.message });
    failures.push("수동 편집 페이지 런타임 에러: " + err.message);
  });
  const injection = await openWithSeed(page, buildManualEditSeedState(), site);
  return { pageConsole, injection };
}

// 저장된 B 슬롯의 배정 id·미배정 id·확정 id
const swapSummary = (c) => ({ assigned: c.assigned.map((a) => a.id), unassigned: (c.unassignedMembers || []).map((m) => m.id), confirmedIds: c.confirmedIds });
const SWAPPED = { assigned: ["A0_0", "B2_0"], unassigned: [], confirmedIds: ["B2_0"] };

// 메뉴로 미배정 회원B를 교체해 넣고 → 저장값 → 새로고침 후 저장값·카드를 본다. 실패하면 test-artifacts/swap-reload/<tag>/에
// 단계별 스크린샷과 report.json(URL·origin·문서 시작 시 저장소 키·시드 주입 전 저장소 상태·저장값·콘솔)을 남긴다(CI가 아티팩트로 올린다).
async function checkSwapReload(page, { pageConsole, injection }, tag, failures) {
  const failuresBefore = failures.length;
  const assert = (cond, msg) => { if (!cond) failures.push("[교체·새로고침 " + tag + "] " + msg); };
  const stages = [];
  const recordStage = async (stage) => {
    const probe = await page.evaluate(({ key, logKey }) => ({
      url: location.href,
      origin: location.origin,
      keys: Object.keys(localStorage),
      docStart: window.__smoke_doc_start__,
      raw: localStorage.getItem(key),
      seedLog: localStorage.getItem(logKey),
    }), { key: STORAGE_KEY, logKey: SEED_LOG_KEY });
    const st = probe.raw ? JSON.parse(probe.raw) : null;
    const c = st && st.candidates && st.candidates[0];
    const snap = {
      stage,
      url: probe.url,
      origin: probe.origin,
      keys: probe.keys,
      docStart: probe.docStart,
      seedLog: probe.seedLog && JSON.parse(probe.seedLog),
      stored: st && { inputKey: st.schedule3Result && st.schedule3Result.inputKey, candidateAList: st.schedule3Result && st.schedule3Result.candidateAList, candidates: st.candidates },
      summary: c ? swapSummary(c) : null,
      cardText: await page.locator("#candidates3 .candidate-card").first().innerText({ timeout: 2000 }).catch(() => "(카드 없음)"),
      consoleSoFar: pageConsole.length,
      screenshot: await page.screenshot({ fullPage: true }),
    };
    stages.push(snap);
    return snap;
  };
  const before = await recordStage("교체 전");
  assert(JSON.stringify(before.summary) === JSON.stringify({ assigned: ["A0_0", "A2_0"], unassigned: ["B"], confirmedIds: [] }), "교체 전 저장값이 픽스처와 다름: " + JSON.stringify(before.summary));
  assert(/미배정 1명/.test(before.cardText), "교체 전 카드에 '미배정 1명'이 없음(픽스처 확인)");
  await page.locator("#candidates3 .cal-block", { hasText: "회원A" }).nth(1).evaluate((el) => el.click());
  await page.locator(".block-context-menu-item", { hasText: "회원B(으)로 교체" }).first().evaluate((el) => el.click());
  const afterSwap = await recordStage("교체 직후");
  assert(JSON.stringify(afterSwap.summary) === JSON.stringify(SWAPPED), "교체 직후 저장값(배정·미배정·확정)이 다름: " + JSON.stringify(afterSwap.summary));
  assert(!/미배정 \d+명/.test(afterSwap.cardText), "미배정 회원으로 교체했는데 카드에 미배정이 남음: " + afterSwap.cardText);
  const { lost } = await reloadChecked(page, "교체·새로고침 " + tag, failures);
  if (!lost) await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 }).catch(() => assert(false, "새로고침 후 생성 페이지가 열리지 않음"));
  const afterReload = await recordStage("새로고침 후");
  // 저장소가 통째로 비었으면 앱 검사는 의미가 없다 — 위의 [환경 저장소 유실] 실패만 남긴다.
  if (!lost) {
    assert(JSON.stringify(afterReload.summary) === JSON.stringify(SWAPPED), "교체 뒤 새로고침하자 저장값(배정·미배정·확정)이 달라짐: " + JSON.stringify(afterReload.summary));
    assert(!/미배정 \d+명/.test(afterReload.cardText), "교체 뒤 새로고침하자 카드에 미배정이 다시 나타남");
  }
  if (failures.length > failuresBefore) {
    const dir = path.join(ARTIFACT_DIR, "swap-reload", tag);
    fs.mkdirSync(dir, { recursive: true });
    stages.forEach((snap, i) => fs.writeFileSync(path.join(dir, i + "-" + snap.stage + ".png"), snap.screenshot));
    const report = {
      failures: failures.slice(failuresBefore),
      classification: lost ? "환경 저장소 유실(새로고침된 문서 시작 시 저장소 비어 있음)" : "앱 오류 의심(저장소는 남아 있음)",
      expectedAfterSwap: SWAPPED,
      injection,
      stages: stages.map((snap) => ({ ...snap, screenshot: undefined })),
      console: pageConsole,
    };
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
    console.error("교체·새로고침 진단 기록: " + dir);
  }
}

// 구버전 앱(LEGACY_APP_COMMIT)의 정적 파일을 임시 폴더로 꺼낸다. 커밋이 없으면(얕은 clone) 검사를 건너뛰지 않고 실패한다.
function extractLegacyApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pt-smoke-legacy-"));
  let tar;
  try {
    tar = execFileSync("git", ["-C", ROOT, "archive", "--format=tar", LEGACY_APP_COMMIT, "index.html", "script.js", "style.css", "vendor"], { maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new Error("구버전 앱 커밋 " + LEGACY_APP_COMMIT + "을 찾지 못함 — 전체 git 이력이 필요하다(CI checkout fetch-depth: 0)\n" + err.message);
  }
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  return dir;
}

// 구버전 탭과의 저장 호환성: 같은 origin에서 구버전(키 v3, schemaVersion 1)과 신버전(키 v4, schemaVersion 2)이 함께 열려도
// (1) 구버전 저장분의 회원·신청·설정·수정 확정 후보가 신버전으로 그대로 이관되고 구버전 저장분은 건드리지 않는다
// (2) 구버전 탭의 자동 저장·새로고침이 신버전 저장분(연속 요일 배정 제외 포함)을 바꾸지 못한다
// (3) 신버전 백업을 구버전에서 복원하면 기존 데이터를 그대로 둔 채 거부된다 (4) 신버전에서 복원하면 새 설정이 유지된다.
async function checkLegacyCompat(browser, site, failures) {
  const assert = (cond, msg) => { if (!cond) failures.push("[구버전 호환] " + msg); };
  const ctx = await browser.newContext();
  const read = (p, key) => p.evaluate((k) => localStorage.getItem(k), key);
  const json = (v) => JSON.stringify(v);
  try {
    const legacy = await ctx.newPage();
    legacy.on("pageerror", (err) => failures.push("[구버전 호환] 구버전 페이지 런타임 에러: " + err.message));
    const seed = buildManualEditSeedState();
    const at = (day) => ({ id: "A" + day + "_0", memberId: "A", day, startSlot: 0, duration: 60, locationId: "loc1" });
    seed.schemaVersion = 1;
    seed.onceLimitedMemberIds3 = ["B"];
    seed.candidates = [];
    seed.schedule3Result = { candidateAList: [{ assigned: [at(0), at(2)], unassignedMembers: [seed.members[1]], confirmedIds: ["A0_0"] }, null, null] };
    await legacy.goto(site.blank);
    await legacy.evaluate(({ key, data }) => localStorage.setItem(key, data), { key: LEGACY_STORAGE_KEY, data: json(seed) });
    await legacy.goto(site.legacyIndex);
    await legacy.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    const legacyRaw = await read(legacy, LEGACY_STORAGE_KEY);
    const old = JSON.parse(legacyRaw);
    assert(old.schedule3Result.candidateAList[0], "픽스처 확인: 구버전 앱이 수정 확정 후보를 유지해야 함");

    // (1) 이관
    const app = await ctx.newPage();
    app.on("pageerror", (err) => failures.push("[구버전 호환] 신버전 페이지 런타임 에러: " + err.message));
    await app.goto(site.index);
    await app.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    const migrated = JSON.parse((await read(app, STORAGE_KEY)) || "null");
    assert(migrated && migrated.schemaVersion === 2, "이관 후 신버전 키에 schemaVersion 2로 저장돼야 함: " + json(migrated && migrated.schemaVersion));
    if (migrated) {
      ["locations", "travelTimes", "members", "requests", "availableCells", "onceLimitedMemberIds3", "excludedMemberIds3"].forEach((k) =>
        assert(json(migrated[k]) === json(old[k]), "이관 후 " + k + "가 달라짐: " + json(migrated[k]) + " ≠ " + json(old[k])));
      const card = migrated.schedule3Result.candidateAList[0];
      assert(card && json(card.assigned.map((a) => a.id)) === json(["A0_0", "A2_0"]) && json(card.confirmedIds) === json(["A0_0"]), "이관 후 수정 확정 후보가 유지되지 않음: " + json(card));
      assert(json(migrated.noConsecutiveDayMemberIds) === "[]", "이관 후 연속 요일 배정 제외 기본값이 빈 목록이 아님");
    }
    assert((await app.locator("#candidates3 .candidate-card").count()) === 1, "이관 후 수정 확정 후보 카드가 보이지 않음");
    assert((await read(app, LEGACY_STORAGE_KEY)) === legacyRaw, "신버전이 구버전 저장분을 바꿈");

    // 새 설정 저장
    await app.click('.nav-item[data-page="memberSchedule"]');
    await app.waitForSelector("#pageMemberSchedule.active", { timeout: 5000 });
    await app.click("#noConsecutiveControl");
    await app.locator("#noConsecutiveDropdown .ms-option", { hasText: "회원A" }).click();
    const ncOf = async () => (JSON.parse((await read(app, STORAGE_KEY)) || "{}")).noConsecutiveDayMemberIds;
    assert(json(await ncOf()) === json(["A"]), "연속 요일 배정 제외가 저장되지 않음: " + json(await ncOf()));
    const appRaw = await read(app, STORAGE_KEY);

    // (2) 이관 전에 열린 구버전 탭의 자동 저장(페이지 이동·숨김·새로고침)
    await legacy.click('.nav-item[data-page="members"]');
    await legacy.evaluate(() => window.dispatchEvent(new window.Event("beforeunload")));
    await legacy.reload();
    await legacy.waitForSelector(".page.active", { timeout: 5000 });
    await legacy.click('.nav-item[data-page="memberSchedule"]');
    assert((await read(app, STORAGE_KEY)) === appRaw, "구버전 탭의 저장이 신버전 저장분을 바꿈");
    await app.reload();
    await app.waitForSelector("#pageMemberSchedule.active", { timeout: 5000 });
    assert((await app.locator("#noConsecutiveChipRow .chip", { hasText: "회원A" }).count()) === 1, "구버전 탭 저장 뒤 새로고침하자 연속 요일 배정 제외가 사라짐");

    // 신버전 백업 만들기
    await app.click('.nav-item[data-page="settings"]');
    const onPrompt = (d) => d.accept(d.type() === "prompt" ? BACKUP_PASSWORD : undefined);
    app.on("dialog", onPrompt);
    await app.click("#backupExportBtn");
    await app.waitForSelector("#backupExportResult:not([hidden])", { timeout: 15000 });
    app.off("dialog", onPrompt);
    const backupCode = await app.inputValue("#backupExportTextarea");
    const appBefore = await read(app, STORAGE_KEY); // 설정 페이지 이동·백업이 저장한 뒤의 값

    // (3) 구버전에서 복원 → 확인 창 없이 거부, 양쪽 저장분 그대로
    const legacyDialogs = [];
    legacy.on("dialog", (d) => { legacyDialogs.push(d.message()); d.dismiss(); });
    await legacy.click('.nav-item[data-page="settings"]');
    const legacyBefore = await read(legacy, LEGACY_STORAGE_KEY);
    await legacy.click("#backupImportOpenBtn");
    await legacy.fill("#backupImportTextarea", backupCode);
    await legacy.fill("#backupImportPinInput", BACKUP_PASSWORD);
    await legacy.click("#backupImportApplyBtn");
    // 받아들이면 확인 창이 뜨고(위에서 취소) 안내가 비어 있다 — 기다림이 끝나지 않아도 아래 검사로 실패를 기록한다.
    await legacy.waitForFunction(() => document.getElementById("backupImportHint").textContent !== "", null, { timeout: 15000 }).catch(() => {});
    const legacyHint = await legacy.locator("#backupImportHint").innerText();
    assert(legacyHint.includes("복원에 실패") && legacyDialogs.length === 0, "구버전이 신버전 백업을 거부하지 않음: " + json({ legacyHint, legacyDialogs }));
    assert((await read(legacy, LEGACY_STORAGE_KEY)) === legacyBefore, "구버전 복원 거부 뒤 구버전 저장분이 바뀜");
    assert((await read(app, STORAGE_KEY)) === appBefore, "구버전 복원 시도 뒤 신버전 저장분이 바뀜");

    // (4) 신버전에서 설정을 지운 뒤 복원 → 새로고침 후 설정이 돌아온다
    await app.click('.nav-item[data-page="memberSchedule"]');
    await app.locator("#noConsecutiveChipRow .chip button").click();
    assert(json(await ncOf()) === "[]", "연속 요일 배정 제외 해제가 저장되지 않음");
    await app.click('.nav-item[data-page="settings"]');
    await app.click("#backupImportOpenBtn");
    await app.fill("#backupImportTextarea", backupCode);
    await app.fill("#backupImportPinInput", BACKUP_PASSWORD);
    app.once("dialog", (d) => d.accept());
    await app.click("#backupImportApplyBtn");
    await app.waitForSelector(".restore-recovery-banner", { timeout: 15000 });
    const restored = JSON.parse((await read(app, STORAGE_KEY)) || "{}");
    assert(json(restored.noConsecutiveDayMemberIds) === json(["A"]) && restored.schemaVersion === 2, "신버전 백업 복원 후 연속 요일 배정 제외가 유지되지 않음: " + json(restored.noConsecutiveDayMemberIds));
    assert(json(restored.members) === json(old.members) && json(restored.requests) === json(old.requests), "신버전 백업 복원 후 회원·신청이 달라짐");
    await app.click('.nav-item[data-page="memberSchedule"]');
    assert((await app.locator("#noConsecutiveChipRow .chip", { hasText: "회원A" }).count()) === 1, "신버전 백업 복원 후 연속 요일 배정 제외 칩이 보이지 않음");
  } finally {
    await ctx.close();
  }
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

  const legacyRoot = extractLegacyApp();
  const server = await startServer(legacyRoot);
  const origin = "http://127.0.0.1:" + server.address().port;
  const site = { blank: origin + "/__smoke_blank", index: origin + "/index.html", legacyIndex: origin + "/legacy/index.html" };
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

    if (!FULL_BUDGET_A) {
      await page.addInitScript(
        (scale) => {
          window.__PT_TEST_BUDGET_SCALE__ = scale;
        },
        A_BUDGET_SCALE
      );
    }

    await openWithSeed(page, buildSeedState(), site);

    // 후보 생성(그리디 탐색 + 체인 DP 다듬기). 기본값은 위에서 주입한 __PT_TEST_BUDGET_SCALE__로
    // 체인 DP의 시간 예산을 축소해 몇 초 안에 끝난다. SMOKE_FULL_BUDGET_A=1이면 실제 운영 예산
    // 그대로 돌린다(트리비얼한 입력도 몇 분~수십 분).
    const generateTimeout = FULL_BUDGET_A ? 45 * 60 * 1000 : 2 * 60 * 1000;
    // 진행바: 생성 전에는 숨기고, 버튼을 누른 그 순간(첫 await 전 동기 구간) 보이고, 끝나면 다시 숨긴다.
    // [hidden]을 클래스의 display: flex가 덮어 '후보 탐색 0%'가 생성 전부터 보이던 회귀를 막는다.
    const progressVisible = (p = page) => p.locator("#generateProgressWrap3").isVisible();
    assert(!(await progressVisible()), "생성 전에 진행바(후보 탐색 0%)가 보임");
    const shownOnStart = await page.evaluate(() => {
      document.getElementById("generateBtn3").click();
      const el = document.getElementById("generateProgressWrap3");
      return window.getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
    });
    assert(shownOnStart, "생성을 시작했는데 진행바가 보이지 않음");
    await page.waitForFunction(() => !document.querySelector("#generateBtn3").disabled, null, { timeout: generateTimeout });
    assert(!(await progressVisible()), "생성이 끝났는데 진행바가 남음");
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
    // 생성 중에 다시 그려진 카드의 재최적화 버튼은 생성이 끝나면 다시 눌러져야 한다.
    const reoptDisabled = await page.locator("#candidates3 .reopt-btn").evaluateAll((bs) => bs.map((b) => b.disabled));
    assert(
      reoptDisabled.length > 0 && reoptDisabled.every((d) => !d),
      "다시 생성한 뒤 '나머지 일정 다시 최적화' 버튼이 비활성으로 남음: " + JSON.stringify(reoptDisabled)
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
    await reloadChecked(page, "생성 결과 새로고침", failures);
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    assert(!(await progressVisible()), "새로고침 후 진행바가 보임");
    const reloadedMemberCount = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).members.length : -1;
    }, STORAGE_KEY);
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
    await reloadChecked(page, "신청 변경 뒤 새로고침", failures);
    await page.click('.nav-item[data-page="schedule3"]');
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    titles = await cardTitles();
    assert(
      titles.length === 0,
      "신청이 바뀐 뒤 새로고침하자 옛 후보가 남음 (실제: " + JSON.stringify(titles) + ")"
    );
    const staleHint = await page.locator("#generateHint3").innerText();
    assert(staleHint.includes("회원·신청·설정이 변경되어") && !staleHint.includes("필수 조건"), "입력 변경 안내가 다름: " + staleHint);
    // 시작 전 입력 검증에서 멈추면(신청 없음) 진행바를 띄우지 않는다.
    await page.click("#generateBtn3");
    assert((await page.locator("#generateHint3").innerText()).includes("가능 시간을 등록"), "신청이 없을 때 안내가 다름");
    assert(!(await progressVisible()), "입력 검증에서 멈췄는데 진행바가 보임");

    // 붙여넣기 미리보기: 신규 회원일 때만 지점·구분 드롭다운을 보이고, 기존 회원·건너뛰기에서는 숨긴다(여러 번 바꿔도).
    await page.click('.nav-item[data-page="memberSchedule"]');
    await page.waitForSelector("#pageMemberSchedule.active", { timeout: 5000 });
    await page.click("#bulkImportOpenBtn"); // 신청이 비어 있어 확인 창 없이 바로 열린다
    await page.fill("#bulkImportTextarea", "테스터 x\n새회원 x");
    await page.click("#bulkImportPreviewBtn");
    const rowSelect = page.locator(".bulk-preview-row").nth(0).locator(".bulk-preview-row-head > select");
    const rowFields = (i) => page.locator(".bulk-preview-row").nth(i).locator(".bulk-preview-new-fields");
    assert(!(await rowFields(0).isVisible()), "기존 회원 줄에 신규 회원용 지점·구분 드롭다운이 보임");
    assert(await rowFields(1).isVisible(), "신규 회원 줄에 지점·구분 드롭다운이 보이지 않음");
    for (const [choice, visible] of [["__new__", true], ["__skip__", false], ["mem1", false], ["__new__", true], ["mem1", false]]) {
      await rowSelect.selectOption(choice);
      assert((await rowFields(0).isVisible()) === visible, `미리보기 선택 ${choice}에서 지점·구분 드롭다운 표시가 ${visible ? "보여야" : "숨겨야"} 함`);
    }
    await page.click("#bulkImportCloseBtn");

    // 연속 요일 배정 제외 회원: 회원 스케줄 추가에서 선택 → 저장 → 새로고침 후 유지, 선택 해제도 저장.
    const ncIds = async () => ((await readState(page)) || {}).noConsecutiveDayMemberIds;
    await page.click("#noConsecutiveControl");
    await page.locator("#noConsecutiveDropdown .ms-option", { hasText: "테스터" }).click();
    assert(JSON.stringify(await ncIds()) === JSON.stringify(["mem1"]), "연속 요일 배정 제외 선택이 저장되지 않음: " + JSON.stringify(await ncIds()));
    await reloadChecked(page, "연속 요일 배정 제외 새로고침", failures);
    await page.click('.nav-item[data-page="memberSchedule"]');
    await page.waitForSelector("#pageMemberSchedule.active", { timeout: 5000 });
    assert((await page.locator("#noConsecutiveChipRow .chip", { hasText: "테스터" }).count()) === 1, "새로고침 후 연속 요일 배정 제외 칩이 사라짐");
    assert(JSON.stringify(await ncIds()) === JSON.stringify(["mem1"]), "새로고침 후 연속 요일 배정 제외 저장값이 달라짐");
    await page.locator("#noConsecutiveChipRow .chip button").click();
    assert(JSON.stringify(await ncIds()) === "[]", "연속 요일 배정 제외 해제가 저장되지 않음");


    const cspViolations = await page.evaluate(() => window.__PT_CSP_VIOLATIONS__ || []);
    assert(
      cspViolations.length === 0,
      "CSP 위반 발생: " + JSON.stringify(cspViolations),
    );

    // 후보 비교: 골든 CASE-09 생성 결과(추천 + 공강 최소)를 넣고 '추천안과 비교'를 연다. 이 저장
    // 상태에는 inputKey가 없어 기존 저장분 경로(하드 제약 재검사 후 인정)도 함께 지난다.
    const cmp = await browser.newPage();
    const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "compare-CASE-09.state.json"), "utf8");
    await openWithSeed(cmp, fixture, site);
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
      await openWithSeed(mob, longState, site);
      await mob.locator(".compare-candidate-btn").first().click();
      const scrollWidth = await mob.evaluate(() => document.documentElement.scrollWidth);
      assert(scrollWidth <= width, `${width}px 화면에서 페이지가 가로로 스크롤됨 (scrollWidth ${scrollWidth})`);
      for (const t of await measureToasts(mob, TOAST_SAMPLES)) {
        assert(t.left >= 0 && t.right <= width, `${width}px 화면에서 알림이 화면 밖으로 잘림 (${t.left}~${t.right}): ${t.message}`);
        assert(t.overflow <= 0, `${width}px 화면에서 알림 문구가 줄바꿈되지 않고 넘침 (${t.overflow}px): ${t.message}`);
        assert(t.pageScroll <= width, `${width}px 화면에서 알림 때문에 페이지가 가로로 스크롤됨 (scrollWidth ${t.pageScroll})`);
      }
      await mob.close();
    }
    // 데스크톱에서는 기존처럼 문구 길이만큼(최소 200px) 한 줄로 나온다.
    const [shortToast, ...longToasts] = await measureToasts(cmp, TOAST_SAMPLES.slice(0, 3));
    assert(shortToast.width === 200, `데스크톱 짧은 알림 폭이 최소 200px이 아님 (${shortToast.width})`);
    for (const t of longToasts)
      assert(t.width > 200 && t.height === shortToast.height, `데스크톱에서 알림이 문구 길이만큼 한 줄로 나오지 않음 (폭 ${t.width}, 높이 ${t.height}): ${t.message}`);

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
      await page.addInitScript((scale) => {
        if (scale) window.__PT_TEST_BUDGET_SCALE__ = scale;
      }, FULL_BUDGET_A ? 0 : A_BUDGET_SCALE);
      await openWithSeed(page, seed, site);
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
    const levelsRun = (log) => log.filter((e) => e.event === "level").map((e) => e.level + "×" + e.budgetScale).join(",");
    const eventOf = (log, event) => log.find((e) => e.event === event);

    await reoptBtn.click();
    assert(await progressVisible(ro), "다시 최적화를 시작했는데 진행바가 보이지 않음");
    await ro.click("#generateBtn3Cancel");
    await waitIdle();
    assert(!(await progressVisible(ro)), "다시 최적화를 취소했는데 진행바가 남음");
    assert(eventOf(reoptLog, "abort")?.reason === "cancelled", "취소가 계측에 남지 않음: " + JSON.stringify(reoptLog));
    assert(!(await reoptPanel.isVisible()), "재최적화를 취소했는데 제안이 나타남");
    assert((await editedIds()) === seedJson, "재최적화 취소 뒤 카드가 바뀜");

    reoptLog.length = 0;
    await reoptBtn.click();
    await waitIdle();
    const proposalText = (await reoptPanel.isVisible()) ? await reoptPanel.innerText() : "";
    assert(proposalText.includes("변경 최소화 제안"), "변경 최소화 제안 패널이 나타나지 않음: " + (await ro.locator("#generateHint3").innerText()) + " / " + levelsRun(reoptLog));
    assert(levelsRun(reoptLog) === "L1×0.1", "L1에서 개선을 찾았으면 그 Level에서 멈춰야 함(전체 자동 실행 금지): " + levelsRun(reoptLog));
    // 시드는 저장 데이터로 넣었으므로 되돌리기 기록이 없다 — "이동 없음"이 아니라 "기록 없음"으로 남아야 한다.
    const l1 = eventOf(reoptLog, "level");
    assert(
      l1.mode === "first" && l1.status === "improved" && l1.changedMembers === 1 && l1.changedSessions === 1 &&
        l1.originStatus === "no-history" && l1.originCount === 0 && typeof l1.ms === "number" && l1.source,
      "L1 계측(mode·변경 회원/세션·원래 위치 상태·시간·엔진)이 다름: " + JSON.stringify(l1)
    );
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
    assert(eventOf(reoptLog, "discard")?.widened === 0, "버리기가 계측에 남지 않음: " + JSON.stringify(reoptLog));
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
    const applyEvent = eventOf(reoptLog, "apply");
    assert(
      reoptLog.filter((e) => e.event === "level").map((e) => e.mode).join(",") === "first,widen" &&
        JSON.stringify(applyEvent && [applyEvent.level, applyEvent.kind, applyEvent.proposalIndex, applyEvent.proposalLevels, applyEvent.widened]) ===
          JSON.stringify(["full", "full", 1, ["L1", "full"], 1]),
      "적용 계측(넓히기 사용·적용한 제안 종류·제안 목록)이 다름: " + JSON.stringify(reoptLog)
    );
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
    await reloadChecked(ro, "재최적화 되돌리기 뒤 새로고침", failures);
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

    // 수동 편집·설정 입력의 화면 연결(판정 정책 자체는 unit이 맡는다): 드래그를 놓으면 근무 시간 검사가 적용되고,
    // 메뉴로 회원을 교체하면 카드의 미배정 표시가 바뀌고, 입력칸·선택창은 보정된 값을 보여준다.
    const me = await browser.newPage();
    const meOpen = await openManualEditPage(me, site, failures);
    const meCard = async () => (await readState(me)).candidates[0];
    const toastTexts = () => me.locator(".toast").allTextContents();
    const assignedBefore = JSON.stringify((await meCard()).assigned);
    await me
      .locator("#candidates3 .cal-block", { hasText: "회원A" })
      .first()
      .dragTo(me.locator('#candidates3 .cal-cell[data-day="1"][data-slot="0"]'));
    assert(JSON.stringify((await meCard()).assigned) === assignedBefore, "근무하지 않는 화요일로 드래그한 수업이 옮겨짐");
    assert((await toastTexts()).some((t) => t.includes("근무 가능 시간 밖")), "근무 시간 밖 드래그에 안내가 없음: " + JSON.stringify(await toastTexts()));
    await checkSwapReload(me, meOpen, "http-1", failures);
    await me.click('.nav-item[data-page="settings"]');
    const travelInput = me.locator(".travel-min-input").first();
    await travelInput.fill("");
    await travelInput.dispatchEvent("change");
    assert((await travelInput.inputValue()) === "30" && (await readState(me)).travelTimes["loc1|loc2"] === 30, "이동 시간 빈칸이 원래 값(30분)으로 되돌아가지 않음");
    await travelInput.fill("0");
    await travelInput.dispatchEvent("change");
    assert((await readState(me)).travelTimes["loc1|loc2"] === 0, "이동 시간 0을 입력했는데 0분으로 저장되지 않음");
    const monSelects = me.locator(".avail-day-row").first().locator("select");
    await monSelects.nth(0).selectOption("33"); // 17:30
    await monSelects.nth(1).selectOption("30"); // 17:00
    const endShown = await monSelects.nth(1).evaluate((sel) => (sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : ""));
    assert(endShown === "18:00", "근무 종료를 시작보다 이르게 고르면 선택창이 18:00을 보여야 함 (실제: '" + endShown + "')");
    await me.close();
    // 새 컨텍스트의 첫 문서에서 저장 → 새로고침하는 조건을 반복한다(CI에서 간헐적으로 저장소가 비어 있던 단계).
    for (let i = 2; i <= SWAP_REPEAT; i++) {
      const rp = await browser.newPage();
      await checkSwapReload(rp, await openManualEditPage(rp, site, failures), "http-" + i, failures);
      await rp.close();
    }

    // inputKey가 없는 옛 저장분에 정상 수정·확정 후보와 근무 시간 위반 후보(근무 안 하는 화요일)가 섞여 있으면
    // 위반 후보만 비우고, 정상 후보는 확정 상태 그대로 새로고침 뒤에도 남는다. 안내는 입력 변경이 아니라 필수 조건 위반이다.
    const lg = await browser.newPage();
    lg.on("pageerror", (err) => failures.push("옛 저장분 페이지 런타임 에러: " + err.message));
    const lgSeed = buildManualEditSeedState();
    const lgAt = (day) => ({ id: "A" + day + "_0", memberId: "A", day, startSlot: 0, duration: 60, locationId: "loc1" });
    const lgMemberB = lgSeed.members[1];
    lgSeed.schedule3Result = { candidateAList: [{ assigned: [lgAt(0), lgAt(2)], unassignedMembers: [lgMemberB], confirmedIds: ["A0_0"] }, null, null] };
    lgSeed.candidates = [{ assigned: [lgAt(0), lgAt(1)], unassignedMembers: [lgMemberB], confirmedIds: ["A1_0"], strategyIndex: 0 }];
    await openWithSeed(lg, lgSeed, site);
    const lgHint = await lg.locator("#generateHint3").innerText();
    assert(lgHint.includes("필수 조건(근무 가능 시간에만 배정한다)을 어긴 후보 1개만") && !lgHint.includes("변경되어"), "옛 저장분 위반 안내가 다름: " + lgHint);
    for (const when of ["로드 직후", "새로고침 후"]) {
      const st = await readState(lg);
      const kept = st.schedule3Result.candidateAList[0];
      assert(st.candidates.length === 0 && kept && JSON.stringify(kept.confirmedIds) === JSON.stringify(["A0_0"]), when + ": 위반 후보만 비우고 정상 확정 후보를 남겨야 함: " + JSON.stringify(st.schedule3Result) + JSON.stringify(st.candidates));
      assert(typeof st.schedule3Result.inputKey === "string", when + ": 현재 입력 키가 저장되지 않음");
      assert((await lg.locator("#candidates3 .candidate-card").count()) === 1, when + ": 정상 후보 카드가 보이지 않음");
      if (when === "로드 직후") {
        await reloadChecked(lg, "옛 저장분 새로고침", failures);
        await lg.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
      }
    }
    await lg.close();

    await checkLegacyCompat(browser, site, failures);

    // README의 파일 직접 실행(file://): 임시 persistent profile(디스크 저장소)에서 저장 → 새로고침 → 브라우저를 닫고 다시 열어도 유지된다.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pt-smoke-file-"));
    try {
      fs.writeFileSync(path.join(tmp, "blank.html"), BLANK_HTML);
      const fileSite = { blank: pathToFileURL(path.join(tmp, "blank.html")).href, index: pathToFileURL(path.join(ROOT, "index.html")).href };
      const profile = path.join(tmp, "profile");
      let ctx = await chromium.launchPersistentContext(profile);
      const fp = ctx.pages()[0] || (await ctx.newPage());
      await checkSwapReload(fp, await openManualEditPage(fp, fileSite, failures), "file", failures);
      await ctx.close();
      ctx = await chromium.launchPersistentContext(profile);
      const rp = ctx.pages()[0] || (await ctx.newPage());
      await rp.goto(fileSite.index);
      const after = await rp.evaluate(({ key, logKey }) => ({ url: location.href, origin: location.origin, keys: Object.keys(localStorage), raw: localStorage.getItem(key), logged: localStorage.getItem(logKey) }), { key: STORAGE_KEY, logKey: SEED_LOG_KEY });
      if (!after.logged) failures.push("[환경 저장소 유실] file:// 브라우저 재실행: 저장소가 비어 있음 " + JSON.stringify({ url: after.url, origin: after.origin, keys: after.keys }));
      else {
        const c = after.raw && JSON.parse(after.raw).candidates[0];
        assert(JSON.stringify(c && swapSummary(c)) === JSON.stringify(SWAPPED), "file:// 브라우저 재실행 후 저장값(배정·미배정·확정)이 다름: " + JSON.stringify(c && swapSummary(c)));
      }
      await ctx.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(legacyRoot, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error("FAIL — 스모크 테스트 실패:");
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  const aNote = FULL_BUDGET_A ? "체인 DP 실제 운영 예산으로 검증" : "체인 DP 예산 축소 검증";
  console.log(
    "PASS — 스모크 테스트 통과 (" + aNote + ", 후보 생성·추천 카드, 확정 후보 보존(재생성·새로고침), 신청 변경 시 수정 후보 무효화, 후보 비교 패널, 재최적화 취소·변경 최소화 제안·버리기·전체 탐색 비교·적용·되돌리기·국소 실패 안내, 근무 시간 밖 드래그 차단·회원 교체 후 미배정 표시·설정 입력 보정, 옛 저장분 위반 후보만 정리, 구버전 탭·백업과 저장 분리(이관·자동 저장·복원 거부), 교체·새로고침 저장값 " + SWAP_REPEAT + "회(http)·file:// 새로고침·브라우저 재실행 유지, 모바일 가로 스크롤 없음, 회원 목록 렌더링 확인됨)"
  );
}

main().catch((err) => {
  console.error("스모크 테스트 실행 중 예외 발생:", err);
  process.exit(1);
});
