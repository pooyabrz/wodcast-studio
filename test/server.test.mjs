import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture, logoPng } from '../scripts/fixtures.mjs';

test('public output does not grant command access; local bootstrap authorizes the panel', async t => {
  const f = await fixture(); t.after(() => f.close());
  assert.equal((await f.command('start')).response.status, 401);
  assert.equal((await f.api('/api/state')).value.timer.status, 'idle');
  assert.equal((await f.authorize()).authorized, true); assert.equal((await f.command('start')).response.status, 200);
});
test('control rejects a foreign Origin and Host and denies private files', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.authorize();
  const origin = await f.api('/api/command', { method: 'POST', headers: { Origin: 'http://example.invalid', 'Content-Type': 'application/json' }, body: '{"action":"start"}' }); assert.equal(origin.response.status, 403);
  const status = await new Promise((ok, reject) => { const req = http.request({ hostname: '127.0.0.1', port: f.app.port, path: '/api/state', headers: { Host: 'example.invalid:8787' } }, res => { res.resume(); ok(res.statusCode); }); req.on('error', reject); req.end(); });
  assert.equal(status, 403);
  assert.equal((await fetch(`${f.app.baseUrl}/server.mjs`)).status, 404);
  assert.equal((await fetch(`${f.app.baseUrl}/%2e%2e%2fserver.mjs`)).status, 403);
});
test('the English controller, transparent overlay and module assets are served', async t => {
  const f = await fixture(); t.after(() => f.close());
  const html = await (await fetch(f.app.baseUrl)).text(); assert.match(html, /lang="en"/); assert.match(html, /Start workout/);
  for (const path of ['/overlay.html', '/js/client.js', '/css/overlay.css', '/assets/wodcast-mark.svg']) assert.equal((await fetch(`${f.app.baseUrl}${path}`)).status, 200);
  assert.match(await (await fetch(`${f.app.baseUrl}/css/overlay.css`)).text(), /\.overlay-page\s*\{[^}]*background\s*:\s*transparent\s*!important/i);
});
test('SSE delivers shared changes and loading another output does not reset a running timer', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.authorize();
  await f.command('configure', { timer: { durationSec: 30, prestartSec: 0 } });
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 5000);
  const stream = await fetch(`${f.app.baseUrl}/api/events`, { signal: abort.signal }), reader = stream.body.getReader();
  const decoder = new TextDecoder(); let buffer = '';
  async function next(predicate) {
    for (;;) {
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const packet = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        if (packet.startsWith('data: ')) { const value = JSON.parse(packet.slice(6)); if (predicate(value)) return value; }
      }
      const chunk = await reader.read(); if (chunk.done) throw new Error('SSE ended unexpectedly.'); buffer += decoder.decode(chunk.value, { stream: true });
    }
  }
  try {
    assert.equal((await next(() => true)).timer.status, 'idle'); await f.command('start'); assert.equal((await next(s => s.timer.status === 'running')).timer.mode, 'countdown');
    await delay(140); await fetch(`${f.app.baseUrl}/overlay.html`); assert.ok((await f.api('/api/state')).value.timer.remainingSec < 30);
    await f.command('configure', { content: { title: 'LIVE UPDATE' } }); assert.equal((await next(s => s.config.content.title === 'LIVE UPDATE')).timer.status, 'running');
  } finally { clearTimeout(timeout); abort.abort(); await reader.cancel().catch(() => {}); }
});
test('pause preserves server time and active timer settings cannot be changed', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.authorize();
  await f.command('configure', { timer: { prestartSec: 0 } }); await f.command('start'); await delay(70); await f.command('pause');
  const paused = (await f.api('/api/state')).value.timer.remainingSec; await delay(90); assert.equal((await f.api('/api/state')).value.timer.remainingSec, paused);
  assert.equal((await f.command('configure', { timer: { durationSec: 5 } })).response.status, 400);
  assert.equal((await f.command('defaults')).response.status, 400); await f.command('resume'); await delay(50); assert.ok((await f.api('/api/state')).value.timer.remainingSec < paused);
});
test('logo upload and portable layout import retain assets on a fresh instance', async t => {
  const f = await fixture(), second = await fixture(); t.after(async () => { await f.close(); await second.close(); }); await f.authorize(); await second.authorize();
  const logo = await f.api('/api/logo', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: logoPng() }); assert.equal(logo.response.status, 200);
  const preset = (await f.api('/api/export')).value; assert.ok(preset.logoDataUrl.startsWith('data:image/png;base64,'));
  const imported = await second.api('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preset) }); assert.equal(imported.response.status, 200);
  const bytes = await (await fetch(`${second.app.baseUrl}${imported.value.config.content.logoUrl}`)).arrayBuffer(); assert.deepEqual(Buffer.from(bytes), logoPng());
  assert.equal((await f.api('/api/logo', { method: 'POST', body: '<svg onload="alert(1)"/>' })).response.status, 400);
});
test('simultaneous saves serialize safely and a restart keeps the layout with an idle timer', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.authorize(); await f.command('configure', { content: { title: 'SAVED STUDIO' } });
  const saves = await Promise.all(Array.from({ length: 8 }, () => f.command('save'))); assert.ok(saves.every(s => s.response.status === 200));
  assert.equal(JSON.parse(await readFile(join(f.directory, 'settings.json'))).config.content.title, 'SAVED STUDIO');
  await f.command('start'); await f.restart(); const state = (await f.api('/api/state')).value;
  assert.equal(state.config.content.title, 'SAVED STUDIO'); assert.equal(state.timer.status, 'idle'); assert.equal(state.dirty, false);
});
test('invalid saved settings are preserved until the user explicitly saves', async t => {
  const f = await fixture(); t.after(() => f.close()); await writeFile(join(f.directory, 'settings.json'), '{broken'); await f.restart();
  assert.ok((await f.api('/api/state')).value.storageWarning); assert.equal(await readFile(join(f.directory, 'settings.json'), 'utf8'), '{broken');
});
test('pairing creates a usable authorized session without automatic local login', async t => {
  const f = await fixture({ autoAuthorizeLocal: false }); t.after(() => f.close());
  const boot = (await f.api('/api/bootstrap')).value; assert.equal(boot.authorized, false); assert.equal(boot.pairing, null);
  const wrong = await f.api('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"000000"}' }); assert.equal(wrong.response.status, 401);
  const good = await f.api('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: f.app.pairingCode }) });
  const response = await fetch(`${f.app.baseUrl}/api/command`, { method: 'POST', headers: { Cookie: good.response.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' }, body: '{"action":"start"}' }); assert.equal(response.status, 200);
});
test('only the current audio owner can release its output', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.authorize();
  await f.command('claimAudio', { clientId: 'studio-audio-one' }); await f.command('claimAudio', { clientId: 'studio-audio-two' }); await f.command('releaseAudio', { clientId: 'studio-audio-one' });
  assert.equal((await f.api('/api/state')).value.audioClientId, 'studio-audio-two'); await f.command('releaseAudio', { clientId: 'studio-audio-two' }); assert.equal((await f.api('/api/state')).value.audioClientId, null);
});
