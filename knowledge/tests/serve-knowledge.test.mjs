import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveMimeType } from "../tools/serve-knowledge.mjs";

test("resolveMimeType 为 .mjs 返回模块脚本所需的 JavaScript MIME", () => {
  assert.equal(
    resolveMimeType(path.resolve("knowledge", "graph", "graph-runtime.mjs")),
    "application/javascript; charset=utf-8"
  );
});
