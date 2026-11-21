import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { DEFAULT_CONFIG, VERSION, clone, sanitizeConfig } from '../public/js/model.js';
import { TimerEngine } from '../public/js/timer.js';
import { AccessControl, isLoopback } from './access.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
function imageExtension(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  throw failure('Only PNG, JPEG and WebP logos are supported.');
}
async function readBody(req, limit = 64000, json = true) {
  if (json && !String(req.headers['content-type'] || '').startsWith('application/json')) throw failure('Content-Type must be application/json.', 415);
  if (Number(req.headers['content-length']) > limit) { req.resume(); throw failure('Request is too large.', 413); }
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw failure('Request is too large.', 413); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  if (!json) return bytes;
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw failure('Invalid JSON.'); }
}

export async function createStudio({ port = 0, lan = false, dataDir = resolve(projectRoot, 'data'), autoAuthorizeLocal = true } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw failure('Port must be an integer from 0 to 65535.');
  const publicDir = resolve(projectRoot, 'public'), assetsDir = resolve(dataDir, 'assets'), settingsFile = resolve(dataDir, 'settings.json');
  await mkdir(assetsDir, { recursive: true });
  let config = clone(DEFAULT_CONFIG), savedConfig = clone(DEFAULT_CONFIG), savedAt = null, storageWarning = '';
  try {
    const stored = JSON.parse(await readFile(settingsFile, 'utf8'));
    config = sanitizeConfig(stored.config); savedConfig = clone(config); savedAt = stored.savedAt || null;
  } catch (error) {
    if (error.code !== 'ENOENT') storageWarning = 'Saved settings could not be read. Defaults are active; the original file has been preserved.';
  }
  const engine = new TimerEngine(config.timer), access = new AccessControl(), subscribers = new Set();
  let addresses = [], boundPort = port, revision = 1, audioClientId = null, commands = Promise.resolve();
  try { addresses = Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address); } catch { /* Localhost remains available when interface enumeration is restricted. */ }
  const snapshot = () => ({ config, timer: engine.snapshot(), revision, savedAt, dirty: JSON.stringify(config) !== JSON.stringify(savedConfig), audioClientId, storageWarning });
  const broadcast = () => {
    const packet = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const client of subscribers) {
      if (client.writableLength > 262144) { client.destroy(); subscribers.delete(client); } else client.write(packet);
    }
  };
  const mutate = work => { const task = commands.then(work); commands = task.catch(() => {}); return task; };
  const reply = (res, status, value, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value));
  };
  const active = () => ['running', 'paused'].includes(engine.status);
  const apply = patch => {
    const next = sanitizeConfig(patch, config);
    if (JSON.stringify(next.timer) !== JSON.stringify(config.timer)) engine.configure(next.timer);
    config = next; revision++;
  };
  async function storeLogo(bytes) {
    if (bytes.length > 2097152) throw failure('Logo must be at most 2 MB.');
    const extension = imageExtension(bytes), hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
    const name = `logo-${hash}.${extension}`; await writeFile(resolve(assetsDir, name), bytes); return `/uploads/${name}`;
  }
  async function exportPreset() {
    const preset = { type: 'wodcast-layout', version: 1, config: clone(config) };
    if (config.content.logoUrl.startsWith('/uploads/')) {
      const name = config.content.logoUrl.split('/').pop(), bytes = await readFile(resolve(assetsDir, name));
      preset.logoDataUrl = `data:image/${extname(name) === '.jpg' ? 'jpeg' : extname(name).slice(1)};base64,${bytes.toString('base64')}`;
    }
    return preset;
  }
  const server = http.createServer(async (req, res) => {
    try {
      const allowedHosts = ['localhost', '127.0.0.1', ...addresses].map(h => `${h}:${boundPort}`);
      if (!allowedHosts.includes(req.headers.host)) return reply(res, 403, { error: 'Host is not allowed.' });
      res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
      const path = new URL(req.url, `http://${req.headers.host}`).pathname;
      if (req.method === 'GET' && path === '/api/bootstrap') {
        const local = isLoopback(req.socket.remoteAddress), auto = local && autoAuthorizeLocal && !['cross-site', 'same-site'].includes(req.headers['sec-fetch-site']);
        const headers = auto && !access.authorized(req.headers.cookie) ? { 'Set-Cookie': access.session() } : {};
        return reply(res, 200, { state: snapshot(), authorized: auto || access.authorized(req.headers.cookie), local, version: VERSION, pairing: local && autoAuthorizeLocal ? { enabled: lan, code: access.code, urls: addresses.map(ip => `http://${ip}:${boundPort}/`) } : null }, headers);
      }
      if (req.method === 'GET' && path === '/api/state') return reply(res, 200, snapshot());
      if (req.method === 'GET' && path === '/api/events') {
        if (subscribers.size >= 30) return reply(res, 503, { error: 'Too many connected views.' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify(snapshot())}\n\n`); subscribers.add(res); res.on('close', () => subscribers.delete(res)); return;
      }
      if (path.startsWith('/api/') && req.method !== 'GET') {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw failure('Cross-origin control is not allowed.', 403);
        if (path !== '/api/pair' && !access.authorized(req.headers.cookie)) throw failure('Pair with the studio before controlling it.', 401);
      }
      if (req.method === 'POST' && path === '/api/pair') {
        const input = await readBody(req); const cookie = access.pair(req.socket.remoteAddress, input.code);
        return reply(res, 200, { authorized: true }, { 'Set-Cookie': cookie });
      }
      if (req.method === 'POST' && path === '/api/command') {
        const { action, payload } = await readBody(req);
        const result = await mutate(async () => {
          switch (action) {
            case 'start': engine.start(); break;
            case 'pause': engine.pause(); break;
            case 'resume': engine.resume(); break;
            case 'reset': engine.reset(); break;
            case 'configure': apply(payload); break;
            case 'defaults': if (active()) throw failure('Reset the timer first.'); apply(DEFAULT_CONFIG); break;
            case 'save': {
              const timestamp = new Date().toISOString();
              await writeFile(`${settingsFile}.tmp`, JSON.stringify({ version: 1, savedAt: timestamp, config }, null, 2));
              await rename(`${settingsFile}.tmp`, settingsFile); savedConfig = clone(config); savedAt = timestamp; storageWarning = ''; break;
            }
            case 'claimAudio':
              if (!/^[a-z\d-]{8,80}$/i.test(payload?.clientId || '')) throw failure('Invalid audio client ID.');
              audioClientId = payload.clientId; break;
            case 'releaseAudio': if (audioClientId === payload?.clientId) audioClientId = null; break;
            default: throw failure('Unknown command.');
          }
          revision++; broadcast(); return snapshot();
        }); return reply(res, 200, result);
      }
      if (req.method === 'POST' && path === '/api/logo') {
        const bytes = await readBody(req, 2097152, false);
        const result = await mutate(async () => { apply({ content: { logoUrl: await storeLogo(bytes) } }); broadcast(); return snapshot(); });
        return reply(res, 200, result);
      }
      if (req.method === 'GET' && path === '/api/export') {
        if (!access.authorized(req.headers.cookie)) throw failure('Not authorized.', 401);
        return reply(res, 200, await exportPreset(), { 'Content-Disposition': 'attachment; filename="WODCAST-Layout.json"' });
      }
      if (req.method === 'POST' && path === '/api/import') {
        const preset = await readBody(req, 3145728);
        const result = await mutate(async () => {
          if (active()) throw failure('Reset the timer before importing a layout.');
          if (preset.type !== 'wodcast-layout' || preset.version !== 1) throw failure('Unsupported WODCAST layout file.');
          const incoming = sanitizeConfig(preset.config);
          if (preset.logoDataUrl) {
            const match = /^data:image\/(?:png|jpeg|webp);base64,([a-z\d+/=]+)$/i.exec(preset.logoDataUrl);
            if (!match) throw failure('Invalid embedded logo.');
            incoming.content.logoUrl = await storeLogo(Buffer.from(match[1], 'base64'));
          } else if (incoming.content.logoUrl.startsWith('/uploads/')) throw failure('The uploaded logo is missing from this layout file.');
          apply(incoming); broadcast(); return snapshot();
        }); return reply(res, 200, result);
      }
      if (path.startsWith('/api/')) throw failure('API endpoint not found.', 404);
      if (!['GET', 'HEAD'].includes(req.method)) throw failure('Method is not allowed.', 405);
      let file;
      if (/^\/uploads\/logo-[a-f\d]{24}\.(png|jpg|webp)$/.test(path)) file = resolve(assetsDir, path.split('/').pop());
      else {
        const relative = path === '/' || path === '/index.html' ? '/control.html' : decodeURIComponent(path);
        file = resolve(publicDir, `.${relative}`);
        if (!file.startsWith(publicDir + sep) || relative.split('/').some(part => part.startsWith('.'))) throw failure('Path is not allowed.', 403);
      }
      const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (!res.headersSent) reply(res, error.code === 'ENOENT' ? 404 : error.status || 400, { error: error.code === 'ENOENT' ? 'File not found.' : error.message }); else res.end();
    }
  });
  await new Promise((ok, reject) => { server.once('error', reject); server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', ok); });
  boundPort = server.address().port;
  let transition = engine.transitionId, lastSent = 0;
  const tick = setInterval(() => { engine.advance(); const now = performance.now(); if (engine.transitionId !== transition || now - lastSent >= 1000) { transition = engine.transitionId; lastSent = now; broadcast(); } }, 100);
  tick.unref();
  return {
    server, port: boundPort, baseUrl: `http://127.0.0.1:${boundPort}`, pairingCode: access.code, addresses,
    snapshot,
    async close() {
      clearInterval(tick); for (const client of subscribers) client.end(); subscribers.clear();
      await commands; await new Promise(ok => { server.close(ok); server.closeAllConnections(); });
    }
  };
}
