const mongoose = require("mongoose");

const workEntrySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true
    },
    businessType: {
      type: String,
      required: true
    },
    workDate: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0.01, max: 24 },
    videoId: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 300 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
  },
  {
    timestamps: true
  }
);

workEntrySchema.index({ employeeId: 1, workDate: 1, isDeleted: 1 });
workEntrySchema.index({ businessType: 1, workDate: 1, isDeleted: 1 });
workEntrySchema.index({ createdAt: -1 });

module.exports = mongoose.model("WorkEntry", workEntrySchema);
