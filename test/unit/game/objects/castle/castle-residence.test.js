import { CastleMapPreparation as Castle } from "../../../../../src/game/objects/castle/CastleMapPreparation.js";
import { createCastleGroundCuts, clipCastleTerrainRecord } from "../../../../../src/game/objects/castle/CastleGroundCuts.js";
import { createCastleStairFlight } from "../../../../../src/game/objects/castle/CastleStairFlight.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout, createCastleButtressFootings } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

const path = "../../../../../src/game/objects/castle/";
const source = readFileSync(new URL(`${path}CastleEntityBuilder.js`, import.meta.url), "utf8")
  .replace(/^import[\s\S]*?from "[^"]+";\r?\n/gm, "");
const start = source.indexOf("  constructor({");
const end = source.indexOf("\n  get entity()", start);
// Keep the real navigation methods and private fields; rendering needs a GPU.
const isolated = source.slice(0, start) + `
  constructor({ residence, position, cameraBlocks, groundColumns = [], audienceRoom = null, stairs = null, serviceStairs = null }) {
    this.#residence = residence;
    this.#position = position;
    this.#cameraCollisionBlocks = cameraBlocks;
    this.#groundCollisionColumns = groundColumns;
    this.#audienceRoom = audienceRoom;
    this.#stairs = stairs;
    this.#serviceStairs = serviceStairs;
  }
` + source.slice(end);
const Builder = new Function("CASTLE_BLOCK_SIZE", `${isolated.replace("export class", "class")}\nreturn CastleEntityBuilder;`)(0.25);

/**
 * @param {string} side
 * @param {string} style
 */
function generate(side = "WEST", style = "twin-tower") {
  return CastleGenerator.generate({
    position: { x: -4, z: -4, width: 8, depth: 8, elevation: 3 },
    doors: [{ side, offset: 3, width: 2 }], style,
  });
}

it("connects the bedroom side door and side terrace to the front balcony for every shape", async () => {
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await generate(side, style);
      const layout = new CastleResidentialLayout(plan);
      const builder = new Builder({ position: plan.input.position, cameraBlocks: plan.metadata.collision.cameraBlocks,
        residence: { layout, blocksMovementAt: () => false } });
      const door = plan.metadata.runtime.residential.sideDoor;
      const angle = door.yaw * Math.PI / 180;
      for (let offset = -0.5; offset <= 0.5; offset += 0.05) {
        assert.equal(builder.blocksMovementAt(door.x + Math.sin(angle) * offset,
          door.z + Math.cos(angle) * offset, 0.22, door.y), false, `${style} ${side} side door`);
      }
      const front = layout.toWorld(0, plan.metadata.runtime.residential.balcony.endDepth);
      assert.equal(builder.blocksMovementAt(front.x, front.z, 0.22, door.y), true, "bedroom front remains closed");
      const terrace = layout.rooms.sideTerrace;
      const targetX = (terrace.minX + terrace.maxX) / 2;
      const bridgeZ = layout.rooms.balcony.maxZ - 0.375;
      for (let progress = 0; progress <= 1; progress += 0.025) {
        const point = layout.toWorld(targetX * progress, bridgeZ);
        assert.equal(builder.blocksMovementAt(point.x, point.z, 0.22, door.y), false,
          `${style} ${side} front-to-side terrace`);
      }
    }
  }
});

