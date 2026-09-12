import { HERO_ANIMATION } from "../../../src/game/enum/HeroAnimation.js";

function pressKey(code) {
  cy.window().trigger("keydown", { code, key: code });
}

describe("Buried treasure", () => {
  beforeEach(() => {
    cy.visit("/map/test_flat");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
  });

  it("allows digging after chopping down a tree", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("tree-dig");
    });
    cy.get(".interaction-prompt").should("contain.text", "Chop tree");
    pressKey("KeyE");
    cy.get(".interaction-prompt", { timeout: 10000 }).should(
      "contain.text",
      "Dig for treasure",
    );
  });

  it("reveals embedded stones when digging at a lava source", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("lava-source-dig");
    });
    cy.get(".interaction-prompt").should("contain.text", "Dig for treasure");
    pressKey("KeyE");
    cy.window({ timeout: 7000 }).should((window) => {
      expect(window.gameMovementTest.state().animation).to.equal(
        HERO_ANIMATION.DIG_BLOCKED_ANNOYED,
      );
    });
  });

  it("allows digging on grass beside a lava source", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("lava-source-bank");
    });
    cy.get(".interaction-prompt").should("contain.text", "Dig for treasure");
  });

  it("allows digging on grass diagonally outside the lava bank", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("lava-source-diagonal-dig");
    });
    cy.get(".interaction-prompt").should("contain.text", "Dig for treasure");
  });

  it("allows digging on an ordinary river bank after collecting its flower", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("river-bank-flower-dig");
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect flowers");
    pressKey("KeyE");
    cy.get(".interaction-prompt", { timeout: 5000 }).should(
      "contain.text",
      "Dig for treasure",
    );
  });

  it("digs up a chest, opens it, and collects medieval coins", () => {
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().wallet).to.deep.equal({
        gold: 0,
        silver: 0,
        copper: 0,
      });
    });
    cy.get(".coin-wallet").should("not.exist");
    cy.get(".interaction-prompt").should("contain.text", "Dig for treasure");

    cy.window().then((window) => {
      window.Math.random = () => 0.1;
    });
    pressKey("KeyE");
    cy.get(".interaction-prompt").should("contain.text", "Stop digging");
    cy.get(".interaction-prompt", { timeout: 7000 }).should(
      "contain.text",
      "Open treasure chest",
    );

    cy.window().then((window) => {
      let seed = 137;
      window.Math.random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    });
    pressKey("KeyE");
    cy.wait(700);

    cy.window().should((window) => {
      const wallet = window.gameMovementTest.state().wallet;
      expect(wallet.gold + wallet.silver + wallet.copper).to.equal(0);
    });
    cy.wait(1900);

    cy.window({ timeout: 4000 }).should((window) => {
      const wallet = window.gameMovementTest.state().wallet;
      expect(wallet.gold + wallet.silver + wallet.copper).to.equal(5);
    });

    cy.get(".interaction-prompt").should("contain.text", "Fill hole");
    let positionBeforeHole;
    cy.window().then((window) => {
      positionBeforeHole = window.gameMovementTest.state().position;
      window.gameMovementTest.move(-1, 0);
    });
    cy.window({ timeout: 3000 }).should((window) => {
      expect(window.gameMovementTest.state().animation).to.equal(
        HERO_ANIMATION.HOLE_REFUSAL,
      );
    });
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
      const position = window.gameMovementTest.state().position;
      expect(
        Math.hypot(
          position.x - positionBeforeHole.x,
          position.z - positionBeforeHole.z,
        ),
      ).to.be.lessThan(0.55);
    });
    cy.window({ timeout: 3000 }).should((window) => {
      expect(window.gameMovementTest.state().animation).not.to.equal(
        HERO_ANIMATION.HOLE_REFUSAL,
      );
    });

    pressKey("KeyE");
    cy.get(".interaction-prompt").should("contain.text", "Stop filling");
    cy.window({ timeout: 3000 }).should((window) => {
      expect(window.gameMovementTest.state().animation).to.equal(
        HERO_ANIMATION.FILL_HOLE,
      );
    });
    cy.get("body", { timeout: 7000 }).should(($body) => {
      expect($body.find(".interaction-prompt").text()).not.to.contain(
        "Stop filling",
      );
    });
    cy.window().then((window) => {
      window.gameMovementTest.move(-1, 0);
    });
    cy.wait(600);
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
      const position = window.gameMovementTest.state().position;
      expect(
        Math.hypot(
          position.x - positionBeforeHole.x,
          position.z - positionBeforeHole.z,
        ),
      ).to.be.greaterThan(0.55);
    });
  });
});
