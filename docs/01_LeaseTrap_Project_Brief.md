# LeaseTrap: Project Brief (Shared)

**Audience:** both teammates. Read this fully before touching code.
**Team:** Person A (Backend / AI / Legal) and Person B (Frontend).
**Goal:** a fully working v1 prototype, deployed on Vercel in about 3 hours, at $0 cost. Everything else is a post-deploy patch.

---

## 1. What we're building

LeaseTrap is an AI lease auditor for UMass Amherst students. A student uploads an off-campus lease PDF (or clicks "Load Sample Lease") and gets:

1. **A Red / Yellow / Green risk scorecard** checked against Massachusetts tenant law (M.G.L. c. 186).
2. **An estimated illegal overcharge in dollars**, computed in code, not by the AI.
3. **A polite pushback email** to the landlord, built from a code template using the clauses the student selects.

Footer on every page: *"Educational tool, not legal advice."*

### The three v1 features
| # | Feature | Owner |
|---|---|---|
| F1 | Upload + AI audit (Gemini reads the PDF, returns structured JSON) | A (API) + B (upload UI) |
| F2 | Risk scorecard (score, R/Y/G counts, $ overcharge, expandable clause cards) | B |
| F3 | Pushback email generator (checkboxes, tone toggle, copy button) | B |

### Explicitly NOT in v1
Dev Log tab, control lease, addendum document, filtering, gauge animation, mobile polish, multi-state support, accounts, database. These come after the first deploy (see section 10).

---

## 2. Tech stack (all free)

| Need | Tool |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling / icons | Tailwind CSS + `lucide-react` (no Shadcn: setup costs too much time) |
| AI | Gemini API free tier via `@google/genai`, key from Google AI Studio |
| Hosting | Vercel Hobby |
| Source control | GitHub |
| Sample lease creation | Any free AI chat + Google Docs "Download as PDF" |

No database, no auth, no paid services.

---

## 3. Architecture

```
Browser (B's UI)
   |  upload PDF (FormData, field "file")
   v
POST /api/audit  (A)
   |  validate -> base64 -> Gemini (KB prompt + responseSchema)
   v
AuditResult JSON  --> Scorecard (B) --> Email panel (B)

"Load Sample" button --> GET /samples/sample-result.json (static, no API)
```

- The overcharge total is computed in the frontend (sum of `dollar_amount` on RED clauses).
- The email is built from a code template in `lib/email.ts`, with no second AI call.
- The sample path never touches the network or Gemini, so it is the demo insurance.

---

## 4. Frozen data contract

`lib/types.ts` is written in Phase 0 and **frozen after 15 minutes**. If either of you needs a change, tell the other first.

```ts
export type Severity = "RED" | "YELLOW" | "GREEN";

export interface Clause {
  id: string;
  severity: Severity;
  category: "Deposit" | "Fees" | "Entry" | "Renewal" | "Liability" | "Other";
  title: string;
  verbatim_quote: string;
  explanation: string;
  citation: string;
  suggested_fix: string;
  dollar_amount: number; // 0 if not a money issue
}

export interface AuditResult {
  safety_score: number; // 0 = predatory, 100 = safe
  summary: string;
  clauses: Clause[];
}

export interface ApiError {
  error: string; // human-readable, safe to show the user
}
```

**Score direction:** 100 = safe, 0 = predatory. Both of you must follow this. The UI colors the score accordingly (low = red).

---

## 5. API contract (A builds, B consumes)

### `POST /api/audit`
- **Request:** `multipart/form-data` with one field `file` (a PDF, 3 MB or less).
- **Success (200):** `AuditResult` JSON.
- **Errors:** `ApiError` JSON with these statuses:
  - `400`: not a PDF, missing file
  - `413`: file too large
  - `429`: Gemini rate limit hit ("Too many requests, try again in a minute")
  - `500`: model or parsing failure

### Client helper (A writes, B calls): `lib/api.ts`
```ts
export async function analyzeLease(file: File): Promise<AuditResult>; // throws Error(message) on failure
export async function loadSample(): Promise<AuditResult>;            // fetches /samples/sample-result.json
```
In Phase 0, A commits a **stub** of this file that returns the mock JSON, so B can code against the final function names immediately. A swaps in the real fetch later and B changes nothing.

### Static files
- `public/samples/mock-result.json`: hand-made, written in Phase 0, used by B while building the UI
- `public/samples/sample-result.json`: real Gemini output on the sample lease, saved by A around hour 1:45
- `public/samples/sample-lease.pdf`: the sample lease, created by B

---

## 6. Functional requirements (acceptance checklist)

