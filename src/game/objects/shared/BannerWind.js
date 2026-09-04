export const AMBIENT_WIND_BASE_SPEED = 0.15;
const AMBIENT_WIND_BASE_ANGLE = 0.55;

export const AMBIENT_WIND_DIRECTION = Object.freeze({
  x: Math.cos(AMBIENT_WIND_BASE_ANGLE),
  y: 0,
  z: Math.sin(AMBIENT_WIND_BASE_ANGLE),
});

export function getAmbientWindSpeed(elapsedSeconds) {
  const broadGust = Math.sin(elapsedSeconds * 0.31) * 0.014;
  const slowGust = Math.sin(elapsedSeconds * 0.09 + 1.8) * 0.007;
  return Math.max(0.11, AMBIENT_WIND_BASE_SPEED + broadGust + slowGust);
}

export function getAmbientWind(elapsedSeconds) {
  const angle =
    AMBIENT_WIND_BASE_ANGLE +
    Math.sin(elapsedSeconds * 0.035) * 0.18 +
    Math.sin(elapsedSeconds * 0.013 + 1.7) * 0.1;
  return {
    direction: {
      x: Math.cos(angle),
      y: 0,
      z: Math.sin(angle),
    },
    speed: getAmbientWindSpeed(elapsedSeconds),
  };
}

export class BannerWind {
  #elapsed = 0;
  #phase;
  #speed;
  #strength;
  #pointer = {
    active: false,
    lastPoint: null,
    strength: 0,
    directionY: 0,
    directionZ: 0,
  };

  constructor(seed = Math.random()) {
    this.#phase = seed * Math.PI * 2;
    this.#speed = 0.72 + ((seed * 7.13) % 1) * 0.42;
    this.#strength = 0.82 + ((seed * 11.71) % 1) * 0.36;
  }

  advance(deltaTime) {
    const elapsed = Math.max(0, deltaTime);
    this.#elapsed += elapsed;
    const damping = Math.exp(-elapsed * (this.#pointer.active ? 1.45 : 3.8));
    this.#pointer.strength *= damping;
  }

  begin(point) {
    if (!point) return;
    this.#pointer.active = true;
    this.#pointer.lastPoint = point.clone();
    this.#pointer.strength = Math.max(this.#pointer.strength, 0.042);
    this.#pointer.directionY *= 0.35;
    this.#pointer.directionZ =
      this.#pointer.directionZ * 0.35 +
      Math.sin(this.#elapsed * 1.7 + this.#phase) * 0.22;
  }

  applyPointer(point, deltaTime) {
    if (!point || !this.#pointer.active || !this.#pointer.lastPoint) return;
    const elapsed = Math.max(1 / 120, Math.min(0.08, deltaTime));
    const movementY = point.y - this.#pointer.lastPoint.y;
    const movementZ = point.z - this.#pointer.lastPoint.z;
    const movementDistance = Math.hypot(movementY, movementZ);
    const velocityY = movementY / elapsed;
    const velocityZ = movementZ / elapsed;
    const speed = Math.hypot(velocityY, velocityZ);

    if (speed > 0.001) {
      const blend = 0.68;
      const blendedY =
        this.#pointer.directionY * (1 - blend) + (velocityY / speed) * blend;
      const blendedZ =
        this.#pointer.directionZ * (1 - blend) + (velocityZ / speed) * blend;
      const length = Math.hypot(blendedY, blendedZ);
      this.#pointer.directionY = length > 0.000001 ? blendedY / length : 0;
      this.#pointer.directionZ = length > 0.000001 ? blendedZ / length : 0;
      const impulse = movementDistance * 0.55 + speed * 0.02;
      this.#pointer.strength = Math.min(
        0.3,
        this.#pointer.strength * 0.82 + impulse,
      );
    }
    this.#pointer.lastPoint.copy(point);
  }

  end() {
    this.#pointer.active = false;
    this.#pointer.lastPoint = null;
  }

  deform({
    basePositions,
    positions,
    vertexUv,
    normalAxis = 0,
    verticalAxis = 1,
    horizontalAxis = 2,
  }) {
    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      const offset = this.sample(
        vertexUv[vertex * 2],
        vertexUv[vertex * 2 + 1],
      );
      const positionIndex = vertex * 3;
      positions[positionIndex + normalAxis] =
        basePositions[positionIndex + normalAxis] + offset.normal;
      positions[positionIndex + verticalAxis] =
        basePositions[positionIndex + verticalAxis] + offset.vertical;
      positions[positionIndex + horizontalAxis] =
        basePositions[positionIndex + horizontalAxis] + offset.horizontal;
    }
  }

  sample(u, v) {
    const time = this.#elapsed * this.#speed;
    const slowGust =
      Math.sin(time * 0.43 + this.#phase) * 0.55 +
      Math.sin(time * 0.17 + this.#phase * 1.73) * 0.28;
    const directionLength = Math.hypot(
      this.#pointer.directionY,
      this.#pointer.directionZ,
    );
    const directionY =
      directionLength > 0.001 ? this.#pointer.directionY / directionLength : 0;
    const directionZ =
      directionLength > 0.001 ? this.#pointer.directionZ / directionLength : 0;
    const freedom = v * v;
    const flutter = Math.sin(time * 3.25 + u * 7.4 + v * 2.1 + this.#phase);
    const ripple = Math.sin(time * 1.36 - u * 4.8 + this.#phase * 0.62);
    const windStrength = freedom * this.#strength;
    const pointerWave = Math.sin(
      this.#elapsed * 9.5 -
        u * directionZ * 6.2 -
        v * directionY * 5.2 +
        this.#phase,
    );
    const pointerStrength = freedom * this.#pointer.strength;

    return {
      normal:
        windStrength * (slowGust * 0.035 + flutter * 0.014 + ripple * 0.008) +
        pointerStrength * (0.62 + pointerWave * 0.38),
      vertical:
        windStrength * (flutter * 0.008 + ripple * 0.005) +
        pointerStrength * directionY * 0.58,
      horizontal:
        windStrength * (ripple * 0.018 + flutter * 0.009 * Math.abs(u)) +
        pointerStrength * directionZ * 0.58,
      rotationY: ripple * 2.4 + directionZ * this.#pointer.strength * 28,
      rotationZ: flutter * 1.1 + directionY * this.#pointer.strength * 18,
    };
  }
}
