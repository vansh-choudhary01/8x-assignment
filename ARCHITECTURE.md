# Architecture

Naano is an npm workspace: `apps/web` (Vite React SPA), `apps/api` (Express), `packages/shared` (roles, statuses, event types). The API process also starts the BullMQ ingestion worker. There is no separate worker command.

Data on screen is MongoDB plus fetches of public pages. AI only enriches or drafts from that stored source; it does not invent marketplace rows.

## Frontend

`apps/web` talks to `/api/*` on the same origin. Vite proxies `/api`, `/t`, and `/p` to `http://localhost:4000`.

| Area | Routes |
| --- | --- |
| Public | `/`, `/login` (`/signup` redirects to login) |
| After Google | `/choose-role` if `role` is unset |
| Creator | `/creator/onboarding`, then `/creator` (home, card, opportunities, collaborations, messages, analytics, earnings) |
| Brand | `/brand/onboarding`, then `/brand` (home, campaigns, creators, collaborations, messages, analytics) |

`RequireAuth` + `OnboardingGate` keep unfinished profiles on onboarding. `NaanoAsk` is a slide-over on every page. Session is the `token` cookie (`credentials: include`).

## Backend

`apps/api/src/index.ts` connects MongoDB, connects Redis, starts the ingestion worker, then listens on `PORT` (default 4000).

Routers in `app.ts`:

| Prefix | Auth |
| --- | --- |
| `GET /api/health` | Public |
| `GET /t/:token`, `GET /p/:token` | Public (tracking) |
| `/api/auth` | Mixed |
| `/api/creators` | Creator |
| `/api/brands` | Brand |
| `/api/marketplace` | Brand |
| `/api/campaigns` | Settled role |
| `/api/applications` | Settled role |
| `/api/collaborations` | Settled role |
| `/api/workspace` | Settled role (analytics; earnings is creator-only) |
| `/api/ai` | Settled role |

Bodies are validated with Zod. Errors are JSON `{ error: { code, message } }`.

## Auth

Google OAuth only. `GET /api/auth/google` redirects to Google. Callback is `GOOGLE_REDIRECT_URI` (default `http://localhost:5173/api/auth/google/callback`, proxied to the API). The API upserts `User` by `googleId` / email, sets an httpOnly `token` JWT (`sameSite=lax`), and redirects into the app.

`POST /api/auth/role` sets `BRAND` or `CREATOR` once. `GET /api/auth/me` returns the user and `needsRole`. `POST /api/auth/logout` clears the cookie.

No email/password, no LinkedIn OAuth.

## MongoDB models

| Collection | Role |
| --- | --- |
| `User` | Google identity, optional `role` |
| `CreatorProfile` | Public fields, ingest/enrichment status, insights, embedding |
| `BrandProfile` | Website, ingest status, company intelligence, embedding |
| `SourceDocument` | Fetched page text (`WEBSITE_PAGE` or `CREATOR_PROFILE`) |
| `DocumentChunk` | Chunks of source text (optional embeddings) |
| `Campaign` | Brief, optional `landingUrl`, `pricePerPost`, embedding |
| `Application` | Unique per campaign+creator; pitch + status |
| `Collaboration` | One per accepted application; content URLs; amount |
| `Conversation` / `Message` | One thread per collaboration |
| `TrackingLink` | Token → destination URL, keyed to collaboration/campaign/creator |
| `AnalyticsEvent` | Typed events with optional IDs and metadata |
| `LedgerEntry` | `PENDING` / `EARNED` / `VOIDED` / `RELEASED` (UI sums pending/earned/voided) |
| `AiConversation` / `AiMessage` | Ask Naano history |
| `AiPendingAction` | Write tools waiting for confirm/cancel |

## Ingestion and queues

`PUT /api/creators/me` or `PUT /api/brands/me` queues a BullMQ job (`ingestion` queue, Redis). Retry: 3 attempts, exponential backoff.

Worker (`infrastructure/queue/worker.ts`, concurrency 2):

1. **Creator** — Composite provider fetches public LinkedIn and/or X in parallel. If one source is blocked (common: LinkedIn HTTP 999), the other can still succeed. Results merge into one profile. Raw HTML text is persisted as `SourceDocument`. If `OPENAI_API_KEY` is set, AI writes `insights` (Creator Card) and an embedding.
2. **Brand** — Same-site crawl, max **8** pages, Cheerio extract. Pages stored as `SourceDocument` + chunks. AI drafts `intelligence` when OpenAI is configured.

The UI polls `GET .../me` until status is no longer queued/running. `POST .../me/complete` marks onboarding done after the creator/brand confirms.

## Matching

Onboarded creators only.

- `GET /api/campaigns/:id/matches` — `rankCreatorsForCampaign`: industry/topic/audience/price overlap plus cosine of stored embeddings. Each row has a `score` and `reasons`.
- `POST /api/ai/search/creators` — natural-language search over stored cards (embeddings when OpenAI is available, otherwise text overlap).

## Campaigns and applications

Brands `POST /api/campaigns` (default status `OPEN`). Creators `GET /api/campaigns` as open/`IN_PROGRESS` campaigns.

- Creator apply: `POST /api/applications/campaign/:id` with a pitch.
- Brand invite: `POST /api/applications/campaign/:id/invite`.
- Brand accept/reject; creator `accept-invite`.

Accepting creates a `Collaboration`, a `Conversation`, a `PENDING` ledger row, optional tracking link, and moves the campaign to `IN_PROGRESS`.

## Collaborations and messaging

Allowed transitions:

- Creator: `ACCEPTED` → `CONTENT_SUBMITTED` (content URL + optional notes); `APPROVED` → `PUBLISHED` (published post URL).
- Brand: `CONTENT_SUBMITTED` → `APPROVED` or `CANCELLED`; `PUBLISHED` → `COMPLETED`; `ACCEPTED` → `CANCELLED`.

`GET/POST /api/collaborations/:id/messages` is the thread. `POST /api/ai/drafts/reply` fills the composer; sending is always the message POST.

Cancel writes `VOIDED`. Complete writes `EARNED` and may mark the campaign `COMPLETED` if no other open collabs remain.

## Tracking, analytics, earnings

When a collaboration opens (and a campaign `landingUrl` or brand `websiteUrl` exists), `ensureTrackingLink` stores a token. Destination is the landing URL, else the brand website — not the LinkedIn post.

- `GET /t/:token` — record `TRACKING_CLICK`, 302 to destination.
- `GET /p/:token` — same click via 1×1 GIF.

Brands `POST /api/collaborations/:id/funnel` with `LEAD`, `PIPELINE`, or `REVENUE` (revenue requires `amount`).

`GET /api/workspace/analytics` counts **stored** events (funnel + breakdown by creator/campaign/post/link). Empty means nothing recorded.

`GET /api/workspace/earnings` (creator) rolls up ledger rows per collaboration.

## Ask Naano

`POST /api/ai/turn` with page context (`path`, optional ids). The model may call tools over live Mongo:

- **Read:** profile, campaigns, collabs, messages, analytics, earnings, applications, creator search/list, matches, drafts.
- **Write (confirm in UI):** create campaign, apply, invite, accept/reject, send message, update creator card, transition collab, record funnel.

`POST /api/ai/actions/:id/confirm` or `/cancel`. Dedicated draft endpoints (`/api/ai/drafts/campaign|application|reply`) return JSON for forms/composers and do not send or publish by themselves.
