import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { GrassInstanceData } from "../../../../../src/game/objects/ground-cover/GrassInstanceData.js";

test("instance edge settings retain every float32 transform component and native attribute location", () => {
  const device = new pc.NullGraphicsDevice({
    width: 1,
    height: 1,
  });
  const format = GrassInstanceData.createFormat(pc, device);
  const first = new pc.Mat4().setTRS(new pc.Vec3(1.5, 2.25, -4), new pc.Quat().setFromEulerAngles(0, 37, 0), new pc.Vec3(0.2, 0.1, 0.2));
  const second = new pc.Mat4().setTRS(new pc.Vec3(-2, 3, 0), new pc.Quat(), new pc.Vec3(0.1, 0.2, 1));
  const data = [];
  GrassInstanceData.append(data, first.data, [0, 0.03, 0.2, 1], [1, 0]);
  GrassInstanceData.append(data, second.data, [1, 0.2, 0.03, 0], [0, 1]);
  const buffer = new Float32Array(data);
  assert.equal(format.size, GrassInstanceData.stride * Float32Array.BYTES_PER_ELEMENT);
  assert.deepEqual(format.elements.map((element) => element.name), [pc.SEMANTIC_ATTR11, pc.SEMANTIC_ATTR12, pc.SEMANTIC_ATTR14, pc.SEMANTIC_ATTR15, pc.SEMANTIC_ATTR8, pc.SEMANTIC_ATTR9]);
  assert.deepEqual(buffer.slice(0, 16), first.data);
  assert.deepEqual(buffer.slice(22, 38), second.data);
  assert.deepEqual(buffer.slice(16, 22), new Float32Array([0, 0.03, 0.2, 1, 1, 0]));
  assert.deepEqual(buffer.slice(38, 44), new Float32Array([1, 0.2, 0.03, 0, 0, 1]));
  buffer[GrassInstanceData.stride + 13] = -10000;
  assert.equal(buffer[13], 2.25, "excavating one instance preserves adjacent transforms");
  assert.deepEqual(buffer.slice(38, 44), new Float32Array([1, 0.2, 0.03, 0, 0, 1]), "excavation preserves edge attributes");
  device.destroy();
});
