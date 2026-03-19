import { describe, expect, it } from "vitest";

import { evaluateAlertTransitions } from "../src/alerts/alertEngine";
import type { AlertState, UsageSummary } from "../src/types";

const baseSummary: UsageSummary = {
  myEmail: "me@example.com",
  mySpendUsd: 90,
  myLimitUsd: 100,
  teamSpendUsd: 800,
  teamBudgetUsd: 1000,
  cycleStart: 1700000000000
};

describe("alert engine", () => {
  it("triggers alerts when threshold is crossed", () => {
    const previous: AlertState = { sent: {} };
    const result = evaluateAlertTransitions(
      baseSummary,
      { personalPercent: 80, teamPercent: 70 },
      previous
    );

    expect(result.payloads).toHaveLength(2);
    expect(Object.keys(result.nextState.sent)).toHaveLength(2);
  });

  it("does not trigger the same alert twice in the same cycle", () => {
    const first = evaluateAlertTransitions(
      baseSummary,
      { personalPercent: 80, teamPercent: 80 },
      { sent: {} }
    );
    const second = evaluateAlertTransitions(
      baseSummary,
      { personalPercent: 80, teamPercent: 80 },
      first.nextState
    );

    expect(first.payloads).toHaveLength(2);
    expect(second.payloads).toHaveLength(0);
  });
});
