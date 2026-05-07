# Contributing

Project Knowledge is a local-first tool for coding-agent project memory. Contributions are most useful when they improve real Codex, Claude Code, or long-running repository workflows.

## Good First Contributions

- Improve the README or `READE_CN.md` with clearer examples.
- Add a small sample project under `tests/fixtures/` or a documented demo under `docs/`.
- Improve error messages in `scripts/`.
- Add tests around evidence filtering, recommendation-pool behavior, or plugin wrappers.
- Report where the workflow is confusing in a real project.

## Development

Run the full test suite before sending changes:

```bash
npm test
```

Useful commands:

```bash
npm run pk:init -- <project-root>
npm run pk:preflight -- <project-root> "task description"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
npm run pk:lint -- <project-root>
npm run pk:govern -- <project-root>
npm run pk:serve -- <project-root> 8124
```

## Evidence Rules

Long-term `source_evidence` should point to stable source files, not temporary planning files, generated artifacts, local tool state, or documentation-only context.

Avoid using these as durable evidence:

- `.worktrees/`
- `.project-knowledge/`
- `.agents/`
- `.codex/`
- `node_modules/`
- `docs/`
- `task_plan.md`
- `findings.md`
- `progress.md`

## Pull Requests

Keep pull requests focused. Include:

- What changed.
- Why it matters for project memory or plugin usage.
- How you tested it.
- Any compatibility concerns for existing Codex or Claude Code installs.

## Plugin Updates

After changing plugin files, reinstall or update the local plugin and fully restart the client:

```bash
npm run codex:install
```

Claude Code:

```bash
/plugin update pk@local-project-knowledge
```
