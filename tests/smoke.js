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
const STORAGE_KEY = "pt_schedule_state_v5";
const SCHEMA_VERSION = 3;
// 구버전 앱(schemaVersion 1)의 저장 키와, 그 마지막 배포 빌드. 구버전 탭과의 저장 호환성 검사에 쓴다(CI는 fetch-depth 0으로 받아야 한다).
const LEGACY_STORAGE_KEY = "pt_schedule_state_v3";
const LEGACY_APP_COMMIT = "fa0d4babb3ffa9da6e0e4978a65fa42c2235980b";
// 직전 앱(schemaVersion 2, 지점 색상 이전)의 저장 키와 마지막 배포 빌드(#35 병합).
const PREVIOUS_STORAGE_KEY = "pt_schedule_state_v4";
const PREVIOUS_APP_COMMIT = "583649682e6c22a59255c6e007098e18338c720b";
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
// 구간 선택 실행(개발 중 빠른 확인): node tests/smoke.js --only reopt,manual-edit
// 인자가 없으면 전 구간을 돌린다(npm test·CI). 구간마다 새 페이지·컨텍스트를 열고 시드를 직접 넣으므로 서로 독립이다.
const SECTIONS = {
  core: "후보 생성·추천 카드·확정 후보 보존·이미지 저장·새로고침·신청 변경 무효화·붙여넣기 미리보기·CSP",
  compare: "후보 비교 패널·모바일 가로 스크롤·알림 폭",
  reopt: "재최적화(취소·제안·버리기·전체 탐색 비교·적용·되돌리기·국소 실패)",
  "manual-edit": "근무 시간 밖 드래그·회원 교체 후 새로고침 저장값(SMOKE_SWAP_REPEAT회)·설정 입력 보정",
  "stale-saved": "옛 저장분 위반 후보만 정리",
  "legacy-compat": "구버전(schemaVersion 1) 탭·백업 호환·비정상 신버전 저장분 보호",
  "no-consecutive": "연속 배정 제외 설정 위치·선택 유지·후보 무효화·생성 적용",
  "previous-compat": "직전 버전(schemaVersion 2) 이관·지점 색상·백업",
  "candidate-display": "대표 후보 비교표·미배정 1명 추가 후보·지점 색·시간 표시·추가 탐색 중 후보 유지",
  file: "file:// 저장·새로고침·브라우저 재실행",
};
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg >= 0 ? String(process.argv[onlyArg + 1] || "").split(",").filter(Boolean) : null;
// 상속 속성(toString·constructor·__proto__ 등)을 구간으로 인정하지 않도록 직접 정의된 키만 본다.
const unknownSections = (ONLY || []).filter((name) => !Object.hasOwn(SECTIONS, name));
if ((ONLY && ONLY.length === 0) || unknownSections.length) {
  console.error("알 수 없는 smoke 구간: " + (unknownSections.join(",") || "(비어 있음)") + "\n사용 가능:\n" +
    Object.entries(SECTIONS).map(([name, desc]) => "  " + name + " — " + desc).join("\n"));
  process.exit(1);
}
// 실제로 들어간 구간을 기록해, 고른 구간(전체 실행이면 SECTIONS 전부)이 하나라도 실행되지 않았으면 PASS 대신 실패한다.
const ranSections = new Set();
const want = (name) => {
  const on = !ONLY || ONLY.includes(name);
  if (on) ranSections.add(name);
  return on;
};

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
// /legacy/ 아래는 구버전 앱(LEGACY_APP_COMMIT), /previous/ 아래는 직전 앱(PREVIOUS_APP_COMMIT) 빌드를 같은 origin에서
// 낸다 — localStorage를 공유하는 옛 버전 탭을 재현한다.
function startServer(legacyRoot, previousRoot) {
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
    } else if (pathname.startsWith("/previous/")) {
      root = previousRoot;
      pathname = pathname.slice("/previous".length);
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

// 복원 창을 열고(열 때 입력칸을 비운다) 창이 열린 뒤 코드·비밀번호를 넣고, 실제로 들어갔는지 확인한다 — CI에서 한 번
// 구버전 앱의 입력칸이 적용 시점에 비어 있었다(열기 처리와 입력 순서가 어긋난 것으로 의심).
async function openBackupImport(p, code) {
  await p.click("#backupImportOpenBtn");
  await p.waitForSelector("#backupImportOverlay.open", { timeout: 5000 });
  await p.fill("#backupImportTextarea", code);
  await p.fill("#backupImportPinInput", BACKUP_PASSWORD);
  const filled = async () => (await p.inputValue("#backupImportTextarea")) === code && (await p.inputValue("#backupImportPinInput")) === BACKUP_PASSWORD;
  if (!(await filled())) throw new Error("복원 창 입력이 들어가지 않음(" + p.url() + ")");
}

// 옛 앱 커밋의 정적 파일을 임시 폴더로 꺼낸다. 커밋이 없으면(얕은 clone) 검사를 건너뛰지 않고 실패한다.
function extractLegacyApp(commit = LEGACY_APP_COMMIT) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pt-smoke-legacy-"));
  let tar;
  try {
    tar = execFileSync("git", ["-C", ROOT, "archive", "--format=tar", commit, "index.html", "script.js", "style.css", "vendor"], { maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new Error("옛 앱 커밋 " + commit + "을 찾지 못함 — 전체 git 이력이 필요하다(CI checkout fetch-depth: 0)\n" + err.message);
  }
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  return dir;
}

// 구버전 탭과의 저장 호환성: 같은 origin에서 구버전(키 v3, schemaVersion 1)과 신버전(키 v5, schemaVersion 3)이 함께 열려도
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
    assert(migrated && migrated.schemaVersion === SCHEMA_VERSION, "이관 후 신버전 키에 현재 schemaVersion으로 저장돼야 함: " + json(migrated && migrated.schemaVersion));
    if (migrated) {
      ["travelTimes", "members", "requests", "availableCells", "onceLimitedMemberIds3", "excludedMemberIds3"].forEach((k) =>
        assert(json(migrated[k]) === json(old[k]), "이관 후 " + k + "가 달라짐: " + json(migrated[k]) + " ≠ " + json(old[k])));
      // 지점은 id·이름 그대로, 색상(schemaVersion 3)만 채워진다.
      assert(json(migrated.locations) === json(old.locations.map((l, i) => ({ ...l, color: ["#50d2c2", "#8c88ff"][i] }))), "이관 후 지점: " + json(migrated.locations));
      const card = migrated.schedule3Result.candidateAList[0];
      assert(card && json(card.assigned.map((a) => a.id)) === json(["A0_0", "A2_0"]) && json(card.confirmedIds) === json(["A0_0"]), "이관 후 수정 확정 후보가 유지되지 않음: " + json(card));
      assert(json(migrated.noConsecutiveDayMemberIds) === "[]", "이관 후 연속 요일 배정 제외 기본값이 빈 목록이 아님");
    }
    assert((await app.locator("#candidates3 .candidate-card").count()) === 1, "이관 후 수정 확정 후보 카드가 보이지 않음");
    assert((await read(app, LEGACY_STORAGE_KEY)) === legacyRaw, "신버전이 구버전 저장분을 바꿈");

    // 새 설정 저장(수업 스케줄 생성 페이지의 조건 영역)
    await app.click('.nav-item[data-page="schedule3"]');
    await app.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
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
    await app.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
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
    await openBackupImport(legacy, backupCode);
    await legacy.click("#backupImportApplyBtn");
    // 받아들이면 확인 창이 뜨고(위에서 취소) 안내가 비어 있다 — 기다림이 끝나지 않아도 아래 검사로 실패를 기록한다.
    await legacy.waitForFunction(() => document.getElementById("backupImportHint").textContent !== "", null, { timeout: 15000 }).catch(() => {});
    const legacyHint = await legacy.locator("#backupImportHint").innerText();
    assert(legacyHint.includes("복원에 실패") && legacyDialogs.length === 0, "구버전이 신버전 백업을 거부하지 않음: " + json({ legacyHint, legacyDialogs }));
    assert((await read(legacy, LEGACY_STORAGE_KEY)) === legacyBefore, "구버전 복원 거부 뒤 구버전 저장분이 바뀜");
    assert((await read(app, STORAGE_KEY)) === appBefore, "구버전 복원 시도 뒤 신버전 저장분이 바뀜");

    // (4) 신버전에서 설정을 지운 뒤 복원 → 새로고침 후 설정이 돌아온다
    await app.click('.nav-item[data-page="schedule3"]');
    await app.locator("#noConsecutiveChipRow .chip button").click();
    assert(json(await ncOf()) === "[]", "연속 요일 배정 제외 해제가 저장되지 않음");
    await app.click('.nav-item[data-page="settings"]');
    await openBackupImport(app, backupCode);
    app.once("dialog", (d) => d.accept());
    await app.click("#backupImportApplyBtn");
    await app.waitForSelector(".restore-recovery-banner", { timeout: 15000 });
    const restored = JSON.parse((await read(app, STORAGE_KEY)) || "{}");
    assert(json(restored.noConsecutiveDayMemberIds) === json(["A"]) && restored.schemaVersion === SCHEMA_VERSION, "신버전 백업 복원 후 연속 요일 배정 제외가 유지되지 않음: " + json(restored.noConsecutiveDayMemberIds));
    assert(json(restored.members) === json(old.members) && json(restored.requests) === json(old.requests), "신버전 백업 복원 후 회원·신청이 달라짐");
    await app.click('.nav-item[data-page="schedule3"]');
    assert((await app.locator("#noConsecutiveChipRow .chip", { hasText: "회원A" }).count()) === 1, "신버전 백업 복원 후 연속 요일 배정 제외 칩이 보이지 않음");
    return backupCode;
  } finally {
    await ctx.close();
  }
}

