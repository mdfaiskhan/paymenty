const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin.model");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

async function signup(req, res, next) {
  try {
    const { email, password } = req.validated.body;
    const existing = await Admin.findOne({ email }).lean();
    if (existing) {
      throw new ApiError(409, "Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      email,
      passwordHash,
      role: "admin",
      isActive: true
    });

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return res.status(201).json({
      token,
      admin: { id: admin._id, email: admin.email, role: admin.role }
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.validated.body;
    const admin = await Admin.findOne({ email, isActive: true }).lean();

    if (!admin) {
      throw new ApiError(401, "Invalid credentials");
    }

    const matched = await bcrypt.compare(password, admin.passwordHash);
    if (!matched) {
      throw new ApiError(401, "Invalid credentials");
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return res.status(200).json({
      token,
      admin: { id: admin._id, email: admin.email, role: admin.role }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  login
};