| ID | Requirement |
|---|---|
| FR-1 | Accept one `.pdf` of 3 MB or less via drag-and-drop or file picker; reject other types or sizes with a clear message |
| FR-2 | "Load Sample Lease" button shows a pre-computed result without calling the API |
| FR-3 | Server sends the PDF to Gemini with the MA legal reference and a JSON schema, returns validated JSON |
| FR-4 | Loading state during analysis; readable error state with Retry and "Use sample instead" |
| FR-5 | Dashboard shows safety score, summary, and RED/YELLOW/GREEN counts |
| FR-6 | Estimated illegal overcharge = sum of `dollar_amount` across RED clauses, computed in code |
| FR-7 | Each clause is an expandable card: severity badge, title, verbatim quote, explanation, citation, suggested fix |
| FR-8 | RED and YELLOW cards have an "include in email" checkbox |
| FR-9 | Email built from a code template using selected clauses, Diplomatic and Firm tones, Copy button |
| FR-10 | Footer disclaimer visible on every page |

### Non-functional
- **Cost:** $0.
- **Performance:** sample loads in under 1 s; a real analysis should take under 30 s (hard cap 60 s).
- **Reliability:** the sample path must work offline from the API.
- **Privacy:** no lease data is stored by us. Free-tier Gemini may use inputs to improve Google products (A: confirm the current terms in AI Studio), so show a note on the upload screen: *"Don't upload leases containing sensitive personal info (SSN, bank numbers)."*
- **Accuracy:** only verified citations. If unsure, the model cites "M.G.L. c. 186" generally and marks the clause YELLOW.

---

## 7. Repo layout and ownership

```
leasetrap/
  app/
    page.tsx                 <- B
    layout.tsx               <- B
    api/audit/route.ts       <- A
  components/                <- B (all)
  lib/
    types.ts                 <- SHARED, frozen
    api.ts                   <- A (stub first, real later)
    kb.ts                    <- A
    prompt.ts                <- A
    email.ts                 <- B
  public/samples/
    mock-result.json         <- SHARED (Phase 0)
    sample-result.json       <- A
    sample-lease.pdf         <- B
  devlog.md                  <- both (append real failures as they happen)
  .env.local                 <- A (NEVER committed)
```

**Git rules**
- Each person edits only their own files. Shared files change only after a quick conversation.
- Commit small, push often. Pull before you push.
- Use `main` directly for your own folders, or short branches merged into `main` (avoid long-lived branches).
- `.env.local` must be in `.gitignore`. Check this before the first push.

---

## 8. Timeline (3 hours)

### Phase 0: Joint setup (0:00 to 0:20)
| Task | Who |
|---|---|
| Create GitHub repo; `npx create-next-app@latest` (TypeScript, Tailwind, App Router); `npm i @google/genai lucide-react` | A |
| Connect repo to Vercel, deploy hello world, add env vars `GEMINI_API_KEY` and `GEMINI_MODEL` | B |
| Get Gemini key from Google AI Studio; create `.env.local`; confirm `.gitignore` | A |
| Write `lib/types.ts`, `mock-result.json`, stub `lib/api.ts` (A writes, B reviews, 10 min together) | Both |

### Phase 1: Parallel build (0:20 to 1:45)
| Time | Person A | Person B |
|---|---|---|
| 0:20-0:45 | Legal KB in `lib/kb.ts`; verify citations | Create the sample lease PDF and hand to A |
| 0:45-1:25 | `POST /api/audit` | Landing page, dropzone, validation, loading/error states, footer |
| 1:25-1:45 | Test with sample lease, tune prompt, save `sample-result.json` | Scorecard banner + clause cards (using mock JSON) |

### Phase 2: Parallel build, continued (1:45 to 2:20)
| Person A | Person B |
|---|---|
| Real `lib/api.ts`, retry and 429 handling, stress test with a second PDF | Email generator: checkboxes, tone toggle, template, Copy button |

### Phase 3: Integration and deploy (2:20 to 3:00)
| Time | Task | Who |
|---|---|---|
| 2:20-2:35 | Merge, `npm run build`, fix type errors | Both |
| 2:35-2:45 | Push to `main`, confirm Vercel env vars | B |
| 2:45-2:55 | Smoke test the live URL (desktop + phone) | A tests, B fixes |
| 2:55-3:00 | Tag `v1-prototype`, freeze | Both |

### Fallback order if behind at 2:00
1. Drop the tone toggle (ship one tone)
2. Drop YELLOW checkboxes (RED only)
3. Show GREEN clauses as a plain list

**Never cut:** the Load Sample button or the pre-computed JSON.

---

## 9. Definition of done for v1

1. The production URL loads and "Load Sample" shows the full scorecard.
2. A real PDF upload returns a scorecard (or a graceful error with retry).
3. Selecting 2 clauses generates a correct email and copies it to the clipboard.
4. No secrets in the repo; the footer disclaimer is visible.

---

## 10. After the first deploy (patch backlog, in order)

