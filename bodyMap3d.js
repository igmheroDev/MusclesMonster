// ============================================================
// RECOVR - Experimental interactive 3D muscle body map
// Independent module. Lazy-loads vendored three.js (ESM).
// Procedural stylized figure — see vendor/MODEL_SOURCE.md
// ============================================================

const BodyMap3D = (() => {
  const STYLE_ID = 'body-map-3d-styles';
  const STORAGE_KEY = 'recovr_bodymap_view_mode';
  const THREE_URL = 'vendor/three.module.min.js';
  const MAX_PIXEL_RATIO = 2;

  const CORAL = '#ff3b5c';
  const AMBER = '#f5a524';
  const MINT = '#3ee6b0';
  const BASE_COLOR = '#3a3a44';
  const BG = '#0a0a0f';

  const EN_LABELS = {
    chest: 'Chest',
    back: 'Back',
    shoulder: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    quads: 'Quads',
    hamstrings: 'Glutes/Hams',
    adductors: 'Adductors',
    calves: 'Calves',
    core: 'Abs',
    forearms: 'Forearms',
  };

  const MUSCLE_IDS = Object.keys(EN_LABELS);

  let THREE = null;
  let loadPromise = null;
  let stylesReady = false;

  /** @type {Map<string, MountState>} */
  const mounts = new Map();

  /**
   * @typedef {object} MountState
   * @property {string} id
   * @property {HTMLElement} host
   * @property {HTMLElement} canvasWrap
   * @property {HTMLElement} tipEl
   * @property {HTMLElement} hintEl
   * @property {object|null} renderer
   * @property {object|null} scene
   * @property {object|null} camera
   * @property {object|null} root
   * @property {object|null} pedestal
   * @property {Map<string, object[]>} muscleMeshes
   * @property {string} colorMode
   * @property {object} data
   * @property {number} yaw
   * @property {number} targetYaw
   * @property {boolean} dragging
   * @property {number} lastX
   * @property {number} breath
   * @property {number} raf
   * @property {boolean} disposed
   * @property {ResizeObserver|null} ro
   * @property {Function|null} onMuscleTap
   * @property {boolean} showPedestal
   * @property {boolean} autoRotate
   */

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
        display: inline-flex;
        align-items: stretch;
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.04);
        flex-shrink: 0;
      }
      .bm3-mode-btn {
        border: none;
        background: transparent;
        color: rgba(232,232,240,0.72);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 6px 11px;
        cursor: pointer;
        font-family: 'Space Grotesk', sans-serif;
      }
      .bm3-mode-btn.selected {
        background: ${CORAL};
        color: #fff;
      }
      .bm3-mode-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .bm3-stage {
        position: relative;
        width: min(100%, 280px);
        margin: 0 auto;
        aspect-ratio: 3 / 4;
        border-radius: 16px;
        overflow: hidden;
        background: radial-gradient(ellipse at 50% 42%, #14141c 0%, ${BG} 72%);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
      }
      .bm3-stage canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
      }
      .bm3-hint {
        position: absolute;
        right: 10px;
        top: 46%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        pointer-events: none;
        opacity: 0.72;
        transition: opacity 0.4s ease;
      }
      .bm3-hint.is-faded { opacity: 0; }
      .bm3-hint-ring {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 1px solid rgba(62,230,176,0.35);
        background: rgba(10,10,15,0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${MINT};
        font-size: 16px;
      }
      .bm3-hint-text {
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: rgba(232,232,240,0.75);
        text-align: center;
        max-width: 64px;
        line-height: 1.2;
      }
      .bm3-tip {
        position: absolute;
        left: 50%;
        top: 18%;
        transform: translateX(-50%);
        z-index: 4;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.18s ease;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 12.5px;
        color: #fff;
        background: rgba(16,16,22,0.92);
        border: 1.5px solid ${CORAL};
        border-radius: 999px;
        padding: 5px 12px;
        box-shadow: 0 0 18px rgba(255,59,92,0.35);
        white-space: nowrap;
        max-width: 90%;
      }
      .bm3-tip.visible { opacity: 1; }
      .bm3-loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--muted, #6b6b85);
        font-size: 12px;
        font-weight: 600;
        pointer-events: none;
      }
      .bm3-fallback {
        padding: 18px 12px;
        text-align: center;
        font-size: 12px;
        color: var(--muted, #6b6b85);
      }
    `;
    document.head.appendChild(style);
    stylesReady = true;
  }

  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    if (loadPromise) return loadPromise;
    loadPromise = import(`./${THREE_URL}?v=r170`)
      .then((mod) => {
        THREE = mod;
        return THREE;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
    return loadPromise;
  }

  function hexToInt(hex) {
    return parseInt(String(hex).replace('#', ''), 16);
  }

  function makeMat(emissiveHex, emissiveIntensity) {
    return new THREE.MeshStandardMaterial({
      color: hexToInt(BASE_COLOR),
      roughness: 0.88,
      metalness: 0.04,
      emissive: hexToInt(emissiveHex || BASE_COLOR),
      emissiveIntensity: emissiveIntensity || 0,
    });
  }

  function addPart(root, muscleMeshes, muscle, geo, x, y, z, sx, sy, sz, rx, ry, rz) {
    const mesh = new THREE.Mesh(geo, makeMat(BASE_COLOR, 0));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    mesh.userData.muscle = muscle;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
    if (!muscleMeshes.has(muscle)) muscleMeshes.set(muscle, []);
    muscleMeshes.get(muscle).push(mesh);
    return mesh;
  }

  function buildProceduralFigure(root) {
    const muscleMeshes = new Map();
    const sphere = new THREE.SphereGeometry(1, 18, 14);
    const capsule = new THREE.CapsuleGeometry(0.5, 1, 6, 12);
    const box = new THREE.BoxGeometry(1, 1, 1);

    // Head / neck (neutral — not a tracked muscle)
    const head = new THREE.Mesh(sphere, makeMat(BASE_COLOR, 0));
    head.position.set(0, 1.62, 0);
    head.scale.set(0.18, 0.22, 0.2);
    head.userData.muscle = null;
    root.add(head);

    const neck = new THREE.Mesh(capsule, makeMat(BASE_COLOR, 0));
    neck.position.set(0, 1.38, 0);
    neck.scale.set(0.22, 0.22, 0.22);
    neck.userData.muscle = null;
    root.add(neck);

    // Torso shell (back / traps / lats grouped under `back`)
    addPart(root, muscleMeshes, 'back', sphere, 0, 1.02, -0.1, 0.36, 0.28, 0.2); // traps
    addPart(root, muscleMeshes, 'back', sphere, -0.14, 0.88, -0.12, 0.22, 0.32, 0.16); // lats L
    addPart(root, muscleMeshes, 'back', sphere, 0.14, 0.88, -0.12, 0.22, 0.32, 0.16); // lats R
    addPart(root, muscleMeshes, 'back', box, 0, 0.58, -0.08, 0.3, 0.26, 0.14); // lower back

    // Chest
    addPart(root, muscleMeshes, 'chest', sphere, -0.15, 1.06, 0.13, 0.2, 0.16, 0.13);
    addPart(root, muscleMeshes, 'chest', sphere, 0.15, 1.06, 0.13, 0.2, 0.16, 0.13);
    addPart(root, muscleMeshes, 'chest', sphere, 0, 0.98, 0.14, 0.16, 0.1, 0.1);

    // Core / abs + obliques
    addPart(root, muscleMeshes, 'core', box, 0, 0.74, 0.12, 0.24, 0.34, 0.11);
    addPart(root, muscleMeshes, 'core', sphere, 0, 0.56, 0.12, 0.18, 0.14, 0.09);
    addPart(root, muscleMeshes, 'core', sphere, -0.16, 0.7, 0.08, 0.1, 0.18, 0.08);
    addPart(root, muscleMeshes, 'core', sphere, 0.16, 0.7, 0.08, 0.1, 0.18, 0.08);

    // Shoulders (front + rear delts share `shoulder`)
    addPart(root, muscleMeshes, 'shoulder', sphere, -0.34, 1.16, 0.04, 0.15, 0.13, 0.13);
    addPart(root, muscleMeshes, 'shoulder', sphere, 0.34, 1.16, 0.04, 0.15, 0.13, 0.13);
    addPart(root, muscleMeshes, 'shoulder', sphere, -0.36, 1.12, -0.06, 0.12, 0.1, 0.11);
    addPart(root, muscleMeshes, 'shoulder', sphere, 0.36, 1.12, -0.06, 0.12, 0.1, 0.11);

    // Biceps (front of upper arm)
    addPart(root, muscleMeshes, 'biceps', capsule, -0.42, 0.9, 0.07, 0.2, 0.26, 0.18, 0.12, 0, 0.18);
    addPart(root, muscleMeshes, 'biceps', capsule, 0.42, 0.9, 0.07, 0.2, 0.26, 0.18, 0.12, 0, -0.18);

    // Triceps (back of upper arm)
    addPart(root, muscleMeshes, 'triceps', capsule, -0.44, 0.88, -0.05, 0.18, 0.28, 0.16, 0.15, 0, 0.15);
    addPart(root, muscleMeshes, 'triceps', capsule, 0.44, 0.88, -0.05, 0.18, 0.28, 0.16, 0.15, 0, -0.15);

    // Forearms
    addPart(root, muscleMeshes, 'forearms', capsule, -0.5, 0.52, 0.03, 0.16, 0.28, 0.14, 0.28, 0, 0.12);
    addPart(root, muscleMeshes, 'forearms', capsule, 0.5, 0.52, 0.03, 0.16, 0.28, 0.14, 0.28, 0, -0.12);

    // Quads
    addPart(root, muscleMeshes, 'quads', capsule, -0.13, 0.14, 0.07, 0.24, 0.4, 0.22);
    addPart(root, muscleMeshes, 'quads', capsule, 0.13, 0.14, 0.07, 0.24, 0.4, 0.22);
    addPart(root, muscleMeshes, 'quads', sphere, -0.13, -0.1, 0.08, 0.13, 0.14, 0.12);
    addPart(root, muscleMeshes, 'quads', sphere, 0.13, -0.1, 0.08, 0.13, 0.14, 0.12);

    // Hamstrings / glutes (posterior) — app id covers both
    addPart(root, muscleMeshes, 'hamstrings', sphere, -0.11, 0.34, -0.1, 0.15, 0.13, 0.13);
    addPart(root, muscleMeshes, 'hamstrings', sphere, 0.11, 0.34, -0.1, 0.15, 0.13, 0.13);
    addPart(root, muscleMeshes, 'hamstrings', capsule, -0.13, 0.06, -0.07, 0.22, 0.36, 0.2);
    addPart(root, muscleMeshes, 'hamstrings', capsule, 0.13, 0.06, -0.07, 0.22, 0.36, 0.2);

    // Adductors (inner thigh)
    addPart(root, muscleMeshes, 'adductors', capsule, -0.04, 0.12, 0.02, 0.12, 0.3, 0.12);
    addPart(root, muscleMeshes, 'adductors', capsule, 0.04, 0.12, 0.02, 0.12, 0.3, 0.12);

    // Calves
    addPart(root, muscleMeshes, 'calves', sphere, -0.13, -0.4, -0.02, 0.11, 0.16, 0.12);
    addPart(root, muscleMeshes, 'calves', sphere, 0.13, -0.4, -0.02, 0.11, 0.16, 0.12);
    addPart(root, muscleMeshes, 'calves', capsule, -0.13, -0.6, 0, 0.14, 0.2, 0.12);
    addPart(root, muscleMeshes, 'calves', capsule, 0.13, -0.6, 0, 0.14, 0.2, 0.12);

    // Feet (neutral)
    const footL = new THREE.Mesh(box, makeMat(BASE_COLOR, 0));
    footL.position.set(-0.14, -0.88, 0.06);
    footL.scale.set(0.14, 0.06, 0.28);
    footL.userData.muscle = null;
    root.add(footL);
    const footR = footL.clone();
    footR.position.x = 0.14;
    root.add(footR);

    return muscleMeshes;
  }

  function buildPedestal(parent) {
    const group = new THREE.Group();
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.9, metalness: 0.05, emissive: hexToInt(MINT), emissiveIntensity: 0.15 }),
      new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.92, metalness: 0.04, emissive: hexToInt(MINT), emissiveIntensity: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x08080e, roughness: 0.95, metalness: 0.02, emissive: hexToInt(MINT), emissiveIntensity: 0.08 }),
    ];
    const tiers = [
      { y: -1.02, r: 0.55, h: 0.06 },
      { y: -1.1, r: 0.72, h: 0.06 },
      { y: -1.18, r: 0.9, h: 0.06 },
    ];
    tiers.forEach((t, i) => {
      const geo = new THREE.CylinderGeometry(t.r, t.r * 1.05, t.h, 48);
      const mesh = new THREE.Mesh(geo, mats[i]);
      mesh.position.y = t.y;
      group.add(mesh);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(t.r * 0.98, 0.012, 8, 48),
        new THREE.MeshBasicMaterial({ color: hexToInt(MINT) })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = t.y + t.h * 0.45;
      group.add(rim);
    });
    parent.add(group);
    return group;
  }

  function intensityFromLoad(load) {
    if (!load || load <= 0) return 0;
    return Math.max(0.15, Math.min(1.35, 0.25 + load * 0.28));
  }

  function recoveryVisual(pct, hasData) {
    if (!hasData) return { color: BASE_COLOR, intensity: 0.05 };
    if (pct < 40) return { color: CORAL, intensity: 0.95 };
    if (pct < 95) return { color: AMBER, intensity: 0.7 };
    return { color: MINT, intensity: 0.55 };
  }

  function applyColors(state) {
    const { muscleMeshes, colorMode, data, showPedestal } = state;
    MUSCLE_IDS.forEach((id) => {
      const meshes = muscleMeshes.get(id) || [];
      let color = BASE_COLOR;
      let intensity = 0.04;

      if (colorMode === 'recovery') {
        const r = data && data.recovery && data.recovery[id];
        const hasData = !!(r && r.lastDate !== null && r.lastDate !== undefined);
        const pct = hasData ? (r.recoveryPct ?? 100) : 100;
        const vis = recoveryVisual(pct, hasData);
        color = vis.color;
        intensity = vis.intensity;
      } else {
        // intensity / complete — only worked muscles glow
        const load = (data && data.loads && data.loads[id]) || 0;
        if (load > 0) {
          color = CORAL;
          intensity = intensityFromLoad(load);
          if (colorMode === 'complete') intensity *= 1.15;
        } else {
          color = BASE_COLOR;
          intensity = showPedestal ? 0.06 : 0.04;
        }
      }

      meshes.forEach((mesh) => {
        const mat = mesh.material;
        mat.color.setHex(hexToInt(BASE_COLOR));
        mat.emissive.setHex(hexToInt(color));
        mat.emissiveIntensity = intensity;
        mat.needsUpdate = true;
      });
    });
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

  function formatRecoveryTip(muscle, data) {
    const label = EN_LABELS[muscle] || muscle;
    const r = data && data.recovery && data.recovery[muscle];
    if (!r || r.lastDate == null) {
      return `<strong>${escapeHtml(label)}</strong> · No data`;
    }
    const pct = Math.round(r.recoveryPct || 0);
    let hoursLeft = null;
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getHoursUntilReady) {
      hoursLeft = MuscleHeatmap.getHoursUntilReady(muscle, data.recovery);
    } else {
      hoursLeft = Math.max(0, Math.round((r.recoveryHours || 0) - (r.hoursElapsed || 0)));
    }
    if (pct < 40) {
      return `${escapeHtml(label)} · Fatigued${hoursLeft > 0 ? ` · ${hoursLeft}h to recover` : ''}`;
    }
    if (pct < 95) {
      return `${escapeHtml(label)} · Recovering${hoursLeft > 0 ? ` · ${hoursLeft}h to recover` : ''}`;
    }
    return `${escapeHtml(label)} · Ready`;
  }

  function formatIntensityTip(muscle, data) {
    const label = EN_LABELS[muscle] || muscle;
    const load = (data && data.loads && data.loads[muscle]) || 0;
    if (load <= 0) return `${escapeHtml(label)} · Idle`;
    const sets = data && data.setCounts && data.setCounts[muscle];
    if (sets != null) return `+${escapeHtml(String(sets))} sets · ${escapeHtml(label)}`;
    const n = Math.max(1, Math.round(load * 2.2));
    return `+${n} sets · ${escapeHtml(label)}`;
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
      const m = hits[i].object && hits[i].object.userData && hits[i].object.userData.muscle;
      if (m) return m;
    }
    return null;
  }

  function onPointerDown(state, e) {
    state.dragging = true;
    state.lastX = (e.clientX != null)
      ? e.clientX
      : ((e.touches && e.touches[0] && e.touches[0].clientX) || 0);
    state.pointerMoved = 0;
    if (state.hintEl) state.hintEl.classList.add('is-faded');
    e.preventDefault();
  }

  function onPointerMove(state, e) {
    if (!state.dragging) return;
    const x = (e.clientX != null)
      ? e.clientX
      : ((e.touches && e.touches[0] && e.touches[0].clientX) || 0);
    const dx = x - state.lastX;
    state.lastX = x;
    state.pointerMoved += Math.abs(dx);
    state.targetYaw += dx * 0.01;
    e.preventDefault();
  }

  function onPointerUp(state, e) {
    if (!state.dragging) return;
    state.dragging = false;
    const clientX = e.clientX ?? (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX);
    const clientY = e.clientY ?? (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY);
    if (state.pointerMoved < 8 && clientX != null) {
      const muscle = pickMuscle(state, clientX, clientY);
      if (muscle) {
        const html = state.colorMode === 'recovery'
          ? formatRecoveryTip(muscle, state.data)
          : formatIntensityTip(muscle, state.data);
        showTip(state, html);
        if (typeof state.onMuscleTap === 'function') state.onMuscleTap(muscle);
      }
    }
  }

  function bindPointer(state) {
    const el = state.canvasWrap;
    const down = (e) => onPointerDown(state, e.touches ? e.touches[0] : e);
    const move = (e) => onPointerMove(state, e.touches ? e.touches[0] : e);
    const up = (e) => onPointerUp(state, e.changedTouches ? e.changedTouches[0] : e);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('touchstart', (e) => { if (e.touches[0]) down(e); }, { passive: false });
    el.addEventListener('touchmove', (e) => { if (e.touches[0]) move(e); }, { passive: false });
    el.addEventListener('touchend', (e) => { up(e); }, { passive: false });
    state._unbind = () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
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
      const breathe = 1 + Math.sin(state.breath) * 0.012;
      if (state.root) state.root.scale.set(breathe, breathe, breathe);
      if (!state.dragging && state.autoRotate) {
        state.targetYaw += state.showPedestal ? 0.006 : 0.0035;
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
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      state.scene = null;
    }
    state.root = null;
    state.pedestal = null;
    state.camera = null;
    state.muscleMeshes = new Map();
  }

  async function createScene(state) {
    await loadThree();
    if (state.disposed) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(hexToInt(BG));

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0, 0.45, 3.55);
    camera.lookAt(0, 0.35, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(hexToInt(BG), 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    state.canvasWrap.appendChild(renderer.domElement);

    // Lighting — soft fill + rim
    const ambient = new THREE.AmbientLight(0x6a6a78, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(1.2, 2.2, 2.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8c4ff, 0.85);
    rim.position.set(-1.8, 1.2, -2.2);
    scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0xffc8b0, 0.35);
    rim2.position.set(2.0, 0.4, -1.2);
    scene.add(rim2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(0, -1.5, 1.5);
    scene.add(fill);

    const root = new THREE.Group();
    root.position.y = -0.05;
    scene.add(root);
    const muscleMeshes = buildProceduralFigure(root);

    let pedestal = null;
    if (state.showPedestal) {
      pedestal = buildPedestal(scene);
      root.position.y = 0.05;
    }

    // Accent energy rings on complete
    if (state.showPedestal) {
      const ringMat1 = new THREE.MeshBasicMaterial({ color: hexToInt(CORAL), transparent: true, opacity: 0.55 });
      const ringMat2 = new THREE.MeshBasicMaterial({ color: hexToInt(MINT), transparent: true, opacity: 0.45 });
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.012, 8, 64), ringMat1);
      r1.position.set(0, 0.75, 0);
      r1.rotation.x = Math.PI / 2.4;
      scene.add(r1);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.01, 8, 64), ringMat2);
      r2.position.set(0, 0.45, 0);
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
    state.yaw = preferBack ? Math.PI : (state.showPedestal ? 0.5 : 0.35);
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
        <div class="bm3-loading">Loading 3D…</div>
        <div class="bm3-tip" aria-live="polite"></div>
        <div class="bm3-hint">
          <div class="bm3-hint-ring" aria-hidden="true">↻</div>
          <div class="bm3-hint-text">Drag to rotate</div>
        </div>`;
      host.appendChild(stage);
    }
    return stage;
  }

  /**
   * Mount or remount a 3D view into host.
   * @param {string} id unique mount id
   * @param {HTMLElement} host
   * @param {object} options
   */
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
    /** @type {MountState} */
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
      lastX: 0,
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
      console.warn('[BodyMap3D] failed to mount', err);
      host.innerHTML = `<div class="bm3-fallback">Could not load 3D. Falling back to 2D.</div>`;
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
    applyColors(state);
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
      btn.addEventListener('click', (e) => {
        e.preventDefault();
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
    CORAL,
    AMBER,
    MINT,
    getPreferredMode,
    setPreferredMode,
    isWebGLAvailable,
    buildModeToggle,
    bindModeToggle,
    mount,
    update,
    unmount,
    unmountAll,
    loadThree,
    getEnglishLabel,
    ensureStyles,
    intensityFromLoad,
    recoveryVisual,
  };
})();

if (typeof window !== 'undefined') {
  window.BodyMap3D = BodyMap3D;
}
