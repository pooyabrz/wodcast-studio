// Shared test fixtures use Node built-ins only.
import { deflateSync } from 'node:zlib';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudio } from '../lib/studio.mjs';

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let n = 0; n < 8; n++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
export function logoPng() {
  const chunk = (name, bytes) => { const type = Buffer.from(name), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc32(Buffer.concat([type, bytes]))); return Buffer.concat([size, type, bytes, checksum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 176, 241, 91, 255]))), chunk('IEND', Buffer.alloc(0))]);
}
export async function fixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'wodcast-test-'));
  let app = await createStudio({ dataDir: directory, ...options }), cookie = '';
  const api = async (path, init = {}) => {
    const response = await fetch(`${app.baseUrl}${path}`, { ...init, headers: { ...(cookie ? { Cookie: cookie } : {}), ...init.headers } });
    const value = await response.json(); return { response, value };
  };
  return {
    directory, get app() { return app; }, api,
    async authorize() { const { response, value } = await api('/api/bootstrap'); cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie; return value; },
    command: (action, payload) => api('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) }),
    async restart() { await app.close(); app = await createStudio({ dataDir: directory, ...options }); cookie = ''; },
    async close() { await app.close(); await rm(directory, { recursive: true, force: true }); }
  };
}
