# 물줄때 마을 · 땀땀이와 씨앗 이야기 — 개발 메모 (Claude Code용)

빌드 단계가 없는 정적 사이트예요. GitHub Pages에 배포하고, 관리는 비개발자가 맡아요. README.md는 그분들이 읽는 문서라서 쉬운 말로 유지해 주세요.

## 구조
- `index.html` → `css/fonts.css`(로컬 Jua·Noto Sans KR) + `css/style.css`
- `lib/three/` : Three.js **r0.147.0** 전역 스크립트(three.min.js, GLTFLoader, OrbitControls, BufferGeometryUtils), 로컬 사본
- `js/` 일반 `<script>` 태그로 이 순서대로 불러옴. 맨 위에 선언한 const/function을 파일끼리 함께 씀:
  `audio.js`(SFX, Web Audio 합성) → `data.js`(assetURL, CHARACTERS, CARPENTER, SEEDS, APP_LINK — 비개발자가 고치는 파일) →
  `models.js`(클레이 재질, 캐릭터·식물·땀땀이) → `world.js`(렌더러·마을) → `game.js`(진행·조작·대화·퀘스트, DOMContentLoaded 시작점) → `plaza.js`(광장) → `info.js`(영상·설명 페이지·앱 뷰)
- `assets/` : 에셋 설명은 `assets/넣어야-할-파일.md`(glb 부품 이름 규칙 포함). `assetURL()`은 경로를 그대로 돌려줌. 설명 페이지·앱 화면 이미지는 `data-a`로 적고 `hydrateAssets()`가 화면을 열 때 불러옴(첫 로딩 가볍게)
- `css/fonts.css`는 fontsource 조각 중 한글·라틴·자모와 사이트 글자에 쓰이는 조각만 남김(한자·특수 조각 160개 제거). 새 기호를 쓰면 기기 글꼴로 보일 수 있음
- `assets/models/ttami.glb`는 gltfpack(meshoptimizer 1.3)으로 압축됨: `-cc -kn -km -ke -vpf -vn 12`(EXT_meshopt_compression + 12비트 노멀, 위치는 float). 원본 대비 부품 16개·이름·박스 동일 확인. `lib/meshopt/meshopt_decoder.js`(UMD 전역) + `loader.setMeshoptDecoder`, CSP에 `'wasm-unsafe-eval'` 필요. 원본 비압축 GLB는 git 기록(이 변경 이전 커밋)에 있음
- `assets/models/ttami.glb` 가 없으면 `makeTtamiPlaceholder()`(models.js) 임시 모형을 씀

## 방명록 (js/guestbook.js, css/guestbook.css)
- 저장소: Firebase Realtime Database를 SDK 없이 REST로 사용. 쓰기는 익명 로그인(Identity Toolkit REST, `GUESTBOOK.apiKey`) 토큰을 `?auth=`로 붙임
  - 로그인: refresh token을 localStorage(`mjauth:*`)에 두고 재사용(같은 IP 가입 수 제한 대비). 그래서 같은 브라우저의 탭들은 cid(=uid)를 공유함. 실패하면 30초 쉼, 읽기는 로그인 없이 됨
  - 경로: `/{room}/notes/{20자 pushId}` = {name≤8, msg≤60, seed, char, color 0-5, uid, ts}, `/{room}/meta` = {count, t}, `/{room}/last/{uid}` = 마지막 글 시각
  - 글쓰기는 PATCH 한 번에 notes·meta·last를 함께 씀. 규칙: count = 이전+1(동시 쓰기 직렬화), meta.t 전체 1초 간격, last 같은 uid 20초 간격. 실패(401)면 최대 4번 재시도
  - 읽기: notes는 `orderBy="ts"` + `limitToLast`(≤1000)/`limitToFirst`(≤100) 쿼리만 허용(규칙). 처음에 최근 `maxNotes`(500)개, 이후 5초마다 `startAt=마지막 ts` 폴링(탭이 숨겨지면 쉼)
  - 옛 규칙(.indexOn ts 없음)에서는 notes 쿼리가 400 → status 'denied'로 표시. apiKey가 비면 상태 줄에 '지금은 읽기만 돼요', 글쓰기 실패 문구도 설정 안내로 바뀜
  - 보안 규칙: `firebase/database.rules.json`. 방 이름 'guestbook'이 규칙에 박혀 있음(room을 바꾸면 규칙도 바꿔야 함)
