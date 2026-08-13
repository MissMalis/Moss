// Candy color assignment for the spending ring. Colors are generated at
// render time from a fixed set of anchor stops — never hardcoded per
// category — so the ring stays a clean rainbow whether there are 2
// categories or 10, and never drifts into muddy olive/teal the way a raw
// HSL sweep does.

const ANCHORS: [number, number, number][] = [
  [232, 93, 110], // coral / raspberry
  [242, 145, 61], // mango
  [235, 201, 74], // lemon
  [95, 190, 126], // leaf green
  [91, 147, 214], // sky blue
  [139, 123, 216], // grape
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** p in [0,1] -> an RGB CSS color string, interpolated across the candy anchors. */
export function candyColorAt(p: number): string {
  const clamped = Math.min(1, Math.max(0, p));
  const scaled = clamped * (ANCHORS.length - 1);
  const i = Math.min(ANCHORS.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const [r1, g1, b1] = ANCHORS[i];
  const [r2, g2, b2] = ANCHORS[i + 1];
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Evenly-spaced positions for n categories shown at once (single category -> center). */
export function evenSpectrumPositions(n: number): number[] {
  if (n <= 1) return [0.5];
  return Array.from({ length: n }, (_, i) => i / (n - 1));
}

/**
 * Deterministic [0,1] position for a category name, stable across renders
 * and months, and unaffected by other categories being added or removed —
 * this is what lets a category keep "its" color once the user has learned
 * it (e.g. "orange = Food"), rather than shifting whenever categories are
 * inserted.
 */
export function stableSpectrumPosition(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0; // 32-bit
  }
  return (Math.abs(hash) % 10000) / 10000;
}

export function candyColorForCategory(name: string): string {
  return candyColorAt(stableSpectrumPosition(name));
}

/**
 * Colors for a specific set of categories shown together: sorted by each
 * category's stable hash position, then spread evenly across the spectrum.
 * This gives well-separated colors regardless of category count (the thing
 * pure per-name hashing can't guarantee — two categories can hash close
 * together and land as near-identical reds), while the *order* — and so
 * roughly which hue family a category falls into — stays stable across
 * renders, since it's driven by the same stable hash every time.
 */
export function candyColorsForCategories(names: string[]): Map<string, string> {
  const sorted = [...new Set(names)].sort(
    (a, b) => stableSpectrumPosition(a) - stableSpectrumPosition(b),
  );
  const positions = evenSpectrumPositions(sorted.length);
  const map = new Map<string, string>();
  sorted.forEach((name, i) => map.set(name, candyColorAt(positions[i])));
  return map;
}
