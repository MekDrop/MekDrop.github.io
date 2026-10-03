import { CastleGenerationScheduler } from "./CastleGenerationScheduler.js";
import { CastleBasePlanGenerator } from "./CastleBasePlanGenerator.js";
import { CastleBasePlanInvalidError } from "../../errors/castle/index.js";
import { createCastlePlannedFloorAreas } from "../../objects/castle/CastlePlannedFloorAreas.js";

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
    if (!position || !doors?.length) { throw new CastleBasePlanInvalidError(options.basePlanId, "entrance"); }
    const side = doors[0].side;
    const transverse = ["WEST", "EAST"].includes(side) ? position.depth : position.width;
    const inward = ["WEST", "EAST"].includes(side) ? position.width : position.depth;
    const envelope = (await CastleBasePlanGenerator.plans).find(/**
     *
     * @param {import("./CastleBasePlanGenerator.js").CastleBasePlan} plan
     */
    (plan) => plan.id === (options.basePlanId ?? "castle-demo-compact"));
    if (!envelope) { throw new CastleBasePlanInvalidError(options.basePlanId, "plan id"); }
    const scale = envelope.coordinates.units === "metres" ? 1
      : Math.min(transverse / (envelope.coordinates.width + 4), inward / (envelope.coordinates.depth + 4));
    if (scale < 0.2) { throw new CastleBasePlanInvalidError(options.basePlanId, "walkable footprint (minimum authored scale 0.2 metres)"); }
    const baseY = position.elevation ?? 3;
    const authored = await CastleBasePlanGenerator.generate({ planId: options.basePlanId, seed: options.seed, unitMetres: scale, baseY });
    scheduler.throwIfAborted();
    const gate = authored.entrance;
    const along = doors[0].offset + doors[0].width / 2;
    const adaptedDoors = doors;
    const yaw = { NORTH: 0, SOUTH: 180, WEST: 90, EAST: -90 }[side];
    const centers = { NORTH: { x: position.x + along, z: position.z }, SOUTH: { x: position.x + along, z: position.z + position.depth },
      WEST: { x: position.x, z: position.z + along }, EAST: { x: position.x + position.width, z: position.z + along } };
    const origin = { ...centers[side], y: baseY, yaw };
    const thickness = 0.25;
    /**
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
     */
    const transform = (bounds) => ({ minX: gate.center - bounds.maxX, maxX: gate.center - bounds.minX,
      minZ: gate.coordinate - bounds.maxZ, maxZ: gate.coordinate - bounds.minZ });
    /**
     * @param {number} x
     * @param {number} z
     * @param {number} y
     */
    const world = (x, z, y) => {
      const angle = yaw * Math.PI / 180;
      return { x: origin.x + Math.cos(angle) * x + Math.sin(angle) * z,
        y, z: origin.z - Math.sin(angle) * x + Math.cos(angle) * z };
    };
    const spaces = [];
    for (const space of authored.spaces) { spaces.push({ ...space, ...transform(space) }); }
    const placedRooms = spaces.filter(/**
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
     */
    (space) => space.kind === "room");
    const buildings = authored.buildings.map(transform);
    const openings = [];
    for (const opening of authored.openings) {
      const entrance = opening.roomId === gate.roomId && opening.floorY === baseY && opening.side === gate.side && opening.kind === "door";
      openings.push({ ...opening, coordinate: (opening.axis === "x" ? gate.center : gate.coordinate) - opening.coordinate,
        center: (opening.axis === "x" ? gate.coordinate : gate.center) - opening.center,
        side: { NORTH: "SOUTH", SOUTH: "NORTH", EAST: "WEST", WEST: "EAST" }[opening.side],
        width: entrance ? doors[0].width : opening.kind === "door" ? Math.max(0.75, opening.width) : opening.width,
        exteriorEntrance: entrance });
    }
    for (const opening of openings) {
      for (let index = 0; index < buildings.length; index++) {
        const building = buildings[index];
        const source = authored.buildings[index];
        if (opening.floorY < source.floorY || opening.floorY >= source.floorY + source.height) { continue; }
        const boundary = opening.axis === "x"
          ? (opening.side === "WEST" ? building.minX : building.maxX)
          : (opening.side === "NORTH" ? building.minZ : building.maxZ);
        if (Math.abs(opening.coordinate - boundary) <= thickness * 1.1) { opening.coordinate = boundary; }
      }
    }
    const rooms = Object.fromEntries(placedRooms.map(/**
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
     */
    (room) => [room.id, room]));
    rooms.work = rooms["throne-hall"];
    rooms.bedroom = rooms["royal-chamber"] ?? rooms.work;
    rooms.service = rooms.kitchen ?? rooms.armory ?? rooms.work;
    rooms.servantBedroom = rooms.service;
    rooms.storage = rooms.service;
    rooms.balcony = { ...rooms.bedroom, purpose: "unused" };
    const furniture = authored.furniture.map(/**
     * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId:string,floorY:number}} item
     */
    (item) => ({ ...item, x: gate.center - item.x, z: gate.coordinate - item.z }));
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
          return !best || distance < best.distance ? { door, dx, dz, distance } : best;
        }, null);
        const entryYaw = nearest ? Math.round(Math.atan2(nearest.dx, nearest.dz) * 180 / Math.PI / 90) * 90 : (x < 0 ? 180 : 0);
        stairs.push({ id: `${shaft.id}:${level}`, shaft: bounds, center: world(x, z, floorY), radius,
          rise: authored.floorHeight, steps: 24, turns: shaft.landingProfile === false ? 1 : 1.5, landingProfile: shaft.landingProfile ?? true,
          entryDoorId: nearest?.door.roomId, exitDirection: 1, yaw: yaw + entryYaw });
      }
    }
    const walkableAreas = [];
    for (const space of spaces) {
      if (space.kind !== "void") { walkableAreas.push({ ...space, bounds: { ...space }, id: space.id }); }
    }
    for (const opening of openings) {
      if (opening.kind !== "door") { continue; }
      walkableAreas.push({ id: `doorThreshold:${opening.roomId}:${opening.side}`, floorY: opening.floorY,
        minX: opening.axis === "x" ? opening.coordinate - 0.5 : opening.center - opening.width / 2,
        maxX: opening.axis === "x" ? opening.coordinate + 0.5 : opening.center + opening.width / 2,
        minZ: opening.axis === "z" ? opening.coordinate - 0.5 : opening.center - opening.width / 2,
        maxZ: opening.axis === "z" ? opening.coordinate + 0.5 : opening.center + opening.width / 2 });
    }
    const outerBounds = { minX: gate.center - authored.width, maxX: gate.center, minZ: 0, maxZ: gate.coordinate };
    const residential = { version: 2, basePlanId: authored.basePlanId, origin, rooms, spaces, placedRooms, openings,
      doorways: openings.filter(/**
       * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
       */
      (opening) => opening.kind === "door"), furniture, rise: authored.floorHeight, floorHeight: authored.floorHeight,
      walkableAreas, authoredStairs: stairs, stair: null, serviceStair: null, basement: null,
      reservations: { throne: { ...rooms.work, minY: 0, maxY: rooms.work.height } },
      outerBounds, gatehouseDepth: 0, skippedRooms: [], subrooms: [], roomRequirements: [],
      shaft: stairs[0]?.shaft, stairHostRoomId: null };
    for (const roof of authored.roofs) {
      if (roof.shape === "flat") { residential.walkableAreas.push({ ...transform(roof), id: `roof:${roof.id}`, floorY: roof.y }); }
    }
    for (const building of authored.buildings) {
      if (building.floorY <= baseY && building.floorY + building.height > baseY) {
        // Room interiors omit partition thickness and circulation seams. The
        // building owns a continuous ground slab before cutting stair openings.
        residential.walkableAreas.push({ ...transform(building), id: `ground-slab:${building.id}`, floorY: baseY });
      }
      if (building.id === "base") {
        const floorY = building.floorY + building.height;
        residential.walkableAreas = residential.walkableAreas.filter(/**
         * @param {{floorY:number}} area
         */
        (area) => area.floorY !== floorY);
        residential.walkableAreas.push({ ...transform(building), id: "base-ceiling", floorY });
      }
    }
    // Rotate each top-floor opening into the stair's frame; quarter turns retain exact brick rectangles.
    for (const stair of stairs) {
      const center = { x: (stair.shaft.minX + stair.shaft.maxX) / 2, z: (stair.shaft.minZ + stair.shaft.maxZ) / 2 };
      const frame = stair.yaw - yaw + (stair.turns === 1 ? 0 : -180);
      /**
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY?:number}} area
       * @param {number} degrees
       */
      const rotate = (area, degrees) => {
        const radians = degrees * Math.PI / 180, cosine = Math.round(Math.cos(radians)), sine = Math.round(Math.sin(radians));
        const corners = [[area.minX, area.minZ], [area.maxX, area.minZ], [area.minX, area.maxZ], [area.maxX, area.maxZ]].map(/**
         *
         * @param {number[]} options
         * @param {number} options."0"
         * @param {number} options."1"
         */
        ([px, pz]) => ({
          x: center.x + (px - center.x) * cosine + (pz - center.z) * sine,
          z: center.z - (px - center.x) * sine + (pz - center.z) * cosine,
        }));
        return { ...area, minX: Math.min(...corners.map(/**
         *
         * @param {{x:number,z:number}} point
         */
        point => point.x)), maxX: Math.max(...corners.map(/**
         *
         * @param {{x:number,z:number}} point
         */
        point => point.x)),
          minZ: Math.min(...corners.map(/**
           *
           * @param {{x:number,z:number}} point
           */
          point => point.z)), maxZ: Math.max(...corners.map(/**
           *
           * @param {{x:number,z:number}} point
           */
          point => point.z)) };
      };
      const top = residential.walkableAreas.filter(/**
       *
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY?:number}} area
       */
      area => area.floorY === stair.center.y + stair.rise).map(/**
       *
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY?:number}} area
       */
      area => rotate(area, -frame));
      const source = { ...residential, authoredStairs: undefined, basePlanId: undefined,
        walkableAreas: top, shaft: rotate(stair.shaft, -frame), stair: { ...center, radius: stair.radius },
        origin: { ...origin, y: stair.center.y }, rooms: {}, doorways: [], stairExitDirection: 1,
        stairExitClearance: stair.landingProfile ? undefined : stair.radius * 0.375 / 0.65 + 0.49 };
      residential.walkableAreas = [...residential.walkableAreas.filter(/**
       *
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY?:number}} area
       */
      area => area.floorY !== stair.center.y + stair.rise),
        ...createCastlePlannedFloorAreas({ metadata: { runtime: { residential: source } } }).map(/**
         *
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY?:number}} area
         */
        area => rotate(area, frame))];
    }
    // Thresholds on the lowest floor also need a single surface owner.
    residential.walkableAreas = createCastlePlannedFloorAreas({ metadata: { runtime: { residential: {
      ...residential, basePlanId: undefined, stair: null, serviceStair: null,
      rooms: {}, doorways: [],
    } } } });
    // Thresholds on the lowest floor also need a single surface owner.
    residential.walkableAreas = createCastlePlannedFloorAreas({ metadata: { runtime: { residential: {
      ...residential, basePlanId: undefined, stair: null, serviceStair: null,
      rooms: {}, doorways: [],
    } } } });
    // Remove every upper void after thresholds and stair landings are compiled.
    for (const space of spaces.filter(/**
                                       * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
                                       */ (space) => space.kind === "void")) {
      residential.walkableAreas = residential.walkableAreas.flatMap(/**
                                                                     * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
                                                                     */ (area) => {
        if (area.floorY !== space.floorY) { return [area]; }
        const a = Math.max(area.minX, space.minX);
        const b = Math.min(area.maxX, space.maxX);
        const c = Math.max(area.minZ, space.minZ);
        const d = Math.min(area.maxZ, space.maxZ);
        if (b <= a || d <= c) { return [area]; }
        return [{ ...area, maxX: a }, { ...area, minX: b },
          { ...area, minX: a, maxX: b, maxZ: c }, { ...area, minX: a, maxX: b, minZ: d }]
          .filter(/**
                   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} piece
                   */ (piece) => piece.maxX > piece.minX && piece.maxZ > piece.minZ);
      });
    }
    const geometry = { boxes: [], decorations: { flames: [], banners: [], flags: [], roofs: [] } };
    const cameraBlocks = [];
    const groundColumns = [];
    const uniqueBoxes = new Set();
    /**
     * @param {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}} bounds
     * @param {string} material
     */
    const addBox = (bounds, material = "castleStoneMid") => {
      if (bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ || bounds.maxY <= bounds.minY) { return; }
      const point = world((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, (bounds.minY + bounds.maxY) / 2);
      const crosswise = ["WEST", "EAST"].includes(side);
      const sx = crosswise ? bounds.maxZ - bounds.minZ : bounds.maxX - bounds.minX;
      const sz = crosswise ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ;
      const sy = bounds.maxY - bounds.minY;
      const key = [point.x, point.y, point.z, sx, sy, sz].map(/**
       * @param {number} value
       */
      (value) => value.toFixed(5)).join(":");
      if (uniqueBoxes.has(key)) { return; }
      uniqueBoxes.add(key);
      // The gate's quarter-metre masonry vocabulary, instanced by material.
      for (let y = bounds.minY; y < bounds.maxY - 1e-6; y += 0.25) {
        for (let x = bounds.minX; x < bounds.maxX - 1e-6; x += 0.25) {
          for (let z = bounds.minZ; z < bounds.maxZ - 1e-6; z += 0.25) {
            const bx = Math.min(0.25, bounds.maxX - x);
            const by = Math.min(0.25, bounds.maxY - y);
            const bz = Math.min(0.25, bounds.maxZ - z);
            const brick = world(x + bx / 2, z + bz / 2, y + by / 2);
            const hash = Math.imul(Math.round(x * 4) + 11, 73856093) ^
              Math.imul(Math.round(y * 4) + 17, 19349663) ^ Math.imul(Math.round(z * 4) + 23, 83492791);
            const shade = (hash >>> 0) % 8;
            geometry.boxes.push({ ...brick, sx: crosswise ? bz : bx, sy: by, sz: crosswise ? bx : bz, yaw: 0,
              material: material === "castleStoneMid" && (shade === 0 || shade === 7) ? "castleStoneDark" : material });
          }
        }
      }
      cameraBlocks.push({ ...point, halfX: sx / 2, halfY: sy / 2, halfZ: sz / 2 });
      if (bounds.minY <= baseY && bounds.maxY > baseY) { groundColumns.push({ x: point.x, z: point.z }); }
    };
    /**
     * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
     * @param {string} axis
     * @param {number} coordinate
     * @param {number} sign
     * @param {number} height
     */
    const wall = (room, axis, coordinate, sign, height) => {
      if (room.kind === "room" && authored.buildings.some(/**
       * @param {{floorY:number,height:number,minX:number,maxX:number,minZ:number,maxZ:number}} building
       */
      (building) => {
        const bounds = transform(building);
        const boundaries = axis === "x" ? [bounds.minX, bounds.maxX] : [bounds.minZ, bounds.maxZ];
        return room.floorY >= building.floorY && room.floorY + height <= building.floorY + building.height &&
          boundaries.some(/**
           * @param {number} boundary
           */
          (boundary) => Math.abs(boundary - coordinate) <= thickness * 1.1);
      })) { return; }
      const alongMin = axis === "x" ? room.minZ : room.minX;
      const alongMax = axis === "x" ? room.maxZ : room.maxX;
      let pieces = [{ start: alongMin - thickness, end: alongMax + thickness, bottom: room.floorY, top: room.floorY + height }];
      for (const door of openings) {
        if (door.kind !== "door" || door.axis !== axis || Math.abs(door.coordinate - coordinate) > thickness * 1.1 ||
          door.floorY + door.height <= room.floorY || door.floorY >= room.floorY + height) { continue; }
        const next = [];
        for (const piece of pieces) {
          const a = Math.max(piece.start, door.center - door.width / 2);
          const b = Math.min(piece.end, door.center + door.width / 2);
          const bottom = Math.max(piece.bottom, door.floorY);
          const top = Math.min(piece.top, door.floorY + door.height);
          if (b <= a || top <= bottom) { next.push(piece); continue; }
          next.push({ ...piece, end: a }, { ...piece, start: b },
            { start: a, end: b, bottom: piece.bottom, top: bottom }, { start: a, end: b, bottom: top, top: piece.top });
        }
        pieces = next;
      }
      for (const piece of pieces) {
        addBox({ minX: axis === "x" ? coordinate + Math.min(0, sign * thickness) : piece.start,
          maxX: axis === "x" ? coordinate + Math.max(0, sign * thickness) : piece.end,
          minZ: axis === "z" ? coordinate + Math.min(0, sign * thickness) : piece.start,
          maxZ: axis === "z" ? coordinate + Math.max(0, sign * thickness) : piece.end,
          minY: piece.bottom, maxY: piece.top });
      }
    };
    for (const building of authored.buildings) {
      const body = { ...transform(building), floorY: building.floorY, height: building.height };
      wall(body, "x", body.minX, -1, body.height);
      wall(body, "x", body.maxX, 1, body.height);
      wall(body, "z", body.minZ, -1, body.height);
      wall(body, "z", body.maxZ, 1, body.height);
      if (building.id === "base") {
        const terrace = { ...body, floorY: body.floorY + body.height };
        wall(terrace, "x", body.minX, -1, 0.25); wall(terrace, "x", body.maxX, 1, 0.25);
        wall(terrace, "z", body.minZ, -1, 0.25); wall(terrace, "z", body.maxZ, 1, 0.25);
        for (let x = body.minX; x < body.maxX; x += 1) {
          for (const z of [body.minZ - thickness / 2, body.maxZ + thickness / 2]) {
            addBox({ minX:x, maxX:Math.min(x+0.5,body.maxX),minZ:z-thickness/2,maxZ:z+thickness/2,minY:terrace.floorY+0.25,maxY:terrace.floorY+0.75 });
          }
        }
        for (let z = body.minZ; z < body.maxZ; z += 1) {
          for (const x of [body.minX - thickness / 2, body.maxX + thickness / 2]) {
            addBox({ minX:x-thickness/2,maxX:x+thickness/2,minZ:z,maxZ:Math.min(z+0.5,body.maxZ),minY:terrace.floorY+0.25,maxY:terrace.floorY+0.75 });
          }
        }
      }
    }
    for (const room of spaces) {
      if (room.kind === "room") {
        wall(room, "x", room.minX, -1, room.height);
        wall(room, "x", room.maxX, 1, room.height);
        wall(room, "z", room.minZ, -1, room.height);
        wall(room, "z", room.maxZ, 1, room.height);
      } else if ((room.kind === "wallWalk" || room.kind === "terrace") && !authored.buildings.length) {
        if (room.kind === "wallWalk" && room.floorY > baseY) {
          addBox({ ...room, minY: baseY, maxY: room.floorY - 0.25 });
        }
        const axes = room.maxX - room.minX > room.maxZ - room.minZ ? [["z", room.minZ, -1], ["z", room.maxZ, 1]]
          : [["x", room.minX, -1], ["x", room.maxX, 1]];
        for (const [axis, coordinate, sign] of axes) { wall(room, axis, coordinate, sign, 0.75); }
      }
    }
    for (const area of residential.walkableAreas) {
      addBox({ ...area, minY: area.floorY - 0.25, maxY: area.floorY });
    }
    for (const roof of authored.roofs) {
      const bounds = transform(roof);
      if (roof.shape === "flat") {
        const platform = { ...bounds, floorY: roof.y, height: 0.75 };
        wall(platform, "x", bounds.minX, -1, 0.75);
        wall(platform, "x", bounds.maxX, 1, 0.75);
        wall(platform, "z", bounds.minZ, -1, 0.75);
        wall(platform, "z", bounds.maxZ, 1, 0.75);
      } else {
        const center = world((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, roof.y);
        geometry.decorations.roofs.push({ ...center, yaw, width: bounds.maxX - bounds.minX + 0.5,
          depth: bounds.maxZ - bounds.minZ + 0.5, height: roof.height });
      }
    }
    const roomDoors = [];
    const uniqueDoors = new Set();
    for (const door of residential.doorways) {
      if (door.exteriorEntrance) { continue; }
      const x = door.axis === "x" ? door.coordinate : door.center;
      const z = door.axis === "z" ? door.coordinate : door.center;
      const key = [door.axis, door.floorY, door.coordinate, door.center].join(":");
      if (uniqueDoors.has(key)) { continue; }
      uniqueDoors.add(key);
      roomDoors.push({ ...world(x, z, door.floorY), roomId: door.roomId, width: door.width, height: door.height - 0.05,
        yaw: yaw + { NORTH: 180, SOUTH: 0, WEST: -90, EAST: 90 }[door.side] + (door.swing === "inward" ? 180 : 0), openingInset: 0 });
    }
    return { input: { ...options, doors: adaptedDoors, requestedStyle: options.requestedStyle ?? authored.basePlanId },
      layout: { empty: false, basePlanId: authored.basePlanId, baseY, primarySide: side, widthBlocks: position.width * 4,
        depthBlocks: position.depth * 4, facadeSpan: transverse * 4, castleDepth: inward * 4,
        worldLeft: position.x, worldTop: position.z, style: { id: authored.basePlanId, wallHeightBlocks: 15, towerSpanBlocks: 6 },
        openings: [{ boundary: "FRONT", start: adaptedDoors[0].offset * 4, end: (adaptedDoors[0].offset + adaptedDoors[0].width) * 4 }], roomPlan: residential },
      structure: { wall: { towerSpan: 6, wallHeight: 15 }, towers: [], gatehouses: [], audienceWing: null }, geometry,
      metadata: { runtime: { residential, roomDoors, terrace: null, audienceOpening: null, interiorWidth: rooms.work.maxX - rooms.work.minX,
        interiorDepth: rooms.work.maxZ - rooms.work.minZ }, collision: { blockSize: 0.25, groundCourse: 0,
        groundColumns, cameraBlocks, cameraBlockHalfExtents: { x: 0.125, y: 0.125, z: 0.125 } } } };
  }
}



