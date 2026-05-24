const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../src/models/User");
const {
  register,
  login,
  verifyToken,
} = require("../src/controllers/authController");

process.env.JWT_SECRET = "test-jwt-secret";

const originalMethods = {
  findOne: User.findOne,
  create: User.create,
  findById: User.findById,
};
const originalConsoleError = console.error;

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

const restoreUserMethods = () => {
  User.findOne = originalMethods.findOne;
  User.create = originalMethods.create;
  User.findById = originalMethods.findById;
};

test.afterEach(() => {
  restoreUserMethods();
  console.error = originalConsoleError;
});

test("register creates a user with the default user role", async () => {
  let createdUser;

  User.findOne = async () => null;
  User.create = async (payload) => {
    createdUser = payload;
    return {
      _id: "user-1",
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  };

  const req = {
    body: { name: "Test User", email: "test@example.com", password: "secret" },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.role, "user");
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.role, "user");
  assert.ok(res.body.token);
});

test("register rejects duplicate email addresses", async () => {
  User.findOne = async () => ({ _id: "existing-user" });

  const req = {
    body: { name: "Test User", email: "test@example.com", password: "secret" },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test("register returns a generic 500 response on unexpected errors", async () => {
  console.error = () => {};

  User.findOne = async () => {
    throw new Error("database connection string leaked here");
  };

  const req = {
    body: { name: "Test User", email: "test@example.com", password: "secret" },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Internal server error");
});

test("login returns a token for valid credentials", async () => {
  User.findOne = async () => ({
    _id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "user",
    matchPassword: async () => true,
  });

  const req = { body: { email: "test@example.com", password: "secret" } };
  const res = createResponse();

  await login(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
});

test("login rejects invalid credentials", async () => {
  User.findOne = async () => ({
    matchPassword: async () => false,
  });

  const req = { body: { email: "test@example.com", password: "wrong" } };
  const res = createResponse();

  await login(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Invalid email or password");
});

test("verifyToken rejects invalid tokens", async () => {
  const req = {
    headers: { authorization: "Bearer invalid-token" },
  };
  const res = createResponse();

  await verifyToken(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.valid, false);
  assert.equal(res.body.message, "Invalid token");
});

test("verifyToken rejects expired tokens", async () => {
  const expiredToken = jwt.sign({ id: "user-1" }, process.env.JWT_SECRET, {
    expiresIn: -1,
  });
  const req = {
    headers: { authorization: `Bearer ${expiredToken}` },
  };
  const res = createResponse();

  await verifyToken(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.valid, false);
  assert.equal(res.body.message, "Token has expired");
});

test("verifyToken returns user details for valid tokens", async () => {
  const token = jwt.sign({ id: "user-1" }, process.env.JWT_SECRET);

  User.findById = () => ({
    select: async () => ({
      _id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "user",
    }),
  });

  const req = {
    headers: { authorization: `Bearer ${token}` },
  };
  const res = createResponse();

  await verifyToken(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.valid, true);
  assert.equal(res.body.user.id, "user-1");
});
