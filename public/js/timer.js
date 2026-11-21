// A single monotonic clock owns the session. Delayed ticks catch up without drift.
export class TimerEngine {
  constructor(settings, now = () => performance.now()) {
    this.settings = { ...settings }; this.now = now; this.transitionId = 0; this.reset();
  }
  phasesForSettings() {
    const s = this.settings, phases = [];
    if (s.prestartSec) phases.push({ kind: 'ready', seconds: s.prestartSec, round: 0 });
    if (s.mode === 'interval') for (let round = 1; round <= s.rounds; round++) {
      phases.push({ kind: 'work', seconds: s.workSec, round });
      if (s.restSec) phases.push({ kind: 'rest', seconds: s.restSec, round });
    }
    else phases.push({ kind: 'work', seconds: s.mode === 'stopwatch' ? Infinity : s.durationSec, round: 1 });
    return phases;
  }
  configure(settings) {
    if (['running', 'paused'].includes(this.status)) throw new Error('Reset the timer before changing its settings.');
    this.settings = { ...settings }; this.reset();
  }
  reset() {
    this.phases = this.phasesForSettings(); this.status = 'idle'; this.index = 0;
    this.startedAt = this.now(); this.carriedMs = 0; this.transitionId++;
  }
  start() {
    if (this.status === 'running') return;
    if (this.status === 'paused') return this.resume();
    if (this.status === 'finished') this.reset();
    this.status = 'running'; this.startedAt = this.now(); this.transitionId++;
  }
  advance(at = this.now()) {
    if (this.status !== 'running') return;
    let elapsed = this.carriedMs + Math.max(0, at - this.startedAt), phase = this.phases[this.index];
    while (phase && Number.isFinite(phase.seconds) && elapsed >= phase.seconds * 1000) {
      elapsed -= phase.seconds * 1000; this.index++; this.transitionId++; phase = this.phases[this.index];
    }
    this.carriedMs = elapsed; this.startedAt = at;
    if (!phase) { this.status = 'finished'; this.carriedMs = 0; }
  }
  pause() { if (this.status === 'running') { this.advance(); if (this.status !== 'finished') this.status = 'paused'; } }
  resume() { if (this.status === 'paused') { this.startedAt = this.now(); this.status = 'running'; } }
  snapshot() {
    this.advance();
    const s = this.settings, phase = this.status === 'idle' ? this.phases.find(p => p.kind === 'work') : this.phases[this.index];
    const elapsedSec = this.status === 'idle' ? 0 : this.carriedMs / 1000;
    const completed = this.phases.slice(0, this.index).reduce((sum, p) => sum + (p.kind === 'ready' ? 0 : p.seconds), 0);
    return {
      status: this.status, mode: s.mode,
      phase: this.status === 'finished' ? 'finished' : this.status === 'idle' ? 'idle' : phase.kind,
      round: this.status === 'idle' || phase?.kind === 'ready' ? 1 : phase?.round || (s.mode === 'interval' ? s.rounds : 1),
      rounds: s.mode === 'interval' ? s.rounds : 1,
      remainingSec: phase && Number.isFinite(phase.seconds) ? Math.max(0, phase.seconds - elapsedSec) : null,
      elapsedSec, totalSec: s.mode === 'interval' ? s.rounds * (s.workSec + s.restSec) : s.mode === 'stopwatch' ? null : s.durationSec,
      sessionElapsedSec: this.status === 'idle' ? 0 : completed + (phase?.kind === 'ready' ? 0 : elapsedSec),
      transitionId: this.transitionId
    };
  }
}
