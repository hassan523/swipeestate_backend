import { normalizeString } from "./NormalizeString.js";
import mongoose from "mongoose";

const escapeRegex = string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const isNumeric = v => typeof v === "string" && /^\d+(\.\d+)?$/.test(v);

const isValidDateString = v =>
  typeof v === "string" &&
  isNaN(v) &&
  !/^\d+$/.test(v) &&
  !isNaN(new Date(v).getTime());

const buildMatchCondition = (key, value) => {
  // Boolean
  if (value === "true") return { [key]: true };
  if (value === "false") return { [key]: false };

  // ✅ OPERATOR OBJECTS FIRST
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const hasOperator = Object.keys(value).some(k => k.startsWith("$"));

    if (hasOperator) {
      const normalized = {};

      for (const [op, val] of Object.entries(value)) {
        if (isNumeric(val)) {
          normalized[op] = Number(val);
        } else if (isValidDateString(val)) {
          normalized[op] = new Date(val);
        } else {
          normalized[op] = val;
        }
      }

      return { [key]: normalized };
    }

    return { [key]: { $elemMatch: value } };
  }

  // Arrays
  if (Array.isArray(value)) {
    return { [key]: { $in: value } };
  }

  // Numbers
  if (typeof value === "number") {
    return { [key]: value };
  }

  // Dates
  if (value instanceof Date) {
    return { [key]: value };
  }

  // ObjectId
  if (value instanceof mongoose.Types.ObjectId) {
    return { [key]: value };
  }

  // ✅ STRING REGEX LAST
  if (typeof value === "string" && value.trim()) {
    const safeValue = escapeRegex(value.trim());
    return { [key]: { $regex: safeValue, $options: "i" } };
  }

  return null;
};

const SearchQuery = (search = {}) => {
  const matchConditions = [];
  for (const [key, value] of Object.entries(search)) {
    const condition = buildMatchCondition(key, value);
    if (condition) {
      matchConditions.push(condition);
    }
  }
  return matchConditions.length > 0
    ? { $match: { $and: matchConditions } }
    : null;
};

export default SearchQuery;
