"use client";

import { useState } from "react";
import { INPUT } from "@/lib/ui";

/**
 * Rev 05 §4: the full holdings-row field set (symbol → shares → cost basis
 * → date → price), kept as one client component because the price field's
 * lock state depends on cross-checking the symbol field against Finnhub
 * (via the existing /api/quotes endpoint). A valid public ticker
 * autopopulates and locks price; an invalid/non-public one leaves it open
 * for manual entry. `formId` associates every input with an external
 * <form> (the holdings-table row pattern); omit it for a plain inline form.
 */
export function HoldingFields({
  formId,
  symbolDefault = "",
  qtyDefault = 0,
  costBasisDefault = 0,
  buyDateDefault = "",
  priceDefault = 0,
}: {
  formId?: string;
  symbolDefault?: string;
  qtyDefault?: number;
  costBasisDefault?: number;
  buyDateDefault?: string;
  priceDefault?: number;
}) {
  const [symbol, setSymbol] = useState(symbolDefault);
  const [price, setPrice] = useState<number>(priceDefault);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);

  async function checkTicker(raw: string) {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      setLocked(false);
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(trimmed)}`);
      const body = await res.json();
      const quote = res.ok ? body.quotes?.[0] : null;
      if (quote?.price != null) {
        setPrice(quote.price);
        setLocked(true);
      } else {
        setLocked(false);
      }
    } catch {
      setLocked(false);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <input
        form={formId}
        name="symbol"
        value={symbol}
        onChange={(e) => {
          setSymbol(e.target.value);
          setLocked(false);
        }}
        onBlur={(e) => checkTicker(e.target.value)}
        placeholder="VTI"
        className={`w-full py-1 text-[12.5px] ${INPUT}`}
      />
      <input
        form={formId}
        type="number"
        step="0.0001"
        name="qty"
        defaultValue={qtyDefault}
        className={`w-full py-1 text-right text-[12.5px] ${INPUT}`}
      />
      <input
        form={formId}
        type="number"
        step="0.0001"
        name="cost_basis"
        defaultValue={costBasisDefault}
        className={`w-full py-1 text-right text-[12.5px] ${INPUT}`}
      />
      <input
        form={formId}
        type="date"
        name="buy_date"
        defaultValue={buyDateDefault}
        className={`w-full py-1 text-[12.5px] ${INPUT}`}
      />
      <input
        form={formId}
        type="number"
        step="0.0001"
        name="current_price"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        readOnly={locked}
        title={locked ? "Locked — matched a public ticker via Finnhub" : checking ? "Checking…" : "No public match — enter a price manually"}
        className={`w-full py-1 text-right text-[12.5px] ${INPUT} ${locked ? "bg-card-soft text-ink-2" : ""}`}
      />
    </>
  );
}
