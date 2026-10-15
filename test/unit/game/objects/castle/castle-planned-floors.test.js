import { CastleFloorFinish } from "../../../../../src/game/objects/castle/CastleFloorFinish.js";
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
const FloorBuilder = new Function("floorUrl", "stoneUrl", "Bookshelf", "CastleFloorFinish", `
${source.slice(source.indexOf("function subtractFloorArea("))}
const WoodenFloor = { createPanel: (models) => models.instantiate(floorUrl) };
return class {
  #layout; #entity = { children: [], addChild(child) { this.children.push(child); } }; #solids = [];
  constructor(layout) { this.#layout = layout; }
  get children() { return this.#entity.children; }
  ${source.slice(start, end).replace("#buildPlannedFloors", "build")}
};`)("wood", "stone", {}, CastleFloorFinish);
class Entity {
  constructor(name) { this.name = name; }
  setLocalPosition(...position) { this.position = position; }
  setLocalScale(...scale) { this.scale = scale; }
  addComponent() {}
}

it("keeps continuous timber above masonry in the panel's seams and corners", () => {
  const buffer = readFileSync(new URL("../../../../../src/game/models/castle/residential/floor-panel.glb", import.meta.url));
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
  const backing = gltf.nodes.find((node) => node.name === "Tile backing");
  const vertices = gltf.accessors[gltf.meshes[backing.mesh].primitives[0].attributes.POSITION];
  const top = backing.translation[1] + vertices.max[1] * (backing.scale?.[1] ?? 1);
  assert.ok(top - 0.06 + 0.004 > 0.001, "wood backing covers the flush final tread even inside plank gaps");
  assert.ok(top < 0.06, "shallow plank seams retain their visible depth");
});



it("keeps authored floor finishes inside room wall reveals and supports all occupied levels", async () => {
  const plan = await CastleGenerator.generate({
    position:{
      x:-14,
      z:-8,
      width:28,
      depth:16,
      elevation:3,
    },
    doors:[{
      side:"NORTH",
      offset:13,
      width:2,
    }],
    seed:1,
  });
  const residential = plan.metadata.runtime.residential;
  residential.furniture = [];
  const layout = new CastleResidentialLayout(plan);
  const builder = new FloorBuilder(layout);
  builder.build(plan,{instantiate:url=>Object.assign(new Entity(),{url})},{
    Entity,
    Color:class {},
  });
  const timber = builder.children.filter(child=>child.url==="wood");
  assert.ok(timber.length>0);
  assert.ok(!timber.some(panel => panel.name.includes(":straightLanding")), "stairwell landing strips remain stone");
  assert.ok(timber.some(panel => panel.name === "Castle kitchen wood floor"));
  assert.ok(timber.some(panel => panel.name === "Castle vestibule wood floor"));
  assert.ok(timber.some(panel => panel.name === "Castle vestibule-south wood floor"));
  assert.ok(timber.some(panel => panel.name === "Castle storage-south wood floor"));
  assert.ok(!timber.some(panel => panel.name === "Castle basement-stair-room wood floor"));
  for(const panel of timber) {
    const [x,y,z] = panel.position, [width,height,depth] = panel.scale;
    assert.ok(residential.spaces.map(room => CastleFloorFinish.bounds(room, residential.buildings, residential.openings)).some(room=>x-width/2>=room.minX-0.125-1e-6&&x+width/2<=room.maxX+0.125+1e-6&&z-depth/2>=room.minZ-0.125-1e-6&&z+depth/2<=room.maxZ+0.125+1e-6&&Math.abs(y+height*0.06-0.004-(room.floorY-layout.origin.y))<1e-6));
  }
  for (const panel of timber) {
    const level = Math.round((panel.position[1] - 0.001) / 3) * 3;
    assert.ok(panel.position[1] > level, "timber stays above stone risers and slab joints");
    assert.ok(Math.abs(panel.position[1] + panel.scale[1] * 0.06 - level - 0.004) < 1e-6, "walking finish height is unchanged");
  }
  const library = timber.filter(panel => panel.name === "Castle upper-stair-room wood floor");
  assert.ok(library.some(panel => Math.abs(panel.position[0] - panel.scale[0] / 2 + 1.5) < 1e-6), "Upper hall timber reaches the exterior wall beyond the room reveal");
  assert.ok(library.some(panel => Math.abs(panel.position[2] + panel.scale[2] / 2 - 7.5) < 1e-6), "Upper hall timber covers the rear perimeter strip");
  for(const floorY of [0,3,6]) assert.ok(layout.walkableAreas.some(area=>area.floorY===floorY));
  for(const area of layout.walkableAreas) assert.ok(area.maxX>area.minX&&area.maxZ>area.minZ);
  for(let i=0;i<layout.walkableAreas.length;i++)for(const other of layout.walkableAreas.slice(i+1)){
    const area=layout.walkableAreas[i];if(area.floorY!==other.floorY)continue;
    assert.ok(Math.min(area.maxX,other.maxX)-Math.max(area.minX,other.minX)<=1e-6||Math.min(area.maxZ,other.maxZ)-Math.max(area.minZ,other.minZ)<=1e-6,"floor panels have one surface owner");
  }
});


