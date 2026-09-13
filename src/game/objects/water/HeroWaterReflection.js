// Captures the actual animated head from a mirrored camera. The river shader
// projects this texture only onto nearby water, so banks and bridges cannot reflect it.
export class HeroWaterReflection {
  #pc;
  #app;
  #layer;
  #camera;
  #target;
  #texture;
  #head = null;
  #instances = [];
  #materials = [];
  #matrix;
  #view;
  #data = new Float32Array(4);

  constructor(pc, app) {
    this.#pc = pc;
    this.#app = app;
    this.#matrix = new pc.Mat4();
    this.#view = new pc.Mat4();
    this.#layer = new pc.Layer({ name: 'Hero water reflection' });
    app.scene.layers.push(this.#layer);
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: 'Reflected hero face', width: 256, height: 256,
      format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
      minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    this.#target = new pc.RenderTarget({ colorBuffer: this.#texture, depth: true });
    this.#camera = new pc.Entity('Hero reflection camera');
    this.#camera.addComponent('camera', {
      clearColor: new pc.Color(0, 0, 0, 0),
      clearColorBuffer: true, clearDepthBuffer: true,
      projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 0.68,
      nearClip: 0.01, farClip: 12, priority: -90,
      layers: [this.#layer.id],
    });
    this.#camera.camera.renderTarget = this.#target;
    app.root.addChild(this.#camera);
    this.#camera.enabled = false;
  }

  update(presentation, camera) {
    this.#data[3] = 0;
    this.#camera.enabled = Boolean(presentation && camera);
    if (!presentation || !camera) {
      return;
    }
    if (this.#head !== presentation.head) {
      this.#bindHead(presentation.head);
    }
    const headPosition = presentation.head.getPosition();
    const direction = camera.entity.getPosition().clone().sub(headPosition).normalize();
    direction.y = -Math.abs(direction.y);
    const position = headPosition.clone().add(direction.mulScalar(4));
    const up = camera.entity.up.clone();
    up.y = -up.y;
    this.#camera.setPosition(position);
    this.#camera.lookAt(headPosition, up);
    this.#view.copy(this.#camera.getWorldTransform()).invert();
    this.#matrix.mul2(this.#camera.camera.projectionMatrix, this.#view);
    this.#data.set([presentation.x, presentation.surfaceY, presentation.z, 1]);
  }

  apply(material) {
    material.setParameter('uHeroReflection', this.#texture);
    material.setParameter('uHeroReflectionMatrix', this.#matrix.data);
    material.setParameter('uHeroWater', this.#data);
  }

  destroy() {
    this.#camera.destroy();
    this.#clearHead();
    this.#app.scene.layers.remove(this.#layer);
    this.#target.destroy();
    this.#texture.destroy();
  }

  #clearHead() {
    this.#layer.removeMeshInstances(this.#instances);
    for (const instance of this.#instances) {
      instance.skinInstance = null;
      instance.destroy();
    }
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#instances = [];
    this.#materials = [];
    this.#head = null;
  }

  #bindHead(head) {
    this.#clearHead();
    this.#head = head;
    for (const render of head.findComponents('render')) {
      for (const source of render.meshInstances) {
        const material = source.material.clone();
        material.useLighting = false;
        material.useSkybox = false;
        material.useFog = false;
        material.emissive.copy(source.material.diffuse);
        material.ambient.set(0, 0, 0);
        material.diffuse.set(0, 0, 0);
        if (source.material.diffuseMap) {
          material.emissiveMap = source.material.diffuseMap;
        }
        material.update();
        const instance = new this.#pc.MeshInstance(source.mesh, material, source.node);
        instance.skinInstance = source.skinInstance;
        if (source.morphInstance) {
          instance.morphInstance = new this.#pc.MorphInstance(source.morphInstance.morph);
        }
        instance.castShadow = false;
        instance.cull = false;
        this.#instances.push(instance);
        this.#materials.push(material);
      }
    }
    this.#layer.addMeshInstances(this.#instances);
  }
}
