#!/usr/bin/env node
'use strict';

/**
 * Manual evidence: HomeBodyMapDetail 3 modes × front/back
 * on iPhone 13 + Pixel 5 with seeded localStorage workouts.
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
    id,
    date,
    type: 'mixed',
    duration: 50 + (exercises.length * 5),
    inProgress: false,
    exercises: exercises.map((ex) => ({
      name: ex.name,
      mode: 'reps',
      sets: ex.sets.length,
      weight: ex.sets[0].weight,
      reps: ex.sets[0].reps,
      setDetails: ex.sets.map((s) => ({ ...s, completed: true })),
    })),
  };
}

/** Realistic seed matching owner screenshot pattern + growth/loss signals */
function buildSeedWorkouts() {
  const sets = (w, r, n = 3) => Array.from({ length: n }, () => ({ weight: w, reps: r }));
  return [
    // Today: back + chest (fatigued) — mirrors owner phone
    session('seed-today', daysAgo(0), [
      { name: '랫 풀다운', sets: sets(60, 10) },
      { name: '시티드 케이블 로우', sets: sets(55, 10) },
      { name: '벤치 프레스', sets: sets(70, 8) },
    ]),
    // 2 days ago: arms
    session('seed-arms', daysAgo(2), [
      { name: '바벨 컬', sets: sets(30, 10) },
      { name: '케이블 푸시다운', sets: sets(25, 12) },
    ]),
    // Progressive chest overload for growth (≥1.5%)
    session('seed-chest-r1', daysAgo(5), [{ name: '벤치 프레스', sets: sets(72, 8) }]),
    session('seed-chest-r2', daysAgo(8), [{ name: '벤치 프레스', sets: sets(68, 8) }]),
    session('seed-chest-r3', daysAgo(12), [{ name: '인클라인 벤치 프레스', sets: sets(55, 10) }]),
    session('seed-chest-r4', daysAgo(16), [{ name: '벤치 프레스', sets: sets(65, 8) }]),
    session('seed-chest-r5', daysAgo(20), [{ name: '덤벨 벤치 프레스', sets: sets(28, 10) }]),
    session('seed-chest-r6', daysAgo(24), [{ name: '벤치 프레스', sets: sets(60, 8) }]),
    // Shoulder growth around 1.5%
    session('seed-sh1', daysAgo(4), [{ name: '오버헤드 프레스', sets: sets(40, 8) }]),
    session('seed-sh2', daysAgo(11), [{ name: '오버헤드 프레스', sets: sets(38, 8) }]),
    session('seed-sh3', daysAgo(18), [{ name: '사이드 레터럴 레이즈', sets: sets(12, 12) }]),
    // Hamstrings / glutes ready
    session('seed-ham', daysAgo(7), [
      { name: '루마니안 데드리프트', sets: sets(80, 8) },
      { name: '힙 쓰러스트', sets: sets(100, 10) },
    ]),
    session('seed-add', daysAgo(7), [{ name: '케이블 어덕션', sets: sets(30, 12) }]),
    session('seed-calf', daysAgo(9), [{ name: '스탠딩 카프 레이즈', sets: sets(60, 15) }]),
    // Quads loss — last trained ~35 days ago
    session('seed-quads-old', daysAgo(35), [
      { name: '백 스쿼트', sets: sets(100, 6) },
      { name: '레그 프레스', sets: sets(160, 10) },
    ]),
    // Older back volume for growth comparison window
    session('seed-back-old1', daysAgo(10), [{ name: '랫 풀다운', sets: sets(55, 10) }]),
    session('seed-back-old2', daysAgo(17), [{ name: '풀업', sets: sets(0, 8) }]),
  ];
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403); res.end(); return;
      }
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

