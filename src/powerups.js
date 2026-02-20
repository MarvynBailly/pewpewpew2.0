// ── Powerups ──────────────────────────────────────────────

const powerups = [];
const missiles = [];
const explosions = [];

let fireModes = {}; // keys: 'trishot'|'minigun'|'missile'; values: { timer: ms }
                   // multiple modes can be active simultaneously — they stack
let freezeTimer = 0;       // ms remaining; enemies frozen while > 0
let shieldHp = 0;          // 1 = shield active, 0 = no shield

const POWERUP_TYPES = ['health', 'trishot', 'minigun', 'freeze', 'nuke', 'missile', 'shield'];
const POWERUP_RADIUS = 14;
const POWERUP_MAX_ON_SCREEN = 3;
const POWERUP_LIFESPAN = 15000; // ms

let powerupSpawnTimer = 5000; // first powerup appears after 5s
const POWERUP_SPAWN_INTERVAL = 1000; // ms between spawns (after first one)

const POWERUP_COLORS = {
    health:  { ring: '#22cc44', bg: '#116622' },
    trishot: { ring: '#00eeff', bg: '#006688' },
    minigun: { ring: '#ff8800', bg: '#884400' },
    freeze:  { ring: '#aaddff', bg: '#334466' },
    nuke:    { ring: '#aa44ff', bg: '#441166' },
    missile: { ring: '#ff4400', bg: '#882200' },
    shield:  { ring: '#ffdd00', bg: '#665500' },
};

const POWERUP_SYMBOLS = {
    health:  '+',
    trishot: '3',
    minigun: 'M',
    freeze:  '❄',
    nuke:    'N',
    missile: '!',
    shield:  '◯',
};

function spawnPowerup() {
    if (powerups.length >= POWERUP_MAX_ON_SCREEN) return;

    const margin = 60;
    const x = margin + Math.random() * (canvas.width - margin * 2);
    const y = margin + Math.random() * (canvas.height - margin * 2);
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];

    powerups.push({
        x, y,
        type,
        hitRadius: POWERUP_RADIUS,
        life: POWERUP_LIFESPAN,
    });
}

function pickupPowerup(type) {
    switch (type) {
        case 'health':
            player.hp = Math.min(PLAYER_MAX_HP, player.hp + 1);
            break;
        case 'trishot':
            fireModes.trishot = { timer: 6000 };
            break;
        case 'minigun':
            fireModes.minigun = { timer: 5000 };
            break;
        case 'freeze':
            freezeTimer = 4000;
            break;
        case 'nuke':
            score += enemies.length;
            enemies.length = 0;
            break;
        case 'missile':
            fireModes.missile = { timer: 8000 };
            break;
        case 'shield':
            shieldHp = 1;
            break;
    }
}

// ── Missiles ─────────────────────────────────────────────

const MISSILE_SPEED = 180;
const MISSILE_RADIUS = 8;

function spawnMissileAtAngle(angleDelta) {
    const baseAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    const angle = baseAngle + angleDelta;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    missiles.push({
        x: player.x + dirX * 18,
        y: player.y + dirY * 18,
        vx: dirX * MISSILE_SPEED + player.vx * 0.2,
        vy: dirY * MISSILE_SPEED + player.vy * 0.2,
        hitRadius: MISSILE_RADIUS,
    });
}

function spawnMissile() {
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    missiles.push({
        x: player.x + dirX * 18,
        y: player.y + dirY * 18,
        vx: dirX * MISSILE_SPEED + player.vx * 0.2,
        vy: dirY * MISSILE_SPEED + player.vy * 0.2,
        hitRadius: MISSILE_RADIUS,
    });
}

function updateMissiles(dt) {
    const seconds = dt / 1000;
    for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        m.x += m.vx * seconds;
        m.y += m.vy * seconds;

        if (m.x < -60 || m.x > canvas.width + 60 ||
            m.y < -60 || m.y > canvas.height + 60) {
            missiles.splice(i, 1);
        }
    }
}

// ── Explosions ───────────────────────────────────────────

const EXPLOSION_MAX_RADIUS = 70;
const EXPLOSION_DURATION = 400; // ms

function triggerExplosion(x, y, radius) {
    if (radius === undefined) radius = EXPLOSION_MAX_RADIUS;
    explosions.push({
        x, y,
        radius: 0,
        maxRadius: radius,
        timer: EXPLOSION_DURATION,
        maxTimer: EXPLOSION_DURATION,
    });
}

