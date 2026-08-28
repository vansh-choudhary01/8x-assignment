import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { BrandGate, CreatorGate } from "@/components/OnboardingGate";
import { RequireAuth } from "@/components/RequireAuth";
import { AuthProvider } from "@/lib/auth";
import { AnalyticsPage, EarningsPage } from "@/pages/creator/Analytics";
import { CollaborationDetailPage, CollaborationsPage, MessagesPage } from "@/pages/creator/Collaborations";
import { CreatorCardPage } from "@/pages/creator/Card";
import { CreatorDashboardPage } from "@/pages/creator/Dashboard";
import { OpportunitiesPage, OpportunityDetailPage } from "@/pages/creator/Opportunities";
import { BrandDashboardPage } from "@/pages/brand/Dashboard";
import { CampaignDetailPage, CampaignNewPage, CampaignsPage } from "@/pages/brand/Campaigns";
import { BrandCreatorDetailPage, BrandCreatorsPage } from "@/pages/brand/Creators";
import { BrandHomePage } from "@/pages/BrandHome";
import { CreatorHomePage } from "@/pages/CreatorHome";
import { LandingPage } from "@/pages/Landing";
import { LoginPage } from "@/pages/Login";
import { ChooseRolePage } from "@/pages/ChooseRole";
import { NaanoAsk } from "@/components/NaanoAsk";

function CreatorWorkspace() {
  return (
    <RequireAuth role="CREATOR">
      <CreatorGate>
        <Outlet />
      </CreatorGate>
    </RequireAuth>
  );
}

function BrandWorkspace() {
  return (
    <RequireAuth role="BRAND">
      <BrandGate>
        <Outlet />
      </BrandGate>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route
            path="/choose-role"
            element={
              <RequireAuth pendingRoleOk>
                <ChooseRolePage />
              </RequireAuth>
            }
          />
          <Route
            path="/creator/onboarding"
            element={
              <RequireAuth role="CREATOR">
                <CreatorHomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/brand/onboarding"
            element={
              <RequireAuth role="BRAND">
                <BrandHomePage />
              </RequireAuth>
            }
          />
          <Route element={<CreatorWorkspace />}>
            <Route path="/creator" element={<CreatorDashboardPage />} />
            <Route path="/creator/card" element={<CreatorCardPage />} />
            <Route path="/creator/opportunities" element={<OpportunitiesPage />} />
            <Route path="/creator/opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="/creator/collaborations" element={<CollaborationsPage />} />
            <Route path="/creator/collaborations/:id" element={<CollaborationDetailPage />} />
            <Route path="/creator/analytics" element={<AnalyticsPage />} />
            <Route path="/creator/earnings" element={<EarningsPage />} />
            <Route path="/creator/messages" element={<MessagesPage />} />
          </Route>
          <Route element={<BrandWorkspace />}>
            <Route path="/brand" element={<BrandDashboardPage />} />
            <Route path="/brand/campaigns" element={<CampaignsPage />} />
            <Route path="/brand/campaigns/new" element={<CampaignNewPage />} />
            <Route path="/brand/campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="/brand/creators" element={<BrandCreatorsPage />} />
            <Route path="/brand/creators/:id" element={<BrandCreatorDetailPage />} />
            <Route path="/brand/collaborations" element={<CollaborationsPage />} />
            <Route path="/brand/collaborations/:id" element={<CollaborationDetailPage />} />
            <Route path="/brand/analytics" element={<AnalyticsPage />} />
            <Route path="/brand/messages" element={<MessagesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NaanoAsk />
      </BrowserRouter>
    </AuthProvider>
  );
}
