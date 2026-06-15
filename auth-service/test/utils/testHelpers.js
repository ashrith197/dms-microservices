/**
 * Property-Based Testing Helper Utilities
 * 
 * This module provides helper functions for setting up test databases,
 * making API requests, and validating responses in property-based tests.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

/**
 * Connect to test database
 * Uses a separate test database to avoid affecting production/development data
 */
const connectTestDB = async () => {
  const testDbUri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/auth-service-test';
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  await mongoose.connect(testDbUri);
};

/**
 * Disconnect from test database
 */
const disconnectTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

/**
 * Clear all collections in the test database
 */
const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Decode a JWT token without verification (for testing payload structure)
 * @param {string} token - JWT token string
 * @returns {Object} Decoded payload
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Verify a JWT token with the secret
 * @param {string} token - JWT token string
 * @returns {Object} Verified payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Check if a timestamp is within ±5 seconds of now
 * @param {Date} timestamp - Timestamp to check
 * @param {Date} reference - Reference time (defaults to now)
 * @returns {boolean} True if within range
 */
const isRecentTimestamp = (timestamp, reference = new Date()) => {
  const diff = Math.abs(timestamp.getTime() - reference.getTime());
  return diff <= 5000; // 5 seconds in milliseconds
};

/**
 * Generate a unique email for testing (to avoid duplicates across test runs)
 * @param {string} baseEmail - Base email address
 * @returns {string} Unique email with timestamp
 */
const uniqueEmail = (baseEmail) => {
  const [local, domain] = baseEmail.split('@');
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${local}+${timestamp}${random}@${domain}`;
};

/**
 * Wait for a specified number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} delayMs - Initial delay in milliseconds (default: 100)
 * @returns {Promise<any>} Result of the operation
 */
const retryOperation = async (operation, maxRetries = 3, delayMs = 100) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await sleep(delayMs * Math.pow(2, attempt)); // Exponential backoff
      }
    }
  }
  
  throw lastError;
};

/**
 * Extract error message from error response
 * @param {Error} error - Error object
 * @returns {string} Error message
 */
const extractErrorMessage = (error) => {
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }
  return error.message || 'Unknown error';
};

/**
 * Validate response structure for registration/login
 * @param {Object} response - API response object
 * @returns {boolean} True if structure is valid
 */
const hasValidAuthResponseStructure = (response) => {
  return (
    response &&
    typeof response.success === 'boolean' &&
    typeof response.message === 'string' &&
    typeof response.token === 'string' &&
    response.user &&
    typeof response.user.id === 'string' &&
    typeof response.user.name === 'string' &&
    typeof response.user.email === 'string' &&
    typeof response.user.role === 'string' &&
    'organisationId' in response.user
  );
};

/**
 * Validate response structure for verify-token
 * @param {Object} response - API response object
 * @returns {boolean} True if structure is valid
 */
const hasValidVerifyTokenResponseStructure = (response) => {
  return (
    response &&
    typeof response.success === 'boolean' &&
    typeof response.valid === 'boolean' &&
    response.user &&
    typeof response.user.id === 'string' &&
    typeof response.user.name === 'string' &&
    typeof response.user.email === 'string' &&
    typeof response.user.role === 'string' &&
    'organisationId' in response.user
  );
};

module.exports = {
  connectTestDB,
  disconnectTestDB,
  clearDatabase,
  decodeToken,
  verifyToken,
  isRecentTimestamp,
  uniqueEmail,
  sleep,
  retryOperation,
  extractErrorMessage,
  hasValidAuthResponseStructure,
  hasValidVerifyTokenResponseStructure
};
