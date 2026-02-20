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

// ── Resolve bullet-enemy hits each frame ─────────────────
function updateCollisions() {
    Collision.bulletsVsEnemies((bullet, bi, enemy, ei) => {
        // Remove the bullet
        bullets.splice(bi, 1);

        // Damage the enemy
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
            enemies.splice(ei, 1);
        }
    });
}
