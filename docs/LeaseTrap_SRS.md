# Software Requirements Specification (SRS)

## LeaseTrap: AI Student Lease Auditor

| | |
|---|---|
| **Version** | 1.0 (v1 prototype) |
| **Team** | Person A (Backend / AI / Legal), Person B (Frontend) |
| **Target** | Deployed prototype in about 3 hours, at $0 cost |
| **Jurisdiction** | Massachusetts (UMass Amherst focus) |

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for LeaseTrap v1, a web application that audits off-campus student leases against Massachusetts tenant law and helps students push back on problematic clauses.

### 1.2 Scope
A student uploads a lease PDF (or loads a built-in sample). The system analyzes it with the Gemini API, shows a Red / Yellow / Green risk scorecard with an estimated illegal overcharge, and generates a polite email to the landlord for the clauses the student selects.

**In scope (v1):** F1 Upload + AI audit, F2 Risk scorecard, F3 Pushback email generator.

**Out of scope (post-deploy patches):** Dev Log tab, control lease, addendum document, filtering, gauge animation, mobile polish, multi-state support, user accounts, database, custom PDF viewer.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| RED | Clause likely illegal or void under MA law |
| YELLOW | Legal but predatory, negotiable, or uncertain |
| GREEN | Standard or tenant-friendly clause |
| KB | Legal knowledge base embedded in the AI prompt |
| Sample | Pre-computed audit result served as a static file |
| M.G.L. | Massachusetts General Laws |

### 1.4 References
- M.G.L. c. 186 (Estates for Years and at Will), verified on malegislature.gov
- Google AI Studio documentation (Gemini API, structured output, current terms of use)
- Vercel Hobby plan limits

---

## 2. Overall Description

### 2.1 Product perspective
A standalone, stateless web app. There is no database and no authentication. The browser talks to one server endpoint, which calls Gemini.

```
Browser UI --(PDF, multipart)--> POST /api/audit --> Gemini API
Browser UI <--(AuditResult JSON)-- /api/audit
Browser UI --(Load Sample)--> /samples/sample-result.json (static)
```

### 2.2 Users
University students signing off-campus leases. No technical or legal background is assumed.

### 2.3 Operating environment
- Modern web browsers (desktop Chrome primary, one phone browser for sanity check)
- Hosted on Vercel Hobby (serverless), Next.js App Router

### 2.4 Constraints
- **Cost:** only free tiers (Gemini free tier, Vercel Hobby, GitHub).
- **Body size:** Vercel Hobby caps request bodies near 4.5 MB, so uploads are limited to 3 MB.
- **Timeout:** the audit route sets `maxDuration = 60`.
- **Rate limits:** Gemini free tier has per-minute and per-day limits.
- **Time:** the whole v1 must be built and deployed in about 3 hours by two people.

### 2.5 Assumptions and dependencies
- The Gemini model name changes over time, so it is stored in the `GEMINI_MODEL` env var (check AI Studio for the current Flash-tier model).
- The KB contains only citations verified on malegislature.gov.
- Gemini's free-tier terms may allow Google to use inputs to improve its products (confirm current terms), so users are warned not to upload sensitive personal data.

---

## 3. Functional Requirements

### 3.1 F1: Upload and AI audit
| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Accept one `.pdf` of 3 MB or less via drag-and-drop or file picker; reject other types and oversize files with a clear message | Must |
| FR-2 | Provide a "Load Sample Lease" button that shows a pre-computed result without calling any API | Must |
| FR-3 | The server shall validate the file, send the PDF to Gemini with the KB prompt and a JSON response schema, and return validated `AuditResult` JSON | Must |
| FR-4 | Show a loading state during analysis, and an error state with Retry and "Use sample instead" | Must |
| FR-11 | Return distinct, user-safe errors for bad file (400), too large (413), rate limit (429), and model or parse failure (500) | Should |

### 3.2 F2: Risk scorecard
| ID | Requirement | Priority |
|---|---|---|
| FR-5 | Display safety score (0 to 100, where 100 is safe), summary text, and counts of RED, YELLOW and GREEN clauses | Must |
| FR-6 | Compute estimated illegal overcharge in code as the sum of `dollar_amount` across RED clauses; never rely on the AI to add | Must |
| FR-7 | Show each clause as an expandable card with severity badge, title, verbatim quote, explanation, citation and suggested fix | Must |
| FR-12 | Sort clauses RED, then YELLOW, then GREEN | Should |
| FR-13 | Handle an empty clause list ("No issues found") without breaking | Should |

### 3.3 F3: Pushback email generator
| ID | Requirement | Priority |
|---|---|---|
| FR-8 | RED and YELLOW cards have an "include in email" checkbox | Must |
| FR-9 | Build the email from a code template (no AI call) using selected clauses, with a Copy to Clipboard button and a "Copied!" confirmation | Must |
| FR-14 | Offer "Diplomatic" and "Firm" tones that change wording only, not facts | Should |
| FR-15 | Show the email in an editable textarea; disable generation when no clause is selected | Should |

### 3.4 Global
| ID | Requirement | Priority |
|---|---|---|
| FR-10 | Show the footer "Educational tool, not legal advice." on every page | Must |
| FR-16 | Show a privacy note near the upload zone warning against uploading sensitive personal information | Should |

