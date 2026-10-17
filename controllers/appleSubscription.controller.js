/**
 * Apple In-App Purchase verification controller (ES Modules version)
 *
 * Install:  npm i @apple/app-store-server-library
 *
 * .env variables required:
 *   APPLE_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   (App Store Connect > Users and Access > Integrations > In-App Purchase)
 *   APPLE_KEY_ID=XXXXXXXXXX
 *   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"   (.p8 file ka content, newlines as \n)
 *   APPLE_BUNDLE_ID=com.swipeestate.user          (apni app ka bundle id)
 *   APPLE_APP_ID=1234567890                       (App Store Connect > App Information > Apple ID; production ke liye zaroori)
 *
 * Apple Root certificates (download from https://www.apple.com/certificateauthority/):
 *   AppleRootCA-G3.cer, AppleRootCA-G2.cer, AppleIncRootCertificate.cer
 *   Inhein backend ke root mein  certs/apple/  folder mein rakho.
 *
 * NOTE: ES Modules mein relative imports ke end par .js likhna zaroori hai.
 *       Neeche model paths aur default/named export apne project ke hisaab se adjust karna.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier, APIException } from "@apple/app-store-server-library";

// ====== ADJUST THESE PATHS (.js extension zaroori) ======
import PlanModel from "../models/PlanScheme.js";
import SubscriptionModel from "../models/SubscriptionSchema.js";
import UserModel from "../models/BuyerSchema.js";

// ========================================================

// ESM mein __dirname nahi hota, is liye ye banaya hai
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID;
const APP_APPLE_ID = Number(process.env.APPLE_APP_ID);

// ====== ADJUST: certs folder ka path. Ye file controllers/ mein hai to '../certs/apple' ======
// Agar file kisi deeper module folder mein hai (jaise src/modules/subscription/), to '../' barha lo.
const CERTS_DIR = path.join(__dirname, "../certs/apple");
// ==========================================================================================

const loadRootCertificates = () =>
   ["AppleRootCA-G3.cer", "AppleRootCA-G2.cer", "AppleIncRootCertificate.cer"]
      .map((file) => path.join(CERTS_DIR, file))
      .filter((p) => fs.existsSync(p))
      .map((p) => fs.readFileSync(p));

const rootCertificates = loadRootCertificates();

if (rootCertificates.length === 0) {
   console.error(`Apple root certificates nahi mile. Is folder ko check karo: ${CERTS_DIR}`);
}

const buildClient = (environment) => new AppStoreServerAPIClient((process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"), process.env.APPLE_KEY_ID, process.env.APPLE_ISSUER_ID, BUNDLE_ID, environment);

const buildVerifier = (environment) =>
   new SignedDataVerifier(
      rootCertificates,
      true, // online certificate revocation check
      environment,
      BUNDLE_ID,
      // appAppleId sirf Production ke liye chahiye
      environment === Environment.PRODUCTION ? APP_APPLE_ID : undefined,
   );

/**
 * Transaction Apple se fetch + verify karta hai.
 * Pehle Production try karta hai, agar nahi mile (sandbox/TestFlight/App Review purchase)
 * to Sandbox try karta hai.
 */
const fetchVerifiedTransaction = async (transactionId) => {
   const environments = [Environment.PRODUCTION, Environment.SANDBOX];
   let lastError = null;

   for (const environment of environments) {
      try {
         const client = buildClient(environment);
         const response = await client.getTransactionInfo(transactionId);

         if (!response?.signedTransactionInfo) {
            throw new Error("Apple ne signed transaction nahi di");
         }

         const verifier = buildVerifier(environment);
         const transaction = await verifier.verifyAndDecodeTransaction(response.signedTransactionInfo);

         return { transaction, environment };
      } catch (error) {
         lastError = error;

         // 404 = transaction is environment mein nahi mili, doosri try karo
         const isNotFound = error instanceof APIException && error.httpStatusCode === 404;

         if (!isNotFound) {
            throw error;
         }
      }
   }

   throw lastError || new Error("Transaction Apple par nahi mili");
};

/**
 * POST /api/subscription/apple/verify
 * Body: { planId: string, transactionId: string }
 * Auth middleware se req.user ya req.userId aana chahiye.
 */
export const verifyAppleSubscription = async (req, res) => {
   try {
      const { planId, transactionId } = req.body;

      // ====== ADJUST: apne auth middleware ke mutabiq userId lo ======
      const userId = req.user?._id || req.userId || req.body.userId;
      // ===============================================================

      if (!userId) {
         return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      if (!planId || !transactionId) {
         return res.status(400).json({
            success: false,
            message: "planId aur transactionId required hain",
         });
      }

      const plan = await PlanModel.findById(planId);
      if (!plan) {
         return res.status(404).json({ success: false, message: "Plan nahi mila" });
      }

      if (!plan.appleProductId) {
         return res.status(400).json({
            success: false,
            message: "Is plan ka Apple product ID set nahi hai",
         });
      }

      // 1) Apple se verified transaction lo
      const { transaction, environment } = await fetchVerifiedTransaction(String(transactionId));

      // 2) Product ID plan se match hona chahiye
      if (transaction.productId !== plan.appleProductId) {
         return res.status(400).json({
            success: false,
            message: "Product ID plan se match nahi karta",
         });
      }

      // 3) Revoked / refunded transaction reject
      if (transaction.revocationDate) {
         return res.status(400).json({
            success: false,
            message: "Ye purchase revoke ho chuki hai",
         });
      }

      // 4) Expired reject
      const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;

      if (!expiresAt || expiresAt.getTime() <= Date.now()) {
         return res.status(400).json({
            success: false,
            message: "Subscription expire ho chuki hai",
         });
      }

      const originalTransactionId = String(transaction.originalTransactionId);
      const appleTransactionId = String(transaction.transactionId);

      // 5) Ye Apple subscription kisi doosre account pe to use nahi ho rahi
      const usedByOther = await SubscriptionModel.findOne({
         appleOriginalTransactionId: originalTransactionId,
         userId: { $ne: userId },
      });

      if (usedByOther) {
         return res.status(409).json({
            success: false,
            message: "Ye Apple subscription kisi aur account se linked hai",
         });
      }

      // 6) Subscription create/update (same user ke liye renew/upgrade bhi handle)
      const startDate = transaction.purchaseDate ? new Date(transaction.purchaseDate) : new Date();

      const subscription = await Subscription.findOneAndUpdate(
         { userId },
         {
            userId,
            planId: plan._id,
            paymentProvider: "apple",
            appleProductId: transaction.productId,
            appleTransactionId,
            appleOriginalTransactionId: originalTransactionId,
            status: "active",
            startDate,
            endDate: expiresAt,
            currentPeriodEnd: expiresAt,
            downgradeRequestedAt: null,
            downgradeMessage: "",
            downgradeScheduled: false,
         },
         { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      // ====== ADJUST: user.subscribedPlan wohi set karo jo tumhara Stripe flow karta hai ======
      await UserModel.findByIdAndUpdate(userId, { subscribedPlan: plan._id });
      // =========================================================================================

      return res.status(200).json({
         success: true,
         message: "Subscription activate ho gayi",
         environment,
         subscription,
      });
   } catch (error) {
      console.error("Apple verification failed:", error);

      return res.status(500).json({
         success: false,
         message: "Apple purchase verify nahi ho saki",
      });
   }
};

/**
 * ROUTE (apni subscription routes file mein add karo):
 *
 * import { verifyAppleSubscription } from '../controllers/appleSubscription.controller.js';
 * router.post('/apple/verify', authMiddleware, verifyAppleSubscription);
 */
