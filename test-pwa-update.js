#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(swJs.includes("event.data?.type === 'SKIP_WAITING'"), 'sw.js SKIP_WAITING handler');
const installBlock = swJs.match(/addEventListener\('install'[\s\S]*?\}\);/);
assert(installBlock && !installBlock[0].includes('skipWaiting'), 'install handler should not auto skipWaiting');

const PwaUpdate = new Function(
  fs.readFileSync(path.join(__dirname, 'pwaUpdate.js'), 'utf8') + '; return PwaUpdate;'
)();

assert(typeof PwaUpdate.init === 'function', 'init exists');
assert(typeof PwaUpdate.apply === 'function', 'apply exists');
assert(typeof PwaUpdate.dismiss === 'function', 'dismiss exists');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(appJs.includes('PwaUpdate.init(reg)'), 'app.js wires PwaUpdate');

console.log(failures === 0 ? 'PwaUpdate tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
