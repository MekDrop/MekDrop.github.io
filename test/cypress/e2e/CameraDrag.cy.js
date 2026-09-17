import { POINTER_TYPE } from "../../../src/game/enum/PointerType.js";
import { DEVELOPMENT_MAX_ZOOM } from "../../../src/game/config/controls.js";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_FACTOR = 1.1;
const DRAG_DISTANCE = 100000;
const VIEW_STORE_KEY = "game-view";
const LOW_ZOOM_LIMIT = 2;
const LOW_ZOOM_VISIBLE_TILE_RATIO = 0.2;

function supportedZoomLevels() {
  const levels = [MIN_ZOOM];
  let zoom = MIN_ZOOM;
  while (zoom < MAX_ZOOM) {
    zoom = Math.min(MAX_ZOOM, zoom * ZOOM_FACTOR);
    levels.push(zoom);
  }
  return levels;
}

function setZoom(zoom) {
  cy.window().then((window) => {
    window.gameCameraTest.setZoom(zoom);
  });
}

function rotateCamera(deltaX) {
  cy.get(".background-canvas").then(($viewport) => {
    const viewport = $viewport[0];
    const rect = viewport.getBoundingClientRect();
    const pointerId = 2;
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    cy.wrap($viewport)
      .trigger("pointerdown", {
        pointerId,
        pointerType: POINTER_TYPE.MOUSE,
        button: 1,
        buttons: 4,
        clientX,
        clientY,
      })
      .trigger("pointermove", {
        pointerId,
        pointerType: POINTER_TYPE.MOUSE,
        button: 1,
        buttons: 4,
        clientX: clientX + deltaX,
        clientY,
      })
      .trigger("pointerup", {
        pointerId,
        pointerType: POINTER_TYPE.MOUSE,
        button: 1,
        buttons: 0,
        clientX: clientX + deltaX,
        clientY,
      });
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

function dragCameraInSteps(deltaX, deltaY, steps) {
  cy.get(".background-canvas").then(($viewport) => {
    const viewport = $viewport[0];
    const rect = viewport.getBoundingClientRect();
    const pointerId = 1;
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    let drag = cy.wrap($viewport).trigger("pointerdown", {
      pointerId,
      pointerType: POINTER_TYPE.MOUSE,
      button: 0,
      buttons: 1,
      clientX,
      clientY,
    });
    for (let step = 1; step <= steps; step += 1) {
      drag = drag.trigger("pointermove", {
        pointerId,
        pointerType: POINTER_TYPE.MOUSE,
        button: 0,
        buttons: 1,
        clientX: clientX + (deltaX * step) / steps,
        clientY: clientY + (deltaY * step) / steps,
      });
    }
    return drag.trigger("pointerup", {
      pointerId,
      pointerType: POINTER_TYPE.MOUSE,
      button: 0,
      buttons: 0,
      clientX: clientX + deltaX,
      clientY: clientY + deltaY,
    });
  });
}

function expectIslandVisible(
  zoom,
  {
    requireFullyVisibleGateway = true,
    manuallyMoved = zoom > MIN_ZOOM,
  } = {},
) {
  cy.window().then((window) => {
    const state = window.gameCameraTest.state();
    const width = state.visibility.viewportWidth;
    const height = state.visibility.viewportHeight;
    expect(state.viewport.zoom).to.be.closeTo(zoom, 0.000001);
    expect(state.viewport.manuallyMoved).to.equal(manuallyMoved);
    expect(
      state.visibility.panWithinBounds,
      JSON.stringify({ zoom, ...state }),
    ).to.equal(true);
    expect(
      state.visibility.safeVisibleTileCenters,
      JSON.stringify({ zoom, ...state }),
    ).to.be.greaterThan(0);
    if (zoom <= LOW_ZOOM_LIMIT) {
      expect(
        state.visibility.safeVisibleTileCenters /
          state.visibility.totalTileCenters,
        JSON.stringify({ zoom, ...state }),
      ).to.be.at.least(LOW_ZOOM_VISIBLE_TILE_RATIO);
    }

    const inset = state.visibility.insetPixels;
    const gateways = Object.entries(state.visibility.visualGroups ?? {})
      .filter(([name]) => name.startsWith("gateway-"))
      .map(([name, bounds]) => {
        const overlapWidth = Math.max(
          0,
          Math.min(bounds.right, width - inset) -
            Math.max(bounds.left, inset),
        );
        const overlapHeight = Math.max(
          0,
          Math.min(bounds.bottom, height - inset) -
            Math.max(bounds.top, inset),
        );
        return { name, bounds, visibleArea: overlapWidth * overlapHeight };
      })
      .filter(({ bounds, visibleArea }) => {
        return (
          visibleArea > 0 &&
          bounds.right - bounds.left <= width - inset * 2 &&
          bounds.bottom - bounds.top <= height - inset * 2
        );
      })
      .sort((left, right) => right.visibleArea - left.visibleArea);
    if (
      !requireFullyVisibleGateway ||
      zoom !== MAX_ZOOM ||
      gateways.length === 0
    ) {
      return;
    }
    const fullyVisibleGateway = gateways.find(({ bounds }) => {
      return (
        bounds.left >= -1 &&
        bounds.top >= -1 &&
        bounds.right <= width + 1 &&
        bounds.bottom <= height + 1
      );
    });
    expect(
      fullyVisibleGateway,
      JSON.stringify({ zoom, gateways, width, height }),
    ).to.exist;
  });
}

function structureIsFullyVisible(state, name) {
  const bounds = state.visibility.visualGroups?.[name];
  if (!bounds) {
    return false;
  }
  return (
    bounds.left >= -1 &&
    bounds.top >= -1 &&
    bounds.right <= state.visibility.viewportWidth + 1 &&
    bounds.bottom <= state.visibility.viewportHeight + 1
  );
}

function structureFitsSafeViewport(state, name) {
  const bounds = state.visibility.visualGroups?.[name];
  if (!bounds) {
    return false;
  }
  const inset = state.visibility.insetPixels;
  return (
    bounds.right - bounds.left <=
      state.visibility.viewportWidth - inset * 2 &&
    bounds.bottom - bounds.top <=
      state.visibility.viewportHeight - inset * 2
  );
}

function horizontalPanProjection(viewport) {
  const yaw = Math.PI / 4 + viewport.rotation * (Math.PI / 2);
  return viewport.panX * Math.cos(yaw) - viewport.panZ * Math.sin(yaw);
}

function startHeroCameraReturn(directionIndex = 0) {
  const directions = [
    [DRAG_DISTANCE, 0],
    [-DRAG_DISTANCE, 0],
    [0, DRAG_DISTANCE],
    [0, -DRAG_DISTANCE],
    [DRAG_DISTANCE, DRAG_DISTANCE],
    [DRAG_DISTANCE, -DRAG_DISTANCE],
    [-DRAG_DISTANCE, DRAG_DISTANCE],
    [-DRAG_DISTANCE, -DRAG_DISTANCE],
  ];
  expect(directionIndex, "an extreme pan away from the hero").to.be.lessThan(
    directions.length,
  );
  const [deltaX, deltaY] = directions[directionIndex];
  setZoom(MAX_ZOOM);
  dragCamera(deltaX, deltaY);
  return cy.window().then((window) => {
    const state = window.gameCameraTest.state();
    const start = state.viewport;
    const distanceFromHero = Math.hypot(
      start.panX - state.hero.position.x,
      start.panZ - state.hero.position.z,
    );
    if (distanceFromHero <= 0.5) {
      return startHeroCameraReturn(directionIndex + 1);
    }
    const started = window.gameCameraTest.returnToHero();
    const immediate = window.gameCameraTest.state().viewport;
    return { immediate, start, started };
  });
}

function expectAnimatedHeroReturn({ immediate, start, started }) {
  expect(started).to.equal(true);
  expect(immediate.panX).to.be.closeTo(start.panX, 0.000001);
  expect(immediate.panZ).to.be.closeTo(start.panZ, 0.000001);
  cy.window({ timeout: 10000 }).should((window) => {
    const state = window.gameCameraTest.state();
    const finished = state.viewport;
    expect(
      Math.hypot(finished.panX - start.panX, finished.panZ - start.panZ),
    ).to.be.greaterThan(0.1);
    expect(state.cameraReturningToHero, JSON.stringify(state)).to.equal(false);
    expect(finished.manuallyMoved, JSON.stringify(state)).to.equal(false);
  });
  expectIslandVisible(MAX_ZOOM, {
    manuallyMoved: false,
    requireFullyVisibleGateway: false,
  });
}

function returnCameraToHeroAndWait() {
  cy.window().then((window) => {
    expect(window.gameCameraTest.returnToHero()).to.equal(true);
  });
  cy.window({ timeout: 10000 }).should((window) => {
    const state = window.gameCameraTest.state();
    expect(state.cameraReturningToHero, JSON.stringify(state)).to.equal(false);
    expect(state.viewport.manuallyMoved).to.equal(false);
  });
}

describe("Camera dragging", () => {
  beforeEach(() => {
    cy.visit("/?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().its("gameCameraTest").should("exist");
  });

  it("shows the dragging hand only while available pan is pressed", () => {
    cy.get(".background-canvas__surface").should(
      "have.css",
      "cursor",
      "auto",
    );
    cy.get(".background-canvas").then(($viewport) => {
      const viewport = $viewport[0];
      const rect = viewport.getBoundingClientRect();
      const pointerId = 1;
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;

      setZoom(MIN_ZOOM);
      cy.wrap($viewport)
        .trigger("pointerdown", {
          pointerId,
          pointerType: POINTER_TYPE.MOUSE,
          button: 0,
          buttons: 1,
          clientX,
          clientY,
        })
        .should("not.have.class", "background-canvas--dragging")
        .trigger("pointerup", {
          pointerId,
          pointerType: POINTER_TYPE.MOUSE,
          button: 0,
          buttons: 0,
          clientX,
          clientY,
        });

      setZoom(MIN_ZOOM * 2);
      cy.wrap($viewport)
        .trigger("pointerdown", {
          pointerId,
          pointerType: POINTER_TYPE.MOUSE,
          button: 0,
          buttons: 1,
          clientX,
          clientY,
        })
        .should("have.class", "background-canvas--dragging")
        .find(".background-canvas__surface")
        .should("have.css", "cursor", "grabbing");

      cy.wrap($viewport)
        .trigger("pointerup", {
          pointerId,
          pointerType: POINTER_TYPE.MOUSE,
          button: 0,
          buttons: 0,
          clientX,
          clientY,
        })
        .should("not.have.class", "background-canvas--dragging");

      cy.get(".background-canvas__surface").then(($canvas) => {
        $canvas[0].addEventListener(
          "pointerdown",
          (event) => event.preventDefault(),
          { once: true },
        );
        cy.wrap($canvas).trigger("pointerdown", {
          pointerId: 2,
          pointerType: POINTER_TYPE.MOUSE,
          button: 0,
          buttons: 1,
          clientX,
          clientY,
        });
        cy.wrap($viewport).should(
          "not.have.class",
          "background-canvas--dragging",
        );
        cy.wrap($canvas).trigger("pointerup", {
          pointerId: 2,
          pointerType: POINTER_TYPE.MOUSE,
          button: 0,
          buttons: 0,
          clientX,
          clientY,
        });
      });
    });
  });

  it("keeps the island on screen after extreme drags at every zoom level", () => {
    const directions = [
      [DRAG_DISTANCE, 0],
      [-DRAG_DISTANCE, 0],
      [0, DRAG_DISTANCE],
      [0, -DRAG_DISTANCE],
      [DRAG_DISTANCE, DRAG_DISTANCE],
      [-DRAG_DISTANCE, -DRAG_DISTANCE],
    ];

    for (const zoom of supportedZoomLevels()) {
      for (const [deltaX, deltaY] of directions) {
        setZoom(zoom);
        dragCamera(deltaX, deltaY);
        expectIslandVisible(zoom, {
          requireFullyVisibleGateway: deltaX === 0,
        });
      }
    }
  });

  it("keeps a manually panned camera away from a stationary hero", () => {
    setZoom(MAX_ZOOM);
    cy.window().then((window) => {
      window.gameCameraTest.panBy(0, DRAG_DISTANCE);
    });

    let pannedViewport;
    cy.window().then((window) => {
      const state = window.gameCameraTest.state();
      pannedViewport = state.viewport;
      expect(state.viewport.manuallyMoved).to.equal(true);
      expect(state.cameraReturningToHero).to.equal(false);
      expect(
        Math.hypot(
          state.viewport.panX - state.hero.position.x,
          state.viewport.panZ - state.hero.position.z,
        ),
      ).to.be.greaterThan(0.5);
    });

    cy.wait(500);
    cy.window().then((window) => {
      const state = window.gameCameraTest.state();
      expect(state.cameraReturningToHero).to.equal(false);
      expect(state.viewport.manuallyMoved).to.equal(true);
      expect(state.viewport.panX).to.be.closeTo(pannedViewport.panX, 0.000001);
      expect(state.viewport.panZ).to.be.closeTo(pannedViewport.panZ, 0.000001);
    });
  });

  it("disables pan limits while Pause/Break developer mode is active", () => {
    let initialViewport;
    cy.window().then((window) => {
      const state = window.gameCameraTest.state();
      initialViewport = state.viewport;
      expect(state.panLimitsEnabled).to.equal(true);
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Pause" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Pause" }));
    });
    cy.window().then((window) => {
      const state = window.gameCameraTest.state();
      expect(state.panLimitsEnabled).to.equal(false);
    });

    dragCamera(DRAG_DISTANCE, DRAG_DISTANCE);

    cy.window().then((window) => {
      const unboundedState = window.gameCameraTest.state();
      const distance = Math.hypot(
        unboundedState.viewport.panX - initialViewport.panX,
        unboundedState.viewport.panZ - initialViewport.panZ,
      );
      expect(distance).to.be.greaterThan(100);
      expect(unboundedState.visibility.safeVisibleTileCenters).to.equal(0);

      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Pause" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Pause" }));
    });
    cy.window().should((window) => {
      const boundedState = window.gameCameraTest.state();
      expect(boundedState.panLimitsEnabled).to.equal(true);
      expect(boundedState.visibility.panWithinBounds).to.equal(true);
      expect(boundedState.visibility.safeVisibleTileCenters).to.be.greaterThan(
        0,
      );
      expect(
        Math.hypot(
          boundedState.viewport.panX - unboundedState.viewport.panX,
          boundedState.viewport.panZ - unboundedState.viewport.panZ,
        ),
      ).to.be.greaterThan(100);
    });
  });

  it("keeps developer mode in session storage across reloads", () => {
    cy.window().then((window) => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Pause" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Pause" }));
      const stored = JSON.parse(window.sessionStorage.getItem("debug"));
      expect(stored.pathArrows).to.equal(true);
      expect(stored.debugAxesHud).to.equal(true);
      expect(stored.debugFpsHud).to.equal(true);
    });

    cy.reload();
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().then((window) => {
      expect(window.gameCameraTest.state().panLimitsEnabled).to.equal(false);
    });
  });

  it("can reverse from the bottom pan limit to the top at maximum zoom", () => {
    setZoom(MAX_ZOOM);
    dragCamera(0, DRAG_DISTANCE);
    cy.window().then((window) => {
      const bottom = window.gameCameraTest.state().viewport;
      dragCamera(0, -DRAG_DISTANCE);
      cy.window().then((currentWindow) => {
        const top = currentWindow.gameCameraTest.state().viewport;
        expect(
          Math.hypot(top.panX - bottom.panX, top.panZ - bottom.panZ),
        ).to.be.greaterThan(1);
        expectIslandVisible(MAX_ZOOM, {
          requireFullyVisibleGateway: false,
        });
      });
    });
  });

  it("can pan sideways while resting at the top limit", () => {
    setZoom(MAX_ZOOM);
    dragCamera(0, -DRAG_DISTANCE);
    cy.window().then((window) => {
      const top = window.gameCameraTest.state().viewport;
      dragCamera(200, 0);
      cy.window().then((currentWindow) => {
        const right = currentWindow.gameCameraTest.state().viewport;
        dragCamera(-400, 0);
        cy.window().then((leftWindow) => {
          const left = leftWindow.gameCameraTest.state().viewport;
          const rightDistance = Math.hypot(
            right.panX - top.panX,
            right.panZ - top.panZ,
          );
          const leftDistance = Math.hypot(
            left.panX - top.panX,
            left.panZ - top.panZ,
          );
          expect(Math.max(rightDistance, leftDistance)).to.be.greaterThan(1);
          expectIslandVisible(MAX_ZOOM, {
            requireFullyVisibleGateway: false,
          });
        });
      });
    });
  });

  it("reaches the true top limit with incremental pointer movement", () => {
    setZoom(MAX_ZOOM);
    dragCamera(0, -DRAG_DISTANCE);
    cy.window().then((window) => {
      const directTop = window.gameCameraTest.state().viewport;
      setZoom(MAX_ZOOM);
      dragCameraInSteps(0, -10000, 50);
      cy.window().then((steppedWindow) => {
        const steppedTop = steppedWindow.gameCameraTest.state().viewport;
        expect(
          Math.hypot(
            steppedTop.panX - directTop.panX,
            steppedTop.panZ - directTop.panZ,
          ),
        ).to.be.lessThan(0.1);
        expectIslandVisible(MAX_ZOOM);
      });
    });
  });

  it("can reveal the full castle at intermediate zoom", () => {
    const zoom = 2.1;
    setZoom(zoom);
    dragCamera(0, DRAG_DISTANCE);
    cy.window().then((window) => {
      const firstLimit = window.gameCameraTest.state();
      setZoom(zoom);
      dragCamera(0, -DRAG_DISTANCE);
      cy.window().then((oppositeWindow) => {
        const oppositeLimit = oppositeWindow.gameCameraTest.state();
        if (!structureFitsSafeViewport(firstLimit, "castle")) {
          return;
        }
        expect(
          structureIsFullyVisible(firstLimit, "castle") ||
            structureIsFullyVisible(oppositeLimit, "castle"),
          JSON.stringify({ firstLimit, oppositeLimit }),
        ).to.equal(true);
      });
    });
  });

  it("can reveal the full castle by panning vertically from the hero", () => {
    const zoom = 3;
    let heroCenteredViewport;
    setZoom(zoom);
    dragCamera(DRAG_DISTANCE, 0);
    returnCameraToHeroAndWait();
    cy.window().then((window) => {
      heroCenteredViewport = window.gameCameraTest.state().viewport;
    });
    dragCamera(0, DRAG_DISTANCE);
    cy.window().then((window) => {
      const firstLimit = window.gameCameraTest.state();
      expect(horizontalPanProjection(firstLimit.viewport)).to.be.closeTo(
        horizontalPanProjection(heroCenteredViewport),
        0.001,
      );
      returnCameraToHeroAndWait();
      cy.window().then((centeredWindow) => {
        heroCenteredViewport = centeredWindow.gameCameraTest.state().viewport;
      });
      dragCamera(0, -DRAG_DISTANCE);
      cy.window().then((oppositeWindow) => {
        const oppositeLimit = oppositeWindow.gameCameraTest.state();
        expect(horizontalPanProjection(oppositeLimit.viewport)).to.be.closeTo(
          horizontalPanProjection(heroCenteredViewport),
          0.001,
        );
        if (!structureFitsSafeViewport(firstLimit, "castle")) {
          return;
        }
        expect(
          structureIsFullyVisible(firstLimit, "castle") ||
            structureIsFullyVisible(oppositeLimit, "castle"),
          JSON.stringify({ firstLimit, oppositeLimit }),
        ).to.equal(true);
      });
    });
  });

  it("animates the camera return to the hero without snapping", () => {
    startHeroCameraReturn().then((attempt) => {
      expectAnimatedHeroReturn(attempt);
    });
  });

  it("persists zoom, rotation, and pan through the Pinia view store", () => {
    setZoom(3);
    rotateCamera(90);
    dragCamera(120, -80);
    cy.wait(200);
    cy.window().then((window) => {
      const viewport = window.gameCameraTest.state().viewport;
      const stored = JSON.parse(window.localStorage.getItem(VIEW_STORE_KEY));
      expect(stored.zoom).to.be.closeTo(viewport.zoom, 0.000001);
      expect(stored.rotation).to.be.closeTo(viewport.rotation, 0.000001);
      expect(stored.panX).to.be.closeTo(viewport.panX, 0.000001);
      expect(stored.panZ).to.be.closeTo(viewport.panZ, 0.000001);

      cy.reload();
      cy.get('.background-canvas[data-game-ready="true"]', {
        timeout: 30000,
      }).should("be.visible");
      cy.window().then((reloadedWindow) => {
        const restored = reloadedWindow.gameCameraTest.state().viewport;
        const rehydrated = JSON.parse(
          reloadedWindow.localStorage.getItem(VIEW_STORE_KEY),
        );
        expect(restored.zoom).to.be.closeTo(stored.zoom, 0.000001);
        expect(restored.rotation).to.be.closeTo(stored.rotation, 0.000001);
        expect(restored.manuallyMoved).to.equal(stored.manuallyMoved);
        expect(rehydrated.panX).to.be.closeTo(restored.panX, 0.000001);
        expect(rehydrated.panZ).to.be.closeTo(restored.panZ, 0.000001);
      });
    });
  });

  it("allows the extended development zoom maximum", () => {
    cy.window().then((window) => {
      for (let step = 0; step < 40; step += 1) {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { code: "PageUp", key: "PageUp" }),
        );
      }
      expect(window.gameCameraTest.state().viewport.zoom).to.be.closeTo(
        DEVELOPMENT_MAX_ZOOM,
        0.000001,
      );
    });
  });
});
