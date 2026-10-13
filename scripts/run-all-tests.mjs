/**
 * Comprehensive test suite for AI-TMS business logic & transaction engine.
 * Tests all 10 critical requirements specified in the prompt.
 */
import { runEngine, genToolId, toolIdBase } from "../lib/engine.ts";
import { forecastAll, DEFAULT_CONFIG } from "../lib/forecast.ts";

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

console.log("=== RUNNING ENGINE & TRANSACTION TESTS ===\n");

// Test 1: Available = 10, Issue = 3 -> Available = 7, In Use = 3
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "Available",
    loc: "Store", avail: 10, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "ISSUE", qty: 3 }, tool);
  assert(res.ok === true, "Test 1.1: Issue 3 allowed");
  assert(res.delta?.avail === -3 && res.delta?.inuse === 3, "Test 1.2: Delta reduces Avail by 3, raises InUse by 3");
  const newAvail = tool.avail + res.delta.avail;
  const newInUse = tool.inuse + res.delta.inuse;
  assert(newAvail === 7 && newInUse === 3, `Test 1.3: Expected Avail=7, InUse=3; Got Avail=${newAvail}, InUse=${newInUse}`);
}

// Test 2: Available = 10, Issue = 15 -> REJECT
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "Available",
    loc: "Store", avail: 10, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "ISSUE", qty: 15 }, tool);
  assert(res.ok === false, "Test 2.1: Issue 15 of 10 is REJECTED");
  assert(res.errors.some(e => e.includes("Only 10 available")), "Test 2.2: Correct error message for insufficient stock");
}

// Test 3: In Use = 10, Return = 4 -> In Use = 6, Available = 4
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "In Use",
    loc: "Machine", avail: 0, inuse: 10, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "RECEIVE", qty: 4 }, tool);
  assert(res.ok === true, "Test 3.1: Return 4 allowed");
  assert(res.delta?.inuse === -4 && res.delta?.avail === 4, "Test 3.2: Delta reduces InUse by 4, raises Avail by 4");
  const newAvail = tool.avail + res.delta.avail;
  const newInUse = tool.inuse + res.delta.inuse;
  assert(newInUse === 6 && newAvail === 4, `Test 3.3: Expected InUse=6, Avail=4; Got InUse=${newInUse}, Avail=${newAvail}`);
}

// Test 4: In Use = 10, Chipoff = 4, Broken = false -> In Use = 6, Waiting Regrind = 4, Permanent consumption = 0
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "In Use",
    loc: "Machine", avail: 0, inuse: 10, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "CHIPOFF", qty: 4, condition: "Chip-off" }, tool);
  assert(res.ok === true, "Test 4.1: Normal chipoff allowed");
  assert(res.delta?.inuse === -4 && res.delta?.wregr === 4 && res.delta?.wscrap === 0, "Test 4.2: Normal chipoff moves to wregr, wscrap=0");
  const newInUse = tool.inuse + res.delta.inuse;
  const newWregr = tool.wregr + res.delta.wregr;
  assert(newInUse === 6 && newWregr === 4, `Test 4.3: Expected InUse=6, Wregr=4; Got InUse=${newInUse}, Wregr=${newWregr}`);
}

// Test 5: In Use = 10, Chipoff = 4, Broken = true -> In Use = 6, Permanent depletion = 4 (Waiting Scrap = 4)
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "In Use",
    loc: "Machine", avail: 0, inuse: 10, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "CHIPOFF", qty: 4, condition: "Broken" }, tool);
  assert(res.ok === true, "Test 5.1: Broken chipoff allowed");
  assert(res.delta?.inuse === -4 && res.delta?.wscrap === 4 && res.delta?.wregr === 0, "Test 5.2: Broken chipoff moves to wscrap (permanent depletion), wregr=0");
  const newInUse = tool.inuse + res.delta.inuse;
  const newWscrap = tool.wscrap + res.delta.wscrap;
  assert(newInUse === 6 && newWscrap === 4, `Test 5.3: Expected InUse=6, Wscrap=4; Got InUse=${newInUse}, Wscrap=${newWscrap}`);
}

// Test 6: Waiting Regrind = 10, Scrap = 3 -> Waiting Regrind = 7, Scrap = 3
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "Waiting Regrind",
    loc: "Store", avail: 0, inuse: 0, wregr: 10, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "SCRAP", qty: 3 }, tool);
  assert(res.ok === true, "Test 6.1: Scrap from Waiting Regrind allowed");
  assert(res.delta?.wregr === -3 && res.delta?.scrap === 3, "Test 6.2: Delta reduces wregr by 3, raises scrap by 3");
  const newWregr = tool.wregr + res.delta.wregr;
  const newScrap = tool.scrap + res.delta.scrap;
  assert(newWregr === 7 && newScrap === 3, `Test 6.3: Expected Wregr=7, Scrap=3; Got Wregr=${newWregr}, Scrap=${newScrap}`);
}

// Test 7: Quantity = 0 -> REJECT
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "Available",
    loc: "Store", avail: 10, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "ISSUE", qty: 0 }, tool);
  assert(res.ok === false, "Test 7.1: Quantity=0 is REJECTED");
}

