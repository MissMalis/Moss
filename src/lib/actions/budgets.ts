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

// Rev 09 §3.3: creating a budget auto-creates its matching (locked)
// category in the same step — upsert on the (user_id, name) unique key so
// naming it after an existing category just re-tags that category's
// icon/color instead of erroring on the constraint.
export async function createBudget(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const cap_amount = Number(formData.get("cap_amount") ?? 0);
  if (!name || cap_amount <= 0) throw new Error("Name the budget and set a positive cap");

  const { error: catErr } = await supabase
    .from("categories")
    .upsert({ user_id: user.id, name, emoji, color }, { onConflict: "user_id,name" });
  if (catErr) throw catErr;

  const { error } = await supabase
    .from("budgets")
    .upsert({ user_id: user.id, category: name, cap_amount }, { onConflict: "user_id,category" });
  if (error) throw error;
  revalidatePath("/expenses/budget");
  revalidatePath("/expenses/categories");
}

export async function updateBudget(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const cap_amount = Number(formData.get("cap_amount") ?? 0);
  if (!id || cap_amount <= 0) throw new Error("Pick a positive cap");

  const { error } = await supabase.from("budgets").update({ cap_amount }).eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses/budget");
}

// Rev 09 §3.3: deleting a budget unlocks/releases its category — it does
// NOT delete the category itself (the user's transactions/history may
// still reference it by name; it just stops being budget-locked).
export async function deleteBudget(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing budget id");

  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses/budget");
  revalidatePath("/expenses/categories");
}
