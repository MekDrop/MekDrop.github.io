import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CastleResidentMotion } from "../../../../../../src/game/objects/castle/residents/CastleResidentMotion.js";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/servant/Servant.js", import.meta.url), "utf8").replace(/^import[^\n]+\r?\n/gm, "");
const Servant = new Function("servantModelUrl", "CHARACTER_HEIGHT", "TerraceActor", "CastleResidentMotion", `${source.replace("export class", "class")}\nreturn Servant;`)("servant.glb", 1.8, class {
  entity = new pc.Entity(); height = 1; pose() {}
}, CastleResidentMotion);
it("places the idle servant clear of all service furniture and map props in every orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({
      position: {
        x: -4,
        z: -4,
        width: 8,
        depth: 8,
        elevation: 3,
      },
      doors: [{
        side,
        offset: 3,
        width: 2,
      }],
      style: "twin-tower",
      seed: "rooms",
    });
    const initialLayout = new CastleResidentialLayout(plan);
    const room = initialLayout.rooms.servantBedroom;
    const drawer = {
      role: "serviceProp",
      object: "BedsideDrawers",
      roomId: "service",
      x: room.maxX - 0.6,
      z: room.minZ + 0.6,
      floorY: room.floorY,
      width: 0.6004,
      depth: 0.5604,
      height: 0.65,
      scale: 1,
      rotation: 0,
    };
    plan.metadata.runtime.residential.furniture.push(drawer);
    const layout = new CastleResidentialLayout(plan);
    const furniture = [...plan.layout.roomPlan.furniture.filter((item) => item.roomId === "service"), drawer];
    assert.equal(layout.standingObstacles.length, plan.metadata.runtime.residential.furniture.length);
    const servant = new Servant({
      pc,
      definition: { id: "servant" },
      runtime: { objects: { getAll: () => [] } },
    });
    servant.bindResidence({
      pc,
      modelLibrary: {},
      residence: {
        layout,
        canEnterBasement: () => true,
      },
    });
    const position = servant.entity.getLocalPosition();
    const standing = layout.toLocal(position.x, position.z);
    for (const item of furniture) {
      const gap = Math.hypot(Math.max(0, Math.abs(standing.x - item.x) - item.width * item.scale / 2),
        Math.max(0, Math.abs(standing.z - item.z) - item.depth * item.scale / 2));
      assert.ok(gap >= 0.44999, `${side} servant clears ${item.role}`);
    }
  }
});

it("keeps the servant in its room when a terrace participant is created", async () => {
  const plan = await CastleGenerator.generate({
    position: {
      x: -4,
      z: -4,
      width: 8,
      depth: 8,
      elevation: 3,
    },
    doors: [{
      side: "EAST",
      offset: 3,
      width: 2,
    }],
    style: "twin-tower",
    seed: "rooms",
  });
  const layout = new CastleResidentialLayout(plan);
  const servant = new Servant({
    pc,
    definition: { id: "servant" },
    runtime: { objects: { getAll: () => [] } },
  });
  servant.bindResidence({
    pc,
    modelLibrary: {},
    residence: {
      layout,
      canEnterBasement: () => true,
    },
  });
  const scene = new pc.Entity("Test scene");
  scene._enabledInHierarchy = true;
  scene.addChild(servant.entity);
  const resident = servant.entity.children[0];
  const position = resident.getPosition().clone();
  const rotation = resident.getRotation().clone();
  const participant = servant.createTerraceParticipant({
    pc,
    modelLibrary: {},
    layout: {
      x: 12,
      y: 6,
      z: -8,
      yaw: 180,
    },
    scale: 0.45,
    kind: "king",
    royal: null,
    navigation: {
      layout,
      blocked: () => false,
      clear: () => true,
    },
  });
  assert.ok(resident.getPosition().distance(position) < 0.00001);
  assert.ok(resident.getRotation().equalsApprox(rotation));
  assert.equal(resident.enabled, true);
  assert.equal(participant.inspector.entity, resident);
  assert.equal(servant.entity.children.length, 2);
  assert.equal(resident.enabled, true);
});
