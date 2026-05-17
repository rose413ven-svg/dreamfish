/* ============================================
   build.js — GitHub Pages + PWA 빌드 스크립트 (Day 28 신규)
   ============================================
   목적: public/ + src/ 를 dist/ 로 합쳐서 GitHub Pages 배포 가능한 정적 사이트 생성.
   
   동작:
   1. dist/ 폴더 초기화
   2. public/* → dist/* 복사
   3. src/    → dist/src/ 복사
   4. dist/index.html 의 src 경로 수정 (절대 → 상대)
   5. dist/index.html 에 PWA 메타/스크립트 태그 삽입
   6. dist/manifest.webmanifest 생성 (PWA 앱 정보)
   7. dist/sw.js 생성 (Service Worker, 모든 dist 파일 자동 캐시)
   
   실행: node build.js  (또는 npm run build)
   결과: dist/ 폴더가 곧 GitHub Pages 에 올릴 내용.
   ============================================ */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
// ★ Day 28 — GitHub Pages 가 main 브랜치의 /docs 폴더만 source 로 인식하므로 docs 사용
const DIST = path.join(ROOT, 'docs');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SRC_DIR = path.join(ROOT, 'src');

// ── 1. docs 초기화 ──────────────────────────────────────────
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });
console.log('✓ docs/ 초기화');

// ── 2. public/* → docs/* 복사 ──────────────────────────────
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}
copyDir(PUBLIC_DIR, DIST);
console.log('✓ public/ → docs/ 복사');

// ── 3. src → docs/src 복사 ─────────────────────────────────
copyDir(SRC_DIR, path.join(DIST, 'src'));
console.log('✓ src/ → docs/src/ 복사');

// ── 4. docs/index.html 수정 (절대경로 → 상대경로 + PWA 태그) ─
const indexPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// /src/main.js → ./src/main.js (GitHub Pages subpath 대응)
html = html.replace('src="/src/main.js"', 'src="./src/main.js"');

// PWA 메타 + manifest + Service Worker 등록 스크립트 삽입 (</head> 직전)
const pwaHead = `
  <!-- ★ Day 28 — PWA (홈 화면 추가 + 오프라인 작동) -->
  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png" />
  <link rel="apple-touch-icon" href="./icon-192.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="꿈낚시" />
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(() => console.log('[PWA] Service Worker 등록 성공'))
          .catch(e => console.warn('[PWA] Service Worker 등록 실패:', e));
      });
    }
  </script>
`;
html = html.replace('</head>', pwaHead + '</head>');
fs.writeFileSync(indexPath, html);
console.log('✓ docs/index.html 수정 (상대경로 + PWA 태그 삽입)');

// ── 5. manifest.webmanifest 생성 ───────────────────────────
const manifest = {
  name: '낭만꿈낚시',
  short_name: '꿈낚시',
  description: '코지 슬롯 낚시 게임 — Dreamreel',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#050813',
  theme_color: '#050813',
  lang: 'ko',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
fs.writeFileSync(
  path.join(DIST, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2)
);
console.log('✓ docs/manifest.webmanifest 생성');

// ── 6. Service Worker (sw.js) 생성 ──────────────────────────
// 캐시할 파일 목록 자동 추출 (dist 의 모든 파일 + './')
function walkFiles(dir, base = '') {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      out.push(...walkFiles(path.join(dir, ent.name), rel));
    } else {
      // sw.js 자신은 캐시 목록에서 제외 (자동 갱신을 위해)
      if (ent.name !== 'sw.js') out.push(`./${rel}`);
    }
  }
  return out;
}
const filesToCache = ['./', ...walkFiles(DIST)];
const cacheVersion = `dreamfish-${Date.now()}`;

const swCode = `/* ★ Day 28 — Service Worker (자동 생성). 빌드 시 캐시 목록 갱신됨. */
const CACHE_NAME = '${cacheVersion}';
const FILES_TO_CACHE = ${JSON.stringify(filesToCache, null, 2)};

// install: 모든 정적 자산 캐시 (오프라인 작동을 위한 핵심)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// activate: 이전 버전 캐시 삭제
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// fetch: 캐시 우선 → 없으면 네트워크 (오프라인 우선 전략)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached))
  );
});
`;
fs.writeFileSync(path.join(DIST, 'sw.js'), swCode);
console.log(`✓ docs/sw.js 생성 (캐시 ${filesToCache.length}개 파일, version: ${cacheVersion})`);

// ── 7. .nojekyll 파일 생성 (GitHub Pages 의 Jekyll 처리 비활성화) ─
// Jekyll 은 underscore(_) 로 시작하는 파일을 무시함 → _stub.css, _stub-helper.js 등이 404 가 되는 문제 해결.
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log('✓ docs/.nojekyll 생성 (Jekyll 비활성화)');

// ── 완료 ─────────────────────────────────────────────────
console.log('');
console.log('✅ 빌드 완료! docs/ 폴더가 만들어졌습니다.');
console.log(`   이제 GitHub Desktop 에서 commit + push 하세요.`);
console.log(`   사이트 주소 (Pages 활성화 후): https://rose413ven-svg.github.io/dreamfish/`);