it("gives the complete authored throne floor to the audience object at its actual level", async () => {
  const plan = await CastleGenerator.generate({
    position: {
      x: -14,
      z: -8,
      width: 28,
      depth: 16,
      elevation: 3,
    },
    doors: [{
      side: "NORTH",
      offset: 13,
      width: 2,
    }],
    seed: 1,
  });
  plan.metadata.runtime.residential.furniture = [];
  const layout = new CastleResidentialLayout(plan);
  const bounds = layout.audienceFloorBounds;
  assert.equal(layout.rooms.work.id, "throne-hall", "authored hall uses a different room ID");
  assert.ok(bounds.maxX > layout.rooms.work.maxX, "the audience panel includes the wall reveal");
  assert.ok(bounds.minZ < layout.rooms.work.minZ, "the entrance edge belongs to the same panel");
  const builder = new FloorBuilder(layout);
  builder.build(plan, { instantiate: url => Object.assign(new Entity(), { url }) }, {
    Entity,
    Color: class {},
  });
  for (const panel of builder.children.filter(child => child.url === "wood")) {
    const [x, y, z] = panel.position;
    if (Math.abs(y - (bounds.floorY - layout.origin.y + 0.001)) > 1e-6) { continue; }
    const [width, , depth] = panel.scale;
    const overlapX = Math.min(x + width / 2, bounds.maxX) - Math.max(x - width / 2, bounds.minX);
    const overlapZ = Math.min(z + depth / 2, bounds.maxZ) - Math.max(z - depth / 2, bounds.minZ);
    assert.ok(overlapX <= 1e-6 || overlapZ <= 1e-6, panel.name + " must not add a second finish inside the audience floor");
  }
});


it("joins vestibule and basement floor reveals without timber outside the entrance", async () => {
  const plan = await CastleGenerator.generate({
    position: {
      x: -14,
      z: -8,
      width: 28,
      depth: 16,
      elevation: 3,
    },
    doors: [{
      side: "NORTH",
      offset: 13,
      width: 2,
    }],
    seed: 1,
  });
  plan.metadata.runtime.residential.furniture = [];
  const layout = new CastleResidentialLayout(plan);
  const builder = new FloorBuilder(layout);
  builder.build(plan, { instantiate: url => Object.assign(new Entity(), { url }) }, {
    Entity,
    Color: class {},
  });
  for (const id of ["vestibule", "vestibule-south", "kitchen", "storage-south"]) {
    const panels = builder.children.filter(panel => panel.name === `Castle ${id} wood floor`);
    assert.equal(panels.length, 1, id + " uses one continuous plank layout");
  }
  const entrance = builder.children.find(panel => panel.name === "Castle vestibule-south wood floor");
  assert.equal(entrance.position[2] - entrance.scale[2] / 2, 0, "timber reaches the inside of the gate");
  assert.ok(entrance.position[2] + entrance.scale[2] / 2 >= 0.375, "the former doorway gap is covered");
  assert.ok(!builder.children.some(panel => panel.url === "wood" && panel.position[2] - panel.scale[2] / 2 < -1e-6),
    "the exterior stone threshold is not covered with wood");
});

it("joins surrounding floor rectangles without filling a stair opening", () => {
  const pieces = [[0, 1, 0, 3], [2, 3, 0, 3], [1, 2, 0, 1], [1, 2, 2, 3]];
  const merged = CastleFloorFinish.merge(pieces);
  assert.equal(merged.reduce((area, [minX, maxX, minZ, maxZ]) => area + (maxX - minX) * (maxZ - minZ), 0), 8);
  assert.ok(!merged.some(([minX, maxX, minZ, maxZ]) => minX < 1.5 && maxX > 1.5 && minZ < 1.5 && maxZ > 1.5));
});
