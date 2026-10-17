import mongoose from "mongoose";
import ApartmentModel from "../models/ApartmentSchema.js";
import BuyerModel from "../models/BuyerSchema.js";
import MatchModel from "../models/MatchSchema.js";
import SellerModel from "../models/SellerSchema.js";
import SearchQuery from "../utils/SearchQuery.js";
import SubscriptionModel from "../models/SubscriptionSchema.js";

export const handleReqMatch = async (req, res, next) => {
   try {
      const { userId, propertyId } = req.params;

      const findBuyer = await BuyerModel.findById(userId);
      if (!findBuyer) return res.status(404).json({ message: "Buyer Not Found" });

      const findProperty = await ApartmentModel.findById(propertyId);
      if (!findProperty) return res.status(404).json({ message: "Property Not Found" });

      const existingMatch = await MatchModel.findOne({
         propertyId,
         "matchLikedBy.buyerId": userId,
      });
      if (existingMatch) return res.status(400).json({ message: "Match already requested" });

      const updatedSubscription = await SubscriptionModel.findOneAndUpdate({ userId, "planRestrictions.numberOfSwipes": { $gt: 0 } }, { $inc: { "planRestrictions.numberOfSwipes": -1 } }, { new: true });
      if (!updatedSubscription) return res.status(400).json({ message: "No swipes remaining" });

      const createMatch = new MatchModel({
         propertyId: propertyId,
         matchLikedBy: {
            buyerId: userId,
            likedAt: Date.now(),
         },
      });
      await createMatch.save();

      res.status(200).json({ message: "Match Request Sent Successfully" });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

export const handleGetMatches = async (req, res, next) => {
   try {
      const { userId } = req.params;

      const buyer = await BuyerModel.findById(userId);
      const seller = buyer ? null : await SellerModel.findById(userId);

      if (!buyer && !seller) {
         return res.status(404).json({ message: "User Not Found" });
      }

      const isSeller = !!seller;

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const search = req.query.search || {};
      const searchStage = SearchQuery(search);

      const pipeline = [
         /* 🔹 Property */
         {
            $lookup: {
               from: "appartments",
               localField: "propertyId",
               foreignField: "_id",
               as: "property",
            },
         },
         { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
      ];

      /* 🔹 ROLE-BASED FILTER */
      if (isSeller) {
         pipeline.push({
            $match: {
               "property.sellerId": new mongoose.Types.ObjectId(userId),
            },
         });
      } else {
         pipeline.push({
            $match: {
               "matchLikedBy.buyerId": new mongoose.Types.ObjectId(userId),
               // status: { $ne: "Rejected" },
            },
         });
      }

      /* 🔹 Buyer */
      pipeline.push(
         {
            $lookup: {
               from: "buyers",
               let: { buyerId: "$matchLikedBy.buyerId" },
               pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$buyerId"] } } }, { $project: { password: 0, sessions: 0, __v: 0 } }],
               as: "buyer",
            },
         },
         { $unwind: { path: "$buyer", preserveNullAndEmptyArrays: true } },
      );

      /* 🔹 Seller */
      pipeline.push(
         {
            $lookup: {
               from: "sellers",
               let: { sellerId: "$property.sellerId" },
               pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$sellerId"] } } }, { $project: { password: 0, sessions: 0, __v: 0 } }],
               as: "seller",
            },
         },
         { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },
      );

      if (searchStage) pipeline.push(searchStage);

      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      const matches = await MatchModel.aggregate(pipeline);

      /* 🔹 Count (same filters, no pagination) */
      const countPipeline = pipeline.filter((stage) => !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage));

      countPipeline.push({ $count: "totalItems" });

      const countResult = await MatchModel.aggregate(countPipeline);
      const totalItems = countResult[0]?.totalItems || 0;
      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
         matches,
         meta: {
            totalItems,
            totalPages,
            page,
            limit,
         },
      });
   } catch (error) {
      console.error(error);
      next(error);
   }
};

export const handleAcceptMatch = async (req, res, next) => {
   try {
      const { userId, matchId } = req.params;

      // 1️⃣ Check if seller exists
      const findSeller = await SellerModel.findById(userId);
      if (!findSeller) {
         return res.status(400).json({ message: "Seller not found" });
      }

      // 2️⃣ Find the match
      const findMatch = await MatchModel.findById(matchId);
      if (!findMatch) {
         return res.status(404).json({ message: "Match not found" });
      }

      // 3️⃣ Atomically decrement buyer's numberOfAcceptMatch
      const updatedSubscription = await SubscriptionModel.findOneAndUpdate(
         {
            userId: userId,
            "planRestrictions.numberOfAcceptMatch": { $gt: 0 },
         },
         { $inc: { "planRestrictions.numberOfAcceptMatch": -1 } },
         { new: true },
      );
      console.log(updatedSubscription);
      if (!updatedSubscription) {
         return res.status(400).json({ message: "This user doesn't have enough matches" });
      }

      // 4️⃣ Update match to accepted
      if (!findMatch.matchAcceptedBy) {
         findMatch.matchAcceptedBy = {};
      }

      findMatch.matchAcceptedBy.sellerId = userId;
      findMatch.matchAcceptedBy.likedAt = new Date();
      findMatch.status = "Matched";

      await findMatch.save();

      res.status(200).json({ message: "Match Accepted Successfully" });
   } catch (error) {
      console.error(error);
      next(error);
   }
};

