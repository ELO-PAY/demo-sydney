import { createAdminClient } from "@/lib/supabase/admin";
import { inquiryLabel, STATUS_LABELS } from "@/lib/constants";

// Always fetch fresh — new leads must appear within seconds.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Person = {
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  ok_to_contact: boolean;
  attributes: Record<string, unknown> | null;
};

type Lead = {
  id: string;
  type: string;
  subject: string | null;
  message: string | null;
  status: string;
  created_at: string;
  people: Person | null;
};

const ATTR_LABELS: Record<string, string> = {
  number_of_employees: "Employees",
  current_industry: "Industry",
  ideal_project_start_date: "Ideal start",
};

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));
}

export default async function LeadsPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, type, subject, message, status, created_at, people ( email, name, phone, company, role, ok_to_contact, attributes )"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="empty">
        <p>Couldn&apos;t load leads: {error.message}</p>
      </div>
    );
  }

  const leads = (data ?? []) as unknown as Lead[];

  return (
    <>
      <h1>Leads</h1>
      <p className="count">
        {leads.length === 0
          ? "No leads yet."
          : `${leads.length} inquir${leads.length === 1 ? "y" : "ies"}, newest first.`}
      </p>

      {leads.length === 0 ? (
        <div className="empty">
          When someone submits the contact form, their inquiry lands here
          instantly.
        </div>
      ) : (
        leads.map((lead) => {
          const p = lead.people;
          const attrs = (p?.attributes ?? {}) as Record<string, unknown>;
          return (
            <article key={lead.id} className="lead">
              <div className="lead-top">
                <p className="lead-name">{p?.name || "Unknown"}</p>
                <span className="lead-when">{formatWhen(lead.created_at)}</span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <span className="badge">{inquiryLabel(lead.type)}</span>
                <span className="badge badge-status">
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
              </div>

              <div className="lead-meta">
                {p?.email && (
                  <span>
                    <b>Email:</b> <a href={`mailto:${p.email}`}>{p.email}</a>
                  </span>
                )}
                {p?.phone && (
                  <span>
                    <b>Phone:</b> {p.phone}
                  </span>
                )}
                {p?.company && (
                  <span>
                    <b>Company:</b> {p.company}
                  </span>
                )}
                {p?.role && (
                  <span>
                    <b>Role:</b> {p.role}
                  </span>
                )}
                {p?.ok_to_contact && (
                  <span>
                    <b>Newsletter:</b> opted in
                  </span>
                )}
              </div>

              {Object.keys(attrs).length > 0 && (
                <div className="attrs">
                  {Object.entries(attrs).map(([k, v]) => (
                    <span key={k} className="attr">
                      <b>{ATTR_LABELS[k] ?? k}:</b> {String(v)}
                    </span>
                  ))}
                </div>
              )}

              {lead.message && <p className="lead-message">{lead.message}</p>}
            </article>
          );
        })
      )}
    </>
  );
}
