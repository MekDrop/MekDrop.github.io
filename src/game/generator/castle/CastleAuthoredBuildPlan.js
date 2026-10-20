import { RoomPlacementRules } from "./rooms/RoomPlacementRules.js";
import { CastleGenerationScheduler } from "./CastleGenerationScheduler.js";
import { CastleBasePlanGenerator } from "./CastleBasePlanGenerator.js";
import { StairwellRoomGenerator } from "./rooms/stairwell/StairwellRoomGenerator.js";
import { SpiralStairStorage } from "./rooms/stairwell/SpiralStairStorage.js";
import { CastleBasePlanInvalidError } from "../../errors/castle/index.js";
import { createCastlePlannedFloorAreas } from "../../objects/castle/structure/CastlePlannedFloorAreas.js";
import { castleStraightStairSurfaces } from "../../objects/castle/stairs/CastleStraightStairs.js";
import { CastleRoundTower } from "./CastleRoundTower.js";

/**
 * Converts a reference plan to the existing castle-owned rendering contract.
 * All opening centres and room slots come from the JSON; only scale/orientation
 * and the two-lane exterior gate width adapt to the map footprint.
 */
export class CastleAuthoredBuildPlan {
  /**
   * @param {{position:{x:number,z:number,width:number,depth:number,elevation?:number},doors:Array<{side:string,offset:number,width:number}>,seed?:string|number,basePlanId:string}} options
   * @returns {Promise<import("../../GameContracts.js").CastleBuildPlan>}
   */
  static async generate(options) {
    const scheduler = options.scheduler ?? new CastleGenerationScheduler({ signal: options.signal });
    scheduler.throwIfAborted();
    const { position, doors } = options;
    if (!position || !doors?.length) {
      throw new CastleBasePlanInvalidError(options.basePlanId, "entrance");
    }
    const side = doors[0].side;
    const transverse = ["WEST", "EAST"].includes(side) ? position.depth : position.width;
    const inward = ["WEST", "EAST"].includes(side) ? position.width : position.depth;
    const envelope = (await CastleBasePlanGenerator.plans).find(/**
     *
     * @param {import("./CastleBasePlanGenerator.js").CastleBasePlan} plan
     */
      (plan) => plan.id === (options.basePlanId ?? CastleBasePlanGenerator.selectPlanId(options.seed)));
    if (!envelope) {
      throw new CastleBasePlanInvalidError(options.basePlanId, "plan id");
    }
    const scale = envelope.coordinates.units === "metres" ? 1
      : Math.min(transverse / (envelope.coordinates.width + 4), inward / (envelope.coordinates.depth + 4));
    if (scale < 0.2) {
      throw new CastleBasePlanInvalidError(options.basePlanId, "walkable footprint (minimum authored scale 0.2 metres)");
    }
    const baseY = position.elevation ?? 3;
    const authored = await CastleBasePlanGenerator.generate({
      planId: options.basePlanId,
      seed: options.seed,
      unitMetres: scale,
      baseY,
    });
    scheduler.throwIfAborted();
    const gate = authored.entrance;
    const along = doors[0].offset + doors[0].width / 2;
    const adaptedDoors = doors.map(/**
     *
     * @param {import("../../GameContracts.js").CastleOpening} door
     */
      door => ({ ...door }));
    const yaw = {
      NORTH: 0,
      SOUTH: 180,
      WEST: 90,
      EAST: -90,
    }[side];
    const centers = {
      NORTH: {
        x: position.x + along,
        z: position.z,
      },
      SOUTH: {
        x: position.x + along,
        z: position.z + position.depth,
      },
      WEST: {
        x: position.x,
        z: position.z + along,
      },
      EAST: {
        x: position.x + position.width,
        z: position.z + along,
      },
    };
    const origin = {
      ...centers[side],
      y: baseY,
      yaw,
    };
    const thickness = 0.25;
    /**
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
     */
    const transform = (bounds) => ({
      minX: gate.center - bounds.maxX,
      maxX: gate.center - bounds.minX,
      minZ: gate.coordinate - bounds.maxZ,
      maxZ: gate.coordinate - bounds.minZ,
    });
    /**
     * @param {number} x
     * @param {number} z
     * @param {number} y
     */
    const world = (x, z, y) => {
      const angle = yaw * Math.PI / 180;

      return {
        x: origin.x + Math.cos(angle) * x + Math.sin(angle) * z,
        y,
        z: origin.z - Math.sin(angle) * x + Math.cos(angle) * z,
      };
    };
    const spaces = [];
    for (const space of authored.spaces) {
      spaces.push({
        ...space,
        ...transform(space),
        wallBounds: transform(space.wallBounds),
      });
    }
    const placedRooms = spaces.filter(CastleAuthoredBuildPlan.#filterSpace);
    const buildings = authored.buildings.map(/**
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} building
     */
      (building) => ({
        ...transform(building),
        floorY: building.floorY,
        height: building.height,
      }));
    const openings = [];
    for (const opening of authored.openings) {
      const entrance = opening.roomId === gate.roomId && opening.floorY === baseY && opening.side === gate.side && opening.kind === "door";
      openings.push({
        ...opening,
        coordinate: (opening.axis === "x" ? gate.center : gate.coordinate) - opening.coordinate,
        center: (opening.axis === "x" ? gate.coordinate : gate.center) - opening.center,
        side: {
          NORTH: "SOUTH",
          SOUTH: "NORTH",
          EAST: "WEST",
          WEST: "EAST",
        }[opening.side],
        width: entrance ? doors[0].width : opening.kind === "door" ? Math.max(0.75, opening.width) : opening.width,
        exteriorEntrance: entrance,
      });
    }
    for (const opening of openings) {
      for (let index = 0; index < buildings.length; index++) {
        const building = buildings[index];
        const source = authored.buildings[index];
        if (opening.floorY < source.floorY || opening.floorY >= source.floorY + source.height) {
          continue;
        }
        const boundary = opening.axis === "x"
          ? (opening.side === "WEST" ? building.minX : building.maxX)
          : (opening.side === "NORTH" ? building.minZ : building.maxZ);
        if (Math.abs(opening.coordinate - boundary) <= thickness * 1.1) {
          opening.coordinate = boundary;
        }
      }
    }
    const exteriorOpening = openings.find(/**
     *
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening & {exteriorEntrance:boolean}} opening
     */
      opening => opening.exteriorEntrance);
    if (exteriorOpening?.axis === "z") {
      // Exterior masonry projects beyond the footprint. Align the final
      // half-metre tread to the door plane, not the original grid boundary.
      adaptedDoors[0].stairBoundaryOffset = -exteriorOpening.coordinate;
    }
    const rooms = Object.fromEntries(
      placedRooms.map(CastleAuthoredBuildPlan.#mapRoom),
    );
    rooms.work = rooms["throne-hall"];
    if (envelope.audienceBounds) {
      const [x, z, width, depth] = envelope.audienceBounds;
      rooms.work = {
        ...rooms.work,
        ...transform({
          minX: x,
          maxX: x + width,
          minZ: z,
          maxZ: z + depth,
        }),
      };
    }
    rooms.bedroom = rooms["royal-chamber"] ?? rooms.work;
    rooms.service = rooms["service-quarters"] ?? rooms.kitchen ?? rooms.armory ?? rooms.work;
    rooms.servantBedroom = rooms.service;
    rooms.storage = rooms.service;
    rooms.balcony = {
      ...rooms.bedroom,
      purpose: "unused",
    };
    const furniture = authored.furniture.map(/**
     * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId:string,floorY:number}} item
     */
      (item) => ({
        ...item,
        x: gate.center - item.x,
        z: gate.coordinate - item.z,
      }));
    const stairs = [];
    for (const shaft of authored.stairs) {
      const bounds = transform(shaft);
      const x = (bounds.minX + bounds.maxX) / 2;
      const z = (bounds.minZ + bounds.maxZ) / 2;
      const radius = shaft.radius ?? Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 - 0.05;
      for (let level = shaft.from; level < shaft.to; level++) {
        const floorY = baseY + level * authored.floorHeight;
        const doors = openings.filter(/**
         *
         * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
         */
          opening => opening.kind === "door" && opening.floorY === floorY);
        const nearest = doors.reduce(/**
         *
         * @param {{door:import("./CastleBasePlanGenerator.js").CompiledCastleOpening,dx:number,dz:number,distance:number}|null} best
         * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} door
         */
          (best, door) => {
            const dx = (door.axis === "x" ? door.coordinate : door.center) - x;
            const dz = (door.axis === "z" ? door.coordinate : door.center) - z;
            const distance = dx * dx + dz * dz;

            return !best || distance < best.distance ? {
              door,
              dx,
              dz,
              distance,
            } : best;
          }, null);
        const entryYaw = shaft.entrySide ? {
          WEST: 90,
          EAST: -90,
          NORTH: 0,
          SOUTH: 180,
        }[shaft.entrySide] : nearest ? Math.round(Math.atan2(nearest.dx, nearest.dz) * 180 / Math.PI / 90) * 90 : (x < 0 ? 180 : 0);
        const flightGap = shaft.flightGap ?? 0;
        const flightShift = shaft.flightShift ?? 0;
        const entryAngle = entryYaw * Math.PI / 180;
        const cosine = Math.round(Math.cos(entryAngle)), sine = Math.round(Math.sin(entryAngle));
        let flightMin = -Infinity, flightMax = Infinity, landingBack = -Infinity;
        for (const room of placedRooms) {
          if (!flightGap || (room.floorY !== floorY && room.floorY !== floorY + authored.floorHeight) ||
              x < room.minX || x > room.maxX || z < room.minZ || z > room.maxZ) {
            continue;
          }
          let roomMin = Infinity, roomMax = -Infinity, roomBack = Infinity;
          for (const [rx, rz] of [[room.minX, room.minZ], [room.minX, room.maxZ], [room.maxX, room.minZ], [room.maxX, room.maxZ]]) {
            const lateral = (rx - x) * cosine - (rz - z) * sine;
            roomBack = Math.min(roomBack, (rx - x) * sine + (rz - z) * cosine);
            roomMin = Math.min(roomMin, lateral);
            roomMax = Math.max(roomMax, lateral);
          }
          // Recess tread ends half a masonry course into the wall to cover
          // the imported stone edge bevels and the wall joints.
          landingBack = Math.max(landingBack, roomBack - 0.01);
          flightMin = Math.max(flightMin, roomMin - 0.125);
          flightMax = Math.min(flightMax, roomMax + 0.125);
        }
        const flightBounds = Number.isFinite(flightMin) && Number.isFinite(flightMax)
          ? {
            minX: flightMin,
            maxX: flightMax,
            inner: 0.12,
          } : undefined;
        const min = flightBounds?.minX ?? -radius - flightGap / 2;
        const max = flightBounds?.maxX ?? radius + flightGap / 2;
        const stairBounds = {
          ...bounds,
          minX: Math.min(bounds.minX, x + Math.min(min * cosine, max * cosine) - radius * Math.abs(sine) - 0.025),
          maxX: Math.max(bounds.maxX, x + Math.max(min * cosine, max * cosine) + radius * Math.abs(sine) + 0.025),
          minZ: Math.min(bounds.minZ, z + Math.min(-min * sine, -max * sine) - radius * Math.abs(cosine) - 0.025),
          maxZ: Math.max(bounds.maxZ, z + Math.max(-min * sine, -max * sine) + radius * Math.abs(cosine) + 0.025),
        };
        stairBounds.minX += Math.min(0, flightShift * sine);
        stairBounds.maxX += Math.max(0, flightShift * sine);
        stairBounds.minZ += Math.min(0, flightShift * cosine);
        stairBounds.maxZ += Math.max(0, flightShift * cosine);
        // The turning platform reaches farther back than the flight radius.
        // Cut floors through that rear edge, including the masonry overlap,
        // or each storey leaves a narrow shelf projecting from the shaft wall.
        const turning = castleStraightStairSurfaces({
          radius,
          rise: authored.floorHeight,
          flightGap,
          flightShift,
          flightBounds,
          landingBack: Number.isFinite(landingBack) ? landingBack : undefined,
        })[1];
        for (const [across, along] of [[turning.minX, turning.minZ], [turning.maxX, turning.minZ]]) {
          const rearX = x + across * cosine + along * sine;
          const rearZ = z - across * sine + along * cosine;
          stairBounds.minX = Math.min(stairBounds.minX, rearX);
          stairBounds.maxX = Math.max(stairBounds.maxX, rearX);
          stairBounds.minZ = Math.min(stairBounds.minZ, rearZ);
          stairBounds.maxZ = Math.max(stairBounds.maxZ, rearZ);
        }
        stairs.push({
          landingLift: shaft.landingLift ?? 0,
          localCenter: {
            x,
            z,
          },
          flightShift,
          id: `${shaft.id}:${level}`,
          straight: true,
          flightGap,
          flightBounds,
          landingBack: Number.isFinite(landingBack) ? landingBack : undefined,
          shaft: stairBounds,
          center: world(x, z, floorY),
          radius,
          rise: authored.floorHeight,
          steps: 24,
          turns: shaft.landingProfile === false ? 1 : 1.5,
          landingProfile: shaft.landingProfile ?? true,
          entryDoorId: nearest?.door.roomId,
          exitDirection: 1,
          yaw: yaw + entryYaw,
        });
      }
    }
    const walkableAreas = [];
    for (const space of spaces) {
      if (space.kind !== "void") {
        walkableAreas.push({
          ...space,
          bounds: { ...space },
          id: space.id,
        });
      }
    }
    for (const opening of openings) {
      if (opening.kind !== "door") {
        continue;
      }
      walkableAreas.push({
        id: `doorThreshold:${opening.roomId}:${opening.side}`,
        floorY: opening.floorY,
        minX: opening.axis === "x" ? opening.coordinate - 0.5 : opening.center - opening.width / 2,
        maxX: opening.axis === "x" ? opening.coordinate + 0.5 : opening.center + opening.width / 2,
        minZ: opening.axis === "z" ? opening.coordinate - 0.5 : opening.center - opening.width / 2,
        maxZ: opening.axis === "z" ? opening.coordinate + 0.5 : opening.center + opening.width / 2,
      });
    }
    const outerBounds = {
      minX: gate.center - authored.width,
      maxX: gate.center,
      minZ: 0,
      maxZ: gate.coordinate,
    };
    const residential = {
      version: 2,
      basePlanId: authored.basePlanId,
      origin,
      rooms,
      spaces,
      placedRooms,
      openings,
      doorways: openings.filter(CastleAuthoredBuildPlan.#filterOpening),
      furniture,
      rise: authored.floorHeight,
      floorHeight: authored.floorHeight,
      walkableAreas,
      authoredStairs: stairs,
      stair: null,
      serviceStair: null,
      basement: null,
      reservations: {
        throne: {
          ...rooms.work,
          minY: 0,
          maxY: rooms.work.height,
        },
      },
      outerBounds,
      buildings,
      gatehouseDepth: 0,
      skippedRooms: [],
      subrooms: [],
      roomRequirements: [],
      shaft: stairs[0]?.shaft,
      stairHostRoomId: null,
    };
    for (const roof of authored.roofs) {
      if (roof.shape === "flat") {
        residential.walkableAreas.push({
          ...transform(roof),
          id: `roof:${roof.id}`,
          floorY: roof.y,
        });
      }
    }
    if (authored.roofAccess) {
      const hole = transform(authored.roofAccess);
      residential.roofAccess = {
        hole,
        rotation: yaw + 180 + authored.roofAccess.rotation,
        position: world(gate.center - authored.roofAccess.position.x, gate.coordinate - authored.roofAccess.position.z, authored.roofAccess.position.y),
        bottom: world(gate.center - authored.roofAccess.bottom.x, gate.coordinate - authored.roofAccess.bottom.z, authored.roofAccess.bottom.y),
        top: world(gate.center - authored.roofAccess.top.x, gate.coordinate - authored.roofAccess.top.z, authored.roofAccess.top.y),
      };
      residential.walkableAreas = residential.walkableAreas.flatMap(
        /**
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,id:string}} area
         */
        (area) => {
          if (area.floorY !== authored.roofAccess.top.y) {
            return [area];
          }
          const left = Math.max(area.minX, hole.minX), right = Math.min(area.maxX, hole.maxX);
          const front = Math.max(area.minZ, hole.minZ), rear = Math.min(area.maxZ, hole.maxZ);
          if (right <= left || rear <= front) {
            return [area];
          }
          return [{
            ...area,
            maxX: left,
          }, {
            ...area,
            minX: right,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            maxZ: front,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            minZ: rear,
          }]
            .filter(CastleAuthoredBuildPlan.#filterPart);
        },
      );
    }
    for (const building of authored.buildings) {
      // Upper rooms need the same continuous structural floor as the ground
      // level, including the wall thickness around their doorways.
      const levels = new Set(
        spaces.filter(/**
                                            * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
                                            */
          space => space.kind !== "void" &&
        space.floorY > baseY && space.floorY < building.floorY + building.height &&
        space.minX >= gate.center - building.maxX && space.maxX <= gate.center - building.minX &&
        space.minZ >= gate.coordinate - building.maxZ && space.maxZ <= gate.coordinate - building.minZ)
          .map(CastleAuthoredBuildPlan.#mapSpace),
      );
      for (const floorY of levels) {
        residential.walkableAreas.push({
          ...transform(building),
          id: `upper-slab:${building.id}:${floorY}`,
          floorY,
        });
      }
      if (building.floorY < baseY) {
        // Basement room finishes stop short of the exterior wall. A continuous
        // foundation slab covers those perimeter seams and partition gaps.
        residential.walkableAreas.push({
          ...transform(building),
          id: `basement-slab:${building.id}`,
          floorY: building.floorY,
        });
      }
      if (building.floorY <= baseY && building.floorY + building.height > baseY) {
        // Room interiors omit partition thickness and circulation seams. The
        // building owns a continuous ground slab before cutting stair openings.
        residential.walkableAreas.push({
          ...transform(building),
          id: `ground-slab:${building.id}`,
          floorY: baseY,
        });
      }
      if (building.id === "base") {
        const floorY = building.floorY + building.height;
        const baseBounds = transform(building);
        residential.walkableAreas = residential.walkableAreas.filter(/**
         * @param {{floorY:number}} area
         */
          (area) => area.floorY !== floorY || area.minX < baseBounds.minX || area.maxX > baseBounds.maxX ||
          area.minZ < baseBounds.minZ || area.maxZ > baseBounds.maxZ);
        residential.walkableAreas.push({
          ...transform(building),
          id: "base-ceiling",
          floorY,
        });
      }
    }
    // Keep both straight flights open; only the top approach owns a slab.
    for (const stair of stairs) {
      const shaft = stair.shaft;
      const topY = stair.center.y + stair.rise;
      residential.walkableAreas = residential.walkableAreas.flatMap(
        /**
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,id:string}} area
         */ (area) => {
          if (area.floorY !== topY) {
            return [area];
          }
          const left = Math.max(area.minX, shaft.minX), right = Math.min(area.maxX, shaft.maxX);
          const front = Math.max(area.minZ, shaft.minZ), rear = Math.min(area.maxZ, shaft.maxZ);
          if (right <= left || rear <= front) {
            return [area];
          }
          return [{
            ...area,
            maxX: left,
          }, {
            ...area,
            minX: right,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            maxZ: front,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            minZ: rear,
          }]
            .filter(CastleAuthoredBuildPlan.#filterPiece);
        },
      );
      const angle = (stair.yaw - yaw) * Math.PI / 180;
      const cosine = Math.round(Math.cos(angle)), sine = Math.round(Math.sin(angle));
      const cx = stair.localCenter.x, cz = stair.localCenter.z;
      const r = stair.radius + (stair.flightShift ?? 0), landing = Math.min(0.15, r * 0.1);
      const width = stair.radius + (stair.flightGap ?? 0) / 2;
      const min = stair.flightBounds?.minX ?? -width, max = stair.flightBounds?.maxX ?? width;
      const corners = [[min, r - landing], [max, r - landing], [min, r + 0.05], [max, r + 0.05]].map(/**
       * @param {number[]} point
       */ point => ({
          x: cx + point[0] * cosine + point[1] * sine,
          z: cz - point[0] * sine + point[1] * cosine,
        }));
      residential.walkableAreas.push({
        id: stair.id + ':straightLanding',
        floorY: topY,
        minX: Math.min(...corners.map(CastleAuthoredBuildPlan.#mapPoint)),
        maxX: Math.max(...corners.map(CastleAuthoredBuildPlan.#mapPoint2)),
        minZ: Math.min(...corners.map(CastleAuthoredBuildPlan.#mapPoint3)),
        maxZ: Math.max(...corners.map(CastleAuthoredBuildPlan.#mapPoint4)),
      });
    }
    // Thresholds on the lowest floor also need a single surface owner.
    residential.walkableAreas = createCastlePlannedFloorAreas({
      metadata: {
        runtime: {
          residential: {
            ...residential,
            basePlanId: undefined,
            stair: null,
            serviceStair: null,
            rooms: {},
            doorways: [],
          },
        },
      },
    });
    // Thresholds on the lowest floor also need a single surface owner.
    residential.walkableAreas = createCastlePlannedFloorAreas({
      metadata: {
        runtime: {
          residential: {
            ...residential,
            basePlanId: undefined,
            stair: null,
            serviceStair: null,
            rooms: {},
            doorways: [],
          },
        },
      },
    });
    // Remove every upper void after thresholds and stair landings are compiled.
    for (const space of spaces.filter(CastleAuthoredBuildPlan.#filterSpace2)) {
      residential.walkableAreas = residential.walkableAreas.flatMap(
        /**
         * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
         */ (area) => {
          if (area.floorY !== space.floorY) {
            return [area];
          }
          const a = Math.max(area.minX, space.minX);
          const b = Math.min(area.maxX, space.maxX);
          const c = Math.max(area.minZ, space.minZ);
          const d = Math.min(area.maxZ, space.maxZ);
          if (b <= a || d <= c) {
            return [area];
          }
          return [{
            ...area,
            maxX: a,
          }, {
            ...area,
            minX: b,
          },
          {
            ...area,
            minX: a,
            maxX: b,
            maxZ: c,
          }, {
            ...area,
            minX: a,
            maxX: b,
            minZ: d,
          }]
            .filter(CastleAuthoredBuildPlan.#filterPiece2);
        },
      );
    }
    const geometry = {
      boxes: [],
      decorations: {
        flames: [],
        banners: [],
        flags: [],
        roofs: [],
      },
    };
    const cameraBlocks = [];
    const groundColumns = [];
    const uniqueBoxes = new Set();
    /**
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}} bounds
     * @param {string} material
     */
    const emitBox = (bounds, material = "castleStoneMid") => {
      if (bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ || bounds.maxY <= bounds.minY) {
        return;
      }
      const point = world((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, (bounds.minY + bounds.maxY) / 2);
      const crosswise = ["WEST", "EAST"].includes(side);
      const sx = crosswise ? bounds.maxZ - bounds.minZ : bounds.maxX - bounds.minX;
      const sz = crosswise ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ;
      const sy = bounds.maxY - bounds.minY;
      const key = [point.x, point.y, point.z, sx, sy, sz].map(CastleAuthoredBuildPlan.#mapValue)
        .join(":");
      if (uniqueBoxes.has(key)) {
        return;
      }
      uniqueBoxes.add(key);
      // The gate's quarter-metre masonry vocabulary, instanced by material.
      for (let y = Math.floor(bounds.minY * 4 + 1e-6) / 4; y < bounds.maxY - 1e-6; y += 0.25) {
        for (let x = Math.floor(bounds.minX * 4 + 1e-6) / 4; x < bounds.maxX - 1e-6; x += 0.25) {
          for (let z = Math.floor(bounds.minZ * 4 + 1e-6) / 4; z < bounds.maxZ - 1e-6; z += 0.25) {
            const left = Math.max(x, bounds.minX);
            const bottom = Math.max(y, bounds.minY);
            const front = Math.max(z, bounds.minZ);
            const bx = Math.min(x + 0.25, bounds.maxX) - left;
            const by = Math.min(y + 0.25, bounds.maxY) - bottom;
            const bz = Math.min(z + 0.25, bounds.maxZ) - front;
            const brick = world(left + bx / 2, front + bz / 2, bottom + by / 2);
            const hash = Math.imul(Math.round(x * 4) + 11, 73856093) ^
              Math.imul(Math.round(y * 4) + 17, 19349663) ^ Math.imul(Math.round(z * 4) + 23, 83492791);
            const shade = (hash >>> 0) % 8;
            geometry.boxes.push({
              ...brick,
              sx: crosswise ? bz : bx,
              sy: by,
              sz: crosswise ? bx : bz,
              yaw: 0,
              material: material === "castleStoneMid" && (shade === 0 || shade === 7) ? "castleStoneDark" : material,
            });
          }
        }
      }
      cameraBlocks.push({
        ...point,
        halfX: sx / 2,
        halfY: sy / 2,
        halfZ: sz / 2,
      });
      if (bounds.minY <= baseY && bounds.maxY > baseY) {
        groundColumns.push({
          x: point.x,
          z: point.z,
        });
      }
    };
    const occupiedBounds = [];
    /**
     * Earlier masonry owns intersections, including room and exterior junctions.
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}} bounds
     * @param {string} material
     */
    const addBox = (bounds, material = "castleStoneMid") => {
      let pieces = [bounds];
      for (const occupied of occupiedBounds) {
        // Every remaining piece is contained by bounds. Disjoint masonry
        // cannot cut any piece, so avoid allocating a flatMap result for it.
        if (Math.min(bounds.maxX, occupied.maxX) - Math.max(bounds.minX, occupied.minX) <= 1e-6 ||
          Math.min(bounds.maxY, occupied.maxY) - Math.max(bounds.minY, occupied.minY) <= 1e-6 ||
          Math.min(bounds.maxZ, occupied.maxZ) - Math.max(bounds.minZ, occupied.minZ) <= 1e-6) {
          continue;
        }
        pieces = pieces.flatMap(
          /**
           * @param {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}} piece
           */ (piece) => {
            const minX = Math.max(piece.minX, occupied.minX), maxX = Math.min(piece.maxX, occupied.maxX);
            const minY = Math.max(piece.minY, occupied.minY), maxY = Math.min(piece.maxY, occupied.maxY);
            const minZ = Math.max(piece.minZ, occupied.minZ), maxZ = Math.min(piece.maxZ, occupied.maxZ);
            if (maxX - minX <= 1e-6 || maxY - minY <= 1e-6 || maxZ - minZ <= 1e-6) {
              return [piece];
            }
            return [{
              ...piece,
              maxX: minX,
            }, {
              ...piece,
              minX: maxX,
            },
            {
              ...piece,
              minX,
              maxX,
              maxY: minY,
            }, {
              ...piece,
              minX,
              maxX,
              minY: maxY,
            },
            {
              minX,
              maxX,
              minY,
              maxY,
              minZ: piece.minZ,
              maxZ: minZ,
            },
            {
              minX,
              maxX,
              minY,
              maxY,
              minZ: maxZ,
              maxZ: piece.maxZ,
            }].filter(CastleAuthoredBuildPlan.#filterRemainder);
          },
        );
        if (!pieces.length) {
          return;
        }
      }
      for (const piece of pieces) {
        emitBox(piece, material);
      }
      occupiedBounds.push(bounds);
    };
    /**
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
     * @param {string} axis
     * @param {number} coordinate
     * @param {number} sign
     * @param {number} height
     * @param {boolean} [envelope]
     */
    const wall = (room, axis, coordinate, sign, height, envelope = false) => {
      let joinedFace = null;
      /**
       * @param {{floorY:number,height:number,minX:number,maxX:number,minZ:number,maxZ:number}} building
       */
      const coversRoomFace = (building) => {
        const bounds = transform(building);
        const boundaries = axis === "x" ? [bounds.minX, bounds.maxX] : [bounds.minZ, bounds.maxZ];
        // A joined building removes this envelope face. Keep the room's
        // partition and doorway instead of leaving its frame in open space.
        const sharedFace = authored.buildings.some(/**
         * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} other
         */
          other => {
            if (other === building || room.floorY >= other.floorY + other.height || room.floorY + height <= other.floorY) {
              return false;
            }
            const volume = transform(other);
            const min = axis === "x" ? volume.minX : volume.minZ;
            const max = axis === "x" ? volume.maxX : volume.maxZ;
            const alongMin = axis === "x" ? room.minZ : room.minX;
            const alongMax = axis === "x" ? room.maxZ : room.maxX;
            const otherMin = axis === "x" ? volume.minZ : volume.minX;
            const otherMax = axis === "x" ? volume.maxZ : volume.maxX;
            if (Math.min(alongMax, otherMax) <= Math.max(alongMin, otherMin)) {
              return false;
            }
            return boundaries.some(/**
           * @param {number} boundary
           */
              boundary => Math.abs(boundary - coordinate) <= thickness * 1.1 && boundary > min && boundary < max);
          });
        if (sharedFace) {
          /**
           * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
           */
          const isFullHeightPassage = opening => opening.roomId === room.id && opening.axis === axis &&
            Math.abs(opening.coordinate - coordinate) <= thickness * 1.1 && opening.open && opening.height >= height;
          if (openings.some(isFullHeightPassage)) {
            return true;
          }
          const contained = room.minX >= bounds.minX && room.maxX <= bounds.maxX && room.minZ >= bounds.minZ && room.maxZ <= bounds.maxZ;
          if (contained) {
            for (const other of authored.buildings) {
              if (other === building || room.floorY >= other.floorY + other.height) {
                continue;
              }
              const volume = transform(other);
              const candidates = axis === "x" ? [volume.minX, volume.maxX] : [volume.minZ, volume.maxZ];
              const face = candidates.find(/**
                                            * @param {number} value
                                            */
                value => Math.abs(value - coordinate) <= thickness * 1.1);
              if (face !== undefined) {
                joinedFace = {
                  coordinate: face,
                  sign: face === candidates[0] ? -1 : 1,
                }; break;
              }
            }
          }
          return false;
        }
        return room.minX >= bounds.minX - 0.001 && room.maxX <= bounds.maxX + 0.001 &&
          room.minZ >= bounds.minZ - 0.001 && room.maxZ <= bounds.maxZ + 0.001 &&
          room.floorY >= building.floorY && room.floorY + height <= building.floorY + building.height &&
          boundaries.some(/**
           * @param {number} boundary
           */
            (boundary) => Math.abs(boundary - coordinate) <= thickness * 1.1);
      };
      if (room.kind === "room" && authored.buildings.some(coversRoomFace)) {
        return;
      }
      if (joinedFace) {
        for (const opening of openings) {
          if (opening.roomId === room.id && opening.axis === axis && Math.abs(opening.coordinate - coordinate) <= thickness * 1.1) {
            opening.coordinate = joinedFace.coordinate;
          }
        }
        coordinate = joinedFace.coordinate;
        sign = joinedFace.sign;
      }
      const alongMin = axis === "x" ? room.minZ : room.minX;
      const alongMax = axis === "x" ? room.maxZ : room.maxX;
      const openEnded = room.kind === "corridor" || room.kind === "terrace";
      let pieces = [{
        start: alongMin - (openEnded ? 0 : thickness),
        end: alongMax + (openEnded ? 0 : thickness),
        bottom: room.floorY,
        top: room.floorY + height,
      }];
      const wallOpenings = openings.flatMap(
        CastleAuthoredBuildPlan.#flatMapOpening,
      );
      if (envelope) {
        for (const other of authored.buildings) {
          if (other.id === room.id) {
            continue;
          }
          const volume = transform(other);
          const min = axis === "x" ? volume.minX : volume.minZ;
          const max = axis === "x" ? volume.maxX : volume.maxZ;
          const interior = coordinate > min + 1e-6 && coordinate < max - 1e-6;
          const sameFace = Math.abs(coordinate - (sign < 0 ? min : max)) < 1e-6;
          if (!interior && !(sameFace && other.height > height)) {
            continue;
          }
          const start = axis === "x" ? volume.minZ : volume.minX;
          const end = axis === "x" ? volume.maxZ : volume.maxX;
          wallOpenings.push({
            kind: "door",
            structuralCut: true,
            axis,
            coordinate,
            center: (start + end) / 2,
            width: end - start,
            floorY: other.floorY,
            height: other.height,
          });
        }
      }
      for (const door of wallOpenings) {
        if (door.kind !== "door" || door.axis !== axis || Math.abs(door.coordinate - coordinate) > thickness * 1.1 ||
          door.floorY + door.height <= room.floorY || door.floorY >= room.floorY + height) {
          continue;
        }
        // Cut the full wooden frame envelope; the casing overlaps the stone
        // while the jambs fit inside the opening around the unchanged leaf.
        const frameClearance = door.exteriorEntrance || door.structuralCut || door.open ? 0 : door.width * 0.09 - 0.01;
        const start = door.center - door.width / 2 - frameClearance;
        const end = door.center + door.width / 2 + frameClearance;
        const next = [];
        for (const piece of pieces) {
          const a = Math.max(piece.start, start);
          const b = Math.min(piece.end, end);
          const bottom = Math.max(piece.bottom, door.floorY);
          const top = Math.min(piece.top, door.floorY + door.height - (door.exteriorEntrance || door.structuralCut || door.open ? 0 : 0.05));
          if (b <= a || top <= bottom) {
            next.push(piece); continue;
          }
          next.push({
            ...piece,
            end: a,
          }, {
            ...piece,
            start: b,
          },
          {
            start: a,
            end: b,
            bottom: piece.bottom,
            top: bottom,
          }, {
            start: a,
            end: b,
            bottom: top,
            top: piece.top,
          });
        }
        pieces = next;
      }
      for (const piece of pieces) {
        // Joined envelopes stop at the other building's interior face.
        // Corner overlap must not become a projecting indoor pilaster.
        if (envelope) {
          for (const other of authored.buildings) {
            if (other.id === room.id || other.floorY > piece.bottom || other.floorY + other.height < piece.top) {
              continue;
            }
            const volume = transform(other);
            const crossMin = axis === "x" ? volume.minX : volume.minZ;
            const crossMax = axis === "x" ? volume.maxX : volume.maxZ;
            if (coordinate < crossMin || coordinate > crossMax) {
              continue;
            }
            const start = axis === "x" ? volume.minZ : volume.minX;
            const end = axis === "x" ? volume.maxZ : volume.maxX;
            if (piece.start < start && piece.end > start && piece.end <= end) {
              piece.end = start;
            } else if (piece.end > end && piece.start < end && piece.start >= start) {
              piece.start = end;
            }
          }
        }
        addBox({
          minX: axis === "x" ? coordinate + Math.min(0, sign * thickness) : piece.start,
          maxX: axis === "x" ? coordinate + Math.max(0, sign * thickness) : piece.end,
          minZ: axis === "z" ? coordinate + Math.min(0, sign * thickness) : piece.start,
          maxZ: axis === "z" ? coordinate + Math.max(0, sign * thickness) : piece.end,
          minY: piece.bottom,
          maxY: piece.top,
        });
      }
    };
    for (const building of authored.buildings) {
      const body = {
        ...transform(building),
        id: building.id,
        floorY: building.floorY,
        height: building.height,
      };
      wall(body, "x", body.minX, -1, body.height, true);
      wall(body, "x", body.maxX, 1, body.height, true);
      wall(body, "z", body.minZ, -1, body.height, true);
      wall(body, "z", body.maxZ, 1, body.height, true);
      if (building.id === "base") {
        const terrace = {
          ...body,
          floorY: body.floorY + body.height,
        };
        wall(terrace, "x", body.minX, -1, 0.25, true); wall(terrace, "x", body.maxX, 1, 0.25, true);
        wall(terrace, "z", body.minZ, -1, 0.25, true); wall(terrace, "z", body.maxZ, 1, 0.25, true);
        /**
         * @param {number} x
         * @param {number} z
         * @returns {boolean}
         */
        const covered = (x, z) => authored.buildings.some(/**
         * @param {{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,height:number}} other
         */
          (other) => {
            const volume = transform(other);

            return other.id !== building.id && other.floorY <= terrace.floorY && other.floorY + other.height >= terrace.floorY + 0.75 &&
            x >= volume.minX - thickness && x <= volume.maxX + thickness && z >= volume.minZ - thickness && z <= volume.maxZ + thickness;
          });
        for (let x = body.minX; x < body.maxX; x += 1) {
          CastleAuthoredBuildPlan.#addHorizontalBattlement(
            covered,
            x,
            body,
            addBox,
            thickness,
            terrace,
            body.minZ - thickness / 2,
          );
          CastleAuthoredBuildPlan.#addHorizontalBattlement(
            covered,
            x,
            body,
            addBox,
            thickness,
            terrace,
            body.maxZ + thickness / 2,
          );
        }
        for (let z = body.minZ; z < body.maxZ; z += 1) {
          CastleAuthoredBuildPlan.#addVerticalBattlement(
            covered,
            z,
            body,
            addBox,
            thickness,
            terrace,
            body.minX - thickness / 2,
          );
          CastleAuthoredBuildPlan.#addVerticalBattlement(
            covered,
            z,
            body,
            addBox,
            thickness,
            terrace,
            body.maxX + thickness / 2,
          );
        }
      }
    }
    for (const room of spaces) {
      const hasRoofParapet = buildings.some(/**
       * Exterior links need their own parapets; roof terraces get theirs from the roof.
       * Compare both footprints in entrance-local coordinates.
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} building
       */
        building => room.minX >= building.minX && room.maxX <= building.maxX &&
          room.minZ >= building.minZ && room.maxZ <= building.maxZ);
      if (room.kind === "corridor") {
        /**
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,height:number}} building
         */
        const enclosesCorridor = building => room.minX >= building.minX && room.maxX <= building.maxX &&
          room.minZ >= building.minZ && room.maxZ <= building.maxZ && room.floorY >= building.floorY &&
          room.floorY + room.height <= building.floorY + building.height;
        if (!buildings.length || buildings.some(enclosesCorridor)) {
          continue;
        }
        // A corridor owns one continuous pair of side walls. Its open ends
        // meet adjoining envelopes without another doorway surround.
        const axis = room.maxX - room.minX < room.maxZ - room.minZ ? "x" : "z";
        wall(room, axis, axis === "x" ? room.minX : room.minZ, -1, room.height);
        wall(room, axis, axis === "x" ? room.maxX : room.maxZ, 1, room.height);
        addBox({
          minX: room.minX - (axis === "x" ? thickness : 0),
          maxX: room.maxX + (axis === "x" ? thickness : 0),
          minZ: room.minZ - (axis === "z" ? thickness : 0),
          maxZ: room.maxZ + (axis === "z" ? thickness : 0),
          minY: room.floorY + room.height - thickness,
          maxY: room.floorY + room.height,
        });
      } else if (room.kind === "room") {
        wall(room, "x", room.minX, -1, room.height);
        wall(room, "x", room.maxX, 1, room.height);
        wall(room, "z", room.minZ, -1, room.height);
        wall(room, "z", room.maxZ, 1, room.height);
      } else if ((room.kind === "wallWalk" || room.kind === "terrace") && !hasRoofParapet) {
        if (room.kind === "wallWalk" && room.floorY > baseY) {
          addBox({
            ...room,
            minY: baseY,
            maxY: room.floorY - 0.25,
          });
        }
        const axes = room.maxX - room.minX > room.maxZ - room.minZ ? [["z", room.minZ, -1], ["z", room.maxZ, 1]]
          : [["x", room.minX, -1], ["x", room.maxX, 1]];
        for (const [axis, coordinate, sign] of axes) {
          wall(room, axis, coordinate, sign, 0.75);
        }
      }
    }
    for (const area of residential.walkableAreas) {
      addBox({
        ...area,
        minY: area.floorY - 0.25,
        maxY: area.floorY,
      });
    }
    for (const roof of authored.roofs) {
      const bounds = transform(roof);
      if (roof.shape === "flat") {
        const parapetHeight = roof.battlements ? 0.25 : 0.75;
        const platform = {
          ...bounds,
          floorY: roof.y,
          height: parapetHeight,
        };
        wall(platform, "x", bounds.minX, -1, parapetHeight);
        wall(platform, "x", bounds.maxX, 1, parapetHeight);
        wall(platform, "z", bounds.minZ, -1, parapetHeight);
        wall(platform, "z", bounds.maxZ, 1, parapetHeight);
        if (roof.battlements) {
          for (const axis of ["x", "z"]) {
            const along = axis === "x" ? "Z" : "X";
            const across = axis === "x" ? "X" : "Z";
            const start = bounds[`min${along}`];
            const end = bounds[`max${along}`];
            const bays = Math.max(2, Math.round((end - start) / 0.9));
            const pitch = (end - start) / bays;
            for (const edge of [-1, 1]) {
              const face = bounds[`${edge < 0 ? "min" : "max"}${across}`];
              for (let bay = 0; bay <= bays; bay++) {
                const center = start + bay * pitch;
                const low = Math.max(start, center - 0.25);
                const high = Math.min(end, center + 0.25);
                /**
                 * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
                 */
                const crossesDoor = (opening) => opening.kind === "door" && opening.floorY === roof.y &&
                  opening.axis === axis && Math.abs(opening.coordinate - face) < 0.3 &&
                  high > opening.center - opening.width / 2 && low < opening.center + opening.width / 2;
                if (openings.some(crossesDoor)) {
                  continue;
                }
                addBox({
                  minX: axis === "x" ? face + Math.min(0, edge * thickness) : low,
                  maxX: axis === "x" ? face + Math.max(0, edge * thickness) : high,
                  minZ: axis === "z" ? face + Math.min(0, edge * thickness) : low,
                  maxZ: axis === "z" ? face + Math.max(0, edge * thickness) : high,
                  minY: roof.y + parapetHeight,
                  maxY: roof.y + 1,
                });
              }
            }
          }
        }
      } else {
        const center = world((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, roof.y);
        geometry.decorations.roofs.push({
          ...center,
          yaw,
          width: bounds.maxX - bounds.minX,
          depth: bounds.maxZ - bounds.minZ,
          height: roof.height,
        });
      }
    }
    const roomDoors = [];
    const uniqueDoors = new Set();
    for (const door of residential.doorways) {
      if (door.exteriorEntrance || door.open) {
        continue;
      }
      const x = door.axis === "x" ? door.coordinate : door.center;
      const z = door.axis === "z" ? door.coordinate : door.center;
      const key = [door.axis, door.floorY, door.coordinate, door.center].join(":");
      if (uniqueDoors.has(key)) {
        continue;
      }
      uniqueDoors.add(key);
      const placement = {
        ...world(x, z, door.floorY),
        roomId: door.roomId,
        openWide: door.openWide,
        frameClearance: door.frameClearance,
        width: door.width,
        height: door.height - 0.05,
        mirrored: authored.mirrored,
        yaw: yaw + {
          NORTH: 180,
          SOUTH: 0,
          WEST: -90,
          EAST: 90,
        }[door.side] + (door.swing === "inward" ? 180 : 0),
        openingInset: door.openingInset ?? 0,
      };
      const angle = placement.yaw * Math.PI / 180;
      const nx = Math.round(Math.sin(angle)), nz = Math.round(Math.cos(angle));
      const tx = nz, tz = -nx;
      const jambReach = door.width * 0.59 + 0.02;
      const jamb = cameraBlocks.filter(/**
                                        * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} block
                                        */
        block => Math.abs(Math.abs((block.x - placement.x) * tx + (block.z - placement.z) * tz) - jambReach) <= Math.abs(tx) * block.halfX + Math.abs(tz) * block.halfZ + 1e-6 &&
          Math.abs(block.y - (door.floorY + 1)) < block.halfY && Math.abs((block.x - placement.x) * nx + (block.z - placement.z) * nz) < 0.5 &&
          Math.abs(nx) * block.halfX + Math.abs(nz) * block.halfZ <= 0.25)
        .sort(/**
               * @param {{x:number,z:number}} a
               * @param {{x:number,z:number}} b
               */
          (a,b) => Math.abs((a.x-placement.x)*nx+(a.z-placement.z)*nz)-Math.abs((b.x-placement.x)*nx+(b.z-placement.z)*nz))[0];
      placement.frameOffset = (placement.openingInset ?? 0) + (jamb ? (jamb.x-placement.x)*nx+(jamb.z-placement.z)*nz + Math.abs(nx)*jamb.halfX + Math.abs(nz)*jamb.halfZ - 0.095 : -0.095);
      roomDoors.push(placement);
    }
    const terraceEntrance = roomDoors.find(CastleAuthoredBuildPlan.#findDoor);
    const leisure = spaces.find(/**
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
     */
      (space) => space.kind === "terrace" && space.maxZ === rooms["upper-stair-room"]?.minZ);
    // Use the authored upper landing doorway; never add a second stairhead.
    const entrance = openings.find(CastleAuthoredBuildPlan.#findOpening);
    const terraceAreas = leisure ? spaces.filter(/**
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
     */
      (space) => space.kind === "terrace" && space.floorY === leisure.floorY) : [];
    const terraceBounds = {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    };
    for (const area of terraceAreas) {
      terraceBounds.minX = Math.min(terraceBounds.minX, area.minX);
      terraceBounds.maxX = Math.max(terraceBounds.maxX, area.maxX);
      terraceBounds.minZ = Math.min(terraceBounds.minZ, area.minZ);
      terraceBounds.maxZ = Math.max(terraceBounds.maxZ, area.maxZ);
    }
    const terraceCenter = leisure ? world(
      (terraceBounds.minX + terraceBounds.maxX) / 2,
      (terraceBounds.minZ + terraceBounds.maxZ) / 2,
      leisure.floorY,
    ) : null;
    const terrace = leisure && terraceEntrance && entrance ? {
      x: terraceEntrance.x,
      y: terraceEntrance.y,
      z: terraceEntrance.z,
      yaw: yaw + 180,
      doorRoomId: terraceEntrance.roomId,
      serviceCenter: terraceCenter,
      width: 2 * Math.min(entrance.center - leisure.minX, leisure.maxX - entrance.center) - 0.4,
      depth: leisure.maxZ - leisure.minZ - 0.25,
    } : null;
    const pocketItems = StairwellRoomGenerator.furnishPockets(residential, options.seed ?? 0);
    for (const [index, item] of pocketItems.entries()) {
      item.id = "stair-pocket-" + index;
      if ((item.y ?? 0) > 0.05) {
        const support = pocketItems.find(/**
         *
         * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem} candidate
         */
          candidate => candidate !== item && candidate.floorY === item.floorY &&
          Math.abs((candidate.y ?? 0) + candidate.height * candidate.scale - item.y) < 0.025 &&
          Math.abs(candidate.x - item.x) < (candidate.width * candidate.scale + item.width * item.scale) / 2 &&
          Math.abs(candidate.z - item.z) < (candidate.depth * candidate.scale + item.depth * item.scale) / 2);
        if (support) {
          item.supportId = "stair-pocket-" + pocketItems.indexOf(support);
        }
      }
      residential.furniture.push(item);
    }
    if (envelope.roundTower) {
      const tower = envelope.roundTower;
      // Move the tower with the reflected corridor, retaining the handedness
      // of its spiral flights and matching asymmetric landing cuts.
      const towerAxis = gate.axis === "z" ? "X" : "Z";
      const towerCenter = [...tower.center];
      if (authored.mirrored) {
        const index = towerAxis === "X" ? 0 : 1;
        towerCenter[index] = 2 * gate.center - towerCenter[index];
      }
      for (const elevation of [0, tower.terraceElevation]) {
        roomDoors.push({
          ...world(gate.center - towerCenter[0], gate.coordinate - towerCenter[1] - tower.radius + 0.125, baseY + elevation),
          roomId: elevation === 0 ? "tower-ground" : "tower-terrace",
          width: tower.doorWidth,
          height: tower.doorHeight - 0.05,
          yaw: yaw + 180,
          mirrored: authored.mirrored,
          openWide: false,
          frameOffset: 0,
        });
      }
      const groundRows = new Map();
      const bellFloorCells = new Set();
      CastleRoundTower.emit(envelope.roundTower, baseY, /**
       *
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}} bounds
       * @param {string} material
       */
        (bounds, material) => {
          if (authored.mirrored) {
            const index = towerAxis === "X" ? 0 : 1;
            const shift = towerCenter[index] - tower.center[index];
            bounds[`min${towerAxis}`] += shift;
            bounds[`max${towerAxis}`] += shift;
          }
          const bellLanding = bounds.maxY === baseY + tower.height + 0.02 && bounds.minY === baseY + tower.height - 0.25;
          const terraceLanding = bounds.maxY === baseY + tower.terraceElevation + 0.02 && bounds.minY === baseY + tower.terraceElevation - 0.25;
          if (bellLanding || terraceLanding) {
            const area = transform(bounds);
            const key = [area.minX, area.maxX, area.minZ, area.maxZ, bounds.maxY].join(":");
            if (!bellFloorCells.has(key)) {
              bellFloorCells.add(key);
              residential.walkableAreas.push({
                ...area,
                id: `round-tower-${bellLanding ? "bell" : "terrace"}-floor:${bellFloorCells.size}`,
                floorY: bounds.maxY,
              });
            }
          }
          if (bounds.maxY === baseY) {
            const row = groundRows.get(bounds.minZ);
            if (row) {
              row.minX = Math.min(row.minX, transform(bounds).minX);
              row.maxX = Math.max(row.maxX, transform(bounds).maxX);
            } else {
              const area = {
                ...transform(bounds),
                id: `round-tower-ground:${groundRows.size}`,
                floorY: baseY,
              };
              groundRows.set(bounds.minZ, area);
              residential.walkableAreas.push(area);
            }
          }
          addBox({
            ...transform(bounds),
            minY: bounds.minY,
            maxY: bounds.maxY,
          }, material);
        });
    }
    const angle = yaw * Math.PI / 180;
    const localWalls = cameraBlocks.map(/**
     *
     * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} block
     */
      block => ({
        ...block,
        x: Math.cos(angle) * (block.x - origin.x) - Math.sin(angle) * (block.z - origin.z),
        z: Math.sin(angle) * (block.x - origin.x) + Math.cos(angle) * (block.z - origin.z),
        halfX: Math.abs(Math.sin(angle)) > 0.5 ? block.halfZ : block.halfX,
        halfZ: Math.abs(Math.sin(angle)) > 0.5 ? block.halfX : block.halfZ,
      }));
    residential.furniture = RoomPlacementRules.repair(residential.furniture, localWalls, spaces, openings, new Set(), residential.walkableAreas);

    return {
      input: {
        ...options,
        doors: adaptedDoors,
        requestedStyle: options.requestedStyle ?? authored.basePlanId,
      },
      layout: {
        empty: false,
        basePlanId: authored.basePlanId,
        baseY,
        primarySide: side,
        widthBlocks: position.width * 4,
        depthBlocks: position.depth * 4,
        facadeSpan: transverse * 4,
        castleDepth: inward * 4,
        worldLeft: position.x,
        worldTop: position.z,
        style: {
          id: authored.basePlanId,
          wallHeightBlocks: 15,
          towerSpanBlocks: 6,
        },
        openings: [{
          boundary: "FRONT",
          start: adaptedDoors[0].offset * 4,
          end: (adaptedDoors[0].offset + adaptedDoors[0].width) * 4,
        }],
        roomPlan: residential,
      },
      structure: {
        wall: {
          towerSpan: 6,
          wallHeight: 15,
        },
        towers: [],
        gatehouses: [],
        audienceWing: null,
      },
      geometry,
      metadata: {
        runtime: {
          authoredObjects: [...(envelope.objects ?? []), ...SpiralStairStorage.furnish(envelope.roundTower,
            authored.mirrored ? (gate.axis === "z" ? "x" : "z") : null)].map(/**
           *
           * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} item
           */
            item => {
              const fixture = structuredClone(item);
              let x = item.position.x * scale;
              let z = item.position.z * scale;
              let rotation = item.rotation ?? 0;
              if (authored.mirrored) {
                if (gate.axis === "z") {
                  x = 2 * gate.center - x;
                  rotation = -rotation;
                } else {
                  z = 2 * gate.center - z;
                  rotation = 180 - rotation;
                }
              }
              if (item.preserveHandedness) {
                rotation = item.rotation ?? 0;
              }
              fixture.position = world(gate.center - x, gate.coordinate - z, baseY + (item.position.y ?? 0) * scale);
              fixture.rotation = yaw - 180 + rotation;
              for (const field of ["Z1", "Z2", "columnTop"]) {
                if (item[field] !== undefined) {
                  fixture[field] = baseY + item[field] * scale;
                }
              }

              return fixture;
            }),
          residential,
          roomDoors,
          terrace,
          audienceOpening: null,
          interiorWidth: rooms.work.maxX - rooms.work.minX,
          interiorDepth: rooms.work.maxZ - rooms.work.minZ,
        },
        collision: {
          blockSize: 0.25,
          groundCourse: 0,
          groundColumns,
          cameraBlocks,
          cameraBlockHalfExtents: {
            x: 0.125,
            y: 0.125,
            z: 0.125,
          },
        },
      },
    };
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
   */
  static #filterSpace(space) {
    return space.kind === "room";
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
   */
  static #mapRoom(room) {
    return [room.id, room];
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
   */
  static #filterOpening(opening) {
    return opening.kind === "door";
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} part
   */
  static #filterPart(part) {
    return part.maxX > part.minX && part.maxZ > part.minZ;
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
   */
  static #mapSpace(space) {
    return space.floorY;
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} piece
   */
  static #filterPiece(piece) {
    return piece.maxX > piece.minX && piece.maxZ > piece.minZ;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static #mapPoint(point) {
    return point.x;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static #mapPoint2(point) {
    return point.x;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static #mapPoint3(point) {
    return point.z;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static #mapPoint4(point) {
    return point.z;
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
   */
  static #filterSpace2(space) {
    return space.kind === "void";
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} piece
   */
  static #filterPiece2(piece) {
    return piece.maxX > piece.minX && piece.maxZ > piece.minZ;
  }

  /**
   * @param {number} value
   */
  static #mapValue(value) {
    return value.toFixed(5);
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}} remainder
   */
  static #filterRemainder(remainder) {
    return (
      remainder.maxX - remainder.minX > 1e-6 &&
              remainder.maxY - remainder.minY > 1e-6 && remainder.maxZ - remainder.minZ > 1e-6
    );
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
   */
  static #flatMapOpening(opening) {
    if (!opening.exteriorEntrance) {
      return [{
        ...opening,
        width: opening.width + (opening.frameClearance ?? 0),
      }];
    }
    // The bundled arch closes the shoulders. Clear the full leaf height
    // through the wall so its taller centre can swing past either jamb.
    return [{
      ...opening,
      height: opening.height - 0.05,
    }];
  }

  /**
   * @param {{roomId:string}} door
   */
  static #findDoor(door) {
    return door.roomId === "upper-stair-room";
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
   */
  static #findOpening(opening) {
    return opening.roomId === "upper-stair-room" && opening.kind === "door";
  }

  /**
   * @param {(x:number,z:number)=>boolean} covered
   * @param {number} x
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} body
   * @param {(box:{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number})=>void} addBox
   * @param {number} thickness
   * @param {{floorY:number}} terrace
   * @param {number} z
   */
  static #addHorizontalBattlement(
    covered,
    x,
    body,
    addBox,
    thickness,
    terrace,
    z,
  ) {
    if (covered(Math.min(x + 0.25, body.maxX), z)) {
      return;
    }
    addBox({
      minX:x,
      maxX:Math.min(x+0.5,body.maxX),
      minZ:z-thickness/2,
      maxZ:z+thickness/2,
      minY:terrace.floorY+0.25,
      maxY:terrace.floorY+0.75,
    });
  }

  /**
   * @param {(x:number,z:number)=>boolean} covered
   * @param {number} z
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} body
   * @param {(box:{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number})=>void} addBox
   * @param {number} thickness
   * @param {{floorY:number}} terrace
   * @param {number} x
   */
  static #addVerticalBattlement(
    covered,
    z,
    body,
    addBox,
    thickness,
    terrace,
    x,
  ) {
    if (covered(x, Math.min(z + 0.25, body.maxZ))) {
      return;
    }
    addBox({
      minX:x-thickness/2,
      maxX:x+thickness/2,
      minZ:z,
      maxZ:Math.min(z+0.5,body.maxZ),
      minY:terrace.floorY+0.25,
      maxY:terrace.floorY+0.75,
    });
  }
}
