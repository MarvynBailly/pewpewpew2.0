// ── Boss 7 — The Swarm Queen ──────────────────────────────
// NEST mode: retreats to corner, invulnerable, spawns minion waves, fires outward spiral
// HUNT mode: vulnerable, chases player, fires homing minion-missiles (spawn enemy on impact)
// Phase 2 at 50% HP: more minions, dual spiral, missiles spawn 2 enemies on impact
// On death: half of remaining enemies die; rest go berserk (2× speed) for 5s

const B7_HP_MAX        = 100;
const B7_SIZE          = 38;
const B7_MAX_SPEED     = 100;
const B7_MODE_DURATION = 13000;

// NEST mode
const B7_MINION_INTERVAL = 3500; // ms between minion waves
const B7_MINION_COUNT    = 3;    // per wave (5 in phase 2)
const B7_SPIRAL_INTERVAL = 1200; // ms between spiral shots
const B7_SPIRAL_COUNT    = 6;    // bullets per ring
const B7_SPIRAL_SPEED    = 180;  // px/s
const B7_SPIRAL_RADIUS   = 5;
const B7_CORNER_MARGIN   = 80;   // how close to corner to aim for

// HUNT mode
const B7_MISSILE_INTERVAL = 3000; // ms between missiles
const B7_MISSILE_SPEED    = 200;
const B7_MISSILE_TURN     = 1.6;  // rad/s — lazy homing
const B7_MISSILE_RADIUS   = 5;

// Berserk timer on death
const B7_BERSERK_DURATION = 5000; // ms

// ── State ─────────────────────────────────────────────────
let boss7             = null;
let boss7Spawned      = false;
let boss7WarningTimer = 0;
let boss7Mode         = "nest"; // "nest" | "hunt"
let boss7ModeTimer    = B7_MODE_DURATION;
let boss7Phase2       = false;
let boss7Shielded     = false;  // true in NEST
let boss7ModeFlash    = 0;

let boss7CornerX      = 0;
let boss7CornerY      = 0;
let boss7MinionTimer  = B7_MINION_INTERVAL;
let boss7SpiralTimer  = B7_SPIRAL_INTERVAL;
let boss7SpiralAngle  = 0;
let boss7MissileTimer = B7_MISSILE_INTERVAL;

const boss7Missiles   = []; // homing minion-missiles
const boss7Bullets    = []; // outward spiral shots

// ── Spawn / Death ─────────────────────────────────────────
function spawnBoss7() {
    boss7 = {
        x: canvas.width / 2,
        y: -B7_SIZE * 3,
        hp: B7_HP_MAX,
        hitRadius: B7_SIZE,
        maxForce: 250,
    };
    Physics.initBody(boss7, { accel: 0, maxSpeed: B7_MAX_SPEED, drag: 0.993 });

    boss7Spawned         = true;
    boss7WarningTimer    = 2500;
    boss7Mode            = "nest";
    boss7ModeTimer       = B7_MODE_DURATION;
    boss7Phase2          = false;
    boss7Shielded        = true;
    boss7ModeFlash       = 0;
    boss7SpiralAngle     = 0;
    boss7MinionTimer     = B7_MINION_INTERVAL;
    boss7SpiralTimer     = B7_SPIRAL_INTERVAL;
    boss7MissileTimer    = B7_MISSILE_INTERVAL;
    boss7Missiles.length = 0;
    boss7Bullets.length  = 0;
    _b7PickCorner();
}

function onBoss7Death() {
    score += 80;
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        dropXpOrb(
            boss7.x + Math.cos(a) * B7_SIZE * (0.5 + Math.random()),
            boss7.y + Math.sin(a) * B7_SIZE * (0.5 + Math.random())
        );
    }
    triggerExplosion(boss7.x, boss7.y);

    // Half the remaining enemies die; the other half go berserk
    const survivors = [];
    for (const e of enemies) {
        if (Math.random() < 0.5) {
            dropXpOrb(e.x, e.y);
        } else {
            e.berserkTimer    = B7_BERSERK_DURATION;
            e.normalMaxSpeed  = e.maxSpeed;
            e.maxSpeed       *= 2.2;
            survivors.push(e);
        }
    }
    enemies.length = 0;
    for (const e of survivors) enemies.push(e);

    boss7                = null;
    boss7Missiles.length = 0;
    boss7Bullets.length  = 0;
    advanceBossQueue();
}

