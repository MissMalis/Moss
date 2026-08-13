import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type ApiKeyType = "gemini" | "market";

function secretName(userId: string, keyType: ApiKeyType) {
  return `${keyType}:${userId}`;
}

export async function setUserSecret(userId: string, keyType: ApiKeyType, value: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("set_user_secret", {
    secret_name: secretName(userId, keyType),
    secret_value: value,
  });
  if (error) throw error;
}

export async function getUserSecret(userId: string, keyType: ApiKeyType): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_user_secret", {
    secret_name: secretName(userId, keyType),
  });
  if (error) throw error;
  return data ?? null;
}

export async function deleteUserSecret(userId: string, keyType: ApiKeyType) {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("delete_user_secret", {
    secret_name: secretName(userId, keyType),
  });
  if (error) throw error;
}
