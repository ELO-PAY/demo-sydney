import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inquiryLabel,
  CALL_FIELDS,
  getCallDetail,
  isProposalReady,
} from "@/lib/constants";
import { formatMoney, formatDate } from "@/lib/format";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PersonRow = {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  role: string | null;
};

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const supabase = createAdminClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select(
      "id, type, subject, message, status, created_at, metadata, people ( id, name, email, company, role )"
    )
    .eq("id", contactId)
    .single();

  if (error || !contact) notFound();

  const person = contact.people as unknown as PersonRow | null;
  const call = getCallDetail(contact.metadata as Record<string, unknown> | null);
  const ready = isProposalReady(call);

  // Guard: a proposal only exists off a completed post-call checklist.
  if (!ready || !call) {
    return (
      <div className="proposal-shell">
        <div className="proposal-gate">
          <h1>Not ready for a proposal yet</h1>
          <p>
            This deal needs a verified scope, a headcount, and an estimated value
            captured on the call before a proposal can be generated.
          </p>
          {person && (
            <p>
              <Link href={`/admin/people/${person.id}`} className="btn btn-sm">
                ← Back to {person.name || "the record"}
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  const valueCents =
    typeof call.estimated_value_cents === "number" ? call.estimated_value_cents : 0;
  const ref = `APA-${contact.id.slice(0, 8).toUpperCase()}`;
  const today = formatDate(new Date().toISOString());

  return (
    <div className="proposal-shell">
      <div className="proposal-toolbar">
        {person && (
          <Link href={`/admin/people/${person.id}`}>← Back to record</Link>
        )}
        <PrintButton />
      </div>

      <article className="proposal">
        <header className="proposal-head">
          <div className="proposal-brand">
            ELO <span>Payroll Association</span>
          </div>
          <div className="proposal-ref">
            <div>
              <b>Proposal</b> {ref}
            </div>
            <div>{today}</div>
          </div>
        </header>

        <h1 className="proposal-title">
          {inquiryLabel(contact.type)}
        </h1>

        <section className="proposal-parties">
          <div>
            <span className="proposal-label">Prepared for</span>
            <p>
              <b>{person?.name || "—"}</b>
              {person?.role ? `, ${person.role}` : ""}
              <br />
              {person?.company && (
                <>
                  {person.company}
                  <br />
                </>
              )}
              {person?.email}
            </p>
          </div>
          <div>
            <span className="proposal-label">Prepared by</span>
            <p>
              <b>ELO Payroll Association</b>
              <br />
              Payroll advisory
              <br />
              emma-lee@austpayroll.com.au
            </p>
          </div>
        </section>

        <section className="proposal-section">
          <h2>Scope of work</h2>
          <p className="proposal-scope">{String(call.verified_scope)}</p>
        </section>

        <section className="proposal-section">
          <h2>Engagement parameters</h2>
          <table className="proposal-table">
            <tbody>
              {CALL_FIELDS.filter(
                (f) => f.key !== "verified_scope" && call[f.key]
              ).map((f) => (
                <tr key={f.key}>
                  <th>{f.label}</th>
                  <td>{String(call[f.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="proposal-section proposal-price">
          <div>
            <span className="proposal-label">Estimated investment</span>
            <p className="proposal-note">
              Fixed-fee estimate based on the scope confirmed on our call.
            </p>
          </div>
          <div className="proposal-amount">{formatMoney(valueCents)}</div>
        </section>

        {call.notes ? (
          <section className="proposal-section">
            <h2>Notes</h2>
            <p className="proposal-scope">{String(call.notes)}</p>
          </section>
        ) : null}

        <footer className="proposal-foot">
          <p>
            This proposal is valid for 30 days from {today}. Figures are estimates
            based on the scope confirmed during our discovery call and may be
            revised if scope changes. GST is additional where applicable.
          </p>
          <p className="proposal-sign">
            ELO Payroll Association · Payroll advisory · Sydney
          </p>
        </footer>
      </article>
    </div>
  );
}