// ── Helpers ───────────────────────────────────────────────
function _b7PickCorner() {
    const m       = B7_CORNER_MARGIN;
    const corners = [
        { x: m,                    y: m },
        { x: canvas.width  - m,   y: m },
        { x: m,                    y: canvas.height - m },
        { x: canvas.width  - m,   y: canvas.height - m },
    ];
    const cx = boss7 ? boss7.x : canvas.width  / 2;
    const cy = boss7 ? boss7.y : canvas.height / 2;
    let best = corners[0], bestDist = Infinity;
    for (const c of corners) {
        const d = Math.hypot(c.x - cx, c.y - cy);
        if (d < bestDist) { bestDist = d; best = c; }
    }
    boss7CornerX = best.x;
    boss7CornerY = best.y;
}

function _b7SpawnMinions(count) {
    for (let i = 0; i < count; i++) {
        const a    = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = B7_SIZE * 2 + Math.random() * 50;
        createEnemy(
            boss7.x + Math.cos(a) * dist,
            boss7.y + Math.sin(a) * dist
        );
    }
}

function _b7FireSpiral() {
    // Phase 2: fire in two opposite directions simultaneously
    const offsets = boss7Phase2 ? [0, Math.PI] : [0];
    for (const off of offsets) {
        for (let i = 0; i < B7_SPIRAL_COUNT; i++) {
            const a = off + boss7SpiralAngle + (i / B7_SPIRAL_COUNT) * Math.PI * 2;
            boss7Bullets.push({
                x:         boss7.x + Math.cos(a) * (B7_SIZE + 6),
                y:         boss7.y + Math.sin(a) * (B7_SIZE + 6),
                vx:        Math.cos(a) * B7_SPIRAL_SPEED,
                vy:        Math.sin(a) * B7_SPIRAL_SPEED,
                hitRadius: B7_SPIRAL_RADIUS,
            });
        }
    }
    boss7SpiralAngle += Math.PI / 7;
}

function _b7FireMissile() {
    const dx   = player.x - boss7.x;
    const dy   = player.y - boss7.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    boss7Missiles.push({
        x:          boss7.x + (dx / dist) * (B7_SIZE + 8),
        y:          boss7.y + (dy / dist) * (B7_SIZE + 8),
        vx:         (dx / dist) * B7_MISSILE_SPEED,
        vy:         (dy / dist) * B7_MISSILE_SPEED,
        hitRadius:  B7_MISSILE_RADIUS,
        splitCount: boss7Phase2 ? 2 : 1,
    });
}

// ── Berserk enemy tick (call always, even when boss7 is null) ──
function tickBoss7BerserkEnemies(dt) {
    for (const e of enemies) {
        if (e.berserkTimer > 0) {
            e.berserkTimer -= dt;
            if (e.berserkTimer <= 0) {
                e.maxSpeed     = e.normalMaxSpeed || e.maxSpeed;
                e.berserkTimer = 0;
            }
        }
    }
}

