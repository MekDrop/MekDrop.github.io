import { HERO_ANIMATION } from "../../../src/game/enum/HeroAnimation.js";

const GRASS_SURFACE_LIFT = 0.14;

function loadScenario(scenario) {
  cy.window().then((window) => {
    window.gameMovementTest.moveForward(false);
    window.gameMovementTest.loadScenario(scenario);
  });
}

function moveForward() {
  cy.window().then((window) => {
    window.gameMovementTest.moveForward(true);
  });
}

function stopMoving() {
  cy.window().then((window) => {
    window.gameMovementTest.moveForward(false);
  });
}

function move(inputX, inputY) {
  cy.window().then((window) => {
    window.gameMovementTest.move(inputX, inputY);
  });
}

function setMovementKey(code, pressed) {
  const eventName = pressed ? "keydown" : "keyup";
  cy.window().trigger(eventName, {
    code,
    key: code,
  });
}

function expectState(assertion, timeout = 8000) {
  cy.window().then({ timeout: timeout + 1000 }, (window) => {
    const startedAt = Date.now();
    return new Cypress.Promise((resolve, reject) => {
      const inspect = () => {
        try {
          assertion(window.gameMovementTest.state());
          resolve();
        } catch (cause) {
          if (Date.now() - startedAt >= timeout) {
            reject(cause);
            return;
          }
          window.setTimeout(inspect, 16);
        }
      };
      inspect();
    });
  });
}

function expectStateContinually(assertion, duration = 250) {
  cy.window().then({ timeout: duration + 1000 }, (window) => {
    const startedAt = Date.now();
    return new Cypress.Promise((resolve, reject) => {
      const inspect = () => {
        try {
          assertion(window.gameMovementTest.state());
        } catch (cause) {
          reject(cause);
          return;
        }
        if (Date.now() - startedAt >= duration) {
          resolve();
          return;
        }
        window.setTimeout(inspect, 16);
      };
      inspect();
    });
  });
}

describe("Hero movement on a predefined terrain map", { testIsolation: false }, () => {
  before(() => {
    cy.visit("/?movement-test=flat");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().its("gameMovementTest").should("exist");
  });

  afterEach(() => {
    stopMoving();
  });

  it("walks across level terrain", () => {
    loadScenario("flat");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.75);
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
    });
  });

  it("walks down onto terrain one block lower", () => {
    loadScenario("safe-descent");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
      expect(state.position.y).to.be.closeTo(1 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
    });
  });

  it("lands on a one-tile-wide lower platform when both boots fit", () => {
    loadScenario("narrow-landing");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
      expect(state.position.y).to.be.closeTo(1 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
    });
  });

  it("jumps from a higher platform onto safe lower terrain", () => {
    loadScenario("jump-descent");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
      window.gameMovementTest.moveForward(true);
    });
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.JUMP);
      expect(state.grounded).to.equal(false);
    });
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
      expect(state.position.y).to.be.closeTo(1 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
    });
  });

  it("jumps from lower terrain onto a one-block-higher platform", () => {
    loadScenario("jump-ascent");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
      window.gameMovementTest.moveForward(true);
    });
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.JUMP);
      expect(state.grounded).to.equal(false);
    });
    expectState((state) => {
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
    });
  });

  it("jumps onto a higher platform beside its exposed corner", () => {
    loadScenario("jump-ascent-corner");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
      window.gameMovementTest.moveForward(true);
    });
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.JUMP);
      expect(state.grounded).to.equal(false);
    });
    expectState((state) => {
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
    });
  });

  it("jumps onto a higher platform after stopping against its exposed edge", () => {
    loadScenario("jump-ascent-corner");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.BLOCKED_PUSH);
      expect(state.grounded).to.equal(true);
    });
    cy.window().then((window) => {
      window.gameMovementTest.jump();
    });
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.JUMP);
      expect(state.grounded).to.equal(false);
    });
    expectState((state) => {
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
    });
  });

  it("jumps from an exposed lower edge onto a higher platform", () => {
    loadScenario("jump-ascent-gap");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
      window.gameMovementTest.moveForward(true);
    });
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.JUMP);
      expect(state.grounded).to.equal(false);
    });
    expectState((state) => {
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
    });
  });

  it("continues onto raised terrain when both boots initially land halfway", () => {
    loadScenario("jump-ascent-partial-feet");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
      window.gameMovementTest.moveForward(true);
    });
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.JUMP);
      expect(state.grounded).to.equal(false);
    });
    expectState((state) => {
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
    });
  });

  it("walks forward when both boots start halfway onto raised terrain", () => {
    loadScenario("partial-raised-start");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.2);
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
      expect(state.grounded).to.equal(true);
    });
    expectStateContinually((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
    });
  });

  it("refuses a drop deeper than one block", () => {
    loadScenario("deep-drop");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.EDGE_REFUSE_LEFT);
      expect(state.position.x).to.be.lessThan(-0.74);
    });
  });

  it("refuses to put half a boot over empty space", () => {
    loadScenario("void-edge");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.EDGE_REFUSE_LEFT);
      expect(state.position.x).to.be.lessThan(0.26);
    });
  });

  it("refuses a sideways half-boot overhang while walking parallel to a ledge", () => {
    loadScenario("parallel-edge");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.EDGE_REFUSE_LEFT);
      expect(state.position.x).to.be.closeTo(-2, 0.08);
    });
  });

  it("plays the right-foot refusal for the mirrored parallel ledge", () => {
    loadScenario("parallel-edge-right");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.EDGE_REFUSE_RIGHT);
      expect(state.position.x).to.be.closeTo(-2, 0.08);
    });
  });

  it("stops before leaning into a taller cube", () => {
    loadScenario("higher-cube");
    setMovementKey("ArrowDown", true);
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.BLOCKED_PUSH);
      expect(state.position.x).to.be.lessThan(-1.27);
    });
    setMovementKey("ArrowDown", false);
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.IDLE);
      expect(state.animationTransitioning).to.equal(false);
      expect(state.position.x).to.be.lessThan(-1.27);
    }, 250);
  });

  it("stops the torso before clipping through a raised terrain corner", () => {
    loadScenario("raised-corner");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.BLOCKED_PUSH);
      expect(state.position.x).to.be.lessThan(-1.12);
      expect(state.position.y).to.be.closeTo(1 + GRASS_SURFACE_LIFT, 0.03);
    });
  });

  it("walks out of a raised-terrain pocket along an open direction", () => {
    loadScenario("raised-pocket");
    move(0, -1);
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.BLOCKED_PUSH);
      expect(state.position.x).to.be.closeTo(-0.7, 0.08);
    });
    stopMoving();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.IDLE);
    }, 250);

    move(0, 1);
    expectState((state) => {
      expect(state.position.x).to.be.lessThan(-1.1);
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.y).to.be.closeTo(1 + GRASS_SURFACE_LIFT, 0.03);
    });
    stopMoving();
  });

  it("walks through a foot-wide corridor between taller cubes", () => {
    loadScenario("narrow-corridor");
    moveForward();
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.WALK);
      expect(state.position.x).to.be.greaterThan(-0.75);
      expect(state.position.y).to.be.closeTo(1 + GRASS_SURFACE_LIFT, 0.03);
    });
  });
});
