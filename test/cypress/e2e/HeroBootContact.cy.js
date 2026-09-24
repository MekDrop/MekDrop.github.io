describe("Hero boot contact", () => {
  it("keeps both boot soles on the terrain while grounded", () => {
    cy.visit("/map/test_flat");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");

    cy.window().then((window) => {
      const startedAt = Date.now();
      return new Cypress.Promise((resolve, reject) => {
        const inspect = () => {
          try {
            const state = window.gameMovementTest.state();
            expect(state.grounded).to.equal(true);
            for (const side of ["left", "right"]) {
              expect(state.footPlacement[side].minimumClearance)
                .to.be.within(-0.025, 0.06);
            }
            resolve();
          } catch (cause) {
            if (Date.now() - startedAt >= 8000) {
              reject(cause);
              return;
            }
            window.setTimeout(inspect, 16);
          }
        };
        inspect();
      });
    });
  });
});
