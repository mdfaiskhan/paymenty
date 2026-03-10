const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, unique: true },
    ownerName: { type: String, trim: true, maxlength: 120, default: "" },
    ownerPhone: { type: String, trim: true, maxlength: 25, default: "" },
    ownerCommissionPerHour: { type: Number, min: 0, default: 0 },
    ownerWorkerCount: { type: Number, min: 0, default: 0 },
    calcType: {
      type: String,
      enum: ["tailor_slab_v1", "butcher_cuts_v1"],
      default: "tailor_slab_v1"
    },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

businessSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Business", businessSchema);
