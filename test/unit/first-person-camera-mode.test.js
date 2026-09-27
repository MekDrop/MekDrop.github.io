import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CameraPointerAction } from "../../src/game/actions/CameraPointerAction.js";
import { FirstPersonCameraAction } from "../../src/game/actions/FirstPersonCameraAction.js";
import { FirstPersonCameraMode } from "../../src/game/strategies/camera/FirstPersonCameraMode.js";
import { DEFAULT_CONTROLS } from "../../src/config/controls.js";
import { projectFirstPersonMovement } from "../../src/game/objects/hero/projectFirstPersonMovement.js";

class Vec3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

function cameraFixture() {
  const transforms = { position: null, target: null };
  const gameCamera = {
    playCanvas: {
      Vec3,
      PROJECTION_PERSPECTIVE: "perspective",
    },
    component: {},
    right: { x: -1, y: 0, z: 0 },
    entity: {
      setPosition(position) {
        transforms.position = position;
      },
      lookAt(x, y, z) {
        transforms.target = { x, y, z };
      },
    },
  };
  return { gameCamera, transforms };
}

const hero = {
  firstPersonCameraPose: {
    position: { x: 2, y: 3, z: 4 },
    direction: { x: 0, y: 0, z: 1 },
  },
};

describe("first-person camera", () => {
  it("binds FPS movement to both WASD and the arrow keys", () => {
    assert.deepEqual(DEFAULT_CONTROLS.moveUp.keys, ["ArrowUp", "KeyW"]);
    assert.deepEqual(DEFAULT_CONTROLS.moveDown.keys, ["ArrowDown", "KeyS"]);
    assert.deepEqual(DEFAULT_CONTROLS.moveLeft.keys, ["ArrowLeft", "KeyA"]);
    assert.deepEqual(DEFAULT_CONTROLS.moveRight.keys, ["ArrowRight", "KeyD"]);
  });

  it("projects W forward and D along the camera's right side", () => {
    const viewDirection = {
      x: 0,
      z: 1,
      right: { x: -1, z: 0 },
    };
    assert.deepEqual(projectFirstPersonMovement(0, 1, viewDirection), {
      x: 0,
      z: 1,
    });
    assert.deepEqual(projectFirstPersonMovement(1, 0, viewDirection), {
      x: -1,
      z: 0,
    });
  });

  it("uses the hero eye position and applies clamped mouse look", () => {
    const { gameCamera, transforms } = cameraFixture();
    const mode = new FirstPersonCameraMode(gameCamera);

    mode.enter();
    mode.update({ hero });
    assert.equal(gameCamera.component.projection, "perspective");
    assert.deepEqual(transforms.position, new Vec3(2, 3, 4));
    assert.deepEqual(mode.state.direction, { x: 0, y: 0, z: 1 });
    assert.deepEqual(mode.state.right, { x: -1, y: 0, z: 0 });

    mode.lookBy(90, -1000);
    mode.update({ hero });
    assert.ok(mode.state.direction.x > 0);
    assert.ok(mode.state.direction.y > 0.85);
    assert.ok(mode.state.direction.z > 0);

    mode.lookBy(0, 2000);
    mode.update({ hero });
    assert.ok(mode.state.direction.y < -0.98);
  });

  it("keeps pointer interpretation in the active camera strategy", () => {
    const { gameCamera } = cameraFixture();
    const mode = new FirstPersonCameraMode(gameCamera);
    mode.enter();
    mode.update({ hero });

    assert.deepEqual(mode.pointerDown({ button: 0, captured: false }), {
      capture: true,
      primary: false,
    });
    assert.deepEqual(mode.pointerDown({ button: 0, captured: true }), {
      capture: false,
      primary: true,
    });
    assert.equal(mode.pointerDown({ button: 2, captured: true }), null);
    assert.equal(
      mode.pointerMove({
        captured: true,
        movementX: 12,
        movementY: -5,
        degreesPerPixel: 0.2,
      }),
      true,
    );
    mode.update({ hero });
    assert.ok(mode.state.direction.x < 0);
    assert.ok(mode.state.direction.y > 0);
  });

  it("executes pointer commands returned by the camera strategy", () => {
    const previousDocument = globalThis.document;
    let requested = 0;
    let exited = 0;
    let patted = 0;
    const renderer = {
      cameraPointerInputActive: true,
      cameraPointerDown: ({ captured }) => ({
        capture: !captured,
        primary: captured,
      }),
      cameraPointerMove: () => true,
    };
    const element = {
      requestPointerLock() {
        requested += 1;
      },
    };
    globalThis.document = {
      pointerLockElement: null,
      exitPointerLock() {
        exited += 1;
      },
    };
    try {
      const pointer = new CameraPointerAction(
        renderer,
        element,
        { invoke: () => { patted += 1; } },
        DEFAULT_CONTROLS.cameraPointer,
      );
      assert.equal(pointer.press({ button: 0 }), true);
      assert.equal(requested, 1);
      globalThis.document.pointerLockElement = element;
      assert.equal(pointer.press({ button: 0 }), true);
      assert.equal(patted, 1);
      assert.equal(pointer.move({ movementX: 1, movementY: 2 }), true);

      const cameraPointer = {
        capture: () => pointer.capture(),
        release: () => pointer.release(),
      };
      const cameraRenderer = { firstPersonCameraEnabled: false };
      const action = new FirstPersonCameraAction(
        cameraRenderer,
        { clear() {} },
        cameraPointer,
      );
      action.invoke();
      assert.equal(cameraRenderer.firstPersonCameraEnabled, true);
      assert.equal(requested, 2);

      action.invoke();
      assert.equal(cameraRenderer.firstPersonCameraEnabled, false);
      assert.equal(exited, 1);
    } finally {
      globalThis.document = previousDocument;
    }
  });
});
