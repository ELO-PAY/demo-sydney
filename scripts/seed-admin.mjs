// Seeds (or resets) ONE admin account and verifies it can sign in.
//   ADMIN_EMAIL     required
//   ADMIN_PASSWORD  optional — a strong one is generated if omitted
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE;
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
let password = process.env.ADMIN_PASSWORD || "";

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env vars in .env.local.");
  process.exit(1);
}
if (!email) {
  console.error("Set ADMIN_EMAIL, e.g.  ADMIN_EMAIL=you@example.com npm run db:seed-admin");
  process.exit(1);
}

function strongPassword() {
  // 20 chars, mixed classes, no ambiguous look-alikes.
  const sets = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnpqrstuvwxyz",
    "23456789",
    "!@#$%^&*-_=+",
  ];
  const all = sets.join("");
  const pick = (s) => s[crypto.randomInt(s.length)];
  const chars = sets.map(pick); // guarantee one of each class
  while (chars.length < 20) chars.push(pick(all));
  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

if (!password) password = strongPassword();

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Create the user (email pre-confirmed so it can log in immediately).
const { error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createErr) {
  const msg = String(createErr.message || "");
  if (/registered|already|exists/i.test(msg)) {
    // Already there — reset the password and ensure it's confirmed.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list.users.find((u) => (u.email || "").toLowerCase() === email);
    if (!existing) {
      console.error("User reported as existing but not found. Aborting.");
      process.exit(1);
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updErr) {
      console.error("Failed to reset existing admin:", updErr.message);
      process.exit(1);
    }
    console.log(`Reset existing admin account: ${email}`);
  } else {
    console.error("Failed to create admin:", msg);
    process.exit(1);
  }
} else {
  console.log(`Created admin account: ${email}`);
}

// Verify: sign in exactly like the real login form (publishable key).
const asUser = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: signIn, error: signInErr } = await asUser.auth.signInWithPassword({
  email,
  password,
});

if (signInErr || !signIn?.session) {
  console.error("VERIFY FAILED — could not sign in:", signInErr?.message);
  process.exit(1);
}

console.log("VERIFY OK — sign-in succeeded, session issued.");
console.log("--------------------------------------------------");
console.log("  Admin email:    " + email);
console.log("  Admin password: " + password);
console.log("--------------------------------------------------");
console.log("Log in at /admin/login");
