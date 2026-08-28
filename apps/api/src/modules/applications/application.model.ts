import mongoose, { Schema, type Types } from "mongoose";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@naano/shared";

export type ApplicationDoc = {
  campaignId: Types.ObjectId;
  creatorUserId: Types.ObjectId;
  brandUserId: Types.ObjectId;
  pitch: string;
  status: ApplicationStatus;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const applicationSchema = new Schema<ApplicationDoc>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    brandUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pitch: { type: String, required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: "SUBMITTED" },
    decidedAt: Date,
  },
  { timestamps: true },
);

applicationSchema.index({ campaignId: 1, creatorUserId: 1 }, { unique: true });

export const Application = mongoose.model<ApplicationDoc>(
  "Application",
  applicationSchema,
);