async function openDetail(page, mode, view) {
  // Ensure home tab
  const homeTab = page.locator('.nav-item[data-tab="home"], [data-tab="home"], button:has-text("홈")').first();
  if (await homeTab.count()) {
    try { await homeTab.tap({ timeout: 2000 }); } catch (e) { /* already home */ }
  }
  await page.waitForTimeout(400);

  // Mode tab
  const modeMap = { recovery: '회복', growth: '성장', loss: '손실' };
  const modeBtn = page.locator(`[data-hmt-mode="${mode}"], button:has-text("${modeMap[mode]}")`).first();
  await modeBtn.tap();
  await page.waitForTimeout(500);

  // Open detail
  const openBtn = page.locator('[data-hbmd-open], button:has-text("자세히 보기")').first();
  await openBtn.waitFor({ state: 'visible', timeout: 10000 });
  await openBtn.tap();
  await page.waitForSelector('#hbmdOverlay.show', { timeout: 8000 });
  await page.waitForTimeout(350);

  // Front/back
  const viewBtn = page.locator(`[data-hbmd-view="${view}"]`).first();
  await viewBtn.tap();
  await page.waitForTimeout(400);
}

async function captureDevice(deviceName, base) {
  const device = devices[deviceName];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...device,
    locale: 'ko-KR',
  });
  const page = await context.newPage();
  const workouts = buildSeedWorkouts();

  await page.addInitScript((payload) => {
    localStorage.clear();
    localStorage.setItem('recovr_workouts_v1', JSON.stringify(payload.workouts));
    localStorage.setItem('recovr_settings_v1', JSON.stringify({
      recoveryHours: 48,
      theme: 'dark',
    }));
    localStorage.setItem('recovr_theme_v1', 'dark');
    localStorage.setItem('recovr_heatmap_data_mode', 'recovery');
    // Prefer skipping SW to avoid stale cache during evidence capture
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register = () => Promise.resolve({ uninstall: () => {} });
    }
  }, { workouts });

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  // Dismiss any onboarding if present
  for (const sel of ['button:has-text("시작")', 'button:has-text("닫기")', '[data-dismiss]']) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.tap({ timeout: 800 }); } catch (e) { /* ignore */ }
    }
  }

  const tag = deviceName.replace(/\s+/g, '');
  const combos = [
    ['recovery', 'front'],
    ['recovery', 'back'],
    ['growth', 'front'],
    ['growth', 'back'],
    ['loss', 'front'],
    ['loss', 'back'],
  ];

  const results = [];
  for (const [mode, view] of combos) {
    // Close prior overlay if open
    const overlay = page.locator('#hbmdOverlay.show');
    if (await overlay.count()) {
      await page.locator('[data-hbmd-close]').first().tap();
      await page.waitForTimeout(300);
    }
    await openDetail(page, mode, view);

    // Assert selection belongs to side
    const detailName = await page.locator('.hbmd-detail-name').first().textContent();
    const selectedCard = (detailName || '').trim();

    const file = path.join(OUT, `after-${mode}-${view}-${tag}.png`);
    await page.locator('#hbmdOverlay .hbmd-sheet').screenshot({ path: file });
    console.log('SHOT', file, 'selected=', selectedCard);

    // Quick DOM checks
    const svg = await page.locator('.hbmd-svg').innerHTML();
    const backPaths = (svg.match(/data-muscle="back"/g) || []).length;
    const hasGluteLabel = svg.includes('data-label-id="glutes"') || svg.includes('둔근');
    results.push({
      device: deviceName, mode, view, file, selectedCard, backPaths, hasGluteLabel,
    });
  }

  // Touch smoke: tap a region on recovery back
  await page.locator('[data-hbmd-close]').first().tap().catch(() => {});
  await openDetail(page, 'recovery', 'back');
  const region = page.locator('.hbmd-svg [data-muscle="back"]').first();
  const box = await region.boundingBox();
  if (box) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
  }
  const afterTap = (await page.locator('.hbmd-detail-name').first().textContent() || '').trim();
  console.log('TOUCH select back region →', afterTap);
  results.push({ device: deviceName, touchSelect: afterTap });

  await browser.close();
  return results;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, base } = await startServer();
  console.log('server', base);
  try {
    const all = [];
    for (const device of ['iPhone 13', 'Pixel 5']) {
      const rows = await captureDevice(device, base);
      all.push(...rows);
    }
    fs.writeFileSync(path.join(OUT, 'hbmd-manual-results.json'), JSON.stringify(all, null, 2));
    console.log('DONE', all.length, 'entries');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
