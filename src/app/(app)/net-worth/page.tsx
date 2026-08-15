import Link from "next/link";
import { listAccounts, listHoldings, ACCOUNT_TYPES } from "@/lib/data/accounts";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import {
  computeNetWorth,
  accountTypeLabel,
  accountGroup,
  aggregateSnapshots,
} from "@/lib/net-worth";
import { createAccount } from "@/lib/actions/accounts";
import { Money } from "@/components/Money";
import { NetWorthHero } from "@/components/NetWorthHero";
import { IconCircle } from "@/components/IconCircle";
import { AddButton } from "@/components/AddButton";
import { IconPicker } from "@/components/IconPicker";
import { Collapsible } from "@/components/Collapsible";
import { MoveMoneyButton } from "@/components/MoveMoneyButton";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { lucideKey } from "@/lib/icons";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL } from "@/lib/ui";

// Rev 05 §4: Rocket-Money nested model — one "Assets" parent whose group
// rows are Investments/Cash, one "Liabilities" parent whose one group is
// Debt. Same nested-card pattern on both sides.
const ASSET_SUBGROUPS = ["Investments", "Cash"] as const;

type AccountRowData = { id: string; name: string; icon: string | null; type: string; apr_pct: number | null; apy_pct: number | null };

function AccountRow({ a, value }: { a: AccountRowData; value: number }) {
  return (
    <Link
      href={`/net-worth/${a.id}`}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-card-soft"
    >
      <IconCircle value={a.icon} label={a.name} variant="solid" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-ink">{a.name}</p>
        <p className="truncate text-[12px] text-ink-3">
          {accountTypeLabel(a.type)}
          {a.type === "Liabilities" && a.apr_pct ? ` · ${a.apr_pct}% APR` : ""}
          {a.type === "HYSA" && a.apy_pct ? ` · ${a.apy_pct}% APY` : ""}
        </p>
      </div>
      <Money value={value} size="card" />
    </Link>
  );
}

function GroupRow({
  label,
  total,
  pct,
  pctLabel,
  accountsInGroup,
  valueById,
}: {
  label: string;
  total: number;
  pct: number;
  pctLabel: "assets" | "liabilities";
  accountsInGroup: AccountRowData[];
  valueById: Map<string, number>;
}) {
  return (
    <Collapsible
      summary={
        <div className="flex flex-1 items-center justify-between gap-3 py-2">
          <p className="text-[13.5px] font-medium text-ink">
            {label} <span className="font-normal text-ink-3">· {pct}% of {pctLabel}</span>
          </p>
          <Money value={total} size="card" />
        </div>
      }
    >
      <div className="space-y-0.5 pb-2 pl-1">
        {accountsInGroup.map((a) => (
          <AccountRow key={a.id} a={a} value={valueById.get(a.id) ?? 0} />
        ))}
      </div>
    </Collapsible>
  );
}

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

  const valueById = new Map(netWorth.accounts.map((av) => [av.id, av.value]));
  const assetsTotal = ASSET_SUBGROUPS.reduce(
    (sum, g) => sum + accounts.filter((a) => accountGroup(a.type) === g).reduce((s, a) => s + (valueById.get(a.id) ?? 0), 0),
    0,
  );
  const liabilitiesAccounts = accounts.filter((a) => accountGroup(a.type) === "Liabilities");
  const liabilitiesTotal = liabilitiesAccounts.reduce((s, a) => s + Math.abs(valueById.get(a.id) ?? 0), 0);

  const transferAccounts = accounts.map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <MoveMoneyButton accounts={transferAccounts} />
      </div>

      <NetWorthHero total={netWorth.total} points={historyPoints} />

      <div className="flex items-center justify-end gap-3">
        <AddButton label="Add account">
          <form action={createAccount} className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Icon
              <IconPicker name="icon" />
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
        <EmptyState icon={lucideKey("landmark")} title="No accounts yet" hint="Add your first one above." />
      ) : (
        <>
          <div className={CARD}>
            <div className="flex items-center justify-between">
              <p className={CARD_HEADER}>Assets</p>
              <Money value={assetsTotal} size="card" />
            </div>
            <div className="mt-2 divide-y divide-border">
              {ASSET_SUBGROUPS.map((group) => {
                const inGroup = accounts.filter((a) => accountGroup(a.type) === group);
                if (inGroup.length === 0) return null;
                const groupTotal = inGroup.reduce((s, a) => s + (valueById.get(a.id) ?? 0), 0);
                const pct = assetsTotal > 0 ? Math.round((Math.abs(groupTotal) / assetsTotal) * 100) : 0;
                return (
                  <GroupRow
                    key={group}
                    label={group}
                    total={groupTotal}
                    pct={pct}
                    pctLabel="assets"
                    accountsInGroup={inGroup}
                    valueById={valueById}
                  />
                );
              })}
            </div>
          </div>

          {liabilitiesAccounts.length > 0 && (
            <div className={CARD}>
              <div className="flex items-center justify-between">
                <p className={CARD_HEADER}>Liabilities</p>
                <Money value={-liabilitiesTotal} size="card" />
              </div>
              <div className="mt-2 divide-y divide-border">
                <GroupRow
                  label="Debt"
                  total={-liabilitiesTotal}
                  pct={100}
                  pctLabel="liabilities"
                  accountsInGroup={liabilitiesAccounts}
                  valueById={valueById}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
