const MINIMUM_HALF_EXTENT = 0.01;
const HERO_BODY_PART_NAMES = new Set([
  "Round face",
  "Nose",
  "Ear",
  "Ear.001",
  "Cyan hair mass",
  "Rounded chest armor",
  "Short red tunic",
  "Golden waist trim",
  "Scarf upper fold",
  "Red lower tunic flap",
  "Emerald pauldron",
  "Short blue sleeve",
  "Blue forearm cuff",
  "Left white glove",
  "Right Emerald pauldron",
  "Right Short blue sleeve",
  "Right Blue forearm cuff",
  "Right white glove",
  "Thick trouser leg",
  "Thick trouser leg.001",
  "Boot shaft",
  "Boot shaft.001",
  "Boot foot",
  "Boot foot.001",
]);

/**
 * Adds fitted compound-collider children to every solid hero body part.
 */
export function addHeroPartColliders({ pc, modelRoot }) {
  const pending = [modelRoot];
  const colliders = [];
  while (pending.length > 0) {
    const part = pending.pop();
    pending.push(...part.children);
    if (!HERO_BODY_PART_NAMES.has(part.name)) {
      continue;
    }
    const meshInstances = part.render?.meshInstances ?? [];
    for (const [index, meshInstance] of meshInstances.entries()) {
      const bounds = meshInstance.mesh?.aabb;
      if (!bounds) {
        continue;
      }
      const collider = new pc.Entity(
        `Hero ${part.name} collider ${index + 1}`,
      );
      collider.setLocalPosition(bounds.center);
      collider.addComponent("collision", {
        type: "box",
        halfExtents: new pc.Vec3(
          Math.max(MINIMUM_HALF_EXTENT, Math.abs(bounds.halfExtents.x)),
          Math.max(MINIMUM_HALF_EXTENT, Math.abs(bounds.halfExtents.y)),
          Math.max(MINIMUM_HALF_EXTENT, Math.abs(bounds.halfExtents.z)),
        ),
      });
      part.addChild(collider);
      colliders.push(collider);
    }
  }
  return colliders;
}
