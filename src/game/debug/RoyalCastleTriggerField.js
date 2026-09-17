const TRIGGER_COLORS = [0xd8aa3d, 0x627bd9, 0xe47ea6];

/** Development-only floor markers that activate one royal castle apiece. */
export class RoyalCastleTriggerField {
  #entity;
  #materials = [];

  constructor({ pc, triggers, cols, rows, tileHeightAt }) {
    this.#entity = new pc.Entity("Royal castle trigger tiles");
    triggers.forEach((trigger, index) => {
      const color = new pc.Color();
      color.fromString(`#${(trigger.color ?? TRIGGER_COLORS[index % 3])
        .toString(16)
        .padStart(6, "0")}`);
      const material = new pc.StandardMaterial();
      material.name = `${trigger.royal ?? "Royal"} trigger material`;
      material.diffuse.copy(color);
      material.emissive.copy(color);
      material.emissiveIntensity = 0.45;
      material.gloss = 0.18;
      material.update();
      this.#materials.push(material);

      const marker = new pc.Entity(`${trigger.royal ?? "Royal"} trigger tile`);
      marker.addComponent("render", {
        type: "cylinder",
        castShadows: false,
        receiveShadows: false,
      });
      marker.render.meshInstances[0].material = material;
      marker.setLocalPosition(
        trigger.col - (cols - 1) / 2,
        tileHeightAt(trigger.col, trigger.row) + 0.025,
        trigger.row - (rows - 1) / 2,
      );
      marker.setLocalScale(0.72, 0.035, 0.72);
      this.#entity.addChild(marker);
    });
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity.destroy();
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#materials = [];
  }
}
