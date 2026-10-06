import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken, generateOTP } from "../utils/TokenGenerator.js";
import AdminModel from "../models/AdminSchema.js";
import autoMailer from "../utils/AutoMailer.js";
import mongoose from "mongoose";
import BuyerModel from "../models/BuyerSchema.js";
import stripe from "../config/StripeConfig.js";
import SubscriptionModel from "../models/SubscriptionSchema.js";
import PlanModel from "../models/PlanScheme.js";
import SearchQuery from "../utils/SearchQuery.js";
import ExtractRelativeFilePath from "../middlewares/ExtractRelativePath.js";
import expressAsyncHandler from "express-async-handler";
import SellerModel from "../models/SellerSchema.js";
import { v2 as cloudinary } from "cloudinary";

// REGISTER
// METHOD : POST
// ENDPOINT: /api/register
const register = async (req, res, next) => {
   try {
      const { username, email, password } = req.body;

      const existingUser = await AdminModel.findOne({
         $or: [{ username }, { email }],
      });
      if (existingUser) {
         return res.status(400).json({ message: "Username or email already taken" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new AdminModel({
         username,
         email,
         password: hashedPassword,
      });

      await newUser.save();

      const accessToken = generateAccessToken(newUser);
      const refreshToken = generateRefreshToken(newUser);

      newUser.refreshToken = refreshToken;
      await newUser.save();

      const userDetails = {
         username: newUser.username,
         email: newUser.email,
         role: newUser.role,
         _id: newUser._id,
         createdAt: newUser.createdAt,
      };

      // Return tokens
      res.status(201).json({
         message: "User registered successfully",
         accessToken,
         refreshToken,
         user: userDetails,
      });
   } catch (err) {
      next(err);
   }
};

// REGISTER
// METHOD : POST
// ENDPOINT: /api/buyer-register
const handleRegisterBuyer = async (req, res, next) => {
   try {
      const { name, email, phone, address, selectedIncome, creditScore, password, fcmToken, deviceType, deviceName } = req.body;

      const profilePicture = req?.files?.profilePicture;

      if (!profilePicture) {
         return res.status(400).json({ message: "profile picture File is required!" });
      }

      const extractPath = req?.files?.profilePicture;
      const uploadResult = extractPath
         ? await cloudinary.uploader.upload(extractPath.tempFilePath, {
              resource_type: "image",
           })
         : "";

      // const extractPath = ExtractRelativeFilePath(profilePicture);

      const existingBuyer =
         (await AdminModel.findOne({
            $or: [{ username: name }, { email }],
         })) ||
         (await BuyerModel.findOne({
            $or: [{ name }, { email }],
         })) ||
         (await SellerModel.findOne({
            $or: [{ name }, { email }],
         }));

      if (existingBuyer) {
         return res.status(400).json({ message: "This email or username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newBuyer = new BuyerModel({
         name,
         email,
         phone,
         address,
         selectedIncome,
         creditScore,
         profilePicture: uploadResult.secure_url,
         password: hashedPassword,
      });
      await newBuyer.save();

      const accessToken = generateAccessToken(newBuyer);
      const refreshToken = generateRefreshToken(newBuyer);

      newBuyer.sessions = [
         {
            fcmToken,
            refreshToken,
            deviceType: deviceType || "web",
            deviceName: deviceName || req.headers["user-agent"],
            createdAt: new Date(),
         },
      ];

      const customerId = await stripe.customers.create({
         email: email,
         name: newBuyer.name,
         metadata: { userId: newBuyer._id.toString() },
      });

      newBuyer.customerId = customerId.id;
      await newBuyer.save();

      const findSubscription = await SubscriptionModel.findOne({
         userId: newBuyer._id,
      });

      let subscribedPlan;
      if (findSubscription) {
         const findPlan = await PlanModel.findOne({
            _id: findSubscription.planId,
         });
         subscribedPlan = {
            subscription: findSubscription,
            plan: findPlan,
         };
      } else {
         subscribedPlan = null;
      }

      const userDetails = {
         _id: newBuyer._id,
         name: newBuyer.name,
         email: newBuyer.email,
         phone: newBuyer.phone,
         profilePicture: newBuyer.profilePicture,
         selectedIncome: newBuyer.selectedIncome,
         creditScore: newBuyer.creditScore,
         address: newBuyer.address,
         role: newBuyer.role,
         subscribedPlan,
      };

      res.status(201).json({
         message: "User registered successfully",
         accessToken,
         refreshToken,
         user: userDetails,
      });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

// REGISTER
// METHOD : POST
// ENDPOINT: /api/seller-register
const handleRegisterSeller = async (req, res, next) => {
   try {
      const { name, email, phone, address, password, fcmToken, deviceType, deviceName } = req.body;

      const profilePicture = req?.files?.profilePicture;

      if (!profilePicture) {
         return res.status(400).json({ message: "profile picture File is required!" });
      }

      // const extractPath = ExtractRelativeFilePath(profilePicture);
      const extractPath = req?.files?.profilePicture;
      const uploadResult = extractPath
         ? await cloudinary.uploader.upload(extractPath.tempFilePath, {
              resource_type: "image",
           })
         : "";
      const existingSeller =
         (await AdminModel.findOne({
            $or: [{ username: name }, { email }],
         })) ||
         (await BuyerModel.findOne({
            $or: [{ name }, { email }],
         })) ||
         (await BuyerModel.findOne({
            $or: [{ name }, { email }],
         }));

      if (existingSeller) {
         return res.status(400).json({ message: "This email or username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newSeller = new SellerModel({
         name,
         email,
         phone,
         address,
         profilePicture: uploadResult.secure_url,
         password: hashedPassword,
      });
      await newSeller.save();

      const accessToken = generateAccessToken(newSeller);
      const refreshToken = generateRefreshToken(newSeller);

      newSeller.sessions = [
         {
            fcmToken,
            refreshToken,
            deviceType: deviceType || "web",
            deviceName: deviceName || req.headers["user-agent"],
            createdAt: new Date(),
         },
      ];

      const customerId = await stripe.customers.create({
         email: email,
         name: newSeller.name,
         metadata: { userId: newSeller._id.toString() },
      });

      newSeller.customerId = customerId.id;
      await newSeller.save();

      const findSubscription = await SubscriptionModel.findOne({
         userId: newSeller._id,
      });

      let subscribedPlan;
      if (findSubscription) {
         const findPlan = await PlanModel.findOne({
            _id: findSubscription.planId,
         });
         subscribedPlan = {
            subscription: findSubscription,
            plan: findPlan,
         };
      } else {
         subscribedPlan = null;
      }

      const userDetails = {
         _id: newSeller._id,
         name: newSeller.name,
         email: newSeller.email,
         phone: newSeller.phone,
         profilePicture: newSeller.profilePicture,
         address: newSeller.address,
         role: newSeller.role,
         subscribedPlan,
      };

      res.status(201).json({
         message: "User registered successfully",
         accessToken,
         refreshToken,
         user: userDetails,
      });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

// LOGIN
// METHOD : POST
// ENDPOINT: /api/login
const login = async (req, res, next) => {
   try {
      const { identifier, password, fcmToken, deviceType, deviceName } = req.body;
      const user =
         (await AdminModel.findOne({
            $or: [{ email: identifier }, { username: identifier }],
         })) ||
         (await BuyerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         })) ||
         (await SellerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         }));

      if (!user) {
         return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
         return res.status(401).json({ message: "Invalid credentials" });
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      let details;

      if (user.role.includes("Admin")) {
         user.refreshToken = refreshToken;
         await user.save();

         details = {
            username: user.username,
            email: user.email,
            role: user.role,
            _id: user._id,
            createdAt: user.createdAt,
         };
      } else if (user.role.includes("Buyer")) {
         // 4️⃣ Save refresh token & session info
         // Assuming user.sessions is an array of active sessions

         if (!user.sessions) user.sessions = [];
         const sessionData = {
            refreshToken,
            fcmToken: fcmToken || null,
            deviceType: deviceType || "web",
            deviceName: deviceName || "web",
            createdAt: new Date(),
         };
         user.sessions.push(sessionData);

         // user.refreshToken = refreshToken;
         await user.save();

         const findSubscription = await SubscriptionModel.findOne({
            userId: user._id,
         });

         let subscribedPlan;
         if (findSubscription) {
            const findPlan = await PlanModel.findOne({
               _id: findSubscription.planId,
            });
            subscribedPlan = {
               subscription: findSubscription,
               plan: findPlan,
            };
         } else {
            subscribedPlan = null;
         }

         details = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            profilePicture: user.profilePicture,
            selectedIncome: user.selectedIncome,
            creditScore: user.creditScore,
            address: user.address,
            role: user.role,
            subscribedPlan: subscribedPlan,
         };
      } else if (user.role.includes("Seller")) {
         if (!user.sessions) user.sessions = [];
         const sessionData = {
            refreshToken,
            fcmToken: fcmToken || null,
            deviceType: deviceType || "web",
            deviceName: deviceName || "web",
            createdAt: new Date(),
         };
         user.sessions.push(sessionData);

         // user.refreshToken = refreshToken;
         await user.save();

         const findSubscription = await SubscriptionModel.findOne({
            userId: user._id,
         });

         let subscribedPlan;
         if (findSubscription) {
            const findPlan = await PlanModel.findOne({
               _id: findSubscription.planId,
            });
            subscribedPlan = {
               subscription: findSubscription,
               plan: findPlan,
            };
         } else {
            subscribedPlan = null;
         }

         details = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            profilePicture: user.profilePicture,
            address: user.address,
            role: user.role,
            subscribedPlan: subscribedPlan,
         };
      }

      res.status(200).json({
         message: "Logged In Successfully",
         accessToken,
         refreshToken,
         user: details,
      });
   } catch (err) {
      console.log(err);
      next(err);
   }
};

// REFRESH
// METHOD : POST
// ENDPOINT: /api/refresh
const refreshToken = async (req, res, next) => {
   const { token } = req.body;

   if (!token) {
      return res.status(403).json({ message: "Refresh token is required" });
   }

   try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

      const user = (await AdminModel.findById(decoded.id)) || (await BuyerModel.findById(decoded.id)) || (await SellerModel.findById(decoded.id));

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "Admin") {
         if (user.refreshToken === token) {
            const accessToken = generateAccessToken(user);
            return res.status(200).json({ accessToken });
         } else {
            return res.status(403).json({ message: "Invalid refresh token" });
         }
      } else if (user.role === "Buyer") {
         const session = user.sessions.find((s) => s.refreshToken === token);
         if (!session) {
            return res.status(403).json({ message: "Invalid refresh token" });
         }
         const accessToken = generateAccessToken(user);
         return res.status(200).json({ accessToken });
      } else if (user.role === "Seller") {
         const session = user.sessions.find((s) => s.refreshToken === token);
         if (!session) {
            return res.status(403).json({ message: "Invalid refresh token" });
         }
         const accessToken = generateAccessToken(user);
         return res.status(200).json({ accessToken });
      } else {
         res.status(400).json({ message: "Invalid Request" });
      }
   } catch (err) {
      next(err);
   }
};

// LOGOUT (Invalidate refresh token)
// METHOD : POST
// ENDPOINT: /api/logout
const logout = async (req, res, next) => {
   const { token } = req.body;

   if (!token) {
      return res.status(400).json({ message: "Refresh token is required" });
   }

   try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

      const user = (await AdminModel.findById(decoded.id)) || (await BuyerModel.findById(decoded.id)) || (await SellerModel.findById(decoded.id));

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }
      if (user.role === "Admin") {
         user.refreshToken = "";
         await user.save();
         return res.status(200).json({ message: "Logged out successfully" });
      } else if (user.role === "Buyer") {
         user.sessions = user.sessions.filter((s) => s.refreshToken !== token);
         await user.save();
         return res.status(200).json({ message: "Logged out successfully" });
      } else if (user.role === "Seller") {
         user.sessions = user.sessions.filter((s) => s.refreshToken !== token);
         await user.save();
         return res.status(200).json({ message: "Logged out successfully" });
      } else {
         res.status(400).json({ message: "Invalid refresh token" });
      }
   } catch (err) {
      // res.status(403).json({ message: "Invalid refresh token" });
      next(err);
   }
};

