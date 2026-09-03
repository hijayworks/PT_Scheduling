#!/usr/bin/env node
// npm install 시(prepare 스크립트로) scripts/git-hooks/pre-commit을 .git/hooks/pre-commit로
// 자동 설치한다. 이 스크립트가 생기기 전에는 README의 안내를 보고 사람이 직접
// `cp scripts/git-hooks/pre-commit .git/hooks/pre-commit`을 실행해야만 훅이 깔렸는데,
// 그 수동 단계를 잊으면 script.js(자동 생성 파일)가 src/ 변경과 조용히 어긋날 수 있었다.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GIT_DIR = path.join(ROOT, ".git");
const SRC_HOOK = path.join(ROOT, "scripts", "git-hooks", "pre-commit");
const DEST_HOOK = path.join(ROOT, ".git", "hooks", "pre-commit");

function main() {
  // git clone이 아니라 npm 패키지로 설치되는 경우 등 .git이 없을 수 있다 — 그럴 땐 조용히 넘어간다.
  if (!fs.existsSync(GIT_DIR)) {
    console.log("install-git-hooks: .git 디렉터리가 없어 건너뜁니다.");
    return;
  }

  const hooksDir = path.join(GIT_DIR, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const src = fs.readFileSync(SRC_HOOK, "utf8");
  if (fs.existsSync(DEST_HOOK)) {
    const existing = fs.readFileSync(DEST_HOOK, "utf8");
    if (existing === src) {
      console.log("install-git-hooks: 이미 최신 pre-commit 훅이 설치돼 있습니다.");
      return;
    }
  }

  fs.writeFileSync(DEST_HOOK, src, { mode: 0o755 });
  fs.chmodSync(DEST_HOOK, 0o755);
  console.log("install-git-hooks: .git/hooks/pre-commit 설치 완료.");
}

main();
