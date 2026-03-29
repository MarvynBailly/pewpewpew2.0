// ── Sprite sheet config ──────────────────────────────────
const spriteSheet = new Image();
spriteSheet.src = "Sprites/paper-airplane-idle.png";

const FRAME_W = 40;
const FRAME_H = 40;
const FRAME_COUNT = 3;
const FRAME_DURATION = 150; // ms per frame

// ── Player state ─────────────────────────────────────────
let PLAYER_MAX_HP = 3;

const player = {
    x: 0,
    y: 0,
    scale: 1,
    frame: 0,
    frameTimer: 0,
    hp: PLAYER_MAX_HP,
    hitRadius: 14,
    iFrames: 0,          // invincibility timer (ms) after taking a hit
    alive: true,
    drawAngle: 0,        // cached facing angle; frozen while upgrade menu is open
};
Physics.initBody(player, {
    accel: 800,      // thrust strength (pixels/s²)
    maxSpeed: 350,   // top speed (pixels/s)
    drag: 0.97,      // space drag — lower = stops faster
});

// ── Player logic ─────────────────────────────────────────
function updatePlayer(dt) {
    if (!player.alive) return;

    // Tick invincibility
    if (player.iFrames > 0) player.iFrames -= dt;

    // Build thrust direction from input
    let ax = 0, ay = 0;
    if (keys["ArrowUp"]    || keys["w"]) ay -= 1;
    if (keys["ArrowDown"]  || keys["s"]) ay += 1;
    if (keys["ArrowLeft"]  || keys["a"]) ax -= 1;
    if (keys["ArrowRight"] || keys["d"]) ax += 1;

    // Normalize diagonal thrust so it isn't faster
    if (ax !== 0 && ay !== 0) {
        const inv = 1 / Math.SQRT2;
        ax *= inv;
        ay *= inv;
    }

    // Apply thrust and let physics handle the rest
    Physics.applyThrust(player, ax * player.accel, ay * player.accel, dt);
    Physics.update(player, dt);

    // Keep player on screen (soft bounce off edges)
    const half = (FRAME_W * player.scale) / 2;
    Physics.clampToBounds(player, half, half, canvas.width, canvas.height);

    // Sprite animation
    player.frameTimer += dt;
    if (player.frameTimer >= FRAME_DURATION) {
        player.frameTimer -= FRAME_DURATION;
        player.frame = (player.frame + 1) % FRAME_COUNT;
    }
}

function drawPlayer() {
    if (!player.alive) return;

    // Blink during invincibility (skip drawing every other 80ms)
    if (player.iFrames > 0 && Math.floor(player.iFrames / 80) % 2 === 0) return;

    const drawW = FRAME_W * player.scale;
    const drawH = FRAME_H * player.scale;

    // Angle from player to mouse — only update when game is running
    const offset = 0.5;
    if (!upgradePending) {
        player.drawAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI / 2 - offset;
    }
    const angle = player.drawAngle;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(angle);
    ctx.drawImage(
        spriteSheet,
        player.frame * FRAME_W, 0,
        FRAME_W, FRAME_H,
        -drawW / 2,
        -drawH / 2,
        drawW, drawH
    );
    ctx.restore();
}

// ── Health bar HUD ───────────────────────────────────────
function drawHealthBar() {
    const barW = 120;
    const barH = 12;
    const x = 20;
    const y = 20;
    const fill = player.hp / PLAYER_MAX_HP;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x, y, barW, barH);

    // Health fill
    ctx.fillStyle = fill > 0.5 ? "rgba(80, 220, 100, 0.9)"
                  : fill > 0.25 ? "rgba(220, 180, 50, 0.9)"
                  : "rgba(220, 50, 50, 0.9)";
    ctx.fillRect(x, y, barW * fill, barH);

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);
}
