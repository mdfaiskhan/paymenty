const mongoose = require("mongoose");

const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    businessType: {
      type: String,
      enum: ["tailor", "butcher"],
      required: true
    },
    workerCount: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

ownerSchema.index({ businessType: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Owner", ownerSchema);

