/**
 * Builds one static compound body directly from generated voxel dimensions.
 *
 * @param {{pc: typeof import("playcanvas"), parent: import("playcanvas").Entity, name: string, voxels: Array<{x: number, y: number, z: number, width: number, height: number, depth: number}>, friction?: number}} options
 * @param {typeof import("playcanvas")} options.pc
 * @param {import("playcanvas").Entity} options.parent
 * @param {string} options.name
 * @param {Array<{x: number, y: number, z: number, width: number, height: number, depth: number}>} options.voxels
 * @param {number} [options.friction=0]
 */
export function addGeneratedVoxelPhysics({
  pc,
  parent,
  name,
  voxels,
  friction = 0,
}) {
  if (!pc || !parent || !voxels.length) {
    return null;
  }
  const collider = new pc.Entity(`${name} physics collider`);
  collider.addComponent("collision", { type: "compound" });
  parent.addChild(collider);
  const world = collider.collision.system.physicsWorld;
  const scale = collider.getWorldTransform().getScale();
  const shapes = [];
  // The engine owns the compound body. Its immutable box shapes do not need
  // thousands of child entities that follow the island through the scene graph.
  collider.once("destroy", () => {
    for (const shape of shapes) {
      world.destroyShape(shape);
    }
  });
  for (const voxel of voxels) {
    const shape = world.createShape({
      type: "box",
      halfExtents: new pc.Vec3(
        voxel.width / 2 * scale.x,
        voxel.height / 2 * scale.y,
        voxel.depth / 2 * scale.z,
      ),
    });
    shapes.push(shape);
    world.addCompoundChild(
      collider.collision.shape,
      shape,
      new pc.Vec3(voxel.x * scale.x, voxel.y * scale.y, voxel.z * scale.z),
      pc.Quat.IDENTITY,
    );
  }
  collider.addComponent("rigidbody", {
    type: "static",
    friction,
    restitution: 0,
  });

  return collider;
}
