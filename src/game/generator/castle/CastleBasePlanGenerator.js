import { everyFiniteNumber } from "../../helpers/collections.js";
import { TerraceStorageRoomGenerator } from "./rooms/terrace-storage/TerraceStorageRoomGenerator.js";
import { KitchenRoomGenerator } from "./rooms/kitchen/KitchenRoomGenerator.js";
import { CastleBasePlanInvalidError } from "../../errors/castle/index.js";
import { ServiceRoomGenerator } from "./rooms/service/ServiceRoomGenerator.js";
import { RoyalBedroomRoomGenerator } from "./rooms/royal-bedroom/RoyalBedroomRoomGenerator.js";
import { LibraryRoomGenerator } from "./rooms/library/LibraryRoomGenerator.js";
import { ThroneRoomGenerator } from "./rooms/throne/ThroneRoomGenerator.js";
import { LeisureRoomGenerator } from "./rooms/leisure/LeisureRoomGenerator.js";
import { TowerRoomGenerator } from "./rooms/tower/TowerRoomGenerator.js";
import { VestibuleRoomGenerator } from "./rooms/vestibule/VestibuleRoomGenerator.js";
import { StairwellRoomGenerator } from "./rooms/stairwell/StairwellRoomGenerator.js";

/**
 * @typedef {{kind:string,side:string,offset:number,width:number,bottom:number,height:number,swing?:string,openWide?:boolean,frameClearance?:number,openingInset?:number,open?:boolean}} AuthoredCastleOpening
 * @typedef {{id:string,label:string,kind:string,bounds:number[],generator:string|null,openings:AuthoredCastleOpening[],floorFinish?:string,furnish?:boolean}} AuthoredCastleSpace
 * @typedef {{id:string,bounds:number[],from:number,to:number,landingProfile?:boolean,radius?:number,flightGap?:number,flightShift?:number,landingLift?:number,entrySide?:string}} AuthoredCastleStair
 * @typedef {{id:string,bounds:number[],elevation:number,shape:string,height?:number,battlements?:boolean}} AuthoredCastleRoof
 * @typedef {{id:string,bounds:number[],elevation:number,height:number}} AuthoredCastleBuilding
 * @typedef {{index:number,elevation:number,spaces:AuthoredCastleSpace[]}} AuthoredCastleFloor
 * @typedef {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom & {kind:string,generator:string|null,wallBounds:{minX:number,maxX:number,minZ:number,maxZ:number}}} CompiledCastleSpace
 * @typedef {{roomId:string,kind:string,side:string,axis:string,coordinate:number,center:number,width:number,bottom:number,height:number,floorY:number,swing:string,openWide?:boolean,frameClearance?:number,openingInset:number,open?:boolean}} CompiledCastleOpening
 * @typedef {{version:number,id:string,name:string,source:{image:string},coordinates:{width:number,depth:number,recommendedUnitMetres:number},floorHeight:number,wallThickness:number,entrance:{spaceId:string,side:string,offset:number,width:number,bridge:number[]},levels:Array<{index:number,elevation:number,spaces:AuthoredCastleSpace[]}>,staircases:AuthoredCastleStair[],roofs:AuthoredCastleRoof[],buildings?:AuthoredCastleBuilding[],roofAccess?:{bounds:number[],bottom:number[],top:number[],position?:number[],rotation?:number}} CastleBasePlan
 */

/**
 * Compiles authored footprints and apertures; room generators only furnish slots.
 * This contract retains multiple staircases and floor voids without room packing.
 */
export class CastleBasePlanGenerator {
  /**
   * Layouts enabled for seed selection, in stable order.
   * @returns {string[]}
   */
  static get layoutPlanIds() {
    return ["castle-demo-compact", "castle-compact-tower", "castle-compact-service-wing"];
  }

