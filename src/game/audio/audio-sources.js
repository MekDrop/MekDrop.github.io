import { SignalBellAudio } from "./signal-bell/SignalBellAudio.js";
import { CastleAudio } from "./castle/CastleAudio.js";

/**
 * Audio classes own their URLs; registration alone does not load their clips.
 */
export const audioSources = [SignalBellAudio, ...CastleAudio.sources];
