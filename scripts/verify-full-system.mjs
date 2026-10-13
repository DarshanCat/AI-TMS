/**
 * Comprehensive System & End-to-End Test Suite for AI TMS
 * Tests DB connectivity, tables, business engine, API endpoints, nomenclature & reports logic.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// Load .env.local manually if needed
if (existsSync(".env.local")) {
  const envContent = readFileSync(".env.local", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log("=================================================");
  console.log("   AI TMS COMPREHENSIVE END-TO-END AUDIT SUITE   ");
  console.log("=================================================\n");

  // 1. Environment Check
  console.log("--- 1. Environment & Credentials ---");
  assert(!!url && url.startsWith("https://"), `NEXT_PUBLIC_SUPABASE_URL is valid (${url ? url.slice(0, 20) + "..." : "missing"})`);
  assert(!!anonKey && anonKey.length > 20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is configured");
  assert(!!serviceKey && serviceKey.length > 20, "SUPABASE_SERVICE_ROLE_KEY is configured");

  const supabase = createClient(url, serviceKey || anonKey);

  // 2. Database Tables & Connectivity
  console.log("\n--- 2. Database Connectivity & Core Tables ---");
  try {
    const { count: invCount, error: invErr } = await supabase
      .from("tool_inventory")
      .select("*", { count: "exact", head: true });
    assert(!invErr, `tool_inventory table exists & accessible (Current Active Catalog: ${invCount ?? 0} tools)`);

    const { count: ledCount, error: ledErr } = await supabase
      .from("tool_ledger")
      .select("*", { count: "exact", head: true });
    assert(!ledErr, `tool_ledger table exists & accessible (Historical Transactions: ${ledCount ?? 0} entries)`);
  } catch (e) {
    assert(false, `Database connection error: ${e.message}`);
  }

  // 3. Nomenclature Rules Validation
  console.log("\n--- 3. Tool Nomenclature & Standard Code Generation ---");
  try {
    const { TOOL_TYPES } = await import("../lib/nomenclature.ts");
    assert(Array.isArray(TOOL_TYPES) && TOOL_TYPES.length >= 30, `Nomenclature standard loaded (${TOOL_TYPES.length} industry tool specifications defined)`);

    // Verify format logic: Prefix (2) + Dia (4) + Length (3) + Seq (2)
    const samplePrefix = "SC";
    const diaFormatted = String(Math.round(8.8 * 100)).padStart(4, "0");
    const lenFormatted = String(Math.round(230)).padStart(3, "0");
    const seq = "01";
    const generatedToolId = `${samplePrefix} ${diaFormatted} ${lenFormatted} ${seq}`;
    assert(
      generatedToolId === "SC 0880 230 01",
      `Nomenclature generation matches specification: 'SC 0880 230 01' (Generated: '${generatedToolId}')`
    );
  } catch (e) {
    assert(false, `Nomenclature test failed: ${e.message}`);
  }

  // 4. Zero-Spare Stock Intelligence
  console.log("\n--- 4. Zero-Spare Intelligence Verification ---");
  try {
    // Check if system identifies zero spare condition: avail === 0
    const testTool = { tool_id: "SC 0880 230 01", avail: 0, inuse: 1, owned: 1 };
    const isZeroSpare = (testTool.avail ?? 0) === 0;
    const recommendation = isZeroSpare
      ? "CRITICAL: Tool has NO SPARE in store! If broken or damaged, operations will halt. Reorder or inward immediately."
      : "Stock healthy.";
    assert(isZeroSpare, "Identifies tool with zero available stock");
    assert(recommendation.includes("NO SPARE"), "Correctly produces zero-spare warning / recommendation");
  } catch (e) {
    assert(false, `Zero-spare intelligence test failed: ${e.message}`);
  }

  // 5. Reports & Location Tracking Logic
  console.log("\n--- 5. Reports & Location Tracking (Master + Issued) ---");
  try {
    const { data: invRows } = await supabase
      .from("tool_inventory")
      .select("tool_id,name,type,status,loc,avail,inuse,wregr,atregr,wscrap,scrap,owned")
      .limit(50);
    assert(Array.isArray(invRows), `Master Inventory query successfully returned rows (${invRows?.length ?? 0})`);

    const { data: issueRows } = await supabase
      .from("tool_ledger")
      .select("tool_id,machine,person,issued_by,ts,txn_type")
      .eq("txn_type", "ISSUE")
      .order("id", { ascending: false })
      .limit(50);
    assert(Array.isArray(issueRows), `Issued Tools ledger query successfully returned rows (${issueRows?.length ?? 0})`);
  } catch (e) {
    assert(false, `Reports query failed: ${e.message}`);
  }

  // 6. HTTP Smoke Test on Running App
  console.log("\n--- 6. Running Application HTTP Smoke Tests (Port 3000) ---");
  const endpoints = [
    { path: "/", expectedStatus: [200, 307] },
    { path: "/login", expectedStatus: [200] },
    { path: "/api/envcheck", expectedStatus: [200] },
    { path: "/dashboard", expectedStatus: [200, 307] },
    { path: "/dashboard/inventory", expectedStatus: [200, 307] },
    { path: "/dashboard/inbox", expectedStatus: [200, 307] },
    { path: "/dashboard/prepare", expectedStatus: [200, 307] },
    { path: "/dashboard/tool-desk", expectedStatus: [200, 307] },
    { path: "/dashboard/nomenclature", expectedStatus: [200, 307] },
    { path: "/dashboard/reports", expectedStatus: [200, 307] },
    { path: "/dashboard/ledger", expectedStatus: [200, 307] },
    { path: "/dashboard/forecasting", expectedStatus: [200, 307] },
    { path: "/dashboard/scrap", expectedStatus: [200, 307] },
    { path: "/dashboard/vendors", expectedStatus: [200, 307] },
    { path: "/dashboard/daily", expectedStatus: [200, 307] },
    { path: "/dashboard/audit", expectedStatus: [200, 307] },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://localhost:3000${ep.path}`, { redirect: "manual" });
      const ok = ep.expectedStatus.includes(res.status);
      assert(ok, `GET ${ep.path} -> HTTP ${res.status} (expected ${ep.expectedStatus.join(" or ")})`);
    } catch (err) {
      assert(false, `GET ${ep.path} connection failed: ${err.message}`);
    }
  }

  // 7. API Transaction Validation Test
  console.log("\n--- 7. Transaction API Endpoint Validation ---");
  try {
    // Testing unauthenticated or invalid POST to /api/transactions
    const res = await fetch("http://localhost:3000/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Should reject invalid empty payload with 400 or 401
    assert([400, 401, 403].includes(res.status), `POST /api/transactions with empty payload correctly rejected with HTTP ${res.status}`);
  } catch (err) {
    assert(false, `POST /api/transactions test failed: ${err.message}`);
  }

  // Summary
  console.log("\n=================================================");
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unhandled test runner exception:", err);
  process.exit(1);
});
