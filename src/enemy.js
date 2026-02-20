// ── Enemies ──────────────────────────────────────────────

const enemies = [];

const ENEMY_SIZE = 14;        // half-size for drawing / collision

// Random float in [min, max]
function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function createEnemy(x, y) {
    // Difficulty scales with time — enemies get faster and more aggressive
    const elapsed = Math.max(0, (gameTime - difficultyOffset)) / 1000 * (postBossMode ? 3 : 1);
    const ramp = 1 + elapsed * 0.02; // +2% per second

    const e = {
        x, y,
        maxForce: randRange(250, 450) * ramp,
        hitRadius: ENEMY_SIZE,
        hp: 1,
    };
    Physics.initBody(e, {
        accel: 0,
        maxSpeed: randRange(250, 380) * ramp,
        drag: randRange(0.985, 0.999),
    });
    enemies.push(e);
    return e;
}

// ── Steering: arrive / seek toward a target ──────────────
// Adapted from Craig Reynolds' steering behaviors.
// desired = normalize(target - pos) * maxSpeed
// steer   = desired - velocity, clamped to maxForce
function steerArrive(enemy, target, dt) {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return; // already on top of target

    // Desired velocity: full speed toward target
    const desiredX = (dx / dist) * enemy.maxSpeed;
    const desiredY = (dy / dist) * enemy.maxSpeed;

    // Steering = desired - current velocity
    let steerX = desiredX - enemy.vx;
    let steerY = desiredY - enemy.vy;

    // Limit steering force
    const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
    if (steerMag > enemy.maxForce) {
        steerX = (steerX / steerMag) * enemy.maxForce;
        steerY = (steerY / steerMag) * enemy.maxForce;
    }

    // Apply as thrust
    Physics.applyThrust(enemy, steerX, steerY, dt);
}

// ── Update & draw all enemies ────────────────────────────
function updateEnemies(dt) {
    if (freezeTimer > 0) return; // frozen — skip all movement
    for (const e of enemies) {
        steerArrive(e, player, dt);
        Physics.update(e, dt);
        Physics.clampToBounds(e, ENEMY_SIZE, ENEMY_SIZE, canvas.width, canvas.height);
    }
}

function drawEnemies() {
    for (const e of enemies) {
        // Face the direction of travel
        const angle = Math.atan2(e.vy, e.vx);

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(angle);

        // Simple diamond / arrow shape
        ctx.beginPath();
        ctx.moveTo(ENEMY_SIZE, 0);              // nose
        ctx.lineTo(-ENEMY_SIZE, -ENEMY_SIZE);    // top-left wing
        ctx.lineTo(-ENEMY_SIZE * 0.5, 0);       // inner notch
        ctx.lineTo(-ENEMY_SIZE, ENEMY_SIZE);     // bottom-left wing
        ctx.closePath();

        ctx.fillStyle = "rgba(255, 60, 60, 0.85)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 120, 120, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }
}
