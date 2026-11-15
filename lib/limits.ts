export const SERVER_LIMITS = {
  maxRequestBytes: 1_000_000,
  maxTextChars: 200_000,
  rateLimitWindowMs: 60_000,
  auditRequestsPerIpPerMinute: 6,
  emailRequestsPerIpPerMinute: 10,
  auditRequestsGloballyPerDay: 100,
  emailRequestsGloballyPerDay: 150,
  maxTrackedIps: 10_000,
  modelTimeoutMs: 50_000,
  auditBudgetMs: 55_000,
  emailBudgetMs: 40_000,
  maxOutputTokens: 4_000,
} as const;
