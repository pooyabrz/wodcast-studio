import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccessControl, isLoopback } from '../lib/access.mjs';
test('only explicit loopback addresses receive local privileges', () => {
  assert.equal(isLoopback('127.0.0.1'), true); assert.equal(isLoopback('::1'), true); assert.equal(isLoopback('192.168.1.20'), false);
});
test('sessions are HttpOnly, expire and ignore unknown cookies', () => {
  let now = 0; const access = new AccessControl({ now: () => now }), cookie = access.session();
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.equal(access.authorized(cookie), true);
  assert.equal(access.authorized('wodcast_session=unknown'), false); now = 43200001; assert.equal(access.authorized(cookie), false);
});
test('pairing rate limit expires and successful pairing opens a session', () => {
  let now = 0; const access = new AccessControl({ now: () => now, code: '123456' });
  for (let i = 0; i < 6; i++) assert.throws(() => access.pair('phone', '000000'), { status: 401 });
  assert.throws(() => access.pair('phone', '123456'), { status: 429 }); now = 60001;
  assert.equal(access.authorized(access.pair('phone', '123456')), true);
});
