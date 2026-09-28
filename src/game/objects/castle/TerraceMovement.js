import { FollowPathBehavior, Path, Vector3, Vehicle } from "yuka";

const DOORWAY_START_Z = -1.4;
const DOORWAY_VISIBLE_Z = 0.2;
const DOORWAY_CLEAR_Z = 1.1;
const WAYPOINT_DISTANCE = 0.001;
const RAD_TO_DEG = 180 / Math.PI;

const ease = (value) => value * value * (3 - 2 * value);

/**
 * Lets Yuka derive facing from an authored path without owning scene placement.
 */
export const terracePathYaw = (points, reverse = false) => {
  const path = new Path();
  const route = reverse ? points.toReversed() : points;
  for (const point of route) {
    path.add(new Vector3(point.x, point.y ?? 0, point.z));
  }
  const vehicle = new Vehicle();
  vehicle.position.copy(path.current());
  const desiredMotion = new Vector3();
  new FollowPathBehavior(path, WAYPOINT_DISTANCE).calculate(
    vehicle,
    desiredMotion,
  );
  const yaw = Math.atan2(desiredMotion.x, desiredMotion.z) * RAD_TO_DEG;
  return Object.is(yaw, -0) ? 0 : yaw;
};

export const syncTerraceWalk = ({
  actor,
  target,
  leaving,
  behavior,
  action = "walk",
}) => {
  const travelDuration = behavior.duration - 0.7;
  const travelTime = Math.max(0, Math.min(
    travelDuration,
    behavior.elapsed - 0.4,
  ));
  const progress = leaving
    ? 1 - travelTime / travelDuration
    : travelTime / travelDuration;
  const z = DOORWAY_START_Z + (target[2] - DOORWAY_START_Z) * progress;
  const lateralProgress = Math.max(0, Math.min(
    1,
    (z - DOORWAY_CLEAR_Z) / (target[2] - DOORWAY_CLEAR_Z),
  ));
  const lateral = ease(lateralProgress);
  const stairProgress = ease(Math.max(
    0,
    Math.min(1, (z - DOORWAY_START_Z) / 1.5),
  ));
  actor.entity.setLocalPosition(
    target[0] * lateral,
    -1.05 * (1 - stairProgress),
    z,
  );
  const path = lateral > 0 && lateral < 1
    ? [
      { x: 0, z: DOORWAY_CLEAR_Z },
      { x: target[0], z: target[2] },
    ]
    : [
      { x: 0, z: DOORWAY_START_Z },
      { x: 0, z: DOORWAY_CLEAR_Z },
    ];
  const yaw = terracePathYaw(path);
  actor.entity.setLocalEulerAngles(0, yaw + (leaving ? 180 : 0), 0);
  actor.entity.enabled = z > DOORWAY_VISIBLE_Z;
  const moving = travelTime > 0 && travelTime < travelDuration;
  actor.pose(
    moving || action === "carry" ? action : "idle",
    travelTime * (behavior.walkSpeed ?? 1),
  );
};
