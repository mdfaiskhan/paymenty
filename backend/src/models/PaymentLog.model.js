const mongoose = require("mongoose");

const paymentLogSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      default: null
    },
    businessType: {
      type: String,
      required: true
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    hoursWorked: { type: Number, min: 0, default: 0 },
    computedAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "partial", "paid"],
      required: true
    },
    method: {
      type: String,
      enum: ["cash", "bank", "upi"],
      default: "cash"
    },
    referenceId: { type: String, trim: true, maxlength: 120 },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 400 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true
    }
  },
  {
    timestamps: true
  }
);

paymentLogSchema.index({ employeeId: 1, periodStart: 1, periodEnd: 1 });
paymentLogSchema.index({ ownerId: 1, periodStart: 1, periodEnd: 1 });
paymentLogSchema.index({ businessType: 1, status: 1, paidAt: -1 });

module.exports = mongoose.model("PaymentLog", paymentLogSchema);
