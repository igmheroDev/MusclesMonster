#!/usr/bin/env node
'use strict';

/**
 * PR #89 verification: 3× zoomed crops of 2D detail fills at 390px & 412px
 * for chest, delts, quads, adductors, calves, glutes, back.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = '/opt/cursor/artifacts';
const { chromium } = require('/tmp/pw-mod/node_modules/playwright');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildSeedWorkouts() {
  const sets = (w, r, n = 3) => Array.from({ length: n }, () => ({ weight: w, reps: r }));
  const session = (id, date, exercises) => ({
    id, date, type: 'mixed', duration: 55, inProgress: false,
    exercises: exercises.map((ex) => ({
      name: ex.name, mode: 'reps', sets: ex.sets.length,
      weight: ex.sets[0].weight, reps: ex.sets[0].reps,
      setDetails: ex.sets.map((s) => ({ ...s, completed: true })),
    })),
  });
  return [
    session('a', daysAgo(0), [
      { name: '벤치 프레스', sets: sets(70, 8) },
      { name: '스탠딩 카프 레이즈', sets: sets(60, 15) },
      { name: '백 스쿼트', sets: sets(100, 6) },
    ]),
    session('b', daysAgo(3), [
      { name: '케이블 어덕션', sets: sets(30, 12) },
      { name: '힙 쓰러스트', sets: sets(100, 10) },
      { name: '랫 풀다운', sets: sets(55, 10) },
    ]),
    session('c', daysAgo(35), [{ name: '레그 프레스', sets: sets(160, 10) }]),
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
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.glb': 'model/gltf-binary',
        };
        res.writeHead(200, {
          'Content-Type': types[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
    server.on('error', reject);
  });
}

/** Fractions of .hbmd-svg bbox → crop regions (viewBox 240×360). */
const CROPS = {
  front: {
    chest: { x: 0.30, y: 0.16, w: 0.40, h: 0.16 },
    delts: { x: 0.08, y: 0.16, w: 0.30, h: 0.16 },
    quads: { x: 0.28, y: 0.42, w: 0.44, h: 0.28 },
    adductors: { x: 0.36, y: 0.48, w: 0.28, h: 0.20 },
    calves: { x: 0.28, y: 0.64, w: 0.44, h: 0.30 },
  },
  back: {
    back: { x: 0.28, y: 0.12, w: 0.44, h: 0.28 },
    glutes: { x: 0.30, y: 0.42, w: 0.40, h: 0.16 },
    calves: { x: 0.28, y: 0.64, w: 0.44, h: 0.30 },
  },
};

async function dismissOnboarding(page) {
  for (const sel of ['button:has-text("시작")', 'button:has-text("닫기")']) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.tap({ timeout: 800 }); } catch (e) { /* */ }
    }
  }
}

async function openDetail(page, mode, view) {
  const modeMap = { recovery: '회복', growth: '성장', loss: '손실' };
  await page.locator(`[data-hmt-mode="${mode}"], button:has-text("${modeMap[mode]}")`).first().tap();
  await page.waitForTimeout(450);
  await page.locator('[data-hbmd-open], button:has-text("자세히 보기")').first().tap();
  await page.waitForSelector('#hbmdOverlay.show', { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.locator(`[data-hbmd-view="${view}"]`).first().tap();
  await page.waitForTimeout(400);
}

async function captureWidth(width, base, workouts) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
  });
  const page = await context.newPage();
  await page.addInitScript((payload) => {
    localStorage.clear();
    localStorage.setItem('recovr_workouts_v1', JSON.stringify(payload.workouts));
    localStorage.setItem('recovr_settings_v1', JSON.stringify({ recoveryHours: 48, theme: 'dark' }));
    localStorage.setItem('recovr_theme_v1', 'dark');
    localStorage.setItem('recovr_heatmap_data_mode', 'growth');
    localStorage.setItem('recovr_bodymap_view_mode', '3d');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register = () => Promise.resolve({ uninstall: () => {} });
    }
  }, { workouts });

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await dismissOnboarding(page);

  for (const view of ['front', 'back']) {
    const overlay = page.locator('#hbmdOverlay.show');
    if (await overlay.count()) {
      await page.locator('[data-hbmd-close]').first().tap();
      await page.waitForTimeout(250);
    }
    await openDetail(page, 'growth', view);
    const map = page.locator('.hbmd-svg').first();
    await map.waitFor({ state: 'visible', timeout: 10000 });
    const box = await map.boundingBox();
    if (!box) continue;

    const sheet = path.join(OUT, `pr89-sheet-growth-${view}-${width}.png`);
    await page.locator('#hbmdOverlay .hbmd-sheet').screenshot({ path: sheet });
    console.log('sheet', sheet);

    for (const [name, frac] of Object.entries(CROPS[view])) {
      const clip = {
        x: box.x + box.width * frac.x,
        y: box.y + box.height * frac.y,
        width: box.width * frac.w,
        height: box.height * frac.h,
      };
      const file = path.join(OUT, `pr89-zoom-${view}-${name}-${width}.png`);
      await page.screenshot({ path: file, clip });
      console.log('zoom', file);
    }
  }

  // Loading string smoke: force loading node text if present in DOM template
  const loadingCheck = await page.evaluate(() => {
    const src = document.documentElement.innerHTML;
    return {
      hasKo: src.includes('3D 해부학') || !!document.querySelector('.bm3-loading'),
    };
  });
  fs.writeFileSync(path.join(OUT, `pr89-loading-check-${width}.json`), JSON.stringify(loadingCheck));

  await browser.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const workouts = buildSeedWorkouts();
  const { server, base } = await startServer();
  console.log('server', base);
  try {
    for (const w of [390, 412]) {
      await captureWidth(w, base, workouts);
    }
    console.log('DONE zoom crops');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
