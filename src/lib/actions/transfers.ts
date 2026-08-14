"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
 * Rev 04 §4: Move money between two of the user's own accounts. Relocates
 * real balance (debits `from`, credits `to` — net worth is unchanged
 * either way) and is recorded as a transfer, never a purchase, so it can
 * never leak into spend reports, budgets, or the expense ring. Safe to
 * Spend impact is computed live from the transfers table (see
 * lib/transfers.ts), not stored here.
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
    .select("id, balance")
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

  const { error: creditErr } = await supabase
    .from("accounts")
    .update({ balance: (toAccount.balance ?? 0) + amount })
    .eq("id", to_account_id);
  if (creditErr) throw creditErr;

  revalidateEverywhere();
}
