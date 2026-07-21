#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const created = [];
function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    children: [],
    parentNode: null,
    style: {},
    innerHTML: '',
    textContent: '',
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    prepend(child) {
      child.parentNode = this;
      this.children.unshift(child);
      return child;
    },
    querySelector(sel) {
      if (sel === '[data-action="restore"]' || sel === '[data-action="dismiss"]') {
        return {
          addEventListener() {},
          textContent: '',
        };
      }
      return null;
    },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); el.className = [...this._s].join(' '); },
      remove(c) { this._s.delete(c); el.className = [...this._s].join(' '); },
      contains(c) { return this._s.has(c); },
    },
  };
  created.push(el);
  return el;
}

const body = makeEl('body');
const head = makeEl('head');
global.document = {
  body,
  head,
  getElementById(id) {
    return created.find((e) => e.id === id) || null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    return el;
  },
};
body.prepend = function prepend(child) {
  child.parentNode = this;
  this.children.unshift(child);
  if (child.id) created.push(child);
  return child;
};
body.appendChild = function appendChild(child) {
  child.parentNode = this;
  this.children.push(child);
  if (child.id && !created.includes(child)) created.push(child);
  return child;
};
head.appendChild = function appendChild(child) {
  child.parentNode = this;
  this.children.push(child);
  if (child.id && !created.includes(child)) created.push(child);
  return child;
};
// ensure createElement results are trackable when id set later
const origCreate = global.document.createElement.bind(global.document);
global.document.createElement = (tag) => {
  const el = origCreate(tag);
  let idVal = '';
  Object.defineProperty(el, 'id', {
    get() { return idVal; },
    set(v) {
      idVal = String(v || '');
      if (idVal && !created.includes(el)) created.push(el);
    },
    configurable: true,
  });
  return el;
};

const BackupReconnect = new Function(
  fs.readFileSync(path.join(__dirname, 'backupReconnect.js'), 'utf8') + '; return BackupReconnect;'
)();

assert(typeof BackupReconnect.evaluate === 'function', 'evaluate exists');
assert(typeof BackupReconnect.restoreWithGesture === 'function', 'restoreWithGesture exists');
assert(typeof BackupReconnect.showBanner === 'function', 'showBanner exists');
assert(BackupReconnect.getPersistGuide(false).includes('매번 허용'), 'browser guide mentions always allow');
assert(BackupReconnect.getPersistGuide(true).includes('앱'), 'pwa guide mentions app');

(async () => {
  const none = await BackupReconnect.evaluate(null);
  assert(none.status === 'none', 'null handle -> none');

  const grantedHandle = {
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
  };
  const ok = await BackupReconnect.evaluate(grantedHandle);
  assert(ok.status === 'restored', 'granted -> restored');

  const promptHandle = {
    async queryPermission() { return 'prompt'; },
    async requestPermission() { return 'granted'; },
  };
  const need = await BackupReconnect.evaluate(promptHandle);
  assert(need.status === 'needs-gesture', 'prompt -> needs-gesture');

  const restored = await BackupReconnect.restoreWithGesture(promptHandle);
  assert(restored.status === 'restored', 'gesture restore granted');

  const deniedHandle = {
    async queryPermission() { return 'denied'; },
    async requestPermission() { return 'denied'; },
  };
  const denied = await BackupReconnect.evaluate(deniedHandle);
  assert(denied.status === 'denied', 'denied status');

BackupReconnect.showBanner(promptHandle, async () => {});
const banner = document.getElementById('backupReconnectBanner');
assert(!!banner, 'banner created');
assert(banner.classList.contains('visible'), 'banner visible');
assert(!!document.getElementById('backup-reconnect-styles'), 'injects own styles');
assert(BackupReconnect.hasPending(), 'pending handle set');
BackupReconnect.hideBanner();
assert(!banner.classList.contains('visible'), 'banner hidden');

  // static integration
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  assert(html.includes('backupReconnect.js'), 'index loads module');
  assert(html.includes('backup-reconnect-banner'), 'index has banner css');
  assert(sw.includes('backupReconnect.js'), 'sw caches module');
  assert(sw.includes('recovr-cache-v57'), 'sw cache bump');

  console.log(failures === 0 ? 'BackupReconnect tests passed ✓' : failures + ' failed');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