- `GUESTBOOK.dbUrl`(js/data.js)이 비어 있으면 체험 모드: localStorage + BroadcastChannel (같은 브라우저의 탭끼리만)
- 수확물: `HARVEST`(js/data.js) 문구 + `buildPlant(seed, 3)`을 별도 WebGLRenderer로 찍은 썸네일(캐시)
- 진입점: 타이틀 `#titleBoard`, 완성 창 `#cpBrag`
- 3D 게시판(`GB.build3D(at, look)`, CanvasTexture에 최근 8개 글)은 광장(plaza.js)에만 세움. 마을에는 없음
- 게시판 화면(`#gb`)은 스크롤 없는 코르크판. 칸(cols×rows, 쪽지 224×204 / 좁은 화면 150×150)을 무작위 순서로 채우고, 꽉 차면 다음 겹으로 더 크게 어긋나게 위에 붙임(z = 오래된 순). 세 겹 아래는 그리지 않음. 오른쪽 아래 칸(칠판 자리)은 각 겹의 마지막. 쪽지를 누르면 맨 위로(`.front`)
- 귀퉁이 칠판 `#gbChalk` = `NET.total`(= max(meta.count, 받은 글 수))명 왔다감(SVG 필터 `#gbChalkFx`로 분필 질감). 모아보기 번호도 total 기준
- `📋 방명록 모아보기`(`#gbList`): 번호·이름·남긴 말·날짜 표, 최근 글이 위. Esc는 쓰기 창 → 모아보기 → 게시판 순으로 닫음
- 게임 중 새 글 알림(toast)은 유지
- 비속어는 표시할 때 모든 글에 `GB.clean()` 적용(DB에는 원문)
- 테스트: `tests/mock_rtdb.py <port>` (RTDB REST + 익명 로그인 + 규칙 핵심 흉내). data.js 사본에 `dbUrl`·`authUrl`=`http://127.0.0.1:<port>`, `apiKey:'test'`, index.html CSP `connect-src`에 그 주소 추가해서 사용
- index.html에 CSP meta 있음. 외부 주소를 새로 쓰면 CSP(connect-src/frame-src 등)도 고쳐야 함

## 광장 (js/plaza.js, `PZ`, `PLAZA = {x:0, z:-170}`)
- 마을과 길로 이어지지 않은 별도 공간(같은 씬의 먼 좌표). 들어오는 곳은 두 군데뿐: 완성 창 `#cpBrag`(`PZ.enter('complete')`), 씨앗 고르기 단계 `#seedPlaza`(`PZ.enter('setup')`). 완성 후 마을에선 ⛲ 버튼(`'village'`)
- 나가기: ⛲ 버튼(광장에선 🏡 나가기) 또는 남쪽 표지판에서 E. setup에서 왔으면 `startGame()`, 아니면 마을 땀땀이 앞으로
- 낮/밤(`MOODS`, `#btnDayNight` → `PZ.toggleMood()`, 0.7초 동안 조명·안개·창문/가로등 빛이 바뀜, 선택은 localStorage `mjplaza:mood`, 기본 밤). 밤에만 불꽃놀이, 하늘은 `body.plazaNight`(별)/`plazaDay`. 점광원은 마을 셰이더 비용 때문에 안 씀, 벽돌 바닥 CanvasTexture, 시계탑 마을회관(시계는 실제 시각), 방명록 게시판(E → 쓰기 창), 물방울 깃발, 노점, 가로등·줄깃발·벤치·풍선, 불꽃놀이
- 레퍼런스는 사용자가 준 다른 게임 광장 사진이지만 분위기만 참고(건물·깃발 디자인은 베끼지 않음)
- 광장 한가운데 땀땀이(`TT_S` 18, 완성한 씨앗 식물, 아니면 해바라기). E → `playWithTtami()` 무작위: 같이 춤추기 5초(`danceAt`: 좌우 콩콩·한 바퀴·씰룩·점프, 땀땀이 wrap과 플레이어에 같은 값) / 흙에 축포 꽂고 팡(confetti) + 플레이어 박수. 둘 다 플레이어는 화면 쪽(yaw 0)을 봄. 다른 접속자에게는 안 보임(로컬)
- 광장에는 빈손으로 들어감: `PZ.enter`가 `G.inv` 전부 0, `G.flags.bucket=false`, 가방 칸(`#inventory`) 숨김. `updateHeadBucket`도 광장에선 양동이를 안 보임
- 손 흔들기는 마을 요정처럼: 거리 0.8~4.0 안에 있는 동안 서로 계속 흔듦(상대 `near`, 나 `G.playerWave`를 매 프레임 유지). 걷는 중(속도 2.5 이상)·씰룩·기차 중엔 멈춤. '뿅' 소리는 처음 가까워질 때만(6초 쿨다운). 접속자 메뉴를 열 때도 흔듦
- 마을 완료 후 땀땀이에게 말 걸면 완성 창이 다시 열림
- 마을회관 문 앞 E → `PZ.openInfo()`(패키지 영상 → 설명 페이지). 이때 `#infoClose`(✕)는 `PZ.backFromInfo()`로 광장 복귀, '다른 씨앗 심기'는 `replay()`가 `PZ.exitQuiet()`로 광장을 조용히 떠남. 목표 안내는 글을 남긴 뒤(`GB.posted`) 회관 문을 가리킴

