import { FileUp } from "lucide-react";
import { LIMITS } from "@/lib/config";
import { formatMegabytes } from "@/lib/display";

export function UploadZone({
  disabled,
  message,
  onFile,
}: {
  disabled: boolean;
  message: string | null;
  onFile: (file: File) => void;
}) {
  return (
    <div>
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center hover:border-slate-500"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files.item(0);
          if (file) onFile(file);
        }}
      >
        <FileUp aria-hidden="true" className="text-slate-700" />
        <span className="font-medium text-slate-900">Choose a PDF or drop it here</span>
        <span className="text-sm text-slate-700">
          PDF only, up to {formatMegabytes(LIMITS.maxPdfBytes)}. We read it on this device. The file is not uploaded.
        </span>
        <input
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.item(0);
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
      {message ? (
        <p role="alert" className="mt-3 text-sm text-slate-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
