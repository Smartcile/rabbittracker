import { describe, expect, it } from "vitest";
import { formatFoodAmount } from "./food.ts";

describe("formatFoodAmount", () => {
  it("formats grams below a kilogram", () => {
    expect(formatFoodAmount(0)).toBe("0 g");
    expect(formatFoodAmount(850)).toBe("850 g");
    expect(formatFoodAmount(999)).toBe("999 g");
  });

  it("formats kilograms from 1000 g", () => {
    expect(formatFoodAmount(1000)).toBe("1 kg");
    expect(formatFoodAmount(1500)).toBe("1.5 kg");
    expect(formatFoodAmount(12500)).toBe("12.5 kg");
  });

  it("keeps the sign for stock movements", () => {
    expect(formatFoodAmount(-250)).toBe("-250 g");
    expect(formatFoodAmount(-1500)).toBe("-1.5 kg");
  });
});
