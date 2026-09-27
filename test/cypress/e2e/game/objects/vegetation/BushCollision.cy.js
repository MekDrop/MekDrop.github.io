describe("Bush collision", () => {
  beforeEach(() => {
    cy.visit("/map/test_flat?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("bush-collision");
    });
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.move(-1, -1);
    });
  });

  afterEach(() => {
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
    });
  });

  it("stops at the generated bush voxels instead of entering them", () => {
    cy.wait(1200);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      expect(state.position.z).to.be.within(0.15, 0.55);
      expect(state.grounded).to.equal(true);
    });
  });

  it("recovers safely after jumping onto the bush", () => {
    cy.wait(1200);
    cy.window().then((window) => {
      window.gameMovementTest.jump();
    });
    cy.wait(250);
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
    });
    cy.wait(3200);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      expect(state.grounded).to.equal(true);
      expect(state.position.y).to.be.closeTo(2, 0.1);
      expect(state.position.z).to.be.lessThan(0.7);
      expect(state.animation).not.to.equal("FallDeath");
      expect(state.respawning).to.equal(false);
    });
  });

  it("lands on top when descending vertically instead of sinking inside", () => {
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
      return window.gameMovementTest.loadScenario("bush-landing");
    });
    cy.wait(1800);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      expect(state.grounded).to.equal(true);
      expect(state.position.y).to.be.closeTo(2.75, 0.03);
      expect(state.animation).to.equal("Idle");
      expect(state.respawning).to.equal(false);
    });
  });

});
