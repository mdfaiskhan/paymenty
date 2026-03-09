const mongoose = require("mongoose");

const incentiveRuleSchema = new mongoose.Schema(
  {
    businessType: {
      type: String,
      required: true
    },
    scope: {
      type: String,
      enum: ["business", "employee"],
      required: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    calcType: {
      type: String,
      enum: ["tailor_slab_v1", "butcher_cuts_v1"],
      required: true
    },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

incentiveRuleSchema.index({ businessType: 1, scope: 1, employeeId: 1, effectiveFrom: -1 });
incentiveRuleSchema.index({ businessType: 1, scope: 1, effectiveTo: 1 });

module.exports = mongoose.model("IncentiveRule", incentiveRuleSchema);
