import Link from "next/link";
import { listAccounts, listHoldings, listAllLiabilityLoans } from "@/lib/data/accounts";
import { listIncomeSources } from "@/lib/data/income";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import {
  computeNetWorth,
  accountTypeLabel,
  accountGroup,
  aggregateSnapshots,
  blendedApr,
} from "@/lib/net-worth";
import { LIABILITY_TYPE_SET } from "@/lib/account-types";
import { Money } from "@/components/Money";
import { NetWorthHero } from "@/components/NetWorthHero";
import { IconCircle } from "@/components/IconCircle";
import { Collapsible } from "@/components/Collapsible";
import { MoveMoneyButton } from "@/components/MoveMoneyButton";
import { AddAssetButton, AddLiabilityButton } from "@/components/AccountWizard";
import { EmptyState } from "@/components/EmptyState";
import { lucideKey } from "@/lib/icons";
import { CARD, CARD_HEADER } from "@/lib/ui";

// Rev 05 §4: Rocket-Money nested model — one "Assets" parent whose group
// rows are Investments/Cash, one "Liabilities" parent whose one group is
// Debt. Same nested-card pattern on both sides.
const ASSET_SUBGROUPS = ["Investments", "Cash"] as const;

type AccountRowData = { id: string; name: string; icon: string | null; type: string; apr_pct: number | null; apy_pct: number | null };

function AccountRow({ a, value, blended }: { a: AccountRowData; value: number; blended: number | null }) {
  const isLiability = LIABILITY_TYPE_SET.has(a.type);
  const apr = isLiability ? (blended ?? a.apr_pct) : null;
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
          {apr != null ? ` · ${apr}% ${blended != null ? "blended " : ""}APR` : ""}
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
  blendedByAccount,
}: {
  label: string;
  total: number;
  pct: number;
  pctLabel: "assets" | "liabilities";
  accountsInGroup: AccountRowData[];
  valueById: Map<string, number>;
  blendedByAccount: Map<string, number>;
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
          <AccountRow key={a.id} a={a} value={valueById.get(a.id) ?? 0} blended={blendedByAccount.get(a.id) ?? null} />
        ))}
      </div>
    </Collapsible>
  );
}

export default async function NetWorthPage() {
  const [accounts, holdings, incomeSources, liabilityLoans] = await Promise.all([
    listAccounts(),
    listHoldings(),
    listIncomeSources(),
    listAllLiabilityLoans(),
  ]);
  await ensureSnapshotsForToday({ accounts, holdings });
  const snapshots = await listAllSnapshots();

  const netWorth = computeNetWorth(accounts, holdings, liabilityLoans);
  const historyPoints = aggregateSnapshots(
    snapshots.map((s) => ({
      snapshot_date: s.snapshot_date,
      account_id: s.account_id,
      contributed: s.contributed,
      market_value: s.market_value,
    })),
  );

  const loansByAccount = new Map<string, typeof liabilityLoans>();
  for (const l of liabilityLoans) {
    loansByAccount.set(l.account_id, [...(loansByAccount.get(l.account_id) ?? []), l]);
  }
  const blendedByAccount = new Map<string, number>();
  for (const [accountId, loans] of loansByAccount) {
    const b = blendedApr(loans);
    if (b != null) blendedByAccount.set(accountId, b);
  }

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
      <div className="flex items-center justify-end gap-3">
        <MoveMoneyButton accounts={transferAccounts} />
      </div>

      <NetWorthHero total={netWorth.total} points={historyPoints} />

      <div className="flex items-center justify-end gap-3">
        <AddLiabilityButton />
        <AddAssetButton incomeSources={incomeSources.map((s) => ({ id: s.id, name: s.name, freq: s.freq }))} />
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
                    blendedByAccount={blendedByAccount}
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
                  blendedByAccount={blendedByAccount}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
