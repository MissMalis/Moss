import Link from "next/link";
import { listAccounts, listHoldings, ACCOUNT_TYPES } from "@/lib/data/accounts";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import { computeNetWorth, accountEmoji, aggregateSnapshots, type HistoryPoint } from "@/lib/net-worth";
import { createAccount } from "@/lib/actions/accounts";
import { Money } from "@/components/Money";
import { NetWorthHero } from "@/components/NetWorthHero";
import { NetWorthLines } from "@/components/NetWorthLines";
import { AddButton } from "@/components/AddButton";
import { EmojiPicker } from "@/components/EmojiPicker";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, INPUT, LABEL, ROW } from "@/lib/ui";

export default async function NetWorthPage() {
  const [accounts, holdings] = await Promise.all([listAccounts(), listHoldings()]);
  await ensureSnapshotsForToday({ accounts, holdings });
  const snapshots = await listAllSnapshots();

  const netWorth = computeNetWorth(accounts, holdings);
  const historyPoints = aggregateSnapshots(
    snapshots.map((s) => ({
      snapshot_date: s.snapshot_date,
      account_id: s.account_id,
      contributed: s.contributed,
      market_value: s.market_value,
    })),
  );

  const holdingsByAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    if (!h.account_id) continue;
    holdingsByAccount.set(h.account_id, [...(holdingsByAccount.get(h.account_id) ?? []), h]);
  }
  const snapshotsByAccount = new Map<string, HistoryPoint[]>();
  for (const s of snapshots) {
    const list = snapshotsByAccount.get(s.account_id) ?? [];
    list.push({ date: s.snapshot_date, contributed: s.contributed, marketValue: s.market_value });
    snapshotsByAccount.set(s.account_id, list);
  }

  const assets = accounts.filter((a) => a.type !== "Liabilities");
  const liabilities = accounts.filter((a) => a.type === "Liabilities");

  function AccountRow({ a }: { a: (typeof accounts)[number] }) {
    const accountHoldings = holdingsByAccount.get(a.id) ?? [];
    const trackable = accountHoldings.length > 0 || a.is_system;
    const series = snapshotsByAccount.get(a.id) ?? [];
    const value = netWorth.accounts.find((av) => av.id === a.id)?.value ?? a.balance;

    return (
      <Link href={`/net-worth/${a.id}`} className={`${ROW} flex items-center justify-between gap-4 transition hover:border-border-strong`}>
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>
            {a.icon || accountEmoji(a.type)}
          </span>
          <div>
            <p className="text-[14px] text-ink">{a.name}</p>
            <p className="text-[12px] text-ink-3">
              {a.type}
              {a.type === "Liabilities" && a.apr_pct ? ` · ${a.apr_pct}% APR` : ""}
              {a.type === "HYSA" && a.apy_pct ? ` · ${a.apy_pct}% APY` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {trackable && series.length > 1 && <NetWorthLines points={series} variant="spark" />}
          <Money value={value} size="card" />
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-8">
      <NetWorthHero total={netWorth.total} points={historyPoints} />

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Assets</h2>
        {assets.length === 0 ? (
          <EmptyState emoji="🏦" title="No accounts yet" hint="Add your first one below." />
        ) : (
          <div className="space-y-2">
            {assets.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Liabilities</h2>
        {liabilities.length === 0 ? (
          <EmptyState emoji="💳" title="No liabilities tracked" hint="Add a credit card or loan below." />
        ) : (
          <div className="space-y-2">
            {liabilities.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      <section>
        <AddButton label="Add account">
          <form action={createAccount} className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Icon
              <EmojiPicker name="icon" />
            </label>
            <label className={LABEL}>
              Name
              <input name="name" required className={INPUT} />
            </label>
            <label className={LABEL}>
              Type
              <select name="type" className={INPUT}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Starting balance
              <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-32 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Starting contributed
              <input type="number" step="0.01" name="starting_contributed" defaultValue={0} className={`w-32 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                APY %
                <Tooltip text="For a high-yield savings account — used to show accrued interest. Leave blank for anything else." />
              </span>
              <input type="number" step="0.01" name="apy_pct" className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                APR %
                <Tooltip text="For a liability — a credit card or loan's interest rate. Leave blank for anything else." />
              </span>
              <input type="number" step="0.01" name="apr_pct" className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                Min cash
                <Tooltip text="For an investing account with a cash sleeve — Moss nudges you if the balance dips under this, since that usually means holdings got auto-sold to cover something." />
              </span>
              <input type="number" step="0.01" name="min_cash" className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                Annual limit
                <Tooltip text="Optional — for 401k/HSA/IRA accounts, Moss will show how close you are to it as the year goes." />
              </span>
              <input type="number" step="0.01" name="annual_contribution_limit" className={`w-28 ${INPUT}`} />
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
              <input type="checkbox" name="is_system" />
              Fed by paycheck contributions
            </label>
            <button type="submit" className={BTN_SOLID}>
              Add account
            </button>
          </form>
        </AddButton>
      </section>
    </div>
  );
}
