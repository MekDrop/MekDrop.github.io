import { CastleResidentialLayout } from "../../castle/residents/CastleResidentialLayout.js";
import { ShelfLayout } from "./ShelfLayout.js";

/**
 * Publishes castle cabinets through the same ownership as authored shelves.
 */
export class CastleShelfMapObjects {
  /**
   * @param {import("../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const castle of objects.filter(CastleShelfMapObjects.#isCastle)) {
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].castleShelf && objects[index].sourceCastleId === castle.id) {
          objects.splice(index, 1);
        }
      }
      let index = 0;
      for (const placement of layout.placements) {
        if (placement.role !== "storageShelf") {
          continue;
        }
        objects.push({
          id: `${castle.id}-storage-shelf-${index++}`,
          object: "Shelf",
          variant: "storage",
          position: { ...placement.position },
          rotation: placement.yaw,
          collisionRotation: layout.yaw,
          scale: placement.scale.x,
          footprint: placement.footprint,
          generated: true,
          castleShelf: true,
          sourceCastleId: castle.id,
          tile: CastleShelfMapObjects.#tile(mapData, placement.position),
        });
      }
      const plan = castle.buildPlan.metadata.runtime.residential;
      const shelves = [];
      if (plan?.version === 2) {
        for (const item of plan.furniture) {
          if (item.role !== "bookshelf") {
            continue;
          }
          shelves.push({
            x: item.x,
            z: item.z,
            length: item.depth * item.scale,
            y: item.floorY - layout.origin.y,
            height: 1.6,
            facing: item.x < 0 ? 1 : -1,
          });
        }
      } else {
        const work = layout.rooms.work;
        const desk = layout.reservations.find(CastleShelfMapObjects.#isDesk);
        const side = (desk.minX + desk.maxX) / 2 > (work.minX + work.maxX) / 2 ? 1 : -1;
        shelves.push({
          x: side > 0 ? work.maxX - 0.24 : work.minX + 0.24,
          z: work.minZ + (work.maxZ - work.minZ) * 0.45,
          length: 0.935,
          y: work.floorY - layout.origin.y,
          height: 1.8,
          facing: -side,
        });
      }
      for (const shelf of shelves) {
        const from = layout.toWorld(shelf.x, shelf.z - shelf.length / 2, shelf.y);
        const to = layout.toWorld(shelf.x, shelf.z + shelf.length / 2, shelf.y);
        if (Math.abs(from.x - to.x) < 1e-6) {
          to.x = from.x;
        } else {
          to.z = from.z;
        }
        const definition = {
          id: `${castle.id}-book-shelf-${index++}`,
          object: "Shelf",
          from,
          to,
          height: shelf.height,
          seed: `${castle.buildPlan.input.seed ?? 0}:${index}`,
          generated: true,
          castleShelf: true,
          sourceCastleId: castle.id,
          tile: CastleShelfMapObjects.#tile(mapData, from),
        };
        const room = layout.rooms.work;
        definition.facing = ShelfLayout.facingToward(definition,
          layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2, 0));
        objects.push(definition);
      }
    }
  }
  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #isCastle(definition) {
    return definition.object === "Castle";
  }
  /**
   * @param {{role:string}} reservation
   */
  static #isDesk(reservation) {
    return reservation.role === "workDesk";
  }
  /**
   * @param {import("../../../GameContracts.js").GameMapData} map
   * @param {import("../../ObjectTypes.js").Point3} position
   */
  static #tile(map, position) {
    return {
      col: Math.round(position.x + (map.cols - 1) / 2),
      row: Math.round(position.z + (map.rows - 1) / 2),
    };
  }
}
