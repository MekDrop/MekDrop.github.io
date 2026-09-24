# AI Task Map

Use this file first when starting AI-assisted work in this repository. It points to likely files and the smallest useful checks so future sessions do not have to rediscover the project shape from scratch.

| Task | Start With | Also Check | Focused Rules | Suggested Checks |
| --- | --- | --- | --- | --- |
| Site shell or visible homepage UI | `src/layouts/MainLayout.vue` | `src/components/`, `src/i18n/` | root `AGENTS.md` | `npm run lint`, `npm run build:spa` if no dev server is running |
| Route or locale behavior | `src/router/`, `src/i18n/`, `quasar.config.js` | `src/pages/IndexPage.vue` | root `AGENTS.md` | `npm run lint`, `npm run build:ssg` if no dev server is running |
| Game canvas mounting | `src/components/GameCanvas.vue` | `src/game/PlayCanvasRenderer.js`, `src/stores/` | root `AGENTS.md` | `npm run lint`, relevant Cypress spec |
| PlayCanvas renderer changes | `src/game/PlayCanvasRenderer.js` | `src/game/objects/`, `src/game/config/`, `src/assets/` | `docs/ai/game-code-style.md` | `npm run lint`, `npm run test:e2e:ci -- --spec <relevant spec>` |
| Map generation, terrain, water, paths, gates, waterfalls, or validation | `src/game/MapGenerator.js`, `docs/map-generator-rules.md` | `src/game/PlayCanvasRenderer.js`, map-related tests | `docs/ai/map-generation.md` | `npm run lint`, map/game Cypress specs |
| Hero movement or controls | `src/game/GameControls.js`, `src/game/actions/`, `src/game/config/controls.js` | `test/cypress/e2e/HeroMovement.cy.js` | `docs/ai/dodge-movement.md` when dodge behavior changes | `npm run test:game:movement`, `npm run lint` |
| Runtime error notifications | `src/boot/runtime-errors.js` | `src/i18n/`, `test/unit/runtime-errors.test.js` | `docs/ai/runtime-errors.md` | `npm run test:unit`, `npm run lint` |
| Stable 3D model or prop asset | `src/game/models/` | owning object under `src/game/objects/` | `docs/ai/blender-models.md` | model export validation, `npm run lint` if runtime code changes |
| Physics, collision, rigid bodies, raycasts, soft bodies, springs, or forces | owning files under `src/game/` | physics setup and related object classes | `docs/ai/game-physics.md` | relevant unit/E2E test, `npm run lint` |
| Game errors or enums | `src/game/errors/`, `src/game/enum/` | `eslint.config.js` restricted syntax rules | `docs/ai/game-code-style.md` | `npm run lint` |
| Unit tests | `test/unit/` | source file under test | `docs/ai/testing.md` | `npm run test:unit` |
| Cypress E2E tests | `test/cypress/e2e/` | `cypress.config.cjs`, source files under test | `docs/ai/testing.md` | targeted `npm run test:e2e:ci -- --spec ...` |
| Build or SSG output | `quasar.config.js`, `src/router/`, `src/i18n/` | affected source files | `docs/ai/testing.md` | mode-specific build if no dev server is running |

Avoid inspecting generated or heavy directories unless the task explicitly requires them: `node_modules/`, `dist/`, `coverage/`, `.nyc_output/`, `.quasar/`, and `tmp/`.
