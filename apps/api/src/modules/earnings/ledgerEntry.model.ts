import mongoose, { Schema, type Types } from "mongoose";
import { LEDGER_ENTRY_TYPES, type LedgerEntryType } from "@naano/shared";

export type LedgerEntryDoc = {
  creatorUserId: Types.ObjectId;
  collaborationId: Types.ObjectId;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  note?: string;
  createdAt: Date;
};

const ledgerEntrySchema = new Schema<LedgerEntryDoc>(
  {
    creatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    collaborationId: {
      type: Schema.Types.ObjectId,
      ref: "Collaboration",
      required: true,
      index: true,
    },
    type: { type: String, required: true, enum: LEDGER_ENTRY_TYPES },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    note: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const LedgerEntry = mongoose.model<LedgerEntryDoc>(
  "LedgerEntry",
  ledgerEntrySchema,
);
