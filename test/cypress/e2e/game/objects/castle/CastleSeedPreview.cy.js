function firstPerson(window) {
  // Cypress moves its pointer while capturing elements. Keep these camera
  // inspections controlled by the test driver rather than that synthetic input.
  for (const type of ["mousemove", "pointermove"]) {
    window.addEventListener(type, (event) => event.stopImmediatePropagation(), true);
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "ScrollLock" }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "ScrollLock" }));
}

async function walkTo(window, target, perspective) {
  const driver = window.gameMovementTest;
  const started = Date.now();
  let reached = false;
  while (Date.now() - started < 30000) {
    const state = driver.state();
    expect(state.drowning).to.equal(false);
    const dx = target.x - state.position.x;
    const dz = target.z - state.position.z;
    const tolerance = target.tolerance ?? (perspective ? 0.12 : 0.18);
    if ((perspective ? Math.hypot(dx, dz) : Math.max(Math.abs(dx), Math.abs(dz))) < tolerance) { reached = true; break; }
    if (perspective) {
      const camera = window.gameCameraTest.state().firstPersonCamera;
      const length = Math.hypot(camera.direction.x, camera.direction.z);
      const distance = Math.hypot(dx, dz);
      const x = dx / distance, z = dz / distance;
      const speed = target.speed ?? 1;
      driver.move((camera.right.x * x + camera.right.z * z) * speed,
        (camera.direction.x * x + camera.direction.z * z) / length * speed);
    } else {
      const yaw = Math.PI / 4 + window.gameCameraTest.state().viewport.rotation * Math.PI / 2;
      const x = Math.abs(dx) >= tolerance ? Math.sign(dx) : 0;
      const z = x === 0 ? Math.sign(dz) : 0;
      driver.move(Math.cos(yaw) * x - Math.sin(yaw) * z,
        -Math.sin(yaw) * x - Math.cos(yaw) * z);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 30));
  }
  expect(reached, JSON.stringify({ target, position: driver.state().position, animation: driver.state().animation })).to.equal(true);
  driver.move(0, 0);
  await new Promise((resolve) => window.setTimeout(resolve, 100));
}

function ready() {
  cy.get('.background-canvas[data-game-ready="true"]', { timeout: 30000 }).should("be.visible");
  cy.window().its("gameMovementTest").should("exist");
}


describe("Castle seed preview", () => {
  it("replaces one castle, updates its sign, and rearms only after stepping off", () => {
    cy.viewport(1280,900);
    cy.visit("/en/map/test_castle-seeds?camera-test");
    ready();
    cy.window().then((window) => firstPerson(window));
    cy.wait(1000);
    let seed;
    cy.window().then({timeout:60000},async (window) => {
      const definitions = window.gameMovementTest.mapObjects();
      expect(definitions.filter((entry) => entry.object === "Castle")).to.have.length(1);
      seed=definitions.find((entry) => entry.object === "Castle").seed;
      await walkTo(window,{x:3,z:-8},true);
    });
    cy.window().should((window) => {
      const objects=window.gameMovementTest.mapObjects();
      const castle=objects.find((entry) => entry.object === "Castle");
      expect(castle.seed).not.to.equal(seed);
      expect(objects.find((entry) => entry.id === castle.seedSignId).text).to.equal(`Seed ${castle.seed}`);
      expect(objects.filter((entry) => entry.object === "Castle")).to.have.length(1);
      expect(window.gameCameraTest.state().firstPersonCamera).not.to.equal(null);
    });
    cy.window().then((window) => {seed=window.gameMovementTest.mapObjects().find((entry) => entry.object === "Castle").seed;});
    cy.wait(1500);
    cy.window().then({timeout:60000},async (window) => {
      expect(window.gameMovementTest.mapObjects().find((entry) => entry.object === "Castle").seed).to.equal(seed);
      await walkTo(window,{x:0,z:-9},true);
      await walkTo(window,{x:3,z:-8},true);
    });
    cy.window().should((window) => {
      const objects=window.gameMovementTest.mapObjects();
      const castle=objects.find((entry) => entry.object === "Castle");
      expect(castle.seed).not.to.equal(seed);
      expect(objects.find((entry) => entry.id === castle.seedSignId).text).to.equal(`Seed ${castle.seed}`);
      expect(objects.filter((entry) => entry.object === "Castle")).to.have.length(1);
    });
    cy.window().then((window) => firstPerson(window));
    cy.wait(500);
    cy.get(".background-canvas").screenshot("castle-seed-preview");
  });
});
