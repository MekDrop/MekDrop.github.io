import assert from 'node:assert/strict';
import test from 'node:test';
import { Entity, EventHandler, Vec3 } from 'playcanvas';
import { BellBugGroundPose } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugGroundPose.js';
import { BellBugCalibration } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugCalibration.js';

test('six rigid feet follow separate tread heights without accumulating offsets or changing hide poses', () => {
  const app = new EventHandler();
  const entity = new Entity('bug'), model = new Entity('model');
  entity.setPosition(0, 0.312, 0);
  model.setLocalScale(BellBugCalibration.scale, BellBugCalibration.scale, BellBugCalibration.scale);
  model.setLocalPosition(0, BellBugCalibration.y, BellBugCalibration.z);
  entity.addChild(model);
  const bones = [];
  for (const side of ['L', 'R']) {
    for (let index = 0; index < 3; index++) {
      const bone = new Entity(`leg_${side}_${index}`);
      bone.setLocalPosition(side === 'L' ? -0.4 : 0.4, 0.1, (index - 1) * 0.3);
      model.addChild(bone);
      const mesh = new Entity(`BellBug leg ${side}${index}`);
      bone.addChild(mesh);
      mesh.findComponents = () => [{
        meshInstances: [{
          aabb: {
            get center() {
              return bone.getPosition();
            },
          },
        }],
      }];
      bones.push(bone);
    }
  }
  const owner = {
    app,
    entity,
    stateName: 'BellBugPursueState',
    clip: 'scuttle_walk',
    grounded: true,
    get position() {
      return entity.getPosition();
    },
    stepSupport: {
      surface: (x, z) => {
        return { point: new Vec3(x, z < 0 ? 0.3 : 0, z) };
      },
    },
  };
  const pose = new BellBugGroundPose(owner, model);
  for (let frame = 0; frame < 20; frame++) {
    app.fire('prerender', 1 / 60);
    for (const bone of bones) {
      const world = bone.getPosition();
      const ground = world.z < 0 ? 0.3 : 0;
      assert.ok(Math.abs(world.y - (0.1 * BellBugCalibration.scale + BellBugCalibration.y + ground + BellBugCalibration.groundClearance)) < 1e-5);
      assert.deepEqual(bone.getLocalScale(), Vec3.ONE);
      assert.ok(bone.getLocalPosition().y <= 0.1 + 1e-6, 'terrain must never push a foot upward into the bell');
    }
    app.fire('postrender');
    for (const bone of bones) {
      assert.ok(Math.abs(bone.getLocalPosition().y - 0.1) < 1e-6);
    }
  }
  owner.stateName = 'BellBugPanicState';
  owner.clip = 'hide_loop';
  app.fire('prerender', 1 / 60);
  assert.ok(Math.abs(model.getLocalPosition().y - BellBugCalibration.y) < 1e-6);
  pose.destroy();
});