it("excavates authored and generated terrain within the castle envelope while preserving tile ownership", async () => {
  const plan = await generate();
  const layout = new CastleResidentialLayout(plan);
  const room = layout.rooms.servantBedroom;
  const point = layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2, -1.5);
  const underground = { object: "Earth", generated: true, position: point };
  const authored = { ...underground, generated: false };
  const above = { object: "Grass", generated: true, position: { ...point, y: layout.origin.y + 0.5 } };
  const turf = { object: "Grass", generated: true, position: { ...point, y: layout.origin.y - 0.5 } };
  const grid = [["structure"]];
  const map = { grid, objects: [{ object: "Castle", buildPlan: plan }, underground, authored, above, turf] };
  Castle.prepareMap(map);
  assert.equal(map.objects.includes(underground), false);
  assert.equal(map.objects.includes(authored), false);
  assert.equal(map.objects.includes(above), false);
  assert.equal(map.objects.includes(turf), false);
  assert.equal(map.grid, grid);
  assert.doesNotThrow(() => Castle.prepareMap({ objects: [{ object: "Castle", buildPlan: {} }] }));
});

it("only the bound servant can obtain basement support", async () => {
  const layout = new CastleResidentialLayout(await generate());
  const room = layout.rooms.servantBedroom;
  const point = layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2, -2.5);
  const servant = {};
  layout.servant = servant;
  assert.equal(layout.surfaceHeightAt(point.x, point.z, point.y), null);
  assert.equal(layout.surfaceHeightAt(point.x, point.z, point.y, {}), null);
  assert.equal(layout.surfaceHeightAt(point.x, point.z, point.y, servant), point.y);
});


it("keeps servant stair access out of ground-level gatehouse masonry", async () => {
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await generate(side, style);
      const layout = new CastleResidentialLayout(plan);
      const { center, radius } = layout.serviceStair;
      const blockers = plan.metadata.collision.cameraBlocks.filter((block) =>
        block.y - block.halfY < layout.origin.y + 0.8 &&
        block.y + block.halfY > layout.origin.y &&
        Math.hypot(Math.max(Math.abs(center.x - block.x) - block.halfX, 0),
          Math.max(Math.abs(center.z - block.z) - block.halfZ, 0)) < radius,
      );
      assert.deepEqual(blockers, [], `${style} ${side}`);
    }
  }
});


it("opens a broad work hall below each generated upper keep", async () => {
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await generate(side, style);
      const layout = new CastleResidentialLayout(plan);
      const depth = plan.metadata.runtime.residential.gatehouseDepth;
      for (const lateral of [-1.65, 0, 1.65]) {
        for (const forward of [layout.rooms.work.minZ + 0.15, depth - 0.75, depth - 0.5, depth - 0.25]) {
          const point = layout.toWorld(lateral, forward);
          const blockers = plan.metadata.collision.cameraBlocks.filter((block) =>
            block.y - block.halfY < layout.origin.y + 0.8 &&
            block.y + block.halfY > layout.origin.y &&
            Math.hypot(Math.max(Math.abs(point.x - block.x) - block.halfX, 0),
              Math.max(Math.abs(point.z - block.z) - block.halfZ, 0)) < 0.08,
          );
          assert.deepEqual(blockers, [], `${style} ${side} ${lateral} ${forward}`);
        }
      }
    }
  }
});


it("fits the authored work desk outside masonry and both stair shafts", async () => {
  for (const style of ["twin-tower", "right-angle", "single-tower", "left-angle"]) {
    for (const side of ["WEST", "EAST", "NORTH", "SOUTH"]) {
      const plan = await generate(side, style);
      const layout = new CastleResidentialLayout(plan);
      const desk = layout.placements.find((placement) => placement.role === "workDesk");
      const center = layout.toLocal(desk.position.x, desk.position.z);
      const halfWidth = 0.9 * desk.scale.x / 2;
      const halfDepth = 0.55 * desk.scale.z / 2;
      const height = 0.73 * desk.scale.y;
      const blockers = plan.metadata.collision.cameraBlocks.filter((block) => {
        if (block.y + block.halfY <= desk.position.y || block.y - block.halfY >= desk.position.y + height) {
          return false;
        }
        const point = layout.toLocal(block.x, block.z);
        return Math.abs(point.x - center.x) < halfWidth + 0.125 &&
          Math.abs(point.z - center.z) < halfDepth + 0.125;
      });
      assert.deepEqual(blockers, [], `${style} ${side} desk`);
      for (const stair of [layout.stairs, layout.serviceStair]) {
        const point = layout.toLocal(stair.center.x, stair.center.z);
        const distance = Math.hypot(Math.max(Math.abs(point.x - center.x) - halfWidth, 0),
          Math.max(Math.abs(point.z - center.z) - halfDepth, 0));
        assert.ok(distance > stair.radius, `${style} ${side} stair`);
      }
    }
  }
});


