import { RoomFurnishingChoices } from "../RoomFurnishingChoices.js";

/**
 * Varies the loose detail on the authored storeroom's exposed crate tops.
 */
export class AuthoredStorageSupplies {
  /**
   * @param {import("../../../../objects/ObjectTypes.js").MapObjectDefinition[]} objects
   * @param {string|number} [seed]
   * @returns {import("../../../../objects/ObjectTypes.js").MapObjectDefinition[]}
   */
  static furnish(objects, seed = 0) {
    const result = structuredClone(objects);
    AuthoredStorageSupplies.#arrangeRacks(result, seed);
    const linens = result.find(AuthoredStorageSupplies.#isLinens);
    const supports = result.filter(AuthoredStorageSupplies.#isExposedCrate);
    if (!linens || !supports.length) {
      return result;
    }
    const room = {
      id: linens.roomId ?? "storeroom",
      level: 0,
    };
    const support = RoomFurnishingChoices.order(supports, room, "stored-linens-support", seed)[0];
    const offset = RoomFurnishingChoices.order([-0.05, 0, 0.05], room, "stored-linens-offset", seed)[0];
    linens.position = {
      x: support.position.x + offset,
      y: support.position.y + 0.4702 * (support.scale ?? 1),
      z: support.position.z,
    };
    linens.rotation = RoomFurnishingChoices.order([0, 90, 180, 270], room, "stored-linens-rotation", seed)[0];
    linens.authoredStorageSupply = true;

    return result;
  }

  /**
   * The two authored three-metre storerooms share this inventory. The alternate
   * layout puts racks on the opposite solid wall and supplies on the vacated wall.
   * Keep the reserve crate stack beside the door, outside both rack approaches.
   * @param {import("../../../../objects/ObjectTypes.js").MapObjectDefinition[]} objects
   * @param {string|number} seed
   */
  static #arrangeRacks(objects, seed) {
    const racks = objects.filter(AuthoredStorageSupplies.#isRack);
    if (racks.length !== 2) {
      return;
    }
    const room = {
      id: "storeroom",
      level: 0,
    };
    const opposite = RoomFurnishingChoices.order([false, true], room, "storage-rack-wall", seed)[0];
    // Both layouts must replace legacy fixed records in saved test maps.
    for (const item of objects) {
      if (AuthoredStorageSupplies.#isRack(item) || AuthoredStorageSupplies.#isLooseSupply(item)) {
        item.authoredStorageSupply = true;
      }
    }
    if (!opposite) {
      return;
    }
    const northZ = racks[0].position.z;
    const westX = racks[0].position.x - 1.7;
    for (const [index, rack] of racks.entries()) {
      rack.position.x = westX + 2.7 + index * 1.6;
      rack.position.z = northZ + 2.25;
      rack.rotation = 180;
    }
    let slot = 0;
    for (const item of objects) {
      if (!AuthoredStorageSupplies.#isLooseSupply(item)) {
        continue;
      }
      item.position.x = westX + 1.5 + slot * 0.8;
      item.position.z = northZ + 0.075;
      slot++;
    }
  }

  /**
   * @param {import("../../../../objects/ObjectTypes.js").MapObjectDefinition} item
   * @returns {boolean}
   */
  static #isRack(item) {
    return item.object === "Shelf" && ["store-rack-1", "store-rack-2"].includes(item.id);
  }

  /**
   * @param {import("../../../../objects/ObjectTypes.js").MapObjectDefinition} item
   * @returns {boolean}
   */
  static #isLooseSupply(item) {
    return ["store-crate-1", "store-crate-2", "store-barrel-1", "store-barrel-2",
      "store-reserve-barrel", "store-pottery"].includes(item.id);
  }

  /**
   * @param {import("../../../../objects/ObjectTypes.js").MapObjectDefinition} item
   * @returns {boolean}
   */
  static #isLinens(item) {
    return item.id === "store-reserve-linens";
  }

  /**
   * @param {import("../../../../objects/ObjectTypes.js").MapObjectDefinition} item
   * @returns {boolean}
   */
  static #isExposedCrate(item) {
    return item.object === "Crate" &&
      ["store-reserve-crate-2", "store-reserve-crate-top"].includes(item.id);
  }
}
