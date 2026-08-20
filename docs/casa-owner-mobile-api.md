# Laro Pulse — owner mobile API

Use this file as the **source of truth** when implementing a native owner app (iOS / Android / Expo). Do not invent extra auth methods, extra fields, or extra routes. If something is not in this file, it is out of scope for the owner app.

Product: **Laro Pulse** — owners see live sensors and alerts for houses Laro manages. UI copy is Portuguese (`pt-PT`). API error strings are Portuguese; you may display them as-is.

Related **website** (do not call from native): owners can also log in in a browser at `/casa/entrar`. Staff CRM (`/login`, `/leads`, …) is a different product. Never use staff email/password login in the owner app.

---

## Hard rules

1. Authenticate owners with **email + 6-digit OTP** only. No passwords, no Google, no magic links.
2. After verify, persist `token` in secure storage (Keychain / Keystore). Send it on every authenticated request:
   ```
   Authorization: Bearer <token>
   ```
3. Do **not** send session cookies from the native app. Do **not** rely on `Set-Cookie`.
4. Do **not** call `/api/auth/*` from the owner app. Those routes are for the website. Owner REST is only under `/api/casa`.
5. Do **not** call `POST /api/auth/email-otp/send-verification-otp` or `POST /api/auth/sign-in/email-otp` directly. They will not create an owner or will reject non-owners.
6. A valid-looking email on `POST /api/casa/auth/otp` **always** returns `{ "ok": true }`, even if that inbox has no house. Do not tell the user “this email is not registered.”
7. Treat another owner’s `siteId` as **not found** (HTTP 404). Do not probe IDs.
8. Skip Web Push (`/push`) on native. Those endpoints are VAPID browser push. Use APNs/FCM later if needed; that API does not exist yet.
9. JSON only. `Content-Type: application/json` on POST/PATCH. No multipart. No GraphQL.

---

## Base URL

| Environment | Base |
| --- | --- |
| Local dev | `http://localhost:3001` (or the port `next dev` prints) |
| Production | the deployed origin, no trailing slash |

All paths below are relative to that origin.

There is **no API version prefix**. Breaking changes will be documented in this file.

---

## Auth model

```
email → POST /api/casa/auth/otp
     → user types 6-digit code from email
     → POST /api/casa/auth/verify  → { token, user, houses }
     → store token
     → GET /api/casa and /api/casa/{siteId}/* with Authorization: Bearer <token>
     → POST /api/casa/auth/sign-out  (then delete token)
```

- OTP length: **6 digits** (`/^\d{6}$/`).
- OTP lifetime: **5 minutes**.
- Wrong codes: generic `401` `{ "error": "Código inválido ou expirado" }` after too many tries as well. Ask the user to request a new code.
- Server rate-limits OTP send (about **5 / 10 min** per email and per IP, plus ~20 req/min on the route). On `429` show “try again later.”
- Token is an opaque session string. Do not parse it. If `401` on an authenticated route, clear token and return to login.

Optional response header on some auth responses: `set-auth-token`. Ignore it; use `token` in the JSON body from verify.

Do **not** send `Origin` / `Referer` if you can avoid it. Native clients usually omit them.

---

## Shared contracts

### Success

JSON body is the payload (no `{ data: ... }` wrapper).

Headers always include:

- `Content-Type: application/json`
- `Cache-Control: private, no-store`

### Error

```json
{ "error": "Portuguese message" }
```

| Status | Meaning |
| --- | --- |
| `400` | Bad body (invalid email, invalid OTP shape, invalid patch) |
| `401` | Missing/invalid/expired session **or** wrong OTP |
| `404` | House not found, disabled, or not owned by this user |
| `429` | Rate limited. Honor `Retry-After` (seconds) if present |
| `500` | Server failure |
| `503` | Only `/push` when VAPID is not configured — native should not call this |

### Authenticated request

```
Authorization: Bearer <token>
```

No token → `401`. Valid token but that house is not theirs → `404`.

### IDs

- `siteId` / `user.id` / `device.id` / `alert.id`: opaque strings (cuid). Never treat them as the old public house token.
- Datetimes: ISO 8601 UTC strings, e.g. `"2026-08-20T12:00:00.000Z"`.
- Quiet hours: `"HH:mm"` 24h, Europe/Lisbon (e.g. `"22:00"`).

---

## Endpoints

### `POST /api/casa/auth/otp`

Start login. **No Authorization header.**

Request:

```json
{ "email": "owner@example.com" }
```

Email is trimmed. Must be a normal email.

Responses:

- `200` `{ "ok": true }` — always, if the email is well-formed. A code is emailed **only** if this inbox owns an active Pulse house.
- `200` in **local/dev only**, may also include `{ "ok": true, "preview": true, "previewCode": "123456" }` when email is written to disk instead of sent. **Never show `previewCode` as a production UI.** Production never includes it.
- `400` `{ "error": "Email inválido" }`
- `429` `{ "error": "Demasiados pedidos" }`
- `500` `{ "error": "Não deu para enviar o código" }`

