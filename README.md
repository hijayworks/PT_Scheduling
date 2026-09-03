# 수업 스케줄 자동 생성기

트레이너의 지점·이동 시간·회원별 희망 시간을 입력하면 겹치지 않는 수업 스케줄 후보를 자동으로 계산해주는 웹 앱입니다.

## 사용 방법

별도 설치나 서버 없이 `index.html` 파일을 브라우저(Chrome 권장)로 열면 바로 사용할 수 있습니다.

입력한 데이터(지점, 회원, 희망 시간 등)는 브라우저의 localStorage에 자동 저장되며, 같은 브라우저·같은 위치에서 다시 열면 그대로 남아있습니다.

## 구성 파일

- `index.html` — 화면 구조
- `style.css` — 스타일
- `script.js` — 로직 (상태 저장, 스케줄 후보 계산 등)

## 개발 환경 설정

`index.html`이 참조하는 `script.js`/`style.css`의 캐시 버스팅 버전(`?v=`)은 커밋 시
`scripts/bump-cache-version.js`가 파일 해시로 자동 갱신합니다. 새로 클론한 환경에서는
아래 명령을 한 번만 실행해 pre-commit 훅을 설치하세요.

```sh
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```
