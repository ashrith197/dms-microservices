/**
 * Validates that required gateway headers are present.
 * Returns { ownerId, ownerEmail, userRole, userName } if valid.
 * Returns null if any required header is missing.
 *
 * Must be called at the start of every controller.
 * If it returns null, respond with 400 immediately — do not proceed.
 */
const extractUserHeaders = (req) => {
  const ownerId = req.headers["x-user-id"];
  const ownerEmail = req.headers["x-user-email"];
  const userRole = req.headers["x-user-role"];
  const userName = req.headers["x-user-name"];

  if (!ownerId || !ownerEmail || !userRole) {
    return null;
  }

  return { ownerId, ownerEmail, userRole, userName };
};

/**
 * Parses tags from request body.
 * Accepts:
 *   - comma-separated string: "finance,legal,2025"
 *   - JSON array string:      '["finance","legal"]'
 *   - actual array:           ["finance", "legal"]
 *   - undefined/null:         returns []
 *
 * Used by both upload and update controllers for consistent behaviour.
 */
const parseTags = (tags) => {
  if (!tags) return [];

  try {
    if (Array.isArray(tags)) {
      return tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (typeof tags === "string") {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    }
  } catch {
    // Not JSON — fall through to comma-split
  }

  if (typeof tags === "string") {
    return tags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  return [];
};

/**
 * Sanitizes ownerId before using it as a filesystem directory name.
 * Strips anything that isn't alphanumeric, hyphen, or underscore.
 * Prevents path traversal if someone bypasses the gateway
 * and sends a crafted x-user-id like "../../etc".
 */
const sanitizeOwnerId = (ownerId) => {
  return String(ownerId).replace(/[^a-zA-Z0-9_-]/g, "_");
};

/**
 * Extracts organisationId from x-organisation-id header
 * Returns null if missing or empty
 */
const extractOrgId = (req) => {
  const orgId = req.headers["x-organisation-id"];
  if (!orgId || orgId.trim() === "") return null;
  return orgId.trim();
};

module.exports = { extractUserHeaders, parseTags, sanitizeOwnerId, extractOrgId };
