/**
 * Renderer-free compatibility for legacy room recipes and saved object records.
 */
export class CandleStandDefinition {
  /**
   * @param {{object?: string, variant?: string}} definition
   */
  static normalize(definition) {
    const name = definition.object;
    if (!["SingleCandleStand", "FloorCandelabrum", "TableCandles"].includes(name)) { return; }
    definition.object = "CandleStand";
    definition.variant = name === "FloorCandelabrum" ? "floor" : name === "TableCandles" ? "table" : "single";
  }
}
