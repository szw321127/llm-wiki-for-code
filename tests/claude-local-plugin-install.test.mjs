import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  installClaudeLocalPlugin,
  resolveClaudePluginPaths,
  removeEnabledPlugin,
  removePluginFromInstalled,
  uninstallClaudeLocalPlugin,
  upsertEnabledPlugin,
  upsertInstalledPlugins
} from "../scripts/install-claude-local-plugin.mjs";

async function exists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

test("resolveClaudePluginPaths uses the plugin directory convention", () => {
  const repositoryRoot = path.resolve("test-repository");
  const homeDir = path.resolve("test-home");
  const paths = resolveClaudePluginPaths({
    repositoryRoot,
    homeDir
  });

  assert.equal(
    paths.sourcePluginPath,
    path.join(repositoryRoot, "plugins", "pk")
  );
  assert.equal(
    paths.cachePluginPath,
    path.join(homeDir, ".claude", "plugins", "cache", "local", "pk", "0.1.16")
  );
  assert.equal(
    paths.installedPluginsPath,
    path.join(homeDir, ".claude", "plugins", "installed_plugins.json")
  );
  assert.equal(
    paths.settingsPath,
    path.join(homeDir, ".claude", "settings.json")
  );
  assert.equal(
    paths.oldSkillsPath,
    path.join(homeDir, ".claude", "skills", "pk")
  );
});

test("upsertInstalledPlugins creates a new payload when absent", () => {
  const installPath = path.resolve("/test/cache/pk");
  const next = upsertInstalledPlugins(null, installPath);

  assert.equal(next.version, 2);
  assert.ok(next.plugins["pk@local"]);
  assert.equal(next.plugins["pk@local"][0].scope, "user");
  assert.equal(next.plugins["pk@local"][0].installPath, installPath);
  assert.equal(next.plugins["pk@local"][0].version, "0.1.16");
  assert.ok(next.plugins["pk@local"][0].installedAt);
  assert.ok(next.plugins["pk@local"][0].lastUpdated);
});

