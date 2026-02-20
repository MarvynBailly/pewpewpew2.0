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
            dropXpOrb(enemy.x, enemy.y);
            enemies.splice(ei, 1);
            score += 1;
        }
    });

    // Bullets vs boss
    if (boss) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bullets[bi], boss)) {
                bullets.splice(bi, 1);
                boss.hp -= 1;
                if (boss.hp <= 0) { onBossDeath(); break; }
            }
        }
    }

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
                    dropXpOrb(e.x, e.y);
                    enemies.splice(ei, 1);
                    score += 1;
                }
            }
        }
    }

    // Missiles vs boss
    if (boss) {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(missiles[mi], boss)) {
                triggerExplosion(missiles[mi].x, missiles[mi].y);
                missiles.splice(mi, 1);
                boss.hp -= 5; // missile does heavy damage
                if (boss.hp <= 0) { onBossDeath(); break; }
            }
        }
    }

    // Boss bullets vs player
    if (player.alive && player.iFrames <= 0) {
        for (let bi = bossBullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bossBullets[bi], player)) {
                bossBullets.splice(bi, 1);
                if (shieldHp > 0) {
                    shieldHp = 0;
                    player.iFrames = 500;
                } else {
                    player.hp -= 1;
                    player.iFrames = 1000;
                    if (player.hp <= 0) player.alive = false;
                }
                break;
            }
        }
    }

    // Boss body vs player
    if (boss && bossWarningTimer <= 0 && player.alive && player.iFrames <= 0) {
        if (Collision.circleVsCircle(player, boss)) {
            if (shieldHp > 0) {
                shieldHp = 0;
                player.iFrames = 500;
            } else {
                player.hp -= 1;
                player.iFrames = 1000;
                if (player.hp <= 0) player.alive = false;
            }
        }
    }

    // Player bullets vs boss2
    if (boss2) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bullets[bi], boss2)) {
                bullets.splice(bi, 1);
                boss2.hp -= 1;
                if (boss2.hp <= 0) { onBoss2Death(); break; }
            }
        }
    }

    // Player missiles vs boss2
    if (boss2) {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(missiles[mi], boss2)) {
                triggerExplosion(missiles[mi].x, missiles[mi].y);
                missiles.splice(mi, 1);
                boss2.hp -= 5;
                if (boss2.hp <= 0) { onBoss2Death(); break; }
            }
        }
    }

    // Boss2 homing missiles vs player
    if (player.alive && player.iFrames <= 0) {
        for (let mi = boss2Missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(boss2Missiles[mi], player)) {
                boss2Missiles.splice(mi, 1);
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
        }
    }

    // Boss2 spread bullets vs player
    if (player.alive && player.iFrames <= 0) {
        for (let bi = boss2Bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(boss2Bullets[bi], player)) {
                boss2Bullets.splice(bi, 1);
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
        }
    }

    // Boss2 body vs player (deals damage during dash in attack phase)
    if (boss2 && boss2WarningTimer <= 0 && boss2DashActive && player.alive && player.iFrames <= 0) {
        if (Collision.circleVsCircle(player, boss2)) {
            if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
            else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
        }
    }

    // Player vs powerups (extended by upgPickupRadius)
    for (let pi = powerups.length - 1; pi >= 0; pi--) {
        const p = powerups[pi];
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const pickupDist = player.hitRadius + upgPickupRadius + p.hitRadius;
        if (dx * dx + dy * dy <= pickupDist * pickupDist) {
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
                    dropXpOrb(e.x, e.y);
                    enemies.splice(ei, 1);
                    player.iFrames = 500;
                    break;
                }

                player.hp -= 1;
                player.iFrames = 1000; // 1 second of invincibility

                // Destroy the enemy on contact
                dropXpOrb(e.x, e.y);
                enemies.splice(ei, 1);

                if (player.hp <= 0) {
                    player.alive = false;
                }
                break; // only take one hit per frame
            }
        }
    }
}
