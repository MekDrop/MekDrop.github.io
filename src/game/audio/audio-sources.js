import { SignalBellAudio } from "./signal-bell/SignalBellAudio.js";
import { CastleAudio } from "./castle/CastleAudio.js";
import { LatchSlugAudio } from "./latch-slug/LatchSlugAudio.js";
import { DoorAudio } from "./door/DoorAudio.js";
import { BellBugAudio } from "./bell-bug/BellBugAudio.js";

/**
 * Audio classes own their URLs; registration alone does not load their clips.
 */
export const audioSources = [SignalBellAudio, ...CastleAudio.sources, ...LatchSlugAudio.sources, ...DoorAudio.sources, ...BellBugAudio.sources];
