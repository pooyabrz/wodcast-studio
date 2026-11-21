import { readdir, readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', 'node_modules', 'data', 'dist', 'test-results', 'playwright-report', 'coverage']);
async function walk(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name); if (entry.isDirectory()) paths.push(...await walk(path)); else paths.push(path);
  }
  return paths;
}
const files = await walk(root);
for (const file of files) {
  if (['.js', '.mjs'].includes(extname(file))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status) throw new Error(result.stderr);
  }
  if (['.js', '.mjs', '.json', '.css', '.html', '.svg', '.md', '.yml', '.yaml', '.sh', '.cmd', '.command', ''].includes(extname(file))) {
    const text = await readFile(file, 'utf8');
    if (/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0400-\u04ff\u4e00-\u9fff]/u.test(text)) throw new Error(`Non-English source text found in ${file}.`);
  }
}
const html = await readFile(join(root, 'public/control.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML element ID.');
const app = await readFile(join(root, 'public/js/control-app.js'), 'utf8');
for (const match of app.matchAll(/\$\('#([a-z\d-]+)'\)/gi)) if (!ids.includes(match[1])) throw new Error(`Missing HTML element: ${match[1]}`);
const previewPath = join(root, 'WODCAST-Preview.html');
if (files.includes(previewPath)) {
  const preview = await readFile(previewPath, 'utf8'), temporary = await mkdtemp(join(tmpdir(), 'wodcast-check-'));
  try {
    const script = [...preview.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
    if (!script || preview.includes('src="/js/') || preview.includes('href="/css/')) throw new Error('Standalone preview contains missing or external code.');
    const target = join(temporary, 'preview.js'); await writeFile(target, script);
    const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' }); if (result.status) throw new Error(result.stderr);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
console.log(`Checked ${files.length} files: JavaScript syntax, UI IDs and English source policy passed.`);
