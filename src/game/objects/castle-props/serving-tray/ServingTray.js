import modelUrl from "../../../models/castle/leisure/serving-tray.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Reusable stored or carrier-mounted serving tray.
 */
export class ServingTray extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * @param {import("../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    const trays = [];
    for (const definition of objects) {
      if (definition.object !== "Servant") { continue; }
      const id = definition.id + "-serving-tray";
      if (objects.some(ServingTray.#matchesId.bind(null, id))) { continue; }
      trays.push({
        id,
        object: "ServingTray",
        carrierId: definition.id,
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
        generated: true,
      });
    }
    const carried = objects.filter(ServingTray.#isCarried);
    const stored = objects.filter(ServingTray.#isNotCarried);
    mapData.objects = [...trays, ...carried, ...stored];
  }

  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {boolean}
   */
  static #isCarried(definition) {
    return definition.object === "ServingTray" && Boolean(definition.carrierId);
  }

  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {boolean}
   */
  static #isNotCarried(definition) { return !ServingTray.#isCarried(definition); }

  /**
   * @param {string} id
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {boolean}
   */
  static #matchesId(id, definition) { return definition.id === id; }

  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    if (this.definition.carrierId) { this.visualRoots[0].enabled = false; }
  }

  /**
   * @returns {boolean}
   */
  get hasAuthoredCollision() { return !this.definition.carrierId; }

  /**
   * Mount in activity coordinates, retaining activity-driven carrying poses.
   * @param {import("playcanvas").Entity} stage
   * @returns {import("playcanvas").Entity}
   */
  attachTo(stage) {
    const visual = this.visualRoots[0];
    stage.addChild(visual);
    visual.setLocalPosition(0, 0, 0);
    visual.setLocalEulerAngles(0, 0, 0);

    return visual;
  }

  onSceneReady() {
    if (!this.definition.carrierId) { super.onSceneReady(); }
  }

  destroy() {
    if (this.definition.carrierId) { this.visualRoots[0].destroy(); }
    super.destroy();
  }
}