// 직전 앱(키 v4, schemaVersion 2 — 지점 색상 이전) 탭과의 저장 호환성 + 지점 색상:
// (1) 직전 저장분의 회원·신청·설정·수정 확정 후보가 그대로 이관되고 지점 색상이 채워지며 직전 저장분은 그대로다
// (2) 등록 지점 색을 바꿔도 후보가 그대로이고 새로고침 뒤에도 유지된다(수업 블록 색은 배정 지점 id 기준), 이름을 바꿔도 색은 유지된다
// (3) 지점을 추가할 때 고른 색이 저장된다 (4) 직전 탭의 자동 저장이 신버전 저장분을 바꾸지 못한다
// (5) 신버전 백업을 직전 앱에서 복원하면 거부되고 (6) 신버전에서 복원하면 색이 돌아온다.
async function checkPreviousCompat(browser, site, failures) {
  const assert = (cond, msg) => { if (!cond) failures.push("[직전 버전 호환·지점 색상] " + msg); };
  const ctx = await browser.newContext();
  const read = (p, key) => p.evaluate((k) => localStorage.getItem(k), key);
  const json = (v) => JSON.stringify(v);
  try {
    const prev = await ctx.newPage();
    prev.on("pageerror", (err) => assert(false, "직전 앱 런타임 에러: " + err.message));
    const seed = buildManualEditSeedState();
    seed.schemaVersion = 2;
    seed.locations = [{ id: "loc1", name: "마포점" }, { id: "loc2", name: "여의도점" }];
    seed.noConsecutiveDayMemberIds = ["A"];
    seed.candidates[0].assigned = [seed.candidates[0].assigned[0]].concat({ ...seed.candidates[0].assigned[1], id: "A2_6", startSlot: 6 });
    seed.candidates[0].confirmedIds = ["A2_6"];
    await prev.goto(site.blank);
    await prev.evaluate(({ key, data }) => localStorage.setItem(key, data), { key: PREVIOUS_STORAGE_KEY, data: json(seed) });
    await prev.goto(site.previousIndex);
    await prev.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    const prevRaw = await read(prev, PREVIOUS_STORAGE_KEY);
    const old = JSON.parse(prevRaw);
    assert(old.candidates[0] && json(old.candidates[0].confirmedIds) === json(["A2_6"]), "픽스처 확인: 직전 앱이 수정 확정 후보를 유지해야 함");

    // (1) 이관
    const app = await ctx.newPage();
    app.on("pageerror", (err) => assert(false, "신버전 런타임 에러: " + err.message));
    await app.goto(site.index);
    await app.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    const migrated = JSON.parse((await read(app, STORAGE_KEY)) || "null");
    assert(migrated && migrated.schemaVersion === SCHEMA_VERSION, "이관 후 schemaVersion: " + json(migrated && migrated.schemaVersion));
    if (migrated) {
      ["travelTimes", "members", "requests", "availableCells", "onceLimitedMemberIds3", "excludedMemberIds3", "noConsecutiveDayMemberIds"].forEach((k) =>
        assert(json(migrated[k]) === json(old[k]), "이관 후 " + k + "가 달라짐"));
      assert(json(migrated.locations) === json([{ id: "loc1", name: "마포점", color: "#5da7ff" }, { id: "loc2", name: "여의도점", color: "#50d2c2" }]), "이관 후 지점 색상: " + json(migrated.locations));
      assert(json(migrated.candidates) === json(old.candidates), "이관 후 수정 확정 후보가 달라짐");
    }
    assert((await read(app, PREVIOUS_STORAGE_KEY)) === prevRaw, "신버전이 직전 저장분을 바꿈");
    const cardTitles = () => app.locator("#candidates3 .candidate-title").allTextContents();
    assert(json(await cardTitles()) === json(["내가 수정한 후보"]), "이관 후 수정 후보 카드: " + json(await cardTitles()));
    const blockClasses = () => app.locator("#candidates3 .cal-block").evaluateAll((bs) => bs.map((b) => [...b.classList].find((c) => c.startsWith("location-color-"))));
    assert(json(await blockClasses()) === json(["location-color-2", "location-color-2"]), "수업 블록이 배정 지점(마포점=파랑) 색이 아님: " + json(await blockClasses()));

    // (2) 등록 지점 색 변경 — 후보를 비우지 않는다
    await app.click('.nav-item[data-page="settings"]');
    const chip = (name) => app.locator("#locationList .location-chip", { hasText: name });
    assert((await chip("마포점").getAttribute("class")).includes("location-color-2"), "등록 목록 칩이 지점 색이 아님");
    await chip("마포점").locator(".location-color-btn").click();
    await chip("마포점").locator('input[aria-label="세이지 그린"]').click(); // 고르면 목록이 다시 그려져 팔레트가 닫힌다
    const afterColor = JSON.parse(await read(app, STORAGE_KEY));
    assert(afterColor.locations[0].color === "#8db58a", "지점 색 변경이 저장되지 않음: " + json(afterColor.locations[0]));
    assert(json(afterColor.candidates) === json(migrated && migrated.candidates) && json(afterColor.schedule3Result) === json(migrated && migrated.schedule3Result), "지점 색만 바꿨는데 후보가 바뀜");
    await app.reload();
    await app.waitForSelector(".page.active", { timeout: 5000 });
    await app.click('.nav-item[data-page="schedule3"]');
    assert(json(await cardTitles()) === json(["내가 수정한 후보"]), "색 변경·새로고침 뒤 수정 후보가 사라짐");
    assert(json(await blockClasses()) === json(["location-color-5", "location-color-5"]), "새로고침 뒤 수업 블록 색이 바뀐 지점 색이 아님: " + json(await blockClasses()));
    assert((await app.locator("#generateHint3").innerText()).trim() === "", "색 변경만으로 후보 초기화 안내가 뜸");

    // (3) 지점 추가 시 색 선택
    await app.click('.nav-item[data-page="settings"]');
    await app.fill("#locationName", "강남점");
    await app.locator('#locationColorPicker input[aria-label="코랄"]').check();
    await app.click('#locationForm button[type="submit"]');
    const added = JSON.parse(await read(app, STORAGE_KEY)).locations.find((l) => l.name === "강남점");
    assert(added && added.color === "#e69a8d", "추가한 지점의 색이 고른 색이 아님: " + json(added));
    assert((await chip("강남점").getAttribute("class")).includes("location-color-3"), "추가한 지점 칩 색");

    // 백업(색 포함, schemaVersion 3)
    const onPrompt = (d) => d.accept(d.type() === "prompt" ? BACKUP_PASSWORD : undefined);
    app.on("dialog", onPrompt);
    await app.click("#backupExportBtn");
    await app.waitForSelector("#backupExportResult:not([hidden])", { timeout: 15000 });
    app.off("dialog", onPrompt);
    const backupCode = await app.inputValue("#backupExportTextarea");

    // 이름 변경 — 색은 지점 id에 붙어 유지
    await chip("마포점").locator(".location-chip-name").click();
    await app.fill("#locationList .location-name-input", "마포2호점");
    await app.press("#locationList .location-name-input", "Enter");
    const renamed = JSON.parse(await read(app, STORAGE_KEY)).locations.find((l) => l.id === "loc1");
    assert(renamed && renamed.name === "마포2호점" && renamed.color === "#8db58a", "이름을 바꾸자 색이 바뀜: " + json(renamed));
    const appBefore = await read(app, STORAGE_KEY);

    // (4) 직전 탭의 자동 저장
    await prev.click('.nav-item[data-page="members"]');
    await prev.evaluate(() => window.dispatchEvent(new window.Event("beforeunload")));
    await prev.reload();
    await prev.waitForSelector(".page.active", { timeout: 5000 });
    assert((await read(app, STORAGE_KEY)) === appBefore, "직전 탭의 저장이 신버전 저장분을 바꿈");

    // (5) 직전 앱에서 신버전 백업 복원 → 거부
    const prevDialogs = [];
    prev.on("dialog", (d) => { prevDialogs.push(d.message()); d.dismiss(); });
    await prev.click('.nav-item[data-page="settings"]');
    const prevBefore = await read(prev, PREVIOUS_STORAGE_KEY);
    await openBackupImport(prev, backupCode);
    await prev.click("#backupImportApplyBtn");
    await prev.waitForFunction(() => document.getElementById("backupImportHint").textContent !== "", null, { timeout: 15000 }).catch(() => {});
    const prevHint = await prev.locator("#backupImportHint").innerText();
    assert(prevHint.includes("복원에 실패") && prevDialogs.length === 0, "직전 앱이 신버전 백업을 거부하지 않음: " + json({ prevHint, prevDialogs }));
    assert((await read(prev, PREVIOUS_STORAGE_KEY)) === prevBefore && (await read(app, STORAGE_KEY)) === appBefore, "복원 거부 뒤 저장분이 바뀜");

    // (6) 신버전에서 복원 → 백업 당시 이름·색
    await openBackupImport(app, backupCode);
    app.once("dialog", (d) => d.accept());
    await app.click("#backupImportApplyBtn");
    await app.waitForSelector(".restore-recovery-banner", { timeout: 15000 });
    const restored = JSON.parse((await read(app, STORAGE_KEY)) || "{}");
    assert(json((restored.locations || []).map((l) => [l.name, l.color])) === json([["마포점", "#8db58a"], ["여의도점", "#50d2c2"], ["강남점", "#e69a8d"]]), "백업 복원 후 지점 색: " + json(restored.locations));
    assert(json(restored.noConsecutiveDayMemberIds) === json(["A"]) && json(restored.members) === json(old.members), "백업 복원 후 설정·회원이 달라짐");
  } finally {
    await ctx.close();
  }
}

