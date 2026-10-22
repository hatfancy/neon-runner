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
        player.y = vh - floorHeight - player.h;
    }
    initBackgroundStars();
    initCityBuildings();
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

// Power-ups State
const activePowerups = {
    shield: 0,   // seconds or 1 for active
    magnet: 0,   // duration timer (seconds)
    slowmo: 0,   // duration timer (seconds)
    hyper: 0     // duration timer (seconds)
};

const POWERUP_TYPES = [
    { type: 'shield', name: 'SHIELD', icon: '🛡️', color: '#00f3ff', duration: 999 }, // lasts until hit
    { type: 'magnet', name: 'MAGNET', icon: '🧲', color: '#ffcc00', duration: 10 },
    { type: 'slowmo', name: 'CHRONO', icon: '⏱️', color: '#bb44ff', duration: 7 },
    { type: 'hyper',  name: 'HYPER',  icon: '⚡', color: '#ff007f', duration: 6 }
];

// Gameplay Variables
let distance = 0;
let score = 0;
let shards = 0;
let combo = 1;
let obstacles = [];
let collectibles = [];
let powerupItems = [];
let particles = [];
let checkpoints = [];
let currentCheckpoint = 0;
let lastTime = 0;
let frameCount = 0;
let levelProgress = 0;
let framesSinceLastObstacle = 0;
let framesSinceLastPowerup = 0;
const levelLength = [3000, 4500, 6000, 8000]; // in distance units

// Parallax City & Sky Background State
let bgStars = [];
let bgBuildingsLayer1 = [];
let bgBuildingsLayer2 = [];

function initBackgroundStars() {
    bgStars = [];
    for (let i = 0; i < 75; i++) {
        bgStars.push({
            x: Math.random() * vw,
            y: Math.random() * (vh - floorHeight - 80),
            size: Math.random() * 2 + 1,
            twinkleSpeed: Math.random() * 0.05 + 0.02,
            color: Math.random() > 0.4 ? '#00f3ff' : '#ff00ff'
        });
    }
}

function initCityBuildings() {
    bgBuildingsLayer1 = []; // Far buildings (slower, darker)
    bgBuildingsLayer2 = []; // Mid buildings (faster, neon outlines)
    
    // Far layer
    let curX = 0;
    while (curX < vw + 600) {
        let w = Math.floor(Math.random() * 80 + 70);
        let h = Math.floor(Math.random() * 240 + 150);
        bgBuildingsLayer1.push({
            x: curX,
            w: w,
            h: h,
            neonColor: Math.random() > 0.5 ? '#9d00ff' : '#00f3ff',
            windowLit: Math.random() > 0.3
        });
        curX += w + Math.floor(Math.random() * 20 + 10);
    }

    // Mid layer
    curX = 0;
    while (curX < vw + 600) {
        let w = Math.floor(Math.random() * 90 + 60);
        let h = Math.floor(Math.random() * 180 + 100);
        bgBuildingsLayer2.push({
            x: curX,
            w: w,
            h: h,
            neonColor: Math.random() > 0.5 ? '#ff00ff' : '#00f3ff',
            roofAntenna: Math.random() > 0.4
        });
        curX += w + Math.floor(Math.random() * 30 + 15);
    }
}
initBackgroundStars();
initCityBuildings();

// Input Handling
const keys = {
    jump: false,
    slide: false
};

let jumpBufferTime = 0;
let coyoteTime = 0;

