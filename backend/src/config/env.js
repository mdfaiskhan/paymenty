const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/paymenty",
  mongoMaxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
  mongoMinPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 1),
  mongoServerSelectionTimeoutMs: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
  mongoSocketTimeoutMs: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  ownerModulePassword: process.env.OWNER_MODULE_PASSWORD || "wadood1234",
  analyticsWarmOnStart: String(process.env.ANALYTICS_WARM_ON_START || "true").toLowerCase() === "true",
  analyticsWarmIntervalMs: Number(process.env.ANALYTICS_WARM_INTERVAL_MS || 300000)
};
