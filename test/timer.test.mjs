import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, sanitizeConfig } from '../public/js/model.js';
import { TimerEngine } from '../public/js/timer.js';
import { formatTime, displayTimer } from '../public/js/renderer.js';

function clock(settings = {}) { let now = 0; return { engine: new TimerEngine({ ...DEFAULT_CONFIG.timer, prestartSec: 0, durationSec: 10, ...settings }, () => now), advance(ms) { now += ms; } }; }
test('duplicate start is idempotent and pause preserves fractional time', () => {
  const c = clock(); c.engine.start(); c.advance(2300); c.engine.start(); assert.equal(c.engine.snapshot().remainingSec, 7.7);
  c.engine.pause(); c.advance(20000); assert.equal(c.engine.snapshot().remainingSec, 7.7);
  c.engine.resume(); c.advance(7700); assert.equal(c.engine.snapshot().status, 'finished');
});
test('lead-in is separate from the workout and starts at round one', () => {
  const c = clock({ mode: 'interval', prestartSec: 5 }); c.engine.start(); assert.equal(c.engine.snapshot().round, 1);
  c.advance(5500); const s = c.engine.snapshot(); assert.equal(s.phase, 'work'); assert.equal(s.remainingSec, 19.5); assert.equal(s.sessionElapsedSec, .5);
});
test('delayed ticks catch up across multiple phases without accumulated drift', () => {
  const c = clock({ mode: 'interval', rounds: 8, workSec: 20, restSec: 10 }); c.engine.start(); c.advance(95500);
  assert.equal(c.engine.snapshot().round, 4); assert.equal(c.engine.snapshot().remainingSec, 14.5);
  c.advance(144500); assert.equal(c.engine.snapshot().status, 'finished'); assert.equal(c.engine.snapshot().sessionElapsedSec, 240);
});
test('zero-rest intervals and a single complete cycle finish at the correct boundary', () => {
  const c = clock({ mode: 'interval', rounds: 2, workSec: 60, restSec: 0 }); c.engine.start(); c.advance(60000); assert.equal(c.engine.snapshot().round, 2); c.advance(60000); assert.equal(c.engine.snapshot().status, 'finished');
  const s = clock({ mode: 'interval', rounds: 1, workSec: 2, restSec: 1 }); s.engine.start(); s.advance(2000); assert.equal(s.engine.snapshot().phase, 'rest'); s.advance(1000); assert.equal(s.engine.snapshot().status, 'finished');
});
test('stopwatch excludes lead-in and time spent paused', () => {
  const c = clock({ mode: 'stopwatch', prestartSec: 3 }); c.engine.start(); c.advance(4250); assert.equal(c.engine.snapshot().elapsedSec, 1.25);
  c.engine.pause(); c.advance(20000); assert.equal(c.engine.snapshot().elapsedSec, 1.25); c.engine.resume(); c.advance(2000); assert.equal(c.engine.snapshot().elapsedSec, 3.25);
});
test('active configuration is locked and reset restores the original duration', () => {
  const c = clock(); c.engine.start(); assert.throws(() => c.engine.configure(DEFAULT_CONFIG.timer)); c.engine.pause(); assert.throws(() => c.engine.configure(DEFAULT_CONFIG.timer)); c.engine.reset(); assert.equal(c.engine.snapshot().remainingSec, 10);
});
test('schema rejects unsafe logos, invalid numbers, unsupported versions and out-of-bounds dimensions', () => {
  for (const patch of [{ timer: { durationSec: 0 } }, { timer: { rounds: 2.5 } }, { theme: { timerSize: NaN } }, { theme: { accent: ['#ffffff'] } }, { content: { logoUrl: 'https://example.com/track.svg' } }, { content: { timeZone: 'Invalid/Zone' } }, { zones: { right: { x: 1900 } } }, { theme: { yellowAt: 5, redAt: 10 } }, { version: 99 }, { timer: [] }]) assert.throws(() => sanitizeConfig(patch));
});
test('only known properties are copied and text is kept as data', () => {
  const c = sanitizeConfig(JSON.parse('{"__proto__":{"polluted":true},"content":{"title":"<script>alert(1)</script>"},"unknown":5}'));
  assert.equal({}.polluted, undefined); assert.equal(c.content.title, '<script>alert(1)</script>'); assert.equal(c.unknown, undefined);
});
test('display formatting rounds countdown up, stopwatch down and supports hours', () => {
  assert.equal(formatTime(.1), '00:01'); assert.equal(formatTime(.9, true), '00:00'); assert.equal(formatTime(3661), '1:01:01');
  const client = { connected: true, receivedAt: performance.now() - 1000, state: { timer: { status: 'paused', mode: 'countdown', phase: 'work', remainingSec: 6.5, elapsedSec: 3.5, totalSec: 10, sessionElapsedSec: 3.5 } } };
  assert.equal(displayTimer(client).text, '00:07'); client.state.timer.status = 'running'; assert.ok(displayTimer(client).value < 6); client.connected = false; assert.equal(displayTimer(client).value, 6.5);
});
