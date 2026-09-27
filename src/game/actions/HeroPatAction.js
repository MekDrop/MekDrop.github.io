export class HeroPatAction {
  #renderer;

  constructor(renderer) {
    this.#renderer = renderer;
  }

  invoke() {
    return this.#renderer.patHero();
  }
}
