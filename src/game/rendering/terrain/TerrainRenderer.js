import { TerrainPhysicsSurface } from "../../collision/index.js";
import { Rivers } from "../../objects/water/index.js";
import { TerrainBatchBuilder } from "./TerrainBatchBuilder.js";
import { TerrainInstanceRenderer } from "./TerrainInstanceRenderer.js";

export class TerrainRenderer {
  static get modelUrls() {
    return Rivers.modelUrls;
  }

  #pc;
  #app;
  #mapData;
  #root;
  #batchBuilder;
  #instanceRenderer;
  #physicsSurface = null;
  #rivers = null;
  #modelLibrary;

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
    modelLibrary,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.#root = root;
    this.#modelLibrary = modelLibrary;
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
    this.#rivers = new Rivers({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
    });
    this.#root.addChild(this.#rivers.entity);
  }

  update(deltaTime, hero = null, camera = null) {
    this.#rivers?.update(deltaTime, hero, camera);
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
    this.#rivers?.destroy();
    this.#rivers = null;
  }
}
