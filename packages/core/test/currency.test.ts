import { describe, expect, it } from "vitest";

import {
  centsToUsd,
  formatKrw,
  formatUsdWithApproxKrw,
  usdToKrw
} from "../src/utils/currency";

describe("currency utils", () => {
  it("converts cents to usd", () => {
    expect(centsToUsd(12345)).toBe(123.45);
  });

  it("converts usd to krw", () => {
    expect(usdToKrw(100, 1320)).toBe(132000);
  });

  it("formats usd with approximate krw", () => {
    const text = formatUsdWithApproxKrw(10, 1300, "ko-KR");
    expect(text).toContain("$10.00");
    expect(text).toContain("약");
    expect(text).toContain("₩13,000");
  });

  it("formats krw", () => {
    expect(formatKrw(10000)).toBe("₩10,000");
  });
});
