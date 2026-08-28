import mongoose, { Schema, type Types } from "mongoose";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "@naano/shared";

export type CampaignDoc = {
  brandUserId: Types.ObjectId;
  title: string;
  description: string;
  goal: string;
  targetAudience: string;
  industry: string;
  platform: string;
  budget?: number;
  pricePerPost?: number;
  currency: string;
  deliverables: string[];
  requirements: string;
    deadline?: Date;
    landingUrl?: string;
    status: CampaignStatus;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
};

const campaignSchema = new Schema<CampaignDoc>(
  {
    brandUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    goal: { type: String, required: true },
    targetAudience: { type: String, required: true },
    industry: { type: String, required: true },
    platform: { type: String, default: "LinkedIn" },
    budget: Number,
    pricePerPost: Number,
    currency: { type: String, default: "USD" },
    deliverables: { type: [String], default: [] },
    requirements: { type: String, default: "" },
    deadline: Date,
    landingUrl: String,
    status: { type: String, enum: CAMPAIGN_STATUSES, default: "DRAFT" },
    embedding: { type: [Number], default: undefined },
  },
  { timestamps: true },
);

export const Campaign = mongoose.model<CampaignDoc>("Campaign", campaignSchema);
