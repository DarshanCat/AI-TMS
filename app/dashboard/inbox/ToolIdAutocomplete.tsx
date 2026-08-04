"use client";
import { useEffect, useRef, useState } from "react";
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

/**
 * Tool ID input with live suggestions against tool_inventory (~1,343 real
 * tools). Debounced so it doesn't hammer Supabase on every keystroke. When
 * the typed value doesn't match anything after the debounce settles, it
 * shows "No ID found" instead of silently failing — the whole point being
 * to stop store staff losing time on typos at issue/return.
 */
export default function ToolIdAutocomplete({
  value, onChange, placeholder, allowNew = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Suppress the "No ID found" warning — e.g. on the Inward form, where a
   *  brand-new Tool ID is the normal case, not a typo. */
  allowNew?: boolean;
}) {
  const [matches, setMatches] = useState<ToolMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) { setMatches([]); setSearched(false); setLoading(false); return; }
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("tool_inventory")
        .select("tool_id,name,type,status")
        .ilike("tool_id", `%${q}%`)
        .order("tool_id", { ascending: true })
        .limit(8);
      setMatches((data as ToolMatch[]) ?? []);
      setLoading(false);
      setSearched(true);
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const exactMatch = matches.some((m) => m.tool_id.toUpperCase() === value.trim().toUpperCase());
  const showNoMatch = !allowNew && searched && !loading && value.trim().length >= 2 && matches.length === 0;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        className="input"
        placeholder={placeholder ?? "e.g. SC 0680 035 01"}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={showNoMatch ? { borderColor: "var(--danger, #c0392b)" } : undefined}
      />
      {showNoMatch && (
        <div className="muted" style={{ fontSize: 11, color: "var(--danger, #c0392b)", marginTop: 2 }}>
          No ID found — check spelling, or Inward it first if it&apos;s new.
        </div>
      )}
      {open && value.trim().length >= 2 && !exactMatch && matches.length > 0 && (
        <div className="panel" style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
          marginTop: 2, maxHeight: 220, overflow: "auto", boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        }}>
          {matches.map((m) => (
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
                <div className="muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name}{m.type ? ` · ${m.type}` : ""}
                </div>
              </div>
              <span className={"chip " + (STATUS_CHIP[m.status] ?? "chip-scrap")} style={{ flexShrink: 0 }}>{m.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}