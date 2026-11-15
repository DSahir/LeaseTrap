# Person B: Frontend / Privacy / UX Task File

**Source of truth:** the team's *LeaseTrap Full Project Specification (v2, Massachusetts-wide, Privacy-First)*. This file only splits that spec into tasks. Section numbers (e.g. "spec 6.3") point into it. Where the spec leaves a detail open, this file fills the gap and marks it **(gap filled)**.

**You own:** everything in the browser: PDF text extraction, scrubbing, preview, results dashboard, quote verification, email UI, help panel, build log tab, Vercel deploy setup.
**Person A owns:** the API (`/api/audit`, `/api/email`, `/api/health`), Gemini, legal pack, prompts, sample leases, eval.
**Independence rule:** you build against your own mock and flip one config flag at integration. You never wait on A. A never waits on you.

Free tools only: Vercel Hobby, GitHub, `pdfjs-dist`, `tesseract.js` (M2), Tailwind, `lucide-react`, `zod`.

---

## 1. Your files

| File / folder | Purpose |
|---|---|
| `app/page.tsx`, `app/layout.tsx` | Page state machine, layout, footer |
| `components/UploadZone.tsx` | Drop zone, validation, municipality dropdown, name fields, demo button, "Scanned lease?" link |
| `components/PreviewPanel.tsx` | Scrubbed text, highlights, editing, send button |
| `components/Results.tsx`, `ClauseCard.tsx`, `LevelBadge.tsx` | Dashboard (spec Feature 2) |
| `components/EmailPanel.tsx` | Tone toggle, draft, restore, copy (spec Feature 3) |
| `components/HelpPanel.tsx`, `content/help-links.ts` | Free Help panel (spec Feature 4) |
| `components/PrivacyNotice.tsx` | Spec 6.12 notice |
| `components/BuildLog.tsx` | Stretch (spec Feature 5) |
| `lib/pdf.ts` | pdf.js extraction |
| `lib/scrub.ts`, `lib/restore.ts` | Scrubber and placeholder restore (spec 6.3, 6.4) |
| `lib/verifyQuotes.ts` | Quote verification (spec 12.4) |
| `lib/api.ts`, `lib/emailClient.ts`, `lib/config.ts` | Client calls and the mock switch |
| `mock/audit-mock.json`, `mock/email-mock.json` (served from `public/mock/`) | Your fixtures |
| `public/samples/fakepii.pdf`, `public/samples/scanned.pdf` | Privacy and OCR test leases (spec 7.2) |
| `SAMPLES_PRIVACY.md` | Which fake PII is seeded where (your answer key) |
| `tests/scrub.test.ts` | Scrubber tests |
| `devlog/B.md` | Real build log (spec Appendix C template) |

**Do not edit A's files:** `lib/contract.ts` (frozen), `lib/audit.ts`, `lib/prompt.ts`, `lib/gemini.ts`, `lib/emailDraft.ts`, `lib/ratelimit.ts`, `app/api/**`, `legal/**`, `prompts/**`, `eval/**`, `SAMPLES.md`, `public/samples/demo-*`, `public/legal/**`, `devlog/A.md`.

---

## 2. Frozen contract (identical copy is in A's file)

A commits this as `lib/contract.ts` in Phase 0. After that, you only import from it.

