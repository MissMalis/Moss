"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listRecentActuals } from "@/lib/data/recurring";
import { rollingAverage } from "@/lib/recurring";
import { applyTax } from "@/lib/tax";
import { reduceLiabilityBalance, ensureDebtPaymentCategory } from "@/lib/liability-payments";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function taxRateFor(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number | null> {
  const { data } = await supabase.from("settings").select("tax_rate_pct").eq("user_id", userId).maybeSingle();
  return data?.tax_rate_pct ?? null;
}

function revalidate() {
  revalidatePath("/expenses");
  revalidatePath("/today");
}

// ---- Categories ----

export async function createCategory(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("categories").insert({ user_id: user.id, name, emoji, color });
  if (error) throw error;
  revalidate();
}

export async function updateCategory(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!id || !name) throw new Error("Name is required");

  // Rev 10 §6.2: a system category's name is load-bearing (matched by
  // string elsewhere — see lib/liability-payments.ts) — icon/color stay
  // editable, but a rename would silently break that matching, so it's
  // ignored for system rows instead of renaming.
  const { data: existing, error: lookupErr } = await supabase.from("categories").select("name, is_system").eq("id", id).single();
  if (lookupErr) throw lookupErr;

  const { error } = await supabase
    .from("categories")
    .update({ name: existing.is_system ? existing.name : name, emoji, color })
    .eq("id", id);
  if (error) throw error;
  revalidate();
}

// Rev 09 §0.2/§0.3/Rev 10 §6.2: a category can't be silently dropped if a
// budget is still keyed to its name (budgets.category is plain text, no
// FK — the schema can't block this for us), or if it's a system category
// (e.g. "Debt payment") Moss itself relies on — surface a clear, labeled
// message instead of letting a delete throw or silently breaking the
// money-effects code that matches on the name. Bills/charges that
// reference a category by id fall back to "no category" via ON DELETE SET
// NULL, not an error (schema.sql, Rev 09 section).
export async function deleteCategory(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");

  const { data: category, error: lookupErr } = await supabase
    .from("categories")
    .select("name, is_system")
    .eq("id", id)
    .single();
  if (lookupErr) throw lookupErr;

  if (category.is_system) {
    throw new Error("This category is managed by Moss and can't be deleted.");
  }

  const { data: lockingBudget } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", user.id)
    .eq("category", category.name)
    .maybeSingle();
  if (lockingBudget) {
    throw new Error("This category is used by a budget. Delete the budget first.");
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  revalidate();
}

// ---- Recurring items ----

export async function createRecurringItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  let category_id = String(formData.get("category_id") ?? "") || null;
  const subtotal = Number(formData.get("amount") ?? 0);
  const is_variable = formData.get("is_variable") === "on";
  const day_of_month = Number(formData.get("day_of_month") ?? 1);
  const apply_tax = formData.get("apply_tax") === "on";
  const target_liability_account_id = String(formData.get("target_liability_account_id") ?? "") || null;
  if (!name) throw new Error("Name is required");

  // Rev 10 §5.3/§6.2: a loan-payment bill is always filed under Debt
  // payment — overrides whatever the category dropdown had, so the ring
  // can't drift from the money-effects code that keys off this name.
  if (target_liability_account_id) {
    category_id = (await ensureDebtPaymentCategory(supabase, user.id)).id;
  }

  const amount = apply_tax ? applyTax(subtotal, true, await taxRateFor(supabase, user.id)) : subtotal;

  const { error } = await supabase.from("recurring_items").insert({
    user_id: user.id,
    name,
    category_id,
    amount,
    is_variable,
    day_of_month,
    apply_tax,
    target_liability_account_id,
    active: true,
  });
  if (error) throw error;
  revalidate();
}

/** "Edit going forward" — changes the item's default amount/config. */
export async function updateRecurringItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  let category_id = String(formData.get("category_id") ?? "") || null;
  const subtotal = Number(formData.get("amount") ?? 0);
  const is_variable = formData.get("is_variable") === "on";
  const day_of_month = Number(formData.get("day_of_month") ?? 1);
  const apply_tax = formData.get("apply_tax") === "on";
  const target_liability_account_id = String(formData.get("target_liability_account_id") ?? "") || null;
  if (!id || !name) throw new Error("Missing item id or name");

  if (target_liability_account_id) {
    category_id = (await ensureDebtPaymentCategory(supabase, user.id)).id;
  }

  const amount = apply_tax ? applyTax(subtotal, true, await taxRateFor(supabase, user.id)) : subtotal;

  const { error } = await supabase
    .from("recurring_items")
    .update({ name, category_id, amount, is_variable, day_of_month, apply_tax, target_liability_account_id })
    .eq("id", id);
  if (error) throw error;
  revalidate();
}

