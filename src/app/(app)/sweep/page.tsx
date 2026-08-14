import { listCards, listCardMultipliers, listUnsweptCharges, listRecentSweptCharges } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/recurring";
import { listAccounts } from "@/lib/data/accounts";
import { getSettings } from "@/lib/data/settings";
import { reconciliationStatus } from "@/lib/cards";
import {
  deleteCardCharge,
  sweepPendingCharges,
  markForbiddenMoneyAccount,
  reconcileForbiddenMoney,
  createCard,
  updateCard,
  deleteCard,
  createMultiplier,
  deleteMultiplier,
  setCashAppCard,
} from "@/lib/actions/cards";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { LogCardChargeForm } from "@/components/LogCardChargeForm";
import { MockCard } from "@/components/MockCard";
import { AddButton } from "@/components/AddButton";
import { EmojiPicker } from "@/components/EmojiPicker";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

export default async function SweepPage() {
  const [cards, multipliers, unswept, recentSwept, categories, accounts, settings] = await Promise.all([
    listCards(),
    listCardMultipliers(),
    listUnsweptCharges(),
    listRecentSweptCharges(),
    listCategories(),
    listAccounts(),
    getSettings(),
  ]);

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const bufferAccount = accounts.find((a) => a.is_forbidden_money) ?? null;
  const pendingTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const status = bufferAccount ? reconciliationStatus(bufferAccount) : null;
  const channelingCard = cards.find((c) => c.id === settings.cash_app_card_id) ?? null;

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
          <EmptyState emoji="🧾" title="Add a card below first" />
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

      <section className="flex flex-wrap items-start gap-6">
        {channelingCard ? (
          <MockCard name={channelingCard.name} last4={channelingCard.last4} network={channelingCard.network} color={channelingCard.color} />
        ) : (
          <div className="flex h-[150px] w-[240px] items-center justify-center rounded-lg border border-dashed border-border-strong text-[12.5px] text-ink-3">
            No channeling card set
          </div>
        )}
        <div className="min-w-[220px] flex-1">
          <p className="text-[13px] text-ink-2">
            Which card channels rewards charges into your buffer?
            <Tooltip text="Just for the visual above and for Sweep — pick whichever card you use for quarantined rewards spending." />
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
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden>
                        {c.icon || "💳"}
                      </span>
                      <div>
                        <p className="text-[14px] text-ink">{c.name}</p>
                        <p className="text-[12px] text-ink-3">
                          {c.network ?? "card"} · base {c.base_multiplier}x
                        </p>
                      </div>
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
                      Edit card
                    </summary>
                    <form action={updateCard} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <label className={LABEL}>
                        Icon
                        <EmojiPicker name="icon" defaultValue={c.icon} />
                      </label>
                      <label className={LABEL}>
                        Name
                        <input name="name" defaultValue={c.name} className={INPUT} />
                      </label>
                      <label className={LABEL}>
                        Last 4
                        <input name="last4" defaultValue={c.last4 ?? ""} maxLength={4} className={`w-20 ${INPUT}`} />
                      </label>
                      <label className={LABEL}>
                        Network
                        <select name="network" defaultValue={c.network ?? "visa"} className={INPUT}>
                          <option value="visa">Visa</option>
                          <option value="mastercard">Mastercard</option>
                          <option value="amex">Amex</option>
                          <option value="discover">Discover</option>
                        </select>
                      </label>
                      <label className={LABEL}>
                        Base multiplier
                        <input type="number" step="0.5" name="base_multiplier" defaultValue={c.base_multiplier} className={`w-16 ${INPUT}`} />
                      </label>
                      <label className={LABEL}>
                        Color
                        <input type="color" name="color" defaultValue={c.color} className="h-9 w-14 rounded-lg border border-border" />
                      </label>
                      <button type="submit" className={LINK_QUIET}>
                        Save
                      </button>
                    </form>
                  </details>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                      {cardMultipliers.length} category bonus{cardMultipliers.length === 1 ? "" : "es"}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {cardMultipliers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-ink-2">
                            {categoryById.get(m.category_id)?.emoji} {categoryById.get(m.category_id)?.name ?? "—"}
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
                    {categories.length === 0 ? (
                      <p className="mt-2 text-[12px] text-ink-3">
                        Add a category in Expenses first, then come back to set a bonus.
                      </p>
                    ) : (
                      <form action={createMultiplier} className="mt-2 flex items-end gap-2">
                        <input type="hidden" name="card_id" value={c.id} />
                        <select name="category_id" required className={`py-1 text-[12.5px] ${INPUT}`}>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.emoji} {cat.name}
                            </option>
                          ))}
                        </select>
                        <input type="number" step="0.5" name="multiplier" defaultValue={2} required className={`w-16 py-1 text-[12.5px] ${INPUT}`} />
                        <button type="submit" className={LINK_QUIET}>
                          Add bonus
                        </button>
                      </form>
                    )}
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <AddButton label="Add a card">
            <form action={createCard} className="flex flex-wrap items-end gap-3">
              <label className={LABEL}>
                Icon
                <EmojiPicker name="icon" />
              </label>
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
                <select name="network" className={INPUT}>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                  <option value="discover">Discover</option>
                </select>
              </label>
              <label className={LABEL}>
                Base multiplier
                <input type="number" step="0.5" name="base_multiplier" defaultValue={1} className={`w-20 ${INPUT}`} />
              </label>
              <label className={LABEL}>
                Card color
                <input type="color" name="color" defaultValue="#14181C" className="h-9 w-14 rounded-lg border border-border" />
              </label>
              <button type="submit" className={BTN_SOLID}>
                Add card
              </button>
            </form>
          </AddButton>
        </div>
      </section>
    </div>
  );
}
