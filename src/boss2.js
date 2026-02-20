// ── Boss II ───────────────────────────────────────────────
// Spawns at 2 minutes. Fast, agile, two-phase fighter.
//
// DEFEND phase: orbits player at range, side-dashes to dodge bullets,
//               fires lazy homing missiles.
// ATTACK phase: chases player, forward-dashes to ram, fires spread shot.
//
// Phases alternate every PHASE_DURATION ms for the whole fight.

const BOSS2_HP_MAX         = 60;
const BOSS2_SIZE           = 26;  // hitRadius — smaller/agiler than boss 1
const BOSS2_MAX_SPEED      = 340;
const BOSS2_ORBIT_RADIUS   = 285; // distance kept in defend phase
const BOSS2_PHASE_DURATION = 11000; // ms per phase

// Bullet-dodge (defend)
const DODGE_THREAT_RADIUS  = 230; // how far to look for incoming bullets
const DODGE_SPEED          = 660; // px/s during the dodge dash
const DODGE_DURATION_MS    = 210; // ms the dash lasts
const DODGE_COOLDOWN_MS    = 1400; // ms before boss can dodge again

// Homing missiles (defend)
const B2M_SPEED      = 190;
const B2M_TURN_RATE  = 1.8;  // rad/s — intentionally lazy so they're dodgeable
const B2M_FIRE_RATE  = 3000; // ms between missiles
const B2M_RADIUS     = 5;

// Spread bullets (attack)
const B2B_SPEED     = 320;
const B2B_FIRE_RATE = 1800;
const B2B_RADIUS    = 5;
const B2B_SPREAD    = 18 * Math.PI / 180; // ±18°

// Forward dash (attack)
const B2_DASH_SPEED    = 740;
const B2_DASH_DURATION = 430;  // ms
const B2_DASH_COOLDOWN = 4200; // ms between dashes

// ── State ─────────────────────────────────────────────────
let boss2              = null;
let boss2Spawned       = false;
let boss2WarningTimer  = 0;
let boss2Phase         = "defend";  // "defend" | "attack"
let boss2PhaseTimer    = BOSS2_PHASE_DURATION;
let boss2PhaseFlash    = 0;         // screen-flash ms on phase switch
let boss2OrbitAngle    = 0;         // current orbit angle around player
let boss2FireTimer     = B2M_FIRE_RATE;
let boss2DodgeCooldown  = 0;
let boss2DodgeActive    = false;
let boss2DodgeTimeLeft  = 0;
let boss2DodgeDirX      = 0;
let boss2DodgeDirY      = 0;
let boss2DashTimer      = B2_DASH_COOLDOWN;
let boss2DashActive     = false;
let boss2DashTimeLeft   = 0;
let boss2DashVx         = 0;
let boss2DashVy         = 0;

const boss2Missiles   = [];
const boss2Bullets    = [];
const boss2DodgeTrail = [];

// ── Spawn / death ─────────────────────────────────────────
function spawnBoss2() {
    boss2 = {
        x: canvas.width / 2,
        y: -BOSS2_SIZE * 3,
        hp: BOSS2_HP_MAX,
        hitRadius: BOSS2_SIZE,
        maxForce: 950,
    };
    Physics.initBody(boss2, { accel: 0, maxSpeed: BOSS2_MAX_SPEED, drag: 0.992 });

    boss2Spawned        = true;
    boss2WarningTimer   = 2500;
    boss2Phase          = "defend";
    boss2PhaseTimer     = BOSS2_PHASE_DURATION;
    boss2PhaseFlash     = 0;
    boss2OrbitAngle     = Math.atan2(boss2.y - player.y, boss2.x - player.x);
    boss2FireTimer      = B2M_FIRE_RATE;
    boss2DodgeCooldown   = 0;
    boss2DodgeActive     = false;
    boss2DodgeTimeLeft   = 0;
    boss2DodgeDirX       = 0;
    boss2DodgeDirY       = 0;
    boss2DashTimer       = B2_DASH_COOLDOWN;
    boss2DashActive      = false;
    boss2Missiles.length  = 0;
    boss2Bullets.length   = 0;
    boss2DodgeTrail.length = 0;
}