// 월·화 12:00~16:00, Q1~Q4(마포점)는 매시 정각 신청, P(상암점)는 월 13:30 하나만 → P가 월요일 가운데에 끼어 이동 2.
// 회원별 추가 탐색이 P를 뺀 '미배정 1명 추가·이동 감소'(수업 +1·이동 -2)를 찾는다.
function buildExclusionSeedState() {
  const cells = [];
  const requests = [];
  [0, 1].forEach((day) => {
    for (let slot = 0; slot < 24; slot++) cells.push(day + "-" + slot);
    ["Q1", "Q2", "Q3", "Q4"].forEach((q) => {
      for (let slot = 0; slot <= 18; slot += 6) requests.push({ id: q + day + "_" + slot, memberId: q, day, startSlot: slot, duration: 60 });
    });
  });
  requests.push({ id: "P0_9", memberId: "P", day: 0, startSlot: 9, duration: 60 });
  return {
    schemaVersion: SCHEMA_VERSION,
    locations: [{ id: "L1", name: "마포점", color: "#5da7ff" }, { id: "L3", name: "상암점", color: "#e69a8d" }],
    travelTimes: { "L1|L3": 30 },
    members: ["Q1", "Q2", "Q3", "Q4"].map((id) => ({ id, name: "회원" + id, locationIds: ["L1"], category: "등록" }))
      .concat({ id: "P", name: "회원P", locationIds: ["L3"], category: "등록" }),
    requests,
    onceLimitedMemberIds3: [],
    excludedMemberIds3: [],
    noConsecutiveDayMemberIds: [],
    availableCells: cells,
    currentPage: "schedule3",
    startMinBase: 720,
  };
}

