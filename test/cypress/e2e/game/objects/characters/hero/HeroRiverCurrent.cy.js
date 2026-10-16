describe("Hero carried by river currents", () => {
  it("follows a deep staggered current beneath an unreachable bridge", () => {
    cy.visit("/map/test_river-zigzag?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 30000 }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");
    cy.window({ timeout: 12000 }).should((window) => {
      const state = window.gameMovementTest.state();
      expect(state.position.x, JSON.stringify(state)).to.be.lessThan(-2.6);
      expect(state.drowning, JSON.stringify(state)).to.equal(true);
      expect(state.position.y, JSON.stringify(state)).to.be.lessThan(0.5);
    });
  });
  it("continues downstream through a narrow right-angle bend", () => {
    cy.visit("/map/test_river-turn?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 30000 }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
      window.gameMovementTest.move(1, -1);
    });
    cy.window().should((window) => {
      const state = window.gameMovementTest.state();
      expect(state.position.x, JSON.stringify(state)).to.be.greaterThan(-1.1);
    });
    cy.window().then((window) => window.gameMovementTest.move(-1, 0));
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().drowning).to.equal(true);
    });
    cy.window().then((window) => window.gameMovementTest.move(0, 0));
    cy.window({ timeout: 15000 }).should((window) => {
      const state = window.gameMovementTest.state();
      expect(state.position.z, JSON.stringify(state)).to.be.greaterThan(1);
    });
  });
});