// FORGET PASSWORD
// METHOD: POST
// ENDPOINT: /api/forget-password
const forgetPassword = async (req, res, next) => {
   try {
      const { identifier } = req.body;
      const user =
         (await AdminModel.findOne({
            $or: [{ email: identifier }, { username: identifier }],
         })) ||
         (await BuyerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         })) ||
         (await SellerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         }));

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }

      const otp = generateOTP();
      const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      user.otp = otp;
      user.otpExpire = otpExpire;
      await user.save();

      autoMailer({
         to: user.email,
         subject: "Password Reset OTP",
         message: `<p>Your OTP for password reset is: <b>${otp}</b>. It will expire in 10 minutes.</p>`,
      });

      res.status(200).json({ message: "OTP sent to your email.", identifier });
   } catch (err) {
      next(err);
   }
};

// VERIFY OTP
// METHOD: POST
// ENDPOINT: /api/verify-otp
const verifyOtp = async (req, res, next) => {
   try {
      const { identifier, otp } = req.body;
      const user =
         (await AdminModel.findOne({
            $or: [{ email: identifier }, { username: identifier }],
         })) ||
         (await BuyerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         })) ||
         (await SellerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         }));

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }
      if (!user.otp || !user.otpExpire) {
         return res.status(400).json({ message: "No OTP requested." });
      }
      if (user.otp !== otp) {
         return res.status(400).json({ message: "Invalid OTP." });
      }
      if (user.otpExpire < new Date()) {
         return res.status(400).json({ message: "OTP expired." });
      }
      res.status(200).json({ message: "OTP verified.", identifier, otp });
   } catch (err) {
      next(err);
   }
};

