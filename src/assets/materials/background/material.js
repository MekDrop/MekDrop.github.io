import * as THREE from "three";
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

const MAX_SOLIDS = 64;
const MAX_ENEMIES = 40;
const MAX_COINS = 40;

export function create(containerWidth, containerHeight) {
  const solidBuffer = Array.from(
    { length: MAX_SOLIDS },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const solidMetaBuffer = Array.from(
    { length: MAX_SOLIDS },
    () => new THREE.Vector4(0, 0, 0, 0),
  );
  const enemyBuffer = Array.from(
    { length: MAX_ENEMIES },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const enemyMetaBuffer = Array.from(
    { length: MAX_ENEMIES },
    () => new THREE.Vector4(0, 0, 0, 0),
  );
  const coinBuffer = Array.from(
    { length: MAX_COINS },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const coinMetaBuffer = Array.from(
    { length: MAX_COINS },
    () => new THREE.Vector4(0, 0, 0, 0),
  );

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uResolution: { value: new THREE.Vector2(containerWidth, containerHeight) },
      uViewport: { value: new THREE.Vector4(0, 0, containerWidth, containerHeight) },
      uPixelScale: { value: 8.0 },
      uWorldSize: { value: new THREE.Vector2(160, 90) },
      uPlayerBox: { value: new THREE.Vector4(12, 12, 7, 13) },
      uPlayerMotion: { value: new THREE.Vector4(0, 0, 1, 0) },
      uPlayerState: { value: new THREE.Vector4(1, 0, 0, 0) },
      uGoal: { value: new THREE.Vector4(156, 12, 44, 0) },
      uSolids: { value: solidBuffer },
      uSolidMeta: { value: solidMetaBuffer },
      uSolidCount: { value: 0.0 },
      uEnemies: { value: enemyBuffer },
      uEnemyMeta: { value: enemyMetaBuffer },
      uEnemyCount: { value: 0.0 },
      uCoins: { value: coinBuffer },
      uCoinMeta: { value: coinMetaBuffer },
      uCoinCount: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: false,
  });
}