// 수업 블록 시간("17:00~18:00")이 한 줄로 끝까지 보이는지(줄바꿈·잘림·말줄임 없음).
async function timeLabelProblems(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#candidates3 .cal-block")].flatMap((b) => {
      const t = b.querySelector(".time");
      const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect();
      const lh = parseFloat(window.getComputedStyle(t).lineHeight);
      const bad = [];
      if (!/^\d\d:\d\d~\d\d:\d\d$/.test(t.textContent)) bad.push("형식 " + t.textContent);
      if (t.scrollWidth > t.clientWidth + 0.5 || tr.right > br.right + 0.5 || tr.bottom > br.bottom + 0.5) bad.push("잘림 " + t.textContent);
      if (tr.height > lh * 1.5) bad.push("줄바꿈 " + t.textContent);
      return bad;
    }),
  );
}

// 저장된 후보 슬롯마다 배치·확정 id(추가 탐색 후보 제외) — 추가 탐색 전후로 그대로인지 본다.
async function candidateSlotSnapshot(page) {
  const saved = await readState(page);
  const slot = (r) => r && { assigned: r.assigned.map((a) => a.id).sort(), confirmedIds: (r.confirmedIds || []).slice().sort() };
  return JSON.stringify({ A: saved.schedule3Result.candidateAList.map(slot), BC: saved.candidates.map(slot) });
}

// 카드 안 수업 블록 메뉴에서 pattern에 맞는 항목을 처음 찾은 블록에서 누른다(블록은 드래그와 엉키지 않게 DOM click).
async function clickBlockMenuItem(page, card, pattern) {
  const blocks = card.locator(".cal-block.clickable");
  for (let i = 0; i < (await blocks.count()); i++) {
    await blocks.nth(i).evaluate((el) => el.click());
    const items = await page.locator(".block-context-menu-item").evaluateAll((bs) => bs.map((b) => !b.disabled && b.textContent));
    const idx = items.findIndex((t) => t && pattern.test(t));
    if (idx >= 0) {
      await page.locator(".block-context-menu-item").nth(idx).evaluate((el) => el.click());
      return true;
    }
    await page.keyboard.press("Escape");
  }
  return false;
}

