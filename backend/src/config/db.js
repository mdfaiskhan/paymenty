const mongoose = require("mongoose");
const env = require("./env");

async function connectDb() {
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: env.mongoMaxPoolSize,
    minPoolSize: env.mongoMinPoolSize,
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
    socketTimeoutMS: env.mongoSocketTimeoutMs
  });
}

module.exports = connectDb;
