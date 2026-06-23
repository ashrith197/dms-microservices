const User = require("../models/User");
const Organisation = require("../models/Organisation");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const sendInternalError = (res, err, context) => {
  console.error(`${context}:`, err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      organisationId: user.organisationId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// POST /auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, isAdmin, organisationName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Check if isAdmin is true and organisationName is missing
    if (isAdmin === true && !organisationName) {
      return res.status(400).json({
        success: false,
        message: "Organisation name is required for admin registration",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }
    const existingname = await User.findOne({ name });
    if (existingname) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this name",
      });
    }

    // Admin registration flow with transaction
    if (isAdmin === true && organisationName) {
      const existingorg = await Organisation.findOne({ name: organisationName });
      if (existingorg) {
        return res.status(409).json({
          success: false,
          message: "Organisation already exists with this name",
        });
      }
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Step 1: Create Organisation with temporary adminId (placeholder)
        const organisation = await Organisation.create(
          [{ name: organisationName, adminId: new mongoose.Types.ObjectId() }],
          { session }
        );

        // Step 2: Create User with role='admin' and organisationId
        const user = await User.create(
          [{
            name,
            email,
            password,
            role: "admin",
            organisationId: organisation[0]._id
          }],
          { session }
        );

        // Step 3: Update Organisation.adminId with created user._id
        organisation[0].adminId = user[0]._id;
        await organisation[0].save({ session });

        // Step 4: Commit transaction
        await session.commitTransaction();

        // Step 5: Generate token with organisationId populated
        const token = generateToken(user[0]);

        // Step 6: Return response with user object including organisationId
        return res.status(201).json({
          success: true,
          message: "User registered successfully",
          token,
          user: {
            id: user[0]._id,
            name: user[0].name,
            email: user[0].email,
            role: user[0].role,
            organisationId: user[0].organisationId,
          },
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

    // Standard registration flow: Create employee user with null organisationId
    const user = await User.create({ 
      name, 
      email, 
      password, 
      role: "employee",
      organisationId: null 
    });
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
      },
    });
  } catch (err) {
    return sendInternalError(res, err, "Register error");
  }
};

// POST /auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
      },
    });
  } catch (err) {
    return sendInternalError(res, err, "Login error");
  }
};

// GET /auth/verify-token
// Called by other microservices to validate JWT
const verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Confirm user still exists in DB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
      },
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        valid: false,
        message: "Token has expired",
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        valid: false,
        message: "Invalid token",
      });
    }
    return sendInternalError(res, err, "Verify token error");
  }
};

module.exports = { register, login, verifyToken };
