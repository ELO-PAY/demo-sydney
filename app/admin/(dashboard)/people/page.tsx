import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTR_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Person = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  role: string | null;
  ok_to_contact: boolean;
  attributes: Record<string, unknown> | null;
  created_at: string;
};

// PostgREST's or() filter is comma/parenthesis-delimited, so strip anything
// that could break it before interpolating the search term.
function safeTerm(q: string): string {
  return q.replace(/[,()%*]/g, " ").trim();
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();
  const term = safeTerm(q);

  const supabase = createAdminClient();
  let query = supabase
    .from("people")
    .select(
      "id, email, name, company, role, ok_to_contact, attributes, created_at"
    )
    .order("created_at", { ascending: false });

  if (term) {
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="empty">
        <p>Couldn&apos;t load people: {error.message}</p>
      </div>
    );
  }

  const people = (data ?? []) as Person[];

  return (
    <>
      <h1>People</h1>
      <p className="count">
        {people.length} {people.length === 1 ? "person" : "people"}
        {q ? ` matching “${q}”` : ", newest first."}
      </p>

      <form method="get" className="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, or company…"
          aria-label="Search people"
        />
        <button type="submit" className="btn btn-sm">
          Search
        </button>
        {q && (
          <Link href="/admin/people" className="search-clear">
            Clear
          </Link>
        )}
      </form>

      {people.length === 0 ? (
        <div className="empty">
          {q ? "No people match that search." : "No people yet."}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Industry</th>
                <th>Employees</th>
                <th>Newsletter</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const attrs = (p.attributes ?? {}) as Record<string, unknown>;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/people/${p.id}`}>
                        {p.name || "—"}
                      </Link>
                      {p.role && <div className="muted">{p.role}</div>}
                    </td>
                    <td>
                      <a href={`mailto:${p.email}`}>{p.email}</a>
                    </td>
                    <td>{p.company || "—"}</td>
                    <td>{(attrs.current_industry as string) || "—"}</td>
                    <td>{(attrs.number_of_employees as string) || "—"}</td>
                    <td>{p.ok_to_contact ? "Yes" : "—"}</td>
                    <td className="nowrap">{formatDate(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Custom attributes shown: {Object.values(ATTR_LABELS).join(", ")}.
      </p>
    </>
  );
}
