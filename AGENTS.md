# Repository Guidelines

## Project Overview

Quasar 2/Vue 3 personal site with a PlayCanvas isometric 3D game layer. `src/layouts/MainLayout.vue` composes the visible site shell; `src/pages/IndexPage.vue` is a route placeholder. Game generation and rendering belong in `src/game/`; PixiJS is legacy asset-management code, not the game renderer.

Start with [docs/ai/task-map.md](docs/ai/task-map.md) for task locations and focused verification. Read only the relevant focused rule files in `docs/ai/`.

## Architecture Invariants

- Render visible game overlays, prompts, status, counters, and controls as PlayCanvas HUD under `src/game/ui/`, not as visible HTML over `GameCanvas.vue`. Hidden HTML may mirror text for accessibility semantics.
- Authored entities at map coordinates must enter through the map's `objects` array. Their object class owns rendering and behavior. Generic infrastructure may discover shared needs such as model URLs; do not add entity-specific fields, collections, imports, preload entries, or rendering branches to `PlayCanvasRenderer`. If normal object integration cannot support the entity, ask before adding a special case.

## Universal Code Rules

Follow `.editorconfig` and [docs/ai/code-style.md](docs/ai/code-style.md). ESLint and Prettier configuration define enforced style. Store temporary helper, conversion, migration, and diagnostic scripts in ignored project-root `tmp/`; never stage or commit its contents.

## Verification

Choose the smallest check that covers changed behavior, as listed in the task map and [docs/ai/testing.md](docs/ai/testing.md). Avoid broad suites by default. Before a build or Prettier command, check whether `http://localhost:9000` is accessible; if so, skip that build or formatting step. Relevant lint and focused checks may still run.

## Focused Rules

- Runtime error recovery: [docs/ai/runtime-errors.md](docs/ai/runtime-errors.md)
- Map generation, terrain, paths, water, or validation: [docs/ai/map-generation.md](docs/ai/map-generation.md)
- Stable visible 3D models or props: [docs/ai/blender-models.md](docs/ai/blender-models.md)
- Physical contact, collision, forces, gravity, inertia, joints, raycasts, rigid bodies, or soft bodies: [docs/ai/game-physics.md](docs/ai/game-physics.md)
- Hero dodge movement: [docs/ai/dodge-movement.md](docs/ai/dodge-movement.md)
- Game errors and enums: [docs/ai/game-code-style.md](docs/ai/game-code-style.md)
- Test creation, organization, and selection: [docs/ai/testing.md](docs/ai/testing.md)
