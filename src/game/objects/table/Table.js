import modelUrl from "../../models/castle/props/kitchen-table.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { WarMapDrawing } from "../castle-props/WarMapDrawing.js";

/**
 * A dimensioned table with an optional map of its current world.
 */
export class Table extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").Texture}
   */
  #texture;
  /**
   * @type {import("playcanvas").StandardMaterial}
   */
  #material;
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application,modelLibrary:import("../../models/GameModelLibrary.js").GameModelLibrary,definition:import("../ObjectTypes.js").MapObjectDefinition,runtime?:import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor(options) {
    const definition = Table.definitionFor(options.definition);
    super({
      ...options,
      definition,
    });

    if (!definition.worldMap) { return; }
    const { pc, app, runtime = {} } = options;
    const raster = WarMapDrawing.raster(runtime.mapData ?? {
      rows: 0,
      cols: 0,
      grid: [],
      heightmap: [],
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
    const paper = new pc.Entity("Flat current-world map");
    paper.addComponent("render", {
      type: "plane",
      material: this.#material,
      castShadows: false,
    });
    paper.setLocalPosition(0, (definition.height + 0.003) * (definition.scale ?? 1) * (definition.stretch?.y ?? 1), 0);
    paper.setLocalScale(definition.width * 0.75 * (definition.scale ?? 1) * (definition.stretch?.x ?? 1), 1, definition.depth * 0.69 * (definition.scale ?? 1) * (definition.stretch?.z ?? 1));
    this.visualRoots[0].addChild(paper);
  }
  /**
   * Resolve old saved-map names into dimensions on the shared timber model.
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {import("../ObjectTypes.js").MapObjectDefinition}
   */
  static definitionFor(definition) {
    const defaults = {
      LibrarySideTable: [0.6841, 0.55, 0.6162],
      VestibuleMapTable: [1.8, 1, 1],
      TeaTable: [1.25, 1.0622, 1.25],
    }[definition.object] ?? [0.6271365, 0.56465894, 1.25];
    return {
      ...definition,
      object: Table.name,
      width: definition.width ?? defaults[0],
      height: definition.height ?? defaults[1],
      depth: definition.depth ?? defaults[2],
      worldMap: definition.worldMap ?? ["WarMapTable", "VestibuleMapTable"].includes(definition.object),
    };
  }

  /**
   * Size both visible timber and authored collision from the same definition.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { width, height, depth, scale = 1, stretch = {
      x: 1,
      y: 1,
      z: 1,
    } } = this.definition;
    model.setLocalScale(width / 0.6271365 * scale * stretch.x,
      height / 0.56465894 * scale * stretch.y, depth / 1.25 * scale * stretch.z);
  }

  destroy() {
    super.destroy();
    this.#material?.destroy();
    this.#texture?.destroy();
  }
}
