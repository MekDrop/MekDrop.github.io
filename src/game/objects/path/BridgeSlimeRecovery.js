/**
 * Capture a local inverse-morph handoff before its native material is removed.
 * The upper exterior avoids reactivating the actor inside an inverted body.
 * @param {typeof import("playcanvas")} pc
 * @param {import("./BridgeSlimePhysics.js").BridgeSlimePhysics} physics
 * @param {number} station
 * @returns {{position:import("playcanvas").Vec3,velocity:import("playcanvas").Vec3}|null}
 */
export const captureSlimeRecovery = (pc, physics, station) => {
  const pose = physics.getPose(station);
  if (!pose) {
    return null;
  }
  const entity = physics.getEntity(station);
  const half = entity?.collision?.halfExtents;
  let position = pose.position.clone();
  if (entity && half) {
    const transform = entity.getWorldTransform();
    const x = transform.transformVector(new pc.Vec3(half.x, 0, 0));
    const y = transform.transformVector(new pc.Vec3(0, half.y, 0));
    const z = transform.transformVector(new pc.Vec3(0, 0, half.z));
    position = entity.getPosition().clone();
    position.y += Math.abs(x.y) + Math.abs(y.y) + Math.abs(z.y);
  }
  return {
    position,
    velocity: entity?.rigidbody?.linearVelocity?.clone() ?? new pc.Vec3(),
  };
};
