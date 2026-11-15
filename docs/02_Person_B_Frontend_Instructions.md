# Person B: Frontend Instructions

**Read `01_LeaseTrap_Project_Brief.md` first.** This file is your personal task list.

**Your role:** everything the user sees. Upload, scorecard, clause cards, email generator, and the Vercel deploy.
**Person A's role:** the backend API, Gemini prompt, legal knowledge base, and sample result JSON. You never need to touch those.
**Time budget:** 3 hours total, and the first deploy at about 2:35.

---

## 1. Your files (only edit these)

| File | Purpose |
|---|---|
| `app/page.tsx` | Main page; holds state (idle / loading / error / result) |
| `app/layout.tsx` | Page shell, title, footer disclaimer |
| `components/UploadZone.tsx` | Drag-and-drop, file picker, validation, Load Sample button |
| `components/Scorecard.tsx` | Banner: score, R/Y/G counts, $ overcharge, summary |
| `components/ClauseCard.tsx` | Expandable card for one clause |
| `components/EmailPanel.tsx` | Tone toggle, generated email, Copy button |
| `lib/email.ts` | Pure function that builds the email text |
| `public/samples/sample-lease.pdf` | The sample lease (you create it) |

**Do not edit:** `lib/types.ts`, `lib/api.ts`, `lib/kb.ts`, `lib/prompt.ts`, `app/api/**`. If you need a change there, message Person A.

---

## 2. What you can rely on from Person A

- `lib/types.ts` with `Clause`, `AuditResult`, `Severity`
- `lib/api.ts` with:
  ```ts
  analyzeLease(file: File): Promise<AuditResult>  // throws Error(message); show message to the user
  loadSample(): Promise<AuditResult>
  ```
  At first these return the mock data, so you can build everything against the final function names. Later A swaps in the real API and **your code won't change**.
- `public/samples/mock-result.json` (7 clauses: 4 RED, 2 YELLOW, 1 GREEN)

**Score direction:** `safety_score` 100 = safe, 0 = predatory. Low scores should look bad (red), high scores good (green).

---

## 3. Your tasks, in order

### Task 0: Setup (0:00 to 0:20)
- [ ] Connect the GitHub repo to **Vercel** (free Hobby plan) and deploy the hello-world page.
- [ ] In Vercel project settings, add env vars `GEMINI_API_KEY` and `GEMINI_MODEL`. Person A will give you the values privately (not in chat history on shared screens, never in the repo).
- [ ] Review `lib/types.ts` and `mock-result.json` with A. Raise concerns now, since they freeze after 15 minutes.

### Task 1: Create the sample lease (0:20 to 0:35). Person A is waiting on this.
1. Ask any free AI chat to write a realistic **5 to 6 page** Amherst, MA student apartment lease. Include these seeded problems:
   - A late fee of $50 if rent is paid after the 5th
   - A disguised "turnover stipend" of $400 at move-in
   - A security deposit larger than one month's rent (e.g., $2,400 on $1,600 rent)
   - An extra non-refundable "professional cleaning fee"
   - "Landlord may enter at any time without notice"
   - A 90-day written notice for non-renewal with automatic 12-month renewal
   - Joint and several liability for all roommates
   - One good clause (deposit held in a separate interest-bearing account)
2. Paste it into Google Docs, then File > Download > PDF.
3. Save as `public/samples/sample-lease.pdf` and keep it **under 3 MB**.
4. Commit, push, and tell Person A.

### Task 2: Landing page and upload (0:35 to 1:05)
- [ ] Layout: title "LeaseTrap", one-line tagline, then `UploadZone`.
- [ ] Drag-and-drop zone plus click-to-browse. Accept only `application/pdf`.
- [ ] **Validation:** reject non-PDFs and files over **3 MB** with a friendly message (e.g., "That file is 5.2 MB. Please upload a PDF under 3 MB.").
- [ ] Privacy note under the dropzone: *"Don't upload leases containing sensitive personal info (SSN, bank numbers)."*
- [ ] **"Load Sample Lease" button** that calls `loadSample()`.
- [ ] Page state machine in `app/page.tsx`: `idle | loading | error | result`.
- [ ] Loading state: a spinner and text like "Analyzing your lease... this can take up to 30 seconds."
- [ ] Error state: shows the error message, a **Retry** button, and a **"Use sample instead"** button.
- [ ] Footer on every page: *"Educational tool, not legal advice."*

**Done when:** clicking Load Sample displays the (temporary) result and errors show properly.

### Task 3: Scorecard and clause cards (1:05 to 1:45)
**Banner (`Scorecard.tsx`)**
- [ ] Large safety score with color: under 40 red, 40 to 69 amber, 70+ green.
- [ ] Three pill counters: RED / YELLOW / GREEN counts (computed from `clauses`).
- [ ] **Estimated illegal overcharge:** `clauses.filter(c => c.severity === "RED").reduce((sum, c) => sum + c.dollar_amount, 0)`, formatted as currency, e.g. "$1,250 in potentially illegal charges". Compute it in code and never ask the AI.
- [ ] Show `summary` text.