it("lets a slightly lower actor cross the real castle threshold without granting basement access", () => {
  const residenceSource = readFileSync(new URL(`${path}CastleResidence.js`, import.meta.url), "utf8")
    .replace(/^import (\w+) from "[^\"]+";\r?\n/gm, 'const $1 = "$1";\n')
    .replace(/^import[^\n]+\r?\n/gm, "");
  const Residence = new Function("CastleResidentialLayout", "addGeneratedVoxelPhysics", `${residenceSource.replace("export class", "class").replace("export function", "function")}\nreturn CastleResidence;`)(CastleResidentialLayout, () => {});
  class Entity {
    addChild() {}
    setLocalPosition() {}
    setLocalEulerAngles() {}
    setLocalScale() {}
    addComponent() {}
    findComponents() { return [{ meshInstances: [] }]; }
  }
  const pc = { Entity, Model: class {}, Color: class {} };
  const modelLibrary = { instantiate: () => new Entity(), instantiateMerged: () => new Entity() };
  const fixture = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/royal-castles.json", import.meta.url), "utf8"));
  for (const castle of fixture.objects.filter((object) => object.object === "Castle")) {
    const plan = castle.buildPlan;
    plan.metadata.runtime.residential.buttressFootings = createCastleButtressFootings(plan, fixture);
    const residence = new Residence({ pc, buildPlan: plan, modelLibrary });
    const layout = residence.layout;
    const builder = new Builder({
      residence, position: castle.position,
      cameraBlocks: plan.metadata.collision.cameraBlocks,
      groundColumns: plan.metadata.collision.groundColumns,
    });
    for (const delta of [0, -0.0001, -0.25, -0.32]) {
      for (let forward = -0.5; forward <= 1; forward += 0.05) {
        const point = layout.toWorld(0, forward);
        assert.equal(builder.blocksMovementAt(point.x, point.z, 0.22, layout.origin.y + delta), false,
          `elevation ${layout.origin.y + delta}, entrance ${forward}`);
      }
    }
    const basement = layout.rooms.storage;
    const underground = layout.toWorld((basement.minX + basement.maxX) / 2, (basement.minZ + basement.maxZ) / 2);
    assert.equal(builder.blocksMovementAt(underground.x, underground.z, 0.22, basement.floorY), true);
  }
});


it("includes the exterior servant entrance stairs in aggregate navigation", () => {
  const calls = [];
  const builder = new Builder({ position: { elevation: 2 }, cameraBlocks: [],
    serviceStairs: { blocksMovementAt: (...args) => { calls.push(args); return true; } } });
  assert.equal(builder.blocksMovementAt(1, 2, 0.22, 1.75, 0.32), true);
  assert.deepEqual(calls, [[1, 2, 0.22, 1.75, 0.32]]);
});

