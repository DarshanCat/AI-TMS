"use client";
import { useState } from "react";

export interface BrokenRow { id: number; tool_id: string; event_date: string | null; qty: number | null; condition: string | null; machine: string | null; reported_by: string | null; received_by: string | null; remarks: string | null; }
export interface RegrindRow { id: number; tool_id: string; event_date: string | null; qty: number | null; vendor: string | null; dc_no: string | null; sent_by: string | null; remarks: string | null; }
export interface ScrapRow { id: number; tool_id: string; event_date: string | null; qty: number | null; status: string | null; condition_vendor: string | null; dc_no: string | null; person: string | null; remarks: string | null; }

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function AuditTabs({ broken, regrind, scrap }: { broken: BrokenRow[]; regrind: RegrindRow[]; scrap: ScrapRow[] }) {
  const [tab, setTab] = useState<"broken" | "regrind" | "scrap">("broken");
  const [q, setQ] = useState("");

  const tabs = [
    { key: "broken" as const, label: `Broken Tools (${broken.length})` },
    { key: "regrind" as const, label: `Sent to Regrinding (${regrind.length})` },
    { key: "scrap" as const, label: `Scrap History (${scrap.length})` },
  ];

  const filt = <T extends { tool_id: string }>(rows: T[]) =>
    q.trim() ? rows.filter((r) => r.tool_id.toLowerCase().includes(q.toLowerCase())) : rows;

  return (
    <>
      <div className="toolbar">
        {tabs.map((t) => (
          <button key={t.key}
            className={t.key === tab ? "btn" : "btn-ghost"}
            style={{ padding: "7px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                     border: t.key === tab ? "1px solid var(--steel)" : "1px solid var(--line)" }}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <div className="spacer" />
        <input className="input" style={{ maxWidth: 220 }} placeholder="Filter by Tool ID…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="panel" style={{ overflow: "auto", maxHeight: "65vh" }}>
        {tab === "broken" && (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Tool ID</th><th className="right">Qty</th><th>Condition</th><th>Machine</th><th>Reported By</th><th>Received By</th><th>Remarks</th></tr></thead>
            <tbody>
              {filt(broken).map((r) => (
                <tr key={r.id}>
                  <td className="muted">{fmt(r.event_date)}</td>
                  <td className="id">{r.tool_id}</td>
                  <td className="num">{r.qty ?? "—"}</td>
                  <td><span className={"chip " + (r.condition === "Broken" ? "chip-wscrap" : "chip-wregr")}>{r.condition ?? "—"}</span></td>
                  <td className="muted">{r.machine || "—"}</td>
                  <td>{r.reported_by || "—"}</td>
                  <td>{r.received_by || "—"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.remarks || ""}</td>
                </tr>
              ))}
              {filt(broken).length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>No rows.</td></tr>}
            </tbody>
          </table>
        )}
        {tab === "regrind" && (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Tool ID</th><th className="right">Qty</th><th>Vendor</th><th>DC No</th><th>Sent By</th><th>Remarks</th></tr></thead>
            <tbody>
              {filt(regrind).map((r) => (
                <tr key={r.id}>
                  <td className="muted">{fmt(r.event_date)}</td>
                  <td className="id">{r.tool_id}</td>
                  <td className="num">{r.qty ?? "—"}</td>
                  <td>{r.vendor || "—"}</td>
                  <td className="id">{r.dc_no || "—"}</td>
                  <td>{r.sent_by || "—"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.remarks || ""}</td>
                </tr>
              ))}
              {filt(regrind).length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>No rows.</td></tr>}
            </tbody>
          </table>
        )}
        {tab === "scrap" && (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Tool ID</th><th className="right">Qty</th><th>Status</th><th>Condition/Vendor</th><th>DC No</th><th>Person</th><th>Remarks</th></tr></thead>
            <tbody>
              {filt(scrap).map((r) => (
                <tr key={r.id}>
                  <td className="muted">{fmt(r.event_date)}</td>
                  <td className="id">{r.tool_id}</td>
                  <td className="num">{r.qty ?? "—"}</td>
                  <td><span className={"chip " + (r.status === "Scrapped" ? "chip-scrap" : "chip-wscrap")}>{r.status ?? "—"}</span></td>
                  <td className="muted">{r.condition_vendor || "—"}</td>
                  <td className="id">{r.dc_no || "—"}</td>
                  <td>{r.person || "—"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.remarks || ""}</td>
                </tr>
              ))}
              {filt(scrap).length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>No rows.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}