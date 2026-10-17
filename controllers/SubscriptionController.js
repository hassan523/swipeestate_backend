import Stripe from "stripe";
import SubscriptionModel from "../models/SubscriptionSchema.js";
import UserModel from "../models/BuyerSchema.js";
import PlanModel from "../models/PlanScheme.js";
import SellerModel from "../models/SellerSchema.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// export const handleCreateSubscription = async (req, res) => {
//   try {
//     const { userId, planId, priceId, email, paymentMethodId, token } = req.body;

//     if (!userId || !planId || !priceId || !email) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const findUser = await UserModel.findById(userId);
//     if (!findUser) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const findPlan = await PlanModel.findById(planId);
//     if (!findPlan) {
//         return res.status(404).json({ message: "Plan not found" });
//     }

//     console.log(findUser.customerId, "customerId");

//     // 1️⃣ Create or get Stripe customer
//     let customerId = findUser.customerId;
//     if (!customerId) {
//       const customer = await stripe.customers.create({ email });
//       findUser.customerId = customer.id;
//       await findUser.save();
//       customerId = customer.id;
//     }

//     // 2️⃣ Create Payment Method (using token instead of card)
//     let finalPaymentMethodId = paymentMethodId;
//     if (!finalPaymentMethodId && token) {
//       // Convert token (e.g., tok_visa) into a payment method
//       const paymentMethod = await stripe.paymentMethods.create({
//         type: "card",
//         card: { token } // 👈 use token here
//       });
//       console.log(paymentMethod.id, "---");
//       finalPaymentMethodId = paymentMethod.id;
//     }

//     // 3️⃣ Attach the Payment Method to the Customer
//     await stripe.paymentMethods.attach(finalPaymentMethodId, {
//       customer: customerId
//     });

//     // 4️⃣ Set as Default Payment Method
//     await stripe.customers.update(customerId, {
//       invoice_settings: { default_payment_method: finalPaymentMethodId }
//     });

//     // 5️⃣ Create Subscription
//     const subscription = await stripe.subscriptions.create({
//       customer: customerId,
//       items: [{ price: priceId }],
//       default_payment_method: finalPaymentMethodId,
//       payment_behavior: "allow_incomplete",
//       expand: ["latest_invoice.payment_intent"],
//       metadata: { userId, planId }
//     });
// // Confirm the payment intent manually
// const paymentIntentId = subscription.latest_invoice.payment_intent?.id;

// if (paymentIntentId) {
//   const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
//     payment_method: paymentMethodId,
//   });

//   console.log("✅ Payment confirmed:", confirmedPaymentIntent.status);
// } else {
//   console.log("⚠️ No payment intent found yet");
// }

//     // await stripe.paymentIntents.confirm(paymentIntent.id);

//     // 6️⃣ Save in DB
//     await SubscriptionModel.create({
//       userId,
//       planId,
//       stripeSubscriptionId: subscription.id,
//       stripeCustomerId: findUser.customerId,
//       status: subscription.status,
//       startDate: subscription.start_date
//         ? new Date(subscription.start_date * 1000)
//         : null,
//       currentPeriodEnd: new Date(
//         subscription.items.data[0].current_period_end * 1000
//       )
//     });

//     console.log("✅ Subscription created successfully:", subscription.id);

//     return res.status(200).json({
//       success: true,
//       message: "Subscription created successfully",
//       subscription
//     });
//   } catch (error) {
//     console.error("❌ Error creating subscription:", error);
//     res.status(500).json({ message: "Failed to create subscription", error });
//   }
// };

