/**
 * CC0 recordings shared by castle effects and player interactions.
 * See copyrights.txt for the per-file provenance.
 */
export class CastleAudio {
  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static transition = {
    wavUrl: new URL("./transition.wav", import.meta.url).href,
    oggUrl: new URL("./transition.ogg", import.meta.url).href,
  };
  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static transitionRelease = {
    wavUrl: new URL("./transitionRelease.wav", import.meta.url).href,
    oggUrl: new URL("./transitionRelease.ogg", import.meta.url).href,
  };
  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static doorOpen = {
    wavUrl: new URL("./doorOpen.wav", import.meta.url).href,
    oggUrl: new URL("./doorOpen.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static doorClose = {
    wavUrl: new URL("./doorClose.wav", import.meta.url).href,
    oggUrl: new URL("./doorClose.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static chop = {
    wavUrl: new URL("./chop.wav", import.meta.url).href,
    oggUrl: new URL("./chop.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static swing = {
    wavUrl: new URL("./swing.wav", import.meta.url).href,
    oggUrl: new URL("./swing.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static pickup = {
    wavUrl: new URL("./pickup.wav", import.meta.url).href,
    oggUrl: new URL("./pickup.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static latch = {
    wavUrl: new URL("./latch.wav", import.meta.url).href,
    oggUrl: new URL("./latch.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static creak = {
    wavUrl: new URL("./creak.wav", import.meta.url).href,
    oggUrl: new URL("./creak.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static cloth = {
    wavUrl: new URL("./cloth.wav", import.meta.url).href,
    oggUrl: new URL("./cloth.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static grassStep1 = {
    wavUrl: new URL("./grassStep1.wav", import.meta.url).href,
    oggUrl: new URL("./grassStep1.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static grassStep2 = {
    wavUrl: new URL("./grassStep2.wav", import.meta.url).href,
    oggUrl: new URL("./grassStep2.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static stoneStep1 = {
    wavUrl: new URL("./stoneStep1.wav", import.meta.url).href,
    oggUrl: new URL("./stoneStep1.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static stoneStep2 = {
    wavUrl: new URL("./stoneStep2.wav", import.meta.url).href,
    oggUrl: new URL("./stoneStep2.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static woodBreak = {
    wavUrl: new URL("./woodBreak.wav", import.meta.url).href,
    oggUrl: new URL("./woodBreak.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static hammer = {
    wavUrl: new URL("./hammer.wav", import.meta.url).href,
    oggUrl: new URL("./hammer.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static land = {
    wavUrl: new URL("./land.wav", import.meta.url).href,
    oggUrl: new URL("./land.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static mist = {
    wavUrl: new URL("./mist.wav", import.meta.url).href,
    oggUrl: new URL("./mist.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static reveal = {
    wavUrl: new URL("./reveal.wav", import.meta.url).href,
    oggUrl: new URL("./reveal.ogg", import.meta.url).href,
  };

  /**
   * @type {{wavUrl:string,oggUrl:string}}
   */
  static fire = {
    wavUrl: new URL("./fire.wav", import.meta.url).href,
    oggUrl: new URL("./fire.ogg", import.meta.url).href,
  };

  /**
   * @returns {{wavUrl:string,oggUrl:string}[]}
   */
  static get sources() {
    return [CastleAudio.transition, CastleAudio.transitionRelease, CastleAudio.doorOpen, CastleAudio.doorClose, CastleAudio.chop, CastleAudio.swing, CastleAudio.pickup, CastleAudio.latch, CastleAudio.creak, CastleAudio.cloth, CastleAudio.grassStep1, CastleAudio.grassStep2, CastleAudio.stoneStep1, CastleAudio.stoneStep2, CastleAudio.woodBreak, CastleAudio.hammer, CastleAudio.land, CastleAudio.mist, CastleAudio.reveal, CastleAudio.fire];
  }
}
