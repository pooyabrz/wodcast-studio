import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');
const assets = {};
for (const file of ['wodcast-mark.svg', 'studio-backdrop.svg']) assets[`/assets/${file}`] = `data:image/svg+xml;base64,${Buffer.from(await read(`public/assets/${file}`)).toString('base64')}`;
let html = await read('public/control.html'), studio = await read('public/css/studio.css');
const overlay = await read('public/css/overlay.css');
for (const [path, data] of Object.entries(assets)) { html = html.replaceAll(path, data); studio = studio.replaceAll(path, data); }
html = html.replace(/<link\b[^>]*href="\/css\/studio\.css"[^>]*>/, () => `<style>${studio}</style>`);
html = html.replace(/<link\b[^>]*href="\/css\/overlay\.css"[^>]*>/, () => `<style>${overlay}</style>`);
const sources = [];
for (const name of ['model.js', 'timer.js', 'client.js', 'renderer.js', 'control-app.js']) sources.push(`// SOURCE: ${name}\n${(await read(`public/js/${name}`)).replace(/^import .*;\n/gm, '').replace(/^export /gm, '')}`);
const script = `window.WODCAST_DEMO=true;\nwindow.WODCAST_ASSETS=${JSON.stringify(assets)};\nwindow.WODCAST_OVERLAY_CSS=${JSON.stringify(overlay)};\n${sources.join('\n\n')}`;
// A replacement callback preserves literal dollar signs in the readable bundle.
html = html.replace(/<script\b[^>]*src="\/js\/control-app\.js"[^>]*>\s*<\/script>/, () => `<script>${script.replaceAll('</script', '<\\/script')}</script>`);
html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>WODCAST | Interactive Preview</title>');
await writeFile(resolve(root, 'WODCAST-Preview.html'), html);
console.log('Built WODCAST-Preview.html with inline scripts, styles and assets.');
