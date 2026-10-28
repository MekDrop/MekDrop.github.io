/**
 * Transfers the raised crossing's existing sandstone commands to its owner.
 * The lower path and stair approaches remain ordinary terrain.
 */
export class OverpassDefinitions {
  /**
   * @param {import("../../GameContracts.js").GameMapData} map
   */
  static populate(map) {
    for (const definition of map.objects ?? []) {
      if (definition.object !== "Overpass") {
        continue;
      }
      const layout = definition.layout;
      const crossing = layout.crossing;
      const minimumX = crossing.col - 0.5 - (map.cols - 1) / 2;
      const minimumZ = crossing.row - 0.5 - (map.rows - 1) / 2;
      const thickness = layout.deckThickness ?? 0.24;
      const commands = [];
      map.renderCommands = (map.renderCommands ?? []).filter(/**
       * @param {import("../ObjectTypes.js").RenderCommand} command
       */
        (command) => {
          if (command.method === "addOverpass" && command.args[0].id === layout.id) {
            definition.railingMaterial = command.args[1];

            return false;
          }
          if (command.method !== "addBoxMatrix") {
            return true;
          }
          const [, , x, y, z, , width, height, depth] = command.args;
          const deck = Math.abs(y - (layout.deckElevation - thickness / 2)) < 0.0001 &&
            Math.abs(height - thickness) < 0.0001 &&
            x - width / 2 >= minimumX - 0.0001 &&
            x + width / 2 <= minimumX + crossing.width + 0.0001 &&
            z - depth / 2 >= minimumZ - 0.0001 &&
            z + depth / 2 <= minimumZ + (crossing.depth ?? 2) + 0.0001;
          if (deck) {
            commands.push(command);
          }
          return !deck;
        });
      if (commands.length) {
        definition.deckCommands = commands;
      }
    }
  }
}
