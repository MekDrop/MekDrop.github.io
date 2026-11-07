import { SignalBellAudio } from "../../../audio/signal-bell/SignalBellAudio.js";
import { LatchSlugAudio } from "../../../audio/latch-slug/LatchSlugAudio.js";
import { CastleAudio } from "../../../audio/castle/CastleAudio.js";
import modelUrl from "../../../models/enemies/bell-bug/bell-bug.glb?url";
import { BellBug } from "./BellBug.js";

BellBug.modelUrl = modelUrl;
BellBug.modelUrls = [modelUrl];
BellBug.audioUrls = [SignalBellAudio.wavUrl, LatchSlugAudio.scoopPress.wavUrl, LatchSlugAudio.scoopPull.wavUrl, LatchSlugAudio.scoopTaste.wavUrl,
  CastleAudio.stoneStep1.wavUrl, CastleAudio.stoneStep2.wavUrl];
export { BellBug as EnemyObjectClass };
