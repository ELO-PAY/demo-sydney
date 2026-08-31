import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inquiryLabel,
  statusLabel,
  PIPELINE_STAGES,
  ATTR_LABELS,
} from "@/lib/constants";
import { formatWhen } from "@/lib/format";
import { updateContactStatus } from "../actions";

// Always fetch fresh — new leads must appear within seconds.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Person = {
  id: string;
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

export default async function PipelinePage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, type, subject, message, status, created_at, people ( id, email, name, phone, company, role, ok_to_contact, attributes )"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="empty">
        <p>Couldn&apos;t load the pipeline: {error.message}</p>
      </div>
    );
  }

  const leads = (data ?? []) as unknown as Lead[];

  return (
    <>
      <h1>Pipeline</h1>
      <p className="count">
        {leads.length === 0
          ? "No inquiries yet."
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
                <p className="lead-name">
                  {p ? (
                    <Link href={`/admin/people/${p.id}`}>
                      {p.name || "Unknown"}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </p>
                <span className="lead-when">{formatWhen(lead.created_at)}</span>
              </div>

              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}
              >
                <span className="badge">{inquiryLabel(lead.type)}</span>
                <span className={`badge badge-status status-${lead.status}`}>
                  {statusLabel(lead.status)}
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

              {/* Move this inquiry through the pipeline. */}
              <form action={updateContactStatus} className="stage-form">
                <input type="hidden" name="contact_id" value={lead.id} />
                {p && <input type="hidden" name="person_id" value={p.id} />}
                <label className="stage-label" htmlFor={`stage-${lead.id}`}>
                  Move to
                </label>
                <select
                  id={`stage-${lead.id}`}
                  name="to_status"
                  defaultValue={lead.status}
                  className="stage-select"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="note"
                  placeholder="Note (optional)"
                  className="stage-note"
                />
                <button type="submit" className="btn btn-sm">
                  Update
                </button>
              </form>
            </article>
          );
        })
      )}
    </>
  );
}
