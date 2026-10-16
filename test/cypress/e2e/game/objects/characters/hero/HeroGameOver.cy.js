describe("Hero game over restart", () => {
  it("loads a new map when a key is pressed after the final death", () => {
    cy.visit("/map/test_lava-river");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");

    for (let life = 3; life > 0; life -= 1) {
      cy.window().then((window) => {
        window.gameMovementTest.jump();
        window.gameMovementTest.move(1, -1);
      });
      cy.window({ timeout: 10000 }).should((window) => {
        expect(window.gameMovementTest.state().burning).to.equal(true);
      });
      if (life > 1) {
        cy.window({ timeout: 10000 }).should((window) => {
          const state = window.gameMovementTest.state();
          expect(state.burning).to.equal(false);
          expect(state.respawning).to.equal(false);
          expect(state.position.x).to.be.closeTo(-3, 0.08);
        });
      }
    }

    cy.get("canvas", { timeout: 10000 })
      .should("have.attr", "aria-label")
      .and("include", "Game over");
    cy.window().then((window) => {
      expect(window.gameMovementTest.isGameOver()).to.equal(true);
      const keydown = new window.KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(keydown);
      expect(keydown.defaultPrevented).to.equal(true);
    });
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("not.have.attr", "data-map-name", "test_lava-river");
  });

  it("loads a new map after the royal castle game over scene", () => {
    cy.visit("/map/test_royal-castles");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");

    for (let life = 3; life > 0; life -= 1) {
      cy.window().then((window) => {
        window.gameMovementTest.jump();
        window.gameMovementTest.move(-1, 0);
      });
      cy.window({ timeout: 10000 }).should((window) => {
        expect(window.gameMovementTest.state().action.action).to.equal(
          "fallingToDeath",
        );
      });
      if (life > 1) {
        cy.window({ timeout: 10000 }).should((window) => {
          const state = window.gameMovementTest.state();
          expect(state.respawning).to.equal(false);
          expect(state.position.z).to.be.closeTo(6, 0.08);
        });
      }
    }

    cy.get("canvas", { timeout: 10000 })
      .should("have.attr", "aria-label")
      .and("include", "Game over");
    cy.window().then((window) => {
      expect(window.gameMovementTest.isGameOver()).to.equal(true);
      const keydown = new window.KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(keydown);
      expect(keydown.defaultPrevented).to.equal(true);
    });
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("not.have.attr", "data-map-name", "test_royal-castles");
  });
});
