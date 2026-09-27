function expectGame(assertion, timeout = 8000) {
  cy.window().then({ timeout: timeout + 1000 }, (window) => {
    const startedAt = Date.now();
    return new Cypress.Promise((resolve, reject) => {
      const inspect = () => {
        try {
          assertion(window.gameMovementTest);
          resolve();
        } catch (cause) {
          if (Date.now() - startedAt >= timeout) {
            reject(cause);
            return;
          }
          window.setTimeout(inspect, 16);
        }
      };
      inspect();
    });
  });
}

describe("TriggerArea", () => {
  it("runs its JavaScript on activation and deactivation", () => {
    cy.visit("/map/test_royal-castles?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 60000,
    }).should("be.visible");
    cy.window().then((window) => {
      expect(window.gameMovementTest.royalCastles())
        .to.have.length(3)
        .and.satisfy((castles) => castles.every(({ present }) => !present));
      window.gameCameraTest.setRotation(0);
      window.gameMovementTest.move(1, 1);
    });
    expectGame((driver) => {
      if (driver.state().position.z < 4.95) {
        driver.move(0, 0);
      }
      expect(driver.state().position.z).to.be.lessThan(4.95);
      expect(driver.royalCastles()).to.satisfy((castles) =>
        castles.every(({ present }) => present),
      );
    });
    cy.window().then((window) => {
      window.gameMovementTest.move(-1, -1);
    });
    expectGame((driver) => {
      if (driver.state().position.z > 5.1) {
        driver.move(0, 0);
      }
      expect(driver.state().position.z).to.be.greaterThan(5.1);
      expect(driver.royalCastles()).to.satisfy((castles) =>
        castles.every(({ present }) => !present),
      );
    });
  });
});