test("upsertInstalledPlugins preserves existing plugins", () => {
  const existing = {
    version: 2,
    plugins: {
      "other@marketplace": [
        {
          scope: "user",
          installPath: "/test/other",
          version: "1.0.0",
          installedAt: "2024-01-01T00:00:00.000Z",
          lastUpdated: "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  };

  const installPath = path.resolve("/test/cache/pk");
  const next = upsertInstalledPlugins(existing, installPath);

  assert.equal(next.version, 2);
  assert.ok(next.plugins["other@marketplace"]);
  assert.ok(next.plugins["pk@local"]);
  assert.equal(next.plugins["pk@local"][0].installPath, installPath);
});

test("upsertInstalledPlugins replaces an existing pk@local entry", () => {
  const existing = {
    version: 2,
    plugins: {
      "pk@local": [
        {
          scope: "user",
          installPath: "/old/path",
          version: "0.1.0",
          installedAt: "2024-01-01T00:00:00.000Z",
          lastUpdated: "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  };

  const installPath = path.resolve("/test/cache/pk");
  const next = upsertInstalledPlugins(existing, installPath);

  assert.equal(next.plugins["pk@local"].length, 1);
  assert.equal(next.plugins["pk@local"][0].installPath, installPath);
  assert.equal(next.plugins["pk@local"][0].version, "0.1.16");
});

test("removePluginFromInstalled removes pk@local and keeps others", () => {
  const existing = {
    version: 2,
    plugins: {
      "pk@local": [
        {
          scope: "user",
          installPath: "/test/pk",
          version: "0.1.16",
          installedAt: "2024-01-01T00:00:00.000Z",
          lastUpdated: "2024-01-01T00:00:00.000Z"
        }
      ],
      "other@marketplace": [
        {
          scope: "user",
          installPath: "/test/other",
          version: "1.0.0",
          installedAt: "2024-01-01T00:00:00.000Z",
          lastUpdated: "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  };

  const next = removePluginFromInstalled(existing);

  assert.ok(!next.plugins["pk@local"]);
  assert.ok(next.plugins["other@marketplace"]);
});

test("removePluginFromInstalled returns null when payload is absent", () => {
  const next = removePluginFromInstalled(null);
  assert.equal(next, null);
});

test("upsertEnabledPlugin creates enabledPlugins when absent", () => {
  const next = upsertEnabledPlugin(null, "pk@local", true);

  assert.equal(next.enabledPlugins["pk@local"], true);
});

test("upsertEnabledPlugin preserves existing settings", () => {
  const existing = {
    env: { FOO: "bar" },
    enabledPlugins: {
      "other@marketplace": true
    }
  };

  const next = upsertEnabledPlugin(existing, "pk@local", true);

  assert.equal(next.env.FOO, "bar");
  assert.equal(next.enabledPlugins["other@marketplace"], true);
  assert.equal(next.enabledPlugins["pk@local"], true);
});

test("upsertEnabledPlugin replaces existing entry", () => {
  const existing = {
    enabledPlugins: {
      "pk@local": false
    }
  };

  const next = upsertEnabledPlugin(existing, "pk@local", true);

  assert.equal(next.enabledPlugins["pk@local"], true);
});

test("removeEnabledPlugin removes pk@local and keeps others", () => {
  const existing = {
    env: { FOO: "bar" },
    enabledPlugins: {
      "pk@local": true,
      "other@marketplace": true
    }
  };

  const next = removeEnabledPlugin(existing, "pk@local");

  assert.equal(next.env.FOO, "bar");
  assert.ok(!next.enabledPlugins["pk@local"]);
  assert.equal(next.enabledPlugins["other@marketplace"], true);
});

test("removeEnabledPlugin returns null when payload is absent", () => {
  const next = removeEnabledPlugin(null, "pk@local");
  assert.equal(next, null);
});

test("installClaudeLocalPlugin copies plugin to cache and writes installed_plugins.json and settings.json", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pk-claude-test-"));
  const homeDir = path.join(tmpDir, "home");
  const repoRoot = path.join(tmpDir, "repo");

  const pluginPath = path.join(repoRoot, "plugins", "pk");
  await fs.mkdir(path.join(pluginPath, ".claude-plugin"), { recursive: true });
  await fs.writeFile(
    path.join(pluginPath, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "pk", version: "0.1.16" }),
    "utf8"
  );
  await fs.mkdir(path.join(pluginPath, "skills", "pk-init"), { recursive: true });
  await fs.writeFile(
    path.join(pluginPath, "skills", "pk-init", "SKILL.md"),
    "---\nname: pk-init\n---\n# PK Init\n",
    "utf8"
  );

  const summary = await installClaudeLocalPlugin({
    repositoryRoot: repoRoot,
    homeDir
  });

  assert.equal(summary.action, "install");
  assert.equal(summary.pluginsStatus, "created");
  assert.equal(summary.settingsStatus, "created");

  const cachePath = path.join(homeDir, ".claude", "plugins", "cache", "local", "pk", "0.1.16");
  assert.ok(await exists(cachePath));
  assert.ok(await exists(path.join(cachePath, ".claude-plugin", "plugin.json")));
  assert.ok(await exists(path.join(cachePath, "skills", "pk-init", "SKILL.md")));

  const installedPluginsPath = path.join(homeDir, ".claude", "plugins", "installed_plugins.json");
  const installed = JSON.parse(await fs.readFile(installedPluginsPath, "utf8"));

  assert.equal(installed.version, 2);
  assert.ok(installed.plugins["pk@local"]);
  assert.equal(installed.plugins["pk@local"][0].scope, "user");
  assert.equal(installed.plugins["pk@local"][0].installPath, cachePath);
  assert.equal(installed.plugins["pk@local"][0].version, "0.1.16");

  const settingsPath = path.join(homeDir, ".claude", "settings.json");
  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));

  assert.equal(settings.enabledPlugins["pk@local"], true);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("installClaudeLocalPlugin cleans up old skills directory and stale cache", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pk-claude-test-"));
  const homeDir = path.join(tmpDir, "home");
  const repoRoot = path.join(tmpDir, "repo");

  const oldSkillsPath = path.join(homeDir, ".claude", "skills", "pk");
  await fs.mkdir(oldSkillsPath, { recursive: true });
  await fs.writeFile(path.join(oldSkillsPath, "old.md"), "old", "utf8");

  const staleCachePath = path.join(homeDir, ".claude", "plugins", "cache", "local", "pk", "0.1.16");
  await fs.mkdir(staleCachePath, { recursive: true });
  await fs.writeFile(path.join(staleCachePath, "stale.txt"), "stale", "utf8");

  const pluginPath = path.join(repoRoot, "plugins", "pk");
  await fs.mkdir(path.join(pluginPath, ".claude-plugin"), { recursive: true });
  await fs.writeFile(
    path.join(pluginPath, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "pk", version: "0.1.16" }),
    "utf8"
  );

  await installClaudeLocalPlugin({
    repositoryRoot: repoRoot,
    homeDir
  });

  assert.ok(!(await exists(oldSkillsPath)));
  assert.ok(!(await exists(path.join(staleCachePath, "stale.txt"))));
  assert.ok(await exists(path.join(staleCachePath, ".claude-plugin", "plugin.json")));

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("installClaudeLocalPlugin throws when plugin.json is missing", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pk-claude-test-"));
  const homeDir = path.join(tmpDir, "home");
  const repoRoot = path.join(tmpDir, "repo");

  const pluginPath = path.join(repoRoot, "plugins", "pk");
  await fs.mkdir(pluginPath, { recursive: true });

  await assert.rejects(
    async () =>
      installClaudeLocalPlugin({
        repositoryRoot: repoRoot,
        homeDir
      }),
    /未找到 Claude Code plugin.json/
  );

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("uninstallClaudeLocalPlugin removes pk@local from installed_plugins and settings", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pk-claude-test-"));
  const homeDir = path.join(tmpDir, "home");
  const repoRoot = path.join(tmpDir, "repo");

  const installedPluginsPath = path.join(homeDir, ".claude", "plugins", "installed_plugins.json");
  await fs.mkdir(path.dirname(installedPluginsPath), { recursive: true });
  await fs.writeFile(
    installedPluginsPath,
    JSON.stringify({
      version: 2,
      plugins: {
        "pk@local": [
          {
            scope: "user",
            installPath: "/test/pk",
            version: "0.1.16",
            installedAt: "2024-01-01T00:00:00.000Z",
            lastUpdated: "2024-01-01T00:00:00.000Z"
          }
        ],
        "other@marketplace": [
          {
            scope: "user",
            installPath: "/test/other",
            version: "1.0.0",
            installedAt: "2024-01-01T00:00:00.000Z",
            lastUpdated: "2024-01-01T00:00:00.000Z"
          }
        ]
      }
    }),
    "utf8"
  );

  const settingsPath = path.join(homeDir, ".claude", "settings.json");
  await fs.writeFile(
    settingsPath,
    JSON.stringify({
      env: { FOO: "bar" },
      enabledPlugins: {
        "pk@local": true,
        "other@marketplace": true
      }
    }),
    "utf8"
  );

  const cachePath = path.join(homeDir, ".claude", "plugins", "cache", "local", "pk", "0.1.16");
  await fs.mkdir(cachePath, { recursive: true });
  await fs.writeFile(path.join(cachePath, "test.txt"), "test", "utf8");

  const summary = await uninstallClaudeLocalPlugin({
    repositoryRoot: repoRoot,
    homeDir
  });

  assert.equal(summary.action, "uninstall");
  assert.equal(summary.pluginsStatus, "updated");
  assert.equal(summary.settingsStatus, "updated");
  assert.equal(summary.removedCache, true);

  const installed = JSON.parse(await fs.readFile(installedPluginsPath, "utf8"));
  assert.ok(!installed.plugins["pk@local"]);
  assert.ok(installed.plugins["other@marketplace"]);

  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  assert.ok(!settings.enabledPlugins["pk@local"]);
  assert.equal(settings.enabledPlugins["other@marketplace"], true);
  assert.equal(settings.env.FOO, "bar");

  assert.ok(!(await exists(cachePath)));

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("uninstallClaudeLocalPlugin handles absent files gracefully", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pk-claude-test-"));
  const homeDir = path.join(tmpDir, "home");
  const repoRoot = path.join(tmpDir, "repo");

  const summary = await uninstallClaudeLocalPlugin({
    repositoryRoot: repoRoot,
    homeDir
  });

  assert.equal(summary.action, "uninstall");
  assert.equal(summary.pluginsStatus, "absent");
  assert.equal(summary.settingsStatus, "absent");

  await fs.rm(tmpDir, { recursive: true, force: true });
});
