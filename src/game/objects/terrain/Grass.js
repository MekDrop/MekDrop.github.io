import { MAP_TILE_TYPE } from "../../enum/MapTileType.js";
import { Earth } from "./Earth.js";
import { GrassSurfaceMaterials } from "./GrassSurfaceMaterials.js";
import { GrassCarpet } from "../ground-cover/GrassCarpet.js";
import { GrassSurface } from "../ground-cover/GrassSurface.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";

/**
 * A turf building block, including the shared living canopy and contact response.
 */
export class Grass extends Earth {
  /**
   * @type {import("../ObjectTypes.js").MapObjectRuntime}
   */
  #runtime;
  /**
   * @type {boolean}
   */
  #ownsSurface = false;

  /**
   * @returns {Readonly<Record<string, string>>}
   */
  static get textureUrls() { return GrassSurfaceMaterials.textureUrls; }
  /**
   * @returns {Array<string>}
   */
  static get modelUrls() { return GrassCarpet.modelUrls; }
  /**
   * @param {number} type
   */
  static surfaceLiftForTile(type) { return type === MAP_TILE_TYPE.GRASS ? GRASS_SURFACE_LIFT : 0; }
  /**
   * @param {Array} args
   */
  static registerMaterials(...args) { GrassSurfaceMaterials.register(...args); }
  /**
   * @param {Array} args
   */
  static configureTexture(...args) { GrassSurfaceMaterials.configureTexture(...args); }

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime: import("../ObjectTypes.js").MapObjectRuntime}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("../ObjectTypes.js").MapObjectDefinition} options.definition
   * @param {import("../ObjectTypes.js").MapObjectRuntime} options.runtime
   */
  constructor(options) {
    super(options);
    const { pc, app, modelLibrary, runtime } = options;
    this.#runtime = runtime;
    if (runtime.canopy) {
      return;
    }
    this.#ownsSurface = true;
    const carpet = new GrassCarpet({ pc, device: app.graphicsDevice, mapData: runtime.mapData, modelLibrary,
      tileColors: GrassSurfaceMaterials.tileColors,
      /**
       * @param {Array<number>} args
       */
      variantForTile: (...args) => runtime.surfaceMaterials.grass.variantForTile(...args),
      zoom: runtime.camera.zoom,
    });
    runtime.root.addChild(carpet.entity);
    const surface = new GrassSurface({ app, pc, mapData: runtime.mapData, terrainMaterials: [carpet.material].filter(Boolean), zoom: runtime.camera.zoom,
      getImpressionContacts: () => runtime.getContactProviders().flatMap(
        /**
         * @param {import("src/game/GameContracts.js").GameObjectContract} object
         */
        (object) => object?.grassFootContacts ?? object?.grassImpressionContacts ?? []),
      getSurfaceContacts: () => [...runtime.objects].flatMap(
        /**
         * @param {import("src/game/GameContracts.js").GameObjectContract} object
         */
        (object) => object.grassSurfaceContacts ?? []),
      /**
       * @param {number} x
       * @param {number} y
       * @param {number} z
       */
      getWeightAt: (x, y, z) => runtime.collisionWorld.grassWeightAt(x, z, y),
    });
    runtime.canopy = { carpet, surface };
    /**
     * @param {import("../ObjectTypes.js").Point3} position
     * @param {number} radius
     */
    runtime.getGrassSupportPoints = (position, radius) => carpet.supportPointsWithin(position, radius);
  }

  /**
   * @param {import("../ObjectTypes.js").Point3} position
   * @param {import("../ObjectTypes.js").MapObjectRuntime} runtime
   */
  defaultGeometry(position, runtime) {
    const geometry = super.defaultGeometry(position, runtime);
    const { col, row } = this.tile ?? { col: Math.round(position.x + (runtime.mapData.cols - 1) / 2), row: Math.round(position.z + (runtime.mapData.rows - 1) / 2) };
    const level = position.y - 0.5;
    geometry.args[0] = `grass:${col}:${row}:${level}`;
    geometry.args[1] = `turfSide:${col}:${row}:${level}`;
    geometry.args[7] = GRASS_SURFACE_LIFT;
    return geometry;
  }
  onSceneReady() {
    if (this.#ownsSurface) {
      this.#runtime.canopy.surface.refreshObstacles();
    }
  }
  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   */
  onObjectRemoved(definition) {
    if (this.#ownsSurface) {
      this.#runtime.canopy.surface.refreshObstacles(definition.tile);
    }
  }
  /**
   * @param {import("../ObjectTypes.js").Point3} position
   * @param {number} radius
   */
  onTerrainExcavated(position, radius) {
    if (this.#ownsSurface) {
      if (radius > 0) {
        this.#runtime.canopy.carpet.clearAt(position, Math.min(0.4, radius + 0.08));
      }
      this.#runtime.instanceRenderer.excavateSurface(position, radius);
    }
  }
  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) {
    if (this.#ownsSurface) {
      this.#runtime.canopy.carpet.setIslandOffsets(near, far);
    }
  }
  onCameraChanged() {
    if (!this.#ownsSurface) {
      return;
    }
    this.#runtime.canopy.surface.zoom = this.#runtime.camera.zoom;
    this.#runtime.canopy.carpet.zoom = this.#runtime.camera.zoom;
  }
  destroy() {
    if (this.#ownsSurface) {
      this.#runtime.canopy.surface.destroy();
      this.#runtime.canopy.carpet.destroy();
    }
    super.destroy();
  }
}
