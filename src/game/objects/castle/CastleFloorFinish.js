/**
 * Keeps a room's timber finish continuous across structural floor fragments.
 */
export class CastleFloorFinish {
  /**
   * @param {{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} room
   * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}>} buildings
   * @param {Array<{exteriorEntrance:boolean,axis:string,coordinate:number,floorY:number}>} openings
   * @returns {{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}}
   */
  static bounds(room, buildings = [], openings = []) {
    const finish = { ...room };
    for (const building of buildings) {
      if (building.floorY > room.floorY || room.minX < building.minX ||
        room.maxX > building.maxX || room.minZ < building.minZ || room.maxZ > building.maxZ) { continue; }
      for (const edge of ["minX", "maxX", "minZ", "maxZ"]) {
        if (Math.abs(room[edge] - building[edge]) <= 0.125 + 1e-6) {
          finish[edge] = building[edge];
        }
      }
      // Entrance circulation reaches the inside of the gate. The exterior
      // doorstep remains stone; a recessed doorway must not leave a bare strip.
      if (room.id.startsWith("vestibule")) {
        for (const opening of openings) {
          if (!opening.exteriorEntrance || opening.floorY !== room.floorY) { continue; }
          for (const edge of opening.axis === "x" ? ["minX", "maxX"] : ["minZ", "maxZ"]) {
            if (Math.abs(room[edge] - opening.coordinate) <= 0.5 + 1e-6 &&
              Math.abs(building[edge] - opening.coordinate) <= 1e-6) {
              finish[edge] = opening.coordinate;
            }
          }
        }
      }
    }

    return finish;
  }

  /**
   * Joins rectangles only when their union is rectangular, preserving stair holes.
   * @param {number[][]} rectangles
   * @returns {number[][]}
   */
  static merge(rectangles) {
    const result = rectangles.map(/**
     *
     * @param {number[]} rectangle
     */
      (rectangle) => rectangle.slice(0, 4));
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < result.length && !changed; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const a = result[i], b = result[j];
          const sameX = Math.abs(a[0] - b[0]) <= 1e-6 && Math.abs(a[1] - b[1]) <= 1e-6 &&
            Math.max(a[2], b[2]) <= Math.min(a[3], b[3]) + 1e-6;
          const sameZ = Math.abs(a[2] - b[2]) <= 1e-6 && Math.abs(a[3] - b[3]) <= 1e-6 &&
            Math.max(a[0], b[0]) <= Math.min(a[1], b[1]) + 1e-6;
          if (!sameX && !sameZ) { continue; }
          result[i] = [Math.min(a[0], b[0]), Math.max(a[1], b[1]),
            Math.min(a[2], b[2]), Math.max(a[3], b[3])];
          result.splice(j, 1);
          changed = true;
          break;
        }
      }
    }

    return result;
  }
}
