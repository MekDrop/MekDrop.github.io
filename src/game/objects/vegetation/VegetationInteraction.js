export class VegetationInteraction {
  #item;
  #hero;
  #tool;
  #onChange;
  #onComplete;

  constructor({ item, hero, tool, onChange, onComplete }) {
    this.#item = item;
    this.#hero = hero;
    this.#tool = tool;
    this.#onChange = onChange;
    this.#onComplete = onComplete;
  }

  get canInteract() {
    return (
      this.#item.canInteract &&
      (!this.#hero.isUsingTool || this.#hero.tool === this.#tool)
    );
  }

  get description() {
    const target = this.#item.describe();
    const active = this.#hero.tool === this.#tool;
    return {
      ...target,
      labelKey: active
        ? "game.interaction.stop_cutting"
        : target.kind === "bush"
          ? "game.interaction.clear_bush"
          : "game.interaction.chop_tree",
      showHealth: true,
    };
  }

  interact() {
    if (!this.canInteract) {
      return false;
    }
    if (this.#hero.isUsingTool) {
      return this.#hero.stopUsingTool();
    }
    const target = this.#item.describe();
    const accepted = this.#hero.useTool(this.#tool, {
      targetPosition: target,
      context: { heightClass: target.heightClass },
      onImpact: () => {
        const result = this.#item.interact();
        this.#onChange?.();
        return result?.destroyed ?? true;
      },
      onComplete: this.#onComplete,
    });
    if (accepted) {
      this.#onChange?.();
    }
    return accepted;
  }
}
