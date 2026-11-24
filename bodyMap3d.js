// ============================================================
// RECOVR - Experimental interactive 3D muscle body map
// Independent module. Lazy-loads vendored three.js + GLTFLoader.
// Anatomical model: vendor/anatomy/muscles-body.glb (CC BY-SA 4.0)
// See vendor/MODEL_SOURCE.md
// ============================================================

const BodyMap3D = (() => {
  const STYLE_ID = 'body-map-3d-styles';
  const STORAGE_KEY = 'recovr_bodymap_view_mode';
  const THREE_URL = 'vendor/three.module.min.js';
  const LOADER_URL = 'vendor/GLTFLoader.js';
  const MODEL_URL = 'vendor/anatomy/muscles-body.glb';
  const MAP_URL = 'vendor/anatomy/KEY_TO_APP.json';
  const MAX_PIXEL_RATIO = 2;

  const CORAL = '#ff3b5c';
  const AMBER = '#f5a524';
  const MINT = '#3ee6b0';
  const GROWTH = '#2ef0a0';
  const GROWTH_DEEP = '#14c878';
  const LOSS = '#7b6cff';
  const LOSS_DEEP = '#4a3dc8';
  const BASE_COLOR = '#3a3a44';
  const CONTEXT_COLOR = '#2a2a32';
  const BG = '#0a0a0f';
  const TRANSITION_MS = 400;

  // App coarse ids that should also light related fine-only meshes
  const LOAD_ALIASES = {
    shoulder: ['front_delts', 'rear_delts'],
    back: ['traps', 'lats', 'lower_back'],
    core: ['abs', 'obliques'],
    // App label "둔근/햄스트링" is one recovery/load bucket
    hamstrings: ['glutes'],
  };

  // App-facing ids (coarse + finer where the model allows)
  const EN_LABELS = {
    chest: 'Chest',
    back: 'Back',
    shoulder: 'Shoulders',
    front_delts: 'Front Delts',
    rear_delts: 'Rear Delts',
    biceps: 'Biceps',
    triceps: 'Triceps',
    quads: 'Quads',
    hamstrings: 'Hamstrings',
    glutes: 'Glutes',
    adductors: 'Adductors',
    calves: 'Calves',
    core: 'Abs',
    abs: 'Abs',
    obliques: 'Obliques',
    traps: 'Traps',
    lats: 'Lats',
    lower_back: 'Lower Back',
    forearms: 'Forearms',
  };

  const MUSCLE_IDS = Object.keys(EN_LABELS);

  // Prefer primary fine label when tapping a mesh
  const FINE_PRIORITY = [
    'front_delts', 'rear_delts', 'traps', 'lats', 'glutes',
    'lower_back', 'obliques', 'abs',
  ];

  let THREE = null;
  let GLTFLoader = null;
  let loadPromise = null;
  let modelPromise = null;
  let keyToApp = null;
  let stylesReady = false;
  let cachedModelTemplate = null; // cloned per mount

  /** @type {Map<string, object>} */
  const mounts = new Map();

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function getPreferredMode() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === '3d' || v === '2d') return v;
    } catch (e) { /* ignore */ }
    return '2d';
  }

  function setPreferredMode(mode) {
    const next = mode === '3d' ? '3d' : '2d';
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    return next;
  }

  function isWebGLAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  function ensureStyles() {
    if (stylesReady || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) {
      stylesReady = true;
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bm3-mode-toggle {
        display: inline-flex; align-items: stretch; border-radius: 999px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); flex-shrink: 0;
      }
      .bm3-mode-btn {
        border: none; background: transparent; color: rgba(232,232,240,0.72);
        font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
        /* Mobile tap target >= 44px (WCAG / Apple HIG) */
        min-width: 44px; min-height: 44px; padding: 10px 14px;
        cursor: pointer; font-family: 'Space Grotesk', sans-serif;
      }
      .bm3-mode-btn.selected { background: ${CORAL}; color: #fff; }
      .bm3-mode-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .bm3-stage {
        position: relative; width: min(100%, 280px); margin: 0 auto; aspect-ratio: 3 / 4;
        border-radius: 16px; overflow: hidden;
        background: radial-gradient(ellipse at 50% 42%, #14141c 0%, ${BG} 72%);
        /* pan-y: vertical page scroll must work when the finger starts on the canvas.
           Horizontal drags are claimed in JS (axis lock) for rotate. */
        touch-action: pan-y; user-select: none; -webkit-user-select: none;
      }
      .bm3-stage canvas {
        display: block; width: 100% !important; height: 100% !important;
        touch-action: pan-y;
      }
      .bm3-hint {
        position: absolute; right: 10px; top: 46%; transform: translateY(-50%);
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        pointer-events: none; opacity: 0.72; transition: opacity 0.4s ease;
      }
      .bm3-hint.is-faded { opacity: 0; }
      .bm3-hint-ring {
        width: 42px; height: 42px; border-radius: 50%;
        border: 1px solid rgba(62,230,176,0.35); background: rgba(10,10,15,0.55);
        display: flex; align-items: center; justify-content: center; color: ${MINT}; font-size: 16px;
      }
      .bm3-hint-text {
        font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em;
        color: rgba(232,232,240,0.75); text-align: center; max-width: 64px; line-height: 1.2;
      }
      .bm3-tip {
        position: absolute; left: 50%; top: 16%; transform: translateX(-50%); z-index: 4;
        pointer-events: none; opacity: 0; transition: opacity 0.18s ease;
        font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 12.5px; color: #fff;
        background: rgba(16,16,22,0.92); border: 1.5px solid ${CORAL}; border-radius: 999px;
        padding: 5px 12px; box-shadow: 0 0 18px rgba(255,59,92,0.35);
        white-space: nowrap; max-width: 92%;
      }
      .bm3-tip.visible { opacity: 1; }
      .bm3-loading {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        color: var(--muted, #6b6b85); font-size: 12px; font-weight: 600; pointer-events: none;
      }
      .bm3-fallback {
        padding: 18px 12px; text-align: center; font-size: 12px; color: var(--muted, #6b6b85);
      }
      .bm3-credit {
        margin-top: 6px; font-size: 9px; line-height: 1.35; color: var(--muted, #6b6b85); text-align: center;
      }
      .bm3-credit a {
        color: ${MINT};
        display: inline-flex; align-items: center; justify-content: center;
        min-height: 44px; padding: 10px 8px;
      }
      /* Hidden 2D/3D hosts must never intercept taps (some WebViews keep layout briefly) */
      .mh-body-wrap[hidden], .bml-2d-only[hidden], .wcm-2d-only[hidden],
      .mh-3d-host[hidden], .bml-3d-host[hidden], .wcm-3d-host[hidden],
      #mh3dHost[hidden], #bml3dHost[hidden], #wcm3dHost[hidden], #h3dSharedHost[hidden] {
        display: none !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    stylesReady = true;
  }

  function loadThree() {
    if (THREE && GLTFLoader) return Promise.resolve(THREE);
    if (loadPromise) return loadPromise;
    // Import without query strings so GLTFLoader's static `from './three.module.min.js'`
    // resolves to the SAME module instance (avoids "Multiple instances of Three.js").
    loadPromise = Promise.all([
      import(`./${THREE_URL}`),
      import(`./${LOADER_URL}`),
    ]).then(([threeMod, loaderMod]) => {
      THREE = threeMod;
      GLTFLoader = loaderMod.GLTFLoader;
      return THREE;
    }).catch((err) => {
      loadPromise = null;
      throw err;
    });
    return loadPromise;
  }

  function hexToInt(hex) {
    return parseInt(String(hex).replace('#', ''), 16);
  }

  function attachGlowFresnel(mat) {
    // Soft view-dependent rim so lit muscles keep fiber depth (no flat emissive slab)
    mat.userData.fresnelStrength = 0;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFresnel = { value: 0 };
      mat.userData.uFresnel = shader.uniforms.uFresnel;
      shader.fragmentShader = `uniform float uFresnel;\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        float bm3Fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.35);
        outgoingLight += totalEmissiveRadiance * bm3Fres * uFresnel;
        #include <opaque_fragment>
        `
      );
    };
    mat.customProgramCacheKey = () => 'bm3-fresnel-v1';
  }

  function makeMuscleMat() {
    // Always a fresh instance — never share across meshes
    const mat = new THREE.MeshStandardMaterial({
      color: hexToInt(BASE_COLOR),
      roughness: 0.72,
      metalness: 0.08,
      emissive: hexToInt(BASE_COLOR),
      emissiveIntensity: 0.03,
      flatShading: false,
      vertexColors: false,
    });
    attachGlowFresnel(mat);
    return mat;
  }

  function makeContextMat() {
    return new THREE.MeshStandardMaterial({
      color: hexToInt(CONTEXT_COLOR),
      roughness: 0.92,
      metalness: 0.02,
      emissive: hexToInt(CONTEXT_COLOR),
      emissiveIntensity: 0.02,
      vertexColors: false,
    });
  }

  function mixHex(a, b, t) {
    const pa = hexToInt(a);
    const pb = hexToInt(b);
    const ar = (pa >> 16) & 255; const ag = (pa >> 8) & 255; const ab = pa & 255;
    const br = (pb >> 16) & 255; const bg = (pb >> 8) & 255; const bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }

  function setFresnel(mat, strength) {
    mat.userData.fresnelStrength = strength;
    if (mat.userData.uFresnel) mat.userData.uFresnel.value = strength;
  }

  async function loadKeyMap() {
    if (keyToApp) return keyToApp;
    const res = await fetch(`./${MAP_URL}?v=2`);
    keyToApp = await res.json();
    return keyToApp;
  }

  function normalizeKeyFromName(name, extras) {
    if (extras && extras.key) return String(extras.key);
    if (extras && extras.muscleId) {
      return String(extras.muscleId).replace(/_(left|right)$/i, '');
    }
    return String(name || '')
      .replace(/__mobile(\.\d+)?$/i, '')
      .replace(/_(left|right)$/i, '')
      .trim();
  }

  function pickPrimaryId(appIds) {
    for (let i = 0; i < FINE_PRIORITY.length; i += 1) {
      if (appIds.includes(FINE_PRIORITY[i])) return FINE_PRIORITY[i];
    }
    return appIds[0] || null;
  }

  function prepareFigure(gltfScene, mapping) {
    const root = new THREE.Group();
    root.name = 'musclesBody';
    const muscleMeshes = new Map();
    const box = new THREE.Box3();
    const tmp = new THREE.Vector3();

    gltfScene.updateMatrixWorld(true);
    box.setFromObject(gltfScene);
    const size = box.getSize(tmp.clone());
    const center = box.getCenter(tmp.clone());
    const targetHeight = 2.15;
    const scale = targetHeight / Math.max(size.y, 0.001);

    const wrapper = new THREE.Group();
    wrapper.add(gltfScene);
    // Center on origin, feet near y=0 after scale
    gltfScene.position.set(-center.x, -box.min.y, -center.z);
    wrapper.scale.setScalar(scale);
    root.add(wrapper);

    gltfScene.traverse((obj) => {
      if (!obj.isMesh) return;
      // Dispose any shared source material; every mesh gets its own instance
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => { /* keep geo; replace below */ });
      }
      const extras = (obj.userData && (obj.userData.key || obj.userData.muscleId || obj.userData.label))
        ? obj.userData
        : (obj.parent && obj.parent.userData) || obj.userData || {};
      const key = normalizeKeyFromName(obj.name, extras);
      const appIds = mapping[key] || null;

      if (appIds && appIds.length) {
        // Brand-new material per mesh (never share / never clone a shared template)
        const mat = makeMuscleMat();
        obj.material = mat;
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.userData.appIds = appIds.slice();
        obj.userData.muscle = pickPrimaryId(appIds);
        obj.userData.atlasKey = key;
        obj.userData.label = extras.label || EN_LABELS[obj.userData.muscle] || key;
        appIds.forEach((id) => {
          if (!muscleMeshes.has(id)) muscleMeshes.set(id, []);
          muscleMeshes.get(id).push(obj);
        });
      } else {
        obj.material = makeContextMat();
        obj.userData.muscle = null;
        obj.userData.appIds = [];
      }
    });

    return { root, muscleMeshes };
  }

  async function loadModelTemplate() {
    if (cachedModelTemplate) return cachedModelTemplate;
    if (modelPromise) return modelPromise;
    modelPromise = (async () => {
      await loadThree();
      const mapping = await loadKeyMap();
      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.load(`./${MODEL_URL}?v=1`, resolve, undefined, reject);
      });
      cachedModelTemplate = { scene: gltf.scene, mapping };
      return cachedModelTemplate;
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
    return modelPromise;
  }

  function intensityFromLoad(load) {
    if (!load || load <= 0) return 0;
    // Keep emissive moderate so MeshStandard lit shading + normals stay readable
    return Math.max(0.18, Math.min(0.52, 0.14 + load * 0.1));
  }

  function recoveryVisual(pct, hasData) {
    if (!hasData) return { color: BASE_COLOR, intensity: 0.04, albedoMix: 0, fresnel: 0 };
    if (pct < 40) return { color: CORAL, intensity: 0.38, albedoMix: 0.82, fresnel: 0.95 };
    if (pct < 95) return { color: AMBER, intensity: 0.3, albedoMix: 0.7, fresnel: 0.75 };
    return { color: MINT, intensity: 0.26, albedoMix: 0.58, fresnel: 0.6 };
  }

  function growthVisual(growthPct, hasData) {
    if (!hasData || !(growthPct > 0)) {
      return { color: BASE_COLOR, intensity: 0.03, albedoMix: 0, fresnel: 0 };
    }
    const maxG = (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.MAX_GROWTH_PCT)
      ? MuscleGrowthTracker.MAX_GROWTH_PCT : 3;
    const t = Math.max(0, Math.min(1, growthPct / maxG));
    const color = t > 0.55 ? GROWTH : GROWTH_DEEP;
    return {
      color,
      intensity: 0.18 + t * 0.34,
      albedoMix: 0.55 + t * 0.35,
      fresnel: 0.45 + t * 0.5,
    };
  }

  function lossVisual(lossPct, hasData) {
    if (!hasData || !(lossPct > 0)) {
      return { color: BASE_COLOR, intensity: 0.03, albedoMix: 0, fresnel: 0 };
    }
    const maxL = (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.MAX_LOSS_PCT)
      ? MuscleGrowthTracker.MAX_LOSS_PCT : 8;
    const t = Math.max(0, Math.min(1, lossPct / maxL));
    const color = t > 0.5 ? LOSS_DEEP : LOSS;
    return {
      color,
      intensity: 0.16 + t * 0.3,
      albedoMix: 0.48 + t * 0.32,
      fresnel: 0.4 + t * 0.4,
    };
  }

  function loadForId(loads, id) {
    if (!loads) return 0;
    let v = loads[id] || 0;
    // Fine-only meshes also pick up their coarse app bucket
    Object.keys(LOAD_ALIASES).forEach((coarse) => {
      if ((LOAD_ALIASES[coarse] || []).includes(id)) {
        v = Math.max(v, loads[coarse] || 0);
      }
    });
    return v;
  }

  function activeLoadForMesh(appIds, loads) {
    if (!loads || !appIds) return 0;
    let best = 0;
    appIds.forEach((id) => {
      best = Math.max(best, loadForId(loads, id));
    });
    return best;
  }

  function recoveryRecordForId(recovery, id) {
    if (!recovery) return null;
    let r = recovery[id];
    if (r && r.lastDate != null) return r;
    // Fine ids fall back to coarse app buckets
    const reverse = {
      front_delts: 'shoulder', rear_delts: 'shoulder',
      traps: 'back', lats: 'back', lower_back: 'back',
      abs: 'core', obliques: 'core',
      glutes: 'hamstrings',
    };
    const coarse = reverse[id];
    if (coarse && recovery[coarse] && recovery[coarse].lastDate != null) return recovery[coarse];
    return null;
  }

  function recoveryForMesh(appIds, recovery) {
    if (!recovery || !appIds) return { pct: 100, hasData: false };
    let best = null;
    appIds.forEach((id) => {
      const r = recoveryRecordForId(recovery, id);
      if (!r || r.lastDate == null) return;
      if (!best || (r.recoveryPct ?? 100) < (best.recoveryPct ?? 100)) best = r;
    });
    if (!best) return { pct: 100, hasData: false };
    return { pct: best.recoveryPct ?? 100, hasData: true };
  }

  const FINE_TO_COARSE = {
    front_delts: 'shoulder', rear_delts: 'shoulder',
    traps: 'back', lats: 'back', lower_back: 'back',
    abs: 'core', obliques: 'core',
    glutes: 'hamstrings',
  };

  function growthEntryForId(perMuscle, id) {
    if (!perMuscle) return null;
    if (perMuscle[id] && perMuscle[id].growth) return perMuscle[id].growth;
    const coarse = FINE_TO_COARSE[id];
    if (coarse && perMuscle[coarse] && perMuscle[coarse].growth) return perMuscle[coarse].growth;
    return null;
  }

  function lossEntryForId(perMuscle, id) {
    if (!perMuscle) return null;
    if (perMuscle[id] && perMuscle[id].loss) return perMuscle[id].loss;
    const coarse = FINE_TO_COARSE[id];
    if (coarse && perMuscle[coarse] && perMuscle[coarse].loss) return perMuscle[coarse].loss;
    return null;
  }

  function growthForMesh(appIds, perMuscle) {
    if (!perMuscle || !appIds) return { pct: 0, hasData: false, entry: null };
    let best = null;
    appIds.forEach((id) => {
      const g = growthEntryForId(perMuscle, id);
      if (!g) return;
      if (!best || (g.growthPct || 0) > (best.growthPct || 0)) best = g;
    });
    if (!best) return { pct: 0, hasData: false, entry: null };
    return { pct: best.growthPct || 0, hasData: true, entry: best };
  }

  function lossForMesh(appIds, perMuscle) {
    if (!perMuscle || !appIds) return { pct: 0, hasData: false, entry: null };
    let best = null;
    appIds.forEach((id) => {
      const l = lossEntryForId(perMuscle, id);
      if (!l) return;
      if (!best || (l.lossPct || 0) > (best.lossPct || 0)) best = l;
    });
    if (!best) return { pct: 0, hasData: false, entry: null };
    return { pct: best.lossPct || 0, hasData: true, entry: best };
  }

  function captureMatSnapshot(mat) {
    return {
      color: mat.color.getHex(),
      emissive: mat.emissive.getHex(),
      emissiveIntensity: mat.emissiveIntensity,
      roughness: mat.roughness,
      fresnel: (mat.userData && mat.userData.fresnelStrength) || 0,
    };
  }

  function applyMatTarget(mat, target) {
    mat.color.setHex(target.color);
    mat.emissive.setHex(target.emissive);
    mat.emissiveIntensity = target.emissiveIntensity;
    mat.roughness = target.roughness;
    if (target.metalness != null) mat.metalness = target.metalness;
    setFresnel(mat, target.fresnel || 0);
    mat.vertexColors = false;
    mat.needsUpdate = true;
  }

  function lerpMat(mat, from, to, t) {
    const mixC = (a, b) => {
      const ar = (a >> 16) & 255; const ag = (a >> 8) & 255; const ab = a & 255;
      const br = (b >> 16) & 255; const bg = (b >> 8) & 255; const bb = b & 255;
      const r = Math.round(ar + (br - ar) * t);
      const g = Math.round(ag + (bg - ag) * t);
      const bl = Math.round(ab + (bb - ab) * t);
      return (r << 16) | (g << 8) | bl;
    };
    mat.color.setHex(mixC(from.color, to.color));
    mat.emissive.setHex(mixC(from.emissive, to.emissive));
    mat.emissiveIntensity = from.emissiveIntensity + (to.emissiveIntensity - from.emissiveIntensity) * t;
    mat.roughness = from.roughness + (to.roughness - from.roughness) * t;
    setFresnel(mat, from.fresnel + (to.fresnel - from.fresnel) * t);
  }

  function computeMatTarget(state, mesh) {
    const appIds = mesh.userData.appIds || [];
    const { colorMode, data, showPedestal } = state;
    const idle = {
      color: hexToInt(BASE_COLOR),
      emissive: hexToInt(BASE_COLOR),
      emissiveIntensity: showPedestal ? 0.045 : 0.03,
      roughness: 0.78,
      fresnel: colorMode === 'complete' || colorMode === 'intensity' ? 0.15 : 0,
      metalness: 0.08,
    };

    if (colorMode === 'recovery') {
      const { pct, hasData } = recoveryForMesh(appIds, data && data.recovery);
      const vis = recoveryVisual(pct, hasData);
      if (!hasData) return idle;
      return {
        color: mixHex(BASE_COLOR, vis.color, vis.albedoMix),
        emissive: hexToInt(vis.color),
        emissiveIntensity: vis.intensity,
        roughness: 0.55,
        fresnel: vis.fresnel,
        metalness: 0.08,
      };
    }

    if (colorMode === 'growth') {
      const { pct, hasData } = growthForMesh(appIds, data && data.perMuscle);
      const vis = growthVisual(pct, hasData && pct > 0);
      if (!(hasData && pct > 0)) return idle;
      return {
        color: mixHex(BASE_COLOR, vis.color, vis.albedoMix),
        emissive: hexToInt(vis.color),
        emissiveIntensity: vis.intensity,
        roughness: 0.48,
        fresnel: vis.fresnel,
        metalness: 0.06,
      };
    }

    if (colorMode === 'loss') {
      const { pct, hasData } = lossForMesh(appIds, data && data.perMuscle);
      const vis = lossVisual(pct, hasData && pct > 0);
      if (!(hasData && pct > 0)) return idle;
      return {
        color: mixHex(BASE_COLOR, vis.color, vis.albedoMix),
        emissive: hexToInt(vis.color),
        emissiveIntensity: vis.intensity,
        roughness: 0.62,
        fresnel: vis.fresnel,
        metalness: 0.04,
      };
    }

    const load = activeLoadForMesh(appIds, data && data.loads);
    if (load > 0) {
      const t = Math.min(1, load / 3.5);
      const emissive = intensityFromLoad(load) * (colorMode === 'complete' ? 1.05 : 1);
      return {
        color: mixHex(BASE_COLOR, CORAL, 0.72 + t * 0.22),
        emissive: hexToInt(CORAL),
        emissiveIntensity: emissive,
        roughness: 0.4 + (1 - t) * 0.16,
        fresnel: 0.55 + t * 0.45,
        metalness: 0.06,
      };
    }
    return idle;
  }

  function ensureUniqueMaterial(mesh) {
    const mat = mesh.material;
    if (!mat) {
      mesh.material = makeMuscleMat();
      return mesh.material;
    }
    // If this material is somehow shared, detach a private clone with fresnel
    if (mat.userData && mat.userData._bm3Shared) {
      const next = makeMuscleMat();
      mesh.material = next;
      return next;
    }
    return mat;
  }

  function applyColors(state, opts) {
    const animate = !!(opts && opts.animate);
    const duration = (opts && opts.duration != null) ? opts.duration : TRANSITION_MS;
    const reduce = prefersReducedMotion();
    const seen = new Set();
    const transitions = [];

    state.muscleMeshes.forEach((meshes) => {
      meshes.forEach((mesh) => {
        if (seen.has(mesh)) return;
        seen.add(mesh);
        const mat = ensureUniqueMaterial(mesh);
        const target = computeMatTarget(state, mesh);
        if (animate && !reduce) {
          transitions.push({ mat, from: captureMatSnapshot(mat), to: target });
        } else {
          applyMatTarget(mat, target);
        }
      });
    });

    if (transitions.length) {
      state.colorTransition = {
        items: transitions,
        start: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        duration,
      };
    } else {
      state.colorTransition = null;
    }
  }

  function showTip(state, html) {
    if (!state.tipEl) return;
    state.tipEl.innerHTML = html;
    state.tipEl.classList.add('visible');
    clearTimeout(state.tipEl._hideTimer);
    state.tipEl._hideTimer = setTimeout(() => {
      state.tipEl.classList.remove('visible');
    }, 3200);
  }

  function formatRecoveryTip(muscle, data, meshLabel) {
    const label = meshLabel || EN_LABELS[muscle] || muscle;
    const r = data && data.recovery && data.recovery[muscle];
    // Fall back across aliases for recovery lookup
    let rec = r;
    if ((!rec || rec.lastDate == null) && data && data.recovery) {
      const aliases = {
        front_delts: 'shoulder', rear_delts: 'shoulder', traps: 'back', lats: 'back',
        lower_back: 'back', glutes: 'hamstrings', abs: 'core', obliques: 'core',
      };
      const alt = aliases[muscle];
      if (alt) rec = data.recovery[alt];
    }
    if (!rec || rec.lastDate == null) {
      return `<strong>${escapeHtml(label)}</strong> · 기록 없음`;
    }
    const pct = Math.round(rec.recoveryPct || 0);
    let hoursLeft = null;
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getHoursUntilReady) {
      const key = (data.recovery[muscle] && data.recovery[muscle].lastDate != null) ? muscle
        : ({ front_delts: 'shoulder', rear_delts: 'shoulder', traps: 'back', lats: 'back', lower_back: 'back', glutes: 'hamstrings', abs: 'core', obliques: 'core' }[muscle] || muscle);
      hoursLeft = MuscleHeatmap.getHoursUntilReady(key, data.recovery);
    } else {
      hoursLeft = Math.max(0, Math.round((rec.recoveryHours || 0) - (rec.hoursElapsed || 0)));
    }
    if (pct < 40) return `${escapeHtml(label)} · 피로${hoursLeft > 0 ? ` · ${hoursLeft}시간 후 준비` : ''}`;
    if (pct < 95) return `${escapeHtml(label)} · 회복 중${hoursLeft > 0 ? ` · ${hoursLeft}시간 후 준비` : ''}`;
    return `${escapeHtml(label)} · 준비됨`;
  }

  function formatIntensityTip(muscle, data, meshLabel) {
    const label = meshLabel || EN_LABELS[muscle] || muscle;
    const loads = data && data.loads;
    let load = (loads && loads[muscle]) || 0;
    if (load <= 0 && loads) {
      const aliases = {
        front_delts: 'shoulder', rear_delts: 'shoulder', traps: 'back', lats: 'back',
        lower_back: 'back', glutes: 'hamstrings', abs: 'core', obliques: 'core',
      };
      const alt = aliases[muscle];
      if (alt) load = loads[alt] || 0;
    }
    if (load <= 0) return `${escapeHtml(label)} · Idle`;
    if (data && data.setCounts && data.setCounts[muscle] != null) {
      return `+${escapeHtml(String(data.setCounts[muscle]))} sets · ${escapeHtml(label)}`;
    }
    const n = Math.max(1, Math.round(load * 2.2));
    return `+${n} sets · ${escapeHtml(label)}`;
  }

  function formatGrowthTip(muscle, data, meshLabel) {
    const label = meshLabel || EN_LABELS[muscle] || muscle;
    const g = growthEntryForId(data && data.perMuscle, muscle);
    if (!g || !(g.growthPct > 0)) return `${escapeHtml(label)} · 성장 신호 없음`;
    const sessions = g.sessionCount != null ? ` · 4주 ${g.sessionCount}회` : '';
    return `${escapeHtml(label)} · 성장 +${g.growthPct}%${sessions}`;
  }

  function formatLossTip(muscle, data, meshLabel) {
    const label = meshLabel || EN_LABELS[muscle] || muscle;
    const l = lossEntryForId(data && data.perMuscle, muscle);
    if (!l) return `${escapeHtml(label)} · 기록 없음`;
    if (!(l.lossPct > 0)) return `${escapeHtml(label)} · 유지 · ${l.daysSince}일 전 운동`;
    return `${escapeHtml(label)} · 손실 −${l.lossPct}% · ${l.daysSince}일 휴식`;
  }

  function tipForMode(state, muscle, label) {
    if (state.colorMode === 'recovery') return formatRecoveryTip(muscle, state.data, label);
    if (state.colorMode === 'growth') return formatGrowthTip(muscle, state.data, label);
    if (state.colorMode === 'loss') return formatLossTip(muscle, state.data, label);
    return formatIntensityTip(muscle, state.data, label);
  }

  function pickMuscle(state, clientX, clientY) {
    if (!state.renderer || !state.camera || !state.root) return null;
    const rect = state.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, state.camera);
    const hits = raycaster.intersectObjects(state.root.children, true);
    for (let i = 0; i < hits.length; i += 1) {
      const obj = hits[i].object;
      if (obj && obj.userData && obj.userData.muscle) {
        return {
          muscle: obj.userData.muscle,
          label: obj.userData.label || EN_LABELS[obj.userData.muscle] || obj.userData.muscle,
        };
      }
    }
    return null;
  }

  const AXIS_LOCK_PX = 8;

  function pointerXY(e) {
    if (!e) return { x: 0, y: 0 };
    if (e.clientX != null) return { x: e.clientX, y: e.clientY || 0 };
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    return t ? { x: t.clientX || 0, y: t.clientY || 0 } : { x: 0, y: 0 };
  }

  function onPointerDown(state, e) {
    if (e && e.pointerType === 'mouse' && e.button != null && e.button !== 0) return;
    state.dragging = true;
    state.dragAxis = null; // 'x' rotate | 'y' scroll | null undecided
    const p = pointerXY(e);
    state.lastX = p.x;
    state.startX = p.x;
    state.startY = p.y;
    state.pointerMoved = 0;
    if (state.hintEl) state.hintEl.classList.add('is-faded');
    // Do not preventDefault on down — vertical page scroll must still start on the canvas.
  }

  function onPointerMove(state, e, rawEvent) {
    if (!state.dragging) return;
    const p = pointerXY(e);
    const dxTotal = p.x - state.startX;
    const dyTotal = p.y - state.startY;

    if (!state.dragAxis) {
      if (Math.abs(dxTotal) < AXIS_LOCK_PX && Math.abs(dyTotal) < AXIS_LOCK_PX) return;
      state.dragAxis = Math.abs(dxTotal) >= Math.abs(dyTotal) ? 'x' : 'y';
      if (state.dragAxis === 'x' && state.canvasWrap && e && e.pointerId != null
          && typeof state.canvasWrap.setPointerCapture === 'function') {
        try { state.canvasWrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    }

    if (state.dragAxis === 'y') {
      // Vertical intent: release rotate and let the browser scroll the page.
      return;
    }

    const dx = p.x - state.lastX;
    state.lastX = p.x;
    state.pointerMoved += Math.abs(dx);
    state.targetYaw += dx * 0.01;
    const ev = rawEvent || e;
    if (ev && typeof ev.preventDefault === 'function' && (ev.cancelable !== false)) {
      ev.preventDefault();
    }
  }

  function onPointerUp(state, e) {
    if (!state.dragging) return;
    const axis = state.dragAxis;
    state.dragging = false;
    state.dragAxis = null;
    if (axis === 'y') return;
    const p = pointerXY(e);
    if (state.pointerMoved < AXIS_LOCK_PX && p) {
      const hit = pickMuscle(state, p.x, p.y);
      if (hit) {
        showTip(state, tipForMode(state, hit.muscle, hit.label));
        if (typeof state.onMuscleTap === 'function') state.onMuscleTap(hit.muscle);
      }
    }
  }

  function bindPointer(state) {
    const el = state.canvasWrap;
    const usePointer = typeof window !== 'undefined' && window.PointerEvent;

    if (usePointer) {
      // Pointer Events alone — avoid also binding touch* (double-rotate / double-toggle on mobile).
      const down = (e) => onPointerDown(state, e);
      const move = (e) => onPointerMove(state, e, e);
      const up = (e) => onPointerUp(state, e);
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move, { passive: false });
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      state._unbind = () => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      return;
    }

    // Legacy touch-only fallback (no PointerEvent)
    const down = (e) => {
      if (!e.touches || !e.touches[0]) return;
      onPointerDown(state, e.touches[0]);
    };
    const move = (e) => {
      if (!e.touches || !e.touches[0]) return;
      onPointerMove(state, e.touches[0], e);
    };
    const up = (e) => {
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      onPointerUp(state, t || e);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up, { passive: true });
    el.addEventListener('touchcancel', up, { passive: true });
    state._unbind = () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }

  function resize(state) {
    if (!state.renderer || !state.camera || !state.canvasWrap) return;
    const w = Math.max(1, state.canvasWrap.clientWidth);
    const h = Math.max(1, state.canvasWrap.clientHeight);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    state.renderer.setSize(w, h, false);
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
  }

  function animate(state) {
    if (state.disposed) return;
    state.raf = requestAnimationFrame(() => animate(state));
    const reduce = prefersReducedMotion();
    if (!reduce) {
      state.breath += 0.025;
      const breathe = 1 + Math.sin(state.breath) * 0.008;
      if (state.root) state.root.scale.setScalar(breathe);
      if (!state.dragging && state.autoRotate) {
        state.targetYaw += state.showPedestal ? 0.006 : 0.0035;
      }
    }
    if (state.colorTransition) {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const t = Math.min(1, (now - state.colorTransition.start) / state.colorTransition.duration);
      const eased = t * t * (3 - 2 * t);
      state.colorTransition.items.forEach((item) => lerpMat(item.mat, item.from, item.to, eased));
      if (t >= 1) {
        state.colorTransition.items.forEach((item) => applyMatTarget(item.mat, item.to));
        state.colorTransition = null;
      }
    }
    state.yaw += (state.targetYaw - state.yaw) * 0.12;
    if (state.root) state.root.rotation.y = state.yaw;
    if (state.pedestal) state.pedestal.rotation.y = -state.yaw * 0.15;
    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera);
    }
  }

  function disposeMount(state) {
    if (!state || state.disposed) return;
    state.disposed = true;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (state._unbind) state._unbind();
    if (state.ro) {
      try { state.ro.disconnect(); } catch (e) { /* ignore */ }
      state.ro = null;
    }
    if (state.renderer) {
      try {
        state.renderer.dispose();
        const canvas = state.renderer.domElement;
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        const gl = state.renderer.getContext && state.renderer.getContext();
        const lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch (e) { /* ignore */ }
      state.renderer = null;
    }
    if (state.scene) {
      state.scene.traverse((obj) => {
        if (obj.geometry && obj.geometry.dispose && !obj.userData._sharedGeo) {
          // cloned scene owns materials; geometry may be shared from template — dispose materials only
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose && m.dispose());
          else if (obj.material.dispose) obj.material.dispose();
        }
      });
      state.scene = null;
    }
    state.root = null;
    state.pedestal = null;
    state.camera = null;
    state.muscleMeshes = new Map();
  }

  function buildPedestal(parent) {
    const group = new THREE.Group();
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.9, metalness: 0.05, emissive: hexToInt(MINT), emissiveIntensity: 0.15 }),
      new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.92, metalness: 0.04, emissive: hexToInt(MINT), emissiveIntensity: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x08080e, roughness: 0.95, metalness: 0.02, emissive: hexToInt(MINT), emissiveIntensity: 0.08 }),
    ];
    const tiers = [
      { y: -0.04, r: 0.42, h: 0.05 },
      { y: -0.1, r: 0.55, h: 0.05 },
      { y: -0.16, r: 0.7, h: 0.05 },
    ];
    tiers.forEach((t, i) => {
      const geo = new THREE.CylinderGeometry(t.r, t.r * 1.05, t.h, 48);
      const mesh = new THREE.Mesh(geo, mats[i]);
      mesh.position.y = t.y;
      group.add(mesh);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(t.r * 0.98, 0.01, 8, 48),
        new THREE.MeshBasicMaterial({ color: hexToInt(MINT) })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = t.y + t.h * 0.45;
      group.add(rim);
    });
    parent.add(group);
    return group;
  }

  async function createScene(state) {
    const template = await loadModelTemplate();
    if (state.disposed) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(hexToInt(BG));

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
    camera.position.set(0, 1.05, 3.35);
    camera.lookAt(0, 0.95, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(hexToInt(BG), 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    state.canvasWrap.appendChild(renderer.domElement);

    // Stronger key/rim so coral albedo keeps fiber volume when emissive is moderate
    const ambient = new THREE.AmbientLight(0x6e6e7c, 0.32);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(1.5, 2.6, 2.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8d0ff, 1.2);
    rim.position.set(-2.1, 1.5, -2.5);
    scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0xffb8a0, 0.55);
    rim2.position.set(2.3, 0.7, -1.5);
    scene.add(rim2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.38);
    fill.position.set(0, -1.2, 1.9);
    scene.add(fill);
    const hemi = new THREE.HemisphereLight(0x8a9bb8, 0x1a1210, 0.4);
    scene.add(hemi);

    const cloned = template.scene.clone(true);
    const { root, muscleMeshes } = prepareFigure(cloned, template.mapping);
    scene.add(root);

    let pedestal = null;
    if (state.showPedestal) {
      pedestal = buildPedestal(scene);
      const ringMat1 = new THREE.MeshBasicMaterial({ color: hexToInt(CORAL), transparent: true, opacity: 0.5 });
      const ringMat2 = new THREE.MeshBasicMaterial({ color: hexToInt(MINT), transparent: true, opacity: 0.4 });
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.01, 8, 64), ringMat1);
      r1.position.set(0, 1.05, 0);
      r1.rotation.x = Math.PI / 2.4;
      scene.add(r1);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.008, 8, 64), ringMat2);
      r2.position.set(0, 0.72, 0);
      r2.rotation.x = Math.PI / 2.6;
      scene.add(r2);
    }

    state.scene = scene;
    state.camera = camera;
    state.renderer = renderer;
    state.root = root;
    state.pedestal = pedestal;
    state.muscleMeshes = muscleMeshes;

    const preferBack = !!(state.data && state.data.view === 'back');
    state.yaw = preferBack ? Math.PI : (state.showPedestal ? 0.45 : 0.28);
    state.targetYaw = state.yaw;

    applyColors(state);
    resize(state);
    bindPointer(state);

    if (typeof ResizeObserver !== 'undefined') {
      state.ro = new ResizeObserver(() => resize(state));
      state.ro.observe(state.canvasWrap);
    }

    const loading = state.canvasWrap.querySelector('.bm3-loading');
    if (loading) loading.remove();

    animate(state);
  }

  function ensureStageDom(host) {
    ensureStyles();
    let stage = host.querySelector('.bm3-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.className = 'bm3-stage';
      stage.innerHTML = `
        <div class="bm3-loading">Loading 3D anatomy…</div>
        <div class="bm3-tip" aria-live="polite"></div>
        <div class="bm3-hint">
          <div class="bm3-hint-ring" aria-hidden="true">↻</div>
          <div class="bm3-hint-text">Drag to rotate</div>
        </div>`;
      host.appendChild(stage);
      if (!host.querySelector('.bm3-credit')) {
        const credit = document.createElement('div');
        credit.className = 'bm3-credit';
        credit.innerHTML = 'Anatomy: Z-Anatomy / BodyParts3D · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>';
        host.appendChild(credit);
      }
    }
    return stage;
  }

  async function mount(id, host, options = {}) {
    if (!host) return false;
    ensureStyles();

    if (!isWebGLAvailable()) {
      host.innerHTML = `<div class="bm3-fallback">3D is unavailable on this device. Showing 2D instead.</div>`;
      setPreferredMode('2d');
      return false;
    }

    const existing = mounts.get(id);
    if (existing) disposeMount(existing);

    const stage = ensureStageDom(host);
    const state = {
      id,
      host,
      canvasWrap: stage,
      tipEl: stage.querySelector('.bm3-tip'),
      hintEl: stage.querySelector('.bm3-hint'),
      renderer: null,
      scene: null,
      camera: null,
      root: null,
      pedestal: null,
      muscleMeshes: new Map(),
      colorMode: options.colorMode || 'intensity',
      data: options.data || {},
      yaw: 0,
      targetYaw: 0,
      dragging: false,
      dragAxis: null,
      lastX: 0,
      startX: 0,
      startY: 0,
      breath: 0,
      raf: 0,
      disposed: false,
      ro: null,
      onMuscleTap: options.onMuscleTap || null,
      showPedestal: !!options.showPedestal,
      autoRotate: options.autoRotate !== false,
      pointerMoved: 0,
    };
    mounts.set(id, state);

    try {
      await createScene(state);
      return true;
    } catch (err) {
      console.warn('[BodyMap3D] failed to mount anatomical model', err);
      host.innerHTML = `<div class="bm3-fallback">Could not load 3D anatomy. Falling back to 2D.</div>`;
      disposeMount(state);
      mounts.delete(id);
      return false;
    }
  }

  function update(id, data, options = {}) {
    const state = mounts.get(id);
    if (!state || state.disposed) return;
    if (data) state.data = data;
    if (options.colorMode) state.colorMode = options.colorMode;
    if (options.showPedestal != null) state.showPedestal = !!options.showPedestal;
    applyColors(state, { animate: !!options.animate, duration: options.duration });
  }

  /** Soft mode switch: keep yaw/renderer, crossfade materials (~400ms). */
  function transitionUpdate(id, data, options = {}) {
    const state = mounts.get(id);
    if (!state || state.disposed) return false;
    if (data) state.data = Object.assign({}, state.data || {}, data);
    if (options.colorMode) state.colorMode = options.colorMode;
    if (options.showPedestal != null) state.showPedestal = !!options.showPedestal;
    if (options.view === 'back') {
      state.targetYaw = Math.PI;
    } else if (options.view === 'front') {
      // Keep current yaw if already facing front-ish; otherwise ease toward front
      if (Math.abs(((state.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) < 0.35) {
        state.targetYaw = 0.28;
      }
    }
    applyColors(state, {
      animate: options.animate !== false,
      duration: options.duration != null ? options.duration : TRANSITION_MS,
    });
    return true;
  }

  function hasMount(id) {
    const state = mounts.get(id);
    return !!(state && !state.disposed && state.renderer);
  }

  function getYaw(id) {
    const state = mounts.get(id);
    return state ? state.yaw : 0;
  }

  function unmount(id) {
    const state = mounts.get(id);
    if (!state) return;
    disposeMount(state);
    mounts.delete(id);
    if (state.host) state.host.innerHTML = '';
  }

  function unmountAll() {
    Array.from(mounts.keys()).forEach(unmount);
  }

  function buildModeToggle(selected, opts = {}) {
    ensureStyles();
    const webgl = isWebGLAvailable();
    const sel = selected === '3d' ? '3d' : '2d';
    const disabled3d = webgl ? '' : 'disabled title="WebGL unavailable"';
    return `
      <div class="bm3-mode-toggle" role="group" aria-label="Body map view mode" data-bm3-toggle="${escapeHtml(opts.scope || '')}">
        <button type="button" class="bm3-mode-btn ${sel === '2d' ? 'selected' : ''}" data-bm3-mode="2d" aria-pressed="${sel === '2d'}">2D</button>
        <button type="button" class="bm3-mode-btn ${sel === '3d' ? 'selected' : ''}" data-bm3-mode="3d" aria-pressed="${sel === '3d'}" ${disabled3d}>3D</button>
      </div>`;
  }

  function bindModeToggle(root, onChange) {
    if (!root) return;
    root.querySelectorAll('[data-bm3-mode]').forEach((btn) => {
      // Guard against re-binding when a parent re-renders the same button node
      if (btn.dataset.bm3Bound === '1') return;
      btn.dataset.bm3Bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        const mode = btn.getAttribute('data-bm3-mode') === '3d' ? '3d' : '2d';
        setPreferredMode(mode);
        if (typeof onChange === 'function') onChange(mode);
      });
    });
  }

  function getEnglishLabel(muscle) {
    return EN_LABELS[muscle] || muscle;
  }

  return {
    STORAGE_KEY,
    MUSCLE_IDS,
    EN_LABELS,
    MODEL_URL,
    CORAL,
    AMBER,
    MINT,
    GROWTH,
    GROWTH_DEEP,
    LOSS,
    LOSS_DEEP,
    TRANSITION_MS,
    getPreferredMode,
    setPreferredMode,
    isWebGLAvailable,
    buildModeToggle,
    bindModeToggle,
    mount,
    update,
    transitionUpdate,
    hasMount,
    getYaw,
    unmount,
    unmountAll,
    loadThree,
    loadModelTemplate,
    getEnglishLabel,
    ensureStyles,
    intensityFromLoad,
    recoveryVisual,
    growthVisual,
    lossVisual,
  };
})();

if (typeof window !== 'undefined') {
  window.BodyMap3D = BodyMap3D;
}