it("keeps staircase collider mesh transforms local to their positioned rigid body", async () => {
  const pc = await import("playcanvas");
  const residenceSource = readFileSync(new URL(`${path}CastleResidence.js`, import.meta.url), "utf8");
  const methodStart = residenceSource.indexOf("  #buildStair(");
  const methodEnd = residenceSource.indexOf("  #furnishRooms(", methodStart);
  const method = residenceSource.slice(methodStart, methodEnd).replace("#buildStair", "buildStair").replaceAll("this.#", "this.");
  const Harness = new Function("stairUrl", `${source.slice(source.indexOf("function subtractFloorArea"))}
return class { ${method} };`)("stair-model");
  class Entity extends pc.Entity {
    addComponent(type, data) { this.components ??= {}; this.components[type] = data; }
    findComponents() { return [{ meshInstances: this.meshInstances ?? [] }]; }
  }
  class Mesh {
    setPositions(positions) { this.positions = positions; }
    setIndices(indices) { this.indices = indices; }
    update() {}
  }
  const sourceMesh = { device: {}, getPositions: (out) => out.push(0.08, 0.5, 0.62), getIndices: (out) => out.push(0, 0, 0) };
  const merged = () => { const entity = new Entity("Collider"); entity.meshInstances = [{ mesh: sourceMesh }]; return entity; };
  const harness = new Harness();
  harness.entity = new Entity("Rooms");
  harness.entity.setLocalPosition(-0.5, 4, 2.375);
  harness.entity.setLocalEulerAngles(0, 180, 0);
  harness.layout = { yaw: 180, origin: { y: 4 }, toLocal: () => ({ x: -5, z: 2 }) };
  harness.stairPhysicsGraphs = [];
  harness.buildStair({ ...pc, Entity, Mesh }, { instantiate: () => new Entity("Model"), instantiateMerged: merged },
    { center: { x: 4.5, y: 1.5, z: 0.375 }, radius: 0.45, rise: 2.5 }, "Servant staircase");
  const body = harness.entity.children[0];
  const graph = body.components.collision.model.graph;
  assert.equal(graph.parent, null, "Mesh sources must not include the rigid body's world translation");
  assert.equal(graph.getWorldTransform().getTranslation().length(), 0);
  assert.equal(graph.getLocalScale().x, 1);
  assert.equal(body.getLocalScale().x, 1);
  assert.equal(graph.getLocalScale().y, 1);
  assert.equal(body.getLocalScale().y, 1);
  const colliderMesh = body.components.collision.model.meshInstances[0].mesh;
  assert.notEqual(colliderMesh, sourceMesh, "Different stair sizes cannot share cached Ammo triangle data");
  assert.deepEqual(colliderMesh.positions, [0.08 * (0.45 / 0.65), 1.25, 0.62 * (0.45 / 0.65)]);
  const position = body.getPosition();
  assert.ok(Math.abs(position.x - 4.5) < 0.000001);
  assert.ok(Math.abs(position.y - 1.5) < 0.000001);
  assert.ok(Math.abs(position.z - 0.375) < 0.000001);
  harness.entity.destroy();
  graph.destroy();
});
it("connects the final spiral edge to a rendered and physical upper landing", () => {
  const source = readFileSync(new URL(`${path}CastleResidence.js`, import.meta.url), "utf8");
  const start = source.indexOf("  #addUpperFloorSupport(");
  const end = source.indexOf("  #buildBasement(", start);
  const method = source.slice(start, end).replace("#addUpperFloorSupport", "addUpperFloorSupport").replaceAll("this.#", "this.");
  const Harness = new Function("stoneUrl", "floorUrl", `${source.slice(source.indexOf("function subtractFloorArea"))}
return class { ${method} };`)("stone", "floor");
  const fixture = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/royal-castles.json", import.meta.url), "utf8"));
  for (const castle of fixture.objects.filter((object) => object.object === "Castle")) {
    const harness = new Harness();
    harness.layout = new CastleResidentialLayout(castle.buildPlan);
    harness.solids = [];
    const visuals = [];
    harness.entity = { addChild: (entity) => visuals.push(entity) };
    harness.addUpperFloorSupport({ instantiate: () => ({ setLocalScale(...scale) { this.scale = scale; }, setLocalPosition(...position) { this.position = position; }, findComponents() { return []; } }) });
    const threshold = visuals.find((entity) => entity.name === "Castle main entrance threshold");
    assert.equal(threshold.position[1] + threshold.scale[1], 0, "bottom-anchored stone stops at the doorway floor");
    for (const floor of visuals.filter((entity) => entity.name === "Castle enclosed room wooden floor")) {
      assert.equal(floor.position[1] + floor.scale[1] * 0.06, 0, "wood stays below the audience carpet");
    }
    for (const garden of visuals.filter((entity) => entity.name === "Castle garden grass surface")) {
      for (const surface of visuals.filter((entity) => entity.name === "Castle main entrance threshold" ||
        entity.name === "Castle service entrance stone landing" || entity.name === "Castle enclosed room wooden floor")) {
        const overlapX = Math.min(garden.position[0] + garden.scale[0] / 2, surface.position[0] + surface.scale[0] / 2) -
          Math.max(garden.position[0] - garden.scale[0] / 2, surface.position[0] - surface.scale[0] / 2);
        const overlapZ = Math.min(garden.position[2] + garden.scale[2] / 2, surface.position[2] + surface.scale[2] / 2) -
          Math.max(garden.position[2] - garden.scale[2] / 2, surface.position[2] - surface.scale[2] / 2);
        assert.ok(overlapX <= 1e-6 || overlapZ <= 1e-6, "garden and doorway/wood surfaces have exclusive footprints");
      }
    }
    assert.ok(visuals.some((entity) => entity.name === "Castle spiral upper landing"));
    const landing = harness.layout.walkableAreas.find((area) => area.id === "mainStairLanding");
    const solid = harness.solids.find((box) => Math.abs(box.x - (landing.minX + landing.maxX) / 2) < 1e-6 &&
      Math.abs(box.z - (landing.minZ + landing.maxZ) / 2) < 1e-6);
    assert.ok(solid?.floorSupport);
    assert.equal(solid.width, landing.maxX - landing.minX);
    assert.equal(solid.depth, landing.maxZ - landing.minZ);
    assert.equal(solid.y + solid.height / 2 + harness.layout.origin.y, landing.floorY);
  }
});

