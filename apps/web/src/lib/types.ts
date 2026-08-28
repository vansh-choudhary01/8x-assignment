import type {
  ApplicationStatus,
  BrandIngestionStatus,
  CampaignStatus,
  CollaborationStatus,
  CreatorIngestionStatus,
  EnrichmentStatus,
  InsightFieldOrigin,
  PricingConfidence,
} from "@naano/shared";

type CreatorInsights = {
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
  generatedAt?: string;
  model?: string;
};

export type CreatorProfile = {
  id: string;
  userId?: string;
  name: string;
  accountName?: string;
  linkedInUrl?: string;
  xUrl?: string;
  xUsername?: string;
  publicPostUrl?: string;
  headline: string;
  bio: string;
  location: string;
  industries: string[];
  topics: string[];
  positioning: string;
  pricePerPost: number | null;
  currency: string;
  audienceSummary: string;
  publicName: string;
  publicLocation: string;
  currentCompany: string;
  currentRole: string;
  education: string;
  followerCount: number | null;
  followerCountRaw: string;
  connectionCountRaw: string;
  extractedSkills: string[];
  publicFound: string[];
  publicMissing: string[];
  publicTitle: string;
  publicDescription: string;
  publicImageUrl: string;
  ingestionStatus: CreatorIngestionStatus;
  ingestionError: string;
  ingestionNotes: string[];
  lastIngestedAt: string | null;
  enrichmentStatus: EnrichmentStatus;
  analysisStage?: string;
  socialSource?: string;
  insights: CreatorInsights | null;
  hasEmbedding: boolean;
  onboardingCompletedAt: string | null;
  updatedAt: string;
};

type BrandIntelligence = {
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
  generatedAt?: string;
  model?: string;
};

export type BrandProfile = {
  id: string;
  companyName: string;
  websiteUrl: string;
  ingestionStatus: BrandIngestionStatus;
  ingestionError: string;
  ingestionNotes: string[];
  pageCount: number;
  chunkCount: number;
  lastIngestedAt: string | null;
  intelligence: BrandIntelligence | null;
  analysisStage?: string;
  hasEmbedding: boolean;
  onboardingCompletedAt: string | null;
  updatedAt: string;
};

export type Campaign = {
  id: string;
  brandUserId: string;
  brandName: string;
  title: string;
  description: string;
  goal: string;
  targetAudience: string;
  industry: string;
  platform: string;
  budget: number | null;
  pricePerPost: number | null;
  currency: string;
  deliverables: string[];
  requirements: string;
  deadline: string | null;
  landingUrl: string;
  status: CampaignStatus;
  createdAt: string;
};

export type Collaboration = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  creatorName: string;
  creatorUserId: string;
  status: CollaborationStatus;
  amount: number;
  currency: string;
  contentUrl: string;
  contentNotes: string;
  publishedUrl: string;
  trackingUrl: string;
  pixelUrl: string;
  createdAt: string;
};

export type ApplicationListItem = {
  id: string;
  campaignId: string;
  status: ApplicationStatus;
  campaignTitle?: string;
  collaborationId?: string | null;
};
