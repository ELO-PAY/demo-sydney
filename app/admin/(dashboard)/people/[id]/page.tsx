import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inquiryLabel,
  statusLabel,
  orderStatusLabel,
  ORDER_STATUSES,
  ATTR_LABELS,
} from "@/lib/constants";
import { formatWhen, formatMoney } from "@/lib/format";
import { addOrder } from "../../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActivityRow = {
  id: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  note: string | null;
  created_at: string;
};

type ContactRow = {
  id: string;
  type: string;
  subject: string | null;
  message: string | null;
  status: string;
  created_at: string;
  activity_log: ActivityRow[] | null;
};

type OrderRow = {
  id: string;
  product_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
};

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: person, error: personErr } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();

  if (personErr || !person) notFound();

  const [{ data: contactsData }, { data: ordersData }] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, type, subject, message, status, created_at, activity_log ( id, from_status, to_status, actor, note, created_at )"
      )
      .eq("person_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, product_name, amount_cents, currency, status, created_at")
      .eq("person_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const contacts = (contactsData ?? []) as unknown as ContactRow[];
  const orders = (ordersData ?? []) as OrderRow[];
  const attrs = (person.attributes ?? {}) as Record<string, unknown>;

  return (
    <>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin/people">← Back to People</Link>
      </p>

      <h1>{person.name || "Unknown"}</h1>
      <p className="count">
        <a href={`mailto:${person.email}`}>{person.email}</a>
        {person.ok_to_contact && (
          <span className="badge badge-status" style={{ marginLeft: 10 }}>
            Newsletter
          </span>
        )}
      </p>

      {/* ---- Details ---- */}
      <section className="panel">
        <h2>Details</h2>
        <div className="lead-meta">
          {person.phone && (
            <span>
              <b>Phone:</b> {person.phone}
            </span>
          )}
          {person.company && (
            <span>
              <b>Company:</b> {person.company}
            </span>
          )}
          {person.role && (
            <span>
              <b>Role:</b> {person.role}
            </span>
          )}
          {person.source_site && (
            <span>
              <b>Source:</b> {person.source_site}
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
      </section>

      {/* ---- Inquiries + status history ---- */}
      <section className="panel">
        <h2>Inquiries</h2>
        {contacts.length === 0 ? (
          <p className="muted">No inquiries on record.</p>
        ) : (
          contacts.map((c) => {
            // Timeline: creation first, then each logged status change, oldest→newest.
            const log = [...(c.activity_log ?? [])].sort(
              (a, b) => a.created_at.localeCompare(b.created_at)
            );
            return (
              <div key={c.id} className="inquiry">
                <div className="lead-top">
                  <span className="badge">{inquiryLabel(c.type)}</span>
                  <span className="lead-when">{formatWhen(c.created_at)}</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge badge-status status-${c.status}`}>
                    {statusLabel(c.status)}
                  </span>
                </div>
                {c.subject && (
                  <p style={{ margin: "10px 0 0", fontWeight: 600 }}>
                    {c.subject}
                  </p>
                )}
                {c.message && <p className="lead-message">{c.message}</p>}

                <ul className="timeline">
                  <li>
                    <span className="tl-when">{formatWhen(c.created_at)}</span>
                    <span className="tl-text">
                      Created as <b>{statusLabel("new_lead")}</b>
                    </span>
                  </li>
                  {log.map((a) => (
                    <li key={a.id}>
                      <span className="tl-when">{formatWhen(a.created_at)}</span>
                      <span className="tl-text">
                        {a.from_status ? statusLabel(a.from_status) : "—"} →{" "}
                        <b>{a.to_status ? statusLabel(a.to_status) : "—"}</b>
                        {a.actor && ` · ${a.actor}`}
                        {a.note && (
                          <span className="tl-note"> — “{a.note}”</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {/* ---- Orders ---- */}
      <section className="panel">
        <h2>Orders</h2>
        {orders.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.product_name}</td>
                    <td className="nowrap">
                      {formatMoney(o.amount_cents, o.currency)}
                    </td>
                    <td>
                      <span className={`badge order-${o.status}`}>
                        {orderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="nowrap">{formatWhen(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={addOrder} className="order-form">
          <input type="hidden" name="person_id" value={person.id} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="product_name">
                Product / service <span className="req">*</span>
              </label>
              <input
                id="product_name"
                name="product_name"
                type="text"
                placeholder="e.g. Payroll Compliance Review"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="amount">Amount (AUD)</label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 4500"
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <input id="currency" name="currency" type="text" defaultValue="AUD" />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="pending">
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {orderStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-sm">
            Add order
          </button>
        </form>
      </section>
    </>
  );
}