// ── Update ────────────────────────────────────────────────
function updateBoss7(dt) {
    tickBoss7BerserkEnemies(dt);

    if (!boss7) return;
    if (boss7WarningTimer > 0) { boss7WarningTimer -= dt; return; }

    const sec     = dt / 1000;
    const moveSec = freezeTimer > 0 ? sec * 0.3 : sec;
    const moveDt  = moveSec * 1000;

    if (!boss7Phase2 && boss7.hp <= B7_HP_MAX / 2) boss7Phase2 = true;

    // Update homing missiles (unaffected by freeze)
    for (let i = boss7Missiles.length - 1; i >= 0; i--) {
        const m           = boss7Missiles[i];
        const targetAngle = Math.atan2(player.y - m.y, player.x - m.x);
        let   curAngle    = Math.atan2(m.vy, m.vx);
        let   diff        = targetAngle - curAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        curAngle += Math.max(-B7_MISSILE_TURN * sec, Math.min(B7_MISSILE_TURN * sec, diff));
        const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || B7_MISSILE_SPEED;
        m.vx = Math.cos(curAngle) * spd;
        m.vy = Math.sin(curAngle) * spd;
        m.x += m.vx * sec;
        m.y += m.vy * sec;
        if (m.x < -80 || m.x > canvas.width + 80 ||
            m.y < -80 || m.y > canvas.height + 80) {
            boss7Missiles.splice(i, 1);
        }
    }

    // Move spiral bullets
    for (let i = boss7Bullets.length - 1; i >= 0; i--) {
        const b = boss7Bullets[i];
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        if (b.x < -80 || b.x > canvas.width + 80 ||
            b.y < -80 || b.y > canvas.height + 80) {
            boss7Bullets.splice(i, 1);
        }
    }

    // Mode transition
    boss7ModeFlash = Math.max(0, boss7ModeFlash - dt);
    boss7ModeTimer -= dt;
    if (boss7ModeTimer <= 0) {
        boss7Mode      = boss7Mode === "nest" ? "hunt" : "nest";
        boss7ModeTimer = B7_MODE_DURATION;
        boss7ModeFlash = 600;
        boss7Shielded  = boss7Mode === "nest";
        if (boss7Mode === "nest") {
            _b7PickCorner();
            boss7MinionTimer = boss7Phase2 ? 2800 : B7_MINION_INTERVAL;
            boss7SpiralTimer = B7_SPIRAL_INTERVAL;
        } else {
            boss7MissileTimer = B7_MISSILE_INTERVAL;
        }
    }

    // ── NEST mode ─────────────────────────────────────────
    if (boss7Mode === "nest") {
        steerArrive(boss7, { x: boss7CornerX, y: boss7CornerY }, moveDt);
        Physics.update(boss7, moveDt);
        Physics.clampToBounds(boss7, B7_SIZE, B7_SIZE, canvas.width, canvas.height);

        const minionCount    = boss7Phase2 ? 5 : B7_MINION_COUNT;
        const minionInterval = boss7Phase2 ? 2800 : B7_MINION_INTERVAL;
        boss7MinionTimer -= dt;
        if (boss7MinionTimer <= 0) {
            _b7SpawnMinions(minionCount);
            boss7MinionTimer = minionInterval;
        }

        boss7SpiralTimer -= dt;
        if (boss7SpiralTimer <= 0) {
            _b7FireSpiral();
            boss7SpiralTimer = B7_SPIRAL_INTERVAL;
        }

    // ── HUNT mode ─────────────────────────────────────────
    } else {
        boss7Shielded = false;
        steerArrive(boss7, player, moveDt);
        Physics.update(boss7, moveDt);
        Physics.clampToBounds(boss7, B7_SIZE, B7_SIZE, canvas.width, canvas.height);

        boss7MissileTimer -= dt;
        if (boss7MissileTimer <= 0) {
            _b7FireMissile();
            boss7MissileTimer = B7_MISSILE_INTERVAL;
        }
    }
}

