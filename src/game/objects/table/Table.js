import modelUrl from "../../models/castle/props/kitchen-table.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";
import deskUrl from "../../models/castle/residential/writing-desk.glb?url";

/**
 * A dimensioned timber table or writing desk.
 */
export class Table extends AbstractCastleProp {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [modelUrl, deskUrl]; }
  /**
   * @returns {string}
   */
  get modelUrl() { return this.definition.variant === "writingDesk" ? deskUrl : modelUrl; }
  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application,modelLibrary:import("../../models/GameModelLibrary.js").GameModelLibrary,definition:import("../ObjectTypes.js").MapObjectDefinition,runtime?:import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor(options) {
    const definition = Table.definitionFor(options.definition);
    super({
      ...options,
      definition,
    });
  }
  /**
   * Apply default dimensions to the shared timber model.
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {import("../ObjectTypes.js").MapObjectDefinition}
   */
  static definitionFor(definition) {
    const desk = definition.variant === "writingDesk";

    return {
      ...definition,
      object: Table.name,
      width: definition.width ?? (desk ? 0.9 : 0.6271365),
      height: definition.height ?? (desk ? 0.65 : 0.56465894),
      depth: definition.depth ?? (desk ? 0.55 : 1.25),
    };
  }

  /**
   * Size both visible timber and authored collision from the same definition.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { width, height, depth, scale = 1, stretch = {
      x: 1,
      y: 1,
      z: 1,
    } } = this.definition;
    const desk = this.definition.variant === "writingDesk";
    model.setLocalScale(width / (desk ? 0.9 : 0.6271365) * scale * stretch.x,
      height / (desk ? 0.65 : 0.56465894) * scale * stretch.y, depth / (desk ? 0.55 : 1.25) * scale * stretch.z);
    if (desk) {
      model.findByName("Parchment")?.destroy();
      model.findByName("Ink pot")?.destroy();
    }
  }
}
