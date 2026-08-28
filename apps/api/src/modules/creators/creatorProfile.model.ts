import mongoose, { Schema, type Types } from "mongoose";
import {
  CREATOR_INGESTION_STATUSES,
  ENRICHMENT_STATUSES,
  type CreatorIngestionStatus,
  type EnrichmentStatus,
  type InsightFieldOrigin,
  type PricingConfidence,
} from "@naano/shared";

export type CreatorInsights = {
  expertise: string[];
  industries: string[];
  contentTopics: string[];
  audienceType: string;
  positioning: string;
  brandCategoryFit: string[];
  notes: string[];
  cardCopy?: string;
  derivedHeadline?: string;
  creatorCategory?: string;
  contentThemes?: string[];
  campaignRecommendations?: string[];
  missing?: string[];
  pricingRecommendation?: {
    suggestedPrice: number | null;
    currency: string;
    basis: string;
    confidence: PricingConfidence;
  };
  fieldOrigins?: Partial<
    Record<
      | "name"
      | "headline"
      | "about"
      | "location"
      | "company"
      | "role"
      | "education"
      | "followers"
      | "image"
      | "positioning"
      | "industries"
      | "audience",
      InsightFieldOrigin
    >
  >;
  generatedAt?: Date;
  model?: string;
};

export type CreatorProfileDoc = {
  userId: Types.ObjectId;
  linkedInUrl?: string;
  headline?: string;
  bio?: string;
  industries: string[];
  topics: string[];
  positioning?: string;
  pricePerPost?: number;
  currency: string;
  followerCount?: number;
  audienceSummary?: string;
  publicName?: string;
  publicLocation?: string;
  currentCompany?: string;
  currentRole?: string;
  education?: string;
  followerCountRaw?: string;
  connectionCountRaw?: string;
  extractedSkills: string[];
  publicFound: string[];
  publicMissing: string[];
  publicTitle?: string;
  publicDescription?: string;
  publicImageUrl?: string;
  publicPostUrl?: string;
  xUrl?: string;
  xUsername?: string;
  socialSource?: string;
  analysisStage: string;
  ingestionStatus: CreatorIngestionStatus;
  ingestionError?: string;
  ingestionNotes: string[];
  lastIngestedAt?: Date;
  enrichmentStatus: EnrichmentStatus;
  insights?: CreatorInsights;
  embedding?: number[];
  onboardingCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const creatorProfileSchema = new Schema<CreatorProfileDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    linkedInUrl: { type: String, trim: true },
    headline: String,
    bio: String,
    industries: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    positioning: String,
    pricePerPost: Number,
    currency: { type: String, default: "USD" },
    followerCount: Number,
    audienceSummary: String,
    publicName: String,
    publicLocation: String,
    currentCompany: String,
    currentRole: String,
    education: String,
    followerCountRaw: String,
    connectionCountRaw: String,
    extractedSkills: { type: [String], default: [] },
    publicFound: { type: [String], default: [] },
    publicMissing: { type: [String], default: [] },
    publicTitle: String,
    publicDescription: String,
    publicImageUrl: String,
    publicPostUrl: String,
    xUrl: String,
    xUsername: String,
    socialSource: String,
    analysisStage: { type: String, default: "idle" },
    ingestionStatus: {
      type: String,
      enum: CREATOR_INGESTION_STATUSES,
      default: "IDLE",
    },
    ingestionError: String,
    ingestionNotes: { type: [String], default: [] },
    lastIngestedAt: Date,
    enrichmentStatus: {
      type: String,
      enum: ENRICHMENT_STATUSES,
      default: "IDLE",
    },
    insights: {
      expertise: [String],
      industries: [String],
      contentTopics: [String],
      audienceType: String,
      positioning: String,
      brandCategoryFit: [String],
      notes: [String],
      cardCopy: String,
      derivedHeadline: String,
      creatorCategory: String,
      contentThemes: [String],
      campaignRecommendations: [String],
      missing: [String],
      pricingRecommendation: {
        suggestedPrice: Number,
        currency: String,
        basis: String,
        confidence: String,
      },
      fieldOrigins: Schema.Types.Mixed,
      generatedAt: Date,
      model: String,
    },
    embedding: { type: [Number], default: undefined },
    onboardingCompletedAt: Date,
  },
  { timestamps: true },
);

export const CreatorProfile = mongoose.model<CreatorProfileDoc>(
  "CreatorProfile",
  creatorProfileSchema,
);