Client UX: after `200`, go to the code screen. Copy: the code was sent if this email has access.

---

### `POST /api/casa/auth/verify`

Finish login. **No Authorization header.**

Request:

```json
{ "email": "owner@example.com", "otp": "123456" }
```

`otp` must be exactly 6 digits.

`200` response:

```json
{
  "token": "<opaque session token>",
  "user": {
    "id": "cuid",
    "name": "Maria Silva",
    "email": "owner@example.com"
  },
  "houses": [
    {
      "siteId": "cuid",
      "name": "Casa de Porto",
      "address": "Rua das Flores 1",
      "city": "Porto"
    }
  ]
}
```

- Persist `token`.
- `houses` may be empty (show empty state). Prefer `houses[0].siteId` as the default house.
- `city` may be `null`. `name` is already a display title (`Casa de {city}` or the address).

Errors:

- `400` invalid email/otp shape (`"Email inválido"` or `"Código de 6 dígitos"`)
- `401` `{ "error": "Código inválido ou expirado" }`
- `500` `{ "error": "Não deu para entrar" }`

---

### `POST /api/casa/auth/sign-out`

Requires `Authorization: Bearer <token>`. Empty body.

- `200` `{ "ok": true }`
- `401` `{ "error": "Não autenticado" }`

Always delete the local token after this call, and also if the call fails with `401`.

---

### `GET /api/casa`

Requires bearer. Current user + houses (same `houses` shape as verify).

- `200` `{ "user": { "id", "name", "email" }, "houses": [ ... ] }`
- `401` `{ "error": "Não autenticado" }`

Call this on launch if a token exists, to refresh the house list.

---

### `GET /api/casa/{siteId}`

Requires bearer. Full snapshot for first paint. Prefer this **or** `GET .../live`, not both on a tight loop.

`200` includes `house`, `houses`, `headline`, `tone`, `updatedAt`, `devices` (richer than live), `alerts`, `today.samples`, `today.day` (chart helpers). Mobile can ignore `today.day` and build charts from samples.

`tone`: `"ok" | "warn" | "alert" | "offline" | "idle"`.

---

### `GET /api/casa/{siteId}/live`

Requires bearer. Poll while the house screen is visible (website uses **60s** + refresh on foreground).

`200`:

```json
{
  "now": "2026-08-20T12:00:00.000Z",
  "devices": [ /* CasaDevice */ ],
  "alerts": [ /* CasaAlert */ ],
  "samples": [ /* CasaSample, Lisbon local day so far */ ]
}
```

- `404` house missing / not owned / disabled
- `401` no/invalid token

---

### `GET /api/casa/{siteId}/history`

Requires bearer. Newest-first pages of samples.

Query:

| Param | Required | Meaning |
| --- | --- | --- |
| `deviceId` | no | Filter to one device. **Omit** for all devices. Do not send `all`. |
| `at` | with `id` | Cursor: previous page’s `nextCursor.recordedAt` |
| `id` | with `at` | Cursor: previous page’s `nextCursor.id` |

`200`:

```json
{
  "samples": [ /* CasaSample */ ],
  "nextCursor": { "recordedAt": "ISO", "id": "cuid" } | null
}
```

Page size is server-controlled (~36). Stop when `nextCursor` is `null` or `samples` is empty.

---

### `GET /api/casa/{siteId}/notify`

Requires bearer. Notification preferences for that house.

`200`:

```json
{
  "push": true,
  "water": true,
  "offline": true,
  "battery": true,
  "climate": true,
  "quietEnabled": false,
  "quietStart": "22:00",
  "quietEnd": "08:00"
}
```

`MOTION` alerts are always on server-side even if you do not expose a toggle.

---

### `PATCH /api/casa/{siteId}/notify`

Requires bearer. **Partial** body: only send keys you are changing. Unknown keys ignored.

Booleans: `push`, `water`, `offline`, `battery`, `climate`, `quietEnabled`.  
Clocks: `quietStart`, `quietEnd` as `"HH:mm"` (`00:00`–`23:59`).

`200`: full prefs object (same as GET).  
`400` `{ "error": "Pedido inválido" }` if body is not an object.

---

### `GET` / `POST` / `DELETE /api/casa/{siteId}/push`

Web Push (VAPID). **Skip in native.** `GET` returns `{ "publicKey" }` or `503`.

---

## Types (implement these)

