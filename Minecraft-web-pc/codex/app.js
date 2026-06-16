const canvas = document.getElementById("game");
const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
const overlay = document.getElementById("overlay");
const playButton = document.getElementById("playButton");
const hotbarEl = document.getElementById("hotbar");
const mineMeter = document.getElementById("mineMeter");
const mineFill = mineMeter.querySelector("span");
const targetNameEl = document.getElementById("targetName");
const coordsEl = document.getElementById("coords");

if (!gl) {
  overlay.querySelector("p").textContent = "This browser could not start WebGL 2.";
  throw new Error("WebGL 2 is required.");
}

const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  LOG: 4,
  LEAVES: 5,
  WATER: 6,
  SAND: 7,
};

const BLOCKS = {
  [BLOCK.GRASS]: { name: "Grass", solid: true, hardness: 0.9, drop: BLOCK.DIRT, placeable: true },
  [BLOCK.DIRT]: { name: "Dirt", solid: true, hardness: 0.75, drop: BLOCK.DIRT, placeable: true },
  [BLOCK.STONE]: { name: "Stone", solid: true, hardness: 1.75, drop: BLOCK.STONE, placeable: true },
  [BLOCK.LOG]: { name: "Log", solid: true, hardness: 1.3, drop: BLOCK.LOG, placeable: true },
  [BLOCK.LEAVES]: { name: "Leaves", solid: true, hardness: 0.45, drop: BLOCK.LEAVES, placeable: true },
  [BLOCK.WATER]: { name: "Water", solid: false, hardness: 999, drop: BLOCK.AIR, placeable: false, transparent: true },
  [BLOCK.SAND]: { name: "Sand", solid: true, hardness: 0.7, drop: BLOCK.SAND, placeable: true },
};

const FACE_NAMES = ["east", "west", "top", "bottom", "south", "north"];
const WORLD_SIZE = 96;
const HALF_WORLD = WORLD_SIZE / 2;
const WATER_LEVEL = 14;
const MAX_HEIGHT = 30;
const REACH = 6;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.31;
const EPS = 0.001;

const textureTiles = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  logSide: 4,
  logTop: 5,
  leaves: 6,
  water: 7,
  sand: 8,
};

const blockFaceTile = {
  [BLOCK.GRASS]: { top: textureTiles.grassTop, bottom: textureTiles.dirt, side: textureTiles.grassSide },
  [BLOCK.DIRT]: { all: textureTiles.dirt },
  [BLOCK.STONE]: { all: textureTiles.stone },
  [BLOCK.LOG]: { top: textureTiles.logTop, bottom: textureTiles.logTop, side: textureTiles.logSide },
  [BLOCK.LEAVES]: { all: textureTiles.leaves },
  [BLOCK.WATER]: { all: textureTiles.water },
  [BLOCK.SAND]: { all: textureTiles.sand },
};

const world = new Map();
let mesh = null;
let meshDirty = true;
let waterMesh = null;
let waterMeshDirty = true;
let lastTime = performance.now();
let hovered = null;
let mining = false;
let miningTargetKey = "";
let miningProgress = 0;
let selectedSlot = 0;
let pointerLocked = false;

const keys = new Set();
const player = {
  pos: { x: 0, y: 28, z: 0 },
  vel: { x: 0, y: 0, z: 0 },
  yaw: -Math.PI / 4,
  pitch: -0.18,
  grounded: false,
};

const inventory = [
  { block: BLOCK.DIRT, count: 0 },
  { block: BLOCK.STONE, count: 0 },
  { block: BLOCK.LOG, count: 0 },
  { block: BLOCK.LEAVES, count: 0 },
  { block: BLOCK.SAND, count: 0 },
  null,
  null,
  null,
  null,
];

const faces = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]] },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] },
  { n: [0, 0, -1], v: [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0]] },
];

const vertexSource = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec2 aUv;
in float aBlockLight;

uniform mat4 uProjection;
uniform mat4 uView;
uniform vec3 uSunDir;

out vec2 vUv;
out float vLight;
out float vDistance;

void main() {
  vec4 viewPos = uView * vec4(aPosition, 1.0);
  float sun = max(dot(normalize(aNormal), normalize(uSunDir)), 0.0);
  vLight = aBlockLight * (0.62 + sun * 0.42);
  vUv = aUv;
  vDistance = length(viewPos.xyz);
  gl_Position = uProjection * viewPos;
}
`;

const fragmentSource = `#version 300 es
precision highp float;

