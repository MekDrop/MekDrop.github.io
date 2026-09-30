import { TerrainPhysicsSurface } from "../../collision/index.js";
import { Rivers } from "../../objects/water/index.js";
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
   * @type {import("../../objects/path/BridgeRailingKit.js").BridgeRailingKit}
   */
  #bridgeRailingKit;
  /**
   * @type {(value: string) => string}
   */
  #resolveMaterial;
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
   * @param {{pc: typeof pc, app: pc.Application, mapData: import("src/game/GameContracts.js").GameMapData, root: pc.Entity, materials: pc.Material[], bridgeRailingKit: import("src/game/objects/path/BridgeRailingKit.js").BridgeRailingKit, resolveMaterial?: (value: string) => string, modelLibrary: GameModelLibrary}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {import("src/game/GameContracts.js").GameMapData} options.mapData
   * @param {pc.Entity} options.root
   * @param {pc.Material[]} options.materials
   * @param {import("src/game/objects/path/BridgeRailingKit.js").BridgeRailingKit} options.bridgeRailingKit
   * @param {(value: string) => string} [options.resolveMaterial]
   * @param {GameModelLibrary} options.modelLibrary
   */
  constructor({
    pc,
    app,
    mapData,
    root,
    materials,
    bridgeRailingKit,
    resolveMaterial,
    modelLibrary,
  }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#bridgeRailingKit = bridgeRailingKit;
    this.#resolveMaterial = resolveMaterial;
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
  }

  build() {
    for (const { method, args } of this.#mapData.renderCommands ?? []) {
      const target = method === "addSpan" || method === "addOverpass" ? this.#bridgeRailingKit : this.#instanceRenderer;
      target[method](...args.map(this.#resolveMaterial));
    }
    this.#instanceRenderer.build();
    this.#rivers = new Rivers({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
    });
    this.#root.addChild(this.#rivers.entity);
  }

  get instanceRenderer() { return this.#instanceRenderer; }
  /**
   * @param {(value: string) => string} value
   */
  set resolveMaterial(value) { this.#resolveMaterial = value; }

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
