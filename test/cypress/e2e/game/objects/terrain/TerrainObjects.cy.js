describe("terrain objects render through the map scene", () => {
  for (const map of ["test_flat", "test_river-source-cover", "pipeline-baseline-default"]) {
    it(`renders ${map} with the grass and earth object lifecycle`, () => {
      cy.intercept("https://www.googletagmanager.com/**", { statusCode: 204, body: "" });
      cy.intercept("https://fonts.googleapis.com/**", { statusCode: 204, body: "" });
      cy.visit(`/map/${map}?camera-test`);
      cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 })
        .should("have.attr", "data-map-name", map);
      cy.get(".background-canvas__surface").should("be.visible").then(($canvas) => {
        expect($canvas[0].width).to.be.greaterThan(0);
        expect($canvas[0].height).to.be.greaterThan(0);
      });
    });
  }
});
