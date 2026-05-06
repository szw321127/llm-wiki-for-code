#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOME_MARKETPLACE_NAME = "local-project-knowledge";
const HOME_MARKETPLACE_DISPLAY_NAME = "Local Project Knowledge";
const HOME_PLUGIN_NAME = "pk";

export function resolveCodexHomeLocalPaths({
  repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  homeDir = os.homedir()
} = {}) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedHomeDir = path.resolve(homeDir);

  return {
    repositoryRoot: resolvedRepositoryRoot,
    homeDir: resolvedHomeDir,
    sourcePluginPath: path.join(resolvedRepositoryRoot, "plugins", HOME_PLUGIN_NAME),
    homePluginParent: path.join(resolvedHomeDir, "plugins"),
    homePluginPath: path.join(resolvedHomeDir, "plugins", HOME_PLUGIN_NAME),
    homeAgentsPluginRoot: path.join(resolvedHomeDir, ".agents", "plugins"),
    homeMarketplacePath: path.join(
      resolvedHomeDir,
      ".agents",
      "plugins",
      "marketplace.json"
    )
  };
}

export function buildInstalledByDefaultEntry(pluginName = HOME_PLUGIN_NAME) {
  return {
    name: pluginName,
    source: {
      source: "local",
      path: `./plugins/${pluginName}`
    },
    policy: {
      installation: "INSTALLED_BY_DEFAULT",
      authentication: "ON_INSTALL"
    },
    category: "Productivity"
  };
}

export function upsertHomeMarketplace(existingPayload, pluginEntry) {
  const payload =
    existingPayload && typeof existingPayload === "object"
      ? structuredClone(existingPayload)
      : {};

  if (!payload.name) {
    payload.name = HOME_MARKETPLACE_NAME;
  }

  if (!payload.interface || typeof payload.interface !== "object") {
    payload.interface = {
      displayName: HOME_MARKETPLACE_DISPLAY_NAME
    };
  } else if (!payload.interface.displayName) {
    payload.interface.displayName = HOME_MARKETPLACE_DISPLAY_NAME;
  }

  const plugins = Array.isArray(payload.plugins) ? payload.plugins.filter(Boolean) : [];
  const nextPlugins = plugins.filter((plugin) => plugin?.name !== pluginEntry.name);
  nextPlugins.push(pluginEntry);
  payload.plugins = nextPlugins;

  return payload;
}

export function removePluginFromMarketplace(existingPayload, pluginName = HOME_PLUGIN_NAME) {
  if (!existingPayload || typeof existingPayload !== "object") {
    return null;
  }

  const payload = structuredClone(existingPayload);
  const plugins = Array.isArray(payload.plugins) ? payload.plugins.filter(Boolean) : [];
  payload.plugins = plugins.filter((plugin) => plugin?.name !== pluginName);

  if (payload.plugins.length === 0) {
    return null;
  }

  return payload;
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

async function ensurePluginLink(sourcePluginPath, homePluginPath) {
  await fs.mkdir(path.dirname(homePluginPath), { recursive: true });

  if (await exists(homePluginPath)) {
    const currentRealPath = await fs.realpath(homePluginPath);
    const expectedRealPath = await fs.realpath(sourcePluginPath);

    if (path.normalize(currentRealPath) === path.normalize(expectedRealPath)) {
      return "unchanged";
    }

    throw new Error(
      `已存在其它 pk 插件目录，未自动覆盖: ${homePluginPath}\n当前指向: ${currentRealPath}`
    );
  }

  await fs.symlink(sourcePluginPath, homePluginPath, "junction");
  return "created";
}

export async function installCodexLocalPlugin({
  repositoryRoot,
  homeDir
} = {}) {
  const paths = resolveCodexHomeLocalPaths({ repositoryRoot, homeDir });

  if (!(await exists(paths.sourcePluginPath))) {
    throw new Error(`未找到源插件目录: ${paths.sourcePluginPath}`);
  }

  const linkStatus = await ensurePluginLink(paths.sourcePluginPath, paths.homePluginPath);
  const existingMarketplace = await readJsonIfPresent(paths.homeMarketplacePath);
  const nextMarketplace = upsertHomeMarketplace(
    existingMarketplace,
    buildInstalledByDefaultEntry()
  );

  await writeJson(paths.homeMarketplacePath, nextMarketplace);

  return {
    action: "install",
    paths,
    linkStatus,
    marketplaceStatus: existingMarketplace ? "updated" : "created"
  };
}

export async function uninstallCodexLocalPlugin({
  repositoryRoot,
  homeDir
} = {}) {
  const paths = resolveCodexHomeLocalPaths({ repositoryRoot, homeDir });
  const existingMarketplace = await readJsonIfPresent(paths.homeMarketplacePath);
  const nextMarketplace = removePluginFromMarketplace(existingMarketplace);

  if (nextMarketplace) {
    await writeJson(paths.homeMarketplacePath, nextMarketplace);
  } else {
    await removePathIfPresent(paths.homeMarketplacePath);
  }

  const removedPluginPath = await removePathIfPresent(paths.homePluginPath);

  return {
    action: "uninstall",
    paths,
    removedPluginPath,
    marketplaceStatus: existingMarketplace ? "updated" : "absent"
  };
}

function formatSummary(summary) {
  if (summary.action === "install") {
    return [
      "已完成 Codex 本地插件安装准备。",
      `- 源插件: ${summary.paths.sourcePluginPath}`,
      `- Home 插件: ${summary.paths.homePluginPath} (${summary.linkStatus})`,
      `- Home marketplace: ${summary.paths.homeMarketplacePath} (${summary.marketplaceStatus})`,
      "- marketplace 策略: INSTALLED_BY_DEFAULT",
      "- 下一步: 完全重启 Codex，让 /pk:* 在启动时被原生发现。"
    ].join("\n");
  }

  return [
    "已完成 Codex 本地插件卸载清理。",
    `- Home 插件: ${summary.paths.homePluginPath} (${summary.removedPluginPath ? "removed" : "absent"})`,
    `- Home marketplace: ${summary.paths.homeMarketplacePath} (${summary.marketplaceStatus})`
  ].join("\n");
}

async function main() {
  const action = process.argv[2] === "uninstall" ? "uninstall" : "install";
  const runner =
    action === "install" ? installCodexLocalPlugin : uninstallCodexLocalPlugin;
  const summary = await runner();
  console.log(formatSummary(summary));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
