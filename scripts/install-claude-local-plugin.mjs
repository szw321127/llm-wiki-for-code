#!/usr/bin/env node

// DEPRECATED: This script is broken with current Claude Code versions.
// It writes pk@local into installed_plugins.json without registering the
// "local" marketplace in known_marketplaces.json, causing:
//   "Plugin 'pk' not found in marketplace 'local'"
// Use the standard /plugin commands instead:
//   /plugin marketplace add <repo>/.agents/plugins
//   /plugin install pk@local-project-knowledge

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_NAME = "pk";
const MARKETPLACE_NAME = "local";
const PLUGIN_VERSION = "0.1.16";
const INSTALLED_PLUGINS_KEY = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

export function resolveClaudePluginPaths({
  repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  homeDir = os.homedir()
} = {}) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedHomeDir = path.resolve(homeDir);

  return {
    repositoryRoot: resolvedRepositoryRoot,
    homeDir: resolvedHomeDir,
    sourcePluginPath: path.join(resolvedRepositoryRoot, "plugins", PLUGIN_NAME),
    cachePluginPath: path.join(resolvedHomeDir, ".claude", "plugins", "cache", MARKETPLACE_NAME, PLUGIN_NAME, PLUGIN_VERSION),
    installedPluginsPath: path.join(resolvedHomeDir, ".claude", "plugins", "installed_plugins.json"),
    settingsPath: path.join(resolvedHomeDir, ".claude", "settings.json"),
    oldSkillsPath: path.join(resolvedHomeDir, ".claude", "skills", PLUGIN_NAME)
  };
}

