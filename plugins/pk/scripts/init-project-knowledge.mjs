#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProjectGraphArtifacts } from "./build-project-graph-data.mjs";
import {
  buildObsidianLinkSection,
  createLogEvent,
  refreshObsidianVault
} from "./obsidian-lib.mjs";
import { scanProject } from "./scan-project.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const templateDirectory = path.resolve(scriptDirectory, "..", "templates");
const previewScriptPath = path.join(scriptDirectory, "serve-project-knowledge.mjs");
const portablePreviewScriptPath = path.join("tools", "serve-project-knowledge.mjs");
const defaultPreviewPort = 8124;

export async function initializeProjectKnowledge(projectRoot) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const scan = await scanProject(resolvedProjectRoot);
  const knowledgeRoot = path.join(resolvedProjectRoot, ".project-knowledge");
  const nodes = buildInitialNodes(scan);

  await ensureKnowledgeSkeleton(knowledgeRoot);
  await writeCoreDocuments(knowledgeRoot, scan);
  await writeProjectProfile(knowledgeRoot, scan, nodes);
  await writeNodes(knowledgeRoot, nodes);
  await fs.cp(templateDirectory, path.join(knowledgeRoot, "templates"), {
    force: true,
    recursive: true
  });
  await writePortablePreviewServer(knowledgeRoot);
  await writeStateFiles(knowledgeRoot);

  const graphArtifacts = await buildProjectGraphArtifacts(knowledgeRoot);
  await refreshObsidianVault(knowledgeRoot, {
    graph: graphArtifacts.graph,
    event: createLogEvent("pk:init", "初始化项目知识库", {
      stable: nodes.filter((node) => node.maturity === "stable").length,
      incubating: nodes.filter((node) => node.maturity === "incubating").length
    })
  });
  await writeOpenGraphLauncher(knowledgeRoot);

  return {
    projectRoot: resolvedProjectRoot,
    knowledgeRoot,
    tech: scan.tech,
    buildTools: scan.buildTools,
    testTools: scan.testTools,
    stableNodeIds: nodes.filter((node) => node.maturity === "stable").map((node) => node.id),
    incubatingNodeIds: nodes.filter((node) => node.maturity === "incubating").map((node) => node.id)
  };
}

