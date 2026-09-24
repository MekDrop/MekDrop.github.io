import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { pickupActionForCategory } from "../config/hero-pickup-actions.js";
import { Hero } from "../objects/hero/Hero.js";
import groundCoverFragmentShader from "../objects/ground-cover/GroundCover.frag?raw";
import groundCoverHeldVertexShader from "../objects/ground-cover/GroundCoverHeld.vert?raw";
import { KnifeTool } from "../objects/hero/tools/index.js";
import {
  GROUND_COVER_VARIANTS,
  GroundCoverHeldItem,
  GroundCoverItem,
} from "../objects/ground-cover/index.js";
import { HeroAnimationSign } from "./HeroAnimationSign.js";

const HERO_PREVIEW_SCALE = 0.65;
const PICKUP_LOOP_PAUSE = 0.32;
const PICKUP_ITEMS = Object.freeze([
  ["Daisy Patch", "daisy-patch"],
  ["Buttercup Patch", "buttercup-patch"],
  ["Pink Flower Patch", "pink-flower-patch"],
  ["Blue Flower Patch", "blue-flower-patch"],
  ["Clover Patch", "clover-patch"],
  ["Red Mushroom", "red-mushroom"],
  ["Golden Mushroom Pair", "golden-mushroom-pair"],
  ["Forest Mushroom Cluster", "forest-mushroom-cluster"],
]);

function findChildByName(root, name) {
  const pending = [root];
  while (pending.length) {
    const entity = pending.pop();
    if (entity.name === name) {
      return entity;
    }
    pending.push(...entity.children);
  }
  return null;
}

function pickupSourceDistance(pickupAction) {
  return pickupAction.targetDistance ?? pickupAction.maximumDistance;
}

function alignBottomToSurface(entity, surfaceY) {
  entity.syncHierarchy();
  let bottomY = Number.POSITIVE_INFINITY;
  for (const render of entity.findComponents("render")) {
    for (const meshInstance of render.meshInstances) {
      const { center, halfExtents } = meshInstance.aabb;
      bottomY = Math.min(bottomY, center.y - halfExtents.y);
    }
  }
  if (!Number.isFinite(bottomY)) {
    return;
  }
  const position = entity.getLocalPosition().clone();
  position.y += surfaceY - bottomY;
  entity.setLocalPosition(position);
}

function createPreviewItem({
  pc,
  app,
  modelLibrary,
  variant,
  definition,
  phase,
}) {
  return new GroundCoverItem({
    pc,
    app,
    modelLibrary,
    modelUrl: definition.modelUrl,
    variant,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    scale: heldItemScale(definition),
    flexibility: definition.flexibility ?? 0.82,
    stepReaction: "recover",
    phase,
    ambientMotion: 0.35,
  });
}

function heldItemScale(definition) {
  return definition.category === "flower"
    ? {
        x: definition.horizontalScale,
        y: definition.verticalScale,
        z: definition.horizontalScale,
      }
    : definition.scale;
}

function heldMaterialSettings(category) {
  return category === "flower"
    ? { bendHeight: 0.14, colorBoost: [1.08, 1.04, 1.08] }
    : { bendHeight: 0.12, colorBoost: [1, 1, 1] };
}

function createHeldMaterial(pc, category) {
  const settings = heldMaterialSettings(category);
  const material = new pc.ShaderMaterial({
    uniqueName: `preview-held-ground-cover-${category}`,
    vertexGLSL: groundCoverHeldVertexShader,
    fragmentGLSL: groundCoverFragmentShader,
    attributes: {
      vertex_position: pc.SEMANTIC_POSITION,
      vertex_normal: pc.SEMANTIC_NORMAL,
      vertex_color: pc.SEMANTIC_COLOR,
    },
  });
  material.name = `Preview held ${category} ground cover`;
  material.cull = pc.CULLFACE_NONE;
  material.setParameter("uBendHeight", settings.bendHeight);
  material.setParameter("uColorBoost", settings.colorBoost);
  material.setParameter("uLightDirection", [0.42, 0.82, 0.38]);
  material.update();
  return material;
}
/** Looping hero pickup previews for every collectible ground-cover inventory item. */
export class HeroPickupItemPreview {
  #pc;
  #modelLibrary;
  #entity;
  #heldMaterials = new Map();
  #entries = [];
  #updateHandle = null;

