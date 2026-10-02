import { GenerationRandom } from "../../map/GenerationRandom.js";
import { createCastleRoomDoorways } from "../CastleRoomDoorways.js";
import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";
import { CastleRoomPacker } from "../CastleRoomPacker.js";
import { ThroneRoomGenerator } from "../rooms/ThroneRoomGenerator.js";
import { LibraryRoomGenerator } from "../rooms/LibraryRoomGenerator.js";
import { ServiceRoomGenerator } from "../rooms/ServiceRoomGenerator.js";
import { LeisureRoomGenerator } from "../rooms/LeisureRoomGenerator.js";
import { StairwellRoomGenerator } from "../rooms/StairwellRoomGenerator.js";
import { TowerRoomGenerator } from "../rooms/TowerRoomGenerator.js";
import { CastlePlacementError } from "../../../errors/castle/index.js";

/**
 * Plans occupied areas before masonry or furniture.
 */
export class RoomPlanningStage extends AbstractCastleGenerationStage {
  /**
   * @param {import("../CastleGenerationContext.js").CastleGenerationContext} context
   */
  async run(context) {
    if (context.layout.empty) { return; }
    const { position, doors, seed } = context.input;
    const { facadeSpan, castleDepth, baseY, primarySide, style } = context.layout;
    const door = doors[0];
    const along = door.offset + door.width / 2;
    const origins = {
      NORTH: { x: position.x + along, z: position.z },
      SOUTH: { x: position.x + along, z: position.z + position.depth },
      WEST: { x: position.x, z: position.z + along },
      EAST: { x: position.x + position.width, z: position.z + along },
    };
    const yaw = { NORTH: 0, SOUTH: 180, WEST: 90, EAST: -90 }[primarySide];
    const origin = { ...origins[primarySide], y: baseY, yaw };
    const sign = ["WEST", "SOUTH"].includes(primarySide) ? -1 : 1;
    const a = sign * -along;
    const b = sign * (facadeSpan / 4 - along);
    const outerBounds = { minX: Math.min(a, b) + 0.5, maxX: Math.max(a, b) - 0.5,
      minZ: 0.5, maxZ: castleDepth / 4 - 0.5 };
    const rise = (style.wallHeightBlocks + 1) / 4;
    const generators = context.planning.roomGenerators ?? [new ThroneRoomGenerator(), new LibraryRoomGenerator(),
      new ServiceRoomGenerator(), new LeisureRoomGenerator({ courtyard: true }),
      ...[1, 2, 3, 4].map(/**
       *
       * @param {number} index
       */
      (index) => new TowerRoomGenerator(index))];
    let packer = null;
    let bestScore = -Infinity;
    // Bounded seeded retries reconsider earlier room sizes and positions before
    // accepting overflow. Room priority stays fixed in every arrangement.
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = new CastleRoomPacker(outerBounds, baseY, rise,
        `${seed ?? "default"}:arrangement:${attempt}`, attempt > 0);
      candidate.place(generators);
      const score = generators.reduce(/**
       *
       * @param {number} value
       * @param {import("../rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator} generator
       * @param {number} index
       */
      (value, generator, index) => {
        const room = candidate.rooms.find(/**
         *
         * @param {{id:string}} entry
         */
        (entry) => entry.id === generator.id);
        return value + (room ? 2 ** (generators.length - index) * 1000 +
          (room.level === 0 ? 100 : 0) : 0);
      }, 0);
      if (score > bestScore) { packer = candidate; bestScore = score; }
      await context.scheduler.yieldIfNeeded(context.yieldState);
    }
    if (!context.planning.roomGenerators && packer.skipped.includes("leisure")) {
      packer.skipped = packer.skipped.filter(/**
       *
       * @param {string} id
       */
      (id) => id !== "leisure");
      generators[3] = new LeisureRoomGenerator();
      packer.place([generators[3]]);
      packer.rooms.sort(/**
       *
       * @param {{id:string}} a
       * @param {{id:string}} b
       */
      (a, b) => generators.findIndex(/**
       *
       * @param {{id:string}} entry
       */
      (entry) => entry.id === a.id) -
        generators.findIndex(/**
         *
         * @param {{id:string}} entry
         */
        (entry) => entry.id === b.id));
    }
    packer.extendRooms(generators);
    for (const room of packer.rooms) {
      if (room.level === 0 && room.floorSpan === 1 && room.id !== "leisure") room.height = rise - 0.25;
    }
    const throne = packer.rooms.find(/**
     *
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */
    (room) => room.id === "throneRoom");
    if (!throne) { throw new CastlePlacementError(); }
    const hasUpper = packer.rooms.some(/**
     *
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */
    (room) => !room.stairHost && room.level + room.floorSpan > 1);
    const hasBasement = packer.rooms.some(/**
     *
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */
    (room) => room.level === -1);
    const hostRoom = packer.rooms.find(/**
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */
    (room) => room.id === packer.stairHostRoomId);
    if (hostRoom && !hasUpper) { hostRoom.floorSpan = 1; hostRoom.height = rise - 0.25; }
    const shaft = packer.shaft;
    const centerX = (shaft.minX + shaft.maxX) / 2;
    const centerZ = (shaft.minZ + shaft.maxZ) / 2;
    const radians = yaw * Math.PI / 180;
    /**
     * @param {number} x
     * @param {number} z
     * @param {number} [y]
     */
    const toWorld = (x, z, y = baseY) => ({ x: origin.x + Math.cos(radians) * x + Math.sin(radians) * z,
      y, z: origin.z - Math.sin(radians) * x + Math.cos(radians) * z });
    const upperOccupant = packer.rooms.find(/**
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */
    (room) => !room.stairHost && (room.level === 1 || room.floorSpan === 2));
    const basementOccupant = packer.rooms.find(/**
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */
    (room) => room.level === -1);
    const mainConnection = new StairwellRoomGenerator("mainStair").connect(hostRoom,
      upperOccupant ? { ...upperOccupant, level: 1, floorY: baseY + rise } : null, shaft);
    const basementConnection = new StairwellRoomGenerator("serviceStair").connect(basementOccupant, hostRoom, shaft);
    const stair = { ...toWorld(centerX, centerZ), radius: 1.5 };
    const rooms = Object.fromEntries(packer.rooms.map(/**
     *
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
     */
    (room) => [room.id, room]));
    const upperHall = { ...outerBounds, floorY: baseY + rise, purpose: "upper hall" };
    rooms.work = throne;
    rooms.bedroom = upperHall;
    rooms.balcony = rooms.leisure ?? { ...outerBounds, minZ: outerBounds.maxZ, floorY: baseY + rise, purpose: "unused" };
    rooms.servantBedroom = rooms.service;
    rooms.storage = rooms.service;
    const walkableAreas = [{ id: "castleGroundFloor", ...outerBounds, floorY: baseY },
      { id: "mainDoorThreshold", minX: -door.width / 2, maxX: door.width / 2, minZ: -0.25, maxZ: 0.75, floorY: baseY }];
    for (const [index, entry] of doors.slice(1).entries()) {
      const along = entry.offset + entry.width / 2;
      const centers = {
        NORTH: { x: position.x + along, z: position.z },
        SOUTH: { x: position.x + along, z: position.z + position.depth },
        WEST: { x: position.x, z: position.z + along },
        EAST: { x: position.x + position.width, z: position.z + along },
      };
      const point = centers[entry.side];
      const dx = point.x - origin.x;
      const dz = point.z - origin.z;
      const x = Math.cos(radians) * dx - Math.sin(radians) * dz;
      const z = Math.sin(radians) * dx + Math.cos(radians) * dz;
      const crosswise = ["WEST", "EAST"].includes(entry.side) !== ["WEST", "EAST"].includes(primarySide);
      walkableAreas.push({ id: `secondaryDoor${index}Threshold`,
        minX: x - (crosswise ? 0.75 : entry.width / 2), maxX: x + (crosswise ? 0.75 : entry.width / 2),
        minZ: z - (crosswise ? entry.width / 2 : 0.75), maxZ: z + (crosswise ? entry.width / 2 : 0.75), floorY: baseY });
    }
    if (hasUpper) { walkableAreas.push({ id: "upperHall", ...outerBounds, floorY: baseY + rise }); }
    if (hasBasement) { walkableAreas.push({ id: "basementHall", ...outerBounds, floorY: baseY - 2.5 }); }
    const basement = hasBasement ? { ...toWorld((outerBounds.minX + outerBounds.maxX) / 2,
      (outerBounds.minZ + outerBounds.maxZ) / 2), width: outerBounds.maxX - outerBounds.minX,
      depth: outerBounds.maxZ - outerBounds.minZ, floorY: baseY - 2.5, ceilingY: baseY - 0.25, yaw } : null;
    context.layout.roomPlan = { version: 2, origin, outerBounds, rooms, stairHostRoomId: packer.stairHostRoomId, placedRooms: packer.rooms,
      skippedRooms: packer.skipped, subrooms: [mainConnection, basementConnection].filter(Boolean), roomRequirements: generators.map(/**
     * @param {import("../rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator} generator
     */
    (generator) => ({ id: generator.id, min: generator.min, ...(generator.max ? { max: generator.max } : {}) })), walkableAreas, stair: mainConnection ? { ...stair, subroomId: mainConnection.id } : null,
      serviceStair: basementConnection ? { ...stair, y: basementConnection.floorY, subroomId: basementConnection.id } : null, basement,
      upperRoom: hasUpper ? { ...toWorld(0, centerZ), width: outerBounds.maxX - outerBounds.minX,
        depth: outerBounds.maxZ - outerBounds.minZ, height: 2.25 } : null,
      gatehouseDepth: 0.5, shaft, rise, reservations: {
        throne: { ...throne, minY: 0, maxY: 2.5 },
        ...(hasUpper ? { mainStair: { ...shaft, minY: 0, maxY: rise + 2 } } : {}),
        ...(hasBasement ? { serviceStair: { ...shaft, minY: -2.5, maxY: 1.5 } } : {}),
      } };
    context.layout.roomPlan.doorways = createCastleRoomDoorways(context.layout.roomPlan);
    context.planning.roomGenerators = generators;
    await context.scheduler.yieldIfNeeded(context.yieldState);
  }
}
