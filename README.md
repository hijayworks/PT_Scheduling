# 수업 스케줄 자동 생성기

트레이너의 지점·이동 시간·회원별 희망 시간을 입력하면 겹치지 않는 수업 스케줄 후보를 자동으로 계산해주는 웹 앱입니다.

## 사용 방법

별도 설치나 서버 없이 `index.html` 파일을 브라우저(Chrome 권장)로 열면 바로 사용할 수 있습니다.

입력한 데이터(지점, 회원, 희망 시간 등)는 브라우저의 localStorage에 자동 저장되며, 같은 브라우저·같은 위치에서 다시 열면 그대로 남아있습니다.

## 구성 파일

- `index.html` — 화면 구조
- `style.css` — 스타일
- `src/` — 로직 소스 (ES 모듈로 분리: 상태·알고리즘·페이지별 렌더링 등). **실제로 고칠 코드는
  여기 있습니다.**
- `script.js` — **자동 생성 파일**입니다. `src/`를 esbuild로 번들링한 결과이며, 직접 고치면
  다음 빌드 때 덮어써집니다. `index.html`이 `file://`로 서버 없이 바로 열려야 해서(아래 "사용
  방법" 참고) `<script type="module">`을 쓸 수 없어, 배포 파일은 지금처럼 하나로 합칩니다.

## 개발 환경 설정

새로 클론한 환경에서는 아래를 한 번만 실행하세요.

```sh
npm install
```

`npm install`이 `prepare` 스크립트(`scripts/install-git-hooks.js`)로 pre-commit 훅을
`.git/hooks/pre-commit`에 자동 설치합니다. (훅을 직접 다시 설치하고 싶다면
`node scripts/install-git-hooks.js`를 실행하세요.)

`src/`를 고친 뒤에는:

```sh
npm run build   # src/ -> script.js 번들링
npm test        # tests/smoke.js (Playwright 헤드리스 E2E 스모크 테스트)
npm run lint    # ESLint
npm run format  # Prettier
```

git commit 시 pre-commit 훅이 `npm run build`와 캐시 버스팅 버전(`?v=`) 갱신을 자동으로
실행하므로, 평소에는 `src/`만 고치고 커밋하면 됩니다.

훅이 어떤 이유로든 설치돼 있지 않은 채 `script.js`가 `src/`와 어긋난 상태로 커밋되면,
GitHub Actions CI(`.github/workflows/ci.yml`)가 `npm run build` 후 `script.js` diff를
검사해 실패시킵니다 — 훅은 예방, CI는 안전망입니다.

`npm test`가 실행하는 후보A(체인DP) 생성 검증은 담금질 다듬기가 시간 예산제(카드 3장 ×
최대 90초)라 데이터가 아주 적어도 실측 몇 분~십수 분이 걸릴 수 있습니다 — 빠르게 반복
확인할 때는 `SMOKE_SKIP_A=1 npm test`로 그 부분만 건너뛸 수 있습니다.
