import { describe, expect, it } from "vitest";

import { transitionTab, type OptionsTabKey } from "./tabState";

describe("tab transition request policy", () => {
  it("never requests refetch on tab switch", () => {
    const order: OptionsTabKey[] = ["overview", "team", "settings"];

    for (let i = 0; i < 200; i += 1) {
      const key = order[i % order.length] as OptionsTabKey;
      const result = transitionTab(key);
      expect(result.shouldRefetch).toBe(false);
    }
  });
});
