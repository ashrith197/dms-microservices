const EventLog = require("../models/EventLog");
const mongoose = require("mongoose");

const getLogs = async (req, res) => {
  try {
    const organisationId = req.headers["x-organisation-id"];
    const userRole       = req.headers["x-user-role"];

    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view logs",
      });
    }

    const {
      eventType, userId, documentId,
      startDate, endDate, limit, page,
    } = req.query;

    const query = {};

    if (organisationId) query.organisationId = organisationId;
    if (eventType)      query.event = eventType;
    if (userId)         query.ownerId = userId;
    if (documentId)     query.documentId = documentId;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate)   query.timestamp.$lte = new Date(endDate);
    }

    const resultLimit  = Math.min(parseInt(limit) || 50, 200);
    const currentPage  = Math.max(parseInt(page)  || 1,  1);
    const skip         = (currentPage - 1) * resultLimit;

    const [logs, totalCount] = await Promise.all([
      EventLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(resultLimit),
      EventLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      totalCount,
      page: currentPage,
      totalPages: Math.ceil(totalCount / resultLimit),
      hasMore: totalCount > skip + logs.length,
      logs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getLogById = async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];

    if (userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can view logs" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid log ID" });
    }

    const log = await EventLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ success: false, message: "Log not found" });
    }

    res.status(200).json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getLogs, getLogById };
