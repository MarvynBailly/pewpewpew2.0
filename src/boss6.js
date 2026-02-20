// ── Boss 6 — The Berserker ────────────────────────────────
// BRAWL mode:  aggressive pursuit, 3-bullet spread on cooldown
// TAUNT mode:  stops, immune window, omnidirectional burst, then resumes
// Phase 2 at 50% HP (PERMANENT — modes replaced):
//   BRAWL → FRENZY: max speed 500, 360° spray while chasing, wall bounce
//   TAUNT → RAMPAGE: shorter immunity, denser burst, immediately dashes to player

const B6_HP_MAX        = 90;
const B6_SIZE          = 45;
const B6_MAX_SPEED     = 230;
const B6_MODE_DURATION = 11000;

// BRAWL
const B6_SPREAD_INTERVAL = 1600; // ms between spread shots
const B6_SPREAD_ANGLE    = 20 * Math.PI / 180;
const B6_SPREAD_SPEED    = 300;  // px/s
const B6_SPREAD_RADIUS   = 6;

// TAUNT
const B6_TAUNT_IMMUNE    = 2000; // ms immune window (phase 1)
const B6_TAUNT_IMMUNE_P2 = 800;  // phase 2 (shorter — less warning)
const B6_BURST_COUNT     = 16;   // omnidirectional burst bullets
const B6_BURST_COUNT_P2  = 24;
const B6_BURST_SPEED     = 260;

// FRENZY (phase 2 BRAWL)
const B6_FRENZY_SPEED    = 500;
const B6_SPRAY_COUNT     = 12;   // 360° spray bullets
const B6_SPRAY_INTERVAL  = 800;

// RAMPAGE dash (phase 2 after TAUNT burst)
const B6_DASH_SPEED    = 750;
const B6_DASH_DURATION = 500;

// ── State ─────────────────────────────────────────────────
let boss6              = null;
let boss6Spawned       = false;
let boss6WarningTimer  = 0;
let boss6Mode          = "brawl"; // "brawl" | "taunt"
let boss6ModeTimer     = B6_MODE_DURATION;
let boss6Phase2        = false;
let boss6ModeFlash     = 0;
let boss6Shielded      = false;   // true during TAUNT immune window

let boss6SpreadTimer   = B6_SPREAD_INTERVAL;
let boss6TauntTimer    = 0;       // immune window countdown

let boss6DashActive    = false;
let boss6DashTimer     = 0;
let boss6DashVx        = 0;
let boss6DashVy        = 0;

const boss6Bullets   = [];
const boss6DashTrail = [];

// ── Spawn / Death ─────────────────────────────────────────
function spawnBoss6() {
    boss6 = {
        x: canvas.width / 2,
        y: -B6_SIZE * 3,
        hp: B6_HP_MAX,
        hitRadius: B6_SIZE,
        maxForce: 700,
    };
    Physics.initBody(boss6, { accel: 0, maxSpeed: B6_MAX_SPEED, drag: 0.992 });

    boss6Spawned          = true;
    boss6WarningTimer     = 2500;
    boss6Mode             = "brawl";
    boss6ModeTimer        = B6_MODE_DURATION;
    boss6Phase2           = false;
    boss6ModeFlash        = 0;
    boss6Shielded         = false;
    boss6SpreadTimer      = B6_SPREAD_INTERVAL;
    boss6TauntTimer       = 0;
    boss6DashActive       = false;
    boss6DashTimer        = 0;
    boss6Bullets.length   = 0;
    boss6DashTrail.length = 0;
}

function onBoss6Death() {
    score += 65;
    for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        dropXpOrb(
            boss6.x + Math.cos(a) * B6_SIZE * (0.5 + Math.random()),
            boss6.y + Math.sin(a) * B6_SIZE * (0.5 + Math.random())
        );
    }
    triggerExplosion(boss6.x, boss6.y);

    boss6                 = null;
    boss6Bullets.length   = 0;
    boss6DashTrail.length = 0;
    advanceBossQueue();
}

