// ============================================================
// RECOVR - BodyMapPose (independent Stage 3 module)
//
// Practical route: segment-based rigid FK (NOT full skinning).
// Why: muscles-body.glb is 221 static Mesh parts with no skins/clips.
// Auto-skinning every mesh to a humanoid skeleton is CPU-heavy on mobile
// (many SkinnedMesh updates) and fights per-mesh glow shells. A vendored
// Mixamo base would replace the CC BY-SA anatomical asset. Region pivots
// + bind-pose FK keep the GLB size unchanged, leave meshes parented so
// glow shells stay attached, and tween cheaply while targeting ≥50 FPS.
//
// Fallback: if attach fails, the figure stays in the authored static pose.
// ============================================================

const BodyMapPose = (() => {
  const POSE_MS = 600;
  const POSE_IDS = ['relaxed', 'flex', 'slump', 'ready', 'victory'];

  // Euler degrees per segment (applied as FK around joint pivots)
  const POSES = {
    relaxed: {
      torso: { x: 2, y: 0, z: 0 },
      shoulder_L: { x: 4, y: 0, z: 8 },
      shoulder_R: { x: 4, y: 0, z: -8 },
      upperArm_L: { x: 6, y: 0, z: 14 },
      upperArm_R: { x: 6, y: 0, z: -14 },
      forearm_L: { x: -8, y: 0, z: 0 },
      forearm_R: { x: -8, y: 0, z: 0 },
      thigh_L: { x: -2, y: 0, z: 3 },
      thigh_R: { x: -2, y: 0, z: -3 },
      calf_L: { x: 4, y: 0, z: 0 },
      calf_R: { x: 4, y: 0, z: 0 },
    },
    flex: {
      torso: { x: -6, y: 0, z: 0 },
      shoulder_L: { x: -18, y: -22, z: 28 },
      shoulder_R: { x: -18, y: 22, z: -28 },
      upperArm_L: { x: -35, y: -40, z: 100 },
      upperArm_R: { x: -35, y: 40, z: -100 },
      forearm_L: { x: -135, y: 18, z: 0 },
      forearm_R: { x: -135, y: -18, z: 0 },
      thigh_L: { x: 0, y: 0, z: 8 },
      thigh_R: { x: 0, y: 0, z: -8 },
      calf_L: { x: 2, y: 0, z: 0 },
      calf_R: { x: 2, y: 0, z: 0 },
    },
    slump: {
      torso: { x: 18, y: 0, z: 0 },
      shoulder_L: { x: 22, y: 10, z: 6 },
      shoulder_R: { x: 22, y: -10, z: -6 },
      upperArm_L: { x: 18, y: 12, z: 30 },
      upperArm_R: { x: 18, y: -12, z: -30 },
      forearm_L: { x: -24, y: 0, z: 0 },
      forearm_R: { x: -24, y: 0, z: 0 },
      thigh_L: { x: 8, y: 0, z: 5 },
      thigh_R: { x: 8, y: 0, z: -5 },
      calf_L: { x: 14, y: 0, z: 0 },
      calf_R: { x: 14, y: 0, z: 0 },
    },
    ready: {
      torso: { x: -3, y: 0, z: 0 },
      shoulder_L: { x: 0, y: -6, z: 16 },
      shoulder_R: { x: 0, y: 6, z: -16 },
      upperArm_L: { x: 10, y: 0, z: 36 },
      upperArm_R: { x: 10, y: 0, z: -36 },
      forearm_L: { x: -36, y: 0, z: 0 },
      forearm_R: { x: -36, y: 0, z: 0 },
      thigh_L: { x: -10, y: 0, z: 6 },
      thigh_R: { x: -10, y: 0, z: -6 },
      calf_L: { x: 16, y: 0, z: 0 },
      calf_R: { x: 16, y: 0, z: 0 },
    },
    victory: {
      torso: { x: -10, y: 0, z: 0 },
      shoulder_L: { x: -28, y: -18, z: 28 },
      shoulder_R: { x: -28, y: 18, z: -28 },
      upperArm_L: { x: -165, y: -8, z: 42 },
      upperArm_R: { x: -165, y: 8, z: -42 },
      forearm_L: { x: -25, y: 0, z: 0 },
      forearm_R: { x: -25, y: 0, z: 0 },
      thigh_L: { x: 0, y: 0, z: 10 },
      thigh_R: { x: 0, y: 0, z: -10 },
      calf_L: { x: 0, y: 0, z: 0 },
      calf_R: { x: 0, y: 0, z: 0 },
    },
  };

  const SEGMENT_ORDER = [
    'torso',
    'shoulder_L', 'shoulder_R',
    'upperArm_L', 'upperArm_R',
    'forearm_L', 'forearm_R',
    'thigh_L', 'thigh_R',
    'calf_L', 'calf_R',
  ];

  // Root→leaf chains so child segments inherit parent joint rotations
  const CHAINS = {
    torso: ['torso'],
    shoulder_L: ['torso', 'shoulder_L'],
    shoulder_R: ['torso', 'shoulder_R'],
    upperArm_L: ['torso', 'shoulder_L', 'upperArm_L'],
    upperArm_R: ['torso', 'shoulder_R', 'upperArm_R'],
    forearm_L: ['torso', 'shoulder_L', 'upperArm_L', 'forearm_L'],
    forearm_R: ['torso', 'shoulder_R', 'upperArm_R', 'forearm_R'],
    thigh_L: ['thigh_L'],
    thigh_R: ['thigh_R'],
    calf_L: ['thigh_L', 'calf_L'],
    calf_R: ['thigh_R', 'calf_R'],
  };

  function degToRad(d) {
    return (d || 0) * Math.PI / 180;
  }

  function poseFromColorMode(colorMode, mountId) {
    if (mountId === 'complete' || colorMode === 'complete') return 'victory';
    if (mountId === 'live' || colorMode === 'intensity') return 'ready';
    if (colorMode === 'growth') return 'flex';
    if (colorMode === 'loss') return 'slump';
    if (colorMode === 'recovery') return 'relaxed';
    return 'relaxed';
  }

  function sideOfName(name) {
    const n = String(name || '');
    if (/_left/i.test(n)) return 'L';
    if (/_right/i.test(n)) return 'R';
    return 'C';
  }

  function atlasKeyOf(mesh) {
    if (mesh.userData && mesh.userData.atlasKey) return String(mesh.userData.atlasKey);
    return String(mesh.name || '')
      .replace(/__mobile(\.\d+)?$/i, '')
      .replace(/_(left|right)$/i, '')
      .trim();
  }

  function classifyMesh(mesh) {
    const key = atlasKeyOf(mesh).toLowerCase();
    const side = sideOfName(mesh.name);
    const S = side === 'C' ? null : side;

    if (/deltoid|supraspinatus|infraspinatus|subscapularis|teres_/.test(key)) {
      return S ? `shoulder_${S}` : 'torso';
    }
    if (/biceps_brachii|brachialis|coracobrachialis|triceps_/.test(key)) {
      return S ? `upperArm_${S}` : null;
    }
    if (/flexor_|extensor_|pronator|supinator|anconeus|palmaris|brachioradialis|abductor_pollicis|opponens/.test(key)) {
      return S ? `forearm_${S}` : null;
    }
    if (/gastroc|soleus|tibialis|peroneus|fibularis|flexor_digitorum_longus|flexor_hallucis|extensor_digitorum_longus|extensor_hallucis|plantaris/.test(key)) {
      return S ? `calf_${S}` : null;
    }
    if (/glute|quadriceps|vastus|rectus_femoris|sartorius|biceps_femoris|semitendinosus|semimembranosus|adductor|gracilis|pectineus|tensor_fascia|piriformis|obturator|gemellus|quadratus_femoris|popliteus/.test(key)) {
      return S ? `thigh_${S}` : null;
    }
    if (/pectoralis|serratus_anterior|trapezius|latissimus|rhomboid|levator_scapulae|serratus_posterior|iliocostalis|longissimus|spinalis|multifidus|quadratus_lumborum|rectus_abdominis|oblique|transversus|pyramidalis|psoas|iliacus|scalenus|splenius|sternocleidomastoid/.test(key)) {
      return 'torso';
    }
    return null;
  }

  function easeInOut(t) {
    return t * t * (3 - 2 * t);
  }

  function eulerFromPose(posePart) {
    const p = posePart || { x: 0, y: 0, z: 0 };
    return { x: degToRad(p.x), y: degToRad(p.y), z: degToRad(p.z) };
  }

  function collectMeshes(root, THREE) {
    const out = [];
    if (!root || !root.traverse) return out;
    root.traverse((obj) => {
      if (!obj || !obj.isMesh) return;
      if (obj.userData && (obj.userData.glowShell || obj.userData.isGlowShell)) return;
      if (THREE && obj.material && obj.material.blending === THREE.AdditiveBlending
        && obj.material.side === THREE.BackSide) {
        return;
      }
      out.push(obj);
    });
    return out;
  }

  function boxCenter(THREE, meshes) {
    const box = new THREE.Box3();
    meshes.forEach((m) => box.expandByObject(m));
    if (box.isEmpty()) return new THREE.Vector3(0, 1, 0);
    return box.getCenter(new THREE.Vector3());
  }

  function boxOf(THREE, meshes) {
    const box = new THREE.Box3();
    meshes.forEach((m) => box.expandByObject(m));
    return box;
  }

  /**
   * Apply FK: for each mesh, walk its segment chain and rotate the full bind
   * matrix around each joint pivot. Meshes stay under original parents so glow
   * shells remain attached. Uses matrixAutoUpdate=false while posed.
   */
  function applyFk(controller, weights, THREE) {
    const { binds, pivots } = controller;
    const rotMats = {};
    SEGMENT_ORDER.forEach((seg) => {
      const w = weights[seg] || { x: 0, y: 0, z: 0 };
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(w.x, w.y, w.z, 'XYZ'));
      rotMats[seg] = new THREE.Matrix4().makeRotationFromQuaternion(q);
    });

    const T = new THREE.Matrix4();
    const Tn = new THREE.Matrix4();
    const scratch = new THREE.Matrix4();
    const invParent = new THREE.Matrix4();
    const M = new THREE.Matrix4();

    binds.forEach((b) => {
      const chain = CHAINS[b.seg];
      if (!chain || !b.mesh.parent) return;
      M.copy(b.matrixWorld);
      chain.forEach((seg) => {
        const pivot = pivots[seg];
        const R = rotMats[seg];
        if (!pivot || !R) return;
        T.makeTranslation(pivot.x, pivot.y, pivot.z);
        Tn.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
        // M = T(pivot) * R * T(-pivot) * M
        scratch.copy(T).multiply(R).multiply(Tn).multiply(M);
        M.copy(scratch);
      });
      b.mesh.matrixAutoUpdate = false;
      b.mesh.parent.updateWorldMatrix(true, false);
      invParent.copy(b.mesh.parent.matrixWorld).invert();
      b.mesh.matrix.copy(invParent).multiply(M);
      b.mesh.updateMatrixWorld(true);
    });
  }

  function attach(state, THREE) {
    if (!state || !state.root || !THREE) return null;
    try {
      state.root.updateMatrixWorld(true);
      const meshes = collectMeshes(state.root, THREE);
      if (meshes.length < 20) return null;

      const binds = [];
      const bySeg = {};
      SEGMENT_ORDER.forEach((id) => { bySeg[id] = []; });

      meshes.forEach((mesh) => {
        const seg = classifyMesh(mesh);
        if (!seg || !bySeg[seg]) return;
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        mesh.matrixWorld.decompose(p, q, s);
        const bind = {
          mesh,
          seg,
          p,
          q,
          s,
          matrixWorld: mesh.matrixWorld.clone(),
          autoUpdate: mesh.matrixAutoUpdate !== false,
        };
        binds.push(bind);
        bySeg[seg].push(bind);
      });

      if ((bySeg.upperArm_L.length + bySeg.upperArm_R.length) === 0) return null;

      const pivots = {};
      {
        const torsoMeshes = bySeg.torso.map((b) => b.mesh);
        const c = torsoMeshes.length ? boxCenter(THREE, torsoMeshes) : new THREE.Vector3(0, 1.2, 0);
        pivots.torso = new THREE.Vector3(0, c.y, c.z * 0.15);
      }
      ['L', 'R'].forEach((S) => {
        const sh = bySeg[`shoulder_${S}`].map((b) => b.mesh);
        const ua = bySeg[`upperArm_${S}`].map((b) => b.mesh);
        const fa = bySeg[`forearm_${S}`].map((b) => b.mesh);
        const th = bySeg[`thigh_${S}`].map((b) => b.mesh);
        const ca = bySeg[`calf_${S}`].map((b) => b.mesh);
        const shBox = sh.length ? boxOf(THREE, sh) : null;
        const uaBox = ua.length ? boxOf(THREE, ua) : null;
        const faBox = fa.length ? boxOf(THREE, fa) : null;
        const thBox = th.length ? boxOf(THREE, th) : null;
        const caBox = ca.length ? boxOf(THREE, ca) : null;
        const xSign = S === 'L' ? 1 : -1;

        const shoulderY = shBox ? (shBox.min.y * 0.35 + shBox.max.y * 0.65) : (uaBox ? uaBox.max.y : 1.55);
        const shoulderX = shBox ? boxCenter(THREE, sh).x : (uaBox ? boxCenter(THREE, ua).x : 0.18 * xSign);
        pivots[`shoulder_${S}`] = new THREE.Vector3(shoulderX, shoulderY, 0);
        pivots[`upperArm_${S}`] = new THREE.Vector3(shoulderX, shoulderY, 0);

        const elbowY = uaBox && faBox
          ? (uaBox.min.y * 0.55 + faBox.max.y * 0.45)
          : (uaBox ? uaBox.min.y : 1.15);
        const elbowX = uaBox ? boxCenter(THREE, ua).x : shoulderX;
        pivots[`forearm_${S}`] = new THREE.Vector3(elbowX, elbowY, 0);

        const hipY = thBox ? thBox.max.y : 0.95;
        const hipX = thBox ? boxCenter(THREE, th).x : 0.08 * xSign;
        pivots[`thigh_${S}`] = new THREE.Vector3(hipX, hipY, 0);

        const kneeY = thBox && caBox
          ? (thBox.min.y * 0.5 + caBox.max.y * 0.5)
          : (thBox ? thBox.min.y : 0.5);
        const kneeX = caBox ? boxCenter(THREE, ca).x : hipX;
        pivots[`calf_${S}`] = new THREE.Vector3(kneeX, kneeY, 0);
      });

      const zero = {};
      SEGMENT_ORDER.forEach((seg) => { zero[seg] = { x: 0, y: 0, z: 0 }; });

      const controller = {
        enabled: true,
        poseId: 'relaxed',
        binds,
        pivots,
        weights: zero,
        tween: null,
        THREE,
      };

      // Verify FK identity leaves bind height intact
      applyFk(controller, zero, THREE);
      const sample = bySeg.shoulder_L[0] || bySeg.torso[0];
      if (sample) {
        const now = new THREE.Vector3();
        sample.mesh.updateWorldMatrix(true, false);
        sample.mesh.getWorldPosition(now);
        if (Math.abs(now.y - sample.p.y) > 0.2) {
          throw new Error(`pose FK drift ${sample.mesh.name}: ${sample.p.y.toFixed(2)} → ${now.y.toFixed(2)}`);
        }
      }

      setPoseOnController(controller, poseFromColorMode(state.colorMode, state.id), { duration: 0 });
      state.poseController = controller;
      return controller;
    } catch (err) {
      console.warn('[BodyMapPose] attach failed — static pose fallback', err);
      state.poseController = null;
      return null;
    }
  }

  function setPoseOnController(controller, poseId, opts) {
    if (!controller || !controller.enabled) return false;
    const id = POSE_IDS.indexOf(poseId) >= 0 ? poseId : 'relaxed';
    const pose = POSES[id] || POSES.relaxed;
    const duration = opts && opts.duration != null ? opts.duration : POSE_MS;
    const reduce = opts && opts.reducedMotion;
    const THREE = controller.THREE;

    const from = {};
    const to = {};
    SEGMENT_ORDER.forEach((seg) => {
      from[seg] = Object.assign({}, controller.weights[seg] || { x: 0, y: 0, z: 0 });
      to[seg] = eulerFromPose(pose[seg]);
    });

    controller.poseId = id;
    if (reduce || duration <= 0) {
      controller.weights = to;
      applyFk(controller, to, THREE);
      controller.tween = null;
      return true;
    }

    controller.tween = {
      start: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      duration,
      from,
      to,
    };
    return true;
  }

  function setPose(state, poseId, opts) {
    if (!state || !state.poseController) return false;
    return setPoseOnController(state.poseController, poseId, opts);
  }

  function update(state, now) {
    const c = state && state.poseController;
    if (!c || !c.tween) return;
    const t = Math.min(1, (now - c.tween.start) / c.tween.duration);
    const e = easeInOut(t);
    const weights = {};
    SEGMENT_ORDER.forEach((seg) => {
      const a = c.tween.from[seg] || { x: 0, y: 0, z: 0 };
      const b = c.tween.to[seg] || { x: 0, y: 0, z: 0 };
      weights[seg] = {
        x: a.x + (b.x - a.x) * e,
        y: a.y + (b.y - a.y) * e,
        z: a.z + (b.z - a.z) * e,
      };
    });
    c.weights = weights;
    applyFk(c, weights, c.THREE);
    if (t >= 1) c.tween = null;
  }

  function dispose(state) {
    if (!state || !state.poseController) return;
    const c = state.poseController;
    try {
      if (c.THREE && c.binds) {
        const zero = {};
        SEGMENT_ORDER.forEach((seg) => { zero[seg] = { x: 0, y: 0, z: 0 }; });
        applyFk(c, zero, c.THREE);
        c.binds.forEach((b) => {
          if (b.mesh) b.mesh.matrixAutoUpdate = b.autoUpdate !== false;
        });
      }
    } catch (e) { /* ignore */ }
    c.enabled = false;
    c.tween = null;
    state.poseController = null;
  }

  return {
    POSE_MS,
    POSE_IDS,
    POSES,
    SEGMENT_ORDER,
    CHAINS,
    poseFromColorMode,
    classifyMesh,
    atlasKeyOf,
    attach,
    setPose,
    update,
    dispose,
    easeInOut,
    eulerFromPose,
  };
})();

if (typeof window !== 'undefined') {
  window.BodyMapPose = BodyMapPose;
}
