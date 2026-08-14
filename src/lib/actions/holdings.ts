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

export async function createHolding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const account_id = String(formData.get("account_id") ?? "");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const qty = Number(formData.get("qty") ?? 0);
  const cost_basis = Number(formData.get("cost_basis") ?? 0);
  const current_price = Number(formData.get("current_price") ?? 0);
  const buy_date = String(formData.get("buy_date") ?? "") || null;
  if (!account_id || !symbol) throw new Error("Account and symbol are required");

  const { error } = await supabase.from("holdings").insert({
    user_id: user.id,
    account_id,
    symbol,
    qty,
    cost_basis,
    current_price,
    buy_date,
  });
  if (error) throw error;
  revalidatePath("/net-worth");
}

// Manually repricing a holding is exactly the kind of refresh the "hasn't
// been updated in N days" checklist nudge (checklist.ts) is watching for —
// bump the owning account's balance_updated_at so acting on the nudge
// actually clears it.
async function touchAccountForHolding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  holdingId: string,
) {
  const { data: holding } = await supabase
    .from("holdings")
    .select("account_id")
    .eq("id", holdingId)
    .maybeSingle();
  if (!holding?.account_id) return;
  await supabase
    .from("accounts")
    .update({ balance_updated_at: new Date().toISOString() })
    .eq("id", holding.account_id);
}

export async function updateHoldingPrice(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const current_price = Number(formData.get("current_price") ?? 0);
  if (!id) throw new Error("Missing holding id");

  const { error } = await supabase
    .from("holdings")
    .update({ current_price })
    .eq("id", id);
  if (error) throw error;
  await touchAccountForHolding(supabase, id);
  revalidatePath("/net-worth");
}

export async function updateHolding(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const qty = Number(formData.get("qty") ?? 0);
  const cost_basis = Number(formData.get("cost_basis") ?? 0);
  const current_price = Number(formData.get("current_price") ?? 0);
  const buy_date = String(formData.get("buy_date") ?? "") || null;
  if (!id || !symbol) throw new Error("Symbol is required");

  const { error } = await supabase
    .from("holdings")
    .update({ symbol, qty, cost_basis, current_price, buy_date })
    .eq("id", id);
  if (error) throw error;
  await touchAccountForHolding(supabase, id);
  revalidatePath("/net-worth");
}

export async function deleteHolding(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing holding id");

  const { error } = await supabase.from("holdings").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
}
