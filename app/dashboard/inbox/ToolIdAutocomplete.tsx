"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

export interface ToolMatch {
  tool_id: string;
  name: string | null;
  type: string | null;
  status: string;
}

const STATUS_CHIP: Record<string, string> = {
  "Available": "chip-avail", "In Use": "chip-inuse", "Waiting Regrind": "chip-wregr",
  "At Regrind": "chip-atregr", "Waiting Scrap": "chip-wscrap", "None/Scrapped": "chip-scrap",
};

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

export default function ToolIdAutocomplete({
  value, onChange, placeholder, allowNew = false, onResolved,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowNew?: boolean;
  onResolved?: (match: ToolMatch | null) => void;
}) {
  const [matches, setMatches] = useState<ToolMatch[]>([]);
  const [fuzzyMatches, setFuzzyMatches] = useState<ToolMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) { setMatches([]); setFuzzyMatches([]); setSearched(false); setLoading(false); return; }
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("tool_inventory")
        .select("tool_id,name,type,status")
        .ilike("tool_id", `%${q}%`)
        .order("tool_id", { ascending: true })
        .limit(30);
      const upperQ = q.toUpperCase();
      const ranked = ((data as ToolMatch[]) ?? []).sort((a, b) => {
        const aStarts = a.tool_id.toUpperCase().startsWith(upperQ) ? 0 : 1;
        const bStarts = b.tool_id.toUpperCase().startsWith(upperQ) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.tool_id.localeCompare(b.tool_id);
      }).slice(0, 8);
      setMatches(ranked);

      if (ranked.length === 0 && !allowNew) {
        const firstTwo = upperQ.slice(0, 2);
        const { data: broad } = await supabase
          .from("tool_inventory")
          .select("tool_id,name,type,status")
          .ilike("tool_id", `${firstTwo}%`)
          .limit(300);
        const scored = ((broad as ToolMatch[]) ?? [])
          .map((m) => ({ m, d: lev(upperQ, m.tool_id.toUpperCase()) }))
          .sort((a, b) => a.d - b.d)
          .filter((x) => x.d <= Math.max(4, Math.ceil(upperQ.length * 0.35)))
          .slice(0, 6)
          .map((x) => x.m);
        setFuzzyMatches(scored);
      } else {
        setFuzzyMatches([]);
      }

      setLoading(false);
      setSearched(true);
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, allowNew]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (boxRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function updateRect() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  const exactMatch = matches.some((m) => m.tool_id.toUpperCase() === value.trim().toUpperCase());

  useEffect(() => {
    const m = matches.find((x) => x.tool_id.toUpperCase() === value.trim().toUpperCase());
    onResolved?.(m ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, value]);

  const showNoMatch = !allowNew && searched && !loading && value.trim().length >= 2 && matches.length === 0 && fuzzyMatches.length === 0;
  const showDropdown = open && value.trim().length >= 2 && !exactMatch && (matches.length > 0 || fuzzyMatches.length > 0);
  const list = matches.length > 0 ? matches : fuzzyMatches;
  const isFuzzy = matches.length === 0 && fuzzyMatches.length > 0;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className="input"
        placeholder={placeholder ?? "e.g. SC 0680 035 01"}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={showNoMatch ? { borderColor: "var(--danger, #c0392b)" } : undefined}
      />
      {showNoMatch && (
        <div className="muted" style={{ fontSize: 11, color: "var(--danger, #c0392b)", marginTop: 2 }}>
          No ID found, even allowing for a spelling mistake — check the tool room, or Inward it first if it&apos;s new.
        </div>
      )}
      {showDropdown && rect && typeof document !== "undefined" && createPortal(
        <div ref={dropdownRef} className="panel" style={{
          position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 9999,
          maxHeight: 280, overflow: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.18)", background: "var(--panel)",
        }}>
          {isFuzzy && (
            <div className="muted" style={{ fontSize: 11, padding: "6px 10px", borderBottom: "1px solid var(--line)", background: "var(--panel-2)" }}>
              No exact match — closest real Tool IDs (check spelling):
            </div>
          )}
          {list.map((m) => (
            <div key={m.tool_id}
              onClick={() => { onChange(m.tool_id); setOpen(false); }}
              style={{
                padding: "8px 10px", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "space-between", gap: 8,
                borderBottom: "1px solid var(--line)", fontSize: 13,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div style={{ minWidth: 0 }}>
                <div className="id">{m.tool_id}</div>
                <div className="muted" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.name}
                </div>
              </div>
              <span className={"chip " + (STATUS_CHIP[m.status] ?? "chip-scrap")} style={{ flexShrink: 0 }}>
                {m.status}
              </span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}