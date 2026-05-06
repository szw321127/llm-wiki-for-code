#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(currentFilePath);
const projectRoot = path.resolve(scriptDirectory, "../..");
const port = Number(process.argv[2] || process.env.PORT || 8123);

export const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

export function resolveMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return mimeTypes[extension] || "application/octet-stream";
}

export function createKnowledgeServer(rootDirectory = projectRoot) {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url || "/",
        `http://${request.headers.host || "127.0.0.1"}`
      );
      const relativePath =
        requestUrl.pathname === "/" ? "/knowledge/graph/knowledge-graph.html" : requestUrl.pathname;
      const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
      const absolutePath = path.join(rootDirectory, safePath);

      if (!absolutePath.startsWith(rootDirectory)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }

      const fileBuffer = await fs.readFile(absolutePath);
      response.writeHead(200, {
        "content-type": resolveMimeType(absolutePath)
      });
      response.end(fileBuffer);
    } catch (error) {
      const statusCode = error.code === "ENOENT" ? 404 : 500;
      response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
      response.end(statusCode === 404 ? "Not Found" : String(error.message || error));
    }
  });
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath);

if (isMainModule) {
  const server = createKnowledgeServer(projectRoot);
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `Knowledge graph preview: http://127.0.0.1:${port}/knowledge/graph/knowledge-graph.html`
    );
  });
}
