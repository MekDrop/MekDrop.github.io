import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../../../src/game/PlayCanvasRenderer.js", import.meta.url), "utf8");
const start = source.indexOf("  #completeInteraction = () => {");
const method = source.slice(start, source.indexOf("\n  #clearScene()", start));
const Driver = new Function(`return class {
  usingTool = true;
  target = "dig";
  #setInteractionTarget(target) { this.target = target; }
  #updateInteractionTarget() {
    if (!this.usingTool) this.target = "fill";
  }
  finishTool() {
    this.#completeInteraction();
    this.usingTool = false;
  }
  ${method}
}`)();

it("refreshes the next interaction after the tool's exit transition", async () => {
  const driver = new Driver();
  driver.finishTool();
  assert.equal(driver.target, null);
  await Promise.resolve();
  assert.equal(driver.target, "fill");
});
