import type {
  DailyUsagePoint,
  DailyUsageResponse,
  FilteredUsageEventsResponse,
  SetUserSpendLimitRequest,
  SetUserSpendLimitResponse,
  SpendMember,
  SpendResponse
} from "../types";

const MOCK_KEY_PREFIX = "mock_";

const MOCK_EMAILS = [
  "taeinn@company.com",
  "lead@company.com",
  "backend@company.com",
  "frontend@company.com",
  "qa@company.com"
] as const;

function startOfCurrentCycle(nowMs: number): number {
  const date = new Date(nowMs);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function buildMember(
  userId: number,
  email: string,
  name: string,
  spendUsd: number,
  monthlyLimitDollars: number | null,
  hardLimitOverrideDollars = 0
): SpendMember {
  const spendCents = Math.round(spendUsd * 100);
  return {
    userId,
    name,
    email,
    role: userId === 1 ? "admin" : "member",
    spendCents,
    overallSpendCents: spendCents,
    fastPremiumRequests: Math.max(4, Math.floor(spendUsd / 2)),
    hardLimitOverrideDollars,
    monthlyLimitDollars
  };
}

function toDayString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildUsagePoint(
  userId: number,
  email: string,
  dayMs: number,
  trafficWeight: number
): DailyUsagePoint {
  const accepts = Math.max(6, Math.round(trafficWeight * 18));
  const rejects = Math.max(1, Math.round(trafficWeight * 4));
  const applies = accepts + rejects + Math.round(trafficWeight * 3);
  const linesAdded = Math.max(80, Math.round(trafficWeight * 560));
  const linesDeleted = Math.max(20, Math.round(trafficWeight * 170));

  return {
    userId,
    day: toDayString(new Date(dayMs)),
    date: dayMs,
    isActive: true,
    email,
    totalLinesAdded: linesAdded,
    totalLinesDeleted: linesDeleted,
    acceptedLinesAdded: Math.round(linesAdded * 0.7),
    acceptedLinesDeleted: Math.round(linesDeleted * 0.66),
    totalApplies: applies,
    totalAccepts: accepts,
    totalRejects: rejects,
    totalTabsShown: accepts + rejects + 5,
    totalTabsAccepted: accepts,
    composerRequests: Math.max(2, Math.round(trafficWeight * 8)),
    chatRequests: Math.max(2, Math.round(trafficWeight * 11)),
    agentRequests: Math.max(1, Math.round(trafficWeight * 5)),
    cmdkUsages: Math.max(1, Math.round(trafficWeight * 6)),
    subscriptionIncludedReqs: Math.max(8, Math.round(trafficWeight * 30)),
    apiKeyReqs: Math.max(1, Math.round(trafficWeight * 3)),
    usageBasedReqs: Math.max(2, Math.round(trafficWeight * 7)),
    bugbotUsages: Math.max(0, Math.round(trafficWeight * 2)),
    mostUsedModel: "gpt-4.1",
    applyMostUsedExtension: "typescript",
    tabMostUsedExtension: "typescript",
    clientVersion: "1.102.1"
  };
}

export function isMockApiKey(apiKey: string): boolean {
  return apiKey.trim().toLowerCase().startsWith(MOCK_KEY_PREFIX);
}

export function createMockSpendResponse(myEmail: string, nowMs = Date.now()): SpendResponse {
  const normalizedEmail = myEmail.trim().toLowerCase();
  const defaultEmail = MOCK_EMAILS[0];
  const primaryEmail = normalizedEmail.length > 0 ? normalizedEmail : defaultEmail;

  const members: SpendMember[] = [
    buildMember(1, primaryEmail, "TAEINN", 182.4, 300),
    buildMember(2, MOCK_EMAILS[1], "Team Lead", 263.8, 350),
    buildMember(3, MOCK_EMAILS[2], "Backend", 148.2, 250),
    buildMember(4, MOCK_EMAILS[3], "Frontend", 121.7, 220, 260),
    buildMember(5, MOCK_EMAILS[4], "QA", 76.5, 160)
  ];

  return {
    teamMemberSpend: members,
    subscriptionCycleStart: startOfCurrentCycle(nowMs),
    totalMembers: members.length,
    totalPages: 1
  };
}

export function createMockDailyUsageResponse(nowMs = Date.now()): DailyUsageResponse {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);

  const data: DailyUsagePoint[] = [];
  const days = 14;

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayMs = today.getTime() - offset * 24 * 60 * 60 * 1000;
    data.push(buildUsagePoint(1, MOCK_EMAILS[0], dayMs, 1.1));
    data.push(buildUsagePoint(2, MOCK_EMAILS[1], dayMs, 1.35));
    data.push(buildUsagePoint(3, MOCK_EMAILS[2], dayMs, 0.92));
    data.push(buildUsagePoint(4, MOCK_EMAILS[3], dayMs, 0.84));
    data.push(buildUsagePoint(5, MOCK_EMAILS[4], dayMs, 0.64));
  }

  return {
    data,
    period: {
      startDate: data[0]?.date ?? today.getTime(),
      endDate: data[data.length - 1]?.date ?? today.getTime()
    },
    pagination: {
      page: 1,
      pageSize: 1000,
      totalUsers: 5,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    }
  };
}

