describe("Saved-map camera follow", () => {
  it("keeps projected pan directions and returns smoothly after manual movement", () => {
    cy.visit('/map/test_flat?camera-test', { onBeforeLoad: (win) => win.sessionStorage.clear() });
    cy.get('.background-canvas[data-game-ready="true"]', {timeout:30000}).should('be.visible');
    cy.window().then((win) => {
      if (win.gameCameraTest.state().panLimitsEnabled) {
        win.dispatchEvent(new win.KeyboardEvent('keydown', {code:'Pause'}));
        win.dispatchEvent(new win.KeyboardEvent('keyup', {code:'Pause'}));
      }
    });
    cy.window().should((win) => {
      expect(win.gameCameraTest.state().panLimitsEnabled).equal(false);
    });
    cy.window().then((win) => {
      const driver = win.gameCameraTest;
      driver.setZoom(6);
      for (const [x,y] of [[30,0],[-30,0],[0,30],[0,-30]]) {
        const before = driver.state().hero.patScreenPosition;
        driver.panBy(x,y);
        const after = driver.state().hero.patScreenPosition;
        expect(after.x-before.x).closeTo(x, 1);
        expect(after.y-before.y).closeTo(y, 1);
      }
      driver.panBy(80,80);
      const before = driver.state().viewport;
      expect(driver.returnToHero()).equal(true);
      expect(driver.state().viewport.panX).equal(before.panX);
      expect(driver.state().cameraReturningToHero).equal(true);
    });
    cy.window().should((win) => {
      const state = win.gameCameraTest.state();
      expect(state.cameraReturningToHero).equal(false);
      expect(state.viewport.manuallyMoved).equal(false);
      expect(Math.hypot(state.viewport.panX-state.hero.position.x,state.viewport.panZ-state.hero.position.z)).lessThan(0.1);
    });
  });
});
