import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";
import { CastleResidentialLayout } from "../../../objects/castle/CastleResidentialLayout.js";
import { CastleStairwellPlacementError } from "../../../errors/castle/index.js";

/**
 * Plans occupied rooms and their connecting stairwell before masonry.
 */
export class RoomPlanningStage extends AbstractCastleGenerationStage {
  /**
   * @param {import("../CastleGenerationContext.js").CastleGenerationContext} context
   */
  async run(context) {
    if (context.layout.empty) {
      return;
    }
    const opening = context.layout.openings.find(
      /**
       * @param {{boundary: string}} candidate
       */
      (candidate) => candidate.boundary === "FRONT",
    );
    if (!opening) {
      return;
    }
    const middle = (opening.start + opening.end - 1) / 2;
    const width = Math.min(middle * 0.25 - 0.375,
      (context.layout.facadeSpan - 1 - middle) * 0.25 - 0.375) * 2;
    const runtime = { interiorWidth: width, audienceOpening: opening };
    const original = new CastleResidentialLayout({ input: context.input,
      layout: context.layout, metadata: { runtime } });
    const radius = 1.2;
    const lateralSign = ["WEST", "SOUTH"].includes(context.layout.primarySide) ? -1 : 1;
    const edges = [lateralSign * (-middle - 0.5) * 0.25,
      lateralSign * (context.layout.facadeSpan - middle - 0.5) * 0.25];
    const minX = Math.min(...edges) + 0.5;
    const maxX = Math.max(...edges) - 0.5;
    const stairSide = -minX >= maxX ? -1 : 1;
    const centerX = stairSide * (0.8 + radius);
    const centerZ = 0.35 + radius;
    const roomEnd = centerZ + radius + 0.25;
    // Preserve the audience room and its throne/carpet formulas exactly.
    // Reject an undersized footprint instead of shrinking a walkable stair.
    if (centerX - radius < minX || centerX + radius > maxX || original.rooms.work.maxZ < roomEnd + 0.5) {
      throw new CastleStairwellPlacementError();
    }
    const upper = { minX, maxX,
      minZ: 0.25, maxZ: roomEnd, floorY: original.rooms.bedroom.floorY, purpose: "terrace access" };
    context.layout.roomPlan = {
      origin: { ...original.origin, yaw: original.yaw },
      envelope: upper,
      gatehouseDepth: roomEnd + 0.25,
      upperRoom: { ...original.toWorld((minX + maxX) / 2, (upper.minZ + upper.maxZ) / 2),
        width: maxX - minX, depth: upper.maxZ - upper.minZ, height: 2 },
      stair: { ...original.toWorld(centerX, centerZ), radius },
      upperDoor: { ...original.toWorld(stairSide * 0.625, 2.125, upper.floorY - original.origin.y),
        yaw: original.yaw + 90, width: 0.9, height: 2 },
      serviceStair: original.toWorld(width / 2 - 0.65, original.rooms.work.maxZ - 0.8),
      basement: { ...original.toWorld(0, (original.rooms.storage.minZ + original.rooms.storage.maxZ) / 2),
        width, depth: original.rooms.storage.maxZ - original.rooms.storage.minZ,
        floorY: original.basement.floorY, ceilingY: original.origin.y - 0.25, yaw: original.yaw },
      walkableAreas: [{ id: "terraceDoorThreshold", minX: -0.6, maxX: 0.6,
        minZ: roomEnd - 0.2, maxZ: roomEnd + 0.45, floorY: upper.floorY },
        { id: "stairwellDoorThreshold", minX: stairSide < 0 ? -0.85 : 0.2,
          maxX: stairSide < 0 ? -0.2 : 0.85, minZ: 1.675, maxZ: 2.575, floorY: upper.floorY }],
      balcony: { startDepth: roomEnd + 0.25, endDepth: original.rooms.work.maxZ },
      rooms: {
        work: original.rooms.work,
        servantBedroom: original.rooms.servantBedroom,
        storage: original.rooms.storage,
        bedroom: { ...upper, minX: stairSide < 0 ? -0.5 : upper.minX,
          maxX: stairSide > 0 ? 0.5 : upper.maxX },
        stairwell: { minX: centerX - radius, maxX: centerX + radius,
          minZ: centerZ - radius, maxZ: centerZ + radius,
          floorY: original.origin.y, purpose: "spiral stairwell", ceilingY: upper.floorY + 2 },
      },
    };
  }
}
