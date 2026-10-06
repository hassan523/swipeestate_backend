import mongoose from "mongoose";
const { Schema } = mongoose;

const ApartmentSchema = new Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sellers"
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ["Rent", "Sale"],
        required: true,
    },
    location: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    area: {
        type: Number,
        required: true,
        min: 0,
    },
    bedrooms: {
        type: Number,
        required: true,
        min: 0,
    },
    bathrooms: {
        type: Number,
        required: true,
        min: 0,
    },
    floor: {
        type: Number,
        min: 0,
    },
    furnished: {
        type: String,
        enum: ["Furnished", "Semi-Furnished", "Unfurnished"],
        default: "Unfurnished",
    },
    balcony: {
        type: Boolean,
        default: false,
    },
    parking: {
        type: Boolean,
        default: false,
    },
    amenities: {
        type: [String],
        default: [],
    },
    availability: {
        type: String,
        enum: ["Available", "Sold", "Rented"],
        default: "Available",
    },
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Inactive",
    },
    image: {
        type: String,
        default: '',
    },
    featuredImages: {
        type: [String],
        default: [],
    },
    featured: {
        type: Boolean,
        default: false,
    },
    description: {
        type: String,
        trim: true,
    },
    proof_of_ownership: {
        type: String,
        default: ""
    }
}, {
    timestamps: true,
});
const ApartmentModel = mongoose.model("appartments", ApartmentSchema);
export default ApartmentModel;
