class Entity {
    constructor(x, y, z) {
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.mesh = null;
        this.health = 100;
        this.isAlive = true;
    }
    
    update(world, deltaTime) {}
    
    getMesh() {
        return this.mesh;
    }
}

class Sheep extends Entity {
    constructor(x, y, z) {
        super(x, y, z);
        this.health = 10;
        this.moveTimer = Math.random() * 100;
        this.moveDirection = new THREE.Vector3(0, 0, 0);
        this.moveSpeed = 0.02;
        
        // Create mesh
        const geometry = new THREE.BoxGeometry(0.6, 0.8, 0.6);
        const material = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
    }
    
    update(world, deltaTime, player) {
        this.moveTimer += deltaTime;
        
        // Random walking
        if (this.moveTimer > 2) {
            this.moveTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection.set(Math.cos(angle), 0, Math.sin(angle));
        }
        
        // Move
        const newPos = this.position.clone();
        newPos.add(this.moveDirection.clone().multiplyScalar(this.moveSpeed * deltaTime));
        
        // Check collision with ground
        const footY = Math.floor(newPos.y - 0.4);
        const footBlock = world.getBlock(Math.floor(newPos.x), footY, Math.floor(newPos.z));
        
        if (footBlock !== BLOCK_TYPES.AIR) {
            this.position.copy(newPos);
            this.velocity.y -= 0.01;
            
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }
        }
        
        this.position.y += this.velocity.y * deltaTime;
        this.velocity.y -= 0.02;
        
        this.mesh.position.copy(this.position);
    }
}

class Cow extends Entity {
    constructor(x, y, z) {
        super(x, y, z);
        this.health = 20;
        this.moveTimer = Math.random() * 100;
        this.moveDirection = new THREE.Vector3(0, 0, 0);
        this.moveSpeed = 0.015;
        
        // Create mesh (bigger than sheep)
        const geometry = new THREE.BoxGeometry(0.7, 1.2, 0.7);
        const material = new THREE.MeshPhongMaterial({ color: 0x5C4033 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
    }
    
    update(world, deltaTime, player) {
        this.moveTimer += deltaTime;
        
        if (this.moveTimer > 3) {
            this.moveTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection.set(Math.cos(angle), 0, Math.sin(angle));
        }
        
        const newPos = this.position.clone();
        newPos.add(this.moveDirection.clone().multiplyScalar(this.moveSpeed * deltaTime));
        
        const footY = Math.floor(newPos.y - 0.6);
        const footBlock = world.getBlock(Math.floor(newPos.x), footY, Math.floor(newPos.z));
        
        if (footBlock !== BLOCK_TYPES.AIR) {
            this.position.copy(newPos);
            this.velocity.y -= 0.01;
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }
        }
        
        this.position.y += this.velocity.y * deltaTime;
        this.velocity.y -= 0.02;
        
        this.mesh.position.copy(this.position);
    }
}

class Pig extends Entity {
    constructor(x, y, z) {
        super(x, y, z);
        this.health = 15;
        this.moveTimer = Math.random() * 100;
        this.moveDirection = new THREE.Vector3(0, 0, 0);
        this.moveSpeed = 0.025;
        
        const geometry = new THREE.BoxGeometry(0.5, 0.7, 0.5);
        const material = new THREE.MeshPhongMaterial({ color: 0xFF69B4 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
    }
    
    update(world, deltaTime, player) {
        this.moveTimer += deltaTime;
        
        if (this.moveTimer > 1.5) {
            this.moveTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection.set(Math.cos(angle), 0, Math.sin(angle));
        }
        
        const newPos = this.position.clone();
        newPos.add(this.moveDirection.clone().multiplyScalar(this.moveSpeed * deltaTime));
        
        const footY = Math.floor(newPos.y - 0.35);
        const footBlock = world.getBlock(Math.floor(newPos.x), footY, Math.floor(newPos.z));
        
        if (footBlock !== BLOCK_TYPES.AIR) {
            this.position.copy(newPos);
            this.velocity.y -= 0.01;
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }
        }
        
        this.position.y += this.velocity.y * deltaTime;
        this.velocity.y -= 0.02;
        
        this.mesh.position.copy(this.position);
    }
}

class Zombie extends Entity {
    constructor(x, y, z) {
        super(x, y, z);
        this.health = 25;
        this.moveTimer = Math.random() * 100;
        this.moveDirection = new THREE.Vector3(0, 0, 0);
        this.moveSpeed = 0.015;
        this.targetPlayer = null;
        this.attackTimer = 0;
        this.attackRange = 3;
        this.attackCooldown = 0;
        
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const material = new THREE.MeshPhongMaterial({ color: 0x556B2F });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
    }
    
