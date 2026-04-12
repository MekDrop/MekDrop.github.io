export class MarioLikeMapGenerator {
  constructor(config) {
    this.config = config;
  }

  generate(nextWidth, nextHeight, seed) {
    const state = this.#createGenerationState(nextWidth, nextHeight, seed);

    this.#pushSolid(state.solids, { x: 0, y: 0, w: state.width, h: state.floorHeight, kind: "wall" });
    this.#buildMainPlatformPath(state);
    this.#buildUpperPlatformRows(state);
    this.#buildGoalStairs(state);
    this.#spawnGroundEnemies(state);

    const solids = this.#finalizeSolids(state);
    const coins = this.#finalizeCoins(state, solids);
    const enemySpawns = this.#finalizeEnemies(state, solids);

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
    const stairCount = this.config.clamp(Math.floor(width / 56), 2, 5);
    const stepWidth = this.config.clamp(Math.floor(width * 0.05), 6, 8);
    const stairStart = goal.x - 10 - stairCount * stepWidth;
    const stairEnd = goal.x + stepWidth;
    const flyingPlatformHeight = 4;
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
    const flyingRowStep = Math.ceil((flyingPlatformHeight + this.config.FLYING_ROW_CLEARANCE) / this.config.PLATFORM_GRID) * this.config.PLATFORM_GRID;
    const flyingRows = [];
    for (let y = flyingBandBottom; y <= flyingBandTop; y += flyingRowStep) {
      flyingRows.push(y);
    }

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
      stairCount,
      stepWidth,
      stairStart,
      stairEnd,
      flyingPlatformHeight,
      flyingRows: flyingRows.length > 0 ? flyingRows : [flyingBandBottom],
      minPlatformGap: this.config.PLATFORM_GRID,
      pathMinGap: this.config.PATH_MIN_GAP,
      pathMaxGap: this.config.PATH_MAX_GAP,
      solids: [],
      coins: [],
      enemySpawns: [],
      starterPlatform: null,
    };
  }

  #buildMainPlatformPath(state) {
    const starterPlatformWidth = this.config.clamp(Math.floor(state.width * 0.12), 10, 16);

    state.starterPlatform = this.#createFlyingPlatform(state, state.safeLeft, starterPlatformWidth);

    if (!state.starterPlatform) {
      state.starterPlatform = this.#snapSolidToGrid({
        x: state.safeLeft,
        y: state.flyingRows[0],
        w: starterPlatformWidth,
        h: state.flyingPlatformHeight,
        kind: "flyingPlatform",
      });
      if (state.solids.length < this.config.MAX_SOLIDS) {
        state.solids.push(state.starterPlatform);
      }
    }

    this.#addPlatformCoins(
      state.coins,
      state.starterPlatform.x,
      state.starterPlatform.y + state.starterPlatform.h + 6,
      state.starterPlatform.w,
      2,
    );

    let cursorX = state.starterPlatform.x + state.starterPlatform.w;

    while (cursorX < state.safeRight - 18) {
      cursorX += this.config.randomInt(state.rng, state.pathMinGap, state.pathMaxGap);
      if (cursorX >= state.safeRight - 18) break;

      const platformWidth = this.config.clamp(
        Math.floor(this.config.randomInt(state.rng, 10, Math.max(10, Math.floor(state.width * 0.16)))),
        10,
        24,
      );
      const placed = this.#createFlyingPlatform(state, cursorX, platformWidth);
      if (!placed) continue;

      this.#addPlatformCoins(
        state.coins,
        placed.x,
        placed.y + placed.h + 6,
        placed.w,
        this.config.clamp(Math.floor(placed.w / 6), 1, 4),
      );
      this.#tryPlacePlatformEnemy(state, placed, 0.95);
      cursorX += placed.w;
    }
  }

  #buildUpperPlatformRows(state) {
    for (let rowIndex = 1; rowIndex < state.flyingRows.length; rowIndex++) {
      this.#buildUpperPlatformRow(state, rowIndex);
    }
  }

  #buildUpperPlatformRow(state, rowIndex) {
    const rowY = state.flyingRows[rowIndex];
    let rowCursor = state.safeLeft + this.config.randomInt(state.rng, 0, state.pathMaxGap);
    let placedInRow = 0;

    while (rowCursor < state.safeRight - 10) {
      const platformWidth = this.config.clamp(this.config.randomInt(state.rng, 8, 16), 8, 20);
      const placed = this.#createFlyingPlatform(state, rowCursor, platformWidth, rowY);

      if (placed) {
        placedInRow += 1;
        this.#addPlatformCoins(
          state.coins,
          placed.x,
          placed.y + placed.h + 6,
          placed.w,
          this.config.clamp(Math.floor(placed.w / 8), 1, 3),
        );
        this.#tryPlacePlatformEnemy(state, placed, 0.75);
        rowCursor += placed.w + this.config.randomInt(state.rng, state.pathMinGap, state.pathMaxGap + 4);
      } else {
        rowCursor += this.config.PLATFORM_GRID;
      }
    }

    if (placedInRow === 0) {
      this.#ensurePlatformInRow(state, rowIndex, rowY);
    }
  }

  #ensurePlatformInRow(state, rowIndex, rowY) {
    const guaranteedWidth = this.config.clamp(this.config.randomInt(state.rng, 10, 14), 10, 18);
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

    for (let i = 0; i < state.stairCount; i++) {
      this.#pushSolid(state.solids, {
        x: state.stairStart + i * state.stepWidth,
        y: state.floorHeight,
        w: state.stepWidth,
        h: stepHeight * (i + 1),
        kind: "stair",
      });
    }

    this.#addPlatformCoins(
      state.coins,
      state.stairStart,
      state.floorHeight + stepHeight * state.stairCount + 7,
      state.stairCount * state.stepWidth,
      state.stairCount,
    );
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

  #finalizeCoins(state, solids) {
    const filteredCoinCandidates = state.coins
      .filter((coin) =>
        coin.x > state.spawn.x + 8 &&
        coin.x < state.goal.x - 4 &&
        coin.y < state.height - 2 &&
        this.#isCoinClearOfSolids(coin, solids),
      )
      .sort(this.config.sortByX);

    let filteredCoins = this.#pickEvenlyDistributed(filteredCoinCandidates, this.config.STAGE_MAX_COLLECTIBLES);

    if (filteredCoins.length === 0) {
      const fallbackCoin = {
        x: state.safeLeft + state.starterPlatform.w * 0.5,
        y: state.starterPlatform.y + state.starterPlatform.h + this.config.DEFAULT_COIN_RADIUS + this.config.COIN_PLATFORM_CLEARANCE + 1.5,
        r: this.config.DEFAULT_COIN_RADIUS,
      };
      if (this.#isCoinClearOfSolids(fallbackCoin, solids)) {
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

    const candidates = this.#collectEnemyCandidates(state, solids, minEnemyX);
    let filteredEnemies = this.#seedEnemiesFromCandidates(
      candidates,
      targetEnemyCount,
      enemyMinSpacing,
      minEnemyX,
      state.goal.x,
      solids,
    );

    filteredEnemies = this.#backfillEnemies(
      state,
      filteredEnemies,
      targetEnemyCount,
      enemyMinSpacing,
      minEnemyX,
      state.goal.x,
      solids,
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

  #seedEnemiesFromCandidates(candidates, targetEnemyCount, enemyMinSpacing, minEnemyX, goalX, solids) {
    const filteredEnemies = [];
    const platformEnemyTarget = Math.min(
      candidates.platform.length,
      Math.max(1, Math.floor(targetEnemyCount * this.config.PLATFORM_ENEMY_TARGET_RATIO)),
    );

    for (let i = 0; i < candidates.platform.length && filteredEnemies.length < platformEnemyTarget; i++) {
      this.#tryAppendEnemy(filteredEnemies, candidates.platform[i], enemyMinSpacing, minEnemyX, goalX, solids);
    }

    const seededEnemyCandidates = [...candidates.platform, ...candidates.nonPlatform];
    for (let i = 0; i < seededEnemyCandidates.length && filteredEnemies.length < targetEnemyCount; i++) {
      this.#tryAppendEnemy(filteredEnemies, seededEnemyCandidates[i], enemyMinSpacing, minEnemyX, goalX, solids);
    }

    return filteredEnemies;
  }

  #backfillEnemies(state, filteredEnemies, targetEnemyCount, enemyMinSpacing, minEnemyX, goalX, solids) {
    let attempts = 0;
    const maxAttempts = Math.max(60, targetEnemyCount * 80);

    while (filteredEnemies.length < targetEnemyCount && attempts < maxAttempts) {
      attempts += 1;
      const x = this.config.randomInt(state.rng, Math.floor(minEnemyX), Math.floor(goalX - 16));
      this.#tryAppendEnemy(filteredEnemies, {
        x,
        y: state.floorHeight,
        speed: this.config.randomInt(state.rng, 8, 12),
        dir: state.rng() < 0.5 ? -1 : 1,
      }, enemyMinSpacing, minEnemyX, goalX, solids);
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
      this.#tryAppendEnemy(filteredEnemies, {
        x,
        y: state.floorHeight,
        speed: this.config.randomInt(state.rng, 8, 12),
        dir: state.rng() < 0.5 ? -1 : 1,
      }, relaxedMinSpacing, minEnemyX, goalX, solids);
    }

    for (
      let x = this.config.snapToPlatformGrid(Math.floor(minEnemyX));
      filteredEnemies.length < targetEnemyCount && x < goalX - 12;
      x += this.config.PLATFORM_GRID
    ) {
      this.#tryAppendEnemy(filteredEnemies, {
        x,
        y: state.floorHeight,
        speed: this.config.randomInt(state.rng, 8, 12),
        dir: state.rng() < 0.5 ? -1 : 1,
      }, relaxedMinSpacing, minEnemyX, goalX, solids);
    }

    return filteredEnemies;
  }

  #tryAppendEnemy(filteredEnemies, candidate, minSpacing, minEnemyX, goalX, solids) {
    if (!candidate) return false;
    if (candidate.x < minEnemyX || candidate.x >= goalX - 12) return false;

    const normalized = this.#normalizeEnemyPatrolForHeadroom(candidate, solids);
    if (!normalized) return false;

    const requiredSpacing = Math.max(minSpacing, this.config.ENEMY_PLACEMENT_MIN_GAP);
    const tooClose = filteredEnemies.some((enemy) => {
      const sameLane = Math.abs(enemy.y - normalized.y) < this.config.PLATFORM_GRID;
      return sameLane && Math.abs(enemy.x - normalized.x) < requiredSpacing;
    });

    if (tooClose) return false;

    filteredEnemies.push(normalized);
    return true;
  }

  #createFlyingPlatform(state, x, platformWidth, rowY = state.flyingRows[0]) {
    if (state.solids.length >= this.config.MAX_SOLIDS) return null;

    const candidate = this.#snapSolidToGrid({
      x,
      y: rowY,
      w: platformWidth,
      h: state.flyingPlatformHeight,
      kind: "flyingPlatform",
    });

    const overlapsStairZone =
      candidate.x < state.stairEnd + state.minPlatformGap &&
      candidate.x + candidate.w > state.stairStart - state.minPlatformGap;

    if (overlapsStairZone || this.#touchesOtherPlatform(candidate, state.solids, state.minPlatformGap)) {
      return null;
    }

    state.solids.push(candidate);
    return candidate;
  }

  #touchesOtherPlatform(candidate, solids, gap) {
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (solid.kind === "wall") continue;
      const intersectsWithGap =
        candidate.x < solid.x + solid.w + gap &&
        candidate.x + candidate.w > solid.x - gap &&
        candidate.y < solid.y + solid.h + gap &&
        candidate.y + candidate.h > solid.y - gap;

      if (intersectsWithGap) {
        return true;
      }
    }

    return false;
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

  #pushSolid(list, solid) {
    if (list.length >= this.config.MAX_SOLIDS) return;
    list.push(this.#snapSolidToGrid(solid));
  }

  #pushCoin(list, coin) {
    if (list.length >= this.config.MAX_COINS) return;
    const candidate = {
      ...coin,
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
    return !solids.some((solid) => this.config.overlap(rect, solid));
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
    const rect = this.config.spriteRect(x, enemyGroundY, this.config.ENEMY_WIDTH, this.config.ENEMY_HEIGHT);
    for (let i = 0; i < solids.length; i++) {
      if (this.config.overlap(rect, solids[i])) return false;
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
      if (this.config.overlap(rect, solids[i])) return true;
    }
    return false;
  }

  #normalizeEnemyPatrolForHeadroom(spawn, solids) {
    const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -6, 6, -8, 8];
    for (let i = 0; i < offsets.length; i++) {
      const x = spawn.x + offsets[i];
      if (!this.#hasStompHeadroomAtX(x, spawn.y, solids)) continue;
      if (!this.#isEnemyBodyClearAtX(x, spawn.y, solids)) continue;
      if (!this.#hasEnemySupportAtX(x, spawn.y, solids)) continue;
      return {
        ...spawn,
        x,
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
      const target = Math.round((i * (items.length - 1)) / denominator);
      let index = target;
      while (used.has(index) && index < items.length - 1) index += 1;
      while (used.has(index) && index > 0) index -= 1;
      if (used.has(index)) continue;
      used.add(index);
      picks.push(items[index]);
    }

    return picks.sort(this.config.sortByX);
  }
}