window.addEventListener('keydown', (e) => {
    // Audio trigger on user interaction
    if (window.neonAudio && !window.neonAudio.isPlayingMusic && window.neonAudio.enabled) {
        window.neonAudio.startMusic();
    }

    if (e.code === 'KeyM') {
        toggleAudio();
        return;
    }

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        keys.jump = true;
        jumpBufferTime = 10;
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
    powerupsBar: document.getElementById('powerups-bar'),
    btnAudioToggle: document.getElementById('btn-audio-toggle'),
    btnMenuAudio: document.getElementById('btn-menu-audio'),

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

// Audio Buttons Listener
function toggleAudio() {
    if (!window.neonAudio) return;
    const isEnabled = window.neonAudio.toggle();
    const txt = isEnabled ? '🔊 MUSIC: ON' : '🔇 MUSIC: MUTED';
    if (ui.btnAudioToggle) {
        ui.btnAudioToggle.innerText = txt;
        ui.btnAudioToggle.classList.toggle('muted', !isEnabled);
    }
    if (ui.btnMenuAudio) {
        ui.btnMenuAudio.innerText = txt;
        ui.btnMenuAudio.classList.toggle('muted', !isEnabled);
    }
}

if (ui.btnAudioToggle) ui.btnAudioToggle.addEventListener('click', toggleAudio);
if (ui.btnMenuAudio) ui.btnMenuAudio.addEventListener('click', toggleAudio);

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

const splashTexts = ["NEON AF!", "RAGE INDUCING", "MIND THE GAP", "GOTTA GO FAST", "CYBERPUNK LITE", "DO A BARREL ROLL", "BEAT THE HIGHSCORE", "SYNTH RESONANCE", "OVERDRIVE ENGAGED"];
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

// Level Select Buttons
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
    
    if (window.neonAudio && window.neonAudio.enabled) {
        window.neonAudio.startMusic();
    }

    if(level >= 3) {
        player.canDoubleJump = true;
    } else {
        player.canDoubleJump = false;
    }
    
    baseSpeed = 6 + (level * 1.5);
    speedMult = 1;
    gameSpeed = baseSpeed;
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

    if (window.neonAudio && window.neonAudio.enabled) {
        window.neonAudio.startMusic();
    }
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
    powerupItems = [];
    particles = [];
    checkpoints = [];
    currentCheckpoint = 0;
    
    // Clear active powerups
    activePowerups.shield = 0;
    activePowerups.magnet = 0;
    activePowerups.slowmo = 0;
    activePowerups.hyper = 0;

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
    obstacles = obstacles.filter(o => o.x > vw);
    powerupItems = powerupItems.filter(p => p.x > vw);
    
    // Clear powerups on death
    activePowerups.shield = 0;
    activePowerups.magnet = 0;
    activePowerups.slowmo = 0;
    activePowerups.hyper = 0;

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

// Spawning Obstacles & Collectibles & Power-ups
function spawnEntities() {
    framesSinceLastObstacle++;
    framesSinceLastPowerup++;
    
    let minFrames = Math.max(30, 80 - (gameSpeed * 2));
    
    // Obstacle Spawning
    if (framesSinceLastObstacle > minFrames && Math.random() < 0.03 * currentLevel * (isRageMode ? 2 : 1)) {
        framesSinceLastObstacle = 0;
        let type = Math.random();
        let obs = { x: vw + 50, w: 30, h: 40, y: vh - floorHeight - 40, passed: false, type: 'basic' };
        
        if (type > 0.8 && currentLevel >= 2) {
            // High laser
            obs.y = vh - floorHeight - player.normalHeight - 20;
            obs.h = 20;
            obs.w = 65;
            obs.type = 'high';
        } else if (type > 0.5 && currentLevel >= 3) {
            // Moving obstacle
            obs.moving = true;
            obs.dy = 2;
        }
        obstacles.push(obs);
    }
    
    // Shards Spawning
    if (Math.random() < 0.02) {
        collectibles.push({
            x: vw + 50,
            y: vh - floorHeight - 50 - Math.random() * 110,
            w: 16,
            h: 16,
            collected: false
        });
    }

    // Power-up Item Spawning (every ~10-15 seconds / prob check)
    if (framesSinceLastPowerup > 350 && Math.random() < 0.015) {
        framesSinceLastPowerup = 0;
        const pDef = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerupItems.push({
            x: vw + 50,
            y: vh - floorHeight - 60 - Math.random() * 100,
            w: 26,
            h: 26,
            type: pDef.type,
            name: pDef.name,
            icon: pDef.icon,
            color: pDef.color,
            maxDuration: pDef.duration,
            collected: false
        });
    }
}

// Update Game Loop Logic
function update(dt) {
    if (gameState !== 'PLAYING') return;
    
    // Calculate delta time in seconds
    const deltaSeconds = Math.min((dt || 16.6) / 1000, 0.1);

    // Update active powerup timers
    if (activePowerups.magnet > 0) activePowerups.magnet = Math.max(0, activePowerups.magnet - deltaSeconds);
    if (activePowerups.slowmo > 0) activePowerups.slowmo = Math.max(0, activePowerups.slowmo - deltaSeconds);
    if (activePowerups.hyper > 0)  activePowerups.hyper = Math.max(0, activePowerups.hyper - deltaSeconds);

    // Increase speed gradually
    if (isRageMode) {
        speedMult += 0.0001;
    } else {
        speedMult += 0.00005;
    }

    // Chrono (slowmo) powerup slows environment speed by 50%
    let currentSpeedMult = speedMult;
    if (activePowerups.slowmo > 0) {
        currentSpeedMult *= 0.5;
    }
    // Hyper boost speeds up distance and score gain!
    if (activePowerups.hyper > 0) {
        currentSpeedMult *= 1.4;
    }

    gameSpeed = baseSpeed * currentSpeedMult;
    
    distance += gameSpeed * 0.1;
    score += Math.floor(gameSpeed * 0.1 * combo * (activePowerups.hyper > 0 ? 2 : 1));
    
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
    spawnEntities();
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
        player.vy += 2;
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
            if (window.neonAudio) window.neonAudio.playJump();
        } else if (player.canDoubleJump && !player.hasDoubleJumped) {
            player.vy = player.jumpPower * 0.9;
            player.hasDoubleJumped = true;
            jumpBufferTime = 0;
            createParticles(player.x, player.y + player.h, '#ff00ff', 15);
            if (window.neonAudio) window.neonAudio.playDoubleJump();
        }
    }
    jumpBufferTime--;
    
    // Animation lerps
    player.squash += (1 - player.squash) * 0.2;
    player.stretch += (1 - player.stretch) * 0.2;
    
    // Trail with special hyper boost particle trail
    player.trail.push({x: player.x, y: player.y, w: player.w, h: player.h, alpha: 0.6});
    if (player.trail.length > (activePowerups.hyper > 0 ? 18 : 10)) player.trail.shift();

    if (activePowerups.hyper > 0 && Math.random() < 0.6) {
        createParticles(player.x, player.y + Math.random() * player.h, '#ff007f', 2);
    }
}

