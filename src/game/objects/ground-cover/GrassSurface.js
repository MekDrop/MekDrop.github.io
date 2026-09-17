import { GrassImpressions } from "./GrassImpressions.js";
import { GrassObstacleMap } from "./GrassObstacleMap.js";
import { GrassSurfaceLoads } from "./GrassSurfaceLoads.js";

const STILL_ZOOM = 1;
const FULL_WIND_ZOOM = 1.1;

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
  #deltaTime = 0;
  #elapsed = 0;

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
      for (const material of this.#terrainMaterials) {
        this.#obstacleMap.apply(material);
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
    const progress = Math.max(0, Math.min(1, (value - STILL_ZOOM) / (FULL_WIND_ZOOM - STILL_ZOOM)));
    const influence = progress * progress * (3 - 2 * progress);
    for (const material of this.#terrainMaterials) {
      material.setParameter("uGrassAmbientMotion", influence);
    }
  }

  destroy() {
    this.#updateHandle?.off();
    this.#renderHandle?.off();
    this.#updateHandle = null;
    this.#renderHandle = null;
    this.#obstacleMap?.destroy();
    this.#obstacleMap = null;
    this.#terrainMaterials = [];
  }

  refreshObstacles() {
    this.#obstacleMap?.refresh(this.#getWeightAt);
  }

  #update = (deltaTime) => {
    this.#deltaTime = Math.min(deltaTime, 0.1);
    this.#elapsed += this.#deltaTime;
    for (const material of this.#terrainMaterials) {
      material.setParameter("uGrassTime", this.#elapsed);
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
