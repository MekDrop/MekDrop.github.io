export class DigInteraction {
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
      this.#field.canDig(this.#target.id) &&
      (!this.#hero.isUsingTool || this.#hero.tool === this.#tool)
    );
  }

  get description() {
    return {
      ...this.#target,
      labelKey:
        this.#hero.tool === this.#tool
          ? "game.interaction.stop_digging"
          : "game.interaction.dig",
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
      onImpact: () => {
        const finished = this.#field.dig(this.#target);
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