function updateEntities() {
    // Parallax background buildings scrolling
    let pSpeed1 = gameSpeed * 0.2; // Far layer
    let pSpeed2 = gameSpeed * 0.45; // Mid layer

    for (let b of bgBuildingsLayer1) {
        b.x -= pSpeed1;
    }
    for (let b of bgBuildingsLayer2) {
        b.x -= pSpeed2;
    }

    // Recycle buildings
    for (let i = 0; i < bgBuildingsLayer1.length; i++) {
        let b = bgBuildingsLayer1[i];
        if (b.x + b.w < 0) {
            let maxX = Math.max(...bgBuildingsLayer1.map(item => item.x + item.w));
            b.x = maxX + Math.floor(Math.random() * 20 + 10);
            b.h = Math.floor(Math.random() * 240 + 150);
        }
    }
    for (let i = 0; i < bgBuildingsLayer2.length; i++) {
        let b = bgBuildingsLayer2[i];
        if (b.x + b.w < 0) {
            let maxX = Math.max(...bgBuildingsLayer2.map(item => item.x + item.w));
            b.x = maxX + Math.floor(Math.random() * 30 + 15);
            b.h = Math.floor(Math.random() * 180 + 100);
        }
    }

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
            let distY = Math.abs((player.y + player.h/2) - (obs.y + obs.h/2));
            if (distY < 80) {
                nearMissEvent();
            }
        }
        
        if (obs.x + obs.w < 0) {
            obstacles.splice(i, 1);
            score += 100 * combo;
        }
    }
    
    // Collectibles & Magnet Attraction
    for (let i = collectibles.length - 1; i >= 0; i--) {
        let col = collectibles[i];
        col.x -= gameSpeed;

        // If magnet is active, pull shards towards player
        if (activePowerups.magnet > 0 && !col.collected) {
            let dx = (player.x + player.w/2) - (col.x + col.w/2);
            let dy = (player.y + player.h/2) - (col.y + col.h/2);
            let dist = Math.hypot(dx, dy);
            if (dist < 450) {
                let pullSpeed = 16;
                col.x += (dx / dist) * pullSpeed;
                col.y += (dy / dist) * pullSpeed;
            }
        }

        if (col.x + col.w < 0) collectibles.splice(i, 1);
    }

    // Power-up Items
    for (let i = powerupItems.length - 1; i >= 0; i--) {
        let p = powerupItems[i];
        p.x -= gameSpeed;
        if (p.x + p.w < 0) powerupItems.splice(i, 1);
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx - gameSpeed * 0.5;
        p.y += p.vy;
        p.alpha -= 0.04;
        if (p.alpha <= 0) particles.splice(i, 1);
    }
}

