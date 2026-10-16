import { Vec2 } from "playcanvas";
import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { castleStraightStairSurfaces } from "../../../../objects/castle/stairs/CastleStraightStairs.js";

/**
 * A stair is a vertical connecting subroom, created after both endpoints exist.
 */
export class StairwellRoomGenerator extends AbstractCastleRoomGenerator {
  /**
   * @param {string} id
   */
  constructor(id) {
    super(id, new Vec2(3, 3), new Vec2(3, 3));
  }

  /**
   * Storage belongs only in supported, low-headroom pockets below the turning slab.
   * Upper floor voids and both flight approaches must remain empty.
   * @param {{authoredStairs:Array,walkableAreas:Array,origin:{yaw:number},furniture:Array}} plan
   * @param {string|number} seed
   * @returns {Array}
   */
  static furnishPockets(plan, seed) {
    const items = [];
    for (const stair of plan.authoredStairs) {
      const firstItem = items.length;
      if (!stair.straight) {
        continue;
      }
      /**
       * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
       */
      const containsUnfurnishedStair = room => room.furnish === false && room.floorY === stair.center.y &&
        stair.localCenter.x >= room.minX && stair.localCenter.x <= room.maxX &&
        stair.localCenter.z >= room.minZ && stair.localCenter.z <= room.maxZ;
      if (plan.spaces?.some(containsUnfurnishedStair)) {
        continue;
      }
      const turning = castleStraightStairSurfaces(stair)[1];
      if (turning.high < 1.2 || turning.maxZ - turning.minZ < 0.65) {
        continue;
      }
      let state = 2166136261;
      for (const character of `${seed}:${stair.id}:storage`) {
        state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
      }
      const angle = (stair.yaw - plan.origin.yaw) * Math.PI / 180;
      const cosine = Math.round(Math.cos(angle)), sine = Math.round(Math.sin(angle));
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

        return state / 4294967296;
      };
      // Keep a continuous walkable strip against the central stair divider.
      const slots = [-1.26, 1.14];
      const rowScales = [0.92 + random() * 0.06, 0.92 + random() * 0.06, 0.92 + random() * 0.06];
      const placements = [];
      for (const slot of slots) {
        for (const row of [0, 1, 2]) {
          placements.push({
            slot,
            row,
          });
        }
      }
      for (const { slot, row } of placements) {
        const across = sine < 0 ? -slot : slot;
        const outer = Math.abs(slot) > 1;
        if (row === 2 && across < 0) {
          continue;
        }
        const maxScale = 1;
        const half = 0.302;
        const tiers = outer ? (row === 2 ? 3 : 2) : (row === 1 && across > 0 ? 2 : 1);
        if (across - half < turning.minX || across + half > turning.maxX) {
          continue;
        }
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const along = [-0.91, -0.33, 0.25][row];
        const x = stair.localCenter.x + across * cosine + along * sine;
        const z = stair.localCenter.z - across * sine + along * cosine;
        const floorY = stair.center.y;
        // The grounded crate measures 0.55 × 0.4702 × 0.549 metres.
        /**
         * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
         */
        const containsCrateFootprint = area => area.floorY === floorY && x - half >= area.minX && x + half <= area.maxX &&
          z - half >= area.minZ && z + half <= area.maxZ;
        if (!plan.walkableAreas.some(containsCrateFootprint)) {
          continue;
        }
        const joinedBase = row !== 1;
        let y = 0.002 + (!outer && joinedBase ? 0.4702 * rowScales[row] * 0.7 : 0);
        const surface = castleStraightStairSurfaces(stair)[across < 0 ? 0 : 2];
        const progress = Math.max(0, Math.min(1, (along + (surface.reverse ? half : -half) -
          surface.minZ) / (surface.maxZ - surface.minZ)));
        const ceiling = row === 0 ? turning.high - 0.3 : surface.low +
          (surface.reverse ? 1 - progress : progress) * (surface.high - surface.low) - 0.3;
        for (let tier = 0; tier < tiers; tier++) {
          const scale = rowScales[row] * maxScale;
          const broadBase = outer && joinedBase && tier === 0;
          const authoredHeight = broadBase ? 0.32914 : 0.4702;
          const height = authoredHeight * scale;
          if (y + height > ceiling) {
            break;
          }
          // Smaller boxes turn freely; larger boxes keep their corners inside the pocket.
          const envelope = 0.55;
          const turn = 45 - Math.acos(Math.min(1, envelope / (0.55 * scale * Math.SQRT2))) * 180 / Math.PI;
          const yaw = broadBase ? 0 : (random() - 0.5) * 2 * turn;
          const radians = yaw * Math.PI / 180;
          const footprint = 0.55 * scale * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)));
          const stagger = (random() - 0.5) * Math.min(0.03, Math.max(0, 0.604 - footprint));
          const sideways = (random() - 0.5) * Math.min(0.014, Math.max(0, 0.558 - footprint));
          items.push({
            role: "stairwellProp",
            object: broadBase ? "Chest" : "Crate",
            x: x + stagger * sine + sideways * cosine,
            z: z + stagger * cosine - sideways * sine,
            floorY,
            roomId: `under-stair:${stair.id}`,
            width: broadBase ? 0.7 : 0.55,
            depth: 0.55,
            height: authoredHeight,
            scale,
            y,
            rotation: (stair.yaw - plan.origin.yaw) + Math.floor(random() * (broadBase ? 2 : 4)) * (broadBase ? 180 : 90) + yaw + (broadBase && row === 0 ? 90 : 0),
            weathering: 0.45 + random() * 0.35,
            ceiling,
            underStair: true,
            backWallStorage: row === 0,
          });
          y += height;
        }
      }
      // The walking strip ends at the back wall: a low terminal stack closes
      // that dead end without narrowing the route alongside the main pile.
      StairwellRoomGenerator.#addTerminalStack(
        stair,
        cosine,
        sine,
        plan,
        turning,
        items,
        -0.30,
      );
      StairwellRoomGenerator.#addTerminalStack(
        stair,
        cosine,
        sine,
        plan,
        turning,
        items,
        0.24,
      );
      for (const prop of [
        {
          object: "Barrel",
          slot: sine < 0 ? -0.72 : 0.72,
          along: -0.91,
          width: 0.554,
          depth: 0.554,
          height: 0.65,
          scale: 0.8,
          endWallStorage: true,
        },
        {
          object: "Barrel",
          slot: sine < 0 ? -0.72 : 0.72,
          along: -0.33,
          width: 0.554,
          depth: 0.554,
          height: 0.65,
          scale: 0.8,
          endWallStorage: true,
        },
        {
          object: "WaterBucket",
          slot: sine < 0 ? 1.29 : -1.29,
          along: 0.5,
          width: 0.3,
          depth: 0.28,
          height: 0.4,
          scale: 1,
        },
        {
          object: "PotteryJar",
          slot: sine < 0 ? -1.17 : 1.17,
          along: -0.33,
          width: 0.229,
          depth: 0.236,
          height: 0.3,
          scale: 1,
          y: 0.9404 * rowScales[1],
        },
      ]) {
        const across = sine < 0 ? -prop.slot : prop.slot;
        // The barrel's upright bottom pivot becomes one end after laying it down.
        // Offset that end so the horizontal barrel stays centred in its reserved slot.
        const along = prop.along + (prop.tilt ? 0.325 * prop.scale : 0);
        const x = stair.localCenter.x + across * cosine + along * sine;
        const z = stair.localCenter.z - across * sine + along * cosine;
        const half = Math.max(prop.width, prop.depth) * prop.scale / 2;
        /**
         * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
         */
        const containsPropFootprint = area => area.floorY === stair.center.y && x - half >= area.minX && x + half <= area.maxX &&
          z - half >= area.minZ && z + half <= area.maxZ;
        if (!plan.walkableAreas.some(containsPropFootprint)) {
          continue;
        }
        items.push({
          ...prop,
          role: "stairwellProp",
          x,
          z,
          floorY: stair.center.y,
          roomId: `under-stair:${stair.id}`,
          y: 0.002 + (prop.y ?? 0) + (prop.tilt ? 0.277 * prop.scale : 0),
          rotation: stair.yaw - plan.origin.yaw + (prop.tilt || prop.object === "Barrel" ? 0 : random() * 360),
          weathering: 0.6,
          underStair: true,
        });
      }
      // Fill the small rear pocket beside the barrel without extending storage
      // into the stair approach. These boxes form one supported low stack.
      const pocketAcross = 0.18;
      const pocketAlong = -0.91;
      const pocketScale = 0.65;
      const pocketSupported = items.length > firstItem;
      for (let tier = 0; pocketSupported && tier < 2; tier++) {
        items.push({
          role: "stairwellProp",
          object: "Crate",
          x: stair.localCenter.x + pocketAcross * cosine + pocketAlong * sine,
          z: stair.localCenter.z - pocketAcross * sine + pocketAlong * cosine,
          floorY: stair.center.y,
          roomId: `under-stair:${stair.id}`,
          width: 0.55,
          depth: 0.5502,
          height: 0.4702,
          scale: pocketScale,
          y: 0.002 + tier * 0.4702 * pocketScale,
          rotation: stair.yaw - plan.origin.yaw,
          weathering: 0.55,
          ceiling: turning.high - 0.3,
          underStair: true,
          endWallStorage: true,
          backPocketStorage: true,
        });
      }
      // Seat the measured footprint against the room's inner wall face.
      // Each tier keeps its own clearance rather than sharing a fixed centre.
      for (const item of items.slice(firstItem)) {
        const area = plan.walkableAreas.find(/**
         * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number,kind?:string}} candidate
         */ candidate => candidate.kind === "room" && candidate.floorY === item.floorY &&
          item.x >= candidate.minX && item.x <= candidate.maxX &&
          item.z >= candidate.minZ && item.z <= candidate.maxZ);
        if (!area) {
          continue;
        }
        const yaw = (item.rotation - stair.yaw + plan.origin.yaw) * Math.PI / 180;
        const circular = item.object === "PotteryJar";
        const halfAcross = item.scale / 2 * (item.tilt ? item.width : circular ? Math.max(item.width, item.depth) :
          item.width * Math.abs(Math.cos(yaw)) + item.depth * Math.abs(Math.sin(yaw)));
        const halfAlong = item.scale / 2 * (item.tilt ? item.depth : circular ? Math.max(item.width, item.depth) :
          item.width * Math.abs(Math.sin(yaw)) + item.depth * Math.abs(Math.cos(yaw)));
        const across = (item.x - stair.localCenter.x) * cosine - (item.z - stair.localCenter.z) * sine;
        const along = (item.x - stair.localCenter.x) * sine + (item.z - stair.localCenter.z) * cosine;
        const acrossLow = cosine === 0 ? (sine > 0 ? stair.localCenter.z - area.maxZ : area.minZ - stair.localCenter.z) :
          (cosine > 0 ? area.minX - stair.localCenter.x : stair.localCenter.x - area.maxX);
        const acrossHigh = cosine === 0 ? (sine > 0 ? stair.localCenter.z - area.minZ : area.maxZ - stair.localCenter.z) :
          (cosine > 0 ? area.maxX - stair.localCenter.x : stair.localCenter.x - area.minX);
        const alongLow = sine === 0 ? (cosine > 0 ? area.minZ - stair.localCenter.z : stair.localCenter.z - area.maxZ) :
          (sine > 0 ? area.minX - stair.localCenter.x : stair.localCenter.x - area.maxX);
        const acrossAxis = cosine === 0 ? "z" : "x";
        const alongAxis = sine === 0 ? "z" : "x";
        const acrossSign = cosine || -sine;
        const alongSign = sine || cosine;
        item.stairApproach = {
          axis: alongAxis,
          coordinate: stair.localCenter[alongAxis] + 0.75 * alongSign,
          side: alongSign > 0 ? "max" : "min",
        };
        // Carry the eligible exterior faces into collision repair. Otherwise
        // its nearest-position rule can undo the wall seating performed here.
        item.wallAlignment = [
          {
            axis: acrossAxis,
            coordinate: stair.localCenter[acrossAxis] + acrossLow * acrossSign,
            side: acrossSign > 0 ? "min" : "max",
          },
          {
            axis: acrossAxis,
            coordinate: stair.localCenter[acrossAxis] + acrossHigh * acrossSign,
            side: acrossSign > 0 ? "max" : "min",
          },
          {
            axis: alongAxis,
            coordinate: stair.localCenter[alongAxis] + alongLow * alongSign,
            side: alongSign > 0 ? "min" : "max",
          },
        ];
        if (item.backPocketStorage) {
          item.wallAlignment = item.wallAlignment.slice(2);
        }
        // All three enclosing walls are eligible; the central flight divider
        // is deliberately absent. Keep the open stair approach unoccupied.
        const wallSeats = [
          {
            across: acrossLow + halfAcross + 0.02,
            along,
          },
          {
            across: acrossHigh - halfAcross - 0.02,
            along,
          },
          {
            across,
            along: alongLow + halfAlong + 0.02,
          },
        ];
        if (item.backPocketStorage) {
          wallSeats.splice(0, 2);
        }
        wallSeats.sort(/**
         * @param {{across:number,along:number}} first
         * @param {{across:number,along:number}} second
         */
          (first, second) => Math.hypot(first.across - across, first.along - along) -
          Math.hypot(second.across - across, second.along - along));
        const { across: seatedAcross, along: seatedAlong } = wallSeats[0];
        item.x += (seatedAcross - across) * cosine + (seatedAlong - along) * sine;
        item.z += -(seatedAcross - across) * sine + (seatedAlong - along) * cosine;
        if (item.stackedBarrel) {
          const support = items
            .slice(firstItem)
            .find(StairwellRoomGenerator.#findCandidate);
          if (support) {
            item.x = support.x + 0.325 * item.scale * sine + 0.03 * sine;
            item.z = support.z + 0.325 * item.scale * cosine + 0.03 * cosine;
          }
        }
      }
    }

    return items;
  }

  /**
   * Decorate the host walls, never the shaft or its turning/approach envelope.
   * Measured lantern bounds are 0.160 × 0.600 × 0.260 metres.
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,stairs:Array,openings:Array,occupied?:Array}} context
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {
    stairs: [],
    openings: [],
  }) {
    if (!context.stairs.length || room.height < 2.5 || room.purpose === "Library") {
      return [];
    }
    let state = 2166136261;
    for (const character of `${context.seed ?? 0}:${room.id}:${room.level}:stairwell`) {
      state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    /**
     * @returns {number}
     */
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

      return state / 4294967296;
    };
    const candidates = [];
    // The south host boundary can contain a doubled inward partition course.
    // Its slot boundary is not a verified mounting plane; leave it untouched.
    for (const side of ["WEST", "EAST", "NORTH"]) {
      const alongX = side === "NORTH" || side === "SOUTH";
      const low = alongX ? room.minX : room.minZ;
      const high = alongX ? room.maxX : room.maxZ;
      for (let along = low + 0.6; along < high - 0.6; along += 0.55) {
        along += random() * 0.08;
        const x = alongX ? along : side === "WEST" ? room.minX + 0.125 : room.maxX - 0.125;
        const z = !alongX ? along : side === "NORTH" ? room.minZ + 0.125 : room.maxZ - 0.125;
        const width = alongX ? 0.16 : 0.26;
        const depth = alongX ? 0.26 : 0.16;
        // Reserve the entire shaft plus extra approach/headroom clearance.
        /**
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} stair
         */
        const overlapsStairClearance = stair => x + width / 2 > stair.minX - 0.4 &&
          x - width / 2 < stair.maxX + 0.4 && z + depth / 2 > stair.minZ - 0.4 &&
          z - depth / 2 < stair.maxZ + 0.4;
        if (context.stairs.some(overlapsStairClearance)) {
          continue;
        }
        /**
         * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
         */
        const blocksOpening = opening => opening.roomId === room.id &&
          opening.floorY === room.floorY && opening.side === side &&
          Math.abs(along - opening.center) < opening.width / 2 + 0.4;
        if (context.openings.some(blocksOpening)) {
          continue;
        }
        /**
         * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
         */
        const overlapsOccupiedItem = item => Math.abs(x - item.x) < item.width * item.scale / 2 + width / 2 + 0.25 &&
          Math.abs(z - item.z) < item.depth * item.scale / 2 + depth / 2 + 0.25;
        if ((context.occupied ?? []).some(overlapsOccupiedItem)) {
          continue;
        }
        candidates.push({
          role: "stairwellProp",
          object: "Lantern",
          properties: {type: "wall"},
          x,
          z,
          width,
          depth,
          scale: 1,
          y: 1.75 + random() * 0.1,
          rotation: {
            NORTH: 0,
            SOUTH: 180,
            WEST: 90,
            EAST: 270,
          }[side],
        });
      }
    }
    const items = [];
    const count = random() < 0.35 ? 2 : 1;
    while (candidates.length && items.length < count) {
      const [item] = candidates.splice(Math.floor(random() * candidates.length), 1);
      /**
       * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} other
       */
      const isTooCloseToItem = other => Math.hypot(item.x - other.x, item.z - other.z) < 1.3;
      if (items.some(isTooCloseToItem)) {
        continue;
      }
      items.push(item);
    }
    // A grounded candle stand fits only a broad host's unused north-west corner.
    // No shelf/table is invented in the narrow landing strip.
    const candleX = room.minX + 0.24;
    const candleZ = room.minZ + 0.32;
    /**
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} stair
     */
    const blocksCandleStairClearance = stair => candleX > stair.minX - 0.75 && candleX < stair.maxX + 0.75 &&
        candleZ > stair.minZ - 0.75 && candleZ < stair.maxZ + 0.75;
    /**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     */
    const blocksCandleOpening = opening => opening.roomId === room.id && opening.floorY === room.floorY &&
        (opening.axis === "x" ? Math.abs(candleX - opening.coordinate) < 0.85 &&
          Math.abs(candleZ - opening.center) < opening.width / 2 + 0.4 :
          Math.abs(candleZ - opening.coordinate) < 0.85 && Math.abs(candleX - opening.center) < opening.width / 2 + 0.4);
    /**
     * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
     */
    const overlapsCandlePlacement = item => Math.abs(candleX - item.x) < item.width * item.scale / 2 + 0.5 &&
        Math.abs(candleZ - item.z) < item.depth * item.scale / 2 + 0.5;
    if (room.maxX - room.minX >= 6 && room.maxZ - room.minZ >= 3 && random() < 0.6 &&
      !context.stairs.some(blocksCandleStairClearance) &&
      !context.openings.some(blocksCandleOpening) &&
      !(context.occupied ?? []).some(overlapsCandlePlacement)) {
      items.push({
        role: "stairwellProp",
        object: "CandleStand",
        properties: {variant: "single"},
        x: candleX,
        z: candleZ,
        width: 0.173,
        depth: 0.173,
        scale: 1,
        y: 0.002,
        rotation: random() * 360,
      });
    }
    return items;
  }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom|null} from
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom|null} to
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
   * @returns {{id:string,fromRoomId:string,toRoomId:string,fromLevel:number,toLevel:number,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,height:number,ceilingY:number}|null}
   */
  connect(from, to, bounds) {
    if (!from || !to || from.floorY >= to.floorY ||
      bounds.maxX - bounds.minX < this.min.x || bounds.maxZ - bounds.minZ < this.min.y) {
      return null;
    }
    return {
      ...bounds,
      id: this.id,
      fromRoomId: from.id,
      toRoomId: to.id,
      fromLevel: from.level,
      toLevel: to.level,
      floorY: from.floorY,
      height: to.floorY - from.floorY,
      ceilingY: to.floorY + 2.25,
    };
  }

  /**
   * @param {{object:string,tilt?:object}} candidate
   */
  static #findCandidate(candidate) {
    return candidate.object === "Barrel" && !candidate.tilt;
  }

  /**
   * @param {{id:string,localCenter:{x:number,z:number},center:{y:number},yaw:number}} stair
   * @param {number} cosine
   * @param {number} sine
   * @param {{walkableAreas:Array<{minX:number,maxX:number,minZ:number,maxZ:number}&{floorY:number}>,origin:{yaw:number}}} plan
   * @param {{high:number}} turning
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem[]} items
   * @param {number} across
   */
  static #addTerminalStack(
    stair,
    cosine,
    sine,
    plan,
    turning,
    items,
    across,
  ) {
    const along = -0.91;
    const x = stair.localCenter.x + across * cosine + along * sine;
    const z = stair.localCenter.z - across * sine + along * cosine;
    const half = 0.3;
    /**
     * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
     */
    const containsTerminalStackFootprint = area => area.floorY === stair.center.y &&
      x - half >= area.minX && x + half <= area.maxX &&
      z - half >= area.minZ && z + half <= area.maxZ;
    if (!plan.walkableAreas.some(containsTerminalStackFootprint)) {
      return;
    }
    let y = 0.002;
    for (const prop of [
      {
        object: "Chest",
        width: 0.7,
        depth: 0.55,
        height: 0.32914,
        scale: 0.84,
      },
      {
        object: "Crate",
        width: 0.55,
        depth: 0.55,
        height: 0.4702,
        scale: 0.9,
      },
      {
        object: "PotteryJar",
        width: 0.229,
        depth: 0.236,
        height: 0.3,
        scale: 1,
      },
    ]) {
      if (y + prop.height * prop.scale > turning.high - 0.3) {
        break;
      }
      const offset = prop.object === "PotteryJar" ? 0.055 : 0;
      items.push({
        ...prop,
        role: "stairwellProp",
        x: x + offset * sine,
        z: z + offset * cosine,
        floorY: stair.center.y,
        roomId: `under-stair:${stair.id}`,
        y,
        rotation: stair.yaw - plan.origin.yaw + (across < 0 ? 180 : 0) + (prop.object === "Chest" ? 90 : 0),
        weathering: 0.65,
        ceiling: turning.high - 0.3,
        underStair: true,
        endWallStorage: true,
      });
      y += prop.height * prop.scale;
    }
  }
}
