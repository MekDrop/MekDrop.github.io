import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Generates the renderer-independent castle build plan as part of the map.
 */
export class CastleBuildPlanStage extends AbstractMapGenerationStage {
  #operations;

  constructor(operations) {
    super();
    this.#operations = operations;
  }

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
    const doors = castle.doors.map(({ side, offset, width, cells = [] }) => {
      const approachElevations = cells
        .map(({ col, row }) => heightmap?.[row]?.[col])
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

    context.output.castleBuildPlan =
      await this.#operations.generateCastleBuildPlan({
        position,
        doors,
        style: castle.style,
      });
  }
}
