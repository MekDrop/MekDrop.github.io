export class RiverStonePlacementPlan {
  #modelHeights;

  constructor(modelHeights) {
    this.#modelHeights = modelHeights;
  }

  create(rivers, cols, rows) {
    const placements = [];
    for (const [riverIndex, river] of rivers.entries()) {
      const blockedCells = new Set([
        `${river.cells[0].col},${river.cells[0].row}`,
        `${river.waterfall.col},${river.waterfall.row}`,
        ...river.cascades.flatMap((cascade) => [
          `${cascade.from.col},${cascade.from.row}`,
          `${cascade.to.col},${cascade.to.row}`,
        ]),
      ]);
      let stonesPlaced = 0;
      for (const cell of river.cells) {
        if (
          cell.underBridge ||
          blockedCells.has(`${cell.col},${cell.row}`) ||
          stonesPlaced >= 3
        ) {
          continue;
        }

        const seed = cell.col * 73 + cell.row * 131 + riverIndex * 977 + 41;
        if (this.#noise(seed) > 0.24) {
          continue;
        }

        const modelIndex = Math.floor(
          this.#noise(seed + 89) * this.#modelHeights.length,
        );
        const scale = 0.38 + this.#noise(seed + 43) * 0.9;
        const horizontalStretch = 0.74 + this.#noise(seed + 59) * 0.52;
        const footprintScale =
          scale * Math.max(horizontalStretch, 1 / horizontalStretch);
        const offsetRange = Math.max(0.04, 0.36 - footprintScale * 0.2);
        const offsetX = (this.#noise(seed + 17) - 0.5) * 2 * offsetRange;
        const offsetZ = (this.#noise(seed + 29) - 0.5) * 2 * offsetRange;
        const burialDepth = 0.01 + this.#noise(seed + 101) * 0.14;
        const rockHeight = 0.38 + this.#noise(seed + 113) * 0.44;
        const verticalScale = rockHeight / this.#modelHeights[modelIndex];
        const x = cell.col - (cols - 1) / 2 + offsetX;
        const z = cell.row - (rows - 1) / 2 + offsetZ;
        placements.push({
          cell: { col: cell.col, row: cell.row },
          modelIndex,
          position: [x, cell.bedElevation - burialDepth, z],
          rotationY: this.#noise(seed + 71) * 360,
          scale: [
            scale * horizontalStretch,
            verticalScale,
            scale / horizontalStretch,
          ],
          contact: cell.bedElevation - burialDepth + rockHeight >
            cell.elevation - 0.025
            ? {
                x,
                elevation: cell.elevation,
                z,
                radius: Math.min(0.28, footprintScale * 0.19),
                direction: cell.direction,
              }
            : null,
        });
        stonesPlaced++;
      }
    }
    return placements;
  }

  #noise(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }
}
