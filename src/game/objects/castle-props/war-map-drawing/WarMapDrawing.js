import { IslandObjectRoots } from "../../shared/IslandObjectRoots.js";
import { MAP_TILE_TYPE } from "../../../enum/MapTileType.js";

/**
 * Draws a flat, north-up parchment view of the actual generated world.
 */
export class WarMapDrawing {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("../../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   * @type {import("playcanvas").Texture}
   */
  #texture;
  /**
   * @type {import("playcanvas").StandardMaterial}
   */
  #material;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({ pc, app, definition, runtime = {} }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(definition.id + " island ownership");
    this.#visual = new pc.Entity(definition.id + " WarMapDrawing");
    this.#visual.tags.add("map-object", definition.id, WarMapDrawing.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const { x, y, z } = definition.position;
    this.#visual.setLocalPosition(x, y, z);
    this.#visual.setLocalEulerAngles(definition.tilt?.x ?? 0, definition.rotation ?? 0, definition.tilt?.z ?? 0);
    const scale = definition.scale ?? 1;
    this.#visual.setLocalScale((definition.width ?? 0.47) * scale * (definition.stretch?.x ?? 1), 1,
      (definition.depth ?? 0.8625) * scale * (definition.stretch?.z ?? 1));
    const raster = WarMapDrawing.raster(runtime.mapData ?? {
      rows: 0,
      cols: 0,
    });
    const canvas = document.createElement("canvas");
    canvas.width = raster.width;
    canvas.height = raster.height;
    canvas.getContext("2d").putImageData(new ImageData(raster.pixels, raster.width, raster.height), 0, 0);
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: "Current world parchment",
      mipmaps: true,
    });
    this.#texture.setSource(canvas);
    this.#material = new pc.StandardMaterial();
    this.#material.diffuseMap = this.#texture;
    this.#material.gloss = 0;
    this.#material.update();
    this.#visual.addComponent("render", {
      type: "plane",
      material: this.#material,
      castShadows: false,
    });
  }

  get entity() {
    return this.#entity;
  }
  get definition() {
    return this.#definition;
  }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() {
    return [this.#visual];
  }
  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#islandRoots.setOffsets(near, far, offsets);
  }
  destroy() {
    this.#entity.destroy();
    this.#material.destroy();
    this.#texture.destroy();
  }

  /**
   * @param {import("../../ObjectTypes.js").GameMapData} map
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
         * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
         */
        item => {
          const position = item.buildPlan?.input.position ?? item.position;
          const col = item.tile?.col ?? Math.round(position.x + (position.width ?? 0) / 2 + (map.cols - 1) / 2);
          const row = item.tile?.row ?? Math.round(position.z + (position.depth ?? 0) / 2 + (map.rows - 1) / 2);

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
          if (castles.has(`${col}:${row}`)) {
            color = [165, 53, 46];
          }
        }
        if (x === 7 || y === 7 || x === size - 8 || y === size - 8) {
          color = [113, 77, 43];
        }
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
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
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
