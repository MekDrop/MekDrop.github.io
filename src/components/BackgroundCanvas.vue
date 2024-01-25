<template>
  <div ref="container" class="background-canvas fit"></div>
</template>

<style lang="scss">
.background-canvas {
  background-color: black;
}
</style>

<script setup>
import * as THREE from 'three'
import { onMounted, ref, watch } from 'vue'
import { dom } from 'quasar'
import { create as createBackgroundMaterial } from 'assets/materials/background/material'
import { useBackgroundImageStore } from 'stores/background-image-store'
import { animateCSS } from 'src/helpers/animate'

let camera, scene, renderer

const container = ref(null)

const backgroundImageStore = useBackgroundImageStore();

const initGL = () => {
  const containerWidth = dom.width(container.value);
  const containerHeight = dom.height(container.value);

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 1000)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(containerWidth, containerHeight)
  renderer.domElement.classList.add('fit');
  container.value.appendChild(renderer.domElement)

  const bgMaterial = createBackgroundMaterial(backgroundImageStore.texture, containerWidth, containerHeight);

  const geometry = new THREE.PlaneGeometry(containerWidth, containerHeight)

  const mesh = new THREE.Mesh(geometry, bgMaterial);
  scene.add(mesh);

  watch(() => backgroundImageStore.lastLoadedUrl, async () => {
    animateCSS(renderer.domElement,'flipInX');
    bgMaterial.uniforms.uTexture.value = backgroundImageStore.texture;
  });

  const updateCameraDistance = () => {
    const boundingBox = new THREE.Box3().setFromObject(mesh)
    const center = new THREE.Vector3()
    boundingBox.getCenter(center)
    const size = boundingBox.getSize(new THREE.Vector3())

    const maxSize = Math.max(size.x, size.y, size.z)
    const fitHeightDistance = maxSize / (2 * Math.tan(Math.PI * camera.fov / 360))
    const fitWidthDistance = size.x / (2 * Math.tan(Math.PI * camera.aspect * camera.fov / 360))
    const distance = Math.max(fitHeightDistance, fitWidthDistance)

    camera.position.z = distance / 8;
  };

  updateCameraDistance();

  const animate = () => {
    requestAnimationFrame(animate);

    bgMaterial.uniforms.uTime.value += 0.005;

    renderer.render(scene, camera)
  }

  animate()
};

onMounted(async() => {
  initGL();
})
</script>
