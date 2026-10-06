import express from "express";
import {
  stripeWebhook,
  handleStripeWebhook
} from "../webhooks/StripeSubscriptionWebhook.js";

const router = express.Router();

// Stripe webhook route — must come *before* express.json middleware!
router.post("/webhook", stripeWebhook, handleStripeWebhook);

export default router;
