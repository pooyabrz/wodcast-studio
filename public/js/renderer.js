import { FONT_STACKS } from './model.js';

export function formatTime(seconds, countUp = false) {
  const n = Math.max(0, countUp ? Math.floor(seconds || 0) : Math.ceil(seconds || 0));
  const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function displayTimer(client) {
  const timer = client.state.timer;
  const dt = timer.status === 'running' && client.connected ? Math.max(0, (performance.now() - client.receivedAt) / 1000) : 0;
  const countUp = timer.mode === 'stopwatch' && timer.phase !== 'ready';
  const value = timer.status === 'finished' ? 0 : countUp ? timer.elapsedSec + dt : Math.max(0, (timer.remainingSec || 0) - dt);
  return { value, text: formatTime(value, countUp), countUp, progress: timer.totalSec ? Math.min(1, (timer.sessionElapsedSec + (timer.phase === 'ready' ? 0 : dt)) / timer.totalSec) : 0 };
}
export function createOverlay(container, client) {
  container.classList.add('overlay-host');
  container.innerHTML = `<div class="overlay-canvas">
    <section class="ov-zone ov-brand" data-zone="left"><div class="ov-brand-head"><img class="ov-logo" data-field="logo" alt="Studio logo"><strong class="ov-title" data-field="title"></strong></div><div class="ov-event"></div><div class="ov-subtitle" data-field="subtitle"></div><div class="ov-free" data-field="freeText"></div></section>
    <section class="ov-zone ov-timer" data-zone="center" data-field="timer"><div class="ov-phase"><i></i><span>READY</span></div><div class="ov-time">12:00</div><div class="ov-round" data-field="round"></div><div class="ov-progress"><i></i></div></section>
    <section class="ov-zone ov-info" data-zone="right"><div class="ov-label" data-field="wod">WORKOUT OF THE DAY<i></i></div><div class="ov-wod" data-field="wod"></div><div class="ov-coach" data-field="trainer"><span class="ov-avatar">CA</span><div><small>YOUR COACH</small><strong></strong></div></div><div class="ov-notes" data-field="notes"></div><div class="ov-clock" data-field="clock"><span>LIVE SESSION</span><time></time></div></section>
  </div>`;
  const board = container.firstElementChild, q = selector => board.querySelector(selector);
  const scale = () => {
    const ratio = Math.min(container.clientWidth / 1920, container.clientHeight / 1080);
    board.style.transform = `scale(${ratio})`; board.style.left = `${(container.clientWidth - 1920 * ratio) / 2}px`; board.style.top = `${(container.clientHeight - 1080 * ratio) / 2}px`;
  };
  const observer = new ResizeObserver(scale); observer.observe(container); scale();
  let signature = '', clock;
  function renderConfig(config) {
    const next = JSON.stringify(config); if (signature === next) return; signature = next;
    const { content: c, theme: t, visible, zones } = config;
    for (const [name, zone] of Object.entries(zones)) {
      const node = q(`[data-zone="${name}"]`); Object.assign(node.style, { left: `${zone.x}px`, top: `${zone.y}px`, width: `${zone.width}px`, height: `${zone.height}px` }); node.classList.toggle('zone-hidden', !zone.visible);
    }
    for (const node of board.querySelectorAll('[data-field]')) node.classList.toggle('field-hidden', !visible[node.dataset.field]);
    board.classList.toggle('no-animation', !t.animate); board.style.fontFamily = FONT_STACKS[t.font];
    board.style.setProperty('--ov-accent', t.accent); board.style.setProperty('--ov-text', t.textColor); board.style.setProperty('--ov-panel', `rgba(12,23,19,${t.panelOpacity})`);
    for (const field of ['titleSize', 'eventSize', 'subtitleSize', 'freeTextSize', 'textSize', 'coachSize', 'notesSize', 'clockSize', 'timerSize']) board.style.setProperty(`--${field}`, `${t[field]}px`);
    for (const cls of ['.ov-brand', '.ov-info']) q(cls).style.textAlign = t.align;
    for (const cls of ['.ov-brand-head', '.ov-coach']) q(cls).style.justifyContent = t.align === 'left' ? 'flex-start' : t.align === 'center' ? 'center' : 'flex-end';
    for (const [selector, key] of [['.ov-title', 'title'], ['.ov-event', 'event'], ['.ov-subtitle', 'subtitle'], ['.ov-free', 'freeText'], ['.ov-coach strong', 'trainer'], ['.ov-notes', 'notes']]) q(selector).textContent = c[key];
    const logo = q('.ov-logo'), asset = window.WODCAST_ASSETS?.[c.logoUrl] || c.logoUrl;
    if (asset) logo.src = asset; else logo.removeAttribute('src'); logo.classList.toggle('field-hidden', !visible.logo || !asset);
    q('.ov-avatar').textContent = c.trainer.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    q('.ov-wod').replaceChildren();
    c.wod.split('\n').forEach((line, i) => { const node = container.ownerDocument.createElement('div'); node.className = i ? 'ov-wod-line' : 'ov-wod-heading'; node.textContent = line; q('.ov-wod').append(node); });
    clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: c.timeZone });
  }
  function draw() {
    const { config, timer } = client.state; renderConfig(config); const display = displayTimer(client);
    q('.ov-phase span').textContent = !client.connected ? 'SYNC LOST' : timer.status === 'paused' ? 'PAUSED' : ({ idle: 'READY', ready: 'GET READY', work: 'WORK', rest: 'REST', finished: 'FINISHED' })[timer.phase];
    let color = timer.phase === 'rest' ? '#99d9ef' : config.theme.timerColor;
    if (config.theme.warningColors && timer.phase === 'work' && !display.countUp) color = display.value <= config.theme.redAt ? '#ff7869' : display.value <= config.theme.yellowAt ? '#f5d46b' : config.theme.accent;
    q('.ov-time').style.color = color; q('.ov-time').textContent = display.text; q('.ov-time').classList.toggle('has-hours', display.text.split(':').length === 3);
    q('.ov-round').textContent = timer.mode === 'interval' ? `ROUND ${timer.round} / ${timer.rounds}` : timer.mode === 'stopwatch' ? 'STOPWATCH' : 'TIME CAP';
    q('.ov-progress i').style.width = `${display.progress * 100}%`; q('.ov-clock time').textContent = clock.format(new Date());
  }
  const unsubscribe = client.on(draw), interval = setInterval(draw, 100); draw();
  return () => { clearInterval(interval); observer.disconnect(); unsubscribe(); };
}