```ts
type CasaUser = {
  id: string;
  name: string;
  email: string;
};

type CasaHouse = {
  siteId: string;
  name: string;
  address: string;
  city: string | null;
};

type CasaDeviceKind =
  | "WATER"
  | "MOTION"
  | "TEMP_HUMIDITY"
  | "DOOR"
  | "GATEWAY"
  | "OTHER";

type CasaReading = {
  open?: boolean;
  leak?: boolean;
  temperature?: number;
  humidity?: number;
  motion?: boolean;
  lux?: number;
};

type CasaDevice = {
  id: string;
  kind: CasaDeviceKind;
  label: string;
  online: boolean;
  lastSeenAt: string | null; // ISO or null
  batteryPct: number | null;
  reading: CasaReading;
};

type CasaAlertType =
  | "WATER_LEAK"
  | "DOOR_OPEN"
  | "TEMP_HIGH"
  | "TEMP_LOW"
  | "HUMIDITY_HIGH"
  | "MOTION"
  | "BATTERY"
  | "OFFLINE";

type CasaAlertStatus = "OPEN" | "ACKED" | "RESOLVED";

type CasaAlert = {
  id: string;
  type: CasaAlertType;
  status: CasaAlertStatus;
  message: string;
  triggeredAt: string; // ISO
};

type CasaSample = {
  id: string;
  deviceId: string;
  recordedAt: string; // ISO
  temperature: number | null;
  humidity: number | null;
  leak: boolean | null;
  open: boolean | null;
  motion: boolean | null;
  lux: number | null;
  batteryPct: number | null;
  online: boolean;
};

type CasaNotifyPrefs = {
  push: boolean;
  water: boolean;
  offline: boolean;
  battery: boolean;
  climate: boolean;
  quietEnabled: boolean;
  quietStart: string; // "HH:mm"
  quietEnd: string;
};

type CasaLiveResponse = {
  now: string;
  devices: CasaDevice[];
  alerts: CasaAlert[];
  samples: CasaSample[];
};

type CasaHistoryResponse = {
  samples: CasaSample[];
  nextCursor: { recordedAt: string; id: string } | null;
};

type CasaVerifyResponse = {
  token: string;
  user: CasaUser;
  houses: CasaHouse[];
};

type CasaError = { error: string };
```

`GET /api/casa/{siteId}` snapshot devices also include `model`, `severity` (`"ok" | "warn" | "alert" | "offline" | "idle"`), and `headline`. Live devices do **not**. Prefer live + list houses for a native home screen.

Suggested labels (pt-PT) if you map enums:

| `kind` | Label |
| --- | --- |
| `WATER` | Fuga / água |
| `MOTION` | Movimento |
| `TEMP_HUMIDITY` | Temperatura |
| `DOOR` | Porta |
| `GATEWAY` | Gateway |
| `OTHER` | Sensor |

Open alerts: `status === "OPEN"`. Water leak: `type === "WATER_LEAK"` or `reading.leak === true`.

---

## Suggested client flow

1. Cold start: if token in secure storage → `GET /api/casa`. On `401`, delete token, show login.
2. Login: email screen → `POST .../otp` → code screen → `POST .../verify` → save token → house list or first `siteId`.
3. House screen: `GET .../live` on appear; poll ~60s while visible; pause in background.
4. History: first page without cursor; next pages with `at` + `id`.
5. Settings: `GET` notify, `PATCH` on toggle. Hide Web Push or map `push` as “alertas” only if you have another channel.
6. Logout: `POST .../sign-out`, delete token.

Timeouts: 10s is enough. Retry `GET` on network errors; do not auto-retry `POST /otp` or `/verify`.

---

## Out of scope (do not implement against)

| Path | Why |
| --- | --- |
| `POST /api/auth/sign-in/email` | Staff CRM password login |
| `POST /api/auth/sign-in/email-otp` | Website-only; skips owner eligibility |
| `POST /api/auth/email-otp/*` | Website-only |
| `/p/{token}`, `/c/{token}` | Public proposal/contract links |
| `/casa/{oldPublicToken}` | Deprecated capability URL |
| `/leads`, `/pulse`, `/api/files/*` | Staff |

---

## Local check

```bash
# always 200 for a well-formed email (no user leak)
curl -s -X POST "$BASE/api/casa/auth/otp" \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com"}'

# 401
curl -s -X POST "$BASE/api/casa/auth/verify" \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","otp":"000000"}'

# 401
curl -s "$BASE/api/casa"
```

In local email mode, OTP HTML is written under `storage/emails/` on the server. `previewCode` may appear on the otp `200` body in development only.

---

## Agent checklist

- [ ] Single API client: base URL + JSON + Bearer interceptor
- [ ] Login: otp → verify → secure token
- [ ] Unknown email: same success UX as known email
- [ ] 401 on any casa GET/PATCH → logout
- [ ] House switcher uses `siteId` from `houses`, not tokens
- [ ] Live poll cancelled on background
- [ ] History pagination uses `nextCursor`
- [ ] Notify PATCH is partial
- [ ] No `/api/auth/*`, no passwords, no Web Push unless specified later
