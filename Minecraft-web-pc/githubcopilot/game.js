class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 200, 800);
        
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.player = null;
        
        this.inventory = {
            slots: Array(9).fill(null),
            selectedSlot: 0
        };
        
        this.blockBreaking = {
            isBreaking: false,
            targetBlock: null,
            progress: 0,
            startTime: 0
        };
        
        this.blockPlacing = {
            cooldown: 0
        };
        
        this.setupScene();
        this.setupWorld();
        this.setupPlayer();
        this.setupLighting();
        this.setupEventListeners();
        this.setupInventoryDisplay();
        this.startGameLoop();
    }
    
    setupScene() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupWorld() {
        this.world = new World(42);
        
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                this.world.generateChunk(x, z);
            }
        }
        
        this.scene.add(this.world.group);
        
        // Setup entity manager
        this.entityManager = new EntityManager(this.world, this.scene, this);
        
        // Setup crafting
        this.craftingMenu = new CraftingMenu(this);
    }
    
    setupPlayer() {
        this.player = new Player(this.world);
        this.camera = this.player.camera;
        this.scene.add(this.camera);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.ambientLight = ambientLight;
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 150, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -200;
        directionalLight.shadow.camera.right = 200;
        directionalLight.shadow.camera.top = 200;
        directionalLight.shadow.camera.bottom = -200;
        this.directionalLight = directionalLight;
        this.scene.add(directionalLight);
        
        // Time system
        this.time = {
            current: 6000, // 6 AM
            dayLength: 20000, // 20 seconds = 1 day
            sunYaw: 0
        };
    }
    
    setupEventListeners() {
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        document.addEventListener('keydown', (e) => {
            const key = parseInt(e.key);
            if (key >= 1 && key <= 9) {
                this.selectInventorySlot(key - 1);
            }
            if (e.key.toLowerCase() === 'c') {
                this.craftingMenu.toggle();
            }
        });
    }
    
    setupInventoryDisplay() {
        const inventoryContainer = document.getElementById('inventory');
        inventoryContainer.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.id = `inv-slot-${i}`;
            if (i === 0) slot.classList.add('selected');
            inventoryContainer.appendChild(slot);
        }
        
        this.updateInventoryDisplay();
    }
    
    selectInventorySlot(slot) {
        this.inventory.selectedSlot = slot;
        this.updateInventoryDisplay();
    }
    
    updateInventoryDisplay() {
        for (let i = 0; i < 9; i++) {
            const slotEl = document.getElementById(`inv-slot-${i}`);
            slotEl.classList.toggle('selected', i === this.inventory.selectedSlot);
            
            const item = this.inventory.slots[i];
            slotEl.textContent = item ? `${item.count}x` : '';
        }
        
        const selected = this.inventory.slots[this.inventory.selectedSlot];
        document.getElementById('selected').textContent = selected ? selected.name : 'None';
    }
    
    addItemToInventory(blockType) {
        const blockData = BLOCK_DATA[blockType];
        
        for (let i = 0; i < 9; i++) {
            if (this.inventory.slots[i] && this.inventory.slots[i].type === blockType) {
                this.inventory.slots[i].count++;
                this.updateInventoryDisplay();
                return;
            }
        }
        
        for (let i = 0; i < 9; i++) {
            if (!this.inventory.slots[i]) {
                this.inventory.slots[i] = {
                    type: blockType,
                    name: blockData.name,
                    count: 1
                };
                this.updateInventoryDisplay();
                return;
            }
        }
    }
    
    onMouseDown(e) {
        if (e.button === 0) {
            this.blockBreaking.isBreaking = true;
            this.blockBreaking.startTime = Date.now();
        } else if (e.button === 2) {
            this.placeBlock();
        }
    }
    
    onMouseUp(e) {
        if (e.button === 0) {
            this.blockBreaking.isBreaking = false;
            this.blockBreaking.progress = 0;
            this.blockBreaking.targetBlock = null;
        }
    }
    
    breakBlock() {
        const playerPos = this.player.getPosition();
        const lookDirection = this.player.getLookDirection();
        
        const rayResult = this.world.raycast(playerPos, lookDirection, 6);
        
        if (rayResult.hit) {
            const blockType = rayResult.block;
            const blockData = BLOCK_DATA[blockType];
            
            if (this.blockBreaking.targetBlock !== rayResult.pos) {
                this.blockBreaking.targetBlock = rayResult.pos;
                this.blockBreaking.startTime = Date.now();
                this.blockBreaking.progress = 0;
            }
            
            const elapsed = Date.now() - this.blockBreaking.startTime;
            this.blockBreaking.progress = elapsed / blockData.breakTime;
            
            document.getElementById('mining').textContent = 
                `${blockData.name} (${(this.blockBreaking.progress * 100).toFixed(0)}%)`;
            
            const progressPercent = Math.min(100, this.blockBreaking.progress * 100);
            document.getElementById('breakProgressBar').style.width = progressPercent + '%';
            
            if (this.blockBreaking.progress >= 1) {
                this.world.setBlock(rayResult.pos.x, rayResult.pos.y, rayResult.pos.z, BLOCK_TYPES.AIR);
                
                const dropType = blockData.drops || blockType;
                this.addItemToInventory(dropType);
                
                this.blockBreaking.targetBlock = null;
                this.blockBreaking.progress = 0;
                this.blockBreaking.startTime = Date.now();
            }
        } else {
            this.blockBreaking.progress = 0;
            document.getElementById('mining').textContent = 'None';
            document.getElementById('breakProgressBar').style.width = '0%';
        }
    }
    
    placeBlock() {
        if (this.blockPlacing.cooldown > 0) return;
        
        const selected = this.inventory.slots[this.inventory.selectedSlot];
        if (!selected) return;
        
        const playerPos = this.player.getPosition();
        const lookDirection = this.player.getLookDirection();
        
        const rayResult = this.world.raycast(playerPos, lookDirection, 6);
        
        if (rayResult.hit && rayResult.empty) {
            const placePos = rayResult.empty;
            
            // Don't place inside player
            const playerFeetY = playerPos.y - this.player.height / 2;
            if (placePos.y > playerFeetY - 1 && placePos.y < playerFeetY + 3 &&
                placePos.x > playerPos.x - 1 && placePos.x < playerPos.x + 1 &&
                placePos.z > playerPos.z - 1 && placePos.z < playerPos.z + 1) {
                return;
            }
            
            this.world.setBlock(placePos.x, placePos.y, placePos.z, selected.type);
            
            selected.count--;
            if (selected.count <= 0) {
                this.inventory.slots[this.inventory.selectedSlot] = null;
            }
            
            this.updateInventoryDisplay();
            this.blockPlacing.cooldown = 100;
        }
    }
    
    updateChunks() {
        const playerChunkX = Math.floor(this.player.getPosition().x / this.world.chunkSize);
        const playerChunkZ = Math.floor(this.player.getPosition().z / this.world.chunkSize);
        
        for (let x = playerChunkX - 3; x <= playerChunkX + 3; x++) {
            for (let z = playerChunkZ - 3; z <= playerChunkZ + 3; z++) {
                this.world.generateChunk(x, z);
            }
        }
        
        // Check for zombie damage
        const entities = this.entityManager.getEntities();
        for (const entity of entities) {
            if (entity instanceof Zombie) {
                const distToPlayer = entity.position.distanceTo(this.player.getPosition());
                if (distToPlayer < 3 && entity.attackCooldown <= 0) {
                    this.player.health -= 0.5;
                    entity.attackCooldown = 30;
                }
            }
        }
    }
    
    updateHUD() {
        const pos = this.player.getPosition();
        document.getElementById('pos').textContent = 
            `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        
        // Time display
        const hour = Math.floor((this.time.current / this.time.dayLength) * 24);
        const minute = Math.floor(((this.time.current % (this.time.dayLength / 24)) / (this.time.dayLength / 24)) * 60);
        document.getElementById('time').textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        
        // Health and hunger
        document.getElementById('health').textContent = Math.max(0, Math.floor(this.player.health));
        document.getElementById('hunger').textContent = Math.max(0, Math.floor(this.player.hunger));
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    startGameLoop() {
        const lastTime = performance.now();
        
        const gameLoop = (currentTime) => {
            const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
            
            this.player.update(deltaTime);
            
            // Update time
            this.time.current += deltaTime * 20; // Speed up time
            if (this.time.current >= this.time.dayLength) {
                this.time.current = 0;
            }
            
            // Update lighting based on time
            this.updateDayNightCycle();
            
            if (this.blockBreaking.isBreaking) {
                this.breakBlock();
            } else {
                document.getElementById('mining').textContent = 'None';
                document.getElementById('breakProgressBar').style.width = '0%';
            }
            
            if (this.blockPlacing.cooldown > 0) {
                this.blockPlacing.cooldown--;
            }
            
            this.updateChunks();
            this.updateHUD();
            this.entityManager.update(deltaTime, this.player.getPosition(), this.time.current / this.time.dayLength);
            this.renderer.render(this.scene, this.camera);
            
            requestAnimationFrame(gameLoop);
        };
        
        requestAnimationFrame(gameLoop);
    }
    
    updateDayNightCycle() {
        const progress = this.time.current / this.time.dayLength;
        const hour = progress * 24;
        
        // Sun position
        const sunAngle = (hour - 6) / 12 * Math.PI;
        this.directionalLight.position.x = Math.cos(sunAngle) * 150;
        this.directionalLight.position.y = 80 + Math.sin(sunAngle) * 70;
        
        // Lighting intensity based on time
        let intensity = 1;
        if (hour < 6 || hour > 18) intensity = 0.2; // Night
        else if (hour < 8) intensity = 0.2 + (hour - 6) / 2 * 0.8; // Sunrise
        else if (hour > 16 && hour < 18) intensity = 1 - (hour - 16) / 2 * 0.8; // Sunset
        
        this.directionalLight.intensity = intensity;
        this.ambientLight.intensity = Math.max(0.1, 0.6 * intensity);
        
        // Sky color based on time
        if (hour >= 6 && hour < 18) {
            const dayProg = (hour - 6) / 12;
            const r = 0.53 * dayProg;
            const g = 0.81 * dayProg;
            const b = 0.92 * dayProg;
            this.scene.background.setRGB(r, g, b);
            this.scene.fog.color.setRGB(r, g, b);
        } else {
            this.scene.background.setRGB(0.1, 0.1, 0.2);
            this.scene.fog.color.setRGB(0.1, 0.1, 0.2);
        }
    }
}

window.addEventListener('load', () => {
    const game = new Game();
});
