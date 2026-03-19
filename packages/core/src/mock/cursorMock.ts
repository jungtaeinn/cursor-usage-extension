import type {
  DailyUsagePoint,
  DailyUsageResponse,
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
