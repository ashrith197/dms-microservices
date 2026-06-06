const express = require("express");
const router = express.Router();
const {
  receiveEvent,
  getNotifications,
  markAsRead,
} = require("../controllers/notificationController");

// Called by Document Service — receives and logs events
router.post("/events", receiveEvent);

// Called by Frontend (via Gateway in future) — lists notifications for a user
router.get("/", getNotifications);

// Mark a notification as read
router.patch("/:id/read", markAsRead);

module.exports = router;
