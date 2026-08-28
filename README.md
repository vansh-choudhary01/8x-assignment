# Naano

Naano is a B2B creator marketplace. Brands find creators who already speak to their buyers, run sponsored campaigns, and see which posts produced clicks, leads, pipeline, and revenue. Creators turn a real public profile into a card, take on campaigns, and work with brands in one workspace.

The problem it solves: creator campaigns usually live in spreadsheets, DMs, and guesswork. Matching is based on follower counts, briefs are rewritten by hand, and nobody can tie a LinkedIn or X post back to a lead. Naano keeps discovery, briefing, collaboration, and attribution in one product — grounded in pages and events that were actually stored, not mock data.

## What you can do

**Brand.** Sign in with Google, choose Brand, paste a company website. Naano fetches public pages and drafts company intelligence for you to confirm. From the workspace you create a campaign (or ask Naano to draft the brief), search and invite creators with explained match reasons, review applications, message, approve content, and record funnel outcomes.

**Creator.** Sign in with Google, choose Creator, paste a public LinkedIn and/or X URL. Naano fetches what is publicly available (one source can fail and the other still proceeds), then drafts a Creator Card for review. You browse open campaigns, apply or accept invites, submit content, publish, and see performance plus an internal earnings ledger (pending / earned / voided — not a live payout provider).

## Features

- Google-only authentication; role is chosen once
- Website ingest → company intelligence
- Public LinkedIn / X ingest → Creator Card (no social OAuth)
- Campaigns, applications, invites, and a collaboration status flow
- In-thread messaging
- Creator matching with written reasons
- Analytics from stored events only
- Internal creator ledger

## AI

Naano is used where it saves work, not as a chatbot bolted onto every screen: drafting company intelligence and Creator Cards, campaign briefs, application pitches, and collaboration replies (inserted into the composer for you to edit and send). Ask Naano can search creators, explain matches and funnels, and propose actions. Writes that change data require explicit confirmation. Nothing is invented that is not in stored source text or events.

## Tracking and attribution

Each collaboration can get a tracking link aimed at the campaign landing page (or the brand website). Clicks are recorded on redirect. Brands can record lead, pipeline, and revenue against that same creator, campaign, post, and link. Analytics is empty until those events exist.

## Stack

React (Vite) and Express in an npm workspace, MongoDB, Redis + BullMQ for ingest jobs, OpenAI for enrichment and the assistant, Cheerio for public HTML. Shared types live in `packages/shared`.

## Docs

- [Architecture](./ARCHITECTURE.md) — structure, APIs, data flows, ingest, matching, tracking, AI
- [Setup](./SETUP.md) — install, env, Google OAuth, how to run locally

Agent capture lives in `.cursor/hooks/` and `.agent-logs/`. Do not gitignore `.agent-logs/`.
