import { ObjectDataCache } from "../../../cache/ObjectDataCache.js";
import { ShelfBooks } from "../shelf/ShelfBooks.js";
import { ShelfLayout } from "../shelf/ShelfLayout.js";

/**
 * Publishes individual shelf volumes as map objects.
 */
export class BookMapObjects {

  /**
   * @param {import("../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = (mapData.objects ?? []).filter(
      BookMapObjects.#filterDefinition,
    );
    // Iterate a snapshot: newly generated volumes are ordinary map records.
    for (const shelf of objects.filter(BookMapObjects.#filterDefinition2)) {
      if (shelf.books === false && !shelf.booksAsObjects) {
        continue;
      }
      objects.push(...this.forShelf(shelf));
      shelf.books = false;
      shelf.booksAsObjects = true;
    }
    mapData.objects = objects;
  }

  /**
   * Preserve the cabinet's packing, module scaling, and cardinal orientation.
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} shelf
   * @returns {import("../../ObjectTypes.js").MapObjectDefinition[]}
   */
  static forShelf(shelf) {
    const bounds = ShelfLayout.bounds(shelf);
    const count = Math.max(1, Math.ceil(bounds.length / 0.935 - 1e-9));
    const length = bounds.length / count;
    const scaleX = length / 0.85;
    const alongX = shelf.from.x !== shelf.to.x;
    const angle = bounds.rotation * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const frontOffset = shelf.facing === -1 ? 0.01 : -0.01;
    const rows = Math.max(1, Math.round((bounds.height - 0.0775) / 0.35));
    const spacing = (bounds.height - 0.0775) / rows;
    const levels = Array.from({ length: rows }, /**
     *
     * @param {undefined} _
     * @param {number} row
     */
      (_, row) => ({
        bottom: 0.0775 + row * spacing,
        height: spacing - 0.055,
      }));
    const seed = String(shelf.seed ?? shelf.id);
    const layouts = ObjectDataCache.resolve("books", {
      seed,
      count,
      levels,
    }, () => this.#layouts(seed, count, levels));
    const books = [];
    for (let module = 0; module < count; module++) {
      const offset = -bounds.length / 2 + (module + 0.5) * length;
      for (const book of layouts[module]) {
        const x = book.position.x * scaleX, z = book.position.z;
        const horizontal = book.tilt.z === 90;
        books.push({
          ...book,
          id: `${shelf.id}-${module}-${book.id}`,
          sourceShelfId: shelf.id,
          sourceCastleId: shelf.sourceCastleId,
          generated: true,
          tile: shelf.tile,
          position: {
            x: bounds.x + (alongX ? offset : frontOffset) + cosine * x + sine * z,
            y: shelf.from.y + book.position.y,
            z: bounds.z + (alongX ? frontOffset : offset) - sine * x + cosine * z,
          },
          rotation: bounds.rotation,
          stretch: {
            x: book.stretch.x * (horizontal ? 1 : scaleX),
            y: book.stretch.y * (horizontal ? scaleX : 1),
            z: book.stretch.z,
          },
        });
      }
    }

    return books;
  }

  /**
   * @param {string} seed
   * @param {number} count
   * @param {{bottom:number,height:number}[]} levels
   * @returns {import("../../ObjectTypes.js").MapObjectDefinition[][]}
   */
  static #layouts(seed, count, levels) {
    let state = 2166136261;
    for (const character of seed) {
      state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

      return state / 4294967296;
    };

    return Array.from({ length: count }, () => ShelfBooks.layout(random, levels));
  }

  /**
   *
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return !definition.sourceShelfId || definition.shelfItem;
  }

  /**
   *
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition2(definition) {
    return definition.object === "Shelf" && definition.variant !== "storage" && !definition.items;
  }
}