// CHANGE PASSWORD
// METHOD: POST
// ENDPOINT: /api/change-password
const changePassword = async (req, res, next) => {
   try {
      const { identifier, otp, newPassword } = req.body;
      const user =
         (await AdminModel.findOne({
            $or: [{ email: identifier }, { username: identifier }],
         })) ||
         (await BuyerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         })) ||
         (await SellerModel.findOne({
            $or: [{ email: identifier }, { name: identifier }],
         }));

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }
      if (!user.otp || !user.otpExpire) {
         return res.status(400).json({ message: "No OTP requested." });
      }
      if (user.otp !== otp) {
         return res.status(400).json({ message: "Invalid OTP." });
      }
      if (user.otpExpire < new Date()) {
         return res.status(400).json({ message: "OTP expired." });
      }
      user.password = await bcrypt.hash(newPassword, 10);
      user.otp = null;
      user.otpExpire = null;
      await user.save();
      res.status(200).json({ message: "Password changed successfully." });
   } catch (err) {
      next(err);
   }
};

// UPDATE PROFILE
// METHOD: PATCH
// ENDPOINT: /api/update-user/:id
const HandleUpdateProfile = async (req, res, next) => {
   try {
      const { id } = req.params;

      const user = (await AdminModel.findById(id)) || (await BuyerModel.findById(id)) || (await SellerModel.findById(id));

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }
      let details;
      if (user.role === "Admin") {
         const { username, email, password, newPass } = req.body;

         // Build dynamic $or conditions
         const userOrConditions = [];
         if (username) userOrConditions.push({ username });
         if (email) userOrConditions.push({ email });

         const existingUser =
            (await AdminModel.findOne({
               _id: { $ne: id },
               $or: userOrConditions,
            })) ||
            (await BuyerModel.findOne({
               _id: { $ne: id },
               $or: userOrConditions,
            }));
         // if (existingUser) {
         //   return res
         //     .status(400)
         //     .json({ message: "Username or email already taken" });
         // }
         user.username = username;
         user.email = email;
         if (password && password !== "" && newPass && newPass !== "") {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
               return res.status(400).json({ message: "Password is Incorrect" });
            }
            user.password = await bcrypt.hash(newPass, 10);
         }
         await user.save();

         details = {
            username: user.username,
            email: user.email,
            role: user.role,
            _id: user._id,
            createdAt: user.createdAt,
         };

         return res.status(200).json({ message: "Profile Updated Successfully", user: details });
      } else if (user.role === "Buyer") {
         const clean = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

         // sanitize inputs
         const name = clean(req.body.name);
         const phone = clean(req.body.phone);
         const email = clean(req.body.email);
         const address = clean(req.body.address);
         const password = clean(req.body.password);
         const selectedIncome = clean(req.body.selectedIncome);
         const creditScore = clean(req.body.creditScore);

         const profilePicture = req?.files?.profilePicture;

         // build $or ONLY if values exist
         const userOrConditions = [];
         if (name) userOrConditions.push({ name });
         if (email) userOrConditions.push({ email });
         if (phone) userOrConditions.push({ phone });
         if (address) userOrConditions.push({ address });
         if (selectedIncome) userOrConditions.push({ selectedIncome });
         if (creditScore) userOrConditions.push({ creditScore });

         let existingUser = null;

         if (userOrConditions.length > 0) {
            existingUser =
               (await BuyerModel.findOne({
                  _id: { $ne: id },
                  $or: userOrConditions,
               })) ||
               (await AdminModel.findOne({
                  _id: { $ne: id },
                  $or: userOrConditions,
               })) ||
               (await SellerModel.findOne({
                  _id: { $ne: id },
                  $or: userOrConditions,
               }));
         }

         //  if (existingUser) {
         //     return res.status(400).json({
         //        message: "name or email already taken",
         //     });
         //  }

         // file updates
         if (profilePicture) {
            const extractPath = req?.files?.profilePicture;
            const uploadResult = extractPath
               ? await cloudinary.uploader.upload(extractPath.tempFilePath, {
                    resource_type: "image",
                 })
               : "";
            user.profilePicture = uploadResult.secure_url;
         }

         // field updates
         if (name) user.name = name;
         if (email) user.email = email;
         if (address) user.address = address;
         if (phone) user.phone = phone;
         if (selectedIncome) user.selectedIncome = selectedIncome;
         if (creditScore) user.creditScore = creditScore;

         if (password) {
            user.password = await bcrypt.hash(password, 10);
         }

         await user.save();

         // subscription info
         const findSubscription = await SubscriptionModel.findOne({
            userId: user._id,
         });

         let subscribedPlan = null;

         if (findSubscription) {
            const findPlan = await PlanModel.findOne({
               _id: findSubscription.planId,
            });

            subscribedPlan = {
               subscription: findSubscription,
               plan: findPlan,
            };
         }

         const details = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            selectedIncome: user.selectedIncome,
            creditScore: user.creditScore,
            address: user.address,
            profilePicture: user.profilePicture,
            role: user.role,
            subscribedPlan,
         };

         return res.status(200).json({
            message: "Profile Updated Successfully",
            user: details,
         });
      } else if (user.role === "Seller") {
         const clean = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

         // sanitize inputs
         const name = clean(req.body.name);
         const phone = clean(req.body.phone);
         const email = clean(req.body.email);
         const address = clean(req.body.address);
         const password = clean(req.body.password);

         const profilePicture = req?.files?.profilePicture;

         // build $or ONLY if values exist
         const userOrConditions = [];
         if (name) userOrConditions.push({ name });
         if (email) userOrConditions.push({ email });
         if (phone) userOrConditions.push({ phone });
         if (address) userOrConditions.push({ address });

         let existingUser = null;

         if (userOrConditions.length > 0) {
            existingUser =
               (await BuyerModel.findOne({
                  _id: { $ne: id },
                  $or: userOrConditions,
               })) ||
               (await AdminModel.findOne({
                  _id: { $ne: id },
                  $or: userOrConditions,
               })) ||
               (await SellerModel.findOne({
                  _id: { $ne: id },
                  $or: userOrConditions,
               }));
         }

         if (existingUser) {
            return res.status(400).json({
               message: "name or email already taken",
            });
         }

         // file updates
         if (profilePicture) {
            const extractPath = req?.files?.profilePicture;
            const uploadResult = extractPath
               ? await cloudinary.uploader.upload(extractPath.tempFilePath, {
                    resource_type: "image",
                 })
               : "";
            user.profilePicture = uploadResult.secure_url;
         }

         // field updates
         if (name) user.name = name;
         if (email) user.email = email;
         if (address) user.address = address;
         if (phone) user.phone = phone;

         if (password) {
            user.password = await bcrypt.hash(password, 10);
         }

         await user.save();

         // subscription info
         const findSubscription = await SubscriptionModel.findOne({
            userId: user._id,
         });

         let subscribedPlan = null;

         if (findSubscription) {
            const findPlan = await PlanModel.findOne({
               _id: findSubscription.planId,
            });

            subscribedPlan = {
               subscription: findSubscription,
               plan: findPlan,
            };
         }

         const details = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            profilePicture: user.profilePicture,
            subscribedPlan,
         };

         return res.status(200).json({
            message: "Profile Updated Successfully",
            user: details,
         });
      } else {
         res.status(400).json({ message: "Invalid Request" });
      }
   } catch (error) {
      next(error);
   }
};

