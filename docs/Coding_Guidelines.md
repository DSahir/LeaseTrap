# LeaseTrap Coding Guidelines (Both Persons)

These rules apply to **everyone, in every file**. They exist to keep two people working in parallel without conflicts, and to protect user privacy and the legal accuracy of the app. When a rule here conflicts with speed, the rule wins, except for the "Never cut" items in the task files, which are rules too.

Source of truth for product behavior: the *LeaseTrap Full Project Specification (v2)*. Source of truth for who owns which file: `Person_A_Tasks.md` and `Person_B_Tasks.md`.

---

## 1. The ten rules that matter most

1. **Raw lease data never leaves the browser.** Only scrubbed text goes to the server.
2. **Never log lease text, model output, request bodies or response bodies.** Not in dev, not "temporarily".
3. **No browser storage** (`localStorage`, `sessionStorage`, IndexedDB, cookies) for lease text, the placeholder map or results.
4. **Secrets live only in env vars.** Never commit `.env*`, never paste keys in chat, issues, commits or screenshots.
5. **Never change `lib/contract.ts` alone.** Tell the other person first.
6. **Edit only the files you own.** Ownership is in the task files.
7. **Every model output is untrusted.** Validate with zod, escape on render, never use `dangerouslySetInnerHTML`.
8. **Every legal citation must come from the verified table** (`legal/refs.json`). No citations from memory, anywhere (code, prompts, mocks, UI copy).
9. **Never state verdicts.** Use "may conflict with", never "is illegal", "void" or "unenforceable".
10. **Never invent build-log entries.** Log real events only.

---

## 2. Tech stack and tooling

| Area | Rule |
|---|---|
| Language | TypeScript with `"strict": true`. No `any` (use `unknown` and narrow). `// @ts-ignore` needs a comment explaining why |
| Framework | Next.js App Router. Server code only in `app/api/**` and `lib/` modules imported by routes |
| Styling | Tailwind utility classes only. No extra CSS libraries |
| Icons | `lucide-react` only |
| Validation | `zod`. Schemas live in `lib/contract.ts` and nowhere else |
| PDF | `pdfjs-dist` in the browser only |
| OCR (M2) | `tesseract.js` in the browser only |
| Cost | Free tiers only. No paid APIs, no billing enabled on the Gemini key |
| Dependencies | Add a new package only if it saves real time. Pin versions (no `latest`). Tell the other person if it affects the shared build. Prefer self-hosting fonts/libs; **no analytics or ad trackers** |
| Formatting | Prettier defaults and the ESLint config that `create-next-app` generates. Run `npm run lint` before pushing |

---

## 3. Git workflow

