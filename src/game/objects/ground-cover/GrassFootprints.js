const RECOVERY_SECONDS = 0.85;
const HISTORY_LIMIT = 6;
const STAMP_DISTANCE = 0.14;

export class GrassFootprints {
  #history = [];
  #feet = new Map();
  #positions = new Float32Array(32);
  #shapes = new Float32Array(32);

  get positions() {
    return this.#positions;
  }

  get shapes() {
    return this.#shapes;
  }

  update(deltaTime, contacts = []) {
    for (const stamp of this.#history) {
      stamp.age += deltaTime;
    }
    this.#history = this.#history.filter(({ age }) => age < RECOVERY_SECONDS);
    const planted = contacts.filter(({ pressure }) => pressure > 0.025).slice(0, 2);
    for (const contact of planted) {
      const previous = this.#feet.get(contact.side);
      if (previous && Math.hypot(
        contact.x - previous.anchor.x, contact.z - previous.anchor.z,
      ) > STAMP_DISTANCE) {
        this.#stamp(previous.anchor);
        previous.anchor = { ...contact };
      }
      this.#feet.set(contact.side, {
        anchor: previous?.anchor ?? { ...contact }, last: { ...contact },
      });
    }
    for (const [side, foot] of this.#feet) {
      if (!planted.some((contact) => contact.side === side)) {
        this.#stamp(foot.last);
        this.#feet.delete(side);
      }
    }
    this.#positions.fill(0);
    this.#shapes.fill(0);
    const stamps = [...planted, ...this.#history];
    stamps.forEach((stamp, index) => {
      const recovery = Math.min(1, (stamp.age ?? 0) / RECOVERY_SECONDS);
      const pressure = stamp.pressure * (1 - recovery * recovery * (3 - 2 * recovery));
      this.#positions.set([stamp.x, stamp.y, stamp.z, pressure], index * 4);
      this.#shapes.set([
        stamp.directionX, stamp.directionZ, stamp.halfWidth, stamp.halfLength,
      ], index * 4);
    });
  }

  #stamp(contact) {
    this.#history.unshift({ ...contact, age: 0 });
    this.#history.length = Math.min(HISTORY_LIMIT, this.#history.length);
  }
}
