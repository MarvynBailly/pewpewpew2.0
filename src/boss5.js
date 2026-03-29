// ── Boss 5 — The Sniper ───────────────────────────────────
// RETREAT mode: flees from player, fires telegraphed sniper shots
// SUPPRESS mode: holds ground, shotgun burst if close else snipes
// Phase 2 at 50% HP: dual sniper shots + lingering slow bullet wall from shotgun

const B5_HP_MAX        = 50;
const B5_SIZE          = 22;
const B5_MAX_SPEED     = 420;
const B5_MODE_DURATION = 9000;

// Sniper
const B5_SNIPER_CYCLE    = 2500; // ms per shot cycle
const B5_SIGHT_DURATION  = 600;  // ms laser sight shown
const B5_SNIPER_SPEED    = 580;  // px/s
const B5_SNIPER_RADIUS   = 4;

// Suppress
const B5_SUPPRESS_SNIPE_INTERVAL = 2000; // ms between instant sniper shots
const B5_SHOTGUN_COOLDOWN        = 1800;
const B5_SHOTGUN_RANGE           = 220;  // px — trigger distance
const B5_SHOTGUN_BULLETS         = 6;
const B5_SHOTGUN_SPREAD          = 40 * Math.PI / 180; // full spread angle
const B5_SHOTGUN_SPEED           = 300;
const B5_SHOTGUN_RADIUS          = 5;

// Phase 2 linger bullets
const B5_LINGER_SPEED = 80;  // px/s
const B5_LINGER_LIFE  = 3000; // ms

// ── State ─────────────────────────────────────────────────
let boss5             = null;
let boss5Spawned      = false;
let boss5WarningTimer = 0;
let boss5Mode         = "retreat"; // "retreat" | "suppress"
let boss5ModeTimer    = B5_MODE_DURATION;
let boss5Phase2       = false;
let boss5ModeFlash    = 0;

let boss5SniperTimer  = B5_SNIPER_CYCLE;
let boss5SniperPhase  = "wait"; // "wait" | "aim"
let boss5AimTargetX   = 0;
let boss5AimTargetY   = 0;

let boss5ShotgunTimer = B5_SHOTGUN_COOLDOWN;
let boss5SuppressSnipeTimer = B5_SUPPRESS_SNIPE_INTERVAL;

const boss5Bullets    = [];

// ── Spawn / Death ─────────────────────────────────────────
function spawnBoss5() {
    boss5 = {
        x: canvas.width * 0.8,
        y: canvas.height * 0.2,
        hp: B5_HP_MAX,
        hitRadius: B5_SIZE,
        maxForce: 1100,
    };
    Physics.initBody(boss5, { accel: 0, maxSpeed: B5_MAX_SPEED, drag: 0.990 });

    boss5Spawned        = true;
    boss5WarningTimer   = 2500;
    boss5Mode           = "retreat";
    boss5ModeTimer      = B5_MODE_DURATION;
    boss5Phase2         = false;
    boss5ModeFlash      = 0;
    boss5SniperTimer    = B5_SNIPER_CYCLE;
    boss5SniperPhase    = "wait";
    boss5ShotgunTimer   = B5_SHOTGUN_COOLDOWN;
    boss5SuppressSnipeTimer = B5_SUPPRESS_SNIPE_INTERVAL;
    boss5Bullets.length = 0;
}

function onBoss5Death() {
    score += 55;
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        dropXpOrb(
            boss5.x + Math.cos(a) * B5_SIZE * (0.5 + Math.random()),
            boss5.y + Math.sin(a) * B5_SIZE * (0.5 + Math.random())
        );
    }
    triggerExplosion(boss5.x, boss5.y);

    boss5               = null;
    boss5Bullets.length = 0;
    advanceBossQueue();
}

// ── Helpers ───────────────────────────────────────────────
function _b5FireSniper(tx, ty) {
    const dx   = tx - boss5.x;
    const dy   = ty - boss5.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    boss5Bullets.push({
        x:         boss5.x + (dx / dist) * (B5_SIZE + 6),
        y:         boss5.y + (dy / dist) * (B5_SIZE + 6),
        vx:        (dx / dist) * B5_SNIPER_SPEED,
        vy:        (dy / dist) * B5_SNIPER_SPEED,
        hitRadius: B5_SNIPER_RADIUS,
        isSniper:  true,
        life:      -1, // never expires on its own
    });
}

