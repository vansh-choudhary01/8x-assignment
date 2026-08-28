# Setup

Prerequisites: **Node.js 20+**, **npm**, **Docker** (for local MongoDB and Redis). A Google Cloud OAuth web client is required to sign in. OpenAI is optional until you need enrichment, matching embeddings, or Ask Naano.

## 1. Environment

```bash
cp .env.example .env
```

The API loads **repo-root** `.env` (`apps/api/src/config.ts`).

| Variable | Notes |
| --- | --- |
| `PORT` | API listen port. Default `4000`. |
| `CLIENT_ORIGIN` | CORS + post-login redirects. Default `http://localhost:5173`. |
| `JWT_SECRET` | Signs the session cookie. Change it. |
| `JWT_EXPIRES_IN` | Default `7d`. |
| `MONGODB_URI` | If unset, `mongodb://127.0.0.1:27017/naano`. **Do not leave the Atlas placeholder from `.env.example` if you are using Docker.** |
| `REDIS_URL` | Default `redis://127.0.0.1:6379`. Required for ingestion jobs. |
| `INGEST_USER_AGENT` | Public fetch User-Agent. |
| `OPENAI_API_KEY` | Optional. Without it, fetches still store text; cards/intelligence/Ask Naano will not enrich. |
| `OPENAI_MODEL` | Default `gpt-4.1-mini`. |
| `OPENAI_EMBEDDING_MODEL` | Default `text-embedding-3-small`. |
| `GOOGLE_CLIENT_ID` | Required for Continue with Google. |
| `GOOGLE_CLIENT_SECRET` | Required. |
| `GOOGLE_REDIRECT_URI` | Must match Google Cloud exactly. Default `http://localhost:5173/api/auth/google/callback`. |

Google Cloud: create an OAuth **Web** client. Authorized JavaScript origin `http://localhost:5173`. Authorized redirect URI = `GOOGLE_REDIRECT_URI` above (Vite proxies `/api` to the API, so the browser hits `:5173`).

## 2. MongoDB and Redis

Local:

```bash
docker compose up -d
```

That publishes MongoDB `27017` and Redis `6379` with named volumes. Set `MONGODB_URI=mongodb://127.0.0.1:27017/naano`.

Or point `MONGODB_URI` at Atlas (`mongodb+srv://…`) and still run Redis locally (or a hosted Redis URL).

## 3. Install and start

From the repo root:

```bash
npm install
npm run dev:api
npm run dev:web
```

`dev:api` (`tsx watch`) connects Mongo, Redis, **starts the ingestion worker in-process**, then serves HTTP. There is no separate worker script.

`npm run dev` starts both, but two terminals are easier to read.

| URL | What |
| --- | --- |
| http://localhost:5173 | Web |
| http://localhost:4000/api/health | `{ ok, mongo, redis }` |
| http://localhost:5173/api/auth/google | Sign-in (proxied) |
| http://localhost:5173/t/:token | Tracking redirect (proxied) |
| http://localhost:5173/p/:token | Tracking pixel (proxied) |

## 4. First use

1. Open the web app → Continue with Google.
2. Choose Brand or Creator (permanent).
3. Brand: paste a public website and wait for ingest. Creator: paste public LinkedIn and/or X URLs.
4. Confirm the drafted intelligence / Creator Card, then the workspace.

## Common issues

**Google button disabled / redirect error.** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty, or redirect URI not exactly `http://localhost:5173/api/auth/google/callback`.

**`/api/health` mongo false.** Docker Mongo not up, or `.env` still has the Atlas placeholder and Atlas is unreachable. Use `mongodb://127.0.0.1:27017/naano` for Compose.

**Ingest stays queued / jobs fail.** Redis down. API still boots (`Redis is not reachable yet`); BullMQ will fail until `REDIS_URL` works. Check `docker compose ps`.

**Creator card has no LinkedIn fields / HTTP 999.** Guest LinkedIn `/in/` pages are often blocked. Add an X URL or a public `/posts/` URL; one source can succeed without the other.

**AI / matching / Ask Naano missing.** No `OPENAI_API_KEY`, invalid key, or model name your account cannot use. Raw ingest still saves.

**CORS / not logged in after Google.** `CLIENT_ORIGIN` must be the origin you open in the browser (`http://localhost:5173`). Cookie is httpOnly `token`, `sameSite=lax`.

**Port in use.** Change `PORT` or stop the other process on 4000 / 5173.
