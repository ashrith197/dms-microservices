const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { protect } = require("../src/middleware/authMiddleware");

const originalAxiosGet = axios.get;

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

test.afterEach(() => {
  axios.get = originalAxiosGet;
});

test("protect rejects requests without bearer tokens", async () => {
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("protect verifies tokens through auth-service and forwards user headers", async () => {
  process.env.AUTH_SERVICE_URL = "http://localhost:4000";
  process.env.INTERNAL_SERVICE_KEY = "internal-key";

  axios.get = async (url, options) => {
    assert.equal(url, "http://localhost:4000/auth/verify-token");
    assert.equal(options.headers.Authorization, "Bearer valid-token");
    assert.equal(options.headers["x-internal-service-key"], "internal-key");

    return {
      data: {
        user: {
          id: "user-1",
          email: "test@example.com",
          role: "user",
          name: "Test User",
          organisationId: "org-123",
        },
      },
    };
  };

  const req = { headers: { authorization: "Bearer valid-token" } };
  const res = createResponse();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.headers["x-user-id"], "user-1");
  assert.equal(req.headers["x-user-email"], "test@example.com");
  assert.equal(req.headers["x-user-role"], "user");
  assert.equal(req.headers["x-user-name"], "Test User");
  assert.equal(req.headers["x-organisation-id"], "org-123");
});

test("protect sets x-organisation-id to empty string when organisationId is missing", async () => {
  process.env.AUTH_SERVICE_URL = "http://localhost:4000";
  process.env.INTERNAL_SERVICE_KEY = "internal-key";

  axios.get = async () => ({
    data: {
      user: {
        id: "user-2",
        email: "noorg@example.com",
        role: "employee",
        name: "No Org User",
      },
    },
  });

  const req = { headers: { authorization: "Bearer valid-token" } };
  const res = createResponse();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.headers["x-organisation-id"], "");
});

test("protect forwards auth-service rejection responses", async () => {
  process.env.AUTH_SERVICE_URL = "http://localhost:4000";
  process.env.INTERNAL_SERVICE_KEY = "internal-key";

  axios.get = async () => {
    throw {
      response: {
        status: 401,
        data: { success: false, message: "Invalid token" },
      },
    };
  };

  const req = { headers: { authorization: "Bearer invalid-token" } };
  const res = createResponse();

  await protect(req, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Invalid token");
});

test("protect returns 503 when auth-service is unavailable", async () => {
  process.env.AUTH_SERVICE_URL = "http://localhost:4000";
  process.env.INTERNAL_SERVICE_KEY = "internal-key";

  axios.get = async () => {
    const err = new Error("timeout");
    err.code = "ECONNABORTED";
    throw err;
  };

  const req = { headers: { authorization: "Bearer valid-token" } };
  const res = createResponse();

  await protect(req, res, () => {});

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.message, "Authentication service unavailable");
});
