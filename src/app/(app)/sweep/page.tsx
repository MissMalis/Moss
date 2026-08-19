import Link from "next/link";
import { listCards, listUnsweptCharges, listRecentSweptCharges } from "@/lib/data/cards";
import { listAccounts } from "@/lib/data/accounts";
import { listPurchasesInRange } from "@/lib/data/income";
import { listCategories } from "@/lib/data/recurring";
import { getSettings } from "@/lib/data/settings";
import { deleteCardCharge, sweepPendingCharges } from "@/lib/actions/cards";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { RecentList } from "@/components/RecentList";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BufferChannelControl } from "@/components/BufferChannelControl";
import { PayOffCardForm } from "@/components/PayOffCardForm";
import { lucideKey } from "@/lib/icons";
import { groupByDate, type TransactionLike } from "@/lib/recent-transactions";
import { BTN_MOSS, CARD, CARD_HEADER, ROW, SCROLL_LIST } from "@/lib/ui";

const LOOKBACK_DAYS = 60;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function SweepPage() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const sinceISO = addDays(todayISO, -LOOKBACK_DAYS);

  const [cards, unswept, recentSwept, accounts, settings, purchases, categories] = await Promise.all([
    listCards(),
    listUnsweptCharges(),
    listRecentSweptCharges(),
    listAccounts(),
    getSettings(),
    listPurchasesInRange(sinceISO, todayISO),
    listCategories(),
  ]);
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const bufferAccount = accounts.find((a) => a.is_forbidden_money) ?? null;
  const cashAccounts = accounts.filter((a) => a.type === "Cash" || a.type === "Checking" || a.type === "Savings");
  // Rev 06b v2 §4/Rev 08 #14: only credit-card liabilities are payable
  // here — an auto loan or mortgage isn't "a card" Sweep can pay off. The
  // legacy "Liabilities" catch-all type used to be allowed through too,
  // which is exactly how a Car loan / Student loan row could show up in
  // this list — its type is that generic legacy string, not a real credit
  // card, regardless of what its name says.
  const liabilityAccounts = accounts.filter((a) => a.type === "Credit card");
  const pendingTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const channelingCard = cards.find((c) => c.id === settings.cash_app_card_id) ?? null;

  // Rev 05 §1.12/§6: the shared recent-transactions component, filtered to
  // rewards-card charges — same underlying data as Dashboard/Expenses, not
  // a copy.
  const rewardsTransactions: TransactionLike[] = purchases
    .filter((p) => p.payment_source === "rewards_card")
    .map((p) => ({
      id: p.id,
      name: p.name,
      amount: p.amount,
      date: p.spent_on,
      kind: "outflow",
      category: p.category || null,
      categoryIcon: p.category ? (categoryByName.get(p.category)?.emoji ?? null) : null,
      categoryColor: p.category ? (categoryByName.get(p.category)?.color ?? null) : null,
    }));
  const rewardsGroups = groupByDate(rewardsTransactions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Sweep</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          Rewards-card charges, logged once on{" "}
          <Link href="/expenses" className="underline decoration-border-strong hover:text-ink">
            Bills &amp; expenses
          </Link>
          , land here quarantined from Safe to spend until you sweep them.
        </p>
      </div>

      <BufferChannelControl
        bufferAccount={bufferAccount}
        cashAccounts={cashAccounts}
        channelingCard={channelingCard}
        cards={cards}
      />

      <div className={CARD}>
        <p className={CARD_HEADER}>Rewards-card charges</p>
        <div className={`mt-3 ${SCROLL_LIST}`}>
          {rewardsGroups.length === 0 ? (
            <p className="text-[13px] text-ink-3">Nothing logged yet.</p>
          ) : (
            <RecentList groups={rewardsGroups} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <div className="flex items-center justify-between gap-2">
            <p className={`flex items-center gap-1 ${CARD_HEADER}`}>
              Step 1 · Select charges to sweep
              <Tooltip text="Review your rewards-card transactions. Once you've moved the money from your bank into your channel account, select the transactions and sweep them." />
            </p>
            <Money value={pendingTotal} size="card" />
          </div>

          <div className={`mt-4 space-y-1.5 ${SCROLL_LIST}`}>
            {unswept.length === 0 ? (
              <EmptyState icon={lucideKey("sparkles")} title="Nothing pending" hint="Charges logged with a rewards card show up here." />
            ) : (
              unswept.map((c) => (
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
              ))
            )}
          </div>
          {unswept.length > 0 && (
            <ActionForm id="sweep-select-form" action={sweepPendingCharges} className="mt-3">
              <button type="submit" className={BTN_MOSS}>
                Sweep selected
              </button>
            </ActionForm>
          )}
        </div>

        <div className={CARD}>
          <p className={`flex items-center gap-1 ${CARD_HEADER}`}>
            Step 2 · Confirm paid off
            <Tooltip text="Review what you owe below. Once you've paid the card, pick the card, pick the transactions (or type a custom amount), and confirm." />
          </p>

          {bufferAccount ? (
            <PayOffCardForm
              bufferAccountId={bufferAccount.id}
              recentSwept={recentSwept}
              cards={cards}
              liabilityAccounts={liabilityAccounts}
              categories={categories}
            />
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={lucideKey("landmark")}
                title="No buffer account set"
                hint="Set one above to confirm payoffs here."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