uniform sampler2D uAtlas;
uniform vec3 uFogColor;
uniform float uAlpha;

in vec2 vUv;
in float vLight;
in float vDistance;

out vec4 outColor;

void main() {
  vec4 tex = texture(uAtlas, vUv);
  vec3 color = tex.rgb * vLight;
  float fog = smoothstep(55.0, 132.0, vDistance);
  color = mix(color, uFogColor, fog);
  outColor = vec4(color, tex.a * uAlpha);
}
`;

const lineVertexSource = `#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uProjection;
uniform mat4 uView;

void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}
`;

const lineFragmentSource = `#version 300 es
precision highp float;

uniform vec4 uColor;

out vec4 outColor;

void main() {
  outColor = uColor;
}
`;


const shaderProgram = makeProgram(gl, vertexSource, fragmentSource);
const attribs = {
  position: gl.getAttribLocation(shaderProgram, "aPosition"),
  normal: gl.getAttribLocation(shaderProgram, "aNormal"),
  uv: gl.getAttribLocation(shaderProgram, "aUv"),
  blockLight: gl.getAttribLocation(shaderProgram, "aBlockLight"),
};
const uniforms = {
  projection: gl.getUniformLocation(shaderProgram, "uProjection"),
  view: gl.getUniformLocation(shaderProgram, "uView"),
  atlas: gl.getUniformLocation(shaderProgram, "uAtlas"),
  sunDir: gl.getUniformLocation(shaderProgram, "uSunDir"),
  fogColor: gl.getUniformLocation(shaderProgram, "uFogColor"),
  camera: gl.getUniformLocation(shaderProgram, "uCamera"),
  alpha: gl.getUniformLocation(shaderProgram, "uAlpha"),
};
const atlasTexture = createAtlasTexture();
const lineProgram = makeProgram(gl, lineVertexSource, lineFragmentSource);
const lineAttribs = {
  position: gl.getAttribLocation(lineProgram, "aPosition"),
};
const lineUniforms = {
  projection: gl.getUniformLocation(lineProgram, "uProjection"),
  view: gl.getUniformLocation(lineProgram, "uView"),
  color: gl.getUniformLocation(lineProgram, "uColor"),
};
const outlineBuffer = gl.createBuffer();

init();

function init() {
  generateWorld();
  player.pos = findSpawn();
  renderHotbar();
  bindEvents();

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.55, 0.76, 0.93, 1);

  requestAnimationFrame(loop);
}

function bindEvents() {
  playButton.addEventListener("click", () => canvas.requestPointerLock());
  canvas.addEventListener("click", () => {
    if (!pointerLocked) canvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
    overlay.classList.toggle("hidden", pointerLocked);
    if (!pointerLocked) mining = false;
  });
  document.addEventListener("mousemove", (event) => {
    if (!pointerLocked) return;
    player.yaw -= event.movementX * 0.0022;
    player.pitch -= event.movementY * 0.0022;
    player.pitch = clamp(player.pitch, -1.52, 1.52);
  });
  document.addEventListener("keydown", (event) => {
    keys.add(event.code);
    const index = Number.parseInt(event.key, 10) - 1;
    if (index >= 0 && index < 9) {
      selectedSlot = index;
      renderHotbar();
    }
  });
  document.addEventListener("keyup", (event) => keys.delete(event.code));
  canvas.addEventListener("mousedown", (event) => {
    if (!pointerLocked) return;
    if (event.button === 0) mining = true;
    if (event.button === 2) placeSelectedBlock();
  });
  document.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
      mining = false;
      miningProgress = 0;
      miningTargetKey = "";
    }
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    if (!pointerLocked) return;
    event.preventDefault();
    selectedSlot = (selectedSlot + (event.deltaY > 0 ? 1 : 8)) % 9;
    renderHotbar();
  }, { passive: false });
  window.addEventListener("resize", resize);
  resize();
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  updatePlayer(dt);
  hovered = raycast(playerEye(), lookDirection(), REACH);
  updateMining(dt);
  coordsEl.textContent = `${Math.floor(player.pos.x)} ${Math.floor(player.pos.y)} ${Math.floor(player.pos.z)}`;
}

function updatePlayer(dt) {
  const forward = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) };
  const right = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
  let ix = 0;
  let iz = 0;
  if (keys.has("KeyW")) {
    ix += forward.x;
    iz += forward.z;
  }
  if (keys.has("KeyS")) {
    ix -= forward.x;
    iz -= forward.z;
  }
  if (keys.has("KeyD")) {
    ix += right.x;
    iz += right.z;
  }
  if (keys.has("KeyA")) {
    ix -= right.x;
    iz -= right.z;
  }
  const len = Math.hypot(ix, iz) || 1;
  ix /= len;
  iz /= len;

  const targetSpeed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.0 : 4.35;
  const accel = player.grounded ? 42 : 13;
  player.vel.x = approach(player.vel.x, ix * targetSpeed, accel * dt);
  player.vel.z = approach(player.vel.z, iz * targetSpeed, accel * dt);
  player.vel.y -= 24 * dt;
  if (keys.has("Space") && player.grounded) {
    player.vel.y = 8.4;
    player.grounded = false;
  }

  moveAxis("x", player.vel.x * dt);
  moveAxis("z", player.vel.z * dt);
  player.grounded = false;
  moveAxis("y", player.vel.y * dt);
  if (player.pos.y < -12) {
    player.pos = findSpawn();
    player.vel = { x: 0, y: 0, z: 0 };
  }
}

function moveAxis(axis, amount) {
  if (amount === 0) return;
  player.pos[axis] += amount;
  const hit = firstCollision();
  if (!hit) return;

  if (amount > 0) {
    if (axis === "x") player.pos.x = hit.x - PLAYER_RADIUS - EPS;
    if (axis === "z") player.pos.z = hit.z - PLAYER_RADIUS - EPS;
    if (axis === "y") player.pos.y = hit.y - PLAYER_HEIGHT - EPS;
  } else {
    if (axis === "x") player.pos.x = hit.x + 1 + PLAYER_RADIUS + EPS;
    if (axis === "z") player.pos.z = hit.z + 1 + PLAYER_RADIUS + EPS;
    if (axis === "y") {
      player.pos.y = hit.y + 1 + EPS;
      player.grounded = true;
    }
  }
  player.vel[axis] = 0;
}

function firstCollision() {
  const minX = Math.floor(player.pos.x - PLAYER_RADIUS);
  const maxX = Math.floor(player.pos.x + PLAYER_RADIUS);
  const minY = Math.floor(player.pos.y);
  const maxY = Math.floor(player.pos.y + PLAYER_HEIGHT);
  const minZ = Math.floor(player.pos.z - PLAYER_RADIUS);
  const maxZ = Math.floor(player.pos.z + PLAYER_RADIUS);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = getBlock(x, y, z);
        if (BLOCKS[block]?.solid) return { x, y, z };
      }
    }
  }
  return null;
}

function updateMining(dt) {
  if (!hovered || hovered.block === BLOCK.WATER) {
    targetNameEl.textContent = "Ready";
    miningProgress = 0;
    miningTargetKey = "";
    mineMeter.classList.remove("active");
    return;
  }

  const blockInfo = BLOCKS[hovered.block];
  targetNameEl.textContent = blockInfo.name;

  if (!mining) {
    miningProgress = 0;
    miningTargetKey = "";
    mineMeter.classList.remove("active");
    return;
  }

  const targetKey = keyOf(hovered.x, hovered.y, hovered.z);
  if (targetKey !== miningTargetKey) {
    miningTargetKey = targetKey;
    miningProgress = 0;
  }

  miningProgress += dt / blockInfo.hardness;
  mineMeter.classList.add("active");
  mineFill.style.width = `${clamp(miningProgress, 0, 1) * 100}%`;

  if (miningProgress >= 1) {
    addInventory(blockInfo.drop, 1);
    setBlock(hovered.x, hovered.y, hovered.z, BLOCK.AIR);
    miningProgress = 0;
    miningTargetKey = "";
    meshDirty = true;
    waterMeshDirty = true;
    renderHotbar();
  }
}

function placeSelectedBlock() {
  if (!hovered) return;
  const slot = inventory[selectedSlot];
  if (!slot || slot.count <= 0 || !BLOCKS[slot.block]?.placeable) return;

  const x = hovered.x + hovered.normal[0];
  const y = hovered.y + hovered.normal[1];
  const z = hovered.z + hovered.normal[2];
  if (getBlock(x, y, z) !== BLOCK.AIR && getBlock(x, y, z) !== BLOCK.WATER) return;
  if (aabbIntersectsBlock(x, y, z)) return;

  setBlock(x, y, z, slot.block);
  slot.count -= 1;
  meshDirty = true;
  waterMeshDirty = true;
  renderHotbar();
}

function aabbIntersectsBlock(x, y, z) {
  return player.pos.x + PLAYER_RADIUS > x &&
    player.pos.x - PLAYER_RADIUS < x + 1 &&
    player.pos.y + PLAYER_HEIGHT > y &&
    player.pos.y < y + 1 &&
    player.pos.z + PLAYER_RADIUS > z &&
    player.pos.z - PLAYER_RADIUS < z + 1;
}

function addInventory(block, count) {
  if (!block || count <= 0) return;
  let emptyIndex = -1;
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i]?.block === block) {
      inventory[i].count += count;
      return;
    }
    if (!inventory[i] && emptyIndex === -1) emptyIndex = i;
  }
  if (emptyIndex !== -1) inventory[emptyIndex] = { block, count };
}

function generateWorld() {
  const heights = new Map();
  for (let x = -HALF_WORLD; x < HALF_WORLD; x++) {
    for (let z = -HALF_WORLD; z < HALF_WORLD; z++) {
      const ridge = fbm(x * 0.018 + 81, z * 0.018 - 17, 5);
      const detail = fbm(x * 0.06 - 9, z * 0.06 + 11, 3);
      let height = Math.floor(15 + ridge * 10 + detail * 3);
      const river = Math.abs(noise2D(x * 0.018 + 240, z * 0.018 - 73));
      if (river < 0.08) height -= Math.floor((0.08 - river) * 42);
      height = clamp(height, 8, MAX_HEIGHT);
      heights.set(key2(x, z), height);

      for (let y = 0; y <= height; y++) {
        const depth = height - y;
        let block = BLOCK.STONE;
        if (y === height) block = height <= WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
        else if (depth < 4) block = height <= WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.DIRT;
        setBlock(x, y, z, block, false);
      }
      for (let y = height + 1; y <= WATER_LEVEL; y++) {
        setBlock(x, y, z, BLOCK.WATER, false);
      }
    }
  }

  for (let x = -HALF_WORLD + 4; x < HALF_WORLD - 4; x++) {
    for (let z = -HALF_WORLD + 4; z < HALF_WORLD - 4; z++) {
      const h = heights.get(key2(x, z));
      if (h <= WATER_LEVEL + 1 || getBlock(x, h, z) !== BLOCK.GRASS) continue;
      const treeNoise = noise2D(x * 0.19 + 300, z * 0.19 - 90);
      const spacing = Math.abs(noise2D(x * 0.09 - 25, z * 0.09 + 60));
      if (treeNoise > 0.72 && spacing > 0.18) {
        makeTree(x, h + 1, z);
      }
    }
  }
}

function makeTree(x, y, z) {
  const height = 4 + Math.floor(rand2(x, z) * 3);
  for (let i = 0; i < height; i++) setBlock(x, y + i, z, BLOCK.LOG, false);
  const crownBase = y + height - 2;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 0; dy <= 3; dy++) {
        const dist = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - 1);
        if (dist > 4) continue;
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && rand3(x + dx, crownBase + dy, z + dz) < 0.45) continue;
        const bx = x + dx;
        const by = crownBase + dy;
        const bz = z + dz;
        if (getBlock(bx, by, bz) === BLOCK.AIR) setBlock(bx, by, bz, BLOCK.LEAVES, false);
      }
    }
  }
}

function findSpawn() {
  let best = { x: 2.5, y: 32, z: 2.5 };
  let bestScore = -Infinity;
  for (let x = -8; x <= 8; x++) {
    for (let z = -8; z <= 8; z++) {
      const y = highestSolid(x, z);
      const block = getBlock(x, y, z);
      const score = (block === BLOCK.GRASS ? 20 : 0) - Math.hypot(x, z) + y * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = { x: x + 0.5, y: y + 1.02, z: z + 0.5 };
      }
    }
  }
  return best;
}

function draw() {
  if (meshDirty) {
    mesh = buildMesh(false);
    meshDirty = false;
  }
  if (waterMeshDirty) {
    waterMesh = buildMesh(true);
    waterMeshDirty = false;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(shaderProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
  gl.uniform1i(uniforms.atlas, 0);

  const projection = mat4Perspective(Math.PI / 3, canvas.width / canvas.height, 0.05, 220);
  const eye = playerEye();
  const center = add3(eye, lookDirection());
  const view = mat4LookAt(eye, center, { x: 0, y: 1, z: 0 });
  gl.uniformMatrix4fv(uniforms.projection, false, projection);
  gl.uniformMatrix4fv(uniforms.view, false, view);
  gl.uniform3f(uniforms.sunDir, -0.45, 0.85, -0.28);
  gl.uniform3f(uniforms.fogColor, 0.55, 0.76, 0.93);
  gl.uniform3f(uniforms.camera, eye.x, eye.y, eye.z);

  gl.disable(gl.BLEND);
  gl.depthMask(true);
  gl.uniform1f(uniforms.alpha, 1);
  drawMesh(mesh);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.uniform1f(uniforms.alpha, 0.66);
  drawMesh(waterMesh);
  gl.depthMask(true);
  gl.disable(gl.BLEND);

  drawBlockOutline(projection, view);
}

function drawMesh(currentMesh) {
  if (!currentMesh || currentMesh.count === 0) return;
  gl.bindVertexArray(currentMesh.vao);
  gl.drawArrays(gl.TRIANGLES, 0, currentMesh.count);
  gl.bindVertexArray(null);
}

function drawBlockOutline(projection, view) {
  if (!hovered) return;
  const vertices = outlineVertices(hovered.x, hovered.y, hovered.z);
  gl.useProgram(lineProgram);
  gl.uniformMatrix4fv(lineUniforms.projection, false, projection);
  gl.uniformMatrix4fv(lineUniforms.view, false, view);
  gl.uniform4f(lineUniforms.color, 0.08, 0.08, 0.06, 0.82);
  gl.bindBuffer(gl.ARRAY_BUFFER, outlineBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(lineAttribs.position);
  gl.vertexAttribPointer(lineAttribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.LINES, 0, vertices.length / 3);
  gl.disable(gl.BLEND);
  gl.enable(gl.CULL_FACE);
}

function outlineVertices(x, y, z) {
  const o = 0.003;
  const x0 = x - o;
  const y0 = y - o;
  const z0 = z - o;
  const x1 = x + 1 + o;
  const y1 = y + 1 + o;
  const z1 = z + 1 + o;
  return [
    x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1,
    x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
    x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1,
    x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
    x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0,
    x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1,
  ];
}

function buildMesh(waterOnly) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const lights = [];

  for (const [key, block] of world) {
    const isWater = block === BLOCK.WATER;
    if (waterOnly !== isWater) continue;
    const [x, y, z] = key.split(",").map(Number);
    if (block === BLOCK.AIR) continue;

    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      const neighbor = getBlock(x + face.n[0], y + face.n[1], z + face.n[2]);
      if (isFaceHidden(block, neighbor, isWater)) continue;
      const tile = tileForFace(block, FACE_NAMES[i]);
      addFace(positions, normals, uvs, lights, x, y, z, face, tile, ambientAt(x, y, z, face.n));
    }
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const bufferData = [
    { data: new Float32Array(positions), size: 3, loc: attribs.position },
    { data: new Float32Array(normals), size: 3, loc: attribs.normal },
    { data: new Float32Array(uvs), size: 2, loc: attribs.uv },
    { data: new Float32Array(lights), size: 1, loc: attribs.blockLight },
  ];
  for (const item of bufferData) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, item.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(item.loc);
    gl.vertexAttribPointer(item.loc, item.size, gl.FLOAT, false, 0, 0);
  }
  gl.bindVertexArray(null);
  return { vao, count: positions.length / 3 };
}

function isFaceHidden(block, neighbor, isWater) {
  if (neighbor === BLOCK.AIR) return false;
  if (isWater) return neighbor === BLOCK.WATER;
  if (neighbor === BLOCK.WATER) return false;
  return Boolean(BLOCKS[neighbor]?.solid);
}

function tileForFace(block, faceName) {
  const map = blockFaceTile[block];
  if (map.all !== undefined) return map.all;
  if (faceName === "top") return map.top;
  if (faceName === "bottom") return map.bottom;
  return map.side;
}

function addFace(positions, normals, uvs, lights, x, y, z, face, tile, light) {
  const uv = tileUv(tile);
  for (const vertexIndex of [0, 1, 2, 0, 2, 3]) {
    const vertex = face.v[vertexIndex];
    positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    normals.push(face.n[0], face.n[1], face.n[2]);
    uvs.push(uv[vertexIndex][0], uv[vertexIndex][1]);
    lights.push(light);
  }
}

function ambientAt(x, y, z, n) {
  let light = n[1] > 0 ? 1 : n[1] < 0 ? 0.48 : 0.72;
  if (n[1] <= 0 && getBlock(x, y + 1, z) !== BLOCK.AIR) light *= 0.82;
  return light;
}

function createAtlasTexture() {
  const tile = 16;
  const cols = 4;
  const rows = 3;
  const atlas = document.createElement("canvas");
  atlas.width = cols * tile;
  atlas.height = rows * tile;
  const ctx = atlas.getContext("2d");

  drawTile(ctx, textureTiles.grassTop, (x, y, r) => mixColor([73, 150, 45], [105, 176, 55], r + rand2(x, y) * 0.25));
  drawTile(ctx, textureTiles.grassSide, (x, y, r) => y < 4 ? mixColor([62, 141, 40], [96, 166, 52], r) : mixColor([106, 75, 42], [128, 91, 53], r + rand2(x, y) * 0.2));
  drawTile(ctx, textureTiles.dirt, (x, y, r) => mixColor([101, 68, 39], [145, 96, 55], r + rand2(x, y) * 0.2));
  drawTile(ctx, textureTiles.stone, (x, y, r) => mixColor([92, 96, 94], [133, 137, 132], r + rand2(x, y) * 0.22));
  drawTile(ctx, textureTiles.logSide, (x, y, r) => mixColor([91, 57, 27], [134, 84, 38], (x % 5 === 0 ? 0.1 : r) + rand2(x, y) * 0.12));
  drawTile(ctx, textureTiles.logTop, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    return mixColor([117, 80, 43], [176, 130, 74], (Math.sin(d * 2.5) + 1) * 0.18 + r * 0.35);
  });
  drawTile(ctx, textureTiles.leaves, (x, y, r) => {
    const dark = (x + y) % 5 === 0;
    return mixColor(dark ? [42, 93, 33] : [54, 123, 39], [85, 156, 48], r + rand2(x, y) * 0.25);
  });
  drawTile(ctx, textureTiles.water, (x, y, r) => mixColor([54, 126, 190], [84, 165, 218], r + (Math.sin((x + y) * 0.8) + 1) * 0.08));
  drawTile(ctx, textureTiles.sand, (x, y, r) => mixColor([174, 153, 91], [214, 194, 122], r + rand2(x, y) * 0.18));

  function drawTile(context, index, picker) {
    const ox = (index % cols) * tile;
    const oy = Math.floor(index / cols) * tile;
    for (let y = 0; y < tile; y++) {
      for (let x = 0; x < tile; x++) {
        const c = picker(x, y, rand2(x + index * 19, y - index * 31));
        context.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        context.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function tileUv(tile) {
  const cols = 4;
  const rows = 3;
  const margin = 0.001;
  const tx = tile % cols;
  const ty = Math.floor(tile / cols);
  const u0 = tx / cols + margin;
  const v0 = ty / rows + margin;
  const u1 = (tx + 1) / cols - margin;
  const v1 = (ty + 1) / rows - margin;
  return [[u1, v1], [u1, v0], [u0, v0], [u0, v1]];
}

function raycast(origin, direction, maxDistance) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(direction.x) || 1;
  const stepY = Math.sign(direction.y) || 1;
  const stepZ = Math.sign(direction.z) || 1;
  const tDeltaX = Math.abs(1 / (direction.x || 0.000001));
  const tDeltaY = Math.abs(1 / (direction.y || 0.000001));
  const tDeltaZ = Math.abs(1 / (direction.z || 0.000001));
  let tMaxX = intBound(origin.x, direction.x);
  let tMaxY = intBound(origin.y, direction.y);
  let tMaxZ = intBound(origin.z, direction.z);
  let normal = [0, 0, 0];
  let dist = 0;

  while (dist <= maxDistance) {
    const block = getBlock(x, y, z);
    if (block !== BLOCK.AIR && block !== BLOCK.WATER) return { x, y, z, block, normal };
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
        normal = [-stepX, 0, 0];
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = [0, 0, -stepZ];
      }
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      dist = tMaxY;
      tMaxY += tDeltaY;
      normal = [0, -stepY, 0];
    } else {
      z += stepZ;
      dist = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, -stepZ];
    }
  }
  return null;
}

function intBound(s, ds) {
  if (ds < 0) return intBound(-s, -ds);
  s = mod(s, 1);
  return (1 - s) / ds;
}

function playerEye() {
  return { x: player.pos.x, y: player.pos.y + 1.62, z: player.pos.z };
}

function lookDirection() {
  const cp = Math.cos(player.pitch);
  return {
    x: Math.sin(player.yaw) * cp,
    y: Math.sin(player.pitch),
    z: Math.cos(player.yaw) * cp,
  };
}

function renderHotbar() {
  hotbarEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement("div");
    slot.className = `slot${i === selectedSlot ? " selected" : ""}`;
    const key = document.createElement("span");
    key.className = "key";
    key.textContent = String(i + 1);
    slot.appendChild(key);
    const item = inventory[i];
    if (item) {
      const icon = document.createElement("span");
      icon.className = "icon";
      icon.style.background = iconStyle(item.block);
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = item.count > 0 ? String(item.count) : "";
      slot.append(icon, count);
    }
    hotbarEl.appendChild(slot);
  }
}

function iconStyle(block) {
  const colors = {
    [BLOCK.DIRT]: "#8b5f35",
    [BLOCK.STONE]: "#8b8f8b",
    [BLOCK.LOG]: "#855426",
    [BLOCK.LEAVES]: "#4f9130",
    [BLOCK.SAND]: "#d4bc76",
  };
  if (block === BLOCK.DIRT) return `linear-gradient(135deg, #a36f3e, ${colors[block]})`;
  if (block === BLOCK.LOG) return `repeating-linear-gradient(90deg, #5d371b 0 4px, ${colors[block]} 4px 9px)`;
  return `linear-gradient(135deg, ${colors[block]}, #26311e)`;
}

