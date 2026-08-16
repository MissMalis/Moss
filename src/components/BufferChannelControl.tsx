"use client";

import { useState } from "react";
import { markForbiddenMoneyAccount, setCashAppCard } from "@/lib/actions/cards";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import { BTN_GHOST, LINK_QUIET } from "@/lib/ui";

interface AccountOpt {
  id: string;
  name: string;
}
interface CardOpt {
  id: string;
  name: string;
}

/**
 * Rev 07 #9: the buffer account + channel card get a permanent, always-
 * visible spot on Sweep — changing either is a small inline control, not
 * the old full "Reconciliation" section + card-button-grid section.
 */
export function BufferChannelControl({
  bufferAccount,
  cashAccounts,
  channelingCard,
  cards,
}: {
  bufferAccount: AccountOpt | null;
  cashAccounts: AccountOpt[];
  channelingCard: CardOpt | null;
  cards: CardOpt[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
      <span>
        Buffer: <span className="text-ink">{bufferAccount?.name ?? "not set"}</span> · Channel card:{" "}
        <span className="text-ink">{channelingCard?.name ?? "not set"}</span>
      </span>
      <button type="button" onClick={() => setEditing((v) => !v)} className={LINK_QUIET}>
        {editing ? "Done" : "Change"}
      </button>

      {editing && (
        <div className="mt-1 flex w-full flex-wrap items-end gap-3">
          <ActionForm action={markForbiddenMoneyAccount} className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-ink-3">
              Buffer account
              <Dropdown
                name="id"
                options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
                defaultValue={bufferAccount?.id ?? ""}
              />
            </label>
            <button type="submit" className={BTN_GHOST}>
              Save
            </button>
          </ActionForm>
          <ActionForm action={setCashAppCard} className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-ink-3">
              Channel card
              <Dropdown
                name="cash_app_card_id"
                options={[{ value: "", label: "None" }, ...cards.map((c) => ({ value: c.id, label: c.name }))]}
                defaultValue={channelingCard?.id ?? ""}
              />
            </label>
            <button type="submit" className={BTN_GHOST}>
              Save
            </button>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