    update(world, deltaTime, player) {
        const distToPlayer = this.position.distanceTo(player);
        
        // Chase player if close
        if (distToPlayer < 20) {
            const direction = new THREE.Vector3()
                .subVectors(player, this.position)
                .normalize();
            this.moveDirection.copy(direction);
            
            // Attack if close enough
            if (distToPlayer < this.attackRange && this.attackCooldown <= 0) {
                // Player takes damage (handled in game.js)
                this.attackCooldown = 30;
            }
        } else {
            this.moveTimer += deltaTime;
            if (this.moveTimer > 2) {
                this.moveTimer = 0;
                const angle = Math.random() * Math.PI * 2;
                this.moveDirection.set(Math.cos(angle), 0, Math.sin(angle));
            }
        }
        
        this.attackCooldown--;
        
        const newPos = this.position.clone();
        newPos.add(this.moveDirection.clone().multiplyScalar(this.moveSpeed * deltaTime));
        
        const footY = Math.floor(newPos.y - 0.9);
        const footBlock = world.getBlock(Math.floor(newPos.x), footY, Math.floor(newPos.z));
        
        if (footBlock !== BLOCK_TYPES.AIR) {
            this.position.copy(newPos);
            this.velocity.y = 0;
        }
        
        this.position.y += this.velocity.y * deltaTime;
        this.velocity.y -= 0.02;
        
        this.mesh.position.copy(this.position);
    }
}

class Skeleton extends Entity {
    constructor(x, y, z) {
        super(x, y, z);
        this.health = 20;
        this.moveTimer = Math.random() * 100;
        this.moveDirection = new THREE.Vector3(0, 0, 0);
        this.moveSpeed = 0.02;
        this.targetPlayer = null;
        this.shootTimer = 0;
        this.shootRange = 30;
        this.shootCooldown = 0;
        
        const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
        const material = new THREE.MeshPhongMaterial({ color: 0xBBBBBB });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
    }
    
    update(world, deltaTime, player) {
        const distToPlayer = this.position.distanceTo(player);
        
        // Chase and shoot at player if close
        if (distToPlayer < this.shootRange) {
            const direction = new THREE.Vector3()
                .subVectors(player, this.position)
                .normalize();
            this.moveDirection.copy(direction).multiplyScalar(0.5);
            
            // Shoot if aimed at player
            if (this.shootCooldown <= 0) {
                this.shootCooldown = 40;
            }
        } else {
            this.moveTimer += deltaTime;
            if (this.moveTimer > 2) {
                this.moveTimer = 0;
                const angle = Math.random() * Math.PI * 2;
                this.moveDirection.set(Math.cos(angle), 0, Math.sin(angle));
            }
        }
        
        this.shootCooldown--;
        
        const newPos = this.position.clone();
        newPos.add(this.moveDirection.clone().multiplyScalar(this.moveSpeed * deltaTime));
        
        const footY = Math.floor(newPos.y - 0.9);
        const footBlock = world.getBlock(Math.floor(newPos.x), footY, Math.floor(newPos.z));
        
        if (footBlock !== BLOCK_TYPES.AIR) {
            this.position.copy(newPos);
            this.velocity.y = 0;
        }
        
        this.position.y += this.velocity.y * deltaTime;
        this.velocity.y -= 0.02;
        
        this.mesh.position.copy(this.position);
    }
}
}

class EntityManager {
    constructor(world, scene, game) {
        this.world = world;
        this.scene = scene;
        this.game = game;
        this.entities = [];
        this.spawnPoints = new Set();
        this.hostileSpawnPoints = new Set();
    }
    
