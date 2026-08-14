"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listRecentActuals } from "@/lib/data/recurring";
import { rollingAverage } from "@/lib/recurring";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
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
  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("categories").insert({ user_id: user.id, name, emoji });
  if (error) throw error;
  revalidate();
}

export async function updateCategory(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  if (!id || !name) throw new Error("Name is required");

  const { error } = await supabase.from("categories").update({ name, emoji }).eq("id", id);
  if (error) throw error;
  revalidate();
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  revalidate();
}

// ---- Recurring items ----

export async function createRecurringItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "") || null;
  const amount = Number(formData.get("amount") ?? 0);
  const is_variable = formData.get("is_variable") === "on";
  const day_of_month = Number(formData.get("day_of_month") ?? 1);
  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("recurring_items").insert({
    user_id: user.id,
    name,
    category_id,
    amount,
    is_variable,
    day_of_month,
    active: true,
  });
  if (error) throw error;
  revalidate();
}

/** "Edit going forward" — changes the item's default amount/config. */
export async function updateRecurringItem(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "") || null;
  const amount = Number(formData.get("amount") ?? 0);
  const is_variable = formData.get("is_variable") === "on";
  const day_of_month = Number(formData.get("day_of_month") ?? 1);
  if (!id || !name) throw new Error("Missing item id or name");

  const { error } = await supabase
    .from("recurring_items")
    .update({ name, category_id, amount, is_variable, day_of_month })
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
