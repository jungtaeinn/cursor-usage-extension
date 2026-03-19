import { describe, expect, it } from "vitest";

import {
  DAILY_USAGE_SYNC_MINUTES,
  SPEND_SYNC_MINUTES,
  shouldSyncOnTabChange
} from "./syncPolicy";

describe("desktop sync policy", () => {
  it("keeps mixed polling interval", () => {
    expect(SPEND_SYNC_MINUTES).toBe(5);
    expect(DAILY_USAGE_SYNC_MINUTES).toBe(60);
  });

  it("does not refetch on tab change", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(shouldSyncOnTabChange()).toBe(false);
    }
  });
});
