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

// Card/multiplier management, charges, sweeping, and reconciliation all
// live on Sweep now (rev 03 §3 — Net worth is Assets/Liabilities only, no
// cards). Only sweeping also touches an account balance, so only that also
// revalidates Net worth's numbers.
function revalidateSweep() {
  revalidatePath("/sweep");
}

function revalidateSweepAndNetWorth() {
  revalidatePath("/sweep");
  revalidatePath("/net-worth");
}

// ---- Cards ----

// Rev 05 §4/§6: cards are now managed from the Net worth account they're
// linked to (one card per liability account), not a standalone Sweep
// section — so create/update/delete all revalidate Net worth too.
function revalidateSweepAndAccount() {
  revalidatePath("/sweep");
  revalidatePath("/net-worth");
}

export async function createCard(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const last4 = String(formData.get("last4") ?? "").trim() || null;
  const network = String(formData.get("network") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "#1C1A17").trim() || "#1C1A17";
  const base_multiplier = Number(formData.get("base_multiplier") ?? 1);
  const account_id = String(formData.get("account_id") ?? "") || null;
  if (!name) throw new Error("Name is required");

  const { error } = await supabase
    .from("cards")
    .insert({ user_id: user.id, name, last4, network, color, base_multiplier, account_id });
  if (error) throw error;
  revalidateSweepAndAccount();
}

export async function updateCard(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const last4 = String(formData.get("last4") ?? "").trim() || null;
  const network = String(formData.get("network") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "#14181C").trim() || "#14181C";
  const base_multiplier = Number(formData.get("base_multiplier") ?? 1);
  if (!id || !name) throw new Error("Name is required");

  const { error } = await supabase
    .from("cards")
    .update({ name, last4, network, color, base_multiplier })
    .eq("id", id);
  if (error) throw error;
  revalidateSweepAndAccount();
}

export async function deleteCard(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
  revalidateSweepAndAccount();
}

// ---- Point multipliers ----

export async function createMultiplier(formData: FormData) {
  const { supabase, user } = await requireUser();
  const card_id = String(formData.get("card_id") ?? "");
  const category_id = String(formData.get("category_id") ?? "");
  const multiplier = Number(formData.get("multiplier") ?? 1);
  if (!card_id || !category_id) throw new Error("Card and category are required");

  const { error } = await supabase
    .from("card_category_multipliers")
    .upsert(
      { user_id: user.id, card_id, category_id, multiplier },
      { onConflict: "card_id,category_id" },
    );
  if (error) throw error;
  revalidateSweep();
}

export async function deleteMultiplier(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("card_category_multipliers").delete().eq("id", id);
  if (error) throw error;
  revalidateSweep();
}

// ---- Card charges (quarantined from Safe-to-Spend until swept) ----
// No standalone "log a charge" action here anymore (rev 04 §7) — a
// rewards-card charge is logged once, on Expenses, and createPurchase
// mirrors it into card_charges itself. This avoids the double-entry the
// old separate Sweep form created.

export async function deleteCardCharge(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  // Only unswept charges can be removed — a swept one already moved real
  // money into the Forbidden Money bucket, so deleting it would desync them.
  const { error } = await supabase.from("card_charges").delete().eq("id", id).eq("swept", false);
  if (error) throw error;
  revalidateSweep();
}

// ---- Sweeper: batch-quarantine pending charges into Forbidden Money ----

/**
 * Rev 05 §6: sweeps a specific set of pending charges rather than an
 * implicit "everything" — "Select charges to sweep" step 1. With no `ids`
 * given (bulk "Sweep now"), every pending charge sweeps, same as before.
 */
export async function sweepPendingCharges(formData?: FormData) {
  const { supabase, user } = await requireUser();
  const ids = formData?.getAll("ids").map(String).filter(Boolean) ?? [];

  let query = supabase.from("card_charges").select("*").eq("user_id", user.id).eq("swept", false);
  if (ids.length > 0) query = query.in("id", ids);
  const { data: pending, error: pendingError } = await query;
  if (pendingError) throw pendingError;
  if (!pending || pending.length === 0) return;

  const { data: bucket, error: bucketError } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("user_id", user.id)
    .eq("is_forbidden_money", true)
    .maybeSingle();
  if (bucketError) throw bucketError;
  if (!bucket) {
    throw new Error("Mark an account as your Forbidden Money bucket first.");
  }

  const total = pending.reduce((s, c) => s + c.amount, 0);
  const sweptAt = new Date().toISOString();
  const sweptIds = pending.map((c) => c.id);

  const { error: updateChargesError } = await supabase
    .from("card_charges")
    .update({ swept: true, swept_at: sweptAt })
    .in("id", sweptIds);
  if (updateChargesError) throw updateChargesError;

  const { error: updateBucketError } = await supabase
    .from("accounts")
    .update({ balance: (bucket.balance ?? 0) + total })
    .eq("id", bucket.id);
  if (updateBucketError) throw updateBucketError;

  revalidateSweepAndNetWorth();
}

// ---- Forbidden Money bucket + reconciliation ----

export async function markForbiddenMoneyAccount(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing account id");

  const { error: clearError } = await supabase
    .from("accounts")
    .update({ is_forbidden_money: false })
    .eq("user_id", user.id)
    .eq("is_forbidden_money", true);
  if (clearError) throw clearError;

  const { error } = await supabase.from("accounts").update({ is_forbidden_money: true }).eq("id", id);
  if (error) throw error;
  revalidateSweep();
}

export async function reconcileForbiddenMoney(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const reconciled_balance = Number(formData.get("reconciled_balance") ?? 0);
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase.from("accounts").update({ reconciled_balance }).eq("id", id);
  if (error) throw error;
  revalidateSweep();
}

// ---- Settling up: pay off a card's balance from the buffer ----

/**
 * Rev 04 §7: records paying off a credit card from the buffer/channeling
 * account. Unlike a generic Move Money transfer, both sides go DOWN — the
 * buffer loses the cash, and the liability owes less — so this can't reuse
 * lib/transfers.ts's symmetric credit/debit logic.
 */
export async function payOffCard(formData: FormData) {
  const { supabase, user } = await requireUser();
  const buffer_account_id = String(formData.get("buffer_account_id") ?? "");
  const liability_account_id = String(formData.get("liability_account_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!buffer_account_id || !liability_account_id) throw new Error("Pick the buffer and the card's liability account");
  if (amount <= 0) throw new Error("Amount must be positive");

  const { data: buffer, error: bufferErr } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("id", buffer_account_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bufferErr) throw bufferErr;
  if (!buffer) throw new Error("Buffer account not found");

  const { data: liability, error: liabilityErr } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("id", liability_account_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (liabilityErr) throw liabilityErr;
  if (!liability) throw new Error("Liability account not found");

  const { error: bufferUpdErr } = await supabase
    .from("accounts")
    .update({ balance: (buffer.balance ?? 0) - amount })
    .eq("id", buffer.id);
  if (bufferUpdErr) throw bufferUpdErr;

  const { error: liabilityUpdErr } = await supabase
    .from("accounts")
    .update({ balance: Math.max(0, (liability.balance ?? 0) - amount) })
    .eq("id", liability.id);
  if (liabilityUpdErr) throw liabilityUpdErr;

  revalidateSweepAndNetWorth();
}

// ---- Which card is the mock channeling-card visual ----

export async function setCashAppCard(formData: FormData) {
  const { supabase, user } = await requireUser();
  const cash_app_card_id = String(formData.get("cash_app_card_id") ?? "") || null;

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, cash_app_card_id }, { onConflict: "user_id" });
  if (error) throw error;
  revalidateSweep();
}
