/**
 * Renders whatever's stored in an icon/emoji field — a plain emoji
 * character, or a small uploaded image saved as a data: URI (rev 04
 * §1.11) — as a circular glyph either way.
 */
export function IconGlyph({
  value,
  fallback,
  className = "text-[16px]",
}: {
  value?: string | null;
  fallback?: string;
  className?: string;
}) {
  if (value?.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element -- small inline data URI, not worth next/image's pipeline
    return <img src={value} alt="" className={`h-[1em] w-[1em] rounded-full object-cover ${className}`} />;
  }
  return <span className={className}>{value || fallback}</span>;
}
