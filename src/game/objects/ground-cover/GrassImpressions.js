const RECOVERY_SECONDS = 0.85;
const MAXIMUM_IMPRESSIONS = 8;
const STAMP_DISTANCE = 0.14;
const MINIMUM_STRENGTH = 0.025;

export class GrassImpressions {
  #history = [];
  #contacts = new Map();
  #positions = new Float32Array(MAXIMUM_IMPRESSIONS * 4);
  #shapes = new Float32Array(MAXIMUM_IMPRESSIONS * 4);

  get positions() {
    return this.#positions;
  }

  get shapes() {
    return this.#shapes;
  }

  update(deltaTime, contacts = []) {
    for (const impression of this.#history) {
      impression.age += deltaTime;
    }
    this.#history = this.#history.filter(({ age }) => age < RECOVERY_SECONDS);
    const active = contacts
      .map((contact, index) => this.#normalize(contact, index))
      .filter(({ strength }) => strength > MINIMUM_STRENGTH)
      .sort((left, right) => right.strength - left.strength)
      .slice(0, MAXIMUM_IMPRESSIONS);
    for (const contact of active) {
      const previous = this.#contacts.get(contact.id);
      if (
        previous &&
        Math.hypot(
          contact.x - previous.anchor.x,
          contact.z - previous.anchor.z,
        ) > STAMP_DISTANCE
      ) {
        this.#stamp(previous.anchor);
        previous.anchor = { ...contact };
      }
      this.#contacts.set(contact.id, {
        anchor: previous?.anchor ?? { ...contact },
        last: { ...contact },
      });
    }
    for (const [id, contact] of this.#contacts) {
      if (!active.some((candidate) => candidate.id === id)) {
        this.#stamp(contact.last);
        this.#contacts.delete(id);
      }
    }
    this.#positions.fill(0);
    this.#shapes.fill(0);
    [...active, ...this.#history]
      .slice(0, MAXIMUM_IMPRESSIONS)
      .forEach((impression, index) => {
        const recovery = Math.min(
          1,
          (impression.age ?? 0) / RECOVERY_SECONDS,
        );
        const strength =
          impression.strength *
          (1 - recovery * recovery * (3 - 2 * recovery));
        this.#positions.set(
          [impression.x, impression.y, impression.z, strength],
          index * 4,
        );
        this.#shapes.set(
          [
            impression.directionX,
            impression.directionZ,
            impression.halfWidth,
            impression.halfLength,
          ],
          index * 4,
        );
      });
  }

  #normalize(contact, index) {
    const radius = Math.max(0.001, contact.radius ?? 0.1);
    const directionLength =
      Math.hypot(contact.directionX ?? 0, contact.directionZ ?? 1) || 1;
    return {
      ...contact,
      id: contact.id ?? contact.side ?? `contact-${index}`,
      x: contact.x ?? 0,
      y: contact.y ?? 0,
      z: contact.z ?? 0,
      strength: Math.max(0, contact.strength ?? contact.pressure ?? 0),
      directionX: (contact.directionX ?? 0) / directionLength,
      directionZ: (contact.directionZ ?? 1) / directionLength,
      halfWidth: Math.max(0.001, contact.halfWidth ?? radius),
      halfLength: Math.max(0.001, contact.halfLength ?? radius),
    };
  }

  #stamp(contact) {
    this.#history.unshift({ ...contact, age: 0 });
    this.#history.length = Math.min(
      MAXIMUM_IMPRESSIONS,
      this.#history.length,
    );
  }
}
