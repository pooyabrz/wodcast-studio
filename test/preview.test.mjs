import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../public/js/client.js';
import { logoPng } from '../scripts/fixtures.mjs';

test('browser preview saves content and imports a portable logo without server calls', async () => {
  const values = new Map(), cleanup = [];
  globalThis.window = { WODCAST_DEMO: true, WODCAST_ASSETS: {}, addEventListener: (_, fn) => cleanup.push(fn) };
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  try {
    const client = createClient(); await client.connect(); await client.command('configure', { content: { title: 'MY STUDIO' } }); await client.command('save'); assert.equal(client.state.dirty, false);
    const preset = await client.exportPreset(); preset.logoDataUrl = `data:image/png;base64,${logoPng().toString('base64')}`;
    await client.importPreset(preset); assert.equal((await client.exportPreset()).logoDataUrl, preset.logoDataUrl); await client.command('save');
    const next = createClient(); await next.connect(); assert.equal(next.state.config.content.title, 'MY STUDIO'); assert.equal(next.state.timer.status, 'idle');
  } finally { cleanup.forEach(fn => fn()); delete globalThis.window; delete globalThis.localStorage; }
});
test('a browser quota error does not report a saved layout', async () => {
  const cleanup = []; globalThis.window = { WODCAST_DEMO: true, WODCAST_ASSETS: {}, addEventListener: (_, fn) => cleanup.push(fn) };
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('Storage quota exceeded.'); } };
  try { const client = createClient(); await client.connect(); await client.command('configure', { content: { title: 'DRAFT' } }); await assert.rejects(client.command('save')); assert.equal(client.state.dirty, true); assert.equal(client.state.savedAt, null); }
  finally { cleanup.forEach(fn => fn()); delete globalThis.window; delete globalThis.localStorage; }
});