// 대표 후보 비교표·미배정 1명 추가 후보('미배정 1명 추가안 더 찾기')·지점 색·시간 한 줄·모바일 가로 스크롤·이미지 저장.
// 추가 탐색 중(첫 회원 P를 탐색에서 뺀 동안) 기본 설정으로 갔다가 돌아와도 정상·수정·확정 후보가 그대로인지도 본다
// — 탐색용 임시 제외가 화면의 후보 검증(dropStaleCandidates)에 새면 P가 배정된 후보가 '제외 회원 배정 위반'으로 지워진다.
async function checkCandidateDisplay(browser, site, failures) {
  const assert = (cond, msg) => { if (!cond) failures.push("[대표 후보 화면] " + msg); };
  const json = (v) => JSON.stringify(v);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (err) => assert(false, "런타임 에러: " + err.message));
  if (!FULL_BUDGET_A) await page.addInitScript((scale) => { window.__PT_TEST_BUDGET_SCALE__ = scale; }, A_BUDGET_SCALE);
  // 진행 문구를 모두 기록해 회원별 추가 탐색 단계가 보였는지 본다.
  await page.addInitScript(() => {
    window.__progressTexts__ = new Set();
    document.addEventListener("DOMContentLoaded", () => {
      const el = document.getElementById("generateProgressText3");
      if (!el) return; // 시드용 빈 페이지
      new window.MutationObserver(() => window.__progressTexts__.add(el.textContent.replace(/\s\d+%$/, ""))).observe(el, { childList: true, characterData: true, subtree: true });
    });
  });
  try {
    await openWithSeed(page, buildExclusionSeedState(), site);
    await clickGenerateAndWait(page, "#generateBtn3", FULL_BUDGET_A ? 45 * 60 * 1000 : 2 * 60 * 1000);
    const summaryRows = () => page.locator("#candidateSummary3 tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
    // 본 생성은 추가 탐색 없이 끝나고, 미배정 1명 추가 행은 '아직 찾지 않음'으로 버튼을 안내한다.
    let progress = await page.evaluate(() => [...window.__progressTexts__]);
    assert(!progress.some((t) => t.startsWith("회원별 추가 탐색")), "본 생성이 회원별 추가 탐색까지 돌았음: " + json(progress));
    const unassignedRows = async () => (await summaryRows()).filter((r) => r[0].startsWith("미배정 1명 추가")).map((r) => r[1]);
    // 본 생성 풀에서 이미 찾은 조건은 값이 보이고(이 시드는 이동 감소형), 후보가 없는 행은 추가 탐색 상태를 안내한다.
    const missingRowsAre = async (prefix, label) => {
      const texts = await unassignedRows();
      assert(texts.length === 2 && texts.some((t) => t.startsWith(prefix)) && texts.every((t) => t.startsWith(prefix) || t === "1명"), label + " 미배정 1명 추가 행: " + json(texts));
    };
    await missingRowsAre("아직 찾지 않음", "추가 탐색 전");
    assert(await page.locator("#extraSearchBtn3").isVisible(), "'미배정 1명 추가안 더 찾기' 버튼이 보이지 않음");
    // 본 생성에서 이미 계산한 그리디 시도 전체 중 카드에 보이는 대표만 추가 후보 슬롯에 저장된다(엔진 재실행 없음).
    let saved = await readState(page);
    assert(saved.schedule3Result.extraCandidates.length >= 1 && saved.schedule3Result.extraCandidates.every((r) => !r.excludedMemberId), "본 생성 그리디 시도에서 고른 대표가 저장되지 않음: " + saved.schedule3Result.extraCandidates.length);

    // 확정 후보(블록 확정)와 수정 후보(인원 교체)를 만든다. 추천(정상) 후보는 남은 자동 배치에서 다시 고른다.
    const cardByTitle = (re) => page.locator("#candidates3 .candidate-card").filter({ has: page.locator(".candidate-title", { hasText: re }) });
    const recCard = () => cardByTitle(/^추천·균형/).first();
    assert(await clickBlockMenuItem(page, recCard(), /으로 확정$/), "확정할 블록을 찾지 못함");
    assert(await clickBlockMenuItem(page, recCard(), /\(으\)로 교체$/), "교체할 블록을 찾지 못함");
    const editedBefore = await cardByTitle("내가 수정한 후보").count();
    assert(editedBefore === 2 && (await cardByTitle(/^추천·균형/).count()) === 1, "정상·수정·확정 후보 준비: " + json(await page.locator("#candidates3 .candidate-title").allTextContents()));

    // 진행 문구가 prefix로 바뀌는 순간(그 회원을 탐색에서 뺀 동안) 동기적으로 action을 한다. 새로고침하면 다시 건다.
    const armOnProgress = (prefix, action) =>
      page.evaluate(({ prefix, action }) => {
        const el = document.getElementById("generateProgressText3");
        window.__armedDone__ = false;
        const obs = new window.MutationObserver(() => {
          if (!el.textContent.startsWith(prefix)) return;
          obs.disconnect();
          if (action === "nav") {
            document.querySelector('.nav-item[data-page="settings"]').click();
            document.querySelector('.nav-item[data-page="schedule3"]').click();
          } else if (action === "cancel") {
            document.getElementById("generateBtn3Cancel").click();
          } else if (action === "confirmRec") {
            const rec = [...document.querySelectorAll("#candidates3 .candidate-card")].find((c) => c.querySelector(".candidate-title").textContent.startsWith("추천·균형"));
            rec.querySelector(".cal-block.clickable").click();
            [...document.querySelectorAll(".block-context-menu-item")].find((b) => b.textContent.endsWith("으로 확정")).click();
          }
          window.__armedDone__ = document.getElementById("pageSchedule3").classList.contains("active");
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true });
      }, { prefix, action });
    const searchTimeout = FULL_BUDGET_A ? 45 * 60 * 1000 : 2 * 60 * 1000;
    const pagerLabel = async () => ((await recCard().locator(".pool-pager-label").count()) ? await recCard().locator(".pool-pager-label").innerText() : "");
    const reload = async (label) => {
      await reloadChecked(page, label, failures);
      await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    };
    const extrasOf = async () => (await readState(page)).schedule3Result.extraCandidates.map((r) => r.assigned.map((x) => x.id).sort().join());

    // (1) 기준 = 화면에 보이는 추천 배치: 동점 배치를 넘겨 둔 채 추가 탐색을 시작하고, 둘째 회원에서 취소한다.
    const pagerBefore = await pagerLabel();
    assert(/^배치 1\/\d+$/.test(pagerBefore) && !pagerBefore.endsWith("/1"), "픽스처 확인: 추천 카드에 동점 배치가 있어야 함: " + pagerBefore);
    await recCard().locator('button[aria-label="다음 배치"]').click();
    const baseLabel = await pagerLabel();
    // 넘겨 본 배치는 원래 슬롯에 저장된다(기존 동작) — 이 시점의 정상·수정·확정 슬롯이 이후 내내 그대로여야 한다.
    const before = await candidateSlotSnapshot(page);
    assert(before.includes('"P0_9"'), "픽스처 확인: 회원P가 배정된 후보가 있어야 함");
    const extrasBeforeCancel = await extrasOf();
    await armOnProgress("회원별 추가 탐색 2/", "cancel");
    await clickGenerateAndWait(page, "#extraSearchBtn3", searchTimeout);
    assert(await page.evaluate(() => window.__armedDone__), "추가 탐색 취소가 일어나지 않음");
    await missingRowsAre("탐색을 끝까지 하지 않음", "같은 기준에서 취소한 뒤");
    const extrasAfterCancel = await extrasOf();
    assert(extrasBeforeCancel.every((x) => extrasAfterCancel.includes(x)) && (await candidateSlotSnapshot(page)) === before, "취소 뒤 기존 후보·이미 찾은 후보가 사라짐");
    await reload("추가 탐색 취소 뒤 새로고침");
    assert((await pagerLabel()) === baseLabel, "새로고침 뒤 추천 카드가 탐색 기준 배치를 보여주지 않음: " + (await pagerLabel()) + " ≠ " + baseLabel);
    await missingRowsAre("탐색을 끝까지 하지 않음", "취소 뒤 새로고침");
    assert(json(await extrasOf()) === json(extrasAfterCancel) && (await candidateSlotSnapshot(page)) === before, "취소 뒤 새로고침하자 후보가 달라짐");

    // (2) 같은 기준으로 다시 찾는 동안(첫 회원 P를 탐색에서 뺀 동안) 기본 설정 → 수업 스케줄 생성으로 이동한다
    //     — 탐색용 임시 제외가 화면의 후보 검증(dropStaleCandidates)에 새면 P가 배정된 후보가 위반으로 지워진다.
    await armOnProgress("회원별 추가 탐색 1/", "nav");
    await clickGenerateAndWait(page, "#extraSearchBtn3", searchTimeout);
    assert(await page.evaluate(() => window.__armedDone__ === true), "추가 탐색 중 메뉴 이동이 일어나지 않음");
    const hint = await page.locator("#generateHint3").innerText();
    assert(!hint.includes("필수 조건"), "추가 탐색 중 메뉴 이동 뒤 후보가 위반으로 초기화됨: " + hint);
    assert((await candidateSlotSnapshot(page)) === before, "추가 탐색 중 메뉴 이동 뒤 저장된 정상·수정·확정 후보가 달라짐");
    assert((await cardByTitle("내가 수정한 후보").count()) === editedBefore && (await cardByTitle(/^추천·균형/).count()) === 1, "추가 탐색 뒤 카드: " + json(await page.locator("#candidates3 .candidate-title").allTextContents()));
    progress = await page.evaluate(() => [...window.__progressTexts__]);
    assert(progress.some((t) => /^회원별 추가 탐색 \d+\/\d+명 \(회원/.test(t)), "회원별 추가 탐색 진행 문구가 보이지 않음: " + json(progress));
    const rows = await summaryRows();
    assert(rows.length === 6, "비교표 행 수: " + rows.length);
    const travelRow = rows.find((r) => r[0] === "미배정 1명 추가·이동 감소");
    assert(travelRow && json(travelRow.slice(1, 5)) === json(["1명", "8건", "0번", "없음"]), "미배정 1명 추가·이동 감소 행: " + json(travelRow));
    const sessionsRow = () => summaryRows().then((rs) => rs.find((r) => r[0] === "미배정 1명 추가·수업 증가")[1]);
    assert((await sessionsRow()) === "탐색에서 조건을 충족하는 후보를 찾지 못함", "끝까지 찾은 뒤 수업 증가형 행: " + (await sessionsRow()));
    await reload("추가 탐색 완료 뒤 새로고침");
    assert((await pagerLabel()) === baseLabel && (await sessionsRow()) === "탐색에서 조건을 충족하는 후보를 찾지 못함", "새로고침 뒤 완료 상태가 유지되지 않음: " + json([await pagerLabel(), await sessionsRow()]));
    // (3) 다른 동점 배치로 넘기면 기준이 바뀐 것 — 다시 찾아야 한다고 안내하고, 기준 배치로 돌아오면 완료 상태다.
    await recCard().locator('button[aria-label="이전 배치"]').click();
    assert((await sessionsRow()).startsWith("추천안이 바뀌어 다시 찾아야 함"), "추천 배치를 넘긴 뒤 수업 증가형 행: " + (await sessionsRow()));
    await recCard().locator('button[aria-label="다음 배치"]').click();
    assert((await sessionsRow()) === "탐색에서 조건을 충족하는 후보를 찾지 못함", "기준 배치로 돌아온 뒤 수업 증가형 행: " + (await sessionsRow()));
    // (4) 탐색 중 추천을 확정해 기준이 바뀌면 끝나도 완료로 처리하지 않고, 새로고침 뒤에도 다시 찾아야 한다고 안내한다.
    await armOnProgress("회원별 추가 탐색 1/", "confirmRec");
    await clickGenerateAndWait(page, "#extraSearchBtn3", searchTimeout);
    assert(await page.evaluate(() => window.__armedDone__ === true), "추가 탐색 중 추천 확정이 일어나지 않음");
    assert((await cardByTitle("내가 수정한 후보").count()) === editedBefore + 1, "탐색 중 확정한 후보가 수정 후보로 남지 않음");
    assert((await sessionsRow()).startsWith("추천안이 바뀌어 다시 찾아야 함"), "탐색 중 기준이 바뀐 뒤 수업 증가형 행: " + (await sessionsRow()));
    await reload("탐색 중 기준 변경 뒤 새로고침");
    assert((await sessionsRow()).startsWith("추천안이 바뀌어 다시 찾아야 함") && (await cardByTitle("내가 수정한 후보").count()) === editedBefore + 1, "새로고침 뒤 기준 변경 안내·수정 후보: " + (await sessionsRow()));
    const card = page.locator("#candidates3 .candidate-card", { has: page.locator(".candidate-title", { hasText: "미배정 1명 추가·이동 감소" }) });
    const desc = (await card.count()) ? await card.locator(".candidate-desc").innerText() : "";
    assert(desc.includes("추천 대비 새로 미배정: 회원P") && desc.includes("이동 -2"), "새로 미배정된 회원·추천 대비 변화 표시: " + desc);
    saved = await readState(page);
    assert(json(saved.excludedMemberIds3) === "[]", "회원별 추가 탐색이 미배정 회원 설정을 바꿈");
    const found = saved.schedule3Result.extraCandidates.filter((r) => r.excludedMemberId);
    assert(found.length >= 1 && found.every((r) => r.unassignedMembers.some((m) => m.id === r.excludedMemberId) && typeof r.baseSig === "string"), "추가 탐색 후보가 저장되지 않았거나 제외 회원이 미배정에 없음(기준 서명 포함)");
    // 지점 색: 블록 제목의 지점과 색 클래스가 맞는다(마포점=파랑 2, 상암점=코랄 3).
    const colorMismatch = await page.locator("#candidates3 .cal-block").evaluateAll((bs) =>
      bs.filter((b) => !b.classList.contains(b.title.includes("(상암점)") ? "location-color-3" : "location-color-2")).map((b) => b.title));
    assert(colorMismatch.length === 0, "수업 블록 색이 배정 지점과 다름: " + json(colorMismatch));
    // 글자 대비: 지점 색 블록의 글자는 진한 색(흰 글자 아님)
    const ink = await page.locator("#candidates3 .cal-block .time").first().evaluate((el) => window.getComputedStyle(el).color);
    assert(ink !== "rgb(255, 255, 255)", "밝은 지점 색 위 글자가 흰색");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const problems = await timeLabelProblems(page);
      assert(problems.length === 0, width + "px 수업 시간 한 줄 표시 문제: " + json(problems.slice(0, 5)));
      const pageScroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(pageScroll <= 0, width + "px 페이지 가로 스크롤 " + pageScroll + "px");
    }
    const inner = await page.locator("#candidates3 .grid-scroll").first().evaluate((el) => el.scrollWidth - el.clientWidth);
    assert(inner > 0, "390px에서 시간표가 카드 안에서 가로 스크롤되지 않음(요일 칸을 줄인 것으로 의심)");
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.locator('#candidates3 button[aria-label="이미지로 저장"]').first().click();
    const download = await downloadPromise;
    if (process.env.SMOKE_SAVE_IMAGE) await download.saveAs(process.env.SMOKE_SAVE_IMAGE);
  } finally {
    await page.close();
  }
}

