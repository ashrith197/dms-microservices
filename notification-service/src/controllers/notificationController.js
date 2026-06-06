const Notification = require("../models/Notification");

// ─────────────────────────────────────────
// POST /notifications/events
// Called by Document Service (fire-and-forget)
// Always returns 201 — even on internal failure
// ─────────────────────────────────────────
const receiveEvent = async (req, res) => {
  const {
    event,
    documentId,
    title,
    ownerId,
    ownerEmail,
    filename,
    timestamp,
  } = req.body;

  // Validate required fields — return 400 only for bad payloads
  // (Document Service sends well-formed payloads, so this is a safety net)
  if (!event || !documentId || !title || !ownerId || !ownerEmail || !timestamp) {
    return res.status(400).json({
      success: false,
      message: "Missing required event fields: event, documentId, title, ownerId, ownerEmail, timestamp",
    });
  }

  const validEvents = ["document_uploaded", "document_updated", "document_deleted"];
  if (!validEvents.includes(event)) {
    return res.status(400).json({
      success: false,
      message: `Invalid event type: ${event}. Valid types: ${validEvents.join(", ")}`,
    });
  }

  // Attempt to save — but ALWAYS return 201 regardless of outcome
  // Document Service is fire-and-forget and must not be affected by our failures
  try {
    const notification = await Notification.create({
      event,
      documentId,
      title,
      ownerId,
      ownerEmail,
      filename: filename || null,
      isRead: false,
      timestamp: new Date(timestamp),
    });

    console.log(`[Event] ${event} | doc: ${documentId} | owner: ${ownerEmail} | ${timestamp}`);

    return res.status(201).json({
      success: true,
      message: "Event received and logged",
      notification,
    });
  } catch (err) {
    // Log the failure server-side but still return 201
    // Notification logging failure must never propagate to Document Service
    console.error("[Notification] Error saving event:", err.message);

    return res.status(201).json({
      success: true,
      message: "Event acknowledged (logging failed)",
      error: err.message,   // included for debugging purposes
    });
  }
};

// ─────────────────────────────────────────
// GET /notifications
// Returns notifications for a specific user
// Query params:
//   ?ownerId=xxx     — required
//   ?event=xxx       — optional, filter by event type
//   ?limit=20        — optional, default 20, max 100
// ─────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const { ownerId, event, limit } = req.query;

    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: "ownerId query parameter is required",
      });
    }

    const query = { ownerId };

    if (event) {
      const validEvents = ["document_uploaded", "document_updated", "document_deleted"];
      if (!validEvents.includes(event)) {
        return res.status(400).json({
          success: false,
          message: `Invalid event filter: ${event}. Valid: ${validEvents.join(", ")}`,
        });
      }
      query.event = event;
    }

    const resultLimit = Math.min(parseInt(limit) || 20, 100);

    const [notifications, totalCount] = await Promise.all([
      Notification.find(query).sort({ timestamp: -1 }).limit(resultLimit),
      Notification.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      totalCount,
      hasMore: totalCount > notifications.length,
      notifications,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// PATCH /notifications/:id/read
// Mark a single notification as read
// ─────────────────────────────────────────
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { receiveEvent, getNotifications, markAsRead };
