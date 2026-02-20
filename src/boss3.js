// ── Boss 3 — The Mothership ───────────────────────────────
// FORTIFY mode: immune, fires rotating bullet rings, spawns minions
// SIEGE mode:   vulnerable, chases player, fires expanding shockwave pulses
// Phase 2 at 50% HP: more minions, denser rings, double shockwaves + spread

const B3_HP_MAX          = 80;
const B3_SIZE            = 55;  // hitRadius — large and imposing
const B3_MAX_SPEED       = 120;
const B3_MODE_DURATION   = 12000; // ms per mode

// Ring attack (FORTIFY)
const B3_RING_SPEED      = 200;  // px/s
const B3_RING_RADIUS     = 5;

// Shockwave (SIEGE)
const B3_SHOCK_INTERVAL   = 4000;  // ms between shockwaves
const B3_SHOCK_MAX_RADIUS = 180;   // px
const B3_SHOCK_DURATION   = 1200;  // ms to fully expand

// ── State ─────────────────────────────────────────────────
let boss3             = null;
let boss3Spawned      = false;
let boss3WarningTimer = 0;
let boss3Mode         = "fortify"; // "fortify" | "siege"
let boss3ModeTimer    = B3_MODE_DURATION;
let boss3Phase2       = false;
let boss3Shielded     = false;    // true during FORTIFY
let boss3ModeFlash    = 0;

let boss3RingTimer    = 0;
let boss3RingAngle    = 0;        // rotated each volley for a spiral effect
let boss3MinionTimer  = 0;
let boss3ShockTimer   = B3_SHOCK_INTERVAL;

const boss3Bullets    = [];       // rotating ring projectiles
const boss3Shockwaves = [];       // expanding damage rings

// ── Spawn / Death ─────────────────────────────────────────
function spawnBoss3() {
    boss3 = {
        x: canvas.width / 2,
        y: -B3_SIZE * 3,
        hp: B3_HP_MAX,
        hitRadius: B3_SIZE,
        maxForce: 300,
    };
    Physics.initBody(boss3, { accel: 0, maxSpeed: B3_MAX_SPEED, drag: 0.992 });

    boss3Spawned           = true;
    boss3WarningTimer      = 2500;
    boss3Mode              = "fortify";
    boss3ModeTimer         = B3_MODE_DURATION;
    boss3Phase2            = false;
    boss3Shielded          = true;
    boss3ModeFlash         = 0;
    boss3RingTimer         = 1500;
    boss3RingAngle         = 0;
    boss3MinionTimer       = 3000;
    boss3ShockTimer        = B3_SHOCK_INTERVAL;
    boss3Bullets.length    = 0;
    boss3Shockwaves.length = 0;
}

function onBoss3Death() {
    score += 50;
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        dropXpOrb(
            boss3.x + Math.cos(a) * B3_SIZE * (0.5 + Math.random()),
            boss3.y + Math.sin(a) * B3_SIZE * (0.5 + Math.random())
        );
    }
    triggerExplosion(boss3.x, boss3.y);

    boss3                  = null;
    boss3Bullets.length    = 0;
    boss3Shockwaves.length = 0;
    advanceBossQueue();
}

// ── Helpers ───────────────────────────────────────────────
function _b3SpawnMinions(count) {
    for (let i = 0; i < count; i++) {
        const a    = Math.random() * Math.PI * 2;
        const dist = B3_SIZE * 2 + Math.random() * 60;
        createEnemy(
            boss3.x + Math.cos(a) * dist,
            boss3.y + Math.sin(a) * dist
        );
    }
}

function _b3FireRing(count) {
    for (let i = 0; i < count; i++) {
        const a = boss3RingAngle + (i / count) * Math.PI * 2;
        boss3Bullets.push({
            x:         boss3.x + Math.cos(a) * (B3_SIZE + 8),
            y:         boss3.y + Math.sin(a) * (B3_SIZE + 8),
            vx:        Math.cos(a) * B3_RING_SPEED,
            vy:        Math.sin(a) * B3_RING_SPEED,
            hitRadius: B3_RING_RADIUS,
        });
    }
    boss3RingAngle += Math.PI / 8; // rotate each ring slightly for spiral feel
}

function _b3FireShockwave(startDelay) {
    boss3Shockwaves.push({
        x:          boss3.x,
        y:          boss3.y,
        radius:     0,
        timer:      B3_SHOCK_DURATION,
        maxTimer:   B3_SHOCK_DURATION,
        startDelay: startDelay || 0,
        hasHit:     false,
    });
}

