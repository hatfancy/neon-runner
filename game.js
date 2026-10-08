const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER, LEVEL_COMPLETE, VICTORY
let currentLevel = 1;
let isRageMode = false;

// Config & Dimensions
let vw = window.innerWidth;
let vh = window.innerHeight;
canvas.width = vw;
canvas.height = vh;

window.addEventListener('resize', () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = vw;
    canvas.height = vh;
    if (gameState === 'PLAYING') {
        player.y = vh - floorHeight - player.h; // roughly keep player on floor
    }
});

const floorHeight = 100;
let baseSpeed = 6;
let speedMult = 1;
let gravity = 0.8;
let gameSpeed = baseSpeed;

// Player Entity
const player = {
    x: vw * 0.15,
    y: 0,
    w: 30,
    h: 80,
    vy: 0,
    jumpPower: -15,
    isGrounded: false,
    isSliding: false,
    slideHeight: 40,
    normalHeight: 80,
    canDoubleJump: false,
    hasDoubleJumped: false,
    lives: 3,
    color: '#00f3ff',
    trail: [],
    squash: 1,
    stretch: 1
};

// Gameplay Variables
let distance = 0;
let score = 0;
let shards = 0;
let combo = 1;
let obstacles = [];
let collectibles = [];
let particles = [];
let checkpoints = [];
let currentCheckpoint = 0;
let lastTime = 0;
let frameCount = 0;
let levelProgress = 0;
let framesSinceLastObstacle = 0;
const levelLength = [3000, 4500, 6000, 8000]; // in distance units

// Input Handling
const keys = {
    jump: false,
    slide: false
};

let jumpBufferTime = 0;
let coyoteTime = 0;

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        keys.jump = true;
        jumpBufferTime = 10;
        if (gameState !== 'PLAYING') return; // handle menu jumps maybe later
    }
    if (e.code === 'ArrowDown') {
        keys.slide = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        keys.jump = false;
        // variable jump height
        if (player.vy < 0) player.vy *= 0.5;
    }
    if (e.code === 'ArrowDown') {
        keys.slide = false;
    }
});

// UI Elements
const ui = {
    hud: document.getElementById('hud'),
    lives: document.getElementById('lives'),
    distance: document.getElementById('distance'),
    score: document.getElementById('score'),
    shards: document.getElementById('shards'),
    combo: document.getElementById('combo'),
    comboContainer: document.getElementById('combo-container'),
    nearMiss: document.getElementById('near-miss'),
    levelIndicator: document.getElementById('level-indicator'),
    splashText: document.getElementById('splash-text'),
    
    mainMenu: document.getElementById('main-menu'),
    levelSelect: document.getElementById('level-select-menu'),
    howToPlay: document.getElementById('how-to-play-menu'),
    gameOver: document.getElementById('game-over-screen'),
    levelComplete: document.getElementById('level-complete-screen'),
    victory: document.getElementById('victory-screen'),
    
    flash: document.createElement('div')
};
ui.flash.className = 'flash-effect';
document.body.appendChild(ui.flash);

// Menus setup
document.getElementById('btn-play').addEventListener('click', () => startGame(1));
document.getElementById('btn-level-select').addEventListener('click', () => switchScreen(ui.levelSelect));
document.getElementById('btn-how-to-play').addEventListener('click', () => switchScreen(ui.howToPlay));
document.getElementById('btn-ls-back').addEventListener('click', () => switchScreen(ui.mainMenu));
document.getElementById('btn-htp-back').addEventListener('click', () => switchScreen(ui.mainMenu));
document.getElementById('btn-retry').addEventListener('click', () => startGame(currentLevel));
document.getElementById('btn-go-menu').addEventListener('click', () => { resetGame(); switchScreen(ui.mainMenu); });
document.getElementById('btn-next-level').addEventListener('click', () => startGame(currentLevel + 1));
document.getElementById('btn-lc-menu').addEventListener('click', () => { resetGame(); switchScreen(ui.mainMenu); });
document.getElementById('btn-v-menu').addEventListener('click', () => { resetGame(); switchScreen(ui.mainMenu); });
document.getElementById('btn-rage-mode').addEventListener('click', () => startRageMode());

