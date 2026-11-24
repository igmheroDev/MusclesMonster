#!/usr/bin/env node
'use strict';

/**
 * PR evidence: 2D detail (3 modes × front/back) at iPhone 13 / Pixel 5,
 * zoomed edge crop, and 3D growth + tapped Korean muscle tip.
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
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
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

async function seedPage(page, workouts) {
  await page.addInitScript((payload) => {
    localStorage.clear();
    localStorage.setItem('recovr_workouts_v1', JSON.stringify(payload.workouts));
    localStorage.setItem('recovr_settings_v1', JSON.stringify({
      recoveryHours: 48, theme: 'dark',
    }));
    localStorage.setItem('recovr_theme_v1', 'dark');
    localStorage.setItem('recovr_heatmap_data_mode', 'growth');
    localStorage.setItem('recovr_bodymap_view_mode', '3d');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register = () => Promise.resolve({ uninstall: () => {} });
    }
  }, { workouts });
}

async function openDetail(page, mode, view) {
  const modeMap = { recovery: '회복', growth: '성장', loss: '손실' };
  const modeBtn = page.locator(`[data-hmt-mode="${mode}"], button:has-text("${modeMap[mode]}")`).first();
  await modeBtn.tap();
  await page.waitForTimeout(500);
  const openBtn = page.locator('[data-hbmd-open], button:has-text("자세히 보기")').first();
  await openBtn.waitFor({ state: 'visible', timeout: 15000 });
  await openBtn.tap();
  await page.waitForSelector('#hbmdOverlay.show', { timeout: 10000 });
  await page.waitForTimeout(350);
  await page.locator(`[data-hbmd-view="${view}"]`).first().tap();
  await page.waitForTimeout(400);
}

async function capture2d(prefix, deviceName, base, workouts) {
  const device = devices[deviceName];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...device, locale: 'ko-KR' });
  const page = await context.newPage();
  await seedPage(page, workouts);
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2800);
  for (const sel of ['button:has-text("시작")', 'button:has-text("닫기")']) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.tap({ timeout: 800 }); } catch (e) { /* */ }
    }
  }

  const tag = deviceName.replace(/\s+/g, '');
  const combos = [
    ['recovery', 'front'], ['recovery', 'back'],
    ['growth', 'front'], ['growth', 'back'],
    ['loss', 'front'], ['loss', 'back'],
  ];
  for (const [mode, view] of combos) {
    const overlay = page.locator('#hbmdOverlay.show');
    if (await overlay.count()) {
      await page.locator('[data-hbmd-close]').first().tap();
      await page.waitForTimeout(300);
    }
    await openDetail(page, mode, view);
    const file = path.join(OUT, `${prefix}-${mode}-${view}-${tag}.png`);
    await page.locator('#hbmdOverlay .hbmd-sheet').screenshot({ path: file });
    console.log('2D', file);

    if (mode === 'recovery' && view === 'front') {
      const map = page.locator('.hbmd-svg').first();
      const box = await map.boundingBox();
      if (box) {
        // Chest/shoulder edge crop
        const crop = await page.screenshot({
          path: path.join(OUT, `${prefix}-edge-zoom-chest-${tag}.png`),
          clip: {
            x: box.x + box.width * 0.22,
            y: box.y + box.height * 0.18,
            width: box.width * 0.56,
            height: box.height * 0.22,
          },
        });
        void crop;
        console.log('EDGE zoom chest', tag);
      }
    }
  }
  await browser.close();
}

async function capture3d(deviceName, base, workouts) {
  const device = devices[deviceName];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...device, locale: 'ko-KR' });
  const page = await context.newPage();
  await seedPage(page, workouts);
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  for (const sel of ['button:has-text("시작")', 'button:has-text("닫기")']) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.tap({ timeout: 800 }); } catch (e) { /* */ }
    }
  }

  // Growth mode tab (home 3D-only shared host)
  await page.locator('[data-hmt-mode="growth"], button:has-text("성장")').first().tap();
  await page.waitForTimeout(1000);

  const host = page.locator('#h3dSharedHost');
  await host.waitFor({ state: 'visible', timeout: 20000 });
  const stage = host.locator('.bm3-stage canvas, canvas').first();
  await stage.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(6000);

  const tag = deviceName.replace(/\s+/g, '');
  const growthShot = path.join(OUT, `after-3d-growth-${tag}.png`);
  // Host + chrome (legend / tip) — viewport clip around host
  const hostBox = await host.boundingBox();
  if (hostBox) {
    await page.screenshot({
      path: growthShot,
      clip: {
        x: Math.max(0, hostBox.x - 8),
        y: Math.max(0, hostBox.y - 56),
        width: Math.min(device.viewport.width, hostBox.width + 16),
        height: Math.min(device.viewport.height, hostBox.height + 72),
      },
    });
  } else {
    await page.screenshot({ path: growthShot, fullPage: false });
  }
  console.log('3D growth', growthShot);

  const box = await stage.boundingBox();
  if (box) {
    // Try a few tap points until tip appears
    const points = [
      [0.50, 0.36], [0.42, 0.40], [0.58, 0.40], [0.50, 0.48], [0.35, 0.32],
    ];
    let tipText = '';
    for (const [px, py] of points) {
      await page.touchscreen.tap(box.x + box.width * px, box.y + box.height * py);
      await page.waitForTimeout(700);
      const tip = page.locator('.bm3-tip.visible').first();
      if (await tip.count()) {
        tipText = ((await tip.textContent()) || '').trim();
        if (tipText) break;
      }
    }
    const tapped = path.join(OUT, `after-3d-growth-tapped-ko-${tag}.png`);
    const hb = await host.boundingBox();
    if (hb) {
      await page.screenshot({
        path: tapped,
        clip: {
          x: Math.max(0, hb.x - 8),
          y: Math.max(0, hb.y - 56),
          width: Math.min(device.viewport.width, hb.width + 16),
          height: Math.min(device.viewport.height, hb.height + 72),
        },
      });
    } else {
      await page.screenshot({ path: tapped, fullPage: false });
    }
    console.log('3D tapped', tapped, 'tip=', tipText);
    fs.writeFileSync(
      path.join(OUT, `after-3d-tip-${tag}.txt`),
      tipText || '(no tip text captured)'
    );
  }

  await browser.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const workouts = buildSeedWorkouts();
  const { server, base } = await startServer();
  console.log('server', base);
  const prefix = process.env.SHOT_PREFIX || 'after';
  try {
    for (const device of ['iPhone 13', 'Pixel 5']) {
      await capture2d(prefix, device, base, workouts);
      if (prefix === 'after') {
        try {
          await capture3d(device, base, workouts);
        } catch (err) {
          console.error('3D capture failed for', device, err.message || err);
        }
      }
    }
    console.log('DONE prefix=', prefix);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
