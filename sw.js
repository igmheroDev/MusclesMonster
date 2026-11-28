// RECOVR Service Worker - 오프라인 캐싱
const CACHE_NAME = 'recovr-cache-v99';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './userProfile.js',
  './workoutUtils.js',
  './durationTimer.js',
  './durationAutoSave.js',
  './restTimer.js',
  './wakeLock.js',
  './pullRefreshGuard.js',
  './appResume.js',
  './logList.js',
  './pwaUpdate.js',
  './workoutGoals.js',
  './muscleHeatmap.js',
  './exerciseMuscleMap.js',
  './exerciseStimHeatmap.js',
  './bodyMap3d.js',
  './bodyMapLive.js',
  './workoutCompleteMap.js',
  './vendor/three.module.min.js',
  './vendor/GLTFLoader.js',
  './vendor/BufferGeometryUtils.js',
  './vendor/three.LICENSE.txt',
  './vendor/MODEL_SOURCE.md',
  './vendor/anatomy/muscles-body.glb',
  './vendor/anatomy/KEY_TO_APP.json',
  './vendor/anatomy/ATTRIBUTION.txt',
  './body-map-front.png',
  './body-map-back.png',
  './body-map-front-dark.png',
  './body-map-back-dark.png',
  './body-mask-front.png',
  './body-mask-back.png',
  './cardioTracker.js',
  './cardioMetrics.js',
  './backupStorage.js',
  './backupWriter.js',
  './backupReconnect.js',
  './backupOnComplete.js',
  './recommendation.js',
  './workoutAdvice.js',
  './homeStatusSummary.js',
  './homeCoachInsight.js',
  './aiCoachFallback.js',
  './aiCoach.js',
  './dailyMission.js',
  './exercisePicker.js',
  './microAnim.js',
  './celebrateFx.js',
  './comboFx.js',
  './hypeFx.js',
  './muscleGrowthTracker.js',
  './muscleGrowthDetail.js',
  './workoutCelebrateVideo.js',
  './assets/celebrate/chest.mp4',
  './assets/celebrate/chest-poster.jpg',
  './assets/celebrate/shoulder.mp4',
  './assets/celebrate/shoulder-poster.jpg',
  './assets/celebrate/biceps.mp4',
  './assets/celebrate/biceps-poster.jpg',
  './assets/celebrate/triceps.mp4',
  './assets/celebrate/triceps-poster.jpg',
  './assets/celebrate/forearms.mp4',
  './assets/celebrate/forearms-poster.jpg',
  './assets/celebrate/lats.mp4',
  './assets/celebrate/lats-poster.jpg',
  './assets/celebrate/traps.mp4',
  './assets/celebrate/traps-poster.jpg',
  './assets/celebrate/lower_back.mp4',
  './assets/celebrate/lower_back-poster.jpg',
  './assets/celebrate/abs.mp4',
  './assets/celebrate/abs-poster.jpg',
  './assets/celebrate/obliques.mp4',
  './assets/celebrate/obliques-poster.jpg',
  './assets/celebrate/quads.mp4',
  './assets/celebrate/quads-poster.jpg',
  './assets/celebrate/adductors.mp4',
  './assets/celebrate/adductors-poster.jpg',
  './assets/celebrate/glutes.mp4',
  './assets/celebrate/glutes-poster.jpg',
  './assets/celebrate/hamstrings.mp4',
  './assets/celebrate/hamstrings-poster.jpg',
  './assets/celebrate/calves.mp4',
  './assets/celebrate/calves-poster.jpg',
  './assets/celebrate/cardio.mp4',
  './assets/celebrate/cardio-poster.jpg',
  './youtubeSearchLink.js',
  './navTabHighlight.js',
  './heatmapModeTabs.js',
  './heatmap3dModes.js',
  './homeBodyMapDetail.js',
  './appBackStack.js',
  './prTrendDetail.js',
  './listQuickActions.js',
  './cardioListQuickActions.js',
  './trendChartQuickActions.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const NETWORK_FIRST_PATHS = [
  '/index.html',
  '/app.js',
  '/workoutUtils.js',
  '/durationTimer.js',
  '/durationAutoSave.js',
  '/restTimer.js',
  '/wakeLock.js',
  '/logList.js',
  '/pwaUpdate.js',
  '/workoutGoals.js',
  '/muscleHeatmap.js',
  '/exerciseMuscleMap.js',
  '/exerciseStimHeatmap.js',
  '/bodyMap3d.js',
  '/bodyMapLive.js',
  '/workoutCompleteMap.js',
  '/vendor/three.module.min.js',
  '/vendor/GLTFLoader.js',
  '/vendor/BufferGeometryUtils.js',
  '/vendor/anatomy/muscles-body.glb',
  '/vendor/anatomy/KEY_TO_APP.json',
  '/body-map-front.png',
  '/body-map-back.png',
  '/body-map-front-dark.png',
  '/body-map-back-dark.png',
  '/body-mask-front.png',
  '/body-mask-back.png',
  '/cardioTracker.js',
  '/cardioMetrics.js',
  '/userProfile.js',
  '/backupStorage.js',
  '/backupWriter.js',
  '/backupReconnect.js',
  '/backupOnComplete.js',
  '/recommendation.js',
  '/workoutAdvice.js',
  '/homeStatusSummary.js',
  '/homeCoachInsight.js',
  '/aiCoachFallback.js',
  '/aiCoach.js',
  '/dailyMission.js',
  '/exercisePicker.js',
  '/microAnim.js',
  '/celebrateFx.js',
  '/comboFx.js',
  '/hypeFx.js',
  '/muscleGrowthTracker.js',
  '/muscleGrowthDetail.js',
  '/workoutCelebrateVideo.js',
  '/youtubeSearchLink.js',
  '/navTabHighlight.js',
  '/heatmapModeTabs.js',
  '/heatmap3dModes.js',
  '/homeBodyMapDetail.js',
  '/appBackStack.js',
  '/prTrendDetail.js',
  '/listQuickActions.js',
  '/cardioListQuickActions.js',
  '/trendChartQuickActions.js',
  '/sw.js',
];

