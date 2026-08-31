"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pipeline", label: "Pipeline" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/newsletter", label: "Newsletter" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      <div className="container">
        {LINKS.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={active ? "admin-nav-link active" : "admin-nav-link"}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
