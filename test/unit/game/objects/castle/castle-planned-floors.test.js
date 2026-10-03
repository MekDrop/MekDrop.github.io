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

it("keeps continuous timber above masonry in the panel's seams and corners", () => {
  const buffer = readFileSync(new URL("../../../../../src/game/models/castle/residential/floor-panel.glb", import.meta.url));
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
  const backing = gltf.nodes.find((node) => node.name === "Tile backing");
  const vertices = gltf.accessors[gltf.meshes[backing.mesh].primitives[0].attributes.POSITION];
  const top = backing.translation[1] + vertices.max[1] * (backing.scale?.[1] ?? 1);
  assert.ok(top - 0.06 + 0.004 > 0.001, "wood backing covers the flush final tread even inside plank gaps");
  assert.ok(top < 0.06, "shallow plank seams retain their visible depth");
});



it("keeps authored floor finishes inside rooms and supports all occupied levels", async () => {
  const plan = await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:"NORTH",offset:13,width:2}],seed:1});
  const residential = plan.metadata.runtime.residential;
  residential.furniture = [];
  const layout = new CastleResidentialLayout(plan);
  const builder = new FloorBuilder(layout);
  builder.build(plan,{instantiate:url=>Object.assign(new Entity(),{url})},{Entity,Color:class {}});
  const timber = builder.children.filter(child=>child.url==="wood");
  assert.ok(timber.length>0);
  for(const panel of timber) {
    const [x,y,z] = panel.position, [width,,depth] = panel.scale;
    assert.ok(residential.placedRooms.some(room=>x-width/2>=room.minX-1e-6&&x+width/2<=room.maxX+1e-6&&z-depth/2>=room.minZ-1e-6&&z+depth/2<=room.maxZ+1e-6&&Math.abs(y+.056-(room.floorY-layout.origin.y))<1e-6));
  }
  for(const floorY of [0,3,6]) assert.ok(layout.walkableAreas.some(area=>area.floorY===floorY));
  for(const area of layout.walkableAreas) assert.ok(area.maxX>area.minX&&area.maxZ>area.minZ);
  for(let i=0;i<layout.walkableAreas.length;i++)for(const other of layout.walkableAreas.slice(i+1)){
    const area=layout.walkableAreas[i];if(area.floorY!==other.floorY)continue;
    assert.ok(Math.min(area.maxX,other.maxX)-Math.max(area.minX,other.minX)<=1e-6||Math.min(area.maxZ,other.maxZ)-Math.max(area.minZ,other.minZ)<=1e-6,"floor panels have one surface owner");
  }
});
