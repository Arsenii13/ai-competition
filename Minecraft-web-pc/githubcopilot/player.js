class Player {
    constructor(world) {
        this.world = world;
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Position player on terrain
        this.camera.position.set(50, 100, 50);
        
        // Health and food
        this.health = 20;
        this.hunger = 20;
        
        // Physics
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;
        this.canJump = false;
        
        // Player dimensions
        this.height = 1.8;
        this.width = 0.6;
        this.depth = 0.6;
        
        // Constants
        this.gravity = 0.0098;
        this.jumpForce = 0.15;
        this.moveSpeed = 0.08;
        this.sprintSpeed = 0.12;
        this.friction = 0.88;
        this.maxVelocityY = 0.4;
        
        // Input
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        
        this.pitch = 0;
        this.yaw = 0;
        
        this.setupInput();
    }
    
    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        document.addEventListener('mousemove', (e) => {
            this.mouseX += e.movementX * 0.003;
            this.mouseY += e.movementY * 0.003;
            
            this.mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.mouseY));
        });
        
        document.addEventListener('click', () => {
            this.camera.position.target = document.body;
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        });
    }
    
    update(deltaTime) {
        this.handleInput();
        this.updatePhysics(deltaTime);
        this.updateCamera();
    }
    
    handleInput() {
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mouseX);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mouseX);
        
        const isSprinting = this.keys['shift'] && this.isGrounded;
        const speed = isSprinting ? this.sprintSpeed : this.moveSpeed;
        
        let moveVector = new THREE.Vector3(0, 0, 0);
        
        if (this.keys['w']) moveVector.add(forward);
        if (this.keys['s']) moveVector.sub(forward);
        if (this.keys['a']) moveVector.sub(right);
        if (this.keys['d']) moveVector.add(right);
        
        if (moveVector.length() > 0) {
            moveVector.normalize().multiplyScalar(speed);
            this.velocity.x = moveVector.x;
            this.velocity.z = moveVector.z;
        } else {
            this.velocity.x *= this.friction;
            this.velocity.z *= this.friction;
        }
        
        if (this.keys[' '] && this.canJump) {
            this.velocity.y = this.jumpForce;
            this.canJump = false;
            this.isGrounded = false;
        }
    }
    
    updatePhysics(deltaTime) {
        this.velocity.y -= this.gravity;
        this.velocity.y = Math.max(-this.maxVelocityY, this.velocity.y);
        
        const newPos = this.camera.position.clone();
        newPos.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Collision detection
        if (this.isColliding(newPos)) {
            this.handleCollision(newPos);
        } else {
            this.camera.position.copy(newPos);
        }
        
        // Ground detection
        const feetPos = this.camera.position.clone();
        feetPos.y -= this.height / 2 + 0.1;
        
        this.isGrounded = false;
        
        for (let x = Math.floor(feetPos.x - this.width / 2); x <= Math.floor(feetPos.x + this.width / 2); x++) {
            for (let z = Math.floor(feetPos.z - this.depth / 2); z <= Math.floor(feetPos.z + this.depth / 2); z++) {
                const blockBelow = this.world.getBlock(x, Math.floor(feetPos.y), z);
                if (blockBelow !== BLOCK_TYPES.AIR) {
                    this.isGrounded = true;
                    this.velocity.y = 0;
                }
            }
        }
        
        this.canJump = this.isGrounded;
    }
    
    isColliding(newPos) {
        const positions = [
            { x: newPos.x - this.width / 2, y: newPos.y - this.height / 2, z: newPos.z - this.depth / 2 },
            { x: newPos.x + this.width / 2, y: newPos.y - this.height / 2, z: newPos.z - this.depth / 2 },
            { x: newPos.x - this.width / 2, y: newPos.y + this.height / 2, z: newPos.z - this.depth / 2 },
            { x: newPos.x + this.width / 2, y: newPos.y + this.height / 2, z: newPos.z - this.depth / 2 },
            { x: newPos.x - this.width / 2, y: newPos.y - this.height / 2, z: newPos.z + this.depth / 2 },
            { x: newPos.x + this.width / 2, y: newPos.y - this.height / 2, z: newPos.z + this.depth / 2 },
            { x: newPos.x - this.width / 2, y: newPos.y + this.height / 2, z: newPos.z + this.depth / 2 },
            { x: newPos.x + this.width / 2, y: newPos.y + this.height / 2, z: newPos.z + this.depth / 2 }
        ];
        
        for (const pos of positions) {
            const block = this.world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
            if (block !== BLOCK_TYPES.AIR) {
                return true;
            }
        }
        
        return false;
    }
    
    handleCollision(newPos) {
        const diff = newPos.clone().sub(this.camera.position);
        
        // Try moving along individual axes
        const testX = this.camera.position.clone();
        testX.x = newPos.x;
        if (!this.isColliding(testX)) {
            this.camera.position.x = testX.x;
        }
        
        const testY = this.camera.position.clone();
        testY.y = newPos.y;
        if (!this.isColliding(testY)) {
            this.camera.position.y = testY.y;
        } else {
            this.velocity.y = 0;
        }
        
        const testZ = this.camera.position.clone();
        testZ.z = newPos.z;
        if (!this.isColliding(testZ)) {
            this.camera.position.z = testZ.z;
        }
    }
    
    updateCamera() {
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.mouseX;
        this.camera.rotation.x = this.mouseY;
    }
    
    getPosition() {
        return this.camera.position;
    }
    
    getLookDirection() {
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(new THREE.Euler(this.mouseY, this.mouseX, 0, 'YXZ'));
        return direction;
    }
}
