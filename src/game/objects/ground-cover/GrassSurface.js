import { GrassFootprints } from "./GrassFootprints.js";
import { GrassObstacleMap } from "./GrassObstacleMap.js";
import { GrassSurfaceLoads } from "./GrassSurfaceLoads.js";

const STILL_ZOOM = 1;
const FULL_WIND_ZOOM = 1.1;

export class GrassSurface {
  #terrainMaterials;
  #updateHandle;
  #renderHandle;
  #getFootContacts;
  #getSurfaceContacts;
  #getWeightAt;
  #footprints = new GrassFootprints();
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
    getFootContacts = () => [],
    getSurfaceContacts = () => [],
    getWeightAt = () => 0,
  }) {
    this.#terrainMaterials = terrainMaterials;
    this.#getFootContacts = getFootContacts;
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
    this.#updateFootprints();
    this.#updateHandle = app.on("update", this.#update);
    // Sample after the hero has applied animation and sole-to-ground alignment.
    this.#renderHandle = app.on("prerender", this.#updateFootprints);
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

  #updateFootprints = () => {
    this.#footprints.update(this.#deltaTime, this.#getFootContacts());
    this.#surfaceLoads.update(this.#getSurfaceContacts());
    for (const material of this.#terrainMaterials) {
      material.setParameter("uGrassFeet[0]", this.#footprints.positions);
      material.setParameter("uGrassFootShapes[0]", this.#footprints.shapes);
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
