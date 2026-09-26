import { TerrainPhysicsSurface } from "../../collision/index.js";
import { TerrainBatchBuilder } from "./TerrainBatchBuilder.js";
import { TerrainInstanceRenderer } from "./TerrainInstanceRenderer.js";

export class TerrainRenderer {
  #pc;
  #app;
  #mapData;
  #root;
  #batchBuilder;
  #instanceRenderer;
  #physicsSurface = null;

  constructor({
    pc,
    app,
    mapData,
    root,
    materials,
    bridgeRailingKit,
    cubeMaterials,
    pathEarthSideMaterial,
    earthSideMaterial,
    sideVariant,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.#root = root;
    this.#instanceRenderer = new TerrainInstanceRenderer({
      pc,
      app,
      root,
      materials,
    });
    this.#batchBuilder = new TerrainBatchBuilder({
      mapData,
      bridgeRailingKit,
      cubeMaterials,
      pathEarthSideMaterial,
      earthSideMaterial,
      sideVariant,
      instanceRenderer: this.#instanceRenderer,
    });
  }

  build(undersideVoxels) {
    this.#batchBuilder.build(undersideVoxels);
    this.#instanceRenderer.build();
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
    this.#instanceRenderer.destroy();
  }
}
