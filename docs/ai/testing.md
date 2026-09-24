# Testing Guidance

Read this when selecting or updating tests.

Cypress E2E specs live in `test/cypress/e2e/` and use `*.cy.js`. The configured base URL is `http://localhost:9000/`; the npm scripts start Quasar automatically.

Component specs, when added, belong beside source files as `src/**/*.cy.js`.

Coverage artifacts are written to `coverage/` and `.nyc_output/` and are ignored.

Prefer the smallest meaningful check first:

- `npm run test:unit` for Node unit tests.
- `npm run test:game:movement` for hero movement behavior.
- `npm run test:e2e:ci -- --spec test/cypress/e2e/IndexPage.cy.js` for the current index page E2E spec.
- `npm run test:e2e:ci -- --spec <path>` for a targeted Cypress spec.
- `npm run test:e2e:ci` for broad E2E coverage.
- `npm run lint` for JavaScript and Vue style and restricted-syntax rules.

Before running a build command or a Prettier check/format command, check whether `http://localhost:9000` is accessible. If it is accessible, skip both build and Prettier steps; other relevant checks such as lint may still run.

Use `npm run build:spa`, `npm run build:ssr`, or `npm run build:ssg` when the changed area warrants that mode and no dev server is already running on `http://localhost:9000`.
