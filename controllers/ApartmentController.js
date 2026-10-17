import mongoose from "mongoose";
import ExtractRelativeFilePath from "../middlewares/ExtractRelativePath.js";
import ApartmentModel from "../models/ApartmentSchema.js";
import BuyerModel from "../models/BuyerSchema.js";
import MatchModel from "../models/MatchSchema.js";
import SellerModel from "../models/SellerSchema.js";
import SearchQuery from "../utils/SearchQuery.js";
import { v2 as cloudinary } from "cloudinary";
import SubscriptionModel from "../models/SubscriptionSchema.js";

export const handleAddApartment = async (req, res, next) => {
   try {
      const { sellerId } = req.params;

      const { title, type, location, price, area, bedrooms, bathrooms, floor, furnished, balcony, parking, amenities, availability, featured, description } = req.body;

      const image = req?.files?.image;
      const featuredImages = req?.files?.featuredImages;
      const proof_of_ownership = req?.files?.proof_of_ownership;

      if (!image) {
         return res.status(404).json({ message: "image is required" });
      }
      if (!proof_of_ownership) {
         return res.status(404).json({ message: "proof of ownership is required" });
      }

      if (!featuredImages) {
         return res.status(400).json({
            message: "At least 1 featured image is required",
         });
      }

      // const extractImage = ExtractRelativeFilePath(image);
      const extractImage = req?.files?.image;
      const uploadResult = extractImage
         ? await cloudinary.uploader.upload(extractImage.tempFilePath, {
              resource_type: "image",
           })
         : "";
      const extract_proof_of_ownership = req?.files?.proof_of_ownership;
      const ownershipResult = extract_proof_of_ownership
         ? await cloudinary.uploader.upload(extract_proof_of_ownership.tempFilePath, {
              resource_type: "image",
           })
         : "";

      const extractFeaturedImage = req?.files?.featuredImages;

      const featuredImagesArray = Array.isArray(extractFeaturedImage) ? extractFeaturedImage : [extractFeaturedImage];

      const imageUrls = [];

      // if (Array.isArray(featuredImagesArray)) {
      //    for (const image of featuredImagesArray) {
      //       const galleryUploadResult = await cloudinary.uploader.upload(image?.tempFilePath);
      //       imageUrls.push(galleryUploadResult.secure_url);
      //    }
      // } else if (extractFeaturedImage) {
      //    const galleryUploadResult = await cloudinary.uploader.upload(extractFeaturedImage?.tempFilePath);
      //    imageUrls.push(galleryUploadResult.secure_url);
      // }

      for (const image of featuredImagesArray) {
         const galleryUploadResult = await cloudinary.uploader.upload(image.tempFilePath, {
            resource_type: "image",
         });

         imageUrls.push(galleryUploadResult.secure_url);
      }

      const findSeller = await SellerModel.findById(sellerId);
      if (!findSeller) {
         return res.status(404).json({ message: "Seller Not Found" });
      }

      const updatedSubscription = await SubscriptionModel.findOneAndUpdate(
         {
            userId: sellerId,
            "planRestrictions.numberOfUpload": { $gt: 0 },
         },
         { $inc: { "planRestrictions.numberOfUpload": -1 } },
         { new: true },
      );

      if (!updatedSubscription) {
         return res.status(403).json({ message: "You have reached your property upload limit. Please upgrade your subscription to upload more properties." });
      }

      const createListing = new ApartmentModel({
         sellerId: sellerId,
         title,
         type,
         location,
         price,
         area,
         bedrooms,
         bathrooms,
         floor,
         furnished,
         balcony,
         parking,
         amenities,
         availability,
         featured,
         description,
         image: uploadResult.secure_url,
         featuredImages: imageUrls,
         proof_of_ownership: ownershipResult.secure_url,
      });
      await createListing.save();

      res.status(200).json({ message: "Apartment Has Been Listed Successfully" });
   } catch (error) {
      console.log(error);
      next(error);
   }
};
export const handleUpdateApartment = async (req, res, next) => {
   try {
      const { sellerId, propertyId } = req.params;

      const findProperty = await ApartmentModel.findOne({
         _id: propertyId,
         sellerId: sellerId,
      });

      if (!findProperty) {
         return res.status(404).json({ message: "Property Not Found" });
      }

      const { title, type, location, price, area, bedrooms, bathrooms, floor, furnished, balcony, parking, amenities, availability, featured, description, status } = req.body;

      // 🔹 Update normal fields (only if sent)
      if (title) findProperty.title = title;
      if (type) findProperty.type = type;
      if (location) findProperty.location = location;
      if (price) findProperty.price = price;
      if (area) findProperty.area = area;
      if (bedrooms) findProperty.bedrooms = bedrooms;
      if (bathrooms) findProperty.bathrooms = bathrooms;
      if (floor !== undefined) findProperty.floor = floor;
      if (furnished) findProperty.furnished = furnished;
      if (balcony !== undefined) findProperty.balcony = balcony;
      if (parking !== undefined) findProperty.parking = parking;
      if (amenities) findProperty.amenities = amenities;
      if (availability) findProperty.availability = availability;
      if (featured !== undefined) findProperty.featured = featured;
      if (description) findProperty.description = description;
      if (status) findProperty.status = status;

      // 🔹 Update main image (optional)
      if (req?.files?.image) {
         const uploadResult = await cloudinary.uploader.upload(req.files.image.tempFilePath, { resource_type: "image" });
         findProperty.image = uploadResult.secure_url;
      }

      // 🔹 Update proof of ownership (optional)
      if (req?.files?.proof_of_ownership) {
         const ownershipResult = await cloudinary.uploader.upload(req.files.proof_of_ownership.tempFilePath, { resource_type: "image" });
         findProperty.proof_of_ownership = ownershipResult.secure_url;
      }

      // 🔹 Update featured images (replace old ones)
      if (req?.files?.featuredImages) {
         const extractFeaturedImages = req.files.featuredImages;
         const imageUrls = [];

         if (Array.isArray(extractFeaturedImages)) {
            for (const img of extractFeaturedImages) {
               const upload = await cloudinary.uploader.upload(img.tempFilePath);
               imageUrls.push(upload.secure_url);
            }
         } else {
            const upload = await cloudinary.uploader.upload(extractFeaturedImages.tempFilePath);
            imageUrls.push(upload.secure_url);
         }

         findProperty.featuredImages = imageUrls;
      }

      await findProperty.save();

      res.status(200).json({
         message: "Apartment Updated Successfully",
         property: findProperty,
      });
   } catch (error) {
      console.log(error);
      next(error);
   }
};
export const handleGetApartment = async (req, res, next) => {
   try {
      const { buyerId } = req.params;

      const findBuyer = await BuyerModel.findById(buyerId);
      if (!findBuyer) {
         return res.status(404).json({ message: "Buyer Not Found" });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const search = req.query.search || {};
      // ✅ force exact match for enum fields
      if (search?.status) {
         search.status = { $eq: search.status };
      }
      const matchStage = SearchQuery(search);

      // 🔹 Get property IDs rejected by this buyer
      const excludedPropertyIds = await MatchModel.distinct("propertyId", {
         $or: [
            {
               "rejectedBy.buyerId": new mongoose.Types.ObjectId(buyerId),
            },
            {
               "matchLikedBy.buyerId": new mongoose.Types.ObjectId(buyerId),
            },
         ],
      });

      const pipeline = [
         {
            $match: {
               _id: { $nin: excludedPropertyIds },
            },
         },

         // 🔹 Lookup seller info
         {
            $lookup: {
               from: "sellers",
               let: { sellerId: "$sellerId" },
               pipeline: [
                  {
                     $match: { $expr: { $eq: ["$_id", "$$sellerId"] } },
                  },
                  {
                     $project: { password: 0, sessions: 0, __v: 0 },
                  },
               ],
               as: "seller",
            },
         },
         {
            $unwind: {
               path: "$seller",
               preserveNullAndEmptyArrays: true,
            },
         },
      ];

      // 🔹 Apply search if exists
      if (matchStage) pipeline.push(matchStage);

      // 🔹 Sorting + pagination
      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      const apartments = await ApartmentModel.aggregate(pipeline);

      // 🔹 Count total items
      const countPipeline = [{ $match: { _id: { $nin: excludedPropertyIds } } }];
      if (matchStage) countPipeline.push(matchStage);
      countPipeline.push({ $count: "totalItems" });

      const countResult = await ApartmentModel.aggregate(countPipeline);
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
         apartments,
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
export const handleGetSellerApartments = async (req, res, next) => {
   try {
      const { sellerId } = req.params;

      const findSeller = await SellerModel.findById(sellerId);
      if (!findSeller) {
         return res.status(404).json({ message: "Seller Not Found" });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const search = req.query.search || {};
      // ✅ force exact match for enum fields
      if (search?.status) {
         search.status = { $eq: search.status };
      }
      const matchStage = SearchQuery(search);

      const pipeline = [
         // 1️⃣ Seller apartments
         {
            $match: {
               sellerId: new mongoose.Types.ObjectId(sellerId),
            },
         },

         // 2️⃣ Lookup matches (TEMP – will be removed later)
         {
            $lookup: {
               from: "matches",
               localField: "_id",
               foreignField: "propertyId",
               as: "matches",
            },
         },

         // 3️⃣ Add match counts
         {
            $addFields: {
               requestedCount: {
                  $size: {
                     $filter: {
                        input: "$matches",
                        as: "m",
                        cond: { $eq: ["$$m.status", "Requested"] },
                     },
                  },
               },
               matchedCount: {
                  $size: {
                     $filter: {
                        input: "$matches",
                        as: "m",
                        cond: { $eq: ["$$m.status", "Matched"] },
                     },
                  },
               },
               rejectedCount: {
                  $size: {
                     $filter: {
                        input: "$matches",
                        as: "m",
                        cond: { $eq: ["$$m.status", "Rejected"] },
                     },
                  },
               },
            },
         },
      ];

      // Optional extra filters (status, date, etc.)
      if (matchStage) pipeline.push(matchStage);

      // 4️⃣ Sorting & pagination
      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // 5️⃣ REMOVE matches array from response
      pipeline.push({
         $project: {
            matches: 0,
         },
      });

      const apartments = await ApartmentModel.aggregate(pipeline);
      // 🔹 Count total items
      const countPipeline = [
         {
            $match: {
               sellerId: new mongoose.Types.ObjectId(sellerId),
            },
         },
      ];
      if (matchStage) countPipeline.push(matchStage);
      countPipeline.push({ $count: "totalItems" });

      const countResult = await ApartmentModel.aggregate(countPipeline);
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
         apartments,
         meta: {
            totalItems,
            totalPages,
            page,
            limit,
         },
      });
   } catch (error) {
      next(error);
   }
};
export const handleGetAllApartments = async (req, res, next) => {
   try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const search = req.query.search || {};
      // ✅ force exact match for enum fields
      if (search?.status) {
         search.status = { $eq: search.status };
      }
      const matchStage = SearchQuery(search);

      const pipeline = [
         // 1️⃣ Seller apartments
         {
            $match: {},
         },

         // 2️⃣ Lookup matches (TEMP – will be removed later)
         {
            $lookup: {
               from: "matches",
               localField: "_id",
               foreignField: "propertyId",
               as: "matches",
            },
         },

         // 3️⃣ Add match counts
         {
            $addFields: {
               requestedCount: {
                  $size: {
                     $filter: {
                        input: "$matches",
                        as: "m",
                        cond: { $eq: ["$$m.status", "Requested"] },
                     },
                  },
               },
               matchedCount: {
                  $size: {
                     $filter: {
                        input: "$matches",
                        as: "m",
                        cond: { $eq: ["$$m.status", "Matched"] },
                     },
                  },
               },
               rejectedCount: {
                  $size: {
                     $filter: {
                        input: "$matches",
                        as: "m",
                        cond: { $eq: ["$$m.status", "Rejected"] },
                     },
                  },
               },
            },
         },
      ];

      // Optional extra filters (status, date, etc.)
      if (matchStage) pipeline.push(matchStage);

      // 4️⃣ Sorting & pagination
      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // 5️⃣ REMOVE matches array from response
      pipeline.push({
         $project: {
            matches: 0,
         },
      });

      const apartments = await ApartmentModel.aggregate(pipeline);
      // 🔹 Count total items
      const countPipeline = [
         {
            $match: {},
         },
      ];
      if (matchStage) countPipeline.push(matchStage);
      countPipeline.push({ $count: "totalItems" });

      const countResult = await ApartmentModel.aggregate(countPipeline);
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
         apartments,
         meta: {
            totalItems,
            totalPages,
            page,
            limit,
         },
      });
   } catch (error) {
      next(error);
   }
};
export const handleGetSellerSingleApartment = async (req, res, next) => {
   try {
      const { sellerId, propertyId } = req.params;

      // 1️⃣ Validate seller
      const findSeller = await SellerModel.findById(sellerId);
      if (!findSeller) {
         return res.status(404).json({ message: "Seller Not Found" });
      }

      const pipeline = [
         {
            $match: {
               _id: new mongoose.Types.ObjectId(propertyId),
               sellerId: new mongoose.Types.ObjectId(sellerId),
            },
         },

         // 2️⃣ Lookup matches
         {
            $lookup: {
               from: "matches",
               localField: "_id",
               foreignField: "propertyId",
               as: "matches",
            },
         },

         // 3️⃣ Lookup buyers (SAFE PROJECTION)
         {
            $lookup: {
               from: "buyers",
               let: { buyerIds: "$matches.matchLikedBy.buyerId" },
               pipeline: [
                  {
                     $match: {
                        $expr: { $in: ["$_id", "$$buyerIds"] },
                     },
                  },
                  {
                     $project: {
                        password: 0,
                        sessions: 0,
                        __v: 0,
                     },
                  },
               ],
               as: "buyers",
            },
         },

         // 4️⃣ Lookup sellers (SAFE PROJECTION)
         {
            $lookup: {
               from: "sellers",
               let: { sellerIds: "$matches.matchAcceptedBy.sellerId" },
               pipeline: [
                  {
                     $match: {
                        $expr: { $in: ["$_id", "$$sellerIds"] },
                     },
                  },
                  {
                     $project: {
                        password: 0,
                        sessions: 0,
                        __v: 0,
                     },
                  },
               ],
               as: "acceptedSellers",
            },
         },

         // 5️⃣ Attach buyer & seller objects into matches
         {
            $addFields: {
               matches: {
                  $map: {
                     input: "$matches",
                     as: "m",
                     in: {
                        _id: "$$m._id",
                        status: "$$m.status",
                        createdAt: "$$m.createdAt",

                        matchLikedBy: {
                           buyer: {
                              $arrayElemAt: [
                                 {
                                    $filter: {
                                       input: "$buyers",
                                       as: "b",
                                       cond: {
                                          $eq: ["$$b._id", "$$m.matchLikedBy.buyerId"],
                                       },
                                    },
                                 },
                                 0,
                              ],
                           },
                           likedAt: "$$m.matchLikedBy.likedAt",
                        },

                        matchAcceptedBy: {
                           seller: {
                              $arrayElemAt: [
                                 {
                                    $filter: {
                                       input: "$acceptedSellers",
                                       as: "s",
                                       cond: {
                                          $eq: ["$$s._id", "$$m.matchAcceptedBy.sellerId"],
                                       },
                                    },
                                 },
                                 0,
                              ],
                           },
                           likedAt: "$$m.matchAcceptedBy.likedAt",
                        },

                        rejectedBy: "$$m.rejectedBy",
                     },
                  },
               },
            },
         },
      ];

      const result = await ApartmentModel.aggregate(pipeline);

      if (!result.length) {
         return res.status(404).json({ message: "Property Not Found" });
      }

      res.status(200).json({
         apartment: result[0],
      });
   } catch (error) {
      next(error);
   }
};
