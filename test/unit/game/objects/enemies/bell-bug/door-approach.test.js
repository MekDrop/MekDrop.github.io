import assert from 'node:assert/strict';
import test from 'node:test';
import { Entity, Vec3 } from 'playcanvas';
import { BellBugDoorApproach } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugDoorApproach.js';

function fixture() {
  const entity = new Entity('entrance');
  entity.setPosition(-7, 3, 5);
  const door = {
    entity,
    openAmount: 0,
  };
  const owner = {
    position: new Vec3(-8.07, 3, 5.01),
    radius: .2541,
    stepSupport: { surface: (x, z) => ({ point: new Vec3(x, 3, z) }) },
  };

  return {
    door,
    owner,
    approach: new BellBugDoorApproach(owner),
  };
}

test('an entrance approach aims in front of the leaf instead of behind its jamb', () => {
  const { door, approach } = fixture();
  const point = approach.next(door).position;
  assert.equal(point.x, -7);
  assert.equal(point.y, 3);
  assert.ok(Math.abs(point.z - 5.3741) < 1e-8);
});

test('a door approach preserves its side when contact nudges the bug across the leaf plane', () => {
  const { door, owner, approach } = fixture();
  const point = approach.next(door).position;
  owner.position.z = 4.99;
  assert.deepEqual(approach.next(door).position, point);
});

test('a rotated entrance uses its own normal to line up with the leaf', () => {
  const { door, owner, approach } = fixture();
  door.entity.setEulerAngles(0, 90, 0);
  owner.position.set(-8.07, 3, 4.997);
  const point = approach.next(door).position;
  assert.ok(Math.abs(point.x + 7.3741) < 1e-8);
  assert.ok(Math.abs(point.z - 5) < 1e-8);
});

test('door approach does not cut across the stair flight or unsupported ground', () => {
  const { door, owner, approach } = fixture();
  owner.position.set(-8.5, 2.6, 6.8);
  assert.equal(approach.next(door), null);
  owner.position.set(-8.07, 3, 5.01);
  owner.stepSupport.surface = () => null;
  assert.equal(approach.next(door), null);
});

test('opening the door releases the approach so the route can continue', () => {
  const { door, approach } = fixture();
  assert.ok(approach.next(door));
  door.openAmount = 1;
  assert.equal(approach.next(door), null);
});
