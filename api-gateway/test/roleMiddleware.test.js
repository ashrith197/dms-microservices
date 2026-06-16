const test = require("node:test");
const assert = require("node:assert/strict");
const { requireRole } = require("../src/middleware/roleMiddleware");

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

test("requireRole allows matching role", () => {
  const middleware = requireRole(["admin"]);
  const req = { headers: { "x-user-role": "admin" } };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("requireRole allows any of multiple matching roles", () => {
  const middleware = requireRole(["manager", "admin"]);

  // Test manager
  const req1 = { headers: { "x-user-role": "manager" } };
  const res1 = createResponse();
  let next1 = false;
  middleware(req1, res1, () => { next1 = true; });
  assert.equal(next1, true);

  // Test admin
  const req2 = { headers: { "x-user-role": "admin" } };
  const res2 = createResponse();
  let next2 = false;
  middleware(req2, res2, () => { next2 = true; });
  assert.equal(next2, true);
});

test("requireRole rejects non-matching role with 403", () => {
  const middleware = requireRole(["admin"]);
  const req = { headers: { "x-user-role": "employee" } };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.ok(res.body.message.includes("Access denied"));
  assert.ok(res.body.message.includes("admin"));
});

test("requireRole returns 401 when no role header present", () => {
  const middleware = requireRole(["admin"]);
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.ok(res.body.message.includes("No role found"));
});

test("requireRole rejects employee from manager+admin route", () => {
  const middleware = requireRole(["manager", "admin"]);
  const req = { headers: { "x-user-role": "employee" } };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.ok(res.body.message.includes("manager, admin"));
});
