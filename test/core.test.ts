import assert from "node:assert/strict";
import test from "node:test";
import { completionAttributes, parseHeaders, resolveLogsEndpoint } from "../src/core.ts";

test("resolves standard OTLP log endpoints without duplication", () => {
  assert.equal(
    resolveLogsEndpoint("https://collector.example"),
    "https://collector.example/v1/logs",
  );
  assert.equal(
    resolveLogsEndpoint("https://collector.example/v1/logs"),
    "https://collector.example/v1/logs",
  );
  assert.equal(
    resolveLogsEndpoint("https://ignored.example", "https://logs.example/custom"),
    "https://logs.example/custom",
  );
});

test("maps OMP usage to Codex response.completed token fields", () => {
  assert.deepEqual(
    completionAttributes({
      input: 100,
      output: 40,
      cacheRead: 20,
      cacheWrite: 10,
      reasoningTokens: 30,
      totalTokens: 170,
    }),
    {
      input_token_count: 130,
      output_token_count: 40,
      cached_token_count: 20,
      cache_write_token_count: 10,
      reasoning_token_count: 30,
      tool_token_count: 170,
    },
  );
});

test("uses computed total tokens when OMP omits totalTokens", () => {
  assert.equal(completionAttributes({ input: 2, output: 3, cacheRead: 5 }).tool_token_count, 10);
});

test("parses and decodes OTLP headers without truncating equals", () => {
  assert.deepEqual(parseHeaders("X-Trace=one%3Dtwo,X-Tenant=codex"), {
    "X-Trace": "one=two",
    "X-Tenant": "codex",
  });
});