function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.timer -= dt;
        ex.radius = ex.maxRadius * (1 - ex.timer / ex.maxTimer);
        if (ex.timer <= 0) {
            explosions.splice(i, 1);
        }
    }
}

// ── Powerup update ───────────────────────────────────────

function updatePowerups(dt) {
    // Tick all active fire modes
    for (const key of Object.keys(fireModes)) {
        fireModes[key].timer -= dt;
        if (fireModes[key].timer <= 0) {
            delete fireModes[key];
        }
    }

    // Tick freeze
    if (freezeTimer > 0) {
        freezeTimer -= dt;
        if (freezeTimer < 0) freezeTimer = 0;
    }

    // Tick powerup lifespans
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].life -= dt;
        if (powerups[i].life <= 0) {
            powerups.splice(i, 1);
        }
    }

    // Spawn new powerups
    powerupSpawnTimer -= dt;
    if (powerupSpawnTimer <= 0) {
        spawnPowerup();
        powerupSpawnTimer = POWERUP_SPAWN_INTERVAL + Math.random() * 5000; // 10–15s
    }
}

// ── Drawing ──────────────────────────────────────────────

function drawPowerups() {
    const t = Date.now() / 400;
    for (const p of powerups) {
        const pulse = 1 + Math.sin(t) * 0.08;
        const r = POWERUP_RADIUS * pulse;
        const col = POWERUP_COLORS[p.type];

        // Fade out in last 3 seconds
        const fadeAlpha = Math.min(1, p.life / 3000);

        ctx.save();
        ctx.globalAlpha = fadeAlpha;

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
        ctx.fillStyle = col.ring + '33';
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = col.ring;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Background circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = col.bg;
        ctx.fill();

        // Symbol
        ctx.font = `bold ${Math.round(r * 1.1)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(POWERUP_SYMBOLS[p.type], p.x, p.y + 1);

        ctx.restore();
    }
}

function drawMissiles() {
    for (const m of missiles) {
        ctx.save();

        // Outer glow
        ctx.beginPath();
        ctx.arc(m.x, m.y, MISSILE_RADIUS * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 100, 30, 0.15)';
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(m.x, m.y, MISSILE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 140, 40, 0.95)';
        ctx.fill();

        ctx.restore();
    }
}

function drawExplosions() {
    for (const ex of explosions) {
        const progress = 1 - ex.timer / ex.maxTimer;
        const alpha = (1 - progress) * 0.7;

        ctx.save();

        // Outer ring
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 160, 30, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner fill
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 80, 10, ${alpha * 0.5})`;
        ctx.fill();

        ctx.restore();
    }
}

function drawShield() {
    if (shieldHp <= 0) return;

    const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
    const r = (player.hitRadius + 10) * pulse;

    ctx.save();

    // Outer glow
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 0, 0.08)';
    ctx.fill();

    // Shield ring
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 220, 0, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
}

function drawActiveAbilityHUD() {
    const pad = 20;
    const barW = 120;
    const barH = 10;
    let yOffset = 70; // below health bar

    // Fire modes — show a bar for each active one
    const modeColors  = { trishot: '#00eeff', minigun: '#ff8800', missile: '#ff4400' };
    const modeLabels  = { trishot: 'TRISHOT',  minigun: 'MINIGUN',  missile: 'MISSILE'  };
    const modeMaxTime = { trishot: 6000,       minigun: 5000,       missile: 8000       };
    for (const key of ['trishot', 'minigun', 'missile']) {
        if (!fireModes[key]) continue;
        const frac = Math.max(0, fireModes[key].timer / modeMaxTime[key]);
        const color = modeColors[key];

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = color;
        ctx.fillText(modeLabels[key], pad, yOffset);

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(pad, yOffset + 14, barW, barH);
        ctx.fillStyle = color;
        ctx.fillRect(pad, yOffset + 14, barW * frac, barH);
        ctx.restore();

        yOffset += 32;
    }

    // Freeze timer
    if (freezeTimer > 0) {
        const frac = Math.max(0, freezeTimer / 4000);

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#aaddff';
        ctx.fillText('FREEZE', pad, yOffset);

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(pad, yOffset + 14, barW, barH);
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(pad, yOffset + 14, barW * frac, barH);

        ctx.restore();
        yOffset += 32;
    }

    // Shield indicator
    if (shieldHp > 0) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#ffdd00';
        ctx.fillText('SHIELD ACTIVE', pad, yOffset);
        ctx.restore();
    }
}
