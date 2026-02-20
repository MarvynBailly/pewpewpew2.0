const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Canvas size is set in HTML (960x720)

// ── Background image ────────────────────────────────────
const bgImage = new Image();
bgImage.src = "Sprites/Background.png";

// ── Input tracking ───────────────────────────────────────
const keys = {};
const mouse = { x: 0, y: 0 };
window.addEventListener("keydown", (e) => { keys[e.key] = true; });
window.addEventListener("keyup", (e) => { keys[e.key] = false; });
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

// ── Parallax star background ─────────────────────────────
function generateStars(count, rMin, rMax, alphaMin, alphaMax) {
    const stars = [];
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random(),
            y: Math.random(),
            r: Math.random() * (rMax - rMin) + rMin,
            alpha: Math.random() * (alphaMax - alphaMin) + alphaMin,
        });
    }
    return stars;
}

const starsBack = generateStars(120, 0.3, 1.3, 0.1, 0.4);
const starsMid = generateStars(60, 0.5, 2, 0.3, 0.8);
const starsFront = generateStars(25, 1, 2.5, 0.5, 0.9);

function drawStarLayer(layer, parallax) {
    const ox = (player.x - canvas.width / 2) * parallax;
    const oy = (player.y - canvas.height / 2) * parallax;

    for (const s of layer) {
        let sx = (s.x * canvas.width - ox) % canvas.width;
        let sy = (s.y * canvas.height - oy) % canvas.height;
        if (sx < 0) sx += canvas.width;
        if (sy < 0) sy += canvas.height;

        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(Math.round(sx), Math.round(sy), Math.ceil(s.r), Math.ceil(s.r));
    }
}

function drawBackground() {
    const bgParallax = 0.01;
    const maxShift = Math.max(canvas.width, canvas.height) * bgParallax / 2;
    const pad = Math.ceil(maxShift) + 1;
    const bgOx = (player.x - canvas.width / 2) * bgParallax;
    const bgOy = (player.y - canvas.height / 2) * bgParallax;
    ctx.drawImage(bgImage, -bgOx - pad, -bgOy - pad, canvas.width + pad * 2, canvas.height + pad * 2);

    // Darken the background so stars and sprites pop
    ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Star layers with increasing parallax (closer = more movement)
    drawStarLayer(starsBack, 0.02);
    drawStarLayer(starsMid, 0.06);
    drawStarLayer(starsFront, 0.12);
}

// ── Score & timer ────────────────────────────────────────
let score = 0;
let gameTime = 0; // ms elapsed

function drawHUD() {
    const pad = 20;

    ctx.font = "bold 16px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    // Timer (MM:SS)
    const totalSec = Math.floor(gameTime / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const sec = String(totalSec % 60).padStart(2, "0");

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(min + ":" + sec, canvas.width - pad, pad);

    // Score
    ctx.fillText("Score: " + score, canvas.width - pad, pad + 22);
}

// ── Enemy wave spawner ───────────────────────────────────
const SPAWN_BASE_INTERVAL = 2500;  // ms between spawns at t=0
const SPAWN_MIN_INTERVAL = 0;      // no cap
const SPAWN_RAMP = 0.97;           // multiplier applied per second (lower = ramps faster)

let spawnTimer = 1500; // first enemy comes quickly

function getSpawnInterval() {
    const elapsed = gameTime / 1000;
    return Math.max(SPAWN_MIN_INTERVAL, SPAWN_BASE_INTERVAL * Math.pow(SPAWN_RAMP, elapsed));
}

function spawnEnemyFromEdge() {
    const side = Math.floor(Math.random() * 4);
    const margin = 120; // spawn well off-screen so they fly in
    let x, y;

    if (side === 0) {        // top
        x = Math.random() * canvas.width;
        y = -margin;
    } else if (side === 1) { // bottom
        x = Math.random() * canvas.width;
        y = canvas.height + margin;
    } else if (side === 2) { // left
        x = -margin;
        y = Math.random() * canvas.height;
    } else {                 // right
        x = canvas.width + margin;
        y = Math.random() * canvas.height;
    }

    createEnemy(x, y);
}

function updateSpawner(dt) {
    if (!player.alive) return;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnEnemyFromEdge();
        spawnTimer = getSpawnInterval();
    }
}

// ── Game over screen ─────────────────────────────────────
let gameOver = false;

function drawGameOver() {
    // Dim overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // "Get Good"
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 64px monospace";
    ctx.fillStyle = "rgba(255, 60, 60, 0.95)";
    ctx.fillText("Get Good", cx, cy - 50);

    // Score & time
    const totalSec = Math.floor(gameTime / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const sec = String(totalSec % 60).padStart(2, "0");

    ctx.font = "bold 22px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("Score: " + score + "    Time: " + min + ":" + sec, cx, cy + 20);

    // Try again button
    const btnW = 200;
    const btnH = 44;
    const btnX = cx - btnW / 2;
    const btnY = cy + 60;

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("Try Again", cx, btnY + btnH / 2);

    // Store button bounds for click detection
    drawGameOver.btnBounds = { x: btnX, y: btnY, w: btnW, h: btnH };
}

function resetGame() {
    // Reset player
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.7;
    player.vx = 0;
    player.vy = 0;
    player.hp = PLAYER_MAX_HP;
    player.iFrames = 0;
    player.alive = true;

    // Clear entities
    enemies.length = 0;
    bullets.length = 0;

    // Reset game state
    score = 0;
    gameTime = 0;
    spawnTimer = 1500;
    fireTimer = 0;
    gameOver = false;

    // Restart loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

canvas.addEventListener("click", (e) => {
    if (!gameOver || !drawGameOver.btnBounds) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const b = drawGameOver.btnBounds;
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        resetGame();
    }
});

// ── Game loop ────────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (player.alive) gameTime += dt;

    updateSpawner(dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateCollisions();

    drawBackground();
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawHealthBar();
    drawHUD();

    if (!player.alive) {
        drawGameOver();
        gameOver = true;
        return; // stop the loop
    }

    requestAnimationFrame(gameLoop);
}

// Start when both images are loaded
let loadedCount = 0;
function onImageLoaded() {
    loadedCount++;
    if (loadedCount < 2) return;
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.7;

    requestAnimationFrame(gameLoop);
}
spriteSheet.onload = onImageLoaded;
bgImage.onload = onImageLoaded;
