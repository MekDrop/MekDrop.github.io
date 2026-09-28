import {
  ArriveBehavior,
  FollowPathBehavior,
  Path,
  Vector3,
  Vehicle,
} from "yuka";

const FIXED_STEP = 1 / 120;
const WAYPOINT_DISTANCE = 0.06;
const ARRIVAL_DECELERATION = 0.01;
const ARRIVAL_TOLERANCE = 0.005;
const STEERING_MASS = FIXED_STEP;
const TIME_EPSILON = 0.0000001;

/**
 * Produces deterministic Yuka poses for a royal's authored walk-out route.
 */
export class RoyalGameOverRouteFollower {
  #arrive;
  #duration;
  #followPath;
  #lastWaypoint;
  #orientationTarget = new Vector3();
  #path;
  #simulatedTime = 0;
  #vehicle;

  constructor({ waypoints, duration }) {
    this.#duration = Math.max(0, duration);
    this.#path = new Path();
    let routeLength = 0;
    let previousWaypoint = null;
    for (const waypoint of waypoints) {
      const routeWaypoint = new Vector3(waypoint.x, waypoint.y, waypoint.z);
      this.#path.add(routeWaypoint);
      if (previousWaypoint) {
        routeLength += previousWaypoint.distanceTo(routeWaypoint);
      }
      previousWaypoint = routeWaypoint;
    }
    const lastWaypoint = waypoints.at(-1);
    this.#lastWaypoint = new Vector3(
      lastWaypoint.x,
      lastWaypoint.y,
      lastWaypoint.z,
    );

    this.#vehicle = new Vehicle();
    this.#vehicle.mass = STEERING_MASS;
    this.#vehicle.maxForce = Number.MAX_SAFE_INTEGER;
    this.#vehicle.maxSpeed =
      this.#duration > 0 ? routeLength / this.#duration : 0;
    this.#vehicle.updateOrientation = false;
    this.#vehicle.position.copy(this.#path.current());

    this.#followPath = new FollowPathBehavior(
      this.#path,
      WAYPOINT_DISTANCE,
    );
    this.#arrive = new ArriveBehavior(
      this.#lastWaypoint,
      ARRIVAL_DECELERATION,
      ARRIVAL_TOLERANCE,
    );
    this.#arrive.active = false;
    this.#vehicle.steering.add(this.#followPath);
    this.#vehicle.steering.add(this.#arrive);
    this.#primeOrientation();
  }

  get pose() {
    const { position, rotation } = this.#vehicle;
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
        w: rotation.w,
      },
    };
  }

  advance(progress) {
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    const targetTime = normalizedProgress * this.#duration;
    while (this.#simulatedTime + FIXED_STEP <= targetTime + TIME_EPSILON) {
      this.#step(FIXED_STEP);
      this.#simulatedTime += FIXED_STEP;
    }

    if (normalizedProgress === 1) {
      const remaining = this.#duration - this.#simulatedTime;
      if (remaining > TIME_EPSILON) {
        this.#step(remaining);
      }
      this.#simulatedTime = this.#duration;
      this.#vehicle.position.copy(this.#lastWaypoint);
      this.#vehicle.velocity.set(0, 0, 0);
    }
    return this.pose;
  }

  #primeOrientation() {
    const desiredVelocity = new Vector3();
    this.#followPath.calculate(this.#vehicle, desiredVelocity);
    if (desiredVelocity.squaredLength() <= TIME_EPSILON) {
      return;
    }
    this.#orientFrom(desiredVelocity);
  }

  #step(deltaTime) {
    if (this.#path.finished()) {
      this.#followPath.active = false;
      this.#arrive.active = true;
    }
    this.#vehicle.update(deltaTime);
    this.#orientFrom(this.#vehicle.velocity);
  }

  #orientFrom(direction) {
    if (direction.x * direction.x + direction.z * direction.z <= TIME_EPSILON) {
      return;
    }
    this.#orientationTarget.set(
      this.#vehicle.position.x + direction.x,
      this.#vehicle.position.y,
      this.#vehicle.position.z + direction.z,
    );
    this.#vehicle.lookAt(this.#orientationTarget);
  }
}
