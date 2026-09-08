export class HeroTool {
  #modelLibrary;
  #modelUrl;
  #name;
  #entity = null;

  constructor({ modelLibrary, modelUrl, name }) {
    this.#modelLibrary = modelLibrary;
    this.#modelUrl = modelUrl;
    this.#name = name;
  }

  get name() {
    return this.#name;
  }

  get summonDuration() {
    return 0.57;
  }

  get useDuration() {
    return 0.8;
  }

  get impactTime() {
    return 0.44;
  }

  get dismissDuration() {
    return 0.57;
  }

  get summonAnimation() {
    return null;
  }

  get dismissAnimation() {
    return null;
  }

  useAnimation() {
    return null;
  }

  mount(parent) {
    if (!this.#entity) {
      this.#entity = this.#modelLibrary.instantiate(this.#modelUrl);
      this.#entity.name = `${this.#name} tool instance`;
      this.#entity.setLocalPosition(0, -0.61, 0.06);
      this.#entity.enabled = false;
    }
    if (this.#entity.parent !== parent) {
      parent.addChild(this.#entity);
    }
  }

  set visible(visible) {
    if (this.#entity) {
      this.#entity.enabled = Boolean(visible);
    }
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
  }
}