## 함께 접속하기 (js/net.js, js/multiplayer.js, css/multiplayer.css)
- 다른 접속자는 광장에서만 보임(`m`=광장에 있음). 좌표 x·z는 광장 한가운데 기준으로 보냄(DB 규칙이 -60~60이라서)
- `NET`(net.js): 방명록과 접속자 공용 연결. Firebase는 `/{room}/players.json` EventSource 하나(무료 동시 연결 100개 아끼기) + notes는 폴링. 체험 모드는 BroadcastChannel
- `/{room}/players/{cid}` = {n 이름, c 캐릭터, m 광장에 있음(0/1), x,y,z,r, a 동작(1 하트·2 놀리기·3 기차), an 동작 번호, tg 대상 cid 목록, t 서버 시각}
  - 250ms마다 바뀐 경우만 PUT, 안 움직이면 8초마다 생존 신호. 20초 넘게 소식 없으면 화면에서 숨기고 90초 넘으면 기록 삭제
  - 규칙: 내 uid 경로만 쓰기 가능, 남의 기록은 t가 90초 지난 것만 삭제 가능
- `MP`(multiplayer.js): 다른 접속자 캐릭터 생성·보간, 가까이 가면 손 흔들기, 메뉴(E 또는 이름표 클릭 → 1 하트 / 2 엉덩이 씰룩 / 3 기차놀이)
  - 기차놀이: 시작한 사람 뒤로 반경 6.5 안의 가까운 최대 3명이 한 줄(간격 1.25)로 0.7초 만에 폴짝 줄 서고, 5초 동안 다 같이 뒤뚱뒤뚱 3걸음 앞으로. 각자 자기 위치를 직접 옮김(`me.line`)
  - 동작은 `an`이 바뀔 때 한 번 재생. `tg`(대상 목록)는 서버가 검증하지 않아서 악의적인 접속자가 남을 기차에 계속 태울 수는 있음(전시용으로는 감수)
- 기영이 머리: `spikyCrownGeo()`(models.js). 몸통 옆면에서 이어지는 한 덩어리 메시, 가장자리만 뾰족하고 안쪽은 평평 · 멜빵끈 없음(주황 티셔츠 + T만)
- 밤티(`case 'bamti'`): 가운데 가르마, 이마는 드러나고 얼굴 옆으로 웨이브 다발(tube)이 흘러내림, 흰 옷은 아랫몸만 감쌈(얼굴 가리는 띠 없음). 참고: 사용자가 보낸 3D 조형 영상

