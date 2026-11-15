# Person A build log

## [2026-11-15 07:06 UTC] Backend integration and local validation
- What I tried: Implemented the audit, email, and health routes; legal-reference loading and post-processing; privacy safeguards; model-backed email drafting; and the frontend API integration. Ran the project tests, lint, production build, and a local HTTP smoke test without a Gemini key.
- What happened (screenshot/link): `npm test` passed 26/26 tests; `npm run lint` passed; `npm run build` passed. The local health route returned 200 with `Cache-Control: no-store`; malformed audit input returned 400; valid audit and email requests returned the expected 502 `MODEL_FAILURE` because no API key is configured. No live Gemini calls were made.
- Why I think it happened: Route validation and no-store behavior worked locally. The model client rejects requests when `GEMINI_API_KEY` is absent, before making a provider call.
- What I changed: Added the backend routes, rate limits and kill switch; citation and quote validation; the limited verified legal pack; privacy-aware prompts and email payload scrubbing; tests; and the visible unpaid-service data-use notice. Added `.env.example` to the repository ignore exceptions and aligned the fallback model variable with `GEMINI_MODEL_FALLBACK`.
- Result after the change: Local automated checks are green. Live model behavior, real evaluation metrics, and model availability remain unverified without a privately configured key.
- What I learned: The local production build and no-key route paths work, but they do not establish live model quality or provider availability.

## [2026-11-15 07:06 UTC] Gemini API data-terms review
- What I tried: Reviewed the official [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms), effective March 23, 2026.
- What happened (screenshot/link): For the unpaid API quota, Google may use submitted content and generated responses to improve and develop products, and human reviewers may read and process inputs and outputs. The unpaid-services section says not to submit sensitive, confidential, or personal information. It does not specify a fixed retention period or promise zero retention. Paid API use is not used to improve products, but prompts and responses may be logged for a limited period for safety, security, and legal requirements. The terms also limit service access by region; they do not establish a general regional data-residency guarantee.
- Why I think it happened: These are the terms applicable to the intended unpaid quota; their data-use language is not a no-training or zero-retention assurance.
- What I changed: Added an in-app disclosure of unpaid-service data use and human review, and documented that users should not submit sensitive, confidential, or personal information. The API key remains unconfigured locally.
- Result after the change: The product does not claim provider-side zero retention or no training. The user-facing disclosure and README direct users not to submit sensitive information.
- What I learned: Client-side scrubbing is an additional safeguard, not a guarantee of anonymity; live evaluation and paid-service configuration require separate verification.
