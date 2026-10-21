describe("Hero walk/run transitions", () => {
  it("accelerates, returns to walking, brakes to idle and can interrupt braking", () => {
    cy.visit("/map/test_locomotion?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 }).should("be.visible");
    cy.window().should(window => {
      expect(window.gameMovementTest?.state().grounded).to.equal(true);
    });
    cy.window().then({ timeout: 15000 }, async window => {
      const driver = window.gameMovementTest;
      const samples = [];
      let phase = "walk";
      const timer = window.setInterval(() => samples.push({
        phase,
        ...driver.state(),
      }), 16);
      /**
       * @param {number} milliseconds
       */
      const wait = milliseconds => new Cypress.Promise(resolve => window.setTimeout(resolve, milliseconds));
      try {
        driver.move(0, -1);
        await wait(700);
        phase = "accelerate";
        driver.move(0, -1, true);
        await wait(900);
        phase = "slow";
        driver.move(0, -1);
        await wait(650);
        expect(driver.state().animation).to.equal("Walk");
        phase = "run";
        driver.move(0, 1, true);
        await wait(1100);
        phase = "stop";
        driver.move(0, 0);
        await wait(750);
        expect(driver.state().animation).to.equal("Idle");
        expect(driver.state().movement.speed).to.equal(0);
        phase = "restart";
        driver.move(0, 1, true);
        await wait(750);
        driver.move(0, 0);
        await wait(120);
        driver.move(0, 1);
        await wait(450);
        expect(driver.state().animation).to.equal("Walk");
        expect(samples.some(s => s.phase === "accelerate" && s.movement.gait === "accelerating")).to.equal(true);
        expect(samples.some(s => s.phase === "slow" && s.movement.gait === "slowing" && s.animation === "Run")).to.equal(true);
        expect(samples.some(s => s.phase === "stop" && s.animation.startsWith("RunStop"))).to.equal(true);
      } finally {
        window.clearInterval(timer);
        driver.move(0, 0);
      }
    });
  });
});
