const amqp = require("amqplib");
const { sendEmail } = require("./emailService");
const NotificationRecord = require("../models/NotificationRecord");
const {
  documentUploadedTemplate,
  documentApprovedTemplate,
  documentRejectedTemplate,
  documentSubmittedTemplate,
  documentsReassignedTemplate,
} = require("../templates/emailTemplates");

const EXCHANGE    = "document_events";
const QUEUE       = "notification_queue";
const ROUTING_KEYS = [
  "document.uploaded",
  "document.updated",
  "document.deleted",
  "document.approved",
  "document.rejected",
  "document.submitted_for_approval",
  "documents.reassigned",              // ← NEW offboarding event
];

const recordNotification = async (data) => {
  try {
    await NotificationRecord.create(data);
  } catch (err) {
    console.error("[Notification] Failed to save record:", err.message);
  }
};

const sendAndRecord = async ({ to, subject, html, eventType, organisationId }) => {
  const recipients = Array.isArray(to) ? to : [to];

  for (const email of recipients) {
    try {
      await sendEmail({ to: email, subject, html });
      console.log(`[Email] Sent "${subject}" to ${email}`);
      await recordNotification({ eventType, organisationId, recipientEmail: email, subject, status: "sent" });
    } catch (err) {
      console.error(`[Email] Failed to send to ${email}:`, err.message);
      await recordNotification({ eventType, organisationId, recipientEmail: email, subject, status: "failed", errorMessage: err.message });
    }
  }
};

const processEvent = async (payload) => {
  const { event, organisationId, metadata = {} } = payload;

  switch (event) {
    case "document_uploaded": {
      const teamEmails = metadata.teamMemberEmails || [];
      if (teamEmails.length === 0) return;

      const { subject, html } = documentUploadedTemplate({
        title:     payload.title,
        ownerName: metadata.ownerName || payload.ownerEmail,
      });
      await sendAndRecord({ to: teamEmails, subject, html, eventType: event, organisationId });
      break;
    }

    case "document_submitted_for_approval": {
      const managerEmail = metadata.managerEmail;
      if (!managerEmail) return;

      const { subject, html } = documentSubmittedTemplate({
        title:     payload.title,
        ownerName: metadata.ownerName || payload.ownerEmail,
        ownerEmail: payload.ownerEmail,
      });
      await sendAndRecord({ to: managerEmail, subject, html, eventType: event, organisationId });
      break;
    }

    case "document_approved": {
      const { subject, html } = documentApprovedTemplate({
        title:      payload.title,
        approvedBy: metadata.approvedBy,
      });
      await sendAndRecord({ to: payload.ownerEmail, subject, html, eventType: event, organisationId });
      break;
    }

    case "document_rejected": {
      const { subject, html } = documentRejectedTemplate({
        title:      payload.title,
        rejectedBy: metadata.rejectedBy,
        reason:     metadata.reason,
      });
      await sendAndRecord({ to: payload.ownerEmail, subject, html, eventType: event, organisationId });
      break;
    }

    case "document_updated": {
      // Log only - no email notification for updates
      console.log(`[Notification] Document updated: ${payload.title} (no email sent)`);
      break;
    }

    case "document_deleted": {
      // Log only - no email notification for deletions
      console.log(`[Notification] Document deleted: ${payload.title} (no email sent)`);
      break;
    }

    // ── NEW: Offboarding reassignment notification ────────────
    case "documents_reassigned": {
      // Notify the new owner that documents have been assigned to them
      const { subject, html } = documentsReassignedTemplate({
        fromEmail: metadata.fromOwnerEmail || payload.fromOwnerId,
        toEmail:   payload.toOwnerEmail,
        count:     payload.count,
      });

      await sendAndRecord({
        to:        payload.toOwnerEmail,
        subject,
        html,
        eventType: event,
        organisationId,
      });
      break;
    }

    default:
      console.log(`[Notification] No email handler for: ${event}`);
  }
};

const startConsumer = async () => {
  try {
    const conn    = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();

    await channel.assertExchange(EXCHANGE, "topic", { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });

    for (const key of ROUTING_KEYS) {
      await channel.bindQueue(QUEUE, EXCHANGE, key);
    }

    console.log("[RabbitMQ] Notification Service connected — consuming notification_queue");

    channel.consume(QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());
        await processEvent(payload);
        channel.ack(msg);
      } catch (err) {
        console.error("[Notification] Failed to process:", err.message);
        channel.nack(msg, false, false);
      }
    });

    conn.on("error", (err) => {
      console.error("[RabbitMQ] Notification error:", err.message);
    });
  } catch (err) {
    console.error("[RabbitMQ] Notification failed to connect:", err.message);
    console.log("[RabbitMQ] Retrying in 5 seconds...");
    setTimeout(startConsumer, 5000);
  }
};

module.exports = { startConsumer };
