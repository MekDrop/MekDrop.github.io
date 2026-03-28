import * as THREE from "three";
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

const MAX_VISIBLE_PLATFORMS = 48;
const MAX_VISIBLE_COLLECTIBLES = 12;
const MAX_VISIBLE_LADDERS = 40;
const MAX_VISIBLE_SPIKES = 20;
const MAX_VISIBLE_PORTALS = 16;

export function create(containerWidth, containerHeight) {
  const platformBuffer = Array.from(
    { length: MAX_VISIBLE_PLATFORMS },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const platformMotionBuffer = new Float32Array(MAX_VISIBLE_PLATFORMS);
  const platformTypeBuffer = new Float32Array(MAX_VISIBLE_PLATFORMS);
  const platformShakeBuffer = new Float32Array(MAX_VISIBLE_PLATFORMS);
  const platformDurabilityBuffer = new Float32Array(MAX_VISIBLE_PLATFORMS);
  const collectibleBuffer = Array.from(
    { length: MAX_VISIBLE_COLLECTIBLES },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const ladderBuffer = Array.from(
    { length: MAX_VISIBLE_LADDERS },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const spikeBuffer = Array.from(
    { length: MAX_VISIBLE_SPIKES },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const spikeDirBuffer = new Float32Array(MAX_VISIBLE_SPIKES);
  const portalBuffer = Array.from(
    { length: MAX_VISIBLE_PORTALS },
    () => new THREE.Vector4(-9999, -9999, 0, 0),
  );
  const portalSideBuffer = new Float32Array(MAX_VISIBLE_PORTALS);

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uResolution: {
        value: new THREE.Vector2(containerWidth, containerHeight),
      },
      uGameViewport: {
        value: new THREE.Vector4(0, 0, containerWidth, containerHeight),
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
      uHeroVisible: { value: 1.0 },
      uSnakePos: {
        value: new THREE.Vector2(0, 0),
      },
      uSnakeVelocity: {
        value: new THREE.Vector2(0, 0),
      },
      uSnakeFacing: { value: 1.0 },
      uSnakeAlive: { value: 0.0 },
      uSnakeOnLadder: { value: 0.0 },
      uPlatforms: { value: platformBuffer },
      uPlatformMotion: { value: platformMotionBuffer },
      uPlatformType: { value: platformTypeBuffer },
      uPlatformShake: { value: platformShakeBuffer },
      uPlatformDurability: { value: platformDurabilityBuffer },
      uPlatformCount: { value: 0.0 },
      uCollectibles: { value: collectibleBuffer },
      uCollectibleCount: { value: 0.0 },
      uLadders: { value: ladderBuffer },
      uLadderCount: { value: 0.0 },
      uSpikes: { value: spikeBuffer },
      uSpikeDir: { value: spikeDirBuffer },
      uSpikeCount: { value: 0.0 },
      uPortals: { value: portalBuffer },
      uPortalSide: { value: portalSideBuffer },
      uPortalCount: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: false,
  });
}
