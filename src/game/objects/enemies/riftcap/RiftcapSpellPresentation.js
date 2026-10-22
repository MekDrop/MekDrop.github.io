/**
 * Temporary area/ward cues owned by the spell effect, using Engine meshes.
 * These are spell volumes, not substitutes for authored character artwork.
 */
export class RiftcapSpellPresentation {
  /**
   * @param {import("./Riftcap.js").Riftcap} owner
   * @param {string} name
   * @param {import("playcanvas").Vec3} center
   * @param {number} radius
   */
  constructor(owner, name, center, radius) {
    const pc = owner.pc;
    this.radius = radius;
    this.center = center.clone();
    this.entity = new pc.Entity(`Riftcap ${name} volume`);
    this.entity.setPosition(center.x, center.y + radius * 0.5, center.z);
    this.entity.setLocalScale(radius * 2, radius, radius * 2);
    this.material = new pc.StandardMaterial();
    const green = name === "mending";
    this.material.diffuse.set(green ? 0.1 : 0.35, green ? 0.9 : 0.2, green ? 0.1 : 1);
    this.material.emissive.copy(this.material.diffuse);
    this.material.opacity = 0.2;
    this.material.blendType = pc.BLEND_ADDITIVE;
    this.material.depthWrite = false;
    this.material.cull = pc.CULLFACE_NONE;
    this.material.update();
    this.entity.addComponent("render", { type: "sphere" });
    for (const instance of this.entity.render.meshInstances) {
      instance.material = this.material;
      instance.castShadow = false;
      instance.receiveShadow = false;
      instance.renderStyle = pc.RENDERSTYLE_WIREFRAME;
    }
    owner.app.root.addChild(this.entity);
  }

  /**
   * @param {import("playcanvas").Vec3} center
   * @param {number} progress
   */
  update(center = this.center, progress = 0) {
    const radius = this.radius * (0.85 + Math.min(1, progress) * 0.15);
    this.entity.setPosition(center.x, center.y + radius * 0.5, center.z);
    this.entity.setLocalScale(radius * 2, radius, radius * 2);
    this.material.opacity = 0.2 * (1 - Math.min(1, progress) * 0.65);
  }

  destroy() {
    this.entity.destroy();
    this.material.destroy();
  }
}
