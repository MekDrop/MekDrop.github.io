import { GameCommandRegistry } from "./GameCommandRegistry.js";
import { GetWindSpeedCommand } from "./GetWindSpeedCommand.js";
import { HelpCommand } from "./HelpCommand.js";
import { SetWindSpeedCommand } from "./SetWindSpeedCommand.js";

/**
 *
 * @param {{target: EventTarget|pc.Entity, logger: Console}} options
 * @param {EventTarget|pc.Entity} options.target
 * @param {Console} options.logger
 */
export function createGameCommandRegistry({
  target = globalThis,
  logger = console,
} = {}) {
  const registry = new GameCommandRegistry(target);
  registry.register(new GetWindSpeedCommand());
  registry.register(new SetWindSpeedCommand(logger));
  registry.register(new HelpCommand(registry, logger));
  return registry;
}

export {
  GameCommandRegistry,
  GetWindSpeedCommand,
  HelpCommand,
  SetWindSpeedCommand,
};
