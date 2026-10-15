import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('?url')) {
    return { url: `data:text/javascript,export default ${JSON.stringify(specifier)}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { Fire } = await import('../../../../../src/game/objects/fire/Fire.js');

class Entity {
  children = [];
  tags = { add() {} };
  constructor(name) { this.name = name; }
  addChild(child) { this.children.push(child); }
  setLocalPosition(...position) { this.position = position; }
  setLocalEulerAngles() {}
  addComponent(type, options) { this[type] = options; }
  destroy() { this.destroyed = true; }
}
class Curve { constructor(keys) { this.keys = keys; } }
class Vec3 { constructor(x, y, z) { Object.assign(this, { x, y, z }); } }
const pc = { Entity, Curve, CurveSet: Curve, Vec3 };
const app = { assets: { find: () => ({ resource: 'texture' }) } };

test('one volume creates one emitter with derived footprint, height and density', () => {
  const fire = new Fire({ pc, app, definition: { id: 'fire', position: { x: 2, y: 3, z: 4 }, volume: { x: 2, y: 1, z: 1 } } });
  const root = fire.entity.children[0];
  assert.deepEqual(root.position, [2, 3, 4]);
  assert.equal(root.children.length, 1);
  const particles = root.children[0].particlesystem;
  // Box spawning already applies world rotation; avoid rotating it again at render.
  assert.equal(particles.localSpace, false);
  assert.equal(particles.intensity, 1.08);
  assert.equal(particles.emitterExtents.x, 1.6400000000000001);
  assert.equal(particles.emitterExtents.z, 0.64);
  assert.equal(particles.numParticles, 124);
  assert.equal(particles.localVelocityGraph.keys[1][1], 0.64 / 0.42);
  fire.destroy();
  assert.equal(fire.entity.destroyed, true);
});

test('intensity changes brightness independently of the box and zero disables flames', () => {
  for (const intensity of [0, 0.5, 2]) {
    const fire = new Fire({ pc, app, definition: { id: 'fire', position: { x: 0, y: 0, z: 0 }, volume: { x: 2, y: 1, z: 1 }, intensity } });
    const emitter = fire.entity.children[0].children[0];
    assert.equal(emitter.enabled, intensity > 0);
    assert.equal(emitter.particlesystem.intensity, 1.08 * intensity);
    assert.equal(emitter.particlesystem.emitterExtents.x, 1.6400000000000001);
    assert.equal(emitter.particlesystem.localVelocityGraph.keys[1][1], 0.64 / 0.42);
    fire.destroy();
  }
});
