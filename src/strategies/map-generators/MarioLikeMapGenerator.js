export class MarioLikeMapGenerator {
  constructor(config) {
    this.config = config;
  }

  generate(nextWidth, nextHeight, seed) {
    const state = this.#createGenerationState(nextWidth, nextHeight, seed);

    this.#pushSolid(state, {
      x: 0,
      y: 0,
      w: state.width,
      h: state.floorHeight,
      kind: "wall",
    });
    this.#buildMainPlatformPath(state);
    this.#buildUpperPlatformRows(state);
    this.#buildGoalStairs(state);
    this.#buildVerticalSupportWalls(state);
    this.#spawnGroundEnemies(state);

    const solids = this.#finalizeSolids(state);
    const enemySpawns = this.#finalizeEnemies(state, solids);
    const coins = this.#finalizeCoins(state, solids, enemySpawns);

    return {
      width: state.width,
      height: state.height,
      seed: state.seed,
      floorHeight: state.floorHeight,
      solids,
      enemySpawns,
      coins,
      spawn: state.spawn,
      goal: state.goal,
    };
  }

  #createGenerationState(nextWidth, nextHeight, seed) {
    const width = Math.max(this.config.MIN_WORLD_WIDTH, Math.floor(nextWidth));
    const height = Math.max(this.config.MIN_WORLD_HEIGHT, Math.floor(nextHeight));
    const rng = this.config.createRng(seed);
    const floorMin = Math.ceil(6 / this.config.PLATFORM_GRID) * this.config.PLATFORM_GRID;
    const floorMaxRaw = Math.max(6, Math.floor(height * 0.22));
    const floorMax = Math.max(floorMin, Math.floor(floorMaxRaw / this.config.PLATFORM_GRID) * this.config.PLATFORM_GRID);
    const floorHeight = this.config.clamp(
      this.config.snapToPlatformGrid(Math.round(height * 0.15)),
      floorMin,
      floorMax,
    );
    const spawn = {
      x: this.config.clamp(Math.round(width * 0.08), 6, Math.max(6, Math.floor(width * 0.16))),
      y: floorHeight,
    };
    const mapRightMargin = this.config.clamp(Math.round(width * 0.05), 4, 12);
    const safeLeft = Math.min(width - 20, spawn.x + 10);
    const goal = {
      x: this.config.clamp(
        this.config.randomInt(rng, Math.floor(width * 0.68), Math.floor(width * 0.9)),
        safeLeft + 24,
        width - mapRightMargin - 2,
      ),
      y: floorHeight,
      h: this.config.clamp(Math.round(height * 0.18), 11, 16),
    };
    const safeRight = Math.max(safeLeft + 16, goal.x - 14);
    const platformFillStart = this.config.PLATFORM_GRID;
    const stairCount = this.config.clamp(Math.floor(width / 56), 2, 5);
    const stepWidth = this.config.clamp(Math.floor(width * 0.05), 6, 8);
    const stairStart = goal.x - 10 - stairCount * stepWidth;
    const stairEnd = goal.x + stepWidth;
    const flyingPlatformHeight = 4;
    const minWalkUnderClearance = this.config.PLAYER.height + 1;
    const minFlyingPlatformWidth = Math.ceil(this.config.PLAYER.width * 2);
    const minHorizontalPlatformGap = Math.ceil(this.config.PLAYER.width * 1.5);
    const jumpGravity = Math.min(
      Math.abs(this.config.PLAYER.gravity),
      Math.abs(this.config.PLAYER.jumpGravityHeld ?? this.config.PLAYER.gravity),
    );
    const maxJumpRise = (this.config.PLAYER.jumpVelocity * this.config.PLAYER.jumpVelocity) / (2 * Math.max(1, jumpGravity));
    const minRowStep = Math.ceil((flyingPlatformHeight + minWalkUnderClearance) / this.config.PLATFORM_GRID) * this.config.PLATFORM_GRID;
    const maxRowStep = Math.max(
      minRowStep,
      Math.floor(Math.max(minRowStep, maxJumpRise - 2) / this.config.PLATFORM_GRID) * this.config.PLATFORM_GRID,
    );
    const flyingBandBottom = this.config.clamp(
      this.config.snapToPlatformGrid(floorHeight + this.config.PLAYER.height + 2),
      floorHeight + this.config.PLATFORM_GRID,
      Math.max(floorHeight + this.config.PLATFORM_GRID, height - flyingPlatformHeight - 10),
    );
    const flyingBandTop = this.config.clamp(
      this.config.snapToPlatformGrid(height - flyingPlatformHeight - 10),
      flyingBandBottom,
      height - flyingPlatformHeight - 6,
    );
    const targetRowStep = this.config.clamp(
      this.config.snapToPlatformGrid(Math.round((minRowStep + maxRowStep) * 0.5)),
      minRowStep,
      maxRowStep,
    );
    const verticalSpan = Math.max(0, flyingBandTop - flyingBandBottom);
    const rowCount = Math.max(
      1,
      Math.min(4, Math.floor(verticalSpan / Math.max(this.config.PLATFORM_GRID, targetRowStep)) + 1),
    );
    const flyingRowStep = rowCount > 1
      ? Math.max(
        minRowStep,
        Math.min(
          maxRowStep,
          Math.floor(verticalSpan / (rowCount - 1) / this.config.PLATFORM_GRID) * this.config.PLATFORM_GRID,
        ),
      )
      : minRowStep;
    const flyingRows = [];
    for (let y = flyingBandBottom; y <= flyingBandTop; y += flyingRowStep) {
      flyingRows.push(y);
    }
    if (flyingRows.length === 1 && verticalSpan >= minRowStep) {
      flyingRows.push(Math.min(flyingBandTop, flyingBandBottom + minRowStep));
    }
    const grid = this.config.PLATFORM_GRID;
    const gridCols = Math.max(1, Math.ceil(width / grid));
    const gridRows = Math.max(1, Math.ceil(height / grid));
    const occupancy = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));

    return {
      width,
      height,
      seed,
      rng,
      floorHeight,
      spawn,
      goal,
      safeLeft,
      safeRight,
      platformFillStart,
      stairCount,
      stepWidth,
      stairStart,
      stairEnd,
      flyingPlatformHeight,
      flyingRows: flyingRows.length > 0 ? flyingRows : [flyingBandBottom],
      minPlatformGap: this.config.PLATFORM_GRID,
      minHorizontalPlatformGap,
      minFlyingPlatformWidth,
      pathMinGap: this.config.PATH_MIN_GAP,
      pathMaxGap: this.config.PATH_MAX_GAP,
      grid,
      gridCols,
      gridRows,
      occupancy,
      gridSolids: [],
      verticalSolids: [],
      nextGridObjectId: 1,
      gridObjectKinds: new Map(),
      solids: [],
      coins: [],
      enemySpawns: [],
      starterPlatform: null,
    };
  }

  #buildMainPlatformPath(state) {
    const starterPlatformWidth = this.config.clamp(
      Math.floor(state.width * 0.12),
      state.minFlyingPlatformWidth,
      Math.max(state.minFlyingPlatformWidth, 16),
    );
    const mainRowY = state.flyingRows[0];
    const endX = Math.min(state.safeRight - 12, state.stairStart - state.minPlatformGap);
    const placements = this.#fillPlatformSpan(state, {
      rowY: mainRowY,
      startX: state.platformFillStart,
      endX,
      minWidth: 10,
      maxWidth: 24,
      minGap: state.minHorizontalPlatformGap,
      maxGap: state.minHorizontalPlatformGap + this.config.PLATFORM_GRID,
      enemyChance: 0.95,
      coinDivisor: 6,
      minCoinCount: 1,
      maxCoinCount: 4,
    });

    state.starterPlatform = placements[0] ?? this.#createFlyingPlatform(
      state,
      state.safeLeft,
      starterPlatformWidth,
      mainRowY,
      0,
    );

    if (!state.starterPlatform) {
      const fallbackStarter = this.#snapSolidToGrid({
        x: state.safeLeft,
        y: mainRowY,
        w: starterPlatformWidth,
        h: state.flyingPlatformHeight,
        kind: "flyingPlatform",
      });
      state.starterPlatform = this.#pushSolid(state, fallbackStarter) ?? fallbackStarter;
    }

    this.#addPlatformCoins(
      state.coins,
      state.starterPlatform.x,
      state.starterPlatform.y + state.starterPlatform.h + 6,
      state.starterPlatform.w,
      2,
    );
  }

  #buildUpperPlatformRows(state) {
    for (let rowIndex = 1; rowIndex < state.flyingRows.length; rowIndex++) {
      this.#buildUpperPlatformRow(state, rowIndex);
    }
  }

  #buildUpperPlatformRow(state, rowIndex) {
    const rowY = state.flyingRows[rowIndex];
    const rowStartX = state.platformFillStart + (rowIndex % 2 === 0 ? 0 : Math.floor(state.minHorizontalPlatformGap * 0.5));
    const placements = this.#fillPlatformSpan(state, {
      rowY,
      startX: rowStartX,
      endX: state.width - 6,
      minWidth: 8,
      maxWidth: 20,
      minGap: state.minHorizontalPlatformGap,
      maxGap: state.minHorizontalPlatformGap + this.config.PLATFORM_GRID * 2,
      enemyChance: 0.75,
      coinDivisor: 8,
      minCoinCount: 1,
      maxCoinCount: 3,
    });

    if (placements.length === 0) {
      this.#ensurePlatformInRow(state, rowIndex, rowY);
    }
  }

  #ensurePlatformInRow(state, rowIndex, rowY) {
    const guaranteedWidth = this.config.clamp(
      this.config.randomInt(state.rng, state.minFlyingPlatformWidth, 18),
      state.minFlyingPlatformWidth,
      18,
    );
    const anchors = [
      state.safeLeft + rowIndex * (state.pathMinGap + 2),
      state.safeLeft + ((state.safeRight - state.safeLeft) * 0.35),
      state.safeLeft + ((state.safeRight - state.safeLeft) * 0.6),
    ];

    for (let i = 0; i < anchors.length; i++) {
      const placed = this.#createFlyingPlatform(state, anchors[i], guaranteedWidth, rowY);
      if (!placed) continue;

      this.#addPlatformCoins(
        state.coins,
        placed.x,
        placed.y + placed.h + 6,
        placed.w,
        this.config.clamp(Math.floor(placed.w / 8), 1, 2),
      );
      this.#tryPlacePlatformEnemy(state, placed, 0.65);
      break;
    }
  }

  #buildGoalStairs(state) {
    const stepWidth = Math.max(
      this.config.PLATFORM_GRID,
      this.config.snapToPlatformGrid(state.stepWidth),
    );
    const desiredStepHeight = Math.max(
      this.config.PLATFORM_GRID,
      this.config.snapToPlatformGrid(
        this.config.clamp(Math.floor((state.height - state.floorHeight) * 0.12), 4, 8),
      ),
    );
    const maxTotalStairHeight = Math.max(
      this.config.PLATFORM_GRID,
      state.flyingRows[0] - state.floorHeight - state.minPlatformGap,
    );
    const maxStepHeight = Math.max(
      this.config.PLATFORM_GRID,
      Math.floor(maxTotalStairHeight / state.stairCount / this.config.PLATFORM_GRID) * this.config.PLATFORM_GRID,
    );
    const stepHeight = this.config.clamp(desiredStepHeight, this.config.PLATFORM_GRID, maxStepHeight);

    const levels = this.#buildGoalWallLevels(state.stairCount, state.rng);

    for (let i = 0; i < state.stairCount; i++) {
      const currentLevel = Math.max(1, levels[i] ?? (i + 1));
      const previousLevel = i > 0 ? Math.max(1, levels[i - 1]) : 1;
      const isVerticalJump = currentLevel - previousLevel >= 2;
      const kind = isVerticalJump || state.rng() < 0.45 ? "wall" : "stair";
      const stepX = this.config.snapToPlatformGrid(state.stairStart + i * stepWidth);
      this.#pushSolid(state, {
        x: stepX,
        y: state.floorHeight,
        w: stepWidth,
        h: stepHeight * currentLevel,
        kind,
      });
    }

    const highestLevel = levels.reduce((maxLevel, level) => Math.max(maxLevel, level), 1);

    this.#addPlatformCoins(
      state.coins,
      state.stairStart,
      state.floorHeight + stepHeight * highestLevel + 7,
      state.stairCount * stepWidth,
      state.stairCount,
    );
  }

  #buildVerticalSupportWalls(state) {
    const supportBaseRowY = state.flyingRows.length > 1 ? state.flyingRows[1] : state.flyingRows[0];
    const candidatePlatforms = state.solids
      .filter((solid) =>
        solid.kind === "flyingPlatform" &&
        solid.x > state.spawn.x + this.config.PLAYER.width * 2 &&
        solid.x + solid.w < state.goal.x - 10 &&
        solid.y >= supportBaseRowY,
      )
      .sort(this.config.sortByX);
    if (candidatePlatforms.length === 0) return;

    const targetCount = this.config.clamp(Math.floor(state.width / 72), 2, 5);
    const selected = this.#pickEvenlyDistributed(candidatePlatforms, targetCount);
    const heightSpan = Math.max(this.config.PLATFORM_GRID, state.height - state.floorHeight);
    const canvasScale = this.config.clamp(
      ((state.width / this.config.MIN_WORLD_WIDTH) + (state.height / this.config.MIN_WORLD_HEIGHT)) * 0.5,
      1,
      2.5,
    );
    const typicalGroundWallHeight = this.config.clamp(
      this.config.snapToPlatformGrid(Math.round(heightSpan * (0.46 + (canvasScale - 1) * 0.16))),
      this.config.PLATFORM_GRID * 3,
      heightSpan,
    );
    const rareTallWallChance = this.config.clamp(0.18 + (canvasScale - 1) * 0.08, 0.18, 0.32);
    const highTopAnchorChance = this.config.clamp(0.35 + (canvasScale - 1) * 0.2, 0.35, 0.55);

    for (let i = 0; i < selected.length; i++) {
      if (state.solids.length >= this.config.MAX_SOLIDS) break;
      const platform = selected[i];
      const desiredWidth = this.config.clamp(
        Math.floor(platform.w * 0.35),
        this.config.PLATFORM_GRID * 2,
        this.config.PLATFORM_GRID * 3,
      );
      const wallWidth = Math.max(
        this.config.PLATFORM_GRID,
        this.config.snapToPlatformGrid(desiredWidth),
      );
      const wallX = this.config.snapToPlatformGrid(
        platform.x + (platform.w - wallWidth) * 0.5,
      );

      const overlappingPlatforms = state.solids
        .filter((solid) =>
          solid.kind === "flyingPlatform" &&
          wallX < solid.x + solid.w &&
          wallX + wallWidth > solid.x,
        );
      if (overlappingPlatforms.length === 0) continue;

      const minWallHeight = this.config.PLAYER.height + this.config.PLATFORM_GRID;
      const overlapYs = overlappingPlatforms
        .map((solid) => solid.y)
        .sort((a, b) => a - b);
      let wallTopY = overlapYs[0];
      if (overlapYs.length > 1 && state.rng() < highTopAnchorChance) {
        const upperHalfStart = Math.floor((overlapYs.length - 1) * 0.5);
        const highIndex = this.config.randomInt(state.rng, upperHalfStart, overlapYs.length - 1);
        wallTopY = overlapYs[highIndex];
      }
      let wallStartY = state.floorHeight;
      const floatingStartCandidates = overlappingPlatforms
        .map((solid) => solid.y + solid.h)
        .filter((candidateY) => candidateY > state.floorHeight && candidateY + minWallHeight <= wallTopY);
      if (floatingStartCandidates.length > 0 && state.rng() < 0.45) {
        const startIndex = this.config.randomInt(state.rng, 0, floatingStartCandidates.length - 1);
        wallStartY = floatingStartCandidates[startIndex];
        const topLaneY = state.flyingRows[state.flyingRows.length - 1] ?? wallTopY;
        const floatingTopCapY = Math.max(
          wallStartY + minWallHeight,
          topLaneY - this.config.PLATFORM_GRID * 2,
        );
        wallTopY = Math.min(wallTopY, floatingTopCapY);
      }

      let maxWallHeight = wallTopY - wallStartY;
      if (wallStartY === state.floorHeight && state.rng() >= rareTallWallChance) {
        maxWallHeight = Math.min(maxWallHeight, typicalGroundWallHeight);
      }
      maxWallHeight = this.config.snapToPlatformGrid(maxWallHeight);
      if (maxWallHeight < minWallHeight) continue;

      let chosenMinHeight = minWallHeight;
      if (wallStartY === state.floorHeight) {
        const tallBiasMin = this.config.snapToPlatformGrid(maxWallHeight * 0.65);
        chosenMinHeight = this.config.clamp(
          tallBiasMin,
          minWallHeight,
          maxWallHeight,
        );
      }
      const wallHeight = this.config.clamp(
        this.config.snapToPlatformGrid(this.config.randomInt(state.rng, chosenMinHeight, maxWallHeight)),
        minWallHeight,
        maxWallHeight,
      );
      if (wallHeight < minWallHeight) continue;
      if (wallWidth >= wallHeight) continue;

      const wall = {
        x: wallX,
        y: wallStartY,
        w: wallWidth,
        h: wallHeight,
        kind: "wall",
        wallStyle: "stair",
      };
      const wallBounds = this.#solidToGridBounds(state, wall);
      if (!wallBounds) continue;
      const intersectsFlyingPlatform = this.#hasOccupiedKinds(state, wallBounds, ["flyingPlatform"]);
      if (intersectsFlyingPlatform) continue;
      const minPassageWidth = this.config.PLAYER.width + this.config.PLATFORM_GRID;
      const minPassageCells = Math.max(1, Math.ceil(minPassageWidth / state.grid));
      const hasNarrowSideGap = this.#hasNarrowHorizontalGap(
        state,
        wallBounds,
        ["flyingPlatform", "wall", "stair"],
        minPassageCells,
      );
      if (hasNarrowSideGap) continue;
      const invalidWallSpacing = state.verticalSolids.some((solidBounds) => {
        const gapCells = this.#horizontalGapCells(wallBounds, solidBounds);
        if (gapCells < 0) return true;
        if (gapCells === 0) return false;
        const minGapCells = Math.max(wallBounds.widthCells, solidBounds.widthCells) * 5;
        return gapCells < minGapCells;
      });
      if (invalidWallSpacing) continue;
      this.#pushSolid(state, wall);
    }
  }

  #buildGoalWallLevels(stairCount, rng) {
    const levels = [];
    let level = 1;
    let mode = this.config.randomInt(rng, 0, 2);

    for (let i = 0; i < stairCount; i++) {
      if (i === 0) {
        levels.push(level);
        continue;
      }

      if (mode === 0) {
        level += 1;
      } else if (mode === 1) {
        if (i % 2 === 0 || rng() < 0.35) level += 1;
      } else {
        if (i >= stairCount - 2) {
          level += 2;
        } else if (rng() < 0.2) {
          level += 1;
        }
      }

      level = this.config.clamp(level, 1, stairCount + 2);
      levels.push(level);
    }

    return levels;
  }

  #spawnGroundEnemies(state) {
    let walkerX = state.safeLeft + 4;

    while (walkerX < state.safeRight - 12) {
      if (state.rng() < 0.42) {
        this.#pushEnemy(state.enemySpawns, {
          x: walkerX,
          y: state.floorHeight,
          speed: this.config.randomInt(state.rng, 8, 12),
          dir: state.rng() < 0.5 ? -1 : 1,
        });
      }
      walkerX += this.config.randomInt(state.rng, 16, 28);
    }
  }

  #finalizeSolids(state) {
    return state.solids.sort(this.config.sortByX).slice(0, this.config.MAX_SOLIDS);
  }

  #finalizeCoins(state, solids, enemySpawns) {
    const filteredCoinCandidates = state.coins
      .filter((coin) =>
        coin.x > state.spawn.x + 8 &&
        coin.x < state.goal.x - 4 &&
        coin.y < state.height - 2 &&
        this.#isCoinClearOfSolids(coin, solids),
      )
      .sort(this.config.sortByX);

    const pickedCoins = this.#pickEvenlyDistributed(filteredCoinCandidates, this.config.STAGE_MAX_COLLECTIBLES);
    const occupancy = this.#createEntityOccupancy(state, solids, enemySpawns);
    let filteredCoins = [];

    for (let i = 0; i < pickedCoins.length; i++) {
      const coin = pickedCoins[i];
      const coinBounds = this.#coinToGridBounds(state, coin);
      if (!coinBounds) continue;
      if (!this.#tryReserveEntityBounds(occupancy, coinBounds)) continue;
      filteredCoins.push(coin);
    }

    if (filteredCoins.length === 0) {
      const fallbackCoin = {
        x: state.safeLeft + state.starterPlatform.w * 0.5,
        y: state.starterPlatform.y + state.starterPlatform.h + this.config.DEFAULT_COIN_RADIUS + this.config.COIN_PLATFORM_CLEARANCE + 1.5,
        r: this.config.DEFAULT_COIN_RADIUS,
      };
      const fallbackBounds = this.#coinToGridBounds(state, fallbackCoin);
      if (
        fallbackBounds &&
        this.#isCoinClearOfSolids(fallbackCoin, solids) &&
        this.#tryReserveEntityBounds(occupancy, fallbackBounds)
      ) {
        filteredCoins = [fallbackCoin];
      }
    }

    return filteredCoins;
  }

  #finalizeEnemies(state, solids) {
    const minEnemyX = Math.max(
      state.spawn.x + 12,
      Math.min(state.goal.x - 12, Math.floor(state.width * this.config.FIRST_ENEMY_MIN_WORLD_RATIO)),
    );
    const targetEnemyCount = Math.min(this.config.MAX_ENEMIES, Math.max(0, Math.floor(state.width / 30)));
    const enemySpan = Math.max(0, state.goal.x - 12 - minEnemyX);
    const enemyMinSpacing = this.config.clamp(
      Math.floor(enemySpan / Math.max(2, targetEnemyCount + 1)),
      this.config.PLATFORM_GRID,
      12,
    );
    const occupancy = this.#createEntityOccupancy(state, solids);

    const candidates = this.#collectEnemyCandidates(state, solids, minEnemyX);
    let filteredEnemies = this.#seedEnemiesFromCandidates(
      state,
      candidates,
      targetEnemyCount,
      enemyMinSpacing,
      minEnemyX,
      state.goal.x,
      solids,
      occupancy,
    );

    filteredEnemies = this.#backfillEnemies(
      state,
      filteredEnemies,
      targetEnemyCount,
      enemyMinSpacing,
      minEnemyX,
      state.goal.x,
      solids,
      occupancy,
    );

    return filteredEnemies.sort(this.config.sortByX).slice(0, targetEnemyCount);
  }

  #collectEnemyCandidates(state, solids, minEnemyX) {
    const candidates = state.enemySpawns
      .filter((enemy) => enemy.x >= minEnemyX && enemy.x < state.goal.x - 12)
      .sort(this.config.sortByX)
      .map((enemy) => this.#normalizeEnemyPatrolForHeadroom(enemy, solids))
      .filter((enemy) => enemy !== null);

    return {
      platform: candidates.filter((enemy) => enemy.lockPlatformPatrol).sort(this.config.sortByX),
      nonPlatform: candidates.filter((enemy) => !enemy.lockPlatformPatrol).sort(this.config.sortByX),
    };
  }

  #seedEnemiesFromCandidates(state, candidates, targetEnemyCount, enemyMinSpacing, minEnemyX, goalX, solids, occupancy) {
    const filteredEnemies = [];
    const platformEnemyTarget = Math.min(
      candidates.platform.length,
      Math.max(1, Math.floor(targetEnemyCount * this.config.PLATFORM_ENEMY_TARGET_RATIO)),
    );

    for (let i = 0; i < candidates.platform.length && filteredEnemies.length < platformEnemyTarget; i++) {
      this.#tryAppendEnemy(state, filteredEnemies, candidates.platform[i], enemyMinSpacing, minEnemyX, goalX, solids, occupancy);
    }

    const seededEnemyCandidates = [...candidates.platform, ...candidates.nonPlatform];
    for (let i = 0; i < seededEnemyCandidates.length && filteredEnemies.length < targetEnemyCount; i++) {
      this.#tryAppendEnemy(state, filteredEnemies, seededEnemyCandidates[i], enemyMinSpacing, minEnemyX, goalX, solids, occupancy);
    }

    return filteredEnemies;
  }

  #backfillEnemies(state, filteredEnemies, targetEnemyCount, enemyMinSpacing, minEnemyX, goalX, solids, occupancy) {
    let attempts = 0;
    const maxAttempts = Math.max(60, targetEnemyCount * 80);

    while (filteredEnemies.length < targetEnemyCount && attempts < maxAttempts) {
      attempts += 1;
      const x = this.config.randomInt(state.rng, Math.floor(minEnemyX), Math.floor(goalX - 16));
      this.#tryAppendEnemy(state, filteredEnemies, {
        x,
        y: state.floorHeight,
        speed: this.config.randomInt(state.rng, 8, 12),
        dir: state.rng() < 0.5 ? -1 : 1,
      }, enemyMinSpacing, minEnemyX, goalX, solids, occupancy);
    }

    const relaxedMinSpacing = Math.max(2, Math.floor(enemyMinSpacing * 0.66));
    const enemySpan = Math.max(0, goalX - 12 - minEnemyX);

    for (let i = 0; i < targetEnemyCount && filteredEnemies.length < targetEnemyCount; i++) {
      const anchorRatio = (i + 0.5) / Math.max(1, targetEnemyCount);
      const anchorX = minEnemyX + enemySpan * anchorRatio;
      const jitter = Math.max(1, Math.floor(enemyMinSpacing * 0.4));
      const x = this.config.clamp(
        this.config.snapToPlatformGrid(Math.round(anchorX + this.config.randomInt(state.rng, -jitter, jitter))),
        Math.floor(minEnemyX),
        Math.floor(goalX - 16),
      );
      this.#tryAppendEnemy(state, filteredEnemies, {
        x,
        y: state.floorHeight,
        speed: this.config.randomInt(state.rng, 8, 12),
        dir: state.rng() < 0.5 ? -1 : 1,
      }, relaxedMinSpacing, minEnemyX, goalX, solids, occupancy);
    }

    for (
      let x = this.config.snapToPlatformGrid(Math.floor(minEnemyX));
      filteredEnemies.length < targetEnemyCount && x < goalX - 12;
      x += this.config.PLATFORM_GRID
    ) {
      this.#tryAppendEnemy(state, filteredEnemies, {
        x,
        y: state.floorHeight,
        speed: this.config.randomInt(state.rng, 8, 12),
        dir: state.rng() < 0.5 ? -1 : 1,
      }, relaxedMinSpacing, minEnemyX, goalX, solids, occupancy);
    }

    return filteredEnemies;
  }

  #tryAppendEnemy(state, filteredEnemies, candidate, minSpacing, minEnemyX, goalX, solids, occupancy) {
    if (!candidate) return false;
    if (candidate.x < minEnemyX || candidate.x >= goalX - 12) return false;

    const normalized = this.#normalizeEnemyPatrolForHeadroom(candidate, solids);
    if (!normalized) return false;
    const snappedEnemy = {
      ...normalized,
      x: this.config.snapToPlatformGrid(normalized.x),
      y: this.config.snapToPlatformGrid(normalized.y),
    };
    if (snappedEnemy.x < minEnemyX || snappedEnemy.x >= goalX - 12) return false;

    const requiredSpacing = Math.max(minSpacing, this.config.ENEMY_PLACEMENT_MIN_GAP);
    const tooClose = filteredEnemies.some((enemy) => {
      const sameLane = Math.abs(enemy.y - snappedEnemy.y) < this.config.PLATFORM_GRID;
      return sameLane && Math.abs(enemy.x - snappedEnemy.x) < requiredSpacing;
    });

    if (tooClose) return false;
    const enemyBounds = this.#enemyToGridBounds(state, snappedEnemy);
    if (!enemyBounds) return false;
    if (!this.#tryReserveEntityBounds(occupancy, enemyBounds)) return false;

    filteredEnemies.push(snappedEnemy);
    return true;
  }

  #fillPlatformSpan(state, {
    rowY,
    startX,
    endX,
    minWidth,
    maxWidth,
    minGap = 0,
    maxGap = 0,
    enemyChance,
    coinDivisor,
    minCoinCount,
    maxCoinCount,
  }) {
    const placements = [];
    const grid = this.config.PLATFORM_GRID;
    let cursorX = Math.floor(startX / grid) * grid;
    const rowEndX = Math.max(cursorX + grid, Math.floor(endX / grid) * grid);
    let contiguousNoGapRun = 0;

    while (cursorX < rowEndX && state.solids.length < this.config.MAX_SOLIDS) {
      const previousPlacement = placements[placements.length - 1];
      if (previousPlacement && contiguousNoGapRun >= 5) {
        const minBreakX = previousPlacement.x + previousPlacement.w + grid;
        cursorX = Math.max(cursorX, minBreakX);
      }
      const remaining = rowEndX - cursorX;
      if (remaining < grid) break;

      const effectiveMinWidth = Math.max(state.minFlyingPlatformWidth, minWidth);
      const effectiveMaxWidth = Math.max(effectiveMinWidth, maxWidth);
      const targetWidth = this.config.clamp(
        this.config.randomInt(state.rng, effectiveMinWidth, effectiveMaxWidth),
        effectiveMinWidth,
        effectiveMaxWidth,
      );
      const maxAllowedWidth = Math.max(state.minFlyingPlatformWidth, remaining);
      const maxGridWidth = Math.max(state.minFlyingPlatformWidth, Math.floor(maxAllowedWidth / grid) * grid);
      const width = this.config.clamp(
        this.config.snapToPlatformGrid(targetWidth),
        state.minFlyingPlatformWidth,
        maxGridWidth,
      );
      if (width < state.minFlyingPlatformWidth || width > remaining) break;
      const placed = this.#createFlyingPlatform(state, cursorX, width, rowY, 0);

      if (!placed) {
        cursorX += grid;
        continue;
      }

      placements.push(placed);
      if (!previousPlacement) {
        contiguousNoGapRun = 1;
      } else {
        const gapFromPrevious = placed.x - (previousPlacement.x + previousPlacement.w);
        contiguousNoGapRun = gapFromPrevious <= 0 ? contiguousNoGapRun + 1 : 1;
      }
      this.#addPlatformCoins(
        state.coins,
        placed.x,
        placed.y + placed.h + 6,
        placed.w,
        this.config.clamp(Math.floor(placed.w / coinDivisor), minCoinCount, maxCoinCount),
      );
      this.#tryPlacePlatformEnemy(state, placed, enemyChance);
      cursorX += placed.w;
      if (cursorX >= rowEndX) break;
      cursorX += this.config.randomInt(state.rng, minGap, maxGap);
    }

    return placements;
  }

  #createFlyingPlatform(state, x, platformWidth, rowY = state.flyingRows[0], requiredGap = state.minPlatformGap) {
    if (state.solids.length >= this.config.MAX_SOLIDS) return null;

    const candidate = this.#snapSolidToGrid({
      x,
      y: rowY,
      w: platformWidth,
      h: state.flyingPlatformHeight,
      kind: "flyingPlatform",
    });
    const candidateBounds = this.#solidToGridBounds(state, candidate);
    if (!candidateBounds) return null;

    const blocksForStairs = Math.abs(candidate.y - state.flyingRows[0]) < this.config.PLATFORM_GRID;
    const overlapsStairZone =
      blocksForStairs &&
      candidate.x < state.stairEnd + state.minPlatformGap &&
      candidate.x + candidate.w > state.stairStart - state.minPlatformGap;

    const blockedBySolid = this.#hasOccupiedKinds(state, candidateBounds, ["flyingPlatform", "wall", "stair"]);
    if (overlapsStairZone || blockedBySolid) {
      return null;
    }

    if (requiredGap > 0 && this.#hasCloseHorizontalNeighbor(state, candidateBounds, ["flyingPlatform"], requiredGap)) {
      return null;
    }

    const minPassageWidth = this.config.PLAYER.width + this.config.PLATFORM_GRID;
    const minPassageCells = Math.max(1, Math.ceil(minPassageWidth / state.grid));
    const createsNarrowSideGap = this.#hasNarrowHorizontalGap(
      state,
      candidateBounds,
      ["flyingPlatform", "wall", "stair"],
      minPassageCells,
    );
    if (createsNarrowSideGap) return null;

    return this.#pushSolid(state, candidate);
  }

  #tryPlacePlatformEnemy(state, platform, chance) {
    if (!platform || platform.w < 14 || state.rng() >= chance) return;

    const enemyHalf = this.config.ENEMY_WIDTH * 0.5;
    const laneY = platform.y + platform.h;
    const leftX = platform.x + enemyHalf + 1;
    const rightX = platform.x + platform.w - enemyHalf - 1;
    const centerX = this.config.clamp(platform.x + platform.w * 0.5, leftX, rightX);
    const preferredXs = [centerX, leftX, rightX];

    for (let i = 0; i < preferredXs.length; i++) {
      const enemyX = preferredXs[i];
      if (!this.#hasLaneEnemyGap(state.enemySpawns, enemyX, laneY)) continue;

      this.#pushEnemy(state.enemySpawns, {
        x: enemyX,
        y: laneY,
        lockPlatformPatrol: true,
        speed: this.config.randomInt(state.rng, 7, 10),
        dir: state.rng() < 0.5 ? -1 : 1,
      });
      break;
    }
  }

  #hasLaneEnemyGap(enemySpawns, x, y) {
    return !enemySpawns.some((enemy) => {
      const sameLane = Math.abs(enemy.y - y) < this.config.PLATFORM_GRID;
      return sameLane && Math.abs(enemy.x - x) < this.config.ENEMY_PLACEMENT_MIN_GAP;
    });
  }

  #snapSolidToGrid(solid) {
    const snapped = { ...solid };
    snapped.y = this.config.snapToPlatformGrid(snapped.y);
    snapped.h = Math.max(this.config.PLATFORM_GRID, this.config.snapToPlatformGrid(snapped.h));

    if (snapped.kind !== "wall") {
      snapped.x = this.config.snapToPlatformGrid(snapped.x);
      snapped.w = Math.max(this.config.PLATFORM_GRID, this.config.snapToPlatformGrid(snapped.w));
    }

    return snapped;
  }

  #solidToGridBounds(state, solid) {
    const left = this.config.clamp(Math.floor(solid.x / state.grid), 0, state.gridCols - 1);
    const right = this.config.clamp(Math.ceil((solid.x + solid.w) / state.grid) - 1, 0, state.gridCols - 1);
    const bottom = this.config.clamp(Math.floor(solid.y / state.grid), 0, state.gridRows - 1);
    const top = this.config.clamp(Math.ceil((solid.y + solid.h) / state.grid) - 1, 0, state.gridRows - 1);
    if (right < left || top < bottom) return null;
    return {
      left,
      right,
      bottom,
      top,
      widthCells: right - left + 1,
      heightCells: top - bottom + 1,
    };
  }

  #isVerticalOverlapInCells(a, b) {
    return a.bottom <= b.top && a.top >= b.bottom;
  }

  #horizontalGapCells(a, b) {
    if (!this.#isVerticalOverlapInCells(a, b)) return Number.POSITIVE_INFINITY;
    if (a.right < b.left) return b.left - a.right - 1;
    if (b.right < a.left) return a.left - b.right - 1;
    return -1;
  }

  #hasOccupiedKinds(state, bounds, kinds) {
    const wanted = new Set(kinds);
    for (let y = bounds.bottom; y <= bounds.top; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        const objectId = state.occupancy[y][x];
        if (!objectId) continue;
        const objectKind = state.gridObjectKinds.get(objectId);
        if (wanted.has(objectKind)) return true;
      }
    }
    return false;
  }

  #hasCloseHorizontalNeighbor(state, bounds, kinds, minGapPx) {
    const minGapCells = Math.max(1, Math.ceil(minGapPx / state.grid));
    return state.gridSolids.some((solid) => {
      if (!kinds.includes(solid.kind)) return false;
      const gapCells = this.#horizontalGapCells(bounds, solid);
      return gapCells >= 0 && gapCells < minGapCells;
    });
  }

  #hasNarrowHorizontalGap(state, bounds, kinds, minPassageCells) {
    return state.gridSolids.some((solid) => {
      if (!kinds.includes(solid.kind)) return false;
      const gapCells = this.#horizontalGapCells(bounds, solid);
      return gapCells > 0 && gapCells < minPassageCells;
    });
  }

  #markSolidInGrid(state, objectId, bounds) {
    for (let y = bounds.bottom; y <= bounds.top; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        state.occupancy[y][x] = objectId;
      }
    }
  }

  #pushSolid(state, solid) {
    if (state.solids.length >= this.config.MAX_SOLIDS) return null;
    const snapped = this.#snapSolidToGrid(solid);
    const bounds = this.#solidToGridBounds(state, snapped);
    if (!bounds) return null;
    if (this.#hasOccupiedKinds(state, bounds, ["wall", "stair", "flyingPlatform"])) return null;
    const objectId = state.nextGridObjectId++;

    state.solids.push(snapped);
    state.gridObjectKinds.set(objectId, snapped.kind);
    state.gridSolids.push({
      kind: snapped.kind,
      objectId,
      ...bounds,
    });
    this.#markSolidInGrid(state, objectId, bounds);

    const isVerticalObstacle = (
      (snapped.kind === "wall" || snapped.kind === "stair") &&
      snapped.y >= state.floorHeight
    );
    if (isVerticalObstacle) {
      state.verticalSolids.push(bounds);
    }

    return snapped;
  }

  #createEmptyCellGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  #isBoundsFree(cellOwners, bounds) {
    for (let y = bounds.bottom; y <= bounds.top; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        if (cellOwners[y][x] !== 0) return false;
      }
    }
    return true;
  }

  #reserveBounds(cellOwners, bounds, objectId) {
    for (let y = bounds.bottom; y <= bounds.top; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        cellOwners[y][x] = objectId;
      }
    }
  }

  #tryReserveEntityBounds(occupancy, bounds) {
    if (!bounds) return false;
    if (!this.#isBoundsFree(occupancy.cellOwners, bounds)) return false;
    this.#reserveBounds(occupancy.cellOwners, bounds, occupancy.nextObjectId);
    occupancy.nextObjectId += 1;
    return true;
  }

  #enemyToGridBounds(state, enemy) {
    const footprintWidth = state.grid * 2;
    const footprintHeight = state.grid * 2;
    const left = this.config.clamp(
      Math.floor((enemy.x - footprintWidth * 0.5) / state.grid),
      0,
      Math.max(0, state.gridCols - 2),
    );
    const bottom = this.config.clamp(
      Math.floor(enemy.y / state.grid),
      0,
      Math.max(0, state.gridRows - 2),
    );
    return {
      left,
      right: Math.min(state.gridCols - 1, left + 1),
      bottom,
      top: Math.min(state.gridRows - 1, bottom + Math.max(1, Math.round(footprintHeight / state.grid)) - 1),
      widthCells: 2,
      heightCells: 2,
    };
  }

  #coinToGridBounds(state, coin) {
    const cellX = this.config.clamp(Math.floor(coin.x / state.grid), 0, state.gridCols - 1);
    const cellY = this.config.clamp(Math.floor(coin.y / state.grid), 0, state.gridRows - 1);
    return {
      left: cellX,
      right: cellX,
      bottom: cellY,
      top: cellY,
      widthCells: 1,
      heightCells: 1,
    };
  }

  #createEntityOccupancy(state, solids, enemySpawns = []) {
    const cellOwners = this.#createEmptyCellGrid(state.gridRows, state.gridCols);
    let nextObjectId = 1;

    for (let i = 0; i < solids.length; i++) {
      const bounds = this.#solidToGridBounds(state, solids[i]);
      if (!bounds) continue;
      if (!this.#isBoundsFree(cellOwners, bounds)) continue;
      this.#reserveBounds(cellOwners, bounds, nextObjectId);
      nextObjectId += 1;
    }

    for (let i = 0; i < enemySpawns.length; i++) {
      const bounds = this.#enemyToGridBounds(state, enemySpawns[i]);
      if (!bounds) continue;
      if (!this.#isBoundsFree(cellOwners, bounds)) continue;
      this.#reserveBounds(cellOwners, bounds, nextObjectId);
      nextObjectId += 1;
    }

    return {
      cellOwners,
      nextObjectId,
    };
  }

  #pushCoin(list, coin) {
    if (list.length >= this.config.MAX_COINS) return;
    const grid = this.config.PLATFORM_GRID;
    const snapToCellCenter = (value) => (
      Math.floor(value / grid) * grid + grid * 0.5
    );
    const candidate = {
      ...coin,
      x: snapToCellCenter(coin.x),
      y: snapToCellCenter(coin.y),
      r: coin.r ?? this.config.DEFAULT_COIN_RADIUS,
    };
    const minDistance = candidate.r * 2 + this.config.COIN_MIN_SEPARATION;
    const minDistanceSq = minDistance * minDistance;

    for (let i = 0; i < list.length; i++) {
      const other = list[i];
      const dx = candidate.x - other.x;
      const dy = candidate.y - other.y;
      if (dx * dx + dy * dy < minDistanceSq) {
        return;
      }
    }

    list.push(candidate);
  }

  #pushEnemy(list, enemy) {
    if (list.length >= this.config.MAX_ENEMIES) return;
    list.push(enemy);
  }

  #addPlatformCoins(coins, x, y, w, count) {
    if (count <= 0) return;
    const step = w / (count + 1);
    for (let i = 0; i < count; i++) {
      this.#pushCoin(coins, {
        x: x + step * (i + 1),
        y,
      });
    }
  }

  #coinRect(coin, padding = 0) {
    return {
      x: coin.x - coin.r - padding,
      y: coin.y - coin.r - padding,
      w: coin.r * 2 + padding * 2,
      h: coin.r * 2 + padding * 2,
    };
  }

  #isCoinClearOfSolids(coin, solids) {
    const rect = this.#coinRect(coin, this.config.COIN_PLATFORM_CLEARANCE);
    return !solids.some((solid) => {
      return rect.x < solid.x + solid.w && rect.x + rect.w > solid.x &&
        rect.y < solid.y + solid.h && rect.y + rect.h > solid.y;
    });
  }

  #hasStompHeadroomAtX(x, enemyGroundY, solids) {
    const enemyTop = enemyGroundY + this.config.ENEMY_HEIGHT;
    const enemyHalf = this.config.ENEMY_WIDTH * 0.45;
    let nearestCeilingBottom = Number.POSITIVE_INFINITY;

    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (solid.y <= enemyTop + 0.01) continue;
      const overlapsX = x + enemyHalf > solid.x && x - enemyHalf < solid.x + solid.w;
      if (!overlapsX) continue;
      nearestCeilingBottom = Math.min(nearestCeilingBottom, solid.y);
    }

    return nearestCeilingBottom - enemyTop >= this.config.ENEMY_STOMP_HEADROOM;
  }

  #isEnemyBodyClearAtX(x, enemyGroundY, solids) {
    const rect = {
      x: x - this.config.ENEMY_WIDTH * 0.5,
      y: enemyGroundY,
      w: this.config.ENEMY_WIDTH,
      h: this.config.ENEMY_HEIGHT,
    };
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (rect.x < solid.x + solid.w && rect.x + rect.w > solid.x &&
        rect.y < solid.y + solid.h && rect.y + rect.h > solid.y) {
        return false;
      }
    }
    return true;
  }

  #hasEnemySupportAtX(x, enemyGroundY, solids, probe = 1.25) {
    const rect = {
      x: x - this.config.ENEMY_WIDTH * 0.5 + 0.35,
      y: enemyGroundY - probe,
      w: this.config.ENEMY_WIDTH - 0.7,
      h: probe,
    };
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (rect.x < solid.x + solid.w && rect.x + rect.w > solid.x &&
        rect.y < solid.y + solid.h && rect.y + rect.h > solid.y) {
        return true;
      }
    }
    return false;
  }

  #findSupportSurfaceForEnemy(spawn, solids) {
    const supportY = spawn.y - 0.01;
    const enemyHalf = Math.max(this.config.ENEMY_WIDTH * 0.5, this.config.PLATFORM_GRID);
    const candidates = [];

    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (!["flyingPlatform", "wall", "stair"].includes(solid.kind)) continue;
      const sameLane = Math.abs(supportY - (solid.y + solid.h)) < this.config.PLATFORM_GRID * 0.5;
      if (!sameLane) continue;
      const fitsOnPlatform =
        spawn.x - enemyHalf >= solid.x &&
        spawn.x + enemyHalf <= solid.x + solid.w;
      if (!fitsOnPlatform) continue;
      candidates.push(solid);
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.w - b.w);
    return candidates[0];
  }

  #normalizeEnemyPatrolForHeadroom(spawn, solids) {
    const supportSurface = this.#findSupportSurfaceForEnemy(spawn, solids);
    const enemyHalf = Math.max(this.config.ENEMY_WIDTH * 0.5, this.config.PLATFORM_GRID);
    const patrolMinX = supportSurface ? supportSurface.x + enemyHalf : Number.NEGATIVE_INFINITY;
    const patrolMaxX = supportSurface ? supportSurface.x + supportSurface.w - enemyHalf : Number.POSITIVE_INFINITY;
    const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -6, 6, -8, 8];
    for (let i = 0; i < offsets.length; i++) {
      const x = spawn.x + offsets[i];
      if (x < patrolMinX || x > patrolMaxX) continue;
      if (!this.#hasStompHeadroomAtX(x, spawn.y, solids)) continue;
      if (!this.#isEnemyBodyClearAtX(x, spawn.y, solids)) continue;
      if (!this.#hasEnemySupportAtX(x, spawn.y, solids)) continue;
      return {
        ...spawn,
        x,
        patrolMinX,
        patrolMaxX,
      };
    }

    return null;
  }

  #pickEvenlyDistributed(items, count) {
    if (items.length <= count) return [...items];
    if (count <= 0) return [];
    if (count === 1) return [items[Math.floor(items.length * 0.5)]];

    const picks = [];
    const used = new Set();
    const denominator = Math.max(1, count - 1);

    for (let i = 0; i < count; i++) {
      let index = Math.round((i * (items.length - 1)) / denominator);
      while (used.has(index) && index < items.length - 1) index += 1;
      while (used.has(index) && index > 0) index -= 1;
      if (used.has(index)) continue;
      used.add(index);
      picks.push(items[index]);
    }

    return picks.sort(this.config.sortByX);
  }
}
