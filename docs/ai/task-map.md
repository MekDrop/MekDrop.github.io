# AI Task Map

Use this file to find likely entry points, focused rules, and the smallest relevant check. Start with root `AGENTS.md` for architecture invariants and universal constraints; read only the focused docs that match the task.

| Task | Start With | Also Check | Focused Rules | Suggested Checks |
| --- | --- | --- | --- | --- |
| Site shell or visible homepage UI | `src/layouts/MainLayout.vue` | `src/components/`, `src/i18n/` | root `AGENTS.md`, `docs/ai/code-style.md` | `npm run lint`; SPA build only if route/build behavior changed |
| Route or locale behavior | `src/router/`, `src/i18n/`, `quasar.config.js` | `src/pages/IndexPage.vue` | root `AGENTS.md`, `docs/ai/code-style.md` | `npm run lint`; `npm run build:ssg` if output behavior changed |
| Game canvas mounting | `src/components/GameCanvas.vue` | `src/game/PlayCanvasRenderer.js`, `src/stores/` | root `AGENTS.md`, `docs/ai/code-style.md` | `npm run lint`; affected E2E spec if mounting behavior changed |
| PlayCanvas renderer changes | `src/game/PlayCanvasRenderer.js` | `src/game/objects/`, `src/game/config/`, `src/assets/` | `docs/ai/code-style.md`, `docs/ai/game-code-style.md` | `npm run lint`; affected E2E spec for behavior changes |
| Map generation, terrain, water, paths, gates, waterfalls, or validation | `src/game/generator/map/MapGenerator.js`, `docs/map-generator-rules.md` | `src/game/PlayCanvasRenderer.js`, map-related tests | `docs/ai/map-generation.md` | relevant Cypress spec with `npm run test:e2e:ci -- --spec <path>`; lint for code changes |
| Hero movement or controls | `src/game/GameControls.js`, `src/game/actions/`, `src/game/config/controls.js` | `test/cypress/e2e/game/objects/hero/HeroMovement.cy.js` | `docs/ai/dodge-movement.md` when dodge behavior changes | `npm run test:game:movement` for movement changes; lint for code changes |
| Runtime error notifications | `src/boot/runtime-errors.js` | `src/i18n/`, `test/unit/boot/runtime-errors.test.js` | `docs/ai/runtime-errors.md` | `npm run test:unit` for runtime-error changes; lint for code changes |
| Stable 3D model or prop asset | `src/game/models/` | owning object under `src/game/objects/` | `docs/ai/blender-models.md` | `npm run blender:export` when source assets change; lint if runtime code changes |
| Physics, collision, rigid bodies, raycasts, soft bodies, springs, or forces | owning files under `src/game/` | physics setup and related object classes | `docs/ai/game-physics.md` | test covering the changed physics behavior; lint for code changes |
| Game errors or enums | `src/game/errors/`, `src/game/enum/` | `eslint.config.js` restricted syntax rules | `docs/ai/game-code-style.md` | `npm run lint` |
| Unit tests | `test/unit/<path-below-src>/` | source file under test | `docs/ai/testing.md` | `npm run test:unit` |
| Cypress E2E tests | owning feature under `test/cypress/e2e/` | `cypress.config.cjs`, source files under test | `docs/ai/testing.md` | `npm run test:e2e:ci -- --spec <path>` |
| Build or SSG output | `quasar.config.js`, `src/router/`, `src/i18n/` | affected source files | `docs/ai/testing.md` | affected build mode only if output behavior changed |

Run checks only when they cover changed behavior; prefer targeted tests and lint over broad suites. Before builds, follow the localhost:9000 rule in root `AGENTS.md`. Avoid inspecting generated or heavy directories unless needed: `node_modules/`, `dist/`, `coverage/`, `.nyc_output/`, `.quasar/`, and `tmp/`.
