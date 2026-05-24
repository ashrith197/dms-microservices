const test = require("node:test");
const assert = require("node:assert/strict");
const validateEnv = require("../src/config/validateEnv");

test("validateEnv throws when required variables are missing", () => {
  delete process.env.TEST_REQUIRED_ENV;

  assert.throws(
    () => validateEnv(["TEST_REQUIRED_ENV"]),
    /Missing required environment variables: TEST_REQUIRED_ENV/
  );
});

test("validateEnv passes when required variables exist", () => {
  process.env.TEST_REQUIRED_ENV = "present";

  assert.doesNotThrow(() => validateEnv(["TEST_REQUIRED_ENV"]));
});
