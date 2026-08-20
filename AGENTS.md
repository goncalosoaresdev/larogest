<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Larogest

Internal ops app for Laro (Portugal): lead pipeline, visits, proposals, contracts, and Pulse (IoT / Casa). Product copy and validation messages are Portuguese (`pt-PT`). Code, identifiers, comments, and this file are English.

Stack: Next.js 16 App Router, React 19, TypeScript (strict), Prisma + PostgreSQL, better-auth, Zod, Tailwind 4, shadcn/ui (`@base-ui/react`). Package manager is npm.

## Commands

```bash
npm run dev              # next dev (default port 3000)
npm run lint
npm run typecheck        # prisma generate + next typegen + tsc --noEmit
npm test                 # tsx --test "src/lib/**/*.test.ts"
npm run db:up            # docker compose postgres:16
npm run db:migrate       # prisma migrate dev
npm run db:seed
npm run db:setup         # first-time migrate + seed
```

Copy `.env.example` to `.env`. Local Postgres: `postgresql://larogest:larogest@localhost:5432/larogest`. Seed login is `SEED_EMAIL` / `SEED_PASSWORD`.

CI (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, and `npm test` without Postgres, then a second job with Postgres for `prisma migrate deploy` and `npm run build`. Unit tests must stay DB-free.

## Layout

| Path | Role |
| --- | --- |
| `src/app/(app)/` | Authenticated staff UI (`/leads`, `/visitas`, `/proposals`, `/contracts`, `/pulse`, `/integracoes`, `/settings`) |
| `src/app/(auth)/login/` | Staff login (email + password) |
| `src/app/p/[token]/`, `src/app/c/[token]/` | Public proposal / contract |
| `src/app/casa/entrar/` | Owner login (email OTP) |
| `src/app/casa/`, `src/app/casa/[siteId]/` | Owner Pulse / Casa PWA (session) |
| `src/app/api/` | Route handlers (`auth`, `casa`, PDF files) |
| `docs/casa-owner-mobile-api.md` | Owner mobile REST spec — point a mobile-app agent at this file |
| `src/app/(app)/**/actions.ts` | `"use server"` mutations |
| `src/components/` | App UI; `src/components/ui/` is shadcn — do not hand-roll duplicates |
| `src/lib/` | Domain logic, validations, Prisma, auth, Pulse, IoT |
| `src/lib/iot/` | Provider adapters (Tuya first). New vendors go here |
| `src/proxy.ts` | Next.js 16 Proxy (not `middleware.ts`) — cookie gate only |
| `prisma/` | Schema and migrations |
| `storage/` | Local PDFs and captured emails in dev; do not commit secrets |

Import with `@/*` → `src/*`.

## Next.js 16

Read bundled docs under `node_modules/next/dist/docs/` before writing framework code. Do not invent APIs from older Next.js.

- Request interception is `src/proxy.ts` with a named `proxy` export. Do not add `middleware.ts`.
- Default to Server Components. Add `"use client"` only for interactivity (forms, charts, live refresh, auth client).
- Server Actions live in colocated `actions.ts` with `"use server"`. Parse `FormData` through Zod schemas in `src/lib/validations.ts`. Call `requireSession()`, mutate with Prisma, `logActivity` where the rest of the module does, then `revalidatePath` / `redirect`.
- Route handlers: `params` is a `Promise` — `const { token } = await params`. Use `jsonOk` / `jsonError` / `limited` from `src/lib/api.ts`. User-facing API errors stay Portuguese.
- `src/proxy.ts` is an optimistic cookie/bearer check, not authorization. Staff pages use `requireSession()` (staff-only); owner pages use `requireOwnerSession()` / `canAccessCasaSite`. APIs: staff `requireApiSession()`, Casa `requireCasaApiSite`. Public prefixes: `/login`, `/p/`, `/c/`, `/casa/entrar`, `/api/auth`, `/api/casa/auth`. Owner mobile APIs accept `Authorization: Bearer <session token>` as well as the cookie.
- Prefer `next/link` and `next/image`. Do not add a Pages Router or a second app root.

## Code style

- Match neighboring files: 2-space indent, double quotes, no semicolons (except the few files that already use them, e.g. `src/lib/utils.ts`).
- Named exports for lib helpers. Keep functions small and pure when they encode rules (money, merge tokens, IoT mapping, alert lanes).
- Comments only for non-obvious constraints. Do not narrate what the code already says.
- Format dates/money with `src/lib/format.ts` (`date-fns` `pt`, `Intl` `pt-PT` / EUR). Human labels for enums live in `src/lib/labels.ts` — do not scatter Portuguese status strings in pages.
- Validate at the boundary with Zod. Do not re-implement schema checks in UI or actions.
- Prisma only through `src/lib/prisma.ts`. Schema changes need a migration (`npm run db:migrate`); do not edit already-applied SQL. Map Prisma enums; do not store magic strings for those fields.
- Email: `src/lib/email.ts` (Cloudflare in production, `storage/emails/` in local dev). Do not add a second mailer.
- PDFs: generate via existing document/PDF helpers; read/write only through `src/lib/storage.ts` (path traversal is rejected).
- New shadcn primitives go in `src/components/ui/` via the existing CLI/config (`components.json`). App-specific widgets stay beside the feature, not inside `ui/`.

## Security

- Never log tokens, OTP codes, VAPID keys, Tuya secrets, or session cookies.
- Proposal / contract public tokens (`/p/`, `/c/`) are unguessable IDs. Casa is session-gated (`/api/casa/[siteId]/*`); rate-limit with `limited`. Do not restore capability URLs on Pulse sites.
- Owner login is email OTP (`src/lib/owner-auth.ts`). Website: `/casa/entrar`. Mobile REST: `POST /api/casa/auth/otp`, `POST /api/casa/auth/verify` (returns a session token), `POST /api/casa/auth/sign-out`, `GET /api/casa`. Only `User.role === "OWNER"` may use those endpoints; staff stay on email + password. Never log OTP codes.
- Do not weaken `src/lib/storage.ts` path checks or serve files outside `storage/pdfs`.
- Auth is better-auth (`src/lib/auth.ts`). Do not add a parallel session store. User roles are `STAFF` | `OWNER`.

## Testing

The suite is Node’s built-in test runner plus `tsx`. Do not add Jest, Vitest, Testing Library, or Playwright unless the task explicitly asks for a new runner.

### Where tests live

Colocate as `*.test.ts` next to the module:

- `src/lib/format.ts` → `src/lib/format.test.ts`
- `src/lib/iot/match.ts` → `src/lib/iot/match.test.ts`

`npm test` is `tsx --test "src/lib/**/*.test.ts"`. Nested lib tests are already included. If you add tests outside that glob, widen the `package.json` `test` script in the same change so CI runs them.

### What to unit-test

Prefer shipped, pure exports in `src/lib/`:

- Zod schemas (`validations.ts`) — valid parse, defaults, and representative failures
- Formatters, merge/template tokens, document snapshot helpers
- Crypto / OTP hashing
- Email address/transport resolution (no network)
- IoT matchers and Tuya status mapping
- Pulse alert lanes / copy
- API helpers (token shape, rate limit, PDF `Content-Disposition`, URL/key checks)
- Owner email / Casa next-path helpers (`owner-auth-core.ts`)

Also add or update tests when you change behavior in those modules. New pure helpers should land with tests in the same PR.

### What not to unit-test here

Do not hit Prisma, PostgreSQL, Tuya, Cloudflare, the filesystem (except asserting path-traversal rejection), or the network. Do not render React trees, drive the browser, or wrap Server Actions / route handlers in an HTTP server.

I/O-heavy modules (`prisma.ts`, `auth.ts`, `casa-notify.ts`, adapters that call Tuya): extract a tiny pure function and test that. Do not mock Prisma to simulate a page load.

### How to write a test

Follow existing files (`src/lib/api.test.ts`, `src/lib/validations.test.ts`, `src/lib/iot/match.test.ts`):

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats EUR in pt-PT", () => {
    assert.equal(formatMoney(18), "18,00 €");
  });
});
```

Rules:

1. Import the real export. Do not copy the implementation into the test or assert against a re-implementation.
2. Use `node:assert/strict` (`equal`, `deepEqual`, `match`, `rejects`, `throws`). No third-party assertion libs.
3. Cover a valid case and the important invalid/edge cases (empty input, bad enum, path traversal, ambiguous IoT match).
4. Assert the function’s actual output, including Portuguese copy when that is the contract (`pulseAlertWork`, Zod issue messages, merge `"—"` placeholders). Do not hardcode blobs that ignore what the function returns.
5. Do not mock the unit under test. Do not mock `fs`, `fetch`, or Prisma in these tests.
6. Keep tests deterministic: no real clock sleeps, no random ports, no shared files on disk. Pass `now` (or equivalent) when the production function already accepts it.
7. Module-level mutable state (e.g. the in-memory rate-limit map) may export a `resetXForTests()` helper and reset it in `beforeEach`. Do not add test-only hooks for anything else.
8. Do not snapshot entire PDF buffers, HTML emails, or Prisma rows.

### When you change production code for tests

Allowed: exporting an existing pure helper, adding an optional `now` argument, or a `resetXForTests()` for process-local maps.

Not allowed: rewriting business rules “to make them testable”, duplicating functions under a `__test__` folder, or skipping a failing test.

### Bar before you stop

```bash
npm test
npm run typecheck
```

`npm test` must exit 0. If a test fails, fix the test or the production bug; do not delete coverage to go green. Lint/typecheck failures introduced by the change must be fixed too.

CI does not collect coverage percentages. Do not add c8/istanbul gates. Breadth matters more than a number: untested new branches in `src/lib` should get cases, not a coverage config.

## Product boundaries

- Gest: leads → visits → proposals → contracts, plus company/templates.
- Pulse: sites/devices/samples/alerts, Tuya sync (`scripts/pulse-sync.ts`), public Casa UI, web push.
- Do not mix Pulse IoT types into the commercial pipeline schemas, or the reverse.
- Public Casa and document-sign flows stay token-based and unauthenticated.

## Guidelines
- Do not preserve backward compatibility. Remove obsolote code.
- choose the simplest implementation that fully meets the requirements, not crazy abstractions.
- Grow the system de layers
- Keep compoments modular and concerns clearly separated
- Prefer established, well maintained libraries. Do not reimplement functionality without a clear reason.
- Lean on the dependencies already in the project before implementation or adding packages
- Make architectural decisions for the long term. Do not do that only works for now and is meant to be replaced.

## Git hygiene

Do not commit `.env`, `storage/` dumps, `.next/`, or `node_modules`. Do not rewrite unrelated files while implementing a feature. Keep the Next.js agent-rules block in this file intact (content outside the markers is preserved by `next dev`).
