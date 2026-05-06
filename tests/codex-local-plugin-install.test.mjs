import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildInstalledByDefaultEntry,
  removePluginFromMarketplace,
  resolveCodexHomeLocalPaths,
  upsertHomeMarketplace
} from "../scripts/install-codex-local-plugin.mjs";

test("resolveCodexHomeLocalPaths uses the home-local plugin convention", () => {
  const repositoryRoot = path.resolve("test-repository");
  const homeDir = path.resolve("test-home");
  const paths = resolveCodexHomeLocalPaths({
    repositoryRoot,
    homeDir
  });

  assert.equal(
    paths.sourcePluginPath,
    path.join(repositoryRoot, "plugins", "pk")
  );
  assert.equal(paths.homePluginPath, path.join(homeDir, "plugins", "pk"));
  assert.equal(
    paths.homeMarketplacePath,
    path.join(homeDir, ".agents", "plugins", "marketplace.json")
  );
});

test("buildInstalledByDefaultEntry produces a Codex auto-installed home-local entry", () => {
  assert.deepEqual(buildInstalledByDefaultEntry(), {
    name: "pk",
    source: {
      source: "local",
      path: "./plugins/pk"
    },
    policy: {
      installation: "INSTALLED_BY_DEFAULT",
      authentication: "ON_INSTALL"
    },
    category: "Productivity"
  });
});

test("upsertHomeMarketplace appends pk while preserving existing metadata", () => {
  const existing = {
    name: "my-local-plugins",
    interface: {
      displayName: "My Local Plugins"
    },
    plugins: [
      {
        name: "other-plugin",
        source: {
          source: "local",
          path: "./plugins/other-plugin"
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL"
        },
        category: "Productivity"
      }
    ]
  };

  const next = upsertHomeMarketplace(existing, buildInstalledByDefaultEntry());

  assert.equal(next.name, "my-local-plugins");
  assert.equal(next.interface.displayName, "My Local Plugins");
  assert.equal(next.plugins.length, 2);
  assert.equal(next.plugins[0].name, "other-plugin");
  assert.equal(next.plugins[1].name, "pk");
  assert.equal(next.plugins[1].policy.installation, "INSTALLED_BY_DEFAULT");
});

test("upsertHomeMarketplace replaces an existing pk entry in place of stale config", () => {
  const existing = {
    name: "local-project-knowledge",
    interface: {
      displayName: "Local Project Knowledge"
    },
    plugins: [
      {
        name: "pk",
        source: {
          source: "local",
          path: "./plugins/pk"
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_USE"
        },
        category: "Old"
      }
    ]
  };

  const next = upsertHomeMarketplace(existing, buildInstalledByDefaultEntry());

  assert.equal(next.plugins.length, 1);
  assert.deepEqual(next.plugins[0], buildInstalledByDefaultEntry());
});

test("removePluginFromMarketplace keeps unrelated plugins and drops empty payloads", () => {
  const mixed = {
    name: "local-plugins",
    interface: {
      displayName: "Local Plugins"
    },
    plugins: [
      buildInstalledByDefaultEntry(),
      {
        name: "other-plugin",
        source: {
          source: "local",
          path: "./plugins/other-plugin"
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL"
        },
        category: "Productivity"
      }
    ]
  };

  const kept = removePluginFromMarketplace(mixed);
  assert.equal(kept.plugins.length, 1);
  assert.equal(kept.plugins[0].name, "other-plugin");

  const removedAll = removePluginFromMarketplace({
    name: "local-project-knowledge",
    interface: {
      displayName: "Local Project Knowledge"
    },
    plugins: [buildInstalledByDefaultEntry()]
  });

  assert.equal(removedAll, null);
});
