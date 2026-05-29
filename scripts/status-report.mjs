#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProjectGraphFromDirectory,
  parseMarkdownDocument
} from "./knowledge-lib.mjs";
import { resolveKnowledgeRoot } from "./paths.mjs";

export async function generateStatusReport(projectRootOrKnowledgeRoot) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const runtimeState = await readJson(path.join(knowledgeRoot, "state", "runtime-state.json"), {});
  const sessionDirectory = path.join(knowledgeRoot, "sessions");
  const recentSessions = await loadRecentSessions(sessionDirectory);
  const projectTitle =
    graph.nodes.find((node) => node.type === "project_profile")?.title || path.basename(knowledgeRoot);
  const stableNodes = graph.nodes.filter((node) => node.type !== "project_profile" && node.maturity !== "incubating").length;
  const incubatingNodes = graph.nodes.filter((node) => node.maturity === "incubating").length;
  const recommendedOptions = graph.nodes
    .filter((node) => node.type === "practice")
    .map((node) => node.recommended_options?.["project-current"] || node.recommended_options?.global)
    .filter(Boolean);

  return {
    projectTitle,
    knowledgeRoot,
    stableNodes,
    incubatingNodes,
    graphDirty: Boolean(runtimeState.graph_dirty),
    lastGraphBuildAt: runtimeState.last_graph_build_at || null,
    recentSessions,
    recommendedOptions
  };
}

async function loadRecentSessions(sessionDirectory) {
  const entries = await safeReadDirectory(sessionDirectory);
  const sessions = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    sessions.push(
      await parseMarkdownDocument(path.join(sessionDirectory, entry.name), sessionDirectory)
    );
  }

  return sessions
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))
    .slice(0, 3)
    .map((session) => ({
      id: session.id,
      title: session.title,
      date: session.date,
      topic: session.topic,
      decision_summary: session.decision_summary
    }));
}

async function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
    }
    throw error;
  }
}

async function safeReadDirectory(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await generateStatusReport(process.argv[2] || process.cwd());
  console.log(JSON.stringify(report, null, 2));
}
