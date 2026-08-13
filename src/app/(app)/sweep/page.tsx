import { listCards, listCardMultipliers, listUnsweptCharges, listRecentSweptCharges } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/recurring";
import { listAccounts } from "@/lib/data/accounts";
import { reconciliationStatus } from "@/lib/cards";
import {
  deleteCardCharge,
  sweepPendingCharges,
  markForbiddenMoneyAccount,
  reconcileForbiddenMoney,
} from "@/lib/actions/cards";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { LogCardChargeForm } from "@/components/LogCardChargeForm";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

export default async function SweepPage() {
  const [cards, multipliers, unswept, recentSwept, categories, accounts] = await Promise.all([
    listCards(),
    listCardMultipliers(),
    listUnsweptCharges(),
    listRecentSweptCharges(),
    listCategories(),
    listAccounts(),
  ]);

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const bufferAccount = accounts.find((a) => a.is_forbidden_money) ?? null;
  const pendingTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const status = bufferAccount ? reconciliationStatus(bufferAccount) : null;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[12.5px] uppercase tracking-wide text-ink-3">Pending</p>
        <p className="font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          {formatMoney(pendingTotal)}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-ink-2">
          Quarantined from Safe to spend until swept into your buffer account
          <Tooltip text="Rewards-card charges don't draw down Safe to Spend right away — they wait here until you sweep them, matching what you'll actually owe on the statement." />
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Log a card charge</h2>
        <p className="mb-3 text-[13px] text-ink-2">
          These stay quarantined from Safe to spend — they never draw down your checking balance
          in real time the way logged expenses do.
        </p>
        {cards.length === 0 ? (
          <EmptyState emoji="🧾" title="Add a card in Portfolio first" />
        ) : (
          <LogCardChargeForm cards={cards} multipliers={multipliers} categories={categories} />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-medium text-ink">Pending charges</h2>
          {unswept.length > 0 && (
            <form action={sweepPendingCharges}>
              <button type="submit" className={BTN_SOLID}>
                Sweep now
              </button>
            </form>
          )}
        </div>
        {unswept.length === 0 ? (
          <EmptyState emoji="🧹" title="Nothing pending" hint="Logged charges will show up here until swept." />
        ) : (
          <div className="space-y-1.5">
            {unswept.map((c) => (
              <div key={c.id} className={`${ROW} flex items-center justify-between`}>
                <span className="text-[13.5px] text-ink">
                  {c.name}{" "}
                  <span className="text-ink-3">
                    · {cardById.get(c.card_id)?.name ?? "—"} · {formatShortDateLabel(c.spent_on)}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[13.5px] text-ink tabular-nums">{formatMoney(c.amount)}</span>
                  <form action={deleteCardCharge}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className={LINK_QUIET}>
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {recentSwept.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
              Recently swept
            </summary>
            <div className="mt-2 space-y-1">
              {recentSwept.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[13px] text-ink-2">
                  <span>
                    {c.name} <span className="text-ink-3">· {formatShortDateLabel(c.spent_on)}</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(c.amount)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Reconciliation</h2>
        {!bufferAccount ? (
          <EmptyState
            emoji="🏦"
            title="No buffer account set"
            hint="Mark a Cash account below to receive swept totals."
          />
        ) : (
          <div className={ROW}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[14px] text-ink">{bufferAccount.name}</p>
                <p className="text-[12px] text-ink-3">Expected (swept total)</p>
              </div>
              <Money value={status!.expected} size="card" />
            </div>
            {status!.shortBy > 0 && (
              <p className="mt-2 text-[13px] text-hold">
                Short by {formatMoney(status!.shortBy)} — move that into your buffer account to
                catch up.
              </p>
            )}
            <form action={reconcileForbiddenMoney} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="id" value={bufferAccount.id} />
              <label className={LABEL}>
                Actual buffer balance
                <input
                  type="number"
                  step="0.01"
                  name="reconciled_balance"
                  defaultValue={bufferAccount.reconciled_balance ?? ""}
                  className={`w-32 ${INPUT}`}
                />
              </label>
              <button type="submit" className={BTN_GHOST}>
                Reconcile
              </button>
            </form>
          </div>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
            Change which account is the buffer
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {accounts
              .filter((a) => a.type === "Cash")
              .map((a) => (
                <form key={a.id} action={markForbiddenMoneyAccount}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className={a.is_forbidden_money ? BTN_SOLID : BTN_GHOST}
                  >
                    {a.name}
                  </button>
                </form>
              ))}
          </div>
        </details>
      </section>
    </div>
  );
}
