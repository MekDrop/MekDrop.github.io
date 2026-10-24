import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { Mat4, Vec3 } from "playcanvas";
import { rebindExportedSkins } from "../../../../scripts/rebind-exported-skins.mjs";

test("rebinds deforming cloth to runtime joints without moving its bind surface", () => {
  const directory = fs.mkdtempSync(path.resolve("tmp/skin-joint-binding-"));
  const file = path.join(directory, "cloth.glb");
  try {
    const sourceWorld = new Mat4().setTranslate(2.2, 3.4, 4.6);
    const targetWorld = new Mat4().setTranslate(1.5, 3.3, 4);
    const inverseBind = sourceWorld.clone().invert();
    const document = {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{
        nodes: [0],
        extras: { skinJointTargets: JSON.stringify({ "Cloth arm": "Left arm" }) },
      }],
      nodes: [
        {
          translation: [2, 3, 4],
          children: [1, 2],
        },
        {
          name: "Cloth arm",
          translation: [.2, .4, .6],
        },
        {
          name: "Left arm",
          translation: [-.5, .3, 0],
        },
      ],
      skins: [{
        joints: [1],
        inverseBindMatrices: 0,
      }],
      buffers: [{ byteLength: 64 }],
      bufferViews: [{
        buffer: 0,
        byteLength: 64,
      }],
      accessors: [{
        bufferView: 0,
        componentType: 5126,
        count: 1,
        type: "MAT4",
      }],
    };
    const json = Buffer.from(JSON.stringify(document));
    const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
    const binary = Buffer.from(inverseBind.data.buffer);
    const buffer = Buffer.alloc(28 + padded.length + binary.length);
    buffer.writeUInt32LE(0x46546c67, 0);
    buffer.writeUInt32LE(2, 4);
    buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(padded.length, 12);
    buffer.writeUInt32LE(0x4e4f534a, 16);
    padded.copy(buffer, 20);
    buffer.writeUInt32LE(binary.length, 20 + padded.length);
    buffer.writeUInt32LE(0x004e4942, 24 + padded.length);
    binary.copy(buffer, 28 + padded.length);
    fs.writeFileSync(file, buffer);

    assert.equal(rebindExportedSkins(file), true);
    const result = fs.readFileSync(file);
    const jsonLength = result.readUInt32LE(12);
    const rebound = JSON.parse(result.subarray(20, 20 + jsonLength));
    assert.deepEqual(rebound.skins[0].joints, [2]);
    const matrix = new Mat4().set(Array.from({ length: 16 }, (_, index) => result.readFloatLE(28 + jsonLength + index * 4)));
    const point = new Vec3(.2, .5, -.1);
    const before = sourceWorld.clone().mul(inverseBind).transformPoint(point);
    const after = targetWorld.clone().mul(matrix).transformPoint(point);
    assert.ok(before.distance(after) < .000001);
    assert.equal(rebindExportedSkins(file), false, "repeated export checks do not apply the correction twice");
    assert.deepEqual(fs.readFileSync(file), result);
  } finally {
    fs.rmSync(file, { force: true });
    fs.rmdirSync(directory);
  }
});
