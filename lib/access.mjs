import { randomBytes, randomInt } from 'node:crypto';

export const isLoopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
export class AccessControl {
  constructor({ now = Date.now, code = String(randomInt(100000, 1000000)) } = {}) {
    this.now = now; this.code = code; this.sessions = new Map(); this.attempts = new Map();
  }
  authorized(cookie = '') {
    const token = cookie.split(';').map(v => v.trim()).find(v => v.startsWith('wodcast_session='))?.slice(16);
    return Boolean(token && (this.sessions.get(token) || 0) > this.now());
  }
  session() {
    for (const [token, expiry] of this.sessions) if (expiry <= this.now()) this.sessions.delete(token);
    if (this.sessions.size >= 128) this.sessions.delete(this.sessions.keys().next().value);
    const token = randomBytes(24).toString('base64url'); this.sessions.set(token, this.now() + 43200000);
    return `wodcast_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`;
  }
  pair(address, code) {
    const previous = this.attempts.get(address);
    const attempt = previous && this.now() - previous.since < 60000 ? previous : { since: this.now(), count: 0 };
    attempt.count++; this.attempts.set(address, attempt);
    if (this.attempts.size > 256) this.attempts.delete(this.attempts.keys().next().value);
    if (attempt.count > 6) throw Object.assign(new Error('Too many attempts. Wait one minute.'), { status: 429 });
    if (String(code) !== this.code) throw Object.assign(new Error('Incorrect pairing code.'), { status: 401 });
    this.attempts.delete(address); return this.session();
  }
}
