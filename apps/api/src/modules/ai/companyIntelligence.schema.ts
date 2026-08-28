import { z } from "zod";

const looseScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

function stringList() {
  return z
    .union([z.array(looseScalar), looseScalar])
    .optional()
    .transform((value) => {
      const items = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
      return items.map((item) => String(item).trim()).filter(Boolean).slice(0, 16);
    });
}

function textField() {
  return looseScalar.optional().transform((value) => (value == null ? "" : String(value).trim()));
}

const rawSchema = z
  .object({
    whatTheyDo: textField(),
    summary: textField(),
    description: textField(),
    companySummary: textField(),
    productsServices: stringList(),
    products: stringList(),
    services: stringList(),
    industry: textField(),
    targetAudience: textField(),
    idealCustomerProfile: textField(),
    valueProposition: textField(),
    campaignThemes: stringList(),
    creatorCategories: stringList(),
    campaignIdeas: stringList(),
    creatorRequirements: stringList(),
    missing: stringList(),
    companyName: textField(),
  })
  .passthrough();

export const companyIntelligenceSchema = rawSchema.transform((value) => {
  const whatTheyDo = [value.whatTheyDo, value.summary, value.description, value.companySummary]
    .map((item) => (item ?? "").trim())
    .find(Boolean);
  if (!whatTheyDo) {
    throw new Error("Model JSON did not include a company description");
  }
  const productsServices = [
    ...value.productsServices,
    ...value.products,
    ...value.services,
  ].filter(Boolean);
  return {
    whatTheyDo,
    productsServices: [...new Set(productsServices)].slice(0, 16),
    industry: value.industry.trim(),
    targetAudience: value.targetAudience.trim(),
    idealCustomerProfile: value.idealCustomerProfile.trim(),
    valueProposition: value.valueProposition.trim(),
    campaignThemes: value.campaignThemes,
    creatorCategories: value.creatorCategories,
    campaignIdeas: value.campaignIdeas,
    creatorRequirements: value.creatorRequirements,
    missing: value.missing,
    companyName: value.companyName.trim(),
  };
});

export type CompanyIntelligenceParsed = z.infer<typeof companyIntelligenceSchema>;
