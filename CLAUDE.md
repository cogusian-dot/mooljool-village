# 물줄때 마을 · 땀땀이와 씨앗 이야기 — 개발 메모 (Claude Code용)

빌드 단계가 없는 정적 사이트예요. GitHub Pages에 배포하고, 관리는 비개발자가 맡아요. README.md는 그분들이 읽는 문서라서 쉬운 말로 유지해 주세요.

## 구조
- `index.html` → `css/fonts.css`(로컬 Jua·Noto Sans KR) + `css/style.css`
- `lib/three/` : Three.js **r0.147.0** 전역 스크립트(three.min.js, GLTFLoader, OrbitControls, BufferGeometryUtils), 로컬 사본
- `js/` 일반 `<script>` 태그로 이 순서대로 불러옴. 맨 위에 선언한 const/function을 파일끼리 함께 씀:
  `audio.js`(SFX, Web Audio 합성) → `data.js`(assetURL, CHARACTERS, CARPENTER, SEEDS, APP_LINK — 비개발자가 고치는 파일) →
  `models.js`(클레이 재질, 캐릭터·식물·땀땀이) → `world.js`(렌더러·마을) → `game.js`(진행·조작·대화·퀘스트, DOMContentLoaded 시작점) → `plaza.js`(광장) → `info.js`(영상·설명 페이지·앱 뷰)
- `assets/` : 넣어야 할 파일 목록은 `assets/넣어야-할-파일.md`. `assetURL()`은 `window.ASSET_B64`가 없으면 경로를 그대로 돌려줌
- `assets/models/ttami.glb` 가 없으면 `makeTtamiPlaceholder()`(models.js) 임시 모형을 씀

## 방명록 (js/guestbook.js, css/guestbook.css)
- 저장소: Firebase Realtime Database를 SDK 없이 REST로 사용. 실시간 수신은 EventSource(SSE), 쓰기는 POST(`ts: {".sv":"timestamp"}`)
  - 경로: `/{room}/notes/{pushId}` = {name≤8, msg≤60, seed, char, color 0-5, ts}, `/{room}/presence/{clientId}` = 서버 시각(25초마다 갱신, 70초 안이면 접속 중)
  - 보안 규칙: `firebase/database.rules.json` (새 글 추가만 허용, 수정·삭제 불가, 필드 검증)
- `GUESTBOOK.dbUrl`(js/data.js)이 비어 있으면 체험 모드: localStorage + BroadcastChannel (같은 브라우저의 탭끼리만)
- 수확물: `HARVEST`(js/data.js) 문구 + `buildPlant(seed, 3)`을 별도 WebGLRenderer로 찍은 썸네일(캐시)
- 진입점: 타이틀 `#titleBoard`, 완성 창 `#cpBrag`
- 3D 게시판(`GB.build3D(at, look)`, CanvasTexture에 최근 8개 글)은 광장(plaza.js)에만 세움. 마을에는 없음
- 게시판 화면(`#gb`)은 스크롤 없는 코르크판. 칸(cols×rows, 쪽지 224×204 / 좁은 화면 150×150)을 무작위 순서로 채우고, 꽉 차면 다음 겹으로 더 크게 어긋나게 위에 붙임(z = 오래된 순). 세 겹 아래는 그리지 않음. 오른쪽 아래 칸(칠판 자리)은 각 겹의 마지막. 쪽지를 누르면 맨 위로(`.front`)
- 귀퉁이 칠판 `#gbChalk` = `notes.size`명 왔다감(SVG 필터 `#gbChalkFx`로 분필 질감). 누적 숫자를 위해 `GUESTBOOK.maxNotes` 5000
- `📋 방명록 모아보기`(`#gbList`): 번호·이름·남긴 말·날짜 표, 최근 글이 위. Esc는 쓰기 창 → 모아보기 → 게시판 순으로 닫음
- 게임 중 새 글 알림(toast)은 유지
- 비속어는 표시할 때 모든 글에 `GB.clean()` 적용. 도배 방지는 클라이언트 쿨다운뿐이라 서버 쪽 속도 제한은 없음
- 테스트: `tests/mock_rtdb.py <port>` (RTDB REST 흉내 서버)로 여러 브라우저 동시 접속 확인 가능

