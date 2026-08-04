"use client";
import { useState } from "react";

export interface PrepRow {
  tool_id: string; name: string | null; where: string;
  since: string | null; by: string | null; issuedBy: string | null;
}
type SectionKey = "inUse" | "atVendor" | "waitingRegrind";

function fmtDate(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function daysSince(ts: string | null) {
  if (!ts) return null;
  return Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 86400000));
}
function urgencyOf(days: number | null): "fresh" | "due-soon" | "overdue" {
  if (days == null) return "fresh";
  if (days >= 14) return "overdue";
  if (days >= 7) return "due-soon";
  return "fresh";
}
const URGENCY_CHIP = { overdue: "chip-wscrap", "due-soon": "chip-wregr", fresh: "chip-avail" } as const;
const URGENCY_LABEL = { overdue: "Overdue", "due-soon": "Due soon", fresh: "On time" } as const;

export default function PrepareActions({
  inUse, atVendor, waitingRegrind, person,
}: { inUse: PrepRow[]; atVendor: PrepRow[]; waitingRegrind: PrepRow[]; person: string }) {
  const [data, setData] = useState({ inUse, atVendor, waitingRegrind });
  const [vendorInputs, setVendorInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; t: string } | null>(null);

  async function act(section: SectionKey, row: PrepRow, txnType: string, tofrom: string, machine: string) {
    setBusyId(row.tool_id); setToast(null);
    const txn = { id: row.tool_id, type: txnType, qty: 1, person, machine, tofrom, dc: "", condition: "", life: null, remark: "Posted via Prepare" };
    try {
      const res = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txns: [txn] }),
      });
      const json = await res.json();
      const result = json.results?.[0];
      if (result?.ok) {
        setData((d) => ({ ...d, [section]: d[section].filter((r) => r.tool_id !== row.tool_id) }));
        setToast({ ok: true, t: `${txnType} posted for ${row.tool_id} (${result.txn_id})` });
      } else {
        setToast({ ok: false, t: `${row.tool_id}: ${result?.errors?.join("; ") ?? "blocked"}` });
      }
    } catch {
      setToast({ ok: false, t: "Network error." });
    } finally { setBusyId(null); }
  }

  // sort each list so overdue rows float to the top
  const sortByUrgency = (rows: PrepRow[]) =>
    [...rows].sort((a, b) => {
      const rank = { overdue: 0, "due-soon": 1, fresh: 2 };
      const ua = urgencyOf(daysSince(a.since)), ub = urgencyOf(daysSince(b.since));
      if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub];
      return (daysSince(b.since) ?? 0) - (daysSince(a.since) ?? 0);
    });

  return (
    <>
      {toast && (
        <div className="panel" style={{ padding: "10px 14px", marginBottom: 14,
          borderColor: toast.ok ? "var(--ok)" : "var(--danger)", color: toast.ok ? "var(--ok)" : "var(--danger)", fontSize: 13 }}>
          {toast.t}
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><span>Take back from operations</span><span className="muted">{data.inUse.length}</span></div>
        <div className="panel-pad">
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Tools currently issued out. If overdue, check the store first — confirm with the person who took it and the one who issued it before assuming it&apos;s missing.
          </p>
          <div style={{ overflow: "auto", maxHeight: "50vh" }}>
            <table className="tbl">
              <thead><tr><th>Tool ID</th><th>Name</th><th>Machine</th><th>Taken by</th><th>Issued by</th><th>Since</th><th className="right">Out</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sortByUrgency(data.inUse).map((r) => {
                  const d = daysSince(r.since); const u = urgencyOf(d);
                  return (
                    <tr key={r.tool_id}>
                      <td className="id">{r.tool_id}</td>
                      <td className="muted">{r.name || "—"}</td>
                      <td className="id" style={{ fontSize: 12 }}>{r.where}</td>
                      <td>{r.by || "—"}</td>
                      <td>{r.issuedBy || "—"}</td>
                      <td className="muted">{fmtDate(r.since)}</td>
                      <td className="num">{d != null ? `${d}d` : "—"}</td>
                      <td><span className={"chip " + URGENCY_CHIP[u]}>{URGENCY_LABEL[u]}</span></td>
                      <td>
                        <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }}
                          disabled={busyId === r.tool_id} onClick={() => act("inUse", r, "RECEIVE", "", r.where)}>
                          {busyId === r.tool_id ? "…" : "Receive ←"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {data.inUse.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 20 }}>Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><span>Receive from vendor</span><span className="muted">{data.atVendor.length}</span></div>
        <div className="panel-pad">
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Tools at the regrind vendor — receive when they return.</p>
          <div style={{ overflow: "auto", maxHeight: "48vh" }}>
            <table className="tbl">
              <thead><tr><th>Tool ID</th><th>Name</th><th>Vendor</th><th>Sent by</th><th>Since</th><th className="right">Out</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sortByUrgency(data.atVendor).map((r) => {
                  const d = daysSince(r.since); const u = urgencyOf(d);
                  return (
                    <tr key={r.tool_id}>
                      <td className="id">{r.tool_id}</td>
                      <td className="muted">{r.name || "—"}</td>
                      <td className="id" style={{ fontSize: 12 }}>{r.where}</td>
                      <td>{r.by || "—"}</td>
                      <td className="muted">{fmtDate(r.since)}</td>
                      <td className="num">{d != null ? `${d}d` : "—"}</td>
                      <td><span className={"chip " + URGENCY_CHIP[u]}>{URGENCY_LABEL[u]}</span></td>
                      <td>
                        <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }}
                          disabled={busyId === r.tool_id} onClick={() => act("atVendor", r, "RECEIPT", r.where, "")}>
                          {busyId === r.tool_id ? "…" : "Receipt ←"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {data.atVendor.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><span>Dispatch for regrind</span><span className="muted">{data.waitingRegrind.length}</span></div>
        <div className="panel-pad">
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Waiting-regrind tools ready to send out. Type the vendor before dispatching.</p>
          <div style={{ overflow: "auto", maxHeight: "48vh" }}>
            <table className="tbl">
              <thead><tr><th>Tool ID</th><th>Name</th><th>Vendor</th><th></th></tr></thead>
              <tbody>
                {data.waitingRegrind.map((r) => (
                  <tr key={r.tool_id}>
                    <td className="id">{r.tool_id}</td>
                    <td className="muted">{r.name || "—"}</td>
                    <td>
                      <input className="input" placeholder="Vendor name" style={{ minWidth: 160 }}
                        value={vendorInputs[r.tool_id] ?? ""}
                        onChange={(e) => setVendorInputs((v) => ({ ...v, [r.tool_id]: e.target.value }))} />
                    </td>
                    <td>
                      <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }}
                        disabled={busyId === r.tool_id || !(vendorInputs[r.tool_id] ?? "").trim()}
                        onClick={() => act("waitingRegrind", r, "DISPATCH", (vendorInputs[r.tool_id] ?? "").trim(), "")}>
                        {busyId === r.tool_id ? "…" : "Dispatch →"}
                      </button>
                    </td>
                  </tr>
                ))}
                {data.waitingRegrind.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}