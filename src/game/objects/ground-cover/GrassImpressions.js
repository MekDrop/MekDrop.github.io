const RECOVERY_SECONDS = 0.85;
const MAXIMUM_IMPRESSIONS = 8;
const STAMP_DISTANCE = 0.14;
const MINIMUM_STRENGTH = 0.025;

export class GrassImpressions {
  /**
   *
   * @type {Array<{x: number, z: number, age: number, strength: number}>}
   */
  #history = [];
  /**
   *
   * @type {Map}
   */
  #contacts = new Map();
  /**
   *
   * @type {Float32Array}
   */
  #positions = new Float32Array(MAXIMUM_IMPRESSIONS * 4);
  /**
   *
   * @type {Float32Array}
   */
  #shapes = new Float32Array(MAXIMUM_IMPRESSIONS * 4);

  get positions() {
    return this.#positions;
  }

  get shapes() {
    return this.#shapes;
  }

  /**
   *
   * @param {number} deltaTime
   * @param {number} contacts
   */
  update(deltaTime, contacts = []) {
    for (const impression of this.#history) {
      impression.age += deltaTime;
    }
    this.#history = this.#history.filter(GrassImpressions.#filter);
    const active = contacts
      .map(this.#mapContact.bind(this))
      .filter(GrassImpressions.#filter2)
      .sort(GrassImpressions.#sortLeft)
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
      /**
       *
       * @param {boolean} candidate
       */
      const hasContactId = (candidate) => candidate.id === id;
      if (!active.some(hasContactId)) {
        this.#stamp(contact.last);
        this.#contacts.delete(id);
      }
    }
    this.#positions.fill(0);
    this.#shapes.fill(0);
    [...active, ...this.#history]
      .slice(0, MAXIMUM_IMPRESSIONS)
      .forEach(this.#forEachImpression.bind(this));
  }

  /**
   *
   * @param {number} contact
   * @param {number} index
   */
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

  /**
   *
   * @param {number} contact
   */
  #stamp(contact) {
    this.#history.unshift({
      ...contact,
      age: 0,
    });
    this.#history.length = Math.min(
      MAXIMUM_IMPRESSIONS,
      this.#history.length,
    );
  }

  /**
   *
   * @param {{age: number}} options
   * @param {number} options.age
   */
  static #filter({ age }) {
    return age < RECOVERY_SECONDS;
  }

  /**
   *
   * @param {number} contact
   * @param {number} index
   */
  #mapContact(contact, index) {
    return this.#normalize(contact, index);
  }

  /**
   *
   * @param {{strength: number}} options
   * @param {number} options.strength
   */
  static #filter2({ strength }) {
    return strength > MINIMUM_STRENGTH;
  }

  /**
   *
   * @param {boolean} left
   * @param {number} right
   */
  static #sortLeft(left, right) {
    return right.strength - left.strength;
  }

  /**
   *
   * @param {{x: number, y: number, z: number, radius: number, strength: number}} impression
   * @param {number} index
   */
  #forEachImpression(impression, index) {
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
  }
}