export const handleRejectMatch = async (req, res, next) => {
   try {
      const { userId, propertyId } = req.params;

      // // 1️⃣ Check buyer exists
      // const buyer = await BuyerModel.findById(userId);
      // if (!buyer) {
      //   return res.status(404).json({ message: "Buyer not found" });
      // }

      // 2️⃣ Check property exists
      const property = await ApartmentModel.findById(propertyId);
      if (!property) {
         return res.status(404).json({ message: "Property not found" });
      }

      // 3️⃣ Atomically decrement buyer's numberOfSwipes
      const updatedSubscription = await SubscriptionModel.findOneAndUpdate(
         {
            userId,
            "planRestrictions.numberOfSwipes": { $gt: 0 },
         },
         { $inc: { "planRestrictions.numberOfSwipes": -1 } },
         { new: true },
      );

      if (!updatedSubscription) {
         return res.status(400).json({ message: "No swipes remaining" });
      }

      // 4️⃣ Find existing match (if any)
      let match = await MatchModel.findOne({
         propertyId,
         "matchLikedBy.buyerId": userId,
      });

      // 5️⃣ Create or update match as rejected
      if (!match) {
         match = new MatchModel({
            propertyId,
            matchLikedBy: {
               buyerId: userId,
            },
            status: "Rejected",
            rejectedBy: {
               buyerId: userId,
               rejectedAt: new Date(),
            },
         });
      } else {
         if (match.status === "Rejected") {
            return res.status(400).json({ message: "Already rejected" });
         }
         match.status = "Rejected";
         match.rejectedBy = {
            buyerId: userId,
            rejectedAt: new Date(),
         };
      }

      await match.save();

      res.status(200).json({ message: "Property rejected successfully" });
   } catch (error) {
      console.error(error);
      next(error);
   }
};

export const handleRejectBySellerMatch = async (req, res, next) => {
   try {
      const { userId, matchId } = req.params;

      // 1️⃣ Check if seller exists
      const findSeller = await SellerModel.findById(userId);
      if (!findSeller) {
         return res.status(400).json({ message: "Seller not found" });
      }

      // 2️⃣ Find the match
      const findMatch = await MatchModel.findById(matchId);
      if (!findMatch) {
         return res.status(404).json({ message: "Match not found" });
      }

      // 4️⃣ Update match to accepted
      if (!findMatch.matchAcceptedBy) {
         findMatch.rejectedBy = {};
      }

      findMatch.rejectedBy.sellerId = userId;
      findMatch.rejectedBy.likedAt = new Date();
      findMatch.status = "Rejected";

      await findMatch.save();

      res.status(200).json({ message: "Property rejected successfully" });
   } catch (error) {
      console.error(error);
      next(error);
   }
};

export const handleShowContactDetail = async (req, res, next) => {
   try {
      const { userId, matchId } = req.params;

      // 1️⃣ Check if seller exists
      const findBuyer = await BuyerModel.findById(userId);
      if (!findBuyer) {
         return res.status(400).json({ message: "Buyer not found" });
      }

      // 2️⃣ Find the match
      const findMatch = await MatchModel.findById(matchId);
      if (!findMatch) {
         return res.status(404).json({ message: "Match not found" });
      }

      const updatedSubscription = await SubscriptionModel.findOneAndUpdate(
         {
            userId: userId,
            "planRestrictions.maxContactShow": { $gt: 0 },
         },
         { $inc: { "planRestrictions.maxContactShow": -1 } },
         { new: true },
      );

      if (!updatedSubscription) {
         return res.status(403).json({
            message: "You have reached your contact viewing limit. Please upgrade your subscription to view more contacts.",
         });
      }

      // 4️⃣ Update match to accepted
      findMatch.showContact = true;

      await findMatch.save();

      res.status(200).json({ message: "Contact Info Unlocked successfully" });
   } catch (error) {
      console.error(error);
      next(error);
   }
};

export const handleGetSingleMatch = async (req, res, next) => {
   try {
      const { userId, matchId } = req.params;

      // 1️⃣ Check if seller exists
      const findBuyer = await BuyerModel.findById(userId);
      if (!findBuyer) {
         return res.status(400).json({ message: "Buyer not found" });
      }

      // 2️⃣ Find the match
      const findMatch = await MatchModel.findById(matchId);
      if (!findMatch) {
         return res.status(404).json({ message: "Match not found" });
      }

      const pipeline = [
         {
            $match: {
               _id: new mongoose.Types.ObjectId(matchId),
               "matchLikedBy.buyerId": new mongoose.Types.ObjectId(userId),
            },
         },
         {
            $lookup: {
               from: "sellers",
               localField: "matchAcceptedBy.sellerId",
               foreignField: "_id",
               as: "seller",
            },
         },
         {
            $unwind: {
               path: "$seller",
               preserveNullAndEmptyArrays: true,
            },
         },
         {
            $lookup: {
               from: "appartments",
               localField: "propertyId",
               foreignField: "_id",
               as: "property",
            },
         },
         {
            $unwind: {
               path: "$property",
               preserveNullAndEmptyArrays: true,
            },
         },
      ];

      const result = await MatchModel.aggregate(pipeline);

      if (!result.length) {
         return res.status(404).json({ message: "Match Not Found" });
      }

      res.status(200).json({ match: result[0] });
   } catch (error) {
      console.error(error);
      next(error);
   }
};
