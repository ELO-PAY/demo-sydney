"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PIPELINE_STAGES,
  ORDER_STATUSES,
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
