import {
  CASTLE_GATE_ARCH_SPRING_BLOCKS,
  CASTLE_GATE_OPENING_HEIGHT_BLOCKS,
  CASTLE_GATE_PYLON_SPAN_BLOCKS,
  CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS,
} from "./CastleGenerationConfig.js";

/**
 *
 * @param {import("src/game/GameContracts.js").CastleOpening} opening
 * @param {number} horizontalBlock
 */
export const castleGateArchHeight = (opening, horizontalBlock) => {
  const width = opening.end - opening.start;
  const localBlock = horizontalBlock - opening.start;
  const distanceFromEdge = Math.min(localBlock, width - 1 - localBlock);
  const halfWidth = width / 2;
  const normalizedRadius = Math.min(
    1,
    distanceFromEdge / Math.max(1, halfWidth - 1),
  );
  return Math.min(
    CASTLE_GATE_OPENING_HEIGHT_BLOCKS,
    Math.floor(
      CASTLE_GATE_ARCH_SPRING_BLOCKS +
        (CASTLE_GATE_OPENING_HEIGHT_BLOCKS - CASTLE_GATE_ARCH_SPRING_BLOCKS) *
          Math.sqrt(1 - (1 - normalizedRadius) ** 2),
    ),
  );
};

/**
 *
 * @param {{blockU: number, blockY: number, blockV: number, opening: import("src/game/GameContracts.js").CastleOpening, gatehouseDepth: number, wallHeight: number}} options
 * @param {number} options.blockU
 * @param {number} options.blockY
 * @param {number} options.blockV
 * @param {import("src/game/GameContracts.js").CastleOpening} options.opening
 * @param {number} options.gatehouseDepth
 * @param {number} options.wallHeight
 */
export const isCastleUpperFloorRoomVoid = ({
  blockU,
  blockY,
  blockV,
  opening,
  gatehouseDepth,
  wallHeight,
}) => {
  const roomStartV = opening.start - CASTLE_GATE_PYLON_SPAN_BLOCKS + 1;
  const roomEndV = opening.end + CASTLE_GATE_PYLON_SPAN_BLOCKS - 1;
  const roomBaseY = wallHeight + 1;

  return (
    blockU >= 1 &&
    blockU < gatehouseDepth - 1 &&
    blockV >= roomStartV &&
    blockV < roomEndV &&
    blockY >= roomBaseY &&
    blockY < roomBaseY + CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS
  );
};