function buildInitialNodes(scan) {
  const nodes = [];
  const hasFrontendPages = scan.frontendPageFiles.length > 0;
  const hasUnifiedClient = scan.unifiedClientFiles.length > 0;
  const hasDirectCall = scan.directCallFiles.length > 0;
  const hasConfigModule = scan.configModuleFiles.length > 0;
  const hasInlineConfig = scan.inlineConfigFiles.length > 0;

  if (hasFrontendPages) {
    nodes.push({
      id: "context-frontend-page",
      type: "context",
      title: "前端交互页面",
      summary: "需要处理页面内数据请求和状态反馈的场景。",
      keywords: ["frontend", "page"],
      maturity: "stable",
      source_evidence: scan.frontendPageFiles
    });
  }

  if (hasUnifiedClient) {
    nodes.push({
      id: "rule-use-unified-client",
      type: "rule",
      title: "优先走统一调用封装层",
      summary: "默认通过统一 client 发起远程调用。",
      applies_to: ["practice-http-client", "option-unified-client"],
      priority: "strong",
      keywords: ["client", "request"],
      maturity: "stable",
      source_evidence: scan.unifiedClientFiles.concat(scan.docEntrypoints.slice(0, 1))
    });

    nodes.push({
      id: "practice-http-client",
      type: "practice",
      title: "HTTP 调用封装实践",
      summary: "当前项目中的远程调用应优先通过统一封装层收敛。",
      contexts: hasFrontendPages ? ["context-frontend-page"] : [],
      constraints: [],
      rules: ["rule-use-unified-client"],
      option_ids: ["option-unified-client", ...(hasDirectCall ? ["option-direct-call"] : [])],
      keywords: ["http", "request", "client"],
      maturity: "stable",
      source_evidence: scan.unifiedClientFiles
    });

    nodes.push({
      id: "option-unified-client",
      type: "option",
      title: "统一调用封装层",
      summary: "通过统一 client 承载调用治理逻辑。",
      practice: "practice-http-client",
      base_score: 88,
      score_breakdown: {
        consistency: 18,
        efficiency: 18,
        maintainability: 18,
        extensibility: 18,
        risk: 16
      },
      alternatives: hasDirectCall ? ["option-direct-call"] : [],
      keywords: ["client", "request"],
      maturity: "stable",
      source_evidence: scan.unifiedClientFiles
    });
  }

  if (hasDirectCall) {
    nodes.push({
      id: "option-direct-call",
      type: "option",
      title: "直接原生调用",
      summary: "在局部直接使用原生请求方式。",
      practice: "practice-http-client",
      base_score: 40,
      score_breakdown: {
        consistency: 8,
        efficiency: 8,
        maintainability: 8,
        extensibility: 8,
        risk: 8
      },
      alternatives: hasUnifiedClient ? ["option-unified-client"] : [],
      keywords: ["fetch", "axios"],
      maturity: "incubating",
      source_evidence: scan.directCallFiles,
      session_refs: []
    });
  }

  if (hasConfigModule || hasInlineConfig) {
    nodes.push({
      id: "practice-config-management",
      type: "practice",
      title: "配置管理实践",
      summary: hasConfigModule
        ? "配置应优先收敛到集中入口而不是散落在各处内联读取。"
        : "当前项目存在内联配置读取，配置管理实践仍需继续孵化。",
      contexts: [],
      constraints: [],
      rules: hasConfigModule ? ["rule-centralized-config-default"] : [],
      option_ids: [
        ...(hasConfigModule ? ["option-centralized-config"] : []),
        ...(hasInlineConfig ? ["option-inline-config"] : [])
      ],
      keywords: ["config", "env"],
      maturity: hasConfigModule ? "stable" : "incubating",
      source_evidence: hasConfigModule ? scan.configModuleFiles : scan.inlineConfigFiles,
      session_refs: []
    });
  }

  if (hasConfigModule) {
    nodes.push({
      id: "rule-centralized-config-default",
      type: "rule",
      title: "默认集中配置管理",
      summary: "默认通过集中配置入口读取环境和运行参数。",
      applies_to: ["practice-config-management", "option-centralized-config"],
      priority: "default",
      keywords: ["config", "env"],
      maturity: "stable",
      source_evidence: scan.configModuleFiles
    });

    nodes.push({
      id: "option-centralized-config",
      type: "option",
      title: "集中配置入口",
      summary: "统一通过配置模块读取环境与参数。",
      practice: "practice-config-management",
      base_score: 84,
      score_breakdown: {
        consistency: 17,
        efficiency: 17,
        maintainability: 17,
        extensibility: 17,
        risk: 16
      },
      alternatives: hasInlineConfig ? ["option-inline-config"] : [],
      keywords: ["config", "env"],
      maturity: "stable",
      source_evidence: scan.configModuleFiles
    });
  }

  if (hasInlineConfig) {
    nodes.push({
      id: "option-inline-config",
      type: "option",
      title: "内联配置",
      summary: "在业务代码中直接读取环境变量或参数。",
      practice: "practice-config-management",
      base_score: 42,
      score_breakdown: {
        consistency: 8,
        efficiency: 9,
        maintainability: 8,
        extensibility: 8,
        risk: 9
      },
      alternatives: hasConfigModule ? ["option-centralized-config"] : [],
      keywords: ["process.env"],
      maturity: "incubating",
      source_evidence: scan.inlineConfigFiles,
      session_refs: []
    });
  }

  return nodes;
}

async function ensureKnowledgeSkeleton(knowledgeRoot) {
  const directories = [
    knowledgeRoot,
    path.join(knowledgeRoot, "practices"),
    path.join(knowledgeRoot, "options"),
    path.join(knowledgeRoot, "contexts"),
    path.join(knowledgeRoot, "constraints"),
    path.join(knowledgeRoot, "rules"),
    path.join(knowledgeRoot, "incubating", "practices"),
    path.join(knowledgeRoot, "incubating", "options"),
    path.join(knowledgeRoot, "incubating", "rules"),
    path.join(knowledgeRoot, "incubating", "constraints"),
    path.join(knowledgeRoot, "incubating", "contexts"),
    path.join(knowledgeRoot, "sessions"),
    path.join(knowledgeRoot, "_views"),
    path.join(knowledgeRoot, ".obsidian"),
    path.join(knowledgeRoot, "state"),
    path.join(knowledgeRoot, "graph"),
    path.join(knowledgeRoot, "templates"),
    path.join(knowledgeRoot, "tools")
  ];

  await Promise.all(directories.map((directory) => fs.mkdir(directory, { recursive: true })));
}

