"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAccount, createLiabilityAccount } from "@/lib/actions/accounts";
import { accountTypeLabel } from "@/lib/net-worth";
import { ASSET_TYPES, LIABILITY_TYPES } from "@/lib/account-types";
import { getAssetFieldConfig, getLiabilityFieldConfig, assetShowsBalanceField, assetShowsHoldingsList, assetShowsLumpCostBasis } from "@/lib/account-field-config";
import { IconPicker } from "@/components/IconPicker";
import { HoldingFields } from "@/components/TickerPriceField";
import { ContributionAmountFields } from "@/components/ContributionAmountFields";
import { Employer401kMatchFields } from "@/components/Employer401kMatchFields";
import { Dropdown } from "@/components/Dropdown";
import { Tooltip } from "@/components/Tooltip";
import type { PayFreq } from "@/lib/employer-match";
import { BTN_GHOST, BTN_SOLID, INPUT, LABEL } from "@/lib/ui";

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);
const CARD_NETWORKS = ["Visa", "Mastercard", "Amex", "Discover"];

interface IncomeSourceOption {
  id: string;
  name: string;
  freq: string;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div
        /* Rev 09 §8: one standard modal size everywhere — matches @/components/Modal's width. */
        className="max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[15px] font-medium text-ink">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-3 hover:text-ink">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TypeGrid<T extends string>({ types, onPick }: { types: readonly T[]; onPick: (t: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {types.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick(t)}
          className="flex h-20 items-center justify-center rounded-lg border border-border px-3 text-center text-[13px] leading-snug text-ink transition hover:border-border-strong hover:bg-card-soft"
        >
          {accountTypeLabel(t)}
        </button>
      ))}
    </div>
  );
}

