#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPreflight } from "./preflight-session.mjs";

const currentFilePath = fileURLToPath(import.meta.url);

export async function runBenchmark(projectRoot, benchmarkFilePath, options = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot || process.cwd());
  const resolvedBenchmarkPath = path.resolve(benchmarkFilePath || "");
  const benchmark = await readBenchmarkFile(resolvedBenchmarkPath);
  const k = Number(options.k || benchmark.k || 3);
  const samples = [];

  for (const sample of benchmark.samples || []) {
    const result = await runPreflight(resolvedProjectRoot, sample.task || "", {
      recordHits: false,
      limits: {
        maxMatchedPractices: Math.max(k, 5),
        maxRecommendedOptions: Math.max(k, 5)
      }
    });
    samples.push(scoreSample(sample, result, k));
  }

  const summary = summarizeScores(samples, benchmark.thresholds || {});

  return {
    mode: "benchmark",
    projectRoot: resolvedProjectRoot,
    benchmarkFile: resolvedBenchmarkPath,
    k,
    sampleCount: samples.length,
    summary,
    samples
  };
}

function scoreSample(sample, preflightResult, k) {
  const matchedNodeIds = collectMatchedNodeIds(preflightResult).slice(0, k);
  const expectedNoMatches = sample.expectedNoMatches === true;
  const expectedNodeIds = dedupeValues(sample.expectedNodeIds || []);
  const relevantNodeIds = new Set([
    ...expectedNodeIds,
    ...dedupeValues(sample.allowedNodeIds || [])
  ]);
  const hitExpectedCount = expectedNodeIds.filter((nodeId) => matchedNodeIds.includes(nodeId)).length;
  const relevantHitCount = matchedNodeIds.filter((nodeId) => relevantNodeIds.has(nodeId)).length;
  const falsePositive = expectedNoMatches && matchedNodeIds.length > 0;
  const precisionAtK = expectedNoMatches
    ? (falsePositive ? 0 : 1)
    : (matchedNodeIds.length > 0 ? relevantHitCount / matchedNodeIds.length : 0);
  const recallAtK = expectedNodeIds.length > 0 ? hitExpectedCount / expectedNodeIds.length : 1;
  const noiseCount = matchedNodeIds.length - relevantHitCount;

  return {
    id: sample.id || sample.task,
    task: sample.task,
    expectedNoMatches,
    expectedNodeIds,
    allowedNodeIds: dedupeValues(sample.allowedNodeIds || []),
    matchedNodeIds,
    hitExpected: expectedNoMatches ? !falsePositive : hitExpectedCount === expectedNodeIds.length,
    falsePositive,
    precisionAtK,
    recallAtK,
    noiseCount,
    mode: preflightResult.mode
  };
}

function collectMatchedNodeIds(preflightResult) {
  return dedupeValues([
    ...(preflightResult.matchedPractices || []).map((item) => item.id),
    ...(preflightResult.recommendedOptions || []).map((item) => item.id)
  ]);
}

function summarizeScores(samples, thresholds) {
  const sampleCount = samples.length || 1;
  const negativeSamples = samples.filter((sample) => sample.expectedNoMatches);
  const recallAtK = average(samples.map((sample) => sample.recallAtK));
  const precisionAtK = average(samples.map((sample) => sample.precisionAtK));
  const hitRate = samples.filter((sample) => sample.hitExpected).length / sampleCount;
  const falsePositiveRate =
    negativeSamples.length > 0
      ? negativeSamples.filter((sample) => sample.falsePositive).length / negativeSamples.length
      : 0;
  const noiseRate =
    samples.reduce((total, sample) => total + sample.noiseCount, 0) /
    Math.max(samples.reduce((total, sample) => total + sample.matchedNodeIds.length, 0), 1);
  const minRecallAtK = Number(thresholds.minRecallAtK ?? 0);
  const minPrecisionAtK = Number(thresholds.minPrecisionAtK ?? 0);
  const maxFalsePositiveRate = Number(thresholds.maxFalsePositiveRate ?? 1);

  return {
    recallAtK,
    precisionAtK,
    hitRate,
    falsePositiveRate,
    noiseRate,
    negativeSampleCount: negativeSamples.length,
    minRecallAtK,
    minPrecisionAtK,
    maxFalsePositiveRate,
    pass:
      recallAtK >= minRecallAtK &&
      precisionAtK >= minPrecisionAtK &&
      falsePositiveRate <= maxFalsePositiveRate
  };
}

async function readBenchmarkFile(filePath) {
  if (!filePath) {
    throw new Error("缺少 benchmark 文件路径");
  }
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function parseCliArgs(args) {
  const positional = [];
  let k = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--k") {
      k = Number(args[index + 1]);
      index += 1;
      continue;
    }
    positional.push(arg);
  }

  return {
    projectRoot: positional[0] || process.cwd(),
    benchmarkFilePath: positional[1],
    options: { k }
  };
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((total, value) => total + Number(value || 0), 0) / values.length;
}

function dedupeValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  const { projectRoot, benchmarkFilePath, options } = parseCliArgs(process.argv.slice(2));
  const result = await runBenchmark(projectRoot, benchmarkFilePath, options);
  console.log(JSON.stringify(result, null, 2));
}
