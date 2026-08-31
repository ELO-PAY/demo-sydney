import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderStatusLabel } from "@/lib/constants";
import { formatWhen, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderRow = {
  id: string;
  product_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  people: { id: string; name: string | null; email: string } | null;
};

export default async function OrdersPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, product_name, amount_cents, currency, status, created_at, people ( id, name, email )"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="empty">
        <p>Couldn&apos;t load orders: {error.message}</p>
      </div>
    );
  }

  const orders = (data ?? []) as unknown as OrderRow[];
  const totalPaid = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);

  return (
    <>
      <h1>Orders</h1>
      <p className="count">
        {orders.length === 0
          ? "No orders yet."
          : `${orders.length} order${orders.length === 1 ? "" : "s"} · ${formatMoney(
              totalPaid
            )} paid.`}
      </p>

      {orders.length === 0 ? (
        <div className="empty">
          Record what people bought from their record under People.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.people ? (
                      <Link href={`/admin/people/${o.people.id}`}>
                        {o.people.name || o.people.email}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
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
    </>
  );
}
