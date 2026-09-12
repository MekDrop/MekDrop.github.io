import { HERO_ANIMATION } from "../../../src/game/enum/HeroAnimation.js";
import { POINTER_TYPE } from "../../../src/game/enum/PointerType.js";

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

function moveCursorToHorizontalEdge(edge) {
  cy.get(".background-canvas__surface").then(($canvas) => {
    const rect = $canvas[0].getBoundingClientRect();
    cy.wrap($canvas).trigger("pointermove", {
      pointerType: POINTER_TYPE.MOUSE,
      clientX: edge === "right" ? rect.right - 10 : rect.left + 10,
      clientY: rect.top + rect.height / 2,
    });
  });
}

describe("Hero idle animation", () => {
  beforeEach(() => {
    cy.visit("/map/test_flat");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
  });

  it("turns only its head toward the cursor within a human range", () => {
    moveCursorToHorizontalEdge("right");
    expectState((state) => {
      expect(state.animation).to.equal(HERO_ANIMATION.BORED_CURSOR_LOOK);
      expect(Math.abs(state.headLookYaw)).to.be.greaterThan(10);
      expect(Math.abs(state.headLookYaw)).to.be.at.most(55);
    });

    cy.window().then((window) => {
      const bodyFacing = window.gameMovementTest.state().facing;
      const previousHeadYaw = window.gameMovementTest.state().headLookYaw;
      moveCursorToHorizontalEdge("left");
      expectState((state) => {
        expect(Math.abs(state.headLookYaw - previousHeadYaw)).to.be.greaterThan(
          20,
        );
        expect(Math.abs(state.headLookYaw)).to.be.at.most(55);
        expect(state.facing.x).to.be.closeTo(bodyFacing.x, 0.001);
        expect(state.facing.z).to.be.closeTo(bodyFacing.z, 0.001);
      }, 1500);
    });
  });
});
