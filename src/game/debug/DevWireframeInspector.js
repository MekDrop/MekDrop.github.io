import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";
import { POINTER_TYPE } from "../enum/PointerType.js";

const ALT_KEYS = new Set(["Alt", "AltLeft", "AltRight"]);

export class DevWireframeInspector {
  #pc;
  #app;
  #canvas;
  #camera;
  #picker;
  #solidMaterial;
  #wireframeMaterial;
  #pointer = null;
  #coordinatePrintPointer = null;
  #altPressed = false;
  #selection = null;
  #frameRequest = null;
  #pickInProgress = false;
  #pickPending = false;
  #generation = 0;
  #connected = false;

  constructor({ pc, app, canvas, camera }) {
    this.#pc = pc;
    this.#app = app;
    this.#canvas = canvas;
    this.#camera = camera;
    this.#picker = new pc.Picker(app, 1, 1, true);
    this.#solidMaterial = new pc.StandardMaterial();
    this.#solidMaterial.name = "Development mesh solid";
    this.#solidMaterial.diffuse = new pc.Color(0.015, 0.02, 0.025);
    this.#solidMaterial.emissive = new pc.Color(0.015, 0.02, 0.025);
    this.#solidMaterial.useLighting = false;
    this.#solidMaterial.depthBias = -0.5;
    this.#solidMaterial.update();
    this.#wireframeMaterial = new pc.StandardMaterial();
    this.#wireframeMaterial.name = "Development mesh wireframe";
    this.#wireframeMaterial.diffuse = new pc.Color(1, 0.08, 0.72);
    this.#wireframeMaterial.emissive = new pc.Color(1, 0.08, 0.72);
    this.#wireframeMaterial.emissiveIntensity = 1;
    this.#wireframeMaterial.useLighting = false;
    this.#wireframeMaterial.depthBias = -1;
    this.#wireframeMaterial.update();
  }

