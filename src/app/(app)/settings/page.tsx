import { getSettings } from "@/lib/data/settings";
import { updateSettings } from "@/lib/actions/settings";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, CARD, INPUT, LABEL } from "@/lib/ui";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-[28px] font-medium text-ink">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          Configuration only — your accounts, bills, and paychecks live in their own tabs.
        </p>

        <form action={updateSettings} className={`mt-4 flex flex-col gap-4 ${CARD}`}>
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
            Business-day rule
            <Tooltip text="If a bill or payday lands on a weekend, shift it to the nearest banking day instead. True bank-holiday calendars aren't machine-readable yet, so this only accounts for weekends." />
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
      </section>

      <section>
        <h2 className="font-display text-[22px] font-medium text-ink">Connections</h2>
        <p className="mt-1 text-[13px] text-ink-2">
          Market data and the Gemini advisor connect here once those modules are built — keys
          stay server-side, never in the browser.
        </p>
        <div className={`mt-4 flex flex-col gap-3 opacity-60 ${CARD}`}>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-ink-2">Market data key</span>
            <span className="text-[12.5px] text-ink-3">Not connected yet</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-ink-2">Gemini advisor key</span>
            <span className="text-[12.5px] text-ink-3">Not connected yet</span>
          </div>
        </div>
      </section>
    </div>
  );
}
