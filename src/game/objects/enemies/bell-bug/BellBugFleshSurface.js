import { impactTriangles } from "../latch-slug/LatchImpactShape.js";

/**
 * Pick the actual posed character surface at claw height. This is a render
 * contact sample only; Ammo still owns approach, occlusion and body collision.
 * @param {import("./BellBug.js").BellBug} bug
 * @param {import("../shared/Enemy.js").EnemyActor} actor
 * @param {number} side
 * @returns {import("playcanvas").Vec3|null}
 */
export function fleshSurface(bug, actor, side) {
  const { pc } = bug;
  const position = bug.targetPosition(actor);
  const foot = bug.animationPlayback?.scoopPose.foot(side);
  const origin = foot?.source ? foot.bone.getPosition().clone() : bug.position.clone()
    .add(bug.entity.right.clone().mulScalar(side ? -0.15 : 0.15)).add(new pc.Vec3(0, 0.3, 0));
  const meshes = [];
  let hasMeshes = false;
  for (const render of actor.entity?.findComponents?.("render") ?? []) {
    if (render.entity.enabled) {
      hasMeshes ||= render.meshInstances.length > 0;
      for (const instance of render.meshInstances) {
        let excluded = false;
        for (let node = instance.node; node && node !== actor.entity; node = node.parent) {
          if (/sword|blade|weapon|tool|axe|hammer|shovel|burner|cape|cloak|crown|throne|effect|particle/i.test(node.name)) {
            excluded = true;
            break;
          }
        }
        if (excluded) {
          continue;
        }
        const bounds = instance.aabb;
        if (!bounds || bounds.center.y - bounds.halfExtents.y <= origin.y + 0.25
          && bounds.center.y + bounds.halfExtents.y >= origin.y - 0.15) {
          meshes.push(instance);
        }
      }
    }
  }
  if (!meshes.length) {
    return hasMeshes || bug.modelLibrary ? null : position.clone().add(new pc.Vec3(0, 0.3, 0));
  }
  const triangles = impactTriangles(pc, meshes, new pc.Mat4());
  let nearest = Infinity, contact = null;
  for (const vertices of triangles) {
    if (Math.min(vertices[1], vertices[4], vertices[7]) > origin.y + 0.25
        || Math.max(vertices[1], vertices[4], vertices[7]) < origin.y - 0.15) {
      continue;
    }
    const point = closestPoint(pc, origin, vertices);
    if (point.distance(origin) < nearest) {
      const hits = bug.app.systems?.rigidbody?.raycastAll(origin, point) ?? [];
      const blocked = hits.some(/**
       * @param {import("playcanvas").RaycastResult} hit
       */
        hit => hit.entity !== bug.entity && !hit.entity.isDescendantOf(bug.entity)
          && hit.entity !== actor.entity && !hit.entity.isDescendantOf(actor.entity));
      if (blocked) {
        continue;
      }
      nearest = point.distance(origin);
      contact = point.clone();
    }
  }

  return contact;
}

/**
 * Exact closest point on a posed render triangle. Ammo capsules cannot expose
 * the animated skin surface; this query changes no physics state or geometry.
 * @param {typeof import("playcanvas")} pc
 * @param {import("playcanvas").Vec3} point
 * @param {number[]} vertices
 * @returns {import("playcanvas").Vec3}
 */
function closestPoint(pc, point, vertices) {
  const a = new pc.Vec3(...vertices.slice(0, 3));
  const b = new pc.Vec3(...vertices.slice(3, 6));
  const c = new pc.Vec3(...vertices.slice(6, 9));
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = point.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) {
    return a;
  }
  const bp = point.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) {
    return b;
  }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    return a.add(ab.mulScalar(d1 / (d1 - d3)));
  }
  const cp = point.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) {
    return c;
  }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    return a.add(ac.mulScalar(d2 / (d2 - d6)));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return b.add(c.sub(b).mulScalar((d4 - d3) / ((d4 - d3) + (d5 - d6))));
  }
  const inverse = 1 / (va + vb + vc);

  return a.add(ab.mulScalar(vb * inverse)).add(ac.mulScalar(vc * inverse));
}
