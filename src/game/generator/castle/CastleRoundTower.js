/**
 * @typedef {{center:number[],radius:number,wallThickness:number,height:number,belfryHeight:number,roofHeight:number,doorWidth:number,doorHeight:number,terraceElevation:number}} RoundTowerDefinition
 */

/**
 * Uses the castle's masonry grid for both the circular shell and Ammo contact.
 * The central stair void remains open through both landings.
 */
export class CastleRoundTower {
  /**
   * @param {RoundTowerDefinition} tower
   * @param {number} baseY
   * @param {(bounds:{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number},material?:string)=>void} emit
   */
  static emit(tower, baseY, emit) {
    const [cx, cz] = tower.center;
    const pitch = 0.25;
    for (let x = cx - tower.radius; x < cx + tower.radius; x += pitch) {
      for (let z = cz - tower.radius; z < cz + tower.radius; z += pitch) {
        const dx = x + pitch / 2 - cx;
        const dz = z + pitch / 2 - cz;
        const radius = Math.hypot(dx, dz);
        const nearestRadius = Math.hypot(Math.max(0, Math.abs(dx) - pitch / 2), Math.max(0, Math.abs(dz) - pitch / 2));
        // Reserve the front 120 degrees for a level doorway landing. The
        // 240-degree flight arrives on the left and restarts on the right.
        const doorLanding = z >= cz && x >= -(z - cz) / Math.sqrt(3) + cx;
        const farthestRadius = Math.hypot(Math.abs(dx) + pitch / 2, Math.abs(dz) + pitch / 2);
        if (radius > tower.radius) {
          continue;
        }
        const bounds = {
          minX: x,
          maxX: x + pitch,
          minZ: z,
          maxZ: z + pitch,
        };
        // The ground slab also suppresses grass under the tower.
        emit({
          ...bounds,
          minY: baseY - 0.25,
          maxY: baseY,
        });
        // The ceiling-hung bell needs no central pad in the spiral stairwell.
        if (nearestRadius >= 1.77 || doorLanding) {
          emit({
            ...bounds,
            minY: baseY + tower.height - 0.25,
            maxY: baseY + tower.height + 0.02,
          });
        }
        // Test the nearest corner, not the cell centre: no part of a masonry
        // block may project into the clear circular stair-and-handrail bore.
        if (nearestRadius >= tower.radius - tower.wallThickness) {
          const left = cx - (tower.doorWidth + 0.15) / 2;
          const right = cx + (tower.doorWidth + 0.15) / 2;
          const doorway = bounds.minX < right && bounds.maxX > left && dz > 0;
          if (doorway) {
            for (const side of [{
              ...bounds,
              maxX: Math.min(left, bounds.maxX),
            },
            {
              ...bounds,
              minX: Math.max(right, bounds.minX),
            }]) {
              if (side.maxX > side.minX) {
                emit({
                  ...side,
                  minY: baseY,
                  maxY: baseY + tower.height,
                });
              }
            }
            const aperture = {
              ...bounds,
              minX: Math.max(left, bounds.minX),
              maxX: Math.min(right, bounds.maxX),
            };
            emit({
              ...aperture,
              minY: baseY + tower.doorHeight - 0.05,
              maxY: baseY + tower.terraceElevation,
            });
            emit({
              ...aperture,
              minY: baseY + tower.terraceElevation + tower.doorHeight - 0.05,
              maxY: baseY + tower.height,
            });
          } else {
            emit({
              ...bounds,
              minY: baseY,
              maxY: baseY + tower.height,
            });
          }
          // Belfry openings start above a continuous protective stone sill.
          emit({
            ...bounds,
            minY: baseY + tower.height,
            maxY: baseY + tower.height + 0.85,
          });
          const pier = Math.abs(dx) < 0.45 || Math.abs(dz) < 0.45;
          if (pier) {
            emit({
              ...bounds,
              minY: baseY + tower.height,
              maxY: baseY + tower.height + tower.belfryHeight,
            });
          }
        }
        // Fill the doorway approach continuously, including the former gap
        // between the spiral and the perimeter floor.
        if (nearestRadius >= 1.77 || doorLanding) {
          emit({
            ...bounds,
            minY: baseY + tower.terraceElevation - 0.25,
            maxY: baseY + tower.terraceElevation + 0.02,
          });
        }
        // Cut boundary bricks to the stair bore and the diagonal landing edge.
        // Only boundary cells need fine cuts; ordinary masonry stays quarter-metre.
        if (!doorLanding && nearestRadius < 1.77 && (farthestRadius > 1.77 ||
          (z + pitch >= cz && x + pitch >= -(z + pitch - cz) / Math.sqrt(3) + cx))) {
          const cut = pitch / 32;
          for (let front = z; front < z + pitch - 1e-6; front += cut) {
            const nearestZ = Math.max(0, Math.abs(front + cut / 2 - cz) - cut / 2);
            const boreX = Math.sqrt(Math.max(0, 1.77 ** 2 - nearestZ ** 2));
            const pieces = [
              {
                minX: x,
                maxX: Math.min(x + pitch, cx - boreX),
              },
              {
                minX: Math.max(x, cx + boreX),
                maxX: x + pitch,
              },
            ];
            if (front >= cz) {
              pieces.push({
                minX: Math.max(x, cx - (front - cz) / Math.sqrt(3)),
                maxX: x + pitch,
              });
            }
            // Union overlapping cuts so the top face never flickers.
            pieces.sort(/**
             *
             * @param {{minX:number,maxX:number}} a
             * @param {{minX:number,maxX:number}} b
             */
              (a, b) => a.minX - b.minX);
            const merged = [];
            for (const piece of pieces.filter(/**
             *
             * @param {{minX:number,maxX:number}} p
             */
              p => p.maxX > p.minX + 1e-6)) {
              const previous = merged.at(-1);
              if (previous && previous.maxX >= piece.minX) {
                previous.maxX = Math.max(previous.maxX, piece.maxX);
              } else {
                merged.push({ ...piece });
              }
            }
            for (const piece of merged) {
              for (const elevation of [tower.terraceElevation, tower.height]) {
                emit({
                  ...piece,
                  minZ: front,
                  maxZ: front + cut,
                  minY: baseY + elevation - 0.25,
                  maxY: baseY + elevation + 0.02,
                });
              }
            }
          }
        }
        // Stepped blue cone follows the same masonry-sized silhouette as the castle.
        const coneHeight = tower.roofHeight * (1 - radius / tower.radius);
        if (coneHeight > 0) {
          // Masonry soffit closes the roof underside above the open belfry.
          emit({
            ...bounds,
            minY: baseY + tower.height + tower.belfryHeight - 0.125,
            maxY: baseY + tower.height + tower.belfryHeight,
          });
          emit({
            ...bounds,
            minY: baseY + tower.height + tower.belfryHeight,
            maxY: baseY + tower.height + tower.belfryHeight + Math.max(0.125, coneHeight),
          }, "castleTowerBlue");
        }
      }
    }
  }
}