it("mounts the entire framed map on continuous masonry away from service doors and shelves", async () => {
  const source = readFileSync(new URL(`${path}CastleResidence.js`, import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("export function findCastleMapMount"));
  const findMount = new Function(`${helper.replace("export function", "function")}\nreturn findCastleMapMount;`)();
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
      const plan = await CastleGenerator.generate({ position: { x: -6, z: -6, width: 12, depth: 12, elevation: 3 },
        doors: [{ side, offset: 5, width: 2 }], style });
      const layout = new CastleResidentialLayout(plan);
      const work = layout.rooms.work;
      const desk = layout.reservations.find((area) => area.role === "workDesk");
      const deskSide = (desk.minX + desk.maxX) / 2 > (work.minX + work.maxX) / 2 ? 1 : -1;
      const shelfBack = work.minZ + (work.maxZ - work.minZ) * 0.45;
      const mount = findMount(plan, layout, deskSide, shelfBack);
      assert.ok(mount, `${style}/${side} has a supported map location`);
      const mountSide = mount.yaw < 0 ? 1 : -1;
      if (mountSide === deskSide) assert.ok(Math.abs(mount.z - shelfBack) >= 0.92);
      for (const across of [-0.356, 0, 0.356]) for (const height of [0.85, 1.176, 1.502]) {
        const point = layout.toWorld(mount.x + mountSide * 0.115, mount.z + across, height);
        assert.ok(plan.metadata.collision.cameraBlocks.some((block) =>
          Math.abs(point.x - block.x) <= block.halfX + 0.000001 &&
          Math.abs(point.y - block.y) <= block.halfY + 0.000001 &&
          Math.abs(point.z - block.z) <= block.halfZ + 0.000001), `${style}/${side}: frame has masonry backing`);
      }
      assert.equal(findMount({ metadata: { collision: { cameraBlocks: [] } } }, layout, deskSide, shelfBack), null,
        "unsupported walls cannot receive a floating frame");
    }
  }
});
