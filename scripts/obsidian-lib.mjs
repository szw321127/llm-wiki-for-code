import fs from "node:fs/promises";
import path from "node:path";

import {
  buildProjectGraphFromDirectory,
  parseMarkdownDocument
} from "./knowledge-lib.mjs";

export async function refreshObsidianVault(knowledgeRoot, options = {}) {
  const graph = options.graph || await buildProjectGraphFromDirectory(knowledgeRoot);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

  await ensureObsidianDirectories(knowledgeRoot);
  await writeObsidianConfig(knowledgeRoot);
  await writeIndex(knowledgeRoot, graph, nodeMap);
  await writePracticeView(knowledgeRoot, graph, nodeMap);
  await writeIncubatingView(knowledgeRoot, graph);
  await writeSessionsView(knowledgeRoot);
  await ensureOrAppendLog(knowledgeRoot, options.event);

  return {
    index: "index.md",
    log: "log.md",
    views: ["_views/practices.md", "_views/incubating.md", "_views/sessions.md"]
  };
}

export function createLogEvent(action, summary, details = {}) {
  return {
    action,
    summary,
    details,
    timestamp: new Date().toISOString()
  };
}

export function buildObsidianLinkSection(node) {
  const lines = [];

  if (node.type === "practice") {
    pushLinkGroup(lines, "Options", node.option_ids);
    pushLinkGroup(lines, "Rules", node.rules);
    pushLinkGroup(lines, "Contexts", node.contexts);
    pushLinkGroup(lines, "Constraints", node.constraints);
  } else if (node.type === "option") {
    pushLinkGroup(lines, "Practice", node.practice ? [node.practice] : []);
    pushLinkGroup(lines, "Alternatives", node.alternatives);
    pushLinkGroup(lines, "Constraints", node.constraints);
  } else if (node.type === "rule") {
    pushLinkGroup(lines, "Applies To", node.applies_to);
  } else if (node.type === "project_profile") {
    pushLinkGroup(lines, "Adopted Rules", node.adopted_rules);
    pushLinkGroup(lines, "Preferred Options", Object.keys(node.preferred_options || {}));
  }

  if ((node.source_evidence || []).length > 0) {
    lines.push("- Evidence");
    for (const evidencePath of node.source_evidence) {
      lines.push(`  - [${evidencePath}](../${evidencePath})`);
    }
  }

  return lines;
}

async function ensureObsidianDirectories(knowledgeRoot) {
  await Promise.all([
    fs.mkdir(path.join(knowledgeRoot, ".obsidian"), { recursive: true }),
    fs.mkdir(path.join(knowledgeRoot, "_views"), { recursive: true })
  ]);
}

