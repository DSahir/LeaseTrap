import { FRIENDLY_ERRORS, LIMITS } from "@/lib/config";
import { formatMegabytes } from "@/lib/display";

export function validatePdfFile(file: { type: string; size: number; name: string }): string | null {
  const looksPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf) return FRIENDLY_ERRORS.FILE_TYPE;
  if (file.size <= 0) return "That PDF is empty. Please choose a different file.";
  if (file.size > LIMITS.maxPdfBytes) {
    return `That file is ${formatMegabytes(file.size)}. Please choose a PDF under ${formatMegabytes(LIMITS.maxPdfBytes)}.`;
  }
  return null;
}