// GET PROFILE
// METHOD: GET
// ENDPOINT: /api/get-profile/:id
const handleGetUserProfile = async (req, res, next) => {
   try {
      const { id } = req.params;
      const findUser = (await BuyerModel.findById(id).select("-sessions -password -otp -otpExpire")) || (await AdminModel.findById(id).select("-password -otp -otpExpire -refreshToken")) || (await SellerModel.findById(id).select("-password -otp -otpExpire -refreshToken"));
      if (!findUser) {
         return res.status(404).json({ message: "User Not Found" });
      }

      if (findUser.role === "Buyer") {
         const findSubscription = await SubscriptionModel.findOne({
            userId: findUser._id,
         });
         let subscribedPlan;
         if (findSubscription) {
            const findPlan = await PlanModel.findOne({
               _id: findSubscription.planId,
            });
            subscribedPlan = {
               subscription: findSubscription,
               plan: findPlan,
            };
         } else {
            subscribedPlan = null;
         }
         const details = {
            _id: findUser._id,
            name: findUser.name,
            email: findUser.email,
            phone: findUser.phone,
            address: findUser.address,
            selectedIncome: findUser.selectedIncome,
            creditScore: findUser.creditScore,
            profilePicture: findUser.profilePicture,
            role: findUser.role,
            subscribedPlan,
         };
         return res.status(200).json({ user: details });
      } else if (findUser.role === "Seller") {
         const findSubscription = await SubscriptionModel.findOne({
            userId: findUser._id,
         });

         let subscribedPlan;
         if (findSubscription) {
            const findPlan = await PlanModel.findOne({
               _id: findSubscription.planId,
            });
            subscribedPlan = {
               subscription: findSubscription,
               plan: findPlan,
            };
         } else {
            subscribedPlan = null;
         }

         const details = {
            _id: findUser._id,
            name: findUser.name,
            email: findUser.email,
            phone: findUser.phone,
            address: findUser.address,
            profilePicture: findUser.profilePicture,
            role: findUser.role,
            subscribedPlan,
         };
         return res.status(200).json({ user: details });
      } else if (findUser.role === "Admin") {
         return res.status(200).json({ user: findUser });
      }
   } catch (error) {
      next(error);
   }
};

