"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

interface HistorySnapshot {
  earmarked: { name: string; occDate: string; amount: number }[];
  purchases: { name: string; amount: number; spent_on: string; category: string }[];
}

/**
 * Corrects a name/category typo on one line item inside a closed period's
 * frozen snapshot. Deliberately never touches an amount or any derived
 * total (safe_to_spend, rollover_in, ...) — those stay frozen as posted,
 * per the build brief's "closed periods are frozen records" rule. This is
 * the "edit, never delete" History gets under rev 02 §8: fix the record,
 * don't rewrite the math.
 */
export async function updateHistoryLineItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const payPeriodId = String(formData.get("pay_period_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const index = Number(formData.get("index") ?? -1);
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!payPeriodId || (kind !== "earmarked" && kind !== "purchases") || index < 0 || !name) {
    throw new Error("Missing or invalid line item edit");
  }

  const { data: period, error: fetchErr } = await supabase
    .from("pay_periods")
    .select("snapshot")
    .eq("id", payPeriodId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!period?.snapshot) throw new Error("No snapshot to edit");

  const snapshot = period.snapshot as unknown as HistorySnapshot;
  if (kind === "earmarked") {
    const item = snapshot.earmarked[index];
    if (!item) throw new Error("Line item not found");
    item.name = name;
  } else {
    const item = snapshot.purchases[index];
    if (!item) throw new Error("Line item not found");
    item.name = name;
    item.category = category || item.category;
  }

  const { error: updErr } = await supabase
    .from("pay_periods")
    .update({ snapshot: snapshot as unknown as Json })
    .eq("id", payPeriodId)
    .eq("user_id", user.id);
  if (updErr) throw updErr;

  revalidatePath("/history");
}
