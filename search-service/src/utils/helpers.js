/**
 * Validates that required gateway headers are present.
 * Returns { ownerId, ownerEmail, userRole, userName } if valid.
 * Returns null if any required header is missing.
 *
 * Identical pattern to document-service/src/utils/helpers.js
 * for consistency across microservices.
 */
const extractUserHeaders = (req) => {
  const ownerId    = req.headers["x-user-id"];
  const ownerEmail = req.headers["x-user-email"];
  const userRole   = req.headers["x-user-role"];
  const userName   = req.headers["x-user-name"];

  if (!ownerId || !ownerEmail || !userRole) {
    return null;
  }

  return { ownerId, ownerEmail, userRole, userName };
};

module.exports = { extractUserHeaders };
