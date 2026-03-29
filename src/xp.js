// ── XP & Leveling ─────────────────────────────────────────

const xpOrbs = [];
const XP_ORB_RADIUS = 6;
const XP_ORB_LIFESPAN = 12000; // ms before an uncollected orb despawns

let playerLevel = 1;
let playerXp = 0;
let xpToNextLevel = 5;

let upgradePending = false;
let upgradeChoices = [];

let levelUpFlashTimer = 0;   // counts down from 700ms; drives the screen flash
let levelUpEffectStart = 0;  // Date.now() when last level-up triggered; drives menu rings

// Accumulated upgrade bonuses — read by bullets.js at fire time
let upgBulletSpeedBonus = 0; // fraction added to base speed  (e.g. 0.2 = +20%)
let upgBulletSizeBonus  = 0; // pixels added to bullet radius
let upgFireRateBonus    = 0; // fraction removed from fire rate (e.g. 0.15 = 15% faster)
let upgPickupRadius     = 0; // extra px added to pickup detection radius

// ── Upgrade definitions ───────────────────────────────────

const ALL_UPGRADES = [
    {
        id: 'speed',
        label: 'SPEED BOOST',
        desc: 'Max speed +15%',
        color: '#00eeff',
        apply() {
            player.maxSpeed *= 1.15;
            player.accel    *= 1.15;
        },
    },
    {
        id: 'control',
        label: 'PRECISION',
        desc: 'Acceleration +25%',
        color: '#aaddff',
        apply() {
            // More accel = reaches top speed faster and stops faster relative to thrust,
            // without touching drag so terminal velocity (and top speed) is unaffected.
            player.accel *= 1.25;
        },
    },
    {
        id: 'fire_rate',
        label: 'RAPID FIRE',
        desc: 'Shoot 15% faster',
        color: '#ff8800',
        apply() { upgFireRateBonus += 0.15; },
    },
    {
        id: 'bullet_size',
        label: 'BIG SHOTS',
        desc: 'Bullet radius +1',
        color: '#ffdd00',
        apply() { upgBulletSizeBonus += 1; },
    },
    {
        id: 'bullet_speed',
        label: 'FAST SHOTS',
        desc: 'Bullet speed +20%',
        color: '#ff4488',
        apply() { upgBulletSpeedBonus += 0.20; },
    },
    {
        id: 'health',
        label: '+1 MAX HP',
        desc: '+1 max HP, restore 1',
        color: '#22cc44',
        apply() {
            PLAYER_MAX_HP += 1;
            player.hp = Math.min(player.hp + 1, PLAYER_MAX_HP);
        },
    },
    {
        id: 'pickup_radius',
        label: 'REACH',
        desc: 'Pickup radius +15px',
        color: '#ff44cc',
        apply() { upgPickupRadius += 15; },
    },
];

// ── Orb spawning & collection ─────────────────────────────

function dropXpOrb(x, y) {
    xpOrbs.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        hitRadius: XP_ORB_RADIUS,
        life: XP_ORB_LIFESPAN,
    });
}

function updateLevelUpFlash(dt) {
    if (levelUpFlashTimer > 0) levelUpFlashTimer = Math.max(0, levelUpFlashTimer - dt);
}

