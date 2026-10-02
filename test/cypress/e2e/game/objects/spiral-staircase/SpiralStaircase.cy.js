import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import castleMap from "../../../../../../src/game/maps/tests/castle-spiral-ascent.json";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/CastleResidentialLayout.js";

function firstPerson(window) {
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

describe("Spiral staircase", () => {
  for (const perspective of [false, true]) {
    it(`walks a full turn without jumping in ${perspective ? "first person" : "isometric"} view`, () => {
      cy.viewport(640, 480);
      cy.visit("/en/map/test_spiral-staircase?camera-test");
      ready();
      cy.window().then({ timeout: 180000 }, async (window) => {
        const driver = window.gameMovementTest;
        const targets = [{ x: 0.5, z: 2.5 }, { x: 0.5, z: 1.3 }];
        for (let index = 0; index < 16; index++) {
          const angle = index === 15 ? 340 * Math.PI / 180 : (index + 0.5) * Math.PI / 8;
          const radius = index === 15 ? 1.2 : 1;
          targets.push({ x: Math.sin(angle) * radius, z: Math.cos(angle) * radius });
        }
        try {
          for (const [index, target] of targets.entries()) {
            if (perspective && index === 1) firstPerson(window);
            await walkTo(window, target, perspective && index >= 1);
          }
          expect(driver.state().position.y).to.be.closeTo(4, 0.05);
          expect(driver.state().grounded).to.equal(true);
        } finally { driver.move(0, 0); }
      });
    });
  }

  it("climbs the generated castle spiral and walks onto the second floor in first person", () => {
    cy.viewport(640, 480);
    cy.visit("/en/map/test_castle-spiral-ascent?camera-test");
    ready();
    cy.window().then({ timeout: 180000 }, async (window) => {
      const driver = window.gameMovementTest;
      const { plan, stair, hallZ } = await climbCastle(window);
      try {
        const upperEntry = plan.layout.roomPlan.doorways.find((door) => door.roomId === "leisure");
        const origin = plan.layout.roomPlan.origin;
        const upperDoor = { x: origin.x + upperEntry.center, z: origin.z + upperEntry.coordinate };
        for (const target of [{ x: 1.4, z: hallZ }, { x: upperDoor.x, z: upperDoor.z + 0.8 },
          { x: upperDoor.x, z: upperDoor.z - 0.7 }, { x: upperDoor.x, z: upperDoor.z + 0.8 },
          { x: 2.8, z: hallZ }]) await walkTo(window, target, true);
        const camera = window.gameCameraTest.state().firstPersonCamera;
        const length = Math.hypot(camera.direction.x, camera.direction.z);
        driver.move(camera.right.x, camera.direction.x / length);
        driver.jump();
        const jumpStarted = Date.now();
        while (driver.state().position.x < 4.1 && Date.now() - jumpStarted < 2000) {
          await new Promise((resolve) => window.setTimeout(resolve, 40));
        }
        driver.move(0, 0);
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        expect(driver.state().position.x).to.be.greaterThan(4.05);
        expect(driver.state().position.y).to.be.closeTo(stair.center.y, 0.08);
        const landedY = driver.state().position.y;
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        expect(driver.state().position.y).to.be.closeTo(landedY, 0.05);
      } finally { driver.move(0, 0); }
    });
  });

  it("crosses the filled exit-side landing and captures it in first person", () => {
    cy.viewport(640, 480);
    cy.visit("/en/map/test_castle-spiral-ascent?camera-test");
    ready();
    cy.window().then({ timeout: 180000 }, async (window) => {
      const driver = window.gameMovementTest;
      const { stair } = await climbCastle(window);
      try {
        for (const target of [{ x: stair.center.x + 0.6, z: stair.center.z + 0.35 },
          { x: stair.center.x + 0.35, z: stair.center.z + 0.65 },
          { x: stair.center.x + 0.6, z: stair.center.z + 1.05 },
          { x: stair.center.x + 1.9, z: stair.center.z + 1.05 },
          { x: stair.center.x + 1.9, z: stair.center.z + 0.35 }]) {
          await walkTo(window, { ...target, speed: 0.6 }, true);
          expect(driver.state().position.y).to.be.closeTo(stair.center.y + stair.rise, 0.08);
        }
        const camera = window.gameCameraTest.state().firstPersonCamera;
        const yaw = Math.atan2(camera.direction.x, camera.direction.z) * 180 / Math.PI;
        const pitch = Math.asin(camera.direction.y) * 180 / Math.PI;
        window.gameCameraTest.lookFirstPersonBy(-75 - yaw, pitch + 40);
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      } finally { driver.move(0, 0); }
    });
    cy.viewport(1280, 900);
    cy.wait(700);
    cy.get(".background-canvas").screenshot("castle-first-person-open-landing");
  });
});

async function climbCastle(window) {
  const driver = window.gameMovementTest;
  firstPerson(window);
  const plan = await CastleGenerator.generate(castleMap.objects[0]);
  const stair = new CastleResidentialLayout(plan).stairs;
  const entry = plan.metadata.runtime.roomDoors.find((door) => door.roomId === "library" && door.y === stair.center.y);
  const targets = [{ x: entry.x, z: entry.z + 0.5 }, { x: entry.x, z: entry.z - 0.6 },
    { x: entry.x, z: entry.z + 0.5 }, castleMap.heroSpawn, ...stair.treads];
  const last = targets.at(-1);
  const outer = { x: stair.center.x + (last.x - stair.center.x) * 1.5,
    z: stair.center.z + (last.z - stair.center.z) * 1.5 };
  const hallZ = stair.center.z + stair.radius - 0.4;
  targets.push(outer, { x: outer.x + 0.35, z: outer.z },
    { x: outer.x + 0.35, z: hallZ }, { x: outer.x + 1.2, z: hallZ });
  try {
    for (const target of targets) {
      await walkTo(window, { ...target, speed: 0.6 }, true);
      // Contact support ramps between adjacent treads; detect a wrong turn or fall.
      if (target.y !== undefined && target !== castleMap.heroSpawn) {
        expect(driver.state().position.y, `tread at ${target.x}, ${target.z}`).to.be.closeTo(target.y, 0.4);
      }
    }
    expect(driver.state().position.y).to.be.closeTo(stair.center.y + stair.rise, 0.05);
    expect(driver.state().grounded).to.equal(true);
  } finally { driver.move(0, 0); }
  return { plan, stair, hallZ };
}
