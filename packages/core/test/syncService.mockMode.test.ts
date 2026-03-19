import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "../src/constants";
import { MemoryStorageAdapter } from "../src/sync/storage";
import { SyncService } from "../src/sync/syncService";

describe("SyncService mock api mode", () => {
  it("loads spend and daily usage without hitting Cursor endpoints when api key is mock", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.setConfig({
      ...DEFAULT_CONFIG,
      apiKey: "mock_demo",
      myEmail: "taeinn@company.com",
      teamBudgetUsd: 1200
    });

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("open.er-api.com")) {
        return new Response(
          JSON.stringify({
            result: "success",
            rates: { KRW: 1370 },
            time_last_update_unix: 1712000000
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      throw new Error(`unexpected remote call: ${url}`);
    });

    const service = new SyncService({ storage, fetchImpl: fetchMock });
    const snapshot = await service.syncAll({ source: "manual", manual: true });

    expect(snapshot.spend).not.toBeNull();
    expect(snapshot.dailyUsage).not.toBeNull();
    expect(snapshot.errors.spend).toBeUndefined();
    expect(snapshot.errors.dailyUsage).toBeUndefined();
    expect(snapshot.stale.spend).toBe(false);
    expect(snapshot.stale.dailyUsage).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("open.er-api.com");
  });
});
