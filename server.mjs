import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createStudio } from './lib/studio.mjs';
import { VERSION } from './public/js/model.js';

const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const lan = process.argv.includes('--lan');
try {
  const app = await createStudio({ port, lan, ...(process.env.WODCAST_DATA_DIR ? { dataDir: resolve(process.env.WODCAST_DATA_DIR) } : {}) });
  console.log(`WODCAST Studio ${VERSION}\nControl panel: ${app.baseUrl}/\nOBS overlay: ${app.baseUrl}/overlay.html`);
  if (lan) console.log(`Pairing code: ${app.pairingCode}\n${app.addresses.map(ip => `Phone: http://${ip}:${app.port}/`).join('\n')}\nUse a trusted private network.`);
  if (process.argv.includes('--open')) {
    const url = `${app.baseUrl}/`, program = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const opener = spawn(program, process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url], { detached: true, stdio: 'ignore' });
    opener.on('error', () => console.log(`Open the panel manually: ${url}`)); opener.unref();
  }
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await app.close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) { console.error(`Studio could not start: ${error.message}`); process.exitCode = 1; }
