import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { GameCamera } from "../../../../src/game/camera/GameCamera.js";

class CameraEntity extends pc.Entity {
  addComponent(type, options) {
    const engineCamera = new pc.Camera({ width: 800, height: 600 });
    engineCamera.node = this;
    Object.assign(engineCamera, options);
    this.camera = {
      layers: [],
      get orthoHeight() {
        return engineCamera.orthoHeight;
      },
      set orthoHeight(value) {
        engineCamera.orthoHeight = value;
      },
      worldToScreen: (point) => engineCamera.worldToScreen(point, 800, 600),
      screenToWorld: (x, y, depth) => engineCamera.screenToWorld(x, y, depth, 800, 600),
      onAppPrerender: () => pc.CameraComponent.prototype.onAppPrerender.call({ _camera: engineCamera }),
    };
  }
}

function createCamera() {
  return new GameCamera({
    pc: { ...pc, Entity: CameraEntity },
    app: { root: new pc.Entity() },
    cloudLayerId: 100,
    targetY: 0,
  });
}

const updateOptions = { cameraDistance: 40, cameraPitch: Math.PI / 6 };

it("refreshes projection queries immediately after rotating at every supported zoom", () => {
  for (const zoom of [1, 1.01, 1.5, 3, 6, 50]) {
    const camera = createCamera();
    camera.zoom = zoom;
    camera.update(updateOptions);
    const before = camera.component.worldToScreen(new pc.Vec3(1, 0, 0));
    camera.rotation = 1;
    camera.update(updateOptions);
    const after = camera.component.worldToScreen(new pc.Vec3(1, 0, 0));
    assert.ok(before.x > 400, `before at zoom ${zoom}`);
    assert.ok(after.x < 400, `after at zoom ${zoom}`);
  }
});

it("refreshes center rays after floating camera translation without waiting for a render", () => {
  const camera = createCamera();
  camera.update(updateOptions);
  const before = camera.component.screenToWorld(400, 300, 0.1);
  const right = camera.entity.right.clone();
  camera.translateLocal(2, 0, 0);
  const after = camera.component.screenToWorld(400, 300, 0.1);
  assert.ok(after.sub(before).distance(right.mulScalar(2)) < 0.0001);
});

it("keeps axis directions fixed when zooming and translating, including far from the world origin", () => {
  const camera = createCamera();
  camera.rotation = 0.3;
  camera.update(updateOptions);
  const expected = camera.debugDirections;
  for (const zoom of [1, 1.01, 1.5, 3, 6, 50]) {
    camera.zoom = zoom;
    camera.panX = 10;
    camera.panZ = -10;
    camera.update(updateOptions);
    camera.translateLocal(10000000, -10000000, 0);
    for (const axis of ["x", "y", "z"]) {
      assert.ok(Math.hypot(
        camera.debugDirections[axis].x - expected[axis].x,
        camera.debugDirections[axis].y - expected[axis].y,
      ) < 0.000001);
    }
  }
});

it("matches projected landmarks through continuous rotation and the angle wrap", () => {
  const camera = createCamera();
  const axes = {
    x: new pc.Vec3(1, 0, 0),
    y: new pc.Vec3(0, 0, 1),
    z: new pc.Vec3(0, 1, 0),
  };
  for (const rotation of [-0.01, 0, 0.125, 0.5, 1, 2, 3, 3.99, 4, 4.01]) {
    camera.rotation = rotation;
    camera.update(updateOptions);
    const origin = camera.component.worldToScreen(new pc.Vec3());
    for (const [axis, point] of Object.entries(axes)) {
      const endpoint = camera.component.worldToScreen(point);
      const x = endpoint.x - origin.x;
      const y = endpoint.y - origin.y;
      const length = Math.hypot(x, y);
      assert.ok(Math.hypot(
        camera.debugDirections[axis].x - x / length,
        camera.debugDirections[axis].y - y / length,
      ) < 0.000001);
    }
  }
});
