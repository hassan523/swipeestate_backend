import cron from "node-cron";
import SubscriptionModel from "../models/SubscriptionSchema.js";
import PlanModel from "../models/PlanScheme.js";

const SWIPE_INCREMENT = {
    FREE: 10,
    BRONZE: 20,
    SILVER: 30,
    PLATINUM: 50,
};

export const SwipeDistributor = () => {
    // Runs every day at 12:00 AM
    cron.schedule("0 0 * * *", async () => {
        try {
            console.log("🔄 Running daily swipe increment cron...");

            const subscriptions = await SubscriptionModel.find({
                status: "active",
            });
            console.log(subscriptions)
            const bulkOps = [];

            for (const sub of subscriptions) {
                const findPlan = await PlanModel.findById(sub.planId);
                const planType = findPlan?.title?.toUpperCase();
                const increment = SWIPE_INCREMENT[planType];
                if (!increment) continue;

                bulkOps.push({
                    updateOne: {
                        filter: { _id: sub._id },
                        update: {
                            $inc: {
                                "planRestrictions.numberOfSwipes": increment,
                            },
                        },
                    },
                });
            }

            if (bulkOps.length) {
                await SubscriptionModel.bulkWrite(bulkOps);
            }

            console.log(`✅ Swipe increment completed for ${bulkOps.length} subscriptions`);
        } catch (error) {
            console.error("❌ Swipe cron failed:", error);
        }
    });
};
