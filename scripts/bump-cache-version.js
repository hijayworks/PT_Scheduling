#!/usr/bin/env node
// index.html의 script.js / style.css 캐시 버스팅 쿼리(?v=)를
// 각 파일 내용의 해시로 자동 갱신한다. 사람이 값을 손으로 바꿀 필요가 없다.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = path.join(ROOT, "index.html");

function shortHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 8);
}

function bumpAsset(html, fileName, hash) {
  const pattern = new RegExp(
    `(${fileName.replace(".", "\\.")})(\\?v=[A-Za-z0-9]+)?(?=["'])`,
    "g"
  );
  return html.replace(pattern, `$1?v=${hash}`);
}

function main() {
  const scriptHash = shortHash(path.join(ROOT, "script.js"));
  const styleHash = shortHash(path.join(ROOT, "style.css"));

  const before = fs.readFileSync(INDEX_HTML, "utf8");
  let after = bumpAsset(before, "script.js", scriptHash);
  after = bumpAsset(after, "style.css", styleHash);

  if (after === before) {
    console.log("bump-cache-version: 변경 없음 (해시 동일)");
    return;
  }

  fs.writeFileSync(INDEX_HTML, after);
  console.log(`bump-cache-version: index.html 갱신 (script.js=${scriptHash}, style.css=${styleHash})`);
}

main();