function checkCollisions() {
    let px = player.x;
    let py = player.y;
    let pw = player.w;
    let ph = player.h;
    let tol = 5; 
    
    // Obstacle collisions
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (px + tol < obs.x + obs.w &&
            px + pw - tol > obs.x &&
            py + tol < obs.y + obs.h &&
            py + ph - tol > obs.y) {
            
            // 1. Hyper Boost ramming: Destroy obstacle and reward score!
            if (activePowerups.hyper > 0) {
                createParticles(obs.x + obs.w/2, obs.y + obs.h/2, '#ff007f', 25);
                score += 350 * combo;
                obstacles.splice(i, 1);
                if (window.neonAudio) window.neonAudio.playNearMiss();
                continue;
            }

            // 2. Shield: Absorbs impact safely
            if (activePowerups.shield > 0) {
                activePowerups.shield = 0;
                obstacles.splice(i, 1);
                createParticles(player.x + pw/2, player.y + ph/2, '#00f3ff', 30);
                if (window.neonAudio) window.neonAudio.playShieldBreak();
                continue;
            }

            // Otherwise, take damage
            die();
            return;
        }
    }
    
    // Shard collisions
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
            if (window.neonAudio) window.neonAudio.playShard();
        }
    }

    // Power-up collisions
    for (let i = powerupItems.length - 1; i >= 0; i--) {
        let p = powerupItems[i];
        if (!p.collected &&
            px < p.x + p.w &&
            px + pw > p.x &&
            py < p.y + p.h &&
            py + ph > p.y) {
            p.collected = true;
            applyPowerup(p.type, p.maxDuration);
            createParticles(p.x, p.y, p.color, 25);
            if (window.neonAudio) window.neonAudio.playPowerup();
            powerupItems.splice(i, 1);
        }
    }
}

function applyPowerup(type, duration) {
    if (type === 'shield') {
        activePowerups.shield = 1;
    } else if (type === 'magnet') {
        activePowerups.magnet = duration;
    } else if (type === 'slowmo') {
        activePowerups.slowmo = duration;
    } else if (type === 'hyper') {
        activePowerups.hyper = duration;
    }
    updatePowerupHUD();
}

function die() {
    gameState = 'DYING';
    combo = 1;
    ui.flash.classList.add('flash-active');
    setTimeout(() => ui.flash.classList.remove('flash-active'), 400);
    
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 300);
    
    createParticles(player.x + player.w/2, player.y + player.h/2, player.color, 50);
    if (window.neonAudio) window.neonAudio.playHit();

    setTimeout(() => {
        restartFromCheckpoint();
    }, 1000);
}

function nearMissEvent() {
    combo++;
    score += 200 * combo;
    ui.nearMiss.classList.remove('hidden');
    ui.nearMiss.style.animation = 'none';
    ui.nearMiss.offsetHeight;
    ui.nearMiss.style.animation = 'flashOut 1s forwards';
    
    ui.comboContainer.classList.remove('hidden');
    ui.combo.innerText = combo;

    if (window.neonAudio) window.neonAudio.playNearMiss();
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

    updatePowerupHUD();
}

function updatePowerupHUD() {
    if (!ui.powerupsBar) return;
    let html = '';

    if (activePowerups.shield > 0) {
        html += `
            <div class="powerup-badge" style="border-color:#00f3ff; color:#00f3ff;">
                <span>🛡️ SHIELD</span>
                <span style="font-size:12px; opacity:0.8;">ACTIVE</span>
            </div>
        `;
    }
    if (activePowerups.magnet > 0) {
        const pct = Math.min(100, (activePowerups.magnet / 10) * 100);
        html += `
            <div class="powerup-badge" style="border-color:#ffcc00; color:#ffcc00;">
                <span>🧲 MAGNET</span>
                <div class="time-bar"><div class="time-fill" style="width:${pct}%"></div></div>
            </div>
        `;
    }
    if (activePowerups.slowmo > 0) {
        const pct = Math.min(100, (activePowerups.slowmo / 7) * 100);
        html += `
            <div class="powerup-badge" style="border-color:#bb44ff; color:#bb44ff;">
                <span>⏱️ CHRONO</span>
                <div class="time-bar"><div class="time-fill" style="width:${pct}%"></div></div>
            </div>
        `;
    }
    if (activePowerups.hyper > 0) {
        const pct = Math.min(100, (activePowerups.hyper / 6) * 100);
        html += `
            <div class="powerup-badge" style="border-color:#ff007f; color:#ff007f;">
                <span>⚡ HYPER</span>
                <div class="time-bar"><div class="time-fill" style="width:${pct}%"></div></div>
            </div>
        `;
    }

    ui.powerupsBar.innerHTML = html;
}

