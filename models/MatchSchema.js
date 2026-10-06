import mongoose from "mongoose";
const { Schema } = mongoose;

const MatchSchema = new Schema({
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "appartments"
    },
    matchLikedBy: {
        type: {
            buyerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "buyers"
            },
            likedAt: Date
        }
    },
    matchAcceptedBy: {
        type: {
            sellerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "sellers"
            },
            likedAt: Date
        },
        default: null
    },

    rejectedBy: {
        buyerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "buyers"
        },
        rejectedAt: Date
    },

    status: {
        type: String,
        enum: ["Requested", "Matched", "Rejected"],
        default: "Requested"
    }
}, {
    timestamps: true,
});

MatchSchema.index({ "rejectedBy.buyerId": 1 });
MatchSchema.index({ propertyId: 1 });
MatchSchema.index({ "matchLikedBy.buyerId": 1 });
MatchSchema.index({ "matchAcceptedBy.sellerId": 1 });
MatchSchema.index({ status: 1 });


const MatchModel = mongoose.model("matches", MatchSchema);
export default MatchModel;
