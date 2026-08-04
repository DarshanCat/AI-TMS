import { createClient } from "@/lib/supabase/server";
import ToolDeskSearch, { type DeskRow } from "./ToolDeskSearch";

export default async function ToolDeskPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tool_inventory")
    .select("tool_id,name,status,loc,avail,inuse,wregr,atregr,wscrap,scrap,life")
    .order("tool_id")
    .limit(3000);

  const rows = (data as DeskRow[] | null) ?? [];

  return (
    <div>
      <h1 className="page-title">Tool Desk</h1>
      <p className="page-sub">Look up any tool by ID — current state and recent history. To post a transaction, use the Inbox.</p>
      {rows.length === 0 ? (
        <div className="panel panel-pad muted" style={{ fontSize: 13, maxWidth: 720, margin: "0 auto" }}>
          No tools loaded yet — seed your tool master first, then come back here.
        </div>
      ) : (
        <ToolDeskSearch rows={rows} />
      )}
    </div>
  );
}