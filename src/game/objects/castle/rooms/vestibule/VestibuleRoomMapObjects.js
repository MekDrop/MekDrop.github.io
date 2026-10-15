import { CastleResidentialLayout } from "../../CastleResidentialLayout.js";

/**
 * Publishes arrival furniture through registered map object lifecycles.
 */
export class VestibuleRoomMapObjects {
  /**
   * @param {import("../../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const castle of [...objects]) {
      const plan = castle.object === "Castle" ? castle.buildPlan?.metadata?.runtime?.residential : null;
      if (!plan?.basePlanId) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].vestibuleFurnishing && objects[index].sourceCastleId === castle.id) {
          objects.splice(index, 1);
        }
      }
      for (const [index, authored] of plan.furniture.entries()) {
        let item = authored;
        if (item.role !== "vestibuleProp") { continue; }
        if (item.object === "Rug") {
          const rugs = plan.furniture.filter(/**
           * @param {import("../../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem & {floorY:number}} candidate
           */ candidate => candidate.role === "vestibuleProp" && candidate.object === "Rug" &&
            candidate.floorY === item.floorY && candidate.x === item.x && candidate.rotation === item.rotation);
          if (authored !== rugs[0]) { continue; }
          const start = Math.min(...rugs.map(/**
           * @param {import("../../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem} rug
           */ rug => rug.z - rug.depth * rug.scale / 2));
          const end = Math.max(...rugs.map(/**
           * @param {import("../../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem} rug
           */ rug => rug.z + rug.depth * rug.scale / 2));
          item = { ...item, z: (start + end) / 2, depth: (end - start) / item.scale,
            stretch: { ...item.stretch, z: (end - start) / (3.3 * item.scale) } };
        }
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.y ?? 0));
        objects.push({ id: `${castle.id}-vestibule-${item.roomId}-${index}`, object: item.object, texture: item.texture, model: item.model, variant: item.variant,
          position, rotation: layout.yaw + 180 + (item.rotation ?? 0), scale: item.scale,
          stretch: item.stretch,
          generated: true, vestibuleFurnishing: true, sourceCastleId: castle.id,
          tile: { col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2) } });
      }
    }
  }
}
