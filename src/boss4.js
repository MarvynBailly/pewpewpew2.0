// ── Boss 4 — The Phantom ─────────────────────────────────
// GHOST mode:  teleports every 2s, fires bullet ring on arrival, semi-transparent
// ANCHOR mode: stationary, fires telegraphed sniper shots
// Phase 2 at 50% HP: faster teleports, double rings, sweeping laser beam in ANCHOR

const B4_HP_MAX        = 55;
const B4_SIZE          = 28;
const B4_MAX_SPEED     = 380;
const B4_MODE_DURATION = 10000;

// GHOST mode
const B4_TELEPORT_INTERVAL    = 2000; // ms between teleports
const B4_TELEPORT_INTERVAL_P2 = 1200; // phase 2
const B4_RING_BULLETS         = 8;
const B4_RING_BULLETS_P2      = 16;
const B4_RING_SPEED           = 220;  // px/s
const B4_BULLET_RADIUS        = 5;

// ANCHOR mode (sniper)
const B4_SNIPER_CYCLE    = 2200; // ms per shot cycle
const B4_SIGHT_DURATION  = 650;  // ms laser sight shown before shot
const B4_SNIPER_SPEED    = 600;  // px/s

// Laser beam (phase 2 ANCHOR)
const B4_BEAM_SWEEP_RATE = (Math.PI / 2) / 1500; // 90° over 1.5s in rad/ms
const B4_BEAM_LENGTH     = 700;

// ── State ─────────────────────────────────────────────────
let boss4              = null;
let boss4Spawned       = false;
let boss4WarningTimer  = 0;
let boss4Mode          = "ghost"; // "ghost" | "anchor"
let boss4ModeTimer     = B4_MODE_DURATION;
let boss4Phase2        = false;
let boss4ModeFlash     = 0;

let boss4TeleportTimer = B4_TELEPORT_INTERVAL;
let boss4Alpha         = 0.35;    // visual transparency (low in GHOST)

let boss4SniperTimer   = B4_SNIPER_CYCLE;
let boss4SniperPhase   = "wait"; // "wait" | "aim"
let boss4AimTargetX    = 0;
let boss4AimTargetY    = 0;

let boss4BeamAngle     = 0;
let boss4BeamActive    = false;

const boss4Bullets     = [];

// ── Spawn / Death ─────────────────────────────────────────
function spawnBoss4() {
    boss4 = {
        x: canvas.width / 2,
        y: -B4_SIZE * 3,
        hp: B4_HP_MAX,
        hitRadius: B4_SIZE,
        maxForce: 900,
    };
    Physics.initBody(boss4, { accel: 0, maxSpeed: B4_MAX_SPEED, drag: 0.992 });

    boss4Spawned        = true;
    boss4WarningTimer   = 2500;
    boss4Mode           = "ghost";
    boss4ModeTimer      = B4_MODE_DURATION;
    boss4Phase2         = false;
    boss4ModeFlash      = 0;
    boss4TeleportTimer  = B4_TELEPORT_INTERVAL;
    boss4Alpha          = 0.35;
    boss4SniperTimer    = B4_SNIPER_CYCLE;
    boss4SniperPhase    = "wait";
    boss4BeamAngle      = 0;
    boss4BeamActive     = false;
    boss4Bullets.length = 0;
}

function onBoss4Death() {
    score += 55;
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        dropXpOrb(
            boss4.x + Math.cos(a) * B4_SIZE * (0.5 + Math.random()),
            boss4.y + Math.sin(a) * B4_SIZE * (0.5 + Math.random())
        );
    }
    triggerExplosion(boss4.x, boss4.y);

    boss4               = null;
    boss4BeamActive     = false;
    boss4Bullets.length = 0;
    advanceBossQueue();
}

// ── Teleport ──────────────────────────────────────────────
function _b4Teleport() {
    let tx, ty, attempts = 0;
    do {
        const margin = B4_SIZE + 60;
        tx = margin + Math.random() * (canvas.width  - margin * 2);
        ty = margin + Math.random() * (canvas.height - margin * 2);
        attempts++;
    } while (attempts < 20 && Math.hypot(tx - player.x, ty - player.y) < 200);

    boss4.x  = tx;
    boss4.y  = ty;
    boss4.vx = 0;
    boss4.vy = 0;
    boss4Alpha = 1.0; // briefly visible on arrival
    _b4FireRing();
}