// ==========================================
// RENDERING SYSTEM & BACKGROUND DETAILS
// ==========================================
function drawBackground() {
    // 1. Cyber Sky Gradient with Atmospheric Haze
    const skyGrad = ctx.createLinearGradient(0, 0, 0, vh - floorHeight);
    skyGrad.addColorStop(0, '#06060c');
    skyGrad.addColorStop(0.6, '#0f0c24');
    skyGrad.addColorStop(1, '#2b0938');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, vw, vh - floorHeight);

    // 2. Distant Giant Neon Cyber Sun / Moon
    const sunX = vw * 0.75;
    const sunY = vh * 0.35;
    const sunRadius = Math.min(vw, vh) * 0.16;

    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.2, sunX, sunY, sunRadius * 2);
    sunGlow.addColorStop(0, 'rgba(255, 0, 128, 0.4)');
    sunGlow.addColorStop(0.5, 'rgba(255, 100, 0, 0.15)');
    sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Retro-sun horizontal scanline blinds
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.clip();
    const sunBodyGrad = ctx.createLinearGradient(sunX, sunY - sunRadius, sunX, sunY + sunRadius);
    sunBodyGrad.addColorStop(0, '#ffee55');
    sunBodyGrad.addColorStop(0.5, '#ff007f');
    sunBodyGrad.addColorStop(1, '#9d00ff');
    ctx.fillStyle = sunBodyGrad;
    ctx.fillRect(sunX - sunRadius, sunY - sunRadius, sunRadius * 2, sunRadius * 2);

    // Blinds cut
    for (let i = 0; i < 9; i++) {
        let slitY = sunY + (i / 9) * sunRadius;
        let slitHeight = 2 + i * 1.2;
        ctx.fillStyle = '#06060c';
        ctx.fillRect(sunX - sunRadius, slitY, sunRadius * 2, slitHeight);
    }
    ctx.restore();

    // 3. Twinkling Neon Stars
    for (let s of bgStars) {
        let alpha = 0.4 + Math.sin(frameCount * s.twinkleSpeed) * 0.35;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // 4. Parallax City Layer 1 (Far silhouette & purple glow)
    for (let b of bgBuildingsLayer1) {
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(b.x, vh - floorHeight - b.h, b.w, b.h);

        // Subtle neon top rim
        ctx.strokeStyle = b.neonColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x, vh - floorHeight - b.h);
        ctx.lineTo(b.x + b.w, vh - floorHeight - b.h);
        ctx.stroke();

        // Random matrix window lights
        if (b.windowLit) {
            ctx.fillStyle = b.neonColor;
            for (let wy = vh - floorHeight - b.h + 20; wy < vh - floorHeight - 20; wy += 25) {
                if (((wy + b.x) % 3) === 0) {
                    ctx.globalAlpha = 0.2;
                    ctx.fillRect(b.x + 10, wy, 4, 6);
                    ctx.fillRect(b.x + b.w - 14, wy, 4, 6);
                }
            }
        }
    }
    ctx.globalAlpha = 1;

    // 5. Parallax City Layer 2 (Mid-ground sharp neon skylines)
    for (let b of bgBuildingsLayer2) {
        ctx.fillStyle = '#141426';
        ctx.fillRect(b.x, vh - floorHeight - b.h, b.w, b.h);

        // Glowing rim on rooftop
        ctx.strokeStyle = b.neonColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.neonColor;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x, vh - floorHeight - b.h);
        ctx.lineTo(b.x + b.w, vh - floorHeight - b.h);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Rooftop antenna with beacon light
        if (b.roofAntenna) {
            let antX = b.x + b.w / 2;
            let antTop = vh - floorHeight - b.h - 18;
            ctx.strokeStyle = '#555577';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(antX, vh - floorHeight - b.h);
            ctx.lineTo(antX, antTop);
            ctx.stroke();

            // Beacon flash
            if (Math.sin(frameCount * 0.1 + b.x) > 0.2) {
                ctx.fillStyle = '#ff0033';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff0033';
                ctx.beginPath();
                ctx.arc(antX, antTop, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }
    ctx.globalAlpha = 1;

    // 6. Perspective Cyber Grid Floor with dynamic scrolling
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, vh - floorHeight, vw, floorHeight);

    // Glowing Neon Floor Horizon Line
    ctx.shadowBlur = 20;
    ctx.shadowColor = activePowerups.hyper > 0 ? '#ff007f' : (activePowerups.slowmo > 0 ? '#bb44ff' : '#00f3ff');
    ctx.strokeStyle = ctx.shadowColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, vh - floorHeight);
    ctx.lineTo(vw, vh - floorHeight);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Moving horizontal grid lines inside floor
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 1;
    let gridOffset = -(distance * 0.8) % 40;
    for (let x = 0; x < vw + 40; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x + gridOffset, vh - floorHeight);
        ctx.lineTo(x + gridOffset - 60, vh);
        ctx.stroke();
    }
    for (let y = vh - floorHeight + 20; y < vh; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(vw, y);
        ctx.stroke();
    }
}

