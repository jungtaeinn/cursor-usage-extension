import { describe, expect, it, vi } from "vitest";

import { CursorApiClient } from "../src/api/cursorApi";

describe("CursorApiClient", () => {
  it("retries on 429 with exponential backoff", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "too many requests" }), {
          status: 429,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "too many requests" }), {
          status: 429,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            teamMemberSpend: [],
            subscriptionCycleStart: 1700000000000,
            totalMembers: 0,
            totalPages: 0
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      );

    const sleeps: number[] = [];
    const client = new CursorApiClient("test-api-key", {
      fetchImpl: fetchMock,
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      }
    });

    const response = await client.postSpend();
    expect(response.totalMembers).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1000, 2000]);
  });
});
