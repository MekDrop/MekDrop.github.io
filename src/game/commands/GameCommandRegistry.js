export class GameCommandRegistry {
  #target;
  #commands = new Map();
  #installedProperties = new Map();
  #installed = false;

  constructor(target = globalThis) {
    this.#target = target;
  }

  get commands() {
    return [...this.#commands.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

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

  #installCommand(command) {
    const previous = Object.getOwnPropertyDescriptor(
      this.#target,
      command.name,
    );
    if (previous && !previous.configurable) {
      return;
    }
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
