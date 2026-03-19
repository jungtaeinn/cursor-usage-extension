import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "../src/constants";
import { SyncService } from "../src/sync/syncService";
import { MemoryStorageAdapter } from "../src/sync/storage";

function createMockFetch(callCounter: Record<string, number>) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);

    if (url.endsWith("/teams/spend")) {
      callCounter.spend += 1;
      return new Response(
        JSON.stringify({
          teamMemberSpend: [
            {
              userId: 1,
              name: "Me",
              email: "me@example.com",
              role: "member",
              spendCents: 7000,
              overallSpendCents: 9000,
              fastPremiumRequests: 12,
              hardLimitOverrideDollars: 0,
              monthlyLimitDollars: 100
            }
          ],
          subscriptionCycleStart: 1700000000000,
          totalMembers: 1,
          totalPages: 1
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.endsWith("/teams/daily-usage-data")) {
      callCounter.daily += 1;
      return new Response(
        JSON.stringify({
          data: [],
          period: { startDate: 1700000000000, endDate: 1701000000000 },
          pagination: {
            page: 1,
            pageSize: 1000,
            totalUsers: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.includes("open.er-api.com")) {
      callCounter.fx += 1;
      return new Response(
        JSON.stringify({
          result: "success",
          rates: { KRW: 1320 },
          time_last_update_unix: 1701000000
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    return new Response("not found", { status: 404 });
  });
}

describe("SyncService", () => {
  it("dedupes concurrent syncAll manual refresh requests", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.setConfig({
      ...DEFAULT_CONFIG,
      apiKey: "test-key",
      myEmail: "me@example.com",
      teamBudgetUsd: 200
    });

    const calls = { spend: 0, daily: 0, fx: 0 };
    const service = new SyncService({
      storage,
      fetchImpl: createMockFetch(calls)
    });

    const [first, second] = await Promise.all([
      service.syncAll({ source: "manual", manual: true }),
      service.syncAll({ source: "manual", manual: true })
    ]);

    expect(first.lastSyncAt).not.toBeNull();
    expect(second.lastSyncAt).not.toBeNull();
    expect(calls.spend).toBe(1);
    expect(calls.daily).toBe(1);
    expect(calls.fx).toBe(1);
  });

  it("dedupes concurrent syncSpend calls", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.setConfig({
      ...DEFAULT_CONFIG,
      apiKey: "test-key",
      myEmail: "me@example.com",
      teamBudgetUsd: 100
    });

    const calls = { spend: 0, daily: 0, fx: 0 };
    const service = new SyncService({
      storage,
      fetchImpl: createMockFetch(calls)
    });

    await Promise.all([service.syncSpend("manual"), service.syncSpend("manual")]);

    expect(calls.spend).toBe(1);
  });
});