// ── Fire ring + targeted bullet(s) ────────────────────────
function _b4FireRing() {
    const count  = boss4Phase2 ? B4_RING_BULLETS_P2 : B4_RING_BULLETS;
    const offset = Math.random() * Math.PI;
    for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * Math.PI * 2;
        boss4Bullets.push({
            x:         boss4.x + Math.cos(a) * (B4_SIZE + 6),
            y:         boss4.y + Math.sin(a) * (B4_SIZE + 6),
            vx:        Math.cos(a) * B4_RING_SPEED,
            vy:        Math.sin(a) * B4_RING_SPEED,
            hitRadius: B4_BULLET_RADIUS,
            isSniper:  false,
        });
    }
    // Targeted bullet at current player position
    const dx   = player.x - boss4.x;
    const dy   = player.y - boss4.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    boss4Bullets.push({
        x:         boss4.x + (dx / dist) * (B4_SIZE + 6),
        y:         boss4.y + (dy / dist) * (B4_SIZE + 6),
        vx:        (dx / dist) * B4_RING_SPEED,
        vy:        (dy / dist) * B4_RING_SPEED,
        hitRadius: B4_BULLET_RADIUS,
        isSniper:  false,
    });
    // Phase 2: extra predictive bullet
    if (boss4Phase2) {
        const t    = dist / B4_RING_SPEED;
        const px   = player.x + player.vx * t - boss4.x;
        const py   = player.y + player.vy * t - boss4.y;
        const pd   = Math.sqrt(px * px + py * py) || 1;
        boss4Bullets.push({
            x:         boss4.x + (px / pd) * (B4_SIZE + 6),
            y:         boss4.y + (py / pd) * (B4_SIZE + 6),
            vx:        (px / pd) * B4_RING_SPEED,
            vy:        (py / pd) * B4_RING_SPEED,
            hitRadius: B4_BULLET_RADIUS,
            isSniper:  false,
        });
    }
}

// ── Update ────────────────────────────────────────────────
function updateBoss4(dt) {
    if (!boss4) return;
    if (boss4WarningTimer > 0) { boss4WarningTimer -= dt; return; }

    const sec     = dt / 1000;
    const moveSec = freezeTimer > 0 ? sec * 0.3 : sec;

    // Phase 2 check
    if (!boss4Phase2 && boss4.hp <= B4_HP_MAX / 2) {
        boss4Phase2    = true;
        boss4BeamAngle = Math.atan2(player.y - boss4.y, player.x - boss4.x);
    }

    // Move bullets (unaffected by freeze)
    for (let i = boss4Bullets.length - 1; i >= 0; i--) {
        const b = boss4Bullets[i];
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        if (b.x < -80 || b.x > canvas.width + 80 ||
            b.y < -80 || b.y > canvas.height + 80) {
            boss4Bullets.splice(i, 1);
        }
    }

    // Mode transition
    boss4ModeFlash = Math.max(0, boss4ModeFlash - dt);
    boss4ModeTimer -= dt;
    if (boss4ModeTimer <= 0) {
        boss4Mode      = boss4Mode === "ghost" ? "anchor" : "ghost";
        boss4ModeTimer = B4_MODE_DURATION;
        boss4ModeFlash = 600;
        if (boss4Mode === "ghost") {
            boss4TeleportTimer = boss4Phase2 ? B4_TELEPORT_INTERVAL_P2 : B4_TELEPORT_INTERVAL;
            boss4Alpha = 0.35;
        } else {
            // Entering ANCHOR: stop moving
            boss4.vx = 0;
            boss4.vy = 0;
            boss4SniperTimer = B4_SNIPER_CYCLE;
            boss4SniperPhase = "wait";
            boss4BeamActive  = boss4Phase2;
            if (boss4Phase2) boss4BeamAngle = Math.atan2(player.y - boss4.y, player.x - boss4.x);
        }
    }

    // ── GHOST mode ────────────────────────────────────────
    if (boss4Mode === "ghost") {
        // Slow drift between teleports
        boss4.vx *= Math.pow(0.92, sec * 60);
        boss4.vy *= Math.pow(0.92, sec * 60);
        boss4.x  += boss4.vx * moveSec;
        boss4.y  += boss4.vy * moveSec;
        Physics.clampToBounds(boss4, B4_SIZE, B4_SIZE, canvas.width, canvas.height);

        // Fade to semi-transparent between teleports
        if (boss4Alpha > 0.35) boss4Alpha = Math.max(0.35, boss4Alpha - sec * 2.0);

        const interval = boss4Phase2 ? B4_TELEPORT_INTERVAL_P2 : B4_TELEPORT_INTERVAL;
        boss4TeleportTimer -= dt;
        if (boss4TeleportTimer <= 0) {
            _b4Teleport();
            boss4TeleportTimer = interval;
        }

    // ── ANCHOR mode ───────────────────────────────────────
    } else {
        boss4Alpha = 1.0;
        boss4.vx   = 0;
        boss4.vy   = 0;

        // Sniper cycle: wait → aim (show sight) → fire
        boss4SniperTimer -= dt;
        if (boss4SniperPhase === "wait" && boss4SniperTimer <= B4_SIGHT_DURATION) {
            boss4SniperPhase = "aim";
            boss4AimTargetX  = player.x;
            boss4AimTargetY  = player.y;
        }
        if (boss4SniperPhase === "aim" && boss4SniperTimer <= 0) {
            const dx   = boss4AimTargetX - boss4.x;
            const dy   = boss4AimTargetY - boss4.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            boss4Bullets.push({
                x:         boss4.x + (dx / dist) * (B4_SIZE + 6),
                y:         boss4.y + (dy / dist) * (B4_SIZE + 6),
                vx:        (dx / dist) * B4_SNIPER_SPEED,
                vy:        (dy / dist) * B4_SNIPER_SPEED,
                hitRadius: B4_BULLET_RADIUS,
                isSniper:  true,
            });
            boss4SniperPhase = "wait";
            boss4SniperTimer = B4_SNIPER_CYCLE;
        }

        // Sweeping laser beam (phase 2 only)
        if (boss4Phase2 && boss4BeamActive) {
            boss4BeamAngle += B4_BEAM_SWEEP_RATE * dt;
        }
    }
}

