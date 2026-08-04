"use client";
import { useMemo, useState } from "react";

export interface VendorRow {
  tool_id: string; name: string | null; type: string | null;
  vendor: string; dispatched_at: string; dc: string | null; qty: number;
}

function fmtTs(ts: string) {
  if (ts === "—") return ts;
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function daysOut(ts: string): number | null {
  if (ts === "—") return null;
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Tools sitting at a vendor for a while need a heads-up before they become
// a silent stock shortfall on the shop floor.
function ageChip(days: number | null) {
  if (days === null) return null;
  if (days >= 14) return "chip-wscrap";
  if (days >= 7) return "chip-wregr";
  return "chip-avail";
}

export default function VendorsTable({ rows, live }: { rows: VendorRow[]; live: boolean }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      r.tool_id.toLowerCase().includes(s) ||
      (r.name ?? "").toLowerCase().includes(s) ||
      r.vendor.toLowerCase().includes(s));
  }, [rows, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, VendorRow[]>();
    for (const r of filtered) {
      const list = map.get(r.vendor) ?? [];
      list.push(r);
      map.set(r.vendor, list);
    }
    return Array.from(map.entries())
      .map(([vendor, items]) => ({
        vendor,
        items: [...items].sort((a, b) => (daysOut(b.dispatched_at) ?? 0) - (daysOut(a.dispatched_at) ?? 0)),
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [filtered]);

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search tool ID, name, or vendor…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>{filtered.length.toLocaleString()} shown{!live && " (sample)"}</span>
      </div>

      {grouped.map(({ vendor, items }) => (
        <div key={vendor} className="panel" style={{ marginBottom: 16, overflow: "auto" }}>
          <div className="panel-head">
            {vendor}
            <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              {items.length} tool{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Tool ID</th><th>Name</th><th>Type</th><th>Dispatched</th>
                <th>DC No</th><th className="right">Qty</th><th>Days out</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const days = daysOut(r.dispatched_at);
                return (
                  <tr key={r.tool_id}>
                    <td className="id">{r.tool_id}</td>
                    <td>{r.name}</td>
                    <td className="muted">{r.type}</td>
                    <td className="muted">{fmtTs(r.dispatched_at)}</td>
                    <td className="muted">{r.dc || "—"}</td>
                    <td className="num">{r.qty}</td>
                    <td>
                      {days === null
                        ? <span className="muted">—</span>
                        : <span className={"chip " + ageChip(days)}>{days}d</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {grouped.length === 0 && (
        <div className="panel">
          <div className="panel-pad muted" style={{ textAlign: "center", padding: 24 }}>
            No tools currently at a vendor.
          </div>
        </div>
      )}
    </>
  );
}