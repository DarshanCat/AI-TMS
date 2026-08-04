"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface DeskRow {
  tool_id: string; name: string | null; status: string; loc: string | null;
  avail: number; inuse: number; wregr: number; atregr: number; wscrap: number; scrap: number;
  life: number | null;
}
interface HistEvent { txn_type: string; ts: string; person: string | null; tofrom: string | null; machine: string | null; }

const CHIP: Record<string, string> = {
  "Available": "chip-avail", "In Use": "chip-inuse", "Waiting Regrind": "chip-wregr",
  "At Regrind": "chip-atregr", "Waiting Scrap": "chip-wscrap", "None/Scrapped": "chip-scrap",
};

// simple edit-distance for "did you mean" suggestions on a typo'd Tool ID
function lev(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

export default function ToolDeskSearch({ rows }: { rows: DeskRow[] }) {
  const [q, setQ] = useState("");
  const [hist, setHist] = useState<HistEvent[] | null>(null);
  const [loadingHist, setLoadingHist] = useState(false);

  const query = q.trim();
  const upper = query.toUpperCase();

  const exact = useMemo(() => rows.find((r) => r.tool_id.toUpperCase() === upper), [rows, upper]);
  const prefix = useMemo(
    () => (!exact && query ? rows.filter((r) => r.tool_id.toUpperCase().startsWith(upper)).slice(0, 8) : []),
    [rows, upper, exact, query],
  );
  const fuzzy = useMemo(() => {
    if (exact || prefix.length || query.length < 3) return [];
    return rows.map((r) => ({ r, d: lev(upper, r.tool_id.toUpperCase()) }))
      .sort((a, b) => a.d - b.d).slice(0, 6).filter((x) => x.d <= 5).map((x) => x.r);
  }, [rows, upper, exact, prefix, query]);

  async function loadHistory(toolId: string) {
    setLoadingHist(true); setHist(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("tool_ledger")
      .select("txn_type,ts,person,tofrom,machine")
      .eq("tool_id", toolId)
      .order("ts", { ascending: false })
      .limit(5);
    setHist((data as HistEvent[] | null) ?? []);
    setLoadingHist(false);
  }
  function pick(id: string) { setQ(id); loadHistory(id); }

  return (
    <div className="panel" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="panel-pad">
        <input className="input" autoFocus placeholder="Search any Tool ID — e.g. SC 0680 035 01"
          value={q} onChange={(e) => { setQ(e.target.value); setHist(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && exact) loadHistory(exact.tool_id); }} />
        <p className="muted" style={{ fontSize: 12, margin: "8px 2px 0" }}>
          Lookup only. To post a transaction, use the <b>Inbox</b>.
        </p>

        {exact && (
          <div className="panel" style={{ marginTop: 16, borderColor: "var(--steel)" }}>
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="id">{exact.tool_id}</span>
              <span className={"chip " + (CHIP[exact.status] ?? "chip-scrap")}>{exact.status}</span>
            </div>
            <div className="panel-pad">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{exact.name}</div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
                <span>Avail <b>{exact.avail}</b></span>
                <span>In use <b>{exact.inuse}</b></span>
                <span>W-Regr <b>{exact.wregr}</b></span>
                <span>At vendor <b>{exact.atregr}</b></span>
                <span>Scrap <b>{exact.scrap}</b></span>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
                <span>Location <b className="id" style={{ fontSize: 12 }}>{exact.loc || "—"}</b></span>
                <span>Life <b>{exact.life ?? "—"}</b></span>
              </div>

              {!hist && !loadingHist && (
                <button className="btn-ghost" style={{ border: "1px solid var(--line)", cursor: "pointer", fontSize: 12 }}
                  onClick={() => loadHistory(exact.tool_id)}>Show recent history</button>
              )}
              {loadingHist && <div className="muted" style={{ fontSize: 12 }}>Loading…</div>}
              {hist && (
                <div style={{ fontSize: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  {hist.length === 0 && <div className="muted">No transactions recorded yet.</div>}
                  {hist.map((h, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <span className={"chip " + (CHIP[h.txn_type] ?? "chip-scrap")} style={{ marginRight: 6 }}>{h.txn_type}</span>
                      {new Date(h.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {h.person ? ` · ${h.person}` : ""}{h.machine ? ` · ${h.machine}` : ""}{h.tofrom ? ` · ${h.tofrom}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!exact && query && (prefix.length > 0 || fuzzy.length > 0) && (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">{prefix.length ? "Matches" : `No exact match for "${query}"`}</div>
            <div className="panel-pad">
              {(prefix.length ? prefix : fuzzy).map((r) => (
                <button key={r.tool_id} onClick={() => pick(r.tool_id)}
                  style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "7px 4px",
                           background: "none", border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer", textAlign: "left" }}>
                  <span className="id">{r.tool_id}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!exact && query && !prefix.length && !fuzzy.length && (
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            No match. If the ID doesn&apos;t exist yet, add it via <b>Inbox → Inward</b> (new tool).
          </p>
        )}
      </div>
    </div>
  );
}