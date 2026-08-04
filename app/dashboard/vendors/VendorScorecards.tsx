export interface Scorecard {
  vendor: string;
  cycles: number;
  avgTurnaroundDays: number | null;
  totalCost: number;
  successRate: number; // 0..1
}

function rateChip(rate: number): string {
  if (rate >= 0.9) return "chip-avail";
  if (rate >= 0.75) return "chip-wregr";
  return "chip-wscrap";
}

export default function VendorScorecards({ rows, live }: { rows: Scorecard[]; live: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="panel-pad muted" style={{ textAlign: "center", padding: 24 }}>
        No completed regrind cycles yet — a scorecard appears once a dispatched tool comes back via Regrind Receipt.
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Vendor</th>
            <th className="right">Cycles</th>
            <th className="right">Avg turnaround</th>
            <th className="right">Total cost</th>
            <th className="right">Success rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.vendor}>
              <td>{r.vendor}{!live && <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>(sample)</span>}</td>
              <td className="num">{r.cycles}</td>
              <td className="num">{r.avgTurnaroundDays !== null ? `${r.avgTurnaroundDays.toFixed(1)}d` : "—"}</td>
              <td className="num">₹{r.totalCost.toLocaleString()}</td>
              <td className="right">
                <span className={"chip " + rateChip(r.successRate)}>{Math.round(r.successRate * 100)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}