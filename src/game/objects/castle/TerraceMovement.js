const DOORWAY_START_Z = -1.4;
const DOORWAY_VISIBLE_Z = 0.2;
const DOORWAY_CLEAR_Z = 1.1;

const ease = (value) => value * value * (3 - 2 * value);

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
  const yaw = Math.atan2(
    lateral > 0 && lateral < 1 ? target[0] : 0,
    target[2] - DOORWAY_CLEAR_Z,
  ) * 180 / Math.PI;
  actor.entity.setLocalEulerAngles(0, yaw + (leaving ? 180 : 0), 0);
  actor.entity.enabled = z > DOORWAY_VISIBLE_Z;
  const moving = travelTime > 0 && travelTime < travelDuration;
  actor.pose(
    moving || action === "carry" ? action : "idle",
    travelTime * (behavior.walkSpeed ?? 1),
  );
};
