import { HERO_ANIMATION } from "../../../../../../src/game/enum/HeroAnimation.js";

describe("Movement-driven ladder climbing", () => {
  it("restores both shoulders after backing away from the ladder", () => {
    cy.visit("/map/test_ladder-climb?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 }).should("be.visible");
    let movement, resting;
    const shoulders = ["Left arm", "Right arm"];
    cy.window().then(window => {
      const ladder = window.gameMovementTest.mapObjects().find(object => object.object === "Ladder");
      window.gameMovementTest.teleport(ladder.bottom);
      const yaw = Math.PI / 4 + window.gameCameraTest.state().viewport.rotation * Math.PI / 2;
      movement = [-Math.sin(yaw), -Math.cos(yaw)];
    });
    cy.wait(1800);
    cy.window().then(window => {
      resting = shoulders.map(name => window.gameMovementTest.jointRotation(name));
      resting.forEach(rotation => expect(rotation).to.exist);
      window.gameMovementTest.move(...movement);
    });
    cy.window().should(window => {
      expect(window.gameMovementTest.state().animation).to.equal(HERO_ANIMATION.CLIMB);
      shoulders.forEach((name, index) => {
        const rotation = window.gameMovementTest.jointRotation(name), rest = resting[index];
        const dot = Math.abs(rotation.x * rest.x + rotation.y * rest.y + rotation.z * rest.z + rotation.w * rest.w);
        expect(dot).to.be.lessThan(0.9);
      });
    });
    cy.window().then(window => window.gameMovementTest.move(-movement[0], -movement[1]));
    cy.window({ timeout: 10000 }).should(window => expect(window.gameMovementTest.state().animation).not.to.equal(HERO_ANIMATION.CLIMB));
    cy.window().then(window => {
      window.gameMovementTest.move(0, 0);
    });
    cy.wait(500);
    cy.window().should(window => {
      shoulders.forEach((name, index) => {
        const rotation = window.gameMovementTest.jointRotation(name), rest = resting[index];
        const dot = Math.abs(rotation.x * rest.x + rotation.y * rest.y + rotation.z * rest.z + rotation.w * rest.w);
        expect(dot).to.be.greaterThan(0.999);
      });
    });
  });
  it("leaves the climb pose on a raised collision surface and walks back down in first person", () => {
    cy.visit("/map/test_ladder-climb?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 }).should("be.visible");
    let ladder;
    cy.window().then(window => {
      ladder = window.gameMovementTest.mapObjects().find(object => object.object === "Ladder");
      window.gameMovementTest.teleport(ladder.bottom);
    });
    cy.wait(1800);
    cy.window().then(window => {
      const camera = window.gameCameraTest.firstPerson(true).firstPersonCamera;
      window.gameCameraTest.lookFirstPersonBy(-Math.atan2(camera.direction.x, camera.direction.z) * 180 / Math.PI, 0);
      window.gameMovementTest.move(0, 1);
    });
    cy.window().should(window => expect(window.gameMovementTest.state().animation).to.equal(HERO_ANIMATION.CLIMB));
    cy.window({ timeout: 15000 }).should(window => {
      const state = window.gameMovementTest.state();
      expect(state.position.y).to.be.greaterThan(ladder.top.y - 0.1);
      expect(state.grounded).to.equal(true);
      expect(state.animation).not.to.equal(HERO_ANIMATION.CLIMB);
    });
    cy.window().then(window => {
      ladder.top = { ...window.gameMovementTest.state().position };
      window.gameMovementTest.move(0, 0);
    });
    cy.wait(400);
    cy.window().then(window => {
      window.gameMovementTest.teleport(ladder.top);
      const direction = window.gameCameraTest.state().firstPersonCamera.direction;
      const yaw = Math.atan2(ladder.position.x - ladder.top.x, ladder.position.z - ladder.top.z);
      window.gameCameraTest.lookFirstPersonBy((yaw - Math.atan2(direction.x, direction.z)) * 180 / Math.PI, 0);
    });
    cy.wait(1800);
    cy.window().then(window => window.gameMovementTest.move(0, 1));
    cy.window().should(window => expect(window.gameMovementTest.state().animation).to.equal(HERO_ANIMATION.CLIMB_TOP));
    cy.window().should(window => expect(window.gameMovementTest.state().animation).to.equal(HERO_ANIMATION.CLIMB));
    cy.window({ timeout: 15000 }).should(window => expect(window.gameMovementTest.state().position.y).to.be.lessThan(ladder.bottom.y + 0.2));
    cy.window().then(window => window.gameMovementTest.move(0, 0));
  });
  it("climbs smoothly without E, pauses on release, and plays the authored clip", () => {
    cy.visit("/map/test_ladder-climb?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 }).should("be.visible");
    let ladder;
    cy.window().then((window) => {
      ladder = window.gameMovementTest.mapObjects().find(object => object.object === "Ladder");
      expect(ladder).to.exist;
      window.gameMovementTest.teleport(ladder.bottom);
    });
    cy.wait(1800);
    cy.window().then((window) => {
      const yaw = Math.PI / 4 + window.gameCameraTest.state().viewport.rotation * Math.PI / 2;
      const dx = ladder.position.x - ladder.bottom.x, dz = ladder.position.z - ladder.bottom.z;
      const length = Math.hypot(dx, dz);
      window.gameMovementTest.move((Math.cos(yaw) * dx - Math.sin(yaw) * dz) / length, (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / length);
    });
    cy.window().should(window => {
      const state = window.gameMovementTest.state();
      expect(state.animation).to.equal(HERO_ANIMATION.CLIMB);
      expect(state.position.y).to.be.greaterThan(ladder.bottom.y + 0.15);
      expect(state.position.y).to.be.lessThan(ladder.top.y - 0.15);
    });
    cy.window().then(window => window.gameMovementTest.move(0, 0));
    cy.wait(150);
    let paused;
    cy.window().then(window => { paused = window.gameMovementTest.state().position.y; });
    cy.wait(300);
    cy.window().then(window => {
      expect(window.gameMovementTest.state().position.y).to.be.closeTo(paused, 0.05);
      window.gameMovementTest.jump();
    });
    cy.window().should(window => expect(window.gameMovementTest.state().animation).not.to.equal(HERO_ANIMATION.CLIMB));
  });
});
