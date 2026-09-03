#!/usr/bin/env node
// src/main.js를 esbuild로 번들링해 script.js에 출력한다. file://로 index.html을 직접 여는
// 배포 방식(README 참고) 때문에 type="module" 스크립트는 CORS로 막혀 쓸 수 없다 — 그래서
// 소스는 ES 모듈로 나누되, 배포되는 script.js는 지금까지와 똑같은 일반 스크립트(IIFE)로
// 번들링한다. script.js는 이 스크립트가 생성하는 파일이므로 직접 수정하지 말 것.
"use strict";

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.join(ROOT, "src", "main.js");
const OUTFILE = path.join(ROOT, "script.js");

const GENERATED_HEADER =
  "// 이 파일은 자동 생성됩니다 — src/ 아래 파일을 수정한 뒤 `npm run build`를 실행하세요.\n" +
  "// (git commit 시 pre-commit 훅이 자동으로 다시 빌드합니다.) 이 파일을 직접 고치면 다음\n" +
  "// 빌드에서 조용히 덮어써집니다.\n";

async function main() {
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: "iife",
    target: "es2020",
    outfile: OUTFILE,
    write: false,
    logLevel: "silent",
    charset: "utf8", // 한글을 \uXXXX로 이스케이프하지 않고 그대로 출력
    // 라이브러리가 아니라 앱 전체를 번들링하는 것이라 모든 모듈의 최상위 부수효과
    // (DOM 요소 캐싱, 이벤트 리스너 등록 등)가 다 필요하다 — 트리쉐이킹이 "안 쓰는 것 같은"
    // export를 지우면서 그 주석까지 함께 지워버리는 문제가 있어 꺼둔다.
    treeShaking: false
  });

  const bundled = result.outputFiles.find((f) => f.path === OUTFILE);
  if (!bundled) {
    throw new Error("esbuild가 예상한 출력 파일을 만들지 않았습니다: " + OUTFILE);
  }
  fs.writeFileSync(OUTFILE, GENERATED_HEADER + bundled.text);
  console.log("build: src/main.js -> script.js");
}

main().catch((err) => {
  console.error("build 실패:", err);
  process.exit(1);
});
