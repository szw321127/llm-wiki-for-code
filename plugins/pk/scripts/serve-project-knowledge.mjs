#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  archiveKnowledgeNode,
  linkDuplicateKnowledgeNode,
  rejectKnowledgeNode,
  verifyKnowledgeNode
} from "./govern-project-knowledge.mjs";
import { resolveProjectKnowledgeRoot } from "./paths.mjs";

const currentFilePath = fileURLToPath(import.meta.url);
const port = Number(process.argv[3] || process.env.PORT || 8124);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function resolveMimeType(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

export function createProjectKnowledgeServer(projectRoot) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const knowledgeRoot = resolveProjectKnowledgeRoot(resolvedProjectRoot);

  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url || "/",
        `http://${request.headers.host || "127.0.0.1"}`
      );

      if (requestUrl.pathname === "/api/governance/reject") {
        await handleGovernanceAction(request, response, resolvedProjectRoot, rejectKnowledgeNode, (body) => ({
          nodeId: body.nodeId,
          reason: body.reason || "manual-reject"
        }));
        return;
      }

      if (requestUrl.pathname === "/api/governance/verify") {
        await handleGovernanceAction(request, response, resolvedProjectRoot, verifyKnowledgeNode, (body) => ({
          nodeId: body.nodeId,
          verifiedAt: body.verifiedAt,
          reason: body.reason || "manual-verify"
        }));
        return;
      }

      if (requestUrl.pathname === "/api/governance/archive") {
        await handleGovernanceAction(request, response, resolvedProjectRoot, archiveKnowledgeNode, (body) => ({
          nodeId: body.nodeId,
          reason: body.reason || "manual-archive"
        }));
        return;
      }

      if (requestUrl.pathname === "/api/governance/link-duplicate") {
        await handleGovernanceAction(request, response, resolvedProjectRoot, linkDuplicateKnowledgeNode, (body) => ({
          nodeId: body.nodeId,
          duplicateOf: body.duplicateOf,
          reason: body.reason || "manual-duplicate"
        }));
        return;
      }

      const relativePath =
        requestUrl.pathname === "/"
          ? "/graph/knowledge-graph.html"
          : requestUrl.pathname;
      const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
      const absolutePath = path.join(knowledgeRoot, safePath);

      if (!absolutePath.startsWith(knowledgeRoot)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }

      const buffer = await fs.readFile(absolutePath);
      response.writeHead(200, { "content-type": resolveMimeType(absolutePath) });
      response.end(buffer);
    } catch (error) {
      const statusCode = error.code === "ENOENT" ? 404 : 500;
      response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
      response.end(statusCode === 404 ? "Not Found" : String(error.message || error));
    }
  });
}

async function handleGovernanceAction(request, response, projectRoot, actionFn, inputBuilder) {
  if (request.method !== "POST") {
    writeJson(response, 405, { ok: false, error: "method-not-allowed" });
    return;
  }

  try {
    const body = await readJsonRequest(request);
    const action = await actionFn(projectRoot, inputBuilder(body));
    writeJson(response, 200, { ok: true, action });
  } catch (error) {
    writeJson(response, 400, {
      ok: false,
      error: String(error.message || error)
    });
  }
}

async function readJsonRequest(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const source = Buffer.concat(chunks).toString("utf8").trim();
  return source ? JSON.parse(source) : {};
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  const projectRoot = path.resolve(process.argv[2] || process.cwd());
  const server = createProjectKnowledgeServer(projectRoot);
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `LLM Wiki for Code preview: http://127.0.0.1:${port}/graph/knowledge-graph.html`
    );
  });
}
