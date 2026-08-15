import Link from "next/link";
import { listCards, listUnsweptCharges, listRecentSweptCharges } from "@/lib/data/cards";
import { listAccounts } from "@/lib/data/accounts";
import { listPurchasesInRange } from "@/lib/data/income";
import { getSettings } from "@/lib/data/settings";
import { reconciliationStatus } from "@/lib/cards";
import {
  deleteCardCharge,
  sweepPendingCharges,
  markForbiddenMoneyAccount,
  reconcileForbiddenMoney,
  payOffCard,
  setCashAppCard,
} from "@/lib/actions/cards";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { MockCard } from "@/components/MockCard";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { RecentList } from "@/components/RecentList";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { lucideKey } from "@/lib/icons";
import { groupByDate, type TransactionLike } from "@/lib/recent-transactions";
import { BTN_GHOST, BTN_MOSS, BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, ROW, SCROLL_LIST } from "@/lib/ui";

const LOOKBACK_DAYS = 60;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function SweepPage() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const sinceISO = addDays(todayISO, -LOOKBACK_DAYS);

  const [cards, unswept, recentSwept, accounts, settings, purchases] = await Promise.all([
    listCards(),
    listUnsweptCharges(),
    listRecentSweptCharges(),
    listAccounts(),
    getSettings(),
    listPurchasesInRange(sinceISO, todayISO),
  ]);

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const bufferAccount = accounts.find((a) => a.is_forbidden_money) ?? null;
  const liabilityAccounts = accounts.filter((a) => a.type === "Liabilities");
  const pendingTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const status = bufferAccount ? reconciliationStatus(bufferAccount) : null;
  const channelingCard = cards.find((c) => c.id === settings.cash_app_card_id) ?? null;

  // Rev 05 §1.12/§6: the shared recent-transactions component, filtered to
  // rewards-card charges — same underlying data as Dashboard/Expenses, not
  // a copy.
  const rewardsTransactions: TransactionLike[] = purchases
    .filter((p) => p.payment_source === "rewards_card")
    .map((p) => ({ id: p.id, name: p.name, amount: p.amount, date: p.spent_on, kind: "outflow", category: p.category || null }));
  const rewardsGroups = groupByDate(rewardsTransactions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Sweep</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          Rewards-card charges, logged once on{" "}
          <Link href="/expenses/log" className="underline decoration-border-strong hover:text-ink">
            Expenses
          </Link>
          , land here quarantined from Safe to spend until you sweep them.
        </p>
      </div>

      <div className={CARD}>
        <p className={CARD_HEADER}>Rewards-card charges</p>
        {rewardsGroups.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-3">Nothing logged yet.</p>
        ) : (
          <div className={`mt-3 ${SCROLL_LIST}`}>
            <RecentList groups={rewardsGroups} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <div className="flex items-center justify-between gap-2">
            <p className={CARD_HEADER}>Step 1 · Select charges to sweep</p>
            <Money value={pendingTotal} size="card" />
          </div>
          <p className="mt-1 flex items-center gap-1 text-[12.5px] text-ink-2">
            Quarantined until swept — nothing is removed just because the month changed
            <Tooltip text="Rewards-card charges don't draw down Safe to Spend right away — they wait here, possibly for weeks, until you sweep them into your buffer account." />
          </p>

          {unswept.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={lucideKey("sparkles")} title="Nothing pending" hint="Charges logged with a rewards card show up here." />
            </div>
          ) : (
            <>
              <div className={`mt-4 space-y-1.5 ${SCROLL_LIST}`}>
                {unswept.map((c) => (
                  <div key={c.id} className={`${ROW} flex items-center gap-3`}>
                    <input
                      type="checkbox"
                      form="sweep-select-form"
                      name="ids"
                      value={c.id}
                      defaultChecked
                      className="h-4 w-4 shrink-0 rounded border-border-strong accent-moss"
                      aria-label={`Include ${c.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-ink">{c.name}</p>
                      <p className="truncate text-[12px] text-ink-3">
                        {cardById.get(c.card_id)?.name ?? "—"} · {formatShortDateLabel(c.spent_on)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13.5px] text-ink tabular-nums">{formatMoney(c.amount)}</span>
                    <ConfirmDeleteButton action={deleteCardCharge} hiddenFields={{ id: c.id }} itemLabel={c.name} variant="link" />
                  </div>
                ))}
              </div>
              <ActionForm id="sweep-select-form" action={sweepPendingCharges} className="mt-3">
                <button type="submit" className={BTN_MOSS}>
                  Sweep selected
                </button>
              </ActionForm>
            </>
          )}
        </div>

        <div className={CARD}>
          <p className={CARD_HEADER}>Step 2 · Confirm paid off</p>
          <p className="mt-1 text-[12.5px] text-ink-2">
            Swept charges below have already moved into {bufferAccount?.name ?? "your buffer account"}. When you
            actually pay the card, confirm it here so the liability comes down too.
          </p>

          {recentSwept.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-3">Nothing swept yet.</p>
          ) : (
            <div className={`mt-4 space-y-1 ${SCROLL_LIST}`}>
              {recentSwept.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[13px] text-ink-2">
                  <span className="truncate">
                    {c.name}{" "}
                    <span className="text-ink-3">
                      · {cardById.get(c.card_id)?.name ?? "—"} · {formatShortDateLabel(c.spent_on)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoney(c.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {bufferAccount &&
            (liabilityAccounts.length === 0 ? (
              <p className="mt-4 text-[13px] text-ink-3 border-t border-border pt-4">
                Add the card&apos;s balance as a liability account in Net worth first.
              </p>
            ) : (
              <form action={payOffCard} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <input type="hidden" name="buffer_account_id" value={bufferAccount.id} />
                <label className={LABEL}>
                  Card balance
                  <select name="liability_account_id" className={INPUT}>
                    {liabilityAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.balance)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={LABEL}>
                  Amount paid
                  <input type="number" step="0.01" name="amount" required className={`w-28 ${INPUT}`} />
                </label>
                <button type="submit" className={BTN_SOLID}>
                  Confirm paid
                </button>
              </form>
            ))}
        </div>
      </div>

      <div className={CARD}>
        <p className={CARD_HEADER}>Reconciliation</p>
        {!bufferAccount ? (
          <div className="mt-3">
            <EmptyState
              icon={lucideKey("landmark")}
              title="No buffer account set"
              hint="Mark a Cash account below to receive swept totals."
            />
          </div>
        ) : (
          <div className={`mt-3 ${ROW}`}>
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
      </div>

      <div className={`${CARD} flex flex-wrap items-start gap-6`}>
        {channelingCard ? (
          <MockCard name={channelingCard.name} last4={channelingCard.last4} network={channelingCard.network} color={channelingCard.color} />
        ) : (
          <div className="flex h-[150px] w-[240px] items-center justify-center rounded-lg border border-dashed border-border-strong text-[12.5px] text-ink-3">
            No channeling card set
          </div>
        )}
        <div className="min-w-[220px] flex-1">
          <p className="flex items-center gap-1 text-[13px] text-ink-2">
            Which card channels rewards charges into your buffer?
            <Tooltip text="Just for the visual above and for Sweep — pick whichever card you use for quarantined rewards spending. Manage the card itself from its account in Net worth." />
          </p>
          <form action={setCashAppCard} className="mt-2 flex items-center gap-2">
            <select name="cash_app_card_id" defaultValue={settings.cash_app_card_id ?? ""} className={INPUT}>
              <option value="">None</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className={BTN_GHOST}>
              Save
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