// ── Update ────────────────────────────────────────────────
function updateBoss3(dt) {
    if (!boss3) return;
    if (boss3WarningTimer > 0) { boss3WarningTimer -= dt; return; }

    const sec     = dt / 1000;
    const moveSec = freezeTimer > 0 ? sec * 0.3 : sec;
    const moveDt  = moveSec * 1000;

    // Phase 2 check (one-time)
    if (!boss3Phase2 && boss3.hp <= B3_HP_MAX / 2) boss3Phase2 = true;

    // Move ring bullets (unaffected by freeze)
    for (let i = boss3Bullets.length - 1; i >= 0; i--) {
        const b = boss3Bullets[i];
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        if (b.x < -80 || b.x > canvas.width + 80 ||
            b.y < -80 || b.y > canvas.height + 80) {
            boss3Bullets.splice(i, 1);
        }
    }

    // Update shockwaves
    for (let i = boss3Shockwaves.length - 1; i >= 0; i--) {
        const sw = boss3Shockwaves[i];
        if (sw.startDelay > 0) { sw.startDelay -= dt; continue; }
        sw.timer -= dt;
        const progress = 1 - Math.max(0, sw.timer / sw.maxTimer);
        sw.radius = B3_SHOCK_MAX_RADIUS * progress;
        if (sw.timer <= 0) boss3Shockwaves.splice(i, 1);
    }

    // Mode transition
    boss3ModeFlash = Math.max(0, boss3ModeFlash - dt);
    boss3ModeTimer -= dt;
    if (boss3ModeTimer <= 0) {
        boss3Mode      = boss3Mode === "fortify" ? "siege" : "fortify";
        boss3ModeTimer = B3_MODE_DURATION;
        boss3ModeFlash = 600;
        boss3Shielded  = boss3Mode === "fortify";
        if (boss3Mode === "siege") {
            boss3ShockTimer = B3_SHOCK_INTERVAL;
        } else {
            boss3RingTimer   = boss3Phase2 ? 1000 : 1500;
            boss3MinionTimer = boss3Phase2 ? 2200 : 3000;
        }
    }

    // ── FORTIFY ───────────────────────────────────────────
    if (boss3Mode === "fortify") {
        // Brake to a stop
        boss3.vx *= Math.pow(0.85, sec * 60);
        boss3.vy *= Math.pow(0.85, sec * 60);
        boss3.x  += boss3.vx * moveSec;
        boss3.y  += boss3.vy * moveSec;
        Physics.clampToBounds(boss3, B3_SIZE, B3_SIZE, canvas.width, canvas.height);

        // Rotating ring fire
        const ringCount    = boss3Phase2 ? 14 : 10;
        const ringInterval = boss3Phase2 ? 1000 : 1500;
        boss3RingTimer -= dt;
        if (boss3RingTimer <= 0) {
            _b3FireRing(ringCount);
            boss3RingTimer = ringInterval;
        }

        // Minion spawning
        const minionCount    = boss3Phase2 ? 4 : 2;
        const minionInterval = boss3Phase2 ? 2200 : 3000;
        boss3MinionTimer -= dt;
        if (boss3MinionTimer <= 0) {
            _b3SpawnMinions(minionCount);
            boss3MinionTimer = minionInterval;
        }

    // ── SIEGE ─────────────────────────────────────────────
    } else {
        boss3Shielded = false;
        steerArrive(boss3, player, moveDt);
        Physics.update(boss3, moveDt);
        Physics.clampToBounds(boss3, B3_SIZE, B3_SIZE, canvas.width, canvas.height);

        boss3ShockTimer -= dt;
        if (boss3ShockTimer <= 0) {
            _b3FireShockwave(0);
            if (boss3Phase2) {
                _b3FireShockwave(600); // staggered second shockwave
                // Also fire 3-bullet aimed spread
                const base   = Math.atan2(player.y - boss3.y, player.x - boss3.x);
                const spread = 18 * Math.PI / 180;
                for (const delta of [-spread, 0, spread]) {
                    const a = base + delta;
                    boss3Bullets.push({
                        x:         boss3.x + Math.cos(a) * (B3_SIZE + 8),
                        y:         boss3.y + Math.sin(a) * (B3_SIZE + 8),
                        vx:        Math.cos(a) * 260,
                        vy:        Math.sin(a) * 260,
                        hitRadius: B3_RING_RADIUS,
                    });
                }
            }
            boss3ShockTimer = B3_SHOCK_INTERVAL;
        }
    }
}

