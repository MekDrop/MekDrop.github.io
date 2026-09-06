import { DEFAULT_CONTROLS as BASE_CONTROLS } from "src/config/controls.js";

export const CONTROLS = Object.freeze(
  BASE_CONTROLS && typeof BASE_CONTROLS === "object" ? BASE_CONTROLS : {},
);

export const DEFAULT_CONTROLS = CONTROLS;

export const MOVEMENT_DIRECTIONS = Object.freeze(["up", "down", "left", "right"]);