function draw() {
    ctx.clearRect(0, 0, vw, vh);
    
    // Draw rich background scene
    drawBackground();

    if (gameState === 'MENU') {
        drawMenuBackground();
        return;
    }

    // Draw Particles
    for (let p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Draw Shards Collectibles
    for (let col of collectibles) {
        if (col.collected) continue;
        ctx.fillStyle = '#00f3ff';
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#00f3ff';
        ctx.save();
        ctx.translate(col.x + col.w/2, col.y + col.h/2);
        ctx.rotate(frameCount * 0.06);
        ctx.fillRect(-col.w/2, -col.h/2, col.w, col.h);
        ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Draw Power-up Items
    for (let p of powerupItems) {
        if (p.collected) continue;
        ctx.save();
        ctx.translate(p.x + p.w/2, p.y + p.h/2);
        
        // Gentle bobbing & rotating neon aura
        let bob = Math.sin(frameCount * 0.08) * 4;
        ctx.translate(0, bob);
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();

        // Icon inside
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.icon, 0, 1);

        ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Draw Obstacles
    for (let obs of obstacles) {
        ctx.fillStyle = '#ff3333';
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#ff3333';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        
        // Inner tech core detail
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8);
    }

    // Draw Player
    if (gameState !== 'DYING') {
        // Player Trail
        for (let i = 0; i < player.trail.length; i++) {
            let t = player.trail[i];
            ctx.globalAlpha = (i / player.trail.length) * 0.35;
            ctx.fillStyle = activePowerups.hyper > 0 ? '#ff007f' : (activePowerups.shield > 0 ? '#00f3ff' : player.color);
            ctx.fillRect(t.x, t.y, t.w, t.h);
        }
        ctx.globalAlpha = 1;

        // Player Body Animation states
        let drawW = player.w * player.stretch;
        let drawH = player.h * player.squash;
        let drawX = player.x + (player.w - drawW)/2;
        let drawY = player.y + player.h - drawH;
        
        let currentColor = player.color;
        if (activePowerups.hyper > 0) currentColor = '#ff007f';
        else if (activePowerups.slowmo > 0) currentColor = '#bb44ff';
        else if (activePowerups.magnet > 0) currentColor = '#ffcc00';

        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 22;
        ctx.shadowColor = currentColor;
        
        let cx = drawX + drawW/2;
        let headY = drawY + 10;
        let neckY = drawY + 20;
        let waistY = drawY + 50;
        let footY = drawY + drawH;
        
        // Draw neon stick figure
        ctx.beginPath();
        // Head
        ctx.arc(cx, headY, 8, 0, Math.PI*2);
        // Body
        ctx.moveTo(cx, headY + 8);
        ctx.lineTo(cx, waistY);
        
        // Legs based on animation
        let legSwing = Math.sin(frameCount * 0.4) * 15;
        if (!player.isGrounded) legSwing = 5;
        if (player.isSliding) {
            ctx.moveTo(cx, waistY);
            ctx.lineTo(cx - 20, footY);
            ctx.moveTo(cx, waistY);
            ctx.lineTo(cx + 20, footY - 10);
        } else {
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

        // Draw Active Shield Bubble if shielded
        if (activePowerups.shield > 0) {
            ctx.save();
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00f3ff';
            ctx.beginPath();
            let pulse = Math.sin(frameCount * 0.1) * 3;
            ctx.ellipse(cx, (headY + footY) / 2, drawW + 14 + pulse, drawH / 2 + 10 + pulse, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Draw Magnet Wave Rings
        if (activePowerups.magnet > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 204, 0, 0.4)';
            ctx.lineWidth = 2;
            let ringSize = (frameCount * 2) % 45 + 15;
            ctx.beginPath();
            ctx.arc(cx, (headY + footY) / 2, ringSize, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawMenuBackground() {
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
