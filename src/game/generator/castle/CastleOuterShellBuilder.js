import { CASTLE_BOUNDARY } from "../../enum/CastleBoundary.js";

/**
 * Builds the packed castle exterior and exposed brick tops.
 */
export class CastleOuterShellBuilder {
  /**
   * @param {import("./CastleGenerationContext.js").CastleGenerationContext} context
   * @param {import("./CastleBuildPlanWriter.js").CastleBuildPlanWriter} writer
   */
  async build(context, writer) {
  const { castleDepth, facadeSpan, wallHeight, battlementPeriod } = context.structure.wall;
  const plan = context.layout.roomPlan;
  const opening = context.layout.openings.find(/**
   * @param {{boundary:string}} entry
   */ (entry) => entry.boundary === CASTLE_BOUNDARY.FRONT);
  const middle = (opening.start + opening.end - 1) / 2;
  const sign = ["WEST", "SOUTH"].includes(context.layout.primarySide) ? -1 : 1;
  for (let u = 0; u < castleDepth; u++) {
    for (let v = 0; v < facadeSpan; v++) {
      const boundary = u < 2 ? CASTLE_BOUNDARY.FRONT : u >= castleDepth - 2 ? CASTLE_BOUNDARY.BACK : v < 2 ? CASTLE_BOUNDARY.LEFT : v >= facadeSpan - 2 ? CASTLE_BOUNDARY.RIGHT : null;
      const horizontal = boundary === CASTLE_BOUNDARY.FRONT || boundary === CASTLE_BOUNDARY.BACK ? v : u;
      if (boundary && writer.openingAt(boundary, horizontal, 0)) {
        writer.addBlock(u, -1, v, "roomShell");
      }
      for (let y = 0; y <= wallHeight; y++) {
        if (boundary && !writer.openingAt(boundary, horizontal, y)) {
          writer.addBlock(u, y, v, y === 2 || y === wallHeight ? "trim" : "stone");
        }
        if (!boundary && y === wallHeight) {
          const x = sign * (v - middle) / 4;
          const z = (u + 0.5) / 4;
          const upperY = plan.origin.y + plan.rise;
          const roomFloor = plan.placedRooms.some(/**
           * @param {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
           */ (room) => room.id !== "leisure" && upperY >= room.floorY && upperY < room.floorY + room.height &&
            x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ);
          // Exposed tops are ordinary masonry; room timber replaces bricks.
          const leisure = plan.rooms.leisure;
          const openTerrace = leisure && leisure.floorY < upperY && x >= leisure.minX && x <= leisure.maxX &&
            z >= leisure.minZ && z <= leisure.maxZ;
          if (!roomFloor && !openTerrace) { writer.addBlock(u, y, v); }

        }
      }
      if (boundary && !(plan.stair && !plan.placedRooms.some(/**
       * @param {{id:string}} room
       */ (room) => room.id.startsWith("tower")))) {
        for (let guard = 1; guard <= 4; guard++) {
          if (guard <= 2 || (u + v) % battlementPeriod === 0) {
            writer.addBlock(u, wallHeight + guard, v, "trim");
          }
        }
      }
    }
  }
  await context.scheduler.yieldIfNeeded(context.yieldState);
  }
}
