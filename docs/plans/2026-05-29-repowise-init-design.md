# Repowise Init Design

## Goal

Package this project as Repowise so a user can install it once, then run `repowise init` from any target project to finish the local knowledge setup.

## Command Experience

`repowise init` is the primary entrypoint. It defaults to the current working directory as the project root and accepts an optional project path:

```powershell
repowise init
repowise init E:\path\to\project
```

The command creates the project knowledge vault, installs agent skills, and reports a JSON summary of created, updated, skipped, and migrated paths.

## Agent Flags

`repowise init` installs both Codex and Claude skills by default. Agent flags restrict only the skill targets; the project knowledge vault is still initialized.

```text
repowise init
  Initialize .repowise/ plus Codex and Claude skills.

repowise init --codex
  Initialize .repowise/ plus Codex skills only.

repowise init --claude
  Initialize .repowise/ plus Claude skills only.

repowise init --no-global
  Skip user-level skill installation.

repowise init --no-project-skills
  Skip project-level skill installation.

repowise init --force
  Replace existing Repowise-managed skill directories.

repowise init --migrate
  Rename an existing .project-knowledge/ vault to .repowise/ when .repowise/ does not already exist.
```

## Directory Model

The project-owned knowledge directory becomes `.repowise/`. It replaces `.project-knowledge/` as the source of truth for Markdown nodes, state, graph artifacts, Obsidian files, templates, and the graph launcher.

Skill installation targets:

```text
%USERPROFILE%/.agents/skills/repowise-*    # user-level Codex skills
%USERPROFILE%/.claude/skills/repowise-*    # user-level Claude skills
<project>/.agents/skills/repowise-*        # project-level Codex skills
<project>/.claude/skills/repowise-*        # project-level Claude skills
```

The npm package keeps `plugins/pk/skills` as the source skill bundle for this migration. During init, Repowise copies those skills to the selected targets with `repowise-*` names and updated skill metadata.

## Compatibility

Existing `pk:*` npm scripts can remain as compatibility wrappers while documentation and package bin entries move users toward `repowise`.

Runtime scripts should prefer `.repowise/`. They may accept a direct `.repowise/` path or a project root. Legacy `.project-knowledge/` should not be created by new init flows. A legacy vault is migrated only when `--migrate` is explicit.

## Error Handling

The command should fail before mutating if incompatible flags are supplied or if a target contains an existing non-Repowise skill directory and `--force` is not set.

If `.project-knowledge/` exists and `.repowise/` is absent, `repowise init` without `--migrate` should explain the legacy vault and ask the user to rerun with `--migrate`.

## Testing

Focused tests should cover:

- `initializeProjectKnowledge()` creates `.repowise/`.
- `repowise init` defaults to the current working directory.
- `repowise init --codex` installs only Codex skills.
- `repowise init --claude` installs only Claude skills.
- `repowise init --no-global` and `--no-project-skills` scope the writes.
- `repowise init --migrate` renames `.project-knowledge/` to `.repowise/`.
- Package metadata exposes the `repowise` bin.
