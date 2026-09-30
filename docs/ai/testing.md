# Testing Guidance

Read this when selecting or updating tests.

## Test organization

Keep test paths aligned with the production code they primarily exercise. Do not add tests directly to the `test/unit/` or `test/cypress/e2e/` roots.

- Unit tests mirror the path below `src/`. For example, tests for `src/game/objects/water/WaterfallGeometry.js` belong at `test/unit/game/objects/water/waterfall-geometry.test.js`.
- Choose the directory of the primary class or function under test when a test imports several modules. Shared dependencies do not determine its location.
- Cross-module tests belong to the narrowest feature directory that owns the behavior. If no single module owns it, use the nearest shared production directory rather than creating a miscellaneous test folder.
- Cypress E2E specs mirror the owning feature below `test/cypress/e2e/`; page-level journeys belong in `test/cypress/e2e/pages/`.
- Component specs remain beside their source files as `src/**/*.cy.js`.
- When production code moves between directories, move its tests in the same change and update scripts and documentation that name their paths.

Cypress E2E specs use `*.cy.js`. The configured base URL is `http://localhost:9000/`; the npm scripts start Quasar automatically.

Unit tests use `*.test.js` and are discovered recursively below `test/unit/`.

Coverage artifacts are written to `coverage/` and `.nyc_output/` and are ignored.

Prefer the smallest meaningful check first:

- `npm run check:changed` detects JS/Vue changes against the upstream branch, including staged, unstaged, and committed branch changes. It lints those files, runs unambiguous nearby unit tests, selects a matching Cypress spec for supported UI/game changes, and considers a targeted build for routing, locale, layout, page, or Quasar config changes. Build checks are skipped when `http://localhost:9000` is accessible. Configure an upstream branch for the most accurate committed-change comparison; without one, the command checks the working tree against `HEAD`.
- `npm run test:unit` for Node unit tests.
- `npm run test:game:performance` measures sustained gameplay near 60 FPS in installed Chrome. Set `GAME_PERFORMANCE_BROWSER` to choose another Cypress browser. The check samples frame times after startup settles, and verifies the canvas stays at full CSS resolution or higher; the HUD counter reports individual frames.
- `npm run test:game:movement` for hero movement behavior.
- `npm run test:e2e:ci -- --spec test/cypress/e2e/pages/IndexPage.cy.js` for the current index page E2E spec.
- `npm run test:e2e:ci -- --spec <path>` for a targeted Cypress spec.
- `npm run test:e2e:ci` for broad E2E coverage.
- `npm run lint` for JavaScript and Vue style and restricted-syntax rules.

Before running a build command or a Prettier check/format command, check whether `http://localhost:9000` is accessible. If it is accessible, skip both build and Prettier steps; other relevant checks such as lint may still run.

Use `npm run build:spa`, `npm run build:ssr`, or `npm run build:ssg` when the changed area warrants that mode and no dev server is already running on `http://localhost:9000`.
