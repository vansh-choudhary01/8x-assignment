import { PRICING_CONFIDENCES, type PricingConfidence } from "@naano/shared";
import { z } from "zod";

const looseScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

function stringList(max = 12) {
  return z
    .union([z.array(looseScalar), looseScalar])
    .optional()
    .transform((value) => {
      const items = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
      return items.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
    });
}

function text() {
  return z.preprocess((value) => {
    if (value == null) return "";
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
    }
    return String(value).trim();
  }, z.string());
}

const pricingSchema = z
  .object({
    suggestedPrice: z.union([z.number(), z.string()]).optional().nullable(),
    amount: z.union([z.number(), z.string()]).optional().nullable(),
    currency: z.union([z.string(), z.number()]).optional().nullable(),
    basis: z.union([z.string(), z.number()]).optional().nullable(),
    rationale: z.union([z.string(), z.number()]).optional().nullable(),
    confidence: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) {
      return { suggestedPrice: null as number | null, currency: "USD", basis: "", confidence: "none" as const };
    }
    const raw = value.suggestedPrice ?? value.amount;
    const suggestedPrice =
      typeof raw === "number" && raw > 0 ? Math.round(raw) : Number(raw) > 0 ? Math.round(Number(raw)) : null;
    const confidenceRaw = String(value.confidence ?? (suggestedPrice ? "low" : "none"));
    const confidence = (PRICING_CONFIDENCES as readonly string[]).includes(confidenceRaw)
      ? (confidenceRaw as PricingConfidence)
      : ("low" as const);
    return {
      suggestedPrice,
      currency: String(value.currency ?? "USD").slice(0, 8) || "USD",
      basis: String(value.basis ?? value.rationale ?? "").trim(),
      confidence: suggestedPrice ? confidence : ("none" as const),
    };
  });

export const creatorInsightsSchema = z
  .object({
    expertise: stringList(12),
    industries: stringList(12),
    contentTopics: stringList(16),
    audienceType: text(),
    positioning: text(),
    brandCategoryFit: stringList(12),
    notes: stringList(12),
    cardCopy: text(),
    derivedHeadline: text(),
    creatorCategory: text(),
    contentThemes: stringList(12),
    campaignRecommendations: stringList(8),
    missing: stringList(16),
    pricingRecommendation: pricingSchema,
  })
  .passthrough();

export type CreatorInsightsParsed = z.infer<typeof creatorInsightsSchema>;
