import cron from "node-cron";
import SubscriptionModel from "../models/SubscriptionSchema.js";
import PlanModel from "../models/PlanScheme.js";
import BuyerModel from "../models/BuyerSchema.js";
import SellerModel from "../models/SellerSchema.js";

const SWIPE_INCREMENT = {
   FREE: 10,
   BRONZE: 20,
   SILVER: 30,
   PLATINUM: 9999,
};

const CONTACT_INCREMENT = {
   FREE: 4,
   BRONZE: 20,
   SILVER: 70,
   PLATINUM: 9999,
};

export const SwipeDistributor = () => {
   // Runs every 10 seconds for testing
   // For daily midnight execution: "0 0 * * *"

   cron.schedule("0 0 * * *", async () => {
      try {
         console.log("Running swipe increment cron...");

         const subscriptions = await SubscriptionModel.find({
            status: "active",
         });

         const bulkOps = [];

         for (const sub of subscriptions) {
            const findPlan = await PlanModel.findById(sub.planId);

            if (!findPlan) continue;

            const planType = findPlan.title?.toUpperCase();
            const type = findPlan.type;

            const increment = SWIPE_INCREMENT[planType];
            const contactIncrement = CONTACT_INCREMENT[planType];

            if (increment === undefined || contactIncrement === undefined) {
               continue;
            }

            const restrictions = sub.planRestrictions || {};

            const uploadOrSwipeKey = type === "agent" ? "numberOfUpload" : "numberOfSwipes";

            const contactKey = type === "agent" ? "numberOfAcceptMatch" : "maxContactShow";

            const updateFields = {};

            // Increment only when the current value is 0
            if (restrictions[uploadOrSwipeKey] === 0) {
               updateFields[`planRestrictions.${uploadOrSwipeKey}`] = increment;
            }

            if (restrictions[contactKey] === 0) {
               updateFields[`planRestrictions.${contactKey}`] = contactIncrement;
            }

            // Skip if neither field needs an update
            if (Object.keys(updateFields).length === 0) {
               continue;
            }

            bulkOps.push({
               updateOne: {
                  filter: {
                     _id: sub._id,
                     status: "active",
                  },
                  update: {
                     $set: updateFields,
                  },
               },
            });
         }

         if (bulkOps.length > 0) {
            await SubscriptionModel.bulkWrite(bulkOps);
         }

         console.log(`Swipe distribution completed. Updated ${bulkOps.length} subscriptions.`);
      } catch (error) {
         console.error("Swipe cron failed:", error);
      }
   });
};
