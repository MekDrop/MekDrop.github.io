import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * @typedef {{col: number, row: number}} GridCell
 */

/**
 * Generates the renderer-independent castle build plan as part of the map.
 */
export class CastleBuildPlanStage extends AbstractMapGenerationStage {
  /**
   *
   * @type {Array}
   */
  #operations;

  /**
   *
   * @param {Array<() => void>} operations
   */
  constructor(operations) {
    super();
    /**
     *
     * @type {Array}
     */
    this.#operations = operations;
  }

  /**
   *
   * @param {GenerationContext} context
   */
  async run(context) {
    const { castle } = context.output;
    if (!castle?.position || !castle.doors?.length) {
      return;
    }

    const { cols, rows } = this.#operations.mapDimensions;
    const { heightmap } = context.world;
    const position = {
      x: castle.position.col - (cols - 1) / 2 - 0.5,
      z: castle.position.row - (rows - 1) / 2 - 0.5,
      width: castle.position.width,
      depth: castle.position.depth,
      elevation: castle.position.elevation,
    };
    const doors = castle.doors.map(/**
     *
     * @param {{side: string, offset: number, width: number, cells: GridCell[]}} options
     * @param {string} options.side
     * @param {number} options.offset
     * @param {number} options.width
     * @param {GridCell[]} options.cells
     */
    ({ side, offset, width, cells = [] }) => {
      const approachElevations = cells
        .map(/**
         *
         * @param {{col: number, row: number}} options
         * @param {number} options.col
         * @param {number} options.row
         */
        ({ col, row }) => heightmap?.[row]?.[col])
        .filter(Number.isFinite);
      return {
        side,
        offset,
        width,
        approachElevation: approachElevations.length
          ? Math.max(...approachElevations)
          : castle.position.elevation,
      };
    });

    castle.seed ??= `${context.input?.mapName ?? "map"}:castle:${castle.position.col}:${castle.position.row}`;
    context.output.castleBuildPlan =
      await this.#operations.generateCastleBuildPlan({
        position,
        doors,
        style: castle.style,
        seed: castle.seed,
      });
  }
}
