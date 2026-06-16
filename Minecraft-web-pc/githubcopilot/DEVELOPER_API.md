# 🔧 Developer API Documentation

## Architecture Overview

```
Game
├── Scene (Three.js WebGL)
├── World
│   ├── Terrain Generation
│   ├── Block Management
│   └── Chunk Rendering
├── Player
│   ├── Camera
│   ├── Physics
│   └── Inventory
├── EntityManager
│   ├── Passive Animals
│   └── Hostile Mobs
├── CraftingMenu
│   └── Recipe System
└── Renderer (60 FPS loop)
```

## Core Classes

### `World`
Manages terrain generation and block data.

```javascript
const world = new World(seed);
world.generateChunk(chunkX, chunkZ);
world.getBlock(x, y, z);
world.setBlock(x, y, z, blockType);
world.raycast(origin, direction, maxDistance);
```

**Properties:**
- `blocks`: Map of all blocks in world
- `meshes`: Cached chunk meshes
- `perlin`, `perlin2`, `perlin3`: Noise generators
- `BIOMES`: Biome type constants

**Methods:**
- `getBiome(x, z)`: Get biome at position
- `getTerrainHeight(x, z)`: Get terrain height
- `generateChunk(x, z)`: Generate chunk
- `generateTree(x, y, z)`: Spawn tree at position
- `raycast(origin, dir, dist)`: Cast ray for block hitting

### `Player`
First-person controller with physics.

```javascript
const player = new Player(world);
player.update(deltaTime);
player.getPosition();
player.getLookDirection();
```

**Properties:**
- `camera`: THREE.PerspectiveCamera
- `health`: Player health (0-20)
- `hunger`: Player hunger (0-20)
- `velocity`: Movement velocity
- `isGrounded`: On ground flag

**Physics Constants:**
- `gravity`: 0.0098 units/frame²
- `jumpForce`: 0.15 vertical velocity
- `moveSpeed`: 0.08 units/frame
- `sprintSpeed`: 0.12 units/frame

### `EntityManager`
Spawns and manages all entities.

```javascript
const manager = new EntityManager(world, scene, game);
manager.spawnAnimals(playerPos, timeOfDay);
manager.spawnHostileMobs(playerPos, timeOfDay);
manager.update(deltaTime, playerPos, timeOfDay);
```

**Entity Types:**
- `Sheep`: Passive, 10 HP
- `Cow`: Passive, 20 HP
- `Pig`: Passive, 15 HP
- `Zombie`: Hostile, 25 HP
- `Skeleton`: Hostile, 20 HP

### `CraftingMenu`
Recipe system for crafting.

```javascript
const menu = new CraftingMenu(game);
menu.toggle();
menu.recipes[0].craft(inventory);
```

**Recipe Creation:**
```javascript
new CraftingRecipe(
  name,
  { blockType1: count1, blockType2: count2 },
  outputBlockType,
  outputCount
)
```

### `Game`
Main game loop and state management.

```javascript
const game = new Game();
// Automatically starts on page load
```

**Key Methods:**
- `breakBlock()`: Handle block breaking
- `placeBlock()`: Handle block placement
- `addItemToInventory()`: Add item to inventory
- `updateDayNightCycle()`: Update lighting
- `updateChunks()`: Load chunks around player

## Block Types

```javascript
BLOCK_TYPES = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    LOG: 4,
    LEAVES: 5,
    WATER: 6,
    SAND: 7,
    GRAVEL: 8,
    COBBLESTONE: 9,
    LOG_SPRUCE: 10,
    LEAVES_SPRUCE: 11,
    DARK_OAK_LOG: 12,
    BIRCH_LOG: 13,
    BIRCH_LEAVES: 14,
    SNOW: 15,
    COAL_ORE: 16,
    IRON_ORE: 17
}
```

Each block has data:
```javascript
{
    name: string,
    color: hex (0xRRGGBB),
    breakTime: milliseconds,
    collectible: boolean,
    drops: blockType (optional),
    opacity: 0-1 (optional)
}
```

## Biomes

```javascript
world.BIOMES = {
    PLAINS: 0,      // Moderate, grassland
    DESERT: 1,      // Flat, sandy
    FOREST: 2,      // Dense trees
    MOUNTAIN: 3,    // High, rocky
    SNOW: 4         // Cold, spruce trees
}
```

## Extending the Game

### Add New Block Type

1. **Add to BLOCK_TYPES:**
   ```javascript
   STONE_BRICK: 18
   ```

2. **Add to BLOCK_DATA:**
   ```javascript
   [BLOCK_TYPES.STONE_BRICK]: {
       name: 'Stone Brick',
       color: 0x505050,
       breakTime: 1000,
       collectible: true
   }
   ```

