# LeaseTrap

LeaseTrap is an educational Massachusetts lease-reading prototype. It is not legal advice. See the [SRS](./docs/LeaseTrap_SRS.md), [Person A tasks](./docs/Person_A_Task.md), [verified legal pack](./legal/ma_tenant_law.md), and [sample answer key](./SAMPLES.md).

## Local development

Install dependencies, copy `.env.example` to `.env.local`, and set a Gemini API key privately. Never paste the key into chat or commit `.env.local`. The project is intended to use Gemini's unpaid quota with billing disabled. The UI discloses Google's current unpaid-service data terms: submitted prompts and outputs may be used to improve services and may be human-reviewed. Do not send sensitive, confidential, or personal information. If a paid Gemini service is configured, verify its terms and update the user-facing disclosure first.

```bash
npm install
npm run dev
```

`AUDIT_DISABLED=true` disables both model-backed POST routes. `npm test`, `npm run lint`, and `npm run build` validate the local project. The API limits are best-effort in-memory protections; they are not shared across serverless instances. Audit and email routes declare a 60-second maximum. Vercel's [official limits page](https://vercel.com/docs/functions/limitations#max-duration), last updated 2026-08-24, lists a 300-second Hobby maximum; the shorter route setting is intentional. No deployment configuration or release is included.

To run the model evaluation, set `GEMINI_API_KEY` in `.env.local` and run:

```bash
npm run eval
```

The evaluation runner performs three evaluation runs per sample lease, logs aggregate metrics only, and does not print lease text. It matches expected findings by category and quoted lease wording (or explicit missing-issue terms), not by model-generated IDs. Recall, precision, and quote/citation metrics are averaged across the three runs; variance compares semantic finding keys. The answer keys are provisional and have not received an independent review.

## API routes

- `POST /api/audit` accepts the frozen `AuditRequestSchema`.
- `POST /api/email` accepts the frozen `EmailRequestSchema`.
- `GET /api/health` returns `{ "status": "ok" }`.

All routes return `Cache-Control: no-store`; errors use the frozen API error codes. API body and rate limits are defined in `lib/limits.ts`.

Official Gemini data terms: [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms).

## Next.js

This project uses Next.js 16.4.6 App Router. Read local Next.js documentation under `node_modules/next/dist/docs/` before making framework changes.

## Deployment

Deployment is intentionally out of scope for this work.
