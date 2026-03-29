// ── Boss ─────────────────────────────────────────────────

const BOSS_HP_MAX = 40;
const BOSS_SIZE   = 40; // hitRadius

let boss             = null;
let bossSpawned      = false;
let bossWarningTimer = 0;

// ── State machine ─────────────────────────────────────────
// hunt    → normal steering + periodic shooting
// windup  → braking, boosters charging, locked target at end
// dash    → flying straight at locked velocity
const BS = { HUNT: "hunt", WINDUP: "windup", DASH: "dash" };

let bossState      = BS.HUNT;
let bossStateTimer = 0; // countdown within the current state

// Attack timers
const BOSS_FIRE_INTERVAL   = 2500; // ms between shots
const BOSS_CHARGE_INTERVAL = 9000; // ms between charge attempts
const BOSS_WINDUP_DURATION = 1800; // ms boss charges up
const BOSS_DASH_DURATION   = 700;  // ms of the actual dash
const BOSS_DASH_SPEED      = 900;  // px/s

let bossFireTimer   = 2500;
let bossChargeTimer = BOSS_CHARGE_INTERVAL;

// Locked dash velocity (set at end of windup)
let bossDashVx = 0;
let bossDashVy = 0;

// ── Boss projectiles ──────────────────────────────────────
const bossBullets = [];
const BOSS_BULLET_SPEED  = 280;
const BOSS_BULLET_RADIUS = 6;

// ── Dash motion trail ─────────────────────────────────────
const dashTrail = [];

// ─────────────────────────────────────────────────────────

function spawnBoss() {
    boss = {
        x: canvas.width / 2,
        y: -BOSS_SIZE * 3,
        hp: BOSS_HP_MAX,
        hitRadius: BOSS_SIZE,
        maxForce: 500,
    };
    Physics.initBody(boss, { accel: 0, maxSpeed: 200, drag: 0.994 });

    bossSpawned        = true;
    bossWarningTimer   = 2500;
    bossState          = BS.HUNT;
    bossFireTimer      = 2500;
    bossChargeTimer    = BOSS_CHARGE_INTERVAL;
    bossBullets.length = 0;
    dashTrail.length   = 0;
}

function onBossDeath() {
    score += 25;
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        dropXpOrb(
            boss.x + Math.cos(a) * BOSS_SIZE * (0.5 + Math.random()),
            boss.y + Math.sin(a) * BOSS_SIZE * (0.5 + Math.random())
        );
    }
    triggerExplosion(boss.x, boss.y);

    boss               = null;
    bossState          = BS.HUNT;
    bossBullets.length = 0;
    dashTrail.length   = 0;
    difficultyOffset = gameTime;
    spawnTimer       = 2000;

    advanceBossQueue();
}

// ── Predictive aim ────────────────────────────────────────
// Estimate where the player will be when a bullet arrives.
function predictPlayerPos() {
    const dx   = player.x - boss.x;
    const dy   = player.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const t    = dist / BOSS_BULLET_SPEED; // travel time estimate
    return {
        x: player.x + player.vx * t,
        y: player.y + player.vy * t,
    };
}

function fireBossShot() {
    const target = predictPlayerPos();
    const dx     = target.x - boss.x;
    const dy     = target.y - boss.y;
    const dist   = Math.sqrt(dx * dx + dy * dy) || 1;
    bossBullets.push({
        x:          boss.x + (dx / dist) * (BOSS_SIZE + 6),
        y:          boss.y + (dy / dist) * (BOSS_SIZE + 6),
        vx:         (dx / dist) * BOSS_BULLET_SPEED,
        vy:         (dy / dist) * BOSS_BULLET_SPEED,
        hitRadius:  BOSS_BULLET_RADIUS,
    });
}