const splashTexts = ["NEON AF!", "RAGE INDUCING", "MIND THE GAP", "GOTTA GO FAST", "CYBERPUNK LITE", "DO A BARREL ROLL", "BEAT THE HIGHSCORE"];
setInterval(() => {
    if(ui.splashText) {
        ui.splashText.innerText = splashTexts[Math.floor(Math.random() * splashTexts.length)];
    }
}, 5000);

function switchScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    if (screenElement) screenElement.classList.remove('hidden');
    
    if (screenElement === null && gameState === 'PLAYING') {
        ui.hud.classList.remove('hidden');
    } else {
        ui.hud.classList.add('hidden');
    }
}

// Generate level select buttons
const levelNames = ["NEON CITY", "INDUSTRIAL ZONE", "CYBER STORM", "NEON HELL"];
let unlockedLevels = parseInt(localStorage.getItem('unlockedLevels')) || 1;
const lsContainer = document.getElementById('level-buttons-container');

function updateLevelSelect() {
    lsContainer.innerHTML = '';
    for(let i = 1; i <= 4; i++) {
        const btn = document.createElement('button');
        btn.className = `level-btn ${i > unlockedLevels ? 'locked' : ''}`;
        btn.innerHTML = `LEVEL ${i}<br><small>${levelNames[i-1]}</small>`;
        if(i <= unlockedLevels) {
            btn.onclick = () => startGame(i);
        }
        lsContainer.appendChild(btn);
    }
}
updateLevelSelect();


function startGame(level) {
    currentLevel = level;
    isRageMode = false;
    resetGame();
    gameState = 'PLAYING';
    switchScreen(null);
    ui.levelIndicator.innerText = `LEVEL ${level} — ${levelNames[level-1]}`;
    
    // Level specific setups
    if(level >= 3) {
        player.canDoubleJump = true;
    } else {
        player.canDoubleJump = false;
    }
    
    baseSpeed = 6 + (level * 1.5);
    speedMult = 1;
    gameSpeed = baseSpeed;
    
    generateLevel(level);
}

function startRageMode() {
    isRageMode = true;
    resetGame();
    gameState = 'PLAYING';
    switchScreen(null);
    ui.levelIndicator.innerText = `NEON RAGE`;
    player.canDoubleJump = true;
    baseSpeed = 12;
    gameSpeed = baseSpeed;
}

function resetGame() {
    player.y = vh - floorHeight - player.normalHeight;
    player.vy = 0;
    player.lives = 3;
    player.isGrounded = true;
    distance = 0;
    score = 0;
    shards = 0;
    combo = 1;
    obstacles = [];
    collectibles = [];
    particles = [];
    checkpoints = [];
    currentCheckpoint = 0;
    updateHUD();
}

function restartFromCheckpoint() {
    player.lives--;
    if (player.lives <= 0) {
        gameState = 'GAMEOVER';
        showGameOver();
        return;
    }
    
    distance = currentCheckpoint;
    player.y = vh - floorHeight - player.normalHeight;
    player.vy = 0;
    combo = 1;
    speedMult = 1;
    obstacles = obstacles.filter(o => o.x > vw); // clear immediate obstacles
    updateHUD();
    gameState = 'PLAYING';
    switchScreen(null);
}

function showGameOver() {
    switchScreen(ui.gameOver);
    document.getElementById('game-over-stats').innerHTML = `
        DISTANCE: ${Math.floor(distance)}<br>
        SCORE: ${score}<br>
        SHARDS: ${shards}
    `;
}

function showLevelComplete() {
    gameState = 'LEVEL_COMPLETE';
    if(currentLevel > unlockedLevels && currentLevel < 4) {
        unlockedLevels = currentLevel + 1;
        localStorage.setItem('unlockedLevels', unlockedLevels);
        updateLevelSelect();
    }
    
    if (currentLevel === 4) {
        switchScreen(ui.victory);
        document.getElementById('victory-stats').innerHTML = `
            SCORE: ${score}<br>
            SHARDS: ${shards}<br>
            LIVES LEFT: ${player.lives}
        `;
    } else {
        switchScreen(ui.levelComplete);
        document.getElementById('level-complete-stats').innerHTML = `
            SCORE: ${score}<br>
            SHARDS: ${shards}
        `;
    }
}

