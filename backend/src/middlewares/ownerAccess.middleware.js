const env = require("../config/env");
const ApiError = require("../utils/ApiError");

function ownerAccessMiddleware(req, res, next) {
  const provided = req.headers["x-owner-password"];
  if (!provided || provided !== env.ownerModulePassword) {
    return next(new ApiError(403, "Invalid owner module password"));
  }
  return next();
}

module.exports = ownerAccessMiddleware;

