import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLE_KNOWN, SAMPLE_LEASE_TEXT } from "../content/sampleLease.ts";
import { AuditResponseSchema } from "../lib/contract.ts";
import { scrubText } from "../lib/scrub.ts";
import { quoteStatus } from "../lib/verifyQuotes.ts";

async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const target = join(root, "public", "samples");
  const mockPath = join(root, "mock", "audit.json");
  const mockContent = await readFile(mockPath, "utf8");
  const result = AuditResponseSchema.parse(JSON.parse(mockContent) as unknown);
  const scrubbed = scrubText(SAMPLE_LEASE_TEXT, {
    tenants: [...SAMPLE_KNOWN.tenants],
    roommates: [...SAMPLE_KNOWN.roommates],
    guarantors: [...SAMPLE_KNOWN.guarantors],
    landlord: SAMPLE_KNOWN.landlord,
    manager: SAMPLE_KNOWN.manager,
    propertyAddress: SAMPLE_KNOWN.propertyAddress,
  });

  for (const clause of result.clauses) {
    if (clause.quote && quoteStatus(clause.quote, scrubbed.text) !== "verified") {
      throw new Error(`Practice quote does not match the sample text: ${clause.id}`);
    }
  }
  if (!result.clauses.every((clause) =>
    clause.ma_statute_citation.every((citation) => citation.id === "MOCK"),
  )) {
    throw new Error("The generated practice bundle must use MOCK citations only.");
  }

  await mkdir(target, { recursive: true });
  await writeFile(join(target, "demo-lease.txt"), `${SAMPLE_LEASE_TEXT}\n`, "utf8");
  await writeFile(join(target, "demo-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write("Wrote fictional practice demo text and result bundle.\n");
}

void main().catch((error: unknown) => {
  process.stderr.write(`Could not create demo bundle: ${String(error)}\n`);
  process.exitCode = 1;
});
