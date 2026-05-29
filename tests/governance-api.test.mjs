import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProjectKnowledgeServer } from "../scripts/serve-project-knowledge.mjs";
import { parseFrontmatterBlock } from "../scripts/knowledge-lib.mjs";

const fixtureProjectRoot = path.resolve("tests", "fixtures", "sample-project");

test("project knowledge server rejects a node through the governance API", async () => {
  const projectRoot = await copyProject("project-knowledge-api-reject-");
  const server = createProjectKnowledgeServer(projectRoot);
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/governance/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodeId: "option-direct-call",
        reason: "manual-reject"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.node_id, "option-direct-call");

    const document = await readFrontmatter(
      path.join(projectRoot, ".repowise", "incubating", "options", "option-direct-call.md")
    );
    assert.equal(document.review_status, "rejected");
    assert.equal(document.rejected_reason, "manual-reject");
  } finally {
    await close(server);
  }
});

test("project knowledge server rejects invalid governance API node ids", async () => {
  const projectRoot = await copyProject("project-knowledge-api-invalid-");
  const server = createProjectKnowledgeServer(projectRoot);
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/governance/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodeId: "../outside",
        reason: "bad"
      })
    });

    assert.equal(response.status, 400);
  } finally {
    await close(server);
  }
});

test("project knowledge server marks a node verified through the governance API", async () => {
  const projectRoot = await copyProject("project-knowledge-api-verify-");
  const server = createProjectKnowledgeServer(projectRoot);
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/governance/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodeId: "rule-use-unified-client",
        verifiedAt: "2026-05-15",
        reason: "source-reviewed"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.type, "verify");
    assert.equal(payload.action.node_id, "rule-use-unified-client");

    const document = await readFrontmatter(
      path.join(projectRoot, ".repowise", "rules", "rule-use-unified-client.md")
    );
    assert.equal(document.last_verified_at, "2026-05-15");
    assert.equal(document.verified_reason, "source-reviewed");

    const log = await fs.readFile(path.join(projectRoot, ".repowise", "log.md"), "utf8");
    assert.match(log, /pk:govern:verify/);
  } finally {
    await close(server);
  }
});

test("project knowledge server archives a node through the governance API", async () => {
  const projectRoot = await copyProject("project-knowledge-api-archive-");
  const server = createProjectKnowledgeServer(projectRoot);
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/governance/archive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodeId: "option-unified-client",
        reason: "retired-pattern"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.type, "archive");
    assert.equal(payload.action.node_id, "option-unified-client");

    const document = await readFrontmatter(
      path.join(projectRoot, ".repowise", "incubating", "options", "option-unified-client.md")
    );
    assert.equal(document.status, "archived");
    assert.equal(document.archive_reason, "retired-pattern");
  } finally {
    await close(server);
  }
});

test("project knowledge server links a duplicate through the governance API", async () => {
  const projectRoot = await copyProject("project-knowledge-api-link-duplicate-");
  const server = createProjectKnowledgeServer(projectRoot);
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/governance/link-duplicate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodeId: "option-direct-call",
        duplicateOf: "option-unified-client",
        reason: "manual-duplicate"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.type, "link-duplicate");
    assert.equal(payload.action.node_id, "option-direct-call");
    assert.equal(payload.action.duplicate_of, "option-unified-client");

    const document = await readFrontmatter(
      path.join(projectRoot, ".repowise", "incubating", "options", "option-direct-call.md")
    );
    assert.equal(document.review_status, "rejected");
    assert.equal(document.duplicate_of, "option-unified-client");
    assert.equal(document.rejected_reason, "manual-duplicate");
  } finally {
    await close(server);
  }
});

async function copyProject(prefix) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const projectRoot = path.join(tempRoot, "sample-project");
  await fs.cp(fixtureProjectRoot, projectRoot, { recursive: true });
  return projectRoot;
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function readFrontmatter(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  return parseFrontmatterBlock(source).data;
}