async function writeCoreDocuments(knowledgeRoot, scan) {
  await fs.writeFile(
    path.join(knowledgeRoot, "README.md"),
    `# ${scan.title} 代码库 wiki\n\n该目录由 LLM Wiki for Code 为当前项目生成，用于沉淀项目实践、方案、规则和会话结晶。\n\n可直接双击 \`open-graph.cmd\` 启动本地图谱预览。\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, "overview.md"),
    `# 项目概览\n\n- 项目：${scan.title}\n- 技术栈：${scan.tech.join(", ") || "待补充"}\n- 构建工具：${scan.buildTools.join(", ") || "待补充"}\n- 测试工具：${scan.testTools.join(", ") || "待补充"}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, "workflow.md"),
    "# 工作流\n\n- 双击 `open-graph.cmd` 打开当前项目的图谱预览\n- 在 Codex 技能列表中使用 `pk-status` 查看当前知识库状态\n- 在 Codex 技能列表中使用 `pk-graph` 刷新图谱阅读层\n- 在任务结束时由 agent 做轻量结晶判断\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, "scoring.md"),
    "# 评分\n\n`final_score = base_score + project_adjustment`\n",
    "utf8"
  );
}

async function writeProjectProfile(knowledgeRoot, scan, nodes) {
  const preferredOptions = {};
  if (nodes.some((node) => node.id === "option-unified-client")) {
    preferredOptions["option-unified-client"] = 8;
  }
  if (nodes.some((node) => node.id === "option-direct-call")) {
    preferredOptions["option-direct-call"] = -8;
  }
  if (nodes.some((node) => node.id === "option-centralized-config")) {
    preferredOptions["option-centralized-config"] = 6;
  }
  if (nodes.some((node) => node.id === "option-inline-config")) {
    preferredOptions["option-inline-config"] = -6;
  }

  const document = renderMarkdownDocument(
    {
      id: "project-current",
      type: "project_profile",
      title: scan.title,
      summary: `${scan.title} 的项目画像，由本地代码与文档初始化生成。`,
      tech: scan.tech,
      build_tools: scan.buildTools,
      test_tools: scan.testTools,
      doc_entrypoints: scan.docEntrypoints,
      adopted_rules: nodes
        .filter((node) => node.type === "rule" && node.maturity === "stable")
        .map((node) => node.id),
      preferred_options: preferredOptions,
      keywords: ["project", "knowledge"],
      status: "active",
      maturity: "stable",
      source_evidence: ["package.json", ...scan.docEntrypoints.slice(0, 2)],
      session_refs: []
    },
    {
      Summary: [`${scan.title} 的项目画像，由本地代码与文档初始化生成。`],
      Defaults: [
        nodes.some((node) => node.id === "option-unified-client")
          ? "默认偏好统一调用封装层"
          : "默认偏好待后续结晶补全",
        nodes.some((node) => node.id === "option-centralized-config")
          ? "默认偏好集中配置入口"
          : "配置默认偏好待后续结晶补全"
      ]
    }
  );

  await fs.writeFile(path.join(knowledgeRoot, "project-profile.md"), document, "utf8");
}

async function writeNodes(knowledgeRoot, nodes) {
  await Promise.all(
    nodes.map(async (node) => {
      const documentPath = resolveNodePath(knowledgeRoot, node);
      const body = buildNodeBody(node);
      await fs.mkdir(path.dirname(documentPath), { recursive: true });
      await fs.writeFile(documentPath, renderMarkdownDocument(node, body), "utf8");
    })
  );
}

function resolveNodePath(knowledgeRoot, node) {
  const baseDirectory =
    node.maturity === "incubating"
      ? path.join(knowledgeRoot, "incubating", `${node.type}s`)
      : path.join(knowledgeRoot, `${node.type}s`);

  switch (node.type) {
    case "practice":
      return path.join(baseDirectory, `${node.id}.md`);
    case "option":
      return path.join(baseDirectory, `${node.id}.md`);
    case "context":
      return path.join(baseDirectory, `${node.id}.md`);
    case "constraint":
      return path.join(baseDirectory, `${node.id}.md`);
    case "rule":
      return path.join(baseDirectory, `${node.id}.md`);
    default:
      throw new Error(`不支持的节点类型: ${node.type}`);
  }
}