// ── Weapons ───────────────────────────────────────────────
function _b6FireSpread() {
    const base = Math.atan2(player.y - boss6.y, player.x - boss6.x);
    for (const delta of [-B6_SPREAD_ANGLE, 0, B6_SPREAD_ANGLE]) {
        const a = base + delta;
        boss6Bullets.push({
            x:         boss6.x + Math.cos(a) * (B6_SIZE + 8),
            y:         boss6.y + Math.sin(a) * (B6_SIZE + 8),
            vx:        Math.cos(a) * B6_SPREAD_SPEED,
            vy:        Math.sin(a) * B6_SPREAD_SPEED,
            hitRadius: B6_SPREAD_RADIUS,
        });
    }
}

function _b6FireBurst(count) {
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.15;
        boss6Bullets.push({
            x:         boss6.x + Math.cos(a) * (B6_SIZE + 8),
            y:         boss6.y + Math.sin(a) * (B6_SIZE + 8),
            vx:        Math.cos(a) * B6_BURST_SPEED,
            vy:        Math.sin(a) * B6_BURST_SPEED,
            hitRadius: B6_SPREAD_RADIUS,
        });
    }
}

// ── Update ────────────────────────────────────────────────
function updateBoss6(dt) {
    if (!boss6) return;
    if (boss6WarningTimer > 0) { boss6WarningTimer -= dt; return; }

    const sec     = dt / 1000;
    const moveSec = freezeTimer > 0 ? sec * 0.3 : sec;
    const moveDt  = moveSec * 1000;

    // Phase 2 trigger (one-time, permanent)
    if (!boss6Phase2 && boss6.hp <= B6_HP_MAX / 2) {
        boss6Phase2        = true;
        boss6.maxSpeed     = B6_FRENZY_SPEED;
        boss6Mode          = "brawl"; // start in FRENZY
        boss6ModeTimer     = B6_MODE_DURATION;
        boss6Shielded      = false;
        boss6DashActive    = false;
        boss6SpreadTimer   = B6_SPRAY_INTERVAL;
    }

    // Move bullets (unaffected by freeze)
    for (let i = boss6Bullets.length - 1; i >= 0; i--) {
        const b = boss6Bullets[i];
        b.x += b.vx * sec;
        b.y += b.vy * sec;
        if (b.x < -80 || b.x > canvas.width + 80 ||
            b.y < -80 || b.y > canvas.height + 80) {
            boss6Bullets.splice(i, 1);
        }
    }

    // Age dash trail
    for (let i = boss6DashTrail.length - 1; i >= 0; i--) {
        boss6DashTrail[i].age += dt;
        if (boss6DashTrail[i].age > 280) boss6DashTrail.splice(i, 1);
    }

    // Mode transition
    boss6ModeFlash = Math.max(0, boss6ModeFlash - dt);
    boss6ModeTimer -= dt;
    if (boss6ModeTimer <= 0) {
        boss6Mode      = boss6Mode === "brawl" ? "taunt" : "brawl";
        boss6ModeTimer = B6_MODE_DURATION;
        boss6ModeFlash = 600;
        boss6Shielded  = false;
        if (boss6Mode === "taunt") {
            boss6TauntTimer = boss6Phase2 ? B6_TAUNT_IMMUNE_P2 : B6_TAUNT_IMMUNE;
            boss6Shielded   = true;
            boss6DashActive = false;
        } else {
            boss6SpreadTimer = boss6Phase2 ? B6_SPRAY_INTERVAL : B6_SPREAD_INTERVAL;
        }
    }

    // ── BRAWL / FRENZY ────────────────────────────────────
    if (boss6Mode === "brawl") {
        if (boss6DashActive) {
            // Rampage dash (phase 2 post-TAUNT burst)
            boss6DashTrail.push({ x: boss6.x, y: boss6.y, age: 0 });
            boss6.x += boss6DashVx * moveSec;
            boss6.y += boss6DashVy * moveSec;
            if (boss6.x < B6_SIZE)                 { boss6.x = B6_SIZE;                boss6DashVx =  Math.abs(boss6DashVx); }
            if (boss6.x > canvas.width  - B6_SIZE) { boss6.x = canvas.width - B6_SIZE; boss6DashVx = -Math.abs(boss6DashVx); }
            if (boss6.y < B6_SIZE)                 { boss6.y = B6_SIZE;                boss6DashVy =  Math.abs(boss6DashVy); }
            if (boss6.y > canvas.height - B6_SIZE) { boss6.y = canvas.height-B6_SIZE;  boss6DashVy = -Math.abs(boss6DashVy); }
            boss6DashTimer -= dt;
            if (boss6DashTimer <= 0) {
                boss6DashActive = false;
                boss6.vx = boss6DashVx * 0.1;
                boss6.vy = boss6DashVy * 0.1;
            }
        } else {
            steerArrive(boss6, player, moveDt);
            Physics.update(boss6, moveDt);
            if (boss6Phase2) {
                // Frenzy: bounce off walls instead of clamping
                if (boss6.x < B6_SIZE)                 { boss6.x = B6_SIZE;                boss6.vx =  Math.abs(boss6.vx); }
                if (boss6.x > canvas.width  - B6_SIZE) { boss6.x = canvas.width - B6_SIZE; boss6.vx = -Math.abs(boss6.vx); }
                if (boss6.y < B6_SIZE)                 { boss6.y = B6_SIZE;                boss6.vy =  Math.abs(boss6.vy); }
                if (boss6.y > canvas.height - B6_SIZE) { boss6.y = canvas.height-B6_SIZE;  boss6.vy = -Math.abs(boss6.vy); }
            } else {
                Physics.clampToBounds(boss6, B6_SIZE, B6_SIZE, canvas.width, canvas.height);
            }
        }

        boss6SpreadTimer -= dt;
        if (boss6SpreadTimer <= 0) {
            if (boss6Phase2) {
                _b6FireBurst(B6_SPRAY_COUNT);
                boss6SpreadTimer = B6_SPRAY_INTERVAL;
            } else {
                _b6FireSpread();
                boss6SpreadTimer = B6_SPREAD_INTERVAL;
            }
        }

    // ── TAUNT / RAMPAGE ───────────────────────────────────
    } else {
        if (!boss6DashActive) {
            // Brake
            boss6.vx *= Math.pow(0.88, sec * 60);
            boss6.vy *= Math.pow(0.88, sec * 60);
            boss6.x  += boss6.vx * moveSec;
            boss6.y  += boss6.vy * moveSec;
            Physics.clampToBounds(boss6, B6_SIZE, B6_SIZE, canvas.width, canvas.height);
        }

        if (boss6Shielded) {
            boss6TauntTimer -= dt;
            if (boss6TauntTimer <= 0) {
                boss6Shielded = false;
                const count   = boss6Phase2 ? B6_BURST_COUNT_P2 : B6_BURST_COUNT;
                _b6FireBurst(count);
                // Phase 2: immediately dash at player
                if (boss6Phase2) {
                    const dx   = player.x - boss6.x;
                    const dy   = player.y - boss6.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    boss6DashVx    = (dx / dist) * B6_DASH_SPEED;
                    boss6DashVy    = (dy / dist) * B6_DASH_SPEED;
                    boss6DashActive = true;
                    boss6DashTimer  = B6_DASH_DURATION;
                }
            }
        } else if (boss6DashActive) {
            boss6DashTrail.push({ x: boss6.x, y: boss6.y, age: 0 });
            boss6.x += boss6DashVx * moveSec;
            boss6.y += boss6DashVy * moveSec;
            if (boss6.x < B6_SIZE)                 { boss6.x = B6_SIZE;                boss6DashVx =  Math.abs(boss6DashVx); }
            if (boss6.x > canvas.width  - B6_SIZE) { boss6.x = canvas.width - B6_SIZE; boss6DashVx = -Math.abs(boss6DashVx); }
            if (boss6.y < B6_SIZE)                 { boss6.y = B6_SIZE;                boss6DashVy =  Math.abs(boss6DashVy); }
            if (boss6.y > canvas.height - B6_SIZE) { boss6.y = canvas.height-B6_SIZE;  boss6DashVy = -Math.abs(boss6DashVy); }
            boss6DashTimer -= dt;
            if (boss6DashTimer <= 0) {
                boss6DashActive = false;
                boss6.vx = boss6DashVx * 0.08;
                boss6.vy = boss6DashVy * 0.08;
            }
        }
    }
}

