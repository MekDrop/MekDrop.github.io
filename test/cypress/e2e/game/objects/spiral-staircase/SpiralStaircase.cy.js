import { HERO_ANIMATION } from "../../../../../../src/game/enum/HeroAnimation.js";
describe("Spiral staircase", () => {
  it("walks a full turn from Z1 to Z2 without jumping", () => {
    cy.visit("/en/map/test_spiral-staircase?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 30000 })
      .should("be.visible");
    cy.window().its("gameMovementTest").should("exist");
    cy.window().then({ timeout: 45000 }, async (window) => {
      const driver = window.gameMovementTest;
      const targets = [{ x: -0.5, z: 2.5 }, { x: -0.5, z: 1.3 }];
      for (let index = 0; index < 16; index += 1) {
        const angle = index === 15 ? 340 * Math.PI / 180 : (index + 0.5) * Math.PI / 8;
        const radius = index === 15 ? 1.2 : 1;
        targets.push({ x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, tolerance: index === 15 ? 0.08 : 0.18 });
      }
      try {
        for (const target of targets) {
          const started = Date.now();
          let reached = false;
          while (Date.now() - started < 6000) {
            const state = driver.state();
            expect(state.drowning).to.equal(false);
            expect(state.animation).not.to.equal(HERO_ANIMATION.JUMP);
            const dx = target.x - state.position.x;
            const dz = target.z - state.position.z;
            const tolerance = target.tolerance ?? 0.18;
            const distance = Math.max(Math.abs(dx), Math.abs(dz));
            if (distance < tolerance) { reached = true; break; }
            const yaw = Math.PI / 4 + window.gameCameraTest.state().viewport.rotation * Math.PI / 2;
            const axisX = Math.abs(dx) >= tolerance ? Math.sign(dx) : 0;
            const axisZ = axisX === 0 ? Math.sign(dz) : 0;
            driver.move(
              Math.cos(yaw) * axisX - Math.sin(yaw) * axisZ,
              -Math.sin(yaw) * axisX - Math.cos(yaw) * axisZ,
            );
            await new Promise((resolve) => window.setTimeout(resolve, 30));
          }
          expect(reached, JSON.stringify(driver.state().position)).to.equal(true);
        }
        driver.move(0, 0);
        const settledAt = Date.now();
        while (!driver.state().grounded && Date.now() - settledAt < 1000) {
          await new Promise((resolve) => window.setTimeout(resolve, 16));
        }
        expect(driver.state().position.y).to.be.closeTo(4, 0.04);
        expect(driver.state().grounded).to.equal(true);
      } finally {
        driver.move(0, 0);
      }
    });
  });
});
