import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import castleMap from "../../../../../../src/game/maps/tests/castle-clearance.json";
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


describe("Reported castle clearance", () => {
  it("climbs the reported seed and crosses its upper doorway without falling", () => {
    cy.viewport(1280,900);
    cy.visit("/en/map/test_castle-clearance?camera-test");
    ready(); cy.wait(3000);
    cy.window().then({timeout:180000},async (window) => {
      firstPerson(window);
      const plan=await CastleGenerator.generate(castleMap.objects[0]);
      const layout=new CastleResidentialLayout(plan);
      const driver=window.gameMovementTest;
      for (const tread of layout.stairs.treads) await walkTo(window,{...tread,speed:0.6},true);
      const door=plan.metadata.runtime.roomDoors.find((entry) => entry.roomId === "library" && entry.y > layout.origin.y);
      const last=layout.stairs.treads.at(-1);
      await walkTo(window,{x:layout.stairs.center.x+(last.x-layout.stairs.center.x)*1.5,z:layout.stairs.center.z+(last.z-layout.stairs.center.z)*1.5,speed:0.6},true);
      for (const x of [door.x-0.5,door.x+0.6,door.x-0.5,door.x+0.6]) {
        await walkTo(window,{x,z:door.z,speed:0.6},true);
        expect(driver.state().position.y).to.be.closeTo(door.y,0.18);
      }
      await walkTo(window,{x:door.x+0.4,z:door.z,speed:0.4},true);
      const camera=window.gameCameraTest.state().firstPersonCamera;
      window.gameCameraTest.lookFirstPersonBy(-90-Math.atan2(camera.direction.x,camera.direction.z)*180/Math.PI,Math.asin(camera.direction.y)*180/Math.PI+35);
      await new Promise((resolve) => window.setTimeout(resolve,700));
    });
    cy.get(".background-canvas").screenshot("reported-castle-upper-threshold");
  });
});
