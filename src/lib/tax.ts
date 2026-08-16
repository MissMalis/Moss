// Rev 06b §7: taxes — honest scope. One configurable location tax rate,
// applied to a subtotal only when the user manually flags a charge as
// needing it (some charges already include tax, some don't — the user
// decides per charge, Moss doesn't guess).

export function applyTax(subtotal: number, applyTax: boolean, taxRatePct: number | null): number {
  if (!applyTax || !taxRatePct) return subtotal;
  return Math.round(subtotal * (1 + taxRatePct / 100) * 100) / 100;
}
