import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import castleMap from "../../../../../../src/game/maps/tests/castle-spiral-ascent.json";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/CastleResidentialLayout.js";

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

describe("Generated castle repairs", () => {
  it("allows repeated entry and exit through a right-hinged private door", () => {
    cy.visit("/en/map/test_castle-room-doorway?camera-test");
    ready(); cy.wait(5000);
    cy.window().then((window) => firstPerson(window)); cy.wait(1000);
    cy.window().then({timeout:60000}, async (window) => {
      await walkTo(window,{x:2.375,z:1},true);
      await walkTo(window,{x:2.375,z:-2},true);
      await walkTo(window,{x:2.375,z:1},true);
    });
  });
  it("walks through private room entrances in first person", () => {
    cy.viewport(1280, 900);
    cy.visit("/en/map/test_castle-spiral-ascent?camera-test");
    ready();
    cy.wait(8000);
    cy.window().then({ timeout: 180000 }, async (window) => {
      firstPerson(window);
      const plan = await CastleGenerator.generate(castleMap.objects[0]);
      const layout = new CastleResidentialLayout(plan);
      const room = plan.layout.roomPlan.rooms.service;
      const door = plan.layout.roomPlan.doorways.find((entry) => entry.roomId === "service" && entry.axis === "z");
      const libraryDoor = plan.metadata.runtime.roomDoors.find((entry) => entry.roomId === "library" && entry.y === layout.origin.y && entry.yaw === 0);
      await walkTo(window, { x: libraryDoor.x, z: libraryDoor.z + 0.65 }, true);
      await walkTo(window, { x: libraryDoor.x, z: libraryDoor.z - 0.75 }, true);
      await walkTo(window, { x: libraryDoor.x, z: -2.9 }, true);
      const start = layout.toWorld(0, 1.1);
      await walkTo(window, start, true);
      const side = layout.toWorld(2.8, 1.1);
      await walkTo(window, side, true);
      const approach = layout.toWorld(door.center, door.coordinate - 0.8);
      await walkTo(window, approach, true);
      const camera = window.gameCameraTest.state().firstPersonCamera;
      const yaw = Math.atan2(camera.direction.x, camera.direction.z) * 180 / Math.PI;
      const pitch = Math.asin(camera.direction.y) * 180 / Math.PI;
      window.gameCameraTest.lookFirstPersonBy(-yaw, pitch);
      window.castleRepairRoom = { room, layout };
    });
    cy.wait(1000);
    cy.get(".background-canvas").screenshot("castle-service-door-first-person");
    cy.window().then({ timeout: 120000 }, async (window) => {
      const { room, layout } = window.castleRepairRoom;
      const door = layout.toWorld((room.minX + room.maxX) / 2, room.minZ + 1);
      await walkTo(window, door, true);
      window.gameCameraTest.lookFirstPersonBy(0, -30);
    });
    cy.wait(700);
    cy.get(".background-canvas").screenshot("castle-service-ceiling-first-person");
  });
  it("inspects a gallery seed exterior and hall while moving the first-person camera", () => {
    cy.viewport(1280, 900);
    cy.visit("/en/map/test_castle-room-correctness?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 90000 }).should("be.visible");
    cy.wait(12000);
    cy.window().then({ timeout: 120000 }, async (window) => {
      firstPerson(window);
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      const camera = window.gameCameraTest.state().firstPersonCamera;
      const yaw = Math.atan2(camera.direction.x, camera.direction.z) * 180 / Math.PI;
      const pitch = Math.asin(camera.direction.y) * 180 / Math.PI;
      window.gameCameraTest.lookFirstPersonBy(-45 - yaw, pitch - 15);
    });
    cy.wait(700);
    cy.get(".background-canvas").screenshot("castle-gallery-exterior-first-person");
    cy.window().then((window) => window.gameCameraTest.lookFirstPersonBy(5, 0));
    cy.wait(700);
    cy.get(".background-canvas").screenshot("castle-gallery-exterior-first-person-turned");
    cy.window().then({ timeout: 120000 }, async (window) => {
      await walkTo(window, { x: 0, z: -9 }, true);
      await walkTo(window, { x: 0, z: -4.7 }, true);
      const camera = window.gameCameraTest.state().firstPersonCamera;
      const yaw = Math.atan2(camera.direction.x, camera.direction.z) * 180 / Math.PI;
      const pitch = Math.asin(camera.direction.y) * 180 / Math.PI;
      window.gameCameraTest.lookFirstPersonBy(-yaw, pitch + 55);
    });
    cy.wait(700);
    cy.get(".background-canvas").screenshot("castle-hall-first-person");
  });
});
