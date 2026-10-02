import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

/**
 * Second pass: furniture uses final room bounds and leaves doorways clear.
 */
export class RoomFurnishingStage extends AbstractCastleGenerationStage {
  /**
   * @param {import("../CastleGenerationContext.js").CastleGenerationContext} context
   */
  async run(context) {
    const plan = context.layout.roomPlan;
    if (!plan) { return; }
    plan.furniture = [];
    for (const generator of context.planning.roomGenerators) {
      const room = plan.placedRooms.find(/**
       *
       * @param {import("../rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} candidate
       */
      (candidate) => candidate.id === generator.id);
      if (!room) { continue; }
      for (const item of generator.furnish(room)) {
        const halfX = item.width * item.scale / 2;
        const halfZ = item.depth * item.scale / 2;
        if (item.x - halfX < room.minX || item.x + halfX > room.maxX ||
          item.z - halfZ < room.minZ || item.z + halfZ > room.maxZ) { continue; }
        if ((plan.stair || plan.serviceStair) && room.minX <= plan.shaft.minX && room.maxX >= plan.shaft.maxX &&
          item.x + halfX > plan.shaft.minX - 0.25 && item.x - halfX < plan.shaft.maxX + 0.25 &&
          item.z + halfZ > plan.shaft.minZ - 0.25 && item.z - halfZ < plan.shaft.maxZ + 0.25) { continue; }
        const blockedEntrance = plan.doorways.some(/**
         * @param {{roomId:string,axis:string,coordinate:number,center:number,width:number,floorY:number}} door
         */
        (door) => door.roomId === room.id && door.floorY === room.floorY &&
          (door.axis === "x" ? Math.abs(item.x - door.coordinate) < halfX + door.width + 0.25 &&
            Math.abs(item.z - door.center) < halfZ + door.width / 2 + 0.2 :
            Math.abs(item.z - door.coordinate) < halfZ + door.width + 0.25 &&
            Math.abs(item.x - door.center) < halfX + door.width / 2 + 0.2));
        if (blockedEntrance) { continue; }
        plan.furniture.push({ ...item, roomId: room.id, floorY: room.floorY });
      }
    }
    await context.scheduler.yieldIfNeeded(context.yieldState);
  }
}
