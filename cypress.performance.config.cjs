const { defineConfig } = require("cypress");

module.exports = defineConfig({
  defaultCommandTimeout: 20000,
  screenshotsFolder: "test/cypress/screenshots",
  trashAssetsBeforeRuns: false,
  video: false,
  viewportHeight: 720,
  viewportWidth: 1280,
  e2e: {
    setupNodeEvents(on) {
      on("task", {
        reportGamePerformance(summary) {
          console.log(`\nGame performance: ${summary}\n`);
          return null;
        },
      });
    },
    baseUrl: "http://localhost:8080/",
    supportFile: "test/cypress/support/e2e.js",
    specPattern: "test/cypress/performance/**/*.cy.js",
  },
});
