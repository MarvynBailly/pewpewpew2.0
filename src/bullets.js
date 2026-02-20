// ── Bullets ──────────────────────────────────────────────

const bullets = [];

const BULLET_SPEED = 350;     // pixels per second
const BULLET_RADIUS = 2;
const FIRE_RATE = 1000;        // ms between shots

let fireTimer = 0;

function spawnBullet() {
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return; // mouse is right on the player

    // Normalize direction and set velocity
    const dirX = dx / dist;
    const dirY = dy / dist;

    bullets.push({
        x: player.x + dirX * 15,   // spawn slightly ahead of the ship
        y: player.y + dirY * 15,
        vx: dirX * BULLET_SPEED + player.vx * 0.3,  // inherit a bit of player momentum
        vy: dirY * BULLET_SPEED + player.vy * 0.3,
        hitRadius: BULLET_RADIUS,
    });
}

function spawnBulletAtAngle(angleDelta) {
    const baseAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    const angle = baseAngle + angleDelta;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    bullets.push({
        x: player.x + dirX * 15,
        y: player.y + dirY * 15,
        vx: dirX * BULLET_SPEED + player.vx * 0.3,
        vy: dirY * BULLET_SPEED + player.vy * 0.3,
        hitRadius: BULLET_RADIUS,
    });
}

function updateBullets(dt) {
    const seconds = dt / 1000;

    const hasMinigun = !!fireModes.minigun;
    const hasTrishot = !!fireModes.trishot;
    const hasMissile = !!fireModes.missile;

    // Determine fire rate: minigun overrides everything, missile-only is slowest
    const rate = hasMinigun ? 120
               : hasMissile ? 2000
               : FIRE_RATE;

    fireTimer -= dt;
    if (fireTimer <= 0) {
        const angles = hasTrishot
            ? [0, 15 * Math.PI / 180, -15 * Math.PI / 180]
            : [hasMinigun ? (Math.random() - 0.5) * (24 * Math.PI / 180) : 0];

        for (const angle of angles) {
            if (hasMissile) {
                spawnMissileAtAngle(angle);
            } else {
                spawnBulletAtAngle(angle);
            }
        }

        // Minigun recoil kick
        if (hasMinigun) {
            const dx = mouse.x - player.x;
            const dy = mouse.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= 1) {
                Physics.applyThrust(player, -(dx / dist) * 4000, -(dy / dist) * 4000, dt);
            }
        }

        fireTimer = rate;
    }

    // Move bullets and remove off-screen ones
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * seconds;
        b.y += b.vy * seconds;

        // Remove if out of bounds (with some padding)
        if (b.x < -50 || b.x > canvas.width + 50 ||
            b.y < -50 || b.y > canvas.height + 50) {
            bullets.splice(i, 1);
        }
    }
}

function drawBullets() {
    for (const b of bullets) {
        // Glowing bullet
        ctx.save();

        // Outer glow
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_RADIUS * 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 200, 255, 0.15)";
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180, 230, 255, 0.95)";
        ctx.fill();

        ctx.restore();
    }
}
