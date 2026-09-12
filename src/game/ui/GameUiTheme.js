import {
  InvalidGameUiThemeColorError,
  InvalidGameUiThemeTokenError,
  MissingGameUiThemeColorRoleError,
  MissingGameUiThemeTokenError,
} from "../errors/ui/index.js";
import { isNumber } from "../helpers/types.js";

const QUASAR_COLOR_ROLES = [
  "primary",
  "secondary",
  "accent",
  "positive",
  "negative",
  "info",
  "warning",
  "dark",
  "darkPage",
];

export class GameUiTheme {
  #colors = new Map();
  #fontFamily;
  #borderRadius;
  #spacing = new Map();

  constructor(theme) {
    for (const role of QUASAR_COLOR_ROLES) {
      this.#colors.set(role, this.#parsePaletteRole(theme, role));
    }
    this.#fontFamily = this.#parseFontFamily(theme);
    this.#borderRadius = this.#parseBorderRadius(theme);
    for (const size of ["Xs", "Sm", "Md", "Lg", "Xl"]) {
      const property = `space${size}`;
      this.#spacing.set(size.toLowerCase(), this.#parsePixelToken(theme, property));
    }

    const primary = this.#get("primary");
    const dark = this.#get("dark");
    const darkPage = this.#get("darkPage");
    const secondary = this.#get("secondary");
    const accent = this.#get("accent");
    const info = this.#get("info");
    const surface = this.#mix(dark, primary, 0.32);
    const pageSurface = this.#mix(darkPage, primary, 0.18);

    this.#set("surfaceTop", this.#mix(surface, secondary, 0.18));
    this.#set("surfaceBottom", this.#shade(pageSurface, -0.42));
    this.#set("surfaceInsetTop", this.#shade(pageSurface, -0.58));
    this.#set(
      "surfaceInsetBottom",
      this.#shade(this.#mix(pageSurface, info, 0.12), -0.42),
    );
    this.#set("surfaceRaisedTop", this.#mix(surface, secondary, 0.35));
    this.#set("surfaceRaisedBottom", this.#shade(surface, -0.25));
    this.#set("outline", this.#mix(secondary, accent, 0.2));
    this.#set("outlineStrong", this.#mix(secondary, accent, 0.48));
    this.#set("text", this.#shade(accent, 0.82));
    this.#set("textMuted", this.#mix(accent, secondary, 0.25));
    this.#set("textSubtle", this.#mix(accent, surface, 0.42));
    this.#set("shadow", this.#shade(pageSurface, -0.82));
    this.#set("backdrop", this.#shade(pageSurface, -0.72));
    this.#set("positive", this.#shade(this.#get("positive"), 0.18));
    const negative = this.#shade(this.#get("negative"), 0.18);
    this.#set("negative", negative);
    this.#set("negativeBright", this.#shade(negative, 0.34));
    this.#set("negativeDark", this.#mix(negative, this.#get("shadow"), 0.56));
    this.#set("info", this.#mix(info, accent, 0.42));
    this.#set("warning", this.#shade(this.#get("warning"), 0.18));
  }

  get surfaceTop() {
    return this.#hex("surfaceTop");
  }

  get surfaceBottom() {
    return this.#hex("surfaceBottom");
  }

  get surfaceInsetTop() {
    return this.#hex("surfaceInsetTop");
  }

  get surfaceInsetBottom() {
    return this.#hex("surfaceInsetBottom");
  }

  get surfaceRaisedTop() {
    return this.#hex("surfaceRaisedTop");
  }

  get surfaceRaisedBottom() {
    return this.#hex("surfaceRaisedBottom");
  }

  get outline() {
    return this.#hex("outline");
  }

  get outlineStrong() {
    return this.#hex("outlineStrong");
  }

  get text() {
    return this.#hex("text");
  }

  get textMuted() {
    return this.#hex("textMuted");
  }

  get textSubtle() {
    return this.#hex("textSubtle");
  }

  get shadow() {
    return this.#hex("shadow");
  }

  get backdrop() {
    return this.#hex("backdrop");
  }

  get positive() {
    return this.#hex("positive");
  }

  get negative() {
    return this.#hex("negative");
  }

  get negativeBright() {
    return this.#hex("negativeBright");
  }

  get negativeDark() {
    return this.#hex("negativeDark");
  }

  get info() {
    return this.#hex("info");
  }

  get warning() {
    return this.#hex("warning");
  }

  get fontFamily() {
    return this.#fontFamily;
  }

  get borderRadius() {
    return this.#borderRadius;
  }

  get spaceXs() {
    return this.#spacing.get("xs");
  }

  get spaceSm() {
    return this.#spacing.get("sm");
  }

  get spaceMd() {
    return this.#spacing.get("md");
  }

  get spaceLg() {
    return this.#spacing.get("lg");
  }

  get spaceXl() {
    return this.#spacing.get("xl");
  }

  font(weight, size) {
    return `${weight} ${size}px ${this.#fontFamily}`;
  }

  withAlpha(color, alpha) {
    const { red, green, blue } = this.#parseColor(color, "runtime color");
    return `rgba(${red}, ${green}, ${blue}, ${this.#clamp(alpha, 0, 1)})`;
  }

  playCanvasColor(pc, color, alpha = 1) {
    const value = this.#parseColor(color, "runtime color");
    return new pc.Color(
      this.#srgbToLinear(value.red / 255),
      this.#srgbToLinear(value.green / 255),
      this.#srgbToLinear(value.blue / 255),
      this.#clamp(alpha, 0, 1),
    );
  }

  #set(name, color) {
    this.#colors.set(name, color);
  }

  #get(name) {
    return this.#colors.get(name);
  }

  #hex(name) {
    const { red, green, blue } = this.#get(name);
    return `#${[red, green, blue]
      .map((component) => component.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  #mix(first, second, amount) {
    const weight = this.#clamp(amount, 0, 1);
    return {
      red: Math.round(first.red + (second.red - first.red) * weight),
      green: Math.round(first.green + (second.green - first.green) * weight),
      blue: Math.round(first.blue + (second.blue - first.blue) * weight),
    };
  }

  #shade(color, amount) {
    const weight = this.#clamp(amount, -1, 1);
    const nextComponent = (component) =>
      weight < 0
        ? component * (1 + weight)
        : component + (255 - component) * weight;
    return {
      red: Math.round(nextComponent(color.red)),
      green: Math.round(nextComponent(color.green)),
      blue: Math.round(nextComponent(color.blue)),
    };
  }

  #parsePaletteRole(palette, role) {
    if (!palette || !Object.hasOwn(palette, role)) {
      throw new MissingGameUiThemeColorRoleError({ role });
    }
    const value = palette[role];
    if (value === null || value === undefined || String(value).trim() === "") {
      throw new MissingGameUiThemeColorRoleError({ role });
    }
    return this.#parseColor(value, role);
  }

  #parseFontFamily(theme) {
    const value = theme?.fontFamily;
    if (value === null || value === undefined || String(value).trim() === "") {
      throw new MissingGameUiThemeTokenError({ token: "font-family" });
    }
    return String(value).trim();
  }

  #parseBorderRadius(theme) {
    return this.#parsePixelToken(theme, "borderRadius", "border-radius");
  }

  #parsePixelToken(theme, property, token = property) {
    const value = theme?.[property];
    if (value === null || value === undefined || String(value).trim() === "") {
      throw new MissingGameUiThemeTokenError({ token });
    }
    const text = String(value).trim();
    const pixels = text.match(/^(0|[\d.]+px)$/)?.[1];
    const length = Number.parseFloat(pixels);
    if (!Number.isFinite(length) || length < 0) {
      throw new InvalidGameUiThemeTokenError({
        token,
        value,
      });
    }
    return length;
  }

  #parseColor(value, role) {
    if (isNumber(value)) {
      return {
        red: (value >> 16) & 0xff,
        green: (value >> 8) & 0xff,
        blue: value & 0xff,
      };
    }

    const text = String(value).trim();
    const hex = text.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
    if (hex) {
      const expanded =
        hex.length === 3
          ? hex
              .split("")
              .map((character) => character + character)
              .join("")
          : hex;
      return {
        red: Number.parseInt(expanded.slice(0, 2), 16),
        green: Number.parseInt(expanded.slice(2, 4), 16),
        blue: Number.parseInt(expanded.slice(4, 6), 16),
      };
    }

    const rgb = text.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
    );
    if (rgb) {
      return {
        red: Math.round(this.#clamp(Number(rgb[1]), 0, 255)),
        green: Math.round(this.#clamp(Number(rgb[2]), 0, 255)),
        blue: Math.round(this.#clamp(Number(rgb[3]), 0, 255)),
      };
    }

    throw new InvalidGameUiThemeColorError({ role, value });
  }

  #srgbToLinear(value) {
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  }

  #clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }
}
