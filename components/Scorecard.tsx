import { AlertOctagon, AlertTriangle, CheckCircle2, CircleHelp } from "lucide-react";
import type { AuditResponse } from "@/lib/contract";

const ITEMS = [
  { key: "high", label: "High concern", icon: AlertOctagon },
  { key: "worth_asking", label: "Worth asking about", icon: AlertTriangle },
  { key: "standard", label: "Looks typical", icon: CheckCircle2 },
  { key: "possibly_missing", label: "Possibly missing", icon: CircleHelp },
] as const;

export function Scorecard({ result, practice }: { result: AuditResponse; practice: boolean }) {
  const flagged = result.counts.high + result.counts.worth_asking + result.counts.possibly_missing;
  return (
    <section aria-labelledby="summary-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="summary-heading" className="text-lg font-semibold text-slate-900">
        Reading summary
      </h2>
      {practice ? (
        <p className="mt-2 text-sm text-slate-800">Practice result. No lease text was sent.</p>
      ) : (
        <p className="mt-2 text-sm text-slate-800">
          Only the scrubbed text, town, and tenancy type were sent. The AI provider may process submitted text under its own terms; see the privacy notice above.
        </p>
      )}
      <p className="mt-3 leading-7 text-slate-800">{result.summary}</p>
      {flagged === 0 ? (
        <p className="mt-3 text-sm font-medium text-slate-900">
          No clauses were flagged. This doesn&apos;t mean the lease is safe.
        </p>
      ) : null}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>
                {item.label}: {result.counts[item.key]}
              </span>
            </li>
          );
        })}
      </ul>
      {result.unsupported_notes.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {result.unsupported_notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
