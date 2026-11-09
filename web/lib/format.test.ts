import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatNumber } from "./format";

describe("Uzbek formatters", () => {
  it("formats numbers and money", () => { expect(formatNumber(12480)).toContain("12"); expect(formatMoney(69000)).toContain("so‘m"); });
  it("handles missing dates", () => { expect(formatDate()).toBe("—"); });
});

