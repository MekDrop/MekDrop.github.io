/** Builds one static compound body directly from generated voxel dimensions. */
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
  for (const voxel of voxels) {
    const part = new pc.Entity(`${name} physics voxel`);
    part.setLocalPosition(voxel.x, voxel.y, voxel.z);
    part.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(
        voxel.width / 2,
        voxel.height / 2,
        voxel.depth / 2,
      ),
    });
    collider.addChild(part);
  }
  parent.addChild(collider);
  collider.addComponent("rigidbody", {
    type: "static",
    friction,
    restitution: 0,
  });
  return collider;
}
