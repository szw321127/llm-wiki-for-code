# Open Graph Launcher Design

## Goal

After `pk:init`, generate a Windows-friendly launcher script inside the target project's `.project-knowledge/` directory so the user can open the graph preview without manually typing a serve command.

## Context

The current implementation keeps the target project clean by generating only `.project-knowledge/` artifacts and leaving all serving logic in the tool repository. That separation is correct, but the current UX forces the user to remember and type `npm run pk:serve -- <project> 8124` or invoke `$pk:serve`.

## Requirements

- Do not modify the target project's `package.json`.
- Generate a single `open-graph.cmd` file under `.project-knowledge/`.
- Double-clicking the script should:
  - start the local preview server in a separate PowerShell window
  - open the browser to `http://127.0.0.1:8124/graph/knowledge-graph.html`
- The script must not depend on the caller's current working directory.
- The generated script should reuse the current Node executable and the repository's existing `serve-project-knowledge.mjs`.

## Proposed Approach

Write the launcher during `initializeProjectKnowledge()` after graph artifacts are generated. The launcher will embed:

- the current Node executable path via `process.execPath`
- the absolute path to `scripts/serve-project-knowledge.mjs`
- the target project root
- the default port `8124`, with optional `%1` override for future flexibility

The `.cmd` file will:

1. compute the project root relative to its own location
2. start a new PowerShell window running the preview server
3. wait briefly
4. open the graph URL in the default browser

## Why This Approach

- Preserves the existing architecture: knowledge data stays in the target project, tooling stays in the skill repository.
- Avoids polluting business repositories with package scripts or dependencies.
- Produces the UX the user asked for with minimal surface area.

## Testing

- Extend `tests/init.test.mjs` to assert that `initializeProjectKnowledge()` creates `.project-knowledge/open-graph.cmd`.
- Verify the file references the preview server script and default port.

