import Link from "next/link";
import { listAccounts, listHoldings, ACCOUNT_TYPES } from "@/lib/data/accounts";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import {
  computeNetWorth,
  accountEmoji,
  accountTypeLabel,
  accountGroup,
  aggregateSnapshots,
  type HistoryPoint,
} from "@/lib/net-worth";
import { createAccount } from "@/lib/actions/accounts";
import { Money } from "@/components/Money";
import { NetWorthHero } from "@/components/NetWorthHero";
import { NetWorthLines } from "@/components/NetWorthLines";
import { AddButton } from "@/components/AddButton";
import { EmojiPicker } from "@/components/EmojiPicker";
import { IconGlyph } from "@/components/IconGlyph";
import { Collapsible } from "@/components/Collapsible";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, ROW } from "@/lib/ui";

const GROUPS = ["Investments", "Cash", "Liabilities"] as const;

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

  function AccountRow({ a }: { a: (typeof accounts)[number] }) {
    const accountHoldings = holdingsByAccount.get(a.id) ?? [];
    const trackable = accountGroup(a.type) === "Investments" || accountHoldings.length > 0;
    const series = snapshotsByAccount.get(a.id) ?? [];
    const value = netWorth.accounts.find((av) => av.id === a.id)?.value ?? a.balance;

    return (
      <Link href={`/net-worth/${a.id}`} className={`${ROW} flex items-center justify-between gap-4 transition hover:border-border-strong`}>
        <div className="flex items-center gap-3">
          <IconGlyph value={a.icon} fallback={accountEmoji(a.type)} className="text-[20px]" />
          <div>
            <p className="text-[14px] text-ink">{a.name}</p>
            <p className="text-[12px] text-ink-3">
              {accountTypeLabel(a.type)}
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
    <div className="space-y-6">
      <NetWorthHero total={netWorth.total} points={historyPoints} />

      <div className="flex items-center justify-between">
        <p className={CARD_HEADER}>Accounts</p>
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
                    {accountTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Starting balance
              <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-32 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                Total contributions
                <Tooltip text="What you've put in overall, including anything from before Moss — used to show growth vs. contributions." />
              </span>
              <input type="number" step="0.01" name="starting_contributed" defaultValue={0} className={`w-32 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                APY %
                <Tooltip text="For a High-Yield Savings Account — used to show accrued interest. Leave blank for anything else." />
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
                <Tooltip text="For HSA — Moss nudges you if the cash balance dips under this, since that usually means a charge triggered an auto-sell." />
              </span>
              <input type="number" step="0.01" name="min_cash" className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                Annual limit
                <Tooltip text="Optional — for 401(k)/HSA/IRA accounts, Moss will show how close you are to it as the year goes." />
              </span>
              <input type="number" step="0.01" name="annual_contribution_limit" className={`w-28 ${INPUT}`} />
            </label>
            <button type="submit" className={BTN_SOLID}>
              Add account
            </button>
          </form>
        </AddButton>
      </div>

      {accounts.length === 0 ? (
        <EmptyState emoji="🏦" title="No accounts yet" hint="Add your first one above." />
      ) : (
        GROUPS.map((group) => {
          const inGroup = accounts.filter((a) => accountGroup(a.type) === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group} className={CARD}>
              <Collapsible defaultOpen summary={<p className={CARD_HEADER}>{group}</p>}>
                <div className="mt-3 space-y-2">
                  {inGroup.map((a) => (
                    <AccountRow key={a.id} a={a} />
                  ))}
                </div>
              </Collapsible>
            </div>
          );
        })
      )}
    </div>
  );
}
