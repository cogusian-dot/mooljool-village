// 물줄때 마을 · 에셋 주소 + 캐릭터·씨앗 데이터 — 이름·대사·씨앗 정보는 여기서 고쳐요
// 원본 단일 파일 index.html 882–1070행에서 옮김
// 파일 경로 → 실제 주소 (지금은 경로 그대로. 나중에 CDN 등으로 옮기면 여기만 고치면 돼요)
function assetURL(path) { return path; }
// data-a="경로" 로 적어 둔 이미지·영상은 그 화면을 열 때 불러와요(첫 로딩을 가볍게)
function hydrateAssets(root) {
  (root || document).querySelectorAll('[data-a]').forEach(el => { if (!el.dataset.done) { el.dataset.done = '1'; el.src = assetURL(el.dataset.a); } });
}
// 물줄때 마을 — 캐릭터 & 씨앗 데이터
// 캐릭터 이름은 여기서 바꾸면 게임 전체에 반영돼요.
const CHARACTERS = [
  { id: 'santa',   name: '산타',   img: 'c00', acc: 'santa',   blush: true, seed: 'pepper',     voice: 1.05, line: '오늘도 선물 같은 하루야!' },
  { id: 'bread',   name: '빵군이',   img: 'c01', acc: 'bread',   seed: 'basil',      voice: 0.95, line: '갓 구운 빵 냄새 맡았어?' },
  { id: 'ribbon',  name: '리봉순',   img: 'c02', acc: 'ribbon',  seed: 'portulaca',  voice: 1.2,  line: '리본 예쁘지? 헤헤.' },
  { id: 'apple',   name: '삼사과',   img: 'c03', acc: 'apple',   seed: 'tomato',     voice: 1.1,  line: '빨간 건 다 좋아!' },
  { id: 'bukbuk',  name: '북북이',   img: 'c04', acc: 'books',   blush: true, seed: 'clover', voice: 1.15, line: '책 읽는 게 세상에서 제일 좋아.' },
  { id: 'miyeok',  name: '미역이',   img: 'c05', acc: 'seaweed', seed: 'perilla',    voice: 0.9,  line: '초록 초록한 게 최고야.' },
  { id: 'jjossu',  name: '쪼수',     img: 'c06', acc: 'shark',   seed: 'mint',       voice: 1.15, line: '어흥! …상어 모자야.' },
  { id: 'gibon',   name: '기본이',   img: 'c07', acc: 'none',    seed: 'lettuce',    voice: 1.0,  line: '난 그냥 기본이야. 기본이 제일 중요하지!' },
  { id: 'bamti',   name: '밤티',     img: 'c08', acc: 'bamti',   seed: 'nasturtium', voice: 1.25, line: '천사 날개 멋지지?' },
  { id: 'dussum',  name: '두섬이',   img: 'c09', acc: 'cake',    seed: 'strawberry', voice: 1.1,  line: '머리 위 케이크는 먹으면 안 돼!' },
  { id: 'sarang',  name: '사랑이',   img: 'c10', acc: 'heart',   seed: 'zinnia',     voice: 1.2,  line: '사랑해~ 다 사랑해~' },
  { id: 'jaya',    name: '자야',     img: 'c11', acc: 'tutu',    body: '#E8882A', seed: 'marigold', voice: 1.0, line: '빙글빙글 춤추는 거 좋아해.' },
  { id: 'danggeun',name: '당근이',   img: 'c12', acc: 'carrot',  seed: 'radish',     voice: 1.05, line: '당근 모자는 내 보물이야.' },
  { id: 'giyoung', name: '기영이',   img: 'c13', acc: 'spiky',   seed: 'rosemary',   voice: 1.3,  line: '머리 스타일 어때? 뾰족뾰족!' },
  { id: 'jack',    name: '잭아저씨', img: 'c14', acc: 'fedora',  seed: 'bean',       voice: 0.75, line: '허허, 반갑구먼.' },
  { id: 'gangnam', name: '강남이',   img: 'c15', acc: 'shades',  seed: 'sunflower',  voice: 0.85, line: '햇빛이 눈부셔서 선글라스 꼈어.' },
  { id: 'kossuk',  name: '코쓱이',   img: 'c17', acc: 'tissue',  seed: 'cotton',     voice: 1.22, line: '훌쩍… 우는 거 아니야, 감동받아서 그래.' },
  { id: 'kitty',   name: '키티',     img: 'c16', acc: 'kitty',   seed: 'catgrass',   voice: 1.3,  line: '냐옹~ 아니, 안녕!' },
];