// GET BUYERS
// METHOD: GET
// ENDPOINT: /api/get-users
const handleGetBuyers = async (req, res, next) => {
   try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const search = req.query.search || {};
      const matchStage = SearchQuery(search);

      const pipeline = [
         {
            $lookup: {
               from: "subscriptions",
               localField: "_id",
               foreignField: "userId",
               as: "subscription",
            },
         },
         {
            $unwind: {
               path: "$subscription",
               preserveNullAndEmptyArrays: true,
            },
         },

         {
            $lookup: {
               from: "plans",
               localField: "subscription.planId",
               foreignField: "_id",
               as: "plan",
            },
         },

         {
            $unwind: {
               path: "$plan",
               preserveNullAndEmptyArrays: true,
            },
         },
         {
            $project: {
               _id: 1,
               name: 1,
               email: 1,
               phone: 1,
               address: 1,
               profilePicture: 1,
               createdAt: 1,
               subscription: 1,
               plan: 1,
               selectedIncome: 1,
               creditScore: 1,
            },
         },
      ];

      if (matchStage) pipeline.push(matchStage);
      pipeline.push({ $sort: { createdAt: -1 } });

      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      const users = await BuyerModel.aggregate(pipeline);

      const countPipeline = [];
      if (matchStage) countPipeline.push(matchStage);
      countPipeline.push({ $count: "totalItems" });

      const countResult = await BuyerModel.aggregate(countPipeline);
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
         users,
         meta: {
            totalItems,
            totalPages,
            page,
            limit,
         },
      });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

