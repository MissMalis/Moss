"use client";

import { useState } from "react";
import { createHolding, updateHolding, deleteHolding } from "@/lib/actions/holdings";
import { formatMoney } from "@/lib/format";
import { AddButton } from "@/components/AddButton";
import { HoldingFields } from "@/components/TickerPriceField";
import { EmptyState } from "@/components/EmptyState";
import { lucideKey } from "@/lib/icons";
import { BTN_GHOST, CARD, CARD_HEADER, LINK_QUIET } from "@/lib/ui";

interface HoldingRow {
  id: string;
  symbol: string;
  qty: number;
  cost_basis: number;
  current_price: number;
  buy_date: string | null;
}

const HOLDINGS_GRID = "grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] items-center gap-2";
const ADD_POSITION_GRID = "grid grid-cols-[1fr_1fr_1fr_1fr_1fr] items-center gap-2";

/** Rev 07 #7: static (read-only) until Edit, matching Details — the live Save/Remove inputs were rendering unconditionally before. */
export function HoldingsSection({ accountId, holdings }: { accountId: string; holdings: HoldingRow[] }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between">
        <p className={CARD_HEADER}>Holdings</p>
        {holdings.length > 0 && (
          <button type="button" onClick={() => setEditing((v) => !v)} className={BTN_GHOST}>
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {holdings.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={lucideKey("trending-up")} title="No positions yet" hint="Add one below." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className={`${HOLDINGS_GRID} pb-1.5 text-center text-[11px] uppercase tracking-wide text-ink-3`}>
            <span>Symbol</span>
            <span>Shares</span>
            <span>Cost basis</span>
            <span>Date</span>
            <span>Price</span>
            <span>Value</span>
            <span />
          </div>
          <div className="space-y-1.5">
            {holdings.map((h) =>
              editing ? (
                <EditableHoldingRow key={h.id} holding={h} />
              ) : (
                <div key={h.id} className={`${HOLDINGS_GRID} rounded-lg border border-border bg-card-soft px-2 py-1.5 text-[12.5px]`}>
                  <span className="truncate text-ink">{h.symbol}</span>
                  <span className="text-right text-ink tabular-nums">{h.qty}</span>
                  <span className="text-right text-ink tabular-nums">{formatMoney(h.cost_basis)}</span>
                  <span className="text-ink-2">{h.buy_date ?? "—"}</span>
                  <span className="text-right text-ink tabular-nums">{formatMoney(h.current_price)}</span>
                  <span className="text-right text-ink tabular-nums">{formatMoney(h.qty * h.current_price)}</span>
                  <span />
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <AddButton label="Add position">
            <form action={createHolding} className="flex flex-col gap-3">
              <input type="hidden" name="account_id" value={accountId} />
              <div className={`${ADD_POSITION_GRID} pb-1 text-center text-[11px] uppercase tracking-wide text-ink-3`}>
                <span>Symbol</span>
                <span>Shares</span>
                <span>Cost basis</span>
                <span>Date</span>
                <span>Price</span>
              </div>
              <div className={ADD_POSITION_GRID}>
                <HoldingFields />
              </div>
              <button type="submit" className={`${BTN_GHOST} self-start`}>
                Add position
              </button>
            </form>
          </AddButton>
        </div>
      )}
    </section>
  );
}

function EditableHoldingRow({ holding: h }: { holding: HoldingRow }) {
  const formId = `holding-${h.id}`;
  return (
    <div className={`${HOLDINGS_GRID} rounded-lg border border-border bg-card-soft px-2 py-1.5 text-[12.5px]`}>
      {/* An empty, display:none <form> whose action every input below associates with via the form="" attribute — keeps the grid columns real siblings instead of nested inside a <form>, which is what caused the old misalignment, without the form itself eating a grid cell. */}
      <form id={formId} action={updateHolding} className="hidden">
        <input type="hidden" name="id" value={h.id} />
      </form>
      <HoldingFields
        formId={formId}
        symbolDefault={h.symbol}
        qtyDefault={h.qty}
        costBasisDefault={h.cost_basis}
        buyDateDefault={h.buy_date ?? ""}
        priceDefault={h.current_price}
      />
      <span className="text-ink tabular-nums">{formatMoney(h.qty * h.current_price)}</span>
      <span className="flex items-center gap-2 justify-self-end">
        <button form={formId} type="submit" className={LINK_QUIET}>
          Save
        </button>
        <form action={deleteHolding}>
          <input type="hidden" name="id" value={h.id} />
          <button type="submit" className={LINK_QUIET}>
            Remove
          </button>
        </form>
      </span>
    </div>
  );
}