async function writeObsidianConfig(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, ".obsidian", "app.json"),
    `${JSON.stringify({ alwaysUpdateLinks: true, newFileLocation: "folder", newFileFolderPath: "sessions" }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, ".obsidian", "graph.json"),
    `${JSON.stringify({ "collapse-filter": false, search: "-path:graph" }, null, 2)}\n`,
    "utf8"
  );
}

async function writeIndex(knowledgeRoot, graph, nodeMap) {
  const project = graph.nodes.find((node) => node.type === "project_profile");
  const practices = graph.nodes.filter((node) => node.type === "practice");
  const rules = graph.nodes.filter((node) => node.type === "rule");
  const lines = [
    "# 项目知识库索引",
    "",
    "## Entry",
    "",
    `- Project: [[project-profile]]${project ? ` (${project.title})` : ""}`,
    "- Practices: [[_views/practices]]",
    "- Incubating: [[_views/incubating]]",
    "- Sessions: [[_views/sessions]]",
    "- Log: [[log]]",
    "",
    "## Recommended Practices",
    ""
  ];

  for (const practice of practices) {
    const recommendedId =
      practice.recommended_options?.["project-current"] ||
      practice.recommended_options?.global;
    const recommended = recommendedId ? nodeMap.get(recommendedId) : null;
    lines.push(`- ${wikilink(practice.id)}${recommended ? ` -> ${wikilink(recommended.id)}` : ""}`);
  }

  lines.push("", "## Rules", "");
  for (const rule of rules) {
    lines.push(`- ${wikilink(rule.id)}`);
  }

  await fs.writeFile(path.join(knowledgeRoot, "index.md"), `${lines.join("\n").trim()}\n`, "utf8");
}

async function writePracticeView(knowledgeRoot, graph, nodeMap) {
  const lines = ["# 实践视图", ""];
  const practices = graph.nodes
    .filter((node) => node.type === "practice")
    .sort((left, right) => left.title.localeCompare(right.title, "zh-Hans-CN"));

  for (const practice of practices) {
    lines.push(`## ${practice.title}`, "");
    lines.push(`- Practice: ${wikilink(practice.id)}`);
    const pool =
      practice.recommendation_pools?.["project-current"] ||
      practice.recommendation_pools?.global ||
      [];
    if (pool.length > 0) {
      lines.push("- Recommendation Pool");
      for (const optionId of pool) {
        const option = nodeMap.get(optionId);
        lines.push(`  - ${wikilink(optionId)}${option ? ` (${option.effective_scores?.["project-current"] ?? option.base_score})` : ""}`);
      }
    }
    lines.push("");
  }

  await fs.writeFile(path.join(knowledgeRoot, "_views", "practices.md"), `${lines.join("\n").trim()}\n`, "utf8");
}

async function writeIncubatingView(knowledgeRoot, graph) {
  const incubatingNodes = graph.nodes
    .filter((node) => node.maturity === "incubating")
    .sort((left, right) => left.type.localeCompare(right.type) || left.title.localeCompare(right.title, "zh-Hans-CN"));
  const lines = ["# 孵化区", ""];

  for (const node of incubatingNodes) {
    lines.push(`- ${wikilink(node.id)} (${node.type})`);
  }

  if (incubatingNodes.length === 0) {
    lines.push("- 暂无孵化知识");
  }

  await fs.writeFile(path.join(knowledgeRoot, "_views", "incubating.md"), `${lines.join("\n").trim()}\n`, "utf8");
}

async function writeSessionsView(knowledgeRoot) {
  const sessionDirectory = path.join(knowledgeRoot, "sessions");
  const entries = await safeReadDirectory(sessionDirectory);
  const sessions = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const document = await parseMarkdownDocument(path.join(sessionDirectory, entry.name), sessionDirectory);
    sessions.push(document);
  }

  const lines = ["# 会话记录", ""];
  for (const session of sessions.sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))) {
    lines.push(`- ${wikilink(session.id)} - ${session.decision_summary || session.summary || ""}`);
  }

  if (sessions.length === 0) {
    lines.push("- 暂无会话记录");
  }

  await fs.writeFile(path.join(knowledgeRoot, "_views", "sessions.md"), `${lines.join("\n").trim()}\n`, "utf8");
}

async function ensureOrAppendLog(knowledgeRoot, event) {
  const logPath = path.join(knowledgeRoot, "log.md");
  const exists = await fileExists(logPath);

  if (!exists) {
    await fs.writeFile(logPath, "# 操作日志\n\n", "utf8");
  }

  if (!event) {
    return;
  }

  await fs.appendFile(logPath, `${formatLogEvent(event)}\n`, "utf8");
}

function formatLogEvent(event) {
  const details = Object.entries(event.details || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .join("; ");
  const suffix = details ? ` (${details})` : "";
  return `- ${event.timestamp || new Date().toISOString()} \`${event.action}\` ${event.summary}${suffix}`;
}

function pushLinkGroup(lines, title, ids = []) {
  const values = (ids || []).filter(Boolean);
  if (values.length === 0) {
    return;
  }
  lines.push(`- ${title}`);
  for (const id of values) {
    lines.push(`  - ${wikilink(id)}`);
  }
}

function wikilink(id) {
  return `[[${id}]]`;
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
