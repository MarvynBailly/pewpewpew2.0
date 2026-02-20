// ── Sprite sheet config ──────────────────────────────────
const spriteSheet = new Image();
spriteSheet.src = "Sprites/paper-airplane-idle.png";

const FRAME_W = 40;
const FRAME_H = 40;
const FRAME_COUNT = 3;
const FRAME_DURATION = 150; // ms per frame

// ── Player state ─────────────────────────────────────────
const player = {
    x: 0,
    y: 0,
    scale: 1,
    frame: 0,
    frameTimer: 0,
};
Physics.initBody(player, {
    accel: 800,      // thrust strength (pixels/s²)
    maxSpeed: 350,   // top speed (pixels/s)
    drag: 0.97,      // space drag — lower = stops faster
});

// ── Player logic ─────────────────────────────────────────
function updatePlayer(dt) {
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
    const drawW = FRAME_W * player.scale;
    const drawH = FRAME_H * player.scale;

    // Angle from player to mouse (sprite faces up, so offset by -90deg)
    const offset = 0.5;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI / 2 - offset;

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