// 목수 요정 (고를 수 없는 마을 주민 · 기본이에 수건 머리띠)
const CARPENTER = { id: 'sadalhee', name: '사달희', acc: 'towel', seed: 'pepper', voice: 0.78, line: '뚝딱뚝딱, 나무로 뭐든 만들지!' };

// req: 성장 단계별로 땀땀이가 요청하는 [물, 양분] 개수. 게임은 2단계(씨앗 → 새싹 → 완성)라서 앞의 두 묶음만 써요
const SEEDS = [
  { id: 'basil', name: '바질', emoji: '🌿', pack: '#5DB866',
    seed: '깨알만 한 까만 씨앗이에요. 물에 닿으면 겉이 젤리처럼 투명하게 부풀어 올라요.',
    plant: '잎을 따서 파스타나 피자에 올려 먹는 향긋한 허브예요. 꽃대가 올라오면 잘라 줘야 잎이 풍성해져요.',
    water: '겉흙이 마르면 듬뿍', waterDetail: '여름 2~3일, 봄·가을 4~5일에 한 번',
    level: 2, sun: '하루 6시간 이상', sprout: '5~10일', harvest: '6~8주',
    tip: '잎 말고 흙에 물을 주면 잎이 무르지 않아.', brag: '잎에서 향긋한 냄새가 나지?', praise: '향이 정말 좋다!',
    req: [[2, 1], [3, 1], [3, 2]] },
  { id: 'perilla', name: '들깨 (깻잎)', short: '들깨', emoji: '🍃', pack: '#3F9B4A',
    seed: '동글동글 갈색 씨앗이에요. 빛을 받아야 싹이 잘 터서 흙을 아주 얇게만 덮어요.',
    plant: '우리가 먹는 깻잎이 바로 들깨 잎이에요. 아래 잎부터 따 먹으면 위로 계속 새잎이 나요.',
    water: '겉흙이 마르면 듬뿍', waterDetail: '2~3일에 한 번, 물을 좋아해요',
    level: 1, sun: '하루 5시간 이상', sprout: '5~7일', harvest: '6주부터',
    tip: '아래쪽 큰 잎부터 따 주면 위쪽이 더 잘 자라.', brag: '깻잎 한 장 한 장이 이렇게 커!', praise: '잎이 손바닥만 해!',
    req: [[2, 1], [3, 1], [4, 1]] },
  { id: 'tomato', name: '방울토마토', emoji: '🍅', pack: '#E8524A',
    seed: '납작하고 연노란 씨앗이에요. 겉에 보송보송한 솜털이 나 있어요.',
    plant: '작은 품종은 화분에서도 빨간 방울토마토가 주렁주렁 열려요. 노란 꽃이 지면 그 자리에 열매가 맺혀요.',
    water: '겉흙이 마르면 듬뿍', waterDetail: '2~3일에 한 번, 열매가 달리면 매일 확인',
    level: 3, sun: '하루 8시간 이상 (햇빛을 아주 좋아해요)', sprout: '7~10일', harvest: '약 3개월',
    tip: '키가 크면 막대를 꽂아서 줄기를 묶어 줘야 해.', brag: '빨간 방울토마토가 주렁주렁!', praise: '진짜 맛있어 보인다!',
    req: [[2, 1], [3, 2], [4, 2]] },
  { id: 'sunflower', name: '미니 해바라기', short: '해바라기', emoji: '🌻', pack: '#F4B400',
    seed: '줄무늬가 있는 길쭉한 씨앗이에요. 우리가 먹는 해바라기씨와 똑같이 생겼어요.',
    plant: '키가 작은 품종(왜성종)이라 화분에서도 커다란 노란 꽃을 볼 수 있어요.',
    water: '겉흙이 마르면', waterDetail: '3~4일에 한 번',
    level: 2, sun: '하루 6시간 이상', sprout: '7~10일', harvest: '꽃까지 약 2달',
    tip: '꽃은 해를 따라가니까 창가 쪽에 두면 좋아.', brag: '해님처럼 환하지?', praise: '꽃이 해님 같아!',
    req: [[2, 1], [2, 2], [3, 2]] },
  { id: 'lettuce', name: '상추', emoji: '🥬', pack: '#8BCB4F',
    seed: '가늘고 길쭉한 씨앗이에요. 빛을 좋아해서 흙을 거의 덮지 않아요.',
    plant: '쌈 채소로 먹는 상추는 겉잎부터 따 주면 몇 번이고 다시 자라요.',
    water: '흙이 촉촉하게', waterDetail: '1~2일에 한 번, 마르지 않게',
    level: 1, sun: '하루 4~6시간', sprout: '3~5일', harvest: '4~5주',
    tip: '한여름 더위는 싫어하니까 시원한 곳에 둬.', brag: '쌈 싸 먹고 싶지 않아?', praise: '잎이 꼬불꼬불 귀여워!',
    req: [[3, 1], [3, 1], [4, 1]] },
  { id: 'strawberry', name: '딸기', emoji: '🍓', pack: '#F0506E',
    seed: '딸기 겉에 콕콕 박힌 깨알 같은 게 바로 씨앗이에요. 싹이 나기까지 2~4주나 걸려요.',
    plant: '하얀 꽃이 지면 빨간 딸기가 열려요. 씨앗부터 키우면 시간이 오래 걸려서 끈기가 필요해요.',
    water: '겉흙이 마르면', waterDetail: '2~3일에 한 번, 열매에 물이 닿지 않게',
    level: 4, sun: '하루 6시간 이상', sprout: '2~4주', harvest: '첫 해엔 꽃까지가 목표!',
    tip: '열매가 흙에 닿으면 무르니까 화분 가장자리로 늘어뜨려 줘.', brag: '딸기가 빨갛게 익었어!', praise: '딸기가 보석 같아!',
    req: [[2, 1], [3, 2], [3, 2]] },
  { id: 'pepper', name: '미니 고추', short: '고추', emoji: '🌶️', pack: '#D93A2B',
    seed: '납작한 원반 모양의 연노란 씨앗이에요. 따뜻해야(25~30℃) 싹이 터요.',
    plant: '하얀 꽃이 진 자리에 초록 고추가 열리고, 다 익으면 빨갛게 변해요.',
    water: '겉흙이 마르면 듬뿍', waterDetail: '2~3일에 한 번',
    level: 3, sun: '하루 6시간 이상', sprout: '10~14일', harvest: '약 3개월',
    tip: '추위를 많이 타니까 따뜻한 창가가 좋아.', brag: '초록 고추가 빨갛게 익었어!', praise: '색깔이 정말 선명해!',
    req: [[2, 1], [3, 1], [3, 2]] },
  { id: 'marigold', name: '메리골드', emoji: '🌼', pack: '#F2862E',
    seed: '한쪽은 까맣고 반대쪽은 하얀, 작은 붓처럼 생긴 가느다란 씨앗이에요.',
    plant: '주황·노랑 폼폼 같은 꽃이 오래오래 피어요. 꽃잎은 말려서 차로 마시기도 해요.',
    water: '겉흙이 마르면', waterDetail: '3~4일에 한 번, 너무 많이 주지 않기',
    level: 1, sun: '하루 6시간 이상', sprout: '5~7일', harvest: '꽃까지 약 2달',
    tip: '시든 꽃을 따 주면 새 꽃이 계속 피어나.', brag: '폼폼 꽃이 동글동글하지?', praise: '꽃이 폼폼 같아!',
    req: [[1, 1], [2, 1], [2, 2]] },
  { id: 'rosemary', name: '로즈마리', emoji: '🌲', pack: '#4E7E66',
    seed: '아주 작은 갈색 씨앗이에요. 싹이 잘 안 나고 2~3주 정도 오래 걸려요.',
    plant: '바늘 같은 잎을 문지르면 상쾌한 향이 나는 허브예요. 고기 요리에 많이 써요.',
    water: '흙이 바싹 마르면', waterDetail: '일주일에 한 번 정도, 과습 주의',
    level: 4, sun: '하루 6시간 이상', sprout: '2~3주', harvest: '3달부터',
    tip: '물을 너무 자주 주면 뿌리가 썩어. 바람 잘 통하는 곳이 좋아.', brag: '잎을 살짝 만져 봐, 상쾌하지?', praise: '숲 냄새가 나!',
    req: [[1, 1], [1, 2], [2, 2]] },
  { id: 'mint', name: '민트', emoji: '🌱', pack: '#47C2A0',
    seed: '먼지처럼 아주아주 작은 씨앗이에요. 흙 위에 뿌리고 덮지 않아요.',
    plant: '잎을 만지면 시원한 향이 나요. 번식력이 강해서 화분 하나를 금방 가득 채워요.',
    water: '겉흙이 마르면 듬뿍', waterDetail: '2~3일에 한 번, 물을 좋아해요',
    level: 2, sun: '하루 4시간 이상', sprout: '10~15일', harvest: '6~8주',
    tip: '줄기 끝을 잘라 주면 옆으로 풍성하게 퍼져.', brag: '잎을 만지면 화~ 해!', praise: '엄청 시원한 향이야!',
    req: [[2, 1], [3, 1], [4, 1]] },
  { id: 'radish', name: '래디시 (적환무)', short: '래디시', emoji: '🔴', pack: '#E0457B',
    seed: '동글동글한 붉은 갈색 씨앗이에요. 3~5일이면 싹이 터서 아주 빨라요.',
    plant: '빨갛고 동그란 꼬마 무예요. 한 달이면 수확할 수 있어서 ‘20일 무’라고도 불러요.',
    water: '흙이 마르지 않게', waterDetail: '1~2일에 한 번, 마르면 뿌리가 갈라져요',
    level: 1, sun: '하루 5시간 이상', sprout: '3~5일', harvest: '약 30일',
    tip: '흙이 마르면 무가 갈라지니까 촉촉하게 지켜 줘.', brag: '흙 속에 빨간 보석이 숨어 있지?', praise: '동글동글 너무 귀여워!',
    req: [[3, 1], [3, 1], [3, 1]] },
  { id: 'bean', name: '강낭콩', emoji: '🫘', pack: '#B5784A',
    seed: '콩 자체가 씨앗! 크고 매끈해서 손으로 심기 쉬워요. 떡잎이 흙을 밀고 쑥 올라와요.',
    plant: '하트 모양 잎이 세 장씩 나고, 꽃이 지면 꼬투리 안에 콩이 자라요. 관찰 일기 쓰기 좋아요.',
    water: '겉흙이 마르면', waterDetail: '2~3일에 한 번, 싹 트기 전엔 과습 주의',
    level: 1, sun: '하루 6시간 이상', sprout: '5~7일', harvest: '약 2달',
    tip: '싹 트기 전에 물을 너무 많이 주면 콩이 썩어버려.', brag: '콩 꼬투리가 주렁주렁!', praise: '꼬투리가 통통해!',
    req: [[2, 1], [2, 1], [3, 2]] },
  { id: 'zinnia', name: '백일홍', emoji: '🌺', pack: '#E8508C',
    seed: '화살촉처럼 생긴 납작한 씨앗이에요.',
    plant: '이름처럼 백 일 동안 피고 지고를 반복하는 꽃이에요. 색깔이 아주 다양해요.',
    water: '겉흙이 마르면', waterDetail: '3일에 한 번 정도, 잎에 물이 닿지 않게',
    level: 2, sun: '하루 6시간 이상', sprout: '5~7일', harvest: '꽃까지 6~8주',
    tip: '더위에 강해서 여름에도 쌩쌩해!', brag: '분홍 꽃이 겹겹이 피었어!', praise: '꽃잎이 겹겹이 예뻐!',
    req: [[2, 1], [2, 1], [3, 2]] },
  { id: 'nasturtium', name: '한련화', emoji: '🏵️', pack: '#F57C2B',
    seed: '주름진 완두콩만 한 씨앗이에요. 하룻밤 물에 불려 심으면 싹이 잘 터요.',
    plant: '연잎 같은 동그란 잎과 주황 꽃이 예뻐요. 잎과 꽃을 샐러드에 넣어 먹을 수도 있어요.',
    water: '겉흙이 마르면', waterDetail: '3~4일에 한 번',
    level: 2, sun: '하루 6시간 이상', sprout: '7~10일', harvest: '꽃까지 6~8주',
    tip: '거름을 너무 많이 주면 잎만 크고 꽃이 적게 펴.', brag: '잎이 연잎처럼 동글동글해!', praise: '잎이 우산 같아!',
    req: [[2, 1], [2, 1], [2, 1]] },
  { id: 'catgrass', name: '캣그라스 (귀리)', short: '캣그라스', emoji: '🌾', pack: '#9DC93B',
    seed: '겉껍질이 붙은 길쭉한 귀리 낟알이에요. 고양이가 좋아하는 풀이 돼요.',
    plant: '일주일이면 초록 풀이 쑥쑥! 고양이가 뜯어 먹으며 털 뭉치를 뱉어내는 걸 도와줘요.',
    water: '매일 촉촉하게', waterDetail: '매일 조금씩, 흙이 마르지 않게',
    level: 1, sun: '밝은 곳 (반그늘도 OK)', sprout: '2~3일', harvest: '7~10일',
    tip: '진짜 빨리 자라. 일주일이면 냥이 간식 완성!', brag: '풀숲이 쑥쑥 자랐어, 냥!', praise: '풀이 보들보들해!',
    req: [[3, 0], [3, 1], [3, 1]] },
  { id: 'portulaca', name: '채송화', emoji: '🌸', pack: '#E35BB5',
    seed: '반짝반짝 까만 먼지 같은 아주 작은 씨앗이에요.',
    plant: '통통한 다육질 잎에 알록달록한 작은 꽃이 피어요. 햇빛을 받으면 꽃이 활짝 열려요.',
    water: '흙이 바싹 마르면', waterDetail: '5~7일에 한 번, 건조에 강해요',
    level: 1, sun: '하루 6시간 이상 (해가 있어야 꽃이 펴요)', sprout: '7~10일', harvest: '꽃까지 6~8주',
    tip: '물 자주 안 줘도 괜찮아. 대신 햇볕은 듬뿍!', brag: '알록달록 꽃이 피었어!', praise: '무지개 꽃밭 같아!',
    req: [[1, 1], [1, 1], [2, 1]] },
  { id: 'clover', name: '클로버 (토끼풀)', short: '클로버', emoji: '☘️', pack: '#4FB55A',
    seed: '좁쌀보다 작은 노르스름한 하트 모양 씨앗이에요. 흙 위에 솔솔 뿌리면 며칠 만에 싹이 터요.',
    plant: '동글동글한 세 잎이 귀여운 풀이에요. 하얀 솜방망이 같은 꽃이 피고, 운이 좋으면 네잎클로버도 만날 수 있어요.',
    water: '겉흙이 마르면 듬뿍', waterDetail: '2~3일에 한 번, 흙이 너무 마르지 않게',
    level: 1, sun: '하루 4~6시간 (밝은 창가)', sprout: '3~7일', harvest: '2~3주면 잎이 가득',
    tip: '너무 덥고 건조하면 잎이 처져. 시원하고 촉촉하게 해 줘.', brag: '어딘가에 네잎클로버가 숨어 있어!', praise: '네잎클로버 찾았다!',
    req: [[2, 1], [3, 1], [3, 1]] },
  { id: 'cotton', name: '목화', emoji: '☁️', pack: '#B9C7D6',
    seed: '보송보송한 솜털에 싸인 콩알만 한 씨앗이에요. 하룻밤 물에 불려 심으면 싹이 잘 터요.',
    plant: '연노란 꽃이 지면 다래라는 열매가 맺히고, 다 익으면 톡 터지면서 하얀 솜이 몽글몽글 나와요.',
    water: '겉흙이 마르면 듬뿍', waterDetail: '2~3일에 한 번, 솜이 터질 무렵엔 조금 줄여요',
    level: 3, sun: '하루 6시간 이상 (따뜻한 곳)', sprout: '7~10일', harvest: '솜까지 약 5개월',
    tip: '추위를 싫어해서 따뜻해지는 5월쯤 심는 게 좋아.', brag: '하얀 솜이 몽글몽글 피었어!', praise: '구름 같아!',
    req: [[2, 1], [3, 1], [3, 2]] },
];
// 앱 영상이 끝난 뒤 열리는 물줄때 앱 (피그마 메이크)
// · 지금 주소(figma.com/make/…)는 피그마가 다른 화면 안에 넣는 것을 막아서 새 창으로 열려요.
// · 피그마 메이크에서 Publish(게시)해서 받은 ○○○.figma.site 주소로 url을 바꾸고 embed를 true로 하면 게임 화면 안에서 바로 열려요.
const APP_LINK = {
  url: 'https://www.figma.com/make/O1sYYVxtC07WmV8g9hACJD/Smart-Plant-Care-App?t=FSrivObawgwIRRfN-6',
  embed: false,
};
const SEED_BY_ID = Object.fromEntries(SEEDS.map(s => [s.id, s]));
const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

