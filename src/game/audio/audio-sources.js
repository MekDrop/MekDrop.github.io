import { SignalBellAudio } from "./signal-bell/SignalBellAudio.js";

/**
 * Audio classes own their URLs; registration alone does not load their clips.
 */
export const audioSources = [SignalBellAudio];
