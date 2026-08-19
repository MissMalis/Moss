import { createElement } from "react";
import { Circle } from "lucide-react";
import { resolveLucideIcon, isDataUrlValue, resolveEmoji } from "@/lib/icons";
import { candyColorForCategory } from "@/lib/candy-colors";

const SIZES = { sm: 26, md: 34, lg: 44 } as const;

/**
 * Rev 05 §1.1/§1.2: the two icon treatments used throughout the standard
 * row — "solid" (bill/item identity, left column: colored circle + first
 * letter, or a real logo) and "tinted" (category symbol, middle column:
 * the category's icon in a soft-tinted circle of its own color).
 *
 * Rev 08 #1: a "tinted" circle with no resolvable icon/emoji (e.g. a
 * category created without picking one) must NEVER fall back to a bare
 * letter — that's the repeat-offender bug. It falls back to a neutral
 * generic circle glyph instead. "solid" identity dots (bills/accounts)
 * keep their letter-avatar fallback — that one was never broken.
 */
export function IconCircle({
  value,
  label,
  color,
  variant = "tinted",
  size = "md",
}: {
  value?: string | null;
  label: string;
  color?: string | null;
  variant?: "solid" | "tinted";
  size?: "sm" | "md" | "lg";
}) {
  const px = SIZES[size];
  const resolvedColor = color || candyColorForCategory(label);
  const iconComponent = resolveLucideIcon(value);
  const emoji = resolveEmoji(value);

  if (isDataUrlValue(value)) {
    // eslint-disable-next-line @next/next/no-img-element -- small inline data URI, not worth next/image's pipeline
    return <img src={value!} alt="" className="shrink-0 rounded-full object-cover" style={{ width: px, height: px }} />;
  }

  const background = variant === "solid" ? resolvedColor : `${resolvedColor}22`;
  const foreground = variant === "solid" ? "#ffffff" : resolvedColor;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: px, height: px, background }}
      aria-hidden
    >
      {emoji ? (
        <span style={{ fontSize: Math.round(px * 0.55), lineHeight: 1 }}>{emoji}</span>
      ) : iconComponent ? (
        createElement(iconComponent, { size: Math.round(px * 0.55), color: foreground, strokeWidth: 2 })
      ) : variant === "tinted" ? (
        <Circle size={Math.round(px * 0.55)} color={foreground} strokeWidth={2} />
      ) : (
        <span className="text-[13px] font-medium" style={{ color: foreground }}>
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