```ts
import { z } from "zod";

export const LEVELS = ["HIGH", "WORTH_ASKING", "STANDARD", "POSSIBLY_MISSING"] as const;
export const CATEGORIES = [
  "SECURITY_DEPOSIT", "FEES", "ENTRY", "REPAIRS", "RENEWAL",
  "LIABILITY", "SUBLETTING", "DISCLOSURES", "OTHER",
] as const;
export const CONFIDENCE = ["HIGH", "MEDIUM", "LOW"] as const;

export const ModelClauseSchema = z.object({
  id: z.string(),
  level: z.enum(LEVELS),
  category: z.enum(CATEGORIES),
  quote: z.string().nullable(),            // null only for POSSIBLY_MISSING
  plain_english: z.string(),
  legal_reference_ids: z.array(z.string()),
  why_flagged: z.string(),
  confidence: z.enum(CONFIDENCE),
  question_for_landlord: z.string(),
});
export const CountsSchema = z.object({
  high: z.number(), worth_asking: z.number(),
  standard: z.number(), possibly_missing: z.number(),
});
export const ModelOutputSchema = z.object({
  summary: z.string(), counts: CountsSchema,
  clauses: z.array(ModelClauseSchema), unsupported_notes: z.array(z.string()),
});

export const CitationSchema = z.object({
  id: z.string(), title: z.string(), citation: z.string(), url: z.string().url(),
  scope_note: z.string().optional(),
});
export const ClauseSchema = ModelClauseSchema.extend({
  ma_statute_citation: z.array(CitationSchema),
});
export const AuditResponseSchema = z.object({
  summary: z.string(), counts: CountsSchema,
  clauses: z.array(ClauseSchema), unsupported_notes: z.array(z.string()),
  legal_last_verified: z.string(),
});

export const AuditRequestSchema = z.object({
  text: z.string().min(1).max(200_000),
  municipality: z.string().max(60),        // slug, lowercase hyphenated
  tenancyType: z.string().max(40).optional(),
  deepReview: z.boolean().optional(),
});

export const EmailClauseInputSchema = z.object({
  category: z.enum(CATEGORIES),
  plain_english: z.string(),
  question_for_landlord: z.string(),
  citations: z.array(z.string()),
});
export const EmailRequestSchema = z.object({
  clauses: z.array(EmailClauseInputSchema).min(1).max(20),
  tone: z.enum(["collaborative", "direct"]),
  notes: z.string().max(1000).optional(),
});
export const EmailResponseSchema = z.object({ subject: z.string(), body: z.string() });

export const ERROR_CODES = ["BAD_REQUEST","TOO_LARGE","RATE_LIMITED","MODEL_FAILURE","DISABLED"] as const;
export const ApiErrorSchema = z.object({ error: z.string(), code: z.enum(ERROR_CODES) });
// 400 BAD_REQUEST, 413 TOO_LARGE, 429 RATE_LIMITED, 502 MODEL_FAILURE, 503 DISABLED
```

**Placeholder vocabulary (your scrubber must produce exactly these):** `[TENANT_n]`, `[ROOMMATE_n]`, `[GUARANTOR_n]`, `[LANDLORD]`, `[MANAGER]`, `[PROPERTY_ADDRESS]`, `[ADDRESS]`, `[PHONE]`, `[EMAIL]`, `[SSN]`, `[NUMBER]`, `[DOB]`, `[ZIP]`.

---

## 3. The mock switch (what makes you independent)

`lib/config.ts`:
```ts
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
export const MOCK_AUDIT_URL = "/mock/audit-mock.json";
export const MOCK_EMAIL_URL = "/mock/email-mock.json";
export const DEMO_TEXT_URL = "/samples/demo-lease.txt";       // A's file at integration
export const DEMO_RESULT_URL = "/samples/demo-result.json";   // A's file at integration
export const LOADED_TOWNS_URL = "/legal/loaded-towns.json";   // A's file; fall back to [] if missing
```
- `lib/api.ts`: `audit(req): Promise<AuditResponse>`. In mock mode fetch the fixture; otherwise `POST /api/audit`. Always re-validate with `AuditResponseSchema` (spec 5.1: browser validates JSON).
- `lib/emailClient.ts`: `draftEmail(req): Promise<EmailResponse>` the same way, calling `POST /api/email`.
- Map error codes to friendly messages: `RATE_LIMITED` "Too many requests, try again in a minute", `DISABLED` "Analysis is temporarily unavailable. Try the demo lease.", `TOO_LARGE`, `BAD_REQUEST`, `MODEL_FAILURE` "We couldn't analyze this text. Please try again."
- Until A's demo files arrive, make your own temporary `demo-lease.txt` and `demo-result.json` copies **under different names** (for example `public/mock/demo-lease.tmp.txt`) so you never collide with A's files.

---

## 4. Plan: two milestones

The spec offers a 5.5-hour stripped MVP (Option A) and a 9 to 10 hour build (Option B). You have tonight only, so:
- **M1 (about 5.5 h): first deploy**, spec Option A: scrubber + preview, audit, results, email, free-help panel.
- **M2 (about 9 to 10 h): the rest of the spec.** Stop at any point after M1; the cut order is in Section 8.

Sync points (about 10 min each): **S1** at 0:30, **S2** at M1 integration, **S3** at the end of M2.

---

## 5. M1 tasks (0:00 to 5:30)

