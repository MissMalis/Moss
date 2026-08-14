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

export async function createCard(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const last4 = String(formData.get("last4") ?? "").trim() || null;
  const network = String(formData.get("network") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "#1C1A17").trim() || "#1C1A17";
  const base_multiplier = Number(formData.get("base_multiplier") ?? 1);
  if (!name) throw new Error("Name is required");

  const { error } = await supabase
    .from("cards")
    .insert({ user_id: user.id, name, last4, network, color, base_multiplier });
  if (error) throw error;
  revalidateSweep();
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
  revalidateSweep();
}

export async function deleteCard(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
  revalidateSweep();
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

export async function createCardCharge(formData: FormData) {
  const { supabase, user } = await requireUser();
  const card_id = String(formData.get("card_id") ?? "");
  const category_id = String(formData.get("category_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const spent_on = String(formData.get("spent_on") ?? "") || new Date().toISOString().slice(0, 10);
  if (!card_id || !name || amount <= 0) {
    throw new Error("Card, name, and a positive amount are required");
  }

  const { error } = await supabase
    .from("card_charges")
    .insert({ user_id: user.id, card_id, category_id, name, amount, spent_on });
  if (error) throw error;
  revalidateSweep();
}

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

export async function sweepPendingCharges() {
  const { supabase, user } = await requireUser();

  const { data: pending, error: pendingError } = await supabase
    .from("card_charges")
    .select("*")
    .eq("user_id", user.id)
    .eq("swept", false);
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

  const { error: updateChargesError } = await supabase
    .from("card_charges")
    .update({ swept: true, swept_at: sweptAt })
    .eq("user_id", user.id)
    .eq("swept", false);
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
