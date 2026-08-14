import Link from "next/link";
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
  payOffCard,
  createCard,
  updateCard,
  deleteCard,
  createMultiplier,
  deleteMultiplier,
  setCashAppCard,
} from "@/lib/actions/cards";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { MockCard } from "@/components/MockCard";
import { AddButton } from "@/components/AddButton";
import { EmojiPicker } from "@/components/EmojiPicker";
import { IconGlyph } from "@/components/IconGlyph";
import { RowMenu } from "@/components/RowMenu";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_MOSS, BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, LINK_QUIET, ROW, SCROLL_LIST } from "@/lib/ui";

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
  const liabilityAccounts = accounts.filter((a) => a.type === "Liabilities");
  const pendingTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const status = bufferAccount ? reconciliationStatus(bufferAccount) : null;
  const channelingCard = cards.find((c) => c.id === settings.cash_app_card_id) ?? null;

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
        <div className="flex items-center justify-between">
          <p className={CARD_HEADER}>Pending</p>
          {unswept.length > 0 && (
            <form action={sweepPendingCharges}>
              <button type="submit" className={BTN_MOSS}>
                Sweep now
              </button>
            </form>
          )}
        </div>
        <p className="font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          {formatMoney(pendingTotal)}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-ink-2">
          Quarantined until swept into your buffer account
          <Tooltip text="Rewards-card charges don't draw down Safe to Spend right away — they wait here until you sweep them, matching what you'll actually owe on the statement." />
        </p>

        {unswept.length === 0 ? (
          <div className="mt-4">
            <EmptyState emoji="🧹" title="Nothing pending" hint="Charges logged with a rewards card show up here." />
          </div>
        ) : (
          <div className={`mt-4 space-y-1.5 ${SCROLL_LIST}`}>
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
                  <RowMenu>
                    <form action={deleteCardCharge}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit">Remove</button>
                    </form>
                  </RowMenu>
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
      </div>

      <div className={CARD}>
        <p className={CARD_HEADER}>Reconciliation</p>
        {!bufferAccount ? (
          <div className="mt-3">
            <EmptyState
              emoji="🏦"
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

      {bufferAccount && (
        <div className={CARD}>
          <p className={CARD_HEADER}>Pay off a card</p>
          <p className="mt-1 text-[13px] text-ink-2">
            Settles a card&apos;s balance from {bufferAccount.name} — moves the cash out and brings what you owe down.
          </p>
          {liabilityAccounts.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">
              Add the card&apos;s balance as a liability account in Net worth first.
            </p>
          ) : (
            <form action={payOffCard} className="mt-3 flex flex-wrap items-end gap-3">
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
                Amount
                <input type="number" step="0.01" name="amount" required className={`w-28 ${INPUT}`} />
              </label>
              <button type="submit" className={BTN_SOLID}>
                Pay it off
              </button>
            </form>
          )}
        </div>
      )}

      <div className={`${CARD} flex flex-wrap items-start gap-6`}>
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
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between">
          <p className={CARD_HEADER}>Cards</p>
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

        {cards.length === 0 ? (
          <div className="mt-3">
            <EmptyState emoji="💳" title="No cards yet" hint="Add your first one above." />
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {cards.map((c) => {
              const cardMultipliers = multipliers.filter((m) => m.card_id === c.id);
              return (
                <div key={c.id} className={ROW}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <IconGlyph value={c.icon} fallback="💳" className="text-[18px]" />
                      <div>
                        <p className="text-[14px] text-ink">{c.name}</p>
                        <p className="text-[12px] text-ink-3">
                          {c.network ?? "card"} · base {c.base_multiplier}x
                        </p>
                      </div>
                    </div>
                    <RowMenu
                      popovers={[
                        {
                          label: "Edit card",
                          content: (
                            <form action={updateCard} className="flex flex-col gap-2">
                              <input type="hidden" name="id" value={c.id} />
                              <div className="flex items-end gap-2">
                                <EmojiPicker name="icon" defaultValue={c.icon} />
                                <input name="name" defaultValue={c.name} className={`flex-1 ${INPUT}`} />
                              </div>
                              <input name="last4" defaultValue={c.last4 ?? ""} maxLength={4} placeholder="Last 4" className={INPUT} />
                              <select name="network" defaultValue={c.network ?? "visa"} className={INPUT}>
                                <option value="visa">Visa</option>
                                <option value="mastercard">Mastercard</option>
                                <option value="amex">Amex</option>
                                <option value="discover">Discover</option>
                              </select>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  name="base_multiplier"
                                  defaultValue={c.base_multiplier}
                                  className={`flex-1 ${INPUT}`}
                                />
                                <input type="color" name="color" defaultValue={c.color} className="h-9 w-14 rounded-lg border border-border" />
                              </div>
                              <button type="submit" className={BTN_SOLID}>
                                Save
                              </button>
                            </form>
                          ),
                        },
                      ]}
                    >
                      <form action={deleteCard}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit">Remove</button>
                      </form>
                    </RowMenu>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                      {cardMultipliers.length} category bonus{cardMultipliers.length === 1 ? "" : "es"}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {cardMultipliers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-[13px]">
                          <span className="flex items-center gap-1.5 text-ink-2">
                            <IconGlyph value={categoryById.get(m.category_id)?.emoji} fallback="🏷️" className="text-[13px]" />
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
                              {cat.emoji && !cat.emoji.startsWith("data:") ? `${cat.emoji} ` : ""}
                              {cat.name}
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
      </div>
    </div>
  );
}
