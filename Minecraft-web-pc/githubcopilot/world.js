// Perlin noise implementation
class PerlinNoise {
    constructor(seed = 0) {
        this.p = [];
        for (let i = 0; i < 256; i++) this.p[i] = i;
        
        for (let i = 255; i > 0; i--) {
            const j = Math.floor((seed + i) * 73856093) % (i + 1);
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }
        
        this.p = this.p.concat(this.p);
    }
    
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 8 ? y : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    noise(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        
        const a = this.p[X] + Y, aa = this.p[a] + Z, ab = this.p[a + 1] + Z;
        const b = this.p[X + 1] + Y, ba = this.p[b] + Z, bb = this.p[b + 1] + Z;
        
        return this.lerp(w,
            this.lerp(v, this.lerp(u, this.grad(this.p[aa], x, y, z), this.grad(this.p[ba], x - 1, y, z)), this.lerp(u, this.grad(this.p[ab], x, y - 1, z), this.grad(this.p[bb], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.p[aa + 1], x, y, z - 1), this.grad(this.p[ba + 1], x - 1, y, z - 1)), this.lerp(u, this.grad(this.p[ab + 1], x, y - 1, z - 1), this.grad(this.p[bb + 1], x - 1, y - 1, z - 1)))
        );
    }
}

// Block types
const BLOCK_TYPES = {
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
    OAK_LOG: 4,
    DARK_OAK_LOG: 12,
    BIRCH_LOG: 13,
    OAK_LEAVES: 5,
    SPRUCE_LEAVES: 11,
    BIRCH_LEAVES: 14,
    SNOW: 15,
    COAL_ORE: 16,
    IRON_ORE: 17
};

// Block data
const BLOCK_DATA = {
    [BLOCK_TYPES.AIR]: { name: 'Air', color: 0x87CEEB, breakTime: 0, collectible: false },
    [BLOCK_TYPES.GRASS]: { name: 'Grass', color: 0x7CB342, breakTime: 600, collectible: true, drops: BLOCK_TYPES.DIRT },
    [BLOCK_TYPES.DIRT]: { name: 'Dirt', color: 0x8B7355, breakTime: 500, collectible: true },
    [BLOCK_TYPES.STONE]: { name: 'Stone', color: 0x808080, breakTime: 1000, collectible: true, drops: BLOCK_TYPES.COBBLESTONE },
    [BLOCK_TYPES.LOG]: { name: 'Oak Log', color: 0x704214, breakTime: 800, collectible: true },
    [BLOCK_TYPES.LEAVES]: { name: 'Oak Leaves', color: 0x32CD32, breakTime: 200, collectible: false },
    [BLOCK_TYPES.WATER]: { name: 'Water', color: 0x4682B4, breakTime: 0, collectible: false, opacity: 0.6 },
    [BLOCK_TYPES.SAND]: { name: 'Sand', color: 0xEDD5B1, breakTime: 400, collectible: true },
    [BLOCK_TYPES.GRAVEL]: { name: 'Gravel', color: 0x9B9B9B, breakTime: 600, collectible: true },
    [BLOCK_TYPES.COBBLESTONE]: { name: 'Cobblestone', color: 0x737373, breakTime: 800, collectible: true },
    [BLOCK_TYPES.LOG_SPRUCE]: { name: 'Spruce Log', color: 0x5C3A1A, breakTime: 800, collectible: true },
    [BLOCK_TYPES.LEAVES_SPRUCE]: { name: 'Spruce Leaves', color: 0x1B7D1B, breakTime: 200, collectible: false },
    [BLOCK_TYPES.DARK_OAK_LOG]: { name: 'Dark Oak Log', color: 0x3E2723, breakTime: 800, collectible: true },
    [BLOCK_TYPES.BIRCH_LOG]: { name: 'Birch Log', color: 0xDCDCDC, breakTime: 800, collectible: true },
    [BLOCK_TYPES.BIRCH_LEAVES]: { name: 'Birch Leaves', color: 0x7CB342, breakTime: 200, collectible: false },
    [BLOCK_TYPES.SNOW]: { name: 'Snow', color: 0xF0F8FF, breakTime: 300, collectible: true },
    [BLOCK_TYPES.COAL_ORE]: { name: 'Coal Ore', color: 0x3A3A3A, breakTime: 1200, collectible: true },
    [BLOCK_TYPES.IRON_ORE]: { name: 'Iron Ore', color: 0xB89968, breakTime: 1500, collectible: true }
};