    spawnAnimals(playerPos, timeOfDay) {
        // Spawn animals in chunks around player (only during day)
        const hour = timeOfDay * 24;
        const isNight = hour < 6 || hour > 18;
        
        const playerChunkX = Math.floor(playerPos.x / 16);
        const playerChunkZ = Math.floor(playerPos.z / 16);
        
        for (let cx = playerChunkX - 1; cx <= playerChunkX + 1; cx++) {
            for (let cz = playerChunkZ - 1; cz <= playerChunkZ + 1; cz++) {
                const key = `${cx},${cz}`;
                
                if (!this.spawnPoints.has(key)) {
                    this.spawnPoints.add(key);
                    
                    if (!isNight) {
                        const count = 2 + Math.floor(Math.random() * 3);
                        for (let i = 0; i < count; i++) {
                            const x = cx * 16 + Math.random() * 16;
                            const z = cz * 16 + Math.random() * 16;
                            const terrainHeight = this.world.getTerrainHeight(x, z);
                            
                            const type = Math.floor(Math.random() * 3);
                            let entity;
                            
                            if (type === 0) entity = new Sheep(x, terrainHeight + 1, z);
                            else if (type === 1) entity = new Cow(x, terrainHeight + 1, z);
                            else entity = new Pig(x, terrainHeight + 1, z);
                            
                            this.entities.push(entity);
                            this.scene.add(entity.mesh);
                        }
                    }
                }
            }
        }
    }
    
    spawnHostileMobs(playerPos, timeOfDay) {
        const hour = timeOfDay * 24;
        const isNight = hour < 6 || hour > 18;
        
        if (!isNight) return;
        
        const playerChunkX = Math.floor(playerPos.x / 16);
        const playerChunkZ = Math.floor(playerPos.z / 16);
        
        for (let cx = playerChunkX - 2; cx <= playerChunkX + 2; cx++) {
            for (let cz = playerChunkZ - 2; cz <= playerChunkZ + 2; cz++) {
                const key = `${cx},${cz}`;
                
                if (!this.hostileSpawnPoints.has(key)) {
                    this.hostileSpawnPoints.add(key);
                    
                    const count = 1 + Math.floor(Math.random() * 2);
                    for (let i = 0; i < count; i++) {
                        const x = cx * 16 + Math.random() * 16;
                        const z = cz * 16 + Math.random() * 16;
                        const terrainHeight = this.world.getTerrainHeight(x, z);
                        
                        const type = Math.floor(Math.random() * 2);
                        let entity;
                        
                        if (type === 0) entity = new Zombie(x, terrainHeight + 1, z);
                        else entity = new Skeleton(x, terrainHeight + 1, z);
                        
                        this.entities.push(entity);
                        this.scene.add(entity.mesh);
                    }
                }
            }
        }
    }
    
    update(deltaTime, playerPos, timeOfDay) {
        this.spawnAnimals(playerPos, timeOfDay);
        this.spawnHostileMobs(playerPos, timeOfDay);
        
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            entity.update(this.world, deltaTime, playerPos);
            
            // Remove if too far away
            const dist = entity.position.distanceTo(playerPos);
            if (dist > 200) {
                this.scene.remove(entity.mesh);
                this.entities.splice(i, 1);
            }
        }
    }
    
    getEntities() {
        return this.entities;
    }
}
