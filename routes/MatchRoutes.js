import express from "express";
import { handleAcceptMatch, handleGetMatches, handleGetSingleMatch, handleRejectBySellerMatch, handleRejectMatch, handleReqMatch, handleShowContactDetail } from "../controllers/MatchController.js";

const router = express.Router();

router.post("/:userId/match-property/:propertyId", handleReqMatch);

router.get("/:userId/get-matches", handleGetMatches);

router.patch("/:userId/accept-matches/:matchId", handleAcceptMatch);

router.patch("/:userId/reject-matches/:propertyId", handleRejectMatch);

router.patch("/:userId/reject-by-seller-matches/:matchId", handleRejectBySellerMatch);

router.patch("/:userId/unlock-contact/:matchId", handleShowContactDetail);

router.get("/:userId/unlock-contact/:matchId", handleGetSingleMatch);

export default router;
