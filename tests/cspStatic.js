#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const violations = [];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const htmlPath = path.join(ROOT, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

if (/\sstyle\s*=/.test(html)) {
  violations.push("index.html에 inline style 속성이 남아 있습니다.");
}
const cspMatch = html.match(
  /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/i,
);
if (!cspMatch) {
  violations.push("Content-Security-Policy meta 태그가 없습니다.");
} else if (/style-src[^;]*'unsafe-inline'/.test(cspMatch[1])) {
  violations.push("style-src에 'unsafe-inline'이 남아 있습니다.");
}

const forbiddenPatterns = [
  { re: /\.style\s*(?:\.|\[|=)/, label: "HTMLElement.style" },
  { re: /\.cssText\b/, label: "cssText" },
  {
    re: /setAttribute\(\s*["']style["']/,
    label: "setAttribute('style', ...)",
  },
];

for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, "utf8");
  for (const { re, label } of forbiddenPatterns) {
    if (re.test(source)) {
      violations.push(
        path.relative(ROOT, file) + "에서 " + label + " 사용을 발견했습니다.",
      );
    }
  }
}

if (violations.length) {
  console.error("FAIL — strict CSP style 검사 실패:");
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}

console.log(
  "PASS — inline style 사용 없음, style-src 'unsafe-inline' 없음",
);
