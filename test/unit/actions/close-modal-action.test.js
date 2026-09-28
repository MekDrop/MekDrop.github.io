import assert from "node:assert/strict";
import test from "node:test";

import { AbstractModalAction } from "../../../src/actions/AbstractModalAction.js";
import { CloseModalAction } from "../../../src/actions/CloseModalAction.js";
import { ToggleInventoryAction } from "../../../src/game/actions/ToggleInventoryAction.js";

test("closes inventory through the shared modal action contract", () => {
  const renderer = {
    inventoryVisible: true,
    closeInventory() {
      return true;
    },
  };
  const modal = new ToggleInventoryAction(renderer, { clear() {} });

  assert.ok(modal instanceof AbstractModalAction);
  assert.equal(new CloseModalAction([modal]).invoke(), true);
});
