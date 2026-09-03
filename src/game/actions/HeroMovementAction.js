export class HeroMovementAction {
  #renderer;
  #directions = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  #running = false;

  constructor(renderer) {
    this.#renderer = renderer;
  }

  setDirection(direction, pressed) {
    if (!(direction in this.#directions)) return;
    this.#directions[direction] = pressed;
    this.#applyMovement();
  }

  setRunning(running) {
    this.#running = running;
    this.#applyMovement();
  }

  jump() {
    this.#renderer.jumpHero();
  }

  clear() {
    for (const direction of Object.keys(this.#directions)) {
      this.#directions[direction] = false;
    }
    this.#running = false;
    this.#applyMovement();
  }

  #applyMovement() {
    const x =
      Number(this.#directions.right) - Number(this.#directions.left);
    const y = Number(this.#directions.up) - Number(this.#directions.down);
    this.#renderer.setHeroMovement(
      x,
      y,
      this.#running && (x !== 0 || y !== 0),
    );
  }
}