class World {
    constructor(seed = 42) {
        this.seed = seed;
        this.perlin = new PerlinNoise(seed);
        this.perlin2 = new PerlinNoise(seed + 1000);
        this.perlin3 = new PerlinNoise(seed + 2000);
        this.blocks = new Map();
        this.meshes = new Map();
        this.chunkSize = 16;
        this.worldHeight = 128;
        this.loadedChunks = new Set();
        
        this.group = new THREE.Group();
        
        // Biome definitions
        this.BIOMES = {
            PLAINS: 0,
            DESERT: 1,
            FOREST: 2,
            MOUNTAIN: 3,
            SNOW: 4
        };
    }
    
    getChunkKey(chunkX, chunkZ) {
        return `${chunkX},${chunkZ}`;
    }
    
    getBlockKey(x, y, z) {
        return `${x},${y},${z}`;
    }
    
    getBiome(x, z) {
        const biomeNoise = this.perlin3.noise(x * 0.005, 0, z * 0.005);
        const tempNoise = this.perlin2.noise(x * 0.003, 0, z * 0.003);
        
        if (biomeNoise < -0.3) return this.BIOMES.DESERT;
        if (biomeNoise < 0) return this.BIOMES.PLAINS;
        if (biomeNoise < 0.3) {
            return tempNoise > 0.2 ? this.BIOMES.SNOW : this.BIOMES.FOREST;
        }
        return this.BIOMES.MOUNTAIN;
    }
    
    getTerrainHeight(x, z) {
        const biome = this.getBiome(x, z);
        let height = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxAmp = 0;
        
        for (let i = 0; i < 4; i++) {
            height += this.perlin.noise(x * frequency * 0.01, 0, z * frequency * 0.01) * amplitude;
            maxAmp += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }
        
        height = (height / maxAmp) * 0.5 + 0.5;
        
        // Biome-specific height variations
        if (biome === this.BIOMES.DESERT) {
            height = height * 0.3 + 60;
        } else if (biome === this.BIOMES.PLAINS) {
            height = height * 0.2 + 62;
        } else if (biome === this.BIOMES.FOREST) {
            height = height * 0.25 + 62;
        } else if (biome === this.BIOMES.MOUNTAIN) {
            height = height * 0.6 + 70;
        } else if (biome === this.BIOMES.SNOW) {
            height = height * 0.4 + 68;
        }
        
        return Math.floor(height);
    }
    
