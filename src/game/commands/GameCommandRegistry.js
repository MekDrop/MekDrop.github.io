export class GameCommandRegistry {
  /**
   *
   * @type {typeof globalThis}
   */
  #target;
  /**
   *
   * @type {Map}
   */
  #commands = new Map();
  /**
   *
   * @type {Map}
   */
  #installedProperties = new Map();
  /**
   *
   * @type {boolean}
   */
  #installed = false;

  /**
   *
   * @param {typeof globalThis} target
   */
  constructor(target = globalThis) {
    /**
     *
     * @type {typeof globalThis}
     */
    this.#target = target;
  }

  /**
   *
   * @returns {Array}
   */
  get commands() {
    return [...this.#commands.values()].sort(/**
     *
     * @param {{name: string}} left
     * @param {{name: string}} right
     */
    (left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  /**
   *
   * @param {string} command
   */
  register(command) {
    if (!command?.name || this.#commands.has(command.name)) {
      return false;
    }
    this.#commands.set(command.name, command);
    if (this.#installed) {
      this.#installCommand(command);
    }
    return true;
  }

  install() {
    if (this.#installed) {
      return;
    }
    this.#installed = true;
    for (const command of this.#commands.values()) {
      this.#installCommand(command);
    }
  }

  destroy() {
    for (const [name, installed] of this.#installedProperties) {
      const current = Object.getOwnPropertyDescriptor(this.#target, name);
      if (current?.value !== installed.invocation) {
        continue;
      }
      if (installed.previous) {
        Object.defineProperty(this.#target, name, installed.previous);
      } else {
        delete this.#target[name];
      }
    }
    this.#installedProperties.clear();
    this.#installed = false;
  }

  /**
   *
   * @param {string} command
   */
  #installCommand(command) {
    const previous = Object.getOwnPropertyDescriptor(
      this.#target,
      command.name,
    );
    if (previous && !previous.configurable) {
      return;
    }
    /**
     *
     * @param {...(string|number|boolean)} parameters
     */
    const invocation = (...parameters) => command.execute(...parameters);
    Object.defineProperty(this.#target, command.name, {
      configurable: true,
      enumerable: false,
      value: invocation,
      writable: false,
    });
    this.#installedProperties.set(command.name, { invocation, previous });
  }
}
