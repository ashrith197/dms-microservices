const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Organisation = require("../src/models/Organisation");
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
const originalOrgMethods = {
  create: Organisation.create,
};
const originalMongooseMethods = {
  startSession: mongoose.startSession,
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
  Organisation.create = originalOrgMethods.create;
  mongoose.startSession = originalMongooseMethods.startSession;
};

test.afterEach(() => {
  restoreUserMethods();
  console.error = originalConsoleError;
});

test("register creates a user with the default employee role", async () => {
  let createdUser;

  User.findOne = async () => null;
  User.create = async (payload) => {
    createdUser = payload;
    return {
      _id: "user-1",
      name: payload.name,
      email: payload.email,
      role: payload.role,
      organisationId: payload.organisationId,
    };
  };

  const req = {
    body: { name: "Test User", email: "test@example.com", password: "secret" },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.role, "employee");
  assert.equal(createdUser.organisationId, null);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.role, "employee");
  assert.equal(res.body.user.organisationId, null);
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
    role: "employee",
    organisationId: null,
    matchPassword: async () => true,
  });

  const req = { body: { email: "test@example.com", password: "secret" } };
  const res = createResponse();

  await login(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.organisationId, null);
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
      role: "employee",
      organisationId: null,
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
  assert.equal(res.body.user.organisationId, null);
});

test("register generates token with null organisationId for standard users", async () => {
  User.findOne = async () => null;
  User.create = async (payload) => ({
    _id: "user-1",
    name: payload.name,
    email: payload.email,
    role: payload.role || "employee",
    organisationId: payload.organisationId,
  });

  const req = {
    body: { name: "Test User", email: "test@example.com", password: "secret" },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.organisationId, null);
  const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(decoded.id, "user-1");
  assert.equal(decoded.email, "test@example.com");
  assert.equal(decoded.name, "Test User");
  assert.equal(decoded.role, "employee");
  assert.equal(decoded.organisationId, null);
});

test("register generates token with organisationId when user has organisation", async () => {
  User.findOne = async () => null;
  User.create = async (payload) => ({
    _id: "user-1",
    name: payload.name,
    email: payload.email,
    role: "admin",
    organisationId: "org-123",
  });

  const req = {
    body: { name: "Admin User", email: "admin@example.com", password: "secret" },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 201);
  const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(decoded.id, "user-1");
  assert.equal(decoded.email, "admin@example.com");
  assert.equal(decoded.name, "Admin User");
  assert.equal(decoded.role, "admin");
  assert.equal(decoded.organisationId, "org-123");
});

test("login generates token with null organisationId for users without organisation", async () => {
  User.findOne = async () => ({
    _id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "employee",
    organisationId: null,
    matchPassword: async () => true,
  });

  const req = { body: { email: "test@example.com", password: "secret" } };
  const res = createResponse();

  await login(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.organisationId, null);
  const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(decoded.organisationId, null);
});

test("login generates token with organisationId for users with organisation", async () => {
  User.findOne = async () => ({
    _id: "user-1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    organisationId: "org-123",
    matchPassword: async () => true,
  });

  const req = { body: { email: "admin@example.com", password: "secret" } };
  const res = createResponse();

  await login(req, res);

  assert.equal(res.statusCode, 200);
  const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(decoded.organisationId, "org-123");
});

test("register rejects admin registration without organisationName", async () => {
  User.findOne = async () => null;

  const req = {
    body: {
      name: "Admin User",
      email: "admin@example.com",
      password: "secret",
      isAdmin: true,
      // organisationName is missing
    },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(
    res.body.message,
    "Organisation name is required for admin registration"
  );
});

test("register creates organisation and admin user atomically", async () => {
  let createdOrganisation;
  let createdUser;
  let orgSaved = false;

  User.findOne = async () => null;

  // Mock mongoose session
  const mockSession = {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: () => {},
  };

  mongoose.startSession = async () => mockSession;

  Organisation.create = async ([orgData], { session }) => {
    createdOrganisation = {
      _id: "org-123",
      name: orgData.name,
      adminId: orgData.adminId,
      save: async ({ session }) => {
        orgSaved = true;
        return createdOrganisation;
      },
    };
    return [createdOrganisation];
  };

  User.create = async ([userData], { session }) => {
    createdUser = {
      _id: "user-1",
      name: userData.name,
      email: userData.email,
      role: userData.role,
      organisationId: userData.organisationId,
    };
    return [createdUser];
  };

  const req = {
    body: {
      name: "Admin User",
      email: "admin@example.com",
      password: "secret",
      isAdmin: true,
      organisationName: "Test Organisation",
    },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.role, "admin");
  assert.equal(res.body.user.organisationId, "org-123");
  assert.ok(res.body.token);

  // Verify organisation was created with correct name
  assert.equal(createdOrganisation.name, "Test Organisation");
  // Verify organisation.adminId was updated to user._id
  assert.equal(createdOrganisation.adminId, "user-1");
  // Verify organisation was saved
  assert.equal(orgSaved, true);
  // Verify user was created with admin role
  assert.equal(createdUser.role, "admin");
  assert.equal(createdUser.organisationId, "org-123");

  // Verify JWT token contains organisationId
  const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(decoded.organisationId, "org-123");
  assert.equal(decoded.role, "admin");
});

test("register rolls back transaction when user creation fails", async () => {
  let transactionAborted = false;
  let sessionEnded = false;

  console.error = () => {}; // Suppress error logging

  User.findOne = async () => null;

  const mockSession = {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {
      transactionAborted = true;
    },
    endSession: () => {
      sessionEnded = true;
    },
  };

  mongoose.startSession = async () => mockSession;

  Organisation.create = async ([orgData], { session }) => {
    return [
      {
        _id: "org-123",
        name: orgData.name,
        adminId: orgData.adminId,
        save: async () => {},
      },
    ];
  };

  User.create = async () => {
    throw new Error("Database error: duplicate email");
  };

  const req = {
    body: {
      name: "Admin User",
      email: "admin@example.com",
      password: "secret",
      isAdmin: true,
      organisationName: "Test Organisation",
    },
  };
  const res = createResponse();

  await register(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Internal server error");
  assert.equal(transactionAborted, true);
  assert.equal(sessionEnded, true);
});