export const handleCreateSubscription = async (req, res) => {
   try {
      const { userId, planId, priceId, email, paymentMethodId, token } = req.body;
      console.log(paymentMethodId, "paymentMethodId");
      if (!userId || !planId || !email) {
         return res.status(400).json({ message: "Missing required fields" });
      }

      const findUser = (await UserModel.findById(userId)) || (await SellerModel.findById(userId));
      if (!findUser) {
         return res.status(404).json({ message: "User not found" });
      }

      const findPlan = await PlanModel.findById(planId);
      if (!findPlan) {
         return res.status(404).json({ message: "Plan not found" });
      }

      console.log(findPlan);

      // ============================================
      //         🆓 FREE PLAN HANDLING
      // ============================================
      if (findPlan.amount === 0) {
         // Directly activate free plan — NO Stripe involved
         const subscription = await SubscriptionModel.create({
            userId,
            planId,
            status: "active",
            stripeSubscriptionId: null,
            stripeCustomerId: findUser.customerId || null,
            startDate: new Date(),
            currentPeriodEnd: null, // free plan does not expire
            planRestrictions: findPlan.planRestrictions,
         });

         let subscribedPlan;
         subscribedPlan = {
            subscription: subscription,
            plan: findPlan,
         };

         return res.status(200).json({
            success: true,
            message: "Subscription created successfully",
            subscribedPlan: subscribedPlan,
         });
      }

      // ============================================
      //         💳 PAID PLAN HANDLING
      // ============================================

      if (!priceId) {
         return res.status(400).json({ message: "priceId is required for paid plans" });
      }

      // 1️⃣ Create or get Stripe customer
      let customerId = findUser.customerId;

      if (customerId) {
         try {
            const existingCustomer = await stripe.customers.retrieve(customerId);

            if (existingCustomer.deleted) {
               customerId = null;
            }
         } catch (error) {
            if (error.code === "resource_missing") {
               customerId = null;
            } else {
               throw error;
            }
         }
      }

      console.log(customerId);
      if (!customerId) {
         const customer = await stripe.customers.create({ email });
         findUser.customerId = customer.id;
         await findUser.save();
         customerId = customer.id;
      }

      // 2️⃣ Create Payment Method (using token instead of card)
      // let finalPaymentMethodId = paymentMethodId;
      let finalPaymentMethodId = null;

      if (paymentMethodId) {
         try {
            const existingPaymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

            finalPaymentMethodId = existingPaymentMethod.id;
         } catch (error) {
            if (error.code !== "resource_missing") {
               throw error;
            }

            console.log("PaymentMethod not found in current Stripe account/mode.");
         }
      }

      if (!finalPaymentMethodId && token) {
         const paymentMethod = await stripe.paymentMethods.create({
            type: "card",
            card: { token },
         });
         finalPaymentMethodId = paymentMethod.id;
      }

      if (!finalPaymentMethodId) {
         return res.status(400).json({
            message: "A valid Stripe PaymentMethod or card token is required.",
         });
      }

      // 3️⃣ Attach Payment Method
      await stripe.paymentMethods.attach(finalPaymentMethodId, {
         customer: customerId,
      });

      // 4️⃣ Set as Default Payment Method
      await stripe.customers.update(customerId, {
         invoice_settings: { default_payment_method: finalPaymentMethodId },
      });

      // 5️⃣ Create Subscription in Stripe
      const subscription = await stripe.subscriptions.create({
         customer: customerId,
         items: [{ price: priceId }],
         default_payment_method: finalPaymentMethodId,
         payment_behavior: "allow_incomplete",
         expand: ["latest_invoice.payment_intent"],
         metadata: { userId, planId },
      });

      // 6️⃣ Confirm payment
      const paymentIntentId = subscription.latest_invoice.payment_intent?.id;
      if (paymentIntentId) {
         await stripe.paymentIntents.confirm(paymentIntentId, {
            payment_method: finalPaymentMethodId,
         });
      }

      // 7️⃣ Save subscription in DB
      const savedSubscription = await SubscriptionModel.create({
         userId,
         planId,
         stripeSubscriptionId: subscription.id,
         stripeCustomerId: findUser.customerId,
         status: subscription.status,
         planRestrictions: findPlan.planRestrictions,
         startDate: subscription.start_date ? new Date(subscription.start_date * 1000) : new Date(),
         currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
      });

      let subscribedPlan;
      subscribedPlan = {
         subscription: savedSubscription,
         plan: findPlan,
      };

      return res.status(200).json({
         success: true,
         message: "Subscription created successfully",
         subscribedPlan: subscribedPlan,
      });
   } catch (error) {
      console.error("❌ Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription", error });
   }
};

