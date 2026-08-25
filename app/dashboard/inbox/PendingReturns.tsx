"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PendingTool {
  tool_id: string;
  name: string | null;
  machine: string | null;
  person: string | null;
  issued_by: string | null;
  ts: string | null;
  inuse: number;
}

export default function PendingReturns({
  onAdd,
  refreshKey,
}: {
  onAdd: (toolId: string, machine: string, person: string, qty: number) => void;
  refreshKey: number;
}) {
  const [tools, setTools] = useState<PendingTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchPending() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: inv } = await supabase
          .from("tool_inventory")
          .select("tool_id,name,inuse,loc")
          .gt("inuse", 0)
          .order("tool_id", { ascending: true })
          .limit(500);

        if (!inv || inv.length === 0) {
          if (mounted) {
            setTools([]);
            setLoading(false);
          }
          return;
        }

        const ids = inv.map((t) => t.tool_id);
        const { data: ledger } = await supabase
          .from("tool_ledger")
          .select("tool_id,machine,person,issued_by,ts")
          .in("tool_id", ids)
          .eq("txn_type", "ISSUE")
          .order("ts", { ascending: false });

        const latestIssue = new Map<string, { machine: string | null; person: string | null; issued_by: string | null; ts: string | null }>();
        for (const row of ledger ?? []) {
          if (!latestIssue.has(row.tool_id)) {
            latestIssue.set(row.tool_id, {
              machine: row.machine,
              person: row.person,
              issued_by: row.issued_by,
              ts: row.ts,
            });
          }
        }

        const result: PendingTool[] = inv.map((t) => {
          const issue = latestIssue.get(t.tool_id);
          return {
            tool_id: t.tool_id,
            name: t.name,
            machine: issue?.machine ?? t.loc ?? null,
            person: issue?.person ?? null,
            issued_by: issue?.issued_by ?? null,
            ts: issue?.ts ?? null,
            inuse: t.inuse,
          };
        });

        if (mounted) setTools(result);
      } catch (err) {
        console.error("Failed to load pending returns:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPending();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  if (loading && tools.length === 0) {
    return (
      <div className="panel panel-pad" style={{ marginBottom: 16, fontSize: 12 }}>
        <span className="muted">Loading tools currently in use...</span>
      </div>
    );
  }

  if (tools.length === 0) {
    return null;
  }

  const filtered = tools.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.tool_id.toLowerCase().includes(q) ||
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.machine && t.machine.toLowerCase().includes(q)) ||
      (t.person && t.person.toLowerCase().includes(q))
    );
  });

  const displayList = expanded ? filtered : filtered.slice(0, 5);

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          Tools Currently In Use <span className="chip chip-warn" style={{ marginLeft: 6 }}>{tools.length}</span>
        </span>
        <button
          type="button"
          className="btn-ghost"
          style={{ fontSize: 11, padding: "3px 8px" }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `View all (${tools.length})`}
        </button>
      </div>
      <div className="panel-pad">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            style={{ fontSize: 12, padding: "4px 8px" }}
            placeholder="Search issued tools by ID, name, machine, or operator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Tool ID</th>
                <th>Name</th>
                <th>Machine / Location</th>
                <th>Operator</th>
                <th>Issued Date</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 12 }}>
                    No matching tools currently issued.
                  </td>
                </tr>
              ) : (
                displayList.map((t) => {
                  const dateStr = t.ts ? new Date(t.ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
                  return (
                    <tr key={t.tool_id}>
                      <td className="id" style={{ fontWeight: 600 }}>{t.tool_id}</td>
                      <td className="muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.name ?? "—"}
                      </td>
                      <td>{t.machine ?? "—"}</td>
                      <td>{t.person ?? "—"}</td>
                      <td className="muted">{dateStr}</td>
                      <td className="right">
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: 11, padding: "3px 8px" }}
                          onClick={() => onAdd(t.tool_id, t.machine ?? "", t.person ?? "", 1)}
                        >
                          + Return
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!expanded && filtered.length > 5 && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setExpanded(true)}
            >
              + {filtered.length - 5} more tools (click to expand)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}