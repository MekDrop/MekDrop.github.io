import * as THREE from "three";
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

export function create(imageTexture, containerWidth, containerHeight) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: imageTexture },
      uTime: { value: 0.0 },
      uResolution: {
        value: new THREE.Vector2(containerWidth, containerHeight),
      },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });
}
