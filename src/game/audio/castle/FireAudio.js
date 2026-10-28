import { CastleAudio } from "./CastleAudio.js";
import { GameObjectAudio } from "../GameObjectAudio.js";

/**
 * Local, quiet crackling owned by the main prop, never its individual flames.
 */
export class FireAudio {
  /**
   * @returns {string[]}
   */
  static get audioUrls() {
    return [CastleAudio.fire.wavUrl];
  }

  /**
   * @param {import("playcanvas").Entity} root
   * @param {import("playcanvas").Application} app
   * @param {import("../../objects/ObjectTypes.js").MapObjectRuntime} runtime
   * @param {number} volume
   */
  constructor(root, app, runtime, volume) {
    if (!runtime?.audioLibrary) {
      return;
    }
    const audio = new GameObjectAudio(root, app, runtime.audioLibrary, { fire: CastleAudio.fire }, volume);
    root.sound.slot("fire").loop = true;
    root.sound.slot("fire").autoPlay = true;
    audio.follow(() => runtime.objects.getOne("hero")?.position ?? null, 7);
    audio.play("fire");
  }
}
