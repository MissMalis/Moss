import Link from "next/link";
import { listDeductions, listIncomeSources } from "@/lib/data/income";
import { formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { lucideKey } from "@/lib/icons";
import { CARD, CARD_HEADER, LINK_QUIET_UNDERLINE, ROW } from "@/lib/ui";

/** Rev 04 §6: read-only here — editing lives in Income, the single source of truth. */
export default async function ContributionsPage() {
  const [deductions, incomeSources] = await Promise.all([listDeductions(), listIncomeSources()]);
  const incomeById = new Map(incomeSources.map((s) => [s.id, s]));
  const total = deductions.reduce((s, d) => s + d.amount, 0);

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1">
          <p className={CARD_HEADER}>Contributions posting this period</p>
          <Tooltip text="Posts automatically when you mark a pay date posted on Dashboard." />
        </div>
        <Link href="/income" className={LINK_QUIET_UNDERLINE}>
          Manage in Income
        </Link>
      </div>

      {deductions.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={lucideKey("landmark")} title="No contributions set up" />
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {deductions.map((d) => {
              const source = incomeById.get(d.income_source_id ?? "");
              return (
                <div key={d.id} className={`${ROW} flex items-center justify-between`}>
                  <div>
                    <p className="text-[14px] text-ink">{d.name}</p>
                    <p className="text-[12px] text-ink-3">
                      {source?.name ?? "—"} · {d.tax_treatment === "pre_tax" ? "pre-tax" : "post-tax (Roth)"}
                      {d.employer_match > 0 && ` · +${formatMoney(d.employer_match)} match`}
                    </p>
                  </div>
                  <span className="text-[14px] text-ink tabular-nums">{formatMoney(d.amount)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between border-t border-border px-3.5 pt-3 text-[13.5px] font-medium">
            <span className="text-ink-2">Total this period</span>
            <span className="text-ink tabular-nums">{formatMoney(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}
