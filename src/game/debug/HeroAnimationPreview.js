import { Hero } from "../objects/hero/Hero.js";
import { AxeTool } from "../objects/hero/tools/AxeTool.js";
import { ShovelTool } from "../objects/hero/tools/ShovelTool.js";
import { HERO_ANIMATION } from "../enum/HeroAnimation.js";
import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { HeroAnimationSign } from "./HeroAnimationSign.js";

/** Independent, looping copies of every clip in the currently loaded hero. */
export class HeroAnimationPreview {
  #entity;
  #overlay;
  #entries = [];
  #updateHandle;
  #elapsed = 0;

  constructor({ pc, app, modelLibrary, canvas, columns = 6 }) {
    this.#entity = new pc.Entity("Hero animation preview");
    const tracks = modelLibrary.getAnimationTracks(Hero.modelUrl);
    const previews = [...tracks].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, track]) => ({ name, track }));
    for (const morph of ["HappyPat", "AngryPat"]) {
      previews.push({ name: morph, track: tracks.get(HERO_ANIMATION.IDLE), morph });
    }
    const rows = Math.ceil(previews.length / columns);
    this.#overlay = document.createElement("div");
    this.#overlay.dataset.heroAnimationGallery = "";
    Object.assign(this.#overlay.style, {
      position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden",
    });
    const heading = document.createElement("div");
    heading.textContent = `Hero animations · ${previews.length} looping previews`;
    Object.assign(heading.style, {
      position: "absolute", top: "16px", right: "16px", padding: "8px 12px",
      background: "#081c22e8", color: "#e6f5ee", borderRadius: "5px",
      font: "600 13px system-ui, sans-serif",
    });
    this.#overlay.append(heading);
    canvas.parentElement.append(this.#overlay);

    for (const [index, { name, track, morph }] of previews.entries()) {
      const anchor = new pc.Entity(`${name} preview station`);
      const across = ((index % columns) - (columns - 1) / 2) * 3.3;
      const back = (Math.floor(index / columns) - (rows - 1) / 2) * 3.8;
      anchor.setLocalPosition(
        (across + back) / Math.SQRT2,
        2 + GRASS_SURFACE_LIFT,
        (back - across) / Math.SQRT2,
      );
      this.#entity.addChild(anchor);
      const model = modelLibrary.instantiate(Hero.modelUrl);
      model.name = `${name} hero preview`;
      model.tags.add("hero-animation-preview", name);
      model.setLocalScale(0.65, 0.65, 0.65);
      model.setLocalEulerAngles(0, 45, 0);
      anchor.addChild(model);
      model.addComponent("anim", { activate: true });
      // Even one-shot clips loop here, each on its own animation component.
      model.anim.addAnimationState(name, track, 1, true);
      model.anim.baseLayer.play(name);
      const morphs = morph ? model.findComponents("render")
        .flatMap((render) => render.meshInstances)
        .map((mesh) => mesh.morphInstance)
        .filter((instance) => instance?.morph.targets.some((target) => target.name === morph)) : [];
      let tool = null;
      if (name === HERO_ANIMATION.FILL_HOLE) {
        tool = new ShovelTool({ modelLibrary });
      } else if ([HERO_ANIMATION.SUMMON_AXE, HERO_ANIMATION.DISMISS_AXE,
        HERO_ANIMATION.CHOP_LOW, HERO_ANIMATION.CHOP_MIDDLE,
        HERO_ANIMATION.CHOP_HIGH].includes(name)) {
        tool = new AxeTool({ modelLibrary });
      }
      if (tool) {
        tool.mount(model.findByName("Right arm"));
        tool.visible = true;
      }
      const sign = new HeroAnimationSign({ pc, app, modelLibrary, name });
      anchor.addChild(sign.entity);
      this.#entries.push({ sign, tool, morph, morphs });
    }
    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#updateHandle?.off();
    for (const entry of this.#entries) {
      entry.tool?.destroy();
      entry.sign.destroy();
    }
    this.#entries = [];
    this.#entity.destroy();
    this.#overlay.remove();
  }

  #update = (deltaTime) => {
    this.#elapsed += deltaTime;
    // Ease from neutral to the expression and back, with a short hold at each.
    const expression = Math.min(1, Math.max(0,
      0.5 - Math.cos(this.#elapsed * Math.PI / 2) * 0.7,
    ));
    for (const entry of this.#entries) {
      for (const instance of entry.morphs) {
        instance.setWeight(entry.morph, expression);
      }
    }
  };
}
