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
 * @property {{runtime: {residential?: CastleResidentialMetadata}}} [metadata]
 */

/**
 * @typedef {object} CastleResidentialMetadata
 * @property {{x: number, y: number, z: number, yaw: number}} origin
 * @property {number} facadeDepth
 * @property {number} floorHeight
 * @property {{x: number, y: number, z: number, width: number, depth: number}} workRoom
 * @property {Record<string, CastleRoomBounds>} rooms
 * @property {Record<string, CastleRoomBounds>} reservations
 * @property {CastleWindowPlacement[]} [exteriorWindows]
 * @property {CastleWindowOpening[]} [windowOpenings]
 * @property {Array<{x:number,z:number,baseY:number,topY:number,width:number,depth:number}>} [buttressFootings]
 * @property {Array<{id:string,purpose:string,bounds:CastleRoomBounds,floorY:number,height:number}>} [buildings]
 * @property {Array<{id:string,bounds:CastleRoomBounds,floorY:number}>} [walkableAreas]
 * @property {Array<{x:number,y:number,z:number,yaw:number,width:number,height:number}>} [secondaryDoors]
 * @property {{x: number, y: number, z: number, radius: number, rise: number}} serviceStair
 * @property {{x: number, y: number, z: number, yaw: number, width: number, height: number}} serviceDoor
 * @property {{side: string, offset: number, width: number, approachElevation: number}} serviceEntry
 * @property {number} gatehouseDepth Upper residence depth in world units.
 * @property {{startDepth: number, endDepth: number}} balcony Empty front terrace bounds from the entrance.
 * @property {{x: number, y: number, z: number, width: number, depth: number, height: number, startDepth: number, endDepth: number}} upperRoom
 * @property {{x: number, y: number, z: number, radius: number, rise: number}} stair
 * @property {{x: number, y: number, z: number, yaw: number, width: number, height: number}} [upperDoor]
 * @property {{x: number, y: number, z: number, yaw: number, width: number, height: number}} sideDoor
 * @property {{x: number, y: number, z: number, yaw: number, width: number, depth: number, height: number}} [chimney]
 * @property {{x: number, z: number, floorY: number, ceilingY: number, width: number, depth: number, yaw: number, allowedRole: string}} basement
 */

/**
 * @typedef {object} CastleWindowPlacement
 * @property {string} role
 * @property {{x:number,y:number,z:number}} position
 * @property {{x:number,y:number,z:number}} scale
 * @property {number} yaw
 */

/**
 * @typedef {CastleWindowPlacement & {width:number,height:number,depth:number,min:{x:number,y:number,z:number},max:{x:number,y:number,z:number}}} CastleWindowOpening
 */

/**
 * @typedef {object} CastleRoomBounds
 * @property {number} minX
 * @property {number} maxX
 * @property {number} minZ
 * @property {number} maxZ
 * @property {number} floorY
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
 * @property {string|number} [seed]
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