// ── Draw ──────────────────────────────────────────────────
function drawBoss7() {
    if (boss7WarningTimer > 0) {
        const blink = (boss7WarningTimer % 500) < 250;
        if (blink) {
            ctx.fillStyle    = "rgba(0, 60, 10, 0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 68px monospace";
            ctx.fillStyle    = "rgba(80, 255, 160, 0.95)";
            ctx.fillText("! THE SWARM QUEEN INCOMING !", canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    if (!boss7) return;

    if (boss7ModeFlash > 0) {
        const a = (boss7ModeFlash / 600) * 0.25;
        ctx.fillStyle = boss7Mode === "nest"
            ? `rgba(0, 100, 40, ${a})`
            : `rgba(100, 200, 80, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Homing missiles
    for (const m of boss7Missiles) {
        const ma = Math.atan2(m.vy, m.vx);
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(ma);
        ctx.beginPath();
        ctx.moveTo( 12,  0);
        ctx.lineTo(-5,  -5);
        ctx.lineTo(-5,   5);
        ctx.closePath();
        ctx.fillStyle = "rgba(80, 220, 120, 0.92)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-5, 0, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(40, 160, 80, 0.7)";
        ctx.fill();
        ctx.restore();
    }

    // Spiral bullets
    for (const b of boss7Bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, B7_SPIRAL_RADIUS * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(80, 255, 140, 0.12)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, B7_SPIRAL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 240, 160, 0.95)";
        ctx.fill();
    }

    // Boss body
    ctx.save();
    ctx.translate(boss7.x, boss7.y);

    // NEST: glowing shield ring
    if (boss7Mode === "nest") {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime / 350);
        ctx.beginPath();
        ctx.arc(0, 0, B7_SIZE * 1.6 + pulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 255, 120, ${0.2 + pulse * 0.3})`;
        ctx.lineWidth   = 3;
        ctx.stroke();
    }

    ctx.shadowColor = boss7Mode === "nest"
        ? "rgba(120, 255, 160, 0.85)"
        : "rgba(60, 200, 100, 0.85)";
    ctx.shadowBlur = 28;

    // Flower body: 6 overlapping petal circles + central hub
    const s    = B7_SIZE;
    const rot  = gameTime / 4000; // slow rotation
    ctx.fillStyle = boss7Mode === "nest"
        ? "rgba(30, 120, 60, 0.95)"
        : "rgba(60, 170, 80, 0.92)";
    ctx.strokeStyle = boss7Mode === "nest"
        ? "rgba(120, 255, 160, 0.9)"
        : "rgba(80, 220, 120, 0.9)";
    ctx.lineWidth = 2.5;

    for (let i = 0; i < 6; i++) {
        const a  = rot + (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * s * 0.65;
        const py = Math.sin(a) * s * 0.65;
        ctx.beginPath();
        ctx.arc(px, py, s * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // Central hub
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = boss7Mode === "nest"
        ? "rgba(40, 160, 80, 0.98)"
        : "rgba(80, 200, 100, 0.98)";
    ctx.fill();
    ctx.stroke();

    // Pulsing core eye
    const eyePulse = 0.5 + 0.5 * Math.sin(gameTime / 250);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 255, 140, ${0.7 + eyePulse * 0.3})`;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawBoss7HpBar();
}

function drawBoss7HpBar() {
    const barW  = 420;
    const barH  = 20;
    const bx    = canvas.width / 2 - barW / 2;
    const by    = canvas.height - 46;
    const frac  = boss7.hp / B7_HP_MAX;
    const fillW = frac * barW;

    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.font         = "bold 13px monospace";
    ctx.fillStyle    = boss7Shielded
        ? "rgba(200, 255, 120, 0.9)"
        : "rgba(80, 220, 120, 0.9)";
    ctx.fillText(boss7Shielded ? "THE SWARM QUEEN  —  NESTING" : "THE SWARM QUEEN", canvas.width / 2, by - 3);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx, by, barW, barH);

    if (!boss7Shielded) {
        ctx.fillStyle = `rgb(0, ${Math.round(120 + 100 * frac)}, ${Math.round(40 * frac)})`;
        ctx.fillRect(bx, by, fillW, barH);
    } else {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime / 250);
        ctx.fillStyle = `rgba(150, 255, 120, ${0.55 + pulse * 0.3})`;
        ctx.fillRect(bx, by, barW, barH);
    }

    ctx.strokeStyle = "rgba(80, 200, 100, 0.7)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
}