function setBlock(x, y, z, block, markDirty = true) {
  const key = keyOf(x, y, z);
  if (block === BLOCK.AIR) world.delete(key);
  else world.set(key, block);
  if (markDirty) {
    meshDirty = true;
    waterMeshDirty = true;
  }
}

function getBlock(x, y, z) {
  return world.get(keyOf(x, y, z)) || BLOCK.AIR;
}

function highestSolid(x, z) {
  for (let y = 64; y >= 0; y--) {
    if (BLOCKS[getBlock(x, y, z)]?.solid) return y;
  }
  return 0;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

function key2(x, z) {
  return `${x},${z}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function approach(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

function add3(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function mod(value, n) {
  return ((value % n) + n) % n;
}

function mixColor(a, b, t) {
  t = clamp(t, 0, 1);
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function fbm(x, z, octaves) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / norm;
}

function noise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fz = smoothstep(z - iz);
  const a = rand2(ix, iz);
  const b = rand2(ix + 1, iz);
  const c = rand2(ix, iz + 1);
  const d = rand2(ix + 1, iz + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz) * 2 - 1;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rand2(x, z) {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

function rand3(x, y, z) {
  return fract(Math.sin(x * 127.1 + y * 269.5 + z * 311.7) * 43758.5453123);
}

function fract(value) {
  return value - Math.floor(value);
}

function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4LookAt(eye, center, up) {
  const z = normalize3({ x: eye.x - center.x, y: eye.y - center.y, z: eye.z - center.z });
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  return new Float32Array([
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
  ]);
}

function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function makeProgram(context, vsSource, fsSource) {
  const vs = makeShader(context, context.VERTEX_SHADER, vsSource);
  const fs = makeShader(context, context.FRAGMENT_SHADER, fsSource);
  const program = context.createProgram();
  context.attachShader(program, vs);
  context.attachShader(program, fs);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    throw new Error(context.getProgramInfoLog(program));
  }
  return program;
}

function makeShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    throw new Error(context.getShaderInfoLog(shader));
  }
  return shader;
}
