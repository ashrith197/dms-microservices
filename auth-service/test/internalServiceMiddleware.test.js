const test = require("node:test");
const assert = require("node:assert/strict");
const {
  requireInternalServiceKey,
} = require("../src/middleware/internalServiceMiddleware");

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("requireInternalServiceKey rejects missing internal service keys", () => {
  process.env.INTERNAL_SERVICE_KEY = "expected-key";
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  requireInternalServiceKey(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("requireInternalServiceKey allows matching internal service keys", () => {
  process.env.INTERNAL_SERVICE_KEY = "expected-key";
  const req = { headers: { "x-internal-service-key": "expected-key" } };
  const res = createResponse();
  let nextCalled = false;

  requireInternalServiceKey(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});
