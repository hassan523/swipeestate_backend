import express from "express";

import validate from "../middlewares/ValidationHandler.js";

import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import AccessMiddleware from "../middlewares/AccessMiddleware.js";
import {
  createProductAndPrice,
  handleGetPlans
} from "../controllers/PlanController.js";

const router = express.Router();

router.post("/create-plans", createProductAndPrice);

router.get("/get-plans", handleGetPlans);

export default router;