3. **Add to world generation** (in `generateChunk()`):
   ```javascript
   if (someCondition) {
       blockType = BLOCK_TYPES.STONE_BRICK;
   }
   ```

### Add New Crafting Recipe

```javascript
this.recipes.push(
    new CraftingRecipe(
        'Tool',
        { [BLOCK_TYPES.LOG]: 3, [BLOCK_TYPES.DIRT]: 1 },
        BLOCK_TYPES.COBBLESTONE,
        1
    )
);
```

### Add New Entity Type

1. **Create Entity class:**
   ```javascript
   class Wolf extends Entity {
       constructor(x, y, z) {
           super(x, y, z);
           this.health = 20;
           // Create mesh
           const geometry = new THREE.BoxGeometry(...);
           this.mesh = new THREE.Mesh(geometry, material);
       }
       
       update(world, deltaTime, player) {
           // AI logic
       }
   }
   ```

2. **Add to EntityManager:**
   ```javascript
   if (type === 3) entity = new Wolf(x, y, z);
   ```

### Add New Biome

1. **Add to BIOMES:**
   ```javascript
   JUNGLE: 5
   ```

2. **Update `getBiome()`:**
   ```javascript
   if (biomeNoise > 0.6) return this.BIOMES.JUNGLE;
   ```

3. **Update `getTerrainHeight()`:**
   ```javascript
   if (biome === this.BIOMES.JUNGLE) {
       height = height * 0.3 + 65;
   }
   ```

4. **Add generation in `generateChunk()`:**
   ```javascript
   if (biome === this.BIOMES.JUNGLE) {
       // Add jungle-specific trees/blocks
   }
   ```

## Performance Optimization

### Current Optimizations
- Dynamic chunk loading (6 chunk radius)
- Mesh caching per chunk
- Entity despawning at 200 blocks
- Efficient raycasting
- FOV culling with fog

### Future Optimizations
- Frustum culling
- Mesh batching
- Level of detail (LOD)
- Worker threads for generation
- Binary space partitioning (BSP)

## Debug Info

Access in browser console:
```javascript
// Check world data
game.world.blocks.size  // Total blocks

// Check entities
game.entityManager.entities.length

// Check performance
game.renderer.info.render.calls

// Spawn test entities
game.entityManager.entities.push(new Zombie(50, 70, 50))
game.scene.add(game.entityManager.entities[0].mesh)
```

## Input Handling

### Keyboard
- WASD: Stored in `player.keys`
- Other keys: Listen in game.js

### Mouse
- Movement: Stored in `player.mouseX`, `player.mouseY`
- Click: Listen in game.js with `mousedown`/`mouseup`

### Pointer Lock
- Activated on click
- Locked to `document.body`
- Required for smooth look

## Rendering Pipeline

1. **Generate world mesh** → Chunk rendering
2. **Update player** → Physics, collision
3. **Update entities** → AI, movement
4. **Update lighting** → Day/night cycle
5. **Render scene** → Three.js renderer

## File Loading Order

```html
<!-- Dependencies -->
<script src="three.min.js"></script>

<!-- Game modules (in order) -->
<script src="world.js"></script>        <!-- Terrain
<script src="entities.js"></script>     <!-- Mobs
<script src="crafting.js"></script>     <!-- Recipes
<script src="player.js"></script>       <!-- Controller
<script src="game.js"></script>         <!-- Main loop (starts game)
```

## Constants Reference

```javascript
// World
WORLD_HEIGHT: 128              // Max Y coordinate
CHUNK_SIZE: 16                 // Blocks per chunk side
WATER_LEVEL: 55                // Fixed water level

// Physics
GRAVITY: 0.0098               // Down acceleration
JUMP_FORCE: 0.15              // Up velocity
MOVE_SPEED: 0.08              // Default movement
SPRINT_SPEED: 0.12            // Sprinting multiplier
FRICTION: 0.88                // Movement damping
MAX_VELOCITY_Y: 0.4           // Terminal velocity

// Time
DAY_LENGTH: 20000             // Milliseconds (20 sec)
HOUR_CYCLE: 24                // 24 hours per day

// Spawning
ANIMAL_SPAWN_RADIUS: 1-3      // Chunks
HOSTILE_SPAWN_RADIUS: 2-4     // Chunks
DESPAWN_DISTANCE: 200         // Blocks

// Mining
BREAK_PROGRESS_THRESHOLD: 1.0 // Normalized (0-1)
```

---

**This is a complete, documented API for extending the Minecraft clone!**
