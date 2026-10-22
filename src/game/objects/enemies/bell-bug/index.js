import { SignalBellAudio } from "../../../audio/signal-bell/SignalBellAudio.js";
import modelUrl from "../../../models/enemies/bell-bug/bell-bug.glb?url";
import { BellBug } from "./BellBug.js";

BellBug.modelUrl = modelUrl;
BellBug.modelUrls = [modelUrl];
BellBug.audioUrls = [SignalBellAudio.wavUrl];
export { BellBug as EnemyObjectClass };
