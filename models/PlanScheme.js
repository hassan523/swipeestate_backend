import mongoose from "mongoose";
const { Schema } = mongoose;

const PlanScheme = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    planPoints: { type: Array, default: [] },
    productId: { type: String, default: "" },
    priceId: { type: String, default: "" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    interval: { type: String, default: "year" },
    active: { type: Boolean, default: true },
    planRestrictions: {
      type: Schema.Types.Mixed,
      default: {}
    }

  },
  {
    timestamps: true
  }
);
const PlanModel = mongoose.model("plans", PlanScheme);
export default PlanModel;