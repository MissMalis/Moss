import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Rev 05 §1.1: the one row layout used everywhere — transactions, bills,
// earmarks. Fixed grid columns so figures and symbols stay aligned
// regardless of name length. Content per column is passed in as nodes so
// this stays usable for both "a bill with a category and an est badge"
// and "a transaction with a colored +/− amount and no category".
const GRID_COLUMNS = "34px 1fr 32px 30px 84px 16px";

export function StandardRow({
  leadingIcon,
  name,
  subtitle,
  categorySymbol,
  estBadge,
  amountNode,
  trailing,
  dimmed,
  href,
}: {
  leadingIcon: React.ReactNode;
  name: string;
  subtitle?: React.ReactNode;
  categorySymbol?: React.ReactNode;
  estBadge?: boolean;
  amountNode: React.ReactNode;
  trailing?: React.ReactNode;
  dimmed?: boolean;
  href?: string;
}) {
  const content = (
    <>
      {leadingIcon}
      <div className="min-w-0">
        <p className="truncate text-[13.5px] text-ink">{name}</p>
        {subtitle && <div className="mt-0.5">{subtitle}</div>}
      </div>
      <div className="flex justify-center">{categorySymbol}</div>
      <div className="flex justify-end">
        {estBadge && (
          <span className="inline-flex h-4 items-center rounded border border-border-strong px-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">
            est
          </span>
        )}
      </div>
      <div className="text-right text-[13.5px] tabular-nums">{amountNode}</div>
      <div className="flex items-center justify-end text-ink-3">
        {trailing ?? (href ? <ChevronRight size={16} /> : null)}
      </div>
    </>
  );

  const className = `grid items-center gap-[14px] py-2 ${dimmed ? "opacity-50" : ""}`;
  const style = { gridTemplateColumns: GRID_COLUMNS };

  if (href) {
    return (
      <Link href={href} className={`${className} transition hover:bg-card-soft rounded-lg -mx-1 px-1`} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
