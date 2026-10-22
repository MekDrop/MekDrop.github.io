import assert from 'node:assert/strict';
import test from 'node:test';
import { Entity, Vec3 } from 'playcanvas';
import { State } from 'yuka';
import { Enemy } from '../../../../../../src/game/objects/enemies/shared/Enemy.js';

function createEnemy(actors = []) {
  const enemy = new Enemy({
    pc: {
      Entity,
      Vec3,
    },
    app: {},
    definition: {id: 'enemy'},
    runtime: {objects: actors},
  });

  return enemy;
}

test('health clamps damage/healing, rejects non-finite values and cannot revive death', () => {
  const enemy = createEnemy();
  assert.equal(enemy.receiveDamage(NaN), 0);
  assert.equal(enemy.receiveDamage(35), 35);
  assert.equal(enemy.receiveHealing(100), 35);
  assert.equal(enemy.health, 100);
  assert.equal(enemy.receiveDamage(150), 100);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.receiveHealing(10), 0);
  assert.equal(enemy.applyStatus('stun'), false);
});

test('royal resolution selects actual royal actor, never a castle or tower', () => {
  const castle = {entity: new Entity('castle')};
  const royal = {
    entity: new Entity('royal'),
    beginGameOver: () => {},
  };
  royal.entity.setPosition(5, 0, 0);
  const enemy = createEnemy([castle, royal]);
  assert.equal(enemy.resolveRoyalTarget(), royal);
  royal.alive = false;
  assert.equal(enemy.resolveRoyalTarget(), null);
});

test('Yuka executes the state owner and statuses expire on simulation time', () => {
  const enemy = createEnemy();
  class CounterState extends State {
    execute(owner) {
      owner.count = (owner.count ?? 0) + 1;
    }
  }
  enemy.behavior.add(CounterState.name, new CounterState());
  enemy.behavior.changeTo(CounterState.name);
  enemy.applyStatus('slow', {
    duration: 0.5,
    factor: 0.5,
  });
  enemy.update(0.25);
  assert.equal(enemy.count, 1);
  assert.equal(enemy.statuses.get('slow').remaining, 0.25);
  enemy.update(0);
  assert.equal(enemy.count, 1);
  enemy.update(0.25);
  assert.equal(enemy.statuses.has('slow'), false);
});

test('immune bells encourage once and secondary rings cannot form a feedback cycle', () => {
  const enemy = createEnemy();
  enemy.bellImmune = true;
  let encouragements = 0;
  enemy.onBellEncouraged = () => encouragements++;
  assert.equal(enemy.onBellRung({eventId: 'ring'}), false);
  enemy.onBellRung({eventId: 'ring'});
  enemy.onBellRung({
    eventId: 'echo',
    secondary: true,
  });
  assert.equal(encouragements, 1);
  assert.equal(enemy.statuses.has('confused'), false);
  const vulnerable = createEnemy();
  assert.equal(vulnerable.onBellRung({eventId: 'first'}), true);
  assert.equal(vulnerable.onBellRung({eventId: 'first'}), false);
});

test('carry, launch and landing hand flight to body and dispatch landing once', () => {
  const enemy = createEnemy();
  const carrier = {entity: new Entity('carrier')};
  carrier.entity.setPosition(2, 0, 3);
  enemy.entity.rigidbody = {
    enabled: true,
    linearVelocity: new Vec3(),
    teleport: () => {},
  };
  let landed = 0;
  enemy.onLanded = () => landed++;
  assert.equal(enemy.beginCarry(carrier), true);
  assert.equal(enemy.entity.rigidbody.enabled, false);
  enemy.update(0.1);
  assert.ok(enemy.position.distance(new Vec3(2, 1.1, 3)) < 0.00001);
  assert.equal(enemy.launch({
    velocity: {
      x: 2,
      y: 5,
      z: 1,
    },
  }), true);
  assert.equal(enemy.carrier, null);
  assert.equal(enemy.thrower, carrier);
  assert.equal(enemy.airborne, true);
  assert.equal(enemy.entity.rigidbody.enabled, true);
  assert.deepEqual(enemy.entity.rigidbody.linearVelocity.toArray(), [2, 5, 1]);
  enemy.moveToward(carrier);
  assert.deepEqual(enemy.entity.rigidbody.linearVelocity.toArray(), [2, 5, 1]);
  assert.equal(enemy.onLanding(), true);
  assert.equal(enemy.onLanding(), false);
  assert.equal(landed, 1);
});


test('map coordinates and authored rotation place the semantic root before physics starts', () => {
  const enemy = new Enemy({
    pc:{
      Entity,
      Vec3,
    },
    app:{},
    runtime:{},
    definition:{
      id:'placed',
      position:{
        x:2,
        y:3,
        z:-4,
      },
      rotation:90,
    },
  });
  assert.deepEqual(enemy.position.toArray(),[2,3,-4]);
  assert.ok(enemy.entity.forward.distance(new Vec3(-1,0,0))<0.00001);
});
