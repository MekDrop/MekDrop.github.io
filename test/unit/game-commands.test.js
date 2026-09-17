import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createGameCommandRegistry } from "../../src/game/commands/index.js";
import {
  AMBIENT_WIND_BASE_SPEED,
  getAmbientWindSpeed,
  resetAmbientWindSpeed,
} from "../../src/game/objects/shared/AmbientWind.js";

function createLogger() {
  return {
    tables: [],
    warnings: [],
    table(rows) {
      this.tables.push(rows);
    },
    warn(message) {
      this.warnings.push(message);
    },
  };
}

afterEach(() => {
  resetAmbientWindSpeed();
});

describe("game console commands", () => {
  it("installs class-backed commands and prints all of them from help", () => {
    const target = {};
    const logger = createLogger();
    const registry = createGameCommandRegistry({ target, logger });

    registry.install();
    const commands = target.help();

    assert.deepEqual(
      commands.map(({ command }) => command),
      [
        "getWindSpeed()",
        "help()",
        'setWindSpeed(speed | "auto")',
      ],
    );
    assert.deepEqual(logger.tables, [commands]);
    registry.destroy();
    assert.equal(target.help, undefined);
    assert.equal(target.getWindSpeed, undefined);
    assert.equal(target.setWindSpeed, undefined);
  });

  it("gets and overrides the wind speed, then restores automatic wind", () => {
    const target = {};
    const registry = createGameCommandRegistry({ target });
    registry.install();

    assert.equal(target.getWindSpeed(), AMBIENT_WIND_BASE_SPEED);
    assert.equal(target.setWindSpeed(0.42), 0.42);
    assert.equal(target.getWindSpeed(), 0.42);
    assert.equal(getAmbientWindSpeed(100), 0.42);
    assert.equal(target.setWindSpeed("auto"), AMBIENT_WIND_BASE_SPEED);
    assert.notEqual(getAmbientWindSpeed(100), 0.42);

    registry.destroy();
  });

  it("allows strong wind speeds above one", () => {
    const target = {};
    const registry = createGameCommandRegistry({ target });
    registry.install();

    assert.equal(target.setWindSpeed(8), 8);
    assert.equal(target.getWindSpeed(), 8);
    assert.equal(getAmbientWindSpeed(100), 8);

    registry.destroy();
  });

  it("rejects invalid wind speeds without changing the current speed", () => {
    const target = {};
    const logger = createLogger();
    const registry = createGameCommandRegistry({ target, logger });
    registry.install();
    target.setWindSpeed(0.3);

    assert.equal(target.setWindSpeed(-0.1), null);
    assert.equal(target.setWindSpeed(Number.NaN), null);
    assert.equal(target.setWindSpeed("stormy"), null);
    assert.equal(target.getWindSpeed(), 0.3);
    assert.equal(logger.warnings.length, 3);

    registry.destroy();
  });

  it("restores a previous global when the registry is destroyed", () => {
    const originalHelp = () => "original";
    const target = { help: originalHelp };
    const registry = createGameCommandRegistry({ target });

    registry.install();
    assert.notEqual(target.help, originalHelp);
    registry.destroy();

    assert.equal(target.help, originalHelp);
  });
});
