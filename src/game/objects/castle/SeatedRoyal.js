const ROYAL_STYLES = {
  king: {
    robe: 0x8f2638,
    robeLight: 0xc3424f,
    hair: 0x4a2b1e,
    crownScale: 1,
    hasBeard: true,
  },
  queen: {
    robe: 0x315aa6,
    robeLight: 0x5884cf,
    hair: 0x6b3b22,
    crownScale: 0.92,
    hasLongHair: true,
  },
  princess: {
    robe: 0xa63e70,
    robeLight: 0xd76598,
    hair: 0x5b321f,
    crownScale: 0.72,
    hasLongHair: true,
  },
};

const MATERIAL_DEFINITIONS = {
  skin: { color: 0xb97855, gloss: 0.12 },
  skinLight: { color: 0xd6956f, gloss: 0.12 },
  eye: { color: 0x171719, gloss: 0.06 },
  gold: { color: 0xd8a936, gloss: 0.38, metalness: 0.34 },
  goldLight: { color: 0xf0cf62, gloss: 0.42, metalness: 0.3 },
  boot: { color: 0x3d241c, gloss: 0.06 },
};

/**
 * A compact, seated low-poly royal. The local +Z axis faces the visitor.
 */
export class SeatedRoyal {
  #pc;
  #entity;
  #materials = new Map();

  constructor({ pc, role = "king" }) {
    this.#pc = pc;
    const normalizedRole = ROYAL_STYLES[role] ? role : "king";
    this.#entity = new pc.Entity(`Seated ${normalizedRole}`);
    this.#createMaterials(ROYAL_STYLES[normalizedRole]);
    this.#build(normalizedRole, ROYAL_STYLES[normalizedRole]);
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
  }

  #createMaterials(style) {
    const definitions = {
      ...MATERIAL_DEFINITIONS,
      robe: { color: style.robe, gloss: 0.1 },
      robeLight: { color: style.robeLight, gloss: 0.12 },
      hair: { color: style.hair, gloss: 0.16 },
    };
    for (const [name, definition] of Object.entries(definitions)) {
      const material = new this.#pc.StandardMaterial();
      material.name = `Royal ${name}`;
      material.diffuse = this.#color(definition.color);
      material.gloss = definition.gloss ?? 0.08;
      material.metalness = definition.metalness ?? 0;
      material.useMetalness = true;
      material.update();
      this.#materials.set(name, material);
    }
  }

  #build(role, style) {
    this.#box("Royal seated robe", "robe", [0, 0.73, 0], [0.68, 0.75, 0.46]);
    this.#box(
      "Royal robe front",
      "robeLight",
      [0, 0.47, 0.25],
      [0.52, 0.56, 0.12],
    );
    this.#box("Royal belt", "gold", [0, 0.82, 0.255], [0.66, 0.09, 0.08]);

    this.#buildLeg(-0.2);
    this.#buildLeg(0.2);
    this.#buildArm(-0.42, -8);
    this.#buildArm(0.42, 8);
    this.#buildHead(role, style);
  }

  #buildLeg(x) {
    const leg = this.#box(
      "Royal bent leg",
      "robe",
      [x, 0.42, 0.37],
      [0.25, 0.24, 0.44],
    );
    leg.setLocalEulerAngles(-18, 0, 0);
    this.#box("Royal boot", "boot", [x, 0.23, 0.58], [0.29, 0.22, 0.4]);
  }

  #buildArm(x, roll) {
    const sleeve = this.#box(
      "Royal sleeve",
      "robeLight",
      [x, 0.78, 0.11],
      [0.24, 0.55, 0.26],
    );
    sleeve.setLocalEulerAngles(12, 0, roll);
    this.#box(
      "Royal hand",
      "skin",
      [x * 0.91, 0.53, 0.29],
      [0.2, 0.2, 0.2],
    );
  }

  #buildHead(role, style) {
    this.#box("Royal neck", "skin", [0, 1.16, 0], [0.22, 0.2, 0.2]);
    this.#box("Royal hair mass", "hair", [0, 1.48, -0.035], [0.71, 0.7, 0.57]);
    this.#box("Royal face", "skinLight", [0, 1.43, 0.28], [0.62, 0.52, 0.13]);

    for (const x of [-0.16, 0.16]) {
      this.#box("Royal eye", "eye", [x, 1.5, 0.355], [0.055, 0.085, 0.035]);
    }
    this.#box("Royal nose", "skin", [0, 1.4, 0.36], [0.06, 0.06, 0.045]);

    if (style.hasLongHair) {
      for (const x of [-0.31, 0.31]) {
        this.#box(
          "Royal long side hair",
          "hair",
          [x, 1.25, 0.06],
          [0.18, 0.58, 0.23],
        );
      }
    }
    if (style.hasBeard) {
      const beard = this.#box(
        "King block beard",
        "hair",
        [0, 1.25, 0.34],
        [0.42, 0.28, 0.11],
      );
      beard.setLocalEulerAngles(-8, 0, 0);
    }

    this.#buildCrown(role, style.crownScale);
  }

  #buildCrown(role, scale) {
    const crown = new this.#pc.Entity(`${role} crown`);
    crown.setLocalPosition(0, 1.86, -0.01);
    crown.setLocalScale(scale, scale, scale);
    this.#entity.addChild(crown);

    this.#box(
      "Crown band",
      "gold",
      [0, 0, 0],
      [0.58, 0.14, 0.47],
      crown,
    );
    const points = role === "princess" ? [-0.18, 0, 0.18] : [-0.23, 0, 0.23];
    for (const x of points) {
      const height = x === 0 ? 0.31 : 0.24;
      this.#box(
        "Crown point",
        "goldLight",
        [x, 0.12 + height / 2, 0.02],
        [0.11, height, 0.11],
        crown,
      );
    }
  }

  #box(name, materialName, position, scale, parent = this.#entity) {
    const entity = new this.#pc.Entity(name);
    entity.addComponent("render", {
      type: "box",
      castShadows: false,
      receiveShadows: true,
    });
    for (const meshInstance of entity.render.meshInstances) {
      meshInstance.material = this.#materials.get(materialName);
    }
    entity.setLocalPosition(...position);
    entity.setLocalScale(...scale);
    parent.addChild(entity);
    return entity;
  }

  #color(value) {
    return new this.#pc.Color(
      ((value >> 16) & 0xff) / 255,
      ((value >> 8) & 0xff) / 255,
      (value & 0xff) / 255,
    );
  }
}
