"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";

export interface MasterToolReportRow {
  tool_id: string;
  name: string | null;
  type: string | null;
  status: string;
  loc: string | null;
  avail: number;
  inuse: number;
  wregr: number;
  atregr: number;
  wscrap: number;
  scrap: number;
  owned: number;
  life: number | null;
}

export interface IssuedToolReportRow {
  tool_id: string;
  name: string | null;
  type: string | null;
  inuse_qty: number;
  issued_to: string; // Machine, Subcontractor, or Location
  person: string;
  issued_by: string;
  issued_at: string;
  expected_return: string;
  days_out: number;
  is_overdue: boolean;
}

export default function ReportsDashboard({
  masterRows,
  issuedRows,
  totalTransactions,
  topIssued,
  typeBreakdown,
}: {
  masterRows: MasterToolReportRow[];
  issuedRows: IssuedToolReportRow[];
  totalTransactions: number;
  topIssued: [string, number][];
  typeBreakdown: [string, number][];
}) {
  const [activeTab, setActiveTab] = useState<"master" | "issued" | "analytics">("master");
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("All");

  const categories = useMemo(() => {
    const set = new Set(masterRows.map((r) => r.type || "Other"));
    return ["All", ...Array.from(set)];
  }, [masterRows]);

  // Master tools filtered
  const filteredMaster = useMemo(() => {
    return masterRows.filter((r) => {
      const matchQ =
        !q.trim() ||
        r.tool_id.toLowerCase().includes(q.toLowerCase()) ||
        (r.name && r.name.toLowerCase().includes(q.toLowerCase())) ||
        (r.loc && r.loc.toLowerCase().includes(q.toLowerCase()));
      const matchType = filterType === "All" || (r.type || "Other") === filterType;
      return matchQ && matchType;
    });
  }, [masterRows, q, filterType]);

  // Issued tools filtered
  const filteredIssued = useMemo(() => {
    return issuedRows.filter((r) => {
      const matchQ =
        !q.trim() ||
        r.tool_id.toLowerCase().includes(q.toLowerCase()) ||
        (r.name && r.name.toLowerCase().includes(q.toLowerCase())) ||
        r.issued_to.toLowerCase().includes(q.toLowerCase()) ||
        r.person.toLowerCase().includes(q.toLowerCase());
      const matchType = filterType === "All" || (r.type || "Other") === filterType;
      return matchQ && matchType;
    });
  }, [issuedRows, q, filterType]);

  // KPI calculations
  const totalMasterCount = masterRows.length;
  const totalAvailableQty = masterRows.reduce((a, b) => a + (b.avail || 0), 0);
  const totalInUseQty = masterRows.reduce((a, b) => a + (b.inuse || 0), 0);
  const totalInRegrindQty = masterRows.reduce((a, b) => a + ((b.wregr || 0) + (b.atregr || 0)), 0);
  const totalScrappedQty = masterRows.reduce((a, b) => a + (b.scrap || 0), 0);

  // Excel Export: Master Data
  const exportMasterExcel = () => {
    const data = filteredMaster.map((r) => ({
      "Tool ID": r.tool_id,
      "Tool Name": r.name ?? "",
      "Class / Type": r.type ?? "",
      Status: r.status,
      Location: r.loc ?? "",
      Available: r.avail,
      "In Use": r.inuse,
      "Waiting Regrind": r.wregr,
      "At Regrind Vendor": r.atregr,
      "Waiting Scrap": r.wscrap,
      Scrapped: r.scrap,
      "Total Owned": r.owned,
      "Tool Life": r.life ?? "—",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Master Tools Inventory");
    XLSX.writeFile(wb, `AI_TMS_Master_Tools_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Excel Export: Issued Tools (Where tools are)
  const exportIssuedExcel = () => {
    const data = filteredIssued.map((r) => ({
      "Tool ID": r.tool_id,
      "Tool Name": r.name ?? "",
      "Type": r.type ?? "",
      "Qty In Use": r.inuse_qty,
      "Issued To (Machine / Subcon)": r.issued_to,
      "Taken By (Operator)": r.person,
      "Issued By (Store)": r.issued_by,
      "Issue Date": r.issued_at,
      "Expected Return": r.expected_return || "—",
      "Days Out": r.days_out,
      "Status": r.is_overdue ? "OVERDUE (14+ Days)" : r.days_out >= 7 ? "DUE SOON (7+ Days)" : "ACTIVE",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Tools Issued Report");
    XLSX.writeFile(wb, `AI_TMS_Issued_Tools_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI Overview Cards */}
      <div className="grid-kpi">
        <div className="kpi accent">
          <div className="k">Total Tools Master</div>
          <div className="v">{totalMasterCount.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="k">Available in Store</div>
          <div className="v" style={{ color: "#1f6a4a" }}>{totalAvailableQty.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="k">Currently In Use</div>
          <div className="v" style={{ color: "#1e4e6b" }}>{totalInUseQty.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="k">In Regrind Loop</div>
          <div className="v" style={{ color: "#8a5a12" }}>{totalInRegrindQty.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="k">Scrapped</div>
          <div className="v" style={{ color: "#5b636e" }}>{totalScrappedQty.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs Toolbar */}
      <div className="toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <button
          className={activeTab === "master" ? "btn" : "btn-ghost"}
          style={{ padding: "8px 16px", borderRadius: 6, cursor: "pointer", border: activeTab === "master" ? "1px solid var(--steel)" : "1px solid var(--line)" }}
          onClick={() => setActiveTab("master")}
        >
          📦 Total Master Data ({masterRows.length})
        </button>

        <button
          className={activeTab === "issued" ? "btn" : "btn-ghost"}
          style={{ padding: "8px 16px", borderRadius: 6, cursor: "pointer", border: activeTab === "issued" ? "1px solid var(--steel)" : "1px solid var(--line)" }}
          onClick={() => setActiveTab("issued")}
        >
          📍 Issued Tools &amp; Where Placed ({issuedRows.length})
        </button>

        <button
          className={activeTab === "analytics" ? "btn" : "btn-ghost"}
          style={{ padding: "8px 16px", borderRadius: 6, cursor: "pointer", border: activeTab === "analytics" ? "1px solid var(--steel)" : "1px solid var(--line)" }}
          onClick={() => setActiveTab("analytics")}
        >
          📊 Movement Analytics
        </button>

        <div className="spacer" />

        {activeTab !== "analytics" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="select"
              style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              className="input"
              style={{ maxWidth: 220, fontSize: 12, padding: "6px 10px" }}
              placeholder={activeTab === "master" ? "Search Master Tool ID, name, loc…" : "Search tool, machine, person…"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="btn"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={activeTab === "master" ? exportMasterExcel : exportIssuedExcel}
            >
              ⬇ Export Excel (.xlsx)
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: Total Master Data Report */}
      {activeTab === "master" && (
        <div className="panel">
          <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Complete Master Inventory &amp; Total Quantity Breakdown</span>
            <span className="muted" style={{ fontSize: 12 }}>Showing {filteredMaster.length} of {masterRows.length} tools</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tool ID</th>
                  <th>Tool Name</th>
                  <th>Class / Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th className="num">Avail</th>
                  <th className="num">In Use</th>
                  <th className="num">W-Regr</th>
                  <th className="num">At Vendor</th>
                  <th className="num">Scrap</th>
                  <th className="num">Total Owned</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaster.map((r) => (
                  <tr key={r.tool_id}>
                    <td className="id" style={{ fontWeight: 600 }}>{r.tool_id}</td>
                    <td>{r.name || "—"}</td>
                    <td className="muted">{r.type || "—"}</td>
                    <td>
                      <span className={"chip " + (r.avail > 0 ? "chip-avail" : r.inuse > 0 ? "chip-inuse" : r.wregr > 0 ? "chip-wregr" : "chip-scrap")}>
                        {r.status}
                      </span>
                    </td>
                    <td className="muted">{r.loc || "—"}</td>
                    <td className="num">
                      {r.avail === 0 ? <span className="chip chip-wscrap" style={{ fontSize: 10 }}>0 · No spare</span> : <b>{r.avail}</b>}
                    </td>
                    <td className="num">{r.inuse}</td>
                    <td className="num">{r.wregr}</td>
                    <td className="num">{r.atregr}</td>
                    <td className="num">{r.scrap}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{r.owned}</td>
                  </tr>
                ))}
                {filteredMaster.length === 0 && (
                  <tr>
                    <td colSpan={11} className="muted" style={{ textAlign: "center", padding: 32 }}>
                      No tools found in the master list. Inward new tools via the Inbox to build the master catalog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Issued Tools & Where Data */}
      {activeTab === "issued" && (
        <div className="panel">
          <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Tools Issued — Where They Are Placed, Who Took Them &amp; When</span>
            <span className="muted" style={{ fontSize: 12 }}>Showing {filteredIssued.length} active issue records</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tool ID</th>
                  <th>Tool Name</th>
                  <th className="num">In Use Qty</th>
                  <th>Issued To (Machine / Subcon)</th>
                  <th>Taken By (Person)</th>
                  <th>Issued By (Store)</th>
                  <th>Issue Timestamp</th>
                  <th>Expected Return</th>
                  <th className="num">Days Out</th>
                  <th>Alert Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssued.map((r, i) => (
                  <tr key={`${r.tool_id}-${i}`}>
                    <td className="id" style={{ fontWeight: 600 }}>{r.tool_id}</td>
                    <td>{r.name || "—"}</td>
                    <td className="num" style={{ fontWeight: 700, color: "var(--steel)" }}>{r.inuse_qty}</td>
                    <td style={{ fontWeight: 600 }}>
                      <span className="chip chip-inuse" style={{ fontSize: 12 }}>
                        {r.issued_to}
                      </span>
                    </td>
                    <td>{r.person || "—"}</td>
                    <td className="muted">{r.issued_by || "—"}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {r.issued_at ? new Date(r.issued_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{r.expected_return || "—"}</td>
                    <td className="num" style={{ fontWeight: 700, color: r.is_overdue ? "var(--danger)" : r.days_out >= 7 ? "var(--warn)" : "inherit" }}>
                      {r.days_out}d
                    </td>
                    <td>
                      {r.is_overdue ? (
                        <span className="chip chip-wscrap" style={{ fontWeight: 700 }}>OVERDUE (14+ d)</span>
                      ) : r.days_out >= 7 ? (
                        <span className="chip chip-wregr" style={{ fontWeight: 700 }}>DUE SOON</span>
                      ) : (
                        <span className="chip chip-avail">ACTIVE</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredIssued.length === 0 && (
                  <tr>
                    <td colSpan={10} className="muted" style={{ textAlign: "center", padding: 32 }}>
                      No tools currently issued to machines or subcontractors. All usable stock is in the store.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Movement Analytics */}
      {activeTab === "analytics" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <div className="panel">
            <div className="panel-head">Transactions by Type ({totalTransactions} total)</div>
            <div className="panel-pad">
              {typeBreakdown.map(([type, count]) => {
                const max = Math.max(1, ...typeBreakdown.map(([, c]) => c));
                return (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span className="chip chip-inuse" style={{ minWidth: 80, textAlign: "center" }}>{type}</span>
                    <div style={{ flex: 1, background: "var(--panel-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                      <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: "var(--steel)" }} />
                    </div>
                    <span className="muted" style={{ fontSize: 12, minWidth: 36, textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
              {typeBreakdown.length === 0 && <div className="muted">No transactions recorded yet.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">Top 10 Most-Issued Tools</div>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Tool ID</th>
                    <th className="num">Quantity Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {topIssued.map(([id, count]) => (
                    <tr key={id}>
                      <td className="id">{id}</td>
                      <td className="num">{count}</td>
                    </tr>
                  ))}
                  {topIssued.length === 0 && (
                    <tr>
                      <td colSpan={2} className="muted" style={{ textAlign: "center", padding: 20 }}>No issue events yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
