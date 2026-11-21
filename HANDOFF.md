# 인수인계: 물줄때 마을 게임 → GitHub Pages 정적 사이트 전환

> 이 파일은 다른 Claude Code 세션에서 이어서 작업하라고 만든 요약이에요.
> 새 세션에서 이 폴더를 열고 "HANDOFF.md 읽고 이어서 진행해줘"라고 입력하면 돼요.

## 1. 프로젝트 개요
- **게임**: 물줄때 마을 · 땀땀이와 씨앗 이야기. MooljoolDay(물줄때) 반려식물 키트 홍보용 3D 웹 게임
  - 경기과학기술대학교 디자인공학과 4CUS, 2026 GTEC Design Engineering Fair
- **원본**: claude.ai 아티팩트(팀 계정 소유) https://claude.ai/artifact/MT1FZy3AyqWm11WrNXKQuc
  - 4MB가 넘는 단일 index.html(3,754줄). 722·723행에 에셋이 base64로 들어 있음
    (`window.ASSET_B64` = { 'assets/...': base64 }, `window.TTAMI_GLB` = 땀땀이 GLB). 줄이 너무 길어 Claude 도구로는 읽을 수 없었음
- **목표**: 빌드 없는 정적 사이트로 GitHub Pages에 배포(나중에 Vercel 연결 가능). 비개발자가 GitHub 웹에서 끌어다 놓기만으로 관리

## 2. 지금까지 한 일 (이 폴더가 결과물)
- 원본 코드를 그대로 옮겨서 나눔: `index.html`, `css/style.css`, `css/fonts.css`, `js/`(audio, data, models, world, game, info)
- Three.js r0.147.0을 `lib/three/`에 로컬로 넣음(CDN 의존 제거). 글꼴 Jua·Noto Sans KR도 로컬(`assets/fonts/`)
- `models.js`의 `loadTtamiModel`: 내장 데이터가 없으면 `assets/models/ttami.glb`를 불러오고, 그것도 없으면 `makeTtamiPlaceholder()` 임시 모형을 씀
- README.md(비개발자용 배포·수정 안내), `.nojekyll`, `tests/smoke.mjs`(오프라인 Playwright 점검)
- 검증: 외부 요청을 전부 차단한 상태에서 타이틀 → 이야기 → 이름·캐릭터·씨앗 → 마을 → 땀땀이 대화까지 페이지 에러 0
  (404는 에셋 파일이 아직 없어서 나는 것)

## 3. 결정 사항
- Three.js는 최신(r187) 대신 r147 유지. 최신 버전은 조명·colorSpace 변경으로 클레이 질감이 달라지는데, 원본과 비교할 기준 화면이 없음
- 텍스트를 JSON으로 분리하지 않고 `js/data.js`(CHARACTERS, SEEDS 등)를 비개발자 편집 파일로 지정
- 배포는 GitHub Pages 1차. Vercel Hobby와 GitHub Pages 모두 상업 목적 사용 불가 → 판매·홍보 사이트로 쓸 계획이면 재검토

## 4. 남은 일
0. ✅ (2026-11-21) 에셋 채움: 바탕 화면 `물줄때마을_게임\물줄때마을\assets`(예전 zip판, 같은 캐릭터 18명 데이터)에서
   chars·img·slides·video 복사, `ttami_model.js`의 base64를 풀어 `assets/models/ttami.glb` 생성.
   로컬 서버로 타이틀·땀땀이 모델·패키지 영상·설명 페이지 이미지 19개 확인(404 없음). 아래 1번은 이제 필요 없음
1. ~~**에셋 확보**~~ (완료, 참고용으로 남김): 목록은 `assets/넣어야-할-파일.md`
   - ⚠️ 원본 아티팩트는 **팀 계정** 것이라 개인 계정에서는 열리지 않음. 아래 추출은 팀 계정 브라우저에서 해야 함
   - 추출 방법: 아티팩트 페이지 → F12 → Console → 실행 위치를 게임 iframe으로 변경
     (`typeof ASSET_B64`가 `'object'`인 항목. `frame-shell-*.js`는 claude.ai 껍데기라서 아님) → 아래 코드 실행
     ```js
     (async () => {
       const all = { ...(window.ASSET_B64 || {}) };
       if (window.TTAMI_GLB) all['assets/models/ttami.glb'] = window.TTAMI_GLB;
       const names = Object.keys(all); console.log(names.length + '개 파일', names);
       for (const p of names) {
         const bin = atob(all[p]); const u8 = new Uint8Array(bin.length);
         for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
         const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8]));
         a.download = p.replace(/^assets\//, '').replace(/\//g, '__');
         document.body.appendChild(a); a.click(); a.remove();
         await new Promise(r => setTimeout(r, 400));
       }
     })();
     ```
     다운로드가 막히면 `copy(JSON.stringify({ ...window.ASSET_B64, 'assets/models/ttami.glb': window.TTAMI_GLB }))` 실행 →
     메모장에 붙여 `assets.json`으로 저장 → 스크립트로 쪼개기
   - 받은 파일 이름 `img__banner.webp` → `assets/img/banner.webp`처럼 `__`를 `/`로 바꿔 배치
   - 추출이 안 되면 팀 원본을 모음: Inventor CAD → GLB, 클레이 렌더, 배너 재료, 발표 PPT, 영상
2. 에셋을 넣은 뒤 `node tests/smoke.mjs`와 실제 플레이로 확인. 영상은 파일당 25MB 이하로(ffmpeg)
3. GitHub 저장소 생성 → 업로드 → Settings > Pages(main, /root) → 주소 확인
4. (선택) Three.js 최신 버전 업그레이드: 원본과 화면 비교가 가능해진 뒤에

## 5. 지켜야 할 게임 설정
- 흐름: 스토리텔링 → 이름·캐릭터·씨앗 고르기 → 마을에서 물·양분 구해 땀땀이 키우기 → 식물 완성 창(물 주는 주기, 집에서 키우기 난이도)
  → 땀땀이 알아보기(패키지 영상 → 설명 페이지) → 물줄때 앱(앱 영상 → Figma Make 앱) / 다른 씨앗 심기
- Figma 앱: https://www.figma.com/make/O1sYYVxtC07WmV8g9hACJD/Smart-Plant-Care-App
- 요정: 두섬이(딸기케이크), 산타, 빵군이, 리봉순, 삼사과, 북북이(책) 등 18명. 목수는 사달희(머리에 수건)
- 양분: 돌멩이로 바위의 반짝이 얻기 → 사과 2개 주고 사달희에게 "도끼로 사다리를 만들어 줄 수 있냐"고 부탁 → 언덕에서 반짝이에 햇볕 담기 → 땀땀이에게 양분
- 클레이 느낌의 매끄러운 표면, 귀여운 효과음
