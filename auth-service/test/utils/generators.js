/**
 * Property-Based Testing Generators
 * 
 * This module provides fast-check generators for creating test data
 * for the auth-service multi-tenancy property-based tests.
 */

const fc = require('fast-check');
const mongoose = require('mongoose');

/**
 * Generate valid user names (non-empty strings)
 */
const validUserName = () => fc.string({ minLength: 1, maxLength: 50 });

/**
 * Generate valid email addresses
 */
const validEmail = () => fc.emailAddress();

/**
 * Generate valid passwords (minimum 6 characters)
 */
const validPassword = () => fc.string({ minLength: 6, maxLength: 50 });

/**
 * Generate valid organisation names (non-empty after trimming)
 */
const validOrganisationName = () => 
  fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0);

/**
 * Generate whitespace-only strings for testing validation
 */
const whitespaceOnlyString = () => 
  fc.oneof(
    fc.constant('   '),
    fc.constant('\t\t'),
    fc.constant('\n\n'),
    fc.constant('  \t  '),
    fc.constant('')
  );

/**
 * Generate valid MongoDB ObjectIds
 */
const validObjectId = () => 
  fc.hexaString({ minLength: 24, maxLength: 24 })
    .map(hex => new mongoose.Types.ObjectId(hex));

/**
 * Generate invalid ObjectIds (random strings that won't match any document)
 */
const invalidObjectId = () => 
  fc.hexaString({ minLength: 24, maxLength: 24 })
    .map(hex => new mongoose.Types.ObjectId(hex));

/**
 * Generate valid role enum values
 */
const validRole = () => fc.oneof(
  fc.constant('employee'),
  fc.constant('manager'),
  fc.constant('admin')
);

/**
 * Generate invalid role values (not in enum)
 */
const invalidRole = () => fc.oneof(
  fc.constant('user'),
  fc.constant('superadmin'),
  fc.constant('guest'),
  fc.constant('ADMIN'),
  fc.constant(''),
  fc.constant('invalid_role')
);

/**
 * Generate complete standard registration payload
 */
const standardRegistrationPayload = () => fc.record({
  name: validUserName(),
  email: validEmail(),
  password: validPassword()
});

/**
 * Generate incomplete registration payload (missing one or more required fields)
 */
const incompleteRegistrationPayload = () => fc.oneof(
  fc.record({ email: validEmail(), password: validPassword() }), // missing name
  fc.record({ name: validUserName(), password: validPassword() }), // missing email
  fc.record({ name: validUserName(), email: validEmail() }), // missing password
  fc.record({ name: validUserName() }), // only name
  fc.record({ email: validEmail() }), // only email
  fc.record({ password: validPassword() }), // only password
  fc.record({}) // empty object
);

/**
 * Generate complete admin registration payload
 */
const adminRegistrationPayload = () => fc.record({
  name: validUserName(),
  email: validEmail(),
  password: validPassword(),
  isAdmin: fc.constant(true),
  organisationName: validOrganisationName()
});

/**
 * Generate admin registration payload missing organisationName
 */
const adminRegistrationWithoutOrgName = () => fc.record({
  name: validUserName(),
  email: validEmail(),
  password: validPassword(),
  isAdmin: fc.constant(true)
});

/**
 * Generate login payload
 */
const loginPayload = () => fc.record({
  email: validEmail(),
  password: validPassword()
});

/**
 * Generate incomplete login payload
 */
const incompleteLoginPayload = () => fc.oneof(
  fc.record({ email: validEmail() }), // missing password
  fc.record({ password: validPassword() }), // missing email
  fc.record({}) // empty object
);

/**
 * Generate nullable ObjectId (null or valid ObjectId)
 */
const nullableObjectId = () => fc.oneof(
  fc.constant(null),
  validObjectId()
);

/**
 * Generate a timestamp within ±5 seconds of now
 */
const recentTimestamp = () => {
  const now = Date.now();
  return fc.integer({ min: now - 5000, max: now + 5000 })
    .map(ms => new Date(ms));
};

module.exports = {
  validUserName,
  validEmail,
  validPassword,
  validOrganisationName,
  whitespaceOnlyString,
  validObjectId,
  invalidObjectId,
  validRole,
  invalidRole,
  standardRegistrationPayload,
  incompleteRegistrationPayload,
  adminRegistrationPayload,
  adminRegistrationWithoutOrgName,
  loginPayload,
  incompleteLoginPayload,
  nullableObjectId,
  recentTimestamp
};
