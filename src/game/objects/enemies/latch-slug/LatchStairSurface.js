import glsl from "./LatchStairSurface.vert?raw";
import wgsl from "./LatchStairSurface.wgsl?raw";

/**
 * Render-only skin contact with the three faces of a measured native tread.
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
    this.inverse = new pc.Mat4();
    const meshes = model.findComponents("render").flatMap(/**
     *
     * @param {import("playcanvas").RenderComponent} render
     */
      render=>render.meshInstances);
    const box = meshes[0].mesh.aabb;
    this.bindSpan = [box.center.z+box.halfExtents.z,box.center.z-box.halfExtents.z];
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
            const modelMatrix = language===pc.SHADERLANGUAGE_GLSL?'matrix_model':'uniform.matrix_model';
            chunks.set("transformVS",field+'\n'+transform.replace('return posW;', 'stairOriginalPosition = posW.xyz;\n #ifdef SKIN\n stairReferencePosition = ('+modelMatrix+' * '+vector+'(vertexPosition, 1.0)).xyz;\n #else\n stairReferencePosition = posW.xyz;\n #endif\n posW = '+vector+'(latchStairSurface(posW.xyz), posW.w);\n return posW;'));
            const normalWrapper = language===pc.SHADERLANGUAGE_GLSL ? `vec3 getNormal() {
              vec3 base = getStairOriginalNormal();
              #ifdef SKIN
              vec3 bindNormal = normalize(getNormalMatrix(matrix_model) * getLocalNormal(vertex_normal));
              base = normalize(mix(base, bindNormal, uStairWeight));
              #endif
              return latchStairNormal(base);
            }` : `fn getNormal() -> vec3f {
              var base = getStairOriginalNormal();
              #ifdef SKIN
              let bindNormal = normalize(getNormalMatrix(uniform.matrix_model) * getLocalNormal(vertex_normal));
              base = normalize(mix(base, bindNormal, uniform.uStairWeight));
              #endif
              return latchStairNormal(base);
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
    this.inverse.invert(this.owner.entity?.getWorldTransform() ?? this.inverse.setIdentity());
    const active = crawl?.active && this.owner.alive && !this.owner.airborne;
    let weight = 0;
    let flow = 0;
    if (active) {
      weight = crawl.phase==='reach'?this.owner.pc.math.smoothstep(0,.5,crawl.phaseAge):crawl.phase==='settle'?1-this.owner.pc.math.smoothstep(0,.22,crawl.phaseAge):1;
      if (crawl.phase==='transfer') {
        const progress=((this.owner.position?.y??crawl.lowerHeight)-crawl.lowerHeight)/Math.max(.01,crawl.upperHeight-crawl.lowerHeight);
        flow=.16*Math.max(0,Math.min(1,progress));
      } else if(crawl.phase==='pull') {
        const progress=((this.owner.position?.y??crawl.lowerHeight)-crawl.lowerHeight)/Math.max(.01,crawl.upperHeight-crawl.lowerHeight);
        flow=.16*Math.max(0,Math.min(1,progress))*(1-this.owner.pc.math.smoothstep(0,.55,crawl.phaseAge));
      }
    }
    for (const {instance,bounds} of this.records) {
      instance.setCustomAabb(active?bounds:null);
      instance.setParameter('uStairWeight',weight);
      instance.setParameter('uStairFlow',flow);
      instance.setParameter('uStairWorldToBind',this.inverse.data);
      instance.setParameter('uStairBindSpan',this.bindSpan);
      instance.setParameter('uStairEdge',active?[crawl.edge.x,crawl.edge.y,crawl.edge.z]:[0,0,0]);
      instance.setParameter('uStairDirection',active?[crawl.direction.x,crawl.direction.y,crawl.direction.z]:[1,0,0]);
      instance.setParameter('uStairLevels',active?[crawl.lowerHeight,crawl.upperHeight]:[0,0]);
      let span = [0,1,0,1], line = [0,0];
      if (active) {
        const gather = crawl.phase === 'pull' ? this.owner.pc.math.smoothstep(0,.55,crawl.phaseAge) : crawl.phase === 'settle' ? 1 : 0;
        const rise = crawl.upperHeight-crawl.lowerHeight;
        const rear = crawl.belly[1].getPosition(), front = crawl.belly[0].getPosition();
        const rearX = rear.clone().sub(crawl.edge).dot(crawl.direction), frontX = front.clone().sub(crawl.edge).dot(crawl.direction);
        const start = crawl.rearAnchor.clone().sub(crawl.edge).dot(crawl.direction);
        const end = rise+Math.max(.04,crawl.frontAnchor.clone().sub(crawl.edge).dot(crawl.direction));
        span = [Math.max(start,-(crawl.lowerRun??.46))*(1-gather)+(rise+.08)*gather,end*(1-gather)+(rise+Math.min(.43,crawl.upperRun??.46))*gather,rearX,frontX];
        line = [rear.y,front.y];
      }
      instance.setParameter('uStairSpan',span);
      instance.setParameter('uStairBodyLine',line);
      instance.setParameter('uStairRuns',active?[crawl.lowerRun??.46,crawl.upperRun??.46]:[1,1]);
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
      for (const name of ['uStairWeight','uStairFlow','uStairEdge','uStairDirection','uStairLevels','uStairSpan','uStairBodyLine','uStairRuns','uStairWorldToBind','uStairBindSpan']) {
        instance.deleteParameter(name);
      }
    }
    for (const material of this.materials.values()) {
      material.destroy();
    }
  }
}
