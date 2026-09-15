export function formatFoodAmount(grams: number): string {
  const value = Math.round(grams);
  if (Math.abs(value) >= 1000) {
    return `${Number((value / 1000).toFixed(2))} kg`;
  }
  return `${value} g`;
}