### Task 0: Setup (0:00 to 0:30)
- [ ] Connect the GitHub repo to **Vercel (free Hobby)** and deploy the blank page (spec 13.2).
- [ ] Add env vars in the **production** environment: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK` (A gives you the values privately; never in the repo or screenshots). `NEXT_PUBLIC_USE_MOCK` must be unset or `false` in production.
- [ ] Check the **current Vercel Hobby function duration limit** and tell A at S1 (spec 11.3).
- [ ] Pull `lib/contract.ts`. Install `pdfjs-dist`. Create `devlog/B.md`.
- **S1:** confirm contract, env, A's answer on Gemini data terms (needed for your privacy notice).

### Task 1: Intake (0:30 to 1:15), spec Feature 1
- [ ] Drop zone and picker, PDF only. **Reject files over 25 MB** client-side with a clear message.
- [ ] `lib/pdf.ts`: `extractText(file)` with pdf.js, client-only. Follow the **current pdf.js docs for the worker setup in Next.js** (the usual stumbling block).
- [ ] **Scanned detection:** if extracted text is under **500 characters**, treat as scanned. For M1: show "Scanned leases are less reliable. Review the text before sending." and offer a paste-text box **(gap filled: stand-in until the OCR/manual redaction path in M2)**.
- [ ] **Municipality dropdown** of MA towns plus "Other"; value is a lowercase hyphenated slug. Fetch `LOADED_TOWNS_URL` (default to `[]`). If the town isn't in the list show: *"No local rules loaded for this town. Local ordinances may also apply."*
- [ ] **Optional fields** (spec 6.3 Step A): tenant name(s), roommates, guarantor name(s), landlord/company, property manager, street address.
- [ ] **Privacy notice** from spec 6.12 above the upload area. Update it to match A's data-terms answer; if no-training can't be confirmed, say client-side scrubbing is your only protection (spec 6.8).
- [ ] Language note: English only (spec 10.3).

Done when: a text PDF produces extracted text in state; bad files, oversize and scanned PDFs show correct messages.

### Task 2: Scrubber (1:15 to 2:30), your biggest task, spec 6.3 and 6.4
`lib/scrub.ts`: `scrub(text, known): { scrubbed, map, findings }`

**Step A, collect known values.** Generate variants for each entered name: "Jane Q. Doe", "Doe, Jane", "Jane Doe", "J. Doe", upper and lower case.
**Step B, exact replacement.** Replace known values with placeholders, **longest string first** to avoid partial leaks.
**Step C, patterns:**

| Pattern | Examples to catch | Replacement |
|---|---|---|
| US phone | `413-555-0147`, `(413) 555 0147`, `413.555.0147`, `+1 413 555 0147` | `[PHONE]` |
| Email | `name@school.edu` | `[EMAIL]` |
| SSN | `123-45-6789`, `123 45 6789` | `[SSN]` |
| Long digit runs (account/card/license) | 9+ digits with spaces or dashes | `[NUMBER]` |
| Date of birth | dates after "DOB", "born", "date of birth" | `[DOB]` |
| ZIP | 5-digit or ZIP+4 near a MA address pattern | `[ZIP]` |
| Street address | number + street name + suffix (St, Ave, Rd, Dr, Ln, Way, Blvd) | `[ADDRESS]` |

**Exceptions (do NOT redact):** `$` amounts, percentages, lease dates (move-in, term start/end, notice deadlines). Redact dates only when they follow a personal-data keyword.
**Step D, residual check.** Rescan for leftover phone/email/10+ digit patterns; return them in `findings` so the preview can highlight them. Warn the user if an SSN-like value was found.
**Step E, mapping.** `placeholder -> original` stays **in memory only**: never serialized, never sent, never stored.

`lib/restore.ts`: `restore(text, map)` puts originals back locally (spec 6.4); unknown placeholders stay as-is.

**Tests (`tests/scrub.test.ts`)** with the spec Appendix D inputs:
```
Phone:  413-555-0147 | (413) 555-0147 | 413.555.0147 | 413 555 0147 | +1 413 555 0147 | 4135550147
Email:  jane.doe@umass.edu | JANE.DOE@Example.COM
SSN:    123-45-6789 | 123 45 6789
Name:   Jane Q. Doe | Doe, Jane | JANE DOE | J. Doe
Address: 12 Main St., Apt 3B, Amherst, MA 01002 | 12 Main Street Unit 3B
Keep:   $1,850 rent | $1,850.00 | 30 days | September 1, 2026
```
- [ ] Create **`public/samples/fakepii.pdf`**: a fictional lease with invented names, addresses, phones in many formats, an SSN, a guarantor and a roommate (spec 7.2). Export from Google Docs. Document what is seeded in `SAMPLES_PRIVACY.md`.
- [ ] Log real regex failures in `devlog/B.md` as they happen.

### Task 3: Preview and privacy UX (2:30 to 3:15), spec 6.5, 6.9
- [ ] **Preview screen:** scrollable scrubbed text with placeholders highlighted (spans/`<mark>` via React; **never** `dangerouslySetInnerHTML`), residual findings highlighted differently, **editable**.
- [ ] Button **"Send this text for analysis"** with the line: *"Only the text shown above will be sent. Your original file stays on your device."*
- [ ] **"Clear everything"** button: wipes in-memory state, map, file and results. **No `localStorage`, `sessionStorage` or IndexedDB anywhere** (search your code for them). Clear state on page unload.
- [ ] **"Try demo lease"** button: loads demo text, runs it through the scrubber and preview, and on Send loads the cached result (`DEMO_RESULT_URL`) **with no API call** (spec 11.3).
- [ ] State machine: `idle | extracting | preview | analyzing | results | error`. Progress wording like "Reading clauses..." (spec 11.3).
- [ ] Error states (spec 10.4): unreadable PDF, oversize file, scanned file, API timeout/rate limit, malformed output, with Retry and "Use demo lease instead".
- [ ] Avoid analytics and ad trackers; pin versions and prefer self-hosted fonts and libraries (spec 6.11).

### Task 4: Results dashboard (3:15 to 4:15), spec Feature 2
First write **`mock/audit-mock.json`** (and copy to `public/mock/`): 6 to 8 clauses covering all four levels, with `ma_statute_citation` entries, and `legal_last_verified`. Mark placeholder citations as **MOCK** and keep them out of any real demo. Validate it with `AuditResponseSchema`.

- [ ] **Summary header:** summary text, counts per level (for example "2 high concern, 4 worth asking about, 6 standard"), **no numeric score, no dollar estimate**, visible disclaimer *"This is an explanation tool, not legal advice. Confirm with a free tenant resource below."*
- [ ] **Level badges** (icon + text label, never color alone):

| Level | Label | Icon (`lucide-react`) |
|---|---|---|
| HIGH | Likely conflicts with MA law, confirm | `AlertTriangle` |
| WORTH_ASKING | Unfavorable or unusual, negotiable | `HelpCircle` |
| STANDARD | Looks typical | `CheckCircle2` |
| POSSIBLY_MISSING | Expected item not found | `CircleDashed` |

- [ ] **Expandable cards** (`aria-expanded`): category, quote, plain English, why flagged, possibly relevant law with official links (from `ma_statute_citation`), confidence indicator (High/Medium/Low), question for landlord, include-in-email checkbox.
- [ ] **Quote verification (`lib/verifyQuotes.ts`, spec 12.4):** normalize whitespace (and curly quotes/dashes), check each `quote` is in the **scrubbed text that was sent**. If not, show *"Could not verify this quote in your document"* and downgrade the displayed confidence to Low. `POSSIBLY_MISSING` has no quote.
- [ ] **Zero flags:** *"No clauses were flagged. This doesn't mean the lease is safe."* Also show `unsupported_notes` when present.
- [ ] **Footer on every page:** "Educational tool, not legal advice." plus "Legal reference last verified: {legal_last_verified}" (spec 7.1 rule 5).
- [ ] **Copy rules (spec 10.5, 16.5):** never use "illegal", "void" or "unenforceable" as bare verdicts; use "may conflict with". Never predict dispute outcomes or advise withholding rent.
- [ ] **Free Help panel (`content/help-links.ts`, spec Feature 4, 16.3):** school student legal services (generic entry telling users to check their school), MassLegalHelp (masslegalhelp.org), Massachusetts Attorney General tenant information, regional legal aid organizations, local Board of Health / code enforcement. **Open and click-test every link; remove any you can't confirm.** Show on every results screen.

### Task 5: Email and accessibility (4:15 to 5:00), spec Feature 3, 10.2
**Email flow (calls A's `/api/email`; mock until integration):**
- [ ] Checkboxes select clauses; build an `EmailRequest` using placeholders only (the browser sends category, `plain_english`, `question_for_landlord`, and citation strings, never original names).
- [ ] Tone toggle: **Collaborative** (asks questions, assumes good faith) and **Direct** (states the concern, cites the law as "my understanding is").
- [ ] Optional notes box.
- [ ] Response comes back with placeholders; `restore(body, map)` **locally** before display (spec 6.4).
- [ ] Editable textarea, **Copy** button with a 2-second "Copied!".
- [ ] Show the leverage note: *"In a competitive market, raising issues may affect whether a landlord offers you the unit. Consider your leverage before sending."*
- [ ] Disabled state with a hint when no clause is selected.
- [ ] Create `mock/email-mock.json` (`{subject, body}` with placeholders) for development.

**Accessibility pass (spec 10.2):** icons plus text labels, 4.5:1 contrast, keyboard navigation with visible focus, screen-reader labels for icons and expandable cards, roughly 8th-grade reading level, mobile-first layout checked at phone width.

### Task 6: S2 integration (5:00 to 5:30) with A
1. Pull A's latest. Set `NEXT_PUBLIC_USE_MOCK=false`. Point `DEMO_TEXT_URL`/`DEMO_RESULT_URL` at A's files and delete your temp demo copies.
2. Run the demo path and one real text PDF. If a quote shows "Could not verify", tell A (the scrubber may have changed text inside a quote; A regenerates `demo-result.json`).
3. **Privacy test (A leads, spec 6.14):** run `fakepii.pdf` with the Network tab open; confirm the `/api/audit` body is scrubbed text only; confirm browser storage is empty after "Clear everything".
4. `npm run build`, push to `main`, test the production URL on desktop and a **real phone**.
5. Tag `v1-prototype` together with A. Record a **60-second fallback walkthrough video** (spec 13.2).

---

## 6. M2 tasks (about 5:30 to 9:30)

| Order | Task | Spec ref |
|---|---|---|
| 1 | **Filters** by level and category on the results screen | 10.1 |
| 2 | **Manual redaction canvas** for scanned leases: user draws black boxes over names/signatures/addresses, pages are flattened, then processed | 6.6 (option 1) |
| 3 | **Client-side OCR** with `tesseract.js` through the same scrubber, with preview and the "less reliable" warning | 6.6 (option 2) |
| 4 | **`scanned.pdf`** test lease (photograph a printed fictional lease with skew) | 7.2 |
| 5 | **Capitalized-name highlighter** in the preview that suggests names the user didn't enter | 6.13 |
| 6 | **Deep-review toggle** (sends `deepReview: true`; only if A built it) | 8.3 |
| 7 | **Build Log tab** (`BuildLog.tsx`): real timestamped entries from `devlog/A.md` + `devlog/B.md`, using the Appendix C template; **no invented entries** | Feature 5, 17.4 |
| 8 | **Device tests:** iOS Safari, Android Chrome, desktop; automated accessibility check plus manual keyboard and screen-reader check | 12.1 |
| 9 | **Load check:** several simultaneous demo clicks, confirm cache path and rate-limit messaging | 12.1 |
| 10 | **Deployment checklist** (spec 13.2): production env vars, `.env*` ignored, rate limiting active (with A), mobile upload, privacy notice before upload, free-help links click-tested, fallback video | 13.2 |
| 11 | **Pitch:** write the 2-minute script (spec 17.2) and own the demo, including showing the Network tab once to prove the payload is scrubbed text only; rehearse with A | 17.2, 17.3 |

---

## 7. Definition of done

**M1**
- [ ] PDF text extracted in the browser; the raw PDF is never sent
- [ ] Scrubber tests pass; preview shows placeholders, residual warnings and is editable
- [ ] Network payload contains only scrubbed text, municipality and tenancy type
- [ ] Demo works with no API call
- [ ] Dashboard: four accessible levels, counts, no score or dollars, quote verification, links to official sources, confidence indicators
- [ ] Email panel: tones, local placeholder restore, Copy, leverage note
- [ ] Help panel links all click-tested; footer disclaimer and last-verified date visible
- [ ] Clear everything works; no browser storage used
- [ ] All error states handled; production tested on a phone

**M2:** filters, scanned-lease path (canvas and OCR), device and accessibility tests done, Build Log tab with only real entries, fallback video and pitch rehearsed.

---

## 8. Cut order and never-cut list
**Cut in this order (spec 14):** Build Log tab, OCR path, deep-review toggle, municipality-related UI polish. Then filters, then the capitalized-name highlighter.
**Never cut:** scrubber and preview, quote verification, disclaimer, Free Help panel, Clear everything.

## 9. Open questions you own (spec Appendix G)
1. Which campus or regional legal-aid links are confirmed active (Task 4).
2. Real prize rules and eligibility (check the hackathon site; statewide scope may reduce the campus-specific angle, so add a clearly labeled campus resource entry without claiming campus legal analysis, spec 17.1).
3. Whether OCR ships tonight or is deferred (decide at the end of M1).

## 10. Communication
S1 (0:30), S2 (about 5:00), S3 (end of M2). Message A during the build **only** if the contract must change or an API response doesn't match the schema in a way you can't handle in the UI. A should not need to ask you for anything else.
