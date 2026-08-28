import mongoose, { Schema } from "mongoose";
import { USER_ROLES, type UserRole } from "@naano/shared";

export type UserDoc = {
  email: string;
  name: string;
  role?: UserRole;
  googleId?: string;
  pictureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES },
    googleId: { type: String, sparse: true, unique: true },
    pictureUrl: String,
  },
  { timestamps: true },
);

export const User = mongoose.model<UserDoc>("User", userSchema);
