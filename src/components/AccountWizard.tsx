"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAccount } from "@/lib/actions/accounts";
import { accountTypeLabel } from "@/lib/net-worth";
import { WIZARD_ACCOUNT_TYPES } from "@/lib/account-types";
import { IconPicker } from "@/components/IconPicker";
import { HoldingFields } from "@/components/TickerPriceField";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_SOLID, INPUT, LABEL } from "@/lib/ui";

type WizardType = (typeof WIZARD_ACCOUNT_TYPES)[number];

const INVESTING_TOGGLE_TYPES = new Set<WizardType>(["401(k)", "Traditional IRA", "Roth IRA", "Taxable Brokerage"]);
const CONTRIBUTION_TYPES = new Set<WizardType>(["HSA", "401(k)", "Traditional IRA", "Roth IRA"]);

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

interface IncomeSourceOption {
  id: string;
  name: string;
}

/** Rev 06b §1: account creation = a two-step, MoneyGuidePro-style wizard — pick the type, then only the fields that type needs. */
export function AccountWizard({ incomeSources }: { incomeSources: IncomeSourceOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "type" | "details">("closed");
  const [type, setType] = useState<WizardType | null>(null);
  const [holdingsMode, setHoldingsMode] = useState<"lump" | "shares">("lump");
  const [showDebitCard, setShowDebitCard] = useState(false);
  const [showCreditCard, setShowCreditCard] = useState(false);
  const [showContribution, setShowContribution] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setStep("closed");
    setType(null);
    setHoldingsMode("lump");
    setShowDebitCard(false);
    setShowCreditCard(false);
    setShowContribution(false);
    setError(null);
  }

  function pickType(t: WizardType) {
    setType(t);
    setHoldingsMode(t === "HSA" ? "shares" : "lump");
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const { id } = await createAccount(fd);
      close();
      router.push(`/net-worth/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  const isInvesting = type ? INVESTING_TOGGLE_TYPES.has(type) : false;
  const isHSA = type === "HSA";
  const usesHoldings = isHSA || (isInvesting && holdingsMode === "shares");

  return (
    <>
      <button type="button" onClick={() => setStep("type")} className={BTN_SOLID}>
        Add account
      </button>

      {step === "type" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={close}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-medium text-ink">What kind of account?</p>
              <button type="button" onClick={close} aria-label="Close" className="text-ink-3 hover:text-ink">
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WIZARD_ACCOUNT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickType(t)}
                  className="rounded-lg border border-border px-3 py-2.5 text-left text-[13.5px] text-ink transition hover:border-border-strong hover:bg-card-soft"
                >
                  {accountTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "details" && type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={close}>
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-medium text-ink">{accountTypeLabel(type)}</p>
              <button type="button" onClick={close} aria-label="Close" className="text-ink-3 hover:text-ink">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input type="hidden" name="type" value={type} />
              <div className="flex items-end gap-3">
                <label className={LABEL}>
                  Icon
                  <IconPicker name="icon" label={type} />
                </label>
                <label className={`flex-1 ${LABEL}`}>
                  Name
                  <input name="name" required className={INPUT} />
                </label>
              </div>

              {!usesHoldings && (
                <label className={LABEL}>
                  {isHSA ? "Cash sleeve" : "Balance"}
                  <input type="number" step="0.01" name="balance" defaultValue={0} className={INPUT} />
                </label>
              )}

              <label className={LABEL}>
                As of
                <input type="date" name="as_of" defaultValue={TODAY_ISO()} style={{ colorScheme: "light" }} className={INPUT} />
              </label>

              {type === "HYSA" && (
                <label className={LABEL}>
                  APY %
                  <input type="number" step="0.01" name="apy_pct" className={`w-24 ${INPUT}`} />
                </label>
              )}

              {(type === "Checking" || type === "Savings" || type === "HYSA") && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className={LABEL}>
                    Last 4 of account
                    <input name="last4" maxLength={4} className={`w-24 ${INPUT}`} />
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
                    <input type="checkbox" checked={showDebitCard} onChange={(e) => setShowDebitCard(e.target.checked)} />
                    Linked card?
                  </label>
                  {showDebitCard && (
                    <label className={LABEL}>
                      Last 4 of card
                      <input name="debit_card_last4" maxLength={4} className={`w-24 ${INPUT}`} />
                    </label>
                  )}
                </div>
              )}

              {isHSA && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className={LABEL}>
                    Minimum-cash threshold
                    <input type="number" step="0.01" name="min_cash" className={`w-28 ${INPUT}`} />
                  </label>
                  <label className={LABEL}>
                    Debit-card last 4
                    <input name="debit_card_last4" maxLength={4} className={`w-24 ${INPUT}`} />
                  </label>
                </div>
              )}

              {type === "Liabilities" && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className={LABEL}>
                    Balance
                    <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-28 ${INPUT}`} />
                  </label>
                  <label className={LABEL}>
                    APR %
                    <input type="number" step="0.01" name="apr_pct" className={`w-20 ${INPUT}`} />
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
                    <input
                      type="checkbox"
                      name="is_credit_card"
                      checked={showCreditCard}
                      onChange={(e) => setShowCreditCard(e.target.checked)}
                    />
                    Is it a credit card?
                    <Tooltip text="A credit-card liability becomes selectable as a rewards card in Sweep." />
                  </label>
                  {showCreditCard && (
                    <>
                      <label className={LABEL}>
                        Last 4
                        <input name="card_last4" maxLength={4} className={`w-24 ${INPUT}`} />
                      </label>
                      <label className={LABEL}>
                        Network
                        <select name="card_network" defaultValue="visa" className={INPUT}>
                          <option value="visa">Visa</option>
                          <option value="mastercard">Mastercard</option>
                          <option value="amex">Amex</option>
                          <option value="discover">Discover</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}

              {isInvesting && (
                <div className="rounded-lg border border-border bg-card-soft p-3">
                  <div className="mb-2 flex gap-1 rounded-md bg-card p-0.5 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setHoldingsMode("lump")}
                      className={`flex-1 rounded px-2 py-1 transition ${holdingsMode === "lump" ? "bg-card-soft text-ink shadow-sm" : "text-ink-3"}`}
                    >
                      Total amount
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoldingsMode("shares")}
                      className={`flex-1 rounded px-2 py-1 transition ${holdingsMode === "shares" ? "bg-card-soft text-ink shadow-sm" : "text-ink-3"}`}
                    >
                      Individual shares
                    </button>
                  </div>
                  <input type="hidden" name="uses_holdings" value={holdingsMode === "shares" ? "on" : ""} />
                  {holdingsMode === "lump" ? (
                    <label className={LABEL}>
                      Total cost basis
                      <input type="number" step="0.01" name="lump_cost_basis" defaultValue={0} className={`w-32 ${INPUT}`} />
                    </label>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      <HoldingFields />
                    </div>
                  )}
                </div>
              )}

              {isHSA && <input type="hidden" name="uses_holdings" value="on" />}

              {(type === "HSA" || type === "401(k)" || type === "Traditional IRA") && (
                <label className={LABEL}>
                  Annual limit
                  <input type="number" step="0.01" name="annual_contribution_limit" className={`w-28 ${INPUT}`} />
                </label>
              )}
              {type === "Roth IRA" && (
                <label className={LABEL}>
                  Annual limit
                  <input type="number" step="0.01" name="annual_contribution_limit" className={`w-28 ${INPUT}`} />
                </label>
              )}

              {type === "401(k)" && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className={LABEL}>
                    Salary (annual)
                    <input type="number" step="0.01" name="salary" className={`w-28 ${INPUT}`} />
                  </label>
                  <label className={LABEL}>
                    <span className="flex items-center gap-1">
                      Match: 100% up to
                      <Tooltip text="Employer matches dollar-for-dollar on your contribution, up to this % of salary." />
                    </span>
                    <input type="number" step="0.1" name="match_tier1_pct" className={`w-20 ${INPUT}`} />%
                  </label>
                  <label className={LABEL}>
                    then
                    <input type="number" step="0.1" name="match_tier2_rate_pct" className={`w-20 ${INPUT}`} />%
                  </label>
                  <label className={LABEL}>
                    up to
                    <input type="number" step="0.1" name="match_tier2_limit_pct" className={`w-20 ${INPUT}`} />%
                  </label>
                </div>
              )}

              {type && CONTRIBUTION_TYPES.has(type) && incomeSources.length > 0 && (
                <div className="rounded-lg border border-border bg-card-soft p-3">
                  <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                    <input type="checkbox" checked={showContribution} onChange={(e) => setShowContribution(e.target.checked)} />
                    Set up a contribution
                  </label>
                  {showContribution && (
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <label className={LABEL}>
                        From
                        <select name="income_source_id" className={INPUT}>
                          {incomeSources.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={LABEL}>
                        {type === "Roth IRA" ? "Contribution (post-tax)" : "Contribution (pre-tax)"} per check
                        <input type="number" step="0.01" name="contribution_amount" defaultValue={0} className={`w-28 ${INPUT}`} />
                      </label>
                      {type === "401(k)" && (
                        <label className={LABEL}>
                          <span className="flex items-center gap-1">
                            % of salary
                            <Tooltip text="Only used to compute the employer match above — the dollar contribution field is what actually posts." />
                          </span>
                          <input type="number" step="0.1" name="contribution_pct" defaultValue={0} className={`w-20 ${INPUT}`} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-[12.5px] text-bad">{error}</p>}

              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setStep("type")} className={BTN_GHOST}>
                  Back
                </button>
                <button type="submit" disabled={pending} className={BTN_SOLID}>
                  {pending ? "Adding…" : "Add account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