async function exists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfPresent(filePath) {
  if (!(await exists(filePath))) {
    return null;
  }

  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function removePathIfPresent(targetPath) {
  if (!(await exists(targetPath))) {
    return false;
  }

  await fs.rm(targetPath, { recursive: true, force: true });
  return true;
}

async function copyDir(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

function buildPluginEntry(installPath) {
  const now = new Date().toISOString();

  return [
    {
      scope: "user",
      installPath,
      version: PLUGIN_VERSION,
      installedAt: now,
      lastUpdated: now
    }
  ];
}

export function upsertInstalledPlugins(existingPayload, installPath) {
  const payload =
    existingPayload && typeof existingPayload === "object"
      ? structuredClone(existingPayload)
      : { version: 2, plugins: {} };

  if (!payload.version) {
    payload.version = 2;
  }

  if (!payload.plugins || typeof payload.plugins !== "object") {
    payload.plugins = {};
  }

  payload.plugins[INSTALLED_PLUGINS_KEY] = buildPluginEntry(installPath);

  return payload;
}

export function upsertEnabledPlugin(settings, pluginKey, enabled = true) {
  const next = settings && typeof settings === "object" ? structuredClone(settings) : {};

  if (!next.enabledPlugins || typeof next.enabledPlugins !== "object") {
    next.enabledPlugins = {};
  }

  next.enabledPlugins[pluginKey] = enabled;
  return next;
}

export function removeEnabledPlugin(settings, pluginKey) {
  if (!settings || typeof settings !== "object") {
    return null;
  }

  const next = structuredClone(settings);

  if (next.enabledPlugins && typeof next.enabledPlugins === "object") {
    delete next.enabledPlugins[pluginKey];
  }

  return next;
}

export function removePluginFromInstalled(existingPayload) {
  if (!existingPayload || typeof existingPayload !== "object") {
    return null;
  }

  const payload = structuredClone(existingPayload);

  if (payload.plugins && typeof payload.plugins === "object") {
    delete payload.plugins[INSTALLED_PLUGINS_KEY];
  }

  return payload;
}

export async function installClaudeLocalPlugin({
  repositoryRoot,
  homeDir
} = {}) {
  const paths = resolveClaudePluginPaths({ repositoryRoot, homeDir });

  if (!(await exists(paths.sourcePluginPath))) {
    throw new Error(`未找到源插件目录: ${paths.sourcePluginPath}`);
  }

  const claudePluginJsonPath = path.join(paths.sourcePluginPath, ".claude-plugin", "plugin.json");

  if (!(await exists(claudePluginJsonPath))) {
    throw new Error(`未找到 Claude Code plugin.json: ${claudePluginJsonPath}`);
  }

  // 清理旧版 skill 安装遗留
  await removePathIfPresent(paths.oldSkillsPath);

  // 复制插件到 cache 目录
  await removePathIfPresent(paths.cachePluginPath);
  await copyDir(paths.sourcePluginPath, paths.cachePluginPath);

  const existingPlugins = await readJsonIfPresent(paths.installedPluginsPath);
  const nextPlugins = upsertInstalledPlugins(existingPlugins, paths.cachePluginPath);

  await writeJson(paths.installedPluginsPath, nextPlugins);

  const existingSettings = await readJsonIfPresent(paths.settingsPath);
  const nextSettings = upsertEnabledPlugin(existingSettings, INSTALLED_PLUGINS_KEY, true);

  await writeJson(paths.settingsPath, nextSettings);

  return {
    action: "install",
    paths,
    pluginsStatus: existingPlugins ? "updated" : "created",
    settingsStatus: existingSettings ? "updated" : "created",
    cleanedOldSkills: await exists(paths.oldSkillsPath) === false
  };
}

export async function uninstallClaudeLocalPlugin({
  repositoryRoot,
  homeDir
} = {}) {
  const paths = resolveClaudePluginPaths({ repositoryRoot, homeDir });
  const existingPlugins = await readJsonIfPresent(paths.installedPluginsPath);
  const nextPlugins = removePluginFromInstalled(existingPlugins);

  if (nextPlugins) {
    await writeJson(paths.installedPluginsPath, nextPlugins);
  }

  const existingSettings = await readJsonIfPresent(paths.settingsPath);
  const nextSettings = removeEnabledPlugin(existingSettings, INSTALLED_PLUGINS_KEY);

  if (nextSettings) {
    await writeJson(paths.settingsPath, nextSettings);
  }

  const removedCache = await removePathIfPresent(paths.cachePluginPath);
  const removedOldSkills = await removePathIfPresent(paths.oldSkillsPath);

  return {
    action: "uninstall",
    paths,
    pluginsStatus: existingPlugins ? "updated" : "absent",
    settingsStatus: existingSettings ? "updated" : "absent",
    removedCache,
    removedOldSkills
  };
}

function formatSummary(summary) {
  if (summary.action === "install") {
    return [
      "已完成 Claude Code 本地插件安装。",
      `- 源插件: ${summary.paths.sourcePluginPath}`,
      `- Cache 路径: ${summary.paths.cachePluginPath}`,
      `- installed_plugins: ${summary.paths.installedPluginsPath} (${summary.pluginsStatus})`,
      `- settings.json: ${summary.paths.settingsPath} (${summary.settingsStatus})`,
      summary.cleanedOldSkills ? "- 已清理旧版 skill 安装遗留" : "",
      "",
      "安装后需要完全重启 Claude Code，让技能在启动时被加载。",
      "重启后可通过 /pk-init、/pk-preflight 等方式调用技能。"
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "已完成 Claude Code 本地插件卸载清理。",
    `- installed_plugins: ${summary.paths.installedPluginsPath} (${summary.pluginsStatus})`,
    `- settings.json: ${summary.paths.settingsPath} (${summary.settingsStatus})`,
    summary.removedCache ? "- 已清理 cache 插件目录" : "",
    summary.removedOldSkills ? "- 已清理旧版 skill 安装遗留" : ""
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const action = process.argv[2] === "uninstall" ? "uninstall" : "install";
  const runner =
    action === "install" ? installClaudeLocalPlugin : uninstallClaudeLocalPlugin;
  const summary = await runner();
  console.log(formatSummary(summary));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
