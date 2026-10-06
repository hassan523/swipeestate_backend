import Stripe from "stripe";
import PlanModel from "../models/PlanScheme.js";
import stripe from "../config/StripeConfig.js";
import SearchQuery from "../utils/SearchQuery.js";

// CREATE PLANS
// METHOD: POST
// ENDPOINT:  /api/plans/create-plans
// const createProductAndPrice = async (req, res, next) => {
//   try {
//     const { title, amount, description, planPoints } = req.body;

//     // ✅ Validate input
//     if (!title || !amount) {
//       return res
//         .status(400)
//         .json({ message: "Title and amount are required fields." });
//     }

//     if (!Array.isArray(planPoints)) {
//       return res.status(400).json({ message: "Plan Points Must Be An Array" });
//     }

//     // ✅ Convert amount to cents
//     const unitAmount = Math.round(amount * 100);

//     // ✅ Create product on Stripe
//     const product = await stripe.products.create({
//       name: title,
//       description
//     });

//     // ✅ Create yearly recurring price
//     const price = await stripe.prices.create({
//       unit_amount: unitAmount,
//       currency: "usd",
//       recurring: { interval: "year" },
//       product: product.id
//     });

//     // ✅ Save to MongoDB
//     const plan = new PlanModel({
//       title,
//       description,
//       planPoints,
//       productId: product.id,
//       priceId: price.id,
//       amount: amount,
//       currency: price.currency,
//       interval: price.recurring.interval
//     });

//     await plan.save();

//     res.status(201).json({
//       message: "Product and yearly price created successfully",
//       plan
//     });
//   } catch (error) {
//     console.error("Stripe Error:", error);
//     next(error);
//   }
// };

const createProductAndPrice = async (req, res, next) => {
  try {
    const { title, amount, description, planPoints, interval } = req.body;

    // Validate input
    if (!title || amount === undefined || amount === null) {
      return res
        .status(400)
        .json({ message: "Title and amount are required fields." });
    }

    if (!Array.isArray(planPoints)) {
      return res.status(400).json({ message: "Plan Points Must Be An Array" });
    }

    let product = null;
    let price = null;

    // --------------------------------------------
    //  ✅ Handle FREE PLAN (amount === 0)
    // --------------------------------------------
    if (amount === 0) {
      // No Stripe product or price created

      const plan = new PlanModel({
        title,
        description,
        planPoints,
        amount: 0,
        currency: "usd",
        interval: null,
        productId: null,
        priceId: null
      });

      await plan.save();

      return res.status(201).json({
        message: "Free plan created successfully",
        plan
      });
    }

    // --------------------------------------------
    //  ✅ PAID PLAN (amount > 0)
    // --------------------------------------------

    if (!["month", "year"].includes(interval)) {
      return res.status(400).json({ message: "Invalid Interval Type" });
    }

    // Convert to cents
    const unitAmount = Math.round(amount * 100);

    // Create product on Stripe
    product = await stripe.products.create({
      name: title,
      description
    });

    // Create yearly price on Stripe
    price = await stripe.prices.create({
      unit_amount: unitAmount,
      currency: "usd",
      recurring: { interval: interval },
      product: product.id
    });

    // Save to DB
    const plan = new PlanModel({
      title,
      description,
      planPoints,
      productId: product.id,
      priceId: price.id,
      amount,
      currency: price.currency,
      interval: price.recurring.interval
    });

    await plan.save();

    return res.status(201).json({
      message: "Paid plan created successfully",
      plan
    });
  } catch (error) {
    console.error("Stripe Error:", error);
    next(error);
  }
};

// GET PLANS
// METHOD: GET
// ENDPOINT:  /api/plans/get-plans
const handleGetPlans = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || {};
    const matchStage = SearchQuery(search); // your existing search function

    const pipeline = [];

    // Build the match stage
    let matchConditions = { active: true }; // only active plans by default

    if (matchStage) {
      const conditions = matchStage.$match || {};
      // include search conditions + always active plans + free plan (amount: 0)
      matchConditions = {
        ...conditions,
        active: true,
      };
    }

    // Add the match stage
    pipeline.push({
      $match: {
        $or: [matchConditions, { amount: 0 }]
      }
    });

    // Sorting, skipping, limiting
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Run aggregation
    const plans = await PlanModel.aggregate(pipeline);

    // Count total items
    const countPipeline = [];
    if (matchStage) {
      countPipeline.push({ $match: matchConditions });
    } else {
      countPipeline.push({ $match: { active: true } });
    }
    countPipeline.push({ $count: "totalItems" });

    const countResult = await PlanModel.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      plans,
      meta: {
        totalItems,
        totalPages,
        page,
        limit
      }
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};


export { createProductAndPrice, handleGetPlans };