// GET SELLERS
// METHOD: GET
// ENDPOINT: /api/get-sellers
const handleGetSellers = async (req, res, next) => {
   try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const search = req.query.search || {};
      const matchStage = SearchQuery(search);

      const pipeline = [
         {
            $lookup: {
               from: "subscriptions",
               localField: "_id",
               foreignField: "userId",
               as: "subscription",
            },
         },
         {
            $unwind: {
               path: "$subscription",
               preserveNullAndEmptyArrays: true,
            },
         },

         {
            $lookup: {
               from: "plans",
               localField: "subscription.planId",
               foreignField: "_id",
               as: "plan",
            },
         },

         {
            $unwind: {
               path: "$plan",
               preserveNullAndEmptyArrays: true,
            },
         },
         {
            $project: {
               _id: 1,
               name: 1,
               email: 1,
               phone: 1,
               address: 1,
               profilePicture: 1,
               createdAt: 1,
               subscription: 1,
               plan: 1,
            },
         },
      ];

      if (matchStage) pipeline.push(matchStage);
      pipeline.push({ $sort: { createdAt: -1 } });

      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      const users = await SellerModel.aggregate(pipeline);

      const countPipeline = [];
      if (matchStage) countPipeline.push(matchStage);
      countPipeline.push({ $count: "totalItems" });

      const countResult = await SellerModel.aggregate(countPipeline);
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
         users,
         meta: {
            totalItems,
            totalPages,
            page,
            limit,
         },
      });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

