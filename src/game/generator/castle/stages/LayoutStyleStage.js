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

export class LayoutStyleStage extends AbstractCastleGenerationStage {
  async run(context) {
    const { position, doors, style: preferredStyleId } = context.input;
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
    const openings = doors.map((door) => {
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
      openings,
      facadeSpan,
      inwardCapacity,
    });
    const hasSecondarySide = openings.some(
      (opening) => opening.boundary !== CASTLE_BOUNDARY.FRONT,
    );
    const requiredDepth = Math.max(
      style.visualDepthBlocks ?? CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
      CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
    );

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
      castleDepth: hasSecondarySide
        ? inwardCapacity
        : Math.min(requiredDepth, inwardCapacity),
    });
  }

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

  #selectStyle({
    preferredStyleId,
    openings,
    facadeSpan,
    inwardCapacity,
  }) {
    const preferredStyle = CASTLE_STYLES.find(
      (candidate) => candidate.id === preferredStyleId,
    );
    const styles = preferredStyle
      ? [
          preferredStyle,
          ...CASTLE_STYLES.filter((candidate) => candidate !== preferredStyle),
        ]
      : CASTLE_STYLES;
    const style = styles.find((candidate) =>
      this.#styleFits(candidate, openings, facadeSpan, inwardCapacity),
    );
    if (!style) {
      throw new CastlePlacementError();
    }
    return style;
  }

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
    return openings.every((opening) => {
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
        ([start, end]) => opening.end <= start || opening.start >= end,
      );
    });
  }
}
