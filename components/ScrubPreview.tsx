export function ScrubPreview({
  text,
  warnings,
  onChange,
}: {
  text: string;
  warnings: string[];
  onChange: (value: string) => void;
}) {
  return (
    <section aria-labelledby="preview-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="preview-heading" className="text-lg font-semibold text-slate-900">
        Preview before sending
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        We remove identifiers we can detect. Some can be missed. Read this preview and delete anything you do not want sent. Names you typed stay on this device.
      </p>
      {warnings.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <label className="mt-4 block text-sm font-medium text-slate-900" htmlFor="scrubbed-text">
        Scrubbed text
      </label>
      <textarea
        id="scrubbed-text"
        className="mt-1 min-h-64 w-full rounded-lg border border-slate-300 p-3 text-sm leading-6 text-slate-900"
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
