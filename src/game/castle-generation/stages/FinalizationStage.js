import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

export class FinalizationStage extends AbstractCastleGenerationStage {
  async run(context) {
    context.output.buildPlan = {
      input: {
        position: context.input.position ? { ...context.input.position } : null,
        doors: context.input.doors.map((door) => ({ ...door })),
        requestedStyle: context.input.style,
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

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}
