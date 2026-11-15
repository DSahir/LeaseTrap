function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Put original values back into placeholder text. Local only. */
export function restorePlaceholders(text: string, map: Record<string, string>): string {
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  return entries.reduce((current, [placeholder, original]) => {
    if (!placeholder || !original) return current;
    const pattern = new RegExp(escapeRegExp(placeholder), "g");
    return current.replace(pattern, () => original);
  }, text);
}
