const axios = require("axios");

const sendNotification = (eventData) => {
  axios
    .post(
      `${process.env.NOTIFICATION_SERVICE_URL}/notifications/events`,
      eventData,
      { timeout: 3000 }
    )
    .catch((err) => {
      console.warn(
        `[Notification] Failed to send "${eventData.event}":`,
        err.message
      );
    });
};

const notifyDocumentUploaded = (document) => {
  sendNotification({
    event: "document_uploaded",
    documentId: document._id,
    title: document.title,
    ownerId: document.ownerId,
    ownerEmail: document.ownerEmail,
    organisationId: document.organisationId,
    filename: document.filename,
    timestamp: new Date().toISOString(),
  });
};

const notifyDocumentDeleted = (document) => {
  sendNotification({
    event: "document_deleted",
    documentId: document._id,
    title: document.title,
    ownerId: document.ownerId,
    ownerEmail: document.ownerEmail,
    organisationId: document.organisationId,
    timestamp: new Date().toISOString(),
  });
};

const notifyDocumentUpdated = (document) => {
  sendNotification({
    event: "document_updated",
    documentId: document._id,
    title: document.title,
    ownerId: document.ownerId,
    ownerEmail: document.ownerEmail,
    organisationId: document.organisationId,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  notifyDocumentUploaded,
  notifyDocumentDeleted,
  notifyDocumentUpdated,
};
