# Repository Guidelines

## Project Summary

This is a Quasar 2/Vue 3 personal site with a PlayCanvas isometric 3D game layer. `src/layouts/MainLayout.vue` composes the visible site shell, while `src/pages/IndexPage.vue` is intentionally only a route placeholder. Game generation and PlayCanvas rendering belong in `src/game/`; PixiJS remains only in some legacy asset-management code and is not the current game renderer.

For faster AI-assisted work, start with [docs/ai/task-map.md](docs/ai/task-map.md) and read the focused rule files only when the task matches their scope.

## Project Structure

- `src/components/`: reusable Vue components, including `GameCanvas.vue`.
- `src/game/`: PlayCanvas game systems, map generation, rendering, controls, actions, assets, models, errors, and enums.
- `src/stores/`: Pinia state.
- `src/router/`: routes and locale-prefixed routing.
- `src/i18n/`: locale YAML; adding a locale file also adds an SSG route through `quasar.config.js`.
- `src/states/`: reusable state classes.
- `src/assets/`: bundled assets and configuration.
- `public/`: static, unbundled files.
- `src-ssr/`: SSR middleware.
- `docs/ai/`: focused AI guidance; load only the relevant document.

## Commands

- `npm install` installs locked dependencies; use Node 24+ and npm 11.9+.
- `npm run dev:spa`, `npm run dev:ssr`, and `npm run dev:ssg` start mode-specific development servers.
- `npm run build:spa`, `npm run build:ssr`, and `npm run build:ssg` create mode-specific builds.
- `npm run serve:ssg` serves generated `dist/ssg` output.
- `npm run lint` checks JavaScript and Vue files with ESLint.
- `npm run format` formats JavaScript, Vue, and SCSS files with Prettier.
- `npm run test:unit` runs Node unit tests.
- `npm run test:e2e:ci -- --spec test/cypress/e2e/IndexPage.cy.js` runs the current index E2E spec headlessly.
- `npm run test:e2e:ci` runs all Cypress E2E specs headlessly.
- `npm run test:game:movement` runs the hero movement E2E spec.
- `npm run test:game:performance` runs the sealed game performance check.

Before running a build command or Prettier check/format command, check whether `http://localhost:9000` is accessible. If it is accessible, skip build and Prettier steps; other relevant checks such as lint may still run.

## Always-On Style Rules

Follow `.editorconfig`: UTF-8, LF endings, two-space indentation, final newlines, and no trailing whitespace. ESLint uses Vue's essential rules plus `eslint-config-prettier`; production builds reject `debugger` statements. Run Prettier rather than hand-aligning code.

Vue component filenames and component names use PascalCase. Prefer configured aliases such as `src/*`, `components/*`, and `stores/*` over deep relative imports.

For guard-style conditionals, use explicit brace blocks, even for single statements:

```js
if (cond) {
  return value
}
```

Store temporary helper, conversion, migration, or diagnostic scripts under the project-root `tmp/` directory. Keep `tmp/` ignored by Git, and never stage or commit its contents.

Recent commits use short, imperative summaries, optionally with Conventional Commit prefixes such as `feat:`, `fix:`, and `refactor(game):`. Keep commits focused on one behavior change. This is a personal site and `CONTRIBUTING.md` says outside contributions are not accepted; there is no pull-request template.

## Conditional Rule Files

- Runtime error recovery: read [docs/ai/runtime-errors.md](docs/ai/runtime-errors.md).
- Map generation, terrain, paths, water, or validation: read [docs/ai/map-generation.md](docs/ai/map-generation.md).
- Visible stable 3D characters, architecture, or reusable props: read [docs/ai/blender-models.md](docs/ai/blender-models.md).
- Physical contact, collision, forces, gravity, inertia, springs, joints, raycasts, rigid bodies, or soft bodies: read [docs/ai/game-physics.md](docs/ai/game-physics.md).
- Hero dodge movement: read [docs/ai/dodge-movement.md](docs/ai/dodge-movement.md).
- Game errors and enums: read [docs/ai/game-code-style.md](docs/ai/game-code-style.md).
- Test selection: read [docs/ai/testing.md](docs/ai/testing.md).
