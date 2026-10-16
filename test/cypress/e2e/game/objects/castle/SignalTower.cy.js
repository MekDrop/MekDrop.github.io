import { CastleSignalTowerLayout } from "../../../../../../src/game/objects/castle/signal-tower/CastleSignalTowerLayout.js";

describe("Signal tower bell", () => {
  it("reaches with a hand, pulls before striking, and releases the action lock", () => {
    let audioStarts;
    let beforeStrike;
    let bell;
    const samples = [];
    cy.viewport(1440, 1000);
    cy.visit("/en-US/map/test_signal-tower?camera-test", {
      onBeforeLoad(window) {
        audioStarts = cy.spy(window.AudioBufferSourceNode.prototype, "start");
        const sample = () => {
          const pose = window.gameMovementTest?.animationPose(["Right white glove", "Right elbow"]);
          if (pose?.clip === "RingBell") {
            samples.push({
              ...pose,
              position: window.gameMovementTest.state().position,
            });
          }
          window.requestAnimationFrame(sample);
        };
        window.requestAnimationFrame(sample);
      },
    });
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");
    cy.window().then(window => {
      const castle = window.gameMovementTest.mapObjects().find(item => item.object === "Castle");
      bell = CastleSignalTowerLayout.describe(castle.buildPlan).bell;
      window.gameMovementTest.teleport({
        ...bell.position,
        z: bell.position.z + 0.8,
      });
      window.gameCameraTest.setRotation(3);
      window.gameCameraTest.setZoom(9);
      window.gameCameraTest.returnToHero();
    });
    cy.window().should(window => {
      expect(window.gameCameraTest.state().cameraReturningToHero).to.equal(false);
    });
    cy.window().then(window => {
      const canvas = window.document.querySelector(".background-canvas");
      const head = window.gameMovementTest.state().patScreenPosition;
      window.gameCameraTest.panBy(canvas.clientWidth / 2 - head.x, canvas.clientHeight / 2 - head.y);
      window.gameCameraTest.setRotation(2);
    });
    cy.get(".interaction-prompt", { timeout: 10000 }).should("contain.text", "Ring bell");
    cy.get(".background-canvas").click("bottomRight");
    cy.then(() => { beforeStrike = audioStarts.callCount; });
    cy.window().trigger("keydown", {
      code: "KeyE",
      key: "e",
    });
    cy.window().trigger("keyup", {
      code: "KeyE",
      key: "e",
    });
    cy.get(".interaction-prompt").should("not.exist");
    cy.window({ timeout: 20000 }).should(window => {
      const pose = window.gameMovementTest.animationPose(["Right white glove"]);
      expect(pose.clip).to.equal("RingBell");
      expect(pose.time).to.be.within(0.5, 1.15);
      expect(window.gameMovementTest.state().action.name).to.equal("ringingBell");
      expect(window.gameMovementTest.dodge(0, -1)).to.equal(false);
      expect(window.gameMovementTest.interact()).to.equal(false);
    });
    cy.screenshot("signal-tower-hand-pull");
    cy.wrap(null, { timeout: 20000 }).should(() => {
      expect(audioStarts.callCount).to.equal(beforeStrike + 1);
    });
    cy.get(".interaction-prompt", { timeout: 20000 }).should("contain.text", "Ring bell");
    cy.then(() => {
      const grips = samples.filter(pose => pose.time >= 0.5 && pose.time <= 1.15);
      expect(grips.length).to.be.greaterThan(2);
      const heights = grips.map(pose => pose.joints["Right white glove"].y);
      const draws = grips.map(pose => pose.joints["Right white glove"].z - bell.position.z);
      expect(Math.max(...draws) - Math.min(...draws)).to.be.greaterThan(0.1);
      expect(Math.max(...heights) - Math.min(...heights)).to.be.lessThan(0.08);
      for (const pose of grips) {
        const hand = pose.joints["Right white glove"];
        expect(Math.abs(pose.position.y - bell.position.y)).to.be.lessThan(0.05);
        expect(Math.abs(hand.x - bell.position.x)).to.be.lessThan(0.04);
        expect(hand.z - bell.position.z).to.be.within(-0.04, 0.23);
        expect(Number.isFinite(pose.joints["Right elbow"].y)).to.equal(true);
      }
    });
    cy.then(() => { beforeStrike = audioStarts.callCount; });
    cy.window().trigger("keydown", {
      code: "KeyE",
      key: "e",
    });
    cy.window().trigger("keyup", {
      code: "KeyE",
      key: "e",
    });
    cy.wrap(null, { timeout: 20000 }).should(() => { expect(audioStarts.callCount).to.equal(beforeStrike + 1); });
    cy.get(".interaction-prompt", { timeout: 20000 }).should("contain.text", "Ring bell");
    // Interrupt before contact: no delayed strike may survive teleporting away.
    cy.then(() => { beforeStrike = audioStarts.callCount; });
    cy.window().trigger("keydown", {
      code: "KeyE",
      key: "e",
    });
    cy.window().trigger("keyup", {
      code: "KeyE",
      key: "e",
    });
    cy.window().then(window => {
      window.gameMovementTest.teleport({
        ...bell.position,
        y: bell.position.y - 3,
        z: bell.position.z + 0.8,
      });
    });
    cy.get("body").should("not.contain.text", "E Ring bell");
    cy.window().should(window => { expect(window.gameMovementTest.state().action.name).to.equal("exploring"); });
    cy.then(() => { expect(audioStarts.callCount).to.equal(beforeStrike); });
  });
});