function isNetworkFirstRequest(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return NETWORK_FIRST_PATHS.some((p) => path.endsWith(p) || path === p || path.endsWith(p.slice(1)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 운동 완료 축하 영상: iOS Safari는 <video>에 Range 요청을 보내므로
// 캐시된 전체 파일에서 잘라 206으로 응답해야 오프라인에서도 재생된다.
function isCelebrateMedia(url) {
  return url.origin === self.location.origin && /\/assets\/celebrate\/[^/]+\.mp4$/.test(url.pathname);
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!m) return null;
  let start;
  let end;
  if (m[1] === '' && m[2] === '') return null;
  if (m[1] === '') {
    const suffix = parseInt(m[2], 10);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (!(start >= 0) || start > end || start >= size) return null;
  return { start, end };
}

async function rangeResponseFrom(response, rangeHeader) {
  const buf = await response.arrayBuffer();
  const size = buf.byteLength;
  const type = response.headers.get('Content-Type') || 'video/mp4';
  if (!rangeHeader) {
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
    });
  }
  const r = parseRange(rangeHeader, size);
  if (!r) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const chunk = buf.slice(r.start, r.end + 1);
  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': type,
      'Content-Length': String(chunk.byteLength),
      'Content-Range': `bytes ${r.start}-${r.end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

async function handleCelebrateMedia(request) {
  const range = request.headers.get('Range');
  const cache = await caches.open(CACHE_NAME);
  const key = request.url.split('#')[0];
  let cached = await cache.match(key, { ignoreSearch: true });
  if (!cached) {
    try {
      // Range 없이 전체 파일을 받아 캐시해 둔다 (206은 캐시 불가)
      const full = await fetch(key, { credentials: 'same-origin' });
      if (full && full.status === 200) {
        await cache.put(key, full.clone());
        cached = full;
      } else {
        return full;
      }
    } catch (e) {
      return new Response(null, { status: 504 });
    }
  }
  return rangeResponseFrom(cached, range);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isCelebrateMedia(url)) {
    event.respondWith(handleCelebrateMedia(event.request));
    return;
  }

  if (isNetworkFirstRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
