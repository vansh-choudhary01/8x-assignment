import mongoose, { Schema, type Types } from "mongoose";
import { BRAND_INGESTION_STATUSES, type BrandIngestionStatus } from "@naano/shared";

type CompanyIntelligence = {
  whatTheyDo: string;
  productsServices: string[];
  industry: string;
  targetAudience: string;
  idealCustomerProfile: string;
  valueProposition: string;
  campaignThemes: string[];
  creatorCategories: string[];
  campaignIdeas?: string[];
  creatorRequirements?: string[];
  missing?: string[];
  generatedAt?: Date;
  model?: string;
};

export type BrandProfileDoc = {
  userId: Types.ObjectId;
  companyName?: string;
  websiteUrl: string;
  ingestionStatus: BrandIngestionStatus;
  ingestionError?: string;
  ingestionNotes: string[];
  pageCount: number;
  chunkCount: number;
  lastIngestedAt?: Date;
  analysisStage: string;
  intelligence?: CompanyIntelligence;
  embedding?: number[];
  onboardingCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const brandProfileSchema = new Schema<BrandProfileDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    companyName: String,
    websiteUrl: { type: String, required: true, trim: true },
    ingestionStatus: {
      type: String,
      enum: BRAND_INGESTION_STATUSES,
      default: "IDLE",
    },
    ingestionError: String,
    ingestionNotes: { type: [String], default: [] },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    lastIngestedAt: Date,
    analysisStage: { type: String, default: "idle" },
    intelligence: {
      whatTheyDo: String,
      productsServices: [String],
      industry: String,
      targetAudience: String,
      idealCustomerProfile: String,
      valueProposition: String,
      campaignThemes: [String],
      creatorCategories: [String],
      campaignIdeas: [String],
      creatorRequirements: [String],
      missing: [String],
      generatedAt: Date,
      model: String,
    },
    embedding: { type: [Number], default: undefined },
    onboardingCompletedAt: Date,
  },
  { timestamps: true },
);

export const BrandProfile = mongoose.model<BrandProfileDoc>(
  "BrandProfile",
  brandProfileSchema,
);
