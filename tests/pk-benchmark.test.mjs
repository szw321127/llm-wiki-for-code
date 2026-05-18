import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { runBenchmark } from "../scripts/benchmark-preflight.mjs";

const execFileAsync = promisify(execFile);
const fixtureProjectRoot = path.resolve("tests", "fixtures", "sample-project");
const benchmarkFixturePath = path.resolve("tests", "fixtures", "pk-benchmark", "preflight-samples.json");

test("runBenchmark scores preflight retrieval against labeled task samples", async () => {
  const report = await runBenchmark(fixtureProjectRoot, benchmarkFixturePath, {
    k: 3
  });

  assert.equal(report.mode, "benchmark");
  assert.equal(report.sampleCount, 4);
  assert.equal(report.k, 3);
  assert.equal(report.summary.pass, true);
  assert.equal(report.summary.recallAtK, 1);
  assert.ok(report.summary.precisionAtK > 0.6);
  assert.equal(report.summary.falsePositiveRate, 0);
  assert.equal(report.samples[0].hitExpected, true);
  assert.deepEqual(report.samples[0].matchedNodeIds.slice(0, 3), [
    "practice-http-client",
    "option-unified-client",
    "option-direct-call"
  ]);
  assert.equal(report.samples[3].expectedNoMatches, true);
  assert.equal(report.samples[3].falsePositive, false);
  assert.deepEqual(report.samples[3].matchedNodeIds, []);
});

test("benchmark CLI prints JSON metrics", async () => {
  const { stdout } = await execFileAsync("node", [
    "scripts/benchmark-preflight.mjs",
    fixtureProjectRoot,
    benchmarkFixturePath,
    "--k",
    "3"
  ]);

  const report = JSON.parse(stdout);

  assert.equal(report.mode, "benchmark");
  assert.equal(report.sampleCount, 4);
  assert.equal(report.summary.pass, true);
  assert.ok(Array.isArray(report.samples));
});
