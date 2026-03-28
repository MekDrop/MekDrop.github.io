import * as THREE from "three";
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

const MAX_VISIBLE_PLATFORMS = 28;
const MAX_VISIBLE_COLLECTIBLES = 12;

export function create(containerWidth, containerHeight) {
  const platformBuffer = Array.from(
    { length: MAX_VISIBLE_PLATFORMS },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const collectibleBuffer = Array.from(
    { length: MAX_VISIBLE_COLLECTIBLES },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uResolution: {
        value: new THREE.Vector2(containerWidth, containerHeight),
      },
      uViewSize: {
        value: new THREE.Vector2(0, 0),
      },
      uCameraPos: {
        value: new THREE.Vector2(0, 0),
      },
      uHeroPos: {
        value: new THREE.Vector2(0, 0),
      },
      uHeroVelocity: {
        value: new THREE.Vector2(0, 0),
      },
      uHeroFacing: { value: 1.0 },
      uHeroGrounded: { value: 0.0 },
      uHeroCrouch: { value: 0.0 },
      uPlatforms: { value: platformBuffer },
      uPlatformCount: { value: 0.0 },
      uCollectibles: { value: collectibleBuffer },
      uCollectibleCount: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: false,
  });
}