  constructor({ pc, modelLibrary, app, columns = 4 }) {
    this.#pc = pc;
    this.#modelLibrary = modelLibrary;
    this.#entity = new pc.Entity("Hero pickup item preview");
    for (const category of new Set(
      Object.values(GROUND_COVER_VARIANTS).map(({ category }) => category),
    )) {
      this.#heldMaterials.set(category, createHeldMaterial(pc, category));
    }
    const tracks = modelLibrary.getAnimationTracks(
      Hero.modelUrl,
      [...new Set(
        Object.values(GROUND_COVER_VARIANTS)
          .map(({ category }) => pickupActionForCategory(category)?.animation)
          .filter(Boolean),
      )],
    );
    const rows = Math.ceil(PICKUP_ITEMS.length / columns);

    for (const [index, [name, variant]] of PICKUP_ITEMS.entries()) {
      const definition = GROUND_COVER_VARIANTS[variant];
      const pickupAction = pickupActionForCategory(definition.category);
      const anchor = new pc.Entity(`${name} pickup station`);
      const across = ((index % columns) - (columns - 1) / 2) * 3.4;
      const back = (Math.floor(index / columns) - (rows - 1) / 2) * 4;
      anchor.setLocalPosition(
        (across + back) / Math.SQRT2,
        2 + GRASS_SURFACE_LIFT,
        (back - across) / Math.SQRT2,
      );
      this.#entity.addChild(anchor);

      const model = modelLibrary.instantiate(Hero.modelUrl);
      model.name = `${name} pickup hero preview`;
      model.tags.add("hero-pickup-item-preview", name);
      model.setLocalScale(
        HERO_PREVIEW_SCALE,
        HERO_PREVIEW_SCALE,
        HERO_PREVIEW_SCALE,
      );
      model.setLocalEulerAngles(0, 45, 0);
      anchor.addChild(model);
      model.addComponent("anim", { activate: true });
      model.anim.addAnimationState(
        pickupAction.animation,
        tracks.get(pickupAction.animation),
        1,
        false,
      );
      model.anim.baseLayer.play(pickupAction.animation);
      model.anim.speed = 0;

      const source = new pc.Entity(`${name} pickup source`);
      const sourceDistance = pickupSourceDistance(pickupAction);
      source.setLocalPosition(
        sourceDistance / Math.SQRT2,
        0,
        sourceDistance / Math.SQRT2,
      );
      anchor.addChild(source);
      const sourceItem = createPreviewItem({
        pc,
        app,
        modelLibrary,
        variant,
        definition,
        phase: index * 0.73,
      });
      sourceItem.entity.name = `${name} source pickup item`;
      source.addChild(sourceItem.entity);

      let tool = null;
      if (pickupAction.requiresTool) {
        tool = new KnifeTool({ modelLibrary });
        tool.mount(findChildByName(model, "Right arm"));
        tool.visible = true;
      }

      const sign = new HeroAnimationSign({ pc, app, modelLibrary, name });
      anchor.addChild(sign.entity);
      this.#entries.push({
        name,
        anchor,
        model,
        source,
        sourceItem,
        definition,
        pickupAction,
        sign,
        tool,
        elapsed: index * 0.11,
        heldItem: null,
      });
    }

    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    for (const entry of this.#entries) {
      entry.heldItem?.destroy();
      entry.sourceItem?.destroy();
      entry.tool?.destroy();
      entry.sign.destroy();
    }
    this.#entries = [];
    for (const material of this.#heldMaterials.values()) {
      material.destroy();
    }
    this.#heldMaterials.clear();
    this.#entity.destroy();
  }

  #createHeldItem(entry) {
    return new GroundCoverHeldItem({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      modelUrl: entry.definition.modelUrl,
      name: entry.name,
      scale: heldItemScale(entry.definition),
      material: this.#heldMaterials.get(entry.definition.category),
      gripPoint: entry.definition.gripPoint,
      pickupTilt: entry.definition.category === "flower" ? -68 : 68,
    });
  }

  #update = (deltaTime) => {
    for (const entry of this.#entries) {
      const loopDuration = entry.pickupAction.duration + PICKUP_LOOP_PAUSE;
      const previousElapsed = entry.elapsed;
      entry.elapsed = (entry.elapsed + deltaTime) % loopDuration;
      if (entry.elapsed < previousElapsed) {
        entry.heldItem?.destroy();
        entry.heldItem = null;
        entry.sourceItem.entity.enabled = true;
        entry.model.anim.baseLayer.play(entry.pickupAction.animation);
      }
      const animationTime = Math.min(entry.elapsed, entry.pickupAction.duration);
      entry.model.anim.baseLayer.activeStateCurrentTime = animationTime;
      entry.sourceItem.entity.enabled =
        animationTime < entry.pickupAction.impactTime;
      if (entry.sourceItem.entity.enabled) {
        const contactLeadTime = Math.max(
          0,
          entry.pickupAction.impactTime - 0.35,
        );
        if (animationTime >= contactLeadTime) {
          entry.sourceItem.stepOn(0, 1);
        }
        entry.sourceItem.advance(deltaTime);
      }
      if (
        animationTime >= entry.pickupAction.impactTime &&
        animationTime < entry.pickupAction.heldItemHideTime
      ) {
        if (!entry.heldItem) {
          entry.heldItem = this.#createHeldItem(entry);
          const gloveName = entry.pickupAction.heldItemAttachment === "left"
            ? "Left white glove"
            : "Right white glove";
          entry.heldItem.mount(
            entry.anchor,
            findChildByName(entry.model, gloveName),
          );
        }
        entry.heldItem.follow(deltaTime);
      } else if (entry.heldItem) {
        entry.heldItem.destroy();
        entry.heldItem = null;
      }
    }
  };
}
