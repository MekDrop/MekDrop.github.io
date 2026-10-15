import wallModelUrl from "../../models/castle/props/vestibule-bench.glb?url";
import islandModelUrl from "../../models/castle/props/vestibule-island-bench.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { BenchDefinition } from "./BenchDefinition.js";

/**
 * Independent seating with wall and freestanding island model variants.
 */
export class Bench extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      definition: BenchDefinition.normalize(options.definition),
    });
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [wallModelUrl, islandModelUrl]; }

  /**
   * Rendering and authored collision always use the same selected asset.
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "island" ? islandModelUrl : wallModelUrl;
  }

  /**
   * Runs after castles publish furnishings, including old saved plans.
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    for (const definition of mapData.objects ?? []) {
      Object.assign(definition, BenchDefinition.normalize(definition));
    }
  }
}