// ── Update ────────────────────────────────────────────────
function updateBoss(dt) {
    if (!boss) return;

    if (bossWarningTimer > 0) {
        bossWarningTimer -= dt;
        return;
    }

    const sec = dt / 1000;
    // Freeze power-up slows boss movement to 30% (timers still tick normally)
    const moveSec = freezeTimer > 0 ? sec * 0.3 : sec;
    const moveDt  = moveSec * 1000;

    // Move boss bullets (unaffected by freeze)
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        const b = bossBullets[i];
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        if (b.x < -60 || b.x > canvas.width + 60 ||
            b.y < -60 || b.y > canvas.height + 60) {
            bossBullets.splice(i, 1);
        }
    }

    // ── HUNT ──────────────────────────────────────────────
    if (bossState === BS.HUNT) {
        steerArrive(boss, player, moveDt);
        Physics.update(boss, moveDt);
        Physics.clampToBounds(boss, BOSS_SIZE, BOSS_SIZE, canvas.width, canvas.height);

        // Shoot at player
        bossFireTimer -= dt;
        if (bossFireTimer <= 0) {
            fireBossShot();
            bossFireTimer = BOSS_FIRE_INTERVAL;
        }

        // Trigger charge windup
        bossChargeTimer -= dt;
        if (bossChargeTimer <= 0) {
            bossState        = BS.WINDUP;
            bossStateTimer   = BOSS_WINDUP_DURATION;
            bossChargeTimer  = BOSS_CHARGE_INTERVAL;
            dashTrail.length = 0;
        }

    // ── WINDUP ────────────────────────────────────────────
    } else if (bossState === BS.WINDUP) {
        // Heavy deceleration so the boss "plants" before the dash
        const brakeDrag = Math.pow(0.88, sec * 60);
        boss.vx *= brakeDrag;
        boss.vy *= brakeDrag;
        if (Math.abs(boss.vx) < 1) boss.vx = 0;
        if (Math.abs(boss.vy) < 1) boss.vy = 0;
        boss.x += boss.vx * moveSec;
        boss.y += boss.vy * moveSec;
        Physics.clampToBounds(boss, BOSS_SIZE, BOSS_SIZE, canvas.width, canvas.height);

        bossStateTimer -= dt;
        if (bossStateTimer <= 0) {
            // Lock in direction toward player's current position
            const dx = player.x - boss.x;
            const dy = player.y - boss.y;
            const dist   = Math.sqrt(dx * dx + dy * dy) || 1;
            bossDashVx   = (dx / dist) * BOSS_DASH_SPEED;
            bossDashVy   = (dy / dist) * BOSS_DASH_SPEED;
            bossState    = BS.DASH;
            bossStateTimer = BOSS_DASH_DURATION;
        }

    // ── DASH ──────────────────────────────────────────────
    } else if (bossState === BS.DASH) {
        // Record trail point
        dashTrail.push({ x: boss.x, y: boss.y, age: 0 });

        // Move in locked straight line — bypass physics engine
        boss.x += bossDashVx * moveSec;
        boss.y += bossDashVy * moveSec;

        // Bounce off edges to keep boss on-screen
        if (boss.x < BOSS_SIZE)                 { boss.x = BOSS_SIZE;                 bossDashVx = Math.abs(bossDashVx) * 0.6; }
        if (boss.x > canvas.width  - BOSS_SIZE) { boss.x = canvas.width  - BOSS_SIZE; bossDashVx = -Math.abs(bossDashVx) * 0.6; }
        if (boss.y < BOSS_SIZE)                 { boss.y = BOSS_SIZE;                 bossDashVy = Math.abs(bossDashVy) * 0.6; }
        if (boss.y > canvas.height - BOSS_SIZE) { boss.y = canvas.height - BOSS_SIZE; bossDashVy = -Math.abs(bossDashVy) * 0.6; }

        // Age trail
        for (let i = dashTrail.length - 1; i >= 0; i--) {
            dashTrail[i].age += dt;
            if (dashTrail[i].age > 280) dashTrail.splice(i, 1);
        }

        bossStateTimer -= dt;
        if (bossStateTimer <= 0) {
            boss.vx   = bossDashVx * 0.08;
            boss.vy   = bossDashVy * 0.08;
            bossState = BS.HUNT;
            dashTrail.length = 0;
        }
    }
}

