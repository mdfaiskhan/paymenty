const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    placeId: { type: String, required: true, trim: true, maxlength: 80 },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    businessType: {
      type: String,
      enum: ["tailor", "butcher"],
      required: true
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

employeeSchema.index({ businessType: 1, isActive: 1, createdAt: -1 });
employeeSchema.index({ name: "text", phone: "text", email: "text", placeId: "text", location: "text" });

module.exports = mongoose.model("Employee", employeeSchema);
