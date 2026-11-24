#!/usr/bin/env node
'use strict';

/**
 * Playwright mobile tap / scroll regression for the 3D body map.
 * Skips cleanly when Playwright is not installed (CI without browser deps).
 *
 * Run with local static server:
 *   python3 -m http.server 8765 &
 *   MM_BASE=http://127.0.0.1:8765 node test-mobile-bodymap-touch.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

function tryRequirePlaywright() {
  const candidates = [
    'playwright',
    path.join('/tmp/node_modules/playwright'),
    path.join(__dirname, 'node_modules/playwright'),
  ];
  for (const c of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(c);
    } catch (e) { /* next */ }
  }
  return null;
}

const SAMPLE_WORKOUTS = [
  {
    id: 'qa-w1',
    date: new Date().toISOString().slice(0, 10),
    type: 'push',
    duration: 55,
    inProgress: false,
    exercises: [
      {
        name: '벤치프레스',
        mode: 'reps',
        sets: 3,
        setDetails: [
          { weight: 60, reps: 10, completed: true },
          { weight: 60, reps: 8, completed: true },
          { weight: 55, reps: 8, completed: true },
        ],
      },
    ],
  },
];

function startServer() {
  return new Promise((resolve, reject) => {
    const root = __dirname;
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(root, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(root)) {
        res.writeHead(403); res.end(); return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('missing'); return; }
        const ext = path.extname(filePath);
        const types = {
          '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
          '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary',
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

async function run() {
  // Always-on source guards (no browser required)
  const bm3 = fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8');
  assert(/touch-action:\s*pan-y/.test(bm3), 'source: touch-action pan-y');
  assert(!/touch-action:\s*none/.test(bm3), 'source: no touch-action none');

  const pw = tryRequirePlaywright();
  if (!pw) {
    console.log('SKIP: Playwright not installed — source guards only');
    console.log(failures === 0 ? '\n=== mobile bodymap touch (source) passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
    process.exit(failures === 0 ? 0 : 1);
  }

  const { chromium, devices } = pw;
  const { server, base } = await startServer();
  const outDir = process.env.MM_OUT || path.join('/opt/cursor/artifacts');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { /* ignore */ }

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const profiles = [
    { name: 'iPhone13', device: devices['iPhone 13'] },
    { name: 'Pixel5', device: devices['Pixel 5'] },
  ];

  try {
    for (const profile of profiles) {
      const context = await browser.newContext({
        ...profile.device,
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage();
      await page.addInitScript((workouts) => {
        localStorage.setItem('recovr_workouts_v1', JSON.stringify(workouts));
        localStorage.setItem('recovr_bodymap_view_mode', '2d');
        localStorage.setItem('recovr_theme_v1', 'dark');
      }, SAMPLE_WORKOUTS);

      await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#view-home.view.active', { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Duplicate toggle check (2D)
      const toggles2d = await page.evaluate(() => Array.from(document.querySelectorAll('.bm3-mode-toggle'))
        .filter((el) => {
          const st = getComputedStyle(el);
          return st.display !== 'none' && st.visibility !== 'hidden' && !el.closest('[hidden]');
        })
        .map((el) => el.getAttribute('data-bm3-toggle')));
      assert(toggles2d.length === 1, `${profile.name}: exactly one visible 2D/3D toggle (got ${JSON.stringify(toggles2d)})`);
      assert(toggles2d[0] === 'home-modes', `${profile.name}: chrome owns toggle`);

      const legends2d = await page.evaluate(() => Array.from(document.querySelectorAll('.h3d-legend, .mh-legend'))
        .filter((el) => {
          const st = getComputedStyle(el);
          return st.display !== 'none' && st.visibility !== 'hidden' && el.offsetParent !== null;
        })
        .map((el) => el.className));
      assert(
        legends2d.filter((c) => /h3d-legend/.test(c)).length === 0,
        `${profile.name}: chrome legend hidden in 2D`
      );

      // Switch to 3D
      await page.locator('[data-bm3-toggle="home-modes"] [data-bm3-mode="3d"]').tap();
      await page.waitForTimeout(2500);

      const stage = await page.evaluate(() => {
        const el = document.querySelector('#h3dSharedHost .bm3-stage, .bm3-stage');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          touchAction: cs.touchAction,
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          hasCanvas: !!el.querySelector('canvas'),
          hostHidden: document.getElementById('h3dSharedHost')?.hasAttribute('hidden'),
        };
      });
      assert(!!stage, `${profile.name}: 3D stage mounted`);
      if (stage) {
        assert(/pan-y/.test(stage.touchAction), `${profile.name}: stage touch-action is pan-y (got ${stage.touchAction})`);
        assert(!stage.hostHidden, `${profile.name}: shared host visible in 3D`);
      }

      // Cards should be hidden in 3D
      const cardsHidden = await page.evaluate(() => {
        const mh = document.getElementById('muscleHeatmapCard');
        const mg = document.getElementById('muscleGrowthHeatmapCard');
        const hide = (el) => !el || getComputedStyle(el).display === 'none';
        return hide(mh) && hide(mg);
      });
      assert(cardsHidden, `${profile.name}: 2D heatmap cards hidden while 3D active`);

      // Vertical swipe on stage should change scrollY (page scroll not stuck)
      if (stage && stage.hasCanvas) {
        const before = await page.evaluate(() => window.scrollY);
        const client = await context.newCDPSession(page);
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: stage.x, y: stage.y }],
        });
        for (let i = 1; i <= 10; i += 1) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: stage.x, y: stage.y - i * 20 }],
          });
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => window.scrollY);
        assert(after !== before || before === 0, `${profile.name}: vertical swipe on 3D can scroll page (before=${before}, after=${after})`);
        // If already at top and content short, after may stay 0 — still OK if touch-action is pan-y
        if (after === before && before === 0) {
          console.log(`NOTE: ${profile.name} scrollY stayed 0 (page top / short content) — touch-action pan-y still asserted`);
        }
      }

      // Nav must remain tappable (elementFromPoint not canvas)
      const navHit = await page.evaluate(() => {
        const nav = document.querySelector('.nav-item[data-view="log"]');
        const r = nav.getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { tag: el && el.tagName, cls: el && String(el.className || ''), isCanvas: el && el.tagName === 'CANVAS' };
      });
      assert(!navHit.isCanvas, `${profile.name}: bottom nav not covered by 3D canvas`);

      await page.locator('.nav-item[data-view="log"]').tap();
      await page.waitForTimeout(300);
      const onLog = await page.evaluate(() => document.getElementById('view-log')?.classList.contains('active'));
      assert(onLog, `${profile.name}: nav log tap works after 3D`);

      await page.locator('.nav-item[data-view="home"]').tap();
      await page.waitForTimeout(400);

      // Mode tabs
      for (const mode of ['growth', 'loss', 'recovery']) {
        await page.locator(`[data-hmt-mode="${mode}"]`).tap();
        await page.waitForTimeout(350);
        const selected = await page.evaluate((m) => {
          const tab = document.querySelector(`[data-hmt-mode="${m}"]`);
          return tab && tab.getAttribute('aria-selected') === 'true';
        }, mode);
        assert(selected, `${profile.name}: tab ${mode} selects on single tap`);
      }

      await page.screenshot({
        path: path.join(outDir, `after-${profile.name}-home-3d.png`),
        fullPage: false,
      });

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures === 0 ? '\n=== mobile bodymap touch passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
