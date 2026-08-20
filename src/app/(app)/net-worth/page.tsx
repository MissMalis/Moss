import { listAccounts, listHoldings, listAllLiabilityLoans } from "@/lib/data/accounts";
import { listIncomeSources } from "@/lib/data/income";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import { computeNetWorth, accountGroup, aggregateSnapshots, blendedApr } from "@/lib/net-worth";
import { Money } from "@/components/Money";
import { NetWorthHero } from "@/components/NetWorthHero";
import { MoveMoneyButton } from "@/components/MoveMoneyButton";
import { AddAssetButton, AddLiabilityButton } from "@/components/AccountWizard";
import { NetWorthGroupList, type NetWorthGroupData } from "@/components/NetWorthGroupList";
import { CARD_HEADER } from "@/lib/ui";

// Rev 05 §4: Rocket-Money nested model — one "Assets" parent whose group
// rows are Investments/Cash, one "Liabilities" parent whose one group is
// Debt. Same nested-card pattern on both sides.
const ASSET_SUBGROUPS = ["Investments", "Cash"] as const;

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

  const assetGroups: NetWorthGroupData[] = ASSET_SUBGROUPS.map((group) => {
    const inGroup = accounts.filter((a) => accountGroup(a.type) === group);
    const groupTotal = inGroup.reduce((s, a) => s + (valueById.get(a.id) ?? 0), 0);
    const pct = assetsTotal > 0 ? Math.round((Math.abs(groupTotal) / assetsTotal) * 100) : 0;
    return {
      key: group,
      label: group,
      total: groupTotal,
      pct,
      pctLabel: "assets" as const,
      accounts: inGroup.map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        type: a.type,
        institution: a.institution,
        value: valueById.get(a.id) ?? 0,
        apr: blendedByAccount.get(a.id) ?? a.apr_pct,
        apy: a.apy_pct,
        blended: blendedByAccount.has(a.id),
      })),
    };
  }).filter((g) => g.accounts.length > 0);

  const liabilityGroups: NetWorthGroupData[] = liabilitiesAccounts.length
    ? [
        {
          key: "Debt",
          label: "Debt",
          total: -liabilitiesTotal,
          pct: 100,
          pctLabel: "liabilities",
          accounts: liabilitiesAccounts.map((a) => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            type: a.type,
            institution: a.institution,
            value: valueById.get(a.id) ?? 0,
            apr: blendedByAccount.get(a.id) ?? a.apr_pct,
            apy: a.apy_pct,
            blended: blendedByAccount.has(a.id),
          })),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <MoveMoneyButton accounts={transferAccounts} />
      </div>

      <NetWorthHero total={netWorth.total} points={historyPoints} />

      {/* Rev 08 #9: each Add button sits ABOVE the section card it adds to
          (page-level, right-aligned), not inside the card's header row —
          tightly paired with its own card via a nested space-y-2. */}
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <AddAssetButton incomeSources={incomeSources.map((s) => ({ id: s.id, name: s.name, freq: s.freq }))} />
        </div>
        {/* Rev 10 §4.2: ~16px corners on Net worth's own cards — the
            "friendlier" Rocket-Money radius, scoped to this page only (the
            shared CARD constant elsewhere stays at the standard 12px).
            Written out rather than appending to CARD, since two
            conflicting `rounded-*` utilities in one className isn't a
            reliable override — Tailwind resolves it by generated-CSS
            order, not by className string order. */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className={CARD_HEADER}>Assets</p>
            <Money value={assetsTotal} size="card" />
          </div>
          {assetGroups.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">No accounts yet — add your first one above.</p>
          ) : (
            <div className="mt-2">
              <NetWorthGroupList groups={assetGroups} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <AddLiabilityButton />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className={CARD_HEADER}>Liabilities</p>
            <Money value={-liabilitiesTotal} size="card" />
          </div>
          {liabilityGroups.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">No debt tracked yet — add one above.</p>
          ) : (
            <div className="mt-2">
              <NetWorthGroupList groups={liabilityGroups} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