## 조작 (2026-11-23 추가)
- 점프: 게임 중(`G.mode==='play'`) 스페이스 = `jump()`(대화 중이면 대화 넘기기). 행동은 E·Enter·Z·✋. 터치 화면은 `#jumpBtn`(pointer: coarse일 때만 보임, ✋ 왼쪽)
  - `G.jumpY/jumpV`, `JUMP_V 7.2`·`JUMP_G 24`(높이 약 1.1). 플레이어 y = posY + jumpY, 카메라는 jumpY를 따라가지 않음. busy·언덕·햇빛 모으기 중엔 안 됨. 접속자 y에도 jumpY 포함
- 시점: follow 카메라가 `G.cam.yaw`(좌우)·`G.cam.elev`(0~1.2, 0이면 카메라 높이 = 시선 높이 1.3 → 1인칭 눈높이 정도) 구면 좌표로 플레이어 둘레를 돎. yaw 0·`CAM_ELEV0`이 예전 고정 시점과 같음
  - `#gl` 포인터 드래그(마우스 왼/오른쪽, 터치 손가락 하나)로 회전. 조이스틱과 포인터 id가 달라서 이동과 동시에 가능. 더블클릭/두 번 탭 → `camReset()`. 스폰·광장 출입 때도 초기화
  - 이동 입력(WASD·조이스틱)은 카메라 yaw만큼 돌려서 화면 기준으로 움직임
  - 줌 `G.cam.zoom`(0.4~1.6, 거리 = CAM_DIST×zoom): 마우스 휠, 두 손가락 벌리기/오므리기(#gl 위 포인터 2개일 때만, 조이스틱 손가락은 제외). camReset이 1로 돌림
  - 카메라 충돌 `keepTargetOutside()`: 카메라 목표 위치(tPos)가 모델 **안**일 때만 tPos를 당김(현재 위치로 판단하면 이동 중 벽을 스칠 때 걸려 멈춤)(사이에 가로막는 것은 그대로 둠, 사용자 요청). 머리(y 1.5)→카메라 광선에 걸린 물체 중 카메라→머리 광선에 안 걸리는 것 = 카메라를 품은 물체 → 그 입구 0.6 앞(최소 1.0)으로. 겹친 부품 안일 수 있어 최대 4번 반복. 카메라는 lerp로 따라감
  - `CAM_OCCLUDERS`(models.js): 합치기 전 장식 부품(`mergeByMaterial(group, 'village'|'plaza')`)과 `addOccluders()`로 넣은 사과나무·언덕·가운데 땀땀이·광장 live 그룹. 반지름 0.3 이하·투명·그림자 안 지는 것은 제외
- 그림자: 햇빛과 그림자 범위를 구역 전체에 고정(`updateSun`, 마을 중심 ±40 / 광장 중심 ±26). 예전엔 캐릭터 주변 ±24만 따라다님. 합쳐진 장식 메시는 원래도 매번 그림자 패스에 다 들어가서 비용은 거의 같음
- 충돌: 원 `collider(x,z,r)`(W.colliders) + 네모 `boxCollider(x,z,hw,hd)`(W.boxes, `pushOutBox`로 덜 파고든 축으로 밀어냄). 광장 마을회관은 원 5개로는 벽 앞면(z −14.2)을 못 막아 안으로 들어갔음 → 몸체 13×6.6 상자만 추가(계단은 막지 않음: 계단까지 막았더니 문에 다가가기 어려웠음). 문 정면에서 문까지 0.35, E 범위 2.8
- 구역 숨기기: `W.zoneObjs.village`(buildWorld 끝의 scene.children 스냅샷, 조명·구름 제외) / `.plaza`(PZ.build 전후 차이). `updateSun`의 구역 전환 때 다른 구역을 visible=false. 둥근 지평선으로 안 휘는 재질(벽돌·창문 불빛·간판 등)이 마을 하늘에 광장이 떠 보이던 문제 때문
- 햇살 언덕 사다리: base 반지름 5.25, 꼭대기 3.2(예전 5.05/3.06은 옆면·둔덕을 뚫음). 사다리 각도 ±0.3 안의 둔덕 1개는 만들지 않음
- 광장 잔디는 `RingGeometry(…, 64, 40)`(원판은 테두리 점뿐이라 둥근 지평선으로 휘면 바닥 전체가 기울어 덤불 그림자가 초승달처럼 어긋났음)
- 둥근 지평선(`CURVE_PROJ`, models.js): 예전엔 '카메라 깊이'로 휘어서 시점을 돌리면 지형이 따라 움직였음 → 지금은 **지도 중심 기준 월드 공간**에서 휨: `U_CC`(중심 xz)에서 `U_D0`보다 먼 곳만 y -= `U_CURVE`·(d−d0)². `setCurveZone('village'|'plaza')`를 매 프레임 `updateCamera`에서 호출(마을 0,0 d0 34 / 광장 0,−170 d0 19). 걸어 다니는 곳은 평평해서 그림자·충돌과 어긋나지 않음
  - `worldToScreen`(이름표·! 표시)도 같은 식. 별도 렌더러(설명 페이지 뷰어, 방명록 썸네일)는 원점에 모델을 두므로 `renderFlat()`으로 휘지 않게 그림

- 가방 칸 고르기: 칸 누르기/탭 → `selectSlot(i)`(숫자키 1~6은 사용자 요청으로 없앰), `G.sel`(SLOT_KEYS 순서 apple·bucket·water·ladder·crystal·nutrient). 같은 키 다시 → 내려놓기, 없는 물건은 deny+toast, 다 쓰면 `refreshSel`이 자동 해제. 게임 중·마을·가방이 보일 때만(광장 메뉴의 1~3은 메뉴 열렸을 때 먼저 처리)
  - 사과·사다리·반짝이·양분은 오른손에 듦(`updateHeld`, 메시는 `HELD` 캐시, body에 붙이고 손 위치 따라감). 양동이·물은 지금처럼 머리에 인 양동이. 다른 물건을 들면 머리 양동이는 숨김. 사용은 여전히 E로 자동(선택과 무관)

## 게임 진행 변경 (2026-11-22)
- 성장 2단계: `GROW_STAGES = [1, 3]`(game.js). 씨앗 → 새싹 → 완성. `SEEDS[].req`는 앞의 두 묶음만 사용
- NPC 자랑 대화의 세 번째 선택지는 공감 안 해 주는 말 → `n.sad` 동안 웅크리고 눈물(`burst('tear', pos, 1, { vel })`: 두 눈에서 위로 솟았다가 양옆으로 포물선을 그리며 떨어짐). 다시 말 걸어 칭찬하면 풀림
- 완성 시 `n.celebrate` 위치(땀땀이 둘레 반지름 5, 카메라 쪽은 비움)로 모든 NPC가 모여 축하
- 양동이는 얻은 뒤 머리에 이고 다님(`updateHeadBucket`). `makeBucketMesh`는 속이 빈 양동이라 물이 있으면 윗부분까지 하늘색 물이 찬 게 보임. 언덕 위(`G.onHill`)·햇빛 모으기(`G.sunHold`) 중엔 숨김(가방에 넣은 것처럼). 반짝이는 0.55초 뒤 바로 가방으로(따라다니지 않음)
- 돌멩이 던지는 동안(`actRock` → `G.throwing`)에도 양동이 숨김. 완성 축하로 모인 요정(`n.celebrate`)은 이름표 숨김
- 설명 페이지 3D 뷰어: 버튼(`.mvCtl`)과 안내 문구는 캔버스 아래(모델을 가리지 않게). 물받이통 서랍은 땀땀이 등 쪽(-z, 얼굴은 +z)으로 똑바로 빠지고 뒤쪽 끝을 축으로 기울여 물을 버림(`addTtamiDrawer`의 `tilt` 축 = 서랍 뒤 끝, `slide.position.z`, `tilt.rotation.x`)
- 목수 화분은 작업대 옆 (-14.3, 9.3). `#btnPlaza`는 식물 완성 후에만 보임(`refreshPlazaBtn`)

## 결정 사항
- 성능: `adaptQuality()`(world.js)가 3초 평균이 두 번 연달아 36ms 넘으면 pixelRatio를 0.25씩(최소 0.75), 그다음 그림자 맵을 절반씩(최소 512) 낮춤. 올리지는 않음. `?hq`로 끔
- 숨은 오버레이(#story·#setup·#help·#complete·#videoOverlay·#appView·#lightbox·#info)는 `:not(.show)`일 때 content-visibility:hidden(style.css 맨 끝). 안 보이는 글자의 글꼴 조각을 미리 받지 않게 하려는 것. 새 오버레이를 만들면 같이 넣기
- Three.js는 r147 그대로 둠. r187로 올리면 조명 세기(π 배율·decay), colorSpace, mergeGeometries, PCFSoftShadowMap 제거 때문에
  클레이 질감이 달라지는데, 원본과 비교할 기준 화면이 없어서 보류. 업그레이드 시 _reports/A.md 참고 (배포 패키지에는 없음)
- 텍스트를 content.json으로 분리하지 않고 `js/data.js`를 편집 파일로 지정 (원본 코드 동작 보존)

## 배포
- index.html의 CSS·JS 주소에 `?v=날짜`를 붙임(GitHub Pages가 10분 캐시라 배포 직후 예전 파일과 섞여 에러가 날 수 있었음). JS·CSS를 고치면 이 숫자를 모두 같이 올리기

## 검증
- `node tests/smoke.mjs` : 오프라인(외부 요청 차단) 실행, 콘솔 에러·페이지 에러 수집, 스크린샷 tests/out/
- 로컬 실행: `python3 -m http.server 8000`

## 지켜야 할 게임 설정
- 요정: 두섬이(딸기케이크), 산타, 빵군이, 리봉순, 삼사과, 북북이(책) 등. 목수는 사달희(머리에 수건)
- 양분 플로우: 돌멩이로 반짝이 얻기 → 사과 2개 주고 사달희에게 사다리 부탁 → 언덕에서 햇볕 담기 → 땀땀이에게 양분
- 클레이 느낌 매끄러운 표면, 귀여운 효과음

## 버전 구성 (2026-11-23)
- 저장소 맨 위 = ver2(팀원 Rarae827/mooljoolday-village-ver2의 보안·최적화 버전)를 정식으로 씀
- `ver1/` = 그 전 버전 백업. Firebase를 쓰지 않도록 `dbUrl`을 비워 체험 모드로 둠
- 시작·완성 화면의 '만든 사람 김채현' 문구는 유지
- 수상 사진은 상패를 든 손 사진(`award_plaque.webp`)만 씀. 팀원 얼굴이 나오는 사진(단체·시상식)은 공개 사이트라 빼기로 팀이 결정

## 모바일 화면 (2026-11-24)
- 도움말 `#help`: 맨 위 `#helpClose`(처음엔 '게임 시작!', ❔로 열면 '게임으로 돌아가기'), 내용은 `.helpPc`/`.helpTouch`로 나눠 `(pointer: coarse)`에 따라 하나만 보임, 카드는 스크롤됨
- 터치 화면(`pointer: coarse`): `#hudTL`(목표 안내 `#objective` + 가방 `#inventory`를 감싼 div, 컴퓨터에선 display:contents)이 왼쪽 위 세로 묶음. 목표 안내 13px, 그 아래 가방은 가진 물건(`.slot.on`)만, 가방 아이콘 숨김. 위쪽 `.round` 버튼 38px. 묶음 폭은 버튼 줄 왼쪽까지(⛲ 버튼이 보이면 더 좁게)
- 조이스틱·✋·점프 버튼은 반투명 '물젤리' 스타일(style.css 맨 끝)
- 요정 충돌: `npcCollide`/`npcBlocked`가 기물(W.colliders·boxes)·화분(`POT_R` = MINI_SCALE×0.125 ≈ 0.81 + NPC_R)·다른 요정·플레이어와 부딪힘. 걷다가 부딪히면 `npcBonk` → '꽁!' 글자(`.bonkPop`)·`SFX.bonk`·폴짝, 곧 다른 곳으로 감
- 부르는 이름: `nickName()`(data.js) 한글 3~4글자면 뒤 두 글자. 부를 때 `callName`(채현아/민지야), '~이야?' 물을 때 `J(nickName, '이야', '야')`(채현이야?/민지야?)