**Clause cards (`ClauseCard.tsx`)**
- [ ] Collapsed: severity badge (red/amber/green), category chip, title.
- [ ] Expanded: verbatim quote (blockquote style), explanation, citation, suggested fix.
- [ ] Sort order: RED first, then YELLOW, then GREEN.
- [ ] Checkbox on RED and YELLOW cards only ("Include in email").
- [ ] Use `lucide-react` icons (e.g., `AlertOctagon`, `AlertTriangle`, `CheckCircle2`, `ChevronDown`).
- [ ] Never rely on color alone: include the text label RED / YELLOW / GREEN in the badge.

**Done when:** the mock data renders correctly, expand and collapse work, and checkboxes toggle.

### Task 4: Email generator (1:45 to 2:20)
**`lib/email.ts`**: a pure function:
```ts
export type Tone = "diplomatic" | "firm";
export function buildEmail(selected: Clause[], tone: Tone): string;
```
- Tone only changes wording, not facts.
- Greeting uses a placeholder: `Dear [Landlord Name],`
- Loop over `selected`, listing for each: title, citation, and suggested fix. Don't invent facts beyond what's in the clause.
- **Diplomatic:** collaborative language ("I'd appreciate your help updating a few terms so the lease aligns with Massachusetts requirements").
- **Firm:** direct and statute-focused ("These provisions conflict with the cited Massachusetts law, and I request that they be amended before I sign").
- Closing with `[Your Name]` and a thanks line.
- Don't quote the entire original clause unless short. Reference by title.

**`EmailPanel.tsx`**
- [ ] A sticky bottom panel or right-hand drawer.
- [ ] Shows "N clauses selected"; disabled with a hint if none are selected.
- [ ] Tone toggle (Diplomatic / Firm).
- [ ] Editable textarea with the generated email (so students can tweak it).
- [ ] **Copy to Clipboard** button using `navigator.clipboard.writeText`, with a "Copied!" confirmation for 2 seconds.

**Done when:** selecting 2 clauses shows a correct email, the tone switch changes wording, and Copy works.

**If you're behind at 2:00:** ship one tone only, then only RED checkboxes, then GREEN as a plain list. Never cut the Load Sample button.

### Task 5: Integration and deploy (2:20 to 3:00)
- [ ] Pull Person A's latest. Run `npm run build` and fix any type errors in your files.
- [ ] Push to `main`. Vercel auto-deploys.
- [ ] Verify env vars are set in the Vercel dashboard.
- [ ] While A smoke-tests the live URL, fix what they report.
- [ ] Final tag: `git tag v1-prototype && git push --tags` (do this together with A).

---

## 4. Handy guidance

**Styling:** plain Tailwind only. Suggested palette: red-600 / amber-500 / green-600 for severity, slate for text, white cards on slate-50 background. Keep it clean; polish is a post-deploy patch.

**File upload code sketch**
```ts
const MAX = 3 * 1024 * 1024;
function validate(file: File): string | null {
  if (file.type !== "application/pdf") return "Please upload a PDF file.";
  if (file.size > MAX) return "That file is over 3 MB. Please upload a smaller PDF.";
  return null;
}
```

**Page state sketch**
```ts
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "result"; data: AuditResult };
```

**Common pitfalls**
- Add `"use client"` at the top of any component using state or event handlers.
- Don't hardcode clause content in the UI. Everything must come from the `AuditResult`.
- Handle `clauses` being an empty array gracefully (show "No issues found").
- Test with the mock JSON edited to contain: 0 RED clauses, 10+ clauses, and a very long quote. The UI shouldn't break.

---

## 5. Your daily-driver checklist

- [ ] Vercel connected, env vars set
- [ ] Sample lease PDF created, under 3 MB, committed
- [ ] Upload zone with validation + Load Sample button
- [ ] Loading, error, retry, and sample-fallback states
- [ ] Footer disclaimer visible
- [ ] Score banner + R/Y/G counts + $ overcharge computed in code
- [ ] Expandable clause cards, sorted by severity
- [ ] Checkboxes on RED/YELLOW cards
- [ ] Email generator with tone toggle + Copy
- [ ] `npm run build` passes, `main` deployed, live URL tested on desktop and phone

---

## 6. Communication with Person A

- **Message A when:** the sample lease is pushed, you need a change to the contract, or something looks wrong in the API data.
- **A will message you when:** `sample-result.json` is saved, the real `lib/api.ts` is live, or the API error format changes.
- Keep a running `devlog.md` note any time something breaks or you try something that fails. Real notes are the raw material for the Dev Log patch later.
