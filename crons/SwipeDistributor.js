import cron from "node-cron";
import SubscriptionModel from "../models/SubscriptionSchema.js";
import PlanModel from "../models/PlanScheme.js";

// Fallback limits (agar plan document me planRestrictions na mile)
const FALLBACK_LIMITS = {
   FREE: {
      numberOfSwipes: 10,
      maxContactShow: 4,
      numberOfAcceptMatch: 4,
      numberOfUpload: 10,
   },
   BRONZE: {
      numberOfSwipes: 20,
      maxContactShow: 20,
      numberOfAcceptMatch: 20,
      numberOfUpload: 20,
   },
   SILVER: {
      numberOfSwipes: 30,
      maxContactShow: 70,
      numberOfAcceptMatch: 70,
      numberOfUpload: 70,
   },
   PLATINUM: {
      numberOfSwipes: 9999,
      maxContactShow: 9999,
      numberOfAcceptMatch: 9999,
      numberOfUpload: 9999,
   },
};

// Buyer vs Agent/Seller ki keys
const KEYS_BY_TYPE = {
   buyer: ["numberOfSwipes", "maxContactShow"],
   agent: ["numberOfUpload", "numberOfAcceptMatch"],
};

const getKeysForType = (type) => (type === "agent" ? KEYS_BY_TYPE.agent : KEYS_BY_TYPE.buyer);

// Pehle plan.planRestrictions, nahi mili to fallback
const getPlanLimit = (plan, planTitle, key) => {
   const fromPlan = plan.planRestrictions?.[key];
   if (typeof fromPlan === "number") return fromPlan;
   return FALLBACK_LIMITS[planTitle]?.[key];
};

/**
 * Ek plan ke saare active subscriptions ko DB ke andar hi reset karta hai.
 * Node me koi subscription load nahi hoti, isliye 50k ho ya 5 lakh, memory same rehti hai.
 */
const resetSubscriptionsForPlan = async (plan) => {
   const planTitle = plan.title?.toUpperCase();
   const keys = getKeysForType(plan.type);

   const limits = {};
   for (const key of keys) {
      const limit = getPlanLimit(plan, planTitle, key);
      if (limit !== undefined) limits[key] = limit;
   }

   const limitKeys = Object.keys(limits);
   if (limitKeys.length === 0) return 0;

   // Sirf wohi docs jinki koi bhi key limit se kam ya missing ho
   const needsResetConditions = limitKeys.map((key) => ({
      [`planRestrictions.${key}`]: { $not: { $gte: limits[key] } },
   }));

   // $max: current value agar limit se zyada hai to wahi rahegi, kam hai to limit ho jayegi
   const setStage = {};
   for (const key of limitKeys) {
      setStage[`planRestrictions.${key}`] = {
         $max: [{ $ifNull: [`$planRestrictions.${key}`, 0] }, limits[key]],
      };
   }

   const result = await SubscriptionModel.updateMany(
      {
         status: "active",
         planId: plan._id,
         $or: needsResetConditions,
      },
      [{ $set: setStage }],
   );

   return result.modifiedCount ?? 0;
};

let isRunning = false;

export const SwipeDistributor = () => {
   // Testing: har 10 seconds  -> "*/10 * * * * *"
   // Production: roz midnight -> "0 0 * * *"
   cron.schedule(
      "0 0 * * *",
      async () => {
         // Pichla run abhi chal raha ho to overlap mat karo
         if (isRunning) {
            console.log("Swipe reset still running, skipping this tick.");
            return;
         }

         isRunning = true;

         try {
            console.log("Running swipe reset cron...");

            // Plans bohat kam hote hain, lean() se halka fetch
            const plans = await PlanModel.find({}).lean();

            let totalUpdated = 0;

            for (const plan of plans) {
               try {
                  totalUpdated += await resetSubscriptionsForPlan(plan);
               } catch (planError) {
                  // Ek plan fail ho to baaki plans chalte rahein
                  console.error(`Reset failed for plan ${plan._id}:`, planError);
               }
            }

            console.log(`Reset completed. Updated ${totalUpdated} subscriptions.`);
         } catch (error) {
            console.error("Swipe cron failed:", error);
         } finally {
            isRunning = false;
         }
      },
      {
         timezone: "Asia/Karachi",
      },
   );
};
