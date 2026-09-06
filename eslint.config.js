"use strict";

// 최소 설정: 모듈 분리 중 export/import를 빠뜨리는 실수(no-undef)와 죽은 코드(no-unused-vars)를
// 잡는 데 초점을 둔다. 브라우저 전역은 필요한 것만 손으로 나열해 globals 패키지 의존을 피했다.
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  localStorage: "readonly",
  console: "readonly",
  location: "readonly",
  performance: "readonly",
  requestAnimationFrame: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  fetch: "readonly",
  alert: "readonly",
  confirm: "readonly",
  prompt: "readonly",
  crypto: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  structuredClone: "readonly",
  html2canvas: "readonly", // vendor/html2canvas.min.js가 전역으로 주입
  File: "readonly",
  URL: "readonly",
  Blob: "readonly",
  btoa: "readonly",
  atob: "readonly"
};

const nodeGlobals = {
  require: "readonly",
  module: "readonly",
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  console: "readonly",
  Buffer: "readonly"
};

module.exports = [
  {
    ignores: ["node_modules/**", "script.js", "vendor/**", ".playwright-mcp/**"]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: browserGlobals
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
    files: ["scripts/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
    // page.evaluate()/addInitScript() 콜백 안에서는 브라우저 전역을 그대로 쓰므로 둘 다 허용
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
    // tests/unit.js가 esbuild로 번들링해 요구(require)하는 진입점 — src/**/*.js처럼
    // export/import를 쓰는 ES 모듈이라 이 파일만 sourceType을 module로 되돌린다.
    files: ["tests/unit/entry.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: browserGlobals
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  }
];
