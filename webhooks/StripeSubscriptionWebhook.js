import Stripe from "stripe";
import express from "express";
import SubscriptionModel from "../models/SubscriptionSchema.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware for raw body (required by Stripe)
export const stripeWebhook = express.raw({ type: "application/json" });

export const handleStripeWebhook = async (req, res) => {
  console.log("📩 Incoming Stripe webhook event...");
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(`✅ Webhook verified: ${event.type}`);
  } catch (err) {
    console.error("⚠️ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // ✅ Subscription Created
      case "customer.subscription.created": {
        const sub = event.data.object;
        console.log("🎉 [Webhook Triggered] Subscription Created Event Received");
        console.log("➡️ Subscription ID:", sub.id);
        console.log("➡️ Status:", sub.status);
        console.log("➡️ Customer ID:", sub.customer);

        const userId = sub.metadata?.userId;
        const planId = sub.metadata?.planId;

        console.log("📦 Metadata received:", { userId, planId });

        // await SubscriptionModel.create({
        //   userId,
        //   planId,
        //   stripeSubscriptionId: sub.id,
        //   stripeCustomerId: sub.customer,
        //   status: sub.status,
        //   startDate: new Date(sub.start_date * 1000),
        //   currentPeriodEnd: new Date(sub.items.data[0].current_period_end * 1000),
        // });

        console.log("✅ Subscription saved successfully to MongoDB!");
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;

        const dbSub = await SubscriptionModel.findOne({
          stripeSubscriptionId: sub.id
        });

        if (!dbSub) break;

        const freePlan = await PlanModel.findOne({ amount: 0 });

        await SubscriptionModel.findByIdAndUpdate(dbSub._id, {
          planId: freePlan._id,
          stripeSubscriptionId: null,
          downgradeScheduled: false,
          downgradeRequestedAt: null,
          downgradeMessage: "",
          endDate: null,
          currentPeriodEnd: null,
          status: "active"
        });

        break;
      }



      // ✅ Subscription Updated
      case "customer.subscription.updated": {
        const updatedSub = event.data.object;
        console.log("🔁 [Webhook Triggered] Subscription Updated Event Received");
        console.log("➡️ Subscription ID:", updatedSub.id);
        console.log("➡️ New Status:", updatedSub.status);

        await SubscriptionModel.findOneAndUpdate(
          { stripeSubscriptionId: updatedSub.id },
          {
            status: updatedSub.status,
            currentPeriodEnd: new Date(updatedSub.items.data[0].current_period_end * 1000),
          }
        );

        console.log("✅ Subscription updated in MongoDB!");
        break;
      }

      // ✅ Subscription Canceled / Expired
      case "customer.subscription.deleted": {
        const deletedSub = event.data.object;
        console.log("⚠️ [Webhook Triggered] Subscription Deleted Event Received");
        console.log("➡️ Subscription ID:", deletedSub.id);

        await SubscriptionModel.findOneAndUpdate(
          { stripeSubscriptionId: deletedSub.id },
          { status: "canceled" }
        );

        console.log("✅ Subscription marked as canceled in MongoDB!");
        break;
      }

      // ✅ Payment Success
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        console.log("💰 [Webhook Triggered] Payment Succeeded Event Received");
        console.log("➡️ Invoice ID:", invoice.id);
        console.log("➡️ Amount Paid:", invoice.amount_paid / 100, invoice.currency.toUpperCase());
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        console.log("💰 Payment succeeded for subscription:", subscriptionId);

        await SubscriptionModel.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionId },
          { status: "active" }
        );

        console.log("✅ Subscription activated in DB!");
        break;
      }


      default:
        console.log(`⚙️ [Webhook Triggered] Unhandled Event Type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Error processing webhook:", err);
    res.status(500).send("Webhook handler failed.");
  }
};
