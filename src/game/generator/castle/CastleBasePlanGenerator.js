import { KitchenRoomGenerator } from "./rooms/KitchenRoomGenerator.js";
import { CastleBasePlanInvalidError } from "../../errors/castle/index.js";
import { ServiceRoomGenerator } from "./rooms/ServiceRoomGenerator.js";
import { LibraryRoomGenerator } from "./rooms/LibraryRoomGenerator.js";
import { ThroneRoomGenerator } from "./rooms/ThroneRoomGenerator.js";
import { LeisureRoomGenerator } from "./rooms/LeisureRoomGenerator.js";
import { TowerRoomGenerator } from "./rooms/TowerRoomGenerator.js";

/**
 * @typedef {{kind:string,side:string,offset:number,width:number,bottom:number,height:number,swing?:string}} AuthoredCastleOpening
 * @typedef {{id:string,label:string,kind:string,bounds:number[],generator:string|null,openings:AuthoredCastleOpening[]}} AuthoredCastleSpace
 * @typedef {{id:string,bounds:number[],from:number,to:number,landingProfile?:boolean,radius?:number,flightGap?:number,flightShift?:number,landingLift?:number}} AuthoredCastleStair
 * @typedef {{id:string,bounds:number[],elevation:number,shape:string,height?:number}} AuthoredCastleRoof
 * @typedef {{id:string,bounds:number[],elevation:number,height:number}} AuthoredCastleBuilding
 * @typedef {{index:number,elevation:number,spaces:AuthoredCastleSpace[]}} AuthoredCastleFloor
 * @typedef {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom & {kind:string,generator:string|null}} CompiledCastleSpace
 * @typedef {{roomId:string,kind:string,side:string,axis:string,coordinate:number,center:number,width:number,bottom:number,height:number,floorY:number,swing:string}} CompiledCastleOpening
 * @typedef {{version:number,id:string,name:string,source:{image:string},coordinates:{width:number,depth:number,recommendedUnitMetres:number},floorHeight:number,wallThickness:number,entrance:{spaceId:string,side:string,offset:number,width:number,bridge:number[]},levels:Array<{index:number,elevation:number,spaces:AuthoredCastleSpace[]}>,staircases:AuthoredCastleStair[],roofs:AuthoredCastleRoof[],buildings?:AuthoredCastleBuilding[]}} CastleBasePlan
 */

/**
 * Compiles authored footprints and apertures; room generators only furnish slots.
 * This contract retains multiple staircases and floor voids without room packing.
 */
export class CastleBasePlanGenerator {
  /**
   * @returns {Promise<CastleBasePlan[]>} Independent copies suitable for an editor.
   */
  static get plans() {
    return this.#loadPlans();
  }

