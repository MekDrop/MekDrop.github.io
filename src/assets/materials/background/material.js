import * as THREE from "three";
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

const MAX_VISIBLE_STRUCTURES = 1;
const MAX_VISIBLE_ANCHORS = 1;
const MAX_VISIBLE_MINIONS = 1;
const MAX_VISIBLE_PROJECTILES = 1;
const MAX_VISIBLE_IMPACTS = 1;

export function create(containerWidth, containerHeight) {
  const structureBuffer = Array.from(
    { length: MAX_VISIBLE_STRUCTURES },
    () => new THREE.Vector4(-9999, -9999, -9999, 0),
  );
  const structureMetaBuffer = Array.from(
    { length: MAX_VISIBLE_STRUCTURES },
    () => new THREE.Vector4(0, 0, 0, 0),
  );

  const anchorBuffer = Array.from(
    { length: MAX_VISIBLE_ANCHORS },
    () => new THREE.Vector4(-9999, -9999, -9999, 0),
  );
  const anchorStateBuffer = new Float32Array(MAX_VISIBLE_ANCHORS);

  const minionBuffer = Array.from(
    { length: MAX_VISIBLE_MINIONS },
    () => new THREE.Vector4(-9999, -9999, -9999, 0),
  );
  const minionMetaBuffer = Array.from(
    { length: MAX_VISIBLE_MINIONS },
    () => new THREE.Vector4(0, 0, 0, 0),
  );

  const projectileBuffer = Array.from(
    { length: MAX_VISIBLE_PROJECTILES },
    () => new THREE.Vector4(-9999, -9999, -9999, 0),
  );
  const projectileMetaBuffer = Array.from(
    { length: MAX_VISIBLE_PROJECTILES },
    () => new THREE.Vector4(0, 0, 0, 0),
  );

  const impactBuffer = Array.from(
    { length: MAX_VISIBLE_IMPACTS },
    () => new THREE.Vector4(-9999, -9999, -9999, 0),
  );
  const impactStrengthBuffer = new Float32Array(MAX_VISIBLE_IMPACTS);

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uResolution: { value: new THREE.Vector2(containerWidth, containerHeight) },
      uGameViewport: { value: new THREE.Vector4(0, 0, containerWidth, containerHeight) },
      uPixelScale: { value: 3.0 },
      uCameraPos: { value: new THREE.Vector3(0, 2, 0) },
      uCameraYaw: { value: 0.0 },
      uCameraPitch: { value: -0.1 },
      uFov: { value: 1.15 },
      uArenaHalfWidth: { value: 12.0 },
      uArenaFloorY: { value: 0.0 },
      uArenaCeilingY: { value: 9.0 },
      uPlayerPos: { value: new THREE.Vector3(0, 1.5, 0) },
      uPlayerVelocity: { value: new THREE.Vector3(0, 0, 0) },
      uPlayerWeapon: { value: 1.0 },
      uPlayerHealthNorm: { value: 1.0 },
      uPlayerGrappleActive: { value: 0.0 },
      uPlayerGrapplePoint: { value: new THREE.Vector3(0, 0, 0) },
      uPlayerSwordSwing: { value: 0.0 },
      uBossPos: { value: new THREE.Vector3(0, 0, 80) },
      uBossHealthNorm: { value: 1.0 },
      uBossLookUp: { value: 0.0 },
      uBossSummonPulse: { value: 0.0 },
      uBossAlive: { value: 1.0 },
      uScanOriginZ: { value: 0.0 },
      uScanDistance: { value: 0.0 },
      uScanWidth: { value: 10.0 },
      uScanIntensity: { value: 1.0 },
      uStructures: { value: structureBuffer },
      uStructureMeta: { value: structureMetaBuffer },
      uStructureCount: { value: 0.0 },
      uAnchors: { value: anchorBuffer },
      uAnchorState: { value: anchorStateBuffer },
      uAnchorCount: { value: 0.0 },
      uMinions: { value: minionBuffer },
      uMinionMeta: { value: minionMetaBuffer },
      uMinionCount: { value: 0.0 },
      uProjectiles: { value: projectileBuffer },
      uProjectileMeta: { value: projectileMetaBuffer },
      uProjectileCount: { value: 0.0 },
      uImpacts: { value: impactBuffer },
      uImpactStrength: { value: impactStrengthBuffer },
      uImpactCount: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: false,
  });
}
