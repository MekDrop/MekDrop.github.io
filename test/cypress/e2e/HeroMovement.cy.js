import { HERO_ANIMATION } from "../../../src/game/enum/HeroAnimation.js";
import { POINTER_TYPE } from "../../../src/game/enum/PointerType.js";
import { GRASS_SURFACE_LIFT } from "../../../src/game/config/terrain.js";

const RESPAWN_CAMERA_DRAG_DISTANCE = 100000;

function loadScenario(scenario) {
  cy.window().then((window) => {
    window.gameMovementTest.moveForward(false);
    return window.gameMovementTest.loadScenario(scenario);
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

function dragCamera(deltaX, deltaY) {
  cy.get(".background-canvas").then(($viewport) => {
    const viewport = $viewport[0];
    const rect = viewport.getBoundingClientRect();
    const pointerId = 1;
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    cy.wrap($viewport)
      .trigger("pointerdown", {
        pointerId,
        pointerType: POINTER_TYPE.MOUSE,
        button: 0,
        buttons: 1,
        clientX,
        clientY,
      })
      .trigger("pointermove", {
        pointerId,
        pointerType: POINTER_TYPE.MOUSE,
        button: 0,
        buttons: 1,
        clientX: clientX + deltaX,
        clientY: clientY + deltaY,
      })
      .trigger("pointerup", {
        pointerId,
        pointerType: POINTER_TYPE.MOUSE,
        button: 0,
        buttons: 0,
        clientX: clientX + deltaX,
        clientY: clientY + deltaY,
      });
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
    cy.visit("/map/test_flat?camera-test");
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

  it("lands upright after dodging backward across level terrain", () => {
    loadScenario("flat");
    expectState((state) => {
      expect(state.grounded).to.equal(true);
    });
    cy.window().then((window) => {
      expect(window.gameMovementTest.dodge(0, -1, "down")).to.equal(true);
    });
    expectStateContinually((state) => {
      expect(state.animation).not.to.equal(HERO_ANIMATION.FALL_DEATH);
      expect(state.respawning).to.equal(false);
    }, 1200);
    expectState((state) => {
      expect(state.grounded).to.equal(true);
      expect(state.animation).to.equal(HERO_ANIMATION.IDLE);
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
    });
  });

  it("keeps both animated boots above the path while climbing a slope", () => {
    loadScenario("path-slope-walk");
    moveForward();
    let maximumAppliedLift = 0;
    let maximumTilt = 0;
    let minimumClearance = Number.POSITIVE_INFINITY;
    expectState((state) => {
      const feet = Object.values(state.footPlacement ?? {});
      for (const foot of feet) {
        maximumAppliedLift = Math.max(
          maximumAppliedLift,
          foot.appliedLift,
        );
        maximumTilt = Math.max(maximumTilt, foot.tiltDegrees);
        if (foot.minimumClearance !== null) {
          minimumClearance = Math.min(
            minimumClearance,
            foot.minimumClearance,
          );
        }
      }
      expect(state.position.x).to.be.greaterThan(1.2);
      expect(state.position.y).to.be.closeTo(2, 0.03);
      expect(state.grounded).to.equal(true);
      expect(maximumAppliedLift).to.be.greaterThan(0.02);
      expect(maximumTilt).to.be.greaterThan(10);
      expect(minimumClearance).to.be.at.least(-0.001);
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

  it("walks beneath a grade-separated path without colliding with its deck", () => {
    loadScenario("overpass-clearance");
    move(0, -1);
    expectState((state) => {
      expect(state.position.x).to.be.greaterThan(1.7);
      expect(state.position.y).to.be.closeTo(2, 0.03);
      expect(state.grounded).to.equal(true);
    });
  });

  it("keeps the camera rotation while walking beneath a grade-separated path", () => {
    loadScenario("overpass-camera-entry");
    cy.window().then((window) => {
      window.gameCameraTest.setZoom(3);
      window.gameCameraTest.setRotation(0);
    });
    setMovementKey("ArrowDown", true);
    cy.window().then({ timeout: 9000 }, (window) => {
      const rotations = [];
      const deadline = Date.now() + 8000;
      return new Cypress.Promise((resolve) => {
        const inspect = () => {
          const position = window.gameMovementTest.state().position;
          rotations.push(window.gameCameraTest.state().viewport.rotation);
          if (position.x > 1.7 || Date.now() >= deadline) {
            resolve({ position, rotations });
            return;
          }
          window.setTimeout(inspect, 10);
        };
        inspect();
      }).then(({ position, rotations: observedRotations }) => {
        expect(position.x).to.be.greaterThan(1.7);
        expect([...new Set(observedRotations)]).to.deep.equal([0]);
      });
    });
    setMovementKey("ArrowDown", false);
    cy.wait(300);
    cy.window().then((window) => {
      expect(window.gameCameraTest.state().viewport.rotation).to.equal(0);
    });
  });

  it("hits the underside when jumping beneath a grade-separated path", () => {
    loadScenario("overpass-clearance");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
    });
    expectStateContinually((state) => {
      expect(state.position.y).to.be.at.most(2.33);
    }, 500);
    expectState((state) => {
      expect(state.grounded).to.equal(true);
      expect(state.position.y).to.be.closeTo(2, 0.03);
    });
  });

  it("burns the hero to ashes after jumping into lava", () => {
    loadScenario("lava-river");
    cy.window().then((window) => {
      window.gameMovementTest.jump();
      window.gameMovementTest.move(1, -1);
    });
    expectState((state) => {
      expect(state.burning).to.equal(true);
      expect(state.drowning).to.equal(false);
    });
    expectState((state) => {
      expect(state.ashes).to.equal(true);
      expect(state.position.y).to.be.lessThan(1.1);
    });
    expectState((state) => {
      expect(state.burning).to.equal(false);
      expect(state.ashes).to.equal(false);
      expect(state.position.x).to.be.closeTo(-3, 0.08);
      expect(state.position.y).to.be.closeTo(2 + GRASS_SURFACE_LIFT, 0.03);
    });
  });

  it("animates the camera to the respawn point after dying off-screen", () => {
    loadScenario("lava-river");
    cy.window().then((window) => {
      window.gameCameraTest.setZoom(6);
      window.gameMovementTest.jump();
      window.gameMovementTest.move(1, -1);
    });
    expectState((state) => {
      expect(state.ashes).to.equal(true);
    });
    cy.window().then((window) => {
      window.gameMovementTest.move(0, 0);
    });
    dragCamera(RESPAWN_CAMERA_DRAG_DISTANCE, RESPAWN_CAMERA_DRAG_DISTANCE);

    let startViewport;
    cy.window().then((window) => {
      startViewport = window.gameCameraTest.state().viewport;
    });

    cy.window({ timeout: 8000 }).should((window) => {
      const state = window.gameCameraTest.state();
      expect(state.hero.respawning, JSON.stringify(state)).to.equal(true);
      expect(state.cameraReturningToHero, JSON.stringify(state)).to.equal(true);
    });
    cy.window().then((window) => {
      const state = window.gameCameraTest.state();
      const currentViewport = state.viewport;
      const currentDistance = Math.hypot(
        state.hero.position.x - currentViewport.panX,
        state.hero.position.z - currentViewport.panZ,
      );
      expect(currentDistance).to.be.greaterThan(0.1);
    });
    cy.window({ timeout: 10000 }).should((window) => {
      const state = window.gameCameraTest.state();
      const heroScreenPosition = state.hero.patScreenPosition;
      expect(state.cameraReturningToHero, JSON.stringify(state)).to.equal(false);
      expect(state.viewport.manuallyMoved, JSON.stringify(state)).to.equal(false);
      expect(
        Math.hypot(
          state.viewport.panX - startViewport.panX,
          state.viewport.panZ - startViewport.panZ,
        ),
      ).to.be.greaterThan(0.1);
      expect(heroScreenPosition, JSON.stringify(state)).to.not.equal(null);
      expect(heroScreenPosition.x, JSON.stringify(state)).to.be.within(
        heroScreenPosition.radius,
        state.visibility.viewportWidth - heroScreenPosition.radius,
      );
      expect(heroScreenPosition.y, JSON.stringify(state)).to.be.within(
        heroScreenPosition.radius,
        state.visibility.viewportHeight - heroScreenPosition.radius,
      );
    });
  });
});