function _b5FireShotgun() {
    const base     = Math.atan2(player.y - boss5.y, player.x - boss5.x);
    const stepAngle = B5_SHOTGUN_SPREAD / (B5_SHOTGUN_BULLETS - 1);
    for (let i = 0; i < B5_SHOTGUN_BULLETS; i++) {
        const a = base - B5_SHOTGUN_SPREAD / 2 + stepAngle * i;
        boss5Bullets.push({
            x:         boss5.x + Math.cos(a) * (B5_SIZE + 6),
            y:         boss5.y + Math.sin(a) * (B5_SIZE + 6),
            vx:        Math.cos(a) * B5_SHOTGUN_SPEED,
            vy:        Math.sin(a) * B5_SHOTGUN_SPEED,
            hitRadius: B5_SHOTGUN_RADIUS,
            isSniper:  false,
            life:      -1,
        });
    }
    // Phase 2: add slow lingering bullets at the origin
    if (boss5Phase2) {
        const lCount = 4;
        for (let i = 0; i < lCount; i++) {
            const a = base - Math.PI / 4 + (i / (lCount - 1)) * (Math.PI / 2);
            boss5Bullets.push({
                x:        boss5.x,
                y:        boss5.y,
                vx:       Math.cos(a) * B5_LINGER_SPEED,
                vy:       Math.sin(a) * B5_LINGER_SPEED,
                hitRadius: B5_SHOTGUN_RADIUS,
                isSniper:  false,
                life:      B5_LINGER_LIFE,
                isLinger:  true,
            });
        }
    }
}

// Flee steering: thrust directly away from player
function _b5Flee(dt) {
    const dx   = boss5.x - player.x;
    const dy   = boss5.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const desiredX = (dx / dist) * boss5.maxSpeed;
    const desiredY = (dy / dist) * boss5.maxSpeed;
    let steerX = desiredX - boss5.vx;
    let steerY = desiredY - boss5.vy;
    const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
    if (steerMag > boss5.maxForce) {
        steerX = (steerX / steerMag) * boss5.maxForce;
        steerY = (steerY / steerMag) * boss5.maxForce;
    }
    Physics.applyThrust(boss5, steerX, steerY, dt);
}

// ── Update ────────────────────────────────────────────────
function updateBoss5(dt) {
    if (!boss5) return;
    if (boss5WarningTimer > 0) { boss5WarningTimer -= dt; return; }

    const sec     = dt / 1000;
    const moveSec = freezeTimer > 0 ? sec * 0.3 : sec;
    const moveDt  = moveSec * 1000;

    if (!boss5Phase2 && boss5.hp <= B5_HP_MAX / 2) boss5Phase2 = true;

    // Move + age bullets (unaffected by freeze)
    for (let i = boss5Bullets.length - 1; i >= 0; i--) {
        const b = boss5Bullets[i];
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        if (b.life > 0) {
            b.life -= dt;
            if (b.life <= 0) { boss5Bullets.splice(i, 1); continue; }
        }
        if (b.x < -100 || b.x > canvas.width + 100 ||
            b.y < -100 || b.y > canvas.height + 100) {
            boss5Bullets.splice(i, 1);
        }
    }

    // Mode transition
    boss5ModeFlash = Math.max(0, boss5ModeFlash - dt);
    boss5ModeTimer -= dt;
    if (boss5ModeTimer <= 0) {
        boss5Mode      = boss5Mode === "retreat" ? "suppress" : "retreat";
        boss5ModeTimer = B5_MODE_DURATION;
        boss5ModeFlash = 600;
        boss5SniperTimer    = B5_SNIPER_CYCLE;
        boss5SniperPhase    = "wait";
        boss5ShotgunTimer   = B5_SHOTGUN_COOLDOWN;
        boss5SuppressSnipeTimer = B5_SUPPRESS_SNIPE_INTERVAL;
    }

    // ── RETREAT mode ──────────────────────────────────────
    if (boss5Mode === "retreat") {
        _b5Flee(moveDt);
        Physics.update(boss5, moveDt);
        Physics.clampToBounds(boss5, B5_SIZE, B5_SIZE, canvas.width, canvas.height);

        // Telegraphed sniper cycle
        boss5SniperTimer -= dt;
        if (boss5SniperPhase === "wait" && boss5SniperTimer <= B5_SIGHT_DURATION) {
            boss5SniperPhase = "aim";
            boss5AimTargetX  = player.x;
            boss5AimTargetY  = player.y;
        }
        if (boss5SniperPhase === "aim" && boss5SniperTimer <= 0) {
            _b5FireSniper(boss5AimTargetX, boss5AimTargetY);
            if (boss5Phase2) {
                // Second predictive shot
                const dist = Math.hypot(boss5AimTargetX - boss5.x, boss5AimTargetY - boss5.y);
                const t    = dist / B5_SNIPER_SPEED;
                _b5FireSniper(player.x + player.vx * t, player.y + player.vy * t);
            }
            boss5SniperPhase = "wait";
            boss5SniperTimer = B5_SNIPER_CYCLE;
        }

    // ── SUPPRESS mode ─────────────────────────────────────
    } else {
        // Heavy braking — holds position
        boss5.vx *= Math.pow(0.88, sec * 60);
        boss5.vy *= Math.pow(0.88, sec * 60);
        boss5.x  += boss5.vx * moveSec;
        boss5.y  += boss5.vy * moveSec;
        Physics.clampToBounds(boss5, B5_SIZE, B5_SIZE, canvas.width, canvas.height);

        const distToPlayer = Math.hypot(player.x - boss5.x, player.y - boss5.y);
        if (distToPlayer < B5_SHOTGUN_RANGE) {
            boss5ShotgunTimer -= dt;
            if (boss5ShotgunTimer <= 0) {
                _b5FireShotgun();
                boss5ShotgunTimer = B5_SHOTGUN_COOLDOWN;
            }
        } else {
            boss5SuppressSnipeTimer -= dt;
            if (boss5SuppressSnipeTimer <= 0) {
                _b5FireSniper(player.x, player.y); // instant, no telegraph
                boss5SuppressSnipeTimer = B5_SUPPRESS_SNIPE_INTERVAL;
            }
        }
    }
}

