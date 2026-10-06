import express from "express";
import {
  login,
  logout,
  refreshToken,
  register,
  forgetPassword,
  verifyOtp,
  changePassword,
  HandleUpdateProfile,
  handleGetUserProfile,
  handleUpdatePassword,
  handleUpdateTimezone,
  handleDeleteAccount,
  handleRegisterBuyer,
  handleRegisterSeller,
  handleGetBuyers,
  handleGetSellers,
  handleGetSubscriptionDetails
} from "../controllers/AuthController.js";
import validate from "../middlewares/ValidationHandler.js";
import {
  loginSchema,
  adminSchema,
  userSchema
} from "../validations/AuthValidations.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import AccessMiddleware from "../middlewares/AccessMiddleware.js";
import { CreateUploadMiddleware } from "../middlewares/MulterMiddleware.js";
import { createRequire } from 'module';

const router = express.Router();
const require = createRequire(import.meta.url);

router.post("/register", validate(adminSchema), register);

router.post(
  "/buyer-register",
  handleRegisterBuyer
);

router.post(
  "/seller-register",
  handleRegisterSeller
);

router.post(
  "/login",
  //  validate(loginSchema)
  login
);

router.post("/refresh", refreshToken);

router.post("/logout", logout);

router.patch("/forget-password", forgetPassword);

router.patch("/verify-otp", verifyOtp);

router.patch("/change-password", changePassword);

router.get("/get-profile/:id", handleGetUserProfile);

router.patch("/update-user/:id",
  HandleUpdateProfile);

router.get("/get-buyers", handleGetBuyers);

router.get("/get-sellers", handleGetSellers);

router.patch("/:id/update-password", handleUpdatePassword);

router.patch("/update-timezone", handleUpdateTimezone);

router.patch("/:userId/delete-account", handleDeleteAccount);

router.get("/:userId/get-subscription", handleGetSubscriptionDetails);

export default router;