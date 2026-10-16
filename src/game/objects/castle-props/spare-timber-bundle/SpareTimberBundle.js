import { arePositiveFiniteNumbers } from "../../../helpers/types.js";
import modelUrl from "../../../models/castle/props/spare-timber-bundle.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { GenerationRandom } from "../../../generator/map/GenerationRandom.js";

/**
 * Spare boards stored upright in a narrow stairwell gap.
 */
export class SpareTimberBundle extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }

  /**
   * Pack authored upright boards into a bottom-centered area for both meshes.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { width = 0.08, depth = 0.127, height = 0.72, timberSeed } = this.definition;
    const originals = model.find(SpareTimberBundle.#findEntity);
    const templates = originals.map(SpareTimberBundle.#mapEntity);
    for (const original of originals) {
      original.destroy();
    }
    const columns = Math.max(1, Math.floor(width / 0.08));
    const rows = Math.max(1, Math.ceil(depth / 0.046));
    if (templates.length && arePositiveFiniteNumbers(width, depth, height) && columns * rows <= 4096) {
      const random = new GenerationRandom(String(timberSeed ?? this.definition.id));
      const cellWidth = width / columns;
      const cellDepth = depth / rows;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const template = templates[random.rng(0, templates.length - 1)];
          const board = template.entity.clone();
          const boardHeight = height * random.rng(62, 100) / 100;
          const boardWidth = Math.min(0.08, cellWidth * 0.7) * random.rng(78, 100) / 100;
          const boardDepth = Math.min(0.035, cellDepth * 0.55) * random.rng(80, 100) / 100;
          board.name = `Spare timber board ${row}-${column}`;
          board.setLocalScale(boardWidth / 0.08, boardHeight / template.height, boardDepth / 0.035);
          // Each board has room to lean without intersecting its neighbours.
          board.setLocalEulerAngles(
            random.rng(-100, 100) / 100 * Math.min(4, cellDepth / boardHeight * 12),
            random.rng(-18, 18),
            random.rng(-100, 100) / 100 * Math.min(6, cellWidth / boardHeight * 12),
          );
          const matrix = board.getLocalTransform().data;
          const halfX = Math.abs(matrix[0]) * 0.04 + Math.abs(matrix[4]) * template.height / 2 + Math.abs(matrix[8]) * 0.0175;
          const halfY = Math.abs(matrix[1]) * 0.04 + Math.abs(matrix[5]) * template.height / 2 + Math.abs(matrix[9]) * 0.0175;
          const halfZ = Math.abs(matrix[2]) * 0.04 + Math.abs(matrix[6]) * template.height / 2 + Math.abs(matrix[10]) * 0.0175;
          const fit = Math.min(1, cellWidth * 0.48 / halfX, cellDepth * 0.48 / halfZ, height / (2 * halfY));
          board.setLocalScale(boardWidth / 0.08 * fit, boardHeight / template.height * fit, boardDepth / 0.035 * fit);
          board.setLocalPosition(
            (column - (columns - 1) / 2) * cellWidth + (cellWidth / 2 - halfX * fit) * random.rng(-80, 80) / 100,
            halfY * fit,
            (row - (rows - 1) / 2) * cellDepth + (cellDepth / 2 - halfZ * fit) * random.rng(-80, 80) / 100,
          );
          model.addChild(board);
        }
      }
    }
    for (const template of templates) {
      template.entity.destroy();
    }
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  static #findEntity(entity) {
    return entity.name.startsWith("Stored spare timber board");
  }

  /**
   * @param {import("playcanvas").Entity} entity
   */
  static #mapEntity(entity) {
    return {
      entity: entity.clone(),
      height: entity.getLocalPosition().y * 2,
    };
  }
}
