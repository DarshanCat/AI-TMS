// Pure, explainable inventory forecasting from ledger events.
// No LLM, no hidden model — every number here is auditable.

export interface LedgerEvent {
  tool_id: string;
  txn_type: string;
  qty: number;
  ts: string;
  condition?: string | null;
}

export interface StockRow {
  tool_id: string;
  name: string | null;
  avail: number;
  status: string;
}

export interface Forecast {
  tool_id: string;
  name: string | null;
  avail: number;
  perDay: number;          // consumption rate, pieces/day
  daysCover: number | null; // days until stock-out (null if no consumption)
  stockOut: string | null;  // ISO date of projected stock-out
  reorderQty: number;       // recommended order (0 = none needed)
  urgency: "ok" | "soon" | "now";
  reason: string;
}

// Consumption = pieces that permanently leave available stock.
// ISSUE moves avail->inuse (temporary, comes back), so it is NOT consumption.
// True depletion = broken tools (CHIPOFF/Broken) + SCRAP.
// (If you'd rather treat every ISSUE as demand, flip COUNT_ISSUE to true.)
const COUNT_ISSUE = false;

function isConsumption(e: LedgerEvent): boolean {
  if (e.txn_type === "SCRAP") return true;
  if (COUNT_ISSUE && e.txn_type === "ISSUE") return true;
  return false;
}

export interface ForecastConfig {
  leadTimeDays: number;   // how long a reorder takes to arrive
  safetyDays: number;     // buffer you want on top of lead time
  minWindowDays: number;  // ignore rates computed from too-short a history
}

export const DEFAULT_CONFIG: ForecastConfig = {
  leadTimeDays: 14,
  safetyDays: 7,
  minWindowDays: 14,
};

export function forecastAll(
  stock: StockRow[],
  events: LedgerEvent[],
  cfg: ForecastConfig = DEFAULT_CONFIG,
): Forecast[] {
  // group consumption events per tool
  const byTool = new Map<string, LedgerEvent[]>();
  for (const e of events) {
    if (!isConsumption(e)) continue;
    if (!byTool.has(e.tool_id)) byTool.set(e.tool_id, []);
    byTool.get(e.tool_id)!.push(e);
  }

  const now = Date.now();
  const out: Forecast[] = [];

  for (const s of stock) {
    const evts = (byTool.get(s.tool_id) ?? []).sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
    let perDay = 0;
    let reason = "No depletion recorded yet — rate unknown.";

    if (evts.length >= 1) {
      const first = +new Date(evts[0].ts);
      const windowDays = Math.max((now - first) / 86400000, 1);
      const totalQty = evts.reduce((a, e) => a + Math.abs(e.qty), 0);

      if (windowDays >= cfg.minWindowDays) {
        perDay = totalQty / windowDays;
        reason = `${totalQty} pcs depleted over ${Math.round(windowDays)} days.`;
      } else {
        // too little history to trust a rate — flag but don't fabricate
        perDay = 0;
        reason = `Only ${Math.round(windowDays)} days of history — need ${cfg.minWindowDays}+ to project.`;
      }
    }

    const daysCover = perDay > 0 ? s.avail / perDay : null;
    const stockOut = daysCover != null
      ? new Date(now + daysCover * 86400000).toISOString().slice(0, 10)
      : null;

    // reorder if stock-out falls within lead time + safety buffer
    const threshold = cfg.leadTimeDays + cfg.safetyDays;
    let reorderQty = 0;
    let urgency: Forecast["urgency"] = "ok";

    if (daysCover != null && daysCover <= threshold) {
      // order enough to cover lead time + safety at current rate, minus what's on hand
      const target = Math.ceil(perDay * threshold);
      reorderQty = Math.max(target - s.avail, 1);
      urgency = daysCover <= cfg.leadTimeDays ? "now" : "soon";
      reason = `~${perDay.toFixed(2)} pcs/day; ${Math.round(daysCover)} days cover vs ${threshold}-day lead+safety.`;
    } else if (daysCover != null) {
      reason = `~${perDay.toFixed(2)} pcs/day; ${Math.round(daysCover)} days cover — healthy.`;
    }

    out.push({
      tool_id: s.tool_id, name: s.name, avail: s.avail,
      perDay, daysCover, stockOut, reorderQty, urgency, reason,
    });
  }

  // most urgent first: reorder-now, then soonest stock-out
  return out.sort((a, b) => {
    const rank = { now: 0, soon: 1, ok: 2 };
    if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
    return (a.daysCover ?? 1e9) - (b.daysCover ?? 1e9);
  });
}