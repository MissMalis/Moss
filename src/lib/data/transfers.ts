import { createClient } from "@/lib/supabase/server";

export async function listTransfersInRange(start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transfers")
    .select("*")
    .gte("transfer_date", start)
    .lte("transfer_date", end)
    .order("transfer_date", { ascending: false });
  if (error) throw error;
  return data;
}
