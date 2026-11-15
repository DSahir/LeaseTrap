# LeaseTrap

LeaseTrap is an educational Massachusetts lease-reading prototype. It is not legal advice. See the [SRS](./docs/LeaseTrap_SRS.md), [Person A tasks](./docs/Person_A_Task.md), [verified legal pack](./legal/ma_tenant_law.md), and [sample answer key](./SAMPLES.md).

## Local development

### Requirements

- Git
- Node.js 20.9 or newer (LTS recommended)
- npm (included with Node.js)

### Get the code and install dependencies on Windows

Open PowerShell and run:

```powershell
git clone --branch dev-v1 https://github.com/DSahir/LeaseTrap.git
Set-Location LeaseTrap
npm ci
```

If you already cloned the repository, update the branch instead:

```powershell
Set-Location path\to\LeaseTrap
git switch dev-v1
git pull origin dev-v1
npm ci
```

If your team uses a fork, clone that fork's `dev-v1` branch instead of `DSahir/LeaseTrap`.

### Configure local environment

Create a local environment file from the checked-in example, without overwriting an existing file:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
notepad .env.local
```

For **demo-only mode**, leave `AUDIT_DISABLED=true`. The **Try fictional demo** button opens a saved practice result and does not call Gemini. The API-backed audit and email features stay disabled.

For **live analysis**, add a valid Gemini API key to `GEMINI_API_KEY` and set `AUDIT_DISABLED=false`. The example file supplies the configured primary and fallback model names (`GEMINI_MODEL` and `GEMINI_MODEL_FALLBACK`); leave them unchanged unless the project maintainer asks you to update them. Keep `NEXT_PUBLIC_USE_MOCK` unset or set it to `false` when testing the real API. Save `.env.local` before starting or restarting the server.

Never commit `.env.local`, paste the key into chat, or include it in screenshots. It is ignored by Git. Each developer must obtain their own key through the project's approved secure channel; do not share keys in the repository.

### Run the app

Start the development server:

```powershell
npm run dev
```

Open the URL printed by Next.js (usually [http://localhost:3000](http://localhost:3000)). If port 3000 is already occupied, Next.js may select another port; use the URL it prints. To stop the server, focus the PowerShell window and press `Ctrl+C`.

### Try the app

1. Choose **Try fictional demo** to inspect the saved practice result without an AI call.
2. To test PDF extraction, choose a PDF. Text extraction and identifier masking happen in the browser; inspect the scrubbed preview before analysis.
3. Only choose **Analyze scrubbed text** when you intend to send the previewed text, town, and tenancy type to Gemini.
4. To test email drafting, select one or more eligible findings and choose **Write draft**. This generates draft text; it does not send an email. The selected clause details are sent for drafting.

Masking can miss sensitive details. Do not test with real leases or submit sensitive, confidential, or personal information. The project is intended to use Gemini's unpaid quota with billing disabled; under Google's current unpaid-service terms, submitted prompts and outputs may be used to improve services and may be human-reviewed. If a paid Gemini service is configured, verify its terms and update the user-facing disclosure first.

### Validate changes

Run the checks from the project directory:

```powershell
npm test
npm run lint
npm run build
```

`npm run build` creates the production build. To run that build locally after it succeeds:

```powershell
npm start
```

Open the local URL printed by Next.js and stop it with `Ctrl+C`.

### Troubleshooting

- **`GEMINI_API_KEY` missing or model error:** verify the local `.env.local` has a valid key and `AUDIT_DISABLED=false`; restart `npm run dev` after changing the file. Never paste the key into logs or messages.
- **`503 DISABLED`:** `AUDIT_DISABLED=true`; set it to `false` only if you intend to make live model requests.
- **`429 RATE_LIMITED`:** wait a minute before retrying. The provider may also enforce its own quota limits.
- **Scanned or empty PDF preview:** the PDF may contain images rather than selectable text. Use a text-based PDF or paste text you are authorized to process.
- **Port already in use:** use the alternate localhost URL shown in the dev-server output, or stop the other dev server from its own terminal with `Ctrl+C`.

The API limits are best-effort in-memory protections; they are not shared across serverless instances and should not be treated as abuse protection for a public launch. Audit and email routes declare a 60-second maximum. Vercel's [official limits page](https://vercel.com/docs/functions/limitations#max-duration), last updated 2026-08-24, lists a 300-second Hobby maximum; the shorter route setting is intentional.

To run the model evaluation, set a valid `GEMINI_API_KEY` in `.env.local` and run:

```powershell
npm run eval
```

The evaluation runner makes three live Gemini calls per sample lease (nine calls total) and does not print lease text. It uses only the project's fictional sample leases; it still consumes API quota. The current audit prompt is v3; v1 and v2 are retained for comparison. Scoring matches expected findings by category and quoted lease wording (or explicit missing-issue terms), not by model-generated IDs. Recall, precision, and quote/citation metrics are averaged across the three runs; variance compares semantic finding keys. Per-finding diagnostics report how often expected issues were found, how often expected-clean clauses were flagged, and unmatched flag counts by category, without printing model quotes. The renewal clause is not scored as an expected legal finding because the supplied legal pack does not address automatic renewal. The answer keys are provisional and have not received an independent review.

## API routes

- `POST /api/audit` accepts the frozen `AuditRequestSchema`.
- `POST /api/email` accepts the frozen `EmailRequestSchema`.
- `GET /api/health` returns `{ "status": "ok" }`.

All routes return `Cache-Control: no-store`; errors use the frozen API error codes. API body and rate limits are defined in `lib/limits.ts`.

Official Gemini data terms: [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms).

## Next.js

This project uses Next.js 16.4.6 App Router. Read local Next.js documentation under `node_modules/next/dist/docs/` before making framework changes.

## Vercel deployment

The app uses Next.js defaults and does not need a custom Vercel build configuration.

1. Push the reviewed branch to GitHub and import `DSahir/LeaseTrap` into Vercel.
2. Set these environment variables in Vercel for the environment you are deploying:
   - `GEMINI_API_KEY`: add privately in Vercel; never put the value in Git or chat.
   - `GEMINI_MODEL`: `gemini-3.5-flash-lite`
   - `GEMINI_MODEL_FALLBACK`: `gemini-3.1-flash-lite`
   - `AUDIT_DISABLED`: `true` for a deployment with model routes disabled; change to `false` only when ready to test the live routes.
   - `NEXT_PUBLIC_USE_MOCK`: unset or `false`.
3. Deploy, then check `/api/health` for `{ "status": "ok" }`. This confirms the app is responding, not that Gemini credentials or model calls work.
4. Before enabling model-backed routes on a public deployment, add shared rate limiting and usage controls. Current limits are per-instance and can reset or diverge across serverless instances. Until then, use a controlled preview/beta and monitor provider quota.
5. Test using the fictional sample lease before inviting users. Do not send sensitive, confidential, or personal information.

This is a deployment path, not a claim that the current app has production-grade abuse controls or has been deployed.
