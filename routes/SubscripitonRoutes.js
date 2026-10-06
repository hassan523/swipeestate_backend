import express from "express";

import validate from "../middlewares/ValidationHandler.js";

import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import AccessMiddleware from "../middlewares/AccessMiddleware.js";
import { handleCreateSubscription, handleDowngradeSubscription, handleGetCurrentPlanId, HandleGetPaymentIntent, handleUpgradeSubscription } from "../controllers/SubscriptionController.js";

const router = express.Router();

router.post("/create-subscription", handleCreateSubscription);

router.post("/downgrade-subscription/:userId", handleDowngradeSubscription);

router.post("/upgrade-subscription/:userId", handleUpgradeSubscription);

router.get("/get-subscribed-plan/:userId", handleGetCurrentPlanId);

router.post("/get-intent", HandleGetPaymentIntent);

export default router;
