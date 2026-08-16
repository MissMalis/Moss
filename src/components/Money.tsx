import { splitMoney } from "@/lib/format";

const SIZES = {
  hero: { dollars: "text-[52px] leading-[1.05]", cents: "text-[32px]" },
  section: { dollars: "text-[40px] leading-[1.05]", cents: "text-[26px]" },
  card: { dollars: "text-[21px] leading-[1.2]", cents: "text-[13px]" },
  stat: { dollars: "text-[21px] leading-[1.2]", cents: "text-[13px]" },
  // Rev 07 #2: the Assets/Liabilities group-row subtotal — bold and dark
  // like its parent total, one tier smaller.
  subtotal: { dollars: "text-[17px] leading-[1.2]", cents: "text-[11px]" },
} as const;

export function Money({
  value,
  size = "card",
  className = "",
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { sign, dollars, cents } = splitMoney(value);
  const s = SIZES[size];
  return (
    <span
      className={`font-display font-semibold tracking-[-0.02em] tabular-nums text-ink ${className}`}
    >
      <span className={s.dollars}>
        {sign}${dollars}
      </span>
      <span className={`${s.cents} text-ink-3`}>.{cents}</span>
    </span>
  );
}
