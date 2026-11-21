import { createClient } from './client.js';
import { createOverlay } from './renderer.js';
const client = createClient({ readOnly: true });
createOverlay(document.querySelector('#overlay'), client);
async function connect() { try { await client.connect(); } catch { client.connected = false; client.emit(); setTimeout(connect, 3000); } }
connect();