    generateChunk(chunkX, chunkZ) {
        const key = this.getChunkKey(chunkX, chunkZ);
        if (this.loadedChunks.has(key)) return;
        
        const baseX = chunkX * this.chunkSize;
        const baseZ = chunkZ * this.chunkSize;
        
        for (let x = 0; x < this.chunkSize; x++) {
            for (let z = 0; z < this.chunkSize; z++) {
                const worldX = baseX + x;
                const worldZ = baseZ + z;
                const terrainHeight = this.getTerrainHeight(worldX, worldZ);
                const biome = this.getBiome(worldX, worldZ);
                
                // Generate water bodies
                const waterNoise = this.perlin2.noise(worldX * 0.02, 0, worldZ * 0.02);
                const waterLevel = 55;
                const shouldHaveWater = biome !== this.BIOMES.DESERT && biome !== this.BIOMES.MOUNTAIN && waterNoise > 0.4;
                
                for (let y = 0; y < this.worldHeight; y++) {
                    const blockKey = this.getBlockKey(worldX, y, worldZ);
                    let blockType = BLOCK_TYPES.AIR;
                    
                    if (y === 0) blockType = BLOCK_TYPES.STONE;
                    else if (y < terrainHeight - 3) {
                        blockType = BLOCK_TYPES.STONE;
                        
                        // Cave generation with Perlin noise
                        const caveNoise = Math.abs(this.perlin.noise(worldX * 0.05, y * 0.05, worldZ * 0.05));
                        if (caveNoise < 0.4) blockType = BLOCK_TYPES.AIR;
                        
                        // Ore generation
                        const oreNoise = this.perlin2.noise(worldX * 0.2, y * 0.1, worldZ * 0.2);
                        if (caveNoise > 0.4) {
                            if (y < 40 && oreNoise > 0.7) blockType = BLOCK_TYPES.COAL_ORE;
                            if (y < 30 && oreNoise > 0.8) blockType = BLOCK_TYPES.IRON_ORE;
                        }
                    }
                    else if (y < terrainHeight - 1) blockType = BLOCK_TYPES.DIRT;
                    else if (y === terrainHeight - 1) {
                        if (biome === this.BIOMES.DESERT) blockType = BLOCK_TYPES.SAND;
                        else if (biome === this.BIOMES.SNOW) blockType = BLOCK_TYPES.SNOW;
                        else blockType = BLOCK_TYPES.GRASS;
                    }
                    else if (shouldHaveWater && y <= waterLevel) {
                        blockType = BLOCK_TYPES.WATER;
                    }
                    else if (y === terrainHeight && biome === this.BIOMES.DESERT) {
                        // Occasional gravel in desert
                        if (Math.random() < 0.2) blockType = BLOCK_TYPES.GRAVEL;
                    }
                    
                    if (blockType !== BLOCK_TYPES.AIR) {
                        this.blocks.set(blockKey, blockType);
                    }
                }
                
                // Tree generation
                const treeChance = biome === this.BIOMES.DESERT ? 0.005 : biome === this.BIOMES.FOREST ? 0.08 : 0.02;
                if (Math.random() < treeChance && terrainHeight < 100 && !shouldHaveWater) {
                    if (biome === this.BIOMES.DESERT) {
                        this.generateDesertTree(worldX, terrainHeight, worldZ);
                    } else if (biome === this.BIOMES.SNOW) {
                        this.generateSpruceTree(worldX, terrainHeight, worldZ);
                    } else if (biome === this.BIOMES.FOREST) {
                        this.generateTree(worldX, terrainHeight, worldZ);
                    } else {
                        this.generateTree(worldX, terrainHeight, worldZ);
                    }
                }
            }
        }
        
        this.loadedChunks.add(key);
        this.renderChunk(chunkX, chunkZ);
    }
    
    generateTree(x, baseY, z) {
        const height = 4 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < height; i++) {
            const y = baseY + i;
            this.blocks.set(this.getBlockKey(x, y, z), BLOCK_TYPES.LOG);
        }
        
        const foliageY = baseY + height - 2;
        const foliageRadius = 2;
        
