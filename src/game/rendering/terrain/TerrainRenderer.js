import { TerrainPhysicsSurface } from "../../collision/index.js";
import { TerrainInstanceRenderer } from "./TerrainInstanceRenderer.js";

export class TerrainRenderer {

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
   * @param {{pc: typeof pc, app: pc.Application, mapData: import("src/game/GameContracts.js").GameMapData, root: pc.Entity, materials: pc.Material[], bridgeRailingKit: import("src/game/objects/path/BridgeRailingKit.js").BridgeRailingKit, resolveMaterial?: (value: string) => string}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {import("src/game/GameContracts.js").GameMapData} options.mapData
   * @param {pc.Entity} options.root
   * @param {pc.Material[]} options.materials
   * @param {import("src/game/objects/path/BridgeRailingKit.js").BridgeRailingKit} options.bridgeRailingKit
   * @param {(value: string) => string} [options.resolveMaterial]
   */
  constructor({
    pc,
    app,
    mapData,
    root,
    materials,
    bridgeRailingKit,
    resolveMaterial,
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
  }

  get instanceRenderer() { return this.#instanceRenderer; }
  /**
   * @param {(value: string) => string} value
   */
  set resolveMaterial(value) { this.#resolveMaterial = value; }


  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#instanceRenderer.setIslandOffsets(near, far, offsets);
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
  }
}
