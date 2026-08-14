import { getSettings } from "@/lib/data/settings";
import { updateSettings, saveApiKey, removeApiKey } from "@/lib/actions/settings";
import { seedDemoData } from "@/lib/actions/demo";
import { ClearDataButton } from "@/components/ClearDataButton";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, LINK_QUIET } from "@/lib/ui";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          Configuration only — your accounts, bills, and paychecks live in their own tabs.
        </p>
      </div>

      <form action={updateSettings} className={`flex flex-col gap-4 ${CARD}`}>
        <p className={CARD_HEADER}>General</p>
        <label className={LABEL}>
          Bank
          <input
            name="bank"
            defaultValue={settings.bank}
            placeholder="Generic"
            className={`max-w-xs ${INPUT}`}
          />
        </label>

        <label className={LABEL}>
          <span className="flex items-center gap-1">
            Bank pays me early
            <Tooltip text="Some banks post direct deposit a few days before the official payday. This only changes the date Moss expects to see it land — it doesn't move bill due-dates or Safe to spend math." />
          </span>
          <select
            name="early_pay_days"
            defaultValue={settings.early_pay_days}
            className={`max-w-xs ${INPUT}`}
          >
            <option value={0}>Right on payday</option>
            <option value={1}>1 day early</option>
            <option value={2}>2 days early</option>
            <option value={3}>3 days early</option>
            <option value={4}>4 days early</option>
            <option value={5}>5 days early</option>
          </select>
        </label>

        <label className={LABEL}>
          <span className="flex items-center gap-1">
            Business-day rule
            <Tooltip text="If a bill or payday lands on a weekend, shift it to the nearest banking day instead. True bank-holiday calendars aren't machine-readable yet, so this only accounts for weekends. Applied after the early-pay offset above." />
          </span>
          <select name="biz_shift" defaultValue={settings.biz_shift} className={`max-w-xs ${INPUT}`}>
            <option value="none">Don&apos;t shift</option>
            <option value="prior">Shift to the day before</option>
            <option value="next">Shift to the day after</option>
          </select>
        </label>

        <div>
          <button type="submit" className={BTN_SOLID}>
            Save
          </button>
        </div>
      </form>

      <div className={CARD}>
        <p className={CARD_HEADER}>Connections</p>
        <p className="mt-1 text-[13px] text-ink-2">
          Keys are written straight to Supabase Vault and never read back to this page — once
          saved, you&apos;ll only ever see &quot;connected&quot;.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <ApiKeyRow
            label="Market data key"
            keyType="market"
            connected={settings.market_key_set}
            hint="Powers live holding prices (Finnhub)."
          />
          <div className="border-t border-border" />
          <ApiKeyRow
            label="Gemini advisor key"
            keyType="gemini"
            connected={settings.gemini_key_set}
            hint="Powers the Ask Moss advisor."
          />
        </div>
      </div>

      <div className={CARD}>
        <p className={CARD_HEADER}>Demo data</p>
        <p className="mt-1 text-[13px] text-ink-2">
          Fill every tab with realistic sample accounts, bills, and history to see how Moss
          looks in use, or wipe everything to start with your own numbers. Loading always fully
          replaces whatever&apos;s there — it&apos;s not additive.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <form action={seedDemoData}>
            <button type="submit" className={BTN_SOLID}>
              Load demo data
            </button>
          </form>
          <ClearDataButton />
        </div>
      </div>
    </div>
  );
}

function ApiKeyRow({
  label,
  keyType,
  connected,
  hint,
}: {
  label: string;
  keyType: "market" | "gemini";
  connected: boolean;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] text-ink">{label}</p>
          <p className="text-[12px] text-ink-3">{hint}</p>
        </div>
        {connected && (
          <span className="text-[12.5px] text-good">•••• connected</span>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] text-ink-3 hover:text-ink-2">
          {connected ? "Replace key" : "Connect"}
        </summary>
        <div className="mt-2 flex items-center gap-2">
          <form action={saveApiKey} className="flex items-center gap-2">
            <input type="hidden" name="key_type" value={keyType} />
            <input
              type="password"
              name="value"
              required
              placeholder="Paste key"
              autoComplete="off"
              className={`w-56 py-1.5 ${INPUT}`}
            />
            <button type="submit" className={`${BTN_GHOST} py-1.5`}>
              Save
            </button>
          </form>
          {connected && (
            <form action={removeApiKey}>
              <input type="hidden" name="key_type" value={keyType} />
              <button type="submit" className={LINK_QUIET}>
                Remove
              </button>
            </form>
          )}
        </div>
      </details>
    </div>
  );
}
