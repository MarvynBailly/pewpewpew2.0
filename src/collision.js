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

    // ── Boss 3 collisions ─────────────────────────────────

    // Bullets vs boss3 (only when not shielded)
    if (boss3 && !boss3Shielded) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bullets[bi], boss3)) {
                bullets.splice(bi, 1);
                boss3.hp -= 1;
                if (boss3.hp <= 0) { onBoss3Death(); break; }
            }
        }
    }

    // Missiles vs boss3 (only when not shielded)
    if (boss3 && !boss3Shielded) {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(missiles[mi], boss3)) {
                triggerExplosion(missiles[mi].x, missiles[mi].y);
                missiles.splice(mi, 1);
                boss3.hp -= 5;
                if (boss3.hp <= 0) { onBoss3Death(); break; }
            }
        }
    }

    // Boss3 ring bullets vs player
    if (player.alive && player.iFrames <= 0) {
        for (let bi = boss3Bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(boss3Bullets[bi], player)) {
                boss3Bullets.splice(bi, 1);
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
        }
    }

    // Boss3 shockwaves vs player
    if (player.alive && player.iFrames <= 0) {
        for (const sw of boss3Shockwaves) {
            if (sw.startDelay > 0 || sw.radius <= 0 || sw.hasHit) continue;
            const dx   = player.x - sw.x;
            const dy   = player.y - sw.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Hit if player overlaps with the ring edge (ring has ~20px thickness)
            if (Math.abs(dist - sw.radius) < player.hitRadius + 20) {
                sw.hasHit = true;
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
        }
    }

    // Boss3 body vs player (SIEGE mode only — not shielded)
    if (boss3 && !boss3Shielded && boss3WarningTimer <= 0 && player.alive && player.iFrames <= 0) {
        if (Collision.circleVsCircle(player, boss3)) {
            if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
            else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
        }
    }

    // ── Boss 4 collisions ─────────────────────────────────

    // Bullets vs boss4
    if (boss4) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bullets[bi], boss4)) {
                bullets.splice(bi, 1);
                boss4.hp -= 1;
                if (boss4.hp <= 0) { onBoss4Death(); break; }
            }
        }
    }

    // Missiles vs boss4
    if (boss4) {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(missiles[mi], boss4)) {
                triggerExplosion(missiles[mi].x, missiles[mi].y);
                missiles.splice(mi, 1);
                boss4.hp -= 5;
                if (boss4.hp <= 0) { onBoss4Death(); break; }
            }
        }
    }

    // Boss4 bullets vs player
    if (player.alive && player.iFrames <= 0) {
        for (let bi = boss4Bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(boss4Bullets[bi], player)) {
                boss4Bullets.splice(bi, 1);
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
        }
    }

    // Boss4 sweeping laser beam vs player (phase 2 ANCHOR)
    if (boss4 && boss4Phase2 && boss4Mode === "anchor" && boss4BeamActive && player.alive && player.iFrames <= 0) {
        const lx1  = boss4.x;
        const ly1  = boss4.y;
        const lx2  = boss4.x + Math.cos(boss4BeamAngle) * B4_BEAM_LENGTH;
        const ly2  = boss4.y + Math.sin(boss4BeamAngle) * B4_BEAM_LENGTH;
        const ldx  = lx2 - lx1;
        const ldy  = ly2 - ly1;
        const lenSq = ldx * ldx + ldy * ldy;
        const t    = Math.max(0, Math.min(1, ((player.x - lx1) * ldx + (player.y - ly1) * ldy) / lenSq));
        const cx   = lx1 + t * ldx;
        const cy   = ly1 + t * ldy;
        const distSq = (player.x - cx) * (player.x - cx) + (player.y - cy) * (player.y - cy);
        const beamRadius = 8;
        if (distSq <= (player.hitRadius + beamRadius) * (player.hitRadius + beamRadius)) {
            if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
            else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
        }
    }

    // ── Boss 5 collisions ─────────────────────────────────

    // Bullets vs boss5
    if (boss5) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bullets[bi], boss5)) {
                bullets.splice(bi, 1);
                boss5.hp -= 1;
                if (boss5.hp <= 0) { onBoss5Death(); break; }
            }
        }
    }

    // Missiles vs boss5
    if (boss5) {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(missiles[mi], boss5)) {
                triggerExplosion(missiles[mi].x, missiles[mi].y);
                missiles.splice(mi, 1);
                boss5.hp -= 5;
                if (boss5.hp <= 0) { onBoss5Death(); break; }
            }
        }
    }

    // Boss5 bullets vs player
    if (player.alive && player.iFrames <= 0) {
        for (let bi = boss5Bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(boss5Bullets[bi], player)) {
                boss5Bullets.splice(bi, 1);
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
        }
    }

    // ── Boss 6 collisions ─────────────────────────────────

    // Bullets vs boss6 (only when not shielded)
    if (boss6 && !boss6Shielded) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bullets[bi], boss6)) {
                bullets.splice(bi, 1);
                boss6.hp -= 1;
                if (boss6.hp <= 0) { onBoss6Death(); break; }
            }
        }
    }

    // Missiles vs boss6 (only when not shielded)
    if (boss6 && !boss6Shielded) {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(missiles[mi], boss6)) {
                triggerExplosion(missiles[mi].x, missiles[mi].y);
                missiles.splice(mi, 1);
                boss6.hp -= 5;
                if (boss6.hp <= 0) { onBoss6Death(); break; }
            }
        }
    }

    // Boss6 bullets vs player
    if (player.alive && player.iFrames <= 0) {
        for (let bi = boss6Bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(boss6Bullets[bi], player)) {
                boss6Bullets.splice(bi, 1);
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
        }
    }

    // Boss6 body vs player during dash
    if (boss6 && !boss6Shielded && boss6WarningTimer <= 0 && boss6DashActive && player.alive && player.iFrames <= 0) {
        if (Collision.circleVsCircle(player, boss6)) {
            if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
            else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
        }
    }

    // ── Boss 7 collisions ─────────────────────────────────

    // Bullets vs boss7 (only when not shielded / HUNT mode)
    if (boss7 && !boss7Shielded) {
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(bullets[bi], boss7)) {
                bullets.splice(bi, 1);
                boss7.hp -= 1;
                if (boss7.hp <= 0) { onBoss7Death(); break; }
            }
        }
    }

    // Missiles vs boss7 (only when not shielded)
    if (boss7 && !boss7Shielded) {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(missiles[mi], boss7)) {
                triggerExplosion(missiles[mi].x, missiles[mi].y);
                missiles.splice(mi, 1);
                boss7.hp -= 5;
                if (boss7.hp <= 0) { onBoss7Death(); break; }
            }
        }
    }

    // Boss7 homing missiles vs player — on hit: spawn mini-enemy instead of damage
    if (player.alive && player.iFrames <= 0) {
        for (let mi = boss7Missiles.length - 1; mi >= 0; mi--) {
            if (Collision.circleVsCircle(boss7Missiles[mi], player)) {
                const m = boss7Missiles[mi];
                boss7Missiles.splice(mi, 1);
                // Spawn mini-enemies at impact
                const count = m.splitCount || 1;
                for (let k = 0; k < count; k++) {
                    const a = Math.random() * Math.PI * 2;
                    createEnemy(m.x + Math.cos(a) * 20, m.y + Math.sin(a) * 20);
                }
                break;
            }
        }
    }

    // Boss7 spiral bullets vs player
    if (player.alive && player.iFrames <= 0) {
        for (let bi = boss7Bullets.length - 1; bi >= 0; bi--) {
            if (Collision.circleVsCircle(boss7Bullets[bi], player)) {
                boss7Bullets.splice(bi, 1);
                if (shieldHp > 0) { shieldHp = 0; player.iFrames = 500; }
                else { player.hp -= 1; player.iFrames = 1000; if (player.hp <= 0) player.alive = false; }
                break;
            }
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
