import { createHash } from "node:crypto";
import { SERVER_LIMITS } from "@/lib/limits";

type Endpoint = "audit" | "email";

type WindowCounts = {
  window: number;
  count: number;
};

type DailyCounts = {
  day: string;
  count: number;
};

const ipCounts = new Map<string, WindowCounts>();
const globalCounts = new Map<Endpoint, DailyCounts>();
let trackedDay = "";

const IP_LIMITS: Record<Endpoint, number> = {
  audit: SERVER_LIMITS.auditRequestsPerIpPerMinute,
  email: SERVER_LIMITS.emailRequestsPerIpPerMinute,
};

const GLOBAL_LIMITS: Record<Endpoint, number> = {
  audit: SERVER_LIMITS.auditRequestsGloballyPerDay,
  email: SERVER_LIMITS.emailRequestsGloballyPerDay,
};

export function consumeRateLimit(endpoint: Endpoint, clientId: string, now = Date.now()): boolean {
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / SERVER_LIMITS.rateLimitWindowMs);
  if (trackedDay !== day) {
    pruneExpiredCounts(day, minute);
    trackedDay = day;
  }
  const clientHash = createHash("sha256").update(clientId).digest("hex");
  const clientKey = `${minute}:${endpoint}:${clientHash}`;
  const global = globalCounts.get(endpoint);
  const client = ipCounts.get(clientKey);

  if ((global?.day === day && global.count >= GLOBAL_LIMITS[endpoint]) ||
      (client?.window === minute && client.count >= IP_LIMITS[endpoint])) {
    return false;
  }

  if (ipCounts.size >= SERVER_LIMITS.maxTrackedIps) pruneExpiredMinuteCounts(minute);
  if (!client && ipCounts.size >= SERVER_LIMITS.maxTrackedIps) {
    return false;
  }

  globalCounts.set(endpoint, {
    day,
    count: global?.day === day ? global.count + 1 : 1,
  });
  ipCounts.set(clientKey, {
    window: minute,
    count: client?.window === minute ? client.count + 1 : 1,
  });

  if (ipCounts.size > SERVER_LIMITS.maxTrackedIps) {
    pruneExpiredMinuteCounts(minute);
  }

  return true;
}

export function getClientId(headers: Headers): string {
  const forwarded = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
  return candidate ?? headers.get("x-real-ip")?.trim() ?? "unknown";
}

function pruneExpiredCounts(currentDay: string, currentMinute: number): void {
  for (const [key, value] of ipCounts) {
    if (value.window < currentMinute) ipCounts.delete(key);
  }
  for (const [key, value] of globalCounts) {
    if (value.day !== currentDay) globalCounts.delete(key);
  }
}

function pruneExpiredMinuteCounts(currentMinute: number): void {
  for (const [key, value] of ipCounts) {
    if (value.window < currentMinute) ipCounts.delete(key);
  }
}
