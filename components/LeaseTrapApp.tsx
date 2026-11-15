"use client";

import { useEffect, useRef, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { ClauseCard } from "@/components/ClauseCard";
import { EmailPanel } from "@/components/EmailPanel";
import { HelpPanel } from "@/components/HelpPanel";
import { Scorecard } from "@/components/Scorecard";
import { ScrubPreview } from "@/components/ScrubPreview";
import { UploadZone } from "@/components/UploadZone";
import { SAMPLE_KNOWN } from "@/content/sampleLease";
import { loadDemoBundle, loadTownSlugs, requestAudit } from "@/lib/api";
import { FRIENDLY_ERRORS, isMockApiEnabled, LIMITS, MUNICIPALITIES, TENANCY_TYPES } from "@/lib/config";
import type { AuditResponse } from "@/lib/contract";
import { sortClauses } from "@/lib/display";
import { toFriendlyMessage } from "@/lib/errors";
import { validatePdfFile } from "@/lib/files";
import { extractPdfText } from "@/lib/pdf";
import { isPracticeResult } from "@/lib/practice";
import { scrubText, splitNameList, type KnownNames } from "@/lib/scrub";

type Preview = { text: string; warnings: string[]; label: string };

type Flow =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "preview"; preview: Preview }
  | { status: "loading"; preview: Preview }
  | { status: "error"; message: string; preview: Preview | null }
  | {
      status: "result";
      preview: Preview;
      quoteBasis: string;
      quoteLabel: string;
      result: AuditResponse;
      practice: boolean;
    };

