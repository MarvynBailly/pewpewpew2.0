const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Canvas size is set in HTML (800x600)

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
    speed: 4,
    scale: 1,
    frame: 0,
    frameTimer: 0,
};

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

// ── Static space background ──────────────────────────────
// Generated once, redrawn from arrays each frame (no movement)

function generateStars(count, rMin, rMax, alphaMin, alphaMax) {
    const stars = [];
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random(),  // 0-1 normalized, scaled to canvas on draw
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

function drawStarLayer(layer) {
    for (const s of layer) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(
            Math.round(s.x * canvas.width),
            Math.round(s.y * canvas.height),
            Math.ceil(s.r), Math.ceil(s.r)
        );
    }
}

function drawBackground() {
    // Deep space
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Star layers
    drawStarLayer(starsBack);
    drawStarLayer(starsMid);

    // Front stars (closest)
    drawStarLayer(starsFront);
}

// ── Player logic ─────────────────────────────────────────
function updatePlayer(dt) {
    if (keys["ArrowUp"] || keys["w"]) player.y -= player.speed;
    if (keys["ArrowDown"] || keys["s"]) player.y += player.speed;
    if (keys["ArrowLeft"] || keys["a"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"]) player.x += player.speed;

    const half = (FRAME_W * player.scale) / 2;
    player.x = Math.max(half, Math.min(canvas.width - half, player.x));
    player.y = Math.max(half, Math.min(canvas.height - half, player.y));

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

// ── Game loop ────────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    updatePlayer(dt);

    drawBackground();
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

// Start when sprite sheet is loaded
spriteSheet.onload = () => {
    // Center player after first resize
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.7;
    requestAnimationFrame(gameLoop);
};
