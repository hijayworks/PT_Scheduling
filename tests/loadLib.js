// tests/unit/entry.js를 esbuild로 Node용(CJS) 번들링해 그 자리에서 요구한 결과(lib)를 내보낸다.
// 단위 테스트(tests/unit.js)와 골든 데이터셋(tests/golden.js)이 같은 번들을 쓴다.
//
// src 모듈들은 브라우저에서 돌아가는 걸 전제하므로(예: state.js 최상단의
// document.addEventListener), 임포트 시점에 필요한 최소한의 전역만 흉내 낸다.
"use strict";

const path = require("path");
const Module = require("module");
const esbuild = require("esbuild");

// pages/memberSchedule.js처럼 임포트 시점에 DOM 요소를 찾고 이벤트를 거는 모듈도 불러올 수
// 있도록, 정의하지 않은 속성은 무엇이든 "아무것도 안 하는 함수 겸 객체"를 돌려주게 한다.
function domStub(base = {}) {
  return new Proxy(
    Object.assign(function () {}, base),
    {
      get: (t, k) =>
        k in base ? base[k] : k === Symbol.toPrimitive ? () => "" : domStub(),
      apply: () => domStub(),
      construct: () => domStub(),
      set: () => true,
    },
  );
}
globalThis.document = globalThis.document || domStub({ hidden: false });
globalThis.window = globalThis.window || globalThis;
globalThis.addEventListener = globalThis.addEventListener || (() => {});
// navigator·performance는 Node 22부터 이미 전역으로 존재해(단, wakeLock 등은 없음) 여기서
// 굳이 덮어쓰지 않는다 — 다시 대입하면 getter 전용이라 TypeError가 난다. 테스트 대상
// 함수들은 애초에 navigator를 쓰지 않는다.
globalThis.localStorage = globalThis.localStorage || {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

const ENTRY = path.join(__dirname, "unit", "entry.js");
const built = esbuild.buildSync({
  entryPoints: [ENTRY],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const mod = new Module(ENTRY);
mod.filename = ENTRY;
mod.paths = Module._nodeModulePaths(path.dirname(ENTRY));
mod._compile(built.outputFiles[0].text, ENTRY);
module.exports = mod.exports;
