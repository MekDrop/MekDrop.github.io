import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { HeroFootSupport } from "../../../../../src/game/objects/hero/HeroFootSupport.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

const source = readFileSync(new URL("../../../../../src/game/objects/castle/CastleResidence.js", import.meta.url), "utf8");
const start = source.indexOf("  #buildPlannedFloors(buildPlan, models, pc)");
const end = source.indexOf("\n  /**", start);
// Exercise the real construction method without a GPU or model loader.
const FloorBuilder = new Function("floorUrl", "stoneUrl", "Bookshelf", `
${source.slice(source.indexOf("function subtractFloorArea("))}
return class {
  #layout; #entity = { children: [], addChild(child) { this.children.push(child); } }; #solids = [];
  constructor(layout) { this.#layout = layout; }
  get children() { return this.#entity.children; }
  ${source.slice(start, end).replace("#buildPlannedFloors", "build")}
};`)("wood", "stone", {});
class Entity {
  constructor(name) { this.name = name; }
  setLocalPosition(...position) { this.position = position; }
  setLocalScale(...scale) { this.scale = scale; }
  addComponent() {}
}

it("uses timber only inside rooms, leaves exposed tops as bricks, and supports stone door thresholds", async () => {
  const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
    doors: [{ side: "NORTH", offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" });
  const residential = plan.metadata.runtime.residential;
  const builder = new FloorBuilder(new CastleResidentialLayout(plan));
  residential.furniture = [];
  builder.build(plan, { instantiate: (url) => Object.assign(new Entity(), { url }) },
    { Entity, Color: class {} });
  const panels = builder.children.filter((child) => child.url);
  assert.ok(panels.some((panel) => panel.url === "wood"));
  assert.ok(panels.filter((panel) => panel.name.includes("Threshold")).every((panel) => panel.url === "stone"), "door thresholds have continuous stone support");
  for (const panel of panels) {
    const [x, y, z] = panel.position;
    const [width, , depth] = panel.scale;
    if (panel.url === "stone") {
      assert.ok(y + panel.scale[1] <= 0.004001, "stone finish clears the terrain without a raised entrance lip");
      continue;
    }
    assert.ok(residential.placedRooms.some((room) => x - width / 2 >= room.minX - 1e-6 &&
      x + width / 2 <= room.maxX + 1e-6 && z - depth / 2 >= room.minZ - 1e-6 &&
      z + depth / 2 <= room.maxZ + 1e-6), "wood stays inside a room");
  }
  const layout = new CastleResidentialLayout(plan);
  const exposed = layout.toWorld(0.125, 5.125, residential.rise - 0.125);
  assert.ok(plan.metadata.collision.cameraBlocks.some((brick) => Math.abs(brick.x - exposed.x) < 0.001 &&
    Math.abs(brick.y - exposed.y) < 0.001 && Math.abs(brick.z - exposed.z) < 0.001), "exposed top retains an individual brick");
});

it("keeps the lower spiral turn clear beneath the landing and supports the complete exit", async () => {
  const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 2 },
    doors: [{ side: "NORTH", offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" });
  const layout = new CastleResidentialLayout(plan);
  const landing = layout.walkableAreas.find((area) => area.id === "mainStairLanding");
  for (const tread of layout.stairs.treads) {
    if (tread.y >= landing.floorY - 0.32) continue;
    const local = layout.toLocal(tread.x, tread.z);
    const distance = Math.hypot(Math.max(landing.minX - local.x, 0, local.x - landing.maxX),
      Math.max(landing.minZ - local.z, 0, local.z - landing.maxZ));
    if (distance > 0.18) continue;
    assert.ok(landing.floorY - 0.25 - tread.y >= 1.45,
      "the landing slab leaves headroom above every lower tread it overlaps");
  }
  const feet = new HeroFootSupport({ supportHeightAtPoint: (x, z) => layout.surfaceHeightAt(x, z, landing.floorY) });
  const last = layout.stairs.treads.at(-1);
  const exitX = layout.stairs.center.x + (last.x - layout.stairs.center.x) * 1.4;
  const exitZ = layout.stairs.center.z + (last.z - layout.stairs.center.z) * 1.4;
  for (let distance = 0; distance <= 1.2; distance += 0.025) {
    assert.equal(feet.unsupportedFootAt(exitX + distance, exitZ, landing.floorY, { x: 1, z: 0 }), null,
      "both complete boots stay supported from the final tread onto the upper floor");
  }
  assert.equal(landing.maxZ, plan.layout.roomPlan.shaft.maxZ,
    "the exit reaches the rear wall without leaving an unsupported strip");
});

it("keeps continuous timber above masonry in the panel's seams and corners", () => {
  const buffer = readFileSync(new URL("../../../../../src/game/models/castle/residential/floor-panel.glb", import.meta.url));
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
  const backing = gltf.nodes.find((node) => node.name === "Tile backing");
  const vertices = gltf.accessors[gltf.meshes[backing.mesh].primitives[0].attributes.POSITION];
  const top = backing.translation[1] + vertices.max[1] * (backing.scale?.[1] ?? 1);
  assert.ok(top - 0.06 + 0.004 > 0.001, "wood backing covers the flush final tread even inside plank gaps");
  assert.ok(top < 0.06, "shallow plank seams retain their visible depth");
});


it("supports the complete upstairs doorway without overlapping floor panels", async () => {
  const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
    doors: [{ side: "NORTH", offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" });
  const layout = new CastleResidentialLayout(plan);
  const roomPlan = plan.metadata.runtime.residential;
  const doorway = roomPlan.doorways.find((door) => door.roomId === roomPlan.stairHostRoomId && door.floorY > roomPlan.origin.y);
  const areas = layout.walkableAreas.filter((area) => area.floorY === doorway.floorY);
  const x = roomPlan.shaft.maxX - 0.2;
  for (let z = doorway.center - doorway.width / 2; z <= doorway.center + doorway.width / 2; z += 0.05) {
    assert.ok(areas.some((area) => x >= area.minX && x <= area.maxX && z >= area.minZ - 1e-6 && z <= area.maxZ + 1e-6));
  }
  for (let first = 0; first < areas.length; first++) {
    for (const second of areas.slice(first + 1)) {
      const area = areas[first];
      assert.ok(Math.min(area.maxX, second.maxX) - Math.max(area.minX, second.minX) <= 1e-6 ||
        Math.min(area.maxZ, second.maxZ) - Math.max(area.minZ, second.minZ) <= 1e-6, "no coplanar floor overlap");
    }
  }
});

it("fills the exit-side shaft strip with visible floor and preserves headroom below it", async () => {
  const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 2 },
    doors: [{ side: "NORTH", offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" });
  const layout = new CastleResidentialLayout(plan);
  const floorY = layout.stairs.center.y + layout.stairs.rise;
  const center = layout.toLocal(layout.stairs.center.x, layout.stairs.center.z);
  const areas = layout.walkableAreas.filter((area) => area.floorY === floorY);
  plan.metadata.runtime.residential.furniture = [];
  const builder = new FloorBuilder(layout);
  builder.build(plan, { instantiate: (url) => Object.assign(new Entity(), { url }) }, { Entity, Color: class {} });
  const panels = builder.children.filter((child) => child.url === "wood");
  for (let x = center.x + 0.1; x <= center.x + 1.1; x += 0.1) {
    for (let z = center.z + 0.1; z <= center.z + 0.8; z += 0.1) {
      assert.ok(panels.some((panel) => Math.abs(x - panel.position[0]) <= panel.scale[0] / 2 + 1e-6 &&
        Math.abs(z - panel.position[2]) <= panel.scale[2] / 2 + 1e-6), "the marked strip has an actual timber panel");
    }
  }
  for (const tread of layout.stairs.treads) {
    if (tread.y >= floorY - 0.32) continue;
    const local = layout.toLocal(tread.x, tread.z);
    for (const area of areas) {
      const distance = Math.hypot(Math.max(area.minX - local.x, 0, local.x - area.maxX),
        Math.max(area.minZ - local.z, 0, local.z - area.maxZ));
      if (distance <= 0.18) assert.ok(floorY - 0.25 - tread.y >= 1.45, "filled floor leaves capsule headroom");
    }
  }
});

it("removes unused stair ledges and keeps a solid hall-side wall before the exit", async () => {
  const plan = await CastleGenerator.generate({ position: { x: -4, z: -4, width: 8, depth: 8, elevation: 2 },
    doors: [{ side: "NORTH", offset: 3, width: 2 }], style: "twin-tower", seed: "rooms" });
  const layout = new CastleResidentialLayout(plan);
  const residential = plan.metadata.runtime.residential;
  const shaft = residential.shaft;
  const floorY = residential.origin.y + residential.rise;
  const areas = layout.walkableAreas.filter((area) => area.floorY === floorY);
  for (const point of [{ x: (shaft.minX + shaft.maxX) / 2, z: shaft.minZ - 0.2 },
    { x: shaft.maxX - 0.15, z: shaft.minZ + 0.25 }]) {
    assert.ok(!areas.some((area) => point.x > area.minX && point.x < area.maxX &&
      point.z > area.minZ && point.z < area.maxZ), "unused ledges have no visible or physical floor");
  }
  assert.ok(plan.metadata.collision.cameraBlocks.some((block) => {
    const point = layout.toLocal(block.x, block.z);
    return Math.abs(point.x - shaft.maxX) < 0.26 && point.z > shaft.minZ && point.z < shaft.minZ + 0.5 &&
      block.y > floorY && block.y < floorY + 1;
  }), "the hall-side shaft edge has masonry and collision");
  assert.ok(residential.furniture.every((item) => item.roomId !== "leisure"), "no lone chair on the leisure terrace");
});