/** Rev 06b v2 §1-2: "Add asset" — its own type picker + wizard, split from liabilities. */
export function AddAssetButton({ incomeSources }: { incomeSources: IncomeSourceOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "type" | "details">("closed");
  const [type, setType] = useState<(typeof ASSET_TYPES)[number] | null>(null);

  function close() {
    setStep("closed");
    setType(null);
  }
  function onDone(id: string) {
    close();
    router.push(`/net-worth/${id}`);
  }

  return (
    <>
      <button type="button" onClick={() => setStep("type")} className={BTN_SOLID}>
        Add asset
      </button>

      {step === "type" && (
        <Modal title="What kind of account?" onClose={close}>
          <TypeGrid types={ASSET_TYPES} onPick={(t) => { setType(t); setStep("details"); }} />
        </Modal>
      )}

      {step === "details" && type && (
        <Modal title={accountTypeLabel(type)} onClose={close}>
          <AssetDetailsForm type={type} incomeSources={incomeSources} onBack={() => setStep("type")} onDone={onDone} />
        </Modal>
      )}
    </>
  );
}

/** Rev 06b v2 §1-2/§4: "Add liability" — no more "is it a credit card?" toggle; credit card is just its own type. */
export function AddLiabilityButton() {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "type" | "details">("closed");
  const [type, setType] = useState<(typeof LIABILITY_TYPES)[number] | null>(null);

  function close() {
    setStep("closed");
    setType(null);
  }
  function onDone(id: string) {
    close();
    router.push(`/net-worth/${id}`);
  }

  return (
    <>
      <button type="button" onClick={() => setStep("type")} className={BTN_SOLID}>
        Add liability
      </button>

      {step === "type" && (
        <Modal title="What kind of debt?" onClose={close}>
          <TypeGrid types={LIABILITY_TYPES} onPick={(t) => { setType(t); setStep("details"); }} />
        </Modal>
      )}

      {step === "details" && type && (
        <Modal title={accountTypeLabel(type)} onClose={close}>
          <LiabilityDetailsForm type={type} onBack={() => setStep("type")} onDone={onDone} />
        </Modal>
      )}
    </>
  );
}

function AssetDetailsForm({
  type,
  incomeSources,
  onBack,
  onDone,
}: {
  type: (typeof ASSET_TYPES)[number];
  incomeSources: IncomeSourceOption[];
  onBack: () => void;
  onDone: (id: string) => void;
}) {
  const cfg = getAssetFieldConfig(type);
  const [holdingsMode, setHoldingsMode] = useState<"lump" | "shares">(cfg.alwaysBothCashAndHoldings ? "shares" : "lump");
  const usesHoldings = holdingsMode === "shares";
  const showsBalance = assetShowsBalanceField(cfg, usesHoldings);
  const showsHoldingsList = assetShowsHoldingsList(cfg, usesHoldings);
  const showsLumpCostBasis = assetShowsLumpCostBasis(cfg, usesHoldings);
  const [positionCount, setPositionCount] = useState(1);
  const [showDebitCard, setShowDebitCard] = useState(false);
  const [showContribution, setShowContribution] = useState(false);
  const [incomeSourceId, setIncomeSourceId] = useState(incomeSources[0]?.id ?? "");
  const [salary, setSalary] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const freq = (incomeSources.find((s) => s.id === incomeSourceId)?.freq ?? "biweekly") as PayFreq;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("uses_holdings", usesHoldings ? "on" : "");
      fd.set("position_count", String(usesHoldings ? positionCount : 0));
      const { id } = await createAccount(fd);
      onDone(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
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

      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL}>
          Institution
          <input name="institution" placeholder="TD Bank" className={`w-40 ${INPUT}`} />
        </label>
        {showsBalance && !cfg.isHoldingsToggle && (
          <label className={LABEL}>
            {cfg.alwaysBothCashAndHoldings ? "Cash sleeve" : "Balance"}
            <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-32 ${INPUT}`} />
          </label>
        )}
        <label className={LABEL}>
          As of
          <input type="date" name="as_of" defaultValue={TODAY_ISO()} style={{ colorScheme: "light" }} className={INPUT} />
        </label>
        {cfg.showsAPY && (
          <label className={LABEL}>
            APY %
            <input type="number" step="0.01" name="apy_pct" className={`w-24 ${INPUT}`} />
          </label>
        )}
      </div>

      {cfg.showsLast4 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL}>
            Last 4 of account #
            <input name="last4" maxLength={4} placeholder="1234" className={`w-24 ${INPUT}`} />
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
            <input type="checkbox" checked={showDebitCard} onChange={(e) => setShowDebitCard(e.target.checked)} />
            Linked card?
          </label>
          {showDebitCard && (
            <>
              <label className={LABEL}>
                Card type
                <Dropdown name="debit_card_network" options={CARD_NETWORKS.map((n) => ({ value: n, label: n }))} defaultValue="Visa" />
              </label>
              <label className={LABEL}>
                Last 4 of card
                <input name="debit_card_last4" maxLength={4} placeholder="5678" className={`w-24 ${INPUT}`} />
              </label>
            </>
          )}
        </div>
      )}

      {(cfg.showsMinCash || cfg.showsDebitCardLast4) && (
        <div className="flex flex-wrap items-end gap-3">
          {cfg.showsMinCash && (
            <label className={LABEL}>
              Minimum-cash threshold
              <input type="number" step="0.01" name="min_cash" className={`w-28 ${INPUT}`} />
            </label>
          )}
          {cfg.showsDebitCardLast4 && (
            <label className={LABEL}>
              Debit-card last 4
              <input name="debit_card_last4" maxLength={4} className={`w-24 ${INPUT}`} />
            </label>
          )}
        </div>
      )}

      {cfg.showsAnnualLimit && (
        <label className={LABEL}>
          Annual limit
          <input type="number" step="0.01" name="annual_contribution_limit" className={`w-28 ${INPUT}`} />
        </label>
      )}

      {cfg.isHoldingsToggle && (
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
          {showsLumpCostBasis && (
            <div className="flex flex-wrap items-end gap-3">
              <label className={LABEL}>
                Total value
                <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-32 ${INPUT}`} />
              </label>
              <label className={LABEL}>
                Total cost basis
                <input type="number" step="0.01" name="starting_contributed" defaultValue={0} className={`w-32 ${INPUT}`} />
              </label>
            </div>
          )}
        </div>
      )}

      {(showsHoldingsList || cfg.alwaysBothCashAndHoldings) && (
        <div>
          <div className="grid grid-cols-5 gap-2 pb-1 text-center text-[11px] uppercase tracking-wide text-ink-3">
            <span>Symbol</span>
            <span>Shares</span>
            <span>Cost basis</span>
            <span>Date</span>
            <span>Price</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: positionCount }).map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-2">
                <HoldingFields index={i} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPositionCount((n) => n + 1)} className="mt-2 text-[12.5px] text-ink-2 hover:text-ink">
            + Add position
          </button>
        </div>
      )}

      {cfg.showsSalaryAndMatch && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card-soft p-3">
          <label className={LABEL}>
            Salary (annual)
            <input
              type="number"
              step="0.01"
              name="salary"
              onChange={(e) => setSalary(Number(e.target.value) || null)}
              className={`w-32 ${INPUT}`}
            />
          </label>
          <Employer401kMatchFields />
        </div>
      )}

      {cfg.showsContribution && incomeSources.length > 0 && (
        <div className="rounded-lg border border-border bg-card-soft p-3">
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <input type="checkbox" checked={showContribution} onChange={(e) => setShowContribution(e.target.checked)} />
            Set up a contribution
          </label>
          {showContribution && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className={LABEL}>
                From
                <Dropdown
                  name="income_source_id"
                  options={incomeSources.map((s) => ({ value: s.id, label: s.name }))}
                  value={incomeSourceId}
                  onChange={setIncomeSourceId}
                />
              </label>
              <span className="pb-2 text-[12.5px] text-ink-3">{cfg.contributionTaxTreatment === "post_tax" ? "post-tax" : "pre-tax"}</span>
              {cfg.showsSalaryAndMatch ? (
                <ContributionAmountFields salary={salary} freq={freq} />
              ) : (
                <label className={LABEL}>
                  Contribution per check
                  <input type="number" step="0.01" name="contribution_amount" defaultValue={0} className={`w-28 ${INPUT}`} />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {cfg.showsNotes && (
        <label className={LABEL}>
          Notes
          <textarea name="notes" rows={2} className={`${INPUT} resize-none`} />
        </label>
      )}

      {error && <p className="text-[12.5px] text-bad">{error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={onBack} className={BTN_GHOST}>
          Back
        </button>
        <button type="submit" disabled={pending} className={BTN_SOLID}>
          {pending ? "Adding…" : "Add account"}
        </button>
      </div>
    </form>
  );
}

function LiabilityDetailsForm({
  type,
  onBack,
  onDone,
}: {
  type: (typeof LIABILITY_TYPES)[number];
  onBack: () => void;
  onDone: (id: string) => void;
}) {
  const cfg = getLiabilityFieldConfig(type);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const { id } = await createLiabilityAccount(fd);
      onDone(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
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

      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL}>
          Institution
          <input name="institution" placeholder="TD Bank" className={`w-40 ${INPUT}`} />
        </label>
        <label className={LABEL}>
          Balance
          <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-28 ${INPUT}`} />
        </label>
        <label className={LABEL}>
          APR %
          <input type="number" step="0.01" name="apr_pct" placeholder={type === "Medical debt" ? "often 0" : undefined} className={`w-20 ${INPUT}`} />
        </label>
        <label className={LABEL}>
          As of
          <input type="date" name="as_of" defaultValue={TODAY_ISO()} style={{ colorScheme: "light" }} className={INPUT} />
        </label>
        {cfg.showsTerm && (
          <label className={LABEL}>
            Term (years)
            <input type="number" name="term_years" className={`w-20 ${INPUT}`} />
          </label>
        )}
      </div>

      {cfg.showsCreditCardLast4 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL}>
            Card type
            <Dropdown name="card_network" options={CARD_NETWORKS.map((n) => ({ value: n, label: n }))} defaultValue="Visa" />
          </label>
          <label className={LABEL}>
            Last 4
            <input name="last4" maxLength={4} className={`w-24 ${INPUT}`} />
          </label>
          <span className="flex items-center gap-1 pb-2 text-[12px] text-ink-3">
            <Tooltip text="This card becomes selectable as a rewards card in Sweep." />
            Selectable in Sweep
          </span>
        </div>
      )}

      {error && <p className="text-[12.5px] text-bad">{error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={onBack} className={BTN_GHOST}>
          Back
        </button>
        <button type="submit" disabled={pending} className={BTN_SOLID}>
          {pending ? "Adding…" : "Add liability"}
        </button>
      </div>
    </form>
  );
}
