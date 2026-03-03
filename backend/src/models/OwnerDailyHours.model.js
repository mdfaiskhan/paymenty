const mongoose = require("mongoose");

const ownerDailyHoursSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: true
    },
    workDate: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
  },
  {
    timestamps: true
  }
);

ownerDailyHoursSchema.index({ ownerId: 1, workDate: 1 }, { unique: true });

module.exports = mongoose.model("OwnerDailyHours", ownerDailyHoursSchema);

