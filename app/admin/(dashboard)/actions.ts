"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PIPELINE_STAGES,
  ORDER_STATUSES,
  CALL_FIELDS,
  getCallDetail,
  isProposalReady,
  type ContactStatus,
  type OrderStatus,
} from "@/lib/constants";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// The logged-in admin's email, recorded as the actor on status changes.
// The layout already guarantees a user, but we confirm again here.
async function requireActor(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return user.email ?? "admin";
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// Move a Contacts row to a new stage. The DB function writes exactly one
// activity_log row per real change and is a no-op when the stage is unchanged.
export async function updateContactStatus(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const contactId = str(formData, "contact_id");
  const toStatus = str(formData, "to_status") as ContactStatus;
  const note = str(formData, "note");

  if (!contactId || !PIPELINE_STAGES.includes(toStatus)) return;

  const supabase = createAdminClient();

  // Gate: a deal can't move to Proposal until the post-call checklist gives us
  // a verified scope, a headcount, and a price. This is what kills wrong
  // assumptions before they reach the client.
  if (toStatus === "proposal") {
    const { data: row } = await supabase
      .from("contacts")
      .select("metadata")
      .eq("id", contactId)
      .single();
    const call = getCallDetail(row?.metadata as Record<string, unknown> | null);
    if (!isProposalReady(call)) {
      throw new Error(
        "Complete the post-call checklist first — a proposal needs a verified " +
          "scope, headcount, and an estimated value. Add them on the person's " +
          "record, then move to Proposal."
      );
    }
  }

  const { error } = await supabase.rpc("set_contact_status", {
    p_contact_id: contactId,
    p_to_status: toStatus,
    p_actor: actor,
    p_note: note || null,
  });

  if (error) {
    console.error("set_contact_status failed:", error);
    throw new Error("Couldn't update the stage. Please try again.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pipeline");
  const personId = str(formData, "person_id");
  if (personId) revalidatePath(`/admin/people/${personId}`);
}

// Record an order against a person, shown on their record.
export async function addOrder(formData: FormData): Promise<void> {
  await requireActor();
  const personId = str(formData, "person_id");
  const productName = str(formData, "product_name");
  const amountStr = str(formData, "amount");
  const currency = (str(formData, "currency") || "AUD").toUpperCase();
  const status = str(formData, "status") as OrderStatus;

  if (!personId || !productName) {
    throw new Error("Product name is required.");
  }
  if (!ORDER_STATUSES.includes(status)) {
    throw new Error("Please choose a valid order status.");
  }

  // Accept "1,250.00" / "$1250" etc.; store as integer cents.
  const amount = Number(amountStr.replace(/[^0-9.]/g, ""));
  const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;

  const supabase = createAdminClient();
  const { error } = await supabase.from("orders").insert({
    person_id: personId,
    product_name: productName,
    amount_cents: amountCents,
    currency,
    status,
  });

  if (error) {
    console.error("addOrder failed:", error);
    throw new Error("Couldn't save the order. Please try again.");
  }

  revalidatePath(`/admin/people/${personId}`);
  revalidatePath("/admin/orders");
}

// Parse "$4,500" / "4500.00" etc. into integer cents. Returns 0 when blank/invalid.
function parseCents(raw: string): number {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Capture the post-call detail back onto the deal (contacts.metadata.call) —
// the structured checklist fields, a free-text notes box, and the estimated
// value from the pricing calculator. This is "log the real detail on the same
// record and move it forward": if the deal is still early, it advances to
// Discovery call and logs that move.
export async function saveCallDetail(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const contactId = str(formData, "contact_id");
  const personId = str(formData, "person_id");
  if (!contactId) throw new Error("Missing contact.");

  const call: Record<string, unknown> = {};
  for (const f of CALL_FIELDS) {
    const v = str(formData, `call_${f.key}`);
    if (v) call[f.key] = v;
  }
  const notes = str(formData, "call_notes");
  if (notes) call.notes = notes;
  const valueCents = parseCents(str(formData, "estimated_value"));
  if (valueCents > 0) call.estimated_value_cents = valueCents;
  call.logged_by = actor;
  call.logged_at = new Date().toISOString();

  const supabase = createAdminClient();

  // Merge onto any existing metadata so we don't clobber other keys.
  const { data: row, error: readErr } = await supabase
    .from("contacts")
    .select("metadata, status")
    .eq("id", contactId)
    .single();
  if (readErr) {
    console.error("saveCallDetail read failed:", readErr);
    throw new Error("Couldn't load the inquiry. Please try again.");
  }

  const metadata = {
    ...((row?.metadata as Record<string, unknown> | null) ?? {}),
    call,
  };

  const { error } = await supabase
    .from("contacts")
    .update({ metadata })
    .eq("id", contactId);
  if (error) {
    console.error("saveCallDetail update failed:", error);
    throw new Error("Couldn't save the call detail. Please try again.");
  }

  // Move the deal forward when it's still at intake: the call has now happened.
  if (row?.status === "new_lead" || row?.status === "contacted") {
    const { error: moveErr } = await supabase.rpc("set_contact_status", {
      p_contact_id: contactId,
      p_to_status: "discovery_call",
      p_actor: actor,
      p_note: "Call detail captured",
    });
    if (moveErr) console.error("saveCallDetail stage move failed:", moveErr);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pipeline");
  if (personId) revalidatePath(`/admin/people/${personId}`);
}
