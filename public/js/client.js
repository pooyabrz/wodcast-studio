import { DEFAULT_CONFIG, clone, sanitizeConfig } from './model.js';
import { TimerEngine } from './timer.js';

export function createClient({ readOnly = false } = {}) {
  const demo = Boolean(window.WODCAST_DEMO), listeners = new Set();
  const client = {
    demo, connected: demo, authorized: demo && !readOnly, meta: null,
    clientId: `studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    receivedAt: performance.now(),
    state: { config: clone(DEFAULT_CONFIG), timer: new TimerEngine(DEFAULT_CONFIG.timer).snapshot(), dirty: false, savedAt: null, audioClientId: null },
    on(fn) { listeners.add(fn); fn(client.state); return () => listeners.delete(fn); },
    emit() { for (const fn of listeners) fn(client.state); },
    accept(state) { client.state = state; client.receivedAt = performance.now(); client.emit(); }
  };
  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) { client.authorized = false; client.emit(); }
      throw new Error(result.error || 'Request failed.');
    }
    return result;
  }
  if (!demo) {
    const bootstrap = async () => {
      if (readOnly) return request('/api/state');
      client.meta = await request('/api/bootstrap'); client.authorized = client.meta.authorized; return client.meta.state;
    };
    client.connect = async () => {
      const state = await bootstrap(); client.connected = true; client.accept(state);
      const events = new EventSource('/api/events');
      events.onopen = () => { if (!client.connected) bootstrap().then(state => { client.connected = true; client.accept(state); }).catch(() => {}); };
      events.onmessage = event => { try { client.connected = true; client.accept(JSON.parse(event.data)); } catch { /* The next full snapshot replaces a malformed packet. */ } };
      events.onerror = () => {
        if (client.connected) {
          const dt = Math.max(0, (performance.now() - client.receivedAt) / 1000), timer = client.state.timer;
          if (timer.status === 'running') {
            if (timer.remainingSec !== null) timer.remainingSec = Math.max(0, timer.remainingSec - dt);
            timer.elapsedSec += dt; if (timer.phase !== 'ready') timer.sessionElapsedSec += dt;
          }
          client.connected = false; client.receivedAt = performance.now(); client.emit();
        }
      };
      window.addEventListener('pagehide', () => events.close(), { once: true });
    };
    client.command = async (action, payload) => {
      if (readOnly) throw new Error('The overlay is read-only.');
      if (!client.connected) throw new Error('Studio is disconnected. Wait for reconnection.');
      const result = await request('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) }); client.accept(result); return result;
    };
    client.pair = async code => {
      await request('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      client.accept(await bootstrap());
    };
    client.uploadLogo = async file => client.accept(await request('/api/logo', { method: 'POST', headers: { 'Content-Type': file.type }, body: file }));
    client.importPreset = async preset => client.accept(await request('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preset) }));
    client.exportPreset = () => request('/api/export');
  } else {
    // The standalone preview intentionally has browser-local state, separate from OBS/LAN.
    const assets = window.WODCAST_ASSETS || (window.WODCAST_ASSETS = {});
    let config = clone(DEFAULT_CONFIG), saved = clone(config), savedAt = null, audioClientId = null;
    try {
      const stored = JSON.parse(localStorage.getItem('wodcast-preview-v1') || 'null');
      if (stored) { config = sanitizeConfig(stored.config); saved = clone(config); savedAt = stored.savedAt; Object.assign(assets, stored.assets || {}); }
    } catch { /* Invalid or unavailable browser storage falls back to defaults. */ }
    const timer = new TimerEngine(config.timer);
    const snapshot = () => ({ config, timer: timer.snapshot(), dirty: JSON.stringify(config) !== JSON.stringify(saved), savedAt, audioClientId });
    const apply = patch => { const next = sanitizeConfig(patch, config); if (JSON.stringify(next.timer) !== JSON.stringify(config.timer)) timer.configure(next.timer); config = next; };
    client.connect = async () => { client.meta = { local: true, pairing: null }; client.accept(snapshot()); };
    client.command = async (action, payload) => {
      switch (action) {
        case 'start': timer.start(); break;
        case 'pause': timer.pause(); break;
        case 'resume': timer.resume(); break;
        case 'reset': timer.reset(); break;
        case 'configure': apply(payload); break;
        case 'defaults': if (['running', 'paused'].includes(timer.status)) throw new Error('Reset the timer first.'); apply(DEFAULT_CONFIG); break;
        case 'save': {
          const timestamp = new Date().toISOString();
          localStorage.setItem('wodcast-preview-v1', JSON.stringify({ config, assets, savedAt: timestamp }));
          saved = clone(config); savedAt = timestamp; break;
        }
        case 'claimAudio': audioClientId = payload.clientId; break;
        case 'releaseAudio': if (audioClientId === payload.clientId) audioClientId = null; break;
        default: throw new Error('Unknown command.');
      }
      client.accept(snapshot()); return client.state;
    };
    const embedLogo = data => {
      if (!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(data) || data.length > 2800000) throw new Error('Invalid embedded PNG, JPEG or WebP logo.');
      const ext = data.startsWith('data:image/jpeg') ? 'jpg' : data.match(/^data:image\/(\w+)/)[1];
      const hash = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const path = `/uploads/logo-${hash}.${ext}`; assets[path] = data; return path;
    };
    client.uploadLogo = async file => {
      const data = await new Promise((ok, reject) => { const reader = new FileReader(); reader.onload = () => ok(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      apply({ content: { logoUrl: embedLogo(data) } }); client.accept(snapshot());
    };
    client.exportPreset = async () => {
      const preset = { type: 'wodcast-layout', version: 1, config: clone(config) };
      if (config.content.logoUrl.startsWith('/uploads/')) preset.logoDataUrl = assets[config.content.logoUrl];
      return preset;
    };
    client.importPreset = async preset => {
      if (['running', 'paused'].includes(timer.status)) throw new Error('Reset the timer first.');
      if (preset.type !== 'wodcast-layout' || preset.version !== 1) throw new Error('Unsupported WODCAST layout file.');
      const next = sanitizeConfig(preset.config);
      if (preset.logoDataUrl) next.content.logoUrl = embedLogo(preset.logoDataUrl);
      else if (next.content.logoUrl.startsWith('/uploads/')) throw new Error('This layout is missing its embedded logo.');
      apply(next); client.accept(snapshot());
    };
    const loop = setInterval(() => client.accept(snapshot()), 1000);
    window.addEventListener('pagehide', () => clearInterval(loop), { once: true });
  }
  return client;
}
