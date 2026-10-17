import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { CameraPanBounds } from "../../../../src/game/camera/CameraPanBounds.js";

it("can center elevated details of a structure larger than the viewport", () => {
  const bounds = new CameraPanBounds({
    grid: [[1]],
    heightmap: [[2]],
    cols: 1,
    rows: 1,
  });
  bounds.addVisualBounds(new Vec3(0, 20, 0), new Vec3(2, 15, 2), {
    group: "tower",
    protectAtPanLimit: true,
    centerReachableAtEveryZoom: true,
  });
  const pitch = Math.PI / 6;
  const pan = -32 / Math.tan(pitch) / Math.SQRT2;
  for (const zoom of [6, 23.23]) {
    const view = {
      panX: pan,
      panZ: pan,
      centerX: 0,
      centerZ: 0,
      targetY: 0,
      rotation: 0,
      pitch,
      zoom,
      orthoHeight: 12 / zoom,
      viewportWidth: 1000,
      viewportHeight: 800,
    };
    const constrained = bounds.constrain(view);
    assert.ok(Math.abs(constrained.x - pan) < 0.000001);
    assert.ok(Math.abs(constrained.z - pan) < 0.000001);
    assert.equal(bounds.visibility(view).panWithinBounds, true);
    const outside = bounds.constrain({
      ...view,
      panX: -10000,
      panZ: -10000,
    });
    assert.ok(Math.hypot(outside.x, outside.z) < 100);
    assert.deepEqual(bounds.constrain({
      ...view,
      zoom: 1,
    }), {
      x: 0,
      z: 0,
    });
  }
});
