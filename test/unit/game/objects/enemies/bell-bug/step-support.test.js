import assert from 'node:assert/strict';
import test from 'node:test';
import { Entity, Vec3 } from 'playcanvas';
import { BellBugStepSupport } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugStepSupport.js';

function fixture({ height = 0.3, blocked = false, ceiling = false, type = 'static' } = {}) {
  const entity = new Entity('bug');
  const ground = new Entity('tread');
  ground.rigidbody = { type };
  const calls = [];
  const bug = {
    pc: { Vec3 },
    entity,
    radius: 0.42,
    height: 0.85,
    grounded: true,
    statuses: new Map(),
    get position() {
      return entity.getPosition();
    },
    app: {
      systems: {
        rigidbody: {
          raycastAll: (start, end) => {
            if (start.y > end.y) {
              const y = start.z < -0.1 ? height : 0;

              return y <= start.y && y >= end.y ? [{
                entity: ground,
                point: new Vec3(start.x, y, start.z),
                normal: new Vec3(0, 1, 0),
              }] : [];
            }
            return (start.y === end.y ? blocked : ceiling) ? [{ entity: ground }] : [];
          },
        },
      },
    },
  };
  entity.rigidbody = {
    linearVelocity: new Vec3(0, -0.1, -1),
    teleport: p => {
      calls.push(p.clone()); entity.setPosition(p);
    },
  };

  return {
    bug,
    calls,
    support: new BellBugStepSupport(bug),
  };
}

test('a reachable tread lifts the capsule while retaining horizontal velocity', () => {
  const { bug, support, calls } = fixture();
  support.advance(new Vec3(0, 0, -1));
  assert.equal(calls.length, 1);
  assert.ok(Math.abs(bug.position.y - 0.304) < 1e-6);
  assert.deepEqual(bug.entity.rigidbody.linearVelocity, new Vec3(0, 0, -1));
});

test('settling just below the authored stair base still permits an ordinary riser', () => {
  const { bug, support, calls } = fixture();
  bug.entity.setPosition(0, -0.01, 0);
  support.advance(new Vec3(0, 0, -1));
  assert.equal(calls.length, 1);
  assert.ok(bug.position.y - (-0.01) <= 0.32);
});

test('walls, ceilings, tall risers and moving objects cannot become automatic steps', () => {
  for (const options of [{ blocked: true }, { ceiling: true }, { height: 0.5 }, { type: 'dynamic' }]) {
    const { support, calls } = fixture(options);
    support.advance(new Vec3(0, 0, -1));
    assert.equal(calls.length, 0, JSON.stringify(options));
  }
});

test('falling, thrown, carried and stunned bugs never receive a step lift', () => {
  for (const state of ['ungrounded', 'airborne', 'carrier', 'stun', 'falling']) {
    const { bug, support, calls } = fixture();
    if (state === 'ungrounded') {
      bug.grounded = false;
    } else if (state === 'stun') {
      bug.statuses.set('stun', {});
    } else if (state === 'falling') {
      bug.entity.rigidbody.linearVelocity.y = -3;
    } else {
      bug[state] = true;
    }
    support.advance(new Vec3(0, 0, -1));
    assert.equal(calls.length, 0, state);
  }
});
