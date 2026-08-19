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
  defaultAccountIcon,
} from "@/lib/net-worth";
import { LIABILITY_TYPE_SET } from "@/lib/account-types";
import { formatMoney } from "@/lib/format";
import { Money } from "@/components/Money";
import { NetWorthHero } from "@/components/NetWorthHero";
import { IconCircle } from "@/components/IconCircle";
import { Collapsible } from "@/components/Collapsible";
import { MoveMoneyButton } from "@/components/MoveMoneyButton";
import { AddAssetButton, AddLiabilityButton } from "@/components/AccountWizard";
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
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-card-soft"
    >
      <IconCircle value={a.icon ?? defaultAccountIcon(a.type)} label={a.name} variant="tinted" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-ink-2">{a.name}</p>
        <p className="truncate text-[11.5px] text-ink-3">
          {accountTypeLabel(a.type)}
          {apr != null ? ` · ${apr}% ${blended != null ? "blended " : ""}APR` : ""}
          {a.type === "HYSA" && a.apy_pct ? ` · ${a.apy_pct}% APY` : ""}
        </p>
      </div>
      <span className="shrink-0 font-display text-[13px] font-medium tabular-nums text-ink-2">{formatMoney(value)}</span>
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
        <div className="flex flex-1 items-center justify-between gap-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
            {label} <span className="normal-case">· {pct}% of {pctLabel}</span>
          </p>
          <Money value={total} size="subtotal" />
        </div>
      }
    >
      <div className="space-y-0.5 py-1 pl-5">
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

      {/* Rev 08 #9: each Add button sits ABOVE the section card it adds to
          (page-level, right-aligned), not inside the card's header row —
          tightly paired with its own card via a nested space-y-2. */}
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <AddAssetButton incomeSources={incomeSources.map((s) => ({ id: s.id, name: s.name, freq: s.freq }))} />
        </div>
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3">
            <p className={CARD_HEADER}>Assets</p>
            <Money value={assetsTotal} size="card" />
          </div>
          {accounts.filter((a) => accountGroup(a.type) !== "Liabilities").length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">No accounts yet — add your first one above.</p>
          ) : (
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
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <AddLiabilityButton />
        </div>
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3">
            <p className={CARD_HEADER}>Liabilities</p>
            <Money value={-liabilitiesTotal} size="card" />
          </div>
          {liabilitiesAccounts.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">No debt tracked yet — add one above.</p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
