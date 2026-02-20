const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Canvas size is set in HTML (960x720)

// ── Background image ────────────────────────────────────
const bgImage = new Image();
bgImage.src = "Sprites/Background.png";

// ── Input tracking ───────────────────────────────────────
const keys = {};
const mouse = { x: 0, y: 0 };
let paused = false;

window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === "Escape" && player.alive && !upgradePending) {
        paused = !paused;
        if (!paused) {
            // Reset lastTime so we don't get a huge dt spike on resume
            lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }
});
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
let score    = 0;
let gameTime = 0; // ms elapsed

// ── Difficulty offset ────────────────────────────────────
// Reset to gameTime whenever difficulty should restart (e.g. after boss death)
let difficultyOffset = 0;

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
    const elapsed = Math.max(0, (gameTime - difficultyOffset)) / 1000 * (postBossMode ? 3 : 1);
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

const BOSS_SPAWN_TIME = 60000; // 60 seconds

let postBossMode        = false; // true after both bosses are killed — ramps difficulty hard
let boss2SpawnCountdown = -1; // counts down after Boss I dies (solo Boss II fight)
let dualBossCountdown  = -1; // counts down after Boss II dies (dual fight)
let dualBossMode       = false; // true once the dual phase begins

function updateSpawner(dt) {
    if (!player.alive) return;

    // Trigger Boss I at 60 s
    if (!bossSpawned && gameTime >= BOSS_SPAWN_TIME) {
        spawnBoss();
        return;
    }

    // Tick the Boss II solo countdown (starts when Boss I dies)
    if (boss2SpawnCountdown > 0) {
        boss2SpawnCountdown -= dt;
        if (boss2SpawnCountdown <= 0 && !boss2Spawned) {
            spawnBoss2();
            return;
        }
    }

    // Tick the dual-boss countdown (starts when Boss II dies solo, then repeats)
    if (dualBossCountdown > 0) {
        dualBossCountdown -= dt;
        if (dualBossCountdown <= 0) {
            dualBossMode = true;
            spawnBoss();
            spawnBoss2();
            dualBossCountdown = -1;
            return;
        }
    }

    // Pause regular spawning while either boss is alive or enemies are frozen
    if (boss !== null || boss2 !== null) return;
    if (freezeTimer > 0) return;

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

    // Scoreboard button
    const sbBtnY = btnY + btnH + 12;

    ctx.fillStyle = "rgba(255, 200, 60, 0.1)";
    ctx.fillRect(btnX, sbBtnY, btnW, btnH);
    ctx.strokeStyle = "rgba(255, 200, 60, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(btnX, sbBtnY, btnW, btnH);

    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "rgba(255, 210, 60, 0.9)";
    ctx.fillText("Scoreboard", cx, sbBtnY + btnH / 2);

    // Store button bounds for click detection
    drawGameOver.btnBounds   = { x: btnX, y: btnY,   w: btnW, h: btnH };
    drawGameOver.sbBtnBounds = { x: btnX, y: sbBtnY, w: btnW, h: btnH };
}

