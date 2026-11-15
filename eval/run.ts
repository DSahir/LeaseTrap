import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { SAMPLE_KNOWN } from "../content/sampleLease.ts";
import { AuditModelFailure, runAudit } from "../lib/audit.ts";
import { ApiFault } from "../lib/apiServer.ts";
import { AUDIT_PROMPT_VERSION } from "../lib/prompt.ts";
import { calculateMetrics, type Answer } from "./scoring.ts";
import { GeminiRequestError } from "../lib/gemini.ts";
import { scrubText } from "../lib/scrub.ts";

type Answers = Record<string, Answer>;

const RUNS = 3;

async function run(): Promise<void> {
  loadEnvConfig(process.cwd());

  if (!process.env.GEMINI_API_KEY) {
    console.error("EVAL_BLOCKED: configure GEMINI_API_KEY privately in .env.local; no lease text was logged.");
    process.exitCode = 1;
    return;
  }

  try {
    const answers = JSON.parse(await readFile(join(process.cwd(), "eval", "answers.json"), "utf8")) as Answers;
    await main(answers);
  } catch (error) {
    if (error instanceof AuditModelFailure) {
      console.error(`EVAL_FAILED: MODEL_FAILURE (${error.reason}); no lease text was logged.`);
      process.exitCode = 1;
      return;
    }

    if (error instanceof GeminiRequestError) {
      const status = error.status === undefined ? "" : ` (HTTP ${error.status})`;
      console.error(`EVAL_FAILED: GEMINI_PROVIDER_ERROR${status}; no lease text was logged.`);
      process.exitCode = 1;
      return;
    }

    const code = error instanceof ApiFault ? error.code : "MODEL_FAILURE";
    console.error(`EVAL_FAILED: ${code}; no lease text was logged.`);
    process.exitCode = 1;
  }
}

void run();

async function main(answers: Answers): Promise<void> {
  const sources = await loadSources();
  const legalIds = new Set(
    (JSON.parse(await readFile(join(process.cwd(), "legal", "refs.json"), "utf8")) as { id: string }[]).map((ref) => ref.id),
  );

  for (const [leaseId, text] of Object.entries(sources)) {
    const expected = answers[leaseId];
    if (!expected) throw new Error(`Missing answer key for ${leaseId}`);
    const results = [];
    for (let run = 0; run < RUNS; run += 1) {
      const start = Date.now();
      const result = await runAudit({ text, municipality: "amherst" });
      results.push({ result, latencyMs: Date.now() - start });
    }

    const metrics = calculateMetrics(text, results, expected, legalIds);
    console.log(JSON.stringify({ prompt: AUDIT_PROMPT_VERSION, lease: leaseId, runs: RUNS, ...metrics }));
  }
}

async function loadSources(): Promise<Record<string, string>> {
  const demo = await readFile(join(process.cwd(), "public", "samples", "demo-lease.txt"), "utf8");
  const scrubbedDemo = scrubText(demo, {
    tenants: [...SAMPLE_KNOWN.tenants],
    roommates: [...SAMPLE_KNOWN.roommates],
    guarantors: [...SAMPLE_KNOWN.guarantors],
    landlord: SAMPLE_KNOWN.landlord,
    manager: SAMPLE_KNOWN.manager,
    propertyAddress: SAMPLE_KNOWN.propertyAddress,
  }).text;
  const clean = await readFile(join(process.cwd(), "eval", "leases", "clean.txt"), "utf8");
  const injection = await readFile(join(process.cwd(), "eval", "leases", "injection.txt"), "utf8");
  return { "demo-lease": scrubbedDemo, clean, injection };
}
