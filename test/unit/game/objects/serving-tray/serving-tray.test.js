import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../../../../../src/game/objects/serving-tray/ServingTray.js", import.meta.url), "utf8");
const isolated = source.replace(/^import .*;$/gm, "")
  .replace("export class", "const modelUrl = 'tray.glb'; class AbstractCastleProp {} export class");
const { ServingTray } = await import("data:text/javascript," + encodeURIComponent(isolated));

test("legacy trays preserve placement and carrier trays precede servants without duplication", () => {
  const legacy = {
    id: "stored",
    object: "TerraceServingTray",
    position: { x: 1, y: 2, z: 3 },
    scale: 0.45,
  };
  const servant = { id: "staff", object: "Servant" };
  const map = { objects: [legacy, servant] };
  ServingTray.prepareMap(map);
  assert.equal(legacy.object, "ServingTray");
  assert.deepEqual(legacy.position, { x: 1, y: 2, z: 3 });
  assert.equal(legacy.scale, 0.45);
  assert.equal(map.objects[0].carrierId, servant.id);
  const first = JSON.stringify(map);
  ServingTray.prepareMap(map);
  assert.equal(JSON.stringify(map), first);
});

