# 물줄때 마을 · 땀땀이와 씨앗 이야기 — 개발 메모 (Claude Code용)

빌드 단계가 없는 정적 사이트예요. GitHub Pages에 배포하고, 관리는 비개발자가 맡아요. README.md는 그분들이 읽는 문서라서 쉬운 말로 유지해 주세요.

## 구조
- `index.html` → `css/fonts.css`(로컬 Jua·Noto Sans KR) + `css/style.css`
- `lib/three/` : Three.js **r0.147.0** 전역 스크립트(three.min.js, GLTFLoader, OrbitControls, BufferGeometryUtils), 로컬 사본
- `js/` 일반 `<script>` 태그로 이 순서대로 불러옴. 맨 위에 선언한 const/function을 파일끼리 함께 씀:
  `audio.js`(SFX, Web Audio 합성) → `data.js`(assetURL, CHARACTERS, CARPENTER, SEEDS, APP_LINK — 비개발자가 고치는 파일) →
  `models.js`(클레이 재질, 캐릭터·식물·땀땀이) → `world.js`(렌더러·마을) → `game.js`(진행·조작·대화·퀘스트, DOMContentLoaded 시작점) → `info.js`(영상·설명 페이지·앱 뷰)
- `assets/` : 넣어야 할 파일 목록은 `assets/넣어야-할-파일.md`. `assetURL()`은 `window.ASSET_B64`가 없으면 경로를 그대로 돌려줌
- `assets/models/ttami.glb` 가 없으면 `makeTtamiPlaceholder()`(models.js) 임시 모형을 씀

## 결정 사항
- Three.js는 r147 그대로 둠. r187로 올리면 조명 세기(π 배율·decay), colorSpace, mergeGeometries, PCFSoftShadowMap 제거 때문에
  클레이 질감이 달라지는데, 원본과 비교할 기준 화면이 없어서 보류. 업그레이드 시 _reports/A.md 참고 (배포 패키지에는 없음)
- 텍스트를 content.json으로 분리하지 않고 `js/data.js`를 편집 파일로 지정 (원본 코드 동작 보존)

## 검증
- `node tests/smoke.mjs` : 오프라인(외부 요청 차단) 실행, 콘솔 에러·페이지 에러 수집, 스크린샷 tests/out/
- 로컬 실행: `python3 -m http.server 8000`

## 지켜야 할 게임 설정
- 요정: 두섬이(딸기케이크), 산타, 빵군이, 리봉순, 삼사과, 북북이(책) 등. 목수는 사달희(머리에 수건)
- 양분 플로우: 돌멩이로 반짝이 얻기 → 사과 2개 주고 사달희에게 사다리 부탁 → 언덕에서 햇볕 담기 → 땀땀이에게 양분
- 클레이 느낌 매끄러운 표면, 귀여운 효과음