// 한국어 조사
function hasJong(s) { const c = s.charCodeAt(s.length - 1); if (c < 0xAC00 || c > 0xD7A3) return false; return (c - 0xAC00) % 28 !== 0; }
function J(s, a, b) { return s + (hasJong(s) ? a : b); }
function callName(s) { return J(s, '아', '야'); }
function plantShort(seed) { return seed.short || seed.name; }


// ═════════ 방명록 설정 ═════════
// dbUrl: Firebase 실시간 데이터베이스 주소를 따옴표 안에 붙여 넣으세요. (README '방명록 켜기' 참고)
//   예) 'https://mooljool-village-default-rtdb.asia-southeast1.firebasedatabase.app'
//   비워 두면 '체험 모드'로 동작해요. 체험 모드에서는 같은 기기·같은 브라우저 안에서만 글이 보여요.
const GUESTBOOK = {
  dbUrl: 'https://mooljool-village-default-rtdb.asia-southeast1.firebasedatabase.app',
  // apiKey: Firebase 프로젝트 설정 > 일반 > '웹 API 키'. 익명 로그인에 써요. 비어 있으면 방명록은 읽기만 돼요.
  //   (이 키는 공개돼도 괜찮은 값이에요. 대신 README '방명록 켜기 ④'대로 키 사용처를 우리 사이트로 묶어 두세요)
  apiKey: '',
  room: 'guestbook',   // 게시판 이름. 바꾸면 firebase/database.rules.json 안의 'guestbook'도 똑같이 바꿔서 다시 붙여 넣어야 해요
  maxNotes: 500,       // 들어올 때 받아 오는 최근 글 수 (게시판·'방명록 모아보기' 표). '몇 명 왔다감' 숫자는 전체 글 수예요
  maxLength: 40,       // 한 글의 최대 글자 수
  cooldownSec: 30,     // 같은 기기에서 다시 쓰기까지 기다리는 시간(초)
};

// 수확 자랑: 씨앗별로 무엇을 수확하는지 (열매가 없으면 잎이나 꽃)
const HARVEST = {
  basil: '바질 잎 한 줌', perilla: '깻잎 한 장', tomato: '방울토마토 한 송이', sunflower: '해바라기 한 송이',
  lettuce: '상추 한 장', strawberry: '딸기 한 알', pepper: '미니 고추 하나', marigold: '메리골드 한 송이',
  rosemary: '로즈마리 한 가지', mint: '민트 잎 한 장', radish: '래디시 한 뿌리', bean: '강낭콩 꼬투리 하나',
  nasturtium: '한련화 한 송이', zinnia: '백일홍 한 송이', catgrass: '캣그라스 한 줌', portulaca: '채송화 한 송이',
  clover: '네잎클로버 한 잎', cotton: '목화솜 한 송이',
};
