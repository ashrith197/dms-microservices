const Document = require("../models/Document");
const { extractUserHeaders } = require("../utils/helpers");

// ─────────────────────────────────────────
// GET /search
// Query parameters:
//   q         — search text (title, category, tags)
//   mode      — "text" (default, uses index, faster) or "regex" (partial match, flexible)
//   category  — partial match on category
//   date      — exact day filter (YYYY-MM-DD)
//   dateFrom  — range start (YYYY-MM-DD)
//   dateTo    — range end (YYYY-MM-DD)
//   mimetype  — exact MIME type filter
//   sort      — "date-desc" (default) | "date-asc" | "title-asc" | "title-desc" | "size-asc" | "size-desc" | "relevance"
//   limit     — max results (default 20, max 100)
//   page      — page number (default 1)
// ─────────────────────────────────────────
const search = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers (x-user-id, x-user-email, x-user-role). Request must come through API Gateway.",
      });
    }

    const {
      q, mode, category, date, dateFrom, dateTo,
      mimetype, sort, limit, page,
    } = req.query;

    // Must provide at least one search parameter
    if (!q && !category && !date && !dateFrom && !dateTo && !mimetype) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one search parameter: q, category, date, dateFrom, dateTo, or mimetype",
      });
    }

    // Base filter — never return soft-deleted documents
    const filter = { isDeleted: false };

    // Role-based scoping — users only see their own documents
    if (user.userRole !== "admin") {
      filter.ownerId = user.ownerId;
    }

    // ── Text search (hybrid: text index OR regex) ──────────────────
    if (q) {
      const searchMode = mode === "regex" ? "regex" : "text";

      if (searchMode === "text") {
        // Uses MongoDB text index — faster on large collections
        // Handles stemming and stop words automatically
        // Use mode=regex for partial matching (e.g. "rep" matching "report")
        filter.$text = { $search: q };
      } else {
        // Regex mode — partial match, case-insensitive
        // Slower but more flexible (finds "rep" inside "report")
        const regex = new RegExp(q, "i");
        filter.$or = [
          { title: { $regex: regex } },
          { category: { $regex: regex } },
          { tags: { $elemMatch: { $regex: regex } } },
        ];
      }
    }

    // ── Category filter (partial match, case-insensitive) ──────────
    if (category) {
      filter.category = { $regex: new RegExp(category, "i") };
    }

    // ── Exact date filter (single day) ─────────────────────────────
    if (date) {
      const start = new Date(date);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    // ── Date range filter ──────────────────────────────────────────
    if (dateFrom || dateTo) {
      filter.createdAt = filter.createdAt || {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (isNaN(from.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid dateFrom format. Use YYYY-MM-DD",
          });
        }
        filter.createdAt.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (isNaN(to.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid dateTo format. Use YYYY-MM-DD",
          });
        }
        to.setDate(to.getDate() + 1); // inclusive end date
        filter.createdAt.$lt = to;
      }
    }

    // ── MIME type filter (exact match) ─────────────────────────────
    if (mimetype) {
      filter.mimetype = mimetype;
    }

    // ── Sort options ───────────────────────────────────────────────
    const sortBy = sort || "date-desc";
    let sortObj = {};

    switch (sortBy) {
      case "date-asc":      sortObj = { createdAt: 1 };  break;
      case "date-desc":     sortObj = { createdAt: -1 }; break;
      case "title-asc":     sortObj = { title: 1 };      break;
      case "title-desc":    sortObj = { title: -1 };     break;
      case "size-asc":      sortObj = { size: 1 };       break;
      case "size-desc":     sortObj = { size: -1 };      break;
      case "relevance":
        // Only meaningful with $text search — sorts by MongoDB text score
        if (filter.$text) {
          sortObj = { score: { $meta: "textScore" } };
        } else {
          sortObj = { createdAt: -1 }; // fallback if no text search active
        }
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    // ── Pagination ─────────────────────────────────────────────────
    const resultLimit  = Math.min(parseInt(limit) || 20, 100);
    const currentPage  = Math.max(parseInt(page) || 1, 1);
    const skip         = (currentPage - 1) * resultLimit;

    // Fields to return — never expose filepath or storedFilename
    // Include textScore projection when using $text search
    const selectFields = filter.$text
      ? "title filename mimetype size category tags ownerId ownerEmail createdAt updatedAt"
      : "title filename mimetype size category tags ownerId ownerEmail createdAt updatedAt";

    // Build query — include textScore if relevance sort is active
    let queryBuilder = Document.find(filter)
      .select(selectFields)
      .sort(sortObj)
      .skip(skip)
      .limit(resultLimit);

    if (sortBy === "relevance" && filter.$text) {
      queryBuilder = queryBuilder.select({ score: { $meta: "textScore" } });
    }

    const [results, totalCount] = await Promise.all([
      queryBuilder,
      Document.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: results.length,
      totalCount,
      page: currentPage,
      totalPages: Math.ceil(totalCount / resultLimit),
      hasMore: totalCount > skip + results.length,
      searchMode: q ? (mode === "regex" ? "regex" : "text") : null,
      results,
    });
  } catch (err) {
    console.error("[Search] Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /search/filters
// Returns available filter options for this user
// Includes: categories, mimetypes, tags, date range, total count
// ─────────────────────────────────────────
const getFilters = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers. Request must come through API Gateway.",
      });
    }

    const scope = { isDeleted: false };
    if (user.userRole !== "admin") {
      scope.ownerId = user.ownerId;
    }

    // Run all distinct queries and aggregate in parallel
    const [categories, mimetypes, tags, dateRange] = await Promise.all([
      Document.distinct("category", scope),
      Document.distinct("mimetype", scope),
      Document.distinct("tags", scope),
      Document.aggregate([
        { $match: scope },
        {
          $group: {
            _id: null,
            minDate: { $min: "$createdAt" },
            maxDate: { $max: "$createdAt" },
            totalDocuments: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      filters: {
        categories:     categories.filter(Boolean).sort(),
        mimetypes:      mimetypes.filter(Boolean).sort(),
        tags:           tags.filter(Boolean).sort(),
        dateRange:      dateRange[0] || { minDate: null, maxDate: null, totalDocuments: 0 },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /search/stats
// Returns document statistics for this user
// Useful for analytics dashboard
// ─────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers. Request must come through API Gateway.",
      });
    }

    const scope = { isDeleted: false };
    if (user.userRole !== "admin") {
      scope.ownerId = user.ownerId;
    }

    const stats = await Document.aggregate([
      { $match: scope },
      {
        $group: {
          _id: null,
          totalDocuments:  { $sum: 1 },
          totalSize:       { $sum: "$size" },
          avgSize:         { $avg: "$size" },
          categoryCounts:  { $push: "$category" },
          mimetypeCounts:  { $push: "$mimetype" },
        },
      },
    ]);

    if (stats.length === 0) {
      return res.status(200).json({
        success: true,
        stats: {
          totalDocuments: 0,
          totalSize: 0,
          avgSize: 0,
          byCategory: {},
          byMimetype: {},
        },
      });
    }

    const result = stats[0];

    // Count occurrences of each category and mimetype
    const byCategory = result.categoryCounts.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const byMimetype = result.mimetypeCounts.reduce((acc, mime) => {
      acc[mime] = (acc[mime] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      stats: {
        totalDocuments: result.totalDocuments,
        totalSize:      result.totalSize,
        avgSize:        Math.round(result.avgSize),
        byCategory,
        byMimetype,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { search, getFilters, getStats };
