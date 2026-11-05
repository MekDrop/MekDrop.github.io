import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CastleGenerator } from '../../../../../src/game/generator/castle/CastleGenerator.js';
import { CastleResidentialLayout } from '../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js';

for (const basePlanId of ['castle-rear-bell-tower', 'castle-tower-bridge']) {
  test(`${basePlanId} reserves a clear storage aisle after rotation and mirroring`, async () => {
    const map = JSON.parse(await readFile(`src/game/maps/tests/${basePlanId}.json`, 'utf8'));
    const castle = map.objects.find(item => item.object === 'Castle');
    for (const seed of [0, 1]) {
      for (const side of ['NORTH', 'SOUTH', 'EAST', 'WEST']) {
        const plan = await CastleGenerator.generate({
          ...castle,
          seed,
          doors: [{
            ...castle.doors[0],
            side,
          }],
        });
        const layout = new CastleResidentialLayout(plan);
        const room = layout.rooms.storeroom;
        const supplies = plan.metadata.runtime.authoredObjects.filter(item => item.id?.startsWith('store-reserve-'));
        assert.equal(supplies.length, 5);
        for (const item of supplies) {
          const local = layout.toLocal(item.position.x, item.position.z);
          const half = .554 * item.scale / 2;
          assert.ok(local.x - half > room.minX + .125 && local.x + half < room.maxX - .125);
          assert.ok(local.z - half > room.minZ + .125 && local.z + half < room.maxZ - .125);
          // The new stock occupies only the far wall strip, leaving the entire
          // central route and the existing racks' metre-deep approaches open.
          assert.ok(Math.min(local.z - room.minZ, room.maxZ - local.z) + half < .85, `${seed}/${side}: stock stays in the wall strip`);
          for (const rack of plan.metadata.runtime.authoredObjects.filter(object => object.object === 'Shelf' && object.roomId === 'storeroom')) {
            const angle = rack.rotation * Math.PI / 180;
            const dx = item.position.x - rack.position.x, dz = item.position.z - rack.position.z;
            const front = dx * Math.sin(angle) + dz * Math.cos(angle);
            const across = dx * Math.cos(angle) - dz * Math.sin(angle);
            assert.ok(front - half > 1.225 || front + half < 0 || Math.abs(across) - half > .9, 'metre-deep rack approaches stay clear');
          }
          const door = plan.metadata.runtime.residential.openings.find(opening => opening.roomId === 'storeroom' && opening.kind === 'door');
          const along = Math.abs((door.axis === 'x' ? local.z : local.x) - door.center);
          const normal = Math.abs((door.axis === 'x' ? local.x : local.z) - door.coordinate);
          assert.ok(along > half + door.width / 2 + .05 || normal > half + door.width + .05,
            `${seed}/${side}: the inward door sweep stays clear`);
        }
        const bottom = supplies.find(item => item.id === 'store-reserve-crate-1');
        const top = supplies.find(item => item.id === 'store-reserve-crate-top');
        assert.equal(top.position.x, bottom.position.x);
        assert.equal(top.position.z, bottom.position.z);
        assert.ok(Math.abs(top.position.y - bottom.position.y - .4702) < 1e-6);
      }
    }
  });
}
