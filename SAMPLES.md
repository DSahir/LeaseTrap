# Sample and evaluation data

All names, numbers, addresses, and lease text below are fictional. No real lease or personal data is included.

| Asset | Purpose | Notes |
|---|---|---|
| `public/samples/demo-lease.txt` | Public walkthrough sample | Contains intentionally fake personal identifiers to exercise the browser scrubber. |
| `public/samples/demo-result.json` | Cached walkthrough result | Practice content only; it is not produced by a live review of a user's lease. |
| `eval/leases/clean.txt` | Control input | Ordinary fictional clauses intended to expose false positives. |
| `eval/leases/injection.txt` | Prompt-injection input | Contains hostile instructions as untrusted lease text. |

`eval/answers.json` records the provisional seeded-issue labels. They have not yet been reviewed by an independent person, so evaluation metrics must not be presented as an independent benchmark. Renewal length and roommate liability are included only as "worth asking" sample topics, without a verified legal citation.