export async function toggleRecurringItemActive(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const { error } = await supabase.from("recurring_items").update({ active }).eq("id", id);
  if (error) throw error;
  revalidate();
}

export async function deleteRecurringItem(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("recurring_items").delete().eq("id", id);
  if (error) throw error;
  revalidate();
}

// ---- Per-occurrence state ----

async function upsertOccurrence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recurringItemId: string,
  occDate: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase.from("recurring_occurrences").upsert(
    { user_id: userId, recurring_item_id: recurringItemId, occ_date: occDate, ...patch },
    { onConflict: "recurring_item_id,occ_date" },
  );
  if (error) throw error;
}

export async function skipOccurrence(formData: FormData) {
  const { supabase, user } = await requireUser();
  const recurring_item_id = String(formData.get("recurring_item_id") ?? "");
  const occ_date = String(formData.get("occ_date") ?? "");
  await upsertOccurrence(supabase, user.id, recurring_item_id, occ_date, { skipped: true });
  revalidate();
}

export async function unskipOccurrence(formData: FormData) {
  const { supabase, user } = await requireUser();
  const recurring_item_id = String(formData.get("recurring_item_id") ?? "");
  const occ_date = String(formData.get("occ_date") ?? "");
  await upsertOccurrence(supabase, user.id, recurring_item_id, occ_date, { skipped: false });
  revalidate();
}

/** "Edit once" — a one-time override for a single occurrence. */
export async function editOccurrenceOnce(formData: FormData) {
  const { supabase, user } = await requireUser();
  const recurring_item_id = String(formData.get("recurring_item_id") ?? "");
  const occ_date = String(formData.get("occ_date") ?? "");
  const override_amount = Number(formData.get("override_amount") ?? 0);
  await upsertOccurrence(supabase, user.id, recurring_item_id, occ_date, { override_amount });
  revalidate();
}

/**
 * Mark an occurrence posted ("it actually went through"). For variable
 * bills this records the actual and re-seeds the item's estimate from the
 * rolling average of the last 3 actuals (brief §0.3 / §1).
 */
export async function postOccurrence(formData: FormData) {
  const { supabase, user } = await requireUser();
  const recurring_item_id = String(formData.get("recurring_item_id") ?? "");
  const occ_date = String(formData.get("occ_date") ?? "");
  const actualRaw = formData.get("actual_amount");
  const actual_amount = actualRaw != null && actualRaw !== "" ? Number(actualRaw) : null;

  await upsertOccurrence(supabase, user.id, recurring_item_id, occ_date, {
    posted: true,
    actual_amount,
  });

  // Rev 10 §5.3: a loan-payment bill also pays down the liability it's
  // linked to, the same amount effect as a Move money paydown — no
  // purchase/Safe-to-spend change here, since a Bill's money already left
  // Safe to spend via its earmark the moment the pay-period window opened
  // (see lib/data/today.ts); creating one here would double-count it. The
  // ring already picks this up too, automatically, via the bill's own
  // category on recurring_items — no separate step needed.
  const { data: item } = await supabase
    .from("recurring_items")
    .select("amount, target_liability_account_id")
    .eq("id", recurring_item_id)
    .maybeSingle();
  if (item?.target_liability_account_id) {
    await reduceLiabilityBalance(supabase, item.target_liability_account_id, actual_amount ?? item.amount);
  }

  if (actual_amount != null) {
    const recentActuals = await listRecentActuals(recurring_item_id, 3);
    const seed = rollingAverage(recentActuals);
    if (seed != null) {
      const { error } = await supabase
        .from("recurring_items")
        .update({ amount: seed })
        .eq("id", recurring_item_id);
      if (error) throw error;
    }
  }

  revalidate();
}

export async function unpostOccurrence(formData: FormData) {
  const { supabase, user } = await requireUser();
  const recurring_item_id = String(formData.get("recurring_item_id") ?? "");
  const occ_date = String(formData.get("occ_date") ?? "");
  await upsertOccurrence(supabase, user.id, recurring_item_id, occ_date, {
    posted: false,
    actual_amount: null,
  });
  revalidate();
}
