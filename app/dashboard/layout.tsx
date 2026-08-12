import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV: [string, string][] = [
  ["Dashboard", "/dashboard"],
  ["Inbox", "/dashboard/inbox"],
  ["Tool Desk", "/dashboard/tool-desk"],
  ["Prepare", "/dashboard/prepare"],
  ["Inventory", "/dashboard/inventory"],
  ["Ledger", "/dashboard/ledger"],
  ["Scrap Register", "/dashboard/scrap"],
  ["Vendors", "/dashboard/vendors"],
  ["Forecasting", "/dashboard/forecasting"],
  ["Reports", "/dashboard/reports"],
  ["Daily", "/dashboard/daily"],
  ["Audit Records", "/dashboard/audit"],
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const who = user.email ?? "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "216px 1fr", minHeight: "100vh" }}>
      <aside style={{ background: "var(--steel-dark)", color: "#c9d6da", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontWeight: 800, color: "#fff", fontSize: 16, letterSpacing: "0.02em" }}>AI-TMS</div>
          <div style={{ fontSize: 11, color: "#7fa0a9", marginTop: 2 }}>Vijay Spheroidals</div>
        </div>
        <nav style={{ padding: 10, flex: 1 }}>
          {NAV.map(([label, href]) => (
            <Link key={href} href={href}
              style={{ display: "block", padding: "9px 12px", color: "#aebfc4", borderRadius: 6, fontSize: 13, marginBottom: 2 }}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>
          <div style={{ color: "#7fa0a9", marginBottom: 8, wordBreak: "break-all" }}>{who}</div>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost" style={{ border: "1px solid #2c6b7c", color: "#c9d6da", borderRadius: 6, padding: "6px 12px", background: "transparent", cursor: "pointer", fontSize: 12 }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 52, borderBottom: "1px solid var(--line)", background: "var(--panel)", display: "flex", alignItems: "center", padding: "0 24px" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-soft)" }}>Tool Management System</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Store · Operations · Regrind</div>
        </header>
        <main style={{ padding: 24, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}