function buildNodeBody(node) {
  const sections = {
    Summary: [node.summary]
  };

  if (node.type === "practice") {
    sections.Decision = [
      node.maturity === "stable"
        ? "当前项目中该实践已具备明确默认方案。"
        : "当前项目中该实践仍在孵化阶段。"
    ];
  }

  if (node.type === "option") {
    sections.Advantages = [
      node.maturity === "stable" ? "更接近当前项目默认做法。" : "可作为对照或局部过渡方案。"
    ];
    sections.Risks = [
      node.maturity === "stable" ? "需要持续保持边界清晰。" : "目前不应直接占据默认推荐位。"
    ];
  }

  if ((node.source_evidence || []).length > 0) {
    sections.Evidence = node.source_evidence;
  }

  const links = buildObsidianLinkSection(node);
  if (links.length > 0) {
    sections.Links = links;
  }

  return sections;
}

async function writeStateFiles(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "usage-index.json"),
    "{}\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "runtime-state.json"),
    `${JSON.stringify(
      {
        initialized: true,
        graph_dirty: false,
        last_session_id: null,
        last_crystallized_at: null,
        last_graph_build_at: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function writePortablePreviewServer(knowledgeRoot) {
  await fs.copyFile(previewScriptPath, path.join(knowledgeRoot, portablePreviewScriptPath));
}

async function writeOpenGraphLauncher(knowledgeRoot) {
  const launcherPath = path.join(knowledgeRoot, "open-graph.cmd");
  const launcherSource = [
    "@echo off",
    "setlocal",
    'set "PORT=%~1"',
    `if not defined PORT set "PORT=${defaultPreviewPort}"`,
    'set "NODE_EXE=node"',
    'set "SERVE_SCRIPT=%~dp0tools\\serve-project-knowledge.mjs"',
    'for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"',
    "where %NODE_EXE% >nul 2>nul",
    "if errorlevel 1 (",
    "  echo Node.js was not found on PATH. Install Node.js or add node.exe to PATH.",
    "  exit /b 1",
    ")",
    'start "LLM Wiki for Code Graph Server" powershell -NoExit -ExecutionPolicy Bypass -Command "& { & \\"%NODE_EXE%\\" \\"%SERVE_SCRIPT%\\" \\"%PROJECT_ROOT%\\" \\"%PORT%\\" }"',
    "timeout /t 2 /nobreak >nul",
    'start "" "http://127.0.0.1:%PORT%/graph/knowledge-graph.html"',
    ""
  ].join("\r\n");

  await fs.writeFile(launcherPath, launcherSource, "utf8");
}

function renderMarkdownDocument(frontmatter, sections) {
  const normalizedFrontmatter = { ...frontmatter };
  delete normalizedFrontmatter.body;

  const lines = ["---", ...serializeYamlObject(normalizedFrontmatter), "---", ""];

  for (const [title, items] of Object.entries(sections)) {
    lines.push(`## ${title}`, "");
    for (const item of items) {
      if (!item) {
        continue;
      }
      lines.push(item.startsWith("- ") ? item : item);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function serializeYamlObject(value, indentLevel = 0) {
  return Object.entries(value).flatMap(([key, nestedValue]) =>
    serializeYamlEntry(key, nestedValue, indentLevel)
  );
}

function serializeYamlEntry(key, value, indentLevel) {
  const indent = " ".repeat(indentLevel);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indent}${key}: []`];
    }
    return [`${indent}${key}:`, ...value.map((item) => `${indent}  - ${serializeScalar(item)}`)];
  }

  if (value && typeof value === "object") {
    const childEntries = Object.entries(value);
    if (childEntries.length === 0) {
      return [`${indent}${key}: {}`];
    }
    return [
      `${indent}${key}:`,
      ...childEntries.flatMap(([childKey, childValue]) =>
        serializeYamlEntry(childKey, childValue, indentLevel + 2)
      )
    ];
  }

  return [`${indent}${key}: ${serializeScalar(value)}`];
}

function serializeScalar(value) {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined || value === "") {
    return '""';
  }
  return String(value);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = path.resolve(process.argv[2] || process.cwd());
  const summary = await initializeProjectKnowledge(projectRoot);
  console.log(JSON.stringify(summary, null, 2));
}
