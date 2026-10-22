describe("Pitcher Ogre production playback", () => {
  it("loads its saved map, plays every embedded clip and captures the actual actor", () => {
    cy.viewport(1280, 720);
    const failures = [];
    const playback = [];
    cy.intercept("**/src/**", (request) => {
      request.continue((response) => {
        if (response.statusCode >= 400) {
          failures.push({
            url: request.url,
            status: response.statusCode,
            body: String(response.body).slice(0, 800),
          });
        }
      });
    });
    cy.on("fail", (error) => {
      error.message += `\nFailed production modules: ${JSON.stringify(failures.slice(0, 6))}`;
      throw error;
    });
    cy.visit("/map/test_enemy-pitcher-ogre", {
      onBeforeLoad: (window) => {
        const info = window.console.info.bind(window.console);
        window.console.info = (...args) => {
          if (args[0] === "PitcherOgrePlaybackEvidence") {
            playback.push(JSON.parse(args[1]));
          }
          info(...args);
        };
      },
    });
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 120000 }).should("be.visible");
    cy.get(".background-canvas").screenshot("pitcher-ogre-production-map");
    // Actual PlayCanvas HUD button, not a visible HTML overlay or injected driver.
    cy.get(".background-canvas").click(1120, 561);
    cy.wrap(playback, { timeout: 90000 }).should((evidence) => {
      expect(evidence).to.have.length(1);
      expect(evidence[0]).to.have.length(22);
      for (const clip of evidence[0]) {
        expect(clip.samples, clip.clip).to.have.length(3);
        const changed = new Set();
        for (const sample of clip.samples) {
          expect(Number.isFinite(sample.time), clip.clip).to.equal(true);
          expect(sample.speed, clip.clip).to.be.greaterThan(0);
          for (const joint of sample.joints) {
            expect([...joint.position, ...joint.rotation].every(Number.isFinite), joint.name).to.equal(true);
            const first = clip.samples[0].joints.find((entry) => entry.name === joint.name);
            const moved = [...joint.position, ...joint.rotation].some((value, index) => Math.abs(value - [...first.position, ...first.rotation][index]) > 1e-6);
            if (moved) {
              changed.add(joint.name);
            }
          }
        }
        expect(changed.size, `${clip.clip}: actual non-root joint motion`).to.be.at.least(2);
      }
    });
    cy.then(() => cy.writeFile("src/game/objects/enemies/pitcher-ogre/evidence/runtime-playback.json", playback[0]));
    cy.get(".background-canvas").click(1120, 523);
    cy.readFile("test/cypress/downloads/pitcher-ogre-preview.png", null, { timeout: 30000 }).should((bytes) => expect(bytes.length).to.be.greaterThan(1000));
  });
});
