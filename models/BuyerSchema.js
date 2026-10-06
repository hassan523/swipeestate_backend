import mongoose from "mongoose";
const { Schema } = mongoose;

const SessionSchema = new Schema(
  {
    fcmToken: { type: String, required: false },
    refreshToken: { type: String, required: true },
    deviceType: {
      type: String,
      enum: ["web", "android", "ios"],
      default: "web",
    },
    timezone: {
      type: String,
      default: "UTC", // e.g. "Asia/Karachi"
    },
    deviceName: { type: String },
    lastActive: { type: Date, default: Date.now },
    ipAddress: { type: String },
  },
  { _id: false }
);

const BuyerSchema = new Schema(
  {
    customerId: {
      type: String,
    },
    name: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    address: {
      type: String,
    },
    selectedIncome: {
      type: String,
    },

    creditScore: {
      type: String,
    },
    password: String,
    role: {
      type: String,
      enum: ["Buyer"],
      default: "Buyer",
    },
    sessions: [SessionSchema],
    otp: {
      type: String,
    },
    profilePicture: {
      type: String,
      // required: true
      default: "/uploads/placeholder-profile-img.png"
    },
    otpExpire: {
      type: Date,
    },

  },
  {
    timestamps: true,
  }
);
const BuyerModel = mongoose.model("buyers", BuyerSchema);
export default BuyerModel;
