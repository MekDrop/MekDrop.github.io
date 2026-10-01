import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

export class FinalizationStage extends AbstractCastleGenerationStage {
  /**
   *
   * @param {CastleGenerationContext} context
   */
  async run(context) {
    context.output.buildPlan = {
      input: {
        position: context.input.position ? { ...context.input.position } : null,
        doors: context.input.doors.map(/**
         *
         * @param {{side: string, offset: number, width: number, cells?: import("src/game/GameContracts.js").GridPoint[]}} door
         */
        (door) => ({ ...door })),
        requestedStyle: context.input.style,
        ...(context.input.seed === undefined ? {} : { seed: context.input.seed }),
      },
      layout: this.#clone(context.layout),
      structure: this.#clone(context.structure),
      geometry: this.#clone({
        boxes: context.geometry.boxes,
        decorations: context.geometry.decorations,
      }),
      metadata: this.#clone(context.metadata),
    };
  }

  /**
   *
   * @param {number} value
   */
  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}
