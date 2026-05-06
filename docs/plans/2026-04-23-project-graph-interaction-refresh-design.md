# Project Graph Interaction Refresh Design

## Goal

Improve the project knowledge graph reading experience by making the canvas the single primary interaction surface, moving project-level information into the graph itself, and simplifying the detail drawer UI.

## Current Problems

- The page repeats project-level information in multiple places: the top hero copy and `project-summary-strip`.
- The canvas is visually secondary because too much vertical space is consumed before the user reaches the graph.
- The right-side detail drawer mixes multiple visual systems (`detail-stage`, `score-hero`, `detail-section`), which makes hierarchy unstable and noisy.
- The interaction model is inconsistent: `project_profile` exists as a graph node type, but project information is also rendered outside the graph as a separate summary strip.

## Approved Direction

The chosen direction is the “structure unified” approach:

- Remove the standalone project summary strip.
- Treat the project profile as a first-class graph node inside the interactive canvas.
- Keep the right-side fixed drawer, but redesign it into a cleaner single-column information panel.
- Compress top controls into a tighter primary toolbar.
- Move secondary filters into a collapsible panel below the toolbar instead of permanently occupying horizontal space.

## Layout Design

### Top Region

- Keep a concise top shell with page title and short supporting copy.
- Replace the current permanently expanded two-row control layout with:
  - primary row: `project-view`, `search`, `filter toggle`, `reset`
  - secondary filter panel: `context`, `constraint`, `type`, `include incubating`, `adopted only`
- The secondary filter panel is hidden by default and expands inline below the primary toolbar.

### Graph Canvas

- The canvas remains the dominant surface and gets more vertical focus after removing the summary strip.
- `practice` continues to anchor the main reading path.
- `recommended option` remains visually attached to its `practice`.
- `context`, `constraint`, `rule`, and `project_profile` all belong to the auxiliary annotation layer.
- `project_profile` becomes a visually stronger badge-like node within the graph instead of an external summary block.

### Project Profile Node

- Render the project profile as a dedicated graph node, placed near the upper-left anchor area of the scene.
- It should be more prominent than generic auxiliary badges, but still less visually dominant than a `practice` card.
- Its purpose is to act as the project context entry point for the graph, not as a banner.

## Detail Drawer Design

The drawer remains fixed on the right, but adopts one unified card language.

### Structure

For every selected node, render the drawer as a single-column stack:

1. Header block
   - title
   - type
   - maturity/status
   - one-line summary
2. Key facts block
   - node-specific metrics or recommendation info
3. Relations block
   - clickable related nodes
4. Body block
   - markdown content
5. Evidence block
   - source path
   - source evidence
   - usage/adoption stats when present

### Node-Specific Rules

- `project_profile`
  - show project title, tech stack, adopted rule count, preferred option count
- `practice`
  - show current recommended option, candidate count, related rule count
- `option`
  - show final score, base score, adjustment, recommendation state
- auxiliary nodes
  - show lightweight overview plus related practices

### Visual Cleanup

- Remove the current stacked large-hero treatment in the drawer.
- Use one consistent surface style for drawer sections.
- Keep clickable relation chips, but make them visually consistent and button-like without mixing multiple chip/button patterns.

## Interaction Model

- The main user path becomes:
  1. inspect the graph
  2. click any node, including the project profile node
  3. inspect details in the right drawer
  4. continue traversal via related-node actions in the drawer

- The graph, not the page chrome, becomes the source of truth for project context navigation.

## Testing Strategy

- Update shell tests to remove assumptions about `project-summary-strip`.
- Add structural assertions for:
  - project profile being integrated into the graph shell instead of a summary strip
  - collapsible filter panel markup
  - simplified drawer structure markers
- Run targeted shell tests and full `npm test`.