export const handleDowngradeSubscription = async (req, res, next) => {
   try {
      const { userId } = req.params;
      const { downgradeTo } = req.body;

      const existingSub = await SubscriptionModel.findOne({
         userId,
         status: "active",
      });

      if (!existingSub?.stripeSubscriptionId) {
         return res.status(400).json({ message: "Active paid subscription not found" });
      }

      if (existingSub.downgradeScheduled) {
         return res.status(400).json({
            message: "Downgrade already scheduled",
            downgradeDate: existingSub.endDate,
         });
      }

      const freePlan = await PlanModel.findOne({
         _id: downgradeTo,
         amount: 0,
         active: true,
      });

      if (!freePlan) {
         return res.status(404).json({ message: "Invalid Free Plan" });
      }

      const stripeSub = await stripe.subscriptions.update(existingSub.stripeSubscriptionId, { cancel_at_period_end: true });
      const downgradeDate = new Date(stripeSub.cancel_at * 1000);
      const requestedAt = new Date();
      const message = downgradeDate ? `Your subscription will downgrade to the Free plan on ${downgradeDate.toDateString()}.` : "Your subscription downgrade is scheduled.";

      await SubscriptionModel.findByIdAndUpdate(existingSub._id, {
         endDate: downgradeDate,
         downgradeScheduled: true,
         downgradeRequestedAt: requestedAt,
         downgradeMessage: message,
      });

      return res.status(200).json({
         message: "Subscription downgrade scheduled successfully",
         downgradeDate,
         downgradeRequestedAt: requestedAt,
      });
   } catch (error) {
      console.error("❌ Downgrade failed:", error);
      next(error);
   }
};

export const handleGetCurrentPlanId = async (req, res, next) => {
   try {
      const { userId } = req.params;
      const getPlan = await SubscriptionModel.findOne({
         userId: userId,
         status: "active",
      });
      const plan = await PlanModel.findById(getPlan.planId);
      const canDowngrade = plan.amount === 0 ? false : true;
      res.status(200).json({ planId: getPlan.planId, canDowngrade, priceId: plan.priceId, plan: getPlan, planDetail: plan });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

export const handleUpgradeSubscription = async (req, res, next) => {
   try {
      const { userId } = req.params;
      const { upgradeTo, paymentMethodId, token } = req.body;

      const findUser = await UserModel.findById(userId);
      if (!findUser?.customerId) {
         return res.status(400).json({ message: "Stripe customer not found" });
      }

      // 1️⃣ Existing active subscription
      const existingSub = await SubscriptionModel.findOne({
         userId,
         status: "active",
      });

      if (!existingSub) {
         return res.status(400).json({ message: "Active subscription not found" });
      }

      // 2️⃣ Validate new paid plan
      const newPlan = await PlanModel.findById(upgradeTo);
      if (!newPlan?.priceId || newPlan.amount <= 0) {
         return res.status(404).json({ message: "Invalid paid plan" });
      }

      const customerId = findUser.customerId;

      // 3️⃣ Payment method handling
      let finalPaymentMethodId = paymentMethodId;
      if (!finalPaymentMethodId && token) {
         const pm = await stripe.paymentMethods.create({
            type: "card",
            card: { token },
         });
         finalPaymentMethodId = pm.id;
      }

      if (!finalPaymentMethodId) {
         return res.status(400).json({ message: "Payment method required" });
      }

      // 4️⃣ Attach & set default payment method
      await stripe.paymentMethods.attach(finalPaymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
         invoice_settings: { default_payment_method: finalPaymentMethodId },
      });

      // 5️⃣ Create NEW subscription (instant charge)
      const newStripeSub = await stripe.subscriptions.create({
         customer: customerId,
         items: [{ price: newPlan.priceId }],
         default_payment_method: finalPaymentMethodId,
         payment_behavior: "allow_incomplete",
         expand: ["latest_invoice.payment_intent"],
         metadata: {
            userId: String(userId),
            planId: String(newPlan._id),
         },
      });

      // 6️⃣ Confirm payment
      const paymentIntent = newStripeSub.latest_invoice?.payment_intent;
      if (paymentIntent?.id) {
         await stripe.paymentIntents.confirm(paymentIntent.id, {
            payment_method: finalPaymentMethodId,
         });
      }

      // 7️⃣ Cancel OLD subscription ONLY if it has a Stripe subscription
      if (existingSub.stripeSubscriptionId) {
         await stripe.subscriptions.update(existingSub.stripeSubscriptionId, {
            cancel_at_period_end: false,
            status: "canceled",
         });
      }

      // 8️⃣ Update DB
      await SubscriptionModel.findByIdAndUpdate(existingSub._id, {
         planId: newPlan._id,
         stripeSubscriptionId: newStripeSub.id,
         stripeCustomerId: customerId,
         status: newStripeSub.status,
         startDate: new Date(),
         endDate: null,
         currentPeriodEnd: new Date(newStripeSub.items.data[0].current_period_end * 1000),

         downgradeScheduled: false,
         downgradeRequestedAt: null,
         downgradeMessage: "",
         planRestrictions: newPlan.planRestrictions,
      });

      return res.status(200).json({
         message: "Subscription upgraded successfully",
         subscriptionId: newStripeSub.id,
      });
   } catch (error) {
      console.error("❌ Upgrade failed:", error);
      next(error);
   }
};

export const HandleGetPaymentIntent = async (req, res) => {
   try {
      const paymentIntent = await stripe.paymentIntents.create({
         amount: req.body.amount * 100,
         currency: "usd",
         automatic_payment_methods: {
            enabled: true,
         },
      });
      res.status(200).json({ getPaymentIntent: paymentIntent.client_secret });
   } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal Server Error" });
   }
};

