#!/usr/bin/env node
'use strict';

/**
 * Every tappable Z-Anatomy mesh (KEY_TO_APP) must resolve to a Korean gym label.
 * No English / atlas-key fallbacks in tip UI.
 */

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

const root = __dirname;
const keyToApp = JSON.parse(
  fs.readFileSync(path.join(root, 'vendor/anatomy/KEY_TO_APP.json'), 'utf8')
);
const src = fs.readFileSync(path.join(root, 'bodyMap3d.js'), 'utf8');

const BodyMap3D = new Function(`${src}; return BodyMap3D;`)();

console.log('=== 1. KO_LABELS surface ===');
assert(BodyMap3D.KO_LABELS, 'KO_LABELS exported');
assert(BodyMap3D.KO_LABELS === BodyMap3D.EN_LABELS, 'EN_LABELS aliases KO_LABELS');
const requiredKo = {
  chest: '가슴',
  shoulder: '어깨',
  front_delts: '어깨(전면)',
  side_delts: '어깨(측면)',
  rear_delts: '어깨(후면)',
  biceps: '이두',
  triceps: '삼두',
  forearms: '전완',
  lats: '광배',
  traps: '승모근',
  abs: '복근',
  core: '복근',
  obliques: '복사근',
  glutes: '둔근',
  quads: '대퇴사두',
  hamstrings: '햄스트링',
  adductors: '내전근',
  calves: '종아리',
  lower_back: '기립근',
};
Object.keys(requiredKo).forEach((id) => {
  assert(BodyMap3D.KO_LABELS[id] === requiredKo[id], `${id} → ${requiredKo[id]}`);
});

console.log('=== 2. No tappable mesh falls back to English ===');
assert(typeof BodyMap3D.auditTappableLabels === 'function', 'auditTappableLabels');
const missing = BodyMap3D.auditTappableLabels(keyToApp);
assert(missing.length === 0, `all atlas keys Korean (${missing.length} missing: ${JSON.stringify(missing.slice(0, 5))})`);

const atlasKeys = Object.keys(keyToApp);
assert(atlasKeys.length > 50, `KEY_TO_APP has ${atlasKeys.length} meshes`);
atlasKeys.forEach((atlasKey) => {
  const ids = keyToApp[atlasKey];
  const primary = BodyMap3D.pickPrimaryId(ids);
  const label = BodyMap3D.labelForMuscle(primary);
  assert(!!label, `${atlasKey} has label`);
  assert(/[\uac00-\ud7a3]/.test(label), `${atlasKey} → Korean (${label})`);
  assert(!/[A-Za-z]/.test(label), `${atlasKey} has no Latin letters (${label})`);
  assert(label !== atlasKey, `${atlasKey} does not fall back to atlas key`);
});

console.log('=== 3. Lateral delts map to 어깨(측면) ===');
assert(
  Array.isArray(keyToApp.deltoid_lateral)
    && keyToApp.deltoid_lateral.includes('side_delts'),
  'deltoid_lateral → side_delts'
);
assert(
  BodyMap3D.pickPrimaryId(keyToApp.deltoid_lateral) === 'side_delts',
  'lateral delts primary = side_delts'
);
assert(
  BodyMap3D.labelForMuscle(BodyMap3D.pickPrimaryId(keyToApp.deltoid_lateral)) === '어깨(측면)',
  'lateral tip = 어깨(측면)'
);

console.log('=== 4. Tip formatters use Korean (no Idle/Chest) ===');
assert(!src.includes("'Idle'"), 'Idle English tip removed');
assert(!src.includes('"Idle"'), 'Idle English tip removed (dbl)');
assert(src.includes('자극 없음'), 'Korean idle tip');
assert(src.includes('세트'), 'Korean sets wording');
assert(!/EN_LABELS\s*=\s*\{[^}]*Chest/.test(src), 'no English Chest in labels map');
assert(src.includes("chest: '가슴'"), '가슴 in source');

console.log(failures === 0 ? '\n=== 3D Korean label tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