## 광장 (js/plaza.js, `PZ`, `PLAZA = {x:0, z:-170}`)
- 마을과 길로 이어지지 않은 별도 공간(같은 씬의 먼 좌표). 들어오는 곳은 두 군데뿐: 완성 창 `#cpBrag`(`PZ.enter('complete')`), 씨앗 고르기 단계 `#seedPlaza`(`PZ.enter('setup')`). 완성 후 마을에선 ⛲ 버튼(`'village'`)
- 나가기: ⛲ 버튼(광장에선 🏡 나가기) 또는 남쪽 표지판에서 E. setup에서 왔으면 `startGame()`, 아니면 마을 땀땀이 앞으로
- 낮/밤(`MOODS`, `#btnDayNight` → `PZ.toggleMood()`, 0.7초 동안 조명·안개·창문/가로등 빛이 바뀜, 선택은 localStorage `mjplaza:mood`, 기본 밤). 밤에만 불꽃놀이, 하늘은 `body.plazaNight`(별)/`plazaDay`. 점광원은 마을 셰이더 비용 때문에 안 씀, 벽돌 바닥 CanvasTexture, 시계탑 마을회관(시계는 실제 시각), 방명록 게시판(E → 쓰기 창), 물방울 깃발, 노점, 가로등·줄깃발·벤치·풍선, 불꽃놀이
- 레퍼런스는 사용자가 준 다른 게임 광장 사진이지만 분위기만 참고(건물·깃발 디자인은 베끼지 않음)
- 광장 한가운데 땀땀이(`TT_S` 18, 완성한 씨앗 식물, 아니면 해바라기). E → `playWithTtami()` 무작위: 같이 춤추기 5초(`danceAt`: 좌우 콩콩·한 바퀴·씰룩·점프, 땀땀이 wrap과 플레이어에 같은 값) / 흙에 축포 꽂고 팡(confetti) + 플레이어 박수. 둘 다 플레이어는 화면 쪽(yaw 0)을 봄. 다른 접속자에게는 안 보임(로컬)
- 마을 완료 후 땀땀이에게 말 걸면 완성 창이 다시 열림
- 마을회관 문 앞 E → `PZ.openInfo()`(패키지 영상 → 설명 페이지). 이때 `#infoClose`(✕)는 `PZ.backFromInfo()`로 광장 복귀, '다른 씨앗 심기'는 `replay()`가 `PZ.exitQuiet()`로 광장을 조용히 떠남. 목표 안내는 글을 남긴 뒤(`GB.posted`) 회관 문을 가리킴

## 함께 접속하기 (js/net.js, js/multiplayer.js, css/multiplayer.css)
- 다른 접속자는 광장에서만 보임(`m`=광장에 있음). 좌표 x·z는 광장 한가운데 기준으로 보냄(DB 규칙이 -60~60이라서)
- `NET`(net.js): 방명록과 접속자 공용 연결. Firebase는 `/{room}.json` EventSource 하나로 notes·players를 함께 받음(무료 동시 연결 100개 아끼기). 체험 모드는 BroadcastChannel
- `/{room}/players/{cid}` = {n 이름, c 캐릭터, m 광장에 있음(0/1), x,y,z,r, a 동작(1 하트·2 놀리기·3 기차), an 동작 번호, tg 대상 cid 목록, t 서버 시각}
  - 250ms마다 바뀐 경우만 PUT, 안 움직이면 8초마다 생존 신호. 20초 넘게 소식 없으면 화면에서 숨기고 90초 넘으면 기록 삭제
- `MP`(multiplayer.js): 다른 접속자 캐릭터 생성·보간, 가까이 가면 손 흔들기, 메뉴(E 또는 이름표 클릭 → 1 하트 / 2 엉덩이 씰룩 / 3 기차놀이)
  - 기차놀이: 시작한 사람 뒤로 반경 6.5 안의 가까운 최대 3명이 한 줄(간격 1.25)로 0.7초 만에 폴짝 줄 서고, 5초 동안 다 같이 뒤뚱뒤뚱 3걸음 앞으로. 각자 자기 위치를 직접 옮김(`me.line`)
  - 동작은 `an`이 바뀔 때 한 번 재생. 서버 검증이 없어서 악의적인 접속자가 남을 기차에 계속 태울 수 있음(전시용으로는 감수)
- 기영이 머리: `spikyCrownGeo()`(models.js). 몸통 옆면에서 이어지는 한 덩어리 메시, 가장자리만 뾰족하고 안쪽은 평평 · 멜빵끈 없음(주황 티셔츠 + T만)
- 밤티(`case 'bamti'`): 가운데 가르마, 이마는 드러나고 얼굴 옆으로 웨이브 다발(tube)이 흘러내림, 흰 옷은 아랫몸만 감쌈(얼굴 가리는 띠 없음). 참고: 사용자가 보낸 3D 조형 영상

## 게임 진행 변경 (2026-11-22)
- 성장 2단계: `GROW_STAGES = [1, 3]`(game.js). 씨앗 → 새싹 → 완성. `SEEDS[].req`는 앞의 두 묶음만 사용
- NPC 자랑 대화의 세 번째 선택지는 공감 안 해 주는 말 → `n.sad` 동안 웅크리고 눈물(`burst('tear', pos, 1, { vel })`: 두 눈에서 위로 솟았다가 양옆으로 포물선을 그리며 떨어짐). 다시 말 걸어 칭찬하면 풀림
- 완성 시 `n.celebrate` 위치(땀땀이 둘레 반지름 5, 카메라 쪽은 비움)로 모든 NPC가 모여 축하
- 양동이는 얻은 뒤 머리에 이고 다님(`updateHeadBucket`). `makeBucketMesh`는 속이 빈 양동이라 물이 있으면 윗부분까지 하늘색 물이 찬 게 보임. 언덕 위(`G.onHill`)·햇빛 모으기(`G.sunHold`) 중엔 숨김(가방에 넣은 것처럼). 반짝이는 0.55초 뒤 바로 가방으로(따라다니지 않음)
- 목수 화분은 작업대 옆 (-14.3, 9.3). `#btnPlaza`는 식물 완성 후에만 보임(`refreshPlazaBtn`)

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