- **Branches:** work on your own short-lived branch (`a/<task>` or `b/<task>`), or on `main` only inside your own folders. Never leave a branch unmerged for more than about an hour.
- **Before every push:** `git pull --rebase origin main`, then `npm run build` locally. **Never push a broken build to `main`**, because Vercel deploys it.
- **Commits:** small and frequent. Format: `type(scope): short message`
  - Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`
  - Examples: `feat(scrub): redact dotted phone numbers`, `fix(api): drop unknown legal ref ids`
- **Conflicts:** if you hit a conflict in a file you don't own, stop and message the owner. Don't resolve it by overwriting.
- **Tags:** `v1-prototype` after the first verified deploy. Tag later deploys `v1.1`, `v1.2`...
- **Never commit:** `.env*`, real leases, API keys, `node_modules`, large PDFs (keep sample PDFs under 4 MB).
- **Before making the repo public:** run a secret scan (`git grep -n "AIza"`, check `git ls-files | grep -i env`). If a key ever leaks: rotate it immediately (spec 6.15).

---

## 4. Ownership and the frozen contract

- The ownership tables in the task files are binding. If you need a change in the other person's file, **message them**; don't edit it.
- `lib/contract.ts` is committed once by Person A in Phase 0 and then frozen.
  - Need a change? Message the other person, agree on it, change it in **one commit** that updates the contract, the server code and the client code together, and tell the other person to pull.
  - Never loosen a schema (for example, making a field optional) just to make an error go away.
- **Mocks and fixtures:** B owns `mock/*`. They must pass `AuditResponseSchema` / `EmailResponseSchema`. Placeholder citations in mocks must be labeled `MOCK` and never appear in the demo.

---

## 5. Privacy and security rules (spec 6)

### Both persons
- Treat every lease as sensitive, including sample leases while testing. Samples use **fictional** names and addresses only.
- Real leases (for the eval set) need explicit permission, redaction before use, and must never be committed to a public repo.
- Don't paste real lease text into chat tools, issues or screenshots.
- Never claim "anonymous". Say "we remove identifiers we can detect".

### Person B (browser)
- Extraction, scrubbing, quote verification and placeholder restore all run in the browser.
- The `placeholder -> original` map lives in memory only: never serialized, never in state that gets persisted, never sent. Clear it in "Clear everything" and on page unload.
- The request to `/api/audit` may contain **only** `text` (scrubbed), `municipality`, `tenancyType` and `deepReview`. Never add file names, original filenames, user-entered names or the map.
- The request to `/api/email` may contain only placeholder-based clause data, tone and notes.
- Render all model text through React. Never `dangerouslySetInnerHTML`, never `innerHTML`, never `eval`.
- Do not use third-party scripts, analytics or trackers on any page.
- Do not rely on "the model will ignore personal data". Redaction happens before sending, always.

### Person A (server)
- No request-body or model-output logging. Wrap handlers in try/catch and log **only an error code and route name**. Check framework defaults, middleware and error handlers for hidden logging.
- No file writes, databases or analytics events containing lease content.
- Validate and cap input before doing anything else (spec 11.2): JSON body, zod parse, 200,000-character limit.
- Rate-limit per IP and globally; support the `AUDIT_DISABLED` kill switch.
- Neutralize `<lease>` and `</lease>` inside input. Treat the lease as data, never instructions (spec 6.10).
- Return `Cache-Control: no-store` on API responses.
- API key is read from `process.env` on the server only. Never prefix it with `NEXT_PUBLIC_`, never return it, never include it in an error message.
- Keep billing **disabled** on the Gemini key.

---

## 6. TypeScript and code style

- **Naming:** `camelCase` for variables and functions, `PascalCase` for components and types, `UPPER_SNAKE_CASE` for constants and env var names, `kebab-case` for municipality slugs.
- **Files:** components `PascalCase.tsx`; lib modules `camelCase.ts`; one main export per file.
- **Functions:** small and pure where possible (scrubber, restore, verifyQuotes, email helpers are pure and testable). Side effects (fetch, DOM) stay at the edges.
- **No magic numbers:** limits (`25 MB`, `500 chars`, `200_000`) live in named constants in one place (`lib/config.ts` for B, `lib/limits.ts` for A).
- **Comments:** explain **why**, not what. Mark unverified assumptions with `// VERIFY:` and resolve every one before the demo.
- **No dead code or `console.log` left in committed code.** (A: especially nothing that could print content.)
- **Imports:** use the types and schemas from `lib/contract.ts`; don't redefine them.
- **Dates:** ISO strings (`YYYY-MM-DD`) in data. Human formatting only at render time.

---

## 7. Error handling

- **Never show raw errors, stack traces or server messages to users.** Show the friendly message mapped from the error `code`:

| Code | Status | User message |
|---|---|---|
| `BAD_REQUEST` | 400 | "We couldn't read that text. Please check it and try again." |
| `TOO_LARGE` | 413 | "That document is too long. Try pasting only the key sections." |
| `RATE_LIMITED` | 429 | "Too many requests, try again in a minute." |
| `MODEL_FAILURE` | 502 | "We couldn't analyze this text. Please try again." |
| `DISABLED` | 503 | "Analysis is temporarily unavailable. Try the demo lease." |

- Every async call has a timeout, a catch, a loading state and a retry or fallback.
- Server: model call timeout 50 s; retry **once** on invalid JSON; fallback model once on non-429 errors; then fail with `MODEL_FAILURE`.
- Client: always re-validate API responses with zod; on failure show the generic message, not the parse error.
- Handle empty states: no clauses, no selected clauses, empty text, non-lease document, non-English text.

---

## 8. Copy and content rules (spec 10.5, 16)

**Required**
- Footer on every page: "Educational tool, not legal advice." and "Legal reference last verified: {date}".
- Results screen always shows the disclaimer and the Free Help panel.
- Hedged language: "may conflict with", "my understanding is", "could you confirm".
- Zero-flag message: "No clauses were flagged. This doesn't mean the lease is safe."
- Email panel leverage note about competitive markets.

**Forbidden**
- "illegal", "void", "unenforceable" or "will not hold up in court" as verdicts.
- Predicting outcomes of disputes.
- Advising withholding rent or taking legal action.
- Threats of lawsuits or complaints in email drafts.
- Any invented facts about the user's situation.
- Saying the model is "trained on Massachusetts law". Say "grounded in a curated legal reference" (spec 8.1).
- Reading level above roughly 8th grade for user-facing text.

---

## 9. Legal content rules (mostly Person A, but everyone follows)

- A citation is allowed in code, prompts, mocks, demo data or UI **only if** it has a row in `legal/VERIFICATION_LOG.md` with an official URL, section, verifier and date.
- Write rules in **your own words**; don't paste statute text.
- If you cannot confirm a subsection, cite the general chapter or section, or drop the entry.
- Do not claim local (town) rules from memory. Local files exist only if sourced; otherwise the app says "No local rules loaded for this town."
- The model may cite **only by ID** from `<legal_pack>`. Unknown IDs are dropped server-side; clauses left without a valid reference become Low confidence and are capped at "worth asking about".
- Re-verify the date shown in the app footer whenever the pack changes.

---

## 10. Prompts

- Prompts live in `prompts/vN.md` and are loaded by `lib/prompt.ts`. Never edit a saved version in place; create `vN+1` with a changelog line (what changed and why).
- Record eval results per prompt version in `devlog/A.md`.
- Use a pinned model string from env vars. Never use "latest" aliases. Log the model name, date and settings with every eval run.
- Do not put real PII, real leases or secrets in prompts or eval files committed to the repo.

---

## 11. Testing

| What | Who | How |
|---|---|---|
| Scrubber, restore, quote verifier | B | Unit tests with the spec Appendix D inputs (including "keep" cases) |
| Zod schemas and mocks | B | A test that parses `mock/*.json` with the schemas |
| `runAudit` pipeline | A | `eval/run.ts` on sample leases, 3 to 5 runs each |
| Injection, edge inputs | A | `eval/leases/injection.txt`, empty, oversize, Spanish, non-lease, malformed JSON |
| Privacy | A leads, B assists | Network tab body check, log grep for seeded PII, empty browser storage |
| Accessibility | B | Keyboard-only pass, labels, 4.5:1 contrast, phone width |

Rules:
- **A change that touches scrubbing, validation or quote checking needs a test.**
- Don't tune prompts against only one lease; keep at least one unseen lease.
- Report results honestly, including misses (spec 12.3).
- Only **one person calls the live Gemini API at a time** (free-tier limits).
- Run `npm run build` and `npm run lint` before every push to `main`.

---

## 12. Accessibility rules (spec 10.2)

- Never rely on color alone: every status has an icon **and** a text label.
- 4.5:1 text contrast minimum.
- Every interactive element is keyboard reachable with a visible focus style.
- Icon-only buttons have `aria-label`. Expandable cards use `aria-expanded`. Form inputs have visible `<label>`s.
- Mobile-first layout; test at about 375 px width.
- Use real `<button>` and `<a>` elements, not clickable `<div>`s.

---

## 13. Build log (real entries only)

- Each person keeps `devlog/A.md` or `devlog/B.md` and appends entries **as events happen**, using this template (spec Appendix C):

```
## [Timestamp] Short title
- What I tried:
- What happened (screenshot/link):
- Why I think it happened:
- What I changed:
- Result after the change:
- What I learned:
```

- Small honest entries are valuable ("regex missed a phone number written with dots").
- If there were few failures, show few entries. **Never write an entry for something that didn't happen.**

---

## 14. Pre-push checklist (every push to `main`)

- [ ] `git pull --rebase origin main`
- [ ] `npm run lint` and `npm run build` pass
- [ ] Only my own files changed (`git status` / `git diff --stat`)
- [ ] No `console.log` of content, no commented-out code
- [ ] No secrets or real leases staged (`git diff --staged`)
- [ ] New or changed behavior has a test where required (Section 11)
- [ ] Copy follows Section 8
- [ ] Commit message follows Section 3

## 15. Pre-deploy checklist (before tagging `v1-prototype`)

- [ ] Production env vars set (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK`), `NEXT_PUBLIC_USE_MOCK` unset or `false`
- [ ] `.env*` ignored; secret scan clean; billing disabled on the key
- [ ] No body logging anywhere; `Cache-Control: no-store` on API responses
- [ ] Rate limits active; `AUDIT_DISABLED` switch tested
- [ ] Pinned model works in production
- [ ] Demo path works with no API call
- [ ] Privacy test passed with `fakepii.pdf` (payload clean, logs clean, storage empty)
- [ ] Every legal citation shown has a verification row
- [ ] Every Help-panel link click-tested
- [ ] Disclaimer, last-verified date and privacy notice visible
- [ ] Tested on a real phone
- [ ] Fallback walkthrough video recorded

---

## 16. When in doubt

1. Protect user data first.
2. Be honest second (hedge, verify, say what you don't know).
3. Keep it simple third. Cut features before you cut a "Never cut" item.
4. Ask the other person in one short message instead of editing their files.