// ── Draw ──────────────────────────────────────────────────
function drawBoss3() {
    if (boss3WarningTimer > 0) {
        const blink = (boss3WarningTimer % 500) < 250;
        if (blink) {
            ctx.fillStyle    = "rgba(80, 0, 160, 0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 68px monospace";
            ctx.fillStyle    = "rgba(200, 100, 255, 0.95)";
            ctx.fillText("! THE MOTHERSHIP INCOMING !", canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    if (!boss3) return;

    // Mode flash
    if (boss3ModeFlash > 0) {
        const a = (boss3ModeFlash / 600) * 0.3;
        ctx.fillStyle = boss3Mode === "fortify"
            ? `rgba(100, 0, 220, ${a})`
            : `rgba(220, 50, 255, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Shockwave rings
    for (const sw of boss3Shockwaves) {
        if (sw.startDelay > 0 || sw.radius <= 0) continue;
        const progress = sw.radius / B3_SHOCK_MAX_RADIUS;
        const alpha    = (1 - progress) * 0.7;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 100, 255, ${alpha})`;
        ctx.lineWidth   = 8 * (1 - progress) + 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius * 0.82, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 180, 255, ${alpha * 0.35})`;
        ctx.lineWidth   = 3;
        ctx.stroke();
    }

    // Ring bullets
    for (const b of boss3Bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, B3_RING_RADIUS * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(160, 60, 255, 0.15)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, B3_RING_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200, 120, 255, 0.95)";
        ctx.fill();
    }

    // Boss body
    ctx.save();
    ctx.translate(boss3.x, boss3.y);

    // FORTIFY: pulsing shield rings
    if (boss3Mode === "fortify") {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime / 300);
        ctx.beginPath();
        ctx.arc(0, 0, B3_SIZE * 1.5 + pulse * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.2 + pulse * 0.35})`;
        ctx.lineWidth   = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, B3_SIZE * 1.72 + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.1 + pulse * 0.15})`;
        ctx.lineWidth   = 2;
        ctx.stroke();
    }

    ctx.shadowColor = boss3Mode === "fortify"
        ? "rgba(100, 100, 255, 0.9)"
        : "rgba(180, 60, 255, 0.9)";
    ctx.shadowBlur = 32;

    // Hexagon body
    const s = B3_SIZE;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a  = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const px = Math.cos(a) * s;
        const py = Math.sin(a) * s;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = boss3Mode === "fortify"
        ? "rgba(60, 30, 120, 0.95)"
        : "rgba(100, 20, 160, 0.92)";
    ctx.fill();
    ctx.strokeStyle = boss3Mode === "fortify"
        ? "rgba(140, 80, 255, 0.9)"
        : "rgba(220, 100, 255, 0.95)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pulsing core eye
    const eyePulse = 0.5 + 0.5 * Math.sin(gameTime / 220);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = boss3Mode === "fortify"
        ? `rgba(80, 200, 255, ${0.6 + eyePulse * 0.35})`
        : `rgba(255, 100, 255, ${0.6 + eyePulse * 0.35})`;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawBoss3HpBar();
}

function drawBoss3HpBar() {
    const barW  = 420;
    const barH  = 20;
    const bx    = canvas.width / 2 - barW / 2;
    const by    = canvas.height - 46;
    const frac  = boss3.hp / B3_HP_MAX;
    const fillW = frac * barW;

    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.font         = "bold 13px monospace";
    ctx.fillStyle    = boss3Shielded
        ? "rgba(100, 200, 255, 0.9)"
        : "rgba(200, 120, 255, 0.9)";
    ctx.fillText(boss3Shielded ? "THE MOTHERSHIP  —  SHIELDED" : "THE MOTHERSHIP", canvas.width / 2, by - 3);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx, by, barW, barH);

    if (!boss3Shielded) {
        ctx.fillStyle = `rgb(${Math.round(130 + 125 * (1 - frac))}, 0, ${Math.round(200 * frac)})`;
        ctx.fillRect(bx, by, fillW, barH);
    } else {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime / 200);
        ctx.fillStyle = `rgba(80, 180, 255, ${0.6 + pulse * 0.35})`;
        ctx.fillRect(bx, by, barW, barH);
    }

    ctx.strokeStyle = "rgba(180, 100, 255, 0.7)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
}
