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
