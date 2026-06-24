#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');

console.log('=== 1. HTML 템플릿: 무게 모드 초기 display:none 없음 ===');
assert(
  !appJs.includes("style=\"${isDuration ? '' : 'display:none'}\"}>${isDuration ? '+ 시간 세트 추가' : '+ 세트 추가'}"),
  'add-set-btn에 무게 모드 display:none 조건이 남아 있음'
);
assert(
  appJs.includes('<button class="add-set-btn">${isDuration ? \'+ 시간 세트 추가\' : \'+ 세트 추가\'}</button>'),
  'add-set-btn 템플릿이 올바르지 않음'
);

console.log('=== 2. CSS: add-set-btn 숨김 규칙 없음 ===');
const addSetCss = indexHtml.match(/\.add-set-btn\s*\{[^}]+\}/);
assert(!!addSetCss, '.add-set-btn CSS 블록 없음');
assert(!/display\s*:\s*none/.test(addSetCss[0]), '.add-set-btn CSS에 display:none 있음');
assert(
  !indexHtml.includes('.add-set-btn:') || !indexHtml.match(/\.add-set-btn[^{]*\{[^}]*display\s*:\s*none/),
  'add-set-btn 관련 CSS 숨김 규칙 있음'
);

console.log('=== 3. setRowMode: 무게/시간 모드 모두 버튼 표시 ===');
const setRowModeBlock = appJs.slice(appJs.indexOf('function setRowMode'), appJs.indexOf('function showSuggestions'));
assert(setRowModeBlock.includes('addSetBtn.style.display = \'\';'), 'setRowMode에서 addSetBtn 표시 처리 없음');
const displayCount = (setRowModeBlock.match(/addSetBtn\.style\.display = '';/g) || []).length;
assert(displayCount >= 2, 'setRowMode 무게/시간 분기 모두에서 버튼 표시 필요');

console.log('=== 4. addExerciseRow: 초기화 후 setRowMode 호출 ===');
const addExerciseBlock = appJs.slice(appJs.indexOf('function addExerciseRow'), appJs.indexOf('function addSetRow'));
assert(addExerciseBlock.includes('setRowMode(row, durationActive);'), 'addExerciseRow 끝에서 setRowMode 미호출');

console.log('=== 5. Service Worker: 캐시 갱신 + app.js 네트워크 우선 ===');
assert(swJs.includes('recovr-cache-v23'), 'SW 캐시 버전이 v23이 아님');
assert(swJs.includes('NETWORK_FIRST_PATHS'), 'SW 네트워크 우선 목록 없음');
assert(swJs.includes('/app.js'), 'SW가 app.js를 네트워크 우선 대상으로 포함하지 않음');
assert(appJs.includes('reg.update()'), '앱 로드 시 SW update() 호출 없음');

console.log(failures === 0 ? '\n=== ALL PASSED ✓ (5/5) ===' : `\n=== ${failures} FAILED ===`);
process.exit(failures === 0 ? 0 : 1);
