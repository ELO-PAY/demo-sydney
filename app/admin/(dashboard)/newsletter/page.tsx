import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Subscriber = {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  created_at: string;
};

export default async function NewsletterPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name, email, company, created_at")
    .eq("ok_to_contact", true)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="empty">
        <p>Couldn&apos;t load the newsletter list: {error.message}</p>
      </div>
    );
  }

  const subscribers = (data ?? []) as Subscriber[];
  const emails = subscribers.map((s) => s.email).join(", ");

  return (
    <>
      <h1>Newsletter</h1>
      <p className="count">
        {subscribers.length === 0
          ? "No one has opted in yet."
          : `${subscribers.length} ${
              subscribers.length === 1 ? "person" : "people"
            } opted in (ok_to_contact = true).`}
      </p>

      {subscribers.length === 0 ? (
        <div className="empty">
          People who tick the newsletter box on the contact form appear here.
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Opted in</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/people/${s.id}`}>
                        {s.name || "—"}
                      </Link>
                    </td>
                    <td>
                      <a href={`mailto:${s.email}`}>{s.email}</a>
                    </td>
                    <td>{s.company || "—"}</td>
                    <td className="nowrap">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field" style={{ marginTop: 20 }}>
            <label htmlFor="all-emails">All addresses (copy for a send)</label>
            <textarea id="all-emails" readOnly rows={3} defaultValue={emails} />
          </div>
        </>
      )}
    </>
  );
}