  connect() {
    if (this.#connected) {
      return;
    }
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_DOWN,
      this.#handlePointerDown,
    );
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_MOVE,
      this.#handlePointerMove,
    );
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_LEAVE,
      this.#handlePointerLeave,
    );
    window.addEventListener(INPUT_EVENT_TYPE.KEY_DOWN, this.#handleKeyDown);
    window.addEventListener(INPUT_EVENT_TYPE.KEY_UP, this.#handleKeyUp);
    window.addEventListener(INPUT_EVENT_TYPE.BLUR, this.#handleBlur);
    document.addEventListener(
      INPUT_EVENT_TYPE.VISIBILITY_CHANGE,
      this.#handleVisibilityChange,
    );
    this.#connected = true;
  }

  refresh() {
    this.#generation += 1;
    this.#cancelScheduledPick();
    this.#pickPending = false;
    this.#coordinatePrintPointer = null;
    this.#clearSelection();
    this.#schedulePick();
  }

  disconnect() {
    if (!this.#connected) {
      return;
    }
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_DOWN,
      this.#handlePointerDown,
    );
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_MOVE,
      this.#handlePointerMove,
    );
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_LEAVE,
      this.#handlePointerLeave,
    );
    window.removeEventListener(INPUT_EVENT_TYPE.KEY_DOWN, this.#handleKeyDown);
    window.removeEventListener(INPUT_EVENT_TYPE.KEY_UP, this.#handleKeyUp);
    window.removeEventListener(INPUT_EVENT_TYPE.BLUR, this.#handleBlur);
    document.removeEventListener(
      INPUT_EVENT_TYPE.VISIBILITY_CHANGE,
      this.#handleVisibilityChange,
    );
    this.#connected = false;
    this.#pointer = null;
    this.#coordinatePrintPointer = null;
    this.#deactivate();
  }

  destroy() {
    this.disconnect();
    this.#generation += 1;
    this.#cancelScheduledPick();
    this.#pickPending = false;
    this.#clearSelection();
    this.#picker?.destroy();
    this.#picker = null;
    this.#solidMaterial?.destroy();
    this.#solidMaterial = null;
    this.#wireframeMaterial?.destroy();
    this.#wireframeMaterial = null;
    this.#camera = null;
    this.#app = null;
    this.#canvas = null;
  }

  #handlePointerDown = (event) => {
    if (
      event.pointerType !== POINTER_TYPE.MOUSE ||
      event.button !== 0 ||
      !event.altKey
    ) {
      return;
    }
    event.preventDefault();
    this.#altPressed = true;
    this.#pointer = { clientX: event.clientX, clientY: event.clientY };
    this.#coordinatePrintPointer = this.#pointer;
    this.#schedulePick();
  };

  #handlePointerMove = (event) => {
    if (event.pointerType !== POINTER_TYPE.MOUSE) {
      return;
    }
    this.#pointer = { clientX: event.clientX, clientY: event.clientY };
    if (!event.altKey) {
      if (this.#altPressed) {
        this.#deactivate();
      }
      return;
    }
    this.#altPressed = true;
    this.#schedulePick();
  };

  #handlePointerLeave = (event) => {
    if (event.pointerType !== POINTER_TYPE.MOUSE) {
      return;
    }
    this.#pointer = null;
    this.#generation += 1;
    this.#pickPending = false;
    if (!this.#coordinatePrintPointer) {
      this.#cancelScheduledPick();
    }
    this.#clearSelection();
  };

  #handleKeyDown = (event) => {
    if (!ALT_KEYS.has(event.key) && !ALT_KEYS.has(event.code)) {
      return;
    }
    this.#altPressed = true;
    if (this.#pointer) {
      event.preventDefault();
    }
    this.#schedulePick();
  };

  #handleKeyUp = (event) => {
    if (!ALT_KEYS.has(event.key) && !ALT_KEYS.has(event.code)) {
      return;
    }
    if (this.#pointer) {
      event.preventDefault();
    }
    this.#deactivate();
  };

  #handleBlur = () => {
    this.#deactivate();
  };

  #handleVisibilityChange = () => {
    if (document.hidden) {
      this.#deactivate();
    }
  };

  #deactivate() {
    this.#altPressed = false;
    this.#generation += 1;
    this.#pickPending = false;
    this.#cancelScheduledPick();
    this.#clearSelection();
  }

  #schedulePick() {
    if (
      !this.#picker ||
      (!this.#coordinatePrintPointer && (!this.#altPressed || !this.#pointer))
    ) {
      return;
    }
    this.#pickPending = true;
    if (this.#pickInProgress || this.#frameRequest !== null) {
      return;
    }
    this.#frameRequest = window.requestAnimationFrame(() => {
      this.#frameRequest = null;
      void this.#pickHoveredMesh();
    });
  }

  #cancelScheduledPick() {
    if (this.#frameRequest === null) {
      return;
    }
    window.cancelAnimationFrame(this.#frameRequest);
    this.#frameRequest = null;
  }

  async #pickHoveredMesh() {
    const coordinatePrintPointer = this.#coordinatePrintPointer;
    const pointer = coordinatePrintPointer ?? this.#pointer;
    if (
      !this.#picker ||
      (!coordinatePrintPointer && !this.#altPressed) ||
      !pointer
    ) {
      return;
    }
    this.#coordinatePrintPointer = null;
    this.#pickInProgress = true;
    this.#pickPending = false;
    const generation = this.#generation;
    const previousSelection = this.#temporarilyRestoreSelection();
    let pickPromise;

    try {
      const rect = this.#canvas.getBoundingClientRect();
      const width = Math.max(1, this.#canvas.clientWidth);
      const height = Math.max(1, this.#canvas.clientHeight);
      const x = ((pointer.clientX - rect.left) / Math.max(1, rect.width)) * width;
      const y = ((pointer.clientY - rect.top) / Math.max(1, rect.height)) * height;
      this.#picker.resize(width, height);
      this.#picker.prepare(this.#camera, this.#app.scene);
      pickPromise = Promise.all([
        this.#picker.getSelectionAsync(x, y),
        this.#picker.getWorldPointAsync(x, y),
      ]);
    } catch {
      pickPromise = Promise.resolve([[], null]);
    } finally {
      this.#reapplySelection(previousSelection);
    }

    try {
      const [selection, worldPoint] = await pickPromise;
      if (!this.#connected) {
        return;
      }
      const meshInstance = selection[0] ?? null;
      if (coordinatePrintPointer) {
        this.#printObjectCoordinates(meshInstance, worldPoint);
      }
      if (generation !== this.#generation || !this.#altPressed) {
        return;
      }
      this.#setSelection(meshInstance, worldPoint);
    } catch {
      if (generation === this.#generation) {
        this.#setSelection(null);
      }
    } finally {
      this.#pickInProgress = false;
      if (this.#pickPending || this.#coordinatePrintPointer) {
        this.#schedulePick();
      }
    }
  }

  #setSelection(meshInstance, worldPoint) {
    const instanceIndex = this.#findInstanceIndex(meshInstance, worldPoint);
    const instanceSource = meshInstance?.instancingData?.vertexBuffer ?? null;
    if (
      (instanceSource
        ? instanceSource === this.#selection?.instanceSource
        : meshInstance === this.#selection?.meshInstance) &&
      instanceIndex === (this.#selection?.instanceIndex ?? null)
    ) {
      return;
    }
    this.#clearSelection();
    if (!meshInstance?.mesh) {
      return;
    }
    if (instanceIndex !== null) {
      this.#selection = this.#createInstanceSelection(
        meshInstance,
        instanceIndex,
      );
      return;
    }
    this.#selection = {
      meshInstance,
      instanceIndex: null,
      material: meshInstance.material,
      renderStyle: meshInstance.renderStyle,
    };
    this.#applySelection(this.#selection);
  }

  #printObjectCoordinates(meshInstance, worldPoint) {
    if (!meshInstance) {
      console.info("[DevWireframeInspector] No object selected.");
      return;
    }
    const instanceIndex = this.#findInstanceIndex(meshInstance, worldPoint);
    const position = this.#objectPosition(meshInstance, instanceIndex);
    console.info("[DevWireframeInspector] Object coordinates", {
      name: meshInstance.node?.name ?? null,
      instanceIndex,
      position: this.#coordinates(position),
      hitPosition: this.#coordinates(worldPoint),
    });
  }

  #objectPosition(meshInstance, instanceIndex) {
    if (instanceIndex === null) {
      return meshInstance.node?.getPosition?.() ?? null;
    }
    const values = this.#floatValues(
      meshInstance.instancingData.vertexBuffer.storage,
    );
    const instanceMatrix = new this.#pc.Mat4();
    const worldMatrix = new this.#pc.Mat4();
    instanceMatrix.data.set(
      values.subarray(instanceIndex * 16, instanceIndex * 16 + 16),
    );
    worldMatrix.mul2(meshInstance.node.getWorldTransform(), instanceMatrix);
    return worldMatrix.getTranslation();
  }

  #coordinates(point) {
    if (!point) {
      return null;
    }
    return { x: point.x, y: point.y, z: point.z };
  }

  #applySelection(selection) {
    selection.meshInstance.material = this.#wireframeMaterial;
    selection.meshInstance.renderStyle = this.#pc.RENDERSTYLE_WIREFRAME;
  }

  #clearSelection() {
    if (!this.#selection) {
      return;
    }
    const { meshInstance, material, renderStyle, overlay } = this.#selection;
    if (overlay) {
      overlay.destroy();
      this.#selection = null;
      return;
    }
    if (meshInstance.material === this.#wireframeMaterial) {
      meshInstance.material = material;
    }
    if (meshInstance.renderStyle === this.#pc.RENDERSTYLE_WIREFRAME) {
      meshInstance.renderStyle = renderStyle;
    }
    this.#selection = null;
  }

  #temporarilyRestoreSelection() {
    const selection = this.#selection;
    if (selection?.overlay) {
      return null;
    }
    this.#clearSelection();
    return selection;
  }

  #reapplySelection(selection) {
    if (!selection || !this.#wireframeMaterial) {
      return;
    }
    this.#selection = selection;
    this.#applySelection(selection);
  }

  #findInstanceIndex(meshInstance, worldPoint) {
    const instancingData = meshInstance?.instancingData;
    const vertexBuffer = instancingData?.vertexBuffer;
    if (!worldPoint || !vertexBuffer?.storage || !meshInstance?.mesh?.aabb) {
      return null;
    }
    const values = this.#floatValues(vertexBuffer.storage);
    const count = Math.min(
      instancingData.count,
      Math.floor(values.length / 16),
    );
    const instanceMatrix = new this.#pc.Mat4();
    const worldMatrix = new this.#pc.Mat4();
    const bounds = new this.#pc.BoundingBox();
    const closestPoint = new this.#pc.Vec3();
    const nodeWorldTransform = meshInstance.node.getWorldTransform();
    let closestIndex = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < count; index += 1) {
      instanceMatrix.data.set(values.subarray(index * 16, index * 16 + 16));
      worldMatrix.mul2(nodeWorldTransform, instanceMatrix);
      bounds.setFromTransformedAabb(meshInstance.mesh.aabb, worldMatrix);
      bounds.closestPoint(worldPoint, closestPoint);
      const deltaX = closestPoint.x - worldPoint.x;
      const deltaY = closestPoint.y - worldPoint.y;
      const deltaZ = closestPoint.z - worldPoint.z;
      const distance = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    return closestIndex;
  }

  #floatValues(storage) {
    if (storage instanceof Float32Array) {
      return storage;
    }
    if (ArrayBuffer.isView(storage)) {
      return new Float32Array(
        storage.buffer,
        storage.byteOffset,
        storage.byteLength / Float32Array.BYTES_PER_ELEMENT,
      );
    }
    return new Float32Array(storage);
  }

  #createInstanceSelection(meshInstance, instanceIndex) {
    const instanceSource = meshInstance.instancingData.vertexBuffer;
    const values = this.#floatValues(instanceSource.storage);
    const matrix = new this.#pc.Mat4();
    matrix.data.set(
      values.subarray(instanceIndex * 16, instanceIndex * 16 + 16),
    );

    const overlay = new this.#pc.Entity("Development wireframe selection");
    overlay.setLocalPosition(matrix.getTranslation());
    overlay.setLocalRotation(new this.#pc.Quat().setFromMat4(matrix));
    overlay.setLocalScale(matrix.getScale());
    const sourceMeshes = meshInstance.node.render.meshInstances.filter(
      (candidate) =>
        candidate.instancingData?.vertexBuffer === instanceSource,
    );
    const overlayMeshes = [];
    for (const source of sourceMeshes) {
      const solid = new this.#pc.MeshInstance(
        source.mesh,
        this.#solidMaterial,
        overlay,
      );
      const wireframe = new this.#pc.MeshInstance(
        source.mesh,
        this.#wireframeMaterial,
        overlay,
      );
      solid.castShadow = false;
      solid.receiveShadow = false;
      solid.pick = false;
      wireframe.renderStyle = this.#pc.RENDERSTYLE_WIREFRAME;
      wireframe.castShadow = false;
      wireframe.receiveShadow = false;
      wireframe.pick = false;
      overlayMeshes.push(solid, wireframe);
    }
    overlay.addComponent("render", {
      meshInstances: overlayMeshes,
      castShadows: false,
      receiveShadows: false,
    });
    if (meshInstance.node.render?.layers) {
      overlay.render.layers = [...meshInstance.node.render.layers];
    }
    meshInstance.node.addChild(overlay);
    return {
      meshInstance,
      instanceIndex,
      instanceSource,
      overlay,
    };
  }
}