function resetGame() {
    // Reset player physics stats modified by upgrades
    player.maxSpeed = 350;
    player.accel    = 800;
    player.drag     = 0.97;

    // Reset player position / state
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.7;
    player.vx = 0;
    player.vy = 0;
    player.iFrames = 0;
    player.alive = true;

    // Clear entities
    enemies.length = 0;
    bullets.length = 0;
    powerups.length = 0;
    missiles.length = 0;
    explosions.length = 0;
    xpOrbs.length = 0;

    // Reset game state
    score            = 0;
    gameTime         = 0;
    difficultyOffset = 0;
    spawnTimer       = 1500;
    boss               = null;
    bossSpawned        = false;
    bossWarningTimer   = 0;
    bossState          = BS.HUNT;
    bossFireTimer      = 2500;
    bossChargeTimer    = BOSS_CHARGE_INTERVAL;
    bossBullets.length = 0;
    dashTrail.length   = 0;
    postBossMode         = false;
    boss2SpawnCountdown  = -1;
    dualBossCountdown    = -1;
    dualBossMode         = false;
    boss2              = null;
    boss2Spawned       = false;
    boss2WarningTimer  = 0;
    boss2Phase         = "defend";
    boss2PhaseTimer    = BOSS2_PHASE_DURATION;
    boss2PhaseFlash    = 0;
    boss2OrbitAngle    = 0;
    boss2FireTimer     = B2M_FIRE_RATE;
    boss2DodgeCooldown    = 0;
    boss2DodgeActive      = false;
    boss2DodgeTimeLeft    = 0;
    boss2DashTimer        = B2_DASH_COOLDOWN;
    boss2DashActive       = false;
    boss2Missiles.length  = 0;
    boss2Bullets.length   = 0;
    boss2DodgeTrail.length = 0;
    paused             = false;
    fireTimer = 0;
    fireModes = {};
    freezeTimer = 0;
    shieldHp = 0;
    magnetTimer = 0;
    powerupSpawnTimer = 5000;
    gameOver = false;

    // Reset XP & upgrade state
    playerLevel = 1;
    playerXp = 0;
    xpToNextLevel = 5;
    upgradePending = false;
    upgradeChoices = [];
    upgBulletSpeedBonus = 0;
    upgBulletSizeBonus  = 0;
    upgFireRateBonus    = 0;
    upgPickupRadius     = 0;
    PLAYER_MAX_HP  = 3;
    player.hp      = PLAYER_MAX_HP;
    levelUpFlashTimer  = 0;
    levelUpEffectStart = 0;

    resetScoreboardSession();

    // Restart loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Upgrade menu card selection
    if (upgradePending && drawUpgradeMenu.cardBounds) {
        for (const card of drawUpgradeMenu.cardBounds) {
            if (mx >= card.x && mx <= card.x + card.w &&
                my >= card.y && my <= card.y + card.h) {
                applyUpgrade(card.index);
                return;
            }
        }
        return; // ignore clicks outside cards while menu is open
    }

    // Game over buttons
    if (!gameOver || !drawGameOver.btnBounds) return;

    const b = drawGameOver.btnBounds;
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        resetGame();
        return;
    }

    const sb = drawGameOver.sbBtnBounds;
    if (sb && mx >= sb.x && mx <= sb.x + sb.w && my >= sb.y && my <= sb.y + sb.h) {
        showScoreboard(score, gameTime);
    }
});

// ── Game loop ────────────────────────────────────────────
let lastTime = 0;

function drawPauseOverlay() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.font         = "bold 64px monospace";
    ctx.fillStyle    = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 20);

    ctx.font      = "bold 18px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Press ESC to resume", canvas.width / 2, canvas.height / 2 + 36);
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (paused) {
        drawPauseOverlay();
        return; // hold the frame, don't reschedule
    }

    if (player.alive && !upgradePending) gameTime += dt;

    updateLevelUpFlash(dt); // always ticks, even while menu is open

    if (!upgradePending) {
        updateSpawner(dt);
        updatePlayer(dt);
        updateBullets(dt);
        updateEnemies(dt);
        updateBoss(dt);
        updateBoss2(dt);
        updatePowerups(dt);
        updateMissiles(dt);
        updateExplosions(dt);
        updateXpOrbs(dt);
        updateCollisions();
    }

    drawBackground();
    drawExplosions();
    drawPowerups();
    drawXpOrbs();
    drawBullets();
    drawMissiles();
    drawEnemies();
    drawBoss();
    drawBoss2();
    drawPlayer();
    drawMagnet();
    drawShield();
    drawHealthBar();
    drawXpBar();
    drawHUD();
    drawActiveAbilityHUD();

    drawLevelUpFlash(); // green screen flash — visible whether menu is open or not

    if (upgradePending) {
        drawUpgradeMenu();
    }

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
