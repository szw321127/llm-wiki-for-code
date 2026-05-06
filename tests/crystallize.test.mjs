import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { crystallizeSession } from "../scripts/crystallize-session.mjs";

const execFileAsync = promisify(execFile);

const fixtureRoot = path.resolve("tests", "fixtures", "sample-project");

test("crystallizeSession supports no-op, session-only, incubating, and stable-update flows", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-crystallize-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  const noOp = await crystallizeSession(projectRoot, {
    writeSession: false,
    topic: "noop"
  });
  assert.equal(noOp.mode, "no-op");

  const sessionOnly = await crystallizeSession(projectRoot, {
    sessionId: "session-2026-04-23-session-only",
    title: "只写会话",
    topic: "session-only",
    decisionSummary: "本轮没有形成稳定知识。",
    touchedFiles: ["src/pages/demo.ts"]
  });
  assert.equal(sessionOnly.mode, "session-only");
  assert.equal(
    await fileExists(
      path.join(
        projectRoot,
        ".project-knowledge",
        "sessions",
        "session-2026-04-23-session-only.md"
      )
    ),
    true
  );

  const incubating = await crystallizeSession(projectRoot, {
    sessionId: "session-2026-04-23-incubating",
    title: "新增孵化知识",
    topic: "incubating",
    decisionSummary: "发现一个可复用但尚未稳定的新方案。",
    touchedFiles: ["src/pages/demo.ts"],
    incubatingNodes: [
      {
        id: "option-shared-status-layer",
        type: "option",
        title: "共享任务状态层",
        summary: "把局部状态更新收敛到共享状态层。",
        practice: "practice-http-client",
        base_score: 44,
        score_breakdown: {
          consistency: 9,
          efficiency: 9,
          maintainability: 9,
          extensibility: 9,
          risk: 8
        },
        keywords: ["status"],
        source_evidence: ["src/pages/demo.ts"]
      }
    ]
  });
  assert.equal(incubating.mode, "session+incubating");
  assert.equal(
    await fileExists(
      path.join(
        projectRoot,
        ".project-knowledge",
        "incubating",
        "options",
        "option-shared-status-layer.md"
      )
    ),
    true
  );

  const stableUpdate = await crystallizeSession(projectRoot, {
    sessionId: "session-2026-04-23-stable-update",
    title: "更新稳定知识",
    topic: "stable-update",
    decisionSummary: "再次确认统一 client 是默认做法。",
    touchedFiles: ["src/api/client.ts", "docs/engineering.md"],
    adoptedNodeIds: ["option-unified-client"],
    stableUpdates: [
      {
        id: "rule-use-unified-client",
        type: "rule",
        summary: "默认通过统一 client 发起远程调用，页面层不应直接内联公共请求治理逻辑。"
      }
    ]
  });
  assert.equal(stableUpdate.mode, "session+stable-update");

  const updatedRule = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "rules",
      "rule-use-unified-client.md"
    ),
    "utf8"
  );
  const usageIndex = JSON.parse(
    await fs.readFile(
      path.join(projectRoot, ".project-knowledge", "state", "usage-index.json"),
      "utf8"
    )
  );

  assert.match(updatedRule, /页面层不应直接内联公共请求治理逻辑/);
  assert.equal(usageIndex["option-unified-client"].adopted_count, 2);
});

test("crystallize CLI accepts a JSON input file for adopted and incubating updates", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-crystallize-cli-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const inputPath = path.join(tempRoot, "crystallize-input.json");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });
  await fs.writeFile(
    inputPath,
    `${JSON.stringify(
      {
        sessionId: "session-2026-04-23-cli-json",
        title: "CLI JSON 结晶",
        topic: "cli-json",
        decisionSummary: "通过 CLI JSON 记录采纳和新增孵化实践。",
        touchedFiles: ["src/pages/demo.ts"],
        adoptedNodeIds: ["option-unified-client"],
        incubatingNodes: [
          {
            id: "option-cli-json-status-layer",
            type: "option",
            title: "CLI JSON 状态层",
            summary: "通过 CLI JSON 写入的状态层候选。",
            practice: "practice-http-client",
            base_score: 45,
            score_breakdown: {
              consistency: 9,
              efficiency: 9,
              maintainability: 9,
              extensibility: 9,
              risk: 9
            },
            keywords: ["status"],
            source_evidence: ["src/pages/demo.ts"]
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const { stdout } = await execFileAsync(process.execPath, [
    path.resolve("scripts", "crystallize-session.mjs"),
    projectRoot,
    inputPath
  ]);
  const result = JSON.parse(stdout);

  assert.equal(result.mode, "session+incubating");
  assert.deepEqual(result.adoptedNodeIds, ["option-unified-client"]);
  assert.deepEqual(result.incubatingNodeIds, ["option-cli-json-status-layer"]);
  assert.equal(
    await fileExists(
      path.join(
        projectRoot,
        ".project-knowledge",
        "incubating",
        "options",
        "option-cli-json-status-layer.md"
      )
    ),
    true
  );

  const usageIndex = JSON.parse(
    await fs.readFile(
      path.join(projectRoot, ".project-knowledge", "state", "usage-index.json"),
      "utf8"
    )
  );
  const log = await fs.readFile(
    path.join(projectRoot, ".project-knowledge", "log.md"),
    "utf8"
  );
  const incubatingView = await fs.readFile(
    path.join(projectRoot, ".project-knowledge", "_views", "incubating.md"),
    "utf8"
  );

  assert.equal(usageIndex["option-unified-client"].adopted_count, 2);
  assert.match(log, /pk:crystallize/);
  assert.match(log, /session-2026-04-23-cli-json/);
  assert.match(incubatingView, /\[\[option-cli-json-status-layer\]\]/);
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