// ── Draw ──────────────────────────────────────────────────
function drawBoss5() {
    if (boss5WarningTimer > 0) {
        const blink = (boss5WarningTimer % 500) < 250;
        if (blink) {
            ctx.fillStyle    = "rgba(0, 60, 20, 0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 68px monospace";
            ctx.fillStyle    = "rgba(80, 255, 100, 0.95)";
            ctx.fillText("! THE SNIPER INCOMING !", canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    if (!boss5) return;

    if (boss5ModeFlash > 0) {
        const a = (boss5ModeFlash / 600) * 0.25;
        ctx.fillStyle = boss5Mode === "retreat"
            ? `rgba(0, 80, 30, ${a})`
            : `rgba(60, 200, 80, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Bullets
    for (const b of boss5Bullets) {
        ctx.save();
        const alpha = (b.isLinger && b.life > 0) ? Math.min(1, b.life / 1000) : 1;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isSniper ? B5_SNIPER_RADIUS * 2 : B5_SHOTGUN_RADIUS * 2, 0, Math.PI * 2);
        ctx.fillStyle = b.isSniper ? "rgba(255, 255, 100, 0.2)" : "rgba(60, 255, 80, 0.15)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isSniper ? B5_SNIPER_RADIUS : B5_SHOTGUN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = b.isSniper ? "rgba(255, 255, 60, 0.97)" : "rgba(80, 220, 100, 0.95)";
        ctx.fill();
        ctx.restore();
    }

    // Laser sight line (aim phase in RETREAT)
    if (boss5Mode === "retreat" && boss5SniperPhase === "aim") {
        const dx   = boss5AimTargetX - boss5.x;
        const dy   = boss5AimTargetY - boss5.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const frac = 1 - (boss5SniperTimer / B5_SIGHT_DURATION);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(boss5.x + (dx / dist) * (B5_SIZE + 4), boss5.y + (dy / dist) * (B5_SIZE + 4));
        ctx.lineTo(boss5.x + (dx / dist) * 800, boss5.y + (dy / dist) * 800);
        ctx.strokeStyle = `rgba(255, 80, 40, ${0.25 + frac * 0.7})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    // Boss body
    const angle = boss5Mode === "suppress"
        ? Math.atan2(player.y - boss5.y, player.x - boss5.x)
        : Math.atan2(boss5.vy || -1, boss5.vx || 1);

    ctx.save();
    ctx.translate(boss5.x, boss5.y);
    ctx.rotate(angle);

    ctx.shadowColor = boss5Mode === "retreat"
        ? "rgba(50, 200, 80, 0.9)"
        : "rgba(200, 255, 80, 0.9)";
    ctx.shadowBlur = 24;

    // Long narrow arrowhead
    const s = B5_SIZE;
    ctx.beginPath();
    ctx.moveTo( s * 1.8,  0);
    ctx.lineTo( s * 0.3, -s * 0.45);
    ctx.lineTo(-s * 0.8, -s * 0.55);
    ctx.lineTo(-s * 0.6,  0);
    ctx.lineTo(-s * 0.8,  s * 0.55);
    ctx.lineTo( s * 0.3,  s * 0.45);
    ctx.closePath();

    ctx.fillStyle = boss5Mode === "retreat"
        ? "rgba(20, 120, 50, 0.92)"
        : "rgba(100, 200, 60, 0.92)";
    ctx.fill();
    ctx.strokeStyle = boss5Mode === "retreat"
        ? "rgba(60, 220, 90, 0.9)"
        : "rgba(200, 255, 80, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Scope glint
    ctx.beginPath();
    ctx.arc(s * 0.6, 0, s * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 120, 0.8)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawBoss5HpBar();
}

function drawBoss5HpBar() {
    const barW  = 420;
    const barH  = 20;
    const bx    = canvas.width / 2 - barW / 2;
    const by    = canvas.height - 46;
    const frac  = boss5.hp / B5_HP_MAX;
    const fillW = frac * barW;

    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.font         = "bold 13px monospace";
    ctx.fillStyle    = "rgba(80, 220, 100, 0.9)";
    ctx.fillText("THE SNIPER", canvas.width / 2, by - 3);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx, by, barW, barH);

    ctx.fillStyle = `rgb(0, ${Math.round(255 * frac)}, 50)`;
    ctx.fillRect(bx, by, fillW, barH);

    ctx.strokeStyle = "rgba(60, 200, 80, 0.7)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
}
