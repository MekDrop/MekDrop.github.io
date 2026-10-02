/**
 * Shared structural JSDoc contracts for map objects.
 *
 * @typedef {{x: number, y: number, z: number}} Point3
 * @typedef {{col: number, row: number}} GridPoint
 * @typedef {{col: number, row: number, elevation?: number, terrainHeight?: number, direction?: string}} RiverCell
 * @typedef {object} MapObjectDefinition
 * @property {string} id
 * @property {string} object
 * @property {Point3} [position]
 * @property {number} [level] Block bottom elevation when position is omitted.
 * @property {boolean} [generated]
 * @property {RenderCommand} [geometry]
 * @property {string} [variant]
 * @property {number} [rotation]
 * @property {Point3} [from] Bookshelf start edge; world Y is the bottom elevation.
 * @property {Point3} [to] Bookshelf end edge; same Y and exactly one differing ground coordinate.
 * @property {number} [height] Bookshelf height; defaults to 1.8.
 * @property {number} [facing] Bookshelf front direction, 1 or -1 on the perpendicular axis.
 * @property {number} [Z1] Spiral staircase lower map elevation (world Y).
 * @property {number} [Z2] Spiral staircase upper map elevation (world Y), above Z1.
 * @property {{col: number, row: number}} [tile]
 * @property {Array<{offsetX: number, offsetZ: number, diameter: number, height: number}>} [parts]
 * @property {string} [script]
 * @property {string|number} [color]
 * @property {{id: string, contents: Array<string>}} [buriedTreasure]
 * @property {{id: string, contents: Array<string>}} [buriedTreasure]
 * @typedef {{method: string, args: Array}} RenderCommand
 * @typedef {object} GameMapData
 * @property {number} cols
 * @property {number} rows
 * @property {string} [mapName]
 * @property {Array<Array<number|string>>} grid
 * @property {Array<Array<number>>} heightmap
 * @property {Array<Array<{shape?: string, overpassId?: string, bridgeGroundHeight?: number, renderMode?: string}>>} [tileMeta]
 * @property {Array<MapObjectDefinition>} [objects]
 * @property {Array<RenderCommand>} [renderCommands]
 * @property {Array<{id?: string, kind?: string, cells: Array<RiverCell>, cascades: Array<RiverCascade>, waterfall: WaterfallDefinition}>} [riverData]
 * @property {PathOverpass} [overpassData]
 * @property {{horizontal: boolean, station: number, cells: Array<{col: number, row: number}>, removedCells: Array<{col: number, row: number}>, nearIsland: string[], farIsland: string[]}} [islandConnectorData]
 * @property {{position: {col: number, row: number, width: number, depth: number}}} [castle]
 * @typedef {object} MapObjectRuntime
 * @property {GameMapData} [mapData]
 * @property {Iterable<MapObjectLike>} [objects]
 * @property {import("playcanvas").Entity} [root]
 * @property {{zoom: number}} [camera]
 * @property {import("src/game/collision/GroundCollisionWorld.js").GroundCollisionWorld} [collisionWorld]
 * @property {import("src/game/rendering/terrain/TerrainInstanceRenderer.js").TerrainInstanceRenderer} [instanceRenderer]
 * @property {number} [sideVariantCount]
 * @property {(value: string) => string} [resolveMaterial]
 * @property {(resolve: (value: string) => string) => void} [setMaterialResolver]
 * @property {() => Array<MapObjectLike>} [getContactProviders]
 * @property {{earth: import("./terrain/EarthSurfaceMaterials.js").EarthSurfaceMaterials, grass: import("./terrain/GrassSurfaceMaterials.js").GrassSurfaceMaterials}} [surfaceMaterials]
 * @property {{carpet: import("./ground-cover/GrassCarpet.js").GrassCarpet, surface: import("./ground-cover/GrassSurface.js").GrassSurface}} [canopy]
 * @property {(definition: MapObjectDefinition) => void} [onObjectRemoved]
 * @property {(error: Error) => void} [onRuntimeError]
 * @property {(position: Point3, radius: number) => Array<Point3>} [getGrassSupportPoints]
 * @typedef {object} MapObjectLike
 * @property {import("playcanvas").Entity} entity
 * @property {MapObjectDefinition} [definition]
 * @property {() => void} destroy
 * @property {(x: number, z: number, radius?: number) => number|null} [surfaceHeightAt]
 * @property {(position: Point3) => InteractionLike|null} [getInteraction]
 * @typedef {object} InteractionLike
 * @property {string} [description]
 * @property {() => void} [begin]
 * @property {(deltaTime: number) => void} [advance]
 * @property {() => void} [cancel]
 * @typedef {object} HeroLike
 * @property {import("playcanvas").Entity} entity
 * @property {Point3} position
 * @property {Point3} facingDirection
 * @property {number} [facing]
 * @property {boolean} [grounded]
 * @property {(interaction: InteractionLike|null) => void} [setInteraction]
 * @typedef {object} HeroActionPayload
 * @property {Point3} [direction]
 * @property {Point3} [targetPosition]
 * @property {number} [remaining]
 * @property {number} [duration]
 * @property {number} [speed]
 * @property {boolean} [positioning]
 * @property {InteractionLike} [interaction]
 * @typedef {object} HeroActionContext
 * @property {HeroActionPayload|null} payload
 * @property {number} deltaTime
 * @property {(action: string, payload: HeroActionPayload|null) => void} transition
 * @property {() => void} finish
 * @property {Point3} [bridgeClimbEnd]
 * @property {number} [dodgeAnimationDuration]
 * @property {number} [edgeRefusalDuration]
 * @property {number} [holeRefusalDuration]
 * @property {number} [blockedDigReactionDuration]
 * @property {number} [repelDuration]
 * @property {number} [repelSpeed]
 * @property {HeroActionFeedback} feedback
 * @property {HeroActionFeedback} feedback
 * @typedef {object} RiverCascade
 * @property {RiverCell} from
 * @property {RiverCell} to
 * @property {string} direction
 * @typedef {object} WaterfallDefinition
 * @property {number} col
 * @property {number} row
 * @property {string} direction
 * @property {number} topElevation
 * @property {number} bottomElevation
 * @typedef {object} RiverTerminal
 * @property {number} radius
 * @property {number} depth
 * @property {number} surfaceElevation
 * @typedef {object} WaterfallJoin
 * @property {Array<Array<number>>} front
 * @property {Array<Array<number>>} rear
 * @property {Array<Array<number>>} uvs
 * @property {Array<Array<number>>} sources
 * @typedef {object} PathOverpass
 * @property {Array<{col: number, row: number, riseDirection: string, lowHeight: number, highHeight: number}>} slopeCells
 * @property {Array<GridPoint>} approachCells
 * @property {Array<GridPoint>} crossingCells
 * @property {{col: number, row: number, width: number}} crossing
 * @property {number} deckElevation
 * @typedef {object} CastleDoorDefinition
 * @property {string} side
 * @property {number} offset
 * @property {number} width
 * @property {number} height
 * @property {string} [kind]
 * @typedef {object} CastleBuildPlan
 * @property {Array<CastleDoorDefinition>} doors
 * @property {Array<{side: string, start: number, end: number}>} walls
 * @property {Array<{x: number, z: number, width: number, depth: number}>} rooms
 * @typedef {object} TerraceActivityState
 * @property {string} [phase]
 * @property {boolean} [active]
 * @property {boolean} [carryingTable]
 * @property {boolean} [carryingTea]
 * @property {number} [bookOpenAmount]
 * @property {Point3} [position]
 * @property {number} [rotation]
 */

export {};