1. **Dev Log tab:** static page from real notes in `devlog.md`. Only log failures that actually happened.
2. **Prompt hardening:** test disguised fees ("turnover stipend," "redecorating fee").
3. **Control lease:** a clean lease to prove there are no false positives.
4. **Addendum document** and a more detailed email.
5. **Mobile polish, severity filter, score gauge.**
6. **Privacy notice** and nicer rate-limit messaging.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Gemini free-tier rate limit or model rename | Model name in `GEMINI_MODEL`; only one person calls the live API at a time; sample path needs no API |
| Wrong legal citation | A verifies each on malegislature.gov; fallback is "M.G.L. c. 186" + YELLOW |
| Vercel body-size error | 3 MB client-side limit with a clear message |
| Bad JSON from model | `responseSchema` + try/catch + friendly error + sample fallback |
| Venue Wi-Fi dies in demo | Sample result is a static file served by the app |

---

## 12. Demo script (2 minutes, for later)

1. **Hook (20s):** a real illegal-fee story relevant to UMass students.
2. **Demo (60s):** Load Sample, show the score and dollar overcharge, open one red card, check two boxes, generate and copy the email.
3. **Process (30s):** open the Dev Log with one real failure and its fix (after patch 1).
4. **Close (10s):** "Scale to other states by swapping the knowledge file."

---

## Appendix: Starter `mock-result.json`

Placeholder data for B's UI work. Citations here are **placeholders** and A will verify the real ones before they reach `sample-result.json`.

```json
{
  "safety_score": 28,
  "summary": "This lease has 4 likely illegal charges or terms and 2 negotiable risks.",
  "clauses": [
    {
      "id": "1", "severity": "RED", "category": "Fees",
      "title": "Late fee after day 5",
      "verbatim_quote": "A $50 late fee applies if rent is received after the 5th of the month.",
      "explanation": "Massachusetts generally bars late fees until rent is 30 days overdue.",
      "citation": "M.G.L. c. 186 § 15B",
      "suggested_fix": "Remove the clause or move the late fee to 30 days after the due date.",
      "dollar_amount": 50
    },
    {
      "id": "2", "severity": "RED", "category": "Fees",
      "title": "Turnover stipend",
      "verbatim_quote": "Tenant agrees to pay a $400 turnover stipend at move-in.",
      "explanation": "This is a disguised extra fee. Upfront charges are limited to first month, last month, a security deposit, and a lock/key cost.",
      "citation": "M.G.L. c. 186 § 15B",
      "suggested_fix": "Remove the stipend.",
      "dollar_amount": 400
    },
    {
      "id": "3", "severity": "RED", "category": "Entry",
      "title": "Entry without notice",
      "verbatim_quote": "Landlord may enter the unit at any time without notice.",
      "explanation": "Tenants are entitled to quiet enjoyment; entry requires reasonable notice except in emergencies.",
      "citation": "M.G.L. c. 186 § 15",
      "suggested_fix": "Replace with entry on reasonable advance notice, except emergencies.",
      "dollar_amount": 0
    },
    {
      "id": "4", "severity": "RED", "category": "Deposit",
      "title": "Security deposit over one month",
      "verbatim_quote": "Security deposit: $2,400 (monthly rent is $1,600).",
      "explanation": "A security deposit may not exceed one month's rent.",
      "citation": "M.G.L. c. 186 § 15B",
      "suggested_fix": "Reduce the deposit to $1,600.",
      "dollar_amount": 800
    },
    {
      "id": "5", "severity": "YELLOW", "category": "Liability",
      "title": "Joint and several liability",
      "verbatim_quote": "All tenants are jointly and severally liable for the full rent.",
      "explanation": "Legal, but you can be charged for a roommate's unpaid share.",
      "citation": "M.G.L. c. 186",
      "suggested_fix": "Ask for individual liability or a roommate agreement.",
      "dollar_amount": 0
    },
    {
      "id": "6", "severity": "YELLOW", "category": "Renewal",
      "title": "90-day auto-renewal notice",
      "verbatim_quote": "Lease renews for 12 months unless tenant gives 90 days written notice.",
      "explanation": "Long notice windows are easy to miss and lock you in.",
      "citation": "M.G.L. c. 186",
      "suggested_fix": "Ask for a 30 to 60 day window or month-to-month after the term.",
      "dollar_amount": 0
    },
    {
      "id": "7", "severity": "GREEN", "category": "Deposit",
      "title": "Deposit held in escrow",
      "verbatim_quote": "Deposit will be held in a separate interest-bearing account.",
      "explanation": "This matches the statutory requirement.",
      "citation": "M.G.L. c. 186 § 15B",
      "suggested_fix": "None needed.",
      "dollar_amount": 0
    }
  ]
}
```