        for (let dx = -foliageRadius; dx <= foliageRadius; dx++) {
            for (let dz = -foliageRadius; dz <= foliageRadius; dz++) {
                for (let dy = -1; dy <= 2; dy++) {
                    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 3) {
                        const py = foliageY + dy;
                        if (py > baseY) {
                            const key = this.getBlockKey(x + dx, py, z + dz);
                            if (!this.blocks.has(key)) {
                                this.blocks.set(key, BLOCK_TYPES.LEAVES);
                            }
                        }
                    }
                }
            }
        }
    }
    
    generateSpruceTree(x, baseY, z) {
        const height = 6 + Math.floor(Math.random() * 4);
        
        for (let i = 0; i < height; i++) {
            const y = baseY + i;
            this.blocks.set(this.getBlockKey(x, y, z), BLOCK_TYPES.LOG_SPRUCE);
        }
        
        for (let dy = -2; dy <= 1; dy++) {
            const radius = dy === -2 ? 2 : 1;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) + Math.abs(dz) <= radius) {
                        const key = this.getBlockKey(x + dx, baseY + height - 1 + dy, z + dz);
                        if (!this.blocks.has(key)) {
                            this.blocks.set(key, BLOCK_TYPES.LEAVES_SPRUCE);
                        }
                    }
                }
            }
        }
    }
    
    generateDesertTree(x, baseY, z) {
        // Cactus-like tree
        const height = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < height; i++) {
            this.blocks.set(this.getBlockKey(x, baseY + i, z), BLOCK_TYPES.LOG);
        }
    }
    
    renderChunk(chunkX, chunkZ) {
        const baseX = chunkX * this.chunkSize;
        const baseZ = chunkZ * this.chunkSize;
        
        const geometry = new THREE.BufferGeometry();
        const waterGeometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const waterPositions = [];
        const waterColors = [];
        
        const visited = new Set();
        
        for (let x = baseX; x < baseX + this.chunkSize; x++) {
            for (let z = baseZ; z < baseZ + this.chunkSize; z++) {
                for (let y = 0; y < this.worldHeight; y++) {
                    const blockKey = this.getBlockKey(x, y, z);
                    if (!this.blocks.has(blockKey)) continue;
                    
                    const blockType = this.blocks.get(blockKey);
                    const blockData = BLOCK_DATA[blockType];
                    const color = new THREE.Color(blockData.color);
                    
                    const isWater = blockType === BLOCK_TYPES.WATER;
                    const posArray = isWater ? waterPositions : positions;
                    const colArray = isWater ? waterColors : colors;
                    
                    const faces = [
                        { normal: [0, 1, 0], vertices: [[0,1,0], [1,1,0], [1,1,1], [0,1,1]] },
                        { normal: [0, -1, 0], vertices: [[0,0,0], [0,0,1], [1,0,1], [1,0,0]] },
                        { normal: [1, 0, 0], vertices: [[1,0,0], [1,0,1], [1,1,1], [1,1,0]] },
                        { normal: [-1, 0, 0], vertices: [[0,0,0], [0,1,0], [0,1,1], [0,0,1]] },
                        { normal: [0, 0, 1], vertices: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]] },
                        { normal: [0, 0, -1], vertices: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]] }
                    ];
                    
                    for (const face of faces) {
                        const nx = x + face.normal[0];
                        const ny = y + face.normal[1];
                        const nz = z + face.normal[2];
                        const neighborKey = this.getBlockKey(nx, ny, nz);
                        
                        if (!this.blocks.has(neighborKey)) {
                            for (const vertex of face.vertices) {
                                posArray.push(x + vertex[0], y + vertex[1], z + vertex[2]);
                                colArray.push(color.r, color.g, color.b);
                            }
                        }
                    }
                }
            }
        }
        
        // Regular blocks
        if (positions.length > 0) {
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
            
            const material = new THREE.MeshPhongMaterial({ vertexColors: true });
            const mesh = new THREE.Mesh(geometry, material);
            
            this.group.add(mesh);
            this.meshes.set(this.getChunkKey(chunkX, chunkZ), mesh);
        }
        
        // Water blocks
        if (waterPositions.length > 0) {
            waterGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(waterPositions), 3));
            waterGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(waterColors), 3));
            
            const waterMaterial = new THREE.MeshPhongMaterial({ 
                vertexColors: true, 
                transparent: true, 
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
            
            this.group.add(waterMesh);
            this.meshes.set(this.getChunkKey(chunkX, chunkZ) + '_water', waterMesh);
        }
    }
    
    getBlock(x, y, z) {
        const key = this.getBlockKey(x, y, z);
        return this.blocks.get(key) || BLOCK_TYPES.AIR;
    }
    
    setBlock(x, y, z, blockType) {
        const key = this.getBlockKey(x, y, z);
        
        if (blockType === BLOCK_TYPES.AIR) {
            this.blocks.delete(key);
        } else {
            this.blocks.set(key, blockType);
        }
        
        this.rerenderAffectedChunks(x, y, z);
    }
    
    rerenderAffectedChunks(x, y, z) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const cx = chunkX + dx;
                const cz = chunkZ + dz;
                const key = this.getChunkKey(cx, cz);
                
                // Remove both regular and water meshes
                if (this.meshes.has(key)) {
                    this.group.remove(this.meshes.get(key));
                    this.meshes.delete(key);
                }
                if (this.meshes.has(key + '_water')) {
                    this.group.remove(this.meshes.get(key + '_water'));
                    this.meshes.delete(key + '_water');
                }
                this.loadedChunks.delete(key);
                this.generateChunk(cx, cz);
            }
        }
    }
    
    raycast(origin, direction, maxDistance = 100) {
        let current = origin.clone();
        const step = direction.clone().normalize().multiplyScalar(0.1);
        let distance = 0;
        let lastEmpty = null;
        
        while (distance < maxDistance) {
            const x = Math.floor(current.x);
            const y = Math.floor(current.y);
            const z = Math.floor(current.z);
            
            const block = this.getBlock(x, y, z);
            
            if (block !== BLOCK_TYPES.AIR) {
                return { hit: true, block, pos: { x, y, z }, empty: lastEmpty };
            }
            
            lastEmpty = { x, y, z };
            current.add(step);
            distance += 0.1;
        }
        
        return { hit: false, block: BLOCK_TYPES.AIR };
    }
}
