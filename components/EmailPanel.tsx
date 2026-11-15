import { useMemo, useState } from "react";
import { isMockApiEnabled, LIMITS } from "@/lib/config";
import type { Clause, EmailResponse } from "@/lib/contract";
import { buildLocalEmail, emailForClipboard, MARKET_NOTE, toEmailClause } from "@/lib/emailClient";
import { requestEmail } from "@/lib/api";
import { toFriendlyMessage } from "@/lib/errors";

export function EmailPanel({
  clauses,
  getMap,
}: {
  clauses: Clause[];
  getMap: () => Record<string, string>;
}) {
  const [tone, setTone] = useState<"collaborative" | "direct">("collaborative");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<EmailResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [restoreOnCopy, setRestoreOnCopy] = useState(false);
  const request = useMemo(
    () => ({
      clauses: clauses.map(toEmailClause),
      tone,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }),
    [clauses, tone, notes],
  );

  async function writeDraft() {
    if (clauses.length === 0) return;
    setStatus("loading");
    setMessage(null);
    try {
      const next = await requestEmail(request, undefined, getMap());
      setDraft(next);
      setStatus("ready");
    } catch (error) {
      const fallback = buildLocalEmail(request);
      setDraft(fallback);
      setStatus("ready");
      setMessage(
        isMockApiEnabled()
          ? toFriendlyMessage(error)
          : "We drafted this on your device because the email service did not respond. Read it before you send it.",
      );
    }
  }

  async function copyDraft() {
    if (!draft) return;
    const text = emailForClipboard(draft, getMap(), restoreOnCopy);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), LIMITS.copyResetMs);
    } catch {
      setMessage("We couldn't copy that. Select the text and copy it yourself.");
    }
  }

  return (
    <section aria-labelledby="email-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="email-heading" className="text-lg font-semibold text-slate-900">
        Email draft
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{MARKET_NOTE}</p>
      <p className="mt-2 text-sm text-slate-800">
        {clauses.length === 0
          ? "Choose at least one high-concern or worth-asking clause."
          : `${clauses.length} clause${clauses.length === 1 ? "" : "s"} selected.`}
      </p>
      <fieldset className="mt-4" disabled={status === "loading"}>
        <legend className="text-sm font-medium text-slate-900">Tone</legend>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="tone"
            checked={tone === "collaborative"}
            onChange={() => setTone("collaborative")}
          />
          Collaborative
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="tone" checked={tone === "direct"} onChange={() => setTone("direct")} />
          Direct
        </label>
      </fieldset>
      <label className="mt-3 block text-sm font-medium text-slate-900" htmlFor="email-notes">
        Optional note to include
      </label>
      <textarea
        id="email-notes"
        maxLength={LIMITS.maxNotesChars}
        className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <button
        type="button"
        className="mt-3 min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:bg-slate-400"
        disabled={clauses.length === 0 || status === "loading"}
        onClick={() => void writeDraft()}
      >
        {status === "loading" ? "Writing draft..." : "Write draft"}
      </button>
      {draft ? (
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-900" htmlFor="email-subject">
            Subject
          </label>
          <input
            id="email-subject"
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
            value={draft.subject}
            onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
          />
          <label className="mt-3 block text-sm font-medium text-slate-900" htmlFor="email-body">
            Draft
          </label>
          <textarea
            id="email-body"
            className="mt-1 min-h-64 w-full rounded-lg border border-slate-300 p-3 text-sm leading-6"
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          />
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={restoreOnCopy}
              onChange={(event) => setRestoreOnCopy(event.target.checked)}
            />
            Put masked details back when copying. This stays on this device.
          </label>
          <button
            type="button"
            className="mt-2 min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium"
            onClick={() => void copyDraft()}
          >
            Copy to clipboard
          </button>
          <p aria-live="polite" className="mt-2 text-sm text-slate-800">
            {copied ? "Copied!" : ""}
          </p>
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="mt-3 text-sm text-slate-800">
          {message}
        </p>
      ) : null}
    </section>
  );
}
