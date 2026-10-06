import express from "express";
import { handleAddApartment, handleGetAllApartments, handleGetApartment, handleGetSellerApartments, handleGetSellerSingleApartment, handleUpdateApartment } from "../controllers/ApartmentController.js";
import { CreateUploadMiddleware } from "../middlewares/MulterMiddleware.js";

const router = express.Router();

router.post("/create-apartment/:sellerId", handleAddApartment);

router.patch("/:sellerId/update-property/:propertyId", handleUpdateApartment);

router.get("/:buyerId/property-listing", handleGetApartment);

router.get("/:sellerId/seller-property-listing", handleGetSellerApartments);

router.get("/property-listing", handleGetAllApartments);

router.get("/:sellerId/seller-property/:propertyId", handleGetSellerSingleApartment);

export default router;