function onBoss2Death() {
    score += 40;
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        dropXpOrb(
            boss2.x + Math.cos(a) * BOSS2_SIZE * (0.5 + Math.random()),
            boss2.y + Math.sin(a) * BOSS2_SIZE * (0.5 + Math.random())
        );
    }
    triggerExplosion(boss2.x, boss2.y);

    boss2                = null;
    boss2Missiles.length = 0;
    boss2Bullets.length  = 0;
    difficultyOffset     = gameTime;
    spawnTimer           = 2000;

    if (dualBossMode) {
        // In the dual phase: restart countdown only when both bosses are dead
        if (boss === null) {
            postBossMode     = true;          // NOW go crazy
            difficultyOffset = gameTime - 20000; // ~408ms spawn interval with 3× multiplier
            dualBossCountdown = 60000;
        }
    } else {
        // Solo Boss II down — moderate difficulty jump, dual phase coming soon
        difficultyOffset = gameTime - 15000; // ~1600ms spawn interval, manageable
        dualBossCountdown = 60000;
    }
}

// ── Bullet-threat detection ───────────────────────────────
function _b2FindThreat() {
    for (const b of bullets) {
        const dx   = boss2.x - b.x;
        const dy   = boss2.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > DODGE_THREAT_RADIUS) continue;
        const bspd = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
        // Dot > 0.6 means the bullet is travelling roughly toward boss2
        const dot = (b.vx * dx + b.vy * dy) / (bspd * dist);
        if (dot > 0.6) return b;
    }
    return null;
}

function _b2Dodge(bullet) {
    const bspd = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) || 1;
    const sign = Math.random() > 0.5 ? 1 : -1;

    // Direction perpendicular to the incoming bullet
    boss2DodgeDirX = (-bullet.vy / bspd) * sign;
    boss2DodgeDirY = ( bullet.vx / bspd) * sign;

    boss2DodgeActive   = true;
    boss2DodgeTimeLeft = DODGE_DURATION_MS;
    boss2DodgeCooldown = DODGE_COOLDOWN_MS;
    boss2DodgeTrail.length = 0;
}

// ── Weapons ───────────────────────────────────────────────
function _b2FireMissile() {
    const dx   = player.x - boss2.x;
    const dy   = player.y - boss2.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    boss2Missiles.push({
        x:         boss2.x + (dx / dist) * (BOSS2_SIZE + 8),
        y:         boss2.y + (dy / dist) * (BOSS2_SIZE + 8),
        vx:        (dx / dist) * B2M_SPEED,
        vy:        (dy / dist) * B2M_SPEED,
        hitRadius: B2M_RADIUS,
        tracking:  true,
    });
}

function _b2FireSpread() {
    const base = Math.atan2(player.y - boss2.y, player.x - boss2.x);
    for (const delta of [-B2B_SPREAD, 0, B2B_SPREAD]) {
        const a = base + delta;
        boss2Bullets.push({
            x:         boss2.x + Math.cos(a) * (BOSS2_SIZE + 8),
            y:         boss2.y + Math.sin(a) * (BOSS2_SIZE + 8),
            vx:        Math.cos(a) * B2B_SPEED,
            vy:        Math.sin(a) * B2B_SPEED,
            hitRadius: B2B_RADIUS,
        });
    }
}

