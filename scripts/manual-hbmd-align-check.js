#!/usr/bin/env node
'use strict';

/**
 * Alignment evidence: overlays path strokes on the body outline and captures
 * front/back × 3 modes at 390px and 412px sheet widths.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = '/opt/cursor/artifacts';
const { chromium, devices } = require('/tmp/pw-mod/node_modules/playwright');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function session(id, date, exercises) {
  return {
    id, date, type: 'mixed', duration: 55, inProgress: false,
    exercises: exercises.map((ex) => ({
      name: ex.name, mode: 'reps', sets: ex.sets.length,
      weight: ex.sets[0].weight, reps: ex.sets[0].reps,
      setDetails: ex.sets.map((s) => ({ ...s, completed: true })),
    })),
  };
}

function buildSeedWorkouts() {
  const sets = (w, r, n = 3) => Array.from({ length: n }, () => ({ weight: w, reps: r }));
  return [
    session('a', daysAgo(0), [
      { name: '랫 풀다운', sets: sets(60, 10) },
      { name: '시티드 케이블 로우', sets: sets(55, 10) },
      { name: '벤치 프레스', sets: sets(70, 8) },
    ]),
    session('b', daysAgo(2), [
      { name: '바벨 컬', sets: sets(30, 10) },
      { name: '케이블 푸시다운', sets: sets(25, 12) },
    ]),
    session('c1', daysAgo(5), [{ name: '벤치 프레스', sets: sets(72, 8) }]),
    session('c2', daysAgo(8), [{ name: '벤치 프레스', sets: sets(68, 8) }]),
    session('c3', daysAgo(12), [{ name: '인클라인 벤치 프레스', sets: sets(55, 10) }]),
    session('c4', daysAgo(16), [{ name: '벤치 프레스', sets: sets(65, 8) }]),
    session('c5', daysAgo(20), [{ name: '덤벨 벤치 프레스', sets: sets(28, 10) }]),
    session('c6', daysAgo(24), [{ name: '벤치 프레스', sets: sets(60, 8) }]),
    session('s1', daysAgo(4), [{ name: '오버헤드 프레스', sets: sets(40, 8) }]),
    session('s2', daysAgo(11), [{ name: '오버헤드 프레스', sets: sets(38, 8) }]),
    session('s3', daysAgo(18), [{ name: '사이드 레터럴 레이즈', sets: sets(12, 12) }]),
    session('h', daysAgo(7), [
      { name: '루마니안 데드리프트', sets: sets(80, 8) },
      { name: '힙 쓰러스트', sets: sets(100, 10) },
    ]),
    session('ad', daysAgo(7), [{ name: '케이블 어덕션', sets: sets(30, 12) }]),
    session('cf', daysAgo(9), [{ name: '스탠딩 카프 레이즈', sets: sets(60, 15) }]),
    session('q', daysAgo(35), [
      { name: '백 스쿼트', sets: sets(100, 6) },
      { name: '레그 프레스', sets: sets(160, 10) },
    ]),
    session('bo1', daysAgo(10), [{ name: '랫 풀다운', sets: sets(55, 10) }]),
    session('bo2', daysAgo(17), [{ name: '풀업', sets: sets(0, 8) }]),
  ];
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('missing'); return; }
        const ext = path.extname(filePath);
        const types = {
          '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
          '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
          '.glb': 'model/gltf-binary',
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
    server.on('error', reject);
  });
}

async function openDetail(page, mode, view) {
  const modeMap = { recovery: '회복', growth: '성장', loss: '손실' };
  // Close any open sheet first — it blocks home mode tabs.
  const overlay = page.locator('#hbmdOverlay.show');
  if (await overlay.count()) {
    await page.locator('[data-hbmd-close]').first().tap({ force: true });
    await page.waitForSelector('#hbmdOverlay.show', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.locator(`[data-hmt-mode="${mode}"]`).first().tap({ force: true });
  await page.waitForTimeout(450);
  await page.locator('[data-hbmd-open]').first().tap({ force: true });
  await page.waitForSelector('#hbmdOverlay.show', { timeout: 8000 });
  await page.locator(`[data-hbmd-view="${view}"]`).first().tap({ force: true });
  await page.waitForTimeout(350);
}

async function injectOverlay(page) {
  // Bright path outlines with the SAME calibrate transform as fills, unmasked,
  // so yellow edges show true path geometry on top of the body art.
  return page.evaluate(() => {
    const svg = document.querySelector('#hbmdOverlay .hbmd-svg');
    if (!svg) return { ok: false };
    let g = svg.querySelector('[data-hbmd-align-overlay]');
    if (g) g.remove();
    const muscles = svg.querySelector('.hbmd-muscles');
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-hbmd-align-overlay', '1');
    g.setAttribute('pointer-events', 'none');
    // Match fill-layer transform so overlay tracks calibrated geometry.
    if (muscles && muscles.getAttribute('transform')) {
      g.setAttribute('transform', muscles.getAttribute('transform'));
    }
    (muscles ? muscles.querySelectorAll('path[data-muscle]') : []).forEach((p) => {
      const c = p.cloneNode(false);
      c.removeAttribute('style');
      c.removeAttribute('mask');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', '#ffff00');
      c.setAttribute('stroke-width', '1.6');
      c.setAttribute('stroke-opacity', '0.95');
      c.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(c);
    });
    svg.appendChild(g);
    const mask = svg.querySelector('mask');
    const musclesStyle = muscles ? (muscles.getAttribute('style') || '') : '';
    return {
      ok: true,
      hasSvgMask: !!(mask && muscles && muscles.getAttribute('mask')),
      maskUnits: mask ? mask.getAttribute('maskUnits') : null,
      maskContentUnits: mask ? mask.getAttribute('maskContentUnits') : null,
      cssMask: musclesStyle.includes('mask-image'),
      noMhSvg: !(svg.getAttribute('class') || '').includes('mh-svg'),
      hasPreserveAspectRatio: svg.getAttribute('preserveAspectRatio') === 'xMidYMid meet',
      fillTransform: muscles ? muscles.getAttribute('transform') : null,
      pathCount: muscles ? muscles.querySelectorAll('path[data-muscle]').length : 0,
    };
  });
}

async function runWidth(base, width, deviceName) {
  const device = devices[deviceName];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...device,
    viewport: { width, height: Math.max(device.viewport.height, 844) },
    deviceScaleFactor: 2,
    locale: 'ko-KR',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const workouts = buildSeedWorkouts();
  await page.addInitScript((payload) => {
    localStorage.clear();
    localStorage.setItem('recovr_workouts_v1', JSON.stringify(payload.workouts));
    localStorage.setItem('recovr_settings_v1', JSON.stringify({ recoveryHours: 48 }));
    localStorage.setItem('recovr_theme_v1', 'dark');
    localStorage.setItem('recovr_heatmap_data_mode', 'recovery');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register = () => Promise.resolve({});
    }
  }, { workouts });

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2200);

  // Force sheet/map width context via CSS for the overlay capture
  await page.addStyleTag({
    content: `.hbmd-sheet{width:${width}px !important;max-width:${width}px !important;}
      .hbmd-map-wrap{max-width:min(280px,${width - 28}px) !important;}`,
  });

  const tag = `${width}w`;
  const results = [];
  for (const mode of ['recovery', 'growth', 'loss']) {
    for (const view of ['front', 'back']) {
      await openDetail(page, mode, view);
      const meta = await injectOverlay(page);
      const file = path.join(OUT, `align-${mode}-${view}-${tag}-${deviceName.replace(/\s+/g, '')}.png`);
      await page.locator('#hbmdOverlay .hbmd-map-wrap').screenshot({ path: file });
      console.log('ALIGN', file, meta);
      results.push({ width, device: deviceName, mode, view, file, ...meta });
    }
  }
  await browser.close();
  return results;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, base } = await startServer();
  console.log('server', base);
  try {
    const all = [];
    // 390 ≈ iPhone 13 CSS width, 412 ≈ Pixel 5
    all.push(...await runWidth(base, 390, 'iPhone 13'));
    all.push(...await runWidth(base, 412, 'Pixel 5'));
    fs.writeFileSync(path.join(OUT, 'hbmd-align-results.json'), JSON.stringify(all, null, 2));
    const bad = all.filter((r) => !r.hasSvgMask || r.cssMask
      || r.maskUnits !== 'userSpaceOnUse' || r.maskContentUnits !== 'userSpaceOnUse'
      || r.noMhSvg === false || r.hasPreserveAspectRatio === false);
    if (bad.length) {
      console.error('MASK/VIEWBOX REGRESSION', bad);
      process.exit(1);
    }
    console.log('DONE', all.length);
  } finally {
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
