import { CASTLE_BOUNDARY } from "../enum/CastleBoundary.js";
import {
  CASTLE_BLOCK_SIZE,
  CASTLE_GATE_ARCH_TILE_CENTER_DEPTH_BLOCKS,
  CASTLE_GATE_ARCH_TILE_DEPTH_BLOCKS,
  CASTLE_GATE_CROWN_HEIGHT_BLOCKS,
  CASTLE_GATE_OPENING_HEIGHT_BLOCKS,
  CASTLE_GATE_PYLON_SPAN_BLOCKS,
  CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS,
  CASTLE_WALL_HEIGHT_BLOCKS,
  CASTLE_WALL_THICKNESS_BLOCKS,
} from "./CastleGenerationConfig.js";
import { castleGateArchHeight } from "./CastleGeometry.js";

export class CastleGeometryPlanner {
  async buildWalls(context, writer) {
    const wall = context.structure.wall;
    if (!wall) {
      return;
    }
    const addBlock = writer.addBlock.bind(writer);
    const openingAt = writer.openingAt.bind(writer);
    this.#buildCastleWallShell(
      addBlock,
      openingAt,
      wall.castleDepth,
      wall.facadeSpan,
      wall.towerSpan,
      wall.wallHeight,
      wall.battlementPeriod,
      wall.wallWings,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    if (context.structure.audienceWing) {
      this.#buildCastleAudienceWing(
        addBlock,
        context.structure.audienceWing.opening,
        wall.castleDepth,
        wall.facadeSpan,
        wall.wallHeight,
        wall.battlementPeriod,
        openingAt,
      );
    }
}
  async buildTowers(context, writer) {
    const { battlementPeriod } = context.structure.wall;
    for (const tower of context.structure.towers) {
      this.#buildCastleTower(
        writer.addBlock.bind(writer),
        tower.u,
        tower.v,
        tower.span,
        tower.span,
        0,
        tower.height,
        battlementPeriod,
      );
      const centerU = tower.u + (tower.span - 1) / 2;
      const centerV = tower.v + (tower.span - 1) / 2;
      if (tower.front) {
        for (const ledgeHeight of [2, tower.height - 5]) {
          writer.addLocalBox(
            -0.58,
            ledgeHeight,
            centerV,
            0.32,
            0.62,
            tower.span + 0.7,
            "trim",
          );
        }
        writer.addBanner(-0.76, tower.height - 8, centerV, 2.5, 4.5);
      }
      const fireTurret = writer.addRoofFireTurret(
        centerU,
        centerV,
        tower.height,
      );
      writer.addFlame(
        fireTurret.blockU,
        fireTurret.flameBlockY,
        fireTurret.blockV,
        1.05,
      );
      await context.scheduler.yieldIfNeeded(context.yieldState);
    }
  }

  async buildGatehouses(context, writer) {
    const { castleDepth, facadeSpan, style } = context.layout;
    const { towerSpan, battlementPeriod } = context.structure.wall;
    for (const gatehouse of context.structure.gatehouses) {
      this.#buildCastleGatehouse(
        writer.addBlock.bind(writer),
        writer.addLocalBox.bind(writer),
        writer.addFlame.bind(writer),
        writer.addBanner.bind(writer),
        writer.addFlag.bind(writer),
        writer.addRoof.bind(writer),
        gatehouse.opening,
        castleDepth,
        facadeSpan,
        towerSpan,
        style.towerHeightBlocks,
        battlementPeriod,
        gatehouse.primary ? style : null,
      );
      await context.scheduler.yieldIfNeeded(context.yieldState);
    }
  }

  #buildCastleWallShell(
    addBlock,
    openingAt,
    castleDepth,
    facadeSpan,
    towerSpan,
    wallHeight,
    battlementPeriod,
    wallWings = [],
  ) {
    const wallDepth = Math.min(castleDepth, towerSpan);
    const hasLeftWing = wallWings.includes(CASTLE_BOUNDARY.LEFT);
    const hasRightWing = wallWings.includes(CASTLE_BOUNDARY.RIGHT);
    // The audience room reaches both side walls, so the front face must start
    // at the same block to avoid a recessed corner seam.
    const facadeInset = 0;
    for (let blockU = 0; blockU < castleDepth; blockU += 1) {
      for (let blockV = 0; blockV < facadeSpan; blockV += 1) {
        for (let blockY = 0; blockY < wallHeight; blockY += 1) {
          const role =
            blockY === 2 || blockY === wallHeight - 3 ? "trim" : "stone";
          const crossesLeftGate =
            blockV < CASTLE_WALL_THICKNESS_BLOCKS &&
            openingAt(CASTLE_BOUNDARY.LEFT, blockU, blockY);
          const crossesRightGate =
            blockV >= facadeSpan - CASTLE_WALL_THICKNESS_BLOCKS &&
            openingAt(CASTLE_BOUNDARY.RIGHT, blockU, blockY);
          if (
            blockU >= facadeInset &&
            blockU < wallDepth &&
            !openingAt(CASTLE_BOUNDARY.FRONT, blockV, blockY) &&
            !crossesLeftGate &&
            !crossesRightGate
          ) {
            addBlock(blockU, blockY, blockV, role);
          }
          if (
            hasLeftWing &&
            blockU < castleDepth &&
            blockV < towerSpan &&
            !openingAt(CASTLE_BOUNDARY.LEFT, blockU, blockY)
          ) {
            addBlock(blockU, blockY, blockV, role);
          }
          if (
            hasRightWing &&
            blockU < castleDepth &&
            blockV >= facadeSpan - towerSpan &&
            !openingAt(CASTLE_BOUNDARY.RIGHT, blockU, blockY)
          ) {
            addBlock(blockU, blockY, blockV, role);
          }
        }

        const isEdge =
          (blockU >= facadeInset &&
            blockU < facadeInset + CASTLE_WALL_THICKNESS_BLOCKS) ||
          (blockU >= wallDepth - CASTLE_WALL_THICKNESS_BLOCKS &&
            blockU < wallDepth) ||
          (hasLeftWing &&
            (blockV < CASTLE_WALL_THICKNESS_BLOCKS ||
              (blockV >= towerSpan - CASTLE_WALL_THICKNESS_BLOCKS &&
                blockV < towerSpan))) ||
          (hasRightWing &&
            (blockV >= facadeSpan - CASTLE_WALL_THICKNESS_BLOCKS ||
              (blockV >= facadeSpan - towerSpan &&
                blockV <
                  facadeSpan - towerSpan + CASTLE_WALL_THICKNESS_BLOCKS)));
        if (isEdge && (blockU + blockV) % battlementPeriod === 0) {
          addBlock(blockU, wallHeight, blockV, "trim");
        }
      }
    }
  }

  #buildCastleAudienceWing(
    addBlock,
    opening,
    castleDepth,
    facadeSpan,
    wallHeight,
    battlementPeriod,
    openingAt,
  ) {
    const roomCenter = (opening.start + opening.end) / 2;
    const roomStart = 0;
    const roomEnd = facadeSpan;
    const sideWalls = [
      [roomStart, CASTLE_BOUNDARY.LEFT],
      [roomEnd - CASTLE_WALL_THICKNESS_BLOCKS, CASTLE_BOUNDARY.RIGHT],
    ];
    const openingCenter = roomCenter * CASTLE_BLOCK_SIZE;
    const interiorStart =
      (roomStart + CASTLE_WALL_THICKNESS_BLOCKS) * CASTLE_BLOCK_SIZE;
    const interiorEnd =
      (roomEnd - CASTLE_WALL_THICKNESS_BLOCKS) * CASTLE_BLOCK_SIZE;
    const interiorWidth =
      Math.min(openingCenter - interiorStart, interiorEnd - openingCenter) * 2;
    for (const [wallV, boundary] of sideWalls) {
      for (let blockU = 0; blockU < castleDepth; blockU += 1) {
        for (
          let offsetV = 0;
          offsetV < CASTLE_WALL_THICKNESS_BLOCKS;
          offsetV += 1
        ) {
          for (let blockY = 0; blockY < wallHeight; blockY += 1) {
            const role =
              blockY === 2 || blockY === wallHeight - 3 ? "trim" : "stone";
            if (!openingAt(boundary, blockU, blockY)) {
              addBlock(blockU, blockY, wallV + offsetV, role);
            }
          }
          if (blockU % battlementPeriod === 0) {
            addBlock(blockU, wallHeight, wallV + offsetV, "trim");
          }
        }
      }
    }

    for (
      let blockU = castleDepth - CASTLE_WALL_THICKNESS_BLOCKS;
      blockU < castleDepth;
      blockU += 1
    ) {
      for (let blockV = roomStart; blockV < roomEnd; blockV += 1) {
        for (let blockY = 0; blockY < wallHeight; blockY += 1) {
          const role =
            blockY === 2 || blockY === wallHeight - 3 ? "trim" : "stone";
          if (!openingAt(CASTLE_BOUNDARY.BACK, blockV, blockY)) {
            addBlock(blockU, blockY, blockV, role);
          }
        }
        if ((blockV - roomStart) % battlementPeriod === 0) {
          addBlock(blockU, wallHeight, blockV, "trim");
        }
      }
    }

    this.#buildCastleAudienceRoof(
      addBlock,
      roomStart,
      roomEnd,
      castleDepth,
      wallHeight,
      battlementPeriod,
    );
    return interiorWidth;
  }

  #buildCastleAudienceRoof(
    addBlock,
    roomStart,
    roomEnd,
    castleDepth,
    wallHeight,
    battlementPeriod,
  ) {
    for (let blockU = 0; blockU < castleDepth; blockU += 1) {
      for (let blockV = roomStart; blockV < roomEnd; blockV += 1) {
        const isEdge =
          blockU === 0 ||
          blockU === castleDepth - 1 ||
          blockV === roomStart ||
          blockV === roomEnd - 1;
        addBlock(blockU, wallHeight, blockV, isEdge ? "trim" : "stone");
        if (isEdge && (blockU + blockV) % battlementPeriod === 0) {
          addBlock(blockU, wallHeight + 1, blockV, "trim");
        }
      }
    }
  }

  #buildCastleTower(
    addBlock,
    startU,
    startV,
    spanU,
    spanV,
    baseBlockY,
    bodyHeight,
    battlementPeriod,
  ) {
    for (
      let blockY = baseBlockY;
      blockY < baseBlockY + bodyHeight;
      blockY += 1
    ) {
      const topInset =
        blockY >= baseBlockY + bodyHeight - 4 && spanU >= 7 && spanV >= 7
          ? 1
          : 0;
      for (let localU = topInset; localU < spanU - topInset; localU += 1) {
        for (let localV = topInset; localV < spanV - topInset; localV += 1) {
          const rearWindowCourse =
            blockY >= baseBlockY + 6 && blockY <= baseBlockY + 7;
          const rearWindowColumn = localV === Math.floor(spanV / 2);
          const rearWindowTunnel =
            rearWindowCourse && rearWindowColumn && localU >= spanU - 2;
          if (rearWindowTunnel) continue;
          const rearWindowInterior =
            rearWindowCourse && rearWindowColumn && localU === spanU - 3;
          const isShell =
            localU === topInset ||
            localU === spanU - 1 - topInset ||
            localV === topInset ||
            localV === spanV - 1 - topInset ||
            blockY === baseBlockY + bodyHeight - 1 ||
            rearWindowInterior;
          if (isShell) {
            const isTrimCourse =
              blockY === baseBlockY + 2 ||
              blockY === baseBlockY + bodyHeight - 5;
            addBlock(
              startU + localU,
              blockY,
              startV + localV,
              rearWindowInterior ? "iron" : isTrimCourse ? "trim" : "stone",
            );
          }
        }
      }
    }

    const crownInset = spanU >= 7 && spanV >= 7 ? 1 : 0;
    for (let localU = crownInset; localU < spanU - crownInset; localU += 1) {
      for (let localV = crownInset; localV < spanV - crownInset; localV += 1) {
        const isEdge =
          localU === crownInset ||
          localU === spanU - 1 - crownInset ||
          localV === crownInset ||
          localV === spanV - 1 - crownInset;
        if (isEdge && (localU + localV) % battlementPeriod === 0) {
          addBlock(
            startU + localU,
            baseBlockY + bodyHeight,
            startV + localV,
            "trim",
          );
        }
      }
    }
  }

  #buildCastleGatehouse(
    addBlock,
    addLocalBox,
    addFlame,
    addBanner,
    addFlag,
    addRoof,
    opening,
    castleDepth,
    facadeSpan,
    towerSpan,
    towerHeight,
    battlementPeriod,
    primaryStyle,
  ) {
    const pylonSpan = CASTLE_GATE_PYLON_SPAN_BLOCKS;
    const gatehouseDepth = Math.min(towerSpan, castleDepth);
    const gatehouseHeight = towerHeight;
    const gateFaceDepth = Math.min(1, gatehouseDepth - 1);
    const roofDoorWidth = 4;
    const roofDoorHeight = CASTLE_UPPER_FLOOR_ROOM_HEIGHT_BLOCKS;
    const roofDoorStart = Math.floor(
      (opening.start + opening.end - roofDoorWidth) / 2,
    );
    const roofDoorBase =
      (primaryStyle?.wallHeightBlocks ?? CASTLE_WALL_HEIGHT_BLOCKS) + 1;
    const isRoofDoorOpening = (depth, horizontal, blockY) =>
      Boolean(primaryStyle) &&
      depth >= gateFaceDepth &&
      depth < gatehouseDepth &&
      horizontal >= roofDoorStart &&
      horizontal < roofDoorStart + roofDoorWidth &&
      blockY >= roofDoorBase &&
      blockY < roofDoorBase + roofDoorHeight;
    const placeBoundaryBlock = (depth, horizontal, blockY, role) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addBlock(castleDepth - 1 - depth, blockY, horizontal, role);
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addBlock(horizontal, blockY, depth, role);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addBlock(horizontal, blockY, facadeSpan - 1 - depth, role);
      } else {
        addBlock(depth, blockY, horizontal, role);
      }
    };
    const placeBoundaryDecoration = (
      depth,
      horizontal,
      blockY,
      scaleDepth,
      scaleY,
      scaleHorizontal,
      role,
    ) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addLocalBox(
          castleDepth - 1 - depth,
          blockY,
          horizontal,
          scaleDepth,
          scaleY,
          scaleHorizontal,
          role,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addLocalBox(
          horizontal,
          blockY,
          depth,
          scaleHorizontal,
          scaleY,
          scaleDepth,
          role,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addLocalBox(
          horizontal,
          blockY,
          facadeSpan - 1 - depth,
          scaleHorizontal,
          scaleY,
          scaleDepth,
          role,
        );
      } else {
        addLocalBox(
          depth,
          blockY,
          horizontal,
          scaleDepth,
          scaleY,
          scaleHorizontal,
          role,
        );
      }
    };
    const placeBoundaryFlame = (depth, horizontal, blockY, scale = 1) => {
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (horizontal < 0 || horizontal >= horizontalLimit) {
        return;
      }
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addFlame(castleDepth - 1 - depth, blockY, horizontal, scale);
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addFlame(horizontal, blockY, depth, scale);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addFlame(horizontal, blockY, facadeSpan - 1 - depth, scale);
      } else {
        addFlame(depth, blockY, horizontal, scale);
      }
    };
    const placeBoundaryRoofFireTurret = (
      centerDepth,
      centerHorizontal,
      baseBlockY,
    ) => {
      const turretDepth = Math.round(centerDepth);
      const turretHorizontal = Math.round(centerHorizontal);
      const turretHeight = 3;
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (
        turretDepth - 1 < 0 ||
        turretDepth + 1 >= gatehouseDepth ||
        turretHorizontal - 1 < 0 ||
        turretHorizontal + 1 >= horizontalLimit
      ) {
        return;
      }

      for (
        let blockY = baseBlockY;
        blockY < baseBlockY + turretHeight;
        blockY += 1
      ) {
        for (let depthOffset = -1; depthOffset <= 1; depthOffset += 1) {
          for (
            let horizontalOffset = -1;
            horizontalOffset <= 1;
            horizontalOffset += 1
          ) {
            const topCourse = blockY === baseBlockY + turretHeight - 1;
            const edge =
              Math.abs(depthOffset) === 1 || Math.abs(horizontalOffset) === 1;
            placeBoundaryBlock(
              turretDepth + depthOffset,
              turretHorizontal + horizontalOffset,
              blockY,
              topCourse && edge ? "trim" : "stone",
            );
          }
        }
      }
      for (const [depthOffset, horizontalOffset] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [0, 0],
      ]) {
        placeBoundaryBlock(
          turretDepth + depthOffset,
          turretHorizontal + horizontalOffset,
          baseBlockY + turretHeight,
          "trim",
        );
      }
      placeBoundaryFlame(
        turretDepth,
        turretHorizontal,
        baseBlockY + turretHeight + 1,
        1.05,
      );
    };
    const placeBoundaryBanner = (depth, horizontal, blockY, width, height) => {
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (horizontal < 0 || horizontal >= horizontalLimit) {
        return;
      }
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addBanner(
          castleDepth - 1 - depth,
          blockY,
          horizontal,
          width,
          height,
          opening.boundary,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addBanner(horizontal, blockY, depth, width, height, opening.boundary);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addBanner(
          horizontal,
          blockY,
          facadeSpan - 1 - depth,
          width,
          height,
          opening.boundary,
        );
      } else {
        addBanner(depth, blockY, horizontal, width, height, opening.boundary);
      }
    };
    const placeBoundaryFlag = (
      depth,
      horizontal,
      blockY,
      roofCollider = null,
    ) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addFlag(
          castleDepth - 1 - depth,
          blockY,
          horizontal,
          opening.boundary,
          roofCollider,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addFlag(horizontal, blockY, depth, opening.boundary, roofCollider);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addFlag(
          horizontal,
          blockY,
          facadeSpan - 1 - depth,
          opening.boundary,
          roofCollider,
        );
      } else {
        addFlag(depth, blockY, horizontal, opening.boundary, roofCollider);
      }
    };
    const placeBoundaryRoof = (
      depth,
      horizontal,
      blockY,
      width,
      roofDepth,
      height,
    ) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addRoof(
          castleDepth - 1 - depth,
          blockY,
          horizontal,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addRoof(
          horizontal,
          blockY,
          depth,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addRoof(
          horizontal,
          blockY,
          facadeSpan - 1 - depth,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      } else {
        addRoof(
          depth,
          blockY,
          horizontal,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      }
    };
    // Complete the masonry above the doorway with normal castle tiles. Their
    // exterior faces stay flush with the facade, but their hidden depth is cut
    // in half so the curved door tips can sweep behind them without clipping.
    for (
      let horizontal = opening.start;
      horizontal < opening.end;
      horizontal += 1
    ) {
      const archHeight = castleGateArchHeight(opening, horizontal);
      for (
        let blockY = archHeight;
        blockY < CASTLE_GATE_OPENING_HEIGHT_BLOCKS;
        blockY += 1
      ) {
        placeBoundaryDecoration(
          CASTLE_GATE_ARCH_TILE_CENTER_DEPTH_BLOCKS,
          horizontal,
          blockY,
          CASTLE_GATE_ARCH_TILE_DEPTH_BLOCKS,
          1,
          1,
          "stone",
        );
      }
    }
    const pylonRanges = [
      [opening.start - pylonSpan, opening.start - 1],
      [opening.end, opening.end + pylonSpan - 1],
    ];

    for (const [rangeStart, rangeEnd] of pylonRanges) {
      for (
        let horizontal = rangeStart;
        horizontal <= rangeEnd;
        horizontal += 1
      ) {
        for (let depth = 0; depth < gatehouseDepth; depth += 1) {
          for (let blockY = 0; blockY < gatehouseHeight; blockY += 1) {
            const topInset = blockY >= gatehouseHeight - 3 ? 1 : 0;
            const horizontalLimit = [
              CASTLE_BOUNDARY.FRONT,
              CASTLE_BOUNDARY.BACK,
            ].includes(opening.boundary)
              ? facadeSpan
              : castleDepth;
            const withinSteppedCrown =
              horizontal >= rangeStart + topInset &&
              horizontal <= rangeEnd - topInset &&
              depth >= topInset &&
              depth < gatehouseDepth - topInset;
            if (
              horizontal >= 0 &&
              horizontal < horizontalLimit &&
              withinSteppedCrown
            ) {
              const framesGate =
                depth === 0 &&
                (horizontal === opening.start - 1 ||
                  horizontal === opening.end);
              const isTrimCourse =
                blockY === 2 ||
                blockY === gatehouseHeight - 4 ||
                (framesGate && blockY < CASTLE_GATE_OPENING_HEIGHT_BLOCKS + 4);
              placeBoundaryBlock(
                depth,
                horizontal,
                blockY,
                isTrimCourse ? "trim" : "stone",
              );
            }
          }
        }
      }
    }

    for (const [rangeStart, rangeEnd] of pylonRanges) {
      for (
        let horizontal = rangeStart + 1;
        horizontal <= rangeEnd - 1;
        horizontal += 1
      ) {
        if ((horizontal - rangeStart) % battlementPeriod === 0) {
          placeBoundaryBlock(1, horizontal, gatehouseHeight, "trim");
          placeBoundaryBlock(
            gatehouseDepth - 2,
            horizontal,
            gatehouseHeight,
            "trim",
          );
        }
      }
      for (let depth = 2; depth < gatehouseDepth - 2; depth += 1) {
        if (depth % battlementPeriod === 0) {
          placeBoundaryBlock(depth, rangeStart + 1, gatehouseHeight, "trim");
          placeBoundaryBlock(depth, rangeEnd - 1, gatehouseHeight, "trim");
        }
      }
    }

    for (const [rangeStart, rangeEnd] of pylonRanges) {
      const center = (rangeStart + rangeEnd) / 2;
      for (const ledgeHeight of [2, gatehouseHeight - 4]) {
        placeBoundaryDecoration(
          -0.58,
          center,
          ledgeHeight,
          0.32,
          0.62,
          pylonSpan + 0.7,
          "trim",
        );
      }
    }

    for (
      let horizontal = opening.start;
      horizontal < opening.end;
      horizontal += 1
    ) {
      for (let depth = 0; depth < CASTLE_WALL_THICKNESS_BLOCKS; depth += 1) {
        for (
          let blockY = CASTLE_GATE_OPENING_HEIGHT_BLOCKS;
          blockY < CASTLE_GATE_OPENING_HEIGHT_BLOCKS + 4;
          blockY += 1
        ) {
          placeBoundaryBlock(depth, horizontal, blockY, "accent");
          if (
            depth === 0 &&
            !isRoofDoorOpening(gatehouseDepth - 1, horizontal, blockY)
          ) {
            placeBoundaryBlock(
              gatehouseDepth - 1,
              horizontal,
              blockY,
              "accent",
            );
          }
        }
      }
    }

    for (
      let horizontal = opening.start;
      horizontal < opening.end;
      horizontal += 1
    ) {
      for (let depth = gateFaceDepth; depth < gatehouseDepth; depth += 1) {
        for (
          let blockY = CASTLE_GATE_OPENING_HEIGHT_BLOCKS;
          blockY < gatehouseHeight;
          blockY += 1
        ) {
          if (isRoofDoorOpening(depth, horizontal, blockY)) continue;
          placeBoundaryBlock(depth, horizontal, blockY);
        }
      }
    }

    const towerCenters = [
      opening.start - pylonSpan / 2,
      opening.end + pylonSpan / 2 - 1,
    ];
    for (const horizontal of towerCenters) {
      placeBoundaryBanner(-0.76, horizontal, gatehouseHeight - 7, 2.5, 4.5);
      if (!primaryStyle) {
        placeBoundaryRoofFireTurret(
          (gatehouseDepth - 1) / 2,
          horizontal,
          gatehouseHeight,
        );
      }
    }

    const torchHeight = Math.min(7, gatehouseHeight - 5);
    for (const horizontal of [opening.start - 2, opening.end + 1]) {
      if (horizontal < 0) continue;
      placeBoundaryDecoration(
        -0.55,
        horizontal,
        torchHeight - 0.5,
        0.45,
        0.5,
        0.45,
        "iron",
      );
      placeBoundaryFlame(-0.62, horizontal, torchHeight, 0.72);
    }

    const horizontalLimit = [
      CASTLE_BOUNDARY.FRONT,
      CASTLE_BOUNDARY.BACK,
    ].includes(opening.boundary)
      ? facadeSpan
      : castleDepth;

    if (!primaryStyle) {
      return;
    }

    const crownShoulder = primaryStyle.gateShoulderSpanBlocks ?? 3;
    const crownHeight = Math.max(
      gatehouseHeight + 2,
      primaryStyle.gateCrownHeightBlocks ?? CASTLE_GATE_CROWN_HEIGHT_BLOCKS,
    );
    const crownBase = CASTLE_GATE_OPENING_HEIGHT_BLOCKS + 4;
    const crownDepth = Math.min(gatehouseDepth, castleDepth);
    const crownStart = Math.max(0, opening.start - crownShoulder);
    const crownEnd = Math.min(
      horizontalLimit - 1,
      opening.end + crownShoulder - 1,
    );

    for (let blockY = crownBase; blockY < crownHeight; blockY += 1) {
      const topInset = blockY >= crownHeight - 3 ? 1 : 0;
      for (
        let horizontal = crownStart + topInset;
        horizontal <= crownEnd - topInset;
        horizontal += 1
      ) {
        for (let depth = 0; depth < crownDepth; depth += 1) {
          const isShell =
            horizontal === crownStart + topInset ||
            horizontal === crownEnd - topInset ||
            depth === 0 ||
            depth === crownDepth - 1 ||
            blockY === crownBase ||
            blockY === crownHeight - 1;
          if (isShell && !isRoofDoorOpening(depth, horizontal, blockY)) {
            const isCrownEdge =
              horizontal === crownStart + topInset ||
              horizontal === crownEnd - topInset ||
              depth === 0 ||
              depth === crownDepth - 1;
            const isTrimCourse =
              blockY === crownBase ||
              (blockY === crownHeight - 1 && isCrownEdge);
            placeBoundaryBlock(
              depth,
              horizontal,
              blockY,
              isTrimCourse ? "trim" : "stone",
            );
          }
        }
      }
    }

    const crownCenter = Math.round((crownStart + crownEnd) / 2);
    const roofRadius = Math.min(
      2,
      Math.floor((crownDepth - 1) / 2),
      Math.floor((crownEnd - crownStart) / 2),
    );
    const roofDepthCenter = Math.max(
      roofRadius,
      Math.min(crownDepth - 1 - roofRadius, Math.round((crownDepth - 1) / 2)),
    );
    const roofHorizontalCenter = Math.max(
      crownStart + roofRadius,
      Math.min(crownEnd - roofRadius, crownCenter),
    );
    const roofTowerHeight = 5;
    const roofDepthStart = roofDepthCenter - roofRadius;
    const roofDepthEnd = roofDepthCenter + roofRadius;
    const roofHorizontalStart = roofHorizontalCenter - roofRadius;
    const roofHorizontalEnd = roofHorizontalCenter + roofRadius;
    for (
      let blockY = crownHeight;
      blockY < crownHeight + roofTowerHeight;
      blockY += 1
    ) {
      for (let depth = roofDepthStart; depth <= roofDepthEnd; depth += 1) {
        for (
          let horizontal = roofHorizontalStart;
          horizontal <= roofHorizontalEnd;
          horizontal += 1
        ) {
          const windowCourse =
            blockY >= crownHeight + 2 && blockY <= crownHeight + 3;
          const frontWindowTunnel =
            horizontal === roofHorizontalCenter && depth <= roofDepthStart + 1;
          const backWindowTunnel =
            horizontal === roofHorizontalCenter && depth >= roofDepthEnd - 1;
          const leftWindowTunnel =
            depth === roofDepthCenter && horizontal <= roofHorizontalStart + 1;
          const rightWindowTunnel =
            depth === roofDepthCenter && horizontal >= roofHorizontalEnd - 1;
          if (
            windowCourse &&
            (frontWindowTunnel ||
              backWindowTunnel ||
              leftWindowTunnel ||
              rightWindowTunnel)
          ) {
            continue;
          }
          const topCourse = blockY === crownHeight + roofTowerHeight - 1;
          const edge =
            depth === roofDepthStart ||
            depth === roofDepthEnd ||
            horizontal === roofHorizontalStart ||
            horizontal === roofHorizontalEnd;
          const windowInterior =
            windowCourse &&
            depth === roofDepthCenter &&
            horizontal === roofHorizontalCenter;
          placeBoundaryBlock(
            depth,
            horizontal,
            blockY,
            windowInterior ? "iron" : topCourse && edge ? "trim" : "stone",
          );
        }
      }
    }
    const roofSpan = roofRadius * 2 + 1;
    const roofHeight = Math.max(2.5, roofSpan * 0.68);
    const roofBaseBlockY = crownHeight + roofTowerHeight;
    placeBoundaryRoof(
      roofDepthCenter,
      roofHorizontalCenter,
      roofBaseBlockY,
      roofSpan + 0.6,
      roofSpan + 0.6,
      roofHeight,
    );

    for (
      let horizontal = crownStart + 1;
      horizontal < crownEnd;
      horizontal += 1
    ) {
      if ((horizontal - crownStart) % battlementPeriod === 0) {
        placeBoundaryBlock(0, horizontal, crownHeight, "trim");
        placeBoundaryBlock(crownDepth - 1, horizontal, crownHeight, "trim");
      }
    }
    for (let depth = 1; depth < crownDepth - 1; depth += 1) {
      if (depth % battlementPeriod === 0) {
        placeBoundaryBlock(depth, crownStart + 1, crownHeight, "trim");
        placeBoundaryBlock(depth, crownEnd - 1, crownHeight, "trim");
      }
    }

    placeBoundaryFlag(
      roofDepthCenter,
      roofHorizontalCenter,
      roofBaseBlockY + roofHeight - 1,
      {
        baseY: -(roofHeight - 1) * CASTLE_BLOCK_SIZE,
        halfWidth: ((roofSpan + 0.6) * CASTLE_BLOCK_SIZE) / 2,
        halfDepth: ((roofSpan + 0.6) * CASTLE_BLOCK_SIZE) / 2,
        height: roofHeight * CASTLE_BLOCK_SIZE,
      },
    );
  }
}
