# NexaChat

NexaChat is a mobile-first messaging and productivity workspace built with Next.js App Router, TypeScript, React, Tailwind, Radix UI, Zustand, TanStack Query, Supabase, the AI SDK, and Serwist. The app runs in demo mode without external credentials; Supabase-backed auth, persistence, realtime, protected uploads, AI, wallets, and push APIs activate when their server configuration is supplied.

## Run locally

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>. With no Supabase credentials, the interface uses a local demo workspace and API routes return explicit `*_NOT_CONFIGURED` errors instead of silently pretending that remote writes succeeded.

## Supabase setup

The included `supabase/config.toml` and ordered SQL migrations create the public schema, auth profile trigger, RLS policies, private `chat-media` bucket, message/task/wallet functions, and Realtime publication entries.

For local Supabase development:

```bash
supabase start
supabase db reset
supabase status
```

For a hosted project, configure the project URL/keys in `.env.local`, set the Auth Site URL and allowed redirects, then link and apply the migrations:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Never commit `.env.local`, a Supabase service-role key, an OpenAI key, an Upstash token, a OneSignal REST key, or the cron secret. The browser must only receive the Supabase anon/publishable key. The service-role key is used only by the protected cron and push server handlers.

### Configuration

| Variable | Needed for | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase browser and server clients | Public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | RLS-authenticated browser/server clients | Public anon key; RLS is mandatory |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron and trusted push recipient lookups | Server only |
| `NEXT_PUBLIC_APP_URL` | Auth redirects and same-origin fallback | Public URL |
| `OPENAI_API_KEY` | AI routes | Server only |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Distributed per-user rate limiting | Server only |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | Push delivery | REST key server only |
| `CRON_SECRET` | Scheduled-message/self-destruct endpoint | Server only; use a long random value |

The rate limiter uses Upstash when configured and a bounded in-memory fallback otherwise. The fallback is suitable for development only; multi-instance production deployments should configure Redis.

## Implemented server routes

All user-scoped routes require a valid Supabase session, validate request bodies, enforce same-origin checks on mutations, and use RLS. API JSON errors include stable `code` values.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/conversations` | `POST` | Atomically create a direct chat, group, channel, or saved-messages conversation |
| `/api/messages/send` | `POST` | Send a text or validated attachment message; accepts JSON or multipart form data |
| `/api/messages/read` | `POST` | Update the caller's read cursor and message receipts |
| `/api/messages/search` | `GET` | Search only messages visible under RLS |
| `/api/messages/schedule` | `GET`, `POST` | List and schedule future text messages |
| `/api/messages/schedule/[scheduleId]` | `DELETE` | Cancel an unsent scheduled message |
| `/api/media/presign` | `POST` | Create a user-folder-scoped signed upload |
| `/api/media/complete` | `POST` | Validate a signed upload, create a thumbnail, and record metadata |
| `/api/media/upload` | `POST` | Validate, thumbnail, and persist a multipart upload |
| `/api/media/[mediaId]/url` | `GET` | Return short-lived signed read URLs after an RLS check |
| `/api/ai/chat` | `POST` | Stream an authenticated Nexa AI response |
| `/api/ai/summarize` | `POST` | Summarize text supplied by the caller |
| `/api/ai/translate` | `POST` | Translate text without mutating the source message |
| `/api/ai/smart-reply` | `POST` | Return draft reply suggestions; never auto-sends them |
| `/api/ai/extract-task` | `POST` | Extract a task candidate and save only when explicitly requested |
| `/api/tasks` | `GET`, `POST` | List visible tasks and create a task |
| `/api/tasks/[taskId]` | `PATCH`, `DELETE` | Update or delete a task allowed by RLS |
| `/api/wallet/balance` | `GET` | Read the caller's wallet and recent transactions, excluding the PIN hash |
| `/api/wallet/pin` | `POST` | Set a one-time bcrypt-hashed wallet PIN |
| `/api/wallet/transfer` | `POST` | Perform an atomic, idempotent wallet transfer with database PIN verification |
| `/api/notifications` | `GET` | List the caller's notifications |
| `/api/notifications/[notificationId]` | `PATCH` | Mark an owned notification read/unread |
| `/api/notifications/push` | `POST` | Send a generic, privacy-preserving push to eligible conversation members |
| `/api/cron/process-messages` | `POST` | Process due messages and self-destruct cleanup with `Authorization: Bearer $CRON_SECRET` |

Configure a trusted scheduler (for example, a platform cron) to call `/api/cron/process-messages` every minute. The function processes due rows with `FOR UPDATE SKIP LOCKED`, so concurrent workers do not double-send a scheduled row.

### Upload and storage behavior

The `chat-media` bucket is private with a 100 MiB cap and a MIME allowlist. Upload handlers reject SVG/HTML, check file signatures, decode images with Sharp, limit decoded image pixels, and generate WebP thumbnails. Object names are random and scoped to the authenticated user's UUID folder. A private object is not readable by other conversation members until an RLS-visible `media` record links it to a message; read URLs expire after one minute.

## Database and security

- Supabase Auth remains the identity/password system; NexaChat does not store password hashes in `public.users`.
- RLS is enabled for all app tables. Conversation access is checked by security-definer helper functions, and conversation membership is required for message reads/writes.
- Private account fields (`email`, `phone`, push tokens, and wallet `pin_hash`) are not selectable by other users. The wallet PIN hash is excluded even from the owner's normal wallet query.
- Read/write APIs use Zod validation, per-user rate limits, generic provider errors, and same-origin checks for browser mutations.
- AI logs store model/action/token counts/latency, not prompts or response text.
- Push alerts use generic text by default; chat content is not placed in notification previews.
- Scheduled jobs use a dedicated constant-time checked cron secret; the service-role client is isolated to trusted server handlers.

## Realtime and offline behavior

The client hydrates the authenticated user's conversations, recent messages, profiles, media URLs, and tasks from Supabase, then subscribes to message and membership changes. The local demo workspace remains available without Supabase. When authenticated, the remote workspace is excluded from the shared Zustand `localStorage` snapshot; a per-current-user IndexedDB cache and ordered outbox support offline reads and message retries. The outbox retains UUIDs for idempotent sends and discards entries when the signed-in account changes.

Serwist builds the service worker from `src/app/sw.ts`; the generated `public/sw.js` and Workbox output are ignored build artifacts. Median bridge helpers are kept client-side and can link OneSignal registration IDs to the signed-in user's private profile fields.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Unit tests cover upload MIME/signature handling, private object key generation, and mutation origin validation. `npm run test:e2e` is available for Playwright once browser binaries and end-to-end scenarios are configured.

## Production readiness notes

This repository includes the protected database/API foundation and a functional demo UX, but a deployment still needs its own Supabase project, OpenAI key, distributed rate-limit store, OneSignal credentials, cron schedule, and provider configuration. Messages currently use Supabase TLS/RLS and private storage; `encryption_pub` is only a schema field and **end-to-end message encryption is not implemented**. Wallet transfers are internal ledger transfers, not a real-money payment integration. Calls, contact-book sync, task reminders, malware scanning, and a complete browser E2E suite also require additional provider/product work before claiming full production readiness.
