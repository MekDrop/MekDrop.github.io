import assert from "node:assert/strict";
import { test } from "node:test";
import { VestibuleRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/vestibule/VestibuleRoomGenerator.js";
import { RoyalBedroomRoomGenerator } from "../../../../../../src/game/generator/castle/rooms/royal-bedroom/RoyalBedroomRoomGenerator.js";
import { PaintingCatalog } from "../../../../../../src/game/objects/castle-props/painting/PaintingCatalog.js";

test("room furnishing stores varied, repeatable subjects from the appropriate content pool", () => {
  for (const [generator, id, subjects] of [
    [new VestibuleRoomGenerator(), "vestibule", PaintingCatalog.arrivalSubjects],
    [new RoyalBedroomRoomGenerator(), "royal-chamber", PaintingCatalog.bedroomSubjects],
  ]) {
    const seen = new Set();
    for (let seed = 0; seed < 50; seed++) {
      const room = {
        id,
        minX: 0,
        maxX: 7,
        minZ: 0,
        maxZ: 8,
        floorY: 0,
        height: 3,
        level: 0,
        furnishingSeed: seed,
      };
      const pictures = generator.furnish(room).filter(item => item.object === "Painting");
      assert.ok(pictures.length > 0, `${id}: ${seed}`);
      assert.deepEqual(generator.furnish(room).filter(item => item.object === "Painting"), pictures);
      for (const picture of pictures) {
        assert.ok(subjects.includes(picture.variant), `${id}: ${picture.variant}`);
        seen.add(picture.variant);
      }
    }
    assert.ok(seen.size > 5, `${id} should vary across furnishing seeds`);
  }
});
