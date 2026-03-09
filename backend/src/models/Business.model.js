const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, unique: true },
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