// ── Draw ──────────────────────────────────────────────────
function drawBoss6() {
    if (boss6WarningTimer > 0) {
        const blink = (boss6WarningTimer % 500) < 250;
        if (blink) {
            ctx.fillStyle    = "rgba(100, 20, 0, 0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 68px monospace";
            ctx.fillStyle    = "rgba(255, 80, 20, 0.95)";
            ctx.fillText("! THE BERSERKER INCOMING !", canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    if (!boss6) return;

    if (boss6ModeFlash > 0) {
        const a = (boss6ModeFlash / 600) * 0.3;
        ctx.fillStyle = boss6Phase2 && boss6Mode === "brawl"
            ? `rgba(255, 30, 0, ${a})`
            : `rgba(200, 100, 0, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Dash trail
    for (const t of boss6DashTrail) {
        const frac = 1 - t.age / 280;
        ctx.beginPath();
        ctx.arc(t.x, t.y, B6_SIZE * frac * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 80, 0, ${frac * 0.38})`;
        ctx.fill();
    }

    // Bullets
    for (const b of boss6Bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, B6_SPREAD_RADIUS * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 60, 0, 0.13)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, B6_SPREAD_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = boss6Phase2
            ? "rgba(255, 40, 0, 0.97)"
            : "rgba(255, 130, 30, 0.95)";
        ctx.fill();
    }

    // Phase 2 shake offset
    const shakeX = boss6Phase2 ? (Math.random() - 0.5) * 4 : 0;
    const shakeY = boss6Phase2 ? (Math.random() - 0.5) * 4 : 0;

    const facingAngle = boss6DashActive
        ? Math.atan2(boss6DashVy, boss6DashVx)
        : Math.atan2(boss6.vy || -1, boss6.vx || 0);

    ctx.save();
    ctx.translate(boss6.x + shakeX, boss6.y + shakeY);
    ctx.rotate(facingAngle);

    // TAUNT immune flash ring
    if (boss6Shielded) {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime / 120);
        ctx.beginPath();
        ctx.arc(0, 0, B6_SIZE * 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 200, 60, ${0.4 + pulse * 0.5})`;
        ctx.lineWidth   = 5;
        ctx.stroke();
    }

    ctx.shadowColor = boss6Phase2
        ? "rgba(255, 20, 0, 1.0)"
        : (boss6Mode === "brawl" ? "rgba(255, 100, 0, 0.9)" : "rgba(255, 200, 50, 0.9)");
    ctx.shadowBlur = boss6DashActive ? 52 : 30;

    // Pentagon body
    const s = B6_SIZE;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a  = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * s;
        const py = Math.sin(a) * s;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = boss6Phase2
        ? (boss6Shielded ? "rgba(255, 80, 0, 0.97)" : "rgba(200, 20, 0, 0.95)")
        : (boss6Mode === "brawl" ? "rgba(180, 60, 0, 0.92)" : "rgba(220, 140, 0, 0.92)");
    ctx.fill();
    ctx.strokeStyle = boss6Phase2
        ? "rgba(255, 60, 0, 0.98)"
        : "rgba(255, 160, 40, 0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Core
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = boss6Phase2
        ? "rgba(255, 200, 80, 0.9)"
        : "rgba(255, 220, 120, 0.8)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawBoss6HpBar();
}

function drawBoss6HpBar() {
    const barW  = 420;
    const barH  = 20;
    const bx    = canvas.width / 2 - barW / 2;
    const by    = canvas.height - 46;
    const frac  = boss6.hp / B6_HP_MAX;
    const fillW = frac * barW;

    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.font         = "bold 13px monospace";
    ctx.fillStyle    = boss6Phase2
        ? "rgba(255, 50, 0, 0.95)"
        : "rgba(255, 160, 40, 0.9)";
    ctx.fillText(boss6Phase2 ? "THE BERSERKER  —  ENRAGED" : "THE BERSERKER", canvas.width / 2, by - 3);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx, by, barW, barH);

    ctx.fillStyle = boss6Phase2
        ? "rgb(220, 0, 0)"
        : `rgb(255, ${Math.round(150 * frac)}, 0)`;
    ctx.fillRect(bx, by, fillW, barH);

    ctx.strokeStyle = boss6Phase2
        ? "rgba(255, 40, 0, 0.8)"
        : "rgba(255, 160, 40, 0.7)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, barW, barH);
}