// Test 8: Quantity = -5 -> REJECT
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "Available",
    loc: "Store", avail: 10, inuse: 0, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 10, life: null,
  };
  const res = runEngine({ id: tool.tool_id, type: "ISSUE", qty: -5 }, tool);
  assert(res.ok === false, "Test 8.1: Quantity=-5 is REJECTED");
}

// Test 9: Tool ID does not exist -> REJECT
{
  const res = runEngine({ id: "NON_EXISTENT_TOOL", type: "ISSUE", qty: 1 }, null);
  assert(res.ok === false, "Test 9.1: Non-existent tool for ISSUE is REJECTED");
  assert(res.errors.some(e => e.includes("not found in master")), "Test 9.2: Correct error message for missing tool");
}

// Test 10: Regrind workflow (Dispatch: wregr -> atregr, Receipt: atregr -> avail)
{
  const tool = {
    tool_id: "SC 0680 035 01", name: "Test Drill", type: "Solid Carbide", status: "Waiting Regrind",
    loc: "Store", avail: 0, inuse: 0, wregr: 5, atregr: 0, wscrap: 0, scrap: 0, owned: 5, life: null,
  };
  const disp = runEngine({ id: tool.tool_id, type: "DISPATCH", qty: 3 }, tool);
  assert(disp.ok === true, "Test 10.1: Dispatch from wregr allowed");
  assert(disp.delta?.wregr === -3 && disp.delta?.atregr === 3, "Test 10.2: Dispatch moves wregr -> atregr");

  const atVendorTool = { ...tool, wregr: 2, atregr: 3 };
  const rcpt = runEngine({ id: tool.tool_id, type: "RECEIPT", qty: 3 }, atVendorTool);
  assert(rcpt.ok === true, "Test 10.3: Receipt from atregr allowed");
  assert(rcpt.delta?.atregr === -3 && rcpt.delta?.avail === 3, "Test 10.4: Receipt moves atregr -> avail");
}

console.log("\n=== RUNNING FORECASTING TESTS ===\n");

// Test 11: Forecasting distinguishes Normal Chipoff vs Broken Chipoff
{
  const stock = [{ tool_id: "TEST_TOOL_1", name: "Test Drill", avail: 5, status: "Available" }];
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  // Scenario A: Only normal chipoff events -> no permanent consumption
  const normalEvents = [
    { tool_id: "TEST_TOOL_1", txn_type: "CHIPOFF", qty: 2, ts: daysAgo(20), condition: "Chip-off" },
    { tool_id: "TEST_TOOL_1", txn_type: "CHIPOFF", qty: 1, ts: daysAgo(10), condition: "Chip-off" },
  ];
  const fcNormal = forecastAll(stock, normalEvents, { ...DEFAULT_CONFIG, minWindowDays: 1 });
  assert(fcNormal[0].perDay === 0, "Test 11.1: Normal chipoff does NOT count as permanent consumption rate");
  assert(fcNormal[0].urgency === "ok", "Test 11.2: Normal chipoff maintains healthy status without depletion");

  // Scenario B: Broken chipoff events -> permanent depletion
  const brokenEvents = [
    { tool_id: "TEST_TOOL_1", txn_type: "CHIPOFF", qty: 2, ts: daysAgo(20), condition: "Broken" },
    { tool_id: "TEST_TOOL_1", txn_type: "CHIPOFF", qty: 2, ts: daysAgo(10), condition: "Broken" },
  ];
  const fcBroken = forecastAll(stock, brokenEvents, { ...DEFAULT_CONFIG, minWindowDays: 1 });
  assert(fcBroken[0].perDay > 0, "Test 11.3: Broken chipoff correctly calculates consumption rate");
  assert(fcBroken[0].daysCover !== null, "Test 11.4: Broken chipoff projects days cover");
}

// Test 12: Tool ID Generation
{
  const base = toolIdBase("SC", 6.8, 35);
  assert(base === "SC 0680 035", `Test 12.1: Dimensioned toolIdBase: expected "SC 0680 035", got "${base}"`);

  const nextId = genToolId(["SC 0680 035 01", "SC 0680 035 02"], "SC", 6.8, 35);
  assert(nextId === "SC 0680 035 03", `Test 12.2: genToolId sequence increment: expected "SC 0680 035 03", got "${nextId}"`);
}

console.log("\n=== RUNNING ZERO-SPARE INTELLIGENCE TESTS ===\n");

// Test 13: Tool with 1 qty broken -> triggers NO SPARE critical alert
{
  const tool = {
    tool_id: "SC 0880 230 01", name: "DIA 8.8 DRILL", type: "Solid Carbide", status: "In Use",
    loc: "HMC", avail: 0, inuse: 1, wregr: 0, atregr: 0, wscrap: 0, scrap: 0, owned: 1, life: 50,
  };
  const res = runEngine({ id: tool.tool_id, type: "CHIPOFF", qty: 1, condition: "Broken" }, tool);
  assert(res.ok === true, "Test 13.1: Broken chipoff allowed");
  assert(res.warnings.some(w => w.includes("NO SPARE")), "Test 13.2: Engine emits NO SPARE critical alert");
}

console.log(`\n========================================`);
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
