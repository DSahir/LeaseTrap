import { jsonResponse } from "@/lib/apiServer";

export function GET(): Response {
  return jsonResponse({ status: "ok" });
}