  /**
   * Consecutive even/odd seeds select the same layout.
   * @param {string|number} [seed]
   * @returns {string}
   */
  static selectPlanId(seed) {
    const ids = this.layoutPlanIds;

    return ids[Math.floor(this.#seedNumber(seed) / 2) % ids.length];
  }

  /**
   * Numeric strings retain their parity; named seeds use a stable unsigned hash.
   * @param {string|number} [seed]
   * @returns {number}
   */
  static #seedNumber(seed = 0) {
    const numeric = Number(seed);
    if (Number.isFinite(numeric)) {
      return Math.abs(Math.trunc(numeric));
    }
    let hash = 0;
    for (const character of String(seed)) {
      hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
    }

    return hash;
  }

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
      modules = await Promise.all([import("./plans/castle-01.json"), import("./plans/castle-03.json"), import("./plans/castle-04.json"), import("./plans/castle-demo-compact.json"), import("./plans/castle-compact-tower.json"), import("./plans/castle-compact-service-wing.json")]);
    } else {
      modules = await Promise.all([import("./plans/castle-01.json", { with: { type: "json" } }),
        import("./plans/castle-03.json", { with: { type: "json" } }), import("./plans/castle-04.json", { with: { type: "json" } }),
        import("./plans/castle-demo-compact.json", { with: { type: "json" } }), import("./plans/castle-compact-tower.json", { with: { type: "json" } }), import("./plans/castle-compact-service-wing.json", { with: { type: "json" } })]);
    }
    const rearTower = import.meta.env
      ? await import("./plans/castle-rear-bell-tower.json")
      : await import("./plans/castle-rear-bell-tower.json", { with: { type: "json" } });
    modules.push(rearTower);

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
    const planId = options.planId ?? this.selectPlanId(options.seed);
    const plan = plans.find(/**
       *
       * @param {CastleBasePlan} candidate
       */
      (candidate) => candidate.id === planId);
    if (!plan) {
      throw new CastleBasePlanInvalidError(options.planId, "planId");
    }
    this.validate(plan);
    const scale = options.unitMetres ?? plan.coordinates.recommendedUnitMetres;
    const baseY = options.baseY ?? 0;
    if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(baseY)) {
      throw new CastleBasePlanInvalidError(plan.id, "scale/baseY");
    }
    const generators = options.generators ?? [new ServiceRoomGenerator(), new RoyalBedroomRoomGenerator(), new KitchenRoomGenerator(), new LibraryRoomGenerator(),
      new ThroneRoomGenerator(), new LeisureRoomGenerator(), new TowerRoomGenerator(1), new VestibuleRoomGenerator(), new TerraceStorageRoomGenerator()];
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
          if (upper.index !== floor.index + floorSpan) {
            continue;
          }
          for (const voidSpace of upper.spaces) {
            /**
             * @param {number} value
             * @param {number} index
             */
            const matchesAuthoredBound = (value, index) => value === authored.bounds[index];
            if (voidSpace.kind === "void" && authored.kind === "room" &&
              voidSpace.bounds.every(matchesAuthoredBound)) {
              floorSpan++; break;
            }
          }
        }
        const room = {
          ...this.#bounds(authored.bounds, scale),
          id: authored.id,
          purpose: authored.label,
          kind: authored.kind,
          floorFinish: authored.floorFinish,
          furnish: authored.furnish,
          level: floor.index,
          floorY: baseY + floor.elevation,
          furnishingSeed: options.seed ?? 0,
          floorSpan,
          height: floorSpan * plan.floorHeight - (plan.buildings ? 0 : 0.25),
          generator: authored.generator,
          furnishingBounds: authored.furnishingBounds ? this.#bounds(authored.furnishingBounds, scale) : null,
        };
        spaces.push(room);
        // Exterior walls follow the building envelope rather than the inset
        // room rectangle. Preserve their actual inside faces for wall props.
        room.wallBounds = {
          minX: room.minX,
          maxX: room.maxX,
          minZ: room.minZ,
          maxZ: room.maxZ,
        };
        for (const building of plan.buildings ?? []) {
          if (floor.elevation < building.elevation || floor.elevation + room.height > building.elevation + building.height) {
            continue;
          }
          const envelope = this.#bounds(building.bounds, scale);
          for (const edge of ["minX", "maxX", "minZ", "maxZ"]) {
            if (Math.abs(room[edge] - envelope[edge]) <= plan.wallThickness * scale * 1.1) {
              room.wallBounds[edge] = envelope[edge];
            }
          }
        }
        for (const opening of authored.openings) {
          const alongX = ["NORTH", "SOUTH"].includes(opening.side);
          openings.push({
            roomId: room.id,
            kind: opening.kind,
            side: opening.side,
            axis: alongX ? "z" : "x",
            coordinate: alongX
              ? opening.side === "NORTH" ? room.minZ : room.maxZ
              : opening.side === "WEST" ? room.minX : room.maxX,
            center: (alongX ? room.minX : room.minZ) + (opening.offset + opening.width / 2) * scale,
            open: opening.open === true,
            width: opening.width * scale,
            bottom: opening.bottom,
            height: opening.height,
            floorY: room.floorY,
            swing: opening.swing ?? "outward",
            openWide: opening.openWide,
            frameClearance: opening.frameClearance ?? 0,
            openingInset: opening.openingInset ?? 0,
          });
        }
      }
    }
    // Furnishing must see doors authored by neighboring rooms, including later spaces.
    for (const room of spaces) {
      if (!room.generator || room.furnish === false) {
        continue;
      }
      const generator = registry.get(room.generator);
      if (!generator) {
        throw new CastleBasePlanInvalidError(plan.id, `generator:${room.generator}`);
      }
      const furnishingRoom = room.furnishingBounds ? {
        ...room,
        ...room.furnishingBounds,
      } : room;
      for (const item of generator.furnish(furnishingRoom, {
        seed: options.seed,
        wallThickness: plan.wallThickness * scale,
        openings,
        stairs: plan.staircases.map(/**
         * @param {AuthoredCastleStair} stair
         */ (stair) => ({
            ...stair,
            ...this.#bounds(stair.bounds, scale),
          })),
      })) {
        const halfX = item.width * item.scale / 2;
        const halfZ = item.depth * item.scale / 2;
        const bounds = item.wallAttachment || item.role === "libraryProp" || item.role === "servantBed" || ["Fireplace", "HangingFryingPan"].includes(item.object) ? room.wallBounds : room;
        const wallInset = item.wallInset ?? 0;
        if (item.x - halfX < bounds.minX - wallInset - 1e-6 || item.x + halfX > bounds.maxX + wallInset + 1e-6 ||
          item.z - halfZ < bounds.minZ - wallInset - 1e-6 || item.z + halfZ > bounds.maxZ + wallInset + 1e-6) {
          continue;
        }
        const blocksDoor = openings.some(/**
         *
         * @param {CompiledCastleOpening} opening
         */
          (opening) => opening.roomId === room.id && opening.kind === "door" &&
          (item.y ?? 0) + (item.height ?? Infinity) * item.scale > 0.05 &&
          !(item.object === "Shelf" && (opening.axis === "z" ?
            Math.abs(item.x - opening.center) >= halfX + opening.width / 2 && Math.abs(item.z - opening.coordinate) >= halfZ + 0.1 :
            Math.abs(item.z - opening.center) >= halfZ + opening.width / 2 && Math.abs(item.x - opening.coordinate) >= halfX + 0.1)) &&
          (opening.axis === "x" ? Math.abs(item.x - opening.coordinate) < halfX + 0.75 &&
            Math.abs(item.z - opening.center) < halfZ + opening.width / 2 + 0.25 :
            Math.abs(item.z - opening.coordinate) < halfZ + 0.75 &&
            Math.abs(item.x - opening.center) < halfX + opening.width / 2 + 0.25));
        const blocksStair = plan.staircases.some(/**
         *
         * @param {AuthoredCastleStair} stair
         */
          (stair) => room.level >= stair.from && room.level <= stair.to &&
          item.x + halfX > stair.bounds[0] * scale && item.x - halfX < (stair.bounds[0] + stair.bounds[2]) * scale &&
          item.z + halfZ > stair.bounds[1] * scale && item.z - halfZ < (stair.bounds[1] + stair.bounds[3]) * scale);
        if (!blocksDoor && !blocksStair) {
          furniture.push({
            ...item,
            roomId: room.id,
            floorY: room.floorY,
          });
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
    const roofAccess = plan.roofAccess ? {
      ...this.#bounds(plan.roofAccess.bounds, scale),
      position: {
        x: (plan.roofAccess.position ?? plan.roofAccess.bottom)[0] * scale,
        y: baseY + (plan.roofAccess.position ?? plan.roofAccess.bottom)[1],
        z: (plan.roofAccess.position ?? plan.roofAccess.bottom)[2] * scale,
      },
      rotation: plan.roofAccess.rotation ?? 0,
      bottom: {
        x: plan.roofAccess.bottom[0] * scale,
        y: baseY + plan.roofAccess.bottom[1],
        z: plan.roofAccess.bottom[2] * scale,
      },
      top: {
        x: plan.roofAccess.top[0] * scale,
        y: baseY + plan.roofAccess.top[1],
        z: plan.roofAccess.top[2] * scale,
      },
    } : null;
    const result = {
      roofAccess,
      basePlanId: plan.id,
      sourceImage: plan.source.image,
      width: plan.coordinates.width * scale,
      depth: plan.coordinates.depth * scale,
      wallThickness: plan.wallThickness * scale,
      floorHeight: plan.floorHeight,
      spaces,
      placedRooms: spaces.filter(/**
       *
       * @param {CompiledCastleSpace} space
       */
        (space) => space.kind === "room"),
      openings,
      stairs: plan.staircases.map(/**
       *
       * @param {AuthoredCastleStair} stair
       */
        (stair) => ({
          id: stair.id,
          ...this.#bounds(stair.bounds, scale),
          from: stair.from,
          to: stair.to,
          entrySide: stair.entrySide,
          landingProfile: stair.landingProfile,
          flightGap: (stair.flightGap ?? 0) * scale,
          flightShift: (stair.flightShift ?? 0) * scale,
          landingLift: (stair.landingLift ?? 0) * scale,
          radius: stair.radius === undefined ? undefined : stair.radius * scale,
          bottomY: baseY + stair.from * plan.floorHeight,
          topY: baseY + stair.to * plan.floorHeight,
        })),
      roofs: plan.roofs.map(/**
       *
       * @param {AuthoredCastleRoof} roof
       */
        (roof) => ({
          id: roof.id,
          ...this.#bounds(roof.bounds, scale),
          y: baseY + roof.elevation,
          shape: roof.shape,
          battlements: roof.battlements === true,
          height: roof.height ?? 1.5,
        })),
      buildings: (plan.buildings ?? []).map(/**
       *
       * @param {{bounds:number[],elevation:number,height:number,id:string}} building
       */
        (building) => ({
          ...building,
          ...this.#bounds(building.bounds, scale),
          floorY: baseY + building.elevation,
        })),
      entrance: {
        ...entrance,
        bridge: this.#bounds(plan.entrance.bridge, scale),
      },
      furniture,
    };
    const stairwell = new StairwellRoomGenerator("authored-stairwell");
    for (const room of spaces) {
      if (room.kind !== "room" || room.furnish === false) {
        continue;
      }
      if (roofAccess && room.floorY === roofAccess.bottom.y && roofAccess.position.x >= room.minX &&
          roofAccess.position.x <= room.maxX && roofAccess.position.z >= room.minZ && roofAccess.position.z <= room.maxZ) {
        continue;
      }
      const stairs = result.stairs.filter(/**
       * @param {{from:number,to:number,minX:number,maxX:number,minZ:number,maxZ:number}} stair
       */ stair => room.level >= stair.from && room.level <= stair.to &&
        room.maxX > stair.minX && room.minX < stair.maxX && room.maxZ > stair.minZ && room.minZ < stair.maxZ);
      const occupied = furniture.filter(/**
       * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId:string,floorY:number}} item
       */ item => item.roomId === room.id && item.floorY === room.floorY);
      for (const item of stairwell.furnish(room, {
        seed: Math.floor(this.#seedNumber(options.seed) / 2),
        stairs,
        openings,
        occupied,
      })) {
        furniture.push({
          ...item,
          roomId: room.id,
          floorY: room.floorY,
        });
      }
    }
    result.mirrored = this.#seedNumber(options.seed) % 2 === 1;
    if (result.mirrored) {
      // Reflect parallel to the entrance wall about the door itself, fixing its anchor.
      const axis = entrance.axis === "z" ? "X" : "Z";
      const twiceCenter = entrance.center * 2;
      for (const bounds of [...(roofAccess ? [roofAccess] : []), ...spaces, ...spaces.map(/**
       * @param {CompiledCastleSpace} space
       */
        space => space.wallBounds), ...result.stairs, ...result.roofs, ...result.buildings, result.entrance.bridge]) {
        const min = bounds[`min${axis}`];
        bounds[`min${axis}`] = twiceCenter - bounds[`max${axis}`];
        bounds[`max${axis}`] = twiceCenter - min;
      }
      for (const stair of result.stairs) {
        if (axis === "X" && ["WEST", "EAST"].includes(stair.entrySide) || axis === "Z" && ["NORTH", "SOUTH"].includes(stair.entrySide)) {
          stair.entrySide = {
            WEST: "EAST",
            EAST: "WEST",
            NORTH: "SOUTH",
            SOUTH: "NORTH",
          }[stair.entrySide];
        }
      }
      if (roofAccess) {
        const coordinate = axis.toLowerCase();
        roofAccess.position[coordinate] = twiceCenter - roofAccess.position[coordinate];
        roofAccess.rotation = axis === "X" ? -roofAccess.rotation : 180 - roofAccess.rotation;
        roofAccess.bottom[coordinate] = twiceCenter - roofAccess.bottom[coordinate];
        roofAccess.top[coordinate] = twiceCenter - roofAccess.top[coordinate];
      }
      for (const opening of openings) {
        if (opening.axis === entrance.axis) {
          opening.center = twiceCenter - opening.center;
        } else {
          opening.coordinate = twiceCenter - opening.coordinate;
          opening.side = {
            WEST: "EAST",
            EAST: "WEST",
            NORTH: "SOUTH",
            SOUTH: "NORTH",
          }[opening.side];
        }
      }
      for (const item of furniture) {
        const coordinate = axis.toLowerCase();
        item[coordinate] = twiceCenter - item[coordinate];
        if (item.role === "stairwellProp") {
          item.rotation = axis === "X" ? -item.rotation : 180 - item.rotation;
        }
        if (item.rotation !== undefined && item.role !== "stairwellProp") {
          item.rotation = (axis === "X" ? -item.rotation : 180 - item.rotation) + (item.mirrorRotationOffset ?? 0);
        }
      }
    }
    return result;
  }

  /**
   * @param {number[]} bounds
   * @param {number} scale
   * @returns {{minX:number,maxX:number,minZ:number,maxZ:number}}
   */
  static #bounds([x, z, width, depth], scale) {
    return {
      minX: x * scale,
      maxX: (x + width) * scale,
      minZ: z * scale,
      maxZ: (z + depth) * scale,
    };
  }

  /**
   * @param {CastleBasePlan} plan
   */
  static validate(plan) {
    /**
     * @param {string} field
     */
    const fail = (field) => {
      throw new CastleBasePlanInvalidError(plan.id, field);
    };
    if (plan.version !== 1 || !Number.isFinite(plan.floorHeight) || plan.floorHeight <= 0) {
      fail("version/floorHeight");
    }
    /**
     * @param {number[]} bounds
     */
    const boundsValid = (bounds) => Array.isArray(bounds) && bounds.length === 4 && everyFiniteNumber(bounds) &&
      bounds[0] >= 0 && bounds[1] >= 0 && bounds[2] > 0 && bounds[3] > 0 &&
      bounds[0] + bounds[2] <= plan.coordinates.width && bounds[1] + bounds[3] <= plan.coordinates.depth;
    const floors = new Set();
    for (const floor of plan.levels) {
      if (floors.has(floor.index) || floor.elevation !== floor.index * plan.floorHeight) {
        fail("levels");
      }
      floors.add(floor.index);
      const ids = new Set();
      for (const space of floor.spaces) {
        if (ids.has(space.id) || !boundsValid(space.bounds)) {
          fail(`space:${space.id}`);
        }
        ids.add(space.id);
        for (const opening of space.openings) {
          const length = ["NORTH", "SOUTH"].includes(opening.side) ? space.bounds[2] : space.bounds[3];
          if (!["NORTH", "SOUTH", "EAST", "WEST"].includes(opening.side) || !["door", "window"].includes(opening.kind) ||
            !everyFiniteNumber([opening.offset, opening.width, opening.bottom, opening.height]) ||
            opening.offset < 0 || opening.width <= 0 || opening.offset + opening.width > length ||
            opening.bottom < 0 || opening.height <= 0 || opening.bottom + opening.height > plan.floorHeight) {
            fail(`opening:${space.id}`);
          }
        }
      }
    }
    for (const stair of plan.staircases) {
      if (stair.entrySide !== undefined && !["NORTH", "EAST", "SOUTH", "WEST"].includes(stair.entrySide)) {
        fail(`stair:${stair.id}:entrySide`);
      }
      if (!boundsValid(stair.bounds) || !floors.has(stair.from) || !floors.has(stair.to) || stair.from >= stair.to) {
        fail(`stair:${stair.id}`);
      }
    }
    for (const roof of plan.roofs) {
      if (!boundsValid(roof.bounds) || !Number.isFinite(roof.elevation)) {
        fail(`roof:${roof.id}`);
      }
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
    /**
     *
     * @param {AuthoredCastleOpening} opening
     */
    const matchesEntranceOpening = (opening) =>
      opening.kind === "door" && opening.side === plan.entrance.side && opening.offset === plan.entrance.offset &&
      opening.width === plan.entrance.width;
    if (!entrance || !boundsValid(plan.entrance.bridge) || !entrance.openings.some(matchesEntranceOpening)) {
      fail("entrance");
    }
  }
}
