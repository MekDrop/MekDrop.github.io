import modelUrl from "../../models/castle/props/kitchen-table.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { WarMapDrawing } from "./WarMapDrawing.js";

/**
 * Authored table with a flat parchment map derived from its current world.
 */
export class WarMapTable extends AbstractCastleProp {
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
    super(options);
    const { pc, app, runtime = {} } = options;
    const raster = WarMapDrawing.raster(runtime.mapData ?? { rows: 0, cols: 0, grid: [], heightmap: [] });
    const canvas = document.createElement("canvas");
    canvas.width = raster.width;
    canvas.height = raster.height;
    canvas.getContext("2d").putImageData(new ImageData(raster.pixels, raster.width, raster.height), 0, 0);
    this.#texture = new pc.Texture(app.graphicsDevice, { name: "Current world parchment", mipmaps: true });
    this.#texture.setSource(canvas);
    this.#material = new pc.StandardMaterial();
    this.#material.diffuseMap = this.#texture;
    this.#material.gloss = 0;
    this.#material.update();
    const paper = new pc.Entity("Flat current-world map");
    paper.addComponent("render", { type: "plane", material: this.#material, castShadows: false });
    paper.setLocalPosition(0, 0.567, 0);
    paper.setLocalScale(0.47, 1, 0.86);
    this.visualRoots[0].addChild(paper);
  }
  destroy() {
    super.destroy();
    this.#material.destroy();
    this.#texture.destroy();
  }
}
