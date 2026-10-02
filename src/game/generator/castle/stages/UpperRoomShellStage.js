import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";
import { CastleRoomShellBuilder } from "../CastleRoomShellBuilder.js";

/**
 * Builds the planned upper rooms instead of relying on gatehouse leftovers.
 */
export class UpperRoomShellStage extends AbstractCastleGenerationStage {
  /**
   * @param {import("../CastleGenerationContext.js").CastleGenerationContext} context
   */
  async run(context) {
    const plan = context.layout.roomPlan;
    if (!plan) return;
    if (plan.version === 2) {
      await new CastleRoomShellBuilder().build(context);
      return;
    }
    const room = plan.envelope;
    const opening = context.layout.openings.find(
      /**
       * @param {{boundary: string}} entry
       */
      (entry) => entry.boundary === "FRONT",
    );
    const middle = (opening.start + opening.end - 1) / 2;
    const sign = ["WEST", "SOUTH"].includes(context.layout.primarySide) ? -1 : 1;
    const partition = (plan.rooms.stairwell.minX + plan.rooms.stairwell.maxX) / 2 < 0 ? -0.625 : 0.625;
    const bottom = Math.round((room.floorY - context.layout.baseY) / 0.25);
    const top = bottom + 8;
    for (let u = 0; u <= Math.round(room.maxZ / 0.25); u += 1) {
      const z = (u + 0.5) * 0.25;
      for (let v = 0; v < context.layout.facadeSpan; v += 1) {
        const x = sign * (v - middle) * 0.25;
        const outer = Math.abs(x - room.minX + 0.125) < 0.01 ||
          Math.abs(x - room.maxX - 0.125) < 0.01 ||
          Math.abs(z - room.minZ + 0.125) < 0.01 ||
          Math.abs(z - room.maxZ - 0.125) < 0.01;
        const divider = Math.abs(x - partition) < 0.01;
        const inside = x >= room.minX - 0.125 && x <= room.maxX + 0.125 &&
          z >= room.minZ - 0.125 && z <= room.maxZ + 0.125;
        if (!inside) continue;
        for (let y = bottom; y <= top; y += 1) {
          const terraceDoor = Math.abs(z - room.maxZ - 0.125) < 0.01 && Math.abs(x) < 0.5;
          const stairDoor = divider && Math.abs(z - 2.125) < 0.45;
          if (y < top && (terraceDoor || stairDoor)) continue;
          if (outer || divider || y === top) {
            context.planning.writer.addBlock(u, y, v, "roomShell");
          }
        }
      }
    }
    await context.scheduler.yieldIfNeeded(context.yieldState);
  }
}
