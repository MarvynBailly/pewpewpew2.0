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

// ── Game loop ────────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);

    drawBackground();
    drawBullets();
    drawEnemies();
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

    // Spawn a few test enemies
    createEnemy(100, 100);
    createEnemy(canvas.width - 100, 100);
    createEnemy(canvas.width / 2, 50);

    requestAnimationFrame(gameLoop);
}
spriteSheet.onload = onImageLoaded;
bgImage.onload = onImageLoaded;
