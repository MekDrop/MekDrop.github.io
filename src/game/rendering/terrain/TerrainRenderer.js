import { TerrainPhysicsSurface } from "../../collision/index.js";
import { Rivers } from "../../objects/water/index.js";
import { TerrainBatchBuilder } from "./TerrainBatchBuilder.js";
import { TerrainInstanceRenderer } from "./TerrainInstanceRenderer.js";

export class TerrainRenderer {
  /**
   *
   * @returns {Array}
   */
  static get modelUrls() {
    return Rivers.modelUrls;
  }

  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {pc.Application}
   */
  #app;
  /**
   *
   * @type {import("src/game/GameContracts.js").GameMapData}
   */
  #mapData;
  /**
   *
   * @type {pc.Entity}
   */
  #root;
  /**
   *
   * @type {TerrainBatchBuilder}
   */
  #batchBuilder;
  /**
   *
   * @type {TerrainInstanceRenderer}
   */
  #instanceRenderer;
  /**
   *
   * @type {null}
   */
  #physicsSurface = null;
  /**
   *
   * @type {null}
   */
  #rivers = null;
  /**
   *
   * @type {GameModelLibrary}
   */
  #modelLibrary;

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, mapData: import("src/game/GameContracts.js").GameMapData, root: pc.Entity, materials: pc.Material[], bridgeRailingKit: import("src/game/objects/path/BridgeRailingKit.js").BridgeRailingKit, cubeMaterials: Array, pathEarthSideMaterial: pc.Material, earthSideMaterial: pc.Material, sideVariant: (material: string, index: number) => string, modelLibrary: GameModelLibrary}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {import("src/game/GameContracts.js").GameMapData} options.mapData
   * @param {pc.Entity} options.root
   * @param {pc.Material[]} options.materials
   * @param {import("src/game/objects/path/BridgeRailingKit.js").BridgeRailingKit} options.bridgeRailingKit
   * @param {Array} options.cubeMaterials
   * @param {pc.Material} options.pathEarthSideMaterial
   * @param {pc.Material} options.earthSideMaterial
   * @param {(material: string, index: number) => string} options.sideVariant
   * @param {GameModelLibrary} options.modelLibrary
   */
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
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {pc.Application}
     */
    this.#app = app;
    /**
     *
     * @type {import("src/game/GameContracts.js").GameMapData}
     */
    this.#mapData = mapData;
    /**
     *
     * @type {pc.Entity}
     */
    this.#root = root;
    /**
     *
     * @type {GameModelLibrary}
     */
    this.#modelLibrary = modelLibrary;
    /**
     *
     * @type {TerrainInstanceRenderer}
     */
    this.#instanceRenderer = new TerrainInstanceRenderer({
      pc,
      app,
      root,
      materials,
      mapData,
    });
    /**
     *
     * @type {TerrainBatchBuilder}
     */
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

  /**
   *
   * @param {Array<{col: number, row: number, level: number, rocky: boolean}>} undersideVoxels
   */
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

  /**
   *
   * @param {number} deltaTime
   * @param {null} hero
   * @param {null} camera
   */
  update(deltaTime, hero = null, camera = null) {
    this.#rivers?.update(deltaTime, hero, camera);
  }

  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) {
    this.#instanceRenderer.setIslandOffsets(near, far);
    this.#rivers?.setIslandOffsets(near, far);
  }

  /**
   *
   * @param {GroundCollisionWorld} collisionWorld
   */
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
