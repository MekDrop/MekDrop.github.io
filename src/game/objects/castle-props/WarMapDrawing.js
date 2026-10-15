import { MAP_TILE_TYPE } from "../../enum/MapTileType.js";

/**
 * Draws a flat, north-up parchment view of the actual generated world.
 */
export class WarMapDrawing {
  /**
   * @param {import("../ObjectTypes.js").GameMapData} map
   * @param {number} [size]
   * @returns {{width:number,height:number,pixels:Uint8ClampedArray}}
   */
  static raster(map, size = 256) {
    const pixels = new Uint8ClampedArray(size * size * 4);
    const margin = 14;
    const ratio = Math.min((size - margin * 2) / Math.max(1, map.cols),
      (size - margin * 2) / Math.max(1, map.rows));
    const left = (size - map.cols * ratio) / 2, top = (size - map.rows * ratio) / 2;
    const rivers = new Set(
      (map.riverData ?? []).flatMap(WarMapDrawing.#flatMapRiver),
    );
    const castles = new Set(
      (map.objects ?? []).filter(WarMapDrawing.#filterItem).map(
        /**
         * @param {import("../ObjectTypes.js").MapObjectDefinition} item
         */
        item => {
          const col = item.tile?.col ?? Math.round(item.position.x + (item.position.width ?? 0) / 2 + (map.cols - 1) / 2);
          const row = item.tile?.row ?? Math.round(item.position.z + (item.position.depth ?? 0) / 2 + (map.rows - 1) / 2);

          return `${col}:${row}`;
        },
      ),
    );
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const col = Math.floor((x - left) / ratio), row = Math.floor((y - top) / ratio);
        let color = [224, 201, 151];
        if (col >= 0 && row >= 0 && col < map.cols && row < map.rows) {
          const tile = map.grid?.[row]?.[col];
          const height = map.heightmap?.[row]?.[col] ?? 0;
          color = tile === MAP_TILE_TYPE.WATER || rivers.has(`${col}:${row}`) ? [88, 136, 154] :
            tile === MAP_TILE_TYPE.PATH ? [149, 108, 66] :
              [135 - Math.min(30, height * 3), 148 - Math.min(35, height * 3), 92];
          if (castles.has(`${col}:${row}`)) { color = [165, 53, 46]; }
        }
        if (x === 7 || y === 7 || x === size - 8 || y === size - 8) { color = [113, 77, 43]; }
        pixels.set([...color, 255], (y * size + x) * 4);
      }
    }

    return {
      width: size,
      height: size,
      pixels,
    };
  }

  /**
   * @param {{cells:Array<{col:number,row:number}>}} river
   */
  static #flatMapRiver(river) {
    return river.cells.map(WarMapDrawing.#mapCell);
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} item
   */
  static #filterItem(item) {
    return item.object === "Castle";
  }

  /**
   * @param {{col:number,row:number}} cell
   */
  static #mapCell(cell) {
    return `${cell.col}:${cell.row}`;
  }
}
