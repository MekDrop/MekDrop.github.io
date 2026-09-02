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

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, LF endings, two-space indentation, final newlines, and no trailing whitespace. ESLint uses Vue's essential rules plus `eslint-config-prettier`; production builds reject `debugger` statements. Run Prettier rather than hand-aligning code. Vue component filenames and component names use PascalCase. Prefer configured aliases such as `src/*`, `components/*`, and `stores/*` over deep relative imports.
For JavaScript class internals, use modern ES private class syntax (#privateField, #privateMethod()) instead of underscore-prefixed pseudo-private fields or methods.
Prefer one primary class per JavaScript file when the code models a distinct system or component. Avoid large utility-style files that accumulate many unrelated constants, variables, and free functions when that logic belongs inside a cohesive class.

## Map Generation Rules

When a request involves updating map generation logic, path generation, terrain shaping, water placement, tile rendering, or validation for the isometric game layer, read `docs/map-generator-rules.md` first and treat it as the canonical specification. Do not implement shortcuts that violate the two-tile path width, grid-aligned ownership, projection consistency, slope-length validation, gate placement, waterfall upstream-length rules, or final validation requirements defined there.

## Testing Guidelines

Cypress E2E specs live in `test/cypress/e2e/` and use `*.cy.js`. The configured base URL is `http://localhost:8080/`; the npm scripts start Quasar automatically. Component specs, when added, belong beside source files as `src/**/*.cy.js`. Coverage artifacts are written to `coverage/` and `.nyc_output/` and are ignored.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, optionally with Conventional Commit prefixes and scopes such as `feat:`, `fix:`, and `refactor(game):`. Keep commits focused on one behavior change. This is a personal site and `CONTRIBUTING.md` states that outside contributions are not accepted; there is no pull-request template.