// Level Generation
function generateLevel(level) {
    // Generate static sections for the level
    // For this prototype, we'll generate obstacles dynamically as we run
}

function spawnObstacle() {
    framesSinceLastObstacle++;
    let minFrames = Math.max(30, 80 - (gameSpeed * 2)); // Dynamic minimum gap based on speed
    
    // Basic probability based on level
    if (framesSinceLastObstacle > minFrames && Math.random() < 0.03 * currentLevel * (isRageMode ? 2 : 1)) {
        framesSinceLastObstacle = 0;
        let type = Math.random();
        let obs = { x: vw + 50, w: 30, h: 40, y: vh - floorHeight - 40, passed: false, type: 'basic' };
        
        if (type > 0.8 && currentLevel >= 2) {
            // High laser
            obs.y = vh - floorHeight - player.normalHeight - 20;
            obs.h = 20;
            obs.w = 60;
            obs.type = 'high';
        } else if (type > 0.5 && currentLevel >= 3) {
            // Moving obstacle
            obs.moving = true;
            obs.dy = 2;
        }
        obstacles.push(obs);
    }
    
    // Spawn shards
    if (Math.random() < 0.01) {
        collectibles.push({ x: vw + 50, y: vh - floorHeight - 100 - Math.random() * 100, w: 15, h: 15, collected: false });
    }
}

// Game Loop
function update(dt) {
    if (gameState !== 'PLAYING') return;
    
    // Increase speed gradually
    if (isRageMode) {
        speedMult += 0.0001;
    } else {
        speedMult += 0.00005;
    }
    gameSpeed = baseSpeed * speedMult;
    
    distance += gameSpeed * 0.1;
    score += Math.floor(gameSpeed * 0.1 * combo);
    
    if (!isRageMode && distance >= levelLength[currentLevel - 1]) {
        showLevelComplete();
        return;
    }
    
    // Set Checkpoints
    if (distance - currentCheckpoint > 1000) {
        currentCheckpoint = distance;
    }
    
    handlePlayerMovement();
    updateEntities();
    checkCollisions();
    spawnObstacle();
    updateHUD();
}

function handlePlayerMovement() {
    // Gravity
    player.vy += gravity;
    player.y += player.vy;
    
    // Floor Collision
    if (player.y >= vh - floorHeight - player.h) {
        player.y = vh - floorHeight - player.h;
        player.vy = 0;
        player.isGrounded = true;
        player.hasDoubleJumped = false;
        coyoteTime = 10;
        
        // Landing squish
        if (player.vy > 10) {
            player.squash = 0.7;
            player.stretch = 1.3;
            createParticles(player.x, player.y + player.h, '#fff', 5);
        }
    } else {
        player.isGrounded = false;
        coyoteTime--;
    }
    
    // Sliding
    if (keys.slide && player.isGrounded) {
        if (!player.isSliding) {
            player.isSliding = true;
            player.y += (player.normalHeight - player.slideHeight);
            player.h = player.slideHeight;
        }
    } else {
        if (player.isSliding) {
            player.isSliding = false;
            player.y -= (player.normalHeight - player.slideHeight);
            player.h = player.normalHeight;
        }
    }
    
    // Fast Fall
    if (keys.slide && !player.isGrounded) {
        player.vy += 2; // accelerate down
    }
    
    // Jumping
    if (jumpBufferTime > 0) {
        if (player.isGrounded || coyoteTime > 0) {
            player.vy = player.jumpPower;
            player.isGrounded = false;
            coyoteTime = 0;
            jumpBufferTime = 0;
            player.squash = 1.2;
            player.stretch = 0.8;
            createParticles(player.x, player.y + player.h, player.color, 10);
        } else if (player.canDoubleJump && !player.hasDoubleJumped) {
            player.vy = player.jumpPower * 0.9;
            player.hasDoubleJumped = true;
            jumpBufferTime = 0;
            createParticles(player.x, player.y + player.h, '#ff00ff', 15);
        }
    }
    jumpBufferTime--;
    
    // Animation lerps
    player.squash += (1 - player.squash) * 0.2;
    player.stretch += (1 - player.stretch) * 0.2;
    
    // Trail
    player.trail.push({x: player.x, y: player.y, w: player.w, h: player.h, alpha: 0.5});
    if (player.trail.length > 10) player.trail.shift();
}

