"use client";

import { useState } from "react";
import { createDeduction, updateDeduction, deleteDeduction } from "@/lib/actions/income";
import { formatMoney } from "@/lib/format";
import { AddButton } from "@/components/AddButton";
import { RowMenu } from "@/components/RowMenu";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, ROW } from "@/lib/ui";

interface DeductionRow {
  id: string;
  name: string;
  amount: number;
  employer_match: number;
  income_source_id: string | null;
  tax_treatment: string;
}

interface IncomeSourceOption {
  id: string;
  name: string;
}

/**
 * Rev 06b §5: each account's contribution rule lives on its own detail
 * page now — Income only holds paychecks. Tax treatment is fixed by
 * account type (never a user choice); §4's employer match is recomputed
 * server-side from the account's own salary/match settings.
 */
export function AccountContributionSection({
  accountSystemKey,
  accountType,
  deductions,
  incomeSources,
}: {
  accountSystemKey: string;
  accountType: string;
  deductions: DeductionRow[];
  incomeSources: IncomeSourceOption[];
}) {
  const taxTreatment = accountType === "Roth IRA" ? "post_tax" : "pre_tax";
  const isMatch401k = accountType === "401(k)";
  const [pct, setPct] = useState(0);

  if (incomeSources.length === 0) return null;

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <p className={CARD_HEADER}>Contribution</p>
          <Tooltip text="Posts to this account — including employer match — when you mark the pay date posted on Dashboard." />
        </div>
        {deductions.length === 0 && (
          <AddButton label="Set up a contribution">
            <form action={createDeduction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="target_account_key" value={accountSystemKey} />
              <input type="hidden" name="tax_treatment" value={taxTreatment} />
              <input type="hidden" name="name" value="Contribution" />
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
                {taxTreatment === "post_tax" ? "Contribution (post-tax)" : "Contribution (pre-tax)"} per check
                <input type="number" step="0.01" name="amount" defaultValue={0} className={`w-28 ${INPUT}`} />
              </label>
              {isMatch401k && (
                <label className={LABEL}>
                  <span className="flex items-center gap-1">
                    % of salary
                    <Tooltip text="Only used to compute the employer match — the dollar amount above is what actually posts." />
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    name="contribution_pct"
                    value={pct}
                    onChange={(e) => setPct(Number(e.target.value))}
                    className={`w-20 ${INPUT}`}
                  />
                </label>
              )}
              <button type="submit" className={BTN_SOLID}>
                Save
              </button>
            </form>
          </AddButton>
        )}
      </div>

      {deductions.length > 0 && (
        <div className="mt-3 space-y-2">
          {deductions.map((d) => {
            const source = incomeSources.find((s) => s.id === d.income_source_id);
            return (
              <div key={d.id} className={ROW}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] text-ink">{formatMoney(d.amount)} per check</p>
                    <p className="text-[12px] text-ink-3">
                      {source?.name ?? "—"} · {d.tax_treatment === "pre_tax" ? "pre-tax" : "post-tax (Roth)"}
                      {d.employer_match > 0 && ` · +${formatMoney(d.employer_match)} employer match`}
                    </p>
                  </div>
                  <RowMenu
                    popovers={[
                      {
                        label: "Edit",
                        content: (
                          <form action={updateDeduction} className="flex flex-col gap-2">
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="target_account_key" value={accountSystemKey} />
                            <input type="hidden" name="tax_treatment" value={taxTreatment} />
                            <input type="hidden" name="name" value="Contribution" />
                            <select name="income_source_id" defaultValue={d.income_source_id ?? ""} className={INPUT}>
                              {incomeSources.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <input type="number" step="0.01" name="amount" defaultValue={d.amount} className={INPUT} />
                            {isMatch401k && (
                              <label className={LABEL}>
                                % of salary
                                <input type="number" step="0.1" name="contribution_pct" defaultValue={0} className={INPUT} />
                              </label>
                            )}
                            <button type="submit" className={BTN_SOLID}>
                              Save
                            </button>
                          </form>
                        ),
                      },
                    ]}
                  >
                    <ConfirmDeleteButton action={deleteDeduction} hiddenFields={{ id: d.id }} itemLabel="this contribution" variant="link" />
                  </RowMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
