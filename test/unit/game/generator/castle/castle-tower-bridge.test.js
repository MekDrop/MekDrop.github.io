import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { it } from 'node:test';
import { CastleGenerator } from '../../../../../src/game/generator/castle/CastleGenerator.js';
import { CastleResidentialLayout } from '../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js';
import { WalkingPaths } from '../../../../../src/game/navigation/WalkingPaths.js';
import { createCastleGroundCuts } from '../../../../../src/game/objects/castle/ground/CastleGroundCuts.js';

it('routes monsters under the entrance bridge and ends at the spiral tower door', async () => {
  const map = JSON.parse(await readFile(new URL('../../../../../src/game/maps/tests/castle-tower-bridge.json', import.meta.url), 'utf8'));
  WalkingPaths.rebuild(map);
  const route = map.paths[0].route;
  assert.ok(route.length > 0);
  assert.deepEqual(route.at(-1), {
    col: 21.5,
    row: 26.5,
    elevation: 2,
  });
  assert.ok(route.some(point => point.col === 21.5 && point.row === 18.5));
});

it('keeps the bridge underpass open and both tower exits aligned after rotation and mirroring', async () => {
  for (const seed of [6, 7]) {
    for (const side of ['NORTH', 'SOUTH', 'EAST', 'WEST']) {
      const plan = await CastleGenerator.generate({
        basePlanId: 'castle-tower-bridge',
        seed,
        position: {
          x: -8,
          z: -16,
          width: 16,
          depth: 21,
          elevation: 2,
        },
        doors: [{
          side,
          offset: 7,
          width: 2,
        }],
      });
      const r = plan.metadata.runtime.residential;
      const layout = new CastleResidentialLayout(plan);
      const approach = layout.toWorld(0, -0.3, 0);
      assert.equal(createCastleGroundCuts(plan, layout).some(cut => approach.x > cut.minX && approach.x < cut.maxX && approach.z > cut.minZ && approach.z < cut.maxZ), false, 'terrain path survives immediately outside the sill');
      const upperOpening = r.openings.find(opening => opening.roomId === 'descent-tower-upper' && opening.kind === 'door');
      const lintel = layout.toWorld(upperOpening.axis === 'x' ? upperOpening.coordinate : upperOpening.center,
        upperOpening.axis === 'z' ? upperOpening.coordinate : upperOpening.center, upperOpening.floorY - r.origin.y + 2.725);
      assert.ok(plan.metadata.collision.cameraBlocks.some(block => Math.abs(block.x - lintel.x) <= block.halfX + 1e-6 && Math.abs(block.z - lintel.z) <= block.halfZ + 1e-6 && Math.abs(block.y - lintel.y) < block.halfY), 'stone meets the top of the wooden header');
      for (const flank of [-0.95, 0.95]) {
        const jamb = layout.toWorld(upperOpening.axis === 'x' ? upperOpening.coordinate : upperOpening.center + flank,
          upperOpening.axis === 'z' ? upperOpening.coordinate : upperOpening.center + flank, upperOpening.floorY - r.origin.y + 1);
        assert.ok(plan.metadata.collision.cameraBlocks.some(block => Math.abs(block.x - jamb.x) <= block.halfX + 1e-6 && Math.abs(block.z - jamb.z) <= block.halfZ + 1e-6 && Math.abs(block.y - jamb.y) < block.halfY), 'stone closes both sides of the terrace doorway');
      }
      const bridge = r.spaces.find(space => space.id === 'terrace-link');
      assert.equal(bridge.floorY, 6);
      assert.equal(r.spaces.some(space => space.id === 'rear-corridor'), false);
      assert.equal(r.doorways.filter(door => door.exteriorEntrance).length, 1);
      assert.equal(r.doorways.find(door => door.exteriorEntrance).roomId, 'tower-entrance');
      assert.equal(plan.metadata.runtime.entranceDoorOwnedByRoom, true);
      assert.ok(plan.metadata.runtime.roomDoors.some(door => door.roomId === 'tower-ground' && door.width === 1.2 && door.exteriorEntrance));
      assert.ok(plan.metadata.runtime.roomDoors.some(door => door.roomId === 'tower-terrace' && door.y === 6));
      assert.ok(plan.metadata.runtime.roomDoors.some(door => door.roomId === 'descent-tower-upper' && door.y === 6));
      assert.equal(r.authoredStairs.length, 1);
      const below = layout.toWorld((bridge.minX + bridge.maxX) / 2, (bridge.minZ + bridge.maxZ) / 2, 1);
      assert.equal(plan.metadata.collision.cameraBlocks.some(block => Math.abs(block.x - below.x) < block.halfX && Math.abs(block.y - below.y) < block.halfY && Math.abs(block.z - below.z) < block.halfZ), false);
    }
  }
});
