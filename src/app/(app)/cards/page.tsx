import { listCards, listCardMultipliers, listUnsweptCharges, listRecentSweptCharges } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/recurring";
import { listAccounts } from "@/lib/data/accounts";
import { getSettings } from "@/lib/data/settings";
import { reconciliationStatus } from "@/lib/cards";
import {
  createCard,
  deleteCard,
  createMultiplier,
  deleteMultiplier,
  deleteCardCharge,
  sweepPendingCharges,
  markForbiddenMoneyAccount,
  reconcileForbiddenMoney,
  setCashAppCard,
} from "@/lib/actions/cards";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { MockCard } from "@/components/MockCard";
import { LogCardChargeForm } from "@/components/LogCardChargeForm";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

export default async function CardsPage() {
  const [cards, multipliers, unswept, recentSwept, categories, accounts, settings] = await Promise.all([
    listCards(),
    listCardMultipliers(),
    listUnsweptCharges(),
    listRecentSweptCharges(),
    listCategories(),
    listAccounts(),
    getSettings(),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const forbiddenMoneyAccount = accounts.find((a) => a.is_forbidden_money) ?? null;
  const cashAppCard = cards.find((c) => c.id === settings.cash_app_card_id) ?? null;
  const pendingTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const status = forbiddenMoneyAccount ? reconciliationStatus(forbiddenMoneyAccount) : null;

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-start gap-6">
        {cashAppCard ? (
          <MockCard
            name={cashAppCard.name}
            last4={cashAppCard.last4}
            network={cashAppCard.network}
            color={cashAppCard.color}
          />
        ) : (
          <div className="flex h-[150px] w-[240px] items-center justify-center rounded-2xl border border-dashed border-border-strong text-[12.5px] text-ink-3">
            No Cash App card set
          </div>
        )}
        <div className="flex-1 min-w-[220px]">
          <p className="text-[13px] text-ink-2">
            Which card is your Cash App card?
            <Tooltip text="Just for the visual above — pick whichever card you use for Cash App spending." />
          </p>
          <form action={setCashAppCard} className="mt-2 flex items-center gap-2">
            <select
              name="cash_app_card_id"
              defaultValue={settings.cash_app_card_id ?? ""}
              className={INPUT}
            >
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
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Cards</h2>
        {cards.length === 0 ? (
          <EmptyState emoji="💳" title="No cards yet" hint="Add your first one below." />
        ) : (
          <div className="space-y-2">
            {cards.map((c) => {
              const cardMultipliers = multipliers.filter((m) => m.card_id === c.id);
              return (
                <div key={c.id} className={ROW}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] text-ink">{c.name}</p>
                      <p className="text-[12px] text-ink-3">
                        {c.network ?? "card"} · base {c.base_multiplier}x
                      </p>
                    </div>
                    <form action={deleteCard}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className={LINK_QUIET}>
                        Remove
                      </button>
                    </form>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                      {cardMultipliers.length} category bonus{cardMultipliers.length === 1 ? "" : "es"}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {cardMultipliers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-ink-2">
                            {categoryById.get(m.category_id)?.emoji}{" "}
                            {categoryById.get(m.category_id)?.name ?? "—"}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-ink">{m.multiplier}x</span>
                            <form action={deleteMultiplier}>
                              <input type="hidden" name="id" value={m.id} />
                              <button type="submit" className={LINK_QUIET}>
                                Remove
                              </button>
                            </form>
                          </span>
                        </div>
                      ))}
                    </div>
                    <form action={createMultiplier} className="mt-2 flex items-end gap-2">
                      <input type="hidden" name="card_id" value={c.id} />
                      <select name="category_id" className={`py-1 text-[12.5px] ${INPUT}`}>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.5"
                        name="multiplier"
                        placeholder="4"
                        className={`w-16 py-1 text-[12.5px] ${INPUT}`}
                      />
                      <button type="submit" className={LINK_QUIET}>
                        Add bonus
                      </button>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4 rounded-[20px] border border-border bg-card p-5">
          <summary className="cursor-pointer text-[13px] text-ink-2">Add a card</summary>
          <form action={createCard} className="mt-3 flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Name
              <input name="name" required placeholder="Chase Sapphire" className={INPUT} />
            </label>
            <label className={LABEL}>
              Last 4
              <input name="last4" maxLength={4} className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Network
              <input name="network" placeholder="visa" className={`w-28 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Base multiplier
              <input type="number" step="0.5" name="base_multiplier" defaultValue={1} className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Card color
              <input type="color" name="color" defaultValue="#1C1A17" className="h-9 w-14 rounded-lg border border-border" />
            </label>
            <button type="submit" className={BTN_SOLID}>
              Add card
            </button>
          </form>
        </details>
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Log a card charge</h2>
        <p className="mb-3 text-[13px] text-ink-2">
          These stay quarantined from Safe to spend — they never draw down your checking balance
          in real time the way logged purchases do.
        </p>
        {cards.length === 0 ? (
          <EmptyState emoji="🧾" title="Add a card first" />
        ) : (
          <LogCardChargeForm cards={cards} multipliers={multipliers} categories={categories} />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-medium text-ink">
            Pending, {formatMoney(pendingTotal)}
            <Tooltip text="Forbidden Money — quarantined from Safe to spend until you sweep it into your Cash App bucket, matching what you'll owe on your statement." />
          </h2>
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
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Cash App reconciliation</h2>
        {!forbiddenMoneyAccount ? (
          <EmptyState
            emoji="🏦"
            title="No Forbidden Money bucket set"
            hint="Mark a Cash account below to receive swept totals."
          />
        ) : (
          <div className={ROW}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[14px] text-ink">{forbiddenMoneyAccount.name}</p>
                <p className="text-[12px] text-ink-3">Expected (swept total)</p>
              </div>
              <Money value={status!.expected} size="card" />
            </div>
            {status!.shortBy > 0 && (
              <p className="mt-2 text-[13px] text-hold">
                Short by {formatMoney(status!.shortBy)} — move that into Cash App to catch up.
              </p>
            )}
            <form action={reconcileForbiddenMoney} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="id" value={forbiddenMoneyAccount.id} />
              <label className={LABEL}>
                Actual Cash App balance
                <input
                  type="number"
                  step="0.01"
                  name="reconciled_balance"
                  defaultValue={forbiddenMoneyAccount.reconciled_balance ?? ""}
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
            Change which account is the bucket
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