// ── Update ────────────────────────────────────────────────
function updateBoss2(dt) {
    if (!boss2) return;
    if (boss2WarningTimer > 0) { boss2WarningTimer -= dt; return; }

    const sec = dt / 1000;
    // Freeze power-up slows boss movement to 30% (timers still tick normally)
    const moveSec = freezeTimer > 0 ? sec * 0.3 : sec;
    const moveDt  = moveSec * 1000;

    // ── Homing missiles ───────────────────────────────────
    for (let i = boss2Missiles.length - 1; i >= 0; i--) {
        const m = boss2Missiles[i];
        if (m.tracking) {
            const dx          = player.x - m.x;
            const dy          = player.y - m.y;
            const targetAngle = Math.atan2(dy, dx);
            let   curAngle    = Math.atan2(m.vy, m.vx);
            let   diff        = targetAngle - curAngle;
            // Normalise angle difference to [-π, π]
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            curAngle += Math.max(-B2M_TURN_RATE * sec, Math.min(B2M_TURN_RATE * sec, diff));
            const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || B2M_SPEED;
            m.vx = Math.cos(curAngle) * spd;
            m.vy = Math.sin(curAngle) * spd;
        }
        m.x += m.vx * sec;
        m.y += m.vy * sec;
        if (m.x < -80 || m.x > canvas.width + 80 ||
            m.y < -80 || m.y > canvas.height + 80) {
            boss2Missiles.splice(i, 1);
        }
    }

    // ── Spread bullets ────────────────────────────────────
    for (let i = boss2Bullets.length - 1; i >= 0; i--) {
        const b = boss2Bullets[i];
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        if (b.x < -60 || b.x > canvas.width + 60 ||
            b.y < -60 || b.y > canvas.height + 60) {
            boss2Bullets.splice(i, 1);
        }
    }

    // ── Phase transition ──────────────────────────────────
    boss2PhaseFlash  = Math.max(0, boss2PhaseFlash - dt);
    boss2PhaseTimer -= dt;
    if (boss2PhaseTimer <= 0) {
        const wasDefend  = boss2Phase === "defend";
        boss2Phase       = wasDefend ? "attack" : "defend";
        boss2PhaseTimer  = BOSS2_PHASE_DURATION;
        boss2PhaseFlash  = 700;
        boss2FireTimer   = wasDefend ? B2B_FIRE_RATE : B2M_FIRE_RATE;

        if (wasDefend) {
            // Missiles lose tracking — fly straight and leave screen
            for (const m of boss2Missiles) m.tracking = false;
        } else {
            // Re-entering defend — anchor orbit to current position
            boss2OrbitAngle = Math.atan2(boss2.y - player.y, boss2.x - player.x);
        }
    }

    // ── DEFEND phase ──────────────────────────────────────
    if (boss2Phase === "defend") {
        boss2DodgeCooldown = Math.max(0, boss2DodgeCooldown - dt);

        if (boss2DodgeActive) {
            // Smooth dash — same approach as Boss I charge
            boss2DodgeTrail.push({ x: boss2.x, y: boss2.y, age: 0 });
            boss2.x += boss2DodgeDirX * DODGE_SPEED * moveSec;
            boss2.y += boss2DodgeDirY * DODGE_SPEED * moveSec;
            boss2.x = Math.max(BOSS2_SIZE, Math.min(canvas.width  - BOSS2_SIZE, boss2.x));
            boss2.y = Math.max(BOSS2_SIZE, Math.min(canvas.height - BOSS2_SIZE, boss2.y));
            boss2.vx = boss2DodgeDirX * DODGE_SPEED;
            boss2.vy = boss2DodgeDirY * DODGE_SPEED;

            // Age trail
            for (let i = boss2DodgeTrail.length - 1; i >= 0; i--) {
                boss2DodgeTrail[i].age += dt;
                if (boss2DodgeTrail[i].age > 200) boss2DodgeTrail.splice(i, 1);
            }

            boss2DodgeTimeLeft -= dt;
            if (boss2DodgeTimeLeft <= 0) {
                boss2DodgeActive = false;
                boss2.vx = boss2DodgeDirX * 55;
                boss2.vy = boss2DodgeDirY * 55;
                boss2DodgeTrail.length = 0;
            }
        } else {
            boss2OrbitAngle += 0.42 * moveSec;
            const orbitTargetX = player.x + Math.cos(boss2OrbitAngle) * BOSS2_ORBIT_RADIUS;
            const orbitTargetY = player.y + Math.sin(boss2OrbitAngle) * BOSS2_ORBIT_RADIUS;
            steerArrive(boss2, { x: orbitTargetX, y: orbitTargetY }, moveDt);

            if (boss2DodgeCooldown <= 0) {
                const threat = _b2FindThreat();
                if (threat) _b2Dodge(threat);
            }

            Physics.update(boss2, moveDt);
            Physics.clampToBounds(boss2, BOSS2_SIZE, BOSS2_SIZE, canvas.width, canvas.height);
        }

        boss2FireTimer -= dt;
        if (boss2FireTimer <= 0) {
            _b2FireMissile();
            boss2FireTimer = B2M_FIRE_RATE;
        }

    // ── ATTACK phase ──────────────────────────────────────
    } else {
        if (boss2DashActive) {
            // Fly straight at locked velocity
            boss2.vx = boss2DashVx;
            boss2.vy = boss2DashVy;
            boss2.x += boss2.vx * moveSec;
            boss2.y += boss2.vy * moveSec;
            boss2.x = Math.max(BOSS2_SIZE, Math.min(canvas.width  - BOSS2_SIZE, boss2.x));
            boss2.y = Math.max(BOSS2_SIZE, Math.min(canvas.height - BOSS2_SIZE, boss2.y));

            boss2DashTimeLeft -= dt;
            if (boss2DashTimeLeft <= 0) {
                boss2DashActive = false;
                boss2.vx = boss2DashVx * 0.1;
                boss2.vy = boss2DashVy * 0.1;
                boss2DashTimer = B2_DASH_COOLDOWN;
            }
        } else {
            steerArrive(boss2, player, moveDt);
            Physics.update(boss2, moveDt);
            Physics.clampToBounds(boss2, BOSS2_SIZE, BOSS2_SIZE, canvas.width, canvas.height);

            boss2DashTimer -= dt;
            if (boss2DashTimer <= 0) {
                const dx   = player.x - boss2.x;
                const dy   = player.y - boss2.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                boss2DashVx   = (dx / dist) * B2_DASH_SPEED;
                boss2DashVy   = (dy / dist) * B2_DASH_SPEED;
                boss2DashActive   = true;
                boss2DashTimeLeft = B2_DASH_DURATION;
            }
        }

        boss2FireTimer -= dt;
        if (boss2FireTimer <= 0) {
            _b2FireSpread();
            boss2FireTimer = B2B_FIRE_RATE;
        }
    }
}

