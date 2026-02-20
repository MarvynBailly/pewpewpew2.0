// ── Collision Detection ──────────────────────────────────
// Circle-based hit detection. Every entity just needs x, y, and hitRadius.
// Works with any sprite — just set hitRadius to match the art.

const Collision = {
    // Are two circles overlapping?
    circleVsCircle(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        const radii = a.hitRadius + b.hitRadius;
        return distSq <= radii * radii;
    },

    // Check all bullets against all enemies, call onHit(bullet, enemy) for each collision
    bulletsVsEnemies(onHit) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const e = enemies[ei];
                if (Collision.circleVsCircle(b, e)) {
                    onHit(b, bi, e, ei);
                    break; // bullet can only hit one enemy
                }
            }
        }
    },
};

// ── Resolve all collisions each frame ────────────────────
function updateCollisions() {
    // Bullets vs enemies
    Collision.bulletsVsEnemies((bullet, bi, enemy, ei) => {
        bullets.splice(bi, 1);

        enemy.hp -= 1;
        if (enemy.hp <= 0) {
            enemies.splice(ei, 1);
            score += 1;
        }
    });

    // Missiles vs enemies
    for (let mi = missiles.length - 1; mi >= 0; mi--) {
        const m = missiles[mi];
        let hit = false;
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            const e = enemies[ei];
            if (Collision.circleVsCircle(m, e)) {
                hit = true;
                break;
            }
        }
        if (hit) {
            triggerExplosion(m.x, m.y);
            missiles.splice(mi, 1);

            // Kill all enemies within explosion radius
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const e = enemies[ei];
                const dx = e.x - m.x;
                const dy = e.y - m.y;
                const distSq = dx * dx + dy * dy;
                if (distSq <= EXPLOSION_MAX_RADIUS * EXPLOSION_MAX_RADIUS) {
                    enemies.splice(ei, 1);
                    score += 1;
                }
            }
        }
    }

    // Player vs powerups
    for (let pi = powerups.length - 1; pi >= 0; pi--) {
        const p = powerups[pi];
        if (Collision.circleVsCircle(player, p)) {
            pickupPowerup(p.type);
            powerups.splice(pi, 1);
        }
    }

    // Enemies vs player
    if (player.alive && player.iFrames <= 0) {
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            const e = enemies[ei];
            if (Collision.circleVsCircle(player, e)) {
                // Shield absorbs the hit
                if (shieldHp > 0) {
                    shieldHp = 0;
                    enemies.splice(ei, 1);
                    player.iFrames = 500;
                    break;
                }

                player.hp -= 1;
                player.iFrames = 1000; // 1 second of invincibility

                // Destroy the enemy on contact
                enemies.splice(ei, 1);

                if (player.hp <= 0) {
                    player.alive = false;
                }
                break; // only take one hit per frame
            }
        }
    }
}
