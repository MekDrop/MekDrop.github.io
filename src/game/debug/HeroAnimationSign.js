import signModelUrl from "../models/scenery/arrow-signpost.glb?url";

/** An authored wooden direction sign with an instance-specific inscription. */
export class HeroAnimationSign {
  #entity;
  #texture;
  #material;

  static get modelUrl() {
    return signModelUrl;
  }

  constructor({ pc, app, modelLibrary, name }) {
    this.#entity = modelLibrary.instantiate(signModelUrl);
    this.#entity.name = `${name} arrow sign`;
    this.#entity.tags.add("hero-animation-sign", name);
    this.#entity.setLocalEulerAngles(0, 45, 0);
    this.#entity.setLocalPosition(1.25 / Math.SQRT2, 0, 1.25 / Math.SQRT2);

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    const words = name.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ");
    const lines = words.length > 2
      ? [words.slice(0, -1).join(" "), words.at(-1)]
      : [words.join(" ")];
    let fontSize = lines.length > 1 ? 90 : 160;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    do {
      context.font = `bold ${fontSize}px "Palatino Linotype", Georgia, serif`;
      if (lines.every((line) => {
        const metrics = context.measureText(line);
        const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        return metrics.width <= 494 && height <= (lines.length > 1 ? 67 : 142);
      })) {
        break;
      }
      fontSize -= 2;
    } while (fontSize > 24);
    context.fillStyle = "#efd8a2";
    for (const [index, line] of lines.entries()) {
      const metrics = context.measureText(line);
      let x = (canvas.width - metrics.width) / 2;
      const baseline = 80 + (index - (lines.length - 1) / 2) * 76
        + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      context.textAlign = "left";
      for (const [letterIndex, letter] of [...line].entries()) {
        const variation = Math.sin(letterIndex * 2.3 + index);
        context.save();
        context.translate(x, baseline + variation * 1.5);
        context.rotate(variation * 0.025);
        context.fillText(letter, 0, 0);
        context.restore();
        x += context.measureText(letter).width;
      }
    }
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: `${name} sign lettering`,
      width: canvas.width,
      height: canvas.height,
      format: pc.PIXELFORMAT_RGBA8,
      srgb: true,
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      anisotropy: 4,
    });
    this.#texture.setSource(canvas);
    this.#material = new pc.StandardMaterial();
    this.#material.name = `${name} painted inscription`;
    this.#material.diffuse = new pc.Color(1, 1, 1);
    this.#material.diffuseMap = this.#texture;
    this.#material.opacityMap = this.#texture;
    this.#material.opacityMapChannel = "a";
    this.#material.blendType = pc.BLEND_NORMAL;
    this.#material.depthWrite = false;
    this.#material.useMetalness = true;
    this.#material.metalness = 0;
    this.#material.gloss = 0;
    this.#material.update();
    for (const render of this.#entity.findByName("Sign inscription").findComponents("render")) {
      for (const mesh of render.meshInstances) {
        mesh.material = this.#material;
        mesh.castShadow = false;
      }
    }
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity.destroy();
    this.#material.destroy();
    this.#texture.destroy();
  }
}
