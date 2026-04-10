const test = require("node:test");
const assert = require("node:assert/strict");
const { RateLimiter } = require("../src/rateLimiter");

test("allows first request and tracks remaining", () => {
  const limiter = new RateLimiter({ windowMs: 60000, max: 5 });
  const result = limiter.consume("ip1");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
  assert.equal(result.retryAfterMs, 0);
});

test("blocks request when max is exceeded", () => {
  const limiter = new RateLimiter({ windowMs: 60000, max: 3 });
  limiter.consume("ip2");
  limiter.consume("ip2");
  limiter.consume("ip2");
  const blocked = limiter.consume("ip2");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs > 0);
});

test("resets counter after window expires", () => {
  const limiter = new RateLimiter({ windowMs: 1000, max: 2 });
  const now = Date.now();
  limiter.consume("ip3", now);
  limiter.consume("ip3", now);
  const blocked = limiter.consume("ip3", now);
  assert.equal(blocked.allowed, false);

  const after = now + 1001;
  const reset = limiter.consume("ip3", after);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});

test("tracks different identities independently", () => {
  const limiter = new RateLimiter({ windowMs: 60000, max: 2 });
  const now = Date.now();
  limiter.consume("a", now);
  limiter.consume("a", now);
  const blockedA = limiter.consume("a", now);
  assert.equal(blockedA.allowed, false);

  const allowedB = limiter.consume("b", now);
  assert.equal(allowedB.allowed, true);
});

test("sweep removes expired entries", () => {
  const limiter = new RateLimiter({ windowMs: 500, max: 10 });
  const now = Date.now();
  limiter.consume("sweep-ip", now);
  assert.equal(limiter.store.size, 1);
  limiter.sweep(now + 600);
  assert.equal(limiter.store.size, 0);
});

test("remaining decrements correctly across multiple calls", () => {
  const limiter = new RateLimiter({ windowMs: 60000, max: 10 });
  for (let i = 0; i < 5; i++) {
    const r = limiter.consume("count-ip");
    assert.equal(r.remaining, 10 - (i + 1));
  }
});
