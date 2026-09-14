import { GrassFootprints } from "./GrassFootprints.js";

const STILL_ZOOM = 1;
const FULL_WIND_ZOOM = 1.1;

export class GrassSurface {
  #terrainMaterials;
  #updateHandle;
  #renderHandle;
  #getFootContacts;
  #footprints = new GrassFootprints();
  #deltaTime = 0;
  #elapsed = 0;

  constructor({ app, terrainMaterials = [], zoom = 1, getFootContacts = () => [] }) {
    this.#terrainMaterials = terrainMaterials;
    this.#getFootContacts = getFootContacts;
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
    this.#terrainMaterials = [];
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
    for (const material of this.#terrainMaterials) {
      material.setParameter("uGrassFeet[0]", this.#footprints.positions);
      material.setParameter("uGrassFootShapes[0]", this.#footprints.shapes);
    }
  };
}
