/**
 * Walk through the production collision world without overriding door poses.
 * @param {Window} window
 * @param {number} x
 * @param {number} z
 */
async function walkTo(window, x, z, floorY = 2, perspective = false) {
  const driver = window.gameMovementTest;
  const started = Date.now();
  while (Date.now() - started < 12000) {
    const state = driver.state();
    const dx = x - state.position.x;
    const dz = z - state.position.z;
    expect(state.drowning).to.equal(false);
    if (floorY !== null) {
      expect(state.position.y).to.be.within(floorY - 0.1, floorY + 0.2);
    }
    if (Math.hypot(dx, dz) < (perspective ? .12 : .18)) {
      driver.move(0, 0);

      return;
    }
    if (perspective) {
      const camera = window.gameCameraTest.state().firstPersonCamera;
      const length = Math.hypot(camera.direction.x, camera.direction.z);
      const distance = Math.hypot(dx, dz);
      driver.move((camera.right.x * dx + camera.right.z * dz) / distance * .45,
        (camera.direction.x * dx + camera.direction.z * dz) / length / distance * .45);
    } else {
      const yaw = Math.PI / 2 + window.gameCameraTest.state().viewport.rotation * Math.PI / 2;
      const worldX = Math.max(-1, Math.min(1, dx * 3));
      const worldZ = Math.max(-1, Math.min(1, dz * 3));
      driver.move(Math.cos(yaw) * worldX - Math.sin(yaw) * worldZ,
        -Math.sin(yaw) * worldX - Math.cos(yaw) * worldZ);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 30));
  }
  driver.move(0, 0);
  expect.fail(`Hero could not walk to ${x}, ${z}: ${JSON.stringify(driver.state().position)}`);
}

describe("Rear bell castle", () => {
  it("uses the right-hand terrace landing and climbs to the centered bell", () => {
    cy.visit("/map/test_castle-rear-bell-tower?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 90000 }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");
    cy.window().then({ timeout: 180000 }, async (window) => {
      window.gameCameraTest.firstPerson(true);
      window.gameMovementTest.teleport({
        x: 1.275,
        y: 6.04,
        z: -5.996,
      });
      await walkTo(window, 0, -4.5, null, true);
      await walkTo(window, 0, -1, null, true);
      await walkTo(window, 0, -4.5, null, true);
      await walkTo(window, 1.3, -5.75, null, true);
      for (let index = 0; index < 20; index++) {
        const angle = (96 + index * 12) * Math.PI / 180;
        await walkTo(window, Math.sin(angle) * 1.3, -6.25 + Math.cos(angle) * 1.3, null, true);
        expect(window.gameMovementTest.state().position.y).to.be.greaterThan(6 + (index + 1) * .2 - .15);
      }
      await walkTo(window, 0, -4.7, null, true);
      await walkTo(window, 1.2, -5.3, null, true);
      await walkTo(window, 1.1, -6, null, true);
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(10, .08);
    });
  });

  it("opens every door by hero approach and traverses both directions", () => {
    cy.viewport(1440, 1000);
    cy.visit("/map/test_castle-rear-bell-tower?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 90000 }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");
    cy.window().then({ timeout: 180000 }, async (window) => {
      window.gameCameraTest.firstPerson(false);
      window.gameMovementTest.teleport({
        x: -4,
        y: 2.15,
        z: 10,
      });
      for (const [x, z] of [[-4, 4.2], [-4, 4], [0, 4], [0, .75], [3.2, .75], [0, .75],
        [0, 3.5], [3.2, 3.5], [0, 3.5], [0, -1], [0, -3.7], [0, -1],
        [0, 4], [-4, 4], [-4, 4.2], [-4, 10]]) {
        await walkTo(window, x, z);
      }
      window.gameMovementTest.teleport({
        x: 0,
        y: 6.14,
        z: 1,
      });
      for (const z of [-1, -3.7, -1, 1]) {
        await walkTo(window, 0, z, 6);
      }
    });
    cy.get("[data-global-exception]").should("not.exist");
  });
});