---

## 4. Data Requirements

### 4.1 Frozen data contract (`lib/types.ts`)
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
  error: string;
}
```

### 4.2 Data handling
- No lease content is persisted by the application.
- The PDF exists only in memory during the request.
- Results live in browser state only.

---

## 5. External Interface Requirements

### 5.1 User interface
- Single-page layout: hero with upload zone, then scorecard, clause list, and email panel.
- Severity is conveyed by color and a text label (never color alone).
- Responsive layout that doesn't break on a phone.

### 5.2 API interface
**`POST /api/audit`**
- Request: `multipart/form-data`, field `file` (PDF, 3 MB or less)
- 200: `AuditResult`
- 400 / 413 / 429 / 500: `ApiError`

**Client helpers (`lib/api.ts`)**
```ts
analyzeLease(file: File): Promise<AuditResult>; // throws Error(message)
loadSample(): Promise<AuditResult>;            // fetches /samples/sample-result.json
```

### 5.3 Third-party interface
- Gemini API via `@google/genai`, with `responseMimeType: "application/json"` and `responseSchema` matching `AuditResult`.
- Config via env vars `GEMINI_API_KEY` and `GEMINI_MODEL`.

---

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Cost | Total spend is $0; all tools are free tier |
| NFR-2 | Performance | Sample loads in under 1 s; real analysis under 30 s typical, 60 s hard limit |
| NFR-3 | Reliability | The sample path works with no API or network access beyond the app itself |
| NFR-4 | Security | API key only in env vars (`.env.local`, Vercel settings); never in the repo or sent to the client |
| NFR-5 | Privacy | No storage of lease data; upload-screen warning about sensitive info |
| NFR-6 | Accuracy | Only verified citations; if unsure the model cites "M.G.L. c. 186" generally and marks the clause YELLOW |
| NFR-7 | Usability | The main flow is reachable within 2 clicks of the landing page |
| NFR-8 | Compatibility | Works on current desktop Chrome and one mobile browser |
| NFR-9 | Maintainability | Legal content isolated in `lib/kb.ts` so another jurisdiction can be added by swapping the file |

---

## 7. Legal Knowledge Base Requirements

The KB is limited to rules the team has verified on malegislature.gov. Planned topics:

1. **Upfront charges:** first month, last month, security deposit (max one month's rent), and new lock/key cost. Other fees (cleaning, pet deposit, application fee, disguised "stipends") are RED.
2. **Deposit handling:** separate interest-bearing Massachusetts account; receipt and account details within 30 days.
3. **Late fees:** none until rent is 30 days overdue.
4. **Landlord entry:** unannounced entry clauses are invalid; use "reasonable notice" wording and avoid asserting a fixed hour count.
5. **Deposit deductions:** unpaid rent, damage beyond normal wear and tear, certain unpaid utilities.
6. **Attorney's fees and waivers:** one-sided fee-shifting and waivers of statutory rights are unenforceable.

**Prompt rules:** use only the KB; never cite another state's law; quote clauses verbatim; flag disguised fees by substance, not label; if unsure, cite "M.G.L. c. 186" generally and mark YELLOW. Lawful: first plus last month plus deposit (at most 1 month) plus lock/key.

Any unverified citation or claim must be dropped or generalized.

---

## 8. Free Tool Stack

| Need | Tool |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling / icons | Tailwind CSS + lucide-react |
| AI | Gemini API free tier (`@google/genai`) |
| Hosting | Vercel Hobby |
| Source control | GitHub |
| Sample lease creation | Free AI chat + Google Docs PDF export |

---

## 9. Acceptance Criteria

1. The production URL loads and "Load Sample" shows the full scorecard.
2. A real PDF upload returns a scorecard, or a graceful error with retry.
3. Selecting 2 clauses generates a correct email that copies to the clipboard.
4. Uploading a non-PDF or a file over 3 MB shows a clear message.
5. No secrets in the repo; the footer disclaimer is visible.
6. `npm run build` passes and the app is tagged `v1-prototype`.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini rate limit or model rename | Audit fails | Model in env var; one tester at a time; sample needs no API |
| Wrong legal citation | Credibility loss | Verify on malegislature.gov; fallback to general cite + YELLOW |
| Vercel body-size limit | Upload fails | 3 MB client-side limit with clear message |
| Malformed model JSON | UI crash | `responseSchema`, try/catch, friendly error, sample fallback |
| Venue Wi-Fi failure in demo | Demo fails | Static sample result |
| Scanned or poor-quality PDFs | Missed clauses | Test a second PDF; note limits in the post-deploy backlog |

---

## 11. Post-Deployment Backlog (not part of v1)

1. Dev Log tab built from real failures recorded in `devlog.md`
2. Prompt hardening for disguised fees
3. Control (clean) lease to check for false positives
4. Lease amendment addendum and longer email
5. Mobile polish, severity filter, score gauge
6. Improved privacy notice and rate-limit messaging

---

## 12. Disclaimer

LeaseTrap is an educational tool and does not provide legal advice. Output may contain errors, and users should consult a qualified professional or campus legal services for decisions.
