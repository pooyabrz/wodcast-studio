import assert from 'node:assert/strict';
import { readFile, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { fixture, logoPng } from './fixtures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let playwright;
try { playwright = await import(process.env.WODCAST_PLAYWRIGHT_MODULE || 'playwright'); }
catch { throw new Error('Optional browser QA requires Playwright. See docs/TESTING.md for installation.'); }
const browser = await playwright.chromium.launch({ headless: true, ...(process.env.WODCAST_BROWSER_EXECUTABLE ? { executablePath: process.env.WODCAST_BROWSER_EXECUTABLE } : {}) });
const f = await fixture(), paired = await fixture({ autoAuthorizeLocal: false });
const temporary = await mkdtemp(join(tmpdir(), 'wodcast-browser-'));
const errors = [], externalRequests = [], checks = [];
function watch(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { const url = new URL(req.url()); if (url.protocol === 'http:' || url.protocol === 'https:') { if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(req.url()); } });
}
async function eventually(fn, message, timeout = 8000) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) { try { if (await fn()) return; } catch (error) { last = error; } await new Promise(ok => setTimeout(ok, 50)); }
  throw new Error(`${message}${last ? `: ${last.message}` : ''}`);
}
const state = async () => (await f.api('/api/state')).value;
const screenshot = async (page, name) => {
  if (!process.env.WODCAST_QA_DIR) return;
  await mkdir(process.env.WODCAST_QA_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.WODCAST_QA_DIR, name), fullPage: true });
};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage(); watch(page); await page.goto(f.app.baseUrl);
  await page.locator('#primaryTimer:enabled').waitFor(); assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('.ov-zone').count(), 3); assert.equal(await page.locator('[data-visibility]').count(), 10); checks.push('English panel loads with three zones and ten visibility controls');
  const output = await context.newPage(); watch(output); await output.goto(`${f.app.baseUrl}/overlay.html`); await output.locator('.ov-title').waitFor();
  assert.equal(await output.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)'); checks.push('Independent overlay has a transparent body');
  await page.locator('#durationMin').fill('0'); await page.locator('#durationPart').fill('8'); await page.locator('[name="timer.prestartSec"]').fill('0'); await page.getByRole('button', { name: 'Apply timer', exact: true }).click();
  await eventually(async () => (await state()).config.timer.durationSec === 8, 'Countdown settings were not applied');
  await page.locator('#primaryTimer').click(); await eventually(async () => (await state()).timer.status === 'running', 'Timer did not start');
  assert.equal(await page.locator('#timerMode').isDisabled(), true); await page.locator('#primaryTimer').click(); await eventually(async () => (await state()).timer.status === 'paused', 'Timer did not pause');
  const paused = (await state()).timer.remainingSec; await output.reload(); await page.waitForTimeout(200); assert.equal((await state()).timer.remainingSec, paused);
  await page.locator('#primaryTimer').click(); await page.waitForTimeout(1100); assert.ok((await state()).timer.remainingSec < paused);
  page.once('dialog', d => d.accept()); await page.locator('#resetTimer').click(); await eventually(async () => (await state()).timer.status === 'idle', 'Reset failed');
  checks.push('Countdown, pause, resume, reset, output reload and active-settings lock');
  await page.locator('h1').first().click(); await page.keyboard.press('Space'); await eventually(async () => (await state()).timer.status === 'running', 'Space did not start the timer');
  await page.keyboard.press('Space'); await eventually(async () => (await state()).timer.status === 'paused', 'Space did not pause the timer');
  page.once('dialog', d => d.accept()); await page.keyboard.press('r'); await eventually(async () => (await state()).timer.status === 'idle', 'R did not reset'); checks.push('Keyboard start, pause and confirmed reset');
  await page.locator('[data-preset="tabata"]').click(); await eventually(async () => (await state()).config.timer.mode === 'interval', 'Preset failed');
  await page.locator('[name="timer.workSec"]').fill('1'); await page.locator('[name="timer.restSec"]').fill('1'); await page.locator('[name="timer.rounds"]').fill('2'); await page.locator('[name="timer.prestartSec"]').fill('0'); await page.getByRole('button', { name: 'Apply timer', exact: true }).click();
  await eventually(async () => (await state()).config.timer.workSec === 1, 'Interval form failed'); await page.locator('#primaryTimer').click();
  await eventually(async () => (await state()).timer.status === 'finished', 'Intervals did not finish', 6500); assert.equal((await state()).timer.round, 2); checks.push('Preset, short work/rest intervals and completion');
  await page.locator('#resetTimer').click(); await page.locator('#timerMode').selectOption('stopwatch'); await page.getByRole('button', { name: 'Apply timer', exact: true }).click();
  await eventually(async () => (await state()).config.timer.mode === 'stopwatch', 'Stopwatch mode failed'); await page.locator('#primaryTimer').click(); await page.waitForTimeout(1150);
  assert.ok((await state()).timer.elapsedSec >= 1); page.once('dialog', d => d.accept()); await page.locator('#resetTimer').click(); await eventually(async () => (await state()).timer.status === 'idle', 'Stopwatch reset failed'); checks.push('Stopwatch mode and elapsed display');
  await page.locator('[name="content.wod"]').fill('<script>window.__wodcastInjected=true</script>\n12 Reps'); await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await eventually(async () => (await state()).config.content.wod.startsWith('<script>'), 'Text changes failed'); await eventually(async () => (await output.locator('.ov-wod').textContent()).includes('<script>'), 'Output did not receive text');
  assert.equal(await output.evaluate(() => window.__wodcastInjected), undefined); checks.push('Editable content is rendered as text, with no script execution');
  await page.getByRole('button', { name: 'Design', exact: true }).click(); await page.locator('[name="content.title"]').fill('NORTHSIDE'); await page.getByRole('button', { name: 'Apply identity', exact: true }).click();
  await eventually(async () => (await output.locator('.ov-title').textContent()) === 'NORTHSIDE', 'Brand update failed');
  await page.locator('#logoInput').setInputFiles({ name: 'test-logo.png', mimeType: 'image/png', buffer: logoPng() }); await eventually(async () => (await state()).config.content.logoUrl.startsWith('/uploads/'), 'Logo upload failed');
  await page.locator('[name="theme.accent"]').evaluate(node => { node.value = '#66cc88'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[name="theme.titleSize"]').fill('32'); await page.getByRole('button', { name: 'Apply design', exact: true }).click(); await eventually(async () => (await state()).config.theme.accent === '#66cc88', 'Theme update failed');
  await page.locator('[name="zones.right.x"]').fill('1400'); await page.getByRole('button', { name: 'Apply positions', exact: true }).click(); await eventually(async () => (await state()).config.zones.right.x === 1400, 'Zone update failed');
  checks.push('Brand, image decoding/upload, colors, font size and zone positions');
  const downloaded = page.waitForEvent('download'); await page.locator('#exportButton').click(); const download = await downloaded, exportedPath = join(temporary, 'layout.json'); await download.saveAs(exportedPath);
  const preset = JSON.parse(await readFile(exportedPath, 'utf8')); assert.ok(preset.logoDataUrl); assert.equal(preset.config.content.title, 'NORTHSIDE');
  await page.locator('#removeLogo').click(); await eventually(async () => (await state()).config.content.logoUrl === '', 'Logo removal failed');
  await page.locator('#importInput').setInputFiles(exportedPath); await eventually(async () => (await state()).config.content.logoUrl.startsWith('/uploads/'), 'Portable import failed');
  await page.locator('#saveButton').click(); await eventually(async () => !(await state()).dirty && (await state()).savedAt, 'Save failed'); await f.restart(); await page.goto(f.app.baseUrl); await page.locator('#primaryTimer:enabled').waitFor();
  assert.equal((await state()).config.content.title, 'NORTHSIDE'); assert.equal((await state()).timer.status, 'idle'); checks.push('Portable export/import with logo, saved layout and safe server restart');
  await page.locator('[data-visibility="logo"]').uncheck(); await eventually(async () => !(await state()).config.visible.logo, 'Visibility failed');
  await page.locator('#audioButton').click(); await eventually(async () => Boolean((await state()).audioClientId), 'Audio activation failed'); await page.locator('#audioButton').click();
  checks.push('Live visibility and explicit sound activation');
  await page.getByRole('button', { name: 'Design', exact: true }).click(); page.once('dialog', d => d.accept()); await page.locator('#defaultsButton').click();
  await eventually(async () => (await state()).config.content.title === 'WODCAST', 'Defaults failed'); await page.getByRole('button', { name: 'Studio', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await screenshot(page, 'studio-desktop.png');
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } }), phone = await phoneContext.newPage(); watch(phone); await phone.goto(paired.app.baseUrl);
  await phone.locator('#pairDialog[open]').waitFor(); await phone.locator('#pairCode').fill(paired.app.pairingCode); await phone.getByRole('button', { name: 'Connect', exact: true }).click(); await phone.locator('#primaryTimer:enabled').waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await screenshot(phone, 'studio-mobile.png'); await phoneContext.close(); checks.push('Pairing dialog and a 390px mobile viewport without horizontal overflow');
  const standalone = await context.newPage(); watch(standalone); await standalone.goto(pathToFileURL(resolve(root, 'WODCAST-Preview.html')).href); await standalone.locator('#primaryTimer:enabled').waitFor(); assert.equal(await standalone.locator('#demoBanner').isVisible(), true);
  await standalone.locator('#primaryTimer').click(); await eventually(async () => (await standalone.locator('#timerStatus').textContent()) === 'RUNNING', 'Standalone timer failed');
  const popupEvent = context.waitForEvent('page'); await standalone.locator('#openOverlay').click(); const popup = await popupEvent; watch(popup); await popup.locator('.ov-title').waitFor(); assert.equal(await popup.locator('.ov-title').textContent(), 'WODCAST'); await popup.close(); checks.push('Self-contained file preview and its separate output window');
  await context.close(); assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  console.log(JSON.stringify({ status: 'passed', checks, pageErrors: errors.length, externalRequests: externalRequests.length }, null, 2));
} finally { await browser.close(); await f.close(); await paired.close(); await rm(temporary, { recursive: true, force: true }); }
