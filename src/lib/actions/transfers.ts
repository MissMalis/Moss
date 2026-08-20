"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LIABILITY_TYPE_SET } from "@/lib/account-types";
import { reduceLiabilityBalance, ensureDebtPaymentCategory } from "@/lib/liability-payments";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function revalidateEverywhere() {
  for (const path of ["/today", "/net-worth", "/expenses", "/sweep"]) {
    revalidatePath(path);
  }
}

/**
 * Rev 04 §4/Rev 10 §5: Move money between two of the user's own accounts —
 * discretionary movements (funding an account, extra debt paydown, cash
 * shuffles), as opposed to a scheduled Bill. Debits `from` normally; `to`
 * is credited normally UNLESS it's a liability, in which case the amount
 * pays it down instead (crediting a liability the same way as an asset
 * would make the debt bigger, backwards). Net worth is unchanged either
 * way (cash ↓ = liability ↓, a wash) — unconditional on funding source,
 * unlike Safe to spend. Never recorded as a purchase — this stays a
 * transfer, so Safe to spend keeps coming from the existing
 * transfersSafeToSpendImpact math (lib/transfers.ts) as the single
 * source, not a second, double-counted one. The Spend-analysis ring
 * instead reads checking-sourced liability transfers directly off the
 * transfers table (see expenses/page.tsx's byCategory), so it can show
 * this without ever touching Safe to spend.
 */
export async function createTransfer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const from_account_id = String(formData.get("from_account_id") ?? "");
  const to_account_id = String(formData.get("to_account_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const transfer_date = String(formData.get("transfer_date") ?? "") || new Date().toISOString().slice(0, 10);

  if (!from_account_id || !to_account_id) throw new Error("Pick a from and to account");
  if (from_account_id === to_account_id) throw new Error("Pick two different accounts");
  if (amount <= 0) throw new Error("Amount must be positive");

  const { data: fromAccount, error: fromErr } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("id", from_account_id)
    .maybeSingle();
  if (fromErr) throw fromErr;
  if (!fromAccount) throw new Error("Source account not found");

  const { data: toAccount, error: toErr } = await supabase
    .from("accounts")
    .select("id, type, balance")
    .eq("id", to_account_id)
    .maybeSingle();
  if (toErr) throw toErr;
  if (!toAccount) throw new Error("Destination account not found");

  const { error: insertErr } = await supabase.from("transfers").insert({
    user_id: user.id,
    from_account_id,
    to_account_id,
    amount,
    transfer_date,
  });
  if (insertErr) throw insertErr;

  const { error: debitErr } = await supabase
    .from("accounts")
    .update({ balance: (fromAccount.balance ?? 0) - amount })
    .eq("id", from_account_id);
  if (debitErr) throw debitErr;

  const toIsLiability = LIABILITY_TYPE_SET.has(toAccount.type);
  if (toIsLiability) {
    await reduceLiabilityBalance(supabase, to_account_id, amount);
    // Ensures the category exists (so it shows on Categories, and the
    // ring can resolve its color/icon) the first time anyone pays down a
    // liability — the ring itself reads the transfers table directly,
    // not a purchase, per the note above.
    await ensureDebtPaymentCategory(supabase, user.id);
  } else {
    const { error: creditErr } = await supabase
      .from("accounts")
      .update({ balance: (toAccount.balance ?? 0) + amount })
      .eq("id", to_account_id);
    if (creditErr) throw creditErr;
  }

  revalidateEverywhere();
}
