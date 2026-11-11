import glsl from "./LatchStairSurface.vert?raw";
import wgsl from "./LatchStairSurface.wgsl?raw";

/**
 * Render-only skin contact with the three faces of a measured native tread, using a volume-preserving vertical shear.
 */
export class LatchStairSurface {
  /**
   * @type {boolean}
   */
  destroyed = false;
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.owner = owner;
    this.records = [];
    const {pc,app} = owner;
    const materials = new Map();
    for (const render of model.findComponents("render")) {
      for (const instance of render.meshInstances) {
        const original = instance.material;
        let material = materials.get(original);
        if (!material) {
          material = original.clone();
          material.shaderChunksVersion = pc.version.split(".").slice(0,2).join(".");
          for (const language of [pc.SHADERLANGUAGE_GLSL,pc.SHADERLANGUAGE_WGSL]) {
            const chunks = material.getShaderChunks(language), stock = pc.ShaderChunks.get(app.graphicsDevice,language);
            const transform = chunks.get("transformVS") ?? stock.get("transformVS");
            const normal = chunks.get("normalVS") ?? stock.get("normalVS");
            const field = language === pc.SHADERLANGUAGE_GLSL ? glsl : wgsl;
            const vector = language===pc.SHADERLANGUAGE_GLSL?'vec4':'vec4f';
            chunks.set("transformVS", field + '\n' + transform.replace('return posW;', 'stairOriginalPosition = posW.xyz;\n posW = ' + vector + '(latchStairSurface(posW.xyz), posW.w);\n return posW;'));
            const normalWrapper = language === pc.SHADERLANGUAGE_GLSL ? `vec3 getNormal() {
              return latchStairNormal(getStairOriginalNormal());
            }` : `fn getNormal() -> vec3f {
              return latchStairNormal(getStairOriginalNormal());
            }`;
            chunks.set("normalVS",normal.replace('getNormal()', 'getStairOriginalNormal()')+'\n'+normalWrapper);
          }
          material.update();
          materials.set(original,material);
        }
        const bounds = instance.mesh.aabb.clone();
        bounds.halfExtents.add(new pc.Vec3(0.7,0.7,0.7));
        instance.material = material;
        this.records.push({
          instance,
          original,
          material,
          bounds,
        });
      }
    }
    this.materials = materials;
    this.handle = app.on("prerender",this.update,this);
    this.update();
  }
  update() {
    if (this.destroyed) {
      return;
    }
    const crawl = this.owner.stairCrawl;
    const active = crawl?.active && this.owner.alive && !this.owner.airborne;
    let weight = 0;
    if (active) {
      weight = crawl.phase==='reach'?this.owner.pc.math.smoothstep(0,.5,crawl.phaseAge):crawl.phase==='settle'?1-this.owner.pc.math.smoothstep(0,.22,crawl.phaseAge):1;
    }
    for (const {instance,bounds} of this.records) {
      instance.setCustomAabb(active?bounds:null);
      instance.setParameter('uStairWeight',weight);
      instance.setParameter('uStairRootHeight', this.owner.position?.y ?? crawl?.lowerHeight ?? 0);
      instance.setParameter('uStairEdge',active?[crawl.edge.x,crawl.edge.y,crawl.edge.z]:[0,0,0]);
      instance.setParameter('uStairDirection',active?[crawl.direction.x,crawl.direction.y,crawl.direction.z]:[1,0,0]);
      instance.setParameter('uStairLevels',active?[crawl.lowerHeight,crawl.upperHeight]:[0,0]);
    }
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.handle.off();
    for (const {instance,original} of this.records) {
      instance.material=original;
      instance.setCustomAabb(null);
      for (const name of ['uStairWeight','uStairRootHeight','uStairEdge','uStairDirection','uStairLevels']) {
        instance.deleteParameter(name);
      }
    }
    for (const material of this.materials.values()) {
      material.destroy();
    }
  }
}
