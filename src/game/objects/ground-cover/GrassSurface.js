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
  #terrainMaterials;
  #updateHandle;
  #renderHandle;
  #getImpressionContacts;
  #getSurfaceContacts;
  #getWeightAt;
  #impressions = new GrassImpressions();
  #surfaceLoads = new GrassSurfaceLoads();
  #obstacleMap = null;
  #windMap = null;
  #deltaTime = 0;
  #elapsed = 0;
  #windVisibility = FITTED_VIEW_WIND_VISIBILITY;

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

  refreshObstacles(tile = null) {
    this.#obstacleMap?.refresh(this.#getWeightAt, tile);
  }

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