export function LeaseTrapApp() {
  const mapRef = useRef<Record<string, string>>({});
  const originalRef = useRef("");
  const [flow, setFlow] = useState<Flow>({ status: "idle" });
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [municipality, setMunicipality] = useState<string>("amherst");
  const [tenancyType, setTenancyType] = useState("");
  const [tenantNames, setTenantNames] = useState("");
  const [roommateNames, setRoommateNames] = useState("");
  const [guarantorNames, setGuarantorNames] = useState("");
  const [landlord, setLandlord] = useState("");
  const [manager, setManager] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [loadedTowns, setLoadedTowns] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const clearMemory = () => {
      mapRef.current = {};
      originalRef.current = "";
    };
    window.addEventListener("pagehide", clearMemory);
    return () => {
      window.removeEventListener("pagehide", clearMemory);
      clearMemory();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadTownSlugs().then((slugs) => {
      if (!cancelled) setLoadedTowns(slugs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function knownNames(): KnownNames {
    return {
      tenants: splitNameList(tenantNames),
      roommates: splitNameList(roommateNames),
      guarantors: splitNameList(guarantorNames),
      landlord,
      manager,
      propertyAddress,
    };
  }

  function remember(source: string, known: KnownNames) {
    const scrubbed = scrubText(source, known);
    originalRef.current = source;
    mapRef.current = scrubbed.map;
    return scrubbed;
  }

  function clearEverything() {
    mapRef.current = {};
    originalRef.current = "";
    setFlow({ status: "idle" });
    setFileMessage(null);
    setPaste("");
    setTenantNames("");
    setRoommateNames("");
    setGuarantorNames("");
    setLandlord("");
    setManager("");
    setPropertyAddress("");
    setExpanded([]);
    setSelected([]);
  }

  async function readFile(file: File) {
    const problem = validatePdfFile(file);
    if (problem) {
      setFileMessage(problem);
      return;
    }
    setFileMessage(null);
    setFlow({ status: "reading" });
    try {
      const text = await extractPdfText(await file.arrayBuffer());
      const scrubbed = remember(text, knownNames());
      const warnings = [...scrubbed.warnings];
      if (text.trim().length < LIMITS.minExtractedChars) warnings.unshift(FRIENDLY_ERRORS.PDF);
      setFlow({ status: "preview", preview: { text: scrubbed.text, warnings, label: "Scrubbed preview" } });
    } catch (error) {
      setFlow({ status: "error", message: toFriendlyMessage(error, FRIENDLY_ERRORS.PDF), preview: null });
    }
  }

  function usePastedText() {
    const source = paste;
    if (source.trim().length === 0) {
      setFileMessage("Paste some lease text first.");
      return;
    }
    setFileMessage(null);
    setPaste("");
    const scrubbed = remember(source, knownNames());
    setFlow({
      status: "preview",
      preview: { text: scrubbed.text, warnings: scrubbed.warnings, label: "Scrubbed preview" },
    });
  }

  function maskAgain() {
    if (!originalRef.current) return;
    const scrubbed = remember(originalRef.current, knownNames());
    const warnings = [
      "Masking again replaced the preview. Check it before you send.",
      ...scrubbed.warnings,
    ];
    setFlow({ status: "preview", preview: { text: scrubbed.text, warnings, label: "Scrubbed preview" } });
  }

  async function analyze(preview: Preview) {
    if (preview.text.trim().length === 0) {
      setFlow({ status: "error", message: FRIENDLY_ERRORS.BAD_REQUEST, preview });
      return;
    }
    if (preview.text.length > LIMITS.maxTextChars) {
      setFlow({ status: "error", message: FRIENDLY_ERRORS.TOO_LARGE, preview });
      return;
    }
    setFlow({ status: "loading", preview });
    try {
      const result = await requestAudit({
        text: preview.text,
        municipality,
        ...(tenancyType ? { tenancyType } : {}),
      });
      setExpanded([]);
      setSelected([]);
      setFlow({
        status: "result",
        preview,
        quoteBasis: preview.text,
        quoteLabel: "the scrubbed text you approved",
        result,
        practice: isMockApiEnabled() || isPracticeResult(result),
      });
    } catch (error) {
      setFlow({ status: "error", message: toFriendlyMessage(error), preview });
    }
  }

  async function loadSample() {
    setFlow({ status: "reading" });
    setFileMessage(null);
    const demo = await loadDemoBundle();
    if (demo) {
      applySampleNames();
      const scrubbed = remember(demo.text, sampleKnown());
      setExpanded([]);
      setSelected([]);
      setFlow({
        status: "result",
        preview: {
          text: scrubbed.text,
          warnings: scrubbed.warnings,
          label: "Scrubbed demo text",
        },
        quoteBasis: scrubbed.text,
        quoteLabel: "the scrubbed demo text",
        result: demo.result,
        practice: true,
      });
      return;
    }
    try {
      const response = await fetch("/samples/sample-lease.pdf");
      if (!response.ok) throw new Error("sample-missing");
      const text = await extractPdfText(await response.arrayBuffer());
      applySampleNames();
      const scrubbed = remember(text, sampleKnown());
      const preview = { text: scrubbed.text, warnings: scrubbed.warnings, label: "Scrubbed sample" };
      if (!isMockApiEnabled()) {
        setFlow({ status: "preview", preview });
        return;
      }
      const result = await requestAudit({ text: scrubbed.text, municipality });
      setExpanded([]);
      setSelected([]);
      setFlow({
        status: "result",
        preview,
        quoteBasis: scrubbed.text,
        quoteLabel: "the scrubbed sample text",
        result,
        practice: true,
      });
    } catch (error) {
      const known = toFriendlyMessage(error, "");
      setFlow({
        status: "error",
        message: known || "The sample lease is not available yet. Try again in a moment.",
        preview: null,
      });
    }
  }

  function applySampleNames() {
    setTenantNames(SAMPLE_KNOWN.tenants.join(", "));
    setRoommateNames(SAMPLE_KNOWN.roommates.join(", "));
    setGuarantorNames(SAMPLE_KNOWN.guarantors.join(", "));
    setLandlord(SAMPLE_KNOWN.landlord);
    setManager(SAMPLE_KNOWN.manager);
    setPropertyAddress(SAMPLE_KNOWN.propertyAddress);
  }

  const preview = flow.status === "idle" || flow.status === "reading" ? null : flow.preview;
  const result = flow.status === "result" ? flow.result : null;
  const practice = flow.status === "result" ? flow.practice : false;
  const sorted = result ? sortClauses(result.clauses) : [];
  const selectedClauses = sorted.filter((clause) => selected.includes(clause.id));
  const townReady = loadedTowns !== null;
  const townLoaded = townReady && loadedTowns.includes(municipality);
  const townMessage = !townReady
    ? "Checking which towns have a local rules file."
    : townLoaded
      ? "A local rules file is loaded for this town. It is used only when you run an analysis."
      : "No local rules loaded for this town.";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">LeaseTrap</h1>
          <p className="mt-2 max-w-xl text-base leading-7 text-slate-700">
            Read a Massachusetts lease on this device, mask details we can detect, and review questions you could ask before you sign.
          </p>
        </div>
        <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium" onClick={clearEverything}>
          Clear everything
        </button>
      </header>

      <aside aria-label="Privacy and AI service terms" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-slate-800">
        <h2 className="font-semibold">Before you send lease text</h2>
        <p className="mt-1">
          This prototype is intended for Gemini&apos;s unpaid quota. Under Google&apos;s current terms for unpaid Gemini API use,
          submitted prompts and responses may be used to improve services and may be reviewed by people. Google says not to
          submit sensitive, confidential, or personal information to unpaid services. Check the preview and remove anything
          you do not want to share.{" "}
          <a
            className="underline"
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noreferrer"
          >
            Read Gemini API terms
          </a>
          . If you configure a paid service, verify its terms and update this notice before use.
        </p>
        <p className="mt-2">
          LeaseTrap does not save your lease on its server, but that does not control how an AI provider handles text it receives.
        </p>
      </aside>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-900">
          Town
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
            value={municipality}
            onChange={(event) => setMunicipality(event.target.value)}
          >
            {MUNICIPALITIES.map((town) => (
              <option key={town.slug} value={town.slug}>
                {town.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-900">
          Tenancy type
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
            value={tenancyType}
            onChange={(event) => setTenancyType(event.target.value)}
          >
            {TENANCY_TYPES.map((type) => (
              <option key={type.label} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-900">
          Names to mask on this device
        </summary>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          These names are used only to mask the preview. They are not sent. Separate several names with commas.
        </p>
        <div className="mt-3 grid gap-3">
          <NameField id="tenants" label="Tenants" value={tenantNames} onChange={setTenantNames} />
          <NameField id="roommates" label="Roommates" value={roommateNames} onChange={setRoommateNames} />
          <NameField id="guarantors" label="Guarantors" value={guarantorNames} onChange={setGuarantorNames} />
          <NameField id="landlord" label="Landlord" value={landlord} onChange={setLandlord} />
          <NameField id="manager" label="Manager" value={manager} onChange={setManager} />
          <NameField id="address" label="Property address" value={propertyAddress} onChange={setPropertyAddress} />
        </div>
      </details>

      {flow.status !== "result" ? (
        <div className="mt-6 space-y-4">
          <UploadZone disabled={flow.status === "reading" || flow.status === "loading"} message={fileMessage} onFile={(file) => void readFile(file)} />
          <p className="text-sm leading-6 text-slate-700">
            Don&apos;t paste a Social Security number or bank number if you can avoid it. We remove identifiers we can detect, and we can miss some. Nothing is saved in browser storage.
          </p>
          <div>
            <label className="text-sm font-medium text-slate-900" htmlFor="paste-lease">
              Or paste lease text
            </label>
            <textarea
              id="paste-lease"
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-3 text-sm"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
            />
            <button type="button" className="mt-2 min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium" onClick={usePastedText}>
              Mask pasted text
            </button>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:bg-slate-400"
            disabled={flow.status === "reading" || flow.status === "loading"}
            onClick={() => void loadSample()}
          >
            Load sample lease
          </button>
        </div>
      ) : null}

      {flow.status === "reading" ? <p className="mt-6 text-sm text-slate-800">Reading the PDF on this device...</p> : null}
      {flow.status === "loading" ? (
        <p className="mt-6 text-sm text-slate-800" role="status">
          Analyzing the scrubbed text... this can take up to a minute.
        </p>
      ) : null}
      {flow.status === "error" ? (
        <div role="alert" className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-900">{flow.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {flow.preview ? (
              <button type="button" className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white" onClick={() => void analyze(flow.preview as Preview)}>
                Retry
              </button>
            ) : null}
            <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium" onClick={() => void loadSample()}>
              Use sample instead
            </button>
          </div>
        </div>
      ) : null}

      {preview && flow.status !== "loading" ? (
        <div className="mt-6 space-y-4">
          <ScrubPreview
            text={preview.text}
            warnings={preview.warnings}
            onChange={(text) => {
              if (flow.status === "preview" || flow.status === "error" || flow.status === "result") {
                const next = { ...preview, text };
                if (flow.status === "result") setFlow({ ...flow, preview: next });
                else setFlow({ status: "preview", preview: next });
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white" onClick={() => void analyze(preview)}>
              Analyze scrubbed text
            </button>
            <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium" onClick={maskAgain}>
              Mask again
            </button>
          </div>
        </div>
      ) : null}

      {result && flow.status === "result" ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm leading-6 text-slate-700">
            Educational reading only. This does not say a clause is legal, and it does not predict what would happen in a dispute. Quotes were checked against {flow.quoteLabel}.
          </p>
          <Scorecard result={result} practice={practice} />
          {sorted.length === 0 ? (
            <p className="text-sm font-medium text-slate-900">
              No clauses were flagged. This doesn&apos;t mean the lease is safe.
            </p>
          ) : (
            <div className="space-y-3">
              {sorted.map((clause) => (
                <ClauseCard
                  key={clause.id}
                  clause={clause}
                  quoteBasis={flow.quoteBasis}
                  expanded={expanded.includes(clause.id)}
                  selected={selected.includes(clause.id)}
                  canSelect={selected.length < LIMITS.maxEmailClauses}
                  onToggle={() =>
                    setExpanded((current) =>
                      current.includes(clause.id) ? current.filter((id) => id !== clause.id) : [...current, clause.id],
                    )
                  }
                  onSelect={(include) =>
                    setSelected((current) => {
                      if (include) {
                        if (current.includes(clause.id) || current.length >= LIMITS.maxEmailClauses) return current;
                        return [...current, clause.id];
                      }
                      return current.filter((id) => id !== clause.id);
                    })
                  }
                />
              ))}
            </div>
          )}
          <EmailPanel clauses={selectedClauses} getMap={() => mapRef.current} />
          <HelpPanel townMessage={townMessage} />
        </div>
      ) : (
        <div className="mt-6">
          <HelpPanel townMessage={townMessage} />
        </div>
      )}

      <AppFooter verifiedDate={result?.legal_last_verified} practice={practice} />
    </div>
  );
}

function sampleKnown(): KnownNames {
  return {
    tenants: [...SAMPLE_KNOWN.tenants],
    roommates: [...SAMPLE_KNOWN.roommates],
    guarantors: [...SAMPLE_KNOWN.guarantors],
    landlord: SAMPLE_KNOWN.landlord,
    manager: SAMPLE_KNOWN.manager,
    propertyAddress: SAMPLE_KNOWN.propertyAddress,
  };
}

function NameField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-900" htmlFor={id}>
      {label}
      <input
        id={id}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </label>
  );
}
