import { TerrainPhysicsSurface } from "../../collision/index.js";
import { TerrainBatchBuilder } from "./TerrainBatchBuilder.js";

export class TerrainRenderer {
  #pc;
  #app;
  #mapData;
  #root;
  #batchBuilder;
  #physicsSurface = null;

  constructor({
    pc,
    app,
    mapData,
    root,
    bridgeRailingKit,
    cubeMaterials,
    pathEarthSideMaterial,
    grassEarthSideMaterial,
    sideVariant,
    addCubeMatrix,
    addBoxMatrix,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.#root = root;
    this.#batchBuilder = new TerrainBatchBuilder({
      mapData,
      bridgeRailingKit,
      cubeMaterials,
      pathEarthSideMaterial,
      grassEarthSideMaterial,
      sideVariant,
      addCubeMatrix,
      addBoxMatrix,
    });
  }

  buildBatches(batches) {
    this.#batchBuilder.build(batches);
  }

  buildPhysicsSurface(collisionWorld) {
    this.#physicsSurface?.destroy();
    this.#physicsSurface = new TerrainPhysicsSurface({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      collisionWorld,
    });
    this.#root.addChild(this.#physicsSurface.entity);
  }

  destroy() {
    this.#physicsSurface?.destroy();
    this.#physicsSurface = null;
  }
}
