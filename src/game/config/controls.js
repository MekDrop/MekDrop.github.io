import { DEFAULT_CONTROLS as BASE_CONTROLS } from "../../config/controls.js";
import { isObject } from "../helpers/types.js";

export const DEVELOPMENT_MAX_ZOOM = 50;

export const CONTROLS = Object.freeze(
  isObject(BASE_CONTROLS) ? BASE_CONTROLS : {},
);

export const DEFAULT_CONTROLS = CONTROLS;
