/**
 * @param {number} duration
 * @param {(state: ReturnType<Window["gameMovementTest"]["state"]>) => void} assertion
 */
function observe(duration, assertion) {
  cy.window().then((window) => new Cypress.Promise((resolve, reject) => {
    const start = window.performance.now();
    const frame = () => {
      try {
        assertion(window.gameMovementTest.state());
      } catch (error) {
        reject(error);

        return;
      }
      if (window.performance.now() - start >= duration) {
        resolve();
      } else {
        window.requestAnimationFrame(frame);
      }
    };
    frame();
  }));
}

describe("Exterior stair locomotion", { testIsolation: false }, () => {
  before(() => {
    cy.visit("/map/test_stair-locomotion?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 120000 }).should("be.visible");
  });

  afterEach(() => {
    cy.window().trigger("keyup", { code: "ArrowRight" });
    cy.window().then((window) => window.gameMovementTest.move(0, 0));
  });

  it("keeps short repeated stair taps at walking speed across contact gaps", () => {
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.teleport({
        x: -0.5,
        y: 2.264,
        z: 6.25,
      });
    });
    for (let tap = 0; tap < 5; tap++) {
      cy.window().trigger("keydown", { code: "ArrowRight" });
      observe(130, (state) => {
        expect(state.movement.speed).to.be.lessThan(1.94);
        expect(state.animation).not.to.equal("Run");
      });
      cy.window().trigger("keyup", { code: "ArrowRight" });
      observe(450, (state) => {
        expect(state.movement.speed).to.be.lessThan(1.94);
        expect(state.animation).not.to.equal("Run");
      });
    }
  });

  it("walks through the upper risers and doorway without snagging or hopping", () => {
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.teleport({
        x: -0.5,
        y: 2.264,
        z: 6.25,
      });
      window.gameMovementTest.move(1, 0);
    });
    observe(2500, (state) => {
      expect(state.animation).not.to.equal("Jump");
      expect(state.respawning).to.equal(false);
    });
    cy.window().should((window) => {
      const state = window.gameMovementTest.state();
      expect(state.position.z).to.be.lessThan(1.8);
      expect(state.position.y).to.be.closeTo(4, 0.03);
      expect(state.grounded).to.equal(true);
    });
  });

  it("holds a resting tread without repeated vertical bobbing", () => {
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
      window.gameMovementTest.teleport({
        x: -0.5,
        y: 3.514,
        z: 3.8,
      });
    });
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(3.5, 0.005);
    });
    observe(1500, (state) => {
      expect(state.position.y).to.be.closeTo(3.5, 0.005);
      expect(state.position.z).to.be.closeTo(3.8, 0.005);
      expect(state.grounded).to.equal(true);
      expect(state.animation).not.to.equal("Jump");
    });
  });

  it("does not pump upward when walking into the upper stair corner", () => {
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.teleport({
        x: -0.69,
        y: 3.764,
        z: 3.4,
      });
      window.gameMovementTest.move(1, 0);
    });
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(3.75, 0.005);
    });
    observe(1500, (state) => {
      expect(state.position.y).to.be.closeTo(3.75, 0.005);
      expect(state.grounded).to.equal(true);
      expect(state.animation).not.to.equal("Jump");
    });
  });

  it("walks down the flight to the approach without switching to a jump", () => {
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.teleport({
        x: 0,
        y: 4.014,
        z: 2.6,
      });
      window.gameMovementTest.move(-1, 0);
    });
    observe(2800, (state) => {
      expect(state.animation).not.to.equal("Jump");
      expect(state.respawning).to.equal(false);
    });
    cy.window().should((window) => {
      const state = window.gameMovementTest.state();
      expect(state.position.z).to.be.greaterThan(6.7);
      expect(state.position.y).to.be.closeTo(2.004, 0.03);
      expect(state.grounded).to.equal(true);
    });
  });
});