// ── Draw ──────────────────────────────────────────────────
function drawBoss() {
    // Warning overlay
    if (bossWarningTimer > 0) {
        const blink = (bossWarningTimer % 500) < 250;
        if (blink) {
            ctx.fillStyle = "rgba(200, 30, 0, 0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 68px monospace";
            ctx.fillStyle    = "rgba(255, 220, 40, 0.95)";
            ctx.fillText("! THE HUNTER INCOMING !", canvas.width / 2, canvas.height / 2);
        }
    }

    if (!boss) return;

    // Dash motion trail
    for (const t of dashTrail) {
        const frac  = 1 - t.age / 280;
        const alpha = frac * 0.4;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BOSS_SIZE * frac * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
        ctx.fill();
    }

    // Facing angle — track player during windup, lock to dash direction while dashing
    const facingAngle = bossState === BS.DASH   ? Math.atan2(bossDashVy, bossDashVx)
                      : bossState === BS.WINDUP ? Math.atan2(player.y - boss.y, player.x - boss.x)
                      :                          Math.atan2(boss.vy || -1, boss.vx);

    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(facingAngle);

    // ── Windup booster charge effect ──────────────────────
    if (bossState === BS.WINDUP) {
        const progress = 1 - bossStateTimer / BOSS_WINDUP_DURATION; // 0 → 1
        const flareSize = BOSS_SIZE * (1.0 + progress * 3);
        const alpha     = 0.12 + progress * 0.55;

        // Radial gradient flare at the tail
        const grad = ctx.createRadialGradient(-BOSS_SIZE, 0, 0, -BOSS_SIZE, 0, flareSize);
        grad.addColorStop(0,   `rgba(255, 230, 80, ${alpha + 0.35})`);
        grad.addColorStop(0.3, `rgba(255, 100, 0,  ${alpha})`);
        grad.addColorStop(1,   "rgba(255, 40, 0, 0)");
        ctx.beginPath();
        ctx.arc(-BOSS_SIZE, 0, flareSize, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Shake intensifies toward end of windup
        if (progress > 0.55) {
            const mag = (progress - 0.55) * 6;
            ctx.translate(
                (Math.random() - 0.5) * mag,
                (Math.random() - 0.5) * mag
            );
        }
    }

    // ── Glow ──────────────────────────────────────────────
    ctx.shadowColor = bossState === BS.DASH
        ? "rgba(255, 255, 180, 1.0)"
        : "rgba(255, 160, 0,  0.9)";
    ctx.shadowBlur = bossState === BS.DASH ? 48 : 28;

    // ── Body ──────────────────────────────────────────────
    const s = BOSS_SIZE;
    ctx.beginPath();
    ctx.moveTo( s * 1.5,  0);
    ctx.lineTo(-s * 0.3, -s * 1.1);
    ctx.lineTo(-s * 0.7, -s * 0.35);
    ctx.lineTo(-s,        0);
    ctx.lineTo(-s * 0.7,  s * 0.35);
    ctx.lineTo(-s * 0.3,  s * 1.1);
    ctx.closePath();

    ctx.fillStyle = bossState === BS.DASH
        ? "rgba(255, 230, 110, 0.97)"
        : "rgba(255, 150, 0,   0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 230, 80, 0.95)";
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.arc(s * 0.3, 0, s * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 240, 120, 0.7)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Boss bullets ──────────────────────────────────────
    for (const b of bossBullets) {
        ctx.save();
        // Outer glow
        ctx.beginPath();
        ctx.arc(b.x, b.y, BOSS_BULLET_RADIUS * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 80, 0, 0.18)";
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(b.x, b.y, BOSS_BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 170, 40, 0.95)";
        ctx.fill();
        ctx.restore();
    }

    drawBossHpBar();
}

function drawBossHpBar() {
    const barW  = 420;
    const barH  = 20;
    const bx    = canvas.width / 2 - barW / 2;
    const by    = canvas.height - 46;
    const frac  = boss.hp / BOSS_HP_MAX;
    const fillW = frac * barW;

    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.font         = "bold 13px monospace";
    ctx.fillStyle    = "rgba(255, 210, 60, 0.9)";
    ctx.fillText("THE HUNTER", canvas.width / 2, by - 3);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx, by, barW, barH);

    const g = Math.round(150 * frac);
    ctx.fillStyle = `rgb(255, ${g}, 0)`;
    ctx.fillRect(bx, by, fillW, barH);

    ctx.strokeStyle = "rgba(255, 200, 60, 0.7)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
}
