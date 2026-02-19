const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Canvas size is set in HTML (800x600)

// ── Background image ────────────────────────────────────
const bgImage = new Image();
bgImage.src = "Sprites/Background.png";

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

// ── Parallax star background ─────────────────────────────
// Stars shift based on player position; closer layers move more

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

function drawStarLayer(layer, parallax) {
    // Offset based on how far player is from center
    const ox = (player.x - canvas.width / 2) * parallax;
    const oy = (player.y - canvas.height / 2) * parallax;

    for (const s of layer) {
        // Wrap stars so they tile seamlessly
        let sx = (s.x * canvas.width - ox) % canvas.width;
        let sy = (s.y * canvas.height - oy) % canvas.height;
        if (sx < 0) sx += canvas.width;
        if (sy < 0) sy += canvas.height;

        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillRect(Math.round(sx), Math.round(sy), Math.ceil(s.r), Math.ceil(s.r));
    }
}

function drawBackground() {
    // Background image with subtle parallax (drawn oversized to prevent edge artifacts)
    const bgParallax = 0.01;
    const maxShift = Math.max(canvas.width, canvas.height) * bgParallax / 2;
    const pad = Math.ceil(maxShift) + 1;
    const bgOx = (player.x - canvas.width / 2) * bgParallax;
    const bgOy = (player.y - canvas.height / 2) * bgParallax;
    ctx.drawImage(bgImage, -bgOx - pad, -bgOy - pad, canvas.width + pad * 2, canvas.height + pad * 2);

    // Star layers with increasing parallax (closer = more movement)
    drawStarLayer(starsBack, 0.02);
    drawStarLayer(starsMid, 0.06);
    drawStarLayer(starsFront, 0.12);
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
