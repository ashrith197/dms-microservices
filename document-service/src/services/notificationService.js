const { publishEvent } = require("./queueService");
const axios = require("axios");

const buildPayload = (event, document, extra = {}) => ({
  event,
  documentId:     document._id,
  title:          document.title,
  ownerId:        document.ownerId,           // original creator — audit
  currentOwnerId: document.currentOwnerId,    // active owner — access
  ownerEmail:     document.ownerEmail,
  organisationId: document.organisationId,
  teamId:         document.teamId || null,
  filename:       document.filename || null,
  timestamp:      new Date().toISOString(),
  ...extra,
});

const httpFallback = (payload) => {
  axios
    .post(
      `${process.env.NOTIFICATION_SERVICE_URL}/notifications/events`,
      payload,
      { timeout: 3000 }
    )
    .catch((err) => {
      console.warn("[Notification] HTTP fallback failed:", err.message);
    });
};

const sendEvent = (routingKey, payload) => {
  try {
    publishEvent(routingKey, payload);
  } catch {
    httpFallback(payload);
  }
};

const notifyDocumentUploaded = (document, extra = {}) => {
  sendEvent("document.uploaded", buildPayload("document_uploaded", document, extra));
};

const notifyDocumentDeleted = (document) => {
  sendEvent("document.deleted", buildPayload("document_deleted", document));
};

const notifyDocumentUpdated = (document) => {
  sendEvent("document.updated", buildPayload("document_updated", document));
};

// ── NEW: Offboarding event ──────────────────────────────────
const notifyDocumentsReassigned = ({ fromOwnerId, toOwnerId, toOwnerEmail, organisationId, count }) => {
  publishEvent("documents.reassigned", {
    event:          "documents_reassigned",
    fromOwnerId,
    toOwnerId,
    toOwnerEmail,
    organisationId,
    count,
    timestamp:      new Date().toISOString(),
  });
};

module.exports = {
  notifyDocumentUploaded,
  notifyDocumentDeleted,
  notifyDocumentUpdated,
  notifyDocumentsReassigned,
};
