import { CastleResidentialLayout } from "./CastleResidentialLayout.js";
import { GrassCarpetLayout } from "../ground-cover/GrassCarpetLayout.js";

/**
 * @typedef {{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}} Volume
 */
/**
 * Check prepared terrain independently against the castle's occupied spaces.
 * Face contact with a supporting floor is allowed; positive volume penetration is reported.
 * @param {import("../../GameContracts.js").GameMapData} mapData
 * @returns {Array<{castleId:string,seed:string,area:string,kind:string,certainty:string,reason?:string,rootInside?:boolean,terrainId?:string,position:{x:number,y:number,z:number},bounds:Volume}>}
 */
export function validateCastleGround(mapData) {
  const issues = [];
  const canopy = GrassCarpetLayout.create(mapData);
  const terrain = (mapData.objects ?? []).filter(/**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} object
   */ (object) => ["Earth", "Grass"].includes(object.object) && object.position);
  for (const castle of mapData.objects ?? []) {
    if (castle.object !== "Castle" || !castle.buildPlan?.metadata) continue;
    const plan = castle.buildPlan;
    // Original generator plans predate room envelopes. Their masonry collision
    // boxes still provide a useful, independent terrain penetration check.
    if (!plan.metadata.runtime?.residential) {
      for (const object of terrain) {
        const args = object.geometry?.args;
        const box = object.geometry?.method === "addBoxMatrix";
        const width = box ? args[6] : 1, height = box ? args[7] : 1, depth = box ? args[8] : 1;
        const { x, y, z } = object.position;
        const bounds = { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2,
          maxY: y + height / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
        for (const [index, block] of (plan.metadata.collision?.cameraBlocks ?? []).entries()) {
          const wall = { minX: block.x - block.halfX, maxX: block.x + block.halfX,
            minY: block.y - block.halfY, maxY: block.y + block.halfY,
            minZ: block.z - block.halfZ, maxZ: block.z + block.halfZ };
          if (!overlaps(bounds, wall)) continue;
          issues.push({ castleId: castle.id ?? "Castle", seed: String(castle.seed ?? ""),
            area: `wall:${index}`, kind: "terrain", certainty: "confirmed", terrainId: object.id,
            position: { x, y, z }, bounds });
          break;
        }
      }
      continue;
    }
    const layout = new CastleResidentialLayout(plan);
    const residential = plan.metadata.runtime.residential;
    const areas = [];
    /**
     * @param {string} area
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} room
     * @param {number} floor
     * @param {number} ceiling
     */
    const addRoom = (area, room, floor, ceiling) => {
      if (!room) return;
      const corners = [[room.minX, room.minZ], [room.maxX, room.maxZ], [room.minX, room.maxZ], [room.maxX, room.minZ]]
        .map(/**
              * @param {Array<number>} point
              */ (point) => layout.toWorld(point[0], point[1], 0));
      areas.push({ area, bounds: { minX: Math.min(...corners.map(/**
                                                                  * @param {{x:number}} point
                                                                  */ (point) => point.x)),
        maxX: Math.max(...corners.map(/**
                                       * @param {{x:number}} point
                                       */ (point) => point.x)),
        minZ: Math.min(...corners.map(/**
                                       * @param {{z:number}} point
                                       */ (point) => point.z)),
        maxZ: Math.max(...corners.map(/**
                                       * @param {{z:number}} point
                                       */ (point) => point.z)), minY: floor, maxY: ceiling } });
    };
    addRoom("work", layout.rooms.work, layout.rooms.work.floorY, layout.rooms.work.floorY + 2);
    for (const building of residential.buildings ?? []) {
      if (building.id === "courtyard" || building.role === "courtyard") continue;
      addRoom(`building:${building.id ?? building.role}`, building.bounds, layout.origin.y, layout.origin.y + 2);
    }
    for (const area of layout.walkableAreas) {
      if (area.id === "courtyard" || area.kind === "courtyard") continue;
      addRoom(area.id, area, area.floorY, area.floorY + 1);
    }
    // The surrounding bay is occupied too, not just the narrow spiral shaft.
    // These reservations include the ground-floor approach beside the opening.
    for (const name of ["mainStair", "serviceStair"]) {
      const bay = residential.reservations?.[name];
      if (bay) addRoom(`${name}Bay`, bay, layout.origin.y, layout.origin.y + 2);
    }
    for (const [name, stair] of [["mainStair", layout.stairs], ["serviceStair", layout.serviceStair], ...layout.authoredStairs.map(/**
     * @param {{id:string}} stair
     */ (stair) => [stair.id, stair])]) {
      if (!stair) continue;
      const { center, radius } = stair;
      areas.push({ area: name, bounds: { minX: center.x - radius, maxX: center.x + radius,
        minZ: center.z - radius, maxZ: center.z + radius, minY: center.y, maxY: center.y + stair.rise + 0.8 } });
    }
    for (const name of ["servantBedroom", "storage"]) {
      const room = layout.rooms[name];
      if (room && residential.basement) { addRoom(name, room, room.floorY, residential.basement.ceilingY); }
    }
    for (const [index, block] of (plan.metadata.collision?.cameraBlocks ?? []).entries()) {
      if (block.y + block.halfY <= layout.origin.y || block.y - block.halfY > layout.origin.y + 1) continue;
      areas.push({ area: `wall:${index}`, bounds: { minX: block.x - block.halfX, maxX: block.x + block.halfX,
        minY: Math.max(layout.origin.y, block.y - block.halfY), maxY: block.y + block.halfY,
        minZ: block.z - block.halfZ, maxZ: block.z + block.halfZ } });
    }
    if (!residential.basePlanId && residential.outerBounds) addRoom("castleEnvelope", residential.outerBounds, layout.origin.y, layout.origin.y + 2);
    const context = { castleId: castle.id ?? "Castle", seed: String(castle.seed ?? plan.input.seed ?? plan.metadata.seed ?? mapData.seed ?? mapData.mapName ?? "") };
    for (const object of terrain) {
      const args = object.geometry?.args;
      const box = object.geometry?.method === "addBoxMatrix";
      const width = box ? args[6] : 1, height = box ? args[7] : 1, depth = box ? args[8] : 1;
      const { x, y, z } = object.position;
      const bounds = { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2,
        maxY: y + height / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
      const hit = areas.find(/**
                              * @param {{bounds:Volume}} area
                              */ (area) => overlaps(bounds, area.bounds));
      const turfFloor = !hit && object.object === "Grass" ? areas.find(/**
       * @param {{area:string,bounds:Volume}} area
       */ (area) => !area.area.startsWith("wall:") && bounds.maxY >= area.bounds.minY - 0.02 &&
        bounds.maxY <= area.bounds.minY + 0.25 && Math.min(bounds.maxX, area.bounds.maxX) - Math.max(bounds.minX, area.bounds.minX) > 0.000001 &&
        Math.min(bounds.maxZ, area.bounds.maxZ) - Math.max(bounds.minZ, area.bounds.minZ) > 0.000001) : null;
      const collision = hit ?? turfFloor;
      if (collision) issues.push({ ...context, area: collision.area, kind: turfFloor ? "grass-floor" : "terrain", certainty: "confirmed", terrainId: object.id, position: { x, y, z }, bounds });
    }
    for (const clump of canopy) {
      // Authored model node/accessor bounds (including their transforms), not
      // an assumed unit cube. These enclose static geometry; shader wind/contact
      // deformation and triangle gaps mean an envelope hit is only potential.
      const source = clump.broadleaf ? [-0.168, 0.19, 0, 0.194, -0.129, 0.191] :
        [-0.269, 0.286, -0.029, 0.346, -0.163, 0.2];
      const angle = clump.rotation * Math.PI / 180;
      const points = [[source[0], source[4]], [source[0], source[5]], [source[1], source[4]], [source[1], source[5]]]
        .map(/**
         * @param {Array<number>} point
         */ (point) => ({ x: clump.x + clump.width * (point[0] * Math.cos(angle) + point[1] * Math.sin(angle)),
          z: clump.z + clump.width * (-point[0] * Math.sin(angle) + point[1] * Math.cos(angle)) }));
      const bounds = { minX: Math.min(...points.map(/**
        * @param {{x:number}} point
        */ (point) => point.x)), maxX: Math.max(...points.map(/**
        * @param {{x:number}} point
        */ (point) => point.x)),
        minZ: Math.min(...points.map(/**
        * @param {{z:number}} point
        */ (point) => point.z)), maxZ: Math.max(...points.map(/**
        * @param {{z:number}} point
        */ (point) => point.z)), minY: clump.y + source[2] * clump.height, maxY: clump.y + source[3] * clump.height };
      const hit = areas.find(/**
                              * @param {{bounds:Volume}} area
                              */ (area) => overlaps(bounds, area.bounds));
      if (hit) {
        const rootInside = clump.x > hit.bounds.minX && clump.x < hit.bounds.maxX && clump.z > hit.bounds.minZ && clump.z < hit.bounds.maxZ && clump.y >= hit.bounds.minY - 0.02 && clump.y < hit.bounds.maxY;
        const interiorRoot = rootInside && !hit.area.startsWith("wall:");
        issues.push({ ...context, area: hit.area, kind: interiorRoot ? "grass-in-interior" : "canopy-potential", certainty: interiorRoot ? "confirmed" : "potential", rootInside,
          reason: interiorRoot ? "grass grows inside an occupied castle floor or stair bay" : "rotated authored canopy envelope; triangle gaps and shader deformation not evaluated",
          position: { x: clump.x, y: clump.y, z: clump.z }, bounds });
      }
    }
  }
  return issues;
}

/**
 * @param {Volume} a
 * @param {Volume} b
 */
function overlaps(a, b) {
  return Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0.000001 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0.000001 &&
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 0.000001;
}