// UPDATE PASSWORD
// METHOD : PATCH
// ENDPOINT: /api/id/update-password
const handleUpdatePassword = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { password, newPass } = req.body;
      const user = (await BuyerModel.findById(id)) || (await SellerModel.findById(id));
      if (!user) {
         return res.status(404).json({ message: "User Not Found" });
      }
      if (password && password !== "" && newPass && newPass !== "") {
         const isMatch = await bcrypt.compare(password, user.password);
         if (!isMatch) {
            return res.status(400).json({ message: "Password is Incorrect" });
         }
         user.password = await bcrypt.hash(newPass, 10);
      }
      await user.save();
      return res.status(200).json({ message: "Password Updated Successfully" });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

// UPDATE TIMEZONE
// METHOD : PATCH
// ENDPOINT: /api/update-timezone
const handleUpdateTimezone = async (req, res, next) => {
   try {
      const { refreshToken, timezone } = req.body;

      if (!refreshToken) {
         return res.status(403).json({ message: "Refresh token is required" });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      const user = (await BuyerModel.findById(decoded.id)) || (await SellerModel.findById(decoded.id));

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }

      const session = user.sessions.find((s) => s.refreshToken === refreshToken);
      if (!session) {
         return res.status(403).json({ message: "Invalid refresh token" });
      }
      session.timezone = timezone;
      await session.save();

      res.status(200).json({ message: "Timezone Updated Successfully" });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

// DELETE USER
// METHOD : PATCH
// ENDPOINT: /api/:userId/delete-account
const handleDeleteAccount = async (req, res, next) => {
   try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
         return res.status(400).json({ message: "Invalid User ID" });
      }

      const user = (await BuyerModel.findOneAndDelete({ _id: userId })) || (await SellerModel.findOneAndDelete({ _id: userId }));

      if (!user) {
         return res.status(404).json({ message: "User Not Found or Already Deleted" });
      }

      await SubscriptionModel.deleteMany({ userId: userId });

      return res.status(200).json({
         message: "Your account has been deleted successfully",
      });
   } catch (error) {
      console.error(error);
      next(error);
   }
};

