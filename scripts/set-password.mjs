// One-off dev utility: set (or create) the password for your Moss login.
//
// Usage:
//   node --env-file=.env.local scripts/set-password.mjs you@example.com yourpassword
//
// Uses the service-role key, so it can set a password directly without an
// email round-trip. Safe to keep in the repo — it reads secrets from your
// local .env.local, it doesn't contain any.

import { createClient } from "@supabase/supabase-js";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error(
    "Usage: node --env-file=.env.local scripts/set-password.mjs you@example.com yourpassword",
  );
  process.exit(1);
}

if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Did you forget --env-file=.env.local?",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Could not list users:", listError.message);
  process.exit(1);
}

const existing = data.users.find((u) => u.email === email);

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
  if (error) {
    console.error("Could not update password:", error.message);
    process.exit(1);
  }
  console.log(`Password set for existing user ${email}.`);
} else {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("Could not create user:", error.message);
    process.exit(1);
  }
  console.log(`Created user ${email} with a password.`);
}
