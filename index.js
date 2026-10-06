import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Middlewares
import ErrorHandler from "./middlewares/ErrorHandler.js";
import ErrorLogger from "./middlewares/ErrorLogger.js";
// import RateLimiter from "./middlewares/RateLimiter.js";
import SecurityHeaders from "./middlewares/HelmetMiddleware.js";
import qs from "qs";

// DB Connection
import connectDB from "./config/DB.js";
// import admin from "./config/firebase.js";

// Cloudinary
import { v2 as cloudinary } from "cloudinary";
import fileUpload from "express-fileupload";

// App Connection
import { createServer } from "http";
import ngrok from "ngrok";

// Routes
import AuthRoutes from "./routes/AuthRoutes.js";
import PlanRoutes from "./routes/PlanRoutes.js";
import SubscripitonRoutes from "./routes/SubscripitonRoutes.js";
import ApartmentRoutes from "./routes/ApartmentRoutes.js";
import MatchRoutes from "./routes/MatchRoutes.js";
import WebhookRoutes from "./routes/WebhookRoutes.js";

import { allowedOrigins } from "./utils/AllowedOrigins.js";
import { handleStripeWebhook } from "./webhooks/StripeSubscriptionWebhook.js";
import { SwipeDistributor } from "./crons/SwipeDistributor.js";

import path from "path";

dotenv.config();

const app = express();

console.log("TRUST PROXY VALUE:", app.get("trust proxy"));

app.set("trust proxy", 1);

console.log("TRUST PROXY AFTER SET:", app.get("trust proxy"));

const httpServer = createServer(app);

app.use(SecurityHeaders);

app.set("query parser", "extended");

// === MongoDB Connection ===
connectDB();

// Stripe Webhook
app.use("/api/stripe", WebhookRoutes);



// === Global Middlewares ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);


app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"]
  })
);

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  api_key: process.env.CLOUDINARY_API_KEY
})
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// === Security Header Middleware ===
app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  },
  express.static("uploads")
);

// === Rate Limiter
import rateLimit from "express-rate-limit";

const RateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(RateLimiter);

// === Logger Middleware for logging errors
app.use(ErrorLogger);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Health Ok!" });
});

// Cron 
SwipeDistributor()

// === Routes ===
app.use("/api", AuthRoutes);
app.use("/api/plans", PlanRoutes);
app.use("/api/subscriptions", SubscripitonRoutes);
app.use("/api/apartments", ApartmentRoutes);
app.use("/api/matches", MatchRoutes);

// === Error Handler

app.use(ErrorHandler);

// === Server Start ===
const PORT = process.env.PORT || 5000;

// httpServer.listen(PORT, async () => {
//   console.log(`Server running on http://localhost:${PORT}`);

//   if (process.env.USE_NGROK === "true") {
//     try {
//       const url = await ngrok.connect(PORT);
//       console.log(`ngrok tunnel: ${url}`);
//     } catch (err) {
//       console.error("Failed to start ngrok:", err);
//     }
//   }
// });

app.listen(PORT, () => {
  console.log(`App Is Running On ${PORT}`)
})
