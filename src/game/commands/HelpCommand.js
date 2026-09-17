export class HelpCommand {
  #registry;
  #logger;

  constructor(registry, logger = console) {
    this.#registry = registry;
    this.#logger = logger;
  }

  get name() {
    return "help";
  }

  get usage() {
    return "help()";
  }

  get description() {
    return "Prints every available game console command.";
  }

  execute() {
    const commands = this.#registry.commands.map((command) => ({
      command: command.usage,
      description: command.description,
    }));
    this.#logger.table(commands);
    return commands;
  }
}
