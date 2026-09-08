export class FillHoleInteraction {
  #field;
  #target;
  #hero;
  #tool;
  #onChange;
  #onComplete;

  constructor({ field, target, hero, tool, onChange, onComplete }) {
    this.#field = field;
    this.#target = target;
    this.#hero = hero;
    this.#tool = tool;
    this.#onChange = onChange;
    this.#onComplete = onComplete;
  }

  get canInteract() {
    return (
      this.#field.canFill(this.#target.id) &&
      (!this.#hero.isUsingTool || this.#hero.tool === this.#tool)
    );
  }

  get description() {
    return {
      ...this.#target,
      labelKey:
        this.#hero.tool === this.#tool
          ? "game.interaction.stop_filling"
          : "game.interaction.fill_hole",
      showHealth: false,
    };
  }

  interact() {
    if (!this.canInteract) {
      return false;
    }
    if (this.#hero.isUsingTool) {
      return this.#hero.stopUsingTool();
    }
    const accepted = this.#hero.useTool(this.#tool, {
      targetPosition: this.#target,
      context: { action: "fill" },
      onImpact: () => {
        const finished = this.#field.fill(this.#target);
        this.#onChange?.();
        return finished;
      },
      onComplete: this.#onComplete,
    });
    if (accepted) {
      this.#onChange?.();
    }
    return accepted;
  }
}
