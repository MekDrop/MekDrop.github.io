/**
 * Solid, animated sword parts. Their model hierarchy owns their lifetime and
 * PlayCanvas updates the kinematic bodies from the animated world transforms.
 */
export class KingSwordCollision {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} model
   */
  constructor(pc, model) {
    for (const name of ["King sword blade", "King sword crossguard"]) {
      const part = model.findByName(name);
      for (const instance of part?.render?.meshInstances ?? []) {
        const bounds = instance.mesh.aabb;
        const collider = new pc.Entity(`${name} collision`);
        part.addChild(collider);
        collider.setLocalPosition(bounds.center);
        collider.addComponent("collision", {
          type: "box",
          halfExtents: bounds.halfExtents.clone(),
        });
        collider.addComponent("rigidbody", {
          type: pc.BODYTYPE_KINEMATIC,
          friction: 0,
          restitution: 0,
        });
      }
    }
  }
}
