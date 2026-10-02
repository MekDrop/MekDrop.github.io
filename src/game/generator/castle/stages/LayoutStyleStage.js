import { GenerationRandom } from "../../map/GenerationRandom.js";
import { CASTLE_BOUNDARY } from "../../../enum/CastleBoundary.js";
import { CastlePlacementError } from "../../../errors/castle/index.js";
import {
  CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
  CASTLE_BLOCKS_PER_TILE,
  CASTLE_DOOR_WIDTH_TILES,
  CASTLE_GATE_PYLON_SPAN_BLOCKS,
  CASTLE_STYLES,
  CASTLE_TOWER_SPAN_BLOCKS,
} from "../CastleGenerationConfig.js";
import { AbstractCastleGenerationStage } from "../AbstractCastleGenerationStage.js";

/**
 * @typedef {{boundary: string, start: number, end: number}} CastleOpening
 */

export class LayoutStyleStage extends AbstractCastleGenerationStage {
  /**
   *
   * @param {CastleGenerationContext} context
   */
  async run(context) {
    const { position, doors, style: preferredStyleId, seed } = context.input;
    if (!position || !doors.length) {
      context.layout.empty = true;
      return;
    }

    const widthBlocks = position.width * CASTLE_BLOCKS_PER_TILE;
    const depthBlocks = position.depth * CASTLE_BLOCKS_PER_TILE;
    const primarySide = doors[0].side;
    const inwardCapacity = ["WEST", "EAST"].includes(primarySide)
      ? widthBlocks
      : depthBlocks;
    const facadeSpan = ["WEST", "EAST"].includes(primarySide)
      ? depthBlocks
      : widthBlocks;
    const openings = doors.map(/**
     *
     * @param {{side: string, offset: number, width: number, cells?: import("src/game/GameContracts.js").GridPoint[]}} door
     */
    (door) => {
      const boundary = this.#localBoundary(primarySide, door.side);
      const start = door.offset * CASTLE_BLOCKS_PER_TILE;
      const end = (door.offset + door.width) * CASTLE_BLOCKS_PER_TILE;
      const reverse =
        (primarySide === "EAST" &&
          [CASTLE_BOUNDARY.LEFT, CASTLE_BOUNDARY.RIGHT].includes(boundary)) ||
        (primarySide === "SOUTH" &&
          [CASTLE_BOUNDARY.LEFT, CASTLE_BOUNDARY.RIGHT].includes(boundary));
      const axisLength = ["WEST", "EAST"].includes(door.side)
        ? depthBlocks
        : widthBlocks;
      return {
        boundary,
        start: reverse ? axisLength - end : start,
        end: reverse ? axisLength - start : end,
      };
    });
    const style = this.#selectStyle({
      preferredStyleId,
      seed,
      openings,
      facadeSpan,
      inwardCapacity,
    });
    Object.assign(context.layout, {
      empty: false,
      widthBlocks,
      depthBlocks,
      worldLeft: position.x,
      worldTop: position.z,
      baseY: Math.max(0, position.elevation ?? 3),
      primarySide,
      inwardCapacity,
      facadeSpan,
      openings,
      style,
      castleDepth: inwardCapacity,
    });
  }

  /**
   *
   * @param {string} primarySide
   * @param {string} side
   */
  #localBoundary(primarySide, side) {
    const boundaries = {
      WEST: {
        WEST: CASTLE_BOUNDARY.FRONT,
        EAST: CASTLE_BOUNDARY.BACK,
        NORTH: CASTLE_BOUNDARY.LEFT,
        SOUTH: CASTLE_BOUNDARY.RIGHT,
      },
      EAST: {
        EAST: CASTLE_BOUNDARY.FRONT,
        WEST: CASTLE_BOUNDARY.BACK,
        NORTH: CASTLE_BOUNDARY.LEFT,
        SOUTH: CASTLE_BOUNDARY.RIGHT,
      },
      NORTH: {
        NORTH: CASTLE_BOUNDARY.FRONT,
        SOUTH: CASTLE_BOUNDARY.BACK,
        WEST: CASTLE_BOUNDARY.LEFT,
        EAST: CASTLE_BOUNDARY.RIGHT,
      },
      SOUTH: {
        SOUTH: CASTLE_BOUNDARY.FRONT,
        NORTH: CASTLE_BOUNDARY.BACK,
        WEST: CASTLE_BOUNDARY.LEFT,
        EAST: CASTLE_BOUNDARY.RIGHT,
      },
    };
    return boundaries[primarySide]?.[side] ?? CASTLE_BOUNDARY.FRONT;
  }

  /**
   *
   * @param {{preferredStyleId: string, openings: CastleOpening[], facadeSpan: number, inwardCapacity: number}} options
   * @param {string|number} [options.seed]
   * @param {string} options.preferredStyleId
   * @param {CastleOpening[]} options.openings
   * @param {number} options.facadeSpan
   * @param {number} options.inwardCapacity
   */
  #selectStyle({
    preferredStyleId,
    seed,
    openings,
    facadeSpan,
    inwardCapacity,
  }) {
    const preferredStyle = CASTLE_STYLES.find(
      /**
       *
       * @param {{id: string}} candidate
       */
      (candidate) => candidate.id === preferredStyleId,
    );
    const styles = preferredStyle
      ? [
          preferredStyle,
          ...CASTLE_STYLES.filter(/**
           *
           * @param {{id: string}} candidate
           */
          (candidate) => candidate !== preferredStyle),
        ]
      : seed === undefined ? CASTLE_STYLES : new GenerationRandom(`castle:${seed}:style`).shuffle([...CASTLE_STYLES]);
    const style = styles.find(/**
     *
     * @param {{id: string}} candidate
     */
    (candidate) =>
      this.#styleFits(candidate, openings, facadeSpan, inwardCapacity),
    );
    if (!style) {
      throw new CastlePlacementError();
    }
    return style;
  }

  /**
   *
   * @param {{id: string, towerSpanBlocks?: number, visualDepthBlocks?: number}} style
   * @param {CastleOpening[]} openings
   * @param {number} facadeSpan
   * @param {number} inwardCapacity
   */
  #styleFits(style, openings, facadeSpan, inwardCapacity) {
    const towerSpan = style.towerSpanBlocks ?? CASTLE_TOWER_SPAN_BLOCKS;
    const requiredDepth = Math.max(
      style.visualDepthBlocks ?? CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
      CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
    );
    const castleDepth = Math.min(requiredDepth, inwardCapacity);
    if (
      towerSpan > inwardCapacity ||
      towerSpan > facadeSpan ||
      requiredDepth > inwardCapacity
    ) {
      return false;
    }

    const requiredDoorWidth = CASTLE_DOOR_WIDTH_TILES * CASTLE_BLOCKS_PER_TILE;
    return openings.every(/**
     *
     * @param {import("src/game/GameContracts.js").CastleOpening} opening
     */
    (opening) => {
      if (opening.end - opening.start !== requiredDoorWidth) {
        return false;
      }
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (
        opening.start < CASTLE_GATE_PYLON_SPAN_BLOCKS ||
        opening.end > horizontalLimit - CASTLE_GATE_PYLON_SPAN_BLOCKS
      ) {
        return false;
      }

      const towerRanges = [];
      for (const placement of style.towerPlacements ?? []) {
        const boundaryRanges = {
          FRONT_LEFT: {
            [CASTLE_BOUNDARY.FRONT]: [0, towerSpan],
            [CASTLE_BOUNDARY.LEFT]: [0, towerSpan],
          },
          FRONT_RIGHT: {
            [CASTLE_BOUNDARY.FRONT]: [facadeSpan - towerSpan, facadeSpan],
            [CASTLE_BOUNDARY.RIGHT]: [0, towerSpan],
          },
          BACK_LEFT: {
            [CASTLE_BOUNDARY.BACK]: [0, towerSpan],
            [CASTLE_BOUNDARY.LEFT]: [castleDepth - towerSpan, castleDepth],
          },
          BACK_RIGHT: {
            [CASTLE_BOUNDARY.BACK]: [facadeSpan - towerSpan, facadeSpan],
            [CASTLE_BOUNDARY.RIGHT]: [castleDepth - towerSpan, castleDepth],
          },
        };
        const range = boundaryRanges[placement]?.[opening.boundary];
        if (range) {
          towerRanges.push(range);
        }
      }
      return towerRanges.every(
        /**
         *
         * @param {{"0": Array, "1": Array}} options
         * @param {Array} options."0"
         * @param {Array} options."1"
         */
        ([start, end]) => opening.end <= start || opening.start >= end,
      );
    });
  }
}
