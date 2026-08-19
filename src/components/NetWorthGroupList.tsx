"use client";

import { useState } from "react";
import Link from "next/link";
import { Money } from "@/components/Money";
import { IconCircle } from "@/components/IconCircle";
import { Collapsible } from "@/components/Collapsible";
import { accountTypeLabel, defaultAccountIcon } from "@/lib/net-worth";
import { LIABILITY_TYPE_SET } from "@/lib/account-types";
import { formatMoney } from "@/lib/format";
import { LINK_QUIET } from "@/lib/ui";

export interface NetWorthAccountRow {
  id: string;
  name: string;
  icon: string | null;
  type: string;
  value: number;
  apr: number | null;
  apy: number | null;
  blended: boolean;
}

export interface NetWorthGroupData {
  key: string;
  label: string;
  total: number;
  pct: number;
  pctLabel: "assets" | "liabilities";
  accounts: NetWorthAccountRow[];
}

function AccountRow({ a }: { a: NetWorthAccountRow }) {
  const isLiability = LIABILITY_TYPE_SET.has(a.type);
  const apr = isLiability ? a.apr : null;
  return (
    <Link
      href={`/net-worth/${a.id}`}
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-card-soft"
    >
      <IconCircle value={a.icon ?? defaultAccountIcon(a.type)} label={a.name} variant="tinted" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] text-ink-2">{a.name}</p>
        <p className="truncate text-[11px] text-ink-3">
          {accountTypeLabel(a.type)}
          {apr != null ? ` · ${apr}% ${a.blended ? "blended " : ""}APR` : ""}
          {a.type === "HYSA" && a.apy ? ` · ${a.apy}% APY` : ""}
        </p>
      </div>
      <span className="shrink-0 font-display text-[13px] font-medium tabular-nums text-ink-2">{formatMoney(a.value)}</span>
    </Link>
  );
}

function GroupRow({ group, open, onToggle }: { group: NetWorthGroupData; open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <Collapsible
      open={open}
      onToggle={onToggle}
      summary={
        <div className="flex flex-1 items-center justify-between gap-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
            {group.label} <span className="normal-case">· {group.pct}% of {group.pctLabel}</span>
          </p>
          <Money value={group.total} size="subtotal" />
        </div>
      }
    >
      {/* Rev 09 §6.3: a visible divider between the group header and its
          member accounts — the group's own weight (bold subtotal above)
          vs. the lighter, indented rows below must read unmistakably. */}
      <div className="space-y-0.5 border-t border-border py-1.5 pl-6">
        {group.accounts.map((a) => (
          <AccountRow key={a.id} a={a} />
        ))}
      </div>
    </Collapsible>
  );
}

/** Rev 09 §6.2: one "Expand all / Collapse all" control per card, driving every group row inside it at once. */
export function NetWorthGroupList({ groups }: { groups: NetWorthGroupData[] }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const allOpen = groups.length > 0 && groups.every((g) => openKeys.has(g.key));

  function toggleAll() {
    setOpenKeys(allOpen ? new Set() : new Set(groups.map((g) => g.key)));
  }

  return (
    <div>
      {groups.length > 0 && (
        <div className="flex justify-end pb-1">
          <button type="button" onClick={toggleAll} className={LINK_QUIET}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}
      <div className="divide-y divide-border">
        {groups.map((g) => (
          <GroupRow
            key={g.key}
            group={g}
            open={openKeys.has(g.key)}
            onToggle={(open) =>
              setOpenKeys((prev) => {
                const next = new Set(prev);
                if (open) next.add(g.key);
                else next.delete(g.key);
                return next;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
