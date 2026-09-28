export class HelpCommand {
  /**
   *
   * @type {GameCommandRegistry}
   */
  #registry;
  /**
   *
   * @type {Console}
   */
  #logger;

  /**
   *
   * @param {GameCanvasPluginRegistry} registry
   * @param {Pick<Console, "debug"|"info"|"warn"|"error">} logger
   */
  constructor(registry, logger = console) {
    /**
     *
     * @type {GameCommandRegistry}
     */
    this.#registry = registry;
    /**
     *
     * @type {Console}
     */
    this.#logger = logger;
  }

  /**
   *
   * @returns {string}
   */
  get name() {
    return "help";
  }

  /**
   *
   * @returns {string}
   */
  get usage() {
    return "help()";
  }

  /**
   *
   * @returns {string}
   */
  get description() {
    return "Prints every available game console command.";
  }

  execute() {
    const commands = this.#registry.commands.map(/**
     *
     * @param {string} command
     */
    (command) => ({
      command: command.usage,
      description: command.description,
    }));
    this.#logger.table(commands);
    return commands;
  }
}