// ── Draw ──────────────────────────────────────────────────
function drawBoss2() {
    // Warning overlay
    if (boss2WarningTimer > 0) {
        const blink = (boss2WarningTimer % 500) < 250;
        if (blink) {
            ctx.fillStyle    = "rgba(0, 60, 180, 0.2)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 68px monospace";
            ctx.fillStyle    = "rgba(80, 210, 255, 0.95)";
            ctx.fillText("! BOSS II INCOMING !", canvas.width / 2, canvas.height / 2);
        }
    }

    if (!boss2) return;

    const isDefend = boss2Phase === "defend";

    // Phase-switch flash
    if (boss2PhaseFlash > 0) {
        const a = (boss2PhaseFlash / 700) * 0.35;
        ctx.fillStyle = isDefend ? `rgba(0, 140, 255, ${a})` : `rgba(255, 40, 0, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Dodge trail (cyan, like Boss I's orange dash trail)
    for (const t of boss2DodgeTrail) {
        const frac  = 1 - t.age / 200;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BOSS2_SIZE * frac * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 200, 255, ${frac * 0.38})`;
        ctx.fill();
    }

    // Homing missiles (draw before boss so they appear behind)
    for (const m of boss2Missiles) {
        const ma = Math.atan2(m.vy, m.vx);
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(ma);
        // Body
        ctx.beginPath();
        ctx.moveTo( 11,  0);
        ctx.lineTo(-5, -4);
        ctx.lineTo(-5,  4);
        ctx.closePath();
        ctx.fillStyle = m.tracking ? "rgba(60, 200, 255, 0.92)" : "rgba(110, 110, 130, 0.75)";
        ctx.fill();
        // Exhaust glow
        ctx.beginPath();
        ctx.arc(-5, 0, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = m.tracking ? "rgba(0, 100, 255, 0.65)" : "rgba(80, 80, 90, 0.5)";
        ctx.fill();
        ctx.restore();
    }

    // Spread bullets
    for (const b of boss2Bullets) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, B2B_RADIUS * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 55, 0, 0.14)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, B2B_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 140, 60, 0.95)";
        ctx.fill();
        ctx.restore();
    }

    // ── Boss body ─────────────────────────────────────────
    const facingAngle = boss2DashActive  ? Math.atan2(boss2DashVy,   boss2DashVx)
                      : boss2DodgeActive ? Math.atan2(boss2DodgeDirY, boss2DodgeDirX)
                      :                   Math.atan2(boss2.vy || -1, boss2.vx);

    ctx.save();
    ctx.translate(boss2.x, boss2.y);
    ctx.rotate(facingAngle);

    // Defend phase: pulsing shield ring
    if (isDefend) {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime / 380);
        ctx.beginPath();
        ctx.arc(0, 0, BOSS2_SIZE * 1.85 + pulse * 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 180, 255, ${0.14 + pulse * 0.2})`;
        ctx.lineWidth   = 2.5;
        ctx.stroke();
    }

    // Glow — cyan defend, red attack
    ctx.shadowColor = isDefend ? "rgba(0, 180, 255, 0.9)" : "rgba(255, 50, 0, 0.9)";
    ctx.shadowBlur  = (boss2DashActive || boss2DodgeActive) ? 44 : 22;

    // Body — sleek swept-wing fighter shape
    const s = BOSS2_SIZE;
    ctx.beginPath();
    ctx.moveTo( s * 1.65,  0);          // nose
    ctx.lineTo( s * 0.15, -s * 0.65);   // top inner
    ctx.lineTo(-s * 0.55, -s * 0.95);   // top wing tip
    ctx.lineTo(-s * 0.85, -s * 0.28);   // top tail edge
    ctx.lineTo(-s * 0.65,  0);          // tail notch
    ctx.lineTo(-s * 0.85,  s * 0.28);   // bottom tail edge
    ctx.lineTo(-s * 0.55,  s * 0.95);   // bottom wing tip
    ctx.lineTo( s * 0.15,  s * 0.65);   // bottom inner
    ctx.closePath();

    ctx.fillStyle = isDefend
        ? ((boss2DashActive || boss2DodgeActive) ? "rgba(180, 245, 255, 0.97)" : "rgba(0,  200, 255, 0.92)")
        : (boss2DashActive                       ? "rgba(255, 200, 80,  0.97)" : "rgba(255, 50,  50,  0.92)");
    ctx.fill();

    ctx.strokeStyle = isDefend ? "rgba(100, 230, 255, 0.95)" : "rgba(255, 130, 80, 0.95)";
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.arc(s * 0.45, 0, s * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = isDefend ? "rgba(160, 245, 255, 0.8)" : "rgba(255, 210, 110, 0.8)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawBoss2HpBar();
}

function drawBoss2HpBar() {
    const barW  = 380;
    const barH  = 18;
    const bx    = canvas.width / 2 - barW / 2;
    const by    = 16;
    const frac  = boss2.hp / BOSS2_HP_MAX;
    const fillW = frac * barW;

    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.font         = "bold 13px monospace";
    ctx.fillStyle    = "rgba(255, 210, 60, 0.9)";
    ctx.fillText("BOSS II", canvas.width / 2, by - 3);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx, by, barW, barH);

    const g = Math.round(150 * frac);
    ctx.fillStyle = `rgb(255, ${g}, 0)`;
    ctx.fillRect(bx, by, fillW, barH);

    ctx.strokeStyle = "rgba(255, 200, 60, 0.7)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
}