// 신버전 키가 있는데 최상위 값이 객체가 아니면(대표: "null"·빈 문자열·"[]") 읽기 실패로 막는다 — 구버전 저장분을 이관하지 않고,
// 페이지 이동·beforeunload·새로고침에도 원문을 덮어쓰지 않으며 저장 오류 배너를 띄운다. 정상 백업을 복원하면 차단이 풀리고 다시 저장된다.
async function checkBlockedStorage(browser, site, backupCode, failures) {
  const legacyRaw = JSON.stringify({ ...buildManualEditSeedState(), schemaVersion: 1 });
  for (const value of ["null", "", "[]"]) {
    const assert = (cond, msg) => { if (!cond) failures.push("[저장 보호 " + JSON.stringify(value) + "] " + msg); };
    const ctx = await browser.newContext();
    const read = (p, key) => p.evaluate((k) => localStorage.getItem(k), key);
    try {
      const p = await ctx.newPage();
      p.on("pageerror", (err) => assert(false, "페이지 런타임 에러: " + err.message));
      await p.goto(site.blank);
      await p.evaluate(({ key, legacyKey, value, legacyRaw }) => {
        localStorage.setItem(key, value);
        localStorage.setItem(legacyKey, legacyRaw);
      }, { key: STORAGE_KEY, legacyKey: LEGACY_STORAGE_KEY, value, legacyRaw });
      await p.goto(site.index);
      await p.waitForSelector(".page.active", { timeout: 5000 });
      assert(await p.locator("#storageErrorBanner").isVisible(), "저장 오류 배너가 보이지 않음");
      await p.click('.nav-item[data-page="members"]');
      assert(!(await p.locator("#memberTableBody").innerText()).includes("회원A"), "신버전 키가 있는데 구버전 저장분을 이관함");
      await p.evaluate(() => window.dispatchEvent(new window.Event("beforeunload")));
      await p.reload();
      await p.waitForSelector(".page.active", { timeout: 5000 });
      assert((await read(p, STORAGE_KEY)) === value, "원문이 바뀜: " + JSON.stringify(await read(p, STORAGE_KEY)));
      assert((await read(p, LEGACY_STORAGE_KEY)) === legacyRaw, "구버전 저장분이 바뀜");

      // 정상 백업 복원 → 차단 해제 → 페이지 이동이 다시 저장된다
      await p.click('.nav-item[data-page="settings"]');
      await openBackupImport(p, backupCode);
      p.once("dialog", (d) => d.accept());
      await p.click("#backupImportApplyBtn");
      await p.waitForSelector(".restore-recovery-banner", { timeout: 15000 });
      assert(!(await p.locator("#storageErrorBanner").isVisible()), "정상 백업 복원 뒤에도 저장 오류 배너가 보임");
      await p.click('.nav-item[data-page="memberSchedule"]');
      const saved = JSON.parse((await read(p, STORAGE_KEY)) || "null");
      assert(saved && saved.schemaVersion === SCHEMA_VERSION && saved.currentPage === "memberSchedule" && JSON.stringify(saved.noConsecutiveDayMemberIds) === JSON.stringify(["A"]), "정상 백업 복원 뒤 저장이 다시 되지 않음: " + JSON.stringify(saved && { schemaVersion: saved.schemaVersion, currentPage: saved.currentPage, nc: saved.noConsecutiveDayMemberIds }));
    } finally {
      await ctx.close();
    }
  }
}

