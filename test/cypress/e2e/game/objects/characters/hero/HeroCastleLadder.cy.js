describe("Castle ladder roof clearance", () => {
  it("finishes crossing the real masonry hatch after releasing movement in either direction", () => {
    cy.visit("/map/test_ladder-castle?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 90000 }).should("be.visible");
    let access;
    cy.window().then(window => {
      access = window.gameMovementTest.mapObjects().find(o => o.object === "Castle").buildPlan.metadata.runtime.residential.roofAccess;
      window.gameMovementTest.teleport(access.bottom);
    });
    cy.wait(1800);
    cy.window().then(window => {
      const direction = window.gameCameraTest.firstPerson(true).firstPersonCamera.direction;
      const yaw = Math.atan2(access.position.x - access.bottom.x, access.position.z - access.bottom.z);
      window.gameCameraTest.lookFirstPersonBy((yaw - Math.atan2(direction.x, direction.z)) * 180 / Math.PI, 0);
      window.gameMovementTest.move(0, 1);
    });
    cy.window({ timeout: 15000 }).should(window => {
      const y = window.gameMovementTest.state().position.y;
      expect(y).to.be.greaterThan(access.top.y - 1.2);
      expect(y).to.be.lessThan(access.top.y - 0.3);
    });
    cy.window().then(window => window.gameMovementTest.move(0, 0));
    cy.window({ timeout: 15000 }).should(window => {
      const state = window.gameMovementTest.state();
      expect(state.position.y, JSON.stringify(state)).to.be.greaterThan(access.top.y - 0.1);
      expect(state.grounded).to.equal(true);
    });
    let roofPosition;
    cy.window().then(window => {
      roofPosition = window.gameMovementTest.state().position;
      window.gameMovementTest.move(0, 0);
    });
    cy.wait(400);
    cy.window().then(window => {
      const direction = window.gameCameraTest.state().firstPersonCamera.direction;
      const yaw = Math.atan2(access.position.x - roofPosition.x, access.position.z - roofPosition.z);
      window.gameCameraTest.lookFirstPersonBy((yaw - Math.atan2(direction.x, direction.z)) * 180 / Math.PI, 0);
      window.gameMovementTest.move(0, 1);
    });
    cy.window({ timeout: 15000 }).should(window => {
      const y = window.gameMovementTest.state().position.y;
      expect(y).to.be.lessThan(access.top.y - 0.2);
      expect(y).to.be.greaterThan(access.top.y - 1.2);
    });
    cy.window().then(window => window.gameMovementTest.move(0, 0));
    cy.window({ timeout: 10000 }).should(window => {
      expect(window.gameMovementTest.state().position.y).to.be.lessThan(access.top.y - 1.55);
    });
    let stopped;
    cy.wait(250);
    cy.window().then(window => { stopped = window.gameMovementTest.state().position.y; });
    cy.wait(400);
    cy.window().then(window => expect(window.gameMovementTest.state().position.y).to.be.closeTo(stopped, 0.08));
  });
});
