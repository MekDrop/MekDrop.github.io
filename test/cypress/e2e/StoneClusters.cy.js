import { GRASS_SURFACE_LIFT } from "../../../src/game/config/terrain.js";

function expectHero(assertion, timeout = 8000) {
  cy.window().then({ timeout: timeout + 1000 }, (window) => {
    const startedAt = Date.now();
    return new Cypress.Promise((resolve, reject) => {
      const inspect = () => {
        try {
          assertion(window.gameMovementTest.state(), window);
          resolve();
        } catch (cause) {
          if (Date.now() - startedAt >= timeout) {
            reject(cause);
            return;
          }
          window.setTimeout(inspect, 16);
        }
      };
      inspect();
    });
  });
}

describe("stone clusters", () => {
  it("lets the hero jump onto a decorative stone and stand on it", () => {
    cy.visit("/map/test_stone-cluster?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
    });
    expectHero((state) => {
      expect(state.position.y).to.be.greaterThan(2.8);
      expect(state.grounded).to.equal(false);
    });
    cy.window().then((window) => {
      window.gameMovementTest.moveForward(true);
    });
    expectHero((state, window) => {
      if (state.position.x > -1.2) {
        window.gameMovementTest.moveForward(false);
      }
      expect(state.position.x).to.be.greaterThan(-1.2);
    });
    expectHero((state) => {
      expect(state.position.x).to.be.within(-1.2, -0.85);
      expect(state.position.y).to.be.closeTo(
        2 + GRASS_SURFACE_LIFT + 0.6,
        0.06,
      );
      expect(state.grounded).to.equal(true);
    });
  });
});
