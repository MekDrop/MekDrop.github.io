describe("Tree collision", () => {
  beforeEach(() => {
    cy.visit("/map/test_flat?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
  });

  it("approaches the tree's voxel collider without crossing it", () => {
    let startPosition;
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("tree-dig");
    });
    cy.get(".interaction-prompt").should("contain.text", "Chop tree");
    cy.window().should((window) => {
      expect(window.gameMovementTest.gameStatusHud().interaction.label).to.equal(
        "Chop tree",
      );
    });
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
    });
    cy.wait(200);
    cy.window().then((window) => {
      startPosition = window.gameMovementTest.state().position;
      window.gameMovementTest.move(-1, -1);
    });
    cy.wait(1500);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      window.gameMovementTest.move(0, 0);
      expect(state.position.z).to.be.greaterThan(startPosition.z + 0.005);
      expect(state.position.z).to.be.within(0.2, 0.24);
    });
  });

  it("recovers its animation after jumping against the tree", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("tree-dig");
    });
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.move(-1, -1);
    });
    cy.wait(1200);
    cy.window().then((window) => {
      window.gameMovementTest.jump();
    });
    cy.wait(2200);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      window.gameMovementTest.move(0, 0);
      expect(state.grounded).to.equal(true);
      expect(state.animation).not.to.equal("Jump");
    });
  });

  it("lands on the generated canopy collider with one jump", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("tree-dig");
    });
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.move(-1, -1);
    });
    cy.wait(1200);
    cy.window().then((window) => {
      window.gameMovementTest.jump();
    });
    cy.wait(400);
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
    });
    cy.wait(500);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      expect(state.grounded).to.equal(true);
      expect(state.position.y).to.be.closeTo(3.5, 0.03);
      expect(state.animation).to.equal("Idle");
    });
  });

  it("jumps from the canopy onto valid lower ground without dying", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("tree-dig");
    });
    cy.window().then((window) => {
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.move(-1, -1);
    });
    cy.wait(1200);
    cy.window().then((window) => {
      window.gameMovementTest.jump();
    });
    cy.wait(400);
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
    });
    cy.wait(500);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      expect(state.position.y).to.be.closeTo(3.5, 0.03);
      window.gameMovementTest.move(1, 1);
      window.gameMovementTest.jump();
    });
    cy.wait(350);
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
    });
    cy.wait(1500);
    cy.window().then((window) => {
      const state = window.gameMovementTest.state();
      expect(state.grounded).to.equal(true);
      expect(state.position.y).to.be.closeTo(2, 0.1);
      expect(state.animation).not.to.equal("FallDeath");
      expect(state.respawning).to.equal(false);
    });
  });

});
