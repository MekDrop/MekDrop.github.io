describe("Bookshelf map", () => {
  it("loads the coordinate-based shelf variations with books and physics", () => {
    cy.visit("/en/map/test_bookshelf?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 30000 }).should("be.visible");
    cy.window().its("gameCameraTest").should("exist");
    cy.get("[data-game-loading-scene]", { timeout: 30000 }).should("not.exist");
    cy.screenshot("bookshelf-variations");
  });
});
