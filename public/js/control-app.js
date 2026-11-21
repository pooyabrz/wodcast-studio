import { createClient } from './client.js';
import { createOverlay, displayTimer } from './renderer.js';
import { PRESETS, TEXT_LIMITS, THEME_RANGES } from './model.js';

const client = createClient(), $ = selector => document.querySelector(selector), $$ = selector => [...document.querySelectorAll(selector)];
const pending = new Set(), forms = $$('form[data-editor]');
let toastTimer, configSignature = '', lastWarning = '', audio, soundTransition = -1, readyBeep = '';
function toast(message, error = false) {
  $('#toast').textContent = message; $('#toast').classList.toggle('error', error); $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 6500 : 4000);
}
async function run(work, success) {
  try { await work(); if (success) toast(success); return true; } catch (error) { toast(error.message || 'Action failed.', true); return false; }
}
function field(path, label, { type = 'text', options, rows = 2, min, max, step } = {}) {
  const wrapper = document.createElement('label'); wrapper.className = type === 'checkbox' ? 'check-field' : `field${type === 'color' ? ' color-field' : ''}`;
  const input = document.createElement(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input'); input.name = path;
  if (type === 'select') for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); }
  else if (type === 'textarea') input.rows = rows;
  else input.type = type;
  if (path.startsWith('content.') && TEXT_LIMITS[path.split('.')[1]]) input.maxLength = TEXT_LIMITS[path.split('.')[1]];
  if (min !== undefined) input.min = min; if (max !== undefined) input.max = max; if (step !== undefined) input.step = step;
  if (type === 'checkbox') wrapper.append(input, document.createTextNode(label)); else wrapper.append(document.createTextNode(label), input);
  return wrapper;
}
function grid(parent, fields) { const node = document.createElement('div'); node.className = 'field-grid'; node.append(...fields); parent.append(node); return node; }
grid($('#contentFields'), [field('content.event', 'Session title'), field('content.trainer', 'Coach name')]);
$('#contentFields').append(field('content.wod', 'Workout of the day', { type: 'textarea', rows: 5 }), field('content.notes', 'Notes for participants', { type: 'textarea' }));
$('#brandFields').append(field('content.title', 'Brand name'), field('content.subtitle', 'Subtitle'), field('content.freeText', 'Free text', { type: 'textarea' }), field('content.timeZone', 'Live clock time zone', { type: 'select', options: [['UTC', 'UTC'], ['Europe/Berlin', 'Berlin'], ['Europe/London', 'London'], ['Europe/Istanbul', 'Istanbul'], ['Asia/Tehran', 'Tehran']] }));
grid($('#themeFields'), [['accent', 'Accent'], ['textColor', 'Text'], ['timerColor', 'Timer']].map(([key, label]) => field(`theme.${key}`, label, { type: 'color' })));
grid($('#themeFields'), [field('theme.font', 'Text font', { type: 'select', options: [['sans', 'Sans serif'], ['mono', 'Monospace'], ['serif', 'Serif']] }), field('theme.align', 'Text alignment', { type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] })]);
const sizeField = (key, label) => field(`theme.${key}`, `${label} / px`, { type: 'number', min: THEME_RANGES[key][0], max: THEME_RANGES[key][1] });
grid($('#themeFields'), [sizeField('titleSize', 'Brand title'), sizeField('textSize', 'Workout text'), sizeField('timerSize', 'Timer'), field('theme.panelOpacity', 'Panel opacity / 0 to 1', { type: 'number', min: 0, max: 1, step: .05 })]);
const advanced = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Individual text sizes'; advanced.append(summary);
grid(advanced, [['eventSize', 'Session title'], ['subtitleSize', 'Subtitle'], ['freeTextSize', 'Free text'], ['coachSize', 'Coach'], ['notesSize', 'Notes'], ['clockSize', 'Clock']].map(([key, label]) => sizeField(key, label))); $('#themeFields').append(advanced);
$('#themeFields').append(field('theme.warningColors', 'Green / yellow / red timer warnings', { type: 'checkbox' }));
grid($('#themeFields'), [field('theme.yellowAt', 'Yellow at / seconds', { type: 'number', min: 0, max: 600 }), field('theme.redAt', 'Red at / seconds', { type: 'number', min: 0, max: 600 })]);
$('#themeFields').append(field('theme.animate', 'Fade whole zones in and out', { type: 'checkbox' }));
for (const [key, title] of [['left', 'Left / Brand'], ['center', 'Center / Timer'], ['right', 'Right / Workout']]) {
  const section = document.createElement('fieldset'); section.className = 'zone-editor'; const legend = document.createElement('legend'); legend.textContent = title; section.append(legend);
  grid(section, [['x', 'X', 0, 1920], ['y', 'Y', 0, 1080], ['width', 'Width', 180, 1920], ['height', 'Height', 100, 1080]].map(([name, label, min, max]) => field(`zones.${key}.${name}`, label, { type: 'number', min, max, step: 1 })));
  section.append(field(`zones.${key}.visible`, 'Show this zone', { type: 'checkbox' })); $('#zoneFields').append(section);
}
const visibilityNames = { logo: 'Logo', title: 'Brand name', subtitle: 'Subtitle', freeText: 'Free text', timer: 'Timer', round: 'Rounds', wod: 'Workout', trainer: 'Coach', notes: 'Notes', clock: 'Live clock' };
for (const [key, label] of Object.entries(visibilityNames)) {
  const wrapper = document.createElement('label'); wrapper.className = 'visibility-toggle'; wrapper.textContent = label;
  const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.visibility = key; input.setAttribute('aria-label', `Show ${label.toLowerCase()}`); wrapper.append(input); $('#visibilityFields').append(wrapper);
  input.addEventListener('change', async () => { if (!await run(() => client.command('configure', { visible: { [key]: input.checked } }))) input.checked = client.state.config.visible[key]; });
}
const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function setPath(object, path, value) { const keys = path.split('.'); let node = object; for (const key of keys.slice(0, -1)) node = node[key] || (node[key] = {}); node[keys.at(-1)] = value; }
function fill(form) {
  if (pending.has(form)) return;
  for (const input of form.querySelectorAll('[name]')) { const value = getPath(client.state.config, input.name); if (input.type === 'checkbox') input.checked = value; else input.value = value ?? ''; }
  if (form.id === 'timerForm') { $('#durationMin').value = Math.floor(client.state.config.timer.durationSec / 60); $('#durationPart').value = client.state.config.timer.durationSec % 60; }
}
function timerFields() { $('#durationFields').hidden = $('#timerMode').value !== 'countdown'; $('#intervalFields').hidden = $('#timerMode').value !== 'interval'; }
function patch(form) {
  const result = {};
  for (const input of form.querySelectorAll('[name]')) setPath(result, input.name, input.type === 'checkbox' ? input.checked : input.type === 'number' ? input.valueAsNumber : input.value);
  if (form.id === 'timerForm') { result.timer = { ...client.state.config.timer, ...result.timer }; if (result.timer.mode === 'countdown') result.timer.durationSec = $('#durationMin').valueAsNumber * 60 + $('#durationPart').valueAsNumber; }
  return result;
}
createOverlay($('#previewOverlay'), client);
for (const form of forms) {
  form.addEventListener('input', () => { pending.add(form); if (form.id === 'timerForm') timerFields(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (await run(() => client.command('configure', patch(form)), 'Changes are live. Save the layout to keep them.')) { pending.delete(form); fill(form); timerFields(); }
  });
}
function activate(view) {
  if (!['studio', 'design', 'connect', 'guide'].includes(view)) view = 'studio';
  $$('.view').forEach(node => node.classList.toggle('active', node.id === `view-${view}`));
  $$('[data-view]').forEach(node => { node.classList.toggle('active', node.dataset.view === view); node.setAttribute('aria-current', node.dataset.view === view ? 'page' : 'false'); });
  $('#currentView').textContent = ({ studio: 'Studio', design: 'Design', connect: 'Connections', guide: 'Quick guide' })[view];
}
$$('[data-view]').forEach(button => button.addEventListener('click', () => { location.hash = button.dataset.view; activate(button.dataset.view); window.scrollTo({ top: 0 }); }));
window.addEventListener('hashchange', () => activate(location.hash.slice(1))); activate(location.hash.slice(1));
$$('[data-background]').forEach(button => button.addEventListener('click', () => { $('#previewStage').dataset.background = button.dataset.background; $$('[data-background]').forEach(node => node.classList.toggle('active', node === button)); }));
$$('[data-preset]').forEach(button => button.addEventListener('click', async () => {
  if (await run(() => client.command('configure', { timer: PRESETS[button.dataset.preset] }), 'Timer preset applied. Set the workout text separately.')) { pending.delete($('#timerForm')); fill($('#timerForm')); timerFields(); }
}));
$('#primaryTimer').addEventListener('click', () => {
  if (pending.has($('#timerForm'))) return toast('Apply your timer edits before starting.', true);
  const status = client.state.timer.status; run(() => client.command(status === 'running' ? 'pause' : status === 'paused' ? 'resume' : 'start'));
});
function reset() { if (['running', 'paused'].includes(client.state.timer.status) && !confirm('Reset the current workout session?')) return; run(() => client.command('reset'), 'Timer reset.'); }
$('#resetTimer').addEventListener('click', reset);
$('#saveButton').addEventListener('click', () => { if (pending.size) return toast('Apply your open form edits before saving.', true); run(() => client.command('save'), client.demo ? 'Layout saved in this browser.' : 'Layout saved on your computer.'); });
$('#defaultsButton').addEventListener('click', async () => {
  if (!confirm('Restore the default logo, content, timer and positions?')) return;
  if (await run(() => client.command('defaults'), 'Default layout restored. Save to keep it.')) { pending.clear(); forms.forEach(fill); timerFields(); }
});
$('#logoInput').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  await run(async () => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2097152) throw new Error('Use a PNG, JPEG or WebP logo up to 2 MB.');
    const bitmap = await createImageBitmap(file), valid = bitmap.width <= 4096 && bitmap.height <= 4096; bitmap.close();
    if (!valid) throw new Error('Logo must be at most 4096 x 4096 pixels.'); await client.uploadLogo(file);
  }, 'Logo updated. Save the layout to keep it.'); event.target.value = '';
});
$('#removeLogo').addEventListener('click', () => run(() => client.command('configure', { content: { logoUrl: '' } }), 'Logo removed.'));
function download(value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'WODCAST-Layout.json'; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#exportButton').addEventListener('click', () => run(async () => download(await client.exportPreset()), 'Active layout exported.'));
$('#importInput').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const ok = await run(async () => { if (file.size > 3145728) throw new Error('Layout file must be at most 3 MB.'); await client.importPreset(JSON.parse(await file.text())); }, 'Layout imported. Save to keep it.');
  if (ok) { pending.clear(); forms.forEach(fill); timerFields(); } event.target.value = '';
});
$('#copyObs').addEventListener('click', () => run(async () => {
  if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText($('#obsUrl').value);
  else { $('#obsUrl').select(); if (!document.execCommand('copy')) throw new Error('Copy the selected URL manually.'); }
}, 'Overlay URL copied.'));
$('#openOverlay').addEventListener('click', event => {
  if (!client.demo) return;
  event.preventDefault(); const popup = window.open('', 'wodcast-preview-overlay', 'width=1280,height=720');
  if (!popup) return toast('Allow pop-ups to open the preview overlay.', true);
  popup.document.open(); popup.document.write(`<!doctype html><html lang="en"><head><title>WODCAST | Preview Overlay</title><style>${window.WODCAST_OVERLAY_CSS || ''}</style></head><body class="overlay-page"><div id="output" style="width:100vw;height:100vh"></div></body></html>`); popup.document.close();
  const cleanup = createOverlay(popup.document.querySelector('#output'), client); popup.addEventListener('beforeunload', cleanup, { once: true });
});
function tone(frequency = 880, length = .11) {
  if (audio?.state !== 'running') return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.16, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + length);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + length);
}
$('#audioButton').addEventListener('click', () => run(async () => {
  if (client.state.audioClientId === client.clientId) return client.command('releaseAudio', { clientId: client.clientId });
  const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw new Error('This browser does not support audio cues.');
  audio ||= new Audio(); await audio.resume(); soundTransition = client.state.timer.transitionId; await client.command('claimAudio', { clientId: client.clientId }); tone();
}));
function render(state) {
  const { config, timer } = state, allowed = client.connected && client.authorized, locked = ['running', 'paused'].includes(timer.status);
  $('#demoBanner').hidden = !client.demo; $('#offlineBanner').hidden = client.connected || !client.meta;
  const pill = $('#connectionPill'); pill.classList.toggle('online', client.connected); pill.classList.toggle('offline', !client.connected); pill.replaceChildren(document.createElement('i'), document.createTextNode(client.demo ? 'Browser preview' : client.connected ? 'Studio connected' : 'Disconnected'));
  if (configSignature !== JSON.stringify(config)) {
    configSignature = JSON.stringify(config); forms.forEach(fill); timerFields();
    $$('[data-visibility]').forEach(input => { input.checked = config.visible[input.dataset.visibility]; });
    const url = config.content.logoUrl; if (url) $('#logoPreview').src = window.WODCAST_ASSETS?.[url] || url; else $('#logoPreview').removeAttribute('src'); $('#logoPreview').hidden = !url;
    $('#sidebarEvent').textContent = config.content.event || config.content.title;
    $('#sidebarMode').textContent = timer.mode === 'interval' ? `${config.timer.rounds} ROUNDS / ${config.timer.workSec}:${config.timer.restSec} SEC` : timer.mode === 'stopwatch' ? 'STOPWATCH' : `TIME CAP / ${Math.round(config.timer.durationSec / 60)} MIN`;
    $$('[data-preset]').forEach(button => button.classList.toggle('active', JSON.stringify(config.timer) === JSON.stringify(PRESETS[button.dataset.preset])));
  }
  $$('form[data-editor] input, form[data-editor] select, form[data-editor] textarea, form[data-editor] button, [data-visibility], #logoInput, #removeLogo, #exportButton, #importInput, #saveButton, #defaultsButton, #audioButton, #primaryTimer, #resetTimer').forEach(node => { node.disabled = !allowed; });
  $$('#timerForm input, #timerForm select, #timerForm button, [data-preset]').forEach(node => { node.disabled = !allowed || locked; });
  $('#defaultsButton').disabled = !allowed || locked; $('#importInput').disabled = !allowed || locked;
  $('#primaryTimer span').textContent = ({ idle: 'Start workout', running: 'Pause workout', paused: 'Resume workout', finished: 'Start again' })[timer.status];
  $('#primaryTimer use').setAttribute('href', timer.status === 'running' ? '#icon-pause' : '#icon-play');
  $('#timerStatus').textContent = ({ idle: 'READY', running: 'RUNNING', paused: 'PAUSED', finished: 'FINISHED' })[timer.status];
  $('#summaryStatus').textContent = !client.connected ? 'Connection lost' : ({ idle: 'Ready when you are', running: 'Workout in progress', paused: 'Workout paused', finished: 'Workout completed' })[timer.status];
  $('#timerHint').textContent = locked ? 'Reset before changing timer settings.' : 'Set the times before starting.';
  $('#saveState').textContent = state.dirty ? 'Live changes / not saved yet' : state.savedAt ? `Saved / ${new Date(state.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Default layout / not saved yet';
  const ownsAudio = state.audioClientId === client.clientId; $('#audioButton').classList.toggle('enabled', ownsAudio); $('#audioButton span').textContent = ownsAudio ? 'Sound cues enabled here' : state.audioClientId ? 'Move sound cues here' : 'Enable sound cues';
  if (state.storageWarning && state.storageWarning !== lastWarning) { lastWarning = state.storageWarning; toast(state.storageWarning, true); }
  if (client.demo) $('#pairingInfo').textContent = 'Phone control is available in the complete local-server version.';
  else if (client.meta) {
    $('#obsUrl').value = new URL('/overlay.html', location.href).href;
    const info = $('#pairingInfo'), pairing = client.meta.pairing, signature = JSON.stringify(pairing);
    if (info.dataset.signature !== signature) {
      info.dataset.signature = signature; info.replaceChildren();
      if (pairing?.enabled) {
        const code = document.createElement('div'); code.className = 'pair-code'; code.textContent = pairing.code; info.append(code);
        for (const url of pairing.urls) { const node = document.createElement('div'); node.className = 'pair-url'; node.textContent = url; info.append(node); }
        if (!pairing.urls.length) info.append(document.createTextNode('No network address found. Check the computer network connection.'));
      } else { const text = document.createElement('p'); text.className = 'muted'; text.textContent = client.meta.local ? 'Restart with the LAN launcher to enable phone access.' : 'This device is connected. Find the pairing code on the streaming computer.'; info.append(text); }
    }
  }
  if (client.meta && client.connected && !client.authorized && !$('#pairDialog').open) $('#pairDialog').showModal();
  if (client.authorized && $('#pairDialog').open) $('#pairDialog').close();
}
client.on(render);
$('#pairDialog').addEventListener('cancel', event => event.preventDefault());
$('#pairForm').addEventListener('submit', async event => { event.preventDefault(); $('#pairError').textContent = ''; try { await client.pair($('#pairCode').value); toast('Connected to your studio.'); } catch (error) { $('#pairError').textContent = error.message; } });
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !client.connected || !client.authorized || $('#pairDialog').open || event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
  if (event.code === 'Space') { event.preventDefault(); $('#primaryTimer').click(); } else if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset(); }
});
setInterval(() => {
  const display = displayTimer(client), timer = client.state.timer;
  $('#controlTime').textContent = display.text; $('#controlTime').classList.toggle('has-hours', display.text.split(':').length === 3);
  $('#controlPhase').textContent = timer.status === 'paused' ? 'Paused / time preserved' : `${timer.mode === 'interval' ? `Round ${timer.round} / ${timer.rounds}` : timer.mode === 'stopwatch' ? 'Stopwatch' : 'Countdown'} / ${({ idle: 'ready to start', ready: 'get ready', work: 'work', rest: 'rest', finished: 'complete' })[timer.phase]}`;
  if (client.connected && client.authorized && client.state.audioClientId === client.clientId) {
    if (soundTransition !== timer.transitionId) {
      if (soundTransition !== -1 && timer.status === 'running' && ['work', 'rest'].includes(timer.phase)) tone(timer.phase === 'work' ? 880 : 550);
      if (soundTransition !== -1 && timer.status === 'finished') { tone(980, .22); setTimeout(() => tone(980, .22), 300); } soundTransition = timer.transitionId;
    }
    const n = Math.ceil(display.value), key = `${timer.transitionId}:${n}`;
    if (timer.phase === 'ready' && timer.status === 'running' && n > 0 && n <= 3 && readyBeep !== key) { tone(660, .07); readyBeep = key; }
  }
}, 100);
async function connect() { try { await client.connect(); } catch { client.connected = false; client.emit(); toast('Studio is not reachable. Start the server; reconnection is automatic.', true); setTimeout(connect, 3000); } }
connect();
