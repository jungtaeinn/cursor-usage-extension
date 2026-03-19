import { describe, expect, it } from "vitest";

import {
  createMockDailyUsageResponse,
  createMockSetUserSpendLimitResponse,
  createMockSpendResponse,
  isMockApiKey
} from "../src/mock/cursorMock";

describe("cursor mock fixtures", () => {
  it("detects mock api keys", () => {
    expect(isMockApiKey("mock_demo")).toBe(true);
    expect(isMockApiKey("  MOCK_team ")).toBe(true);
    expect(isMockApiKey("cu_live_real")).toBe(false);
  });

  it("builds spend response with docs-compatible fields", () => {
    const spend = createMockSpendResponse("owner@company.com", 1711929600000);
    expect(spend.totalPages).toBe(1);
    expect(spend.totalMembers).toBeGreaterThan(0);
    expect(spend.teamMemberSpend[0]?.email).toBe("owner@company.com");
    expect(spend.teamMemberSpend[0]?.monthlyLimitDollars).toBeTypeOf("number");
    expect(spend.subscriptionCycleStart).toBeGreaterThan(0);
  });

  it("builds daily usage response with period and pagination", () => {
    const usage = createMockDailyUsageResponse(1711929600000);
    expect(usage.data.length).toBeGreaterThan(0);
    expect(usage.period.startDate).toBeLessThanOrEqual(usage.period.endDate);
    expect(usage.pagination?.page).toBe(1);
    expect(usage.pagination?.hasNextPage).toBe(false);
  });

  it("returns mock set spend limit result", () => {
    const result = createMockSetUserSpendLimitResponse({
      userEmail: "dev@company.com",
      spendLimitDollars: 120
    });
    expect(result.outcome).toBe("success");
    expect(result.message).toContain("[mock]");
  });
});
