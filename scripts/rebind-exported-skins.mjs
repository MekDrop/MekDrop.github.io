import fs from "node:fs";
import { Mat4, Quat, Vec3 } from "playcanvas";

class MissingSkinJointTargetError extends Error {
  constructor(name) {
    super("Missing skin joint target: " + name);

    this.name = "MissingSkinJointTargetError";
  }
}

/**
 * Bind exported cloth to the same nodes that runtime IK and grip adjustments move.
 */
export function rebindExportedSkins(filePath) {
  const buffer = fs.readFileSync(filePath);
  const jsonLength = buffer.readUInt32LE(12);
  const document = JSON.parse(buffer.subarray(20, 20 + jsonLength));
  const mapping = document.scenes?.[document.scene ?? 0]?.extras?.skinJointTargets;
  if (!mapping) {
    return false;
  }
  const targets = typeof mapping === "string" ? JSON.parse(mapping) : mapping;
  const binary = Buffer.from(buffer.subarray(28 + jsonLength));
  const parents = new Map();
  document.nodes.forEach((node, index) => (node.children ?? []).forEach(child => parents.set(child, index)));
  const matrices = new Map();
  function world(index) {
    if (!matrices.has(index)) {
      const node = document.nodes[index];
      const local = node.matrix ? new Mat4().set(node.matrix) : new Mat4().setTRS(
        new Vec3(...(node.translation ?? [0, 0, 0])),
        new Quat(...(node.rotation ?? [0, 0, 0, 1])),
        new Vec3(...(node.scale ?? [1, 1, 1])),
      );
      matrices.set(index, parents.has(index) ? world(parents.get(index)).clone().mul(local) : local);
    }

    return matrices.get(index);
  }
  let changed = false;
  for (const skin of document.skins ?? []) {
    const accessor = document.accessors[skin.inverseBindMatrices];
    const view = document.bufferViews[accessor.bufferView];
    for (let joint = 0; joint < skin.joints.length; joint++) {
      const previous = skin.joints[joint];
      const targetName = targets[document.nodes[previous].name];
      if (!targetName) {
        continue;
      }
      const target = document.nodes.findIndex(node => node.name === targetName);
      if (target < 0) {
        throw new MissingSkinJointTargetError(targetName);
      }
      const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + joint * (view.byteStride ?? 64);
      const inverseBind = new Mat4().set(Array.from({ length: 16 }, (_, index) => binary.readFloatLE(offset + index * 4)));
      const rebound = world(target).clone().invert().mul(world(previous)).mul(inverseBind);
      rebound.data.forEach((value, index) => binary.writeFloatLE(value, offset + index * 4));
      skin.joints[joint] = target;
      changed = true;
    }
  }
  if (!changed) {
    return false;
  }
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const output = Buffer.alloc(28 + padded.length + binary.length);
  buffer.copy(output, 0, 0, 12);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(output, 20);
  output.writeUInt32LE(binary.length, 20 + padded.length);
  output.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(output, 28 + padded.length);
  fs.writeFileSync(filePath, output);

  return true;
}