function updateEntities() {
    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.x -= gameSpeed;
        
        if (obs.moving) {
            obs.y += obs.dy;
            if (obs.y < vh - floorHeight - 150 || obs.y > vh - floorHeight - obs.h) obs.dy *= -1;
        }
        
        // Near miss check
        if (!obs.passed && obs.x < player.x) {
            obs.passed = true;
            // check distance
            let distY = Math.abs((player.y + player.h/2) - (obs.y + obs.h/2));
            if (distY < 80) { // close call
                nearMissEvent();
            }
        }
        
        if (obs.x + obs.w < 0) {
            obstacles.splice(i, 1);
            score += 100 * combo;
        }
    }
    
    // Collectibles
    for (let i = collectibles.length - 1; i >= 0; i--) {
        let col = collectibles[i];
        col.x -= gameSpeed;
        if (col.x + col.w < 0) collectibles.splice(i, 1);
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx - gameSpeed * 0.5;
        p.y += p.vy;
        p.alpha -= 0.05;
        if (p.alpha <= 0) particles.splice(i, 1);
    }
}

function checkCollisions() {
    let px = player.x;
    let py = player.y;
    let pw = player.w;
    let ph = player.h;
    
    // Hitbox tolerance
    let tol = 5; 
    
    for (let obs of obstacles) {
        if (px + tol < obs.x + obs.w &&
            px + pw - tol > obs.x &&
            py + tol < obs.y + obs.h &&
            py + ph - tol > obs.y) {
            die();
            return;
        }
    }
    
    for (let col of collectibles) {
        if (!col.collected &&
            px < col.x + col.w &&
            px + pw > col.x &&
            py < col.y + col.h &&
            py + ph > col.y) {
            col.collected = true;
            shards++;
            score += 500 * combo;
            createParticles(col.x, col.y, '#00f3ff', 10);
        }
    }
}

function die() {
    gameState = 'DYING';
    combo = 1;
    ui.flash.classList.add('flash-active');
    setTimeout(() => ui.flash.classList.remove('flash-active'), 400);
    
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 300);
    
    createParticles(player.x + player.w/2, player.y + player.h/2, player.color, 50);
    
    setTimeout(() => {
        restartFromCheckpoint();
    }, 1000);
}

function nearMissEvent() {
    combo++;
    score += 200 * combo;
    ui.nearMiss.classList.remove('hidden');
    ui.nearMiss.style.animation = 'none';
    ui.nearMiss.offsetHeight; /* trigger reflow */
    ui.nearMiss.style.animation = 'flashOut 1s forwards';
    
    ui.comboContainer.classList.remove('hidden');
    ui.combo.innerText = combo;
}

function createParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            color: color,
            alpha: 1,
            size: Math.random() * 4 + 2
        });
    }
}

function updateHUD() {
    let hearts = '';
    for(let i=0; i<player.lives; i++) hearts += '♥';
    ui.lives.innerText = hearts;
    ui.distance.innerText = `DIST: ${Math.floor(distance)}`;
    ui.score.innerText = `SCORE: ${score}`;
    ui.shards.innerText = shards;
    
    if (combo > 1) {
        ui.comboContainer.classList.remove('hidden');
        ui.combo.innerText = combo;
    } else {
        ui.comboContainer.classList.add('hidden');
    }
}

