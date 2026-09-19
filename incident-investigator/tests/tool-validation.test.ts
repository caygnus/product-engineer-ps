import assert from "node:assert/strict";
import test from "node:test";

import { ToolRegistry } from "@/tools/registry";
import { searchLogsTool } from "@/tools/search-logs";

test("rejects duplicate tool registration", () => {
  const registry = new ToolRegistry();

  registry.register(searchLogsTool);

  assert.throws(
    () => registry.register(searchLogsTool),
    /Tool already registered/,
  );
});

test("rejects unknown tool lookup", () => {
  const registry = new ToolRegistry();

  assert.throws(
    () => registry.get("does_not_exist"),
    /Unknown tool/,
  );
});

test("validates tool input schema", () => {
  const result = searchLogsTool.inputSchema.safeParse({
    service: "checkout",
    query: "database connection timeout",
    timeRange: "10:00-11:00",
  });

  assert.equal(result.success, true);
});

test("rejects malformed tool input", () => {
  const result = searchLogsTool.inputSchema.safeParse({
    service: "checkout",
  });

  assert.equal(result.success, false);
});