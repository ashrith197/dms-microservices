const axios = require("axios");
const PermissionGroup = require("../models/PermissionGroup");

// ─────────────────────────────────────────
// Check if a user has access to a document
//
// Rules:
// 1. Admin always has access
// 2. If document.permissionGroupIds is empty → all org members have access
// 3. If permissionGroupIds is set → user must be in at least one group
//    either directly (userIds) or via team membership (teamIds)
// ─────────────────────────────────────────
const hasDocumentAccess = async (userId, userRole, document) => {
  // Admin always has access
  if (userRole === "admin") return true;

  // Current owner always has access to their document
  if (document.currentOwnerId === userId) return true;

  // No permission groups set — public to entire organisation
  if (!document.permissionGroupIds || document.permissionGroupIds.length === 0) {
    return true;
  }

  // Fetch the permission groups on this document
  const groups = await PermissionGroup.find({
    _id: { $in: document.permissionGroupIds },
  });

  if (groups.length === 0) return true; // groups deleted — treat as open

  // Check direct user access
  const hasDirectAccess = groups.some((g) => g.userIds.includes(userId));
  if (hasDirectAccess) return true;

  // Check team-based access — fetch user's teams from User Management Service
  try {
    const response = await axios.get(
      `${process.env.USER_MANAGEMENT_SERVICE_URL}/teams`,
      {
        headers: {
          "x-user-id": userId,
          "x-user-role": userRole,
          "x-organisation-id": document.organisationId?.toString() || "",
        },
        timeout: 5000,
      }
    );

    const userTeamIds = (response.data.teams || [])
      .filter((t) => t.memberIds.includes(userId))
      .map((t) => t._id.toString());

    const hasTeamAccess = groups.some((g) =>
      g.teamIds.some((tid) => userTeamIds.includes(tid.toString()))
    );

    return hasTeamAccess;
  } catch {
    // If User Management Service is down, deny access conservatively
    return false;
  }
};

// ─────────────────────────────────────────
// Pre-fetch user's permission group IDs for search
// Returns array of group IDs the user is a member of
// Called ONCE before search query — not in a loop
// ─────────────────────────────────────────
const getUserPermissionGroupIds = async (userId, userRole, organisationId) => {
  if (userRole === "admin") return null; // admin sees everything — no filter needed

  try {
    const groups = await PermissionGroup.find({ organisationId });
    // Get user's team IDs from User Management Service
    let userTeamIds = [];
    try {
      const response = await axios.get(
        `${process.env.USER_MANAGEMENT_SERVICE_URL}/teams`,
        {
          headers: {
            "x-user-id": userId,
            "x-user-role": userRole,
            "x-organisation-id": organisationId,
          },
          timeout: 5000,
        }
      );

      userTeamIds = (response.data.teams || [])
        .filter((t) => t.memberIds.includes(userId))
        .map((t) => t._id.toString());
    } catch { }

    const accessibleGroupIds = groups
      .filter((g) =>
        g.userIds.includes(userId) ||
        g.teamIds.some((tid) => userTeamIds.includes(tid.toString()))
      )
      .map((g) => g._id);

    return accessibleGroupIds;
  } catch {
    return [];
  }
};

module.exports = { hasDocumentAccess, getUserPermissionGroupIds };
