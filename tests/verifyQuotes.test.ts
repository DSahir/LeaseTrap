import assert from "node:assert/strict";
import test from "node:test";
import { quoteStatus } from "../lib/verifyQuotes.ts";

test("accepts a quote with different whitespace", () => {
  const source = "Landlord may enter\nthe apartment   at any time without notice.";
  const quote = "Landlord may enter the apartment at any time without notice.";
  assert.equal(quoteStatus(quote, source), "verified");
});

test("marks a changed quote as unverified", () => {
  assert.equal(quoteStatus("Landlord may enter at midnight.", "Landlord may enter with notice."), "unverified");
  assert.equal(quoteStatus(null, "anything"), "none");
});
