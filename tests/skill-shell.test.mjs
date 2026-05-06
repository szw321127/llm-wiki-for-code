import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(".");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);

test("repository exposes a root skill shell", () => {
  assert.equal(fs.existsSync(path.join(root, "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(root, "templates")), true);
  assert.equal(fs.existsSync(path.join(root, "scripts")), true);
});

test("package.json exposes project knowledge skill commands", () => {
  assert.equal(typeof packageJson.scripts["pk:init"], "string");
  assert.equal(typeof packageJson.scripts["pk:preflight"], "string");
  assert.equal(typeof packageJson.scripts["pk:status"], "string");
  assert.equal(typeof packageJson.scripts["pk:graph"], "string");
  assert.equal(typeof packageJson.scripts["pk:crystallize"], "string");
  assert.equal(typeof packageJson.scripts["pk:auto-crystallize"], "string");
  assert.equal(typeof packageJson.scripts["pk:lint"], "string");
  assert.equal(typeof packageJson.scripts["pk:govern"], "string");
  assert.equal(typeof packageJson.scripts["pk:serve"], "string");
  assert.match(packageJson.scripts["pk:init"], /init-project-knowledge/);
  assert.match(packageJson.scripts["pk:preflight"], /preflight-session/);
  assert.match(packageJson.scripts["pk:status"], /status-report/);
  assert.match(packageJson.scripts["pk:graph"], /build-project-graph-data/);
  assert.match(packageJson.scripts["pk:crystallize"], /crystallize-session/);
  assert.match(packageJson.scripts["pk:auto-crystallize"], /auto-crystallize-session/);
  assert.match(packageJson.scripts["pk:lint"], /lint-project-knowledge/);
  assert.match(packageJson.scripts["pk:govern"], /govern-project-knowledge/);
  assert.match(packageJson.scripts["pk:serve"], /serve-project-knowledge/);
});
