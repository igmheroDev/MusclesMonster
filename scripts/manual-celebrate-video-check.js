#!/usr/bin/env node
'use strict';
/**
 * 운동 완료 축하 영상 크로스체크 (수동 실행용)
 *   PW_PATH=<playwright 경로> CHROME=/usr/bin/google-chrome OUT=<폴더> node scripts/manual-celebrate-video-check.js [rootDir]
 * - iPhone 13(390) / Pixel 5(412), touch on
 * - 실제 저장 버튼 탭 → 영상 오버레이 1초/4초 스크린샷, 재생·문구 확인, 닫기 → 앱 정상 확인
 * - reduced-motion → 포스터+문구
 * - 서비스워커 설치 후 오프라인 재생(Range 206)
 * - 홈 3D 스크린샷 (main과 비교용)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const OUT = process.env.OUT || '/workspace/mm-crosscheck-shots/celebrate';
const TAG = process.env.TAG || 'branch';
const HOME_ONLY = !!process.env.HOME_ONLY;
const { chromium, devices } = require(process.env.PW_PATH || 'playwright');
fs.mkdirSync(OUT, { recursive: true });

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function seed() {
  const ex = (name, w, r, n = 4) => ({
    name, weight: w, reps: r, sets: n,
    setDetails: Array.from({ length: n }, () => ({ weight: w, reps: r, completed: true })),
  });
  const s = (d, list, w) => ({
    date: daysAgo(d), startTime: '19:00', duration: 60, type: 'upper', fatigue: 3,
    exercises: list, createdAt: new Date(Date.now() - d * 864e5 - 3600e3).toISOString(),
    updatedAt: new Date(Date.now() - d * 864e5 - 3600e3).toISOString(),
  });
  // 가슴: 4주간 꾸준 + 최근 과부하 → 성장 큼(라임)
  const out = [];
  [26, 23, 20, 17].forEach((d) => out.push(s(d, [ex('벤치 프레스', 60, 8), ex('랫 풀다운', 50, 10, 3)])));
  [12, 9, 6, 3].forEach((d) => out.push(s(d, [ex('벤치 프레스', 75, 8), ex('스쿼트', 80, 8, 3)])));
  return out;
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
        const headers = { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (m) {
          const start = m[1] ? +m[1] : 0;
          const end = m[2] ? Math.min(+m[2], data.length - 1) : data.length - 1;
          res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
          res.end(data.subarray(start, end + 1));
          return;
        }
        res.writeHead(200, { ...headers, 'Content-Length': data.length });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, base, dev, extra) {
  const ctx = await browser.newContext({
    ...devices[dev.device], ...(dev.viewport ? { viewport: dev.viewport } : {}), hasTouch: true, isMobile: true,
    serviceWorkers: extra && extra.sw ? 'allow' : 'block',
    reducedMotion: extra && extra.reduced ? 'reduce' : 'no-preference',
    locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'dark',
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((data) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('recovr_workouts_v1', JSON.stringify(data));
      localStorage.setItem('__seeded', '1');
    }
  }, seed());
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await sleep(1500);
  return { ctx, page, errors };
}

async function home3d(page, dev) {
  // 홈 3D 캔버스 대기 후 스크린샷
  const host = page.locator('#heatmapModeHost');
  await host.scrollIntoViewIfNeeded();
  await page.waitForSelector('#heatmapModeHost canvas', { timeout: 30000 }).catch(() => {});
  await sleep(5000);
  const file = path.join(OUT, `${dev.name}-${TAG}-home3d.png`);
  await host.screenshot({ path: file });
  await page.evaluate(() => window.scrollTo(0, 0));
  return file;
}

async function completeWorkout(page, exercises) {
  await page.evaluate((exs) => openModalWithPrefill({ type: 'upper', exercises: exs, title: '테스트' }), exercises);
  await sleep(500);
  // 세트 완료 체크
  await page.evaluate(() => document.querySelectorAll('#exerciseRows .set-check').forEach((c) => c.classList.add('checked')));
  await page.locator('#saveBtn').scrollIntoViewIfNeeded();
  await page.locator('#saveBtn').tap();
  await page.waitForSelector('#wcvOverlay', { timeout: 3000 });
}

async function state(page) {
  return page.evaluate(() => {
    const o = document.getElementById('wcvOverlay');
    if (!o) return { open: false };
    const v = o.querySelector('video');
    const t = o.querySelector('.wcv-text');
    return {
      open: true, scene: o.dataset.scene,
      currentTime: v ? v.currentTime : null, paused: v ? v.paused : null, videoHidden: v ? v.hidden : null,
      readyState: v ? v.readyState : null, muted: v ? v.muted : null,
      textShown: t.classList.contains('show'), textOpacity: getComputedStyle(t).opacity,
      big: o.querySelector('.wcv-big').textContent, kicker: o.querySelector('.wcv-kicker').textContent,
      color: getComputedStyle(o.querySelector('.wcv-big')).color,
      okVisible: !o.querySelector('.wcv-ok').hidden,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const { server, base } = await startServer();
  const report = { root: ROOT, tag: TAG, devices: {} };
  const devs = [{ name: 'iPhone13', device: 'iPhone 13' }, { name: 'Pixel5', device: 'Pixel 5', viewport: { width: 412, height: 869 } }];
  try {
    for (const dev of devs) {
      const r = (report.devices[dev.name] = {});
      const hp = await newPage(browser, base, dev);
      r.viewport = hp.page.viewportSize();
      r.home3d = await home3d(hp.page, dev);
      await hp.ctx.close();
      if (HOME_ONLY) continue;
      const { ctx, page, errors } = await newPage(browser, base, dev);

      await completeWorkout(page, [{ name: '벤치 프레스', weight: 80, reps: 8, sets: 4 }]);
      const t0 = Date.now();
      await sleep(1000 - (Date.now() - t0));
      r.at1s = await state(page);
      await page.screenshot({ path: path.join(OUT, `${dev.name}-overlay-1s.png`) });
      await sleep(4000 - (Date.now() - t0));
      r.at4s = await state(page);
      await page.screenshot({ path: path.join(OUT, `${dev.name}-overlay-4s.png`) });

      if (dev.name === 'iPhone13') {
        await page.locator('#wcvOverlay .wcv-skip').tap();
        r.closedBy = '건너뛰기 탭';
      } else {
        // 끝나고 1.5초 뒤 자동 닫힘 확인
        await page.waitForSelector('#wcvOverlay', { state: 'detached', timeout: 6000 });
        r.closedBy = 'auto';
        r.autoClosedAtMs = Date.now() - t0;
      }
      await sleep(400);
      r.afterClose = await page.evaluate(() => ({
        overlayGone: !document.getElementById('wcvOverlay'),
        wcmShown: !!document.querySelector('#wcmOverlay.show'),
        wcmTitle: (document.getElementById('wcmTitle') || {}).textContent || null,
      }));
      await page.screenshot({ path: path.join(OUT, `${dev.name}-after-close-wcm.png`) });
      // 기존 완료 요약 닫기 → 홈 정상
      await page.locator('#wcmOverlay .wcm-primary').tap().catch(() => {});
      await sleep(600);
      r.appAfter = await page.evaluate(() => ({
        wcmShown: !!document.querySelector('#wcmOverlay.show'),
        workouts: JSON.parse(localStorage.getItem('recovr_workouts_v1') || '[]').length,
        hasCanvas: !!document.querySelector('canvas'),
      }));
      await page.screenshot({ path: path.join(OUT, `${dev.name}-app-after.png`) });
      // 다시 기록 추가 모달 열고 닫기 (앱 정상 동작)
      await page.evaluate(() => openModal());
      await sleep(400);
      r.appAfter.modalOpens = await page.evaluate(() => document.getElementById('modalOverlay').classList.contains('show'));
      await page.evaluate(() => closeModal());
      await sleep(300);
      r.errors = errors.slice(0, 10);
      await ctx.close();

      // reduced motion: 포스터 + 문구 + 확인
      const rm = await newPage(browser, base, dev, { reduced: true });
      await completeWorkout(rm.page, [{ name: '스쿼트', weight: 100, reps: 6, sets: 4 }]);
      await sleep(700);
      r.reduced = await state(rm.page);
      await rm.page.screenshot({ path: path.join(OUT, `${dev.name}-reduced-motion.png`) });
      await rm.page.locator('#wcvOverlay .wcv-ok').tap();
      await sleep(300);
      r.reduced.closedOk = await rm.page.evaluate(() => !document.getElementById('wcvOverlay'));
      await rm.ctx.close();
    }

    if (!HOME_ONLY) {
      // 오프라인: SW 설치 → 오프라인 → 디버그 훅으로 재생
      const dev = devs[0];
      const sw = await newPage(browser, base, dev, { sw: true });
      await sw.page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
      });
      await sw.page.reload({ waitUntil: 'load' });
      await sleep(1500);
      const cached = await sw.page.evaluate(async () => {
        const keys = await caches.keys();
        const c = await caches.open(keys.find((k) => k.startsWith('recovr-cache')));
        const reqs = await c.keys();
        return { cache: keys, celebrate: reqs.map((r) => r.url).filter((u) => u.includes('/assets/celebrate/')).length, controlled: !!navigator.serviceWorker.controller };
      });
      await sw.ctx.setOffline(true);
      await sw.page.reload({ waitUntil: 'load' });
      await sleep(1500);
      const rangeProbe = await sw.page.evaluate(async () => {
        const r = await fetch('assets/celebrate/back.mp4', { headers: { Range: 'bytes=100-199' } });
        return { status: r.status, contentRange: r.headers.get('Content-Range'), len: (await r.arrayBuffer()).byteLength };
      });
      await sw.page.evaluate(() => WorkoutCelebrateVideo.show({ scene: 'back', pct: 0.9 }, { force: true }));
      await sleep(4000);
      const offline = await state(sw.page);
      await sw.page.screenshot({ path: path.join(OUT, 'iPhone13-offline-back-4s.png') });
      report.offline = { cached, rangeProbe, state: offline, errors: sw.errors.slice(0, 10) };
      await sw.ctx.close();
    }
  } finally {
    fs.writeFileSync(path.join(OUT, `report-${TAG}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    server.close();
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
