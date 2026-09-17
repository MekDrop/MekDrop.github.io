# Repository Guidelines

## Project Structure & Module Organization

This is a Quasar 2/Vue 3 personal site with a PlayCanvas isometric 3D game layer. `src/layouts/MainLayout.vue` composes the visible site shell, while `src/pages/IndexPage.vue` is intentionally only a route placeholder. UI components live in `src/components/`; Pinia state is in `src/stores/`; routing and locale-prefixed routes are defined in `src/router/`. Game generation and PlayCanvas rendering belong in `src/game/`, with reusable state classes under `src/states/` and asset registries/configuration under `src/assets/`. PixiJS remains in use by some legacy asset-management code, but it is not the current game renderer. Locale content is stored as YAML in `src/i18n/`; adding a locale file also adds an SSG route through `quasar.config.js`. Static, unbundled files belong in `public/`. SSR middleware is isolated in `src-ssr/`.

## Build, Test, and Development Commands

- `npm install` installs locked dependencies; use Node 24+ and npm 11.9+.
- `npm run dev:spa`, `npm run dev:ssr`, and `npm run dev:ssg` start the mode-specific development servers.
- `npm run build:spa`, `npm run build:ssr`, and `npm run build:ssg` create mode-specific builds.
- `npm run serve:ssg` serves the generated `dist/ssg` output.
- `npm run lint` checks JavaScript and Vue files with ESLint.
- `npm run format` formats JavaScript, Vue, and SCSS files with Prettier.
- `npm run test:e2e:ci -- --spec test/cypress/e2e/IndexPage.cy.js` runs the current E2E spec headlessly; `npm run test:e2e` opens Cypress interactively.
- `npm run test:e2e:ci` runs all Cypress E2E specs headlessly. Prefer this command for broad E2E coverage instead of passing a bare `*` wildcard to `npx cypress run`.

Before running a build command or a Prettier check/format command, check whether `http://localhost:9000` is accessible. If it is accessible, skip both build and Prettier steps; other relevant checks such as lint may still run.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, LF endings, two-space indentation, final newlines, and no trailing whitespace. ESLint uses Vue's essential rules plus `eslint-config-prettier`; production builds reject `debugger` statements. Run Prettier rather than hand-aligning code. Vue component filenames and component names use PascalCase. Prefer configured aliases such as `src/*`, `components/*`, and `stores/*` over deep relative imports.
For class methods that are zero-argument, read-only accessors, prefer ES6 getter syntax (`get value()`) over `getValue()` methods when the method is called like property access.
For class mutators that are simple one-argument property writes (for example `setVisible`, `setEntranceVisible`, `setArrowsVisible`) and are naturally used as properties, prefer ES6 setter syntax (`set value(...)`) over explicit methods.
Prefer explicit brace blocks for guard-style conditionals, even for single statements; avoid `if (cond) return ...;` and use:

```js
if (cond) {
  return ...;
}
```
For JavaScript class internals, use modern ES private class syntax (#privateField, #privateMethod()) instead of underscore-prefixed pseudo-private fields or methods.
Prefer one primary class per JavaScript file when the code models a distinct system or component. Avoid large utility-style files that accumulate many unrelated constants, variables, and free functions when that logic belongs inside a cohesive class.
Never throw or reject with the built-in `Error` directly (`new Error(...)`). Define a named custom class that extends `Error`; the class must own its predefined message or message template, while call sites pass only structured context needed by that template. Use a separate error class for each distinct failure condition: call sites must not provide an error message or select one through an error code.
Store every error owned or thrown by code under `src/game/` in `src/game/errors/`, even when the failure involves a browser API. Store errors for code outside the game subsystem in `src/errors/`.
Within each error root, group classes into subfolders by their owning feature or area (for example `map/`, `castle/`, `path/`, `screenshot/`, or `assets/`) and import them through that area's index file.
Model enums as frozen plain objects (`export const GRAPHICS_DRIVER = Object.freeze({ ... })`) whose values are primitive literals; name the export in SCREAMING_SNAKE_CASE and the keys in SCREAMING_SNAKE_CASE. Define exactly one enum per file, in a PascalCase file named after the enum (for example `GraphicsDriver.js`). Store enums owned by code under `src/game/` in `src/game/enum/`; store enums for code outside the game subsystem in `src/enum/`. Do not declare enum-like frozen literal objects anywhere else, and do not put anything other than the single enum into an enum file. ESLint enforces these rules via `no-restricted-syntax` overrides in `eslint.config.js`.

## Runtime Error Recovery

Handle unexpected application errors through `src/boot/runtime-errors.js`. The error notification must remain visible and provide two localized actions: **Refresh**, showing a 30-second countdown and reloading immediately when selected, and **Dismiss**, closing the notification without reloading. The page must reload automatically when the countdown expires. Dismissing the notification must cancel both the countdown interval and the pending automatic reload timer. Keep the action labels synchronized across every locale in `src/i18n/` and cover manual refresh, automatic refresh, and timer cancellation in `test/unit/runtime-errors.test.js`.

## Map Generation Rules

When a request involves updating map generation logic, path generation, terrain shaping, water placement, tile rendering, or validation for the isometric game layer, read `docs/map-generator-rules.md` first and treat it as the canonical specification. Do not implement shortcuts that violate the two-tile path width, grid-aligned ownership, projection consistency, slope-length validation, gate placement, waterfall upstream-length rules, or final validation requirements defined there.

## Blender Model Rules

When a visible 3D character, architectural element, or reusable prop has a stable authored shape, create or edit an imported Blender model instead of assembling that artwork from PlayCanvas primitive entities or generating its mesh in JavaScript. Store models under `src/game/models/`, grouped by feature, with exactly one reusable model per `.glb` file. Keep procedural code responsible for map-driven placement, transforms, collision, interaction, runtime color variants, shaders, particles, and other behavior. Terrain topology, route markers, portal surfaces, fire, and deformable cloth should remain procedural unless a task explicitly replaces their runtime system. Use a modular model kit rather than one monolithic asset whenever dimensions or layouts vary at runtime.
Every tracked `.glb` under `src/game/models/` must have an editable `.blend` source file with the same basename in the same directory. Treat the `.blend` file as the source of truth and export the adjacent `.glb` from it. Do not replace these source files with procedural Blender generator scripts unless the user explicitly requests that workflow.
Whenever the model format supports animation, author and store character and prop animation clips in the editable model and exported `.glb` instead of synthesizing joint or object motion in JavaScript. Runtime code should select, sequence, blend, and adjust playback of those embedded clips; use procedural animation only when the behavior is inherently dynamic and cannot reasonably be authored in the model.

## Temporary Files

Store every temporary helper, conversion, migration, or diagnostic script under the project-root `tmp/` directory. Never place temporary scripts elsewhere in the repository. Keep `/tmp/` ignored by Git, and never stage or commit its contents.

## Testing Guidelines

Cypress E2E specs live in `test/cypress/e2e/` and use `*.cy.js`. The configured base URL is `http://localhost:9000/`; the npm scripts start Quasar automatically. Component specs, when added, belong beside source files as `src/**/*.cy.js`. Coverage artifacts are written to `coverage/` and `.nyc_output/` and are ignored.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, optionally with Conventional Commit prefixes and scopes such as `feat:`, `fix:`, and `refactor(game):`. Keep commits focused on one behavior change. This is a personal site and `CONTRIBUTING.md` states that outside contributions are not accepted; there is no pull-request template.