export function createMockFilteredUsageEventsResponse(nowMs = Date.now()): FilteredUsageEventsResponse {
  const now = nowMs;
  const sixHours = 6 * 60 * 60 * 1000;
  const twelveHours = 12 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  const data = [
    {
      timestamp: now - 45 * 60 * 1000,
      email: MOCK_EMAILS[0],
      model: "gpt-5",
      chargedCents: 124,
      totalCents: 118,
      cursorTokenFee: 6,
      requestsCosts: 1.24,
      inputTokens: 18400,
      outputTokens: 4220,
      cacheWriteTokens: 2300,
      cacheReadTokens: 5400
    },
    {
      timestamp: now - 2 * 60 * 60 * 1000,
      email: MOCK_EMAILS[1],
      model: "gpt-4.1",
      chargedCents: 93,
      totalCents: 90,
      cursorTokenFee: 3,
      requestsCosts: 0.93,
      inputTokens: 13200,
      outputTokens: 2980,
      cacheWriteTokens: 1900,
      cacheReadTokens: 4200
    },
    {
      timestamp: now - sixHours,
      email: MOCK_EMAILS[2],
      model: "gpt-4.1",
      chargedCents: 71,
      totalCents: 71,
      requestsCosts: 0.71,
      inputTokens: 8400,
      outputTokens: 1670,
      cacheWriteTokens: 900,
      cacheReadTokens: 2500
    },
    {
      timestamp: now - twelveHours,
      email: MOCK_EMAILS[3],
      model: "claude-sonnet-4",
      chargedCents: 66,
      totalCents: 63,
      cursorTokenFee: 3,
      requestsCosts: 0.66,
      inputTokens: 7900,
      outputTokens: 1380,
      cacheWriteTokens: 820,
      cacheReadTokens: 1900
    },
    {
      timestamp: now - oneDay - 2 * 60 * 60 * 1000,
      email: MOCK_EMAILS[4],
      model: "gpt-4.1-mini",
      chargedCents: 22,
      totalCents: 22,
      requestsCosts: 0.22,
      inputTokens: 2100,
      outputTokens: 520,
      cacheWriteTokens: 200,
      cacheReadTokens: 600,
      isFreeBugbot: false
    }
  ];

  return {
    data,
    period: {
      startDate: now - 30 * oneDay,
      endDate: now
    },
    pagination: {
      page: 1,
      pageSize: 200,
      totalCount: data.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    }
  };
}

export function createMockSetUserSpendLimitResponse(
  payload: SetUserSpendLimitRequest
): SetUserSpendLimitResponse {
  const email = payload.userEmail.trim() || "unknown";
  const limitLabel =
    payload.spendLimitDollars === null ? "limit cleared" : `limit set to $${payload.spendLimitDollars}`;
  return {
    outcome: "success",
    message: `[mock] ${email} ${limitLabel}`
  };
}