function drawLevelUpFlash() {
    if (levelUpFlashTimer <= 0) return;
    const t = 1 - levelUpFlashTimer / 700; // 0 → 1 over 700ms
    // Quick ramp up in first 15%, then fade out
    const alpha = t < 0.15
        ? (t / 0.15) * 0.45
        : (1 - (t - 0.15) / 0.85) * 0.45;
    ctx.save();
    ctx.fillStyle = `rgba(100, 255, 180, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function levelUp() {
    levelUpFlashTimer  = 700;
    levelUpEffectStart = Date.now();
    playerLevel += 1;
    xpToNextLevel = playerLevel * 5;

    // Pick 3 unique random upgrades via Fisher-Yates shuffle
    const pool = [...ALL_UPGRADES];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    upgradeChoices = pool.slice(0, 3);
    upgradePending = true;
}

function applyUpgrade(index) {
    upgradeChoices[index].apply();
    upgradePending = false;
    upgradeChoices = [];
    player.iFrames = Math.max(player.iFrames, 2000); // 2s invincibility on resume
}

function updateXpOrbs(dt) {
    const seconds = dt / 1000;
    for (let i = xpOrbs.length - 1; i >= 0; i--) {
        const orb = xpOrbs[i];

        // Magnet pull
        if (magnetTimer > 0) {
            const dx   = player.x - orb.x;
            const dy   = player.y - orb.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MAGNET_RADIUS && dist > 1) {
                const force = (1 - dist / MAGNET_RADIUS) * 900;
                orb.vx += (dx / dist) * force * seconds;
                orb.vy += (dy / dist) * force * seconds;
                // cap attraction speed
                const spd = Math.sqrt(orb.vx * orb.vx + orb.vy * orb.vy);
                if (spd > 600) { orb.vx = orb.vx / spd * 600; orb.vy = orb.vy / spd * 600; }
            }
        }

        // Brief drift, then settle
        orb.x  += orb.vx * seconds;
        orb.y  += orb.vy * seconds;
        orb.vx *= 0.90;
        orb.vy *= 0.90;

        orb.life -= dt;

        // Pickup — extended by upgPickupRadius
        const pickupDist = player.hitRadius + upgPickupRadius + orb.hitRadius;
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        if (dx * dx + dy * dy <= pickupDist * pickupDist) {
            xpOrbs.splice(i, 1);
            playerXp += 1;
            if (playerXp >= xpToNextLevel) {
                playerXp -= xpToNextLevel;
                levelUp();
            }
            continue;
        }

        if (orb.life <= 0) xpOrbs.splice(i, 1);
    }
}

// ── Drawing ───────────────────────────────────────────────

function drawXpOrbs() {
    const t = Date.now() / 300;
    for (const orb of xpOrbs) {
        const alpha = Math.min(1, orb.life / 2000);
        const pulse = 1 + Math.sin(t + orb.x * 0.05) * 0.2;
        const r = XP_ORB_RADIUS * pulse;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Glow
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 255, 180, 0.12)';
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120, 255, 180, 0.92)';
        ctx.fill();

        ctx.restore();
    }
}

function drawXpBar() {
    const barW = 120;
    const barH = 8;
    const x = 20;
    const y = 36; // sits just below the health bar

    const fill = xpToNextLevel > 0 ? playerXp / xpToNextLevel : 1;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barW, barH);

    ctx.fillStyle = 'rgba(100, 255, 180, 0.9)';
    ctx.fillRect(x, y, barW * fill, barH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(180, 255, 210, 0.9)';
    ctx.fillText('LVL ' + playerLevel, x + barW + 6, y + barH / 2);
}

function drawUpgradeMenu() {
    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx   = canvas.width  / 2;
    const cy   = canvas.height / 2;
    const elapsed = Date.now() - levelUpEffectStart;

    // ── One-shot shockwave rings from player position ─────
    // 4 rings staggered by 100ms each, all done within ~600ms
    const burstDuration = 600;
    ctx.save();
    for (let i = 0; i < 4; i++) {
        const ringElapsed = elapsed - i * 100;
        if (ringElapsed <= 0) continue;
        const progress = Math.min(1, ringElapsed / burstDuration);
        const radius   = progress * 260;
        const alpha    = (1 - progress) * 0.55;
        ctx.beginPath();
        ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 255, 180, ${alpha})`;
        ctx.lineWidth   = 3;
        ctx.stroke();
    }
    ctx.restore();

    // ── Title with scale-in ───────────────────────────────
    // Ease-out cubic: 0→1 over first 350ms
    const titleProgress = Math.min(1, elapsed / 350);
    const titleScale    = 1 - Math.pow(1 - titleProgress, 3);

    ctx.save();
    ctx.translate(cx, 118);
    ctx.scale(titleScale, titleScale);
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.font          = 'bold 44px monospace';
    ctx.fillStyle     = 'rgba(120, 255, 180, 0.95)';
    ctx.fillText('LEVEL UP!', 0, 0);
    ctx.restore();

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 15px monospace';
    ctx.fillStyle    = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('Level ' + playerLevel + '  —  choose an upgrade', cx, 158);

    // Cards
    const cardW = 200;
    const cardH = 140;
    const gap   = 22;
    const totalW = cardW * 3 + gap * 2;
    const startX = cx - totalW / 2;
    const cardY  = 200;

    drawUpgradeMenu.cardBounds = [];

    for (let i = 0; i < upgradeChoices.length; i++) {
        const upg   = upgradeChoices[i];
        const cardX = startX + i * (cardW + gap);
        const hover = mouse.x >= cardX && mouse.x <= cardX + cardW &&
                      mouse.y >= cardY && mouse.y <= cardY + cardH;

        // Card fill
        ctx.fillStyle = hover ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(cardX, cardY, cardW, cardH);

        // Colored accent bar at top
        ctx.fillStyle = upg.color;
        ctx.fillRect(cardX, cardY, cardW, 4);

        // Card border
        ctx.strokeStyle = hover ? upg.color : 'rgba(255,255,255,0.18)';
        ctx.lineWidth   = hover ? 2 : 1;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // Upgrade label
        ctx.font          = 'bold 14px monospace';
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'top';
        ctx.fillStyle     = upg.color;
        ctx.fillText(upg.label, cardX + cardW / 2, cardY + 18);

        // Separator line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(cardX + 16, cardY + 40);
        ctx.lineTo(cardX + cardW - 16, cardY + 40);
        ctx.stroke();

        // Description
        ctx.font      = '13px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.fillText(upg.desc, cardX + cardW / 2, cardY + 52);

        // "Click" hint at bottom
        ctx.font      = '11px monospace';
        ctx.fillStyle = hover ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)';
        ctx.textBaseline = 'bottom';
        ctx.fillText('CLICK TO SELECT', cardX + cardW / 2, cardY + cardH - 10);

        drawUpgradeMenu.cardBounds.push({ x: cardX, y: cardY, w: cardW, h: cardH, index: i });
    }
}