// export const handleUpgradeSubscription = async (req, res, next) => {
//   try {
//     const { userId } = req.params;
//     const { upgradeTo, paymentMethodId, token } = req.body;

//     const findUser = await UserModel.findById(userId);
//     if (!findUser?.customerId) {
//       return res.status(400).json({ message: "Stripe customer not found" });
//     }

//     // 1️⃣ Existing active subscription
//     const existingSub = await SubscriptionModel.findOne({
//       userId,
//       status: "active"
//     });

//     if (!existingSub) {
//       return res.status(400).json({ message: "Active paid subscription not found" });
//     }

//     // 2️⃣ Validate new paid plan
//     const newPlan = await PlanModel.findById(upgradeTo);
//     if (!newPlan?.priceId || newPlan.amount <= 0) {
//       return res.status(404).json({ message: "Invalid paid plan" });
//     }

//     const customerId = findUser.customerId;

//     // 3️⃣ Payment method handling
//     let finalPaymentMethodId = paymentMethodId;

//     if (!finalPaymentMethodId && token) {
//       const pm = await stripe.paymentMethods.create({
//         type: "card",
//         card: { token }
//       });
//       finalPaymentMethodId = pm.id;
//     }

//     if (!finalPaymentMethodId) {
//       return res.status(400).json({ message: "Payment method required" });
//     }

//     // 4️⃣ Attach & set default payment method
//     await stripe.paymentMethods.attach(finalPaymentMethodId, {
//       customer: customerId
//     });

//     await stripe.customers.update(customerId, {
//       invoice_settings: {
//         default_payment_method: finalPaymentMethodId
//       }
//     });

//     // 5️⃣ Create NEW subscription (instant charge)
//     const newStripeSub = await stripe.subscriptions.create({
//       customer: customerId,
//       items: [{ price: newPlan.priceId }],
//       default_payment_method: finalPaymentMethodId,
//       payment_behavior: "allow_incomplete",
//       expand: ["latest_invoice.payment_intent"],
//       metadata: {
//         userId: String(userId),
//         planId: String(newPlan._id)
//       }
//     });

//     // 6️⃣ Confirm payment
//     const paymentIntent = newStripeSub.latest_invoice?.payment_intent;
//     if (paymentIntent?.id) {
//       await stripe.paymentIntents.confirm(paymentIntent.id, {
//         payment_method: finalPaymentMethodId
//       });
//     }

//     // 7️⃣ Cancel OLD subscription (AFTER payment intent exists)
//     await stripe.subscriptions.update(existingSub.stripeSubscriptionId, {
//       cancel_at_period_end: false,
//       status: "canceled"
//     });

//     // 8️⃣ Update DB
//     await SubscriptionModel.findByIdAndUpdate(existingSub._id, {
//       planId: newPlan._id,
//       stripeSubscriptionId: newStripeSub.id,
//       stripeCustomerId: customerId,
//       status: newStripeSub.status,
//       startDate: new Date(),
//       endDate: null,
//       currentPeriodEnd: newStripeSub.current_period_end
//         ? new Date(newStripeSub.current_period_end * 1000)
//         : null,

//       downgradeScheduled: false,
//       downgradeRequestedAt: null,
//       downgradeMessage: ""
//     });

//     return res.status(200).json({
//       message: "Subscription upgraded successfully",
//       subscriptionId: newStripeSub.id
//     });

//   } catch (error) {
//     console.error("❌ Upgrade failed:", error);
//     next(error);
//   }
// };
