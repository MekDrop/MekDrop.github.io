import { HORNED_WRECKER_ANIMATION } from "./HornedWreckerAnimation.js";

/**
 * Selects embedded tracks on the rendered Tripo hierarchy.
 */
export class WreckerAnimationPlayback {
  /**
   * @param {import("playcanvas").Entity} root
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} library
   * @param {string} url
   */
  constructor(root, library, url) {
    this.tracks = library.getAnimationTracks(url, Object.values(HORNED_WRECKER_ANIMATION));
    root.addComponent("anim", { activate: true });
    this.animation = root.anim;
    this.name = null;
    for (const [name, track] of this.tracks) {
      this.animation.addAnimationState(name, track, 1,
        ["idle_snort", "heavy_walk", "heavy_run", "rage_charge_loop", "external_stun"].includes(name));
    }
    this.play("idle_snort");
  }

  /**
   * @param {string} name
   */
  play(name) {
    if (this.name === name || !this.tracks.has(name)) {
      return;
    }
    this.animation.baseLayer.transition(name, 0.12);
    this.name = name;
  }
}
