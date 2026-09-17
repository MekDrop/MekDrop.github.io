export const AMBIENT_WIND_BASE_SPEED = 0.15;
const AMBIENT_WIND_BASE_ANGLE = 0.55;
const AMBIENT_WIND_GUST_RATE = 0.13;
const AMBIENT_WIND_GUST_SPEED = 0.13;
let ambientWindSpeedOverride = null;
let currentAmbientWindSpeed = AMBIENT_WIND_BASE_SPEED;

export const AMBIENT_WIND_DIRECTION = Object.freeze({
  x: Math.cos(AMBIENT_WIND_BASE_ANGLE),
  y: 0,
  z: Math.sin(AMBIENT_WIND_BASE_ANGLE),
});

export function getAmbientWindSpeed(elapsedSeconds) {
  if (ambientWindSpeedOverride !== null) {
    currentAmbientWindSpeed = ambientWindSpeedOverride;
    return currentAmbientWindSpeed;
  }
  const broadVariation = Math.sin(elapsedSeconds * 0.31) * 0.014;
  const slowVariation = Math.sin(elapsedSeconds * 0.09 + 1.8) * 0.007;
  const gustCycle =
    Math.sin(elapsedSeconds * AMBIENT_WIND_GUST_RATE - Math.PI / 2) *
      0.5 +
    0.5;
  // A narrow, smooth peak makes strong gusts occasional instead of giving the
  // whole scene a permanently windy look.
  const gust = Math.pow(gustCycle, 8) * AMBIENT_WIND_GUST_SPEED;
  currentAmbientWindSpeed = Math.max(
    0.11,
    AMBIENT_WIND_BASE_SPEED + broadVariation + slowVariation + gust,
  );
  return currentAmbientWindSpeed;
}

export function getCurrentAmbientWindSpeed() {
  return currentAmbientWindSpeed;
}

export function setAmbientWindSpeed(speed) {
  ambientWindSpeedOverride = speed;
  currentAmbientWindSpeed = speed;
}

export function resetAmbientWindSpeed() {
  ambientWindSpeedOverride = null;
  currentAmbientWindSpeed = AMBIENT_WIND_BASE_SPEED;
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
