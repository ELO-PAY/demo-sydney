import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import AdminNav from "./AdminNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt-and-suspenders: middleware already gates this, but never render
  // admin content without a confirmed user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  return (
    <>
      <header className="admin-header">
        <div className="container">
          <div className="brand" style={{ color: "#fff" }}>
            ELO <span>Admin</span>
          </div>
          <form action={signOut} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="who">{user.email}</span>
            <button type="submit" className="link-btn">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <AdminNav />
      <main className="admin-main">
        <div className="container">{children}</div>
      </main>
    </>
  );
}