// ── Draw ──────────────────────────────────────────────────
function drawBoss4() {
    if (boss4WarningTimer > 0) {
        const blink = (boss4WarningTimer % 500) < 250;
        if (blink) {
            ctx.fillStyle    = "rgba(40, 0, 100, 0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 68px monospace";
            ctx.fillStyle    = "rgba(160, 80, 255, 0.95)";
            ctx.fillText("! THE PHANTOM INCOMING !", canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    if (!boss4) return;

    // Mode flash
    if (boss4ModeFlash > 0) {
        const a = (boss4ModeFlash / 600) * 0.25;
        ctx.fillStyle = boss4Mode === "ghost"
            ? `rgba(80, 0, 180, ${a})`
            : `rgba(200, 200, 255, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Bullets
    for (const b of boss4Bullets) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isSniper ? B4_BULLET_RADIUS * 1.8 : B4_BULLET_RADIUS * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = b.isSniper ? "rgba(255, 255, 200, 0.18)" : "rgba(160, 80, 255, 0.15)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, B4_BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = b.isSniper ? "rgba(255, 255, 180, 0.97)" : "rgba(180, 100, 255, 0.95)";
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = boss4Alpha;
    ctx.translate(boss4.x, boss4.y);

    // Laser sight (aim phase)
    if (boss4Mode === "anchor" && boss4SniperPhase === "aim") {
        const dx     = boss4AimTargetX - boss4.x;
        const dy     = boss4AimTargetY - boss4.y;
        const dist   = Math.sqrt(dx * dx + dy * dy) || 1;
        const sightFrac = 1 - (boss4SniperTimer / B4_SIGHT_DURATION);
        ctx.beginPath();
        ctx.moveTo((dx / dist) * (B4_SIZE + 4), (dy / dist) * (B4_SIZE + 4));
        ctx.lineTo((dx / dist) * 750, (dy / dist) * 750);
        ctx.strokeStyle = `rgba(255, 60, 60, ${0.25 + sightFrac * 0.7})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
    }

    // Sweeping laser beam (phase 2 ANCHOR)
    if (boss4Phase2 && boss4Mode === "anchor" && boss4BeamActive) {
        const bx2  = Math.cos(boss4BeamAngle) * B4_BEAM_LENGTH;
        const by2  = Math.sin(boss4BeamAngle) * B4_BEAM_LENGTH;
        const grad = ctx.createLinearGradient(0, 0, bx2, by2);
        grad.addColorStop(0,   "rgba(255, 220, 80, 0.9)");
        grad.addColorStop(0.3, "rgba(255, 160, 40, 0.7)");
        grad.addColorStop(1,   "rgba(255, 60, 0, 0)");
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(bx2, by2);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(bx2, by2);
        ctx.strokeStyle = "rgba(255, 255, 100, 0.22)";
        ctx.lineWidth   = 18;
        ctx.stroke();
    }

    ctx.shadowColor = boss4Mode === "ghost"
        ? "rgba(140, 60, 255, 0.9)"
        : "rgba(220, 220, 255, 0.9)";
    ctx.shadowBlur = boss4Mode === "anchor" ? 38 : 22;

    // Diamond body
    const s = B4_SIZE;
    ctx.beginPath();
    ctx.moveTo( s * 1.4,  0);
    ctx.lineTo( 0,       -s * 0.9);
    ctx.lineTo(-s * 0.8,  0);
    ctx.lineTo( 0,        s * 0.9);
    ctx.closePath();

    ctx.fillStyle = boss4Mode === "ghost"
        ? "rgba(80, 20, 180, 0.88)"
        : "rgba(200, 190, 255, 0.95)";
    ctx.fill();
    ctx.strokeStyle = boss4Mode === "ghost"
        ? "rgba(160, 80, 255, 0.9)"
        : "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner gem
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = boss4Mode === "ghost"
        ? "rgba(200, 140, 255, 0.8)"
        : "rgba(255, 255, 200, 0.9)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawBoss4HpBar();
}

function drawBoss4HpBar() {
    const barW  = 380;
    const barH  = 18;
    const bx    = canvas.width / 2 - barW / 2;
    const by    = 16;
    const frac  = boss4.hp / B4_HP_MAX;
    const fillW = frac * barW;

    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.font         = "bold 13px monospace";
    ctx.fillStyle    = "rgba(180, 100, 255, 0.9)";
    ctx.fillText("THE PHANTOM", canvas.width / 2, by - 3);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx, by, barW, barH);

    ctx.fillStyle = `rgb(${Math.round(100 + 155 * (1 - frac))}, 0, ${Math.round(200 * frac + 55)})`;
    ctx.fillRect(bx, by, fillW, barH);

    ctx.strokeStyle = "rgba(160, 80, 255, 0.7)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
}
