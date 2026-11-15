import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_KNOWN, SAMPLE_LEASE_TEXT } from "../content/sampleLease.ts";
import { scrubText } from "../lib/scrub.ts";

test("masks dotted phones, email, ssn, and a long account number", () => {
  const result = scrubText(
    "Call 413.555.0148 or jordan.hale.example@mailinator.com. SSN: 900-12-3456. account 123456789.",
    { tenants: [], roommates: [], guarantors: [], landlord: "", manager: "", propertyAddress: "" },
  );
  assert.equal(result.text.includes("413.555.0148"), false);
  assert.equal(result.text.includes("@"), false);
  assert.equal(result.text.includes("900-12-3456"), false);
  assert.equal(result.text.includes("123456789"), false);
  assert.match(result.text, /\[PHONE\]/);
  assert.match(result.text, /\[EMAIL\]/);
  assert.match(result.text, /\[SSN\]/);
  assert.match(result.text, /\[NUMBER\]/);
});

test("keeps rent, short counts, and statute-like text", () => {
  const source = "Rent is $1,600 per month. Notice is 30 days. See Section 15B. Apt 3 is the unit.";
  const result = scrubText(source, {
    tenants: [],
    roommates: [],
    guarantors: [],
    landlord: "",
    manager: "",
    propertyAddress: "",
  });
  assert.equal(result.text, source);
});

test("masks known people and a street address", () => {
  const result = scrubText(SAMPLE_LEASE_TEXT, {
    tenants: [...SAMPLE_KNOWN.tenants],
    roommates: [...SAMPLE_KNOWN.roommates],
    guarantors: [...SAMPLE_KNOWN.guarantors],
    landlord: SAMPLE_KNOWN.landlord,
    manager: SAMPLE_KNOWN.manager,
    propertyAddress: SAMPLE_KNOWN.propertyAddress,
  });
  assert.equal(result.text.includes("Jordan Hale"), false);
  assert.equal(result.text.includes("413.555.0148"), false);
  assert.equal(result.text.includes("18 Kellogg Avenue"), false);
  assert.match(result.text, /\[TENANT_1\]/);
  assert.match(result.text, /\[LANDLORD\]/);
  assert.match(result.text, /\$1,600 per month/);
  assert.equal(result.map["[PHONE]"], "413.555.0148");
});

test("handles Appendix D patterns and preserves useful lease values", () => {
  const source = [
    "Phones: 413-555-0147 | (413) 555-0147 | 413.555.0147 | 413 555 0147 | +1 413 555 0147 | 4135550147",
    "Emails: jane.doe@umass.edu | JANE.DOE@Example.COM",
    "SSNs: 123-45-6789 | 123 45 6789",
    "Names: Jane Q. Doe | Doe, Jane | JANE DOE | J. Doe",
    "Address: 12 Main St., Apt 3B, Amherst, MA 01002",
    "Keep: $1,850 rent | $1,850.00 | 30 days | September 1, 2026",
  ].join("\n");
  const result = scrubText(source, {
    tenants: ["Jane Q. Doe"],
    roommates: [],
    guarantors: [],
    landlord: "",
    manager: "",
    propertyAddress: "",
  });

  for (const phone of [
    "413-555-0147",
    "(413) 555-0147",
    "413.555.0147",
    "413 555 0147",
    "+1 413 555 0147",
    "4135550147",
  ]) {
    assert.equal(result.text.includes(phone), false, phone);
  }
  assert.equal(result.text.includes("jane.doe@umass.edu"), false);
  assert.equal(result.text.includes("JANE.DOE@Example.COM"), false);
  assert.equal(result.text.includes("123-45-6789"), false);
  assert.equal(result.text.includes("123 45 6789"), false);
  assert.doesNotMatch(result.text, /Jane Q\. Doe|Doe, Jane|JANE DOE|J\. Doe/);
  assert.doesNotMatch(result.text, /12 Main St|01002/);
  assert.match(result.text, /\$1,850 rent \| \$1,850\.00 \| 30 days \| September 1, 2026/);
});

test("does not map multiple values of one type to a misleading restore value", () => {
  const result = scrubText("Call 413-555-0101 or 413-555-0102.", {
    tenants: [],
    roommates: [],
    guarantors: [],
    landlord: "",
    manager: "",
    propertyAddress: "",
  });

  assert.equal(result.text, "Call [PHONE] or [PHONE].");
  assert.equal(result.map["[PHONE]"], undefined);
});
