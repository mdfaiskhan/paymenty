const mongoose = require("mongoose");

const ownerCommissionRuleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: true
    },
    commissionPerHour: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

ownerCommissionRuleSchema.index({ ownerId: 1, effectiveFrom: -1 });
ownerCommissionRuleSchema.index({ ownerId: 1, effectiveTo: 1 });

module.exports = mongoose.model("OwnerCommissionRule", ownerCommissionRuleSchema);

