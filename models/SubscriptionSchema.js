import mongoose from "mongoose";
const { Schema } = mongoose;

const SubscriptionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "plans",
      required: true
    },
    stripeSubscriptionId: {
      type: String,
      default: ""
    },
    stripeCustomerId: {
      type: String, // 👈 add this field for reference
      default: ""
    },
    status: {
      type: String,
      enum: ["active", "canceled", "incomplete", "past_due", "trialing"],
      default: "active"
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    currentPeriodEnd: {
      type: Date
    },

    // 🔔 NEW FIELDS
    downgradeRequestedAt: {
      type: Date,
      default: null
    },
    downgradeMessage: {
      type: String,
      default: ""
    },
    downgradeScheduled: {
      type: Boolean,
      default: false
    },
    planRestrictions: {
      type: Schema.Types.Mixed, // Allows dynamic fields
      default: {}
    },

  },
  {
    timestamps: true
  }
);

const SubscriptionModel = mongoose.model("subscriptions", SubscriptionSchema);
export default SubscriptionModel;
