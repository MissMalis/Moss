import { createLiabilityLoan, updateLiabilityLoan, deleteLiabilityLoan } from "@/lib/actions/liability-loans";
import { blendedApr } from "@/lib/net-worth";
import { formatMoney } from "@/lib/format";
import { AddButton } from "@/components/AddButton";
import { LINK_QUIET, BTN_SOLID, CARD, CARD_HEADER, INPUT } from "@/lib/ui";

interface LoanRow {
  id: string;
  name: string;
  balance: number;
  apr_pct: number | null;
}

const LOANS_GRID = "grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2";

/** Rev 06b v2 §4: grouped sub-loans — same pattern as holdings, but for debt. Defaults to one entry; the user can add more. */
export function LiabilityLoansSection({ accountId, loans }: { accountId: string; loans: LoanRow[] }) {
  const total = loans.reduce((s, l) => s + l.balance, 0);
  const blended = blendedApr(loans);

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between">
        <p className={CARD_HEADER}>Loans</p>
        <p className="text-[13px] text-ink-2">
          {formatMoney(total)}
          {blended != null && ` · ${blended}% blended`}
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className={`${LOANS_GRID} pb-1.5 text-center text-[11px] uppercase tracking-wide text-ink-3`}>
          <span>Name</span>
          <span>Balance</span>
          <span>APR %</span>
          <span />
        </div>
        <div className="space-y-1.5">
          {loans.map((l) => {
            const formId = `loan-${l.id}`;
            return (
              <div key={l.id} className={`${LOANS_GRID} rounded-lg border border-border bg-card-soft px-2 py-1.5 text-[12.5px]`}>
                <form id={formId} action={updateLiabilityLoan} className="hidden">
                  <input type="hidden" name="id" value={l.id} />
                </form>
                <input form={formId} name="name" defaultValue={l.name} className={`w-full py-1 text-[12.5px] ${INPUT}`} />
                <input
                  form={formId}
                  type="number"
                  step="0.01"
                  name="balance"
                  defaultValue={l.balance}
                  className={`w-full py-1 text-right text-[12.5px] ${INPUT}`}
                />
                <input
                  form={formId}
                  type="number"
                  step="0.01"
                  name="apr_pct"
                  defaultValue={l.apr_pct ?? ""}
                  className={`w-full py-1 text-right text-[12.5px] ${INPUT}`}
                />
                <span className="flex items-center gap-2 justify-self-end">
                  <button form={formId} type="submit" className={LINK_QUIET}>
                    Save
                  </button>
                  <form action={deleteLiabilityLoan}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className={LINK_QUIET}>
                      Remove
                    </button>
                  </form>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <AddButton label="Add sub-loan">
          <form action={createLiabilityLoan} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="account_id" value={accountId} />
            <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">
              Name
              <input name="name" required className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">
              Balance
              <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-28 ${INPUT}`} />
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">
              APR %
              <input type="number" step="0.01" name="apr_pct" className={`w-20 ${INPUT}`} />
            </label>
            <div className="mt-1 flex w-full justify-end">
              <button type="submit" className={BTN_SOLID}>
                Add
              </button>
            </div>
          </form>
        </AddButton>
      </div>
    </section>
  );
}
