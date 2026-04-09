import prelude from "./prelude.glsl?raw";
import shared from "./shared.glsl?raw";
import backdrop from "./backdrop.glsl?raw";
import solids from "./solids.glsl?raw";
import goal from "./goal.glsl?raw";
import collectible from "./collectible.glsl?raw";
import foe from "./foe.glsl?raw";
import hero from "./hero.glsl?raw";
import main from "./main.glsl?raw";

const fragmentShader = [
  prelude,
  shared,
  backdrop,
  solids,
  goal,
  collectible,
  foe,
  hero,
  main,
].join("\n\n");

export default fragmentShader;
