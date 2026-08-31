"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { INQUIRY_TYPE_VALUES, INDUSTRIES } from "@/lib/constants";

export type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function submitInquiry(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = str(formData, "email");
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const company = str(formData, "company");
  const role = str(formData, "role");
  const type = str(formData, "type");
  const subject = str(formData, "subject");
  const message = str(formData, "message");
  const okToContact = formData.get("ok_to_contact") === "on";

  // Custom attributes
  const numberOfEmployees = str(formData, "number_of_employees");
  const currentIndustry = str(formData, "current_industry");
  const idealStart = str(formData, "ideal_project_start_date");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Please enter your name.";
  if (!email) fieldErrors.email = "Please enter your email.";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "That doesn't look like a valid email.";
  if (!type) fieldErrors.type = "Please choose what you need help with.";
  else if (!INQUIRY_TYPE_VALUES.includes(type))
    fieldErrors.type = "Please choose a valid option.";
  if (currentIndustry && !(INDUSTRIES as readonly string[]).includes(currentIndustry))
    fieldErrors.current_industry = "Please choose a valid industry.";
  if (idealStart && Number.isNaN(Date.parse(idealStart)))
    fieldErrors.ideal_project_start_date = "Please enter a valid date.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  // Build the custom-attributes jsonb from only the values provided.
  const attributes: Record<string, unknown> = {};
  if (numberOfEmployees) attributes.number_of_employees = numberOfEmployees;
  if (currentIndustry) attributes.current_industry = currentIndustry;
  if (idealStart) attributes.ideal_project_start_date = idealStart;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("submit_inquiry", {
    p_email: email,
    p_name: name,
    p_phone: phone || null,
    p_company: company || null,
    p_role: role || null,
    p_source_site: siteUrl,
    p_ok_to_contact: okToContact,
    p_attributes: attributes,
    p_type: type,
    p_subject: subject || null,
    p_message: message || null,
    p_source: "contact_form",
    p_metadata: {},
  });

  if (error) {
    console.error("submit_inquiry failed:", error);
    return {
      ok: false,
      error: "Something went wrong saving your inquiry. Please try again.",
    };
  }

  redirect("/thank-you");
}
