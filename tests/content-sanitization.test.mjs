import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(".");
const ignoredDirectories = new Set([".git", "node_modules"]);
const ignoredExtensions = new Set([".exe", ".zip", ".msi", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const forbiddenFragments = [
  ["d", "x", "m"].join(""),
  fromCodePoints([0x91c7, 0x8d2d, 0x5355]),
  fromCodePoints([0x6dd8, 0x5b9d]),
  fromCodePoints([0x62fc, 0x591a, 0x591a]),
  fromCodePoints([0x5f85, 0x5230, 0x8d27]),
  ["Admin", "istrator"].join(""),
  fromCodePoints([0x672c, 0x673a]),
  fromCodePoints([0x672c, 0x7535, 0x8111])
];
const forbiddenPatterns = [
  {
    name: "Windows absolute path",
    pattern: /(?<![A-Za-z])[A-Za-z]:[\\/](?![\\/])[^\r\n"'`<>)]*/g
  },
  {
    name: "Escaped Windows absolute path",
    pattern: /(?<![A-Za-z])[A-Za-z]:\\\\[^\r\n"'`<>)]*/g
  },
  {
    name: "Unix user home path",
    pattern: /\/Users\/[^\s"'`<>)]*/g
  }
];

test("repository content does not contain project-specific or machine-local residue", async () => {
  const matches = [];

  for (const filePath of await collectTextFiles(root)) {
    const content = await fs.readFile(filePath, "utf8");
    const normalized = content.toLowerCase();
    for (const fragment of forbiddenFragments) {
      if (normalized.includes(fragment.toLowerCase())) {
        matches.push(path.relative(root, filePath).replace(/\\/g, "/"));
        break;
      }
    }

    for (const { name, pattern } of forbiddenPatterns) {
      pattern.lastIndex = 0;
      const result = pattern.exec(content);
      if (result) {
        matches.push(`${path.relative(root, filePath).replace(/\\/g, "/")} (${name}: ${result[0]})`);
        break;
      }
    }
  }

  assert.deepEqual(matches.sort(), []);
});

async function collectTextFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTextFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && !ignoredExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  }

  return files;
}

function fromCodePoints(values) {
  return String.fromCodePoint(...values);
}
