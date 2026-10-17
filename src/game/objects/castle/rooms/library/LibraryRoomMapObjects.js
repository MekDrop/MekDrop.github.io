import { CastleResidentialLayout } from "../../residents/CastleResidentialLayout.js";
import { ShelfLayout } from "../../../castle-props/shelf/ShelfLayout.js";

/**
 * Publishes room-authored study furniture through registered object lifecycles.
 */
export class LibraryRoomMapObjects {
  /**
   * @param {import("../../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    for (const castle of objects.filter(
      LibraryRoomMapObjects.#filterDefinition,
    )) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.basePlanId) {
        continue;
      }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      const prefix = `${castle.id}-library-`;
      // Repeated preparation replaces generated records rather than duplicating them.
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].libraryFurnishing && objects[index].sourceCastleId === castle.id) {
          objects.splice(index, 1);
        }
      }
      const counts = new Map();
      for (const item of plan.furniture) {
        if (item.role !== "libraryProp") {
          continue;
        }
        const roomKey = `${item.roomId}:${item.floorY - layout.origin.y}`;
        const index = counts.get(roomKey) ?? 0;
        counts.set(roomKey, index + 1);
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.y ?? 0));
        const rotation = layout.yaw + 180 + (item.rotation ?? 0);
        const definition = {
          id: `${prefix}${roomKey}-${index}`,
          object: item.object,
          variant: item.variant,
          ...item.properties,
          position,
          rotation,
          generated: true,
          libraryFurnishing: true,
          sourceCastleId: castle.id,
          tile: {
            col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2),
          },
        };
        if (item.object === "Shelf") {
          const angle = rotation * Math.PI / 180;
          const length = item.rotation % 180 ? item.depth : item.width;
          const localAngle = item.rotation * Math.PI / 180;
          for (const neighbour of plan.furniture) {
            if (neighbour === item || neighbour.object !== "Shelf" || neighbour.roomId !== item.roomId || neighbour.floorY !== item.floorY || neighbour.rotation !== item.rotation) {
              continue;
            }
            const dx = neighbour.x - item.x, dz = neighbour.z - item.z;
            // Model orientation includes the castle's 180-degree correction.
            const along = -dx * Math.cos(localAngle) + dz * Math.sin(localAngle);
            const across = dx * Math.sin(localAngle) + dz * Math.cos(localAngle);
            const otherLength = neighbour.rotation % 180 ? neighbour.depth : neighbour.width;
            if (Math.abs(across) < 0.01 && Math.abs(Math.abs(along) - (length + otherLength) / 2) < 0.01) {
              if (along < 0) {
                definition.joinStart = true;
              } else {
                definition.joinEnd = true;
              }
            }
          }
          definition.from = {
            x: position.x - Math.cos(angle) * length / 2,
            y: position.y,
            z: position.z + Math.sin(angle) * length / 2,
          };
          definition.to = {
            x: position.x + Math.cos(angle) * length / 2,
            y: position.y,
            z: position.z - Math.sin(angle) * length / 2,
          };
          // Exact cardinal coordinates keep the shelf range unambiguous.
          if (Math.abs(Math.cos(angle)) < 0.5) {
            definition.from.x = definition.to.x = position.x;
          } else {
            definition.from.z = definition.to.z = position.z;
          }
          const room = plan.spaces.find(/**
           * @param {import("../../../../generator/castle/CastleBasePlanGenerator.js").CompiledCastleSpace} space
           */
            space => space.id === item.roomId && space.floorY === item.floorY) ?? layout.rooms.work;
          const center = layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2, 0);
          definition.facing = ShelfLayout.facingToward(definition, center);
          definition.height = item.height;
          definition.seed = `${castle.buildPlan.input.seed ?? 0}:${roomKey}:${index}`;
        }
        objects.push(definition);
      }
    }
    mapData.objects = objects;
  }

  /**
   *
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return definition.object === "Castle";
  }
}
