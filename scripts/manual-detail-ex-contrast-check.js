#!/usr/bin/env node
'use strict';
/**
 * 자세히 보기 추천 운동 + 3D 명암 + 뒤로가기 크로스체크
 *   PW_PATH=... CHROME=/usr/bin/google-chrome OUT=... node scripts/manual-detail-ex-contrast-check.js
 * iPhone 13 390px / Pixel 5 412px, touch on
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const OUT = process.env.OUT || '/workspace/mm-crosscheck-shots/detail-ex-contrast';
const { chromium, devices } = require(process.env.PW_PATH || 'playwright');
fs.mkdirSync(OUT, { recursive: true });

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function seed() {
  const sets = (w, r, n = 3) => Array.from({ length: n }, () => ({ weight: w, reps: r, completed: true }));
  const ex = (name, w, r, n = 3) => ({
    name, mode: 'reps', sets: n, weight: w, reps: r,
    setDetails: sets(w, r, n),
  });
  const session = (id, date, exercises) => ({
    id, date, type: 'mixed', duration: 55, inProgress: false,
    exercises,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  });
  return [
    session('seed-today', daysAgo(0), [ex('랫 풀다운', 60, 10), ex('시티드 케이블 로우', 55, 10), ex('벤치 프레스', 70, 8)]),
    session('seed-arms', daysAgo(2), [ex('바벨 컬', 30, 10), ex('케이블 푸시다운', 25, 12)]),
    session('seed-chest-r1', daysAgo(5), [ex('벤치 프레스', 72, 8)]),
    session('seed-chest-r2', daysAgo(8), [ex('벤치 프레스', 68, 8)]),
    session('seed-chest-r3', daysAgo(12), [ex('인클라인 벤치 프레스', 55, 10)]),
    session('seed-chest-r4', daysAgo(16), [ex('벤치 프레스', 65, 8)]),
    session('seed-sh1', daysAgo(4), [ex('오버헤드 프레스', 40, 8)]),
    session('seed-ham', daysAgo(7), [ex('루마니안 데드리프트', 80, 8), ex('힙 쓰러스트', 100, 10)]),
    session('seed-core', daysAgo(1), [ex('플랭크', 0, 30, 3), ex('크런치', 0, 15, 3)]),
    session('seed-quads-old', daysAgo(35), [ex('백 스쿼트', 100, 6)]),
  ];
}

function startServer() {
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary',
    '.mp4': 'video/mp4', '.txt': 'text/plain', '.md': 'text/plain',
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('missing'); return; }
        const headers = { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
        res.writeHead(200, { ...headers, 'Content-Length': data.length });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hardwareBack(page) {
  // Same-document History API: page.goBack() can no-op. This matches Android back.
  await page.evaluate(() => { history.back(); });
}

async function waitFor(page, fn, timeout = 4000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await sleep(80);
  }
  return last;
}

async function newPage(browser, base, dev) {
  const ctx = await browser.newContext({
    ...devices[dev.device],
    ...(dev.viewport ? { viewport: dev.viewport } : {}),
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    colorScheme: 'dark',
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((data) => {
    localStorage.setItem('recovr_workouts_v1', JSON.stringify(data));
    localStorage.setItem('recovr_bodymap_view_mode', '3d');
  }, seed());
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await sleep(800);
  return { ctx, page, errors };
}

async function overlayState(page) {
  return page.evaluate(() => {
    const shown = (id) => {
      const el = document.getElementById(id);
      return !!(el && el.classList.contains('show'));
    };
    const exit = document.getElementById('appBackExitOverlay');
    const list = document.querySelector('#eshMuscleOverlay .esh-ex-list, #eshMuscleOverlay .esh-sheet');
    const title = document.querySelector('#eshMuscleOverlay .esh-sheet-title');
    const view = (document.querySelector('.view.active') || {}).id || null;
    return {
      hbmd: shown('hbmdOverlay'),
      eshMuscle: shown('eshMuscleOverlay'),
      eshExercise: shown('eshExerciseOverlay'),
      modal: shown('modalOverlay'),
      exPicker: shown('exPickerOverlay'),
      exit: !!(exit && exit.classList.contains('show')),
      exitText: exit ? (exit.innerText || '').replace(/\s+/g, ' ').trim() : '',
      exerciseTitle: title ? title.textContent.trim() : '',
      exerciseCount: list ? list.querySelectorAll('.esh-ex-item, [data-ex], button, .esh-list-item, li').length : 0,
      view,
      abs: typeof AppBackStack !== 'undefined',
    };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const { server, base } = await startServer();
  const report = { root: ROOT, out: OUT, devices: {} };
  const devs = [
    { name: 'iPhone13', device: 'iPhone 13' },
    { name: 'Pixel5', device: 'Pixel 5', viewport: { width: 412, height: 869 } },
  ];
  let failed = 0;
  try {
    for (const dev of devs) {
      const r = (report.devices[dev.name] = { checks: [] });
      const { ctx, page, errors } = await newPage(browser, base, dev);
      r.viewport = page.viewportSize();
      r.touch = true;

      const host = page.locator('#heatmapModeHost');
      await host.scrollIntoViewIfNeeded();
      await page.waitForSelector('#heatmapModeHost canvas', { timeout: 30000 });
      await sleep(4500);
      const after3d = path.join(OUT, `${dev.name}-3d-after.png`);
      await host.screenshot({ path: after3d });
      r.after3d = after3d;
      await page.screenshot({ path: path.join(OUT, `${dev.name}-home.png`) });

      const btn = page.locator('[data-hbmd-open], .hbmd-open-btn').first();
      await btn.scrollIntoViewIfNeeded();
      await btn.tap();
      await page.waitForSelector('#hbmdOverlay.show', { timeout: 8000 });
      await sleep(400);
      await page.screenshot({ path: path.join(OUT, `${dev.name}-detail-list.png`) });
      let st = await overlayState(page);
      r.checks.push({ name: 'detail opens', ok: st.hbmd && !st.eshMuscle });

      const core = page.locator('#hbmdOverlay [data-hbmd-muscle="core"]').first();
      await core.scrollIntoViewIfNeeded();
      await core.tap();
      await page.waitForSelector('#eshMuscleOverlay.show', { timeout: 8000 });
      await sleep(400);
      await page.screenshot({ path: path.join(OUT, `${dev.name}-detail-exercises.png`) });
      st = await overlayState(page);
      const exOk = st.hbmd && st.eshMuscle && (st.exerciseCount > 0 || /코어|운동/.test(st.exerciseTitle));
      r.checks.push({ name: 'list tap shows exercises', ok: exOk, state: st });
      if (!exOk) failed += 1;

      const beforeBack = await page.evaluate(() => ({
        abs: typeof AppBackStack !== 'undefined',
        armed: typeof AppBackStack !== 'undefined' && AppBackStack.isOverlayTrapArmed(),
        state: history.state,
        len: history.length,
      }));
      r.absBeforeBack = beforeBack;
      await hardwareBack(page);
      st = await waitFor(page, async () => {
        const s = await overlayState(page);
        return (s.hbmd && !s.eshMuscle) ? s : null;
      }) || await overlayState(page);
      r.checks.push({ name: 'back closes exercise sheet, detail stays', ok: st.hbmd && !st.eshMuscle, state: st, abs: beforeBack });
      if (!(st.hbmd && !st.eshMuscle)) failed += 1;
      await page.screenshot({ path: path.join(OUT, `${dev.name}-back-detail-remains.png`) });

      await hardwareBack(page);
      st = await waitFor(page, async () => {
        const s = await overlayState(page);
        return (!s.hbmd && !s.eshMuscle) ? s : null;
      }) || await overlayState(page);
      r.checks.push({ name: 'back closes detail', ok: !st.hbmd && !st.eshMuscle, state: st });
      if (st.hbmd) failed += 1;

      await page.evaluate(() => { if (typeof openModal === 'function') openModal(); });
      await page.waitForSelector('#modalOverlay.show', { timeout: 5000 });
      await sleep(300);
      st = await overlayState(page);
      // openModal() also opens the exercise picker (addExerciseRowAndPick)
      if (st.exPicker) {
        await hardwareBack(page);
        st = await waitFor(page, async () => {
          const s = await overlayState(page);
          return (s.modal && !s.exPicker) ? s : null;
        }) || await overlayState(page);
        r.checks.push({ name: 'back closes exercise picker first', ok: st.modal && !st.exPicker, state: st });
        if (!(st.modal && !st.exPicker)) failed += 1;
      }
      await hardwareBack(page);
      st = await waitFor(page, async () => {
        const s = await overlayState(page);
        return (!s.modal && !s.exPicker) ? s : null;
      }) || await overlayState(page);
      r.checks.push({ name: 'back closes workout modal', ok: !st.modal && !st.exPicker, state: st });
      if (st.modal || st.exPicker) failed += 1;

      await page.evaluate(() => { if (typeof switchView === 'function') switchView('log'); });
      await sleep(400);
      st = await overlayState(page);
      r.checks.push({ name: 'switched to log', ok: st.view === 'view-log', state: st });
      await hardwareBack(page);
      st = await waitFor(page, async () => {
        const s = await overlayState(page);
        return s.view === 'view-home' ? s : null;
      }) || await overlayState(page);
      r.checks.push({ name: 'back returns to home tab', ok: st.view === 'view-home', state: st });
      if (st.view !== 'view-home') failed += 1;

      await hardwareBack(page);
      st = await waitFor(page, async () => {
        const s = await overlayState(page);
        return (s.exit && s.exitText.includes('앱을 종료할까요?')) ? s : null;
      }) || await overlayState(page);
      r.checks.push({ name: 'root back shows exit confirm', ok: st.exit && st.exitText.includes('앱을 종료할까요?'), state: st });
      if (!(st.exit && st.exitText.includes('앱을 종료할까요?'))) failed += 1;
      await page.screenshot({ path: path.join(OUT, `${dev.name}-exit-confirm.png`) });

      await page.locator('#appBackExitOverlay [data-abs-cancel]').tap();
      await sleep(250);
      st = await overlayState(page);
      r.checks.push({ name: '취소 hides confirm, stays in app', ok: !st.exit && st.view === 'view-home', state: st });
      if (st.exit) failed += 1;
      await page.screenshot({ path: path.join(OUT, `${dev.name}-exit-cancel.png`) });

      r.errors = errors.slice(0, 12);
      if (errors.length) r.checks.push({ name: 'no page errors', ok: false, errors: r.errors });
      await ctx.close();
    }
  } finally {
    server.close();
    await browser.close();
  }
  const reportFile = path.join(OUT, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  const all = Object.values(report.devices).flatMap((d) => d.checks || []);
  const bad = all.filter((c) => !c.ok);
  console.log(JSON.stringify({ out: OUT, failed: bad.length, checks: all.map((c) => [c.name, c.ok]) }, null, 2));
  if (bad.length) {
    console.error('FAILED checks', JSON.stringify(bad, null, 2));
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