// GET USER'S PLAN
// METHOD : GET
// ENDPOINT: /api/:userId/get-subscription
const handleGetSubscriptionDetails = async (req, res, next) => {
   try {
      const { userId } = req.params;

      const findSubscription = await SubscriptionModel.findOne({
         userId: userId,
      });

      let subscribedPlan;
      if (findSubscription) {
         const findPlan = await PlanModel.findOne({
            _id: findSubscription.planId,
         });
         subscribedPlan = {
            subscription: findSubscription,
            plan: findPlan,
         };
      } else {
         subscribedPlan = null;
      }

      res.status(201).json({
         subscribedPlan,
      });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

export {
   register,
   handleRegisterBuyer,
   handleRegisterSeller,
   login,
   logout,
   refreshToken,
   forgetPassword,
   verifyOtp,
   changePassword,
   HandleUpdateProfile,
   handleGetUserProfile,
   handleGetSellers,
   handleGetBuyers,
   handleUpdatePassword,
   handleUpdateTimezone,
   handleDeleteAccount,
   handleGetSubscriptionDetails,
};

// const handleRegisterUser = async (req, res, next) => {
//   try {
//     const { username, email, idCardNumber, medicareNumber, dob, address, gender, bloodGroup, pastInjury, pastOperation, medicines, healthNote, password, fcmToken, deviceType, contactNumber, deviceName } = req.body;

//     const medicareFile = req?.files?.medicareFile?.[0];

//     if (!medicareFile) {
//       return res.status(400).json({ message: "Medicare File is required!" });
//     }

//     const extractPath = ExtractRelativeFilePath(medicareFile);

//     let existingUser = await BuyerModel.findOne({
//       $or: [{ username }, { email }, { idCardNumber }, { medicareNumber }],
//     });

//     if (existingUser) {
//       return res.status(400).json({ message: "User Already Exists!" })
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = new BuyerModel({
//       username,
//       email,
//       contactNumber,
//       idCardNumber,
//       medicareNumber,
//       dob,
//       address,
//       gender,
//       bloodGroup,
//       pastInjury,
//       pastOperation,
//       medicines,
//       healthNote,
//       medicare: extractPath,
//       password: hashedPassword,
//     });
//     await newUser.save();

//     const accessToken = generateAccessToken(newUser);
//     const refreshToken = generateRefreshToken(newUser);

//     newUser.sessions = [
//       {
//         fcmToken,
//         refreshToken,
//         deviceType: deviceType || "web",
//         deviceName: deviceName || req.headers["user-agent"],
//         createdAt: new Date(),
//       },
//     ];

//     const customerId = await stripe.customers.create({
//       email: email,
//       name: username,
//       metadata: { userId: newUser._id.toString() },
//     });

//     newUser.customerId = customerId.id;
//     await newUser.save();

//     const findSubscription = await SubscriptionModel.findOne({
//       userId: newUser._id,
//     });

//     let subscribedPlan;
//     if (findSubscription) {
//       const findPlan = await PlanModel.findOne({
//         _id: findSubscription.planId,
//       });
//       subscribedPlan = {
//         subscription: findSubscription,
//         plan: findPlan,
//       };
//     } else {
//       subscribedPlan = null;
//     }

//     const userDetails = {
//       _id: newUser._id,
//       username: newUser.username,
//       email: newUser.email,
//       idCardNumber: newUser.idCardNumber,
//       contactNumber: newUser.contactNumber,
//       medicare: newUser.medicare,
//       profilePicture: newUser.profilePicture,
//       medicareNumber: newUser.medicareNumber,
//       dob: newUser.dob,
//       address: newUser.address,
//       gender: newUser.gender,
//       bloodGroup: newUser.bloodGroup,
//       pastInjury: newUser.pastInjury,
//       pastOperation: newUser.pastOperation,
//       medicines: newUser.medicines,
//       healthNote: newUser.healthNote,
//       role: newUser.role,
//       subscribedPlan,
//     };

//     res.status(201).json({
//       message: "User registered successfully",
//       accessToken,
//       refreshToken,
//       user: userDetails,
//     });
//   } catch (error) {
//     console.log(error);
//     // Handle MongoDB duplicate key error
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyPattern)[0];
//       const value = error.keyValue[field];
//       return res.status(400).json({
//         message: `A user with this ${field} already exists: ${value}`
//       });
//     }

//     next(error);
//   }
// };
