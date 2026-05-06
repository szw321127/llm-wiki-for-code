import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { generateStatusReport } from "../scripts/status-report.mjs";

const fixtureRoot = path.resolve("tests", "fixtures", "sample-project");

test("generateStatusReport summarizes stable/incubating counts and recent sessions", async () => {
  const report = await generateStatusReport(fixtureRoot);

  assert.equal(report.projectTitle, "示例项目");
  assert.equal(report.stableNodes, 5);
  assert.equal(report.incubatingNodes, 1);
  assert.equal(report.graphDirty, false);
  assert.equal(report.recentSessions.length, 1);
  assert.equal(report.recentSessions[0].id, "session-2026-04-23-sample");
  assert.ok(report.recommendedOptions.includes("option-unified-client"));
});
