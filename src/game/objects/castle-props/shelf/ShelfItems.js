import { ShelfLayout } from "./ShelfLayout.js";

/**
 * Resolves supplied contents from shelf-local poses into ordinary map objects.
 */
export class ShelfItems {
  /**
   * Items without a pose are spaced across the bottom shelf.
   * @param {import("../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = (mapData.objects ?? []).filter(ShelfItems.#isRetained);
    for (const shelf of objects.filter(ShelfItems.#isShelf)) {
      const storage = shelf.variant === "storage";
      const bounds = storage ? null : ShelfLayout.bounds(shelf);
      const origin = storage ? shelf.position : {
        x: bounds.x,
        y: shelf.from.y,
        z: bounds.z,
      };
      const rotation = storage ? shelf.rotation ?? 0 : bounds.rotation;
      const angle = rotation * Math.PI / 180;
      const scale = storage ? shelf.scale ?? 1 : 1;
      const stretch = shelf.stretch ?? {
        x: 1,
        y: 1,
        z: 1,
      };
      const width = storage ? 0.8 : bounds.length;
      for (const [index, item] of shelf.items.entries()) {
        const pose = item.position ?? {
          x: -width / 2 + width * (index + 1) / (shelf.items.length + 1),
          y: storage ? 0.0825 : 0.0775,
          z: 0,
        };
        const x = pose.x * scale * stretch.x, z = pose.z * scale * stretch.z;
        objects.push({
          ...item,
          id: `${shelf.id}-item-${item.id ?? index}`,
          sourceShelfId: shelf.id,
          shelfItem: true,
          sourceCastleId: shelf.sourceCastleId,
          generated: true,
          tile: shelf.tile,
          position: {
            x: origin.x + Math.cos(angle) * x + Math.sin(angle) * z,
            y: origin.y + pose.y * scale * stretch.y,
            z: origin.z - Math.sin(angle) * x + Math.cos(angle) * z,
          },
          rotation: rotation + (item.rotation ?? 0),
          scale: (item.scale ?? 1) * scale,
        });
      }
    }
    mapData.objects = objects;
  }
  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
   */
  static #isRetained(item) { return !item.shelfItem; }
  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
   */
  static #isShelf(item) { return item.object === "Shelf" && Array.isArray(item.items); }
}
