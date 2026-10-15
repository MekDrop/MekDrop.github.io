/**
 * Saved-map compatibility shared by bench construction and room preparation.
 */
export class BenchDefinition {
  /**
   * @template {{object?: string, variant?: string}} T
   * @param {T} definition
   * @returns {T}
   */
  static normalize(definition) {
    if (!["Bench", "VestibuleBench", "VestibuleIslandBench"].includes(definition.object)) {
      return definition;
    }

    return {
      ...definition,
      object: "Bench",
      variant: definition.variant ?? (definition.object === "VestibuleIslandBench" ? "island" : "wall"),
    };
  }
}