// 연속 요일 배정 제외 회원 설정은 수업 스케줄 생성의 조건 줄(미배정·1회 제한 회원과 같은 줄)에만 있다. 이미 저장된 선택이 그대로
// 보이고, 선택·해제가 저장되며 기존 후보를 비우고, 다시 생성한 후보에 실제로 적용된다(회원A는 월·화만 신청 → 제외면 1회, 해제면 2회).
async function checkNoConsecutiveSetting(browser, site, failures) {
  const assert = (cond, msg) => { if (!cond) failures.push("[연속 요일 배정 제외] " + msg); };
  const json = (v) => JSON.stringify(v);
  const cells = [];
  [0, 1].forEach((day) => {
    for (let slot = 0; slot < 36; slot++) cells.push(day + "-" + slot);
  });
  const seed = {
    schemaVersion: 2,
    locations: [{ id: "loc1", name: "테스트지점" }],
    travelTimes: {},
    members: [{ id: "A", name: "회원A", locationIds: ["loc1"], category: "등록" }],
    requests: [0, 1].map((day) => ({ id: "A" + day, memberId: "A", day, startSlot: 0, duration: 60 })),
    onceLimitedMemberIds3: [],
    excludedMemberIds3: [],
    noConsecutiveDayMemberIds: ["A"],
    availableCells: cells,
    currentPage: "schedule3",
    startMinBase: 720,
  };
  const page = await browser.newPage();
  page.on("pageerror", (err) => assert(false, "페이지 런타임 에러: " + err.message));
  if (!FULL_BUDGET_A) await page.addInitScript((scale) => { window.__PT_TEST_BUDGET_SCALE__ = scale; }, A_BUDGET_SCALE);
  const generateTimeout = FULL_BUDGET_A ? 45 * 60 * 1000 : 2 * 60 * 1000;
  const chip = page.locator("#noConsecutiveChipRow .chip", { hasText: "회원A" });
  const savedIds = async () => ((await readState(page)) || {}).noConsecutiveDayMemberIds;
  // 저장된 모든 후보(그리디 슬롯 + 체인 DP 슬롯)에서 회원A가 배정된 요일
  const assignedDays = async () => {
    const s = (await readState(page)) || {};
    return [...(s.candidates || []), ...((s.schedule3Result || {}).candidateAList || [])]
      .filter(Boolean)
      .map((r) => r.assigned.filter((a) => a.memberId === "A").map((a) => a.day).sort());
  };
  const cardCount = () => page.locator("#candidates3 .candidate-card:not(.candidate-card-placeholder)").count();
  try {
    await openWithSeed(page, seed, site);
    const sameRow = await page.evaluate(() => {
      const block = document.getElementById("noConsecutiveBlock");
      const row = block && block.closest("#pageSchedule3 .day-start-block-row");
      return !!row && row.contains(document.getElementById("excludedBlock3")) && row.contains(document.getElementById("onceLimitBlock3"));
    });
    assert(sameRow, "수업 스케줄 생성의 미배정·1회 제한 회원과 같은 조건 줄에 있지 않음");
    assert(await page.locator("#noConsecutiveBlock").isVisible(), "수업 스케줄 생성에서 보이지 않음");
    assert((await chip.count()) === 1, "기존 선택(회원A)이 칩으로 보이지 않음");
    await page.click('.nav-item[data-page="memberSchedule"]');
    await page.waitForSelector("#pageMemberSchedule.active", { timeout: 5000 });
    assert(
      (await page.locator("#pageMemberSchedule #noConsecutiveBlock").count()) === 0 && !(await page.locator("#noConsecutiveBlock").isVisible()),
      "회원 스케줄 추가에 설정이 아직 보임"
    );
    await page.click('.nav-item[data-page="schedule3"]');
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });

    // 선택된 채로 생성 → 연속된 월·화에 함께 배정하지 않는다.
    await clickGenerateAndWait(page, "#generateBtn3", generateTimeout);
    let days = await assignedDays();
    assert(days.length > 0 && days.every((d) => d.length === 1), "제외 회원이 연속 요일에 배정됨: " + json(days));

    // 해제 → 저장·기존 후보 비움 → 다시 생성하면 월·화 모두 배정된다.
    await chip.locator("button").click();
    assert(json(await savedIds()) === "[]", "해제가 저장되지 않음: " + json(await savedIds()));
    assert(
      (await cardCount()) === 0 && (await page.locator("#generateHint3").innerText()).includes("회원 선택이 변경되어"),
      "해제 뒤 기존 후보가 비워지지 않음"
    );
    await clickGenerateAndWait(page, "#generateBtn3", generateTimeout);
    days = await assignedDays();
    assert(days.some((d) => json(d) === "[0,1]"), "해제했는데 월·화 연속 배정 후보가 없음: " + json(days));

    // 다시 선택 → 저장·기존 후보 비움 → 새로고침 후 유지 → 생성에 적용
    await page.click("#noConsecutiveControl");
    await page.locator("#noConsecutiveDropdown .ms-option", { hasText: "회원A" }).click();
    assert(json(await savedIds()) === json(["A"]), "선택이 저장되지 않음: " + json(await savedIds()));
    assert((await cardCount()) === 0, "선택 뒤 기존 후보가 비워지지 않음");
    await reloadChecked(page, "연속 요일 배정 제외 새로고침", failures);
    await page.waitForSelector("#pageSchedule3.active", { timeout: 5000 });
    assert((await chip.count()) === 1 && json(await savedIds()) === json(["A"]), "새로고침 후 선택이 유지되지 않음");
    await clickGenerateAndWait(page, "#generateBtn3", generateTimeout);
    days = await assignedDays();
    assert(days.length > 0 && days.every((d) => d.length === 1), "새로고침 뒤 생성에서 제외 회원이 연속 요일에 배정됨: " + json(days));
  } finally {
    await page.close();
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
  const previousRoot = extractLegacyApp(PREVIOUS_APP_COMMIT);
  const server = await startServer(legacyRoot, previousRoot);
  const origin = "http://127.0.0.1:" + server.address().port;
  const site = { blank: origin + "/__smoke_blank", index: origin + "/index.html", legacyIndex: origin + "/legacy/index.html", previousIndex: origin + "/previous/index.html" };
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

    // 후보 생성(그리디 탐색 + 체인 DP 다듬기). 기본값은 위에서 주입한 __PT_TEST_BUDGET_SCALE__로
    // 체인 DP의 시간 예산을 축소해 몇 초 안에 끝난다. SMOKE_FULL_BUDGET_A=1이면 실제 운영 예산
    // 그대로 돌린다(트리비얼한 입력도 몇 분~수십 분).
    const generateTimeout = FULL_BUDGET_A ? 45 * 60 * 1000 : 2 * 60 * 1000;
    // 진행바: 생성 전에는 숨기고, 버튼을 누른 그 순간(첫 await 전 동기 구간) 보이고, 끝나면 다시 숨긴다.
    // [hidden]을 클래스의 display: flex가 덮어 '후보 탐색 0%'가 생성 전부터 보이던 회귀를 막는다.
    const progressVisible = (p = page) => p.locator("#generateProgressWrap3").isVisible();

    if (want("core")) {
      await openWithSeed(page, buildSeedState(), site);
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
        titles.length >= 1 && titles[0].startsWith("추천·균형"),
        "첫 후보 카드가 '추천·균형'이 아님 (실제: " + JSON.stringify(titles) + ")"
      );
      assert(
        (await page.locator("#candidateSummary3 tbody tr").count()) === 6,
        "대표 후보 비교표가 6행이 아님"
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
        titles.includes("내가 수정한 후보"),
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

      const cspViolations = await page.evaluate(() => window.__PT_CSP_VIOLATIONS__ || []);
      assert(
        cspViolations.length === 0,
        "CSP 위반 발생: " + JSON.stringify(cspViolations),
      );
    }

    if (want("compare")) {
      // 후보 비교: 골든 CASE-09 생성 결과(추천 + 공강 최소)를 넣고 '추천안과 비교'를 연다. 이 저장
      // 상태에는 inputKey가 없어 기존 저장분 경로(하드 제약 재검사 후 인정)도 함께 지난다.
      const cmp = await browser.newPage();
      // 둘째 배치(수업 -1·빈 시간 -60분)는 공강이 0분이 아니라 어느 대표 조건에도 들지 않으므로, 확정 표시를 붙여
      // '내가 수정한 후보'로 비교한다(대표 조건 판정은 unit 테스트가 본다).
      const fixtureState = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "compare-CASE-09.state.json"), "utf8"));
      fixtureState.candidates[0].confirmedIds = [fixtureState.candidates[0].assigned[1].id];
      await openWithSeed(cmp, JSON.stringify(fixtureState), site);
      const cmpTitles = await cmp.locator("#candidates3 .candidate-title").allTextContents();
      assert(
        JSON.stringify(cmpTitles) === JSON.stringify(["추천·균형 · 수업 수 우선·공강 허용", "내가 수정한 후보"]),
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
      const longState = JSON.parse(JSON.stringify(fixtureState));
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
    }

    if (want("reopt")) {
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
    }

    if (want("manual-edit")) {
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
    }

    if (want("stale-saved")) {
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
    }

    if (want("legacy-compat")) {
      const backupCode = await checkLegacyCompat(browser, site, failures);
      if (backupCode) await checkBlockedStorage(browser, site, backupCode, failures);
      else failures.push("[저장 보호] 구버전 호환 검사에서 백업 코드를 받지 못해 검사하지 못함");
    }
    if (want("no-consecutive")) await checkNoConsecutiveSetting(browser, site, failures);
    if (want("previous-compat")) await checkPreviousCompat(browser, site, failures);
    if (want("candidate-display")) await checkCandidateDisplay(browser, site, failures);

    if (want("file")) {
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
    }
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(legacyRoot, { recursive: true, force: true });
    fs.rmSync(previousRoot, { recursive: true, force: true });
  }

  const notRun = (ONLY || Object.keys(SECTIONS)).filter((name) => !ranSections.has(name));
  if (notRun.length) failures.push("선택한 smoke 구간이 실행되지 않음(SECTIONS와 want() 호출 불일치): " + notRun.join(","));
  if (failures.length > 0) {
    console.error("FAIL — 스모크 테스트 실패:");
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  const aNote = FULL_BUDGET_A ? "체인 DP 실제 운영 예산으로 검증" : "체인 DP 예산 축소 검증";
  if (ONLY) {
    console.log("PASS — 스모크 일부 구간만 통과 (" + aNote + ", " + ONLY.join(", ") + "). 전체 검증은 인자 없이 실행한다.");
    return;
  }
  console.log(
    "PASS — 스모크 테스트 통과 (" + aNote + ", 후보 생성·추천 카드, 확정 후보 보존(재생성·새로고침), 신청 변경 시 수정 후보 무효화, 후보 비교 패널, 재최적화 취소·변경 최소화 제안·버리기·전체 탐색 비교·적용·되돌리기·국소 실패 안내, 근무 시간 밖 드래그 차단·회원 교체 후 미배정 표시·설정 입력 보정, 옛 저장분 위반 후보만 정리, 구버전 탭·백업과 저장 분리(이관·자동 저장·복원 거부)·비정상 신버전 저장분 보호와 백업 복원 해제, 연속 요일 배정 제외 설정 위치(수업 스케줄 생성)·선택 유지·후보 무효화·생성 적용, 교체·새로고침 저장값 " + SWAP_REPEAT + "회(http)·file:// 새로고침·브라우저 재실행 유지, 모바일 가로 스크롤 없음, 회원 목록 렌더링 확인됨)"
  );
}

main().catch((err) => {
  console.error("스모크 테스트 실행 중 예외 발생:", err);
  process.exit(1);
});
