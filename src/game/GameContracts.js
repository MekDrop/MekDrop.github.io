/**
 * @typedef {object} GridPoint
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [z]
 * @property {number} [col]
 * @property {number} [row]
 */

/**
 * @typedef {object} CastleBuildPlan
 * @property {GameObjectDefinition[]} [objects]
 * @property {GridPoint[]} [collision]
 */

/**
 * @typedef {object} GameMapData
 * @property {number} cols
 * @property {number} rows
 * @property {number[][]} grid
 * @property {number[][]} heightmap
 * @property {TileMetadata[][]} [tileMeta]
 * @property {GameObjectDefinition[]} [objects]
 * @property {import("./objects/ObjectTypes.js").RenderCommand[]} [renderCommands]
 * @property {string} [mapName]
 * @property {CastleLayout} [castle]
 * @property {import("./navigation/WalkingPaths.js").WalkingEntry[]} [entries]
 * @property {{pathIdx: number, entry: import("./navigation/WalkingPaths.js").WalkingEntry, route: import("./navigation/WalkingPaths.js").WalkingPoint[]}[]} [paths]
 * @property {Map<string, Array<{dc: number, dr: number, elevation: number, marker: string, pathIdx: number, surfacePitch: number}>>} [arrowData]
 * @property {{horizontal: boolean, station: number, cells: GridPoint[], removedCells: GridPoint[], nearIsland: string[], farIsland: string[]}} [islandConnectorData]
 */

/**
 * @typedef {object} TileMetadata
 * @property {string} [shape]
 * @property {string} [direction]
 * @property {string} [surfaceType]
 * @property {string} [renderMode]
 * @property {number} [baseHeight]
 * @property {{lowHeight: number, highHeight: number, riseDirection: string}} [slope]
 * @property {{direction: string, elevation: number}} [overpass]
 */

/**
 * @typedef {object} GameObjectDefinition
 * @property {string} id
 * @property {string} [type]
 * @property {GridPoint} [position]
 * @property {string} [category]
 * @property {string} [animation]
 */

/**
 * @typedef {object} GameObjectContract
 * @property {pc.Entity} entity
 * @property {GameObjectDefinition} [definition]
 * @property {GameObjectDefinition} [variantDefinition]
 * @property {() => void} [destroy]
 * @property {(deltaTime: number) => void} [update]
 */

/**
 * @typedef {object} MapObjectOptions
 * @property {GameObjectContract} object
 * @property {GameObjectDefinition} [tile]
 * @property {string} [variant]
 */

/**
 * @typedef {object} MapObjectOptions
 * @property {GameObjectContract} object
 * @property {GameObjectDefinition} [tile]
 * @property {string} [variant]
 */

/**
 * @typedef {object} CastleOpening
 * @property {string} boundary
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} CastleLayout
 * @property {GridPoint} [position]
 * @property {CastleOpening[]} [openings]
 * @property {{centerCol: number, centerRow: number}[]} [doors]
 * @property {string} [style]
 */

/**
 * @typedef {object} CameraState
 * @property {number} [panX]
 * @property {number} [panZ]
 * @property {number} [zoom]
 * @property {number} [rotation]
 * @property {number} [baseOrthoHeight]
 */

/**
 * @typedef {object} CameraPointer
 * @property {number} clientX
 * @property {number} clientY
 * @property {number} [pointerId]
 */

/**
 * @typedef {object} ViewportRect
 * @property {number} width
 * @property {number} height
 * @property {number} [left]
 * @property {number} [top]
 */

/**
 * @typedef {object} InteractionDescription
 * @property {string} [id]
 * @property {string} [label]
 * @property {string} [action]
 * @property {GameObjectContract} [target]
 */

/**
 * @typedef {object} LifecycleOperation
 * @property {AbortSignal} [signal]
 * @property {string} [name]
 * @property {string} [state]
 * @property {number} [startedAt]
 */

/**
 * @typedef {object} RouterContract
 * @property {(location: RouteLocation) => Promise<void>} push
 * @property {(location: RouteLocation) => Promise<void>} replace
 */

/**
 * @typedef {object} RouteLocation
 * @property {string} [name]
 * @property {string} [path]
 * @property {{[key: string]: string}} [query]
 */

/**
 * @typedef {object} StoreContract
 * @property {boolean} [enabled]
 * @property {string} [state]
 * @property {number} [value]
 * @property {(callback: (state: StoreContract) => void) => (() => void)} [$subscribe]
 */

/**
 * @typedef {object} HeroMovementContract
 * @property {pc.Entity} [hero]
 * @property {boolean} [moving]
 * @property {number} [direction]
 * @property {(direction: number, active: boolean) => void} [setDirection]
 * @property {() => void} [jump]
 */

/**
 * @typedef {object} MapGenerationWorld
 * @property {number[][]} [grid]
 * @property {number[][]} [heightmap]
 * @property {TileMetadata[][]} [tileMeta]
 */

/**
 * @typedef {object} MapGenerationRouting
 * @property {GridPoint[]} [route]
 * @property {Set<string>} [mergeZones]
 */

/**
 * @typedef {object} MapGenerationFeatures
 * @property {CastleLayout} [castle]
 * @property {GameObjectDefinition[]} [objects]
 */

/**
 * @typedef {object} MapGenerationOutput
 * @property {GameMapData} [mapData]
 * @property {CastleLayout} [castle]
 * @property {CastleBuildPlan} [buildPlan]
 */

/**
 * @typedef {object} HeroMovementContract
 * @property {pc.Entity} [hero]
 * @property {boolean} [moving]
 * @property {number} [direction]
 * @property {(direction: number, active: boolean) => void} [setDirection]
 * @property {() => void} [jump]
 */

/**
 * @typedef {object} MapGenerationWorld
 * @property {number[][]} [grid]
 * @property {number[][]} [heightmap]
 * @property {TileMetadata[][]} [tileMeta]
 */

/**
 * @typedef {object} MapGenerationRouting
 * @property {GridPoint[]} [route]
 * @property {Set<string>} [mergeZones]
 */

/**
 * @typedef {object} MapGenerationFeatures
 * @property {CastleLayout} [castle]
 * @property {GameObjectDefinition[]} [objects]
 */

/**
 * @typedef {object} MapGenerationOutput
 * @property {GameMapData} [mapData]
 * @property {CastleLayout} [castle]
 * @property {CastleBuildPlan} [buildPlan]
 */

/**
 * @typedef {object} GameActionContract
 * @property {string} [name]
 * @property {boolean} [enabled]
 * @property {() => void|Promise<void>} execute
 */

/**
 * @typedef {object} GameCanvasPluginContext
 * @property {EventTarget} target
 * @property {pc.Entity} container
 * @property {import("./PlayCanvasRenderer.js").PlayCanvasRenderer} renderer
 * @property {RouteLocation} route
 * @property {RouterContract} router
 */

/**
 * @typedef {object} GameCanvasPluginEntry
 * @property {string} module
 * @property {string} exportName
 * @property {{[key: string]: string|number|boolean|null}} [requires]
 * @property {string} [queryParameter]
 */

/**
 * @typedef {object} MaterialDefinition
 * @property {string} [texture]
 * @property {number} [color]
 * @property {number} [gloss]
 * @property {number} [scaleU]
 * @property {number} [scaleV]
 * @property {boolean} [flipU]
 * @property {boolean} [flipV]
 */

export {}
