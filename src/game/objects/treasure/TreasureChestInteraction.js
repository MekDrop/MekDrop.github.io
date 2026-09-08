export class TreasureChestInteraction {
  #field;
  #target;
  #hero;
  #onComplete;

  constructor({ field, target, hero, onComplete }) {
    this.#field = field;
    this.#target = target;
    this.#hero = hero;
    this.#onComplete = onComplete;
  }

  get canInteract() {
    return !this.#hero.isUsingTool && this.#field.canOpen(this.#target.id);
  }

  get description() {
    return {
      ...this.#target,
      labelKey: "game.interaction.open_treasure",
      showHealth: false,
    };
  }

  interact() {
    if (!this.canInteract || !this.#field.open(this.#target)) {
      return false;
    }
    this.#onComplete?.();
    return true;
  }
}
