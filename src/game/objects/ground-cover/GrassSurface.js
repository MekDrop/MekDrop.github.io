import { getAmbientWind } from "../shared/AmbientWind.js";
import { GrassImpressions } from "./GrassImpressions.js";
import { GrassObstacleMap } from "./GrassObstacleMap.js";
import { GrassSurfaceLoads } from "./GrassSurfaceLoads.js";
import { GrassWindMap } from "./GrassWindMap.js";

const STILL_ZOOM = 1;
const FULL_WIND_ZOOM = 1.1;
const FITTED_VIEW_WIND_VISIBILITY = 0.35;
const CALM_WIND_SPEED = 0.1;
const STRONG_WIND_SPEED = 0.28;

/**
 *
 * @param {number} speed
 */
function getWindStrength(speed) {
  const progress = Math.max(
    0,
    (speed - CALM_WIND_SPEED) / (STRONG_WIND_SPEED - CALM_WIND_SPEED),
  );
  if (progress > 1) {
    return 1 + Math.log2(progress) * 0.75;
  }
  return Math.pow(progress, 2.3);
}

export class GrassSurface {
  /**
   *
    * @type {Array<import("playcanvas").Material>}
   */
  #terrainMaterials;
  /**
   *
    * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle;
  /**
   *
    * @type {number}
   */
  #renderHandle;
  /**
   *
    * @type {() => Array<{x: number, y: number, z: number, directionX: number, directionZ: number, strength: number}>}
   */
  #getImpressionContacts;
  /**
   *
    * @type {() => Array<{x: number, y: number, z: number, radius: number}>}
   */
  #getSurfaceContacts;
  /**
   *
    * @type {(x: number, z: number, elevation: number) => number}
   */
  #getWeightAt;
  /**
   *
    * @type {GrassImpressions}
   */
  #impressions = new GrassImpressions();
  /**
   *
    * @type {GrassSurfaceLoads}
   */
  #surfaceLoads = new GrassSurfaceLoads();
  /**
   *
    * @type {GrassObstacleMap}
   */
  #obstacleMap = null;
  /**
   *
    * @type {import("playcanvas").Material}
   */
  #windMap = null;
  /**
   *
    * @type {number}
   */
  #deltaTime = 0;
  /**
   *
    * @type {number}
   */
  #elapsed = 0;
  /**
   *
    * @type {import("playcanvas").Material}
   */
  #windVisibility = FITTED_VIEW_WIND_VISIBILITY;

  /**
   *
   * @param {{app: import("playcanvas").Application, pc: typeof import("playcanvas"), mapData: import("src/game/objects/ObjectTypes.js").GameMapData, terrainMaterials: Array<import("playcanvas").Material>, zoom: number, getImpressionContacts: () => Array<{x: number, y: number, z: number, directionX: number, directionZ: number, strength: number}>, getSurfaceContacts: () => Array<{x: number, y: number, z: number, radius: number}>, getWeightAt: (x: number, z: number, elevation: number) => number}} options
   * @param {import("playcanvas").Application} options.app
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   * @param {Array<import("playcanvas").Material>} options.terrainMaterials
   * @param {number} options.zoom
   * @param {() => Array<{x: number, y: number, z: number, directionX: number, directionZ: number, strength: number}>} options.getImpressionContacts
   * @param {() => Array<{x: number, y: number, z: number, radius: number}>} options.getSurfaceContacts
   * @param {(x: number, z: number, elevation: number) => number} options.getWeightAt
   */
  constructor({
    app,
    pc = null,
    mapData = null,
    terrainMaterials = [],
    zoom = 1,
    getImpressionContacts = () => [],
    getSurfaceContacts = () => [],
    getWeightAt = () => 0,
  }) {

    this.#terrainMaterials = terrainMaterials;

    this.#getImpressionContacts = getImpressionContacts;

    this.#getSurfaceContacts = getSurfaceContacts;

    this.#getWeightAt = getWeightAt;
    if (pc && mapData) {

      this.#obstacleMap = new GrassObstacleMap({
        pc,
        device: app.graphicsDevice,
        mapData,
      });

      this.#windMap = new GrassWindMap({
        pc,
        device: app.graphicsDevice,
        mapData,
      });
      for (const material of this.#terrainMaterials) {
        this.#obstacleMap.apply(material);
        this.#windMap.apply(material);
      }
      this.refreshObstacles();
    }

    this.zoom = zoom;
    this.#update(0);
    this.#updateImpressions();

    this.#updateHandle = app.on("update", this.#update);
    // Sample after the hero has applied animation and sole-to-ground alignment.

    this.#renderHandle = app.on("prerender", this.#updateImpressions);
  }

  set zoom(value) {
    const progress = Math.max(
      0,
      Math.min(
        1,
        (value - STILL_ZOOM) / (FULL_WIND_ZOOM - STILL_ZOOM),
      ),
    );
    const influence = progress * progress * (3 - 2 * progress);
    this.#windVisibility =
      FITTED_VIEW_WIND_VISIBILITY +
      (1 - FITTED_VIEW_WIND_VISIBILITY) * influence;
    for (const material of this.#terrainMaterials) {
      material.setParameter("uGrassAmbientMotion", this.#windVisibility);
    }
  }

  destroy() {
    this.#updateHandle?.off();
    this.#renderHandle?.off();
    this.#updateHandle = null;
    this.#renderHandle = null;
    this.#obstacleMap?.destroy();
    this.#obstacleMap = null;
    this.#windMap?.destroy();
    this.#windMap = null;
    this.#terrainMaterials = [];
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").GridPoint} tile
   */
  refreshObstacles(tile = null) {
    this.#obstacleMap?.refresh(this.#getWeightAt, tile);
  }

  /**
   *
   * @param {number} deltaTime
    * @type {number}
   */
  #update = (deltaTime) => {
    this.#deltaTime = Math.min(deltaTime, 0.1);
    this.#elapsed += this.#deltaTime;
    const wind = getAmbientWind(this.#elapsed);
    this.#windMap?.refresh(wind.direction);
    const windStrength = getWindStrength(wind.speed);
    for (const material of this.#terrainMaterials) {
      material.setParameter("uGrassTime", this.#elapsed);
      material.setParameter("uGrassWindDirection", [
        wind.direction.x,
        wind.direction.z,
      ]);
      material.setParameter("uGrassWindStrength", windStrength);
    }
  };

  /**
   *
    * @type {() => void}
   */
  #updateImpressions = () => {
    this.#impressions.update(
      this.#deltaTime,
      this.#getImpressionContacts(),
    );
    this.#surfaceLoads.update(this.#getSurfaceContacts());
    for (const material of this.#terrainMaterials) {
      material.setParameter(
        "uGrassImpressions[0]",
        this.#impressions.positions,
      );
      material.setParameter(
        "uGrassImpressionShapes[0]",
        this.#impressions.shapes,
      );
      material.setParameter(
        "uGrassSurfaces[0]",
        this.#surfaceLoads.positions,
      );
      material.setParameter(
        "uGrassSurfaceLoads[0]",
        this.#surfaceLoads.loads,
      );
    }
  };
}
