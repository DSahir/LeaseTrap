import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import audit from "../mock/audit.json" with { type: "json" };
import email from "../mock/email.json" with { type: "json" };
import { SAMPLE_KNOWN, SAMPLE_LEASE_TEXT } from "../content/sampleLease.ts";
import { AuditResponseSchema, EmailResponseSchema } from "../lib/contract.ts";
import { buildAuditPayload } from "../lib/api.ts";
import { scrubText } from "../lib/scrub.ts";
import { quoteStatus } from "../lib/verifyQuotes.ts";

test("mock fixtures match the frozen schemas", () => {
  assert.equal(AuditResponseSchema.safeParse(audit).success, true);
  assert.equal(EmailResponseSchema.safeParse(email).success, true);
});

test("practice quotes appear in the scrubbed sample", () => {
  const parsed = AuditResponseSchema.parse(audit);
  const scrubbed = scrubText(SAMPLE_LEASE_TEXT, {
    tenants: [...SAMPLE_KNOWN.tenants],
    roommates: [...SAMPLE_KNOWN.roommates],
    guarantors: [...SAMPLE_KNOWN.guarantors],
    landlord: SAMPLE_KNOWN.landlord,
    manager: SAMPLE_KNOWN.manager,
    propertyAddress: SAMPLE_KNOWN.propertyAddress,
  });
  for (const clause of parsed.clauses) {
    if (!clause.quote) continue;
    assert.equal(quoteStatus(clause.quote, scrubbed.text), "verified", clause.id);
  }
  assert.equal(parsed.counts.high, parsed.clauses.filter((clause) => clause.level === "HIGH").length);
});

test("audit payload has only allowed keys", () => {
  const payload = buildAuditPayload({
    text: "Scrubbed text",
    municipality: "amherst",
    tenancyType: "fixed-term",
  });
  assert.deepEqual(Object.keys(payload).sort(), ["municipality", "tenancyType", "text"]);
});

test("public demo bundle is fictional, schema-valid, and quote-checked", async () => {
  const sampleDir = join(process.cwd(), "public", "samples");
  const [text, resultJson, pdf, refsJson] = await Promise.all([
    readFile(join(sampleDir, "demo-lease.txt"), "utf8"),
    readFile(join(sampleDir, "demo-result.json"), "utf8"),
    readFile(join(sampleDir, "sample-lease.pdf")),
    readFile(join(process.cwd(), "legal", "refs.json"), "utf8"),
  ]);
  const knownRefs = new Set((JSON.parse(refsJson) as { id: string }[]).map((citation) => citation.id));
  const result = AuditResponseSchema.parse(JSON.parse(resultJson) as unknown);
  const scrubbed = scrubText(text, {
    tenants: [...SAMPLE_KNOWN.tenants],
    roommates: [...SAMPLE_KNOWN.roommates],
    guarantors: [...SAMPLE_KNOWN.guarantors],
    landlord: SAMPLE_KNOWN.landlord,
    manager: SAMPLE_KNOWN.manager,
    propertyAddress: SAMPLE_KNOWN.propertyAddress,
  });

  assert.equal(text.replace(/\r\n/g, "\n").trim(), SAMPLE_LEASE_TEXT);
  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.ok(pdf.length <= 3 * 1024 * 1024);
  for (const clause of result.clauses) {
    if (clause.quote) {
      assert.equal(quoteStatus(clause.quote, scrubbed.text), "verified", clause.id);
    }
    assert.ok(clause.ma_statute_citation.every((citation) => knownRefs.has(citation.id)));
    assert.ok(clause.legal_reference_ids.every((id) => knownRefs.has(id)));
  }
});

test("every shipped legal reference has a dated verification-log entry", async () => {
  const [refsText, log, metaText] = await Promise.all([
    readFile(join(process.cwd(), "legal", "refs.json"), "utf8"),
    readFile(join(process.cwd(), "legal", "VERIFICATION_LOG.md"), "utf8"),
    readFile(join(process.cwd(), "legal", "meta.json"), "utf8"),
  ]);
  const refs = JSON.parse(refsText) as { id: string; url: string }[];
  const meta = JSON.parse(metaText) as { legal_last_verified: string };
  const rows = [...log.matchAll(/^\| (L\d+) \|.*\| (\d{4}-\d{2}-\d{2}) \|/gm)];
  const dates = rows.map((row) => row[2]).filter((date): date is string => date !== undefined);
  const loggedIds = new Set(rows.map((row) => row[1]));

  assert.ok(refs.length > 0);
  for (const ref of refs) {
    assert.ok(loggedIds.has(ref.id), `${ref.id} has a verification row`);
    assert.ok(log.includes(ref.url), `${ref.id} URL appears in the log`);
  }
  assert.equal(meta.legal_last_verified, dates.sort().at(-1));
});