  /**
   * Vite 4 serves JSON modules as JavaScript; Node requires JSON attributes.
   * Keep each environment's supported import form in its own branch.
   * @returns {Promise<CastleBasePlan[]>}
   */
  static async #loadPlans() {
    let modules;
    if (import.meta.env) {
      modules = await Promise.all([import("./plans/castle-01.json"), import("./plans/castle-03.json"), import("./plans/castle-04.json"), import("./plans/castle-demo-compact.json")]);
    } else {
      modules = await Promise.all([import("./plans/castle-01.json", { with: { type: "json" } }),
        import("./plans/castle-03.json", { with: { type: "json" } }), import("./plans/castle-04.json", { with: { type: "json" } }),
        import("./plans/castle-demo-compact.json", { with: { type: "json" } })]);
    }
    return structuredClone(modules.map(/**
     * @param {{default:CastleBasePlan}} module
     */
    (module) => module.default));
  }

  /**
   * @param {{planId?:string,seed?:string|number,unitMetres?:number,baseY?:number,generators?:import("./rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator[]}} options
   * @returns {Promise<{basePlanId:string,sourceImage:string,width:number,depth:number,wallThickness:number,placedRooms:import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom[],spaces:Array,openings:Array,stairs:Array,roofs:Array,entrance:Record<string,number|string>,furniture:Array}>}
   */
  static async generate(options = {}) {
    const plans = await this.plans;
    // Keep the compact reference pinned while its exterior is the demo.
    const plan = options.planId === undefined
      ? plans.find(/**
       *
       * @param {CastleBasePlan} candidate
       */
      (candidate) => candidate.id === "castle-demo-compact")
      : plans.find(/**
       *
       * @param {CastleBasePlan} candidate
       */
      (candidate) => candidate.id === options.planId);
    if (!plan) {
      throw new CastleBasePlanInvalidError(options.planId, "planId");
    }
    this.validate(plan);
    const scale = options.unitMetres ?? plan.coordinates.recommendedUnitMetres;
    const baseY = options.baseY ?? 0;
    if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(baseY)) {
      throw new CastleBasePlanInvalidError(plan.id, "scale/baseY");
    }
    const generators = options.generators ?? [new ServiceRoomGenerator(), new KitchenRoomGenerator(), new LibraryRoomGenerator(),
      new ThroneRoomGenerator(), new LeisureRoomGenerator(), new TowerRoomGenerator(1)];
    const registry = new Map(generators.map(/**
     *
     * @param {import("./rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator} generator
     */
    (generator) => [generator.constructor.name, generator]));
    const spaces = [];
    const openings = [];
    const furniture = [];
    for (const floor of plan.levels) {
      for (const authored of floor.spaces) {
        let floorSpan = 1;
        for (const upper of plan.levels) {
          if (upper.index !== floor.index + floorSpan) { continue; }
          for (const voidSpace of upper.spaces) {
            if (voidSpace.kind === "void" && authored.kind === "room" &&
              voidSpace.bounds.every(/**
               * @param {number} value
               * @param {number} index
               */
              (value, index) => value === authored.bounds[index])) { floorSpan++; break; }
          }
        }
        const room = { ...this.#bounds(authored.bounds, scale), id: authored.id, purpose: authored.label,
          kind: authored.kind, level: floor.index, floorY: baseY + floor.elevation,
          floorSpan, height: floorSpan * plan.floorHeight - (plan.buildings ? 0 : 0.25), generator: authored.generator };
        spaces.push(room);
        for (const opening of authored.openings) {
          const alongX = ["NORTH", "SOUTH"].includes(opening.side);
          openings.push({ roomId: room.id, kind: opening.kind, side: opening.side,
            axis: alongX ? "z" : "x", coordinate: alongX
              ? opening.side === "NORTH" ? room.minZ : room.maxZ
              : opening.side === "WEST" ? room.minX : room.maxX,
            center: (alongX ? room.minX : room.minZ) + (opening.offset + opening.width / 2) * scale,
            width: opening.width * scale, bottom: opening.bottom, height: opening.height, floorY: room.floorY, swing: opening.swing ?? "outward" });
        }
        if (!authored.generator) { continue; }
        const generator = registry.get(authored.generator);
        if (!generator) {
          throw new CastleBasePlanInvalidError(plan.id, `generator:${authored.generator}`);
        }
        for (const item of generator.furnish(room)) {
          const halfX = item.width * item.scale / 2;
          const halfZ = item.depth * item.scale / 2;
          if (item.x - halfX < room.minX || item.x + halfX > room.maxX ||
            item.z - halfZ < room.minZ || item.z + halfZ > room.maxZ) { continue; }
          const blocksDoor = openings.some(/**
           *
           * @param {CompiledCastleOpening} opening
           */
          (opening) => opening.roomId === room.id && opening.kind === "door" &&
            (opening.axis === "x" ? Math.abs(item.x - opening.coordinate) < halfX + 0.75 &&
              Math.abs(item.z - opening.center) < halfZ + opening.width / 2 + 0.25 :
              Math.abs(item.z - opening.coordinate) < halfZ + 0.75 &&
              Math.abs(item.x - opening.center) < halfX + opening.width / 2 + 0.25));
          const blocksStair = plan.staircases.some(/**
           *
           * @param {AuthoredCastleStair} stair
           */
          (stair) => floor.index >= stair.from && floor.index <= stair.to &&
            item.x + halfX > stair.bounds[0] * scale && item.x - halfX < (stair.bounds[0] + stair.bounds[2]) * scale &&
            item.z + halfZ > stair.bounds[1] * scale && item.z - halfZ < (stair.bounds[1] + stair.bounds[3]) * scale);
          if (!blocksDoor && !blocksStair) { furniture.push({ ...item, roomId: room.id, floorY: room.floorY }); }
        }
      }
    }
    const entranceRoom = spaces.find(/**
     *
     * @param {CompiledCastleSpace} space
     */
    (space) => space.id === plan.entrance.spaceId && space.level === 0);
    const entrance = openings.find(/**
     *
     * @param {CompiledCastleOpening} opening
     */
    (opening) => opening.roomId === entranceRoom.id && opening.kind === "door" &&
      opening.side === plan.entrance.side && opening.floorY === baseY &&
      opening.width === plan.entrance.width * scale);
    return { basePlanId: plan.id, sourceImage: plan.source.image, width: plan.coordinates.width * scale,
      depth: plan.coordinates.depth * scale, wallThickness: plan.wallThickness * scale, floorHeight: plan.floorHeight, spaces,
      placedRooms: spaces.filter(/**
       *
       * @param {CompiledCastleSpace} space
       */
      (space) => space.kind === "room"), openings,
      stairs: plan.staircases.map(/**
       *
       * @param {AuthoredCastleStair} stair
       */
      (stair) => ({ id: stair.id, ...this.#bounds(stair.bounds, scale),
        from: stair.from, to: stair.to, landingProfile: stair.landingProfile, flightGap: (stair.flightGap ?? 0) * scale, flightShift: (stair.flightShift ?? 0) * scale, landingLift: (stair.landingLift ?? 0) * scale, radius: stair.radius === undefined ? undefined : stair.radius * scale, bottomY: baseY + stair.from * plan.floorHeight, topY: baseY + stair.to * plan.floorHeight })),
      roofs: plan.roofs.map(/**
       *
       * @param {AuthoredCastleRoof} roof
       */
      (roof) => ({ id: roof.id, ...this.#bounds(roof.bounds, scale), y: baseY + roof.elevation, shape: roof.shape, height: roof.height ?? 1.5 })),
      buildings: (plan.buildings ?? []).map(/**
       *
       * @param {{bounds:number[],elevation:number,height:number,id:string}} building
       */
      (building) => ({ ...building, ...this.#bounds(building.bounds, scale),
        floorY: baseY + building.elevation })),
      entrance: { ...entrance, bridge: this.#bounds(plan.entrance.bridge, scale) }, furniture };
  }

  /**
   * @param {number[]} bounds
   * @param {number} scale
   * @returns {{minX:number,maxX:number,minZ:number,maxZ:number}}
   */
  static #bounds([x, z, width, depth], scale) {
    return { minX: x * scale, maxX: (x + width) * scale, minZ: z * scale, maxZ: (z + depth) * scale };
  }

  /**
   * @param {CastleBasePlan} plan
   */
  static validate(plan) {
    /**
     * @param {string} field
     */
    const fail = (field) => { throw new CastleBasePlanInvalidError(plan.id, field); };
    if (plan.version !== 1 || !Number.isFinite(plan.floorHeight) || plan.floorHeight <= 0) { fail("version/floorHeight"); }
    /**
     * @param {number[]} bounds
     */
    const boundsValid = (bounds) => Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite) &&
      bounds[0] >= 0 && bounds[1] >= 0 && bounds[2] > 0 && bounds[3] > 0 &&
      bounds[0] + bounds[2] <= plan.coordinates.width && bounds[1] + bounds[3] <= plan.coordinates.depth;
    const floors = new Set();
    for (const floor of plan.levels) {
      if (floors.has(floor.index) || floor.elevation !== floor.index * plan.floorHeight) { fail("levels"); }
      floors.add(floor.index);
      const ids = new Set();
      for (const space of floor.spaces) {
        if (ids.has(space.id) || !boundsValid(space.bounds)) { fail(`space:${space.id}`); }
        ids.add(space.id);
        for (const opening of space.openings) {
          const length = ["NORTH", "SOUTH"].includes(opening.side) ? space.bounds[2] : space.bounds[3];
          if (!["NORTH", "SOUTH", "EAST", "WEST"].includes(opening.side) || !["door", "window"].includes(opening.kind) ||
            ![opening.offset, opening.width, opening.bottom, opening.height].every(Number.isFinite) ||
            opening.offset < 0 || opening.width <= 0 || opening.offset + opening.width > length ||
            opening.bottom < 0 || opening.height <= 0 || opening.bottom + opening.height > plan.floorHeight) { fail(`opening:${space.id}`); }
        }
      }
    }
    for (const stair of plan.staircases) {
      if (!boundsValid(stair.bounds) || !floors.has(stair.from) || !floors.has(stair.to) || stair.from >= stair.to) { fail(`stair:${stair.id}`); }
    }
    for (const roof of plan.roofs) {
      if (!boundsValid(roof.bounds) || !Number.isFinite(roof.elevation)) { fail(`roof:${roof.id}`); }
    }
    const entrance = plan.levels.find(/**
     *
     * @param {AuthoredCastleFloor} floor
     */
    (floor) => floor.index === 0)?.spaces.find(/**
     *
     * @param {AuthoredCastleSpace} space
     */
    (space) => space.id === plan.entrance.spaceId);
    if (!entrance || !boundsValid(plan.entrance.bridge) || !entrance.openings.some(/**
     *
     * @param {AuthoredCastleOpening} opening
     */
    (opening) =>
      opening.kind === "door" && opening.side === plan.entrance.side && opening.offset === plan.entrance.offset &&
      opening.width === plan.entrance.width)) { fail("entrance"); }
  }
}