// Rendering
function draw() {
    ctx.clearRect(0, 0, vw, vh);
    
    // Grid/Background tech effect
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    ctx.lineWidth = 1;
    let offset = -(distance * 0.5) % 50;
    for(let i=0; i<vw; i+=50) {
        ctx.beginPath();
        ctx.moveTo(i + offset, 0);
        ctx.lineTo(i + offset, vh);
        ctx.stroke();
    }
    
    // Draw Floor
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, vh - floorHeight, vw, floorHeight);
    
    // Neon line for floor
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f3ff';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, vh - floorHeight);
    ctx.lineTo(vw, vh - floorHeight);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (gameState === 'MENU') {
        drawMenuBackground();
        return;
    }

    // Draw Particles
    for (let p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Draw Collectibles
    for (let col of collectibles) {
        if (col.collected) continue;
        ctx.fillStyle = '#00f3ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f3ff';
        ctx.save();
        ctx.translate(col.x + col.w/2, col.y + col.h/2);
        ctx.rotate(frameCount * 0.05);
        ctx.fillRect(-col.w/2, -col.h/2, col.w, col.h);
        ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Draw Obstacles
    for (let obs of obstacles) {
        ctx.fillStyle = '#ff3333';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff3333';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        
        // Inner detail
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.fillRect(obs.x + 5, obs.y + 5, obs.w - 10, obs.h - 10);
    }

    // Draw Player
    if (gameState !== 'DYING') {
        // Trail
        for (let i = 0; i < player.trail.length; i++) {
            let t = player.trail[i];
            ctx.globalAlpha = (i / player.trail.length) * 0.3;
            ctx.fillStyle = player.color;
            ctx.fillRect(t.x, t.y, t.w, t.h);
        }
        ctx.globalAlpha = 1;

        // Player Body Animation states
        let drawW = player.w * player.stretch;
        let drawH = player.h * player.squash;
        let drawX = player.x + (player.w - drawW)/2;
        let drawY = player.y + player.h - drawH; // Anchor bottom
        
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 20;
        ctx.shadowColor = player.color;
        
        // Draw neon stick figure
        let cx = drawX + drawW/2;
        let headY = drawY + 10;
        let neckY = drawY + 20;
        let waistY = drawY + 50;
        let footY = drawY + drawH;
        
        ctx.beginPath();
        // Head
        ctx.arc(cx, headY, 8, 0, Math.PI*2);
        
        // Body
        ctx.moveTo(cx, headY + 8);
        ctx.lineTo(cx, waistY);
        
        // Legs based on animation
        let legSwing = Math.sin(frameCount * 0.4) * 15;
        if (!player.isGrounded) legSwing = 5; // static when jumping
        if (player.isSliding) {
            // Sliding pose
            ctx.moveTo(cx, waistY);
            ctx.lineTo(cx - 20, footY);
            ctx.moveTo(cx, waistY);
            ctx.lineTo(cx + 20, footY - 10);
        } else {
            // Running pose
            ctx.moveTo(cx, waistY);
            ctx.lineTo(cx - 10 + legSwing, footY);
            ctx.moveTo(cx, waistY);
            ctx.lineTo(cx + 10 - legSwing, footY);
        }
        
        // Arms
        let armSwing = Math.sin(frameCount * 0.4 + Math.PI) * 15;
        if (!player.isGrounded) armSwing = 10;
        if (player.isSliding) {
            ctx.moveTo(cx, neckY);
            ctx.lineTo(cx + 15, neckY + 5);
        } else {
            ctx.moveTo(cx, neckY);
            ctx.lineTo(cx - 15 + armSwing, neckY + 15);
            ctx.moveTo(cx, neckY);
            ctx.lineTo(cx + 15 - armSwing, neckY + 15);
        }
        
        ctx.stroke();
    }
}

function drawMenuBackground() {
    // A simple animation running in the background for the menu
    frameCount++;
    ctx.fillStyle = 'rgba(0, 243, 255, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00f3ff';
    let x = (frameCount * 5) % vw;
    let y = vh - floorHeight - 80;
    ctx.fillRect(x, y, 30, 80);
    ctx.shadowBlur = 0;
}

function gameLoop(timestamp) {
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    frameCount++;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// Init
requestAnimationFrame(gameLoop